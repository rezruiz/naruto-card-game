import { findOccupant, isCharacter } from '../board';
import { activateAbility, checkLegality, findAbility, poolAvailableFor, resolveCost as abilityCost, type AbilityDef } from '../abilities';
import { checkHandCardLegality, playHandCard, resolveCost as cardCost } from '../cards/playHandCard';
import { getHandCardDef, needsEnablingCharacter } from '../cards/registry';
import { getCharacterDef, getTokenDef } from '../characters/registry';
import { appendLog, appendPrivateLog, appendWarning } from '../phases/phaseMachine';
import { enqueueChoice, registerChoiceResolver } from '../choices';
import { resolveTopOfStack } from '../stack';
import type { AbilityChoices, BoardOccupant, GameState, PlayerId, StackItem, StagedAction } from '../types';

/**
 * Trust mode (playtesting): players agree on legality out loud, so the
 * engine doesn't gate plays — it just records what each player has declared
 * (a "staged" action), lets them edit or withdraw it, and only calculates
 * the effects when the round is finalized. See PendingFinalize for the
 * approval handshake and hasMeaningfulResponse for when the opponent
 * actually needs to be asked.
 *
 * Order matters: declared actions resolve first-in-first-out (the first one
 * declared resolves first), and a responding player chooses where in that
 * queue their response goes — so a Substitution placed *ahead of* an attack
 * negates it, while one placed after it comes too late.
 */

export interface TrustHooks {
  /** Advances one phase (with all of the reducer's phase-entry automation). Injected because reducer.ts sits above this module in the import graph. */
  advance: (state: GameState) => GameState;
}

const PLAYERS: PlayerId[] = ['p1', 'p2'];
let stagedCounter = 0;

function listAbilities(defId: string): AbilityDef[] {
  const charDef = getCharacterDef(defId);
  if (charDef) return [...charDef.abilities, ...(charDef.ultimate ? [charDef.ultimate] : [])];
  return getTokenDef(defId)?.abilities ?? [];
}

function occupantsOf(state: GameState, player: PlayerId): BoardOccupant[] {
  const p = state.players[player];
  return [...p.backRow, ...p.frontRow].filter((o): o is BoardOccupant => !!o);
}

function toPlaceholder(a: StagedAction): StackItem {
  return {
    id: a.id,
    controllerId: a.owner,
    sourceInstanceId: a.sourceInstanceId,
    sourceName: a.label,
    abilityId: a.abilityId ?? getHandCardIdFor(a),
    abilityName: a.label,
    targets: a.targets,
    resolve: (s) => s,
  };
}

/** A staged card's stack `abilityId` is its card def id (negation.ts looks cards up by that). */
function getHandCardIdFor(a: StagedAction): string {
  return a.cardDefId ?? '';
}

/**
 * The strict-mode view of "what if this player acted right now": everything
 * currently staged sits on the stack as placeholders, this player holds
 * priority, and every untapped Chakra source counts as available (they can
 * still tap it before the round is finalized). Used only for read-only
 * legality probes — the result is never stored.
 */
function probeState(state: GameState, viewer: PlayerId, stack: StagedAction[]): GameState {
  const p = state.players[viewer];
  const untapped = p.chakraSources.filter((s) => !s.tapped).length;
  return {
    ...state,
    rules: 'strict',
    stack: stack.map(toPlaceholder),
    priorityPlayer: viewer,
    players: { ...state.players, [viewer]: { ...p, genericChakraAvailable: p.genericChakraAvailable + untapped } },
  };
}

function abilityWarnings(
  state: GameState,
  owner: PlayerId,
  sourceId: string,
  abilityId: string,
  targets: string[],
  payFromPool: number,
  choices?: AbilityChoices,
): string[] {
  const found = findOccupant(state, sourceId);
  const ability = found ? findAbility(found.occupant.defId, abilityId) : undefined;
  if (!ability) return ['Unknown ability.'];
  // Only the *other* player's staged actions count as "on the stack" for the purpose of this check — a player batching several of their own Normal-speed actions in one round is fine.
  const probe = probeState(state, owner, state.staged.filter((a) => a.owner !== owner));
  const result = checkLegality(probe, sourceId, ability, targets, payFromPool, { skipEvasion: true, choices });
  return result.ok ? [] : [result.reason ?? 'Not legal under the strict rules.'];
}

function cardWarnings(
  state: GameState,
  owner: PlayerId,
  cardInstanceId: string,
  enablerId: string,
  targets: string[],
  payFromPool: number,
  amount: number | undefined,
): string[] {
  const probe = probeState(state, owner, state.staged.filter((a) => a.owner !== owner));
  const result = checkHandCardLegality(probe, owner, cardInstanceId, enablerId, targets, payFromPool, amount);
  return result.ok ? [] : [result.reason ?? 'Not legal under the strict rules.'];
}

/** Why the strict rules would refuse declaring this ability right now (empty = legal) — the UI asks before forcing it through. */
export function abilityDeclarationWarnings(state: GameState, sourceId: string, abilityId: string, targets: string[], payFromPool: number, choices?: AbilityChoices): string[] {
  const found = findOccupant(state, sourceId);
  return found ? abilityWarnings(state, found.player, sourceId, abilityId, targets, payFromPool, choices) : [];
}

/** Same as abilityDeclarationWarnings, for playing a hand card. */
export function cardDeclarationWarnings(state: GameState, cardInstanceId: string, enablerId: string, targets: string[], payFromPool: number, amount: number | undefined): string[] {
  const owner = PLAYERS.find((id) => state.players[id].hand.some((h) => h.instanceId === cardInstanceId));
  return owner ? cardWarnings(state, owner, cardInstanceId, enablerId, targets, payFromPool, amount) : [];
}

/**
 * Where a new action lands in the queue. A response goes right *ahead of*
 * the first opposing action aimed at what it protects or targets (so a
 * Substitution lands before the attack it answers); anything else queues at
 * the end. Either player can then nudge their own items with moveStaged.
 */
function insertStaged(list: StagedAction[], action: StagedAction): StagedAction[] {
  const relevant = new Set([action.sourceInstanceId, ...action.targets].filter(Boolean));
  const index = list.findIndex((a) => a.owner !== action.owner && a.targets.some((t) => relevant.has(t)));
  if (index === -1) return [...list, action];
  return [...list.slice(0, index), action, ...list.slice(index)];
}

/** Any change to the staged list invalidates earlier approvals — the change's author counts as having approved their own edit. */
function afterStagedChange(state: GameState, actor: PlayerId, hooks: TrustHooks): GameState {
  if (!state.pendingFinalize) return state;
  return progressFinalize({ ...state, pendingFinalize: { ...state.pendingFinalize, approvals: [actor] } }, hooks);
}

export function stageAbility(
  state: GameState,
  instanceId: string,
  abilityId: string,
  targets: string[],
  payFromPool: number,
  hooks: TrustHooks,
  choices?: AbilityChoices,
  force = false,
): GameState {
  const found = findOccupant(state, instanceId);
  if (!found) return state;
  const ability = findAbility(found.occupant.defId, abilityId);
  if (!ability) return appendLog(state, `No such ability: ${abilityId}.`);
  const label = `${found.occupant.name}: ${ability.name}`;
  const warnings = abilityWarnings(state, found.player, instanceId, abilityId, targets, payFromPool, choices);
  if (warnings.length > 0 && !force) return refuseIllegal(state, found.player, label, warnings);
  stagedCounter += 1;
  const action: StagedAction = { id: `staged-${stagedCounter}`, owner: found.player, kind: 'ability', sourceInstanceId: instanceId, abilityId, label, targets, payFromPool, choices, warnings };
  return afterStagedChange(logDeclaration({ ...state, staged: insertStaged(state.staged, action) }, action), found.player, hooks);
}

/** An illegal declaration isn't made at all (nobody else ever sees it) unless the player forces it through. */
function refuseIllegal(state: GameState, player: PlayerId, label: string, warnings: string[]): GameState {
  return appendPrivateLog(state, player, `${label} isn't legal under the strict rules: ${warnings.join(' ')} Declare it with Force to push it through anyway.`, true);
}

/** What the opponent may know about a declaration: that one was made — its details stay with its owner until the round is finalized. */
function logDeclaration(state: GameState, action: StagedAction): GameState {
  let next = appendPrivateLog(state, action.owner, `${action.owner} declares ${action.label}.`);
  for (const warning of action.warnings) next = appendPrivateLog(next, action.owner, `${action.label}: ${warning} (forced through — trust mode).`, true);
  return appendLog(next, `${action.owner} declares an action.`);
}

/** How a declared action is named once it's revealed: a face-down card (a Mission) is never named. */
function publicLabel(action: StagedAction): string {
  const def = action.cardDefId ? getHandCardDef(action.cardDefId) : undefined;
  return def?.cardType === 'mission' ? 'a face-down Mission' : action.label;
}

export function stageCard(
  state: GameState,
  cardInstanceId: string,
  enablingInstanceId: string,
  targets: string[],
  payFromPool: number,
  amount: number | undefined,
  hooks: TrustHooks,
  force = false,
): GameState {
  const owner = PLAYERS.find((id) => state.players[id].hand.some((h) => h.instanceId === cardInstanceId && h.kind === 'card'));
  if (!owner) return appendLog(state, 'No such card in hand to play.');
  if (state.staged.some((a) => a.cardInstanceId === cardInstanceId)) return state;
  const entry = state.players[owner].hand.find((h) => h.instanceId === cardInstanceId);
  const def = entry && entry.kind === 'card' ? getHandCardDef(entry.defId) : undefined;
  if (!def) return appendLog(state, 'Unknown card.');
  const enabler = enablingInstanceId ? findOccupant(state, enablingInstanceId) : undefined;
  const label = enabler ? `${def.name} (enabled by ${enabler.occupant.name})` : def.name;
  const warnings = cardWarnings(state, owner, cardInstanceId, enablingInstanceId, targets, payFromPool, amount);
  if (warnings.length > 0 && !force) return refuseIllegal(state, owner, label, warnings);
  stagedCounter += 1;
  const action: StagedAction = {
    id: `staged-${stagedCounter}`,
    owner,
    kind: 'card',
    sourceInstanceId: enablingInstanceId,
    cardInstanceId,
    cardDefId: def.id,
    label,
    targets,
    payFromPool,
    amount,
    warnings,
  };
  return afterStagedChange(logDeclaration({ ...state, staged: insertStaged(state.staged, action) }, action), owner, hooks);
}

export function retargetStaged(state: GameState, stagedId: string, targets: string[], hooks: TrustHooks): GameState {
  const action = state.staged.find((a) => a.id === stagedId);
  if (!action) return state;
  const warnings =
    action.kind === 'ability'
      ? abilityWarnings(state, action.owner, action.sourceInstanceId, action.abilityId!, targets, action.payFromPool, action.choices)
      : cardWarnings(state, action.owner, action.cardInstanceId!, action.sourceInstanceId, targets, action.payFromPool, action.amount);
  const updated = { ...action, targets, warnings };
  const next = appendPrivateLog({ ...state, staged: state.staged.map((a) => (a.id === stagedId ? updated : a)) }, action.owner, `${action.owner} changes the target of ${action.label}.`);
  return afterStagedChange(next, action.owner, hooks);
}

/** Moves one declared action a step earlier or later in the resolution queue (a responder choosing where their response goes). */
export function moveStaged(state: GameState, stagedId: string, direction: 'earlier' | 'later', hooks: TrustHooks): GameState {
  const index = state.staged.findIndex((a) => a.id === stagedId);
  const target = direction === 'earlier' ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= state.staged.length) return state;
  const list = state.staged.slice();
  [list[index], list[target]] = [list[target], list[index]];
  const owner = state.staged[index].owner;
  return afterStagedChange(appendPrivateLog({ ...state, staged: list }, owner, `${owner} moves ${state.staged[index].label} ${direction} in the queue.`), owner, hooks);
}

export function unstage(state: GameState, stagedId: string, hooks: TrustHooks): GameState {
  const action = state.staged.find((a) => a.id === stagedId);
  if (!action) return state;
  const next = appendLog(appendPrivateLog({ ...state, staged: state.staged.filter((a) => a.id !== stagedId) }, action.owner, `${action.owner} withdraws ${action.label}.`), `${action.owner} withdraws a declared action.`);
  return afterStagedChange(next, action.owner, hooks);
}

/**
 * "Could this player usefully respond right now?" — true if they hold a
 * non-Normal-speed ability or hand card they can afford (Chakra in a Pool or
 * available, counting sources they could still tap) and that can target
 * something. Cards and abilities that take several targets only need ONE
 * valid target here, and their own multi-target conditions are ignored — this
 * is a "worth asking?" check, not a full legality check, so it errs toward
 * prompting. This is what keeps the OK prompt from appearing on every
 * action: a player with nothing to respond with is never asked.
 */
export function hasMeaningfulResponse(state: GameState, player: PlayerId): boolean {
  // Chakra already committed to this player's own declared actions isn't free to respond with.
  const committed = state.staged.filter((a) => a.owner === player).reduce((sum, a) => sum + Math.max(0, stagedCost(state, a).cost - a.payFromPool), 0);
  const base = probeState(state, player, state.staged);
  const bp = base.players[player];
  const probe = { ...base, players: { ...base.players, [player]: { ...bp, genericChakraAvailable: Math.max(0, bp.genericChakraAvailable - committed) } } };
  const mine = occupantsOf(probe, player);
  const everyone = PLAYERS.flatMap((id) => occupantsOf(probe, id)).map((o) => o.instanceId);
  const payOptions = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  const targetSets = (maxTargets: number | undefined): string[][] => ((maxTargets ?? 1) === 0 ? [[]] : everyone.map((id) => [id]));

  for (const occ of mine) {
    for (const ability of listAbilities(occ.defId)) {
      if (ability.speed === 'Normal') continue;
      // Several targets required? One valid target is enough to count — drop the ability's own multi-target condition.
      const probeAbility = (ability.maxTargets ?? 1) > 1 ? { ...ability, legalityCheck: undefined } : ability;
      for (const targets of targetSets(ability.maxTargets)) {
        for (const pay of payOptions) {
          if (checkLegality(probe, occ.instanceId, probeAbility, targets, pay, { skipEvasion: true }).ok) return true;
        }
      }
    }
  }

  const enablers = mine.filter(isCharacter).map((c) => c.instanceId);
  for (const entry of probe.players[player].hand) {
    if (entry.kind !== 'card') continue;
    const def = getHandCardDef(entry.defId);
    if (!def || def.speed === 'Normal') continue;
    const multiTarget = (def.maxTargets ?? 1) > 1;
    for (const enabler of needsEnablingCharacter(def) ? enablers : ['']) {
      for (const targets of targetSets(def.maxTargets)) {
        for (const pay of payOptions) {
          if (checkHandCardLegality(probe, player, entry.instanceId, enabler, targets, pay, undefined, { ignoreCondition: multiTarget }).ok) return true;
        }
      }
    }
  }
  return false;
}

/** Commits every staged action in queue order (paying costs softly), then resolves them first-in-first-out. The engine's stack resolves from the top, so the committed items are flipped: the first queued action ends up on top. Later items stay below it — which is exactly what lets an earlier response negate a later attack. */
function resolveAllStaged(state: GameState): GameState {
  const list = state.staged;
  // Retreated characters stay immune for the whole round, even if their controller's last active character falls part-way through it.
  const shield = PLAYERS.flatMap((id) => {
    const p = state.players[id];
    return p.backRow.some((c) => c && !c.status.retreated) ? p.backRow.filter((c) => c?.status.retreated).map((c) => c!.instanceId) : [];
  });
  let next: GameState = { ...state, staged: [], resolutionShield: shield };
  // The round is finalized: what was declared is revealed to both players (a face-down card stays unnamed).
  for (const a of list) {
    next = appendLog(next, `${a.owner}'s declared action is revealed: ${publicLabel(a)}.`);
    for (const warning of a.warnings) next = appendWarning(next, `${publicLabel(a)} was forced through: ${warning}`);
  }
  for (const a of list) {
    next =
      a.kind === 'ability'
        ? activateAbility(next, a.sourceInstanceId, a.abilityId!, a.targets, a.payFromPool, { trust: true, choices: a.choices })
        : playHandCard(next, a.owner, a.cardInstanceId!, a.sourceInstanceId, a.targets, a.payFromPool, a.amount, { trust: true });
  }
  next = { ...next, stack: next.stack.slice().reverse() };
  while (next.stack.length > 0 && !next.winner) next = resolveTopOfStack(next);
  return { ...next, resolutionShield: [], priorityPlayer: next.activePlayer, passesInARow: 0 };
}

function completeFinalize(state: GameState, hooks: TrustHooks): GameState {
  const advance = state.pendingFinalize?.advance ?? false;
  let next: GameState = { ...state, pendingFinalize: null };
  if (next.staged.length > 0) next = resolveAllStaged(next);
  return advance && !next.winner ? hooks.advance(next) : next;
}

/** Auto-approves anyone with nothing meaningful to respond with, and completes the round once everyone has approved. */
export function progressFinalize(state: GameState, hooks: TrustHooks): GameState {
  const pending = state.pendingFinalize;
  if (!pending) return state;
  const approvals = new Set<PlayerId>(pending.approvals);
  if (state.staged.length === 0) {
    PLAYERS.forEach((p) => approvals.add(p));
  } else {
    for (const p of PLAYERS) {
      // "Always confirm" makes every player confirm the round themselves, even with nothing to respond with.
      if (!approvals.has(p) && !state.options?.alwaysConfirm && !hasMeaningfulResponse(state, p)) approvals.add(p);
    }
  }
  const next: GameState = { ...state, pendingFinalize: { ...pending, approvals: [...approvals] } };
  return approvals.size === PLAYERS.length ? completeFinalize(next, hooks) : next;
}

/** What a declared action costs, and how much of that can only come out of a Pool (Pool-only and "entire Pool" costs). */
function stagedCost(state: GameState, a: StagedAction): { cost: number; poolOnly: number; poolUnit: string } {
  if (a.kind === 'ability') {
    const found = findOccupant(state, a.sourceInstanceId);
    const ability = found ? findAbility(found.occupant.defId, a.abilityId!) : undefined;
    if (!found || !ability) return { cost: 0, poolOnly: 0, poolUnit: a.sourceInstanceId };
    const cost = abilityCost(ability, { state, sourceInstanceId: a.sourceInstanceId, targetInstanceIds: a.targets, choices: a.choices });
    const poolOnly = ability.spendsEntirePool ? Math.min(cost, poolAvailableFor(state, a.sourceInstanceId)) : ability.requiresFullPoolPayment ? cost : 0;
    return { cost, poolOnly, poolUnit: a.sourceInstanceId };
  }
  const def = a.cardDefId ? getHandCardDef(a.cardDefId) : undefined;
  if (!def) return { cost: 0, poolOnly: 0, poolUnit: a.sourceInstanceId };
  const cost = cardCost(def, { state, player: a.owner, enablingInstanceId: a.sourceInstanceId, targetInstanceIds: a.targets, amount: a.amount }, a.payFromPool);
  return { cost, poolOnly: 0, poolUnit: a.sourceInstanceId };
}

function poolOf(state: GameState, unitId: string, isAbility: boolean): number {
  if (!unitId) return 0;
  if (isAbility) return poolAvailableFor(state, unitId);
  const found = findOccupant(state, unitId);
  return found?.occupant.chakraPool?.current ?? 0;
}

const POOL_TOP_UP = 'staged-pool-top-up';

/**
 * Costs are paid when the round resolves, from the Chakra the player has
 * actually tapped (§5) — plus their Pool only if they opt in. Checked in
 * queue order before anything resolves: a shortfall a Pool could cover is
 * asked about; anything else stops the resolve with a warning to tap Chakra
 * and try again.
 */
function checkPayments(state: GameState): GameState | null {
  const generic: Record<PlayerId, number> = { p1: state.players.p1.genericChakraAvailable, p2: state.players.p2.genericChakraAvailable };
  const poolSpent: Record<string, number> = {};
  for (const a of state.staged) {
    const { cost, poolOnly, poolUnit } = stagedCost(state, a);
    if (cost <= 0) continue;
    const isAbility = a.kind === 'ability';
    const poolLeft = poolOf(state, poolUnit, isAbility) - (poolSpent[poolUnit] ?? 0);
    const fromPool = Math.min(poolLeft, Math.max(poolOnly, a.payFromPool));
    const needGeneric = cost - fromPool;
    if (needGeneric <= generic[a.owner]) {
      generic[a.owner] -= needGeneric;
      poolSpent[poolUnit] = (poolSpent[poolUnit] ?? 0) + fromPool;
      continue;
    }
    const shortfall = needGeneric - generic[a.owner];
    const unitName = findOccupant(state, poolUnit)?.occupant.name ?? 'the character';
    if (!a.poolDeclined && poolLeft - fromPool >= shortfall) {
      return enqueueChoice(state, {
        player: a.owner,
        prompt: `${a.label} costs ${cost} Chakra but only ${generic[a.owner]} is tapped. Pay the other ${shortfall} from ${unitName}'s Pool?`,
        options: [
          { id: 'yes', label: `Yes — ${shortfall} from the Pool` },
          { id: 'no', label: "No — I'll tap Chakra" },
        ],
        min: 1,
        max: 1,
        resolverId: POOL_TOP_UP,
        data: { stagedId: a.id, shortfall },
      });
    }
    return appendWarning(
      state,
      `${a.owner} can't pay for ${a.label} yet (costs ${cost}, ${generic[a.owner] + fromPool} available) — tap your Chakra sources${a.poolDeclined ? '' : ' or pool Chakra'}, then resolve again.`,
    );
  }
  return null;
}

registerChoiceResolver(POOL_TOP_UP, (state, choice, optionIds) => {
  const stagedId = choice.data.stagedId as string;
  const shortfall = choice.data.shortfall as number;
  const yes = optionIds[0] === 'yes';
  const staged = state.staged.map((a) => (a.id === stagedId ? (yes ? { ...a, payFromPool: a.payFromPool + shortfall } : { ...a, poolDeclined: true }) : a));
  return appendPrivateLog({ ...state, staged }, choice.player, yes ? `${choice.player} will pay ${shortfall} from the Pool — resolve again to continue.` : `${choice.player} won't use the Pool — tap Chakra, then resolve again.`);
});

export function startFinalize(state: GameState, player: PlayerId, advance: boolean, hooks: TrustHooks): GameState {
  if (state.pendingFinalize) return state;
  if (player !== state.activePlayer) return appendLog(state, `Only the active player (${state.activePlayer}) can finalize.`);
  if (state.pendingChoices.some((c) => c.resolverId === POOL_TOP_UP)) return appendLog(state, 'Answer the Pool payment question first.');
  const unpaid = state.staged.length > 0 ? checkPayments(state) : null;
  if (unpaid) return unpaid;
  const next = appendLog(
    { ...state, pendingFinalize: { by: player, advance, approvals: [player] } },
    advance ? `${player} finalizes the ${state.phase} phase.` : `${player} asks to resolve the declared actions.`,
  );
  return progressFinalize(next, hooks);
}

export function approveResolve(state: GameState, player: PlayerId, hooks: TrustHooks): GameState {
  const pending = state.pendingFinalize;
  if (!pending || pending.approvals.includes(player)) return state;
  const next = appendLog({ ...state, pendingFinalize: { ...pending, approvals: [...pending.approvals, player] } }, `${player} has no response — OK.`);
  return progressFinalize(next, hooks);
}

export function cancelFinalize(state: GameState, player: PlayerId): GameState {
  if (!state.pendingFinalize || state.pendingFinalize.by !== player) return state;
  return appendLog({ ...state, pendingFinalize: null }, `${player} reopens the round to make changes.`);
}
