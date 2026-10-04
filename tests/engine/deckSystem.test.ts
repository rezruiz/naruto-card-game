import { describe, expect, it } from 'vitest';
import { createSetupState } from '../../src/engine/state';
import { gameReducer } from '../../src/engine/reducer';
import { payUpkeep, previewUpkeep } from '../../src/engine/upkeep';
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
    expect(state.players.p1.handDeck).toHaveLength(44); // 50 - 6 drawn
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
    const firstHandDeckSize = state.players.p1.handDeck.length;

    state = gameReducer(state, { type: 'MULLIGAN', player: 'p1' });
    expect(state.players.p1.hand.filter((h) => h.kind === 'card')).toHaveLength(6);
    expect(state.players.p1.mulligansSoFar).toBe(1);
    expect(state.players.p1.handDeck).toHaveLength(firstHandDeckSize); // shuffled back + redrawn, net unchanged

    state = gameReducer(state, { type: 'MULLIGAN', player: 'p1' });
    expect(state.players.p1.hand.filter((h) => h.kind === 'card')).toHaveLength(5);
    expect(state.players.p1.mulligansSoFar).toBe(2);
  });

  it('mulligan is each player’s own choice, available until THAT player confirms their starting character', () => {
    let state = createSetupState('p1');
    state = gameReducer(state, { type: 'CHOOSE_CHARACTER', player: 'p1', entryId: state.players.p1.pendingCharacterReveal!.revealed[0] });
    const p1Hand = state.players.p1.hand;
    state = gameReducer(state, { type: 'MULLIGAN', player: 'p1' }); // p1 already confirmed — hand is kept
    expect(state.players.p1.hand).toBe(p1Hand);
    expect(state.players.p1.mulligansSoFar).toBe(0);

    state = gameReducer(state, { type: 'MULLIGAN', player: 'p2' }); // p2 hasn't — still free to mulligan
    expect(state.players.p2.mulligansSoFar).toBe(1);
  });

  it('flips for the first player only after BOTH players finish Setup (§3)', () => {
    let state = createSetupState(undefined, 'strict');
    expect(state.firstPlayerPending).toBe(true);
    state = gameReducer(state, { type: 'CHOOSE_CHARACTER', player: 'p1', entryId: state.players.p1.pendingCharacterReveal!.revealed[0] });
    expect(state.firstPlayerPending).toBe(true);
    state = gameReducer(state, { type: 'CHOOSE_CHARACTER', player: 'p2', entryId: state.players.p2.pendingCharacterReveal!.revealed[0] });
    expect(state.firstPlayerPending).toBe(false);
    expect(state.activePlayer).toBe(state.firstPlayer);
    expect(state.log.some((l) => /coin flip: p[12] goes first/.test(l.text))).toBe(true);
    // Starting characters' Field Orientation follows the flip: turn 1 for the first player, turn 2 for the second.
    const second = state.firstPlayer === 'p1' ? 'p2' : 'p1';
    const firstUnits = [...state.players[state.firstPlayer].backRow, ...state.players[state.firstPlayer].frontRow].filter(Boolean);
    const secondUnits = [...state.players[second].backRow, ...state.players[second].frontRow].filter(Boolean);
    expect(firstUnits.every((u) => u!.status.enteredTurn === 1)).toBe(true);
    expect(secondUnits.every((u) => u!.status.enteredTurn === 2)).toBe(true);
  });
});

describe('Draw Phase (SPEC.md §4.3) — a manual draw, never automatic', () => {
  it("entering the Draw Phase draws nothing; the Draw click draws 1, once — the first player draws on turn 1 too", () => {
    let state = createSetupState('p1');
    state = chooseBoth(state);
    const p1HandDeckBefore = state.players.p1.handDeck.length;

    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // Upkeep
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // Draw
    state = gameReducer(state, { type: 'DRAW_PHASE_CARD' }); // p1 draws on turn 1 too
    expect(state.players.p1.handDeck).toHaveLength(p1HandDeckBefore - 1);

    // Finish p1's turn, into p2's turn.
    for (let i = 0; i < 5; i++) state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // Main1,Combat,Main2,End,Untap(p2)
    const p2HandDeckBefore = state.players.p2.handDeck.length;
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // p2 Upkeep
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // p2 Draw
    expect(state.players.p2.handDeck).toHaveLength(p2HandDeckBefore); // nothing automatic
    state = gameReducer(state, { type: 'DRAW_PHASE_CARD' });
    expect(state.players.p2.handDeck).toHaveLength(p2HandDeckBefore - 1);
    state = gameReducer(state, { type: 'DRAW_PHASE_CARD' }); // once per turn
    expect(state.players.p2.handDeck).toHaveLength(p2HandDeckBefore - 1);
  });

  it('strict mode refuses the Draw click outside the Draw Phase', () => {
    let state = createSetupState('p2');
    state = chooseBoth(state);
    const before = state.players.p2.handDeck.length;
    state = gameReducer(state, { type: 'DRAW_PHASE_CARD' }); // still Untap
    expect(state.players.p2.handDeck).toHaveLength(before);
  });

  it('deals 3 Health damage instead of drawing when the Hand Deck is empty', () => {
    let state = createSetupState('p2');
    state = chooseBoth(state);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, handDeck: [] } } };
    const healthBefore = state.players.p1.health;
    while (!(state.activePlayer === 'p1' && state.phase === 'Draw')) {
      state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    }
    state = gameReducer(state, { type: 'DRAW_PHASE_CARD' });
    expect(state.players.p1.health).toBe(healthBefore - 3);
  });

  it('with Auto-draw off, trust mode stops at the Draw Phase until the draw is taken, then moves on to Main 1', () => {
    let state = createSetupState('p2', 'trust');
    state = gameReducer(state, { type: 'SET_OPTION', option: 'autoDraw', value: false });
    state = chooseBoth(state);
    // p2 goes first and, with Auto-draw off, waits at its turn-1 Draw too.
    expect(state.phase).toBe('Draw');
    state = gameReducer(state, { type: 'DRAW_PHASE_CARD' });
    expect(state.phase).toBe('Main1');
    let guard = 0;
    while (!(state.activePlayer === 'p1' && state.phase === 'Draw') && guard++ < 20) state = gameReducer(state, { type: 'FINALIZE_PHASE', player: state.activePlayer });
    expect(state.phase).toBe('Draw');
    const before = state.players.p1.handDeck.length;
    state = gameReducer(state, { type: 'DRAW_PHASE_CARD' });
    expect(state.players.p1.handDeck).toHaveLength(before - 1);
    expect(state.phase).toBe('Main1');
  });

  it('Auto-draw (on by default in trust mode) takes the Draw Phase draw and moves on to Main 1', () => {
    let state = chooseBoth(createSetupState('p2', 'trust'));
    const before = state.players.p1.handDeck.length;
    let guard = 0;
    while (state.activePlayer !== 'p1' && guard++ < 20) state = gameReducer(state, { type: 'FINALIZE_PHASE', player: state.activePlayer });
    expect(state.phase).toBe('Main1');
    expect(state.players.p1.handDeck).toHaveLength(before - 1);
    expect(state.players.p1.drawnThisDrawPhase).toBe(true);
  });
});

describe('Play a Character from hand (SPEC.md §6.7/§8)', () => {
  it('is always free — the tax is paid when drawing, not playing', () => {
    let state = setupWithJuzoStarting();
    state = {
      ...state,
      players: {
        ...state.players,
        p1: {
          ...state.players.p1,
          genericChakraAvailable: 20,
          hand: [
            ...state.players.p1.hand,
            { kind: 'character', instanceId: 'p1-char-hand-test1', entryId: 'yahiko' },
            { kind: 'character', instanceId: 'p1-char-hand-test2', entryId: 'hidan' },
          ],
        },
      },
    };
    state = gameReducer(state, { type: 'PLAY_CHARACTER', instanceId: 'p1-char-hand-test1' });
    state = gameReducer(state, { type: 'PLAY_CHARACTER', instanceId: 'p1-char-hand-test2' });
    expect(state.players.p1.genericChakraAvailable).toBe(20);
    expect(state.players.p1.reinforcementsPlayed).toBe(0);
    expect(state.players.p1.backRow.some((c) => c?.defId === 'yahiko')).toBe(true);
    expect(state.players.p1.backRow.some((c) => c?.defId === 'hidan')).toBe(true);
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

/** p1 at Main1 with exactly the given back row (by defId) and hand characters, plenty of Chakra, and a known Character Deck. */
function economyState(backRow: string[], handCharacters: string[] = []): GameState {
  let state = setupWithJuzoStarting();
  let p1 = { ...state.players.p1, backRow: state.players.p1.backRow.map(() => null), genericChakraAvailable: 30 };
  state = { ...state, players: { ...state.players, p1 } };
  handCharacters.forEach((entryId, i) => {
    p1 = state.players.p1;
    state = { ...state, players: { ...state.players, p1: { ...p1, hand: [...p1.hand, { kind: 'character', instanceId: `seed-hand-${i}`, entryId }] } } };
  });
  backRow.forEach((entryId, i) => {
    p1 = state.players.p1;
    state = { ...state, players: { ...state.players, p1: { ...p1, hand: [...p1.hand, { kind: 'character', instanceId: `seed-board-${i}`, entryId }] } } };
    state = gameReducer(state, { type: 'PLAY_CHARACTER', instanceId: `seed-board-${i}` });
  });
  p1 = state.players.p1;
  return { ...state, players: { ...state.players, p1: { ...p1, characterDeck: ['kisame', 'itachi', 'konan', 'zetsu', 'hidan', 'yahiko', 'juzo', 'kakuzu'] } } };
}

function idOf(state: GameState, defId: string): string {
  return state.players.p1.backRow.find((c) => c?.defId === defId)!.instanceId;
}

/** Defeats a character the way combat does, then lets the reducer settle the Reinforcement trigger (any action drains it). */
function defeat(state: GameState, defId: string): GameState {
  const next = dealDamage(state, idOf(state, defId), 9999).state;
  return gameReducer(next, { type: 'PASS_PRIORITY' });
}

describe('Character Deck tax & draws (SPEC.md §8)', () => {
  it('a manual draw pays the tax, raises it 3 → 5 → 7 → 8 and caps at 8', () => {
    let state = economyState(['juzo']);
    const paid: number[] = [];
    for (let i = 0; i < 5; i++) {
      const before = state.players.p1.genericChakraAvailable;
      state = gameReducer(state, { type: 'DRAW_CHARACTER_DECK', player: 'p1' });
      paid.push(before - state.players.p1.genericChakraAvailable);
      expect(state.players.p1.pendingCharacterReveal?.revealed.length).toBeGreaterThanOrEqual(2);
      state = gameReducer(state, { type: 'CHOOSE_CHARACTER', player: 'p1', entryId: state.players.p1.pendingCharacterReveal!.revealed[0] });
      state = { ...state, players: { ...state.players, p1: { ...state.players.p1, genericChakraAvailable: 30, characterDeck: ['kisame', 'itachi', 'konan', 'zetsu', 'hidan', 'yahiko'] } } };
    }
    expect(paid).toEqual([3, 5, 7, 8, 8]);
    expect(state.players.p1.reinforcementsPlayed).toBe(5);
  });

  it('a manual draw is a Main Phase action — refused outside it under the strict rules', () => {
    let state = economyState(['juzo']);
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // Combat
    state = gameReducer(state, { type: 'DRAW_CHARACTER_DECK', player: 'p1' });
    expect(state.players.p1.pendingCharacterReveal).toBeNull();
  });

  it('a D-rank being defeated triggers no Reinforcement at all', () => {
    let state = economyState(['juzo', 'amegakure-civilian-rebel']);
    state = defeat(state, 'amegakure-civilian-rebel');
    expect(state.players.p1.reinforcementOffers).toEqual([]);
    expect(state.players.p1.mustPlayCharacter).toBe(false);
  });

  it('a C+ defeat with another C+ still in play offers a PAID draw at the current tax that does not raise it', () => {
    let state = economyState(['juzo', 'yahiko']);
    state = defeat(state, 'yahiko');
    expect(state.players.p1.reinforcementOffers).toEqual(['paid']);
    const before = state.players.p1.genericChakraAvailable;
    state = gameReducer(state, { type: 'ACCEPT_REINFORCEMENT', player: 'p1' });
    expect(before - state.players.p1.genericChakraAvailable).toBe(3);
    expect(state.players.p1.reinforcementsPlayed).toBe(0);
    expect(state.players.p1.pendingCharacterReveal).not.toBeNull();
    expect(state.players.p1.reinforcementOffers).toEqual([]);
  });

  it('the paid offer can be declined', () => {
    let state = economyState(['juzo', 'yahiko']);
    state = defeat(state, 'yahiko');
    state = gameReducer(state, { type: 'DECLINE_REINFORCEMENT', player: 'p1' });
    expect(state.players.p1.reinforcementOffers).toEqual([]);
    expect(state.players.p1.pendingCharacterReveal).toBeNull();
  });

  it('D-ranks are ignored for "last C+ character": with a B and a D in play, the B falling earns a FREE draw', () => {
    let state = economyState(['juzo', 'amegakure-civilian-rebel']);
    state = defeat(state, 'juzo');
    expect(state.players.p1.reinforcementOffers).toEqual(['free']);
    const before = state.players.p1.genericChakraAvailable;
    state = gameReducer(state, { type: 'ACCEPT_REINFORCEMENT', player: 'p1' });
    expect(state.players.p1.genericChakraAvailable).toBe(before);
    expect(state.players.p1.reinforcementsPlayed).toBe(0);
    expect(state.players.p1.pendingCharacterReveal).not.toBeNull();
  });

  it('a D-rank-only hand still counts as "no C+ in hand" — the free draw is offered', () => {
    let state = economyState(['juzo'], ['amegakure-civilian-rebel']);
    state = defeat(state, 'juzo');
    expect(state.players.p1.reinforcementOffers).toEqual(['free']);
    expect(state.players.p1.mustPlayCharacter).toBe(false);
  });

  it('last C+ falls while holding a C+ character card: they must play one (free, any timing); a D-rank does not satisfy it', () => {
    let state = economyState(['juzo'], ['yahiko', 'amegakure-civilian-rebel']);
    state = defeat(state, 'juzo');
    expect(state.players.p1.mustPlayCharacter).toBe(true);
    expect(state.players.p1.reinforcementOffers).toEqual([]);

    // Can't move on under the strict rules until it's done.
    state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    expect(state.phase).toBe('Main1');

    const rebel = state.players.p1.hand.find((h) => h.kind === 'character' && h.entryId === 'amegakure-civilian-rebel')!;
    state = gameReducer(state, { type: 'PLAY_CHARACTER', instanceId: rebel.instanceId });
    expect(state.players.p1.mustPlayCharacter).toBe(true);

    state = { ...state, phase: 'Combat', activePlayer: 'p2' }; // outside normal timing (not even p1's turn) — the forced play still works
    const yahiko = state.players.p1.hand.find((h) => h.kind === 'character' && h.entryId === 'yahiko')!;
    const chakraBefore = state.players.p1.genericChakraAvailable;
    state = gameReducer(state, { type: 'PLAY_CHARACTER', instanceId: yahiko.instanceId });
    expect(state.players.p1.mustPlayCharacter).toBe(false);
    expect(state.players.p1.backRow.some((c) => c?.defId === 'yahiko')).toBe(true);
    expect(state.players.p1.genericChakraAvailable).toBe(chakraBefore);
  });
});

describe('Emergency Relief (Mission)', () => {
  it('counts own losses only after it was played (D-ranks too); its reward is an immediate free draw that leaves the tax alone', () => {
    let state = economyState(['juzo', 'konan', 'yahiko', 'amegakure-civilian-rebel']);
    state = defeat(state, 'konan'); // before the Mission is in play — not counted
    const p1 = state.players.p1;
    state = { ...state, players: { ...state.players, p1: { ...p1, missionsInPlay: [{ instanceId: 'm-relief', defId: 'emergency-relief', owner: 'p1', extra: { losses: 0 } }] } } };

    state = defeat(state, 'yahiko');
    expect(state.players.p1.missionsInPlay[0].extra.losses).toBe(1);
    expect(state.players.p1.pendingCharacterReveal).toBeNull();

    const chakraBefore = state.players.p1.genericChakraAvailable;
    const taxCounterBefore = state.players.p1.reinforcementsPlayed;
    state = defeat(state, 'amegakure-civilian-rebel');
    expect(state.players.p1.missionsInPlay).toHaveLength(0); // completed and discarded
    expect(state.players.p1.pendingCharacterReveal?.revealed.length).toBeGreaterThanOrEqual(2); // drawn right away
    expect(state.players.p1.genericChakraAvailable).toBe(chakraBefore);
    expect(state.players.p1.reinforcementsPlayed).toBe(taxCounterBefore);
  });
});

describe('Pain of the Six Paths as a character (his 6 Path tokens)', () => {
  const pathIds = (s: GameState) => s.players.p1.frontRow.filter((t) => t?.extra.painPath).map((t) => t!.instanceId);

  it('counts as a C+ character in play while any Path stands — losing another C+ is not the "last C+"', () => {
    let state = economyState(['juzo', 'pain']);
    expect(pathIds(state)).toHaveLength(6);
    state = defeat(state, 'juzo');
    expect(state.players.p1.reinforcementOffers).toEqual(['paid']);
  });

  it('is defeated (an S-rank character loss) only when the last Path falls; single Paths are token losses', () => {
    let state = economyState(['juzo', 'pain']);
    const p1 = state.players.p1;
    state = { ...state, players: { ...state.players, p1: { ...p1, missionsInPlay: [{ instanceId: 'm-relief', defId: 'emergency-relief', owner: 'p1', extra: { losses: 0 } }] } } };
    const healthBefore = state.players.p1.health;
    const [first, ...rest] = pathIds(state);

    state = gameReducer(dealDamage(state, first, 9999).state, { type: 'PASS_PRIORITY' });
    expect(state.players.p1.health).toBe(healthBefore); // a token, not a character
    expect(state.players.p1.missionsInPlay[0].extra.losses).toBe(0);

    for (const id of rest) state = gameReducer(dealDamage(state, id, 9999).state, { type: 'PASS_PRIORITY' });
    expect(pathIds(state)).toHaveLength(0);
    expect(state.players.p1.health).toBe(healthBefore - 7); // S-rank Health loss
    expect(state.players.p1.missionsInPlay[0].extra.losses).toBe(1); // Emergency Relief counts Pain
    expect(state.players.p1.reinforcementOffers).toEqual(['paid']); // Juzo is still a C+ in play
  });
});

describe("Pain's Upkeep (he's his Path tokens)", () => {
  it('pays S-rank Upkeep while any Path stands, and an unpaid Pain Disables every Path', () => {
    let state = economyState(['juzo', 'pain']);
    const pain = previewUpkeep(state, 'p1').find((e) => e.name === 'Pain of the Six Paths');
    expect(pain).toBeDefined();
    expect(pain!.rank).toBe('S');
    expect(pain!.breakdown?.base).toBe(3);

    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, chakraSources: [] } } };
    state = payUpkeep(state, 'p1');
    expect(state.players.p1.frontRow.filter((t) => t?.extra.painPath).every((t) => t!.status.disabled)).toBe(true);
  });
});

describe("The second player's first turn", () => {
  it('may place 2 Chakra sources (the first player only 1)', () => {
    let state = chooseBoth(createSetupState('p1'));
    const place = (s: GameState, p: 'p1' | 'p2') => {
      const card = s.players[p].hand.find((h) => h.kind === 'card')!;
      return gameReducer(s, { type: 'PLACE_CHAKRA_SOURCE', instanceId: card.instanceId });
    };
    while (state.phase !== 'Main1') state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    state = place(place(state, 'p1'), 'p1');
    expect(state.players.p1.chakraSources).toHaveLength(1); // turn 1, first player: just 1
    while (!(state.activePlayer === 'p2' && state.phase === 'Main1')) state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    state = place(place(place(state, 'p2'), 'p2'), 'p2');
    expect(state.players.p2.chakraSources).toHaveLength(2); // turn 2, second player: 2, not 3
  });
});
