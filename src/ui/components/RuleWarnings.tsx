import { useState } from 'react';
import type { LogEntry } from '../../engine/types';

/**
 * Trust mode lets actions through that the strict rules would refuse; this
 * banner makes each one impossible to miss (the log alone was too quiet).
 * Shows the warnings logged since the player last dismissed them.
 */
export function RuleWarnings({ log }: { log: LogEntry[] }) {
  const [dismissedThrough, setDismissedThrough] = useState(-1);
  const fresh = log.map((entry, index) => ({ entry, index })).filter(({ entry, index }) => entry.warning && index > dismissedThrough);
  if (fresh.length === 0) return null;
  return (
    <div className="rule-warnings" role="alert">
      <div className="rule-warnings__title">⚠ Not legal under the strict rules</div>
      <ul>
        {fresh.slice(-4).map(({ entry }) => (
          <li key={entry.id}>{entry.text.replace(/\s*[—(]*\s*(not legal under the strict rules[^)]*|allowed anyway \(trust mode\)|trust mode[^)]*)\)?\.?$/i, '')}</li>
        ))}
      </ul>
      {fresh.length > 4 && <div className="rule-warnings__more">+{fresh.length - 4} earlier — see the log</div>}
      <button type="button" onClick={() => setDismissedThrough(log.length - 1)}>
        Dismiss
      </button>
    </div>
  );
}
