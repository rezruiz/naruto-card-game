// A unit's attack (Damage) and defense (Health) as small icons with the number
// laid over them: a dark grey shuriken (its broad middle sits under the number)
// and a shield. The digits are white with a dark outline so they read in light
// and dark themes.

function Shuriken() {
  // The Naruto shuriken: an X of four broad blades, each ridged down the middle (one side catches the light), with a hole at the centre.
  return (
    <>
      <path className="stat-icon__shuriken" d="M1.5 1.5 L16 9.5 L30.5 1.5 L22.5 16 L30.5 30.5 L16 22.5 L1.5 30.5 L9.5 16 Z" />
      <path className="stat-icon__shuriken-bevel" d="M16 16 L16 9.5 L30.5 1.5 Z M16 16 L22.5 16 L30.5 30.5 Z M16 16 L16 22.5 L1.5 30.5 Z M16 16 L9.5 16 L1.5 1.5 Z" />
      <circle className="stat-icon__shuriken-hole" cx="16" cy="16" r="2.6" />
    </>
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
        {kind === 'attack' ? <Shuriken /> : <Shield />}
      </svg>
      <span className="stat-icon__value" aria-hidden>
        {value}
      </span>
    </span>
  );
}
