// Prototype: Yahiko as a named B-rank Shinobi (the card is in shinobi.ts — 6 Supplies, 2 Damage, 3 Health,
// Pool 8). His abilities live here, on a TokenDef with the card's id, and he pays for them from his own Pool.
import { findOccupant, isCharacter, patchOccupant } from '../board';
import { appendLog } from '../phases/phaseMachine';
import type { AbilityDef } from '../abilities';
import { redirectAttack, simulateResolution } from '../cards/negation';
import { registerTokenDef } from './registry';
import type { BoardOccupant, GameState, PlayerId } from '../types';

export const YAHIKO_SHINOBI_ID = 'shinobi-yahiko';

// "Until your next turn, each instance of damage dealt to Yahiko is reduced by 2." Used on your turn, so it
// lasts through the opponent's turn; combat.ts's dealDamage applies it to every hit, attack or ability.
const pillarEncirclement: AbilityDef = {
  id: 'pillar-encirclement',
  name: 'Water Release: Pillar Encirclement',
  cost: 3,
  speed: 'Normal',
  style: 'Water',
  type: 'Ninjutsu',
  maxTargets: 0,
  resolve: (ctx) => {
    const until = ctx.state.turn + 1;
    const next = patchOccupant(ctx.state, ctx.sourceInstanceId, (o) => ({ ...o, extra: { ...o.extra, pillarEncirclementUntilTurn: until } }));
    return appendLog(next, 'Pillar Encirclement: until your next turn, each hit Yahiko takes is reduced by 2.');
  },
};

/** Your Leaders (Pain's Paths count as Pain) and your Shinobi. */
function isAllyUnit(u: BoardOccupant | null): u is BoardOccupant {
  return !!u && (isCharacter(u) || u.extra.shinobi === true || u.extra.painPath === true);
}

// "Each ally's next attack this turn deals 1 additional damage." A Leader's ability attack spends it in
// combat.ts; a Shinobi's combat attack spends it in shinobi.ts.
const rallyingWords: AbilityDef = {
  id: 'rallying-words',
  name: 'Rallying Words',
  cost: 3,
  speed: 'Normal',
  style: 'None',
  type: 'Ninjutsu',
  maxTargets: 0,
  resolve: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found) return ctx.state;
    let state = ctx.state;
    const p = state.players[found.player];
    for (const ally of [...p.backRow, ...p.frontRow].filter(isAllyUnit)) {
      state = patchOccupant(state, ally.instanceId, (o) => ({ ...o, extra: { ...o.extra, rallyingWordsBonusTurn: ctx.state.turn, rallyingSpentOn: undefined } }));
    }
    return appendLog(state, "Rallying Words: each ally's next attack this turn deals 1 additional damage.");
  },
};

/** Characters for Selfless Resolve's condition: Leaders and Shinobi. */
function characterCount(state: GameState, player: PlayerId): number {
  const p = state.players[player];
  return [...p.backRow, ...p.frontRow].filter(isAllyUnit).length;
}

/** An enemy attack waiting on the stack, aimed at `allyId`, that would defeat it if it resolved now (after every reduction) — found by simulating it. */
function lethalAttackOn(state: GameState, owner: PlayerId, allyId: string) {
  return state.stack.find((item) => {
    if (!item.targets.includes(allyId) || item.controllerId === owner) return false;
    return !findOccupant(simulateResolution(state, item), allyId);
  });
}

// "Condition: your opponent controls at least 2 more characters (Leaders and Shinobi) than you. In response to a
// targeted attack on one of your other characters that would defeat it, redirect all of that damage, after the
// original target's reductions, to Yahiko instead. The original target takes none. Yahiko's own abilities can't
// reduce this damage. Untargeted effects can't trigger this." Shinobi combat attacks don't use the stack, so
// this answers Jutsu and abilities.
const selflessResolve: AbilityDef = {
  id: 'selfless-resolve',
  name: 'Selfless Resolve',
  cost: 5,
  speed: 'Reactive',
  style: 'None',
  type: 'None',
  isUltimate: true,
  targetSide: 'ally', // "one of your other characters"
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    const allyId = ctx.targetInstanceIds[0];
    if (!found || !allyId || allyId === ctx.sourceInstanceId || !isAllyUnit(findOccupant(ctx.state, allyId)?.occupant ?? null)) return false;
    const owner = found.player;
    if (characterCount(ctx.state, owner === 'p1' ? 'p2' : 'p1') < characterCount(ctx.state, owner) + 2) return false;
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
    return redirectAttack(ctx.state, item.id, allyId, ctx.sourceInstanceId, { ownReductionsOff: true }, 'Selfless Resolve');
  },
};

registerTokenDef({
  id: YAHIKO_SHINOBI_ID,
  name: 'Yahiko',
  traits: ['Elemental Versatility'],
  sharedElementalVersatility: true,
  abilities: [pillarEncirclement, rallyingWords, selflessResolve],
});
