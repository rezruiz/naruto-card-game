import { appendLog, appendWarning } from './phases/phaseMachine';
import { findOccupant, isCharacter, hasFieldOrientation, patchCharacter, patchOccupant } from './board';
import { canActivateNormalSpeed, pushStackItem, describeCost } from './stack';
import type { AbilityChoices, AbilitySpeed, AbilityType, BoardOccupant, GameState, PlayerId, Style } from './types';
import { getCharacterDef, getTokenDef } from './characters/registry';

export interface AbilityContext {
  state: GameState;
  sourceInstanceId: string;
  targetInstanceIds: string[];
  /** The player's answers to this ability's optional choices (see AbilityDef.choices) — absent when it offers none. */
  choices?: AbilityChoices;
}

/**
 * One optional decision an ability asks its controller for at activation —
 * an alternative cost, or an extra/alternative effect that needs some other
 * resource (e.g. "spend 1 Clay Charge for +2 damage", "pay +X Chakra for +X
 * reduction", "Straight or Bent path"). Never auto-decided by the engine.
 */
export type ChoiceSpec =
  | { id: string; kind: 'yesno'; prompt: string }
  | { id: string; kind: 'number'; prompt: string; min: number; max: number; initial?: number }
  | { id: string; kind: 'option'; prompt: string; options: { id: string; label: string }[] };

export interface AbilityDef {
  id: string;
  name: string;
  /**
   * Chakra cost. `payFromPool` at activation determines the generic/Pool
   * split. May be a function for cards whose cost varies by context (Hidan's
   * free self-target during his Ultimate, Sasori's Iron Sand Wall "3+X",
   * Yahiko's "2 + entire Pool").
   */
  cost: number | ((ctx: AbilityContext) => number);
  speed: AbilitySpeed;
  style: Style;
  type: AbilityType;
  isDamaging?: boolean;
  /** The token(s) this ability creates — the UI offers their card text as details (e.g. Animal Path's Beasts). */
  summons?: { defId: string; name: string }[];
  isUltimate?: boolean;
  isForbidden?: boolean;
  usesPerTurn?: number;
  /**
   * Abilities sharing the same tag on one source may only have ONE of them
   * (any combination) activated per turn — a restriction on top of, not a
   * replacement for, each ability's own usesPerTurn (e.g. Zetsu's Dual
   * Nature: switching freely doesn't help, since White Zetsu's and Black
   * Zetsu's abilities still share one use between them per turn).
   */
  sharedUseGroup?: string;
  /** Cost must be paid entirely from the source's resolved Chakra Pool — no generic-pool contribution allowed (e.g. Zetsu's Absorbed Vitality, "paid from the shared Reservoir only"). */
  requiresFullPoolPayment?: boolean;
  /** "N Chakra + the entire Pool" costs (Almighty Push, Yahiko Sacrifices Himself, Death is an Explosion): the whole Pool is always spent as part of the cost, whatever split the player asked for; the rest comes from generic Chakra. */
  spendsEntirePool?: boolean;
  /** Negates the targeting of an attack aimed at its own source (Crow Clone, Paper Clone, Shinra Tensei V2) — refused while that unit is under Spore Technique. */
  negatesTargetingOfSelf?: boolean;
  /** Can't be activated at all — it fires from its own trigger (the engine asks the controller at that moment). Shown on the card for reference only. */
  triggeredOnly?: boolean;
  /** UI hint: how many targets to collect before activating. Default 1. */
  maxTargets?: number;
  /**
   * Which side(s) each of targetInstanceIds may legally come from (SPEC.md
   * §9's free-targeting default + "any target" keyword override). Default
   * 'enemy'. Only checked when maxTargets !== 0 — abilities that find their
   * own target internally (the Reactive negation/redirect abilities) supply
   * no targetInstanceIds at all and skip this check regardless.
   */
  targetSide?: 'enemy' | 'ally' | 'any';
  /** Extra legality beyond the shared checks below (Trigger conditions, resource costs, etc.). */
  legalityCheck?: (ctx: AbilityContext) => boolean;
  /** The optional choices this ability offers right now (only those that currently apply — e.g. no charge prompt with 0 charges). Answers arrive in ctx.choices. */
  choices?: (ctx: AbilityContext) => ChoiceSpec[];
  resolve: (ctx: AbilityContext) => GameState;
}

/** Hidan with his Curse Technique active — his own side can't target him (SPEC.md, Hidan's Ultimate). */
export function cursingHidan(unit: BoardOccupant): boolean {
  return unit.defId === 'hidan' && unit.extra.curseActive === true;
}

function isElementalJutsu(ability: AbilityDef): boolean {
  return ability.type === 'Ninjutsu' && ability.style !== 'None';
}

/**
 * "First ability each turn costs 1 less" discounts (SPEC.md — Kakuzu's and
 * Yahiko's Elemental Versatility; Yahiko's Inspiring Leader, granted to his
 * allies rather than himself). Design/CHARACTER_LOG.md flags that these
 * wouldn't automatically stack if a character ever qualified for more than
 * one such source at once — so at most a single -1 applies per activation,
 * even if multiple sources are eligible; every eligible source is still
 * marked used, so it isn't then given away again to a later ability this turn.
 */
interface FirstAbilityDiscount {
  eligible: boolean;
  elemental: boolean;
  leader: boolean;
}

function computeFirstAbilityDiscount(ctx: AbilityContext, ability: AbilityDef): FirstAbilityDiscount {
  const found = findOccupant(ctx.state, ctx.sourceInstanceId);
  if (!found || !isCharacter(found.occupant)) return { eligible: false, elemental: false, leader: false };
  const source = found.occupant;
  const ownDef = getCharacterDef(source.defId);

  const elemental =
    !!ownDef?.elementalVersatility &&
    isElementalJutsu(ability) &&
    source.extra.elementalVersatilityUsedTurn !== ctx.state.turn;

  const hasLeaderAlly = ctx.state.players[found.player].backRow.some((c) => {
    if (!c || c.instanceId === source.instanceId || c.status.disabled || c.status.retreated) return false; // a triggered passive — off while Disabled or Retreated
    return !!getCharacterDef(c.defId)?.grantsInspiringLeader;
  });
  const leader = hasLeaderAlly && source.extra.inspiringLeaderUsedTurn !== ctx.state.turn;

  return { eligible: elemental || leader, elemental, leader };
}

/** Samehada Shark Transformation: "attackers targeting him pay +1 Chakra" — +1 for each transformed enemy Kisame among the targets. Shared with hand cards (playHandCard.ts). */
export function targetingSurcharge(state: GameState, actingPlayer: PlayerId | undefined, targetInstanceIds: string[]): number {
  let extra = 0;
  for (const id of new Set(targetInstanceIds)) {
    const t = findOccupant(state, id);
    if (t && t.player !== actingPlayer && t.occupant.defId === 'kisame' && t.occupant.extra.transformed) extra += 1;
  }
  return extra;
}

export function resolveCost(ability: AbilityDef, ctx: AbilityContext): number {
  const base = typeof ability.cost === 'function' ? ability.cost(ctx) : ability.cost;
  const discount = computeFirstAbilityDiscount(ctx, ability);
  let cost = discount.eligible ? Math.max(1, base - 1) : base;
  const source = findOccupant(ctx.state, ctx.sourceInstanceId);
  // Bingo Book: Threat Level C — the next ability used by the character that defeated its target costs 2 less.
  const bingoDiscount = (source?.occupant.extra.nextAbilityDiscount as number | undefined) ?? 0;
  if (bingoDiscount > 0) cost = Math.max(0, cost - bingoDiscount);
  return cost + targetingSurcharge(ctx.state, source?.player, ctx.targetInstanceIds);
}

/**
 * The Chakra Pool an occupant actually pays from, and where it lives:
 * - A Character always pays from its own Pool.
 * - A Token that carries its own chakraPool (Pain's Path tokens — SPEC.md's
 *   one exception to "Tokens have no Pool") pays from that.
 * - A Token naming extra.sharedPoolOwner (Zetsu's Shared Reservoir) pays
 *   from that other instance's Pool instead.
 * - Any other Token has no Pool at all (SPEC.md §10's default).
 */
function resolvePoolOwner(state: GameState, source: BoardOccupant): { instanceId: string; current: number } | undefined {
  if (isCharacter(source)) return { instanceId: source.instanceId, current: source.chakraPool.current };
  if (source.chakraPool) return { instanceId: source.instanceId, current: source.chakraPool.current };
  const ownerId = source.extra.sharedPoolOwner as string | undefined;
  if (!ownerId) return undefined;
  const found = findOccupant(state, ownerId);
  if (!found) return undefined;
  const owner = found.occupant;
  const current = isCharacter(owner) ? owner.chakraPool.current : owner.chakraPool?.current;
  return current === undefined ? undefined : { instanceId: ownerId, current };
}

/**
 * Every Pool this unit may spend from, in the order it spends them: its own
 * (or its shared Reservoir owner's) first, then — for Pain's Paths (Rinnegan
 * Reservoir) — every other Path's Pool.
 */
function poolSources(state: GameState, source: BoardOccupant): { instanceId: string; current: number }[] {
  const own = resolvePoolOwner(state, source);
  const sources = own ? [own] : [];
  if (!isCharacter(source) && source.chakraPool && source.defId.endsWith('-path')) {
    const found = findOccupant(state, source.instanceId);
    for (const t of found ? state.players[found.player].frontRow : []) {
      if (t && t.instanceId !== source.instanceId && t.defId.endsWith('-path') && t.chakraPool) sources.push({ instanceId: t.instanceId, current: t.chakraPool.current });
    }
  }
  return sources;
}

/** Total Chakra this unit could pay from Pools right now (see poolSources) — what the UI offers to split a cost against. */
export function poolAvailableFor(state: GameState, sourceInstanceId: string): number {
  const found = findOccupant(state, sourceInstanceId);
  return found ? poolSources(state, found.occupant).reduce((sum, s) => sum + s.current, 0) : 0;
}

function markStatusUsed(source: BoardOccupant, abilityId: string): BoardOccupant {
  return {
    ...source,
    status: { ...source.status, usedAbilitiesThisTurn: [...source.status.usedAbilitiesThisTurn, abilityId] },
  };
}

export function findAbility(defId: string, abilityId: string): AbilityDef | undefined {
  const charDef = getCharacterDef(defId);
  if (charDef) {
    return [...charDef.abilities, ...(charDef.ultimate ? [charDef.ultimate] : [])].find((a) => a.id === abilityId);
  }
  return getTokenDef(defId)?.abilities.find((a) => a.id === abilityId);
}

export interface Legality {
  ok: boolean;
  reason?: string;
}

export function checkLegality(
  state: GameState,
  sourceInstanceId: string,
  ability: AbilityDef,
  targetInstanceIds: string[],
  payFromPool: number,
  /** skipEvasion: don't flip the evasion coin — for read-only 'could this be legal?' probes (trust mode's meaningful-response check), which must be deterministic and side-effect free. */
  opts: { skipEvasion?: boolean; choices?: AbilityChoices } = {},
): Legality {
  const found = findOccupant(state, sourceInstanceId);
  if (!found) return { ok: false, reason: 'source not found' };
  const source: BoardOccupant = found.occupant;
  if (ability.triggeredOnly) return { ok: false, reason: `${ability.name} triggers on its own — it can't be activated.` };
  if (ability.spendsEntirePool) payFromPool = resolvePoolOwner(state, source)?.current ?? 0;

  if (source.status.disabled) return { ok: false, reason: `${source.name} is Disabled.` };
  if (source.status.retreated) return { ok: false, reason: `${source.name} is Retreated.` };
  // Pool-XOR-act (§5.3): pooling Chakra into a unit this turn blocks it from
  // acting for the rest of the turn (see chakra.ts's matching restriction).
  if (source.status.pooledThisTurn) {
    return { ok: false, reason: `${source.name} was pooled into this turn and can't act.` };
  }
  // Generic full stun (e.g. Itachi's Genjutsu: Mind Prison, Tsukuyomi) — blocks
  // every ability (unlike the narrower targetLockUntilTurn below), and also
  // blocks Chakra pooling (see chakra.ts's matching check).
  const stunUntil = source.extra.stunnedUntilTurn as number | undefined;
  if (stunUntil !== undefined && state.turn <= stunUntil) {
    return { ok: false, reason: `${source.name} is stunned.` };
  }
  // Spore Technique: can't negate the targeting of damage aimed at itself with its own ability.
  const sporeUntil = source.extra.cannotNegateOwnDamageUntilTurn as number | undefined;
  if (ability.negatesTargetingOfSelf && sporeUntil !== undefined && state.turn <= sporeUntil) {
    return { ok: false, reason: `${source.name} is under Spore Technique and can't negate attacks on itself.` };
  }
  // Almighty Push's lockouts: the other Paths wait for its delayed hit; Deva Path itself sits out 3 turn cycles.
  if (source.extra.lockedByAlmightyPush) return { ok: false, reason: `${source.name} is locked out until Almighty Push lands.` };
  const abilityLock = source.extra.abilityLockUntilTurn as number | undefined;
  if (abilityLock !== undefined && state.turn <= abilityLock) return { ok: false, reason: `${source.name} can't use abilities until turn ${abilityLock + 1}.` };
  const maxAbilitiesPerTurn = getCharacterDef(source.defId)?.maxAbilitiesPerTurn ?? getTokenDef(source.defId)?.maxAbilitiesPerTurn;
  if (maxAbilitiesPerTurn !== undefined && source.status.usedAbilitiesThisTurn.length >= maxAbilitiesPerTurn) {
    return { ok: false, reason: `${source.name} has already used its max abilities (${maxAbilitiesPerTurn}) this turn.` };
  }
  if (ability.isDamaging && hasFieldOrientation(state, source)) {
    return { ok: false, reason: `${source.name} has Field Orientation.` };
  }
  if (ability.speed === 'Normal' && !canActivateNormalSpeed(state, found.player)) {
    return { ok: false, reason: `${ability.name} is Normal speed — can only be activated on an empty stack during your own Main/Combat Phase.` };
  }
  // §4.5: a Normal-speed damage-dealing ability is a Combat Phase action; non-damaging (healing/support) Normal-speed abilities may be used in Main or Combat.
  if (ability.speed === 'Normal' && ability.isDamaging && state.phase !== 'Combat') {
    return { ok: false, reason: `${ability.name} deals damage — it can only be activated during your Combat Phase.` };
  }
  if (ability.speed !== 'Normal' && state.priorityPlayer !== found.player) {
    return { ok: false, reason: `${found.player} doesn't currently have priority.` };
  }
  if (ability.style !== 'None' && !(isCharacter(source) && source.styles.includes(ability.style))) {
    return { ok: false, reason: `${source.name} doesn't have Style: ${ability.style}.` };
  }
  // Generic "can't use abilities that target a character" stun (e.g. Kisame's
  // Water Prison Jutsu) — a character/token can set extra.targetLockUntilTurn
  // on a rival to block its targeted abilities through that turn number.
  const lockUntil = source.extra.targetLockUntilTurn as number | undefined;
  if (lockUntil !== undefined && state.turn <= lockUntil && (ability.maxTargets ?? 1) !== 0) {
    return { ok: false, reason: `${source.name} can't use abilities that target a character right now.` };
  }
  const used = source.status.usedAbilitiesThisTurn.filter((id) => id === ability.id).length;
  if (used >= (ability.usesPerTurn ?? 1)) {
    return { ok: false, reason: `${ability.name} already used the max times this turn.` };
  }
  if (ability.sharedUseGroup) {
    const groupUsed = source.status.usedAbilitiesThisTurn.some(
      (usedId) => findAbility(source.defId, usedId)?.sharedUseGroup === ability.sharedUseGroup,
    );
    if (groupUsed) {
      return { ok: false, reason: `${source.name} already used a "${ability.sharedUseGroup}" ability this turn.` };
    }
  }
  // Narrower cousin of the full stun above (e.g. Zetsu's Spore Technique) —
  // blocks only Type: Taijutsu abilities, nothing else.
  const taijutsuLockUntil = source.extra.taijutsuLockedUntilTurn as number | undefined;
  if (taijutsuLockUntil !== undefined && state.turn <= taijutsuLockUntil && ability.type === 'Taijutsu') {
    return { ok: false, reason: `${source.name} can't use Taijutsu abilities right now.` };
  }

  // Free targeting (SPEC.md §9): each chosen target must exist, be on the
  // correct side (enemy by default; 'ally' or 'any' override per-ability),
  // and not be Retreated (full targeting immunity, §6.5b — except when the
  // Retreated unit's controller has zero non-Retreated units left).
  if ((ability.maxTargets ?? 1) !== 0) {
    for (const targetId of targetInstanceIds) {
      const targetFound = findOccupant(state, targetId);
      if (!targetFound) return { ok: false, reason: `No such target.` };
      const side = ability.targetSide ?? 'enemy';
      const isAlly = targetFound.player === found.player;
      if (side === 'enemy' && isAlly) return { ok: false, reason: `${ability.name} can only target an enemy.` };
      if (side === 'ally' && !isAlly) return { ok: false, reason: `${ability.name} can only target an ally.` };
      if (isAlly && targetId !== sourceInstanceId && cursingHidan(targetFound.occupant)) {
        return { ok: false, reason: `Hidan can't be targeted by friendly attacks while his Curse is active.` };
      }
      if (targetFound.occupant.status.retreated) {
        const nonRetreatedExists = state.players[targetFound.player].backRow.some((c) => c && !c.status.retreated);
        if (nonRetreatedExists) return { ok: false, reason: `${targetFound.occupant.name} is Retreated and can't be targeted.` };
      }
    }
  }

  // Generic coin-flip evasion: extra.evasiveActive (e.g. Juzo Biwa's Hiding
  // Mist, a temporary effect) applies against any speed; extra.evasiveNormalOnly
  // (e.g. the Giant Drill-Beaked Bird's always-on Evasive trait) applies only
  // against Normal-speed attacks — a coin flip either way, checked once per
  // targeted instance in this activation.
  for (const targetId of targetInstanceIds) {
    const targetFound = findOccupant(state, targetId);
    const t = targetFound?.occupant;
    if (!t) continue;
    const evades = t.extra.evasiveActive || (t.extra.evasiveNormalOnly && ability.speed === 'Normal');
    if (evades && !opts.skipEvasion && Math.random() < 0.5) {
      return { ok: false, reason: `${t.name} evaded targeting.` };
    }
  }

  const ctx: AbilityContext = { state, sourceInstanceId, targetInstanceIds, choices: opts.choices };
  if (ability.legalityCheck && !ability.legalityCheck(ctx)) {
    return { ok: false, reason: `${ability.name}'s condition isn't met.` };
  }

  const cost = resolveCost(ability, ctx);
  const totalPool = payFromPool;
  const totalGeneric = cost - payFromPool;
  const poolAvailable = poolSources(state, source).reduce((sum, s) => sum + s.current, 0); // Tokens default to no Pool of their own (SPEC.md §10)
  if (totalPool < 0 || totalPool > poolAvailable) {
    return { ok: false, reason: `Not enough Chakra pooled in ${source.name}.` };
  }
  if (ability.requiresFullPoolPayment && totalGeneric !== 0) {
    return { ok: false, reason: `${ability.name} must be paid entirely from the Pool.` };
  }
  if (totalGeneric < 0 || totalGeneric > state.players[found.player].genericChakraAvailable) {
    return { ok: false, reason: `Not enough generic Chakra available.` };
  }

  return { ok: true };
}

function payCost(
  state: GameState,
  player: PlayerId,
  sourceInstanceId: string,
  cost: number,
  payFromPool: number,
  /** soft: trust mode — never pay more than is actually there (the shortfall is logged, not blocked). */
  soft = false,
): GameState {
  let next = state;
  const found = findOccupant(state, sourceInstanceId);
  if (soft) {
    const pooled = found ? poolSources(next, found.occupant).reduce((sum, s) => sum + s.current, 0) : 0;
    const fromPool = Math.min(payFromPool, pooled);
    const fromGeneric = Math.min(cost - fromPool, next.players[player].genericChakraAvailable);
    if (fromPool + fromGeneric < cost) {
      next = appendWarning(next, `${player} is short ${cost - fromPool - fromGeneric} Chakra paying for this action (trust mode — allowed).`);
    }
    payFromPool = fromPool;
    cost = fromPool + fromGeneric;
  }
  if (found && payFromPool > 0) {
    // Drain the unit's own Pool first, then (Pain's Paths) the other Paths' Pools.
    let remaining = payFromPool;
    for (const src of poolSources(next, found.occupant)) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, src.current);
      if (take <= 0) continue;
      remaining -= take;
      next = patchOccupant(next, src.instanceId, (o) => {
        const pool = isCharacter(o) ? o.chakraPool : o.chakraPool!;
        return { ...o, chakraPool: { ...pool, current: pool.current - take } } as BoardOccupant;
      });
    }
  }
  const p = next.players[player];
  return { ...next, players: { ...next.players, [player]: { ...p, genericChakraAvailable: p.genericChakraAvailable - (cost - payFromPool) } } };
}

/** Works for either row — a Token activating its own ability (e.g. Sasori's Third Kazekage) marks its own usage the same way a character does. */
function markUsed(state: GameState, player: PlayerId, sourceInstanceId: string, abilityId: string): GameState {
  const found = findOccupant(state, sourceInstanceId);
  if (!found) return state;
  const p = state.players[player];
  if (found.zone === 'back') {
    const backRow = p.backRow.slice();
    backRow[found.index] = markStatusUsed(backRow[found.index]!, abilityId) as typeof backRow[number];
    return { ...state, players: { ...state.players, [player]: { ...p, backRow } } };
  }
  const frontRow = p.frontRow.slice();
  frontRow[found.index] = markStatusUsed(frontRow[found.index]!, abilityId) as typeof frontRow[number];
  return { ...state, players: { ...state.players, [player]: { ...p, frontRow } } };
}

/**
 * Activate an ability: check legality, pay cost, mark used, push onto the
 * stack (SPEC.md §7 — every speed resolves via the stack).
 */
export function activateAbility(
  state: GameState,
  sourceInstanceId: string,
  abilityId: string,
  targetInstanceIds: string[],
  payFromPool: number,
  /** trust: skip the legality check and pay costs softly (trust mode — the players have agreed the play is legal). choices: the controller's answers to AbilityDef.choices. */
  opts: { trust?: boolean; choices?: AbilityChoices } = {},
): GameState {
  const found = findOccupant(state, sourceInstanceId);
  if (!found) return state;
  const { player, occupant: source } = found;
  const ability = findAbility(source.defId, abilityId);
  if (!ability) return appendLog(state, `No such ability: ${abilityId}.`);
  if (ability.triggeredOnly) return appendLog(state, `${ability.name} triggers on its own — it can't be activated.`);
  const choices = opts.choices;
  if (ability.spendsEntirePool) payFromPool = resolvePoolOwner(state, source)?.current ?? 0;

  if (!opts.trust) {
    const legality = checkLegality(state, sourceInstanceId, ability, targetInstanceIds, payFromPool, { choices });
    if (!legality.ok) return appendLog(state, `Can't activate ${ability.name}: ${legality.reason}`);
  }

  const costCtx: AbilityContext = { state, sourceInstanceId, targetInstanceIds, choices };
  const cost = resolveCost(ability, costCtx);
  const discount = computeFirstAbilityDiscount(costCtx, ability);
  let next = payCost(state, player, sourceInstanceId, cost, payFromPool, !!opts.trust);
  if (discount.elemental) {
    next = patchCharacter(next, sourceInstanceId, (c) => ({ ...c, extra: { ...c.extra, elementalVersatilityUsedTurn: state.turn } }));
  }
  if (discount.leader) {
    next = patchCharacter(next, sourceInstanceId, (c) => ({ ...c, extra: { ...c.extra, inspiringLeaderUsedTurn: state.turn } }));
  }
  next = markUsed(next, player, sourceInstanceId, ability.id);
  if (source.extra.nextAbilityDiscount) {
    next = patchOccupant(next, sourceInstanceId, (o) => ({ ...o, extra: { ...o.extra, nextAbilityDiscount: 0 } }));
  }

  const ctx: AbilityContext = { state: next, sourceInstanceId, targetInstanceIds, choices };
  next = pushStackItem(next, {
    id: `stack-${next.stack.length}-${sourceInstanceId}-${abilityId}`,
    controllerId: player,
    sourceInstanceId,
    sourceName: source.name,
    abilityId,
    abilityName: ability.name,
    targets: targetInstanceIds,
    costText: describeCost(cost, payFromPool),
    // Targets are read from the item at resolution time — a redirect may have rewritten them while it waited.
    resolve: (resolveState, item) => ability.resolve({ ...ctx, state: resolveState, targetInstanceIds: item?.targets ?? targetInstanceIds }),
  });
  return next;
}
