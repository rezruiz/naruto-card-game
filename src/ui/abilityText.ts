import { resolveCost, type AbilityDef } from '../engine/abilities';
import type { GameState } from '../engine/types';

/**
 * Condensed, in-game ability text — what each ability does in as few words
 * as keep it intuitive. The full wording (and every edge case) lives in the
 * rule book (design/SPEC.md); this is the at-a-glance version shown on the
 * clickable ability boxes, as "[Cost] — [Text]".
 */
const ABILITY_TEXT: Record<string, string> = {
  // Kakuzu
  'earth-grudge-fear': 'Deal 1 damage to any target.',
  'iron-skin': 'Deal 2 damage. Kakuzu takes −2 from physical and −1 from elemental attacks until your next turn.',
  'pressure-damage': 'Deal 2 damage to up to 2 enemy characters.',
  'searing-migraine': 'Deal 4 damage.',
  'false-darkness': 'Deal 2 damage.',
  'patchwork-threads': 'After Kakuzu defeats a shinobi: regain 1 Heart, heal 5, keep 2 Chakra pooled, and take 1 elemental Style from the defeated.',
  // Hidan
  'triple-scythe-sweep': 'Deal 2 damage.',
  'curse-technique': 'Curse an enemy Hidan has damaged: all damage Hidan takes is mirrored onto it, and Triple Scythe Sweep can hit Hidan himself for 0 (+1 to the Cursed). Ends when the Cursed enemy falls.',
  // Deidara
  'explosive-clay': 'Gain 1 Clay Charge. Up to 3×/turn.',
  'c1-shi-wan': 'Create a Clay Spider token. Up to 2×/turn.',
  'detonation-art': 'Deal 2 damage — or spend 1 Clay Charge to deal 4.',
  'c3-shi-suri': 'Needs a full Pool. Deal 5 to a target and 3 to each unit next to it (cross).',
  'death-is-an-explosion-v1': 'Needs a full Pool and Deidara at 3 HP or less. Deal 8 to every enemy and 3 to every ally. Deidara dies.',
  'death-is-an-explosion-v2': 'When Deidara would be defeated (full Pool, 5 Clay Charges), you’re asked: deal 8 to every enemy and 5 to every ally. He dies either way.',
  'self-detonate': 'Choose how many of your Clay Spiders detonate at 1 target — 1 damage each. They’re destroyed. Any number of times per turn.',
  'combine-clay-spiders': 'Destroy 4 Clay Spiders: Deidara gains 2 Clay Charges.',
  // Kisame
  'samehada-strike': 'Deal 1, Absorb 1.',
  'samehada-strike-evolved': 'Needs 3+ absorbed and 4+ pooled. Deal 2, Absorb 2.',
  'water-prison-jutsu': "A lower-Rank target can't use targeted abilities for 3 turns (or until Kisame takes damage).",
  'super-shark-bomb-jutsu': 'Needs 4+ absorbed and 3+ pooled. Deal 1 + the target’s pooled Chakra; it loses pooled Chakra equal to half the damage.',
  'thousand-hungry-sharks': 'Deal 4 damage. 2×/turn while transformed.',
  'samehada-shark-transformation': 'Needs 6 absorbed. Transform: +6 Pool, +6 max HP, Water attacks +1 damage and −1 cost. Ends after 7+ damage taken, or at Upkeep with ≤3 pooled.',
  // Itachi
  'crow-shuriken-barrage': 'Deal 2 damage.',
  'great-fireball-technique': 'Deal 3 damage.',
  'genjutsu-mind-prison': 'Stun the target through its controller’s next turn (no pooling, abilities or Jutsu cards). Once per character, ever.',
  'crow-clone': 'Negate an attack targeting Itachi. Once per attacker.',
  amaterasu: 'Deal 3 damage, then 2 more at each of your next 2 Upkeeps. Can’t be reduced.',
  'tsukuyomi-infinite-agony': 'Target already hit by Mind Prison: deal 6 and stun it for 2 turn cycles.',
  // Konan
  'paper-shuriken-storm': 'Deal 2 damage to up to 2 enemy characters.',
  'fold-shikigami': 'Gain 1 Shikigami Charge. Up to 2×/turn.',
  'paper-bomb-tag': 'Deal 3 damage — or spend 1 Shikigami Charge to deal 5.',
  'paper-clone': 'Negate an attack targeting Konan.',
  'paper-person-of-god-technique': 'Needs a full Pool. Deal 3 to all enemy units now, and 3 more at the end of the opponent’s next turn (cancelled if Konan falls).',
  // Sasori & his puppets
  'tail-strike': 'Deal 2 damage and apply 2 Poison.',
  'puppet-shell-guard': 'Redirect a Ninjutsu or physical attack on Third Kazekage onto Hiruko, −2 damage.',
  'poison-senbon': 'Deal 1 damage and apply 2 Poison.',
  'chakra-strings-puppet-summon': 'Create a Puppet Soldier token (max 3).',
  'puppet-performance-hundred-puppets': 'Needs a full Pool. Deal 2 to all enemy units and apply 3 Poison to each.',
  'iron-sand-barrage': 'Deal 3 damage.',
  'gold-dust-poison': 'Deal 1 damage to up to 2 enemies and apply 1 Poison to each.',
  'iron-sand-wall': 'Reduce a Ninjutsu/Taijutsu attack on a friendly unit by 2 + X.',
  'puppet-strike': 'Deal 1 damage.',
  // Zetsu & his clones
  'dual-nature-switch': 'Switch between White and Black mode. Free, any number of times.',
  'white-zetsu-corpse-consumption': 'White mode: heal 2 (4 if any character was defeated this turn).',
  'black-zetsu-sinister-whisper': 'Black mode: deal 1, Absorb 1.',
  'combine-zetsu-golem': 'Merge 3+ White Zetsu Clones into one Golem with their combined HP.',
  'absorbed-vitality': 'Heal an ally or itself for X − 1.',
  'spore-technique': 'An enemy your Zetsus damaged this turn can’t negate damage to itself or use Taijutsu until your next turn ends; Absorb 1 from it at your next 2 End Phases.',
  'white-zetsu-army': 'White mode: create 3 White Zetsu Clones.',
  'clone-strike': 'Deal 1, Absorb 1.',
  'golem-strike': 'Deal 3 and plant a Chakra Spore (next Upkeep, drains up to 3 of its pooled Chakra into Zetsu).',
  // Juzo Biwa
  'cleaving-strike': 'Deal 3 damage; if it defeats the target, deal 1 to another enemy. 2×/turn.',
  'hiding-mist': 'Until end of turn, an enemy targeting Juzo flips a coin — on a loss, it misses.',
  'kubikiribouchou-unleashed': 'Deal 5 damage; if it defeats the target, heal Juzo 6.',
  // Yahiko
  'blade-of-resolve': 'Deal 2 damage.',
  'water-jet-stream': 'Deal 3 damage.',
  'water-pillar-wall': 'Prevent the next 2 damage to Yahiko this turn.',
  'rallying-words': 'Each ally’s next attack this turn deals +1 damage.',
  'yahiko-sacrifices-himself': 'While the opponent has 2+ more characters: when an attack would defeat another of yours, Yahiko takes it instead.',
  // Amegakure Civilian Rebel
  'shinobi-strike': 'Deal 1 damage (2 if Yahiko is in play).',
  // Pain's Paths & Path Beasts
  'shinra-tensei': 'Deal 3 to a target and 3 to each unit next to it (cross).',
  'shinra-tensei-v2': 'Negate a Ninjutsu/Taijutsu attack targeting Deva Path.',
  'bansho-tennin': 'Pull an enemy closer and deal 1. It takes +1 damage for the rest of the turn.',
  'almighty-push': 'Needs Deva’s Pool full, as the first Path ability this turn. At your next End Phase, deal 8 to all enemy units.',
  'mechanized-assault': 'Deal 4 damage.',
  'mechanized-guard': 'Redirect a physical attack on any Path onto Asura, −1 damage.',
  'soul-rip': 'Deal 2 damage; if it defeats the target, draw 1.',
  'chakra-absorption': 'Redirect a Ninjutsu attack onto Preta and reduce it to 0; Preta gains 1 Chakra.',
  'absorb-impact': 'Redirect a physical attack onto Preta, −1 damage.',
  'king-of-hells-judgment': 'Choose a Path: heal it 3 at your next Upkeep (cancelled if Naraka falls).',
  'outer-path-samsara': 'Revive a defeated Path at full HP at your next Upkeep (cancelled if Naraka falls).',
  'relentless-strike': 'Deal 2 damage to up to 2 enemy characters. 2×/turn.',
  'rampaging-charge': 'Deal 3 / 2 / 1 along a path you choose: Straight (along the row) or Bent (front-row target → the character behind it → its neighbor).',
  'drill-peck': 'Deal 1 damage.',
};

/** Costs that depend on something the plain number can't show. */
const COST_TEXT: Record<string, string> = {
  'patchwork-threads': 'Entire Pool (2+)',
  'triple-scythe-sweep': '2 Chakra (0 on himself while Cursing)',
  'c3-shi-suri': '5 Chakra + 5 Clay Charges',
  'death-is-an-explosion-v1': '5 Chakra + entire Pool + 4 Clay Charges',
  'death-is-an-explosion-v2': '6 Chakra + entire Pool + 5 Clay Charges',
  'self-detonate': '1 Chakra (total, any number of Spiders)',
  'genjutsu-mind-prison': '3 Chakra (1 if Itachi outranks the target)',
  'paper-clone': '2 Chakra + 2 Shikigami Charges',
  'paper-person-of-god-technique': '6 Chakra + 4 Shikigami Charges',
  'iron-sand-wall': '3 + X Chakra (X up to 4)',
  'absorbed-vitality': 'X Chakra (from the Reservoir)',
  'yahiko-sacrifices-himself': '2 Chakra + entire Pool',
  'almighty-push': '6 Chakra + Deva’s entire Pool',
};

/** Short trait lines per character/token (defId) — the passives that matter at a glance. */
const TRAIT_TEXT: Record<string, string[]> = {
  kakuzu: ['Five Hearts — when defeated with 2+ Hearts, lose a Heart and a Style and revive instead. Pool = (Hearts − 1) × 2.', 'Elemental Versatility — first elemental jutsu each turn costs 1 less.'],
  hidan: ["Jashin's Blessing — the first time he'd be defeated, he survives at 1 HP. Heals 1 each End Phase (2 while Cursing)."],
  deidara: ['Starts with 1 Clay Charge.'],
  kisame: ['Samehada Fusion — absorbed Chakra builds toward Shark Transformation (6 needed).'],
  itachi: ['Deterioration — max 2 abilities per turn.', 'Uchiha Prodigy — Quick Jutsu cards he could use cost 1 less (min 1).', 'Sharingan Foresight — prevent 1 damage from Quick abilities targeting him.'],
  konan: ['Paper Body — −2 damage from Taijutsu, +1 from Fire.', 'Starts with 1 Shikigami Charge.'],
  'sasori-hiruko': ['Puppet Shell — when Hiruko falls, Sasori becomes Hollow Body (4 HP) instead.', 'Poison — each Upkeep, remove 1 counter and take 1 damage (can’t be prevented).'],
  'sasori-hollow-body': ['Sasori’s true form — defeating it defeats Sasori.', 'Poison — each Upkeep, remove 1 counter and take 1 damage (can’t be prevented).'],
  zetsu: ['Dual Nature — only one mode’s ability (White or Black) per turn.', 'Heals 1 each Upkeep.', 'Shared Reservoir — his Pool fills only by absorbing, and his Clones and Golems share it.'],
  juzo: ['Heals 3 whenever he defeats an enemy character.', 'Iron-Forged Body — −1 damage from Taijutsu (min 1).'],
  yahiko: ['Inspiring Leader — your other Akatsuki’s first ability each turn costs 1 less (min 1).', 'Elemental Versatility — first elemental jutsu each turn costs 1 less.'],
  'amegakure-civilian-rebel': [],
  'deva-path': ['Max 2 of its abilities per turn.', 'Rinnegan Reservoir — may spend any Path’s Pool.'],
  'asura-path': ['Rinnegan Reservoir — may spend any Path’s Pool.'],
  'human-path': ['Rinnegan Reservoir — may spend any Path’s Pool.'],
  'animal-path': ['Rinnegan Reservoir — may spend any Path’s Pool.', 'Its Path Beasts fizzle if it falls.'],
  'preta-path': ['Rinnegan Reservoir — may spend any Path’s Pool.'],
  'naraka-path': ['Rinnegan Reservoir — may spend any Path’s Pool.'],
  'ku-three-headed-hound': ['Fizzles if Animal Path falls.'],
  'war-rhino': ['Fizzles if Animal Path falls.'],
  'giant-drill-beaked-bird': ['Evasive — Normal-speed attacks on it miss on a lost coin flip.', 'Fizzles if Animal Path falls.'],
  'third-kazekage': ['Fizzles if Sasori is truly defeated.'],
  'puppet-soldier': ['Fizzles if Sasori is truly defeated.'],
  'white-zetsu-clone': ['Uses Zetsu’s shared Pool. Fizzles if Zetsu falls.'],
  'zetsu-golem': ['Uses Zetsu’s shared Pool. Fizzles if Zetsu falls.', 'Regeneration — heals 1 each Upkeep if it took no damage last turn.'],
  'clay-spider': ['Fizzles if Deidara falls. Max 5.'],
};

export function abilityText(ability: AbilityDef): string {
  if (ability.id.startsWith('summon-')) return 'Summon this Path Beast (not while it’s in play or on cooldown).';
  return ABILITY_TEXT[ability.id] ?? '';
}

/** The "[Cost]" part: the live cost (with this turn's discounts) where it's a plain number, or a short description of a variable one. */
export function abilityCostText(state: GameState, sourceInstanceId: string, ability: AbilityDef): string {
  const override = COST_TEXT[ability.id];
  if (override) return override;
  try {
    return `${resolveCost(ability, { state, sourceInstanceId, targetInstanceIds: [] })} Chakra`;
  } catch {
    return 'Variable cost';
  }
}

export function traitLines(defId: string): string[] {
  return TRAIT_TEXT[defId] ?? [];
}

/** Every ability id the condensed text covers — for the guard test that keeps it complete. */
export const CONDENSED_ABILITY_IDS = new Set(Object.keys(ABILITY_TEXT));
