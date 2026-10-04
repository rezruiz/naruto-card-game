import type { CharacterInstance, GameState } from '../../engine/types';
import { hasFieldOrientation } from '../../engine/board';
import { trackedResources } from '../../engine/characters/progressText';

/** The drag payload type for a character being dragged back to hand. */
export const CHARACTER_DRAG_TYPE = 'application/x-naruto-character';
/** The drag payload type for a Mission or Terrain in play being dragged back to hand. */
export const IN_PLAY_CARD_DRAG_TYPE = 'application/x-naruto-in-play-card';

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
  draggable = false,
}: {
  character: CharacterInstance;
  state: GameState;
  isTargetable: boolean;
  isEnablable?: boolean;
  onClickAsTarget: (instanceId: string) => void;
  onClickAsEnabler?: (instanceId: string) => void;
  onOpenDetails: (instanceId: string) => void;
  /** Trust mode, own board: can be dragged onto its owner's hand to take back a play. */
  draggable?: boolean;
}) {
  const { chakraPool } = character;
  const sick = hasFieldOrientation(state, character);
  const resources = trackedResources(state, character).filter((t) => t.key);

  function handleClick() {
    if (isEnablable) onClickAsEnabler?.(character.instanceId);
    else if (isTargetable) onClickAsTarget(character.instanceId);
    else onOpenDetails(character.instanceId);
  }

  return (
    <div
      className={`compact-card character-card${isTargetable ? ' targetable' : ''}${isEnablable ? ' enablable' : ''}${character.status.retreated ? ' compact-card--retreated' : ''}`}
      onClick={handleClick}
      draggable={draggable}
      title={draggable ? 'Drag onto your hand to return this character to hand' : undefined}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.setData(CHARACTER_DRAG_TYPE, character.instanceId);
        e.dataTransfer.effectAllowed = 'move';
      }}
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
      {character.styles.length > 0 && (
        <div className="compact-card__styles" title="Styles — which Style abilities and Jutsu cards this character can use or enable">
          {character.styles.map((style) => (
            <span key={style} className={`style-chip style-chip--${style.toLowerCase()}`}>
              {style}
            </span>
          ))}
        </div>
      )}
      <div className="compact-card__badges">
        {character.status.retreated && <span className="badge badge--retreated">Retreated</span>}
        {character.status.disabled && <span className="badge badge--disabled">Disabled</span>}
        {sick && (
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
      <div className="compact-card__hint">Click for details</div>
    </div>
  );
}
