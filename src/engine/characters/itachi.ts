import { findOccupant, isCharacter, patchCharacter } from '../board';
import { dealDamage } from '../combat';
import { appendLog } from '../phases/phaseMachine';
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
    return target ? dealDamage(ctx.state, target, 1).state : ctx.state;
  },
};

const greatFireballTechnique: AbilityDef = {
  id: 'great-fireball-technique',
  name: 'Fire Release: Great Fireball',
  cost: 4,
  speed: 'Normal',
  style: 'Fire',
  type: 'Ninjutsu',
  isDamaging: true,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    return target ? dealDamage(ctx.state, target, 2).state : ctx.state;
  },
};

// The delayed ticks fire on Itachi's controller's Upkeep (onUpkeep below).
// "Damage cannot be reduced": every tick is dealt with cannotBeReduced, which
// skips every reduction in combat.ts (Iron Skin, Paper Body, prevention...).
const amaterasu: AbilityDef = {
  id: 'amaterasu',
  name: 'Amaterasu',
  cost: 8,
  speed: 'Normal',
  style: 'Fire',
  type: 'Ninjutsu',
  isDamaging: true,
  isUltimate: true,
  // Failing Health: not in the same turn as his Forbidden Technique.
  legalityCheck: (ctx) => !usedThisTurn(ctx.state, ctx.sourceInstanceId, 'tsukuyomi-infinite-agony'),
  resolve: (ctx) => {
    const targetId = ctx.targetInstanceIds[0];
    if (!targetId) return ctx.state;
    let state = dealDamage(ctx.state, targetId, 3, { cannotBeReduced: true }).state;
    state = patchCharacter(state, ctx.sourceInstanceId, (k) => ({
      ...k,
      extra: {
        ...k.extra,
        amaterasuSchedule: [...((k.extra.amaterasuSchedule as { targetInstanceId: string; ticksLeft: number }[]) ?? []), { targetInstanceId: targetId, ticksLeft: 3 }],
      },
    }));
    return appendLog(state, 'Amaterasu will deal 1 more damage at the start of each of your next 3 Upkeeps.');
  },
};

// Condition: the target hasn't dealt more than 6 damage to Itachi this game
// (a per-attacker tally kept by combat.ts).
const tsukuyomiInfiniteAgony: AbilityDef = {
  id: 'tsukuyomi-infinite-agony',
  name: 'Mangekyō Sharingan: Tsukuyomi - Infinite Agony',
  cost: 8,
  speed: 'Normal',
  style: 'None',
  type: 'Genjutsu',
  isDamaging: true,
  isForbidden: true,
  legalityCheck: (ctx) => {
    const source = findOccupant(ctx.state, ctx.sourceInstanceId);
    const targetId = ctx.targetInstanceIds[0];
    if (!source || !isCharacter(source.occupant) || !targetId) return false;
    // Failing Health: not in the same turn as his Ultimate.
    if (usedThisTurn(ctx.state, ctx.sourceInstanceId, 'amaterasu')) return false;
    const taken = ((source.occupant.extra.damageTakenFrom as Record<string, number> | undefined) ?? {})[targetId] ?? 0;
    return taken <= 6;
  },
  resolve: (ctx) => {
    const targetId = ctx.targetInstanceIds[0];
    if (!targetId) return ctx.state;
    let state = dealDamage(ctx.state, targetId, 5).state;
    state = patchCharacter(state, targetId, (t) => ({ ...t, extra: { ...t.extra, stunnedUntilTurn: ctx.state.turn + 2 } }));
    return appendLog(state, 'Tsukuyomi stuns its target for the next turn cycle.');
  },
};

function usedThisTurn(state: Parameters<typeof findOccupant>[0], instanceId: string, abilityId: string): boolean {
  const found = findOccupant(state, instanceId);
  return !!found && found.occupant.status.usedAbilitiesThisTurn.includes(abilityId);
}

registerCharacter({
  id: DEF_ID,
  name: 'Itachi',
  rank: 'S',
  baseMaxHP: 11,
  basePoolCapacity: 4,
  styles: ['Fire'],
  abilities: [crowShurikenBarrage, greatFireballTechnique, tsukuyomiInfiniteAgony],
  ultimate: amaterasu,
  maxAbilitiesPerTurn: 2,
  runsHooksWhenInert: ['upkeep'], // Amaterasu's burn keeps ticking even if Itachi Retreats — an already-activated effect (§6.5b)
  initialExtra: { amaterasuSchedule: [] },
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
        next = dealDamage(next, tick.targetInstanceId, 1, { cannotBeReduced: true, ongoing: true }).state;
      }
      if (tick.ticksLeft - 1 > 0) remaining.push({ ...tick, ticksLeft: tick.ticksLeft - 1 });
    }
    return patchCharacter(next, instanceId, (k) => ({ ...k, extra: { ...k.extra, amaterasuSchedule: remaining } }));
  },
});
