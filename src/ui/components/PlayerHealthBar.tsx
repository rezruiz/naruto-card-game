import type { PlayerState } from '../../engine/types';

export function PlayerHealthBar({
  player,
  isActive,
  isYou,
  onAdjust,
}: {
  player: PlayerState;
  isActive: boolean;
  isYou?: boolean;
  /** Trust mode: manual Health correction. */
  onAdjust?: (delta: number) => void;
}) {
  return (
    <div className={isActive ? 'player-panel player-panel--active' : 'player-panel'}>
      <h3>
        {player.id.toUpperCase()}
        {isYou ? ' (You)' : ''}
        {isActive ? ' — active turn' : ''}
      </h3>
      <div className="player-panel__health">
        Health: {player.health}
        {onAdjust && (
          <span className="stepper">
            <button type="button" aria-label="Lose 1 Health" onClick={() => onAdjust(-1)}>
              −
            </button>
            <button type="button" aria-label="Gain 1 Health" onClick={() => onAdjust(1)}>
              +
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
