import type { GameAction, GameState } from '../engine/types';
import { CHARACTER_DECK_NAME } from '../variant';

/**
 * Undo steps back through everything that changed the game. Each entry is a snapshot of the whole state, so an
 * action left out of this list wouldn't just be un-undoable: undoing anything before it would silently wipe it.
 * That's why this is a full Record: a new action type won't compile until it has a label here. Only the settings
 * stay out, since they aren't moves in the game.
 */
const UNDO_LABELS: Record<Exclude<GameAction['type'], 'SET_RULES' | 'SET_OPTION'>, string> = {
  ADVANCE_PHASE: 'Next phase',
  GO_TO_PHASE: 'Phase change',
  PASS_TURN: 'Pass turn',
  PASS_PRIORITY: 'Pass priority',
  PLACE_CHAKRA_SOURCE: 'Place Chakra source',
  TAP_CHAKRA_SOURCE: 'Tap Chakra',
  UNTAP_CHAKRA_SOURCE: 'Untap Chakra',
  POOL_CHAKRA: 'Pool Chakra',
  ACTIVATE_ABILITY: 'Ability',
  PLAY_CHARACTER: 'Play character',
  PLAY_HAND_CARD: 'Play card',
  DRAW_PHASE_CARD: 'Draw',
  DRAW_CARDS: 'Draw',
  MULLIGAN: 'Mulligan',
  CHOOSE_CHARACTER: 'Character pick',
  DRAW_CHARACTER_DECK: `${CHARACTER_DECK_NAME} draw`,
  ACCEPT_REINFORCEMENT: 'Reinforcement draw',
  DECLINE_REINFORCEMENT: 'Decline Reinforcement',
  REVEAL_HAND_CARDS: 'Reveal',
  RESOLVE_CHOICE: 'Choice',
  SET_SQUAD_REDIRECT: 'Squad redirect',
  DECLARE_SHINOBI_ATTACK: 'Declare attack',
  CANCEL_SHINOBI_ATTACK: 'Cancel attack',
  CONFIRM_SHINOBI_ATTACKS: 'Confirm attacks',
  ASSIGN_SHINOBI_DEFENDER: 'Assign defender',
  CONFIRM_SHINOBI_DEFENSE: 'Confirm defenders',
  STAGE_ABILITY: 'Declare ability',
  STAGE_CARD: 'Declare card',
  RETARGET_STAGED: 'Change target',
  UNSTAGE: 'Withdraw action',
  MOVE_STAGED: 'Reorder actions',
  RESOLVE_ACTIONS: 'Resolve actions',
  FINALIZE_PHASE: 'Finalize phase',
  APPROVE_RESOLVE: 'Approve',
  CANCEL_FINALIZE: 'Cancel finalize',
  ADJUST_HP: 'HP change',
  DEAL_DAMAGE: 'Damage',
  ADJUST_POOL: 'Pool change',
  TOGGLE_STATUS: 'Status change',
  ADJUST_PLAYER_HEALTH: 'Health change',
  ADJUST_GENERIC_CHAKRA: 'Chakra change',
  ADJUST_SUPPLIES: 'Supplies change',
  MOVE_HAND_CARD: 'Move card',
  RETURN_FROM_DISCARD: 'Return from discard',
  RETURN_FROM_CONSUMED: 'Return from Consumed',
  SHUFFLE_DECK: 'Shuffle',
  DECK_TAKE: 'Take from deck',
  DECK_TO_BOTTOM: 'Card to bottom',
  SHUFFLE_CHARACTER_DECK: `Shuffle ${CHARACTER_DECK_NAME}`,
  CHARACTER_DECK_TAKE: `Take from ${CHARACTER_DECK_NAME}`,
  RETURN_FROM_CHARACTER_GRAVEYARD: 'Return character',
  RETURN_CHARACTER_TO_HAND: 'Return to hand',
  RETURN_IN_PLAY_CARD_TO_HAND: 'Return to hand',
  RETREAT: 'Retreat',
  RETURN_FROM_RETREAT: 'Return from Retreat',
};

export function undoLabelFor(action: GameAction): string | undefined {
  return (UNDO_LABELS as Partial<Record<GameAction['type'], string>>)[action.type];
}

export interface UndoEntry {
  state: GameState;
  label: string;
}

/** In-memory only — never serialized (StackItem.resolve closures can't be). */
export const UNDO_LIMIT = 100;

/** A blocked action only logs why it failed, so there's nothing to take back. */
function changedTheGame(prev: GameState, next: GameState): boolean {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)] as (keyof GameState)[]);
  return [...keys].some((key) => key !== 'log' && prev[key] !== next[key]);
}

/** The history after `action` took the game from `prev` to `next`. */
export function recordUndo(history: UndoEntry[], action: GameAction, prev: GameState, next: GameState): UndoEntry[] {
  const label = undoLabelFor(action);
  if (!label || !changedTheGame(prev, next)) return history;
  return [...history, { state: prev, label }].slice(-UNDO_LIMIT);
}
