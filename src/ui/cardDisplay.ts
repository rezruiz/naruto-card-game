import { getCharacterDef, getTokenDef, type CharacterDeckEntry } from '../engine/characters';
import { paysInChakra, type HandCardDef } from '../engine/cards/registry';
import { VARIANT } from '../variant';
import { getHandCardText } from './cardInfo';
import './cardStyles.css';

// Shared card-face helpers for anywhere a card is drawn as a card (the deck
// library's collection, the hand): its cost gem, type line and one-line text.

const STYLE_COLOR: Record<string, string> = { Water: 'water', Earth: 'earth', Fire: 'fire', Lightning: 'lightning', Wind: 'wind', Genjutsu: 'genjutsu', Physical: 'physical', Shinobi: 'shinobi' };

/**
 * The Style a card is shown under in the UI (color coding, the Deck Library's Style sections and filter).
 * Genjutsu cards count as their own "Genjutsu" Style here, and Physical ones (Taijutsu and Bukijutsu — the
 * §6.8 Physical umbrella) as "Physical", whatever their printed Style; display only, the rules (e.g. who can
 * enable a card) still use def.style.
 */
export function displayStyle(def: Pick<HandCardDef, 'style' | 'type'> & { cardType?: HandCardDef['cardType'] }): string {
  if (def.cardType === 'shinobi') return 'Shinobi';
  if (def.type === 'Genjutsu') return 'Genjutsu';
  if (def.type === 'Taijutsu' || def.type === 'Bukijutsu') return 'Physical';
  return def.style;
}

/** The card's color-coding class (cardStyles.css): its Style's color, light purple for any other (unique/kekkei genkai) Style, neutral for none. */
export function styleClass(style: string): string {
  return `card-style card-style--${style === 'None' ? 'none' : (STYLE_COLOR[style] ?? 'unique')}`;
}

/** Character cards are white. */
export const CHARACTER_STYLE_CLASS = 'card-style card-style--character';

export const RANK_ORDER = ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D'];
export const TYPE_LABEL: Record<HandCardDef['cardType'], string> = { jutsu: 'Jutsu', assist: 'Assist', mission: 'Mission', terrain: 'Terrain', shinobi: 'Shinobi', equipment: 'Equipment' };

/** The printed Chakra cost, read from the card text (costs can depend on how they're paid, so the def's cost may be a function). */
export function handCardCost(def: HandCardDef): string {
  const text = getHandCardText(def.name) ?? '';
  const m = /Cost:\s*(\d+)/.exec(text) ?? /(\d+)\s*Chakra/.exec(text);
  if (m) return m[1];
  return typeof def.cost === 'number' ? String(def.cost) : '?';
}

/**
 * What pays this card's cost: Chakra (a round gem in the card's Style colour) or, in the Prototype, Supplies
 * (an amber square token) — so the two read differently at a glance.
 */
export function costResource(def: HandCardDef): 'chakra' | 'supplies' {
  return VARIANT === 'prototype' && !paysInChakra(def) ? 'supplies' : 'chakra';
}

/** The cost gem's extra class and tooltip, e.g. for "hand-card__gem": `hand-card__gem--supplies` and "3 Supplies". */
export function costGem(def: HandCardDef, base: string): { className: string; title: string } {
  const resource = costResource(def);
  const cost = handCardCost(def);
  return {
    className: resource === 'supplies' ? `${base} ${base}--supplies` : base,
    title: resource === 'supplies' ? `Costs ${cost} ${cost === '1' ? 'Supply' : 'Supplies'}` : `Costs ${cost} Chakra`,
  };
}

/** One line of what the card does on its face: its Effect, or a Mission's Condition — never its cost, which the cost gem already shows. */
export function handCardSummary(def: HandCardDef): string {
  // A Shinobi with abilities lists them by short name (no "Water Release:"), to fit the face; the details view has the full text.
  const unit = def.shinobi ? getTokenDef(def.id) : undefined;
  if (unit) return unit.abilities.map((a) => a.name.replace(/^\w+ Release: /, '')).join(' · ');
  const lines = (getHandCardText(def.name) ?? '').split('\n').map((l) => l.trim());
  const pick = (prefix: string) => {
    const i = lines.findIndex((l) => l.startsWith(prefix));
    if (i === -1) return null;
    const rest: string[] = [lines[i].slice(prefix.length).trim()];
    for (let j = i + 1; j < lines.length && lines[j] && !/^[A-Z][a-z]+:/.test(lines[j]); j++) rest.push(lines[j]);
    return rest.join(' ');
  };
  // The card face leaves out what it already shows: the cost (the gem at the top) and a Shinobi's
  // Damage and Health (the stat icons). The full text in the details view still has them.
  const face = lines.slice(1).filter((l) => l && !/^Cost:/.test(l) && !(def.shinobi && /^Damage \d+ · Health \d+\.?$/.test(l)));
  return pick('Effect:') ?? pick('Condition:') ?? face.join(' ');
}

export function handCardSubtitle(def: HandCardDef): string {
  const parts = [TYPE_LABEL[def.cardType]];
  if (def.shinobi?.rank) parts.push(`${def.shinobi.rank} Rank`);
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
