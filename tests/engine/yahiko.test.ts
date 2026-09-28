import { describe, expect, it } from 'vitest';
import { activateAbility } from '../../src/engine/abilities';
import { dealDamage } from '../../src/engine/combat';
import { gameReducer } from '../../src/engine/reducer';
import { freshCombat, giveChakra, resolveTop, withCharacterAt } from './testUtils';

function withYahiko() {
  return withCharacterAt(freshCombat(), 'p1', 0, 'yahiko'); // replaces p1's Kakuzu slot
}

describe('Yahiko', () => {
  it('Blade of Resolve deals 2 damage', () => {
    let state = giveChakra(withYahiko(), 'p1', 2);
    const hpBefore = state.players.p2.backRow[0]!.currentHP;
    state = activateAbility(state, 'p1-yahiko', 'blade-of-resolve', ['p2-kakuzu'], 0);
    state = resolveTop(state);
    expect(state.players.p2.backRow[0]!.currentHP).toBe(hpBefore - 2);
  });

  it('Elemental Versatility discounts the first elemental jutsu each turn by 1, not a second', () => {
    let state = giveChakra(withYahiko(), 'p1', 5);
    state = activateAbility(state, 'p1-yahiko', 'water-jet-stream', ['p2-kakuzu'], 0); // Water Ninjutsu, printed 3
    expect(state.players.p1.genericChakraAvailable).toBe(3); // paid 2, not 3
    state = resolveTop(state);

    state = activateAbility(state, 'p1-yahiko', 'water-pillar-wall', [], 0); // Water Ninjutsu, printed 2
    expect(state.players.p1.genericChakraAvailable).toBe(1); // paid full 2 — discount already used
  });

  it('Water Pillar Wall prevents the next 2 damage taken this turn', () => {
    let state = giveChakra(withYahiko(), 'p1', 2);
    state = activateAbility(state, 'p1-yahiko', 'water-pillar-wall', [], 0);
    state = resolveTop(state);

    const hpBefore = state.players.p1.backRow[0]!.currentHP;
    state = dealDamage(state, 'p1-yahiko', 1).state;
    expect(state.players.p1.backRow[0]!.currentHP).toBe(hpBefore); // fully prevented (1 of 2)

    state = dealDamage(state, 'p1-yahiko', 5).state;
    // 1 point of prevention left, so only 4 of the 5 gets through.
    expect(state.players.p1.backRow[0]!.currentHP).toBe(hpBefore - 4);
  });

  it("Inspiring Leader discounts an ally's first ability each turn by 1, but not a second ability", () => {
    let state = giveChakra(withYahiko(), 'p2', 5);
    // p1's Hidan (an ally of Yahiko) gets the discount on his own first activation.
    state = giveChakra(withYahiko(), 'p1', 5);
    state = activateAbility(state, 'p1-hidan', 'triple-scythe-sweep', ['p2-kakuzu'], 0); // printed cost 2
    expect(state.players.p1.genericChakraAvailable).toBe(4); // paid 1, not 2
  });

  it('Yahiko Sacrifices Himself negates an attack targeting an ally, but only when outnumbered by 2+', () => {
    let state = withYahiko();
    // Remove 2 of p1's characters so p2 (still at 5) outnumbers p1 (3) by 2.
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, backRow: state.players.p1.backRow.map((c, i) => (i >= 3 ? null : c)) },
      },
    };
    state = { ...state, activePlayer: 'p2', priorityPlayer: 'p2' };
    state = giveChakra(state, 'p2', 3);
    state = activateAbility(state, 'p2-kakuzu', 'earth-grudge-fear', ['p1-hidan'], 0);
    expect(state.stack).toHaveLength(1);

    state = giveChakra(state, 'p1', 5);
    state = activateAbility(state, 'p1-yahiko', 'yahiko-sacrifices-himself', ['p1-hidan'], 0);
    expect(state.stack).toHaveLength(2);

    const hidanHpBefore = state.players.p1.backRow[1]!.currentHP;
    state = gameReducer(state, { type: 'PASS_PRIORITY' });
    state = gameReducer(state, { type: 'PASS_PRIORITY' }); // resolves the Ultimate, negating Earth Grudge Fear
    expect(state.stack).toHaveLength(0);
    expect(state.players.p1.backRow[1]!.currentHP).toBe(hidanHpBefore); // Hidan untouched
  });
});
