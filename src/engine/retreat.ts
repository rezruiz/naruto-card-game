import { findOccupant, isCharacter, patchCharacter } from './board';
import { appendLog } from './phases/phaseMachine';
import type { CharacterInstance, GameState } from './types';

const MAIN_PHASES = new Set(['Main1', 'Main2']);

/** SPEC.md §6.5b — Retreat cost by Rank. */
export function retreatCost(rank: CharacterInstance['rank']): number {
  if (rank === 'C') return 1;
  if (rank === 'B') return 2;
  return 3; // A and above
}

/**
 * SPEC.md §6.5b: flips a character into the Retreated state — Normal speed,
 * own Main Phase only, costing Chakra scaled by Rank. Can't Retreat your
 * only non-Retreated character, a character that's already acted this turn,
 * or one under a stun-type effect.
 */
export function retreat(state: GameState, instanceId: string): GameState {
  const relaxed = state.rules === 'trust';
  const player = (relaxed ? findOccupant(state, instanceId)?.player : undefined) ?? state.activePlayer;
  if (!relaxed && !MAIN_PHASES.has(state.phase)) {
    return appendLog(state, `${player} can only Retreat a character during their own Main Phase.`);
  }

  const found = findOccupant(state, instanceId);
  if (!found || !isCharacter(found.occupant) || found.player !== player) {
    return appendLog(state, `${player} has no such character to Retreat.`);
  }
  const character = found.occupant;

  if (character.status.retreated) {
    return appendLog(state, `${character.name} is already Retreated.`);
  }
  const stunUntil = character.extra.stunnedUntilTurn as number | undefined;
  if (!relaxed && stunUntil !== undefined && state.turn <= stunUntil) {
    return appendLog(state, `${character.name} is stunned and can't Retreat right now.`);
  }
  if (!relaxed && character.status.usedAbilitiesThisTurn.length > 0) {
    return appendLog(state, `${character.name} has already acted this turn and can't Retreat.`);
  }
  const others = state.players[player].backRow.filter((c) => c && !c.status.retreated && c.instanceId !== instanceId);
  if (!relaxed && others.length === 0) {
    return appendLog(state, `${player} must keep at least 1 non-Retreated character in play.`);
  }

  const fullCost = retreatCost(character.rank);
  const cost = relaxed ? Math.min(fullCost, state.players[player].genericChakraAvailable) : fullCost;
  if (!relaxed && cost > state.players[player].genericChakraAvailable) {
    return appendLog(state, `${player} doesn't have ${cost} Chakra available to Retreat ${character.name}.`);
  }

  let next: GameState = {
    ...state,
    players: {
      ...state.players,
      [player]: { ...state.players[player], genericChakraAvailable: state.players[player].genericChakraAvailable - cost },
    },
  };
  next = patchCharacter(next, instanceId, (c) => ({ ...c, status: { ...c.status, retreated: true } }));
  return appendLog(next, `${character.name} Retreats.`);
}

/**
 * SPEC.md §6.5b: returns a Retreated character to normal — free, and it's
 * treated exactly like it just entered play for summoning sickness (§6.6).
 */
export function returnFromRetreat(state: GameState, instanceId: string): GameState {
  const relaxed = state.rules === 'trust';
  const player = (relaxed ? findOccupant(state, instanceId)?.player : undefined) ?? state.activePlayer;
  if (!relaxed && !MAIN_PHASES.has(state.phase)) {
    return appendLog(state, `${player} can only return a character from Retreat during their own Main Phase.`);
  }
  const found = findOccupant(state, instanceId);
  if (!found || !isCharacter(found.occupant) || found.player !== player) {
    return appendLog(state, `${player} has no such character to return from Retreat.`);
  }
  if (!found.occupant.status.retreated) {
    return appendLog(state, `${found.occupant.name} isn't Retreated.`);
  }

  const next = patchCharacter(state, instanceId, (c) => ({
    ...c,
    status: { ...c.status, retreated: false, enteredTurn: state.turn },
  }));
  return appendLog(next, `${found.occupant.name} returns from Retreat.`);
}
