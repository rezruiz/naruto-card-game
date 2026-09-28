import { describe, expect, it } from 'vitest';
import { activateAbility } from '../../src/engine/abilities';
import { gameReducer } from '../../src/engine/reducer';
import { dealDamage } from '../../src/engine/combat';
import { freshCombat, freshMain1, giveChakra, resolveTop } from './testUtils';
import type { GameState } from '../../src/engine/types';

function withSources(state: GameState, count: number): GameState {
  return {
    ...state,
    players: {
      ...state.players,
      p1: { ...state.players.p1, chakraSources: Array.from({ length: count }, () => ({ tapped: false })) },
    },
  };
}

/** Removes every p1 character except Kakuzu (starting) and Kisame, so Kisame's Synergy discount isn't fully saturated by the default 5-character roster. */
function withJustKakuzuAndKisame(state: GameState): GameState {
  return {
    ...state,
    players: {
      ...state.players,
      p1: { ...state.players.p1, backRow: state.players.p1.backRow.map((c, i) => (i === 0 || i === 3 ? c : null)) },
    },
  };
}

function advanceToP1Upkeep(state: GameState): GameState {
  let next = state;
  while (!(next.activePlayer === 'p1' && next.phase === 'Upkeep')) {
    next = gameReducer(next, { type: 'ADVANCE_PHASE' });
  }
  return next;
}

describe('usedAbilitiesThisTurn resets at Untap', () => {
  it('a once-per-turn ability can be used again on a later turn', () => {
    let state = giveChakra(freshCombat(), 'p1', 10);
    state = activateAbility(state, 'p1-kakuzu', 'earth-grudge-fear', ['p2-kakuzu'], 0);
    state = resolveTop(state);
    const stackBeforeRetry = state.stack.length;
    state = activateAbility(state, 'p1-kakuzu', 'earth-grudge-fear', ['p2-kakuzu'], 0);
    expect(state.stack.length).toBe(stackBeforeRetry); // still this turn — rejected

    for (let i = 0; i < 14; i++) state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    expect(state.activePlayer).toBe('p1');
    expect(state.phase).toBe('Combat');
    state = giveChakra(state, 'p1', 10);
    state = activateAbility(state, 'p1-kakuzu', 'earth-grudge-fear', ['p2-kakuzu'], 0);
    expect(state.stack).toHaveLength(1); // usable again on a new turn
  });
});

describe('Upkeep payment', () => {
  it('Disables a character whose Upkeep goes unpaid (no Chakra sources available)', () => {
    let state = withJustKakuzuAndKisame(freshMain1());
    // Kisame: S rank (3), 1 Synergy match (Kakuzu, Akatsuki) -> costs 2. No sources to tap.
    state = advanceToP1Upkeep(state);
    expect(state.players.p1.backRow[3]!.status.disabled).toBe(true);
  });

  it('pays Upkeep by auto-tapping Chakra sources when affordable', () => {
    let state = withSources(withJustKakuzuAndKisame(freshMain1()), 2);
    state = advanceToP1Upkeep(state);
    expect(state.players.p1.backRow[3]!.status.disabled).toBe(false);
    expect(state.players.p1.chakraSources.filter((s) => s.tapped)).toHaveLength(2);
  });

  it("the starting character's Upkeep is free (A Rank) regardless of affordability", () => {
    let state = withJustKakuzuAndKisame(freshMain1()); // no sources at all
    state = advanceToP1Upkeep(state);
    expect(state.players.p1.backRow[0]!.status.disabled).toBe(false); // Kakuzu (A, starting) — free
  });

  it('a B-rank starting character gains +1 Chakra pooled directly instead of paying Upkeep', () => {
    let state = withJustKakuzuAndKisame(freshMain1());
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, startingCharacterInstanceId: 'p1-hidan' } } };
    // Re-add Hidan for this test (he'd otherwise have been nulled out above).
    const hidan = freshMain1().players.p1.backRow[1]!;
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, backRow: state.players.p1.backRow.map((c, i) => (i === 1 ? hidan : c)) } } };
    const poolBefore = state.players.p1.backRow[1]!.chakraPool.current;
    state = advanceToP1Upkeep(state);
    expect(state.players.p1.backRow[1]!.chakraPool.current).toBe(poolBefore + 1);
    expect(state.players.p1.backRow[1]!.status.disabled).toBe(false);
  });
});

describe('Retreat (SPEC.md §6.5b)', () => {
  it('costs Chakra by Rank, sets Retreated, and grants full targeting immunity', () => {
    let state = giveChakra(freshMain1(), 'p1', 10);
    state = gameReducer(state, { type: 'RETREAT', instanceId: 'p1-hidan' }); // B rank: costs 2
    expect(state.players.p1.backRow[1]!.status.retreated).toBe(true);
    expect(state.players.p1.genericChakraAvailable).toBe(8);

    // Retreated characters can't be targeted at all while another non-Retreated unit exists.
    state = { ...state, activePlayer: 'p2', priorityPlayer: 'p2' };
    state = giveChakra(state, 'p2', 3);
    const stackBefore = state.stack.length;
    state = activateAbility(state, 'p2-kakuzu', 'earth-grudge-fear', ['p1-hidan'], 0);
    expect(state.stack.length).toBe(stackBefore);
  });

  it("can't Retreat your only non-Retreated character", () => {
    let state = giveChakra(freshMain1(), 'p1', 20);
    for (const id of ['p1-hidan', 'p1-deidara', 'p1-kisame', 'p1-itachi']) {
      state = gameReducer(state, { type: 'RETREAT', instanceId: id });
    }
    state = gameReducer(state, { type: 'RETREAT', instanceId: 'p1-kakuzu' });
    expect(state.players.p1.backRow[0]!.status.retreated).toBe(false); // rejected
  });

  it("can't Retreat a character that's already acted this turn", () => {
    let state = giveChakra(freshCombat(), 'p1', 10);
    state = activateAbility(state, 'p1-kakuzu', 'earth-grudge-fear', ['p2-kakuzu'], 0);
    state = { ...resolveTop(state), phase: 'Main2' }; // acted in Combat, now tries to Retreat in Main Phase 2
    state = gameReducer(state, { type: 'RETREAT', instanceId: 'p1-kakuzu' });
    expect(state.players.p1.backRow[0]!.status.retreated).toBe(false);
  });

  it('returning from Retreat is free and grants fresh summoning sickness', () => {
    let state = giveChakra(freshMain1(), 'p1', 10);
    state = gameReducer(state, { type: 'RETREAT', instanceId: 'p1-hidan' });
    const chakraBefore = state.players.p1.genericChakraAvailable;
    state = gameReducer(state, { type: 'RETURN_FROM_RETREAT', instanceId: 'p1-hidan' });
    expect(state.players.p1.backRow[1]!.status.retreated).toBe(false);
    expect(state.players.p1.genericChakraAvailable).toBe(chakraBefore); // free
    expect(state.players.p1.backRow[1]!.status.enteredTurn).toBe(state.turn); // fresh summoning sickness

    const stackBefore = state.stack.length;
    state = activateAbility(state, 'p1-hidan', 'triple-scythe-sweep', ['p2-kakuzu'], 0);
    expect(state.stack.length).toBe(stackBefore); // summoning sick again, rejected
  });
});

describe('Pool-XOR-act (SPEC.md §5.3)', () => {
  it('a character that already used an ability this turn cannot be pooled into', () => {
    let state = giveChakra(freshCombat(), 'p1', 10);
    state = activateAbility(state, 'p1-kakuzu', 'earth-grudge-fear', ['p2-kakuzu'], 0);
    state = { ...resolveTop(state), phase: 'Main2' }; // acted in Combat, now tries to pool in Main Phase 2
    const poolBefore = state.players.p1.backRow[0]!.chakraPool.current;
    state = gameReducer(state, { type: 'POOL_CHAKRA', instanceId: 'p1-kakuzu', amount: 1 });
    expect(state.players.p1.backRow[0]!.chakraPool.current).toBe(poolBefore); // rejected
  });
});

describe('Target legality (SPEC.md §9)', () => {
  it('an enemy-only ability rejects a friendly target', () => {
    let state = giveChakra(freshMain1(), 'p1', 10);
    const stackBefore = state.stack.length;
    state = activateAbility(state, 'p1-itachi', 'crow-shuriken-barrage', ['p1-hidan'], 0); // enemy-only, targeting an ally
    expect(state.stack.length).toBe(stackBefore);
  });

  it('an "any target" ability accepts a friendly target', () => {
    let state = giveChakra(freshCombat(), 'p1', 10);
    state = activateAbility(state, 'p1-kakuzu', 'earth-grudge-fear', ['p1-hidan'], 0);
    expect(state.stack).toHaveLength(1);
  });
});

describe('Retaliation (SPEC.md §6.6)', () => {
  it('sets retaliationPending when a character is defeated', () => {
    let state = freshMain1();
    expect(state.players.p2.retaliationPending).toBe(false);
    // Deidara has no onWouldBeDefeated hook (unlike Kakuzu/Hidan) — a lethal
    // hit is a true, unintercepted defeat.
    state = dealDamage(state, 'p2-deidara', 100).state;
    expect(state.players.p2.retaliationPending).toBe(true);
  });
});
