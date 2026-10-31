import type { TrackedItem } from '../engine/characters/progressText';
import { abilityTextById, traitLines } from './abilityText';
import { getHandCardText } from './cardInfo';

/** What a clicked effect on a unit (Equipment, Poison, a status...) shows: its own text, not the unit's card. */
export interface EffectInfo {
  name: string;
  subtitle: string;
  text?: string;
}

export const FIELD_ORIENTATION_TEXT = "It entered play this turn, so it can't use damage-dealing abilities until its controller's next turn. Non-damaging abilities are fine.";

/** A tracked effect's rules: written here, or taken from the ability, card or trait it comes from so the wording can't drift. */
type Source = string | { ability: string } | { card: string } | { trait: string; name: string };

const TRACKED_EFFECTS: Record<string, Source> = {
  'Clay Charges': "Deidara's resource. C1 gains 1, Detonation Art can spend 1, Combine gains 2, C2 spends 5, C3 spends 2 and Death is an Explosion can spend up to 3 for +1 damage each.",
  Airborne: "Enemy Shinobi attacks, Taijutsu and Bukijutsu can't target this unit. Ninjutsu, Genjutsu and untargeted effects still can. It stays Airborne while it's in play, and Deidara gains 1 Clay Charge at each of your Upkeeps.",
  'Death is an Explosion': { ability: 'death-is-an-explosion-v2' },
  Hearts: { trait: 'kakuzu', name: 'Five Hearts' },
  'Cursed target': { ability: 'curse-technique' },
  'Crow Clone': { card: 'Genjutsu: Crow Clone' },
  'Amaterasu burning': { ability: 'amaterasu' },
  'Absorbed Chakra': 'The total Chakra Samehada has absorbed. At 10, Kisame can enter his Shark Transformation.',
  'Shark transformation': { ability: 'samehada-shark-transformation' },
  'Shikigami Charges': "Konan's resource. Fold Shikigami gains 1, and Paper Bomb Tag can spend 1 to deal 5 instead of 3.",
  'Paper Person of God': { ability: 'paper-person-of-god-technique' },
  Mode: { ability: 'dual-nature-switch' },
  'Shared Pool': "This unit's abilities are paid from another unit's Chakra Pool.",
  "Can't negate damage to itself": { ability: 'spore-technique' },
  'Taijutsu locked': { ability: 'spore-technique' },
  'Almighty Push': { ability: 'almighty-push' },
  "King of Hell's pending effects": { ability: 'king-of-hells-judgment' },
  'Squad Formation group': { card: 'Squad Formation' },
  Poison: "At the start of every Upkeep Phase, not just its controller's, it loses 1 Poison counter and takes 1 damage. This damage can't be prevented or healed away.",
  'Chakra Spore': { ability: 'golem-strike' },
  'Scheduled heals': 'Heals waiting to happen at upcoming Upkeeps, shown as the amount × the Upkeeps left.',
  'Damage prevention': 'Damage this unit takes this turn is prevented, up to this amount.',
  'Added Weight': { card: 'Earth Style: Added Weight Rock Technique' },
  "Can't Retreat": { card: 'Earth Style: Earth Flow River' },
  "Can't be pooled into": { card: 'Chakra Suppression' },
  Stunned: "It can't use abilities, enable a Jutsu, be pooled into or Retreat.",
  "Can't use targeted abilities": { ability: 'water-prison-jutsu' },
  Evasive: 'An attack on this unit may miss on a lost coin flip.',
  'Rallying Words': { ability: 'rallying-words' },
  'Rain Shield': { ability: 'rain-shield' },
  'Pillar Encirclement': { ability: 'pillar-encirclement' },
  'Hiding Like a Mole': { card: 'Earth Style: Hiding Like a Mole Technique' },
  Damage: 'How much damage this Shinobi deals when it attacks or defends.',
  "Kakuzu's revival": 'Hidan would be defeated. Kakuzu may spend his full Chakra Pool and stun himself to revive Hidan at 3 HP.',
  'Defeated a character': { ability: 'patchwork-threads' },
  'Iron Skin': { ability: 'iron-skin' },
  'Beast cooldowns': "A defeated Path Beast can't be summoned again until its cooldown runs out.",
  Locked: { ability: 'almighty-push' },
  'Abilities locked': "This unit can't use abilities until the turn shown.",
  "Banshō Ten'in": { ability: 'bansho-tennin' },
  'Next ability': "This unit's next ability costs less, from a Bingo Book Mission.",
};

/** The labels with their own text — the guard test checks every tracked effect shown on a card is covered. */
export const TRACKED_EFFECT_LABELS = new Set(Object.keys(TRACKED_EFFECTS));

function sourceText(source: Source): string | undefined {
  if (typeof source === 'string') return source;
  if ('ability' in source) return abilityTextById(source.ability);
  if ('card' in source) return getHandCardText(source.card);
  return traitLines(source.trait).find((line) => line.startsWith(source.name));
}

export function trackedInfo(item: TrackedItem, unitName: string): EffectInfo {
  const source = TRACKED_EFFECTS[item.label];
  return { name: item.label, subtitle: `${unitName}: ${item.value}`, text: (source && sourceText(source)) || item.value };
}

export function statusInfo(status: 'Retreated' | 'Disabled' | 'Field Orientation', unitName: string): EffectInfo {
  const text = {
    Retreated: "It can't be targeted or damaged, and it can't act until it returns from Retreat.",
    Disabled: "It can't use abilities or enable a Jutsu, and its triggered passives don't trigger.",
    'Field Orientation': FIELD_ORIENTATION_TEXT,
  }[status];
  return { name: status, subtitle: `Status on ${unitName}`, text };
}

export function styleInfo(style: string, unitName: string): EffectInfo {
  return {
    name: `${style} Style`,
    subtitle: `Style of ${unitName}`,
    text: `A unit with this Style can use ${style} abilities and enable ${style} Jutsu cards.`,
  };
}
