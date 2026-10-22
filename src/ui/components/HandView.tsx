import { useState, type DragEvent } from 'react';
import type { HandEntry } from '../../engine/types';
import { CHARACTER_DRAG_TYPE, IN_PLAY_CARD_DRAG_TYPE } from './CharacterCard';
import { getHandCardDef } from '../../engine/cards/registry';
import { getCharacterDeckEntry } from '../../engine/characters';
import { getCharacterCardText, getHandCardText } from '../cardInfo';
import { characterInfo, handCardCost, handCardSubtitle, handCardSummary } from '../cardDisplay';
import '../Hand.css';

/** Drag data type for a card dragged out of hand onto the board (Hearthstone-style play). */
export const HAND_CARD_DRAG_TYPE = 'application/x-naruto-hand-card';

/** What's being dragged out of hand — the board uses it to light up where it can be dropped. */
export interface HandDrag {
  instanceId: string;
  kind: 'character' | 'card';
  /** Character cards: their Character Deck entry (Pain has no back-row slot — he enters as tokens). */
  entryId?: string;
}

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
  onHandDragStart,
  onHandDragEnd,
  ownerLabel,
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
  /** Opens the full-card popup — clicking anywhere on a card (other than its buttons) opens this. */
  onOpenDetails: (name: string, subtitle: string, text: string | undefined) => void;
  /** Trust mode only: manually move a card out of hand (discard / top or bottom of deck). */
  onMoveCard?: (instanceId: string, to: 'discard' | 'deck-top' | 'deck-bottom') => void;
  /** What to show on a Character card's Play button, and whether the board has room for it. */
  characterPlay?: (entryId: string) => { label: string; hint: string; disabled: boolean; reason?: string };
  /** Trust mode, own hand: a character dragged here from the battlefield returns to hand. */
  onDropCharacter?: (instanceId: string) => void;
  /** Trust mode, own hand: a Mission or Terrain dragged here from play returns to hand. */
  onDropInPlayCard?: (instanceId: string) => void;
  /** This player must play a C+ character now (their last C+ fell) — highlights the cards that satisfy it. */
  mustPlayCPlus?: boolean;
  /** A playable card started being dragged out of hand toward the board. */
  onHandDragStart?: (drag: HandDrag) => void;
  onHandDragEnd?: () => void;
  /** Whose hand this is, e.g. "P1 (You)" — the hand header is how each player's area is labeled. */
  ownerLabel?: string;
}) {
  const [dragOver, setDragOver] = useState(false);

  const dragProps = (drag: HandDrag | null) =>
    drag && onHandDragStart
      ? {
          draggable: true,
          onDragStart: (e: DragEvent) => {
            e.dataTransfer.setData(HAND_CARD_DRAG_TYPE, drag.instanceId);
            e.dataTransfer.effectAllowed = 'move';
            onHandDragStart(drag);
          },
          onDragEnd: () => onHandDragEnd?.(),
        }
      : { draggable: false };

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
        {ownerLabel && <strong className="hand-view__owner">{ownerLabel} · </strong>}
        Hand ({hand.length})
        {onHandDragStart && canAct && <span className="hand-view__drop-hint"> — drag a card onto the board to play it</span>}
        {(onDropCharacter || onDropInPlayCard) && <span className="hand-view__drop-hint"> · drag a character, Mission or Terrain here to return it to hand</span>}
      </span>
      <div className="hand-view__cards">
        {hand.map((entry) => {
          if (entry.kind === 'character') {
            const charEntry = getCharacterDeckEntry(entry.entryId);
            if (!charEntry) return <div className="hand-card hand-card--back" key={entry.instanceId} aria-label="Hidden card" />;
            const required = mustPlayCPlus && charEntry.rank !== 'D';
            const play = characterPlay?.(entry.entryId);
            const playable = (canAct || required) && !play?.disabled;
            const { hp, styles } = characterInfo(charEntry);
            return (
              <div
                className={`hand-card hand-card--character${required ? ' hand-card--required' : ''}${playable ? ' hand-card--playable' : ''}`}
                key={entry.instanceId}
                title={playable ? 'Drag onto one of your character slots to play it · click for details' : 'Click for details'}
                onClick={() => onOpenDetails(charEntry.name, `Character card · Rank ${charEntry.rank} — in hand`, getCharacterCardText(entry.entryId))}
                {...dragProps(playable ? { instanceId: entry.instanceId, kind: 'character', entryId: entry.entryId } : null)}
              >
                <span className="hand-card__gem hand-card__gem--rank">{charEntry.rank}</span>
                <div className="hand-card__name">{charEntry.name}</div>
                <div className="hand-card__type">Character · Rank {charEntry.rank}</div>
                <div className="hand-card__text">
                  {hp && <>HP {hp}<br /></>}
                  {styles}
                </div>
                <div className="hand-card__actions">
                  <button
                    type="button"
                    disabled={!playable}
                    title={play?.reason ?? play?.hint}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayCharacter(entry.instanceId);
                    }}
                  >
                    {play?.label ?? 'Play'}
                  </button>
                </div>
              </div>
            );
          }

          const def = getHandCardDef(entry.defId);
          if (!def) return <div className="hand-card hand-card--back" key={entry.instanceId} aria-label="Hidden card" />;
          const isPending = pendingCardInstanceId === entry.instanceId;
          const playable = canAct && !pendingCardInstanceId;
          return (
            <div
              className={`hand-card hand-card--${def.cardType}${isPending ? ' hand-card--pending' : ''}${playable ? ' hand-card--playable' : ''}`}
              key={entry.instanceId}
              title={playable ? 'Drag onto the board to play it (or onto your Chakra row to place it as a Chakra source) · click for details' : 'Click for details'}
              onClick={() => onOpenDetails(def.name, `${def.cardType} card — in hand`, getHandCardText(def.name))}
              {...dragProps(playable ? { instanceId: entry.instanceId, kind: 'card' } : null)}
            >
              <span className="hand-card__gem">{handCardCost(def)}</span>
              <div className="hand-card__name">{def.name}</div>
              <div className="hand-card__type">{handCardSubtitle(def)}</div>
              <div className="hand-card__text">{handCardSummary(def)}</div>
              <div className="hand-card__actions">
                <button
                  type="button"
                  disabled={!playable}
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
                  aria-label="Discard for Chakra"
                >
                  🌀
                </button>
                {onMoveCard && (
                  <select
                    className="hand-card__move"
                    value=""
                    aria-label="Move card"
                    title="Move card"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      if (e.target.value) onMoveCard(entry.instanceId, e.target.value as 'discard' | 'deck-top' | 'deck-bottom');
                    }}
                  >
                    <option value="">⋯</option>
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
