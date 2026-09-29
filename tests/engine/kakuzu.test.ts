import { describe, expect, it } from 'vitest';
import { activateAbility } from '../../src/engine/abilities';
import { gameReducer } from '../../src/engine/reducer';
import { freshCombat, freshMain1, giveChakra, resolveTop } from './testUtils';

describe('Kakuzu', () => {
  it('Earth Grudge Fear deals 1 damage to any target (including an ally)', () => {
    let state = giveChakra(freshCombat(), 'p1', 1);
    const hpBefore = state.players.p1.backRow[1]?.currentHP ?? 0; // Hidan, an ally
    state = activateAbility(state, 'p1-kakuzu', 'earth-grudge-fear', ['p1-hidan'], 0);
    state = resolveTop(state);
    expect(state.players.p1.backRow[1]?.currentHP).toBe(hpBefore - 1);
  });

  it("won't activate an ability requiring a Style Kakuzu doesn't have", () => {
    let state = giveChakra(freshCombat(), 'p1', 3);
    // Strip Fire from Kakuzu to simulate a post-Five-Hearts Style loss.
    state = {
      ...state,
      players: {
        ...state.players,
        p1: {
          ...state.players.p1,
          backRow: state.players.p1.backRow.map((c, i) =>
            i === 0 && c ? { ...c, styles: c.styles.filter((s) => s !== 'Fire') } : c,
          ),
        },
      },
    };
    const stackBefore = state.stack.length;
    state = activateAbility(state, 'p1-kakuzu', 'searing-migraine', ['p2-kakuzu'], 0);
    expect(state.stack.length).toBe(stackBefore); // rejected, nothing pushed
  });

  it('Patchwork Threads requires at least 2 Chakra pooled and ends at exactly 2', () => {
    let state = freshMain1(); // pooling is a Main Phase action
    // Not enough pooled — should be rejected.
    const attempt = activateAbility(state, 'p1-kakuzu', 'patchwork-threads', [], 0);
    expect(attempt.stack).toHaveLength(0);

    // Pool 3, then activate on a later turn (pooling taps the character for
    // the rest of *this* turn, §5.3's pool-XOR-act rule) — should end at
    // exactly 2.
    state = giveChakra(state, 'p1', 3);
    state = gameReducer(state, { type: 'POOL_CHAKRA', instanceId: 'p1-kakuzu', amount: 3 });
    for (let i = 0; i < 14; i++) state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    expect(state.activePlayer).toBe('p1');
    expect(state.phase).toBe('Main1');
    // Its trigger: Kakuzu defeated someone this turn (combat.ts credits the kill).
    expect(activateAbility(state, 'p1-kakuzu', 'patchwork-threads', [], 0).stack).toHaveLength(0);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, backRow: state.players.p1.backRow.map((c) => (c?.defId === 'kakuzu' ? { ...c, extra: { ...c.extra, lastKillTurn: state.turn } } : c)) } } };
    state = activateAbility(state, 'p1-kakuzu', 'patchwork-threads', [], 0);
    state = resolveTop(state);
    expect(state.players.p1.backRow[0]?.chakraPool.current).toBe(2);
    expect(state.players.p1.backRow[0]?.extra.hearts).toBe(5); // capped at 5
  });

  it("Elemental Versatility discounts Kakuzu's first elemental jutsu each turn by 1, but not a second", () => {
    let state = giveChakra(freshCombat(), 'p1', 8);
    state = activateAbility(state, 'p1-kakuzu', 'searing-migraine', ['p2-kakuzu'], 0); // Fire Ninjutsu, printed cost 4
    expect(state.players.p1.genericChakraAvailable).toBe(5); // paid 3, not 4
    state = resolveTop(state);

    state = activateAbility(state, 'p1-kakuzu', 'pressure-damage', ['p2-hidan'], 0); // Wind Ninjutsu, printed cost 3
    expect(state.players.p1.genericChakraAvailable).toBe(2); // paid full 3 — discount already used this turn
  });
});
