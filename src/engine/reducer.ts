import { placeChakraSource, poolChakra, tapChakraSource } from './chakra';
import { advancePhase } from './phases/phaseMachine';
import type { GameAction, GameState } from './types';

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'ADVANCE_PHASE':
      return advancePhase(state);
    case 'PLACE_CHAKRA_SOURCE':
      return placeChakraSource(state);
    case 'TAP_CHAKRA_SOURCE':
      return tapChakraSource(state, action.sourceIndex);
    case 'POOL_CHAKRA':
      return poolChakra(state, action.instanceId, action.amount);
    default:
      return state;
  }
}
