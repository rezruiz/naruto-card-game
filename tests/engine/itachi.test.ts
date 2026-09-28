import { describe, expect, it } from 'vitest';
import { activateAbility, checkLegality, findAbility } from '../../src/engine/abilities';
import { gameReducer } from '../../src/engine/reducer';
import { freshCombat, giveChakra, resolveTop } from './testUtils';

describe('Itachi', () => {
  it('Deterioration caps Itachi at 2 ability activations per turn', () => {
    let state = giveChakra(freshCombat(), 'p1', 10);
    state = activateAbility(state, 'p1-itachi', 'crow-shuriken-barrage', ['p2-kakuzu'], 0);
    state = resolveTop(state);
    state = activateAbility(state, 'p1-itachi', 'great-fireball-technique', ['p2-kakuzu'], 0);
    state = resolveTop(state);

    const stackBefore = state.stack.length;
    state = activateAbility(state, 'p1-itachi', 'crow-shuriken-barrage', ['p2-hidan'], 0);
    expect(state.stack.length).toBe(stackBefore); // 3rd activation this turn rejected
  });

  it('Mind Prison stuns the target (blocks abilities and pooling) and costs 1 instead of 3 against a lower rank', () => {
    let state = giveChakra(freshCombat(), 'p1', 3);
    // Itachi is S rank; every other starting character is A rank (lower) — full discount applies.
    state = activateAbility(state, 'p1-itachi', 'genjutsu-mind-prison', ['p2-kakuzu'], 0);
    expect(state.players.p1.genericChakraAvailable).toBe(2); // paid 1, not 3
    state = resolveTop(state);

    expect(state.players.p2.backRow[0]!.extra.stunnedUntilTurn).toBe(state.turn + 2);

    const ability = findAbility('kakuzu', 'earth-grudge-fear')!;
    const legality = checkLegality(state, 'p2-kakuzu', ability, ['p1-kakuzu'], 0);
    expect(legality.ok).toBe(false);

    // Pooling into the stunned character is also blocked.
    const poolBefore = state.players.p2.backRow[0]!.chakraPool.current;
    state = { ...state, activePlayer: 'p2' };
    const pooled = gameReducer(state, { type: 'POOL_CHAKRA', instanceId: 'p2-kakuzu', amount: 1 });
    expect(pooled.players.p2.backRow[0]!.chakraPool.current).toBe(poolBefore);
  });

  it("Mind Prison can't be used on the same character twice, ever", () => {
    let state = giveChakra(freshCombat(), 'p1', 3);
    state = activateAbility(state, 'p1-itachi', 'genjutsu-mind-prison', ['p2-kakuzu'], 0);
    state = resolveTop(state);

    state = giveChakra(state, 'p1', 3);
    const stackBefore = state.stack.length;
    state = activateAbility(state, 'p1-itachi', 'genjutsu-mind-prison', ['p2-kakuzu'], 0);
    expect(state.stack.length).toBe(stackBefore);
  });

  it('Crow Clone negates an enemy ability targeting Itachi before it resolves', () => {
    let state = giveChakra(freshCombat(), 'p2', 3);
    state = { ...state, activePlayer: 'p2', priorityPlayer: 'p2' };
    state = activateAbility(state, 'p2-kakuzu', 'earth-grudge-fear', ['p1-itachi'], 0);
    expect(state.stack).toHaveLength(1);

    // p1 responds with Crow Clone instead of passing.
    state = giveChakra(state, 'p1', 2);
    state = activateAbility(state, 'p1-itachi', 'crow-clone', [], 0);
    expect(state.stack).toHaveLength(2);

    const itachiHpBefore = state.players.p1.backRow[4]!.currentHP;
    state = gameReducer(state, { type: 'PASS_PRIORITY' });
    state = gameReducer(state, { type: 'PASS_PRIORITY' }); // resolves Crow Clone, which removes Earth Grudge Fear
    expect(state.stack).toHaveLength(0); // the negated ability never got its own resolution
    expect(state.players.p1.backRow[4]!.currentHP).toBe(itachiHpBefore); // never took the damage
  });

  it('Amaterasu deals 3 immediately, then 2 more at the start of each of the next 2 of Itachi\'s controller\'s Upkeeps', () => {
    let state = giveChakra(freshCombat(), 'p1', 7);
    // Target p2's own Itachi (11 HP) rather than Kakuzu, whose Five Hearts
    // would intercept a lethal-looking tick and muddy the HP math here.
    const hpBefore = state.players.p2.backRow[4]!.currentHP;
    state = activateAbility(state, 'p1-itachi', 'amaterasu', ['p2-itachi'], 0);
    state = resolveTop(state);
    expect(state.players.p2.backRow[4]!.currentHP).toBe(hpBefore - 3);

    // Advance to p1's next Upkeep (11 phases from Combat).
    for (let i = 0; i < 11; i++) state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    expect(state.activePlayer).toBe('p1');
    expect(state.phase).toBe('Upkeep');
    expect(state.players.p2.backRow[4]!.currentHP).toBe(hpBefore - 5); // 3 + 2

    // One full round later, the second tick fires.
    for (let i = 0; i < 14; i++) state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    expect(state.players.p2.backRow[4]!.currentHP).toBe(hpBefore - 7); // 3 + 2 + 2
    expect(state.players.p1.backRow[4]!.extra.amaterasuSchedule).toEqual([]);
  });
});
