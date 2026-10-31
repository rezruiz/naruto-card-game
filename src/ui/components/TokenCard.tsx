import type { GameState, TokenInstance } from '../../engine/types';
import { trackedResources } from '../../engine/characters/progressText';
import { getTokenDef } from '../../engine/characters/registry';
import { getHandCardDef } from '../../engine/cards/registry';
import { hasFieldOrientation } from '../../engine/board';
import { isPrototype } from '../../engine/prototype';
import { isShinobi, shinobiDamage } from '../../engine/shinobi';
import { abilityCostText, abilityText, traitLines } from '../abilityText';
import { FIELD_ORIENTATION_TEXT, statusInfo, trackedInfo, type EffectInfo } from '../effectInfo';
import { EquipmentChips } from './EquipmentChips';
import { InfoChip } from './InfoChip';
import { StatIcon } from './StatIcon';

export function TokenCard({
  token,
  state,
  isTargetable,
  onClickAsTarget,
  onOpenDetails,
  onOpenInfo,
}: {
  token: TokenInstance;
  state: GameState;
  isTargetable: boolean;
  onClickAsTarget: (instanceId: string) => void;
  onOpenDetails: (instanceId: string) => void;
  /** Opens one of the card's effects (Equipment, Poison, an ability...) rather than the unit. */
  onOpenInfo?: (info: EffectInfo) => void;
}) {
  const shinobi: boolean = isShinobi(token);
  // Prototype: Shinobi and tokens are creature cards — effects in the middle,
  // attack (Damage) bottom-left and Health bottom-right, so Damage isn't repeated as a badge.
  const creature = isPrototype(state);
  const resources = trackedResources(state, token).filter((t) => t.key && !(creature && t.label === 'Damage'));
  const orienting = hasFieldOrientation(state, token);
  const leaderBonus = shinobi ? getHandCardDef(token.defId)?.shinobi?.leaderBonus : undefined;
  const tokenDef = getTokenDef(token.defId);
  // While a target is being picked, every click on the card picks it.
  const openInfo = isTargetable ? undefined : onOpenInfo;
  const effects: EffectInfo[] = !creature
    ? []
    : leaderBonus
      ? [{ name: `+${leaderBonus.amount} Damage with ${leaderBonus.name}`, subtitle: token.name, text: `+${leaderBonus.amount} Damage while you have ${leaderBonus.name} in play.` }]
      : [
          ...(tokenDef?.traits ?? []).map((name) => ({ name, subtitle: token.name, text: traitLines(token.defId).find((line) => line.startsWith(name)) ?? name })),
          ...(tokenDef?.abilities ?? []).map((a) => ({ name: a.name.replace(/^\w+ Release: /, ''), subtitle: `${token.name} · ${abilityCostText(state, token.instanceId, a)}`, text: abilityText(a) })),
        ];
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
          {effects.map((effect) => (
            <InfoChip className="token-card__effect" key={effect.name} info={effect} onOpen={openInfo}>
              {effect.name}
            </InfoChip>
          ))}
        </div>
      )}
      {shinobi && <EquipmentChips state={state} holderId={token.instanceId} onOpenInfo={openInfo} />}
      {(resources.length > 0 || orienting || token.status.disabled) && (
        <div className="compact-card__badges">
          {token.status.disabled && (
            <InfoChip className="badge badge--disabled" info={statusInfo('Disabled', token.name)} onOpen={openInfo}>
              Disabled
            </InfoChip>
          )}
          {orienting && (
            <InfoChip className="badge badge--orientation" title={`Field Orientation: ${FIELD_ORIENTATION_TEXT}`} info={statusInfo('Field Orientation', token.name)} onOpen={openInfo}>
              Field Orientation
            </InfoChip>
          )}
          {resources.map((t, i) => (
            <InfoChip className="badge badge--resource" key={`${t.label}-${i}`} title={`${t.label}: ${t.value}`} info={trackedInfo(t, token.name)} onOpen={openInfo}>
              {t.label}: {t.value}
            </InfoChip>
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
