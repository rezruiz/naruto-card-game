import { useReducer } from 'react';
import { gameReducer } from './engine/reducer';
import { createInitialState } from './engine/state';
import { ActionLog } from './ui/components/ActionLog';
import { PhaseIndicator } from './ui/components/PhaseIndicator';
import { PlayerHealthBar } from './ui/components/PlayerHealthBar';
import { TurnControls } from './ui/components/TurnControls';
import './App.css';

function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => createInitialState('p1'));

  return (
    <div className="app">
      <h1>Naruto Custom Card Game — Prototype</h1>
      <div className="players-row">
        <PlayerHealthBar player={state.players.p1} isActive={state.activePlayer === 'p1'} />
        <PlayerHealthBar player={state.players.p2} isActive={state.activePlayer === 'p2'} />
      </div>
      <PhaseIndicator state={state} />
      <TurnControls onAdvancePhase={() => dispatch({ type: 'ADVANCE_PHASE' })} />
      <ActionLog log={state.log} />
    </div>
  );
}

export default App;
