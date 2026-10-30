// A unit's attack (Damage) and defense (Health) as small icons with the number
// laid over them: a dark grey kunai (its blade centred under the number) and a
// shield. The digits are white with a dark outline so they read in light and
// dark themes.

function Kunai() {
  // Drawn pointing up with the blade's widest point at the centre, then tilted so the tip
  // points up and to the right; the grip and ring trail off toward the bottom-left.
  return (
    <g transform="rotate(40 16 16)">
      <path className="stat-icon__blade" d="M16 -1.5 L22.2 15 L16 22 L9.8 15 Z" />
      <rect className="stat-icon__grip" x="14.3" y="22" width="3.4" height="6" rx="0.8" />
      <path className="stat-icon__wrap" d="M14.3 23 L17.7 24.4 M14.3 25.6 L17.7 27" />
      <circle className="stat-icon__ring" cx="16" cy="30.6" r="2.4" />
    </g>
  );
}

function Shield() {
  return <path className="stat-icon__shield" d="M16 2.5 L27 6.5 V15 C27 22.5 22 27.8 16 30 C10 27.8 5 22.5 5 15 V6.5 Z" />;
}

export function StatIcon({
  kind,
  value,
  title,
  hurt = false,
}: {
  kind: 'attack' | 'defense';
  /** What to print: a number, or a buff like "+1". */
  value: number | string;
  title: string;
  /** Defense below its maximum — the number turns red. */
  hurt?: boolean;
}) {
  return (
    <span className={`stat-icon stat-icon--${kind}${hurt ? ' stat-icon--hurt' : ''}`} title={title} aria-label={title}>
      <svg viewBox="0 0 32 32" aria-hidden focusable="false">
        {kind === 'attack' ? <Kunai /> : <Shield />}
      </svg>
      <span className="stat-icon__value" aria-hidden>
        {value}
      </span>
    </span>
  );
}
