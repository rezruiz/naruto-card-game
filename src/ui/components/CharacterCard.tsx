import type { CharacterInstance, GameState } from '../../engine/types';
import { isSummoningSick } from '../../engine/board';

/**
 * A minimized in-play card: just the name plus a one-line vitals readout.
 * The full text and every action (Pool, Retreat, abilities) live in the
 * details popup, opened by clicking the card (or its ⓘ button while a
 * target/enabler is being picked, when a plain click selects instead).
 */
export function CharacterCard({
  character,
  state,
  isTargetable,
  isEnablable,
  onClickAsTarget,
  onClickAsEnabler,
  onOpenDetails,
}: {
  character: CharacterInstance;
  state: GameState;
  isTargetable: boolean;
  isEnablable?: boolean;
  onClickAsTarget: (instanceId: string) => void;
  onClickAsEnabler?: (instanceId: string) => void;
  onOpenDetails: (instanceId: string) => void;
}) {
  const { chakraPool } = character;
  const sick = isSummoningSick(state, character);

  function handleClick() {
    if (isEnablable) onClickAsEnabler?.(character.instanceId);
    else if (isTargetable) onClickAsTarget(character.instanceId);
    else onOpenDetails(character.instanceId);
  }

  return (
    <div
      className={`compact-card character-card${isTargetable ? ' targetable' : ''}${isEnablable ? ' enablable' : ''}${character.status.retreated ? ' compact-card--retreated' : ''}`}
      onClick={handleClick}
    >
      <button
        type="button"
        className="compact-card__info"
        title="Card details"
        onClick={(e) => {
          e.stopPropagation();
          onOpenDetails(character.instanceId);
        }}
      >
        ⓘ
      </button>
      <div className="compact-card__name">{character.name}</div>
      <div className="compact-card__vitals">
        HP {character.currentHP}/{character.maxHP} · Pool {chakraPool.current}/{Number.isFinite(chakraPool.capacity) ? chakraPool.capacity : '∞'}
      </div>
      <div className="compact-card__badges">
        {character.status.retreated && <span className="badge badge--retreated">Retreated</span>}
        {character.status.disabled && <span className="badge badge--disabled">Disabled</span>}
        {sick && <span className="badge badge--sick">Sick</span>}
      </div>
      <div className="compact-card__hint">Click for details</div>
    </div>
  );
}
