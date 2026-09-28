import { describe, expect, it } from 'vitest';
import { activateAbility } from '../../src/engine/abilities';
import { gameReducer } from '../../src/engine/reducer';
import { freshCombat, giveChakra, resolveTop, withCharacterAt } from './testUtils';

function withZetsu() {
  return withCharacterAt(freshCombat(), 'p1', 0, 'zetsu'); // replaces p1's Kakuzu slot
}

describe('Zetsu', () => {
  it('No Self-Pooling blocks the normal pooling action, but Pool capacity is unlimited', () => {
    let state = giveChakra(withZetsu(), 'p1', 5);
    expect(state.players.p1.backRow[0]!.chakraPool.capacity).toBe(Infinity);
    state = gameReducer(state, { type: 'POOL_CHAKRA', instanceId: 'p1-zetsu', amount: 5 });
    expect(state.players.p1.backRow[0]!.chakraPool.current).toBe(0); // blocked
  });

  it('Dual Nature: switching is free and unlimited, but Corpse Consumption/Sinister Whisper share one use per turn', () => {
    let state = giveChakra(withZetsu(), 'p1', 4);
    // Starts in White mode — Corpse Consumption is legal, Sinister Whisper isn't.
    let stackBefore = state.stack.length;
    state = activateAbility(state, 'p1-zetsu', 'black-zetsu-sinister-whisper', ['p2-kakuzu'], 0);
    expect(state.stack.length).toBe(stackBefore); // wrong mode, rejected

    state = activateAbility(state, 'p1-zetsu', 'white-zetsu-corpse-consumption', [], 0);
    expect(state.stack).toHaveLength(1);
    state = resolveTop(state);

    // Switch to Black mode (free, unlimited) — but the shared-use group is
    // already spent this turn, so Sinister Whisper is still rejected.
    state = activateAbility(state, 'p1-zetsu', 'dual-nature-switch', [], 0);
    state = resolveTop(state);
    expect(state.players.p1.backRow[0]!.extra.mode).toBe('black');

    stackBefore = state.stack.length;
    state = activateAbility(state, 'p1-zetsu', 'black-zetsu-sinister-whisper', ['p2-kakuzu'], 0);
    expect(state.stack.length).toBe(stackBefore); // shared-use group already spent
  });

  it('Corpse Consumption heals 4 instead of 2 if any character was defeated this turn', () => {
    let state = giveChakra(withZetsu(), 'p1', 2);
    state = { ...state, log: [...state.log, { id: 'x', turn: state.turn, phase: state.phase, text: 'Someone is defeated.' }] };
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, backRow: state.players.p1.backRow.map((c, i) => (i === 0 && c ? { ...c, currentHP: 1 } : c)) } },
    };
    state = activateAbility(state, 'p1-zetsu', 'white-zetsu-corpse-consumption', [], 0);
    state = resolveTop(state);
    expect(state.players.p1.backRow[0]!.currentHP).toBe(5); // 1 + 4
  });

  it('White Zetsu Army creates 3 Clones (capped at 5 in play), and each Clone pays from Zetsu\'s own shared Pool', () => {
    let state = giveChakra(withZetsu(), 'p1', 20);
    // Feed Zetsu's Pool via Absorb (Sinister Whisper first requires Black mode).
    state = activateAbility(state, 'p1-zetsu', 'dual-nature-switch', [], 0);
    state = resolveTop(state);
    state = activateAbility(state, 'p1-zetsu', 'black-zetsu-sinister-whisper', ['p2-kakuzu'], 0);
    state = resolveTop(state);
    expect(state.players.p1.backRow[0]!.chakraPool.current).toBe(1); // absorbed 1

    state = activateAbility(state, 'p1-zetsu', 'dual-nature-switch', [], 0);
    state = resolveTop(state);
    state = activateAbility(state, 'p1-zetsu', 'white-zetsu-army', [], 0); // paid entirely from generic
    expect(state.stack).toHaveLength(1);
    state = resolveTop(state);
    expect(state.players.p1.frontRow.filter((t) => t?.defId === 'white-zetsu-clone')).toHaveLength(3);
    expect(state.players.p1.backRow[0]!.chakraPool.current).toBe(1); // untouched — paid all-generic above

    const clone = state.players.p1.frontRow.find((t) => t?.defId === 'white-zetsu-clone')!;
    // Clone Strike costs 1 Chakra, payable from Zetsu's shared Pool (1 banked).
    state = activateAbility(state, clone.instanceId, 'clone-strike', ['p2-kakuzu'], 1);
    expect(state.stack).toHaveLength(1);
    state = resolveTop(state);
    expect(state.players.p1.backRow[0]!.chakraPool.current).toBe(1); // spent 1, absorbed 1 back
  });

  it('Combine: Zetsu Golem consumes >=3 Clones into one Golem with their combined current HP', () => {
    let state = giveChakra(withZetsu(), 'p1', 10);
    state = activateAbility(state, 'p1-zetsu', 'white-zetsu-army', [], 0);
    state = resolveTop(state);
    const clones = state.players.p1.frontRow.filter((t) => t?.defId === 'white-zetsu-clone');
    expect(clones).toHaveLength(3);
    const cloneIds = clones.map((c) => c!.instanceId);

    state = activateAbility(state, 'p1-zetsu', 'combine-zetsu-golem', cloneIds, 0);
    expect(state.stack).toHaveLength(1);
    state = resolveTop(state);

    expect(state.players.p1.frontRow.filter((t) => t?.defId === 'white-zetsu-clone')).toHaveLength(0);
    const golem = state.players.p1.frontRow.find((t) => t?.defId === 'zetsu-golem');
    expect(golem).toBeDefined();
    expect(golem!.currentHP).toBe(6); // 3 Clones x 2 HP each
  });

  it("Golem Strike plants a Chakra Spore that drains the target's Pool into Zetsu's at the target's own next Upkeep", () => {
    let state = giveChakra(withZetsu(), 'p1', 10);
    state = activateAbility(state, 'p1-zetsu', 'white-zetsu-army', [], 0);
    state = resolveTop(state);
    const cloneIds = state.players.p1.frontRow.filter((t) => t?.defId === 'white-zetsu-clone').map((t) => t!.instanceId);
    state = activateAbility(state, 'p1-zetsu', 'combine-zetsu-golem', cloneIds, 0);
    state = resolveTop(state);
    const golem = state.players.p1.frontRow.find((t) => t?.defId === 'zetsu-golem')!;

    // Pool some Chakra onto the target directly.
    state = {
      ...state,
      players: {
        ...state.players,
        p2: { ...state.players.p2, backRow: state.players.p2.backRow.map((c, i) => (i === 0 && c ? { ...c, chakraPool: { ...c.chakraPool, current: 5 } } : c)) },
      },
    };

    state = activateAbility(state, golem.instanceId, 'golem-strike', ['p2-kakuzu'], 0);
    expect(state.stack).toHaveLength(1);
    state = resolveTop(state);
    expect(state.players.p2.backRow[0]!.currentHP).toBe(state.players.p2.backRow[0]!.maxHP - 3);

    // Advance to p2's next Upkeep.
    while (!(state.activePlayer === 'p2' && state.phase === 'Upkeep')) {
      state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    }
    expect(state.players.p2.backRow[0]!.chakraPool.current).toBe(2); // drained 3 of 5
    expect(state.players.p1.backRow[0]!.chakraPool.current).toBe(3); // Zetsu's shared Pool gains it
  });
});
