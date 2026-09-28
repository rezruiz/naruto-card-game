import { describe, expect, it } from 'vitest';
import { activateAbility } from '../../src/engine/abilities';
import { gameReducer } from '../../src/engine/reducer';
import { freshCombat, freshMain1, giveChakra, resolveTop } from './testUtils';

describe('Deidara', () => {
  it('Explosive Clay generates a Clay Charge and can be used up to 3 times per turn', () => {
    let state = giveChakra(freshCombat(), 'p1', 3);
    expect(state.players.p1.backRow[2]?.extra.clayCharges).toBe(1); // starts with 1

    for (let i = 0; i < 3; i++) {
      state = activateAbility(state, 'p1-deidara', 'explosive-clay', [], 0);
      state = resolveTop(state);
    }
    expect(state.players.p1.backRow[2]?.extra.clayCharges).toBe(4);

    // 4th activation this turn should be rejected (usesPerTurn: 3).
    const stackBefore = state.stack.length;
    state = activateAbility(state, 'p1-deidara', 'explosive-clay', [], 0);
    expect(state.stack.length).toBe(stackBefore);
  });

  it('C1, Shi-Wan creates a Clay Spider token, capped at 5', () => {
    let state = giveChakra(freshCombat(), 'p1', 10);
    for (let i = 0; i < 2; i++) {
      state = activateAbility(state, 'p1-deidara', 'c1-shi-wan', [], 0);
      state = resolveTop(state);
    }
    expect(state.players.p1.frontRow.filter((t) => t?.defId === 'clay-spider')).toHaveLength(2);

    // usesPerTurn is 2 — a 3rd this turn is rejected regardless of the 5-cap.
    const stackBefore = state.stack.length;
    state = activateAbility(state, 'p1-deidara', 'c1-shi-wan', [], 0);
    expect(state.stack.length).toBe(stackBefore);
  });

  it('Detonation Art deals 4 (not 2) when a Clay Charge is available, and spends it', () => {
    let state = giveChakra(freshCombat(), 'p1', 3);
    const targetHpBefore = state.players.p2.backRow[0]?.currentHP ?? 0;
    state = activateAbility(state, 'p1-deidara', 'detonation-art', ['p2-kakuzu'], 0);
    state = resolveTop(state);
    expect(state.players.p2.backRow[0]?.currentHP).toBe(targetHpBefore - 4);
    expect(state.players.p1.backRow[2]?.extra.clayCharges).toBe(0); // spent
  });

  it('C3, Shi-Suri requires a full Pool and 5 Clay Charges, and hits in a cross pattern', () => {
    let state = freshMain1(); // pooling is a Main Phase action
    // Not enough Charges or Pool yet — rejected.
    const stackBefore = state.stack.length;
    state = activateAbility({ ...state, phase: 'Combat' }, 'p1-deidara', 'c3-shi-suri', ['p2-kakuzu'], 0);
    expect(state.stack.length).toBe(stackBefore);
    state = { ...state, phase: 'Main1' };

    // Fill Deidara's Pool (capacity 3) and stock 5 Clay Charges.
    state = giveChakra(state, 'p1', 3);
    state = gameReducer(state, { type: 'POOL_CHAKRA', instanceId: 'p1-deidara', amount: 3 });
    // Pooling taps Deidara for the rest of *this* turn (§5.3's pool-XOR-act
    // rule) — advance to a later turn before activating his Ultimate.
    for (let i = 0; i < 15; i++) state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    expect(state.activePlayer).toBe('p1');
    expect(state.phase).toBe('Combat'); // damaging Normal-speed abilities are a Combat action (§4.5)
    state = {
      ...state,
      players: {
        ...state.players,
        p1: {
          ...state.players.p1,
          backRow: state.players.p1.backRow.map((c, i) =>
            i === 2 && c ? { ...c, extra: { ...c.extra, clayCharges: 5 } } : c,
          ),
        },
      },
    };
    state = giveChakra(state, 'p1', 5);

    const kakuzuHpBefore = state.players.p2.backRow[0]?.currentHP ?? 0; // primary target
    const hidanHpBefore = state.players.p2.backRow[1]?.currentHP ?? 0; // right neighbor — cross pattern

    state = activateAbility(state, 'p1-deidara', 'c3-shi-suri', ['p2-kakuzu'], 0);
    expect(state.stack).toHaveLength(1);
    state = resolveTop(state);

    expect(state.players.p2.backRow[0]?.currentHP).toBe(kakuzuHpBefore - 5); // primary hit
    expect(state.players.p2.backRow[1]?.currentHP).toBe(hidanHpBefore - 3); // cross-pattern splash
  });
});
