import { findOccupant } from '../../engine/board';
import type { GameAction, GameState, PlayerId } from '../../engine/types';

/**
 * Trust mode's shared "declared actions" area — the lightweight stack. Both
 * players see everything declared so far; each can edit or withdraw their
 * own until the round is resolved. Nothing is calculated until Resolve
 * Actions / Finalize Phase, and the opponent is only asked to OK when the
 * engine finds they actually have a legal response available.
 */
export function StagedPanel({
  state,
  myPlayerId,
  dispatch,
  onRetarget,
  canRetarget,
}: {
  state: GameState;
  /** null = local hotseat (one screen, both players). */
  myPlayerId: PlayerId | null;
  dispatch: (action: GameAction) => void;
  onRetarget: (stagedId: string) => void;
  canRetarget: (stagedId: string) => boolean;
}) {
  const mine = (p: PlayerId) => myPlayerId === null || myPlayerId === p;
  const pending = state.pendingFinalize;
  const waitingOn = pending ? (['p1', 'p2'] as PlayerId[]).filter((p) => !pending.approvals.includes(p)) : [];
  const active = state.activePlayer;
  const targetName = (id: string) => findOccupant(state, id)?.occupant.name ?? 'unknown';

  return (
    <div className="staged-panel">
      <div className="staged-panel__header">
        <strong>Declared actions ({state.staged.length})</strong>
        <span className="staged-panel__hint">Resolves top to bottom (first declared, first resolved). Nothing is calculated until the round is resolved — edit freely until then.</span>
      </div>

      {state.staged.length === 0 && <div className="staged-panel__empty">No actions declared.</div>}
      <ol className="staged-panel__list">
        {state.staged.map((a, index) => (
          <li key={a.id} className={`staged-item staged-item--${a.owner}`}>
            <div className="staged-item__main">
              <span className="staged-item__order">{index + 1}.</span>
              <span className="staged-item__owner">{a.owner.toUpperCase()}</span>
              <span className="staged-item__label">{a.label}</span>
              {a.targets.length > 0 && <span className="staged-item__targets">→ {a.targets.map(targetName).join(', ')}</span>}
            </div>
            {a.warnings.length > 0 && (
              <div className="staged-item__warning" title="Advisory only — the engine will still resolve it. Check with your opponent.">
                ⚠ Not legal under the strict rules: {a.warnings.join(' ')}
              </div>
            )}
            {mine(a.owner) && (
              <div className="staged-item__actions">
                <button type="button" disabled={index === 0} title="Resolve earlier — move it ahead of the item above" onClick={() => dispatch({ type: 'MOVE_STAGED', stagedId: a.id, direction: 'earlier' })}>
                  ↑ Earlier
                </button>
                <button type="button" disabled={index === state.staged.length - 1} title="Resolve later — move it behind the item below" onClick={() => dispatch({ type: 'MOVE_STAGED', stagedId: a.id, direction: 'later' })}>
                  ↓ Later
                </button>
                {canRetarget(a.id) && (
                  <button type="button" onClick={() => onRetarget(a.id)}>
                    Change target
                  </button>
                )}
                <button type="button" onClick={() => dispatch({ type: 'UNSTAGE', stagedId: a.id })}>
                  Remove
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>

      {!pending && mine(active) && (
        <div className="staged-panel__controls">
          <button type="button" onClick={() => dispatch({ type: 'RESOLVE_ACTIONS', player: active })}>
            Resolve Actions
          </button>
          <button type="button" className="primary" onClick={() => dispatch({ type: 'FINALIZE_PHASE', player: active })}>
            Finalize {state.phase} Phase →
          </button>
        </div>
      )}
      {!pending && !mine(active) && <div className="staged-panel__status">Waiting for {active.toUpperCase()} to resolve or finalize the phase.</div>}

      {pending && (
        <div className="staged-panel__prompt">
          <div>
            <strong>{pending.by.toUpperCase()}</strong> {pending.advance ? 'is finalizing the phase' : 'wants to resolve the declared actions'}.
            {waitingOn.length > 0 && <> Waiting on {waitingOn.map((p) => p.toUpperCase()).join(' & ')}.</>}
          </div>
          <div className="staged-panel__controls">
            {waitingOn
              .filter((p) => mine(p))
              .map((p) => (
                <button key={p} type="button" className="primary" onClick={() => dispatch({ type: 'APPROVE_RESOLVE', player: p })}>
                  {p.toUpperCase()}: OK — no response
                </button>
              ))}
            {mine(pending.by) && (
              <button type="button" onClick={() => dispatch({ type: 'CANCEL_FINALIZE', player: pending.by })}>
                Reopen to make changes
              </button>
            )}
          </div>
          {waitingOn.some((p) => mine(p)) && (
            <div className="staged-panel__hint">You have a legal response available — declare it now (play a card / activate an ability), or click OK.</div>
          )}
        </div>
      )}
    </div>
  );
}
