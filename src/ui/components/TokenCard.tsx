import type { GameState, TokenInstance } from '../../engine/types';
import { trackedResources } from '../../engine/characters/progressText';
import { hasFieldOrientation } from '../../engine/board';

export function TokenCard({
  token,
  state,
  isTargetable,
  onClickAsTarget,
  onOpenDetails,
}: {
  token: TokenInstance;
  state: GameState;
  isTargetable: boolean;
  onClickAsTarget: (instanceId: string) => void;
  onOpenDetails: (instanceId: string) => void;
}) {
  const resources = trackedResources(state, token).filter((t) => t.key);
  const orienting = hasFieldOrientation(state, token);
  return (
    <div
      className={`compact-card token-card${isTargetable ? ' targetable' : ''}`}
      onClick={() => (isTargetable ? onClickAsTarget(token.instanceId) : onOpenDetails(token.instanceId))}
    >
      <button
        type="button"
        className="compact-card__info"
        title="Card details"
        onClick={(e) => {
          e.stopPropagation();
          onOpenDetails(token.instanceId);
        }}
      >
        ⓘ
      </button>
      <div className="compact-card__name">{token.name}</div>
      <div className="compact-card__vitals">
        HP {token.currentHP}/{token.maxHP}
        {token.chakraPool && ` · Pool ${token.chakraPool.current}/${token.chakraPool.capacity}`}
      </div>
      {(resources.length > 0 || orienting || token.status.disabled) && (
        <div className="compact-card__badges">
          {token.status.disabled && <span className="badge badge--disabled">Disabled</span>}
          {orienting && (
            <span className="badge badge--orientation" title="Field Orientation: it entered play this turn, so it can't use damage-dealing abilities until its controller's next turn. Non-damaging abilities are fine.">
              Field Orientation
            </span>
          )}
          {resources.map((t, i) => (
            <span className="badge badge--resource" key={`${t.label}-${i}`} title={`${t.label}: ${t.value}`}>
              {t.label}: {t.value}
            </span>
          ))}
        </div>
      )}
      <div className="compact-card__hint">Click for details</div>
    </div>
  );
}
