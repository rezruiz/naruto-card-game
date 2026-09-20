import type { ChakraSource } from '../../engine/types';

export function ChakraSourceRow({
  sources,
  genericChakraAvailable,
  canTap,
  onTap,
}: {
  sources: ChakraSource[];
  genericChakraAvailable: number;
  canTap: boolean;
  onTap: (index: number) => void;
}) {
  return (
    <div className="chakra-sources">
      <span className="chakra-sources__label">
        Chakra: {genericChakraAvailable} available
      </span>
      <div className="chakra-sources__boxes">
        {sources.map((source, index) => (
          <button
            key={index}
            type="button"
            className={source.tapped ? 'chakra-source chakra-source--tapped' : 'chakra-source'}
            disabled={source.tapped || !canTap}
            onClick={() => onTap(index)}
            title={source.tapped ? 'Tapped' : 'Tap for 1 Chakra'}
          >
            {source.tapped ? '✓' : '?'}
          </button>
        ))}
      </div>
    </div>
  );
}
