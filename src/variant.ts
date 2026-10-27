// Which version of the game this build is. The base game (main branch) and the
// prototype (prototype branch) deploy side by side: the base at the site root,
// the prototype under /prototype/. The deploy workflow builds the prototype with
// VITE_VARIANT=prototype; everything else (local dev, tests) is the base game.

export type Variant = 'base' | 'prototype';

export const VARIANT: Variant = import.meta.env.VITE_VARIANT === 'prototype' ? 'prototype' : 'base';

export const VARIANT_LABEL = VARIANT === 'prototype' ? 'Prototype' : 'Base game';

/** The Prototype calls the Character Deck the Leader Deck (its characters are Leaders). */
export const CHARACTER_DECK_NAME = VARIANT === 'prototype' ? 'Leader Deck' : 'Character Deck';

/** Engine log lines name the Character Deck; the Prototype shows it as the Leader Deck. */
export function variantText(text: string): string {
  return VARIANT === 'prototype' ? text.replace(/Character Deck/g, CHARACTER_DECK_NAME) : text;
}
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
