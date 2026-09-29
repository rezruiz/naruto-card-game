import { findOccupant, isCharacter, patchCharacter } from '../board';
import { absorbChakra, dealDamage, registerDamageTakenHook } from '../combat';
import { appendLog } from '../phases/phaseMachine';
import { isLowerRank } from '../ranks';
import type { AbilityDef, AbilityContext } from '../abilities';
import { registerCharacter } from './registry';
import type { GameState } from '../types';

const DEF_ID = 'kisame';

// Samehada Shark Transformation stat swing (SPEC.md's "+6 Pool, +6 max HP").
const TRANSFORM_HP = 6;
const TRANSFORM_POOL = 6;

function isTransformed(ctx: AbilityContext): boolean {
  const found = findOccupant(ctx.state, ctx.sourceInstanceId);
  return !!found && isCharacter(found.occupant) && !!found.occupant.extra.transformed;
}

/**
 * Reverts Samehada Shark Transformation (SPEC.md: "Exits after ≥7 damage
 * post-transformation, or at Upkeep with Pool ≤3"). Resets the absorbed-
 * Chakra counter too, since re-entering the form again requires banking a
 * fresh 6.
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

const samehadaStrike: AbilityDef = {
  id: 'samehada-strike',
  name: 'Samehada Strike',
  cost: 0,
  speed: 'Normal',
  style: 'Water',
  type: 'Taijutsu',
  isDamaging: true,
  legalityCheck: (ctx) => !isTransformed(ctx),
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    let state = dealDamage(ctx.state, target, 1).state;
    state = absorbChakra(state, ctx.sourceInstanceId, target, 1);
    state = patchCharacter(state, ctx.sourceInstanceId, (k) => ({
      ...k,
      extra: { ...k.extra, absorbedChakra: ((k.extra.absorbedChakra as number) ?? 0) + 1 },
    }));
    return state;
  },
};

const samehadaStrikeEvolved: AbilityDef = {
  id: 'samehada-strike-evolved',
  name: 'Samehada Strike Evolved',
  cost: 0,
  speed: 'Normal',
  style: 'Water',
  type: 'Taijutsu',
  isDamaging: true,
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found || !isCharacter(found.occupant)) return false;
    const k = found.occupant;
    return !k.extra.transformed && ((k.extra.absorbedChakra as number) ?? 0) >= 3 && k.chakraPool.current >= 4;
  },
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    let state = dealDamage(ctx.state, target, 2).state;
    state = absorbChakra(state, ctx.sourceInstanceId, target, 2);
    state = patchCharacter(state, ctx.sourceInstanceId, (k) => ({
      ...k,
      extra: { ...k.extra, absorbedChakra: ((k.extra.absorbedChakra as number) ?? 0) + 2 },
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
  cost: (ctx) => (isTransformed(ctx) ? 3 : 4),
  speed: 'Normal',
  style: 'Water',
  type: 'Ninjutsu',
  legalityCheck: (ctx) => {
    const source = findOccupant(ctx.state, ctx.sourceInstanceId);
    const target = ctx.targetInstanceIds[0] ? findOccupant(ctx.state, ctx.targetInstanceIds[0]) : null;
    if (!source || !isCharacter(source.occupant) || !target || !isCharacter(target.occupant)) return false;
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

const superSharkBombJutsu: AbilityDef = {
  id: 'super-shark-bomb-jutsu',
  name: 'Water Style: Super Shark Bomb Jutsu',
  cost: (ctx) => (isTransformed(ctx) ? 3 : 4),
  speed: 'Normal',
  style: 'Water',
  type: 'Ninjutsu',
  isDamaging: true,
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found || !isCharacter(found.occupant)) return false;
    const k = found.occupant;
    return ((k.extra.absorbedChakra as number) ?? 0) >= 4 && k.chakraPool.current >= 3;
  },
  resolve: (ctx) => {
    const targetId = ctx.targetInstanceIds[0];
    if (!targetId) return ctx.state;
    const targetFound = findOccupant(ctx.state, targetId);
    const pooled = targetFound && isCharacter(targetFound.occupant) ? targetFound.occupant.chakraPool.current : 0;
    const dmg = 1 + pooled + (isTransformed(ctx) ? 1 : 0);
    let state = dealDamage(ctx.state, targetId, dmg).state;
    const drain = Math.floor(dmg / 2);
    if (drain > 0 && targetFound && isCharacter(targetFound.occupant)) {
      state = patchCharacter(state, targetId, (t) => ({
        ...t,
        chakraPool: { ...t.chakraPool, current: Math.max(0, t.chakraPool.current - drain) },
      }));
      state = appendLog(state, `The target loses ${drain} pooled Chakra to Super Shark Bomb Jutsu.`);
    }
    return state;
  },
};

const thousandHungrySharks: AbilityDef = {
  id: 'thousand-hungry-sharks',
  name: 'Water Style: Thousand Hungry Sharks',
  cost: (ctx) => (isTransformed(ctx) ? 4 : 5),
  speed: 'Normal',
  style: 'Water',
  type: 'Ninjutsu',
  isDamaging: true,
  usesPerTurn: 2,
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found || !isCharacter(found.occupant)) return false;
    const usedAlready = found.occupant.status.usedAbilitiesThisTurn.filter((id) => id === 'thousand-hungry-sharks').length;
    return found.occupant.extra.transformed === true || usedAlready === 0;
  },
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    return dealDamage(ctx.state, target, isTransformed(ctx) ? 5 : 4).state;
  },
};

// "Attackers targeting him pay +1 Chakra" while transformed is applied to
// every ability and hand card that targets him (abilities.ts resolveCost,
// playHandCard.ts).
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
    return !k.extra.transformed && ((k.extra.absorbedChakra as number) ?? 0) >= 6;
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
  rank: 'S',
  baseMaxHP: 10,
  basePoolCapacity: 12,
  styles: ['Water'],
  abilities: [
    samehadaStrike,
    samehadaStrikeEvolved,
    waterPrisonJutsu,
    superSharkBombJutsu,
    thousandHungrySharks,
    samehadaSharkTransformation,
  ],
  initialExtra: { absorbedChakra: 0, transformed: false, transformDamageTaken: 0 },
  synergy: ['Akatsuki', 'Itachi'],
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
