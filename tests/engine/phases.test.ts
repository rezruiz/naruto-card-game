import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../src/engine/state';
import { gameReducer } from '../../src/engine/reducer';
import { PHASE_ORDER } from '../../src/engine/types';

function advance(state: ReturnType<typeof createInitialState>, times = 1) {
  let next = state;
  for (let i = 0; i < times; i++) {
    next = gameReducer(next, { type: 'ADVANCE_PHASE' });
  }
  return next;
}

describe('turn phase machine', () => {
  it('starts at Untap, turn 1, with the given first player', () => {
    const state = createInitialState('p1');
    expect(state.phase).toBe('Untap');
    expect(state.turn).toBe(1);
    expect(state.activePlayer).toBe('p1');
  });

  it('cycles through all six phases in order', () => {
    let state = createInitialState('p1');
    for (const phase of PHASE_ORDER) {
      expect(state.phase).toBe(phase);
      state = advance(state);
    }
  });

  it('switches active player and increments turn after End Phase', () => {
    const state = advance(createInitialState('p1'), PHASE_ORDER.length);
    expect(state.phase).toBe('Untap');
    expect(state.activePlayer).toBe('p2');
    expect(state.turn).toBe(2);
  });

  it('gains exactly 1 base Chakra at Upkeep, every turn, never more', () => {
    let state = createInitialState('p1');
    state = advance(state, 1); // Untap -> Upkeep
    expect(state.phase).toBe('Upkeep');
    expect(state.players.p1.genericChakraAvailable).toBe(1);

    // Full lap back to p1's next Upkeep: still exactly 1, not accumulating
    // (End Phase clears unspent Chakra along the way, per §4.7).
    state = advance(state, PHASE_ORDER.length * 2);
    expect(state.phase).toBe('Upkeep');
    expect(state.activePlayer).toBe('p1');
    expect(state.players.p1.genericChakraAvailable).toBe(1);
  });

  it('only gives base Chakra to the player whose Upkeep it is, and clears the other on End Phase', () => {
    let state = createInitialState('p1');
    state = advance(state, PHASE_ORDER.length + 1); // p2's Upkeep
    expect(state.activePlayer).toBe('p2');
    expect(state.players.p2.genericChakraAvailable).toBe(1);
    expect(state.players.p1.genericChakraAvailable).toBe(0);
  });

  it('logs each phase transition', () => {
    const state = advance(createInitialState('p1'));
    expect(state.log.at(-1)?.text).toContain('Upkeep');
  });
});
