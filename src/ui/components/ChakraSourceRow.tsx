import type { ChakraSource } from '../../engine/types';

export function ChakraSourceRow({
  sources,
  genericChakraAvailable,
  canTap,
  onTap,
  onUntap,
  onAdjustGeneric,
}: {
  sources: ChakraSource[];
  genericChakraAvailable: number;
  canTap: boolean;
  onTap: (index: number) => void;
  /** Trust mode: clicking a tapped source undoes the tap. */
  onUntap?: (index: number) => void;
  /** Trust mode: manual correction of the available Chakra count. */
  onAdjustGeneric?: (delta: number) => void;
}) {
  return (
    <div className="chakra-sources">
      <span className="chakra-sources__label">
        <span className="chakra-symbol" aria-hidden>
          🌀
        </span>
        Chakra available: <strong>{genericChakraAvailable}</strong>
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
    </div>
  );
}
