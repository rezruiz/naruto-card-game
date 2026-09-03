import type { GameState, PlayerId, PlayerState } from './types';

const STARTING_HEALTH = 30;

function createPlayer(id: PlayerId): PlayerState {
  return { id, health: STARTING_HEALTH, genericChakraAvailable: 0 };
}

export function createInitialState(firstPlayer: PlayerId): GameState {
  return {
    turn: 1,
    activePlayer: firstPlayer,
    phase: 'Untap',
    players: { p1: createPlayer('p1'), p2: createPlayer('p2') },
    log: [{ id: 'log-1', turn: 1, phase: 'Untap', text: `${firstPlayer} goes first.` }],
    winner: null,
  };
}
