import { appendLog, otherPlayer } from './phases/phaseMachine';
import { findOccupant, isCharacter, patchOccupant } from './board';
import type { AbilitySpeed, AbilityType, BoardOccupant, CharacterInstance, GameState, PlayerId, Style } from './types';
import { HEALTH_LOST_ON_DEFEAT } from './ranks';
import { getCharacterDef, getTokenDef } from './characters/registry';
import { getHandCardDef } from './cards/registry';

/** Who is dealing this damage, with what — derived from the stack item currently resolving (state.resolving). */
export interface DamageSource {
  instanceId: string;
  controller: PlayerId;
  itemId: string;
  type: AbilityType;
  style: Style;
  speed: AbilitySpeed;
  /** The damaged unit is one of the item's chosen targets (vs splash/blanket damage). */
  targeted: boolean;
}

function lookupAbility(defId: string, abilityId: string) {
  const charDef = getCharacterDef(defId);
  const list = charDef ? [...charDef.abilities, ...(charDef.ultimate ? [charDef.ultimate] : [])] : (getTokenDef(defId)?.abilities ?? []);
  return list.find((a) => a.id === abilityId);
}

export function damageSourceFor(state: GameState, targetInstanceId: string): DamageSource | undefined {
  const r = state.resolving;
  if (!r) return undefined;
  const src = findOccupant(state, r.sourceInstanceId);
  const info = (src ? lookupAbility(src.occupant.defId, r.abilityId) : undefined) ?? getHandCardDef(r.abilityId);
  if (!info) return undefined;
  return {
    instanceId: r.sourceInstanceId,
    controller: r.controllerId,
    itemId: r.itemId,
    type: info.type,
    style: info.style,
    speed: info.speed,
    targeted: r.targets.includes(targetInstanceId),
  };
}

const isPhysicalType = (t: AbilityType) => t === 'Taijutsu' || t === 'Bukijutsu';
const passivesOn = (o: BoardOccupant) => !o.status.disabled && !o.status.retreated;

/**
 * Every damage modifier that depends on the attacker or the attack: redirect
 * adjustments, attacker bonuses (Rallying Words), vulnerability (Banshō
 * Ten'in), and the defender's reductions (Iron Skin, Paper Body,
 * Iron-Forged Body, Sharingan Foresight). Returns the modified amount plus
 * the state (a one-shot bonus may be marked spent) and log notes.
 */
function applyDamageModifiers(
  state: GameState,
  target: BoardOccupant,
  targetOwner: PlayerId,
  amount: number,
  src: DamageSource | undefined,
  cannotBeReduced: boolean,
): { state: GameState; amount: number; notes: string[]; unprotectable: boolean } {
  let next = state;
  let dmg = amount;
  const notes: string[] = [];
  const turn = state.turn;

  const adjust = src ? state.resolving?.damageAdjust?.[target.instanceId] : undefined;
  if (adjust?.toZero) return { state, amount: 0, notes: [`${target.name} takes none of it (redirected and reduced to 0).`], unprotectable: false };
  if (adjust?.reduceBy) {
    dmg = Math.max(0, dmg - adjust.reduceBy);
    notes.push(`redirected hit reduced by ${adjust.reduceBy}`);
  }

  if (src) {
    const attacker = findOccupant(state, src.instanceId)?.occupant;
    // Rallying Words: this ally's next attack this turn deals +1 (every hit of that one attack).
    if (attacker && attacker.extra.rallyingWordsBonusTurn === turn && (attacker.extra.rallyingSpentOn ?? src.itemId) === src.itemId) {
      dmg += 1;
      notes.push('+1 Rallying Words');
      next = patchOccupant(next, attacker.instanceId, (o) => ({ ...o, extra: { ...o.extra, rallyingSpentOn: src.itemId } }));
    }
  }

  // Banshō Ten'in: +1 damage for the rest of the turn, and its controller's damage-reduction abilities can't protect it.
  const unprotectable = target.extra.banshoVulnerableTurn === turn;
  if (unprotectable) {
    dmg += 1;
    notes.push("+1 Banshō Ten'in");
  }

  if (src && dmg > 0) {
    // Konan's Paper Body: Fire burns paper (+1) — an increase, applied even to damage that can't be reduced.
    if (target.defId === 'konan' && passivesOn(target) && src.style === 'Fire') {
      dmg += 1;
      notes.push('+1 Fire vs Paper Body');
    }
    if (!cannotBeReduced) {
      const before = dmg;
      if (!unprotectable && (target.extra.ironSkinUntilTurn as number | undefined) !== undefined && (target.extra.ironSkinUntilTurn as number) >= turn) {
        if (isPhysicalType(src.type)) dmg = Math.max(0, dmg - 2);
        else if (src.type === 'Ninjutsu' && src.style !== 'None') dmg = Math.max(0, dmg - 1);
        if (dmg < before) notes.push(`Iron Skin −${before - dmg}`);
      }
      if (passivesOn(target)) {
        const b = dmg;
        if (target.defId === 'konan' && src.type === 'Taijutsu') dmg = Math.max(0, dmg - 2);
        if (target.defId === 'juzo' && src.type === 'Taijutsu' && dmg > 1) dmg = Math.max(1, dmg - 1);
        if (target.defId === 'itachi' && src.speed === 'Quick' && src.targeted && src.controller !== targetOwner) dmg = Math.max(0, dmg - 1);
        if (dmg < b) notes.push(`${target.defId === 'konan' ? 'Paper Body' : target.defId === 'juzo' ? 'Iron-Forged Body' : 'Sharingan Foresight'} −${b - dmg}`);
      }
    }
  }
  return { state: next, amount: dmg, notes, unprotectable };
}

/** After damage lands: record who damaged whom (Hidan's Curse condition, Itachi's Tsukuyomi limit), end Water Prison early if Kisame was hit, and mark when a unit last took damage (Golem Regeneration). */
function recordDamage(state: GameState, target: BoardOccupant, targetOwner: PlayerId, dealt: number, src: DamageSource | undefined): GameState {
  if (dealt <= 0) return state;
  let next = setExtra(state, target.instanceId, { lastDamagedTurn: state.turn });
  if (src) {
    const attacker = findOccupant(next, src.instanceId)?.occupant;
    if (attacker?.defId === 'hidan' && src.controller !== targetOwner) {
      const damaged = (attacker.extra.damagedEnemies as string[] | undefined) ?? [];
      if (!damaged.includes(target.instanceId)) next = setExtra(next, attacker.instanceId, { damagedEnemies: [...damaged, target.instanceId] });
    }
    if (target.defId === 'itachi' && src.controller !== targetOwner) {
      const fresh = findOccupant(next, target.instanceId)?.occupant;
      const taken = { ...((fresh?.extra.damageTakenFrom as Record<string, number> | undefined) ?? {}) };
      taken[src.instanceId] = (taken[src.instanceId] ?? 0) + dealt;
      next = setExtra(next, target.instanceId, { damageTakenFrom: taken });
    }
  }
  if (target.defId === 'kisame') {
    // Water Prison ends early once Kisame takes damage.
    for (const p of ['p1', 'p2'] as PlayerId[]) {
      for (const unit of [...next.players[p].backRow, ...next.players[p].frontRow]) {
        if (unit && unit.extra.targetLockBy === target.instanceId) {
          next = setExtra(next, unit.instanceId, { targetLockUntilTurn: undefined, targetLockBy: undefined });
          next = appendLog(next, `Kisame took damage — ${unit.name} breaks free of Water Prison.`);
        }
      }
    }
  }
  return next;
}

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
    /** Not dealt by the resolving attack itself (e.g. Hidan's mirrored Curse damage) — no attacker modifiers, no kill credit. */
    unattributed?: boolean;
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
  // of the Mission's 3 chosen characters MAY be redirected to a different
  // member of the same group — the controller's choice, never automatic.
  // Damage can't pause mid-resolution for a live prompt, so the controller
  // sets a standing choice on the Mission (SET_SQUAD_REDIRECT: which member
  // absorbs redirected hits, or Off). The redirected hit itself is never
  // redirected again (skipSquadRedirect).
  const squadGroup = occupant.extra.squadFormationGroup as string[] | undefined;
  if (!opts.skipSquadRedirect && squadGroup && squadGroup.length > 1) {
    const mission = state.players[player].missionsInPlay.find((m) => m.defId === 'squad-formation' && (m.extra.group as string[] | undefined)?.includes(targetInstanceId));
    const redirectTo = mission?.extra.redirectTo as string | undefined;
    if (redirectTo && redirectTo !== targetInstanceId && squadGroup.includes(redirectTo) && findOccupant(state, redirectTo)) {
      const redirected = appendLog(state, `Squad Formation: ${player} redirects the hit from ${occupant.name} to ${findOccupant(state, redirectTo)!.occupant.name}.`);
      return dealDamage(redirected, redirectTo, amount, { ...opts, skipSquadRedirect: true });
    }
  }

  // Attacker/defender modifiers (see applyDamageModifiers).
  const src = opts.unattributed || opts.ongoing ? undefined : damageSourceFor(state, targetInstanceId);
  const modified = applyDamageModifiers(state, occupant, player, amount, src, !!opts.cannotBeReduced);
  let next = modified.state;
  if (modified.notes.length > 0) next = appendLog(next, `${occupant.name}: ${modified.notes.join(', ')}.`);
  if (modified.amount <= 0) return { state: next, dealt: 0, defeated: false };

  // Generic damage-prevention pool (SPEC.md's "prevent the next N damage this
  // turn" pattern — Yahiko's Water Pillar Wall, Sasori's Iron Sand Wall):
  // extra.damagePreventionRemaining is consumed 1-for-1 against any damage
  // this unit takes this turn, unless the source says it cannotBeReduced
  // (Amaterasu, Poison — an explicit, stronger override per SPEC.md), or
  // Banshō Ten'in made it unprotectable this turn.
  let effectiveAmount = modified.amount;
  if (!opts.cannotBeReduced && !modified.unprotectable) {
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
  next = recordDamage(next, occupant, player, amount, src);

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

  next = applyDefeat(next, player, zone, index, src && src.controller !== player ? src.instanceId : undefined);
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
  /** The enemy unit whose attack made the kill, if known — credited for kill-triggered effects (Patchwork Threads, Bingo Book C). */
  killerInstanceId?: string,
): GameState {
  const p = state.players[player];
  const occupant = zone === 'back' ? p.backRow[index]! : p.frontRow[index]!;

  let next: GameState;
  if (zone === 'back') {
    const backRow = p.backRow.slice();
    backRow[index] = null;
    next = { ...state, players: { ...state.players, [player]: { ...p, backRow } } };
    if (isCharacter(occupant)) {
      // Default rule: a token fizzles when the character that created it is
      // defeated (SPEC.md's recurring "fizzles if X dies" pattern — Deidara's
      // Clay Spiders, Sasori's Puppet Soldiers, etc.). Characters with a more
      // specific fizzle condition (e.g. Pain's Path Beasts, tied to Animal
      // Path rather than to Pain himself) override this via their own
      // token-defeat hooks once that structure is implemented.
      next = fizzleOwnedTokens(next, player, occupant.instanceId);
      next = recordCharacterDefeat(next, player, occupant.rank, occupant.styles, killerInstanceId);
    }
  } else {
    const frontRow = p.frontRow.slice();
    frontRow[index] = null;
    next = { ...state, players: { ...state.players, [player]: { ...p, frontRow } } };
    // A token that goes on cooldown when defeated (Pain's Path Beasts) — recorded on whoever summons it.
    const cooldown = occupant.extra.cooldownOnDefeat as { holderId: string; key: string; upkeeps: number } | undefined;
    const holder = cooldown ? findOccupant(next, cooldown.holderId)?.occupant : undefined;
    if (cooldown && holder) {
      next = setExtra(next, cooldown.holderId, { beastCooldowns: { ...((holder.extra.beastCooldowns as Record<string, number> | undefined) ?? {}), [cooldown.key]: cooldown.upkeeps } });
      next = appendLog(next, `${occupant.name} goes on cooldown for ${cooldown.upkeeps} Upkeep Phases.`);
    }
    // A Token can also be the trigger for other Tokens fizzling (e.g. Pain's
    // Path Beasts, tied to Animal Path specifically rather than to a
    // Character) — each sets extra.fizzlesIfInstanceIdDefeated to that other
    // Token's instanceId at creation.
    next = fizzleOwnedTokens(next, player, occupant.instanceId, 'fizzlesIfInstanceIdDefeated');
    // Pain of the Six Paths is a character made entirely of his 6 Path
    // tokens: when the last one falls, Pain himself is defeated — a full
    // S-rank character defeat (Health loss, Reinforcement, Missions...).
    // Individual Path tokens, like every token, aren't character losses.
    if (occupant.extra.painPath && !painPathsRemain(next, player)) {
      next = appendLog(next, `${occupant.name} is defeated.`);
      next = appendLog(next, 'Pain of the Six Paths is defeated — all six Paths have fallen.');
      next = recordCharacterDefeat(next, player, 'S', ['None'], killerInstanceId);
      return checkWinner(next);
    }
  }

  next = appendLog(next, `${occupant.name} is defeated.`);
  return checkWinner(next);
}

/** Whether any of this player's Pain Path tokens is still in play — while one is, Pain of the Six Paths is a character in play. */
export function painPathsRemain(state: GameState, player: PlayerId): boolean {
  return state.players[player].frontRow.some((t) => !!t?.extra.painPath);
}

/**
 * Everything that follows one of `player`'s CHARACTERS being defeated (never a
 * token's): §11 Health loss by rank, §6.6 Retaliation, the §8 Reinforcement
 * trigger, the opponent's "defeated an enemy of Rank X" Mission event, and
 * kill credit on the unit that made the kill.
 */
function recordCharacterDefeat(state: GameState, player: PlayerId, rank: CharacterInstance['rank'], styles: Style[], killerInstanceId?: string): GameState {
  let next = loseHealth(state, player, HEALTH_LOST_ON_DEFEAT[rank] ?? 0);
  // §8's Reinforcement trigger is recorded here, at the moment of defeat
  // (whether any other C-rank-or-higher character is still standing —
  // D-ranks don't count; Pain counts while any of his Paths stands), and
  // turned into an offer/forced play by the reducer, which can look up hand
  // cards' ranks without the import cycle deck.ts/characters would cause here.
  const lastCPlus = !next.players[player].backRow.some((c) => c && c.rank !== 'D') && !painPathsRemain(next, player);
  next = {
    ...next,
    players: {
      ...next.players,
      [player]: {
        ...next.players[player],
        retaliationPending: true,
        pendingReinforcementEvents: [...next.players[player].pendingReinforcementEvents, { rank, lastCPlus }],
      },
    },
  };
  // Mission cards (the Bingo Book family, §13a) key off "defeated an enemy of
  // Rank X" — recorded on the opponent (the potential winner), drained/checked
  // by the reducer for the same import-cycle reason.
  const winner = otherPlayer(player);
  next = {
    ...next,
    players: {
      ...next.players,
      [winner]: { ...next.players[winner], pendingDefeatEvents: [...next.players[winner].pendingDefeatEvents, { rank, byInstanceId: killerInstanceId }] },
    },
  };
  // Kill credit on the unit that made it: when, and the defeated character's Styles (Patchwork Threads can take one).
  if (killerInstanceId && findOccupant(next, killerInstanceId)) {
    next = setExtra(next, killerInstanceId, { lastKillTurn: next.turn, lastKillStyles: styles });
  }
  return next;
}

export function fizzleOwnedTokens(
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
