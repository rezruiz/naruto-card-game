import { useState } from 'react';
import { handEntryName } from '../../engine/handReveal';
import type { HandEntry, PlayerId } from '../../engine/types';

/** Field Intelligence: the revealing player picks exactly `count` of their own hand cards to show the opponent. */
export function HandRevealPanel({
  hand,
  count,
  requestedBy,
  onReveal,
}: {
  hand: HandEntry[];
  count: number;
  requestedBy: PlayerId;
  onReveal: (instanceIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const needed = Math.min(count, hand.length);
  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < needed ? [...prev, id] : prev));

  return (
    <div className="reveal-panel">
      <div className="reveal-panel__title">
        Field Intelligence: reveal {needed} card(s) of your choice to {requestedBy.toUpperCase()}
      </div>
      <div className="reveal-panel__options">
        {hand.map((entry) => {
          const isSelected = selected.includes(entry.instanceId);
          return (
            <div className={`reveal-panel__option${isSelected ? ' reveal-panel__option--selected' : ''}`} key={entry.instanceId}>
              <button type="button" aria-pressed={isSelected} onClick={() => toggle(entry.instanceId)}>
                {isSelected ? '✓ ' : ''}
                {handEntryName(entry)}
              </button>
            </div>
          );
        })}
      </div>
      <div className="reveal-panel__confirm">
        <button
          type="button"
          className="reveal-panel__confirm-button"
          disabled={selected.length !== needed}
          onClick={() => {
            onReveal(selected);
            setSelected([]);
          }}
        >
          Reveal {selected.length}/{needed}
        </button>
      </div>
    </div>
  );
}
