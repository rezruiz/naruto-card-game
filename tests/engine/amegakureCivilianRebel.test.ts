import { describe, expect, it } from 'vitest';
import { gameReducer } from '../../src/engine/reducer';
import { freshCombat, giveChakra, resolveTop, withCharacterAt } from './testUtils';

describe('Amegakure Civilian Rebel', () => {
  it('has the printed D-rank stats', () => {
    const state = withCharacterAt(freshCombat(), 'p1', 0, 'amegakure-civilian-rebel');
    const rebel = state.players.p1.backRow[0]!;
    expect(rebel.rank).toBe('D');
    expect(rebel.maxHP).toBe(3);
    expect(rebel.chakraPool.capacity).toBe(1);
    expect(rebel.styles).toEqual([]);
  });

  it('Shinobi Strike deals 1 damage, or 2 if Yahiko is in play', () => {
    const strike = (withYahiko: boolean) => {
      let s = withCharacterAt(freshCombat(), 'p1', 0, 'amegakure-civilian-rebel');
      if (withYahiko) s = withCharacterAt(s, 'p1', 1, 'yahiko');
      s = giveChakra(s, 'p1', 1);
      const hidan = s.players.p2.backRow[1]!.currentHP;
      s = gameReducer(s, {
        type: 'ACTIVATE_ABILITY',
        instanceId: 'p1-amegakure-civilian-rebel',
        abilityId: 'shinobi-strike',
        targetInstanceIds: ['p2-hidan'],
        payFromPool: 0,
      });
      s = resolveTop(s);
      return hidan - s.players.p2.backRow[1]!.currentHP;
    };
    expect(strike(false)).toBe(1);
    expect(strike(true)).toBe(2);
  });
});
