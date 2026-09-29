import { findOccupant, isCharacter } from '../board';
import { fizzleOwnedTokens } from '../combat';
import { getCharacterDeckEntry } from '../characters';
import { appendLog } from '../phases/phaseMachine';
import type { GameState, HandEntry } from '../types';

let returnCounter = 0;

/**
 * Trust mode's manual correction for a character played by mistake (dragged
 * from the battlefield back to hand): the card goes back to its owner's
 * hand as a fresh Character card — its damage, Pool and tracked resources
 * are gone, and any tokens it owns fizzle. It is NOT a defeat: no Health
 * loss, no Retaliation, no Reinforcement.
 */
export function returnCharacterToHand(state: GameState, instanceId: string): GameState {
  const found = findOccupant(state, instanceId);
  if (!found || !isCharacter(found.occupant) || found.zone !== 'back') return appendLog(state, 'Only a character in play can be returned to hand.');
  const { player, index, occupant } = found;
  const p = state.players[player];
  const backRow = p.backRow.slice();
  backRow[index] = null;
  // The card in hand is the Character Deck card it came from — Sasori's later forms still return as the Hiruko card he's played as.
  const entryId = getCharacterDeckEntry(occupant.defId) ? occupant.defId : occupant.defId.startsWith('sasori') ? 'sasori-hiruko' : undefined;
  if (!entryId) return appendLog(state, `${occupant.name} has no Character card to return to hand.`);
  returnCounter += 1;
  const handEntry: HandEntry = { kind: 'character', instanceId: `${player}-char-returned-${returnCounter}`, entryId };
  // startingCharacterInstanceId is deliberately left alone — it's Setup's "done" marker (setupPending), and a stale id just means no character gets the starting-character Upkeep treatment.
  let next: GameState = { ...state, players: { ...state.players, [player]: { ...p, backRow, hand: [...p.hand, handEntry] } } };
  next = fizzleOwnedTokens(next, player, occupant.instanceId);
  return appendLog(next, `${player} returns ${occupant.name} to hand (manual) — its damage, Pool and tracked resources reset.`);
}
