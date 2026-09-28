import { CARD_TEXT, CHARACTER_TEXT } from './cardText.generated';

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

export function getCharacterCardText(defId: string): string | undefined {
  const heading = CHARACTER_HEADINGS.find(([test]) => test(defId))?.[1];
  if (!heading) return undefined;
  const key = Object.keys(CHARACTER_TEXT).find((k) => k.startsWith(heading));
  return key ? clean(CHARACTER_TEXT[key]) : undefined;
}

export function getHandCardText(cardName: string): string | undefined {
  const text = CARD_TEXT[cardName];
  return text ? clean(text) : undefined;
}
