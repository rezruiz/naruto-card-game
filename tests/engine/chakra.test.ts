import { onlyStartingCharacter } from './testUtils';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../src/engine/state';
import { gameReducer } from '../../src/engine/reducer';

function advance(state: ReturnType<typeof createInitialState>, times = 1) {
  let next = state;
  for (let i = 0; i < times; i++) {
    next = gameReducer(next, { type: 'ADVANCE_PHASE' });
  }
  return next;
}

function toMain1(state: ReturnType<typeof createInitialState>) {
  // Untap -> Upkeep -> Draw -> Main1
  return advance(state, 3);
}

describe('Chakra sources (§5.2)', () => {
  it('can be placed once per turn during a Main Phase, consuming a hand card', () => {
    let state = toMain1(createInitialState('p1'));
    const handSizeBefore = state.players.p1.hand.length;

    state = gameReducer(state, { type: 'PLACE_CHAKRA_SOURCE', instanceId: state.players.p1.hand[0].instanceId });
    expect(state.players.p1.chakraSources).toHaveLength(1);
    expect(state.players.p1.chakraSources[0].tapped).toBe(false);
    expect(state.players.p1.hand).toHaveLength(handSizeBefore - 1);
    expect(state.players.p1.chakraSourcePlacedThisTurn).toBe(true);
  });

  it('cannot be placed twice in the same turn', () => {
    let state = toMain1(createInitialState('p1'));
    state = gameReducer(state, { type: 'PLACE_CHAKRA_SOURCE', instanceId: state.players.p1.hand[0].instanceId });
    state = gameReducer(state, { type: 'PLACE_CHAKRA_SOURCE', instanceId: state.players.p1.hand[0].instanceId });
    expect(state.players.p1.chakraSources).toHaveLength(1);
  });

  it('cannot be placed outside a Main Phase', () => {
    const state = createInitialState('p1'); // Untap Phase
    const result = gameReducer(state, { type: 'PLACE_CHAKRA_SOURCE', instanceId: state.players.p1.hand[0].instanceId });
    expect(result.players.p1.chakraSources).toHaveLength(0);
  });

  it('produces 1 Chakra when tapped, and cannot be tapped twice', () => {
    let state = toMain1(createInitialState('p1'));
    state = gameReducer(state, { type: 'PLACE_CHAKRA_SOURCE', instanceId: state.players.p1.hand[0].instanceId });
    const before = state.players.p1.genericChakraAvailable;

    state = gameReducer(state, { type: 'TAP_CHAKRA_SOURCE', sourceIndex: 0 });
    expect(state.players.p1.genericChakraAvailable).toBe(before + 1);
    expect(state.players.p1.chakraSources[0].tapped).toBe(true);

    const stuck = gameReducer(state, { type: 'TAP_CHAKRA_SOURCE', sourceIndex: 0 });
    expect(stuck.players.p1.genericChakraAvailable).toBe(before + 1);
  });

  it('untap at the start of the owner’s next turn, and the once-per-turn flag resets', () => {
    let state = toMain1(createInitialState('p1'));
    state = gameReducer(state, { type: 'PLACE_CHAKRA_SOURCE', instanceId: state.players.p1.hand[0].instanceId });
    state = gameReducer(state, { type: 'TAP_CHAKRA_SOURCE', sourceIndex: 0 });
    expect(state.players.p1.chakraSources[0].tapped).toBe(true);

    // Finish p1's turn, all of p2's turn, back to p1's next Untap.
    state = advance(state, 4 + 7); // Combat, Main2, End -> p2 Untap...End -> p1 Untap
    expect(state.activePlayer).toBe('p1');
    expect(state.phase).toBe('Untap');
    expect(state.players.p1.chakraSources[0].tapped).toBe(false);
    expect(state.players.p1.chakraSourcePlacedThisTurn).toBe(false);
  });

  it('total available Chakra grows turn over turn as sources accumulate, from a starting point of zero', () => {
    let state = onlyStartingCharacter(toMain1(createInitialState('p1')), 'p1'); // no upkeep to tap sources
    state = gameReducer(state, { type: 'PLACE_CHAKRA_SOURCE', instanceId: state.players.p1.hand[0].instanceId });
    state = gameReducer(state, { type: 'TAP_CHAKRA_SOURCE', sourceIndex: 0 });
    expect(state.players.p1.genericChakraAvailable).toBe(1); // 1 source, no base income

    // Full lap back to p1's Main1 next turn.
    state = advance(state, 4 + 7 + 3);
    expect(state.activePlayer).toBe('p1');
    expect(state.phase).toBe('Main1');
    // Nothing tapped yet this turn, and there's no automatic income.
    expect(state.players.p1.genericChakraAvailable).toBe(0);
    state = gameReducer(state, { type: 'TAP_CHAKRA_SOURCE', sourceIndex: 0 });
    expect(state.players.p1.genericChakraAvailable).toBe(1);

    state = gameReducer(state, { type: 'PLACE_CHAKRA_SOURCE', instanceId: state.players.p1.hand[0].instanceId });
    state = gameReducer(state, { type: 'TAP_CHAKRA_SOURCE', sourceIndex: 1 });
    expect(state.players.p1.genericChakraAvailable).toBe(2); // 2 sources
  });
});

describe('Personal Chakra Pooling (§5.3)', () => {
  it('pools generic Chakra into a character’s Pool, spending it from the generic pool', () => {
    let state = toMain1(createInitialState('p1'));
    state = gameReducer(state, { type: 'PLACE_CHAKRA_SOURCE', instanceId: state.players.p1.hand[0].instanceId });
    state = gameReducer(state, { type: 'TAP_CHAKRA_SOURCE', sourceIndex: 0 });
    expect(state.players.p1.genericChakraAvailable).toBe(1);

    state = gameReducer(state, { type: 'POOL_CHAKRA', instanceId: 'p1-kakuzu', amount: 1 });
    expect(state.players.p1.genericChakraAvailable).toBe(0);
    expect(state.players.p1.backRow[0]?.chakraPool.current).toBe(1);
  });

  it('cannot pool more than is available', () => {
    const state = toMain1(createInitialState('p1'));
    const result = gameReducer(state, { type: 'POOL_CHAKRA', instanceId: 'p1-kakuzu', amount: 5 });
    expect(result.players.p1.backRow[0]?.chakraPool.current).toBe(0);
  });

  it('cannot pool beyond the character’s capacity', () => {
    let state = onlyStartingCharacter(toMain1(createInitialState('p1')), 'p1'); // no upkeep to tap sources
    // Kakuzu's starting capacity is (5 Hearts - 1) * 2 = 8. Accumulate 9
    // sources over 9 of p1's turns, then tap all of them together in one
    // turn to have 9 Chakra available — more than the character can hold.
    for (let i = 0; i < 9; i++) {
      state = gameReducer(state, { type: 'PLACE_CHAKRA_SOURCE', instanceId: state.players.p1.hand[0].instanceId });
      state = advance(state, 4 + 7 + 3); // back to p1 Main1 next turn
    }
    for (let i = 0; i < 9; i++) {
      state = gameReducer(state, { type: 'TAP_CHAKRA_SOURCE', sourceIndex: i });
    }
    expect(state.players.p1.genericChakraAvailable).toBe(9);
    const result = gameReducer(state, { type: 'POOL_CHAKRA', instanceId: 'p1-kakuzu', amount: 9 });
    expect(result.players.p1.backRow[0]?.chakraPool.current).toBe(0); // rejected, capacity is 8
  });

  it('is not cleared at End Phase, unlike the generic pool', () => {
    let state = toMain1(createInitialState('p1'));
    state = gameReducer(state, { type: 'PLACE_CHAKRA_SOURCE', instanceId: state.players.p1.hand[0].instanceId });
    state = gameReducer(state, { type: 'TAP_CHAKRA_SOURCE', sourceIndex: 0 });
    state = gameReducer(state, { type: 'POOL_CHAKRA', instanceId: 'p1-kakuzu', amount: 1 });

    state = advance(state, 4); // Combat, Main2, End -> p2 Untap
    expect(state.players.p1.backRow[0]?.chakraPool.current).toBe(1);
    expect(state.players.p1.genericChakraAvailable).toBe(0);
  });

  it('cannot be pooled outside a Main Phase', () => {
    const state = createInitialState('p1'); // Untap Phase
    const result = gameReducer(state, { type: 'POOL_CHAKRA', instanceId: 'p1-kakuzu', amount: 1 });
    expect(result.players.p1.backRow[0]?.chakraPool.current).toBe(0);
  });
});
