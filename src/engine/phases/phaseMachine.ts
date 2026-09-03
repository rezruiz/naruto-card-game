import { PHASE_ORDER, type GameState, type Phase, type PlayerId } from '../types';

export function nextPhase(phase: Phase): Phase {
  const index = PHASE_ORDER.indexOf(phase);
  return PHASE_ORDER[(index + 1) % PHASE_ORDER.length];
}

export function otherPlayer(player: PlayerId): PlayerId {
  return player === 'p1' ? 'p2' : 'p1';
}

/**
 * Advances the game by one phase, switching the active player and
 * incrementing the turn counter whenever End Phase is passed. Applies
 * each phase's automatic entry effects (currently just Upkeep's base
 * Chakra income, per SPEC.md §5.1 — 1 Chakra every turn, never growing
 * on its own).
 */
export function advancePhase(state: GameState): GameState {
  const wrapping = state.phase === 'End';
  const phase = nextPhase(state.phase);
  const activePlayer = wrapping ? otherPlayer(state.activePlayer) : state.activePlayer;
  const turn = wrapping ? state.turn + 1 : state.turn;

  let next: GameState = { ...state, phase, activePlayer, turn };

  if (wrapping) {
    // §4.7: unspent generic Chakra never carries past End Phase.
    next = clearGenericChakra(next, state.activePlayer);
  }
  if (phase === 'Upkeep') {
    next = applyBaseChakraIncome(next);
  }

  return appendLog(next, `${activePlayer} enters ${phase} Phase (turn ${turn}).`);
}

function clearGenericChakra(state: GameState, player: PlayerId): GameState {
  return {
    ...state,
    players: {
      ...state.players,
      [player]: { ...state.players[player], genericChakraAvailable: 0 },
    },
  };
}

function applyBaseChakraIncome(state: GameState): GameState {
  const player = state.players[state.activePlayer];
  return {
    ...state,
    players: {
      ...state.players,
      [state.activePlayer]: { ...player, genericChakraAvailable: player.genericChakraAvailable + 1 },
    },
  };
}

export function appendLog(state: GameState, text: string): GameState {
  return {
    ...state,
    log: [...state.log, { id: `log-${state.log.length + 1}`, turn: state.turn, phase: state.phase, text }],
  };
}
