import { findOccupant, isCharacter, patchCharacter } from '../board';
import { dealDamage } from '../combat';
import { appendLog } from '../phases/phaseMachine';
import type { AbilityDef } from '../abilities';
import { registerCharacter } from './registry';

const DEF_ID = 'yahiko';

const bladeOfResolve: AbilityDef = {
  id: 'blade-of-resolve',
  name: 'Blade of Resolve',
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

const waterJetStream: AbilityDef = {
  id: 'water-jet-stream',
  name: 'Water Release: Water Jet Stream',
  cost: 3,
  speed: 'Normal',
  style: 'Water',
  type: 'Ninjutsu',
  isDamaging: true,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    return target ? dealDamage(ctx.state, target, 3).state : ctx.state;
  },
};

// Sets the engine's generic damage-prevention pool (combat.ts's dealDamage)
// on Yahiko himself — consumed automatically against the next damage he
// takes this turn.
const waterPillarWall: AbilityDef = {
  id: 'water-pillar-wall',
  name: 'Water Release: Water Pillar Wall',
  cost: 2,
  speed: 'Normal',
  style: 'Water',
  type: 'Ninjutsu',
  maxTargets: 0,
  resolve: (ctx) =>
    patchCharacter(ctx.state, ctx.sourceInstanceId, (k) => ({
      ...k,
      extra: { ...k.extra, damagePreventionRemaining: 2, damagePreventionUntilTurn: ctx.state.turn },
    })),
};

// NOTE (simplified for this pass): "each ally's next attack this turn deals
// 1 additional damage" is a blanket per-ally buff. The engine has no generic
// per-ability damage-modifier pipeline yet (same gap as Iron Skin/Paper
// Body), so this sets a flag consumed manually by allies' own resolve
// functions if they choose to check it — not yet wired into every existing
// ability's resolve, so treat this as a scaffold rather than a live buff.
const rallyingWords: AbilityDef = {
  id: 'rallying-words',
  name: 'Rallying Words',
  cost: 2,
  speed: 'Normal',
  style: 'None',
  type: 'Ninjutsu',
  maxTargets: 0,
  resolve: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found) return ctx.state;
    let state = ctx.state;
    for (const ally of state.players[found.player].backRow) {
      if (ally) {
        state = patchCharacter(state, ally.instanceId, (c) => ({
          ...c,
          extra: { ...c.extra, rallyingWordsBonusTurn: ctx.state.turn },
        }));
      }
    }
    return appendLog(state, "Rallying Words: each ally's next attack this turn deals 1 additional damage.");
  },
};

// NOTE (simplified for this pass): SPEC.md's full effect redirects the
// attack's exact damage number onto Yahiko instead, calculated after other
// reductions — but a stack item's `resolve` is an opaque closure over its
// original target (like every other ability), so the engine has no way to
// read "how much damage is this about to deal" without actually running it,
// nor to re-target that closure at Yahiko instead. Implemented instead as
// full negation (à la Crow Clone/Paper Clone): the threatened ally takes no
// damage at all, but the damage doesn't separately land on Yahiko either.
// The "would defeat it" gating is dropped for the same reason (no damage
// preview) — this can be activated against any targeted enemy ability aimed
// at another one of the controller's characters, not just a lethal one.
const yahikoSacrificesHimself: AbilityDef = {
  id: 'yahiko-sacrifices-himself',
  name: 'Yahiko Sacrifices Himself',
  cost: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    const pooled = found && isCharacter(found.occupant) ? found.occupant.chakraPool.current : 0;
    return 2 + pooled;
  },
  speed: 'Reactive',
  style: 'None',
  type: 'None',
  isUltimate: true,
  targetSide: 'ally', // "one of your other characters"
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    const allyId = ctx.targetInstanceIds[0];
    if (!found || !isCharacter(found.occupant) || !allyId || allyId === ctx.sourceInstanceId) return false;
    const owner = found.player;
    const opponent = owner === 'p1' ? 'p2' : 'p1';
    const countUnits = (p: typeof ctx.state.players.p1) =>
      p.backRow.filter((c) => c).length + p.frontRow.filter((t) => t).length;
    if (countUnits(ctx.state.players[opponent]) < countUnits(ctx.state.players[owner]) + 2) return false;

    return ctx.state.stack.some((item) => item.targets.includes(allyId) && item.controllerId !== owner);
  },
  resolve: (ctx) => {
    const allyId = ctx.targetInstanceIds[0];
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!allyId || !found) return ctx.state;
    const owner = found.player;

    let state = ctx.state;
    const idx = state.stack.findIndex((item) => item.targets.includes(allyId) && item.controllerId !== owner);
    if (idx === -1) return appendLog(state, 'Yahiko finds no attack left to intercept.');

    const negated = state.stack[idx];
    state = { ...state, stack: [...state.stack.slice(0, idx), ...state.stack.slice(idx + 1)] };
    return appendLog(state, `Yahiko throws himself in front of ${negated.abilityName}, sparing his ally.`);
  },
};

registerCharacter({
  id: DEF_ID,
  name: 'Yahiko',
  rank: 'C',
  baseMaxHP: 8,
  basePoolCapacity: 2,
  styles: ['Water', 'Fire', 'Wind'],
  abilities: [bladeOfResolve, waterJetStream, waterPillarWall, rallyingWords],
  ultimate: yahikoSacrificesHimself,
  elementalVersatility: true,
  grantsInspiringLeader: true,
  synergy: ['Akatsuki', 'Pain', 'Konan'],
});
