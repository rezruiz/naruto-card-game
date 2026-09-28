import { findOccupant, isCharacter, patchCharacter } from '../board';
import { dealDamage } from '../combat';
import { appendLog } from '../phases/phaseMachine';
import { isLowerRank } from '../ranks';
import type { AbilityDef } from '../abilities';
import { registerCharacter } from './registry';

const DEF_ID = 'itachi';

const crowShurikenBarrage: AbilityDef = {
  id: 'crow-shuriken-barrage',
  name: 'Crow Shuriken Barrage',
  cost: 2,
  speed: 'Normal',
  style: 'None',
  type: 'Taijutsu',
  isDamaging: true,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    return target ? dealDamage(ctx.state, target, 2).state : ctx.state;
  },
};

const greatFireballTechnique: AbilityDef = {
  id: 'great-fireball-technique',
  name: 'Great Fireball Technique',
  cost: 3,
  speed: 'Normal',
  style: 'Fire',
  type: 'Ninjutsu',
  isDamaging: true,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    return target ? dealDamage(ctx.state, target, 3).state : ctx.state;
  },
};

// NOTE (interpretation): "through its controller's next turn" is read the
// same way Kakuzu's Iron Skin reads "next turn cycle" (design/CHARACTER_LOG.md)
// — approximated as +2 ply (state.turn) from activation.
const genjutsuMindPrison: AbilityDef = {
  id: 'genjutsu-mind-prison',
  name: 'Genjutsu: Mind Prison',
  cost: (ctx) => {
    const source = findOccupant(ctx.state, ctx.sourceInstanceId);
    const target = ctx.targetInstanceIds[0] ? findOccupant(ctx.state, ctx.targetInstanceIds[0]) : null;
    if (source && isCharacter(source.occupant) && target && isCharacter(target.occupant) && isLowerRank(target.occupant.rank, source.occupant.rank)) {
      return 1;
    }
    return 3;
  },
  speed: 'Quick',
  style: 'None',
  type: 'Genjutsu',
  legalityCheck: (ctx) => {
    const source = findOccupant(ctx.state, ctx.sourceInstanceId);
    const targetId = ctx.targetInstanceIds[0];
    if (!source || !isCharacter(source.occupant) || !targetId) return false;
    const usedOn = (source.occupant.extra.mindPrisonUsedOn as string[]) ?? [];
    return !usedOn.includes(targetId);
  },
  resolve: (ctx) => {
    const targetId = ctx.targetInstanceIds[0];
    if (!targetId) return ctx.state;
    let state = patchCharacter(ctx.state, targetId, (t) => ({
      ...t,
      extra: { ...t.extra, stunnedUntilTurn: ctx.state.turn + 2 },
    }));
    state = patchCharacter(state, ctx.sourceInstanceId, (k) => ({
      ...k,
      extra: { ...k.extra, mindPrisonUsedOn: [...((k.extra.mindPrisonUsedOn as string[]) ?? []), targetId] },
    }));
    return appendLog(state, `Mind Prison stuns its target — no abilities or Chakra pooling for now.`);
  },
};

// A real (not simplified) implementation of the game's target-negation
// pattern (SPEC.md §9): removes the enemy ability currently on the stack
// that's targeting Itachi, so it never resolves against him at all.
const crowClone: AbilityDef = {
  id: 'crow-clone',
  name: 'Crow Clone',
  cost: 2,
  speed: 'Reactive',
  style: 'None',
  type: 'Ninjutsu',
  maxTargets: 0,
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found || !isCharacter(found.occupant)) return false;
    const itachi = found.occupant;
    const usedOn = (itachi.extra.crowCloneUsedOn as string[]) ?? [];
    return ctx.state.stack.some(
      (item) =>
        item.targets.includes(ctx.sourceInstanceId) &&
        item.controllerId !== itachi.owner &&
        !usedOn.includes(item.sourceInstanceId),
    );
  },
  resolve: (ctx) => {
    let state = ctx.state;
    const found = findOccupant(state, ctx.sourceInstanceId);
    if (!found || !isCharacter(found.occupant)) return state;
    const itachi = found.occupant;
    const idx = state.stack.findIndex(
      (item) => item.targets.includes(ctx.sourceInstanceId) && item.controllerId !== itachi.owner,
    );
    if (idx === -1) return appendLog(state, 'Crow Clone finds nothing left to negate.');

    const negated = state.stack[idx];
    state = { ...state, stack: [...state.stack.slice(0, idx), ...state.stack.slice(idx + 1)] };
    state = patchCharacter(state, ctx.sourceInstanceId, (k) => ({
      ...k,
      extra: { ...k.extra, crowCloneUsedOn: [...((k.extra.crowCloneUsedOn as string[]) ?? []), negated.sourceInstanceId] },
    }));
    return appendLog(state, `Itachi phases out — Crow Clone negates ${negated.sourceName}'s ${negated.abilityName}.`);
  },
};

// NOTE (simplified for this pass): the delayed ticks fire on Itachi's
// controller's Upkeep via the engine's generic onUpkeep hook (real, not
// stubbed) — but "damage cannot be reduced" has no reduction system yet to
// override (no character currently reduces damage in the engine either), so
// this flag is threaded through for forward-compatibility only.
const amaterasu: AbilityDef = {
  id: 'amaterasu',
  name: 'Amaterasu',
  cost: 7,
  speed: 'Normal',
  style: 'Fire',
  type: 'Ninjutsu',
  isDamaging: true,
  isUltimate: true,
  resolve: (ctx) => {
    const targetId = ctx.targetInstanceIds[0];
    if (!targetId) return ctx.state;
    let state = dealDamage(ctx.state, targetId, 3, { cannotBeReduced: true }).state;
    state = patchCharacter(state, ctx.sourceInstanceId, (k) => ({
      ...k,
      extra: {
        ...k.extra,
        amaterasuSchedule: [...((k.extra.amaterasuSchedule as { targetInstanceId: string; ticksLeft: number }[]) ?? []), { targetInstanceId: targetId, ticksLeft: 2 }],
      },
    }));
    return appendLog(state, 'Amaterasu will deal 2 more damage at the start of each of your next 2 Upkeeps.');
  },
};

// NOTE (simplified for this pass): the "must not have dealt more than 6
// damage to Itachi this game" condition is not enforced — the engine's
// dealDamage pipeline doesn't yet attribute damage to its source character,
// only its target, so there's no per-attacker lifetime damage total to check.
const tsukuyomiInfiniteAgony: AbilityDef = {
  id: 'tsukuyomi-infinite-agony',
  name: 'Mangekyō Sharingan: Tsukuyomi - Infinite Agony',
  cost: 7,
  speed: 'Normal',
  style: 'None',
  type: 'Genjutsu',
  isDamaging: true,
  isForbidden: true,
  legalityCheck: (ctx) => {
    const source = findOccupant(ctx.state, ctx.sourceInstanceId);
    const targetId = ctx.targetInstanceIds[0];
    if (!source || !isCharacter(source.occupant) || !targetId) return false;
    const usedOn = (source.occupant.extra.mindPrisonUsedOn as string[]) ?? [];
    return usedOn.includes(targetId);
  },
  resolve: (ctx) => {
    const targetId = ctx.targetInstanceIds[0];
    if (!targetId) return ctx.state;
    let state = dealDamage(ctx.state, targetId, 6).state;
    state = patchCharacter(state, targetId, (t) => ({ ...t, extra: { ...t.extra, stunnedUntilTurn: ctx.state.turn + 4 } }));
    return appendLog(state, 'Tsukuyomi stuns its target for the next 2 turn cycles.');
  },
};

registerCharacter({
  id: DEF_ID,
  name: 'Itachi',
  rank: 'S',
  baseMaxHP: 11,
  basePoolCapacity: 4,
  styles: ['Fire'],
  abilities: [crowShurikenBarrage, greatFireballTechnique, genjutsuMindPrison, crowClone, tsukuyomiInfiniteAgony],
  ultimate: amaterasu,
  maxAbilitiesPerTurn: 2,
  runsHooksWhenInert: ['upkeep'], // Amaterasu's burn keeps ticking even if Itachi Retreats — an already-activated effect (§6.5b)
  initialExtra: { mindPrisonUsedOn: [], crowCloneUsedOn: [], amaterasuSchedule: [] },
  synergy: ['Akatsuki'],
  onUpkeep: (state, instanceId) => {
    const found = findOccupant(state, instanceId);
    if (!found || !isCharacter(found.occupant)) return state;
    const schedule = (found.occupant.extra.amaterasuSchedule as { targetInstanceId: string; ticksLeft: number }[]) ?? [];
    if (schedule.length === 0) return state;

    let next = state;
    const remaining: { targetInstanceId: string; ticksLeft: number }[] = [];
    for (const tick of schedule) {
      if (findOccupant(next, tick.targetInstanceId)) {
        next = dealDamage(next, tick.targetInstanceId, 2, { cannotBeReduced: true, ongoing: true }).state;
      }
      if (tick.ticksLeft - 1 > 0) remaining.push({ ...tick, ticksLeft: tick.ticksLeft - 1 });
    }
    return patchCharacter(next, instanceId, (k) => ({ ...k, extra: { ...k.extra, amaterasuSchedule: remaining } }));
  },
});
