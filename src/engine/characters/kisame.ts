import { findOccupant, isCharacter, patchCharacter } from '../board';
import { absorbChakra, dealDamage, registerDamageTakenHook } from '../combat';
import { appendLog } from '../phases/phaseMachine';
import { isLowerRank } from '../ranks';
import type { AbilityDef, AbilityContext } from '../abilities';
import { registerCharacter } from './registry';
import { stackItemInfo } from '../cards/negation';
import type { GameState, StackItem } from '../types';

const DEF_ID = 'kisame';

// Samehada Shark Transformation stat swing (SPEC.md's "+6 Pool, +6 max HP").
const TRANSFORM_HP = 6;
const TRANSFORM_POOL = 6;
/** Samehada Fusion: absorbed Chakra needed before he can transform. */
const FUSION_THRESHOLD = 10;

function isTransformed(ctx: AbilityContext): boolean {
  const found = findOccupant(ctx.state, ctx.sourceInstanceId);
  return !!found && isCharacter(found.occupant) && !!found.occupant.extra.transformed;
}

/**
 * Reverts Samehada Shark Transformation (SPEC.md: "Exits after ≥7 damage
 * post-transformation, or at Upkeep with Pool ≤3"). Resets the absorbed-
 * Chakra counter too, since re-entering the form again requires banking a
 * fresh FUSION_THRESHOLD.
 */
function revertTransformation(state: GameState, instanceId: string): GameState {
  let next = patchCharacter(state, instanceId, (k) => ({
    ...k,
    maxHP: k.maxHP - TRANSFORM_HP,
    currentHP: Math.min(k.currentHP, k.maxHP - TRANSFORM_HP),
    chakraPool: {
      current: Math.min(k.chakraPool.current, k.chakraPool.capacity - TRANSFORM_POOL),
      capacity: k.chakraPool.capacity - TRANSFORM_POOL,
    },
    extra: { ...k.extra, transformed: false, transformDamageTaken: 0, absorbedChakra: 0 },
  }));
  return appendLog(next, 'Kisame reverts out of Samehada Shark Transformation.');
}

/**
 * Samehada Fusion: while transformed, every Ninjutsu attack from Kisame has
 * Absorb 1 — his own abilities and the Jutsu cards he enables. Absorbs from
 * the attack's first target still in play, and counts toward his absorbed total.
 */
export function samehadaFusionAbsorb(state: GameState, kisameId: string, targetIds: string[]): GameState {
  const kisame = findOccupant(state, kisameId);
  if (!kisame || kisame.occupant.defId !== DEF_ID || !kisame.occupant.extra.transformed) return state;
  const target = targetIds.find((id) => id !== kisameId && findOccupant(state, id));
  if (!target) return state;
  let next = absorbChakra(state, kisameId, target, 1);
  next = patchCharacter(next, kisameId, (k) => ({ ...k, extra: { ...k.extra, absorbedChakra: ((k.extra.absorbedChakra as number) ?? 0) + 1 } }));
  return next;
}

/**
 * Samehada Fusion: while transformed, an enemy Ninjutsu attack aimed at Kisame
 * lets him Absorb 1 from its user when it resolves (stack.ts calls this with
 * the state from just before the attack resolved, to read what it was).
 */
export function samehadaIncomingAbsorb(before: GameState, after: GameState, item: StackItem): GameState {
  const info = stackItemInfo(before, item);
  if (!info || !info.isDamaging || info.type !== 'Ninjutsu') return after;
  let next = after;
  for (const id of new Set(item.targets)) {
    const k = findOccupant(next, id);
    if (!k || k.occupant.defId !== DEF_ID || !k.occupant.extra.transformed || k.player === item.controllerId) continue;
    next = absorbChakra(next, id, item.sourceInstanceId, 1);
    next = patchCharacter(next, id, (c) => ({ ...c, extra: { ...c.extra, absorbedChakra: ((c.extra.absorbedChakra as number) ?? 0) + 1 } }));
    next = appendLog(next, 'Samehada feeds on the incoming Ninjutsu — Kisame absorbs 1 from its user.');
  }
  return next;
}

/** Thousand Hungry Sharks (ability and Jutsu card): 4 damage. */
export const SHARKS_DAMAGE = 4;

/**
 * Splits `total` damage over the picked units: each pick is 1 damage (pick a
 * unit twice for 2), and whatever isn't assigned lands on the last pick — one
 * pick puts all of it on one unit. Each unit takes its share as one hit.
 */
export function dealSplitDamage(state: GameState, picks: string[], total: number): GameState {
  if (picks.length === 0) return state;
  const split = new Map<string, number>();
  picks.forEach((id, i) => split.set(id, (split.get(id) ?? 0) + (i === picks.length - 1 ? Math.max(1, total - (picks.length - 1)) : 1)));
  let next = state;
  for (const [id, dmg] of split) {
    if (findOccupant(next, id)) next = dealDamage(next, id, dmg).state;
  }
  return next;
}

const samehadaStrike: AbilityDef = {
  id: 'samehada-strike',
  name: 'Samehada Strike',
  cost: 2,
  requiresFullPoolPayment: true,
  speed: 'Normal',
  style: 'Water',
  type: 'Taijutsu',
  isDamaging: true,
  legalityCheck: (ctx) => !isTransformed(ctx),
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    let state = dealDamage(ctx.state, target, 1).state;
    state = absorbChakra(state, ctx.sourceInstanceId, target, 3);
    state = patchCharacter(state, ctx.sourceInstanceId, (k) => ({
      ...k,
      extra: { ...k.extra, absorbedChakra: ((k.extra.absorbedChakra as number) ?? 0) + 3 },
    }));
    return state;
  },
};

const samehadaStrikeEvolved: AbilityDef = {
  id: 'samehada-strike-evolved',
  name: 'Samehada Strike Evolved',
  cost: 2,
  requiresFullPoolPayment: true,
  speed: 'Normal',
  style: 'Water',
  type: 'Taijutsu',
  isDamaging: true,
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found || !isCharacter(found.occupant)) return false;
    const k = found.occupant;
    return !k.extra.transformed && ((k.extra.absorbedChakra as number) ?? 0) >= 9 && k.chakraPool.current >= 6;
  },
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    let state = dealDamage(ctx.state, target, 2).state;
    state = absorbChakra(state, ctx.sourceInstanceId, target, 4);
    state = patchCharacter(state, ctx.sourceInstanceId, (k) => ({
      ...k,
      extra: { ...k.extra, absorbedChakra: ((k.extra.absorbedChakra as number) ?? 0) + 4 },
    }));
    return state;
  },
};

// "Through the next 3 turns (or until Kisame takes damage), it can't use
// abilities that target a character." The lock remembers who imposed it
// (targetLockBy), so combat.ts can end it early when Kisame is hit.
const waterPrisonJutsu: AbilityDef = {
  id: 'water-prison-jutsu',
  name: 'Water Style: Water Prison Jutsu',
  cost: 5,
  speed: 'Normal',
  style: 'Water',
  type: 'Ninjutsu',
  legalityCheck: (ctx) => {
    const source = findOccupant(ctx.state, ctx.sourceInstanceId);
    const target = ctx.targetInstanceIds[0] ? findOccupant(ctx.state, ctx.targetInstanceIds[0]) : null;
    if (!source || !isCharacter(source.occupant) || !target || !isCharacter(target.occupant)) return false;
    if (source.occupant.extra.transformed) return false; // Samehada Fusion disables it
    return isLowerRank(target.occupant.rank, source.occupant.rank);
  },
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    let state = patchCharacter(ctx.state, target, (t) => ({
      ...t,
      extra: { ...t.extra, targetLockUntilTurn: ctx.state.turn + 3, targetLockBy: ctx.sourceInstanceId },
    }));
    return appendLog(state, `Water Prison Jutsu traps its target — no targeted abilities for 3 turns.`);
  },
};

// Ultimate: 6 Chakra, paid from his Pool only. Deal 3 + X (X = Chakra pooled
// on the target as it lands), Absorb 2. While transformed, Samehada Fusion's
// +1 Water damage applies, and its Absorb 1 on top.
const superSharkBombJutsu: AbilityDef = {
  id: 'super-shark-bomb-jutsu',
  name: 'Water Style: Super Shark Bomb Jutsu',
  cost: 6,
  requiresFullPoolPayment: true,
  speed: 'Normal',
  style: 'Water',
  type: 'Ninjutsu',
  isDamaging: true,
  isUltimate: true,
  resolve: (ctx) => {
    const targetId = ctx.targetInstanceIds[0];
    if (!targetId) return ctx.state;
    const targetFound = findOccupant(ctx.state, targetId);
    const pooled = targetFound?.occupant.chakraPool?.current ?? 0;
    const dmg = 3 + pooled + (isTransformed(ctx) ? 1 : 0);
    let state = dealDamage(ctx.state, targetId, dmg).state;
    if (findOccupant(state, targetId)) {
      state = absorbChakra(state, ctx.sourceInstanceId, targetId, 2);
      state = patchCharacter(state, ctx.sourceInstanceId, (k) => ({ ...k, extra: { ...k.extra, absorbedChakra: ((k.extra.absorbedChakra as number) ?? 0) + 2 } }));
    }
    return samehadaFusionAbsorb(state, ctx.sourceInstanceId, [targetId]);
  },
};

// Also a Jutsu card (cards/jutsu.ts, cost 6); as Kisame's own ability it costs 8.
const thousandHungrySharks: AbilityDef = {
  id: 'thousand-hungry-sharks',
  name: 'Water Style: Thousand Hungry Sharks',
  cost: 7,
  speed: 'Normal',
  style: 'Water',
  type: 'Ninjutsu',
  isDamaging: true,
  maxTargets: SHARKS_DAMAGE,
  legalityCheck: (ctx) => ctx.targetInstanceIds.length >= 1,
  resolve: (ctx) => {
    const picks = ctx.targetInstanceIds.slice(0, SHARKS_DAMAGE + 1);
    const state = dealSplitDamage(ctx.state, picks, SHARKS_DAMAGE + (isTransformed(ctx) ? 1 : 0));
    return samehadaFusionAbsorb(state, ctx.sourceInstanceId, picks);
  },
};

const samehadaSharkTransformation: AbilityDef = {
  id: 'samehada-shark-transformation',
  name: 'Samehada Shark Transformation',
  cost: 0,
  speed: 'Normal',
  style: 'None',
  type: 'None',
  maxTargets: 0,
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found || !isCharacter(found.occupant)) return false;
    const k = found.occupant;
    return !k.extra.transformed && ((k.extra.absorbedChakra as number) ?? 0) >= FUSION_THRESHOLD;
  },
  resolve: (ctx) => {
    let state = patchCharacter(ctx.state, ctx.sourceInstanceId, (k) => ({
      ...k,
      maxHP: k.maxHP + TRANSFORM_HP,
      currentHP: k.currentHP + TRANSFORM_HP,
      chakraPool: { ...k.chakraPool, capacity: k.chakraPool.capacity + TRANSFORM_POOL },
      extra: { ...k.extra, transformed: true, transformDamageTaken: 0 },
    }));
    return appendLog(state, 'Kisame enters Samehada Shark Transformation.');
  },
};

registerCharacter({
  id: DEF_ID,
  name: 'Kisame',
  absorbsIntoPool: true,
  rank: 'S',
  baseMaxHP: 12,
  basePoolCapacity: 12,
  styles: ['Water'],
  abilities: [
    samehadaStrike,
    samehadaStrikeEvolved,
    waterPrisonJutsu,
    thousandHungrySharks,
    samehadaSharkTransformation,
  ],
  ultimate: superSharkBombJutsu,
  initialExtra: { absorbedChakra: 0, transformed: false, transformDamageTaken: 0 },
  synergy: ['Akatsuki'],
  onUpkeep: (state, instanceId) => {
    const found = findOccupant(state, instanceId);
    if (!found || !isCharacter(found.occupant)) return state;
    const k = found.occupant;
    if (k.extra.transformed && k.chakraPool.current <= 3) {
      return revertTransformation(state, instanceId);
    }
    return state;
  },
});

// Samehada Fusion's ">=7 damage post-transformation" exit clause.
registerDamageTakenHook(DEF_ID, (state, targetInstanceId, amount) => {
  const found = findOccupant(state, targetInstanceId);
  if (!found || !isCharacter(found.occupant) || !found.occupant.extra.transformed) return null;

  const totalTaken = ((found.occupant.extra.transformDamageTaken as number) ?? 0) + amount;
  if (totalTaken >= 7) {
    return revertTransformation(state, targetInstanceId);
  }
  return patchCharacter(state, targetInstanceId, (k) => ({
    ...k,
    extra: { ...k.extra, transformDamageTaken: totalTaken },
  }));
});
