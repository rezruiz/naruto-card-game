import { findOccupant, isCharacter, patchCharacter } from '../board';
import { dealDamage } from '../combat';
import { appendLog } from '../phases/phaseMachine';
import type { AbilityDef } from '../abilities';
import { redirectAttack, simulateResolution } from '../cards/negation';
import { registerCharacter } from './registry';
import type { GameState } from '../types';

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

// "Each ally's next attack this turn deals 1 additional damage." combat.ts
// applies the +1 to every hit of each ally's next damaging attack this turn.
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
          extra: { ...c.extra, rallyingWordsBonusTurn: ctx.state.turn, rallyingSpentOn: undefined },
        }));
      }
    }
    return appendLog(state, "Rallying Words: each ally's next attack this turn deals 1 additional damage.");
  },
};

/** An enemy attack waiting on the stack, aimed at `allyId`, that would defeat it if it resolved now (after every reduction) — found by simulating it. */
function lethalAttackOn(state: GameState, owner: 'p1' | 'p2', allyId: string) {
  return state.stack.find((item) => {
    if (!item.targets.includes(allyId) || item.controllerId === owner) return false;
    const after = simulateResolution(state, item);
    return !findOccupant(after, allyId);
  });
}

// "In response to a targeted attack aimed at one of your other characters
// that would defeat it — calculated after any damage-reduction effects —
// redirect all of that damage onto Yahiko instead; the original target takes
// none." "Would defeat it" is checked by simulating the waiting attack.
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
  spendsEntirePool: true,
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

    return !!lethalAttackOn(ctx.state, owner, allyId);
  },
  resolve: (ctx) => {
    const allyId = ctx.targetInstanceIds[0];
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!allyId || !found) return ctx.state;
    const owner = found.player;
    // Prefer the attack that would be lethal; fall back to any enemy attack on the ally (trust mode declares without checking).
    const item = lethalAttackOn(ctx.state, owner, allyId) ?? ctx.state.stack.find((it) => it.targets.includes(allyId) && it.controllerId !== owner);
    if (!item) return appendLog(ctx.state, 'Yahiko finds no attack left to intercept.');
    return redirectAttack(ctx.state, item.id, allyId, ctx.sourceInstanceId, {}, 'Yahiko Sacrifices Himself');
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
