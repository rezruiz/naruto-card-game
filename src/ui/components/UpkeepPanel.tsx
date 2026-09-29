import type { UpkeepPreviewEntry } from '../../engine/upkeep';

/**
 * A standing preview of what this player's NEXT Upkeep Phase will do to
 * every character they currently control — public information (Rank,
 * Synergy and Terrain are all visible), so this is shown for both boards,
 * not just "your own." A positive amount is paid from Chakra sources and
 * never touches the generic pool; a "+N" grant (the starting character's
 * C/B-rank bonus) goes straight into that character's own Chakra Pool,
 * where it persists like any pooled Chakra until spent.
 */
export function UpkeepPanel({ entries }: { entries: UpkeepPreviewEntry[] }) {
  if (entries.length === 0) return null;
  const net = entries.reduce((sum, e) => sum + (e.kind === 'grant' ? e.amount : -e.amount), 0);

  return (
    <div className="upkeep-panel">
      <div className="upkeep-panel__title">Next Upkeep</div>
      <ul className="upkeep-panel__list">
        {entries.map((e) => (
          <li key={e.instanceId} className={`upkeep-row upkeep-row--${e.kind}`}>
            <span className="upkeep-row__name">
              {e.name} ({e.rank}
              {e.isStarting ? ', starting' : ''})
            </span>
            <span className="upkeep-row__amount">
              {e.kind === 'grant' && `+${e.amount} → Pool`}
              {e.kind === 'free' && 'Free'}
              {e.kind === 'cost' && `−${e.amount}`}
            </span>
          </li>
        ))}
      </ul>
      <div className="upkeep-panel__net" title="Costs are paid from Chakra sources, not your available Chakra. A positive net is pooled into the granted character's own Pool, where it stays until spent — it is not lost at End Phase like unspent generic Chakra.">
        Net: {net >= 0 ? '+' : ''}
        {net} Chakra
      </div>
    </div>
  );
}
