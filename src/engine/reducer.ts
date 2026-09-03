import { advancePhase } from './phases/phaseMachine';
import type { GameAction, GameState } from './types';

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'ADVANCE_PHASE':
      return advancePhase(state);
    default:
      return state;
  }
}
