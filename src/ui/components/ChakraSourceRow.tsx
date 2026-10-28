import type { ReactNode } from 'react';
import type { ChakraSource } from '../../engine/types';

export function ChakraSourceRow({
  sources,
  genericChakraAvailable,
  fadingChakra = 0,
  canTap,
  onTap,
  onUntap,
  onAdjustGeneric,
  endSlot,
  supplies,
  onAdjustSupplies,
}: {
  sources: ChakraSource[];
  genericChakraAvailable: number;
  /** How much of it was absorbed — spent first, fades at the next phase change. */
  fadingChakra?: number;
  canTap: boolean;
  onTap: (index: number) => void;
  /** Trust mode: clicking a tapped source undoes the tap. */
  onUntap?: (index: number) => void;
  /** Trust mode: manual correction of the available Chakra count. */
  onAdjustGeneric?: (delta: number) => void;
  /** Shown at the far right of the row (the Consumed pile — the cards spent to place these sources). */
  endSlot?: ReactNode;
  /** Prototype rules: this turn's Supplies (refill each turn; max = turns started, up to 20). */
  supplies?: { available: number; max: number };
  /** Trust mode: manual correction of this turn's Supplies. */
  onAdjustSupplies?: (delta: number) => void;
}) {
  return (
    <div className="chakra-sources">
      <span className="chakra-sources__label">
        <span className="chakra-symbol" aria-hidden>
          🌀
        </span>
        {supplies ? 'Chakra to pool' : 'Chakra available'}: <strong>{genericChakraAvailable}</strong>
        {fadingChakra > 0 && (
          <span className="chakra-sources__fading" title="Absorbed Chakra is spent first and fades when the phase changes">
            {' '}
            ({Math.min(fadingChakra, genericChakraAvailable)} absorbed — fades at phase end)
          </span>
        )}
        {onAdjustGeneric && (
          <span className="stepper">
            <button type="button" aria-label="Remove 1 available Chakra" onClick={() => onAdjustGeneric(-1)}>
              −
            </button>
            <button type="button" aria-label="Add 1 available Chakra" onClick={() => onAdjustGeneric(1)}>
              +
            </button>
          </span>
        )}
      </span>
      {supplies && (
        <span className="chakra-sources__label supplies-label" title="Supplies refill at the start of each of your turns. Your maximum is the number of turns you've started (up to 20). Shinobi, Missions, Terrain, Assists, Retreat and Leader Deck draws cost Supplies.">
          <span aria-hidden>📦</span> Supplies:
          {/* One span, so the label's flex gap doesn't space out "3 / 5". */}
          <span className="supplies-count">
            <strong>{supplies.available}</strong>/{supplies.max}
          </span>
          {onAdjustSupplies && (
            <span className="stepper">
              <button type="button" aria-label="Remove 1 Supply" onClick={() => onAdjustSupplies(-1)}>
                −
              </button>
              <button type="button" aria-label="Add 1 Supply" onClick={() => onAdjustSupplies(1)}>
                +
              </button>
            </span>
          )}
        </span>
      )}
      <div className="chakra-sources__boxes">
        {sources.map((source, index) => (
          <button
            key={index}
            type="button"
            className={source.tapped ? 'chakra-source chakra-source--tapped' : 'chakra-source'}
            disabled={source.tapped ? !onUntap || !canTap : !canTap}
            onClick={() => (source.tapped ? onUntap?.(index) : onTap(index))}
            title={source.tapped ? (onUntap ? 'Tapped — click to undo' : 'Tapped this turn') : 'Tap for 1 Chakra'}
          >
            <span className="chakra-source__symbol" aria-hidden>
              🌀
            </span>
          </button>
        ))}
        {sources.length === 0 && <span className="chakra-sources__empty">No Chakra sources placed yet</span>}
      </div>
      {endSlot && <div className="chakra-sources__end">{endSlot}</div>}
    </div>
  );
}
