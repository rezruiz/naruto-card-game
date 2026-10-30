import { useRef, useState, type PointerEvent } from "react";
import type { HandPeek } from "../../engine/types";
import { getHandCardDef } from "../../engine/cards/registry";
import { getCharacterDeckEntry } from "../../engine/characters";
import { getCharacterCardText, getHandCardText } from "../cardInfo";
import {
  characterInfo,
  costGem,
  handCardCost,
  handCardSubtitle,
  handCardSummary,
  CHARACTER_STYLE_CLASS,
  displayStyle,
  styleClass,
} from "../cardDisplay";
import { StatIcon } from "./StatIcon";
import "../Hand.css";

/**
 * A look at the opponent's hand (e.g. Amegakure Elite Guard: Sensor's Rain Sensing): a snapshot of their hand
 * as it was at that moment — it never updates. A small window the viewer can drag around by its title bar,
 * click a card for its details, and close when they're done.
 */
export function HandPeekWindow({
  peek,
  offset,
  onClose,
  onOpenDetails,
}: {
  peek: HandPeek;
  /** Stagger for several open windows. */
  offset: number;
  onClose: () => void;
  onOpenDetails: (
    name: string,
    subtitle: string,
    text: string | undefined,
  ) => void;
}) {
  const [pos, setPos] = useState({ x: 80 + offset * 28, y: 90 + offset * 28 });
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const x = Math.min(
      Math.max(0, e.clientX - drag.current.dx),
      window.innerWidth - 120,
    );
    const y = Math.min(
      Math.max(0, e.clientY - drag.current.dy),
      window.innerHeight - 40,
    );
    setPos({ x, y });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div
      className="hand-peek"
      style={{ left: pos.x, top: pos.y }}
      role="dialog"
      aria-label={`${peek.owner.toUpperCase()}'s hand`}
    >
      <div
        className="hand-peek__bar"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="hand-peek__title">
          {peek.owner.toUpperCase()}'s hand{" "}
          <span className="hand-peek__sub">
            — seen with {peek.source}, turn {peek.turn} ({peek.cards.length}{" "}
            card{peek.cards.length === 1 ? "" : "s"})
          </span>
        </span>
        <button
          type="button"
          className="hand-peek__close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {/* Inside .hand-view so the cards get exactly the hand's own card layout. */}
      <div className="hand-view hand-peek__body">
        <div className="hand-view__cards">
          {peek.cards.length === 0 && (
            <p className="hand-peek__empty">Their hand was empty.</p>
          )}
          {peek.cards.map((entry) => {
            if (entry.kind === "character") {
              const charEntry = getCharacterDeckEntry(entry.entryId);
              if (!charEntry)
                return (
                  <div
                    className="hand-card hand-card--back"
                    key={entry.instanceId}
                    aria-label="Unknown card"
                  />
                );
              const { hp, styles } = characterInfo(charEntry);
              return (
                <div
                  className={`hand-card hand-card--character ${CHARACTER_STYLE_CLASS}`}
                  key={entry.instanceId}
                  title="Click for details"
                  onClick={() =>
                    onOpenDetails(
                      charEntry.name,
                      `Character card · Rank ${charEntry.rank} — in ${peek.owner.toUpperCase()}'s hand`,
                      getCharacterCardText(entry.entryId),
                    )
                  }
                >
                  <span className="hand-card__gem hand-card__gem--rank">
                    {charEntry.rank}
                  </span>
                  <div className="hand-card__name">{charEntry.name}</div>
                  <div className="hand-card__type">
                    Character · Rank {charEntry.rank}
                  </div>
                  <div className="hand-card__text">{styles}</div>
                  {hp && (
                    <div className="hand-card__stats">
                      <span
                        className="hand-card__stat hand-card__stat--health"
                        title="Health"
                      >
                        <span aria-hidden>♥</span>
                        {hp}
                      </span>
                    </div>
                  )}
                </div>
              );
            }
            const def = getHandCardDef(entry.defId);
            if (!def)
              return (
                <div
                  className="hand-card hand-card--back"
                  key={entry.instanceId}
                  aria-label="Unknown card"
                />
              );
            return (
              <div
                className={`hand-card hand-card--${def.cardType} ${styleClass(displayStyle(def))}`}
                key={entry.instanceId}
                title="Click for details"
                onClick={() =>
                  onOpenDetails(
                    def.name,
                    `${def.cardType} card — in ${peek.owner.toUpperCase()}'s hand`,
                    getHandCardText(def.name),
                  )
                }
              >
                <span {...costGem(def, "hand-card__gem")}>
                  {handCardCost(def)}
                </span>
                <div className="hand-card__name">{def.name}</div>
                <div className="hand-card__type">{handCardSubtitle(def)}</div>
                <div className="hand-card__text">{handCardSummary(def)}</div>
                {def.shinobi && (
                  <div className="hand-card__stats">
                    <StatIcon
                      kind="attack"
                      value={def.shinobi.damage}
                      title={`Damage ${def.shinobi.damage}`}
                    />
                    <span className="hand-card__stat--health">
                      <StatIcon
                        kind="defense"
                        value={def.shinobi.health}
                        title={`Health ${def.shinobi.health}`}
                      />
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
