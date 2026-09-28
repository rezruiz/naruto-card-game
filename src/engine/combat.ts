import { appendLog, otherPlayer } from './phases/phaseMachine';
import { findOccupant, isCharacter, patchOccupant } from './board';
import type { AbilityType, GameState, PlayerId } from './types';
import { HEALTH_LOST_ON_DEFEAT } from './ranks';

/**
 * A character/token definition may register one of these to intercept its own
 * defeat (SPEC.md's recurring "instead of being defeated, X happens" pattern —
 * Kakuzu's Five Hearts, Hidan's Jashin's Blessing, Sasori's Hiruko->Hollow Body).
 * Return the replacement state if the hook fires, or null to let the defeat proceed.
 */
export type OnWouldBeDefeatedHook = (
  state: GameState,
  targetInstanceId: string,
) => GameState | null;

/**
 * Runs on every non-lethal-check of a damage instance against this character
 * (e.g. Hidan's Curse Technique mirroring damage he takes onto his Cursed
 * target). Return the state after any side effect, or null for no-op. Not
 * given a chance to change the amount/target of the original hit itself —
 * only to react to it.
 */
export type OnDamageTakenHook = (
  state: GameState,
  targetInstanceId: string,
  amount: number,
) => GameState | null;

export interface DamageResult {
  state: GameState;
  dealt: number;
  defeated: boolean;
}

/**
 * Shared damage pipeline: apply damage, then (if it would defeat the target)
 * give the target's own onWouldBeDefeated hook a chance to intercept before
 * an actual defeat is applied. Pure function over GameState.
 */
export function dealDamage(
  state: GameState,
  targetInstanceId: string,
  amount: number,
  opts: {
    type?: AbilityType;
    cannotBeReduced?: boolean;
    skipDamageTakenHook?: boolean;
    skipSquadRedirect?: boolean;
    /** An effect that was already running before its target Retreated (poison, Amaterasu) — SPEC.md §6.5b lets those keep ticking despite Retreat's full immunity. */
    ongoing?: boolean;
  } = {},
): DamageResult {
  if (amount <= 0) return { state, dealt: 0, defeated: false };

  const found = findOccupant(state, targetInstanceId);
  if (!found) return { state, dealt: 0, defeated: false };
  const { player, zone, index, occupant } = found;

  // §6.5b: a Retreated character can't be damaged at all — targeted or blanket — unless its controller has no non-Retreated character left, or the effect was already ongoing.
  if (occupant.status.retreated && !opts.ongoing && (state.resolutionShield.includes(occupant.instanceId) || state.players[player].backRow.some((c) => c && !c.status.retreated))) {
    return { state: appendLog(state, `${occupant.name} is Retreated and immune to damage.`), dealt: 0, defeated: false };
  }

  // Squad Formation (Mission, §13a): a single damage instance aimed at one
  // of the Mission's 3 chosen characters may be redirected to a different
  // member of the same group instead. NOTE (simplified for this pass):
  // auto-redirects to whichever other group member currently has the most
  // HP (protecting the weakest) — no interactive "controller's choice"
  // channel exists yet for picking which of the three absorbs it. The
  // redirected hit itself is never redirected again (skipSquadRedirect) —
  // otherwise a 2-member group would ping-pong the same instance forever.
  const squadGroup = occupant.extra.squadFormationGroup as string[] | undefined;
  if (!opts.skipSquadRedirect && squadGroup && squadGroup.length > 1) {
    let bestId: string | undefined;
    let bestHp = -1;
    for (const id of squadGroup) {
      if (id === targetInstanceId) continue;
      const other = findOccupant(state, id);
      if (other && other.occupant.currentHP > bestHp) {
        bestHp = other.occupant.currentHP;
        bestId = id;
      }
    }
    if (bestId) {
      const redirected = appendLog(state, `Squad Formation redirects the hit from ${occupant.name} to another member of the group.`);
      return dealDamage(redirected, bestId, amount, { ...opts, skipSquadRedirect: true });
    }
  }

  // Generic damage-prevention pool (SPEC.md's "prevent the next N damage this
  // turn" pattern — Yahiko's Water Pillar Wall, Sasori's Iron Sand Wall):
  // extra.damagePreventionRemaining is consumed 1-for-1 against any damage
  // this unit takes this turn, unless the source says it cannotBeReduced
  // (Amaterasu, Poison — an explicit, stronger override per SPEC.md).
  let effectiveAmount = amount;
  let next = state;
  if (!opts.cannotBeReduced) {
    const remaining = (occupant.extra.damagePreventionRemaining as number) ?? 0;
    const activeTurn = occupant.extra.damagePreventionUntilTurn as number | undefined;
    if (remaining > 0 && activeTurn === state.turn) {
      const consumed = Math.min(remaining, effectiveAmount);
      effectiveAmount -= consumed;
      next = setExtra(next, targetInstanceId, { damagePreventionRemaining: remaining - consumed });
      next = appendLog(next, `${occupant.name}'s damage prevention absorbs ${consumed}.`);
    }
  }
  if (effectiveAmount <= 0) {
    return { state: next, dealt: 0, defeated: false };
  }
  amount = effectiveAmount;

  const newHP = Math.max(0, occupant.currentHP - amount);
  const wouldDefeat = newHP === 0;

  next = setCurrentHP(next, player, zone, index, newHP);
  next = appendLog(next, `${occupant.name} takes ${amount} damage (${newHP}/${occupant.maxHP} HP).`);

  if (!opts.skipDamageTakenHook) {
    // A Disabled or Retreated character's triggered passives are off (§6.5a/§6.5b). Defeat-replacement passives are the exception — see the defeat hook below, which always runs.
    const inert = occupant.status.disabled || occupant.status.retreated;
    const dtHook = isCharacter(occupant) && !inert ? damageTakenHooks[occupant.defId] : undefined;
    if (dtHook) {
      const reacted = dtHook(next, targetInstanceId, amount);
      if (reacted) next = reacted;
    }
  }

  if (!wouldDefeat) {
    return { state: next, dealt: amount, defeated: false };
  }

  // Replacement-effect passives (Kakuzu's Five Hearts, Hidan's Jashin's Blessing, Hiruko's Hollow Body) still apply while Disabled or Retreated.
  const hook = isCharacter(occupant)
    ? getDefeatHook(occupant.defId)
    : getTokenDefeatHook(occupant.defId);
  if (hook) {
    const replaced = hook(next, targetInstanceId);
    if (replaced) {
      return { state: replaced, dealt: amount, defeated: false };
    }
  }

  next = applyDefeat(next, player, zone, index);
  return { state: next, dealt: amount, defeated: true };
}

function setExtra(state: GameState, instanceId: string, patch: Record<string, unknown>): GameState {
  const found = findOccupant(state, instanceId);
  if (!found) return state;
  const { player, zone, index, occupant } = found;
  const patched = { ...occupant, extra: { ...occupant.extra, ...patch } };
  const p = state.players[player];
  if (zone === 'back') {
    const backRow = p.backRow.slice();
    backRow[index] = patched as (typeof backRow)[number];
    return { ...state, players: { ...state.players, [player]: { ...p, backRow } } };
  }
  const frontRow = p.frontRow.slice();
  frontRow[index] = patched as (typeof frontRow)[number];
  return { ...state, players: { ...state.players, [player]: { ...p, frontRow } } };
}

/** Adjusts an occupant's own chakraPool.current by delta (positive or negative), whichever row it's in. */
function patchPool(state: GameState, instanceId: string, delta: number): GameState {
  return patchOccupant(state, instanceId, (o) => ({ ...o, chakraPool: { ...o.chakraPool!, current: o.chakraPool!.current + delta } }));
}

function setCurrentHP(
  state: GameState,
  player: PlayerId,
  zone: 'back' | 'front',
  index: number,
  hp: number,
): GameState {
  const p = state.players[player];
  if (zone === 'back') {
    const backRow = p.backRow.slice();
    const c = backRow[index]!;
    backRow[index] = { ...c, currentHP: hp };
    return { ...state, players: { ...state.players, [player]: { ...p, backRow } } };
  }
  const frontRow = p.frontRow.slice();
  const t = frontRow[index]!;
  frontRow[index] = { ...t, currentHP: hp };
  return { ...state, players: { ...state.players, [player]: { ...p, frontRow } } };
}

function applyDefeat(
  state: GameState,
  player: PlayerId,
  zone: 'back' | 'front',
  index: number,
): GameState {
  const p = state.players[player];
  const occupant = zone === 'back' ? p.backRow[index]! : p.frontRow[index]!;

  let next: GameState;
  if (zone === 'back') {
    const backRow = p.backRow.slice();
    backRow[index] = null;
    next = { ...state, players: { ...state.players, [player]: { ...p, backRow } } };
    if (isCharacter(occupant)) {
      const healthLost = HEALTH_LOST_ON_DEFEAT[occupant.rank] ?? 0;
      next = loseHealth(next, player, healthLost);
      // Default rule: a token fizzles when the character that created it is
      // defeated (SPEC.md's recurring "fizzles if X dies" pattern — Deidara's
      // Clay Spiders, Sasori's Puppet Soldiers, etc.). Characters with a more
      // specific fizzle condition (e.g. Pain's Path Beasts, tied to Animal
      // Path rather than to Pain himself) override this via their own
      // token-defeat hooks once that structure is implemented.
      next = fizzleOwnedTokens(next, player, occupant.instanceId);
      // SPEC.md §6.6 Retaliation: the next character this player plays is
      // exempt from summoning sickness entirely (consumed once played, §8).
      // §8's own Reinforcement trigger: owed a draw-2-keep-1 reveal — the
      // reducer drains this (see reducer.ts) since deck.ts can't be imported
      // here without a circular import (deck.ts -> characters -> combat.ts).
      next = {
        ...next,
        players: {
          ...next.players,
          [player]: {
            ...next.players[player],
            retaliationPending: true,
            pendingReinforcementDraws: next.players[player].pendingReinforcementDraws + 1,
          },
        },
      };
      // Mission cards (the Bingo Book family, §13a) key off "defeated an
      // enemy of Rank X" — recorded on the opponent (the potential winner),
      // drained/checked by the reducer for the same import-cycle reason as
      // pendingReinforcementDraws above.
      const winner = otherPlayer(player);
      next = {
        ...next,
        players: {
          ...next.players,
          [winner]: { ...next.players[winner], pendingDefeatEvents: [...next.players[winner].pendingDefeatEvents, { rank: occupant.rank }] },
        },
      };
    }
  } else {
    const frontRow = p.frontRow.slice();
    frontRow[index] = null;
    next = { ...state, players: { ...state.players, [player]: { ...p, frontRow } } };
    // A Token can also be the trigger for other Tokens fizzling (e.g. Pain's
    // Path Beasts, tied to Animal Path specifically rather than to a
    // Character) — each sets extra.fizzlesIfInstanceIdDefeated to that other
    // Token's instanceId at creation.
    next = fizzleOwnedTokens(next, player, occupant.instanceId, 'fizzlesIfInstanceIdDefeated');
  }

  next = appendLog(next, `${occupant.name} is defeated.`);
  return checkWinner(next);
}

function fizzleOwnedTokens(
  state: GameState,
  player: PlayerId,
  ownerInstanceId: string,
  matchField: 'ownerCharacterInstanceId' | 'fizzlesIfInstanceIdDefeated' = 'ownerCharacterInstanceId',
): GameState {
  const matches = (t: NonNullable<GameState['players'][PlayerId]['frontRow'][number]>) =>
    matchField === 'ownerCharacterInstanceId' ? t.ownerCharacterInstanceId === ownerInstanceId : t.extra[matchField] === ownerInstanceId;
  const p = state.players[player];
  const fizzled = p.frontRow.filter((t): t is NonNullable<typeof t> => !!t && matches(t));
  if (fizzled.length === 0) return state;
  const frontRow = p.frontRow.map((t) => (t && matches(t) ? null : t));
  let next = { ...state, players: { ...state.players, [player]: { ...p, frontRow } } };
  for (const token of fizzled) {
    next = appendLog(next, `${token!.name} fizzles.`);
  }
  return next;
}

function loseHealth(state: GameState, player: PlayerId, amount: number): GameState {
  const p = state.players[player];
  const health = p.health - amount;
  const next = { ...state, players: { ...state.players, [player]: { ...p, health } } };
  return appendLog(next, `${player} loses ${amount} Health (${health} remaining).`);
}

/** Player Health loss from any non-combat source (e.g. deck.ts's deck-out damage, §4.3) — same pipeline as a defeat's Health loss, winner-checked the same way. */
export function applyHealthLoss(state: GameState, player: PlayerId, amount: number): GameState {
  return checkWinner(loseHealth(state, player, amount));
}

function checkWinner(state: GameState): GameState {
  const p1Dead = state.players.p1.health <= 0;
  const p2Dead = state.players.p2.health <= 0;
  if (p1Dead && p2Dead) return { ...state, winner: 'draw' };
  if (p1Dead) return { ...state, winner: 'p2' };
  if (p2Dead) return { ...state, winner: 'p1' };
  return state;
}

/**
 * Absorb X (SPEC.md §6.8b): the acting unit gains X Chakra unconditionally
 * (capped by its own Pool capacity, same as normal pooling); separately, if
 * the target has any Chakra pooled, it loses X (capped by however much it
 * actually has). The two clauses are independent — the gain always happens
 * even if the drain does nothing.
 */
export function absorbChakra(
  state: GameState,
  sourceInstanceId: string,
  targetInstanceId: string,
  amount: number,
): GameState {
  if (amount <= 0) return state;
  let next = state;

  // A Token source with no Pool of its own (e.g. Zetsu's White Zetsu Clone/
  // Golem) redirects the gain to its named shared-pool owner (Zetsu's Shared
  // Reservoir) if any — mirrors abilities.ts's payment resolution for the
  // same family of Tokens. A Token that carries its own Pool directly (Pain's
  // Path tokens) just gains into that, like a Character would.
  const rawSrc = findOccupant(next, sourceInstanceId);
  const gainOwnerId =
    rawSrc && (isCharacter(rawSrc.occupant) || rawSrc.occupant.chakraPool)
      ? sourceInstanceId
      : (rawSrc?.occupant.extra.sharedPoolOwner as string | undefined);
  const src = gainOwnerId ? findOccupant(next, gainOwnerId) : null;
  if (src && src.occupant.chakraPool) {
    const pool = src.occupant.chakraPool;
    const gained = Math.max(0, Math.min(amount, pool.capacity - pool.current));
    if (gained > 0) {
      next = patchPool(next, gainOwnerId!, gained);
      next = appendLog(next, `${src.occupant.name} absorbs ${gained} Chakra.`);
    }
  }

  const tgt = findOccupant(next, targetInstanceId);
  if (tgt && tgt.occupant.chakraPool && tgt.occupant.chakraPool.current > 0) {
    const drained = Math.min(amount, tgt.occupant.chakraPool.current);
    next = patchPool(next, targetInstanceId, -drained);
    next = appendLog(next, `${tgt.occupant.name} loses ${drained} pooled Chakra, absorbed.`);
  }

  return next;
}

export function healOccupant(
  state: GameState,
  targetInstanceId: string,
  amount: number,
): GameState {
  const found = findOccupant(state, targetInstanceId);
  if (!found || amount <= 0) return state;
  const { player, zone, index, occupant } = found;
  const newHP = Math.min(occupant.maxHP, occupant.currentHP + amount);
  const next = setCurrentHP(state, player, zone, index, newHP);
  return appendLog(next, `${occupant.name} heals to ${newHP}/${occupant.maxHP} HP.`);
}

// --- Hook registry (populated by character definitions; see registry.ts) ---

const defeatHooks: Record<string, OnWouldBeDefeatedHook> = {};
const tokenDefeatHooks: Record<string, OnWouldBeDefeatedHook> = {};
const damageTakenHooks: Record<string, OnDamageTakenHook> = {};

export function registerDefeatHook(defId: string, hook: OnWouldBeDefeatedHook): void {
  defeatHooks[defId] = hook;
}

export function registerTokenDefeatHook(defId: string, hook: OnWouldBeDefeatedHook): void {
  tokenDefeatHooks[defId] = hook;
}

export function registerDamageTakenHook(defId: string, hook: OnDamageTakenHook): void {
  damageTakenHooks[defId] = hook;
}

function getDefeatHook(defId: string): OnWouldBeDefeatedHook | undefined {
  return defeatHooks[defId];
}

function getTokenDefeatHook(defId: string): OnWouldBeDefeatedHook | undefined {
  return tokenDefeatHooks[defId];
}
