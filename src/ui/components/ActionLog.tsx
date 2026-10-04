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
            <li key={entry.id} className={entry.warning ? 'action-log__warning' : undefined}>
              {entry.warning ? '⚠ ' : ''}
              {entry.text}
            </li>
          ))}
      </ul>
    </div>
  );
}
