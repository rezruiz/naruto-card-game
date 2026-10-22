import { useEffect, useRef, useState } from 'react';
import type { PlayerState } from '../../engine/types';
import { STARTING_HEALTH } from '../../engine/state';

/**
 * A player's Health, Yu-Gi-Oh LP-style: a plate in their own bottom-left
 * corner of the board (from their seat — so the opponent's sits top-right).
 * Shows the change ("−5") for a moment whenever Health moves, and turns
 * amber at 10 or below and red at 5 or below.
 */
export function HealthPlate({
  player,
  isActive,
  isYou,
  onAdjust,
}: {
  player: PlayerState;
  isActive: boolean;
  isYou?: boolean;
  /** Trust mode: manual Health correction (shown on hover). */
  onAdjust?: (delta: number) => void;
}) {
  const health = player.health;
  const previous = useRef(health);
  const [change, setChange] = useState<{ delta: number; key: number } | null>(null);

  useEffect(() => {
    const delta = health - previous.current;
    previous.current = health;
    if (delta === 0) return;
    setChange({ delta, key: Date.now() });
    const timer = window.setTimeout(() => setChange(null), 1800);
    return () => window.clearTimeout(timer);
  }, [health]);

  const level = health <= 5 ? 'danger' : health <= 10 ? 'warn' : 'ok';
  const pct = Math.max(0, Math.min(100, (health / STARTING_HEALTH) * 100));

  return (
    <div
      className={`health-plate health-plate--${level}${isActive ? ' health-plate--active' : ''}${change && change.delta < 0 ? ' health-plate--hit' : ''}`}
      aria-label={`${player.id.toUpperCase()} Health ${health} of ${STARTING_HEALTH}`}
    >
      <div className="health-plate__who">
        {player.id.toUpperCase()}
        {isYou && <span className="health-plate__you">You</span>}
        {isActive && <span className="health-plate__turn">Turn</span>}
      </div>
      <div className="health-plate__value">
        <span className="health-plate__label">HP</span>
        <span className="health-plate__number">{health}</span>
        {change && (
          <span key={change.key} className={`health-plate__change${change.delta > 0 ? ' health-plate__change--gain' : ''}`}>
            {change.delta > 0 ? `+${change.delta}` : `−${-change.delta}`}
          </span>
        )}
      </div>
      <div className="health-plate__bar" aria-hidden>
        <div className="health-plate__fill" style={{ width: `${pct}%` }} />
      </div>
      {onAdjust && (
        <div className="health-plate__adjust">
          <button type="button" aria-label="Lose 1 Health" onClick={() => onAdjust(-1)}>
            −
          </button>
          <button type="button" aria-label="Gain 1 Health" onClick={() => onAdjust(1)}>
            +
          </button>
        </div>
      )}
    </div>
  );
}
