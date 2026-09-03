import type { LogEntry } from '../../engine/types';

export function ActionLog({ log }: { log: LogEntry[] }) {
  return (
    <div className="action-log">
      <h2>Log</h2>
      <ul>
        {log
          .slice()
          .reverse()
          .map((entry) => (
            <li key={entry.id}>{entry.text}</li>
          ))}
      </ul>
    </div>
  );
}
