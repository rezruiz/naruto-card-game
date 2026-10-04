import { PHASE_ORDER, type GameState, type Phase } from '../../engine/types';

/** The turn's phases — click one to jump ahead to it (or, in trust mode, back to it). */
export function PhaseIndicator({ state, onGoToPhase, onPassTurn }: { state: GameState; onGoToPhase?: (phase: Phase) => void; onPassTurn?: () => void }) {
  const current = PHASE_ORDER.indexOf(state.phase);
  return (
    <div className="phase-indicator">
      <div className="phase-indicator__turn">
        Turn {state.turn} — {state.activePlayer.toUpperCase()}'s turn
      </div>
      <ol className="phase-indicator__list">
        {PHASE_ORDER.map((phase, i) => {
          const active = phase === state.phase;
          const canClick = !!onGoToPhase && !active && (i > current || state.rules === 'trust');
          return (
            <li key={phase} className={active ? 'phase phase--active' : 'phase'}>
              {canClick ? (
                <button
                  type="button"
                  className="phase__button"
                  title={i > current ? `Skip ahead to ${phase} (runs the phases in between)` : `Go back to ${phase} (trust mode — nothing in between is undone)`}
                  onClick={() => onGoToPhase!(phase)}
                >
                  {phase}
                </button>
              ) : (
                phase
              )}
            </li>
          );
        })}
      </ol>
      {onPassTurn && (
        <button type="button" className="phase-indicator__pass" onClick={onPassTurn} title="End your turn now — the rest of it plays out (End-of-turn effects included) and the other player's turn begins">
          Pass turn →
        </button>
      )}
    </div>
  );
}
