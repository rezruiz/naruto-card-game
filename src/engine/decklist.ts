import { CHARACTER_DECK_MANIFEST, getCharacterDeckEntry, listCharacterDeckEntries } from './characters';
import { HAND_DECK_MANIFEST } from './deck';
import { getHandCardDef, getMissionDef, listHandCardDefs } from './cards/registry';
// Side-effect import — every Hand Deck card must be registered before the card pool is listed.
import './cards';
import type { HandCardDef } from './cards/registry';
import type { CharacterDeckEntry } from './characters';

/**
 * A player-built deck (the deck library): both of a player's decks (§2) as
 * card-id → copy counts. Plain JSON, so it can be saved in the browser and
 * sent over the network to the host.
 */
export interface DeckList {
  id: string;
  name: string;
  /** Hand Deck card def id → copies. */
  handDeck: Record<string, number>;
  /** Character Deck entry id → copies (more than 1 only for D Rank). */
  characterDeck: Record<string, number>;
  /** The built-in starter deck — read-only in the library (copy it to edit). */
  preset?: boolean;
}

// SPEC.md §2's deck-construction rules.
export const HAND_DECK_MIN = 50;
export const HAND_DECK_MAX = 80;
export const CHARACTER_DECK_MIN = 12;
export const CHARACTER_DECK_MAX = 18;
export const RANK_CAPS: Partial<Record<CharacterDeckEntry['rank'], number>> = { S: 3, A: 4, B: 4 };

/** How many copies of a card a deck may hold (§2/§10b): 3 for a Hand Deck card (1 for a Unique Mission); 1 for a character (unlimited for D Rank). */
export function copyLimit(kind: 'hand' | 'character', id: string): number {
  if (kind === 'hand') return getMissionDef(id)?.unique ? 1 : 3;
  return getCharacterDeckEntry(id)?.rank === 'D' ? Infinity : 1;
}

/** The deck builder's card pool. */
export function handCardPool(): HandCardDef[] {
  return listHandCardDefs();
}

export function characterPool(): CharacterDeckEntry[] {
  return listCharacterDeckEntries();
}

const sum = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0);

export function handDeckSize(deck: DeckList): number {
  return sum(deck.handDeck);
}

export function characterDeckSize(deck: DeckList): number {
  return sum(deck.characterDeck);
}

/** Every way this deck breaks SPEC.md §2's construction rules (empty = legal). */
export function validateDeck(deck: DeckList): string[] {
  const errors: string[] = [];
  const hand = handDeckSize(deck);
  if (hand < HAND_DECK_MIN || hand > HAND_DECK_MAX) errors.push(`Hand Deck has ${hand} cards — it needs ${HAND_DECK_MIN}–${HAND_DECK_MAX}.`);
  for (const [id, copies] of Object.entries(deck.handDeck)) {
    const def = getHandCardDef(id);
    if (!def) errors.push(`Unknown Hand Deck card: ${id}.`);
    else if (copies > copyLimit('hand', id)) errors.push(`${def.name}: at most ${copyLimit('hand', id)} ${copyLimit('hand', id) === 1 ? 'copy' : 'copies'}.`);
  }

  const chars = characterDeckSize(deck);
  if (chars < CHARACTER_DECK_MIN || chars > CHARACTER_DECK_MAX) errors.push(`Character Deck has ${chars} cards — it needs ${CHARACTER_DECK_MIN}–${CHARACTER_DECK_MAX}.`);
  const byRank: Record<string, number> = {};
  for (const [id, copies] of Object.entries(deck.characterDeck)) {
    const entry = getCharacterDeckEntry(id);
    if (!entry) {
      errors.push(`Unknown character: ${id}.`);
      continue;
    }
    if (copies > copyLimit('character', id)) errors.push(`${entry.name}: only D Rank characters may have more than 1 copy.`);
    byRank[entry.rank] = (byRank[entry.rank] ?? 0) + copies;
  }
  for (const [rank, cap] of Object.entries(RANK_CAPS)) {
    if ((byRank[rank] ?? 0) > cap!) errors.push(`At most ${cap} ${rank} Rank characters (this deck has ${byRank[rank]}).`);
  }
  return errors;
}

/** The deck as the engine builds it: a Hand Deck manifest and a Character Deck list. Unknown ids are dropped. */
export function toManifests(deck: DeckList): { hand: { defId: string; copies: number }[]; characters: string[] } {
  const hand = Object.entries(deck.handDeck)
    .filter(([id, copies]) => copies > 0 && getHandCardDef(id))
    .map(([defId, copies]) => ({ defId, copies }));
  const characters = Object.entries(deck.characterDeck)
    .filter(([id, copies]) => copies > 0 && getCharacterDeckEntry(id))
    .flatMap(([id, copies]) => Array.from({ length: copies }, () => id));
  return { hand, characters };
}

const countsOf = (ids: string[]) => ids.reduce<Record<string, number>>((acc, id) => ({ ...acc, [id]: (acc[id] ?? 0) + 1 }), {});

export const PRESET_DECK_ID = 'preset-akatsuki';

/** The built-in Akatsuki starter deck (the same preset every game used before the library existed). */
export function presetDeck(): DeckList {
  return {
    id: PRESET_DECK_ID,
    name: 'Akatsuki Starter',
    handDeck: Object.fromEntries(HAND_DECK_MANIFEST.map(({ defId, copies }) => [defId, copies])),
    characterDeck: countsOf(CHARACTER_DECK_MANIFEST),
    preset: true,
  };
}
