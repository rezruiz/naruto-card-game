import { getCharacterDeckEntry } from '../../engine/characters';
import { upkeepReminderText } from '../../engine/upkeep';
import type { PlayerId } from '../../engine/types';

export function CharacterRevealPanel({
  player,
  revealed,
  reason,
  taxNote,
  interactive,
  onChoose,
}: {
  player: PlayerId;
  revealed: string[];
  reason: 'setup' | 'reinforcement';
  /** Reinforcement draws: what it will cost to play the chosen card from hand (rank-independent, so one note for the whole panel). */
  taxNote?: string;
  interactive: boolean;
  onChoose: (entryId: string) => void;
}) {
  return (
    <div className="reveal-panel">
      <div className="reveal-panel__title">
        {player.toUpperCase()}: choose {reason === 'setup' ? 'a starting character' : 'a reinforcement'}
      </div>
      {taxNote && <div className="reveal-panel__note">{taxNote}</div>}
      <div className="reveal-panel__options">
        {revealed.map((entryId, i) => {
          const entry = getCharacterDeckEntry(entryId);
          return (
            <div className="reveal-panel__option" key={`${entryId}-${i}`}>
              <button type="button" disabled={!interactive} onClick={() => onChoose(entryId)}>
                {entry ? `${entry.name} (Rank ${entry.rank})` : 'Hidden character'}
              </button>
              {entry && <div className="reveal-panel__upkeep">{upkeepReminderText(entry.rank, reason)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
