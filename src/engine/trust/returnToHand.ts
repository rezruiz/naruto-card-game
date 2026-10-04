import { findOccupant, isCharacter, occupantIds, purgeReferencesTo } from '../board';
import { fizzleOwnedTokens } from '../combat';
import { getCharacterDeckEntry } from '../characters';
import { appendLog } from '../phases/phaseMachine';
import type { GameState, HandEntry } from '../types';

let returnCounter = 0;

/**
 * Trust mode's manual correction for a Mission or Terrain put into play by
 * mistake: the card goes back to its owner's hand as it was. Its in-play
 * progress is gone (Unshakable Resolve's Untap count, Squad Formation's
 * group), and Squad Formation's group markers come off the characters.
 */
export function returnInPlayCardToHand(state: GameState, instanceId: string): GameState {
  for (const player of ['p1', 'p2'] as const) {
    const p = state.players[player];
    if (p.terrainInPlay?.instanceId === instanceId) {
      const card = p.terrainInPlay;
      const next = { ...state, players: { ...state.players, [player]: { ...p, terrainInPlay: null, hand: [...p.hand, { kind: 'card' as const, ...card }] } } };
      return appendLog(next, `${player} returns the Terrain in play to hand (manual).`);
    }
    const mission = p.missionsInPlay.find((m) => m.instanceId === instanceId);
    if (mission) {
      const clearSquad = <T extends { extra: Record<string, unknown> } | null>(u: T): T =>
        u && u.extra.squadFormationGroup ? { ...u, extra: { ...u.extra, squadFormationGroup: undefined } } : u;
      const next = {
        ...state,
        players: {
          ...state.players,
          [player]: {
            ...p,
            missionsInPlay: p.missionsInPlay.filter((m) => m.instanceId !== instanceId),
            hand: [...p.hand, { kind: 'card' as const, instanceId: mission.instanceId, defId: mission.defId }],
            backRow: mission.defId === 'squad-formation' ? p.backRow.map(clearSquad) : p.backRow,
          },
        },
      };
      return appendLog(next, `${player} returns a Mission in play to hand (manual) — its progress resets.`);
    }
  }
  return appendLog(state, 'No such Mission or Terrain in play to return to hand.');
}

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
  const before = occupantIds(state);
  next = fizzleOwnedTokens(next, player, occupant.instanceId);
  const after = occupantIds(next);
  next = purgeReferencesTo(next, [...before].filter((id) => !after.has(id)));
  return appendLog(next, `${player} returns ${occupant.name} to hand (manual) — its damage, Pool and tracked resources reset.`);
}
