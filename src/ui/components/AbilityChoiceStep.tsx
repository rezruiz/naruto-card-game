import { useState } from 'react';
import type { ChoiceSpec } from '../../engine/abilities';

/** One of an ability's optional choices (Yes/No, a number, or one of several options), asked before it's activated/declared. */
export function AbilityChoiceStep({
  spec,
  onAnswer,
  onCancel,
}: {
  spec: ChoiceSpec;
  onAnswer: (value: boolean | number | string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(spec.kind === 'number' ? spec.min : 0);
  const cancel = (
    <button type="button" onClick={onCancel}>
      Cancel
    </button>
  );

  if (spec.kind === 'yesno') {
    return (
      <>
        <span>{spec.prompt}</span>
        <span>
          <button type="button" onClick={() => onAnswer(true)}>
            Yes
          </button>
          <button type="button" onClick={() => onAnswer(false)}>
            No
          </button>
          {cancel}
        </span>
      </>
    );
  }

  if (spec.kind === 'number') {
    return (
      <>
        <span>
          {spec.prompt}: <strong>{value}</strong> ({spec.min}–{spec.max})
        </span>
        <span>
          <button type="button" disabled={value <= spec.min} onClick={() => setValue((v) => Math.max(spec.min, v - 1))}>
            −
          </button>
          <button type="button" disabled={value >= spec.max} onClick={() => setValue((v) => Math.min(spec.max, v + 1))}>
            +
          </button>
          <button type="button" onClick={() => onAnswer(value)}>
            Confirm
          </button>
          {cancel}
        </span>
      </>
    );
  }

  return (
    <>
      <span>{spec.prompt}</span>
      <span>
        {spec.options.map((o) => (
          <button type="button" key={o.id} onClick={() => onAnswer(o.id)}>
            {o.label}
          </button>
        ))}
        {cancel}
      </span>
    </>
  );
}
