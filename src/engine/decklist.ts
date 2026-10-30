import { CHARACTER_DECK_MANIFEST, getCharacterDeckEntry, listCharacterDeckEntries } from './characters';
import { HAND_DECK_MANIFEST } from './deck';
import { PROTOTYPE_SHINOBI_MANIFEST } from './shinobi';
import { PROTOTYPE_TERRAIN_MANIFEST } from './cards/terrain';
import { VARIANT } from '../variant';
import { NOT_LEADERS } from './prototype';
import { getHandCardDef, getMissionDef, listHandCardDefs } from './cards/registry';
// Side-effect import — every Jutsu Deck card must be registered before the card pool is listed.
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
  /** Jutsu Deck card def id → copies. */
  handDeck: Record<string, number>;
  /** Character Deck entry id → copies (more than 1 only for D Rank). */
  characterDeck: Record<string, number>;
  /** Prototype: Extra Deck card def id → copies (cards pulled out by effects, never drawn). Missing on older saved decks. */
  extraDeck?: Record<string, number>;
  /** The built-in starter deck — read-only in the library (copy it to edit). */
  preset?: boolean;
}

const PROTOTYPE = VARIANT === 'prototype';

// SPEC.md §2's deck-construction rules. The Prototype's Main Deck needs at least 60 cards (PT tab of the design doc).
export const HAND_DECK_MIN = PROTOTYPE ? 60 : 50;
export const HAND_DECK_MAX = 80;
// The Prototype build builds Character Decks by budget instead (PT tab of the design doc):
// each character costs points by Rank, a deck spends at most PT_CHARACTER_BUDGET, holds at
// most 8 characters and 3 S-Ranks, and there are no D-Rank characters.
export const CHARACTER_DECK_MIN = PROTOTYPE ? 1 : 10;
export const CHARACTER_DECK_MAX = PROTOTYPE ? 8 : 15;
export const RANK_CAPS: Partial<Record<CharacterDeckEntry['rank'], number>> = PROTOTYPE ? { S: 3 } : { S: 3, A: 4 };
export const PT_CHARACTER_BUDGET = 50;
export const PT_CHARACTER_COST: Partial<Record<CharacterDeckEntry['rank'], number>> = { S: 10, A: 8, B: 6, C: 4 };

/** Prototype: what this Character Deck spends of the budget. */
export function characterDeckCost(deck: DeckList): number {
  return Object.entries(deck.characterDeck).reduce((total, [id, copies]) => total + (PT_CHARACTER_COST[getCharacterDeckEntry(id)?.rank ?? 'D'] ?? 0) * copies, 0);
}

/** How many copies of a card a deck may hold (§2/§10b): 3 for a Jutsu Deck card (1 for a Unique Mission); 1 for a character (unlimited for D Rank). */
export function copyLimit(kind: 'hand' | 'character', id: string): number {
  // Prototype: every Terrain is Unique.
  if (kind === 'hand') return getMissionDef(id)?.unique || getHandCardDef(id)?.unique || (VARIANT === 'prototype' && getHandCardDef(id)?.cardType === 'terrain') ? 1 : 3;
  return getCharacterDeckEntry(id)?.rank === 'D' ? Infinity : 1;
}

/** Where the Prototype's starter deck differs from the base preset's copy counts (0 = left out; still in the Deck Library). */
const PT_STARTER_COPIES: Record<string, number> = {
  // Kakuzu's mask techniques live in the Extra Deck instead (PROTOTYPE_EXTRA_MANIFEST).
  'jutsu-pressure-damage': 0,
  'jutsu-searing-migraine': 0,
  'jutsu-false-darkness': 0,
  // All 3 Crow Clones (the copy limit) are in the Extra Deck.
  'jutsu-crow-clone': 0,
  'squad-formation': 0,
  'bingo-book-c': 0,
  'jutsu-mind-prison': 0,
  'smoke-out': 0,
  'kunai-deflection': 0,
  'battlefield-selection': 2,
  'medical-chakra-infusion': 2,
};

/** The Prototype's starter Main Deck: the base preset (minus its Terrain, with PT_STARTER_COPIES applied), plus Shinobi, 2 Medical Pouches, 2 Chakra Storage Scrolls and 1 each of five Terrain. The other Equipment is in the Deck Library only. */
export const PROTOTYPE_HAND_MANIFEST: { defId: string; copies: number }[] = [
  ...HAND_DECK_MANIFEST.filter((e) => getHandCardDef(e.defId)?.cardType !== 'terrain')
    .map((e) => ({ ...e, copies: PT_STARTER_COPIES[e.defId] ?? e.copies }))
    .filter((e) => e.copies > 0),
  ...PROTOTYPE_SHINOBI_MANIFEST,
  { defId: 'equip-medical-pouch', copies: 2 },
  { defId: 'equip-chakra-scroll', copies: 2 },
  ...PROTOTYPE_TERRAIN_MANIFEST,
];

/** The Prototype's starter Extra Deck: Kakuzu's three mask techniques (his Heart Masks pulls them out) and 3 Genjutsu: Crow Clone (Itachi's Summoning: Crow Substitution). */
export const PROTOTYPE_EXTRA_MANIFEST: { defId: string; copies: number }[] = [
  ...['jutsu-pressure-damage', 'jutsu-searing-migraine', 'jutsu-false-darkness'].map((defId) => ({ defId, copies: 1 })),
  { defId: 'jutsu-crow-clone', copies: 3 },
];

/** The Prototype's starter Leader Deck: the full 50-point budget (S 10 + 10, A 8 + 8 + 8, B 6). */
export const PROTOTYPE_LEADER_MANIFEST = ['itachi', 'kisame', 'sasori-hiruko', 'deidara', 'kakuzu', 'hidan'];

/** The deck builder's card pool. */
export function handCardPool(): HandCardDef[] {
  return listHandCardDefs();
}

export function characterPool(): CharacterDeckEntry[] {
  // The Prototype's Leader Deck holds only Leaders — the Rebel is a Shinobi in the main deck there.
  return VARIANT === 'prototype' ? listCharacterDeckEntries().filter((e) => !NOT_LEADERS.has(e.id)) : listCharacterDeckEntries();
}

const sum = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0);

export function handDeckSize(deck: DeckList): number {
  return sum(deck.handDeck);
}

/** Prototype: the Extra Deck holds at most this many cards. */
export const EXTRA_DECK_MAX = 15;

/** Prototype: how many cards are in the Extra Deck. */
export function extraDeckSize(deck: DeckList): number {
  return sum(deck.extraDeck ?? {});
}

export function characterDeckSize(deck: DeckList): number {
  return sum(deck.characterDeck);
}

/** Every way this deck breaks SPEC.md §2's construction rules (empty = legal). */
export function validateDeck(deck: DeckList): string[] {
  const errors: string[] = [];
  const hand = handDeckSize(deck);
  if (hand < HAND_DECK_MIN || hand > HAND_DECK_MAX) errors.push(`Jutsu Deck has ${hand} cards — it needs ${HAND_DECK_MIN}–${HAND_DECK_MAX}.`);
  // The copy limit counts a card's copies in the Main Deck and the Extra Deck together.
  const extra = deck.extraDeck ?? {};
  for (const id of new Set([...Object.keys(deck.handDeck), ...Object.keys(extra)])) {
    const copies = (deck.handDeck[id] ?? 0) + (extra[id] ?? 0);
    const def = getHandCardDef(id);
    if (!def) errors.push(`Unknown Jutsu Deck card: ${id}.`);
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
    if (VARIANT === 'prototype' && NOT_LEADERS.has(id) && copies > 0) {
      errors.push(`${entry.name} isn't a Leader — it's a Shinobi in the main deck now.`);
      continue;
    }
    if (copies > copyLimit('character', id)) errors.push(`${entry.name}: only D Rank characters may have more than 1 copy.`);
    byRank[entry.rank] = (byRank[entry.rank] ?? 0) + copies;
  }
  for (const [rank, cap] of Object.entries(RANK_CAPS)) {
    if ((byRank[rank] ?? 0) > cap!) errors.push(`At most ${cap} ${rank} Rank characters (this deck has ${byRank[rank]}).`);
  }
  if (PROTOTYPE) {
    if (byRank.D) errors.push('No D Rank characters in the Prototype — every character is C Rank or higher.');
    if (extraDeckSize(deck) > EXTRA_DECK_MAX) errors.push(`Extra Deck has ${extraDeckSize(deck)} cards — at most ${EXTRA_DECK_MAX}.`);
    const cost = characterDeckCost(deck);
    if (cost > PT_CHARACTER_BUDGET) errors.push(`Character Deck costs ${cost} — the budget is ${PT_CHARACTER_BUDGET} (S 10, A 8, B 6, C 4).`);
  }
  return errors;
}

/** The deck as the engine builds it: a Jutsu Deck manifest and a Character Deck list. Unknown ids are dropped. */
export function toManifests(deck: DeckList): { hand: { defId: string; copies: number }[]; extra: { defId: string; copies: number }[]; characters: string[] } {
  const manifest = (counts: Record<string, number>) =>
    Object.entries(counts)
      .filter(([id, copies]) => copies > 0 && getHandCardDef(id))
      .map(([defId, copies]) => ({ defId, copies }));
  const hand = manifest(deck.handDeck);
  const extra = manifest(deck.extraDeck ?? {});
  const characters = Object.entries(deck.characterDeck)
    .filter(([id, copies]) => copies > 0 && getCharacterDeckEntry(id))
    .flatMap(([id, copies]) => Array.from({ length: copies }, () => id));
  return { hand, extra, characters };
}

const countsOf = (ids: string[]) => ids.reduce<Record<string, number>>((acc, id) => ({ ...acc, [id]: (acc[id] ?? 0) + 1 }), {});

export const PRESET_DECK_ID = 'preset-akatsuki';

/** The built-in Akatsuki starter deck (the same preset every game used before the library existed). */
export function presetDeck(): DeckList {
  return {
    id: PRESET_DECK_ID,
    name: 'Akatsuki Starter',
    // The Prototype build's starter deck also carries the placeholder Shinobi (shinobi.ts).
    handDeck: Object.fromEntries((VARIANT === 'prototype' ? PROTOTYPE_HAND_MANIFEST : HAND_DECK_MANIFEST).map(({ defId, copies }) => [defId, copies])),
    characterDeck: countsOf(VARIANT === 'prototype' ? PROTOTYPE_LEADER_MANIFEST : CHARACTER_DECK_MANIFEST),
    ...(VARIANT === 'prototype' ? { extraDeck: Object.fromEntries(PROTOTYPE_EXTRA_MANIFEST.map(({ defId, copies }) => [defId, copies])) } : {}),
    preset: true,
  };
}
