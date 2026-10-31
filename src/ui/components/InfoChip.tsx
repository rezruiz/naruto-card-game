import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import type { EffectInfo } from '../effectInfo';

/**
 * Something on a unit's card that has its own text (Equipment, Poison, a status...): clicking it opens that text
 * rather than the unit's details. Without onOpen (a target or enabler is being picked) it's plain, so the click
 * selects the unit. A span, not a button: the cards style every button inside them.
 */
export function InfoChip({
  info,
  onOpen,
  className,
  title,
  children,
}: {
  info: EffectInfo;
  onOpen?: (info: EffectInfo) => void;
  className: string;
  title?: string;
  children: ReactNode;
}) {
  if (!onOpen) {
    return (
      <span className={className} title={title}>
        {children}
      </span>
    );
  }
  const open = (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation();
    onOpen(info);
  };
  return (
    <span
      role="button"
      tabIndex={0}
      className={`${className} info-chip`}
      title={title ?? `What is ${info.name}?`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open(e);
        }
      }}
    >
      {children}
    </span>
  );
}
