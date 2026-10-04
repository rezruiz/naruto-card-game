import { useState } from 'react';
import type { PendingChoice } from '../../engine/types';
import { getHandCardText } from '../cardInfo';

/** A decision the engine is waiting on (PendingChoice) — pick between `min` and `max` options, then confirm. Read-only for anyone but the choosing player. */
export function ChoicePanel({ choice, interactive, onResolve }: { choice: PendingChoice; interactive: boolean; onResolve: (optionIds: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  /** An option that names a card (e.g. a look-at-the-top pick) can show that card's full text. */
  const [openId, setOpenId] = useState<string | null>(null);
  const single = choice.max === 1;
  const toggle = (id: string) =>
    setSelected((prev) => (single ? [id] : prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < choice.max ? [...prev, id] : prev));
  const ok = selected.length >= choice.min && selected.length <= choice.max;

  return (
    <div className="choice-panel">
      <div className="choice-panel__title">
        {choice.player.toUpperCase()} to choose: {choice.prompt}
      </div>
      {interactive ? (
        <>
          <div className="choice-panel__options">
            {choice.options.map((o) => {
              const isSelected = selected.includes(o.id);
              const cardText = getHandCardText(o.label);
              return (
                <div key={o.id} className="choice-panel__option">
                  <button type="button" aria-pressed={isSelected} className={isSelected ? 'choice-panel__option--selected' : undefined} onClick={() => toggle(o.id)}>
                    {isSelected ? '✓ ' : ''}
                    {o.label}
                  </button>
                  {cardText && (
                    <button type="button" className="choice-panel__details" aria-expanded={openId === o.id} onClick={() => setOpenId((id) => (id === o.id ? null : o.id))}>
                      {openId === o.id ? 'Hide details' : 'Details'}
                    </button>
                  )}
                  {cardText && openId === o.id && <div className="choice-panel__card-text">{cardText}</div>}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="choice-panel__confirm"
            disabled={!ok}
            onClick={() => {
              onResolve(selected);
              setSelected([]);
            }}
          >
            Confirm{choice.max > 1 ? ` (${selected.length} selected)` : ''}
          </button>
        </>
      ) : (
        <span className="choice-panel__waiting">Waiting for {choice.player.toUpperCase()}…</span>
      )}
    </div>
  );
}
