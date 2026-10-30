import { CARD_TEXT, CHARACTER_TEXT } from './cardText.generated';
import { getTokenDef } from '../engine/characters/registry';
import { listHandCardDefs } from '../engine/cards/registry';
import { VARIANT } from '../variant';

// Character/token defId -> the SPEC.md heading its printed text lives under.
const CHARACTER_HEADINGS: [test: (defId: string) => boolean, heading: string][] = [
  [(d) => d === 'kakuzu', 'Kakuzu'],
  [(d) => d === 'hidan', 'Hidan'],
  [(d) => d === 'deidara' || d === 'clay-spider', 'Deidara'],
  [(d) => d === 'kisame', 'Kisame'],
  [(d) => d === 'itachi', 'Itachi'],
  [(d) => d === 'konan', 'Konan'],
  [(d) => d.startsWith('sasori') || d === 'third-kazekage' || d === 'puppet-soldier', 'Sasori'],
  [(d) => d.includes('zetsu') || d.includes('golem') || d.includes('clone'), 'Zetsu'],
  [(d) => d === 'juzo', 'Juzo Biwa'],
  [(d) => d === 'yahiko', 'Yahiko'],
  [(d) => d === 'amegakure-civilian-rebel', 'Amegakure Civilian Rebel'],
  [(d) => d === 'pain' || d.endsWith('-path') || d === 'war-rhino' || d.startsWith('ku-') || d.startsWith('giant-'), 'Pain of the Six Paths'],
];

const clean = (text: string) =>
  text
    .replace(/\*\*?/g, '')
    .replace(/\s*\(full nuance:\s*design\/CHARACTER_LOG\.md\)\.?/g, '');

/** Prototype wording for character text that differs from SPEC.md's base-game card (applied to the cleaned text). */
const PROTOTYPE_CHARACTER_TEXT: [pattern: RegExp, replacement: string][] = [
  [
    /When Kakuzu enters play, search your Jutsu Deck for\s+Pressure Damage, Searing Migraine and False Darkness and add them to\s+your hand\./,
    'When Kakuzu enters play, add Pressure Damage, Searing Migraine and False Darkness from your Extra Deck to your hand.',
  ],
];

export function getCharacterCardText(defId: string): string | undefined {
  const heading = CHARACTER_HEADINGS.find(([test]) => test(defId))?.[1];
  if (!heading) return undefined;
  const key = Object.keys(CHARACTER_TEXT).find((k) => k.startsWith(heading));
  if (!key) return undefined;
  const text = clean(CHARACTER_TEXT[key]);
  return VARIANT === 'prototype' ? PROTOTYPE_CHARACTER_TEXT.reduce((t, [pattern, replacement]) => t.replace(pattern, replacement), text) : text;
}

/** Splits card text into blocks: each bullet ("- …"), table row ("| …") or paragraph, with its wrapped continuation lines. */
function textBlocks(text: string): string[] {
  const blocks: string[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') {
      blocks.push('');
      continue;
    }
    const startsBlock = trimmed.startsWith('- ') || trimmed.startsWith('|') || blocks.length === 0 || blocks[blocks.length - 1] === '';
    if (startsBlock) blocks.push(trimmed);
    else blocks[blocks.length - 1] += ` ${trimmed}`;
  }
  return blocks.filter((b) => b !== '');
}

/**
 * A token's own printed text only — not its creator's whole card. Pulls
 * the blocks of the parent card's text that are about this token (its own
 * bullet/paragraph, its "<Name>: ability" lines, its row of a stats table),
 * falling back to a summary of its registered abilities when the card text
 * doesn't name it.
 */
export function getTokenCardText(defId: string, tokenName: string): string | undefined {
  // A Shinobi in play shows its card's printed text.
  const card = listHandCardDefs().find((d) => d.id === defId);
  const cardText = card?.shinobi ? getHandCardText(card.name) : undefined;
  if (cardText) return cardText;
  const parent = getCharacterCardText(defId);
  const short = tokenName.replace(/ Path$/, '');
  const matches = parent
    ? textBlocks(parent).filter((block) => {
        const head = block.slice(0, 80);
        if (block.startsWith('|')) return new RegExp(`^\\|\\s*${short}\\s*\\|`).test(block);
        return head.includes(tokenName);
      })
    : [];
  const def = getTokenDef(defId);
  const abilitySummary = def?.abilities.length
    ? def.abilities
        .map((a) => `${a.isUltimate ? '★ ' : ''}${a.name} — ${typeof a.cost === 'number' ? `${a.cost} Chakra` : 'variable cost'} · ${a.speed} · Type: ${a.type}${a.style !== 'None' ? ` · Style: ${a.style}` : ''}`)
        .join('\n')
    : undefined;
  if (matches.length > 0) return matches.join('\n\n');
  return abilitySummary ?? `${tokenName} has no abilities of its own.`;
}

export function getHandCardText(cardName: string): string | undefined {
  const proto = VARIANT === 'prototype' ? listHandCardDefs().find((d) => d.name === cardName)?.prototypeText : undefined;
  if (proto) return proto;
  const text = CARD_TEXT[cardName];
  if (text) return clean(text);
  // Cards whose text isn't in SPEC.md carry it themselves (the Prototype's Equipment).
  return listHandCardDefs().find((d) => d.name === cardName)?.text;
}
