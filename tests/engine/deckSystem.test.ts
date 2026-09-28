import { describe, expect, it } from 'vitest';
import { createSetupState } from '../../src/engine/state';
import { gameReducer } from '../../src/engine/reducer';
import { dealDamage } from '../../src/engine/combat';
import type { GameState } from '../../src/engine/types';

function chooseBoth(state: GameState, entryIdP1?: string, entryIdP2?: string): GameState {
  let next = state;
  const p1Pick = entryIdP1 ?? next.players.p1.pendingCharacterReveal!.revealed[0];
  const p2Pick = entryIdP2 ?? next.players.p2.pendingCharacterReveal!.revealed[0];
  next = gameReducer(next, { type: 'CHOOSE_CHARACTER', player: 'p1', entryId: p1Pick });
  next = gameReducer(next, { type: 'CHOOSE_CHARACTER', player: 'p2', entryId: p2Pick });
  return next;
}

/** Setup leaves the game sitting at Untap (turn 1) — advance to p1's Main1 so PLAY_CHARACTER (Main Phase only) is legal. */
function toMain1(state: GameState): GameState {
  let next = state;
  for (let i = 0; i < 3; i++) next = gameReducer(next, { type: 'ADVANCE_PHASE' });
  return next;
}

/**
 * A fully deterministic post-Setup state at p1's Main1, with p1's starting
 * character forced to Juzo Biwa rather than the random Setup draw — several
 * tests below need to reason precisely about "0 vs 1 character in play" and
 * board room, which the random draw could otherwise occasionally undermine
 * (e.g. if it happened to land on Pain, whose 6 Path tokens don't occupy the
 * back row at all).
 */
function setupWithJuzoStarting(): GameState {
  let state = createSetupState('p1');
  state = {
    ...state,
    players: { ...state.players, p1: { ...state.players.p1, pendingCharacterReveal: { revealed: ['juzo'], reason: 'setup' } } },
  };
  state = chooseBoth(state, 'juzo');
  return toMain1(state);
}

describe('Setup (SPEC.md §3)', () => {
  it('shuffles both decks, reveals 3 Character Deck cards each, and deals a 6-card starting hand', () => {
    const state = createSetupState('p1');
    expect(state.players.p1.characterDeck).toHaveLength(10); // 13 - 3 revealed
    expect(state.players.p1.pendingCharacterReveal!.revealed).toHaveLength(3);
    expect(state.players.p1.hand.filter((h) => h.kind === 'card')).toHaveLength(6);
    expect(state.players.p1.handDeck).toHaveLength(34); // 40 - 6 drawn
  });

  it('blocks every other action until both players choose a starting character', () => {
    let state = createSetupState('p1');
    const stackLenBefore = state.stack.length;
    state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    expect(state.phase).toBe('Untap'); // unchanged — blocked

    // p1 chooses, p2 hasn't yet — still blocked.
    state = gameReducer(state, { type: 'CHOOSE_CHARACTER', player: 'p1', entryId: state.players.p1.pendingCharacterReveal!.revealed[0] });
    state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    expect(state.phase).toBe('Untap');
    expect(state.stack.length).toBe(stackLenBefore);

    // p2 chooses too — now the game can proceed.
    state = gameReducer(state, { type: 'CHOOSE_CHARACTER', player: 'p2', entryId: state.players.p2.pendingCharacterReveal!.revealed[0] });
    state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    expect(state.phase).toBe('Upkeep');
  });

  it("choosing a starting character plays it onto the board immediately, for free, and sets startingCharacterInstanceId", () => {
    let state = createSetupState('p1');
    const pick = state.players.p1.pendingCharacterReveal!.revealed[0];
    state = gameReducer(state, { type: 'CHOOSE_CHARACTER', player: 'p1', entryId: pick });

    expect(state.players.p1.pendingCharacterReveal).toBeNull();
    const onBoard = state.players.p1.backRow.some((c) => c?.defId === pick);
    const onBoardOrTokens = onBoard || state.players.p1.frontRow.some((t) => t !== null); // Pain spawns tokens instead
    expect(onBoardOrTokens).toBe(true);
    expect(state.players.p1.startingCharacterInstanceId).not.toBeNull();
  });

  it('first mulligan redraws a full 6 for free; the second draws only 5', () => {
    let state = createSetupState('p1');
    state = chooseBoth(state);
    const firstHandDeckSize = state.players.p1.handDeck.length;

    state = gameReducer(state, { type: 'MULLIGAN', player: 'p1' });
    expect(state.players.p1.hand.filter((h) => h.kind === 'card')).toHaveLength(6);
    expect(state.players.p1.mulligansSoFar).toBe(1);
    expect(state.players.p1.handDeck).toHaveLength(firstHandDeckSize); // shuffled back + redrawn, net unchanged

    state = gameReducer(state, { type: 'MULLIGAN', player: 'p1' });
    expect(state.players.p1.hand.filter((h) => h.kind === 'card')).toHaveLength(5);
    expect(state.players.p1.mulligansSoFar).toBe(2);
  });
});

describe('Draw Phase (SPEC.md §4.3)', () => {
  it("the first player's first turn skips the Draw Phase, but their opponent's first turn draws normally", () => {
    let state = createSetupState('p1');
    state = chooseBoth(state);
    const p1HandDeckBefore = state.players.p1.handDeck.length;

    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // Upkeep
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // Draw — skipped for p1
    expect(state.players.p1.handDeck).toHaveLength(p1HandDeckBefore);

    // Finish p1's turn, into p2's turn.
    for (let i = 0; i < 5; i++) state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // Main1,Combat,Main2,End,Untap(p2)
    const p2HandDeckBefore = state.players.p2.handDeck.length;
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // p2 Upkeep
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // p2 Draw — NOT skipped
    expect(state.players.p2.handDeck).toHaveLength(p2HandDeckBefore - 1);
  });

  it('deals 3 Health damage instead of drawing when the Hand Deck is empty', () => {
    let state = createSetupState('p1');
    state = chooseBoth(state);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, handDeck: [] } } };
    const healthBefore = state.players.p1.health;

    // p1's turn-1 Draw is skipped regardless (first player's first turn) —
    // advance all the way to p1's *second* Draw Phase (turn 3), which isn't skipped.
    while (!(state.activePlayer === 'p1' && state.phase === 'Draw' && state.turn === 3)) {
      state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    }
    expect(state.players.p1.health).toBe(healthBefore - 3);
  });
});

describe('Play a Character from hand (SPEC.md §6.7/§8)', () => {
  it('the Reinforcement Tax escalates 3, 5, 7... and Empty-Board Waiver is skipped once a character is already in play', () => {
    let state = setupWithJuzoStarting();
    // Manually grant p1 a character-hand-entry and plenty of Chakra, bypassing the reveal flow for a focused test.
    state = {
      ...state,
      players: {
        ...state.players,
        p1: {
          ...state.players.p1,
          genericChakraAvailable: 20,
          hand: [...state.players.p1.hand, { kind: 'character', instanceId: 'p1-char-hand-test1', entryId: 'juzo' }],
        },
      },
    };
    state = gameReducer(state, { type: 'PLAY_CHARACTER', instanceId: 'p1-char-hand-test1' });
    expect(state.players.p1.genericChakraAvailable).toBe(17); // 20 - 3 (already has a starting character, no waiver)
    expect(state.players.p1.reinforcementsPlayed).toBe(1);
    expect(state.players.p1.backRow.some((c) => c?.defId === 'juzo')).toBe(true);

    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, hand: [...state.players.p1.hand, { kind: 'character', instanceId: 'p1-char-hand-test2', entryId: 'yahiko' }] },
      },
    };
    state = gameReducer(state, { type: 'PLAY_CHARACTER', instanceId: 'p1-char-hand-test2' });
    expect(state.players.p1.genericChakraAvailable).toBe(12); // 17 - 5 (2nd reinforcement)
    expect(state.players.p1.reinforcementsPlayed).toBe(2);
  });

  it('waives the tax (and does not advance the counter) when the player controls 0 characters', () => {
    let state = setupWithJuzoStarting();
    // Wipe p1's board to 0 characters to trigger the Empty-Board Waiver.
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, backRow: state.players.p1.backRow.map(() => null), genericChakraAvailable: 5 } } };
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, hand: [...state.players.p1.hand, { kind: 'character', instanceId: 'p1-char-hand-waiver', entryId: 'juzo' }] },
      },
    };
    state = gameReducer(state, { type: 'PLAY_CHARACTER', instanceId: 'p1-char-hand-waiver' });
    expect(state.players.p1.genericChakraAvailable).toBe(5); // unchanged — free
    expect(state.players.p1.reinforcementsPlayed).toBe(0); // waived, doesn't advance the counter
  });

  it('Pain spawns all 6 Path tokens instead of a single character', () => {
    let state = setupWithJuzoStarting();
    state = {
      ...state,
      players: {
        ...state.players,
        p1: {
          ...state.players.p1,
          genericChakraAvailable: 10,
          hand: [...state.players.p1.hand, { kind: 'character', instanceId: 'p1-char-hand-pain', entryId: 'pain' }],
        },
      },
    };
    state = gameReducer(state, { type: 'PLAY_CHARACTER', instanceId: 'p1-char-hand-pain' });
    const pathTokens = state.players.p1.frontRow.filter((t) => t && t.defId.endsWith('-path'));
    expect(pathTokens).toHaveLength(6);
  });

  it("a defeated character grants Retaliation — the next character played gets Ambush", () => {
    // Juzo Biwa has no onWouldBeDefeated hook (unlike Kakuzu/Hidan) — a
    // lethal hit is guaranteed to be a true, unintercepted defeat.
    let state = setupWithJuzoStarting();
    const starting = state.players.p1.startingCharacterInstanceId!;
    state = dealDamage(state, starting, 9999).state;
    expect(state.players.p1.retaliationPending).toBe(true);

    state = {
      ...state,
      players: {
        ...state.players,
        p1: {
          ...state.players.p1,
          genericChakraAvailable: 10,
          hand: [...state.players.p1.hand, { kind: 'character', instanceId: 'p1-char-hand-retal', entryId: 'yahiko' }],
        },
      },
    };
    state = gameReducer(state, { type: 'PLAY_CHARACTER', instanceId: 'p1-char-hand-retal' });
    const played = state.players.p1.backRow.find((c) => c?.defId === 'yahiko');
    expect(played?.status.hasAmbush).toBe(true);
    expect(state.players.p1.retaliationPending).toBe(false); // consumed
  });
});

describe('Reinforcement draw (SPEC.md §8)', () => {
  it("a character's defeat owes a draw-2-keep-1 reveal, without blocking the rest of the game", () => {
    let state = createSetupState('p1');
    state = chooseBoth(state);
    // Simulates what combat.ts sets on a true character defeat (tested
    // directly for combat.ts's own half in coreSystems.test.ts) — this test
    // is about the reducer's drain/gate behavior specifically.
    state = { ...state, players: { ...state.players, p2: { ...state.players.p2, pendingReinforcementDraws: 1 } } };
    const phaseBefore = state.phase;
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // should NOT be blocked by the pending reveal
    expect(state.phase).not.toBe(phaseBefore);
    expect(state.players.p2.pendingCharacterReveal).not.toBeNull(); // auto-drained
    expect(state.players.p2.pendingReinforcementDraws).toBe(0);
  });
});
