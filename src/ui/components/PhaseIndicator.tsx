import { PHASE_ORDER, type GameState } from '../../engine/types';

export function PhaseIndicator({ state }: { state: GameState }) {
  return (
    <div className="phase-indicator">
      <div className="phase-indicator__turn">
        Turn {state.turn} — {state.activePlayer.toUpperCase()}'s turn
      </div>
      <ol className="phase-indicator__list">
        {PHASE_ORDER.map((phase) => (
          <li key={phase} className={phase === state.phase ? 'phase phase--active' : 'phase'}>
            {phase}
          </li>
        ))}
      </ol>
    </div>
  );
}
