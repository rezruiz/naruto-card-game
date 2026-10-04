import { findOccupant, isCharacter, patchCharacter } from './board';
import { appendLog, appendWarning } from './phases/phaseMachine';
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
  let working = state;
  if (!MAIN_PHASES.has(state.phase)) {
    if (!relaxed) return appendLog(state, `${player} can only Retreat a character during their own Main Phase.`);
    working = appendWarning(working, `${player} Retreats outside their own Main Phase — not legal under the strict rules, allowed anyway (trust mode).`);
  }

  const found = findOccupant(working, instanceId);
  if (!found || !isCharacter(found.occupant) || found.player !== player) {
    return appendLog(working, `${player} has no such character to Retreat.`);
  }
  const character = found.occupant;

  if (character.status.retreated) {
    return appendLog(working, `${character.name} is already Retreated.`);
  }
  const stunUntil = character.extra.stunnedUntilTurn as number | undefined;
  if (!relaxed && stunUntil !== undefined && state.turn <= stunUntil) {
    return appendLog(working, `${character.name} is stunned and can't Retreat right now.`);
  }
  if (!relaxed && character.status.usedAbilitiesThisTurn.length > 0) {
    return appendLog(working, `${character.name} has already acted this turn and can't Retreat.`);
  }
  const others = working.players[player].backRow.filter((c) => c && !c.status.retreated && c.instanceId !== instanceId);
  if (!relaxed && others.length === 0) {
    return appendLog(working, `${player} must keep at least 1 non-Retreated character in play.`);
  }

  const fullCost = retreatCost(character.rank);
  const cost = relaxed ? Math.min(fullCost, working.players[player].genericChakraAvailable) : fullCost;
  if (!relaxed && cost > working.players[player].genericChakraAvailable) {
    return appendLog(working, `${player} doesn't have ${cost} Chakra available to Retreat ${character.name}.`);
  }

  let next: GameState = {
    ...working,
    players: {
      ...working.players,
      [player]: { ...working.players[player], genericChakraAvailable: working.players[player].genericChakraAvailable - cost },
    },
  };
  next = patchCharacter(next, instanceId, (c) => ({ ...c, status: { ...c.status, retreated: true } }));
  return appendLog(next, `${character.name} Retreats${cost > 0 ? ` — paid ${cost} Chakra` : ''}.`);
}

/**
 * SPEC.md §6.5b: returns a Retreated character to normal — free, and it's
 * treated exactly like it just entered play for Field Orientation (§6.6).
 */
export function returnFromRetreat(state: GameState, instanceId: string): GameState {
  const relaxed = state.rules === 'trust';
  const player = (relaxed ? findOccupant(state, instanceId)?.player : undefined) ?? state.activePlayer;
  let working = state;
  if (!MAIN_PHASES.has(state.phase)) {
    if (!relaxed) return appendLog(state, `${player} can only return a character from Retreat during their own Main Phase.`);
    working = appendWarning(working, `${player} returns a character from Retreat outside their own Main Phase — not legal under the strict rules, allowed anyway (trust mode).`);
  }
  const found = findOccupant(working, instanceId);
  if (!found || !isCharacter(found.occupant) || found.player !== player) {
    return appendLog(working, `${player} has no such character to return from Retreat.`);
  }
  if (!found.occupant.status.retreated) {
    return appendLog(working, `${found.occupant.name} isn't Retreated.`);
  }

  const next = patchCharacter(working, instanceId, (c) => ({
    ...c,
    status: { ...c.status, retreated: false, enteredTurn: state.turn },
  }));
  return appendLog(next, `${found.occupant.name} returns from Retreat.`);
}
