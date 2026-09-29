import type { GameAction, GameState } from '../engine/types';

/**
 * Actions a player can't just fix by hand afterward — they reveal or
 * consume hidden deck order (draws, mulligans, reveal picks) — so they get a
 * real Undo. Everything else (tapping Chakra, pooling, retreat, manual
 * adjustments) already has a manual correction path and deliberately
 * doesn't clutter the undo history.
 */
const UNDOABLE: Partial<Record<GameAction['type'], string>> = {
  DRAW_PHASE_CARD: 'Draw',
  DRAW_CARDS: 'Draw',
  MULLIGAN: 'Mulligan',
  CHOOSE_CHARACTER: 'Character pick',
  DRAW_CHARACTER_DECK: 'Character Deck draw',
  ACCEPT_REINFORCEMENT: 'Reinforcement draw',
  REVEAL_HAND_CARDS: 'Reveal',
  RESOLVE_CHOICE: 'Choice',
};

export function undoLabelFor(action: GameAction): string | undefined {
  return UNDOABLE[action.type];
}

export interface UndoEntry {
  state: GameState;
  label: string;
}

/** In-memory only — never serialized (StackItem.resolve closures can't be). */
export const UNDO_LIMIT = 20;

export function pushUndo(history: UndoEntry[], entry: UndoEntry): UndoEntry[] {
  const next = [...history, entry];
  return next.length > UNDO_LIMIT ? next.slice(next.length - UNDO_LIMIT) : next;
}
