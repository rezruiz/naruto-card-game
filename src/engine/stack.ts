import { appendLog, otherPlayer } from './phases/phaseMachine';
import type { GameState, PlayerId, StackItem } from './types';

const MAIN_PHASES = new Set(['Main1', 'Main2']);

/**
 * SPEC.md §7: every speed goes on the stack. Normal-speed items may only be
 * pushed when the active player has priority, their own Main/Combat Phase is
 * active, and the stack is currently empty.
 */
export function canActivateNormalSpeed(state: GameState, controller: PlayerId): boolean {
  return (
    state.stack.length === 0 &&
    state.activePlayer === controller &&
    state.priorityPlayer === controller &&
    (MAIN_PHASES.has(state.phase) || state.phase === 'Combat')
  );
}

export function pushStackItem(state: GameState, item: StackItem): GameState {
  const next: GameState = {
    ...state,
    stack: [...state.stack, item],
    priorityPlayer: otherPlayer(item.controllerId),
    passesInARow: 0,
  };
  return appendLog(next, `${item.controllerId} activates ${item.sourceName}: ${item.abilityName}.`);
}

/**
 * A player passes priority. Two passes in a row resolves the top stack item
 * (or, with an empty stack, simply hands priority back to the active player
 * so the phase can advance).
 */
export function passPriority(state: GameState): GameState {
  if (!state.priorityPlayer) return state;
  const passes = state.passesInARow + 1;

  if (passes < 2) {
    return { ...state, priorityPlayer: otherPlayer(state.priorityPlayer), passesInARow: passes };
  }

  if (state.stack.length === 0) {
    return { ...state, priorityPlayer: state.activePlayer, passesInARow: 0 };
  }

  return resolveTopOfStack(state);
}

/** Pops and resolves the top stack item, then hands priority back to the active player. */
export function resolveTopOfStack(state: GameState): GameState {
  const top = state.stack[state.stack.length - 1];
  let next: GameState = { ...state, stack: state.stack.slice(0, -1) };
  next = appendLog(next, `Resolving ${top.sourceName}: ${top.abilityName}.`);
  next = top.resolve(next);
  return { ...next, priorityPlayer: next.activePlayer, passesInARow: 0 };
}
