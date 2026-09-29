import { findOccupant, isCharacter } from '../board';
import { activateAbility, checkLegality, findAbility, type AbilityDef } from '../abilities';
import { checkHandCardLegality, playHandCard } from '../cards/playHandCard';
import { getHandCardDef } from '../cards/registry';
import { getCharacterDef, getTokenDef } from '../characters/registry';
import { appendLog } from '../phases/phaseMachine';
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
): GameState {
  const found = findOccupant(state, instanceId);
  if (!found) return state;
  const ability = findAbility(found.occupant.defId, abilityId);
  if (!ability) return appendLog(state, `No such ability: ${abilityId}.`);
  stagedCounter += 1;
  const action: StagedAction = {
    id: `staged-${stagedCounter}`,
    owner: found.player,
    kind: 'ability',
    sourceInstanceId: instanceId,
    abilityId,
    label: `${found.occupant.name}: ${ability.name}`,
    targets,
    payFromPool,
    choices,
    warnings: abilityWarnings(state, found.player, instanceId, abilityId, targets, payFromPool, choices),
  };
  const next = appendLog({ ...state, staged: insertStaged(state.staged, action) }, `${found.player} declares ${action.label}.`);
  return afterStagedChange(next, found.player, hooks);
}

export function stageCard(
  state: GameState,
  cardInstanceId: string,
  enablingInstanceId: string,
  targets: string[],
  payFromPool: number,
  amount: number | undefined,
  hooks: TrustHooks,
): GameState {
  const owner = PLAYERS.find((id) => state.players[id].hand.some((h) => h.instanceId === cardInstanceId && h.kind === 'card'));
  if (!owner) return appendLog(state, 'No such card in hand to play.');
  if (state.staged.some((a) => a.cardInstanceId === cardInstanceId)) return state;
  const entry = state.players[owner].hand.find((h) => h.instanceId === cardInstanceId);
  const def = entry && entry.kind === 'card' ? getHandCardDef(entry.defId) : undefined;
  if (!def) return appendLog(state, 'Unknown card.');
  const enabler = enablingInstanceId ? findOccupant(state, enablingInstanceId) : undefined;
  stagedCounter += 1;
  const action: StagedAction = {
    id: `staged-${stagedCounter}`,
    owner,
    kind: 'card',
    sourceInstanceId: enablingInstanceId,
    cardInstanceId,
    cardDefId: def.id,
    label: enabler ? `${def.name} (enabled by ${enabler.occupant.name})` : def.name,
    targets,
    payFromPool,
    amount,
    warnings: cardWarnings(state, owner, cardInstanceId, enablingInstanceId, targets, payFromPool, amount),
  };
  const next = appendLog({ ...state, staged: insertStaged(state.staged, action) }, `${owner} plays ${action.label}.`);
  return afterStagedChange(next, owner, hooks);
}

export function retargetStaged(state: GameState, stagedId: string, targets: string[], hooks: TrustHooks): GameState {
  const action = state.staged.find((a) => a.id === stagedId);
  if (!action) return state;
  const warnings =
    action.kind === 'ability'
      ? abilityWarnings(state, action.owner, action.sourceInstanceId, action.abilityId!, targets, action.payFromPool, action.choices)
      : cardWarnings(state, action.owner, action.cardInstanceId!, action.sourceInstanceId, targets, action.payFromPool, action.amount);
  const updated = { ...action, targets, warnings };
  const next = appendLog({ ...state, staged: state.staged.map((a) => (a.id === stagedId ? updated : a)) }, `${action.owner} changes the target of ${action.label}.`);
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
  return afterStagedChange(appendLog({ ...state, staged: list }, `${owner} moves ${state.staged[index].label} ${direction} in the queue.`), owner, hooks);
}

export function unstage(state: GameState, stagedId: string, hooks: TrustHooks): GameState {
  const action = state.staged.find((a) => a.id === stagedId);
  if (!action) return state;
  const next = appendLog({ ...state, staged: state.staged.filter((a) => a.id !== stagedId) }, `${action.owner} withdraws ${action.label}.`);
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
  const probe = probeState(state, player, state.staged);
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
    for (const enabler of def.cardType === 'assist' ? [''] : enablers) {
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
      if (!approvals.has(p) && !hasMeaningfulResponse(state, p)) approvals.add(p);
    }
  }
  const next: GameState = { ...state, pendingFinalize: { ...pending, approvals: [...approvals] } };
  return approvals.size === PLAYERS.length ? completeFinalize(next, hooks) : next;
}

export function startFinalize(state: GameState, player: PlayerId, advance: boolean, hooks: TrustHooks): GameState {
  if (state.pendingFinalize) return state;
  if (player !== state.activePlayer) return appendLog(state, `Only the active player (${state.activePlayer}) can finalize.`);
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
