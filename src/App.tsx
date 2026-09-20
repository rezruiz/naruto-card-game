import { useReducer } from 'react';
import { gameReducer } from './engine/reducer';
import { createInitialState } from './engine/state';
import type { PlayerId } from './engine/types';
import { ActionLog } from './ui/components/ActionLog';
import { ChakraSourceRow } from './ui/components/ChakraSourceRow';
import { CharacterCard } from './ui/components/CharacterCard';
import { HandView } from './ui/components/HandView';
import { PhaseIndicator } from './ui/components/PhaseIndicator';
import { PlayerHealthBar } from './ui/components/PlayerHealthBar';
import { TurnControls } from './ui/components/TurnControls';
import './App.css';

const MAIN_PHASES = new Set(['Main1', 'Main2']);

function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => createInitialState('p1'));
  const canAct = MAIN_PHASES.has(state.phase);

  function renderPlayerBoard(playerId: PlayerId) {
    const player = state.players[playerId];
    const isActive = state.activePlayer === playerId;
    const canActNow = isActive && canAct;

    return (
      <div className="player-board" key={playerId}>
        <PlayerHealthBar player={player} isActive={isActive} />
        <ChakraSourceRow
          sources={player.chakraSources}
          genericChakraAvailable={player.genericChakraAvailable}
          canTap={canActNow}
          onTap={(sourceIndex) => dispatch({ type: 'TAP_CHAKRA_SOURCE', sourceIndex })}
        />
        <HandView
          handSize={player.hand.length}
          canPlace={canActNow}
          alreadyPlacedThisTurn={player.chakraSourcePlacedThisTurn}
          onPlaceChakraSource={() => dispatch({ type: 'PLACE_CHAKRA_SOURCE' })}
        />
        <div className="board-row">
          {player.board.map((character) => (
            <CharacterCard
              key={character.instanceId}
              character={character}
              canPool={canActNow}
              onPoolOne={(instanceId) => dispatch({ type: 'POOL_CHAKRA', instanceId, amount: 1 })}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <h1>Naruto Custom Card Game — Prototype</h1>
      <div className="players-row">
        {renderPlayerBoard('p1')}
        {renderPlayerBoard('p2')}
      </div>
      <PhaseIndicator state={state} />
      <TurnControls onAdvancePhase={() => dispatch({ type: 'ADVANCE_PHASE' })} />
      <ActionLog log={state.log} />
    </div>
  );
}

export default App;
