import { useEffect, useRef, useState, type ReactNode } from 'react';

// The Deck Library's "Sort by" and "Filter" buttons: each opens a small panel
// under the button that closes on an outside click or Escape.

function Popover({ label, active, children }: { label: ReactNode; active?: boolean; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="lib-popover" ref={ref}>
      <button type="button" className={`lib-popover__button${active ? ' lib-popover__button--active' : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label} <span aria-hidden>▾</span>
      </button>
      {open && <div className="lib-popover__panel">{children(() => setOpen(false))}</div>}
    </div>
  );
}

export interface Option<K extends string = string> {
  id: K;
  label: string;
}

export function SortMenu<K extends string>({ options, value, onChange }: { options: Option<K>[]; value: K; onChange: (v: K) => void }) {
  const current = options.find((o) => o.id === value)?.label ?? '';
  return (
    <Popover label={`Sort by: ${current}`}>
      {(close) => (
        <div className="lib-sort" role="menu">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="menuitemradio"
              aria-checked={o.id === value}
              className={o.id === value ? 'lib-sort__option lib-sort__option--on' : 'lib-sort__option'}
              onClick={() => {
                onChange(o.id);
                close();
              }}
            >
              {o.id === value ? '✓ ' : ''}
              {o.label}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

export interface FilterGroup {
  id: string;
  label: string;
  options: Option[];
}

/** Checkbox groups (an empty group means "any"), plus an optional "only cards in this deck" toggle. */
export function FilterMenu({
  groups,
  value,
  onChange,
  inDeckOnly,
  onInDeckOnly,
}: {
  groups: FilterGroup[];
  value: Record<string, string[]>;
  onChange: (next: Record<string, string[]>) => void;
  inDeckOnly: boolean;
  onInDeckOnly: (v: boolean) => void;
}) {
  const count = Object.values(value).reduce((n, v) => n + v.length, 0) + (inDeckOnly ? 1 : 0);
  const toggle = (group: string, id: string) => {
    const on = value[group] ?? [];
    onChange({ ...value, [group]: on.includes(id) ? on.filter((x) => x !== id) : [...on, id] });
  };
  return (
    <Popover label={count ? `Filter (${count})` : 'Filter'} active={count > 0}>
      {() => (
        <div className="lib-filter">
          <label className="lib-filter__check lib-filter__check--wide">
            <input type="checkbox" checked={inDeckOnly} onChange={(e) => onInDeckOnly(e.target.checked)} /> Only cards in this deck
          </label>
          {groups.map((g) => (
            <fieldset key={g.id} className="lib-filter__group">
              <legend>{g.label}</legend>
              {g.options.map((o) => (
                <label key={o.id} className="lib-filter__check">
                  <input type="checkbox" checked={(value[g.id] ?? []).includes(o.id)} onChange={() => toggle(g.id, o.id)} /> {o.label}
                </label>
              ))}
            </fieldset>
          ))}
          <button
            type="button"
            className="lib-filter__clear"
            disabled={count === 0}
            onClick={() => {
              onChange(Object.fromEntries(groups.map((g) => [g.id, []])));
              onInDeckOnly(false);
            }}
          >
            Clear filters
          </button>
        </div>
      )}
    </Popover>
  );
}
