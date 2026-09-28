import { findOccupant } from '../board';
import { dealDamage } from '../combat';
import type { AbilityDef } from '../abilities';
import { registerCharacter } from './registry';

// Deliberately minimal by design (design/SPEC.md): no Traits, Ultimate, or
// Forbidden Technique — cheap, disposable D-rank filler with one basic strike.
const shinobiStrike: AbilityDef = {
  id: 'shinobi-strike',
  name: 'Shinobi Strike',
  cost: 1,
  speed: 'Normal',
  style: 'None',
  type: 'Taijutsu',
  isDamaging: true,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    const source = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!target || !source) return ctx.state;
    // "If Yahiko is in play, deal 2 instead" — Yahiko under the same player's control.
    const yahikoInPlay = ctx.state.players[source.player].backRow.some((c) => c?.defId === 'yahiko');
    return dealDamage(ctx.state, target, yahikoInPlay ? 2 : 1).state;
  },
};

registerCharacter({
  id: 'amegakure-civilian-rebel',
  name: 'Amegakure Civilian Rebel',
  rank: 'D',
  baseMaxHP: 3,
  basePoolCapacity: 1,
  styles: [],
  abilities: [shinobiStrike],
  synergy: ['Akatsuki'],
});
