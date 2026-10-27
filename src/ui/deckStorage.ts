import { PRESET_DECK_ID, presetDeck, type DeckList } from '../engine/decklist';
import { STORAGE_PREFIX } from '../variant';

// The deck library lives in this browser's localStorage — decks are per
// device, not synced anywhere. Every read/write is guarded: storage can be
// unavailable (private windows, blocked site data), and the library then
// simply starts from the preset each time.
// The prototype keeps its own decks (variant.ts), so its card changes can't break base-game decks.
const DECKS_KEY = `${STORAGE_PREFIX}decks.v1`;
const SELECTED_KEY = `${STORAGE_PREFIX}selectedDeck.v1`;

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable — the change lasts for this session only.
  }
}

function isDeckList(value: unknown): value is DeckList {
  const d = value as DeckList;
  return !!d && typeof d.id === 'string' && typeof d.name === 'string' && typeof d.handDeck === 'object' && typeof d.characterDeck === 'object';
}

/** The player's saved decks, after the built-in preset (which is always first and never stored). */
export function loadDecks(): DeckList[] {
  const saved = readJson<unknown[]>(DECKS_KEY);
  const custom = Array.isArray(saved) ? saved.filter(isDeckList).filter((d) => d.id !== PRESET_DECK_ID) : [];
  return [presetDeck(), ...custom.map((d) => ({ ...d, preset: false }))];
}

export function saveDecks(decks: DeckList[]): void {
  writeJson(
    DECKS_KEY,
    decks.filter((d) => !d.preset),
  );
}

export function loadSelectedDeckId(key = 'p1'): string {
  return readJson<Record<string, string>>(SELECTED_KEY)?.[key] ?? PRESET_DECK_ID;
}

export function saveSelectedDeckId(id: string, key = 'p1'): void {
  writeJson(SELECTED_KEY, { ...(readJson<Record<string, string>>(SELECTED_KEY) ?? {}), [key]: id });
}

let deckCounter = 0;

export function newDeckId(): string {
  deckCounter += 1;
  return `deck-${Date.now().toString(36)}-${deckCounter}`;
}
