import { getCharacterDeckEntry } from './characters';
import { getHandCardDef } from './cards/registry';
import { appendLog } from './phases/phaseMachine';
import type { GameState, HandEntry, PlayerId } from './types';

export function handEntryName(entry: HandEntry): string {
  return entry.kind === 'card' ? (getHandCardDef(entry.defId)?.name ?? entry.defId) : (getCharacterDeckEntry(entry.entryId)?.name ?? entry.entryId);
}

/**
 * Field Intelligence (§13b): the opponent fulfils a pending reveal by
 * choosing exactly `count` of their own hand cards. The names go in the log
 * and the cards stay face-up to the requester (redact.ts) for the rest of
 * the turn.
 */
export function revealHandCards(state: GameState, player: PlayerId, instanceIds: string[]): GameState {
  const p = state.players[player];
  const pending = p.pendingHandReveal;
  if (!pending) return appendLog(state, `${player} has nothing to reveal.`);
  const unique = [...new Set(instanceIds)];
  const entries = unique.map((id) => p.hand.find((h) => h.instanceId === id)).filter((h): h is HandEntry => !!h);
  const needed = Math.min(pending.count, p.hand.length);
  if (entries.length !== needed) return appendLog(state, `${player} must reveal exactly ${needed} card(s) from hand.`);

  const next: GameState = {
    ...state,
    players: {
      ...state.players,
      [player]: { ...p, pendingHandReveal: null, revealedHandCards: [...p.revealedHandCards, ...entries.map((e) => e.instanceId)] },
    },
  };
  return appendLog(next, `${player} reveals to ${pending.requestedBy}: ${entries.map(handEntryName).join(', ') || 'nothing'}.`);
}
