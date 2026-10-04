import type { GameState, PlayerId, PlayerState, RulesMode } from './types';
import { BACK_ROW_SIZE, FRONT_ROW_SIZE } from './board';
import { createCharacterInstance, CHARACTER_DECK_MANIFEST } from './characters';
import { buildHandDeck, drawCard, revealCharacters, shuffle } from './deck';
// Side-effect import — registers every Hand Deck card (Jutsu/Assist/
// Terrain/Mission) before any deck is built.
import './cards';

const STARTING_HEALTH = 20;

/**
 * Default playtest roster — one of each currently-implemented character per
 * side, filling all 5 back-row slots (SPEC.md §6.5's cap). This stands in for
 * the not-yet-built Setup/Character-Deck draw flow (§3, §8); once that exists,
 * players will draw into a roster like this instead of always starting with it.
 */
const STARTING_ROSTER = ['kakuzu', 'hidan', 'deidara', 'kisame', 'itachi'];

/** The per-player fields every fresh PlayerState starts with for §8 reinforcements, the manual Draw Phase draw, and Field Intelligence reveals. */
function freshReinforcementFields() {
  return {
    pendingReinforcementEvents: [],
    reinforcementOffers: [],
    mustPlayCharacter: false,
    drawnThisDrawPhase: false,
    pendingHandReveal: null,
    revealedHandCards: [],
  } satisfies Partial<PlayerState>;
}

function createPlayer(id: PlayerId): PlayerState {
  const backRow = new Array(BACK_ROW_SIZE).fill(null);
  STARTING_ROSTER.forEach((defId, i) => {
    backRow[i] = createCharacterInstance(defId, id, `${id}-${defId}`, 1);
  });

  return {
    id,
    health: STARTING_HEALTH,
    genericChakraAvailable: 0,
    chakraSources: [],
    chakraSourcePlacedThisTurn: false,
    firstTurnExtraPlacementUsed: false,
    hand: Array.from({ length: 10 }, (_, i) => ({ kind: 'card', instanceId: `${id}-filler-${i + 1}`, defId: 'filler' })),
    backRow,
    frontRow: new Array(FRONT_ROW_SIZE).fill(null),
    // Interim default until the real Setup/Character-Deck draw flow (§3, §8)
    // exists — treats the roster's first slot as "the starting character" so
    // the Upkeep special-case treatment (§6.5) has something real to apply to.
    startingCharacterInstanceId: `${id}-${STARTING_ROSTER[0]}`,
    retaliationPending: false,
    ...freshReinforcementFields(),
    handDeck: [],
    characterDeck: [],
    consumedPile: [],
    discardPile: [],
    pendingCharacterReveal: null,
    reinforcementsPlayed: 0,
    mulligansSoFar: 0,
    terrainInPlay: null,
    missionsInPlay: [],
    pendingDefeatEvents: [],
    nextCharacterFullyStunned: false,
    nextReinforcementDiscount: 0,
    bonusChakraSourcePlacements: 0,
    attackJutsuUsedThisTurn: [],
  };
}

function createEmptyPlayer(id: PlayerId): PlayerState {
  return {
    id,
    health: STARTING_HEALTH,
    genericChakraAvailable: 0,
    chakraSources: [],
    chakraSourcePlacedThisTurn: false,
    firstTurnExtraPlacementUsed: false,
    hand: [],
    backRow: new Array(BACK_ROW_SIZE).fill(null),
    frontRow: new Array(FRONT_ROW_SIZE).fill(null),
    startingCharacterInstanceId: null,
    retaliationPending: false,
    ...freshReinforcementFields(),
    handDeck: [],
    characterDeck: [],
    consumedPile: [],
    discardPile: [],
    pendingCharacterReveal: null,
    reinforcementsPlayed: 0,
    mulligansSoFar: 0,
    terrainInPlay: null,
    missionsInPlay: [],
    pendingDefeatEvents: [],
    nextCharacterFullyStunned: false,
    nextReinforcementDiscount: 0,
    bonusChakraSourcePlacements: 0,
    attackJutsuUsedThisTurn: [],
  };
}

/**
 * SPEC.md §3's real Setup flow: shuffles both decks, reveals each player's
 * top 3 Character Deck cards (awaiting a CHOOSE_CHARACTER action each to
 * pick the starting character — §8's D-rank bonus rule applies here too),
 * and deals each a 6-card starting hand (mulligan is a separate, optional
 * MULLIGAN action from here). Turn 1 begins immediately; the Draw Phase
 * skip for whoever goes first is handled by drawForDrawPhase, keyed off
 * `firstPlayer`.
 *
 * §3 order: the first-player coin flip happens AFTER both players finish
 * Setup, so nobody knows who goes first while deciding on a mulligan. With
 * no explicit `firstPlayer`, it's left pending (a placeholder is stored) and
 * flipped by the reducer once both starting characters are confirmed.
 * Passing one (tests) fixes it up front.
 */
export function createSetupState(firstPlayer?: PlayerId, rules: RulesMode = 'strict'): GameState {
  const placeholder: PlayerId = firstPlayer ?? 'p1';
  let state: GameState = {
    firstPlayerPending: firstPlayer === undefined,
    pendingChoices: [],
    turn: 1,
    firstPlayer: placeholder,
    activePlayer: placeholder,
    phase: 'Untap',
    players: { p1: createEmptyPlayer('p1'), p2: createEmptyPlayer('p2') },
    rules,
    extraCombatPending: false,
    resolutionShield: [],
    staged: [],
    pendingFinalize: null,
    log: [{ id: 'log-1', turn: 1, phase: 'Untap', text: firstPlayer ? `${firstPlayer} goes first.` : 'Setup: each player picks a starting character and may mulligan. Who goes first is decided afterward.' }],
    winner: null,
    stack: [],
    priorityPlayer: placeholder,
    passesInARow: 0,
  };

  for (const player of ['p1', 'p2'] as PlayerId[]) {
    state = {
      ...state,
      players: {
        ...state.players,
        [player]: { ...state.players[player], characterDeck: shuffle(CHARACTER_DECK_MANIFEST), handDeck: buildHandDeck() },
      },
    };
    state = revealCharacters(state, player, 3, 'setup');
    for (let i = 0; i < 6; i++) state = drawCard(state, player);
  }

  return state;
}

export function createInitialState(firstPlayer: PlayerId): GameState {
  return {
    firstPlayerPending: false,
    pendingChoices: [],
    turn: 1,
    firstPlayer,
    activePlayer: firstPlayer,
    phase: 'Untap',
    players: { p1: createPlayer('p1'), p2: createPlayer('p2') },
    rules: 'strict',
    extraCombatPending: false,
    resolutionShield: [],
    staged: [],
    pendingFinalize: null,
    log: [{ id: 'log-1', turn: 1, phase: 'Untap', text: `${firstPlayer} goes first.` }],
    winner: null,
    stack: [],
    priorityPlayer: firstPlayer,
    passesInARow: 0,
  };
}
