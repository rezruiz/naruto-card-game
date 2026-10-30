// Prototype: the Amegakure Jonin specialists — generic Shinobi (shinobi.ts, 5 Supplies, 2/6, Pool 4), each with
// one jutsu of its specialty, paid from its own Pool. Their abilities live here, on TokenDefs with the cards' ids.
import { findOccupant, getAdjacent, patchOccupant } from '../board';
import { dealDamage } from '../combat';
import { drawCard } from '../deck';
import { appendLog } from '../phases/phaseMachine';
import { applyPoison } from '../poison';
import type { AbilityDef } from '../abilities';
import type { PlayerId } from '../types';
import { getCharacterDef, registerTokenDef } from './registry';
import { getHandCardDef } from '../cards/registry';

export const WATER_SPECIALIST_ID = 'shinobi-rain-jonin-water';
export const WIND_SPECIALIST_ID = 'shinobi-rain-jonin-wind';
export const POISON_SPECIALIST_ID = 'shinobi-rain-jonin-poison';

// "Deal 2 damage."
const rainWaterBullet: AbilityDef = {
  id: 'rain-water-bullet',
  name: 'Water Release: Rain Water Bullet',
  cost: 2,
  speed: 'Normal',
  style: 'Water',
  type: 'Ninjutsu',
  isDamaging: true,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    return target ? dealDamage(ctx.state, target, 2).state : ctx.state;
  },
};

// "Deal 1 damage to each of up to 2 enemy units."
const galeBlade: AbilityDef = {
  id: 'gale-blade',
  name: 'Wind Release: Gale Blade',
  cost: 3,
  speed: 'Normal',
  style: 'Wind',
  type: 'Ninjutsu',
  isDamaging: true,
  maxTargets: 2,
  legalityCheck: (ctx) => ctx.targetInstanceIds.length >= 1 && new Set(ctx.targetInstanceIds).size === ctx.targetInstanceIds.length,
  resolve: (ctx) => {
    let state = ctx.state;
    for (const id of ctx.targetInstanceIds.slice(0, 2)) if (findOccupant(state, id)) state = dealDamage(state, id, 1).state;
    return state;
  },
};

// "Up to 2 enemy Shinobi adjacent to each other each get 2 Poison counters."
const poisonFog: AbilityDef = {
  id: 'poison-fog',
  name: 'Poison Fog',
  cost: 4,
  speed: 'Normal',
  style: 'Poison',
  type: 'Ninjutsu',
  isDamaging: true,
  maxTargets: 2,
  legalityCheck: (ctx) => {
    const [first, second] = ctx.targetInstanceIds;
    const a = first ? findOccupant(ctx.state, first) : undefined;
    if (!a || a.occupant.extra.shinobi !== true) return false;
    if (!second) return true;
    const b = findOccupant(ctx.state, second);
    if (!b || second === first || b.occupant.extra.shinobi !== true) return false;
    const adj = getAdjacent(ctx.state, a.player, a.zone, a.index);
    return [adj.left, adj.right, adj.front, adj.back].some((o) => o?.instanceId === second);
  },
  resolve: (ctx) => {
    let state = ctx.state;
    for (const id of ctx.targetInstanceIds.slice(0, 2)) if (findOccupant(state, id)) state = applyPoison(state, id, 2);
    return state;
  },
};

registerTokenDef({ id: WATER_SPECIALIST_ID, name: 'Amegakure Jonin: Water Specialist', abilities: [rainWaterBullet] });
registerTokenDef({ id: WIND_SPECIALIST_ID, name: 'Amegakure Jonin: Wind Specialist', abilities: [galeBlade] });
registerTokenDef({ id: POISON_SPECIALIST_ID, name: 'Amegakure Jonin: Poison Specialist', abilities: [poisonFog] });

export const SENSOR_ELITE_ID = 'shinobi-rain-elite-sensor';
export const BODYGUARD_ELITE_ID = 'shinobi-rain-elite-bodyguard';

// Sensor: "When it enters play, look at your opponent's hand, then draw a card." The names go in the log,
// which isn't hidden — the opponent only learns what they already know.
registerTokenDef({
  id: SENSOR_ELITE_ID,
  name: 'Amegakure Elite Guard: Sensor',
  traits: ['Rain Sensing'],
  abilities: [],
  onEnterPlay: (state, _instanceId, player) => {
    const opponent: PlayerId = player === 'p1' ? 'p2' : 'p1';
    const names = state.players[opponent].hand.map((h) => (h.kind === 'card' ? (getHandCardDef(h.defId)?.name ?? h.defId) : (getCharacterDef(h.entryId)?.name ?? 'a character card')));
    const looked = appendLog(state, `Rain Sensing: ${player} looks at ${opponent}'s hand — ${names.length ? names.join(', ') : 'it is empty'}.`);
    // A snapshot for the viewer's hand window — it shows the hand as it is right now, not as it changes.
    const peek = { id: `peek-${state.log.length}`, viewer: player, owner: opponent, turn: state.turn, source: 'Rain Sensing', cards: state.players[opponent].hand.map((h) => ({ ...h })) };
    return drawCard({ ...looked, handPeeks: [...(looked.handPeeks ?? []), peek] }, player);
  },
});

// Bodyguard: "Rain Shield — until your next turn, each instance of damage dealt to one of your units is reduced
// by 2." combat.ts's dealDamage applies it (extra.rainShieldUntilTurn).
const rainShield: AbilityDef = {
  id: 'rain-shield',
  name: 'Rain Shield',
  cost: 4,
  speed: 'Normal',
  style: 'Water',
  type: 'Ninjutsu',
  targetSide: 'ally',
  maxTargets: 1,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    const found = target ? findOccupant(ctx.state, target) : undefined;
    if (!found) return ctx.state;
    const until = ctx.state.turn + 1;
    const next = patchOccupant(ctx.state, target, (o) => ({ ...o, extra: { ...o.extra, rainShieldUntilTurn: until } }));
    return appendLog(next, `Rain Shield: until ${found.player}'s next turn, each hit ${found.occupant.name} takes is reduced by 2.`);
  },
};

registerTokenDef({ id: BODYGUARD_ELITE_ID, name: 'Amegakure Elite Guard: Bodyguard', abilities: [rainShield] });
