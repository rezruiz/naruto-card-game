import type { GameState, TokenInstance } from '../../engine/types';
import { trackedResources } from '../../engine/characters/progressText';
import { getTokenDef } from '../../engine/characters/registry';
import { getHandCardDef } from '../../engine/cards/registry';
import { hasFieldOrientation } from '../../engine/board';
import { isPrototype } from '../../engine/prototype';
import { isShinobi, shinobiDamage } from '../../engine/shinobi';
import { EquipmentChips } from './EquipmentChips';
import { StatIcon } from './StatIcon';

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
  const shinobi: boolean = isShinobi(token);
  // Prototype: Shinobi and tokens are creature cards — effects in the middle,
  // attack (Damage) bottom-left and Health bottom-right, so Damage isn't repeated as a badge.
  const creature = isPrototype(state);
  const resources = trackedResources(state, token).filter((t) => t.key && !(creature && t.label === 'Damage'));
  const orienting = hasFieldOrientation(state, token);
  const leaderBonus = shinobi ? getHandCardDef(token.defId)?.shinobi?.leaderBonus : undefined;
  const tokenDef = getTokenDef(token.defId);
  const effects = !creature ? [] : leaderBonus ? [`+${leaderBonus.amount} Damage with ${leaderBonus.name}`] : [...(tokenDef?.traits ?? []), ...(tokenDef?.abilities ?? []).map((a) => a.name.replace(/^\w+ Release: /, ''))];
  return (
    <div
      className={`compact-card token-card${creature ? ' token-card--creature' : ''}${shinobi ? ' token-card--shinobi' : ''}${isTargetable ? ' targetable' : ''}`}
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
      {creature ? (
        token.chakraPool && <div className="compact-card__vitals">Pool {token.chakraPool.current}/{token.chakraPool.capacity}</div>
      ) : (
        <div className="compact-card__vitals">
          HP {token.currentHP}/{token.maxHP}
          {token.chakraPool && ` · Pool ${token.chakraPool.current}/${token.chakraPool.capacity}`}
        </div>
      )}
      {creature && (
        // Room for the card's effects above the stat line (placeholder Shinobi have none yet).
        <div className="token-card__effects">
          {effects.map((name) => (
            <div className="token-card__effect" key={name}>
              {name}
            </div>
          ))}
        </div>
      )}
      {shinobi && <EquipmentChips state={state} holderId={token.instanceId} />}
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
      {creature && (
        <div className="token-card__stats" aria-label={`Health ${token.currentHP} of ${token.maxHP}${shinobi ? `, Damage ${shinobiDamage(token, state)}` : ''}`}>
          {shinobi && <StatIcon kind="attack" value={shinobiDamage(token, state)} title={`Damage ${shinobiDamage(token, state)}`} />}
          <span className="token-card__stat--health">
            <StatIcon kind="defense" value={token.currentHP} hurt={token.currentHP < token.maxHP} title={`Health ${token.currentHP} of ${token.maxHP}`} />
          </span>
        </div>
      )}
      <div className="compact-card__hint">Click for details</div>
    </div>
  );
}
