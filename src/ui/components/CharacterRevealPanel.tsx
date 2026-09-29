import { useState } from 'react';
import { getCharacterDeckEntry } from '../../engine/characters';
import { upkeepReminderText } from '../../engine/upkeep';
import type { PlayerId } from '../../engine/types';

/**
 * A Character Deck reveal (§3's Setup pick, or a §8 Character Deck draw):
 * clicking a card only SELECTS it; each card has its own Details button;
 * nothing is committed until Confirm.
 */
export function CharacterRevealPanel({
  player,
  revealed,
  reason,
  interactive,
  onChoose,
  onOpenDetails,
}: {
  player: PlayerId;
  revealed: string[];
  reason: 'setup' | 'reinforcement';
  interactive: boolean;
  onChoose: (entryId: string) => void;
  onOpenDetails: (entryId: string) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selected = selectedIndex !== null ? revealed[selectedIndex] : undefined;
  const selectedEntry = selected ? getCharacterDeckEntry(selected) : undefined;
  const dRankExtras = revealed.filter((id, i) => i !== selectedIndex && getCharacterDeckEntry(id)?.rank === 'D').length;

  return (
    <div className="reveal-panel">
      <div className="reveal-panel__title">
        {player.toUpperCase()}: choose {reason === 'setup' ? 'a starting character' : 'a character to add to your hand'}
      </div>
      {reason === 'reinforcement' && <div className="reveal-panel__note">Already paid for — playing it from your hand later is free.</div>}
      <div className="reveal-panel__options">
        {revealed.map((entryId, i) => {
          const entry = getCharacterDeckEntry(entryId);
          const isSelected = selectedIndex === i;
          return (
            <div className={`reveal-panel__option${isSelected ? ' reveal-panel__option--selected' : ''}`} key={`${entryId}-${i}`}>
              <button type="button" disabled={!interactive || !entry} aria-pressed={isSelected} onClick={() => setSelectedIndex(i)}>
                {isSelected ? '✓ ' : ''}
                {entry ? `${entry.name} (Rank ${entry.rank})` : 'Hidden character'}
              </button>
              {entry && (
                <button type="button" className="reveal-panel__details" onClick={() => onOpenDetails(entryId)}>
                  Details
                </button>
              )}
              {entry && <div className="reveal-panel__upkeep">{upkeepReminderText(entry.rank, reason)}</div>}
            </div>
          );
        })}
      </div>
      {interactive && (
        <div className="reveal-panel__confirm">
          <button
            type="button"
            className="reveal-panel__confirm-button"
            disabled={!selected}
            onClick={() => {
              if (selected) onChoose(selected);
              setSelectedIndex(null);
            }}
          >
            {selectedEntry ? `Confirm ${selectedEntry.name}` : 'Select a character, then confirm'}
          </button>
          {selected && dRankExtras > 0 && (
            <span className="reveal-panel__note">
              Also keeps {Math.min(2, dRankExtras)} D-rank card(s) from this reveal (§8).
            </span>
          )}
          {reason === 'setup' && <span className="reveal-panel__note">Confirming also keeps your current hand — mulligan first if you want to.</span>}
        </div>
      )}
    </div>
  );
}
