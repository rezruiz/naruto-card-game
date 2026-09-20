import type { CharacterInstance, GameState, PlayerId, PlayerState } from './types';

const STARTING_HEALTH = 20;

function createPlaceholderCharacter(player: PlayerId): CharacterInstance {
  return {
    instanceId: `${player}-placeholder`,
    name: 'Placeholder',
    maxHP: 10,
    currentHP: 10,
    chakraPool: { current: 0, capacity: 5 },
  };
}

function createPlayer(id: PlayerId): PlayerState {
  return {
    id,
    health: STARTING_HEALTH,
    genericChakraAvailable: 0,
    chakraSources: [],
    chakraSourcePlacedThisTurn: false,
    hand: Array.from({ length: 10 }, (_, i) => `filler-${i + 1}`),
    board: [createPlaceholderCharacter(id)],
  };
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
