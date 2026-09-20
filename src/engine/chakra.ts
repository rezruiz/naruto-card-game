import { appendLog } from './phases/phaseMachine';
import type { GameState, PlayerId } from './types';

const MAIN_PHASES = new Set(['Main1', 'Main2']);

function updatePlayer(state: GameState, player: PlayerId, patch: Partial<GameState['players'][PlayerId]>): GameState {
  return {
    ...state,
    players: { ...state.players, [player]: { ...state.players[player], ...patch } },
  };
}

/**
 * §5.2: place 1 Chakra source, removing a hand card from the game to
 * fund it (a physical-table convenience in paper play; no mechanical
 * effect digitally). Sorcery speed (own Main Phase only), once per turn
 * across both Main Phases.
 */
export function placeChakraSource(state: GameState): GameState {
  const player = state.activePlayer;
  const p = state.players[player];

  if (!MAIN_PHASES.has(state.phase)) {
    return appendLog(state, `${player} cannot place a Chakra source outside a Main Phase.`);
  }
  if (p.chakraSourcePlacedThisTurn) {
    return appendLog(state, `${player} has already placed a Chakra source this turn.`);
  }
  if (p.hand.length === 0) {
    return appendLog(state, `${player} has no cards in hand to place as a Chakra source.`);
  }

  const [, ...remainingHand] = p.hand;
  const next = updatePlayer(state, player, {
    hand: remainingHand,
    chakraSources: [...p.chakraSources, { tapped: false }],
    chakraSourcePlacedThisTurn: true,
  });
  return appendLog(next, `${player} places a Chakra source.`);
}

/** §5.2: tap an untapped Chakra source to add 1 Chakra to the generic pool. */
export function tapChakraSource(state: GameState, sourceIndex: number): GameState {
  const player = state.activePlayer;
  const p = state.players[player];
  const source = p.chakraSources[sourceIndex];

  if (!source) {
    return appendLog(state, `${player} has no Chakra source at that position.`);
  }
  if (source.tapped) {
    return appendLog(state, `${player}'s Chakra source is already tapped.`);
  }

  const chakraSources = p.chakraSources.map((s, i) => (i === sourceIndex ? { tapped: true } : s));
  const next = updatePlayer(state, player, {
    chakraSources,
    genericChakraAvailable: p.genericChakraAvailable + 1,
  });
  return appendLog(next, `${player} taps a Chakra source (+1 Chakra).`);
}

/**
 * §5.3: pool generic Chakra into a character's personal Chakra Pool.
 * Sorcery speed only, capped at the character's remaining capacity.
 */
export function poolChakra(state: GameState, instanceId: string, amount: number): GameState {
  const player = state.activePlayer;
  const p = state.players[player];
  const character = p.board.find((c) => c.instanceId === instanceId);

  if (!MAIN_PHASES.has(state.phase)) {
    return appendLog(state, `${player} cannot pool Chakra outside a Main Phase.`);
  }
  if (amount <= 0) {
    return state;
  }
  if (!character) {
    return appendLog(state, `${player} has no such character to pool Chakra into.`);
  }
  if (amount > p.genericChakraAvailable) {
    return appendLog(state, `${player} doesn't have ${amount} Chakra available to pool.`);
  }
  const room = character.chakraPool.capacity - character.chakraPool.current;
  if (amount > room) {
    return appendLog(
      state,
      `${player} can't pool ${amount} into ${character.name}'s Chakra Pool — only ${room} room left.`,
    );
  }

  const board = p.board.map((c) =>
    c.instanceId === instanceId ? { ...c, chakraPool: { ...c.chakraPool, current: c.chakraPool.current + amount } } : c,
  );
  const next = updatePlayer(state, player, {
    board,
    genericChakraAvailable: p.genericChakraAvailable - amount,
  });
  return appendLog(next, `${player} pools ${amount} Chakra into ${character.name}'s Chakra Pool.`);
}
