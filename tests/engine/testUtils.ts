import { gameReducer } from '../../src/engine/reducer';
import { createInitialState } from '../../src/engine/state';
import { createCharacterInstance } from '../../src/engine/characters';
import type { GameState, PlayerId } from '../../src/engine/types';

export function toMain1(state: GameState): GameState {
  let next = state;
  for (let i = 0; i < 3; i++) next = gameReducer(next, { type: 'ADVANCE_PHASE' }); // Untap->Upkeep->Draw->Main1
  return next;
}

export function resolveTop(state: GameState): GameState {
  let next = gameReducer(state, { type: 'PASS_PRIORITY' });
  return gameReducer(next, { type: 'PASS_PRIORITY' });
}

export function giveChakra(state: GameState, player: PlayerId, amount: number): GameState {
  return { ...state, players: { ...state.players, [player]: { ...state.players[player], genericChakraAvailable: amount } } };
}

/**
 * Test convenience: clears Field Orientation for every starting character
 * on both sides, so damage-dealing-ability tests don't have to advance 17+
 * phases just to get past SPEC.md §6.6's turn-1 restriction on starting
 * characters (§3's Setup explicitly gives them Field Orientation too).
 */
export function clearFieldOrientation(state: GameState): GameState {
  const patchPlayer = (p: GameState['players']['p1']) => ({
    ...p,
    backRow: p.backRow.map((c) => (c ? { ...c, status: { ...c.status, enteredTurn: -1 } } : c)),
    // Tokens too (they get Field Orientation when created) — turn 0 means "already there before this turn".
    frontRow: p.frontRow.map((t) => (t ? { ...t, status: { ...t.status, enteredTurn: 0 } } : t)),
  });
  return {
    ...state,
    players: { p1: patchPlayer(state.players.p1), p2: patchPlayer(state.players.p2) },
  };
}

/** Clears Disabled on both boards — for tests that advance whole turns without Chakra sources to pay upkeep, but aren't testing upkeep. */
export function enableAll(state: GameState): GameState {
  const enable = (p: GameState['players']['p1']) => ({ ...p, backRow: p.backRow.map((c) => (c ? { ...c, status: { ...c.status, disabled: false } } : c)) });
  return { ...state, players: { p1: enable(state.players.p1), p2: enable(state.players.p2) } };
}

/** Leaves `player` with only their (free-upkeep) starting character — for tests counting Chakra sources, so upkeep never taps any. */
export function onlyStartingCharacter(state: GameState, player: PlayerId): GameState {
  const p = state.players[player];
  return { ...state, players: { ...state.players, [player]: { ...p, backRow: p.backRow.map((c) => (c && c.instanceId === p.startingCharacterInstanceId ? c : null)) } } };
}

/**
 * Both sides' default 5-character roster at p1's Main 1, ready to act. The
 * fixture has no Chakra sources, so its first Upkeep can't pay the (capped)
 * Synergy-discounted upkeep — that Disabling is cleared here, the same way
 * Field Orientation is, so ability tests start from usable characters.
 */
export function freshMain1(): GameState {
  const state = clearFieldOrientation(toMain1(createInitialState('p1')));
  const enable = (p: GameState['players']['p1']) => ({ ...p, backRow: p.backRow.map((c) => (c ? { ...c, status: { ...c.status, disabled: false } } : c)) });
  return { ...state, players: { p1: enable(state.players.p1), p2: enable(state.players.p2) } };
}

/**
 * Test convenience: swaps a back-row slot for a fresh instance of a
 * character not in the default playtest roster (STARTING_ROSTER only fills
 * all 5 slots with currently-in-rotation characters — this lets tests cover
 * everyone else without growing that roster past the board's 5-slot cap).
 */
export function withCharacterAt(state: GameState, player: PlayerId, index: number, defId: string): GameState {
  const instance = createCharacterInstance(defId, player, `${player}-${defId}`, state.turn);
  const p = state.players[player];
  const backRow = p.backRow.slice();
  backRow[index] = { ...instance, status: { ...instance.status, enteredTurn: -1 } };
  return { ...state, players: { ...state.players, [player]: { ...p, backRow } } };
}

/**
 * Same board as freshMain1(), but in the Combat Phase — where Normal-speed damage-dealing abilities are activated (SPEC.md §4.5). Most character-ability tests only care about the ability's effect, not the phase, so they start here.
 */
export function freshCombat(): GameState {
  return { ...freshMain1(), phase: 'Combat' };
}
