import { describe, expect, it } from 'vitest';
import { gameReducer } from '../../src/engine/reducer';
import { activateAbility } from '../../src/engine/abilities';
import { freshCombat, giveChakra } from './testUtils';

describe('stack & priority (SPEC.md §7)', () => {
  it('activating an ability pushes it onto the stack and passes priority to the opponent', () => {
    let state = giveChakra(freshCombat(), 'p1', 5);
    state = activateAbility(state, 'p1-kakuzu', 'earth-grudge-fear', ['p2-kakuzu'], 0);

    expect(state.stack).toHaveLength(1);
    expect(state.stack[0].abilityName).toBe('Earth Grudge Fear');
    expect(state.priorityPlayer).toBe('p2');
  });

  it('two passes in a row resolves the top stack item', () => {
    let state = giveChakra(freshCombat(), 'p1', 5);
    state = activateAbility(state, 'p1-kakuzu', 'earth-grudge-fear', ['p2-kakuzu'], 0);
    const hpBefore = state.players.p2.backRow[0]?.currentHP ?? 0;

    state = gameReducer(state, { type: 'PASS_PRIORITY' }); // p2 passes
    state = gameReducer(state, { type: 'PASS_PRIORITY' }); // p1 passes -> resolves

    expect(state.stack).toHaveLength(0);
    expect(state.players.p2.backRow[0]?.currentHP).toBe(hpBefore - 1);
  });

  it('resolves in LIFO order when a second ability is activated in response', () => {
    let state = giveChakra(freshCombat(), 'p1', 10);
    state = activateAbility(state, 'p1-kakuzu', 'earth-grudge-fear', ['p2-kakuzu'], 0);
    // p2 responds with a Quick-speed ability — Normal-speed abilities can't
    // be activated with a non-empty stack (SPEC.md §7).
    state = giveChakra(state, 'p2', 5);
    state = activateAbility(state, 'p2-kakuzu', 'false-darkness', ['p1-kakuzu'], 0);
    expect(state.stack).toHaveLength(2);

    const p1HpBefore = state.players.p1.backRow[0]?.currentHP ?? 0;
    const p2HpBefore = state.players.p2.backRow[0]?.currentHP ?? 0;

    state = gameReducer(state, { type: 'PASS_PRIORITY' });
    state = gameReducer(state, { type: 'PASS_PRIORITY' }); // resolves p2's response first
    expect(state.players.p1.backRow[0]?.currentHP).toBe(p1HpBefore - 2); // False Darkness: 2 dmg
    expect(state.players.p2.backRow[0]?.currentHP).toBe(p2HpBefore); // p1's original hasn't resolved yet

    state = gameReducer(state, { type: 'PASS_PRIORITY' });
    state = gameReducer(state, { type: 'PASS_PRIORITY' }); // resolves p1's original
    expect(state.players.p2.backRow[0]?.currentHP).toBe(p2HpBefore - 1); // Earth Grudge Fear: 1 dmg
    expect(state.stack).toHaveLength(0);
  });
});
