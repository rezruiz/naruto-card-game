import { getCharacterDef, type CharacterDeckEntry } from '../engine/characters';
import type { HandCardDef } from '../engine/cards/registry';
import { getHandCardText } from './cardInfo';
import './cardStyles.css';

// Shared card-face helpers for anywhere a card is drawn as a card (the deck
// library's collection, the hand): its cost gem, type line and one-line text.

const STYLE_COLOR: Record<string, string> = { Water: 'water', Earth: 'earth', Fire: 'fire', Lightning: 'lightning', Wind: 'wind', Genjutsu: 'genjutsu', Taijutsu: 'taijutsu' };

/**
 * The Style a card is shown under in the UI (color coding, the Deck Library's Style sections and filter).
 * Genjutsu and Taijutsu cards count as their own "Genjutsu" / "Taijutsu" Style here, whatever their printed
 * Style; display only, the rules (e.g. who can enable a card) still use def.style.
 */
export function displayStyle(def: Pick<HandCardDef, 'style' | 'type'>): string {
  return def.type === 'Genjutsu' || def.type === 'Taijutsu' ? def.type : def.style;
}

/** The card's color-coding class (cardStyles.css): its Style's color, light purple for any other (unique/kekkei genkai) Style, neutral for none. */
export function styleClass(style: string): string {
  return `card-style card-style--${style === 'None' ? 'none' : (STYLE_COLOR[style] ?? 'unique')}`;
}

/** Character cards are white. */
export const CHARACTER_STYLE_CLASS = 'card-style card-style--character';

export const RANK_ORDER = ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D'];
export const TYPE_LABEL: Record<HandCardDef['cardType'], string> = { jutsu: 'Jutsu', assist: 'Assist', mission: 'Mission', terrain: 'Terrain' };

/** The printed Chakra cost, read from the card text (costs can depend on how they're paid, so the def's cost may be a function). */
export function handCardCost(def: HandCardDef): string {
  const text = getHandCardText(def.name) ?? '';
  const m = /Cost:\s*(\d+)/.exec(text) ?? /(\d+)\s*Chakra/.exec(text);
  if (m) return m[1];
  return typeof def.cost === 'number' ? String(def.cost) : '?';
}

/** One line of what the card does: its Effect, or a Mission's Condition. */
export function handCardSummary(def: HandCardDef): string {
  const lines = (getHandCardText(def.name) ?? '').split('\n').map((l) => l.trim());
  const pick = (prefix: string) => {
    const i = lines.findIndex((l) => l.startsWith(prefix));
    if (i === -1) return null;
    const rest: string[] = [lines[i].slice(prefix.length).trim()];
    for (let j = i + 1; j < lines.length && lines[j] && !/^[A-Z][a-z]+:/.test(lines[j]); j++) rest.push(lines[j]);
    return rest.join(' ');
  };
  return pick('Effect:') ?? pick('Condition:') ?? lines.slice(1).join(' ');
}

export function handCardSubtitle(def: HandCardDef): string {
  const parts = [TYPE_LABEL[def.cardType]];
  if (def.style !== 'None') parts.push(def.style);
  if (def.type !== 'None') parts.push(def.type);
  if (def.speed !== 'Normal') parts.push(def.speed);
  return parts.join(' · ');
}

export interface CharacterInfo {
  hp: string;
  styles: string;
}

export function characterInfo(entry: CharacterDeckEntry): CharacterInfo {
  const def = getCharacterDef(entry.id);
  if (!def) return { hp: '', styles: entry.id === 'pain' ? 'Enters as 6 Path tokens' : '' };
  const styles = def.styles.filter((s) => s !== 'None');
  return { hp: String(def.baseMaxHP), styles: styles.length ? styles.join(', ') : 'No Style' };
}

export const byRank = (a: CharacterDeckEntry, b: CharacterDeckEntry) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank) || a.name.localeCompare(b.name);
export const byCost = (a: HandCardDef, b: HandCardDef) => Number(handCardCost(a)) - Number(handCardCost(b)) || a.name.localeCompare(b.name);
