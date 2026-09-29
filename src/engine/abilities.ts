import { appendLog } from './phases/phaseMachine';
import { findOccupant, isCharacter, isSummoningSick, patchCharacter, patchOccupant } from './board';
import { canActivateNormalSpeed, pushStackItem } from './stack';
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
  | { id: string; kind: 'number'; prompt: string; min: number; max: number }
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

export function resolveCost(ability: AbilityDef, ctx: AbilityContext): number {
  const base = typeof ability.cost === 'function' ? ability.cost(ctx) : ability.cost;
  const discount = computeFirstAbilityDiscount(ctx, ability);
  return discount.eligible ? Math.max(1, base - 1) : base;
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
  const maxAbilitiesPerTurn = getCharacterDef(source.defId)?.maxAbilitiesPerTurn ?? getTokenDef(source.defId)?.maxAbilitiesPerTurn;
  if (maxAbilitiesPerTurn !== undefined && source.status.usedAbilitiesThisTurn.length >= maxAbilitiesPerTurn) {
    return { ok: false, reason: `${source.name} has already used its max abilities (${maxAbilitiesPerTurn}) this turn.` };
  }
  if (ability.isDamaging && isSummoningSick(state, source)) {
    return { ok: false, reason: `${source.name} has summoning sickness.` };
  }
  if (ability.speed === 'Normal' && !canActivateNormalSpeed(state, found.player)) {
    return { ok: false, reason: `${ability.name} is Normal speed — can only be activated on an empty stack during your own Main/Combat Phase.` };
  }
  // §4.5: a Normal-speed damage-dealing ability is a Combat Phase action; non-damaging (support) Normal-speed abilities are Main Phase actions.
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
  const poolAvailable = resolvePoolOwner(state, source)?.current ?? 0; // Tokens default to no Pool of their own (SPEC.md §10)
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
    const poolOwner = found ? resolvePoolOwner(next, found.occupant) : undefined;
    const fromPool = Math.min(payFromPool, poolOwner?.current ?? 0);
    const fromGeneric = Math.min(cost - fromPool, next.players[player].genericChakraAvailable);
    if (fromPool + fromGeneric < cost) {
      next = appendLog(next, `${player} is short ${cost - fromPool - fromGeneric} Chakra paying for this action (trust mode — allowed).`);
    }
    payFromPool = fromPool;
    cost = fromPool + fromGeneric;
  }
  if (found && payFromPool > 0) {
    const poolOwner = resolvePoolOwner(next, found.occupant);
    if (poolOwner) {
      next = patchOccupant(next, poolOwner.instanceId, (o) => {
        const pool = isCharacter(o) ? o.chakraPool : o.chakraPool!;
        return { ...o, chakraPool: { ...pool, current: pool.current - payFromPool } } as BoardOccupant;
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
  const choices = opts.choices;

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

  const ctx: AbilityContext = { state: next, sourceInstanceId, targetInstanceIds, choices };
  next = pushStackItem(next, {
    id: `stack-${next.stack.length}-${sourceInstanceId}-${abilityId}`,
    controllerId: player,
    sourceInstanceId,
    sourceName: source.name,
    abilityId,
    abilityName: ability.name,
    targets: targetInstanceIds,
    resolve: (resolveState) => ability.resolve({ ...ctx, state: resolveState }),
  });
  return next;
}
