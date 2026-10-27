// Which version of the game this build is. The base game (main branch) and the
// prototype (prototype branch) deploy side by side: the base at the site root,
// the prototype under /prototype/. The deploy workflow builds the prototype with
// VITE_VARIANT=prototype; everything else (local dev, tests) is the base game.

export type Variant = 'base' | 'prototype';

export const VARIANT: Variant = import.meta.env.VITE_VARIANT === 'prototype' ? 'prototype' : 'base';

export const VARIANT_LABEL = VARIANT === 'prototype' ? 'Prototype' : 'Base game';
export const OTHER_VARIANT_LABEL = VARIANT === 'prototype' ? 'Base game' : 'Prototype';

/** The other version's URL on the same site. */
export function otherVariantUrl(): string {
  const base = import.meta.env.BASE_URL;
  return VARIANT === 'prototype' ? base.replace(/prototype\/$/, '') : `${base}prototype/`;
}

/** Prefix for browser storage keys, so the two versions never share saved decks. */
export const STORAGE_PREFIX = VARIANT === 'prototype' ? 'ncg-proto.' : 'ncg.';

/** Prefix for online room IDs, so a base-game player can't join a prototype game (or the reverse). */
export const PEER_PREFIX = VARIANT === 'prototype' ? 'naruto-ccg-proto-' : 'naruto-ccg-';

/** What a new game is created with: the Prototype build plays the prototype rules (engine/prototype.ts). */
export const RULESET_OPTS: { ruleset?: 'prototype' } = VARIANT === 'prototype' ? { ruleset: 'prototype' } : {};
