import type { TokenInstance } from '../../engine/types';

export function TokenCard({
  token,
  isTargetable,
  onClickAsTarget,
  onOpenDetails,
}: {
  token: TokenInstance;
  isTargetable: boolean;
  onClickAsTarget: (instanceId: string) => void;
  onOpenDetails: (instanceId: string) => void;
}) {
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
      </div>
      <div className="compact-card__hint">Click for details</div>
    </div>
  );
}
