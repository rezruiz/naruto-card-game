import { useState } from 'react';
import type { HandEntry } from '../../engine/types';
import { CHARACTER_DRAG_TYPE, IN_PLAY_CARD_DRAG_TYPE } from './CharacterCard';
import { getHandCardDef } from '../../engine/cards/registry';
import { getCharacterDeckEntry } from '../../engine/characters';
import { getCharacterCardText, getHandCardText } from '../cardInfo';

export function HandView({
  hand,
  canPlace,
  canAct,
  alreadyPlacedThisTurn,
  pendingCardInstanceId,
  onPlaceChakraSource,
  onStartPlayCard,
  onPlayCharacter,
  onOpenDetails,
  onMoveCard,
  characterPlay,
  onDropCharacter,
  onDropInPlayCard,
  mustPlayCPlus = false,
}: {
  hand: HandEntry[];
  canPlace: boolean;
  canAct: boolean;
  alreadyPlacedThisTurn: boolean;
  /** The card currently mid-flow (choosing an enabler/target) — disables re-triggering it and other card plays until resolved or cancelled. */
  pendingCardInstanceId: string | null;
  onPlaceChakraSource: (instanceId: string) => void;
  onStartPlayCard: (instanceId: string) => void;
  onPlayCharacter: (instanceId: string) => void;
  /** Opens the full-card popup — hovering a hand card shows a hint, clicking anywhere on it (other than its buttons) opens this. */
  onOpenDetails: (name: string, subtitle: string, text: string | undefined) => void;
  /** Trust mode only: manually move a card out of hand (discard / top or bottom of deck). */
  onMoveCard?: (instanceId: string, to: 'discard' | 'deck-top' | 'deck-bottom') => void;
  /** What to show on a Character card's Play button: its Reinforcement Tax, and whether the board has room for it. */
  characterPlay?: (entryId: string) => { label: string; hint: string; disabled: boolean; reason?: string };
  /** Trust mode, own hand: a character dragged here from the battlefield returns to hand. */
  onDropCharacter?: (instanceId: string) => void;
  /** Trust mode, own hand: a Mission or Terrain dragged here from play returns to hand. */
  onDropInPlayCard?: (instanceId: string) => void;
  /** This player must play a C+ character now (their last C+ fell) — highlights the cards that satisfy it. */
  mustPlayCPlus?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      className={`hand-view${dragOver ? ' hand-view--drop' : ''}`}
      onDragOver={(e) => {
        const accepts =
          (onDropCharacter && e.dataTransfer.types.includes(CHARACTER_DRAG_TYPE)) || (onDropInPlayCard && e.dataTransfer.types.includes(IN_PLAY_CARD_DRAG_TYPE));
        if (!accepts) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        setDragOver(false);
        const characterId = e.dataTransfer.getData(CHARACTER_DRAG_TYPE);
        const cardId = e.dataTransfer.getData(IN_PLAY_CARD_DRAG_TYPE);
        if (characterId && onDropCharacter) {
          e.preventDefault();
          onDropCharacter(characterId);
        } else if (cardId && onDropInPlayCard) {
          e.preventDefault();
          onDropInPlayCard(cardId);
        }
      }}
    >
      <span className="hand-view__label">
        Hand ({hand.length})
        {(onDropCharacter || onDropInPlayCard) && <span className="hand-view__drop-hint"> — drag a character, Mission or Terrain here to return it to hand</span>}
      </span>
      <div className="hand-view__cards">
        {hand.map((entry) => {
          if (entry.kind === 'character') {
            const charEntry = getCharacterDeckEntry(entry.entryId);
            if (!charEntry) {
              return (
                <div className="hand-card hand-card--hidden" key={entry.instanceId}>
                  <div className="hand-card__name">Hidden card</div>
                </div>
              );
            }
            const required = mustPlayCPlus && charEntry.rank !== 'D';
            return (
              <div
                className={`hand-card hand-card--character${required ? ' hand-card--required' : ''}`}
                key={entry.instanceId}
                onClick={() => onOpenDetails(charEntry.name, `Character card · Rank ${charEntry.rank} — in hand`, getCharacterCardText(entry.entryId))}
              >
                <div className="hand-card__hint">Click for details</div>
                <div className="hand-card__name">{charEntry.name}</div>
                <div className="hand-card__meta">Rank {charEntry.rank} — Character</div>
                {(() => {
                  const play = characterPlay?.(entry.entryId);
                  return (
                    <button
                      type="button"
                      disabled={!(canAct || required) || !!play?.disabled}
                      title={play?.reason ?? play?.hint}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayCharacter(entry.instanceId);
                      }}
                    >
                      {play?.label ?? 'Play'}
                    </button>
                  );
                })()}
              </div>
            );
          }

          const def = getHandCardDef(entry.defId);
          if (!def) {
            return (
              <div className="hand-card hand-card--hidden" key={entry.instanceId}>
                <div className="hand-card__name">Hidden card</div>
              </div>
            );
          }
          const isPending = pendingCardInstanceId === entry.instanceId;
          return (
            <div
              className={`hand-card${isPending ? ' hand-card--pending' : ''}`}
              key={entry.instanceId}
              onClick={() => onOpenDetails(def.name, `${def.cardType} card — in hand`, getHandCardText(def.name))}
            >
              <div className="hand-card__hint">Click for details</div>
              <div className="hand-card__name">{def.name}</div>
              <div className="hand-card__meta">
                {def.cardType} · {typeof def.cost === 'number' ? `${def.cost} Chakra` : 'variable cost'} · {def.speed}
              </div>
              <div className="hand-card__actions">
                <button
                  type="button"
                  disabled={!canAct || !!pendingCardInstanceId}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartPlayCard(entry.instanceId);
                  }}
                >
                  {isPending ? 'Choosing…' : 'Play'}
                </button>
                <button
                  type="button"
                  disabled={!canPlace || alreadyPlacedThisTurn || !!pendingCardInstanceId}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlaceChakraSource(entry.instanceId);
                  }}
                  title="Discard this card to place a Chakra source (once per turn)"
                >
                  🌀 Discard for Chakra
                </button>
                {onMoveCard && (
                  <select
                    className="hand-card__move"
                    value=""
                    aria-label="Move card"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      if (e.target.value) onMoveCard(entry.instanceId, e.target.value as 'discard' | 'deck-top' | 'deck-bottom');
                    }}
                  >
                    <option value="">Move…</option>
                    <option value="discard">To discard pile</option>
                    <option value="deck-top">To top of deck</option>
                    <option value="deck-bottom">To bottom of deck</option>
                  </select>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
