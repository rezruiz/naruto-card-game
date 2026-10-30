import type { AbilitySpeed, AbilityType, GameState, PlayerId, Style } from '../types';

export interface HandCardContext {
  state: GameState;
  player: PlayerId;
  /** The in-play character enabling this play (§5.3/§10c) — only a Jutsu with an ability Type needs one (see needsEnablingCharacter); it's '' for everything else, none of which is played "through" any particular character. */
  enablingInstanceId: string;
  targetInstanceIds: string[];
  /** A player-chosen numeric amount, for the rare card with a variable magnitude the controller picks (e.g. Chakra Transfer's X) — see HandCardDef.needsAmountChoice. Undefined when the card doesn't use one, or when resolved programmatically (tests) without picking one — cards reading this should fall back to their old auto-choice in that case. */
  amount?: number;
}

export interface HandCardDef {
  id: string;
  name: string;
  /** 'shinobi' and 'equipment' exist only under the prototype rules (shinobi.ts, equipment.ts): a unit played onto the board, and gear attached to one, both for Supplies. */
  cardType: 'jutsu' | 'assist' | 'terrain' | 'mission' | 'shinobi' | 'equipment';
  /**
   * Chakra cost. May be a function for the "cheaper if paid from the
   * enabling character's own Pool" discount pattern (§10c) — cost functions
   * receive `payFromPool` indirectly by checking the resolved split at
   * legality time (see playHandCard.ts), same convention as AbilityDef.
   */
  cost: number | ((ctx: HandCardContext, payFromPool: number) => number);
  speed: AbilitySpeed;
  style: Style;
  type: AbilityType;
  isDamaging?: boolean;
  /** UI hint: how many targets to collect before playing. Default 1; 0 for untargeted cards. */
  maxTargets?: number;
  targetSide?: 'enemy' | 'ally' | 'any';
  /**
   * The card *chooses* its units instead of targeting them (§9, "Choosing vs. targeting"): a choice is a
   * game action nothing can interact with — it never counts as targeting, so negation, redirects, "whenever
   * targeted" triggers and targeting surcharges ignore it. The chosen units still go through targetInstanceIds
   * (and the normal side/Retreat checks), but the stack item carries no targets.
   */
  chooses?: boolean;
  /** Bypasses the normal Retreat-targeting-immunity check (§6.5b) — for the rare card that specifically targets a Retreated character, like Deploy Medic Corps. */
  allowRetreatedTarget?: boolean;
  /**
   * When a Normal-speed card may be played: 'main' (Main Phases only), 'combat' (Combat Phase only), or 'either'.
   * Defaults: Terrain/Missions/most Jutsu are Main-only; Attack-type Jutsu are Combat-only. A card whose effect is
   * combat-relevant and resolves immediately sets 'either'. Quick/Reactive cards ignore this.
   */
  timing?: 'main' | 'combat' | 'either';
  /** True when this card's cost function meaningfully changes depending on how much is paid from the enabling character's own Pool (the Substitution family's discount) — the UI offers the player that choice instead of always paying all-generic. */
  offersPoolDiscount?: boolean;
  /** True when the player should choose a numeric amount (HandCardContext.amount) before this card resolves, e.g. Chakra Transfer's X. */
  needsAmountChoice?: boolean | ((targetInstanceIds: string[]) => boolean);
  /** UI label for the amount stepper, e.g. "Chakra to transfer". */
  amountLabel?: string;
  /** Upper bound offered to the player for the amount stepper — called once targets/enabler are chosen. */
  maxAmount?: (ctx: HandCardContext) => number;
  legalityCheck?: (ctx: HandCardContext) => boolean;
  /** For 'jutsu'/'assist': the card's actual effect. For 'terrain'/'mission': what happens the moment it's played (almost always just entering play — see terrainInPlay/missionsInPlay in playHandCard.ts, which handles placement generically before this runs). */
  resolve: (ctx: HandCardContext) => GameState;
  /** Negates the targeting of an attack aimed at its enabling character (the Substitution family) — refused while that character is under Spore Technique. */
  negatesTargetingOfSelf?: boolean;
  /** Shinobi cards (prototype): the unit's base Damage and Health once it's in play. */
  shinobi?: {
    damage: number;
    health: number;
    /** +amount Damage while its controller has a unit with this name in play, Leader or Shinobi (e.g. Amegakure Civilian Rebel with Yahiko). */
    leaderBonus?: { name: string; amount: number };
    /** A named character (e.g. Yahiko), not a generic unit: the legendary rule applies — a player can't have two units with this name in play. */
    named?: boolean;
    /** Rank shown on the card, for flavor only (e.g. the Rebel keeps its D Rank). */
    rank?: string;
    /** Its own Chakra Pool's capacity, for a Shinobi with abilities (its abilities live on a TokenDef with the card's id). */
    pool?: number;
    /** Styles, for a Shinobi whose abilities have one (an ability's Style must be one of its unit's). */
    styles?: Style[];
    /** Synergy, for a named Shinobi (e.g. Yahiko: Akatsuki) — read by Equipment like the Akatsuki Cloak. */
    synergy?: string[];
  };
  /** Equipment cards (prototype): the buffs it gives its holder (equipment.ts). */
  equipment?: EquipmentStats;
  /** The card's printed text, for cards whose text isn't in SPEC.md (the Prototype's Equipment and Terrain). */
  text?: string;
  /** The card's text in the Prototype build, for a base-game card that works differently there (Akatsuki Hideout). */
  prototypeText?: string;
  /** At most 1 copy per deck (the Jutsu Deck's normal limit is 3). */
  unique?: boolean;
  /**
   * Prototype rules, card by card. By default only Jutsu and Shinobi cards can be discarded as a Chakra
   * source, and Jutsu cost Chakra while every other card costs Supplies. A card that breaks either rule says so here.
   */
  chakraSource?: boolean;
  paidWith?: 'chakra' | 'supplies';
  /** Synergy tag(s), mainly relevant for Terrain cards (§10a) that other cards check for (e.g. Chidori Interception's cost discount "if an Akatsuki-Synergy Terrain is in play"). */
  synergy?: string[];
}

/** Prototype rules: what an Equipment card gives the Shinobi holding it — each buff counts only while it's attached, and several Equipment on one holder add up. */
export interface EquipmentStats {
  health?: number;
  damage?: number;
  /** Can also go on a Leader — an exception to Equipment being Shinobi-only (Chakra Storage Scroll, Medical Pouch). */
  leaderHolder?: boolean;
  /** Supplies to play it onto a Leader, when that differs from its normal cost (Medical Pouch: 8). */
  leaderCost?: number;
  /** The heal's Supply cost while it's on a Leader, when that differs from healCost (Medical Pouch: 4). */
  leaderHealCost?: number;
  /** Extra Chakra Pool capacity (for a holder with a Pool: a Leader, or a Shinobi like Yahiko). */
  poolCapacity?: number;
  /** Each damage instance the holder takes is reduced by this much, to a minimum of 1. */
  damageReduction?: number;
  /** Heals the holder this much in its controller's Upkeep Phase. */
  healEachTurn?: number;
  /** Supplies to pay for that heal — it's optional, so the controller is asked each Upkeep. */
  healCost?: number;
  /** When the holder is defeated by an attack, deals this much damage to the attacker. */
  defeatRetaliation?: number;
  /** Extra Damage while the holder has this Style or this Synergy. */
  conditionalDamage?: { style?: Style; synergy?: string; amount: number };
}

/**
 * Whether playing this card needs an in-play character to enable it
 * (§5.3/§10c's Style-affinity rule). Only a Jutsu that's an actual technique
 * — one with an ability Type (Ninjutsu, Taijutsu, Bukijutsu, Genjutsu) — is
 * played "through" a character. Everything else is exempt: Assist cards
 * (§10c), Terrain (§10a), Missions (§10b), and Type: None tactical cards
 * (Field Intelligence, Incoming Mission Assignment, Battlefield Selection).
 */
export function needsEnablingCharacter(def: Pick<HandCardDef, 'cardType' | 'type' | 'paidWith'>, prototype = false): boolean {
  // Prototype rules: a Chakra cost is paid from a Leader's Chakra Pool, so even a Type: None Jutsu needs a Leader to play it through.
  if (prototype) return paysInChakra(def);
  return def.cardType === 'jutsu' && def.type !== 'None';
}

/** Prototype rules: whether this card costs Chakra (from a Leader's Pool) rather than Supplies — Jutsu by default, unless the card says otherwise. */
export function paysInChakra(def: Pick<HandCardDef, 'cardType' | 'paidWith'>): boolean {
  return (def.paidWith ?? (def.cardType === 'jutsu' ? 'chakra' : 'supplies')) === 'chakra';
}

/** Prototype rules: whether this card can be discarded as a Chakra source — Jutsu and Shinobi by default, unless the card says otherwise. */
export function canBeChakraSource(def: Pick<HandCardDef, 'cardType' | 'chakraSource'>): boolean {
  return def.chakraSource ?? (def.cardType === 'jutsu' || def.cardType === 'shinobi');
}

/** The units a played card actually *targets* — none for a card that chooses them instead (HandCardDef.chooses). */
export function targetedIds(def: Pick<HandCardDef, 'chooses'> | undefined, ids: string[]): string[] {
  return def?.chooses ? [] : ids;
}

/** What just happened, offered to every in-play Mission so it can decide whether it cares (§10b's Condition is checked at a variety of different trigger points across the 6 example cards, not one shared moment). */
export type MissionTrigger =
  | { kind: 'untap' }
  /** Run after every action: a Mission whose Condition has failed (or whose ongoing effect has ended) is discarded right then, not at its next scheduled trigger. */
  | { kind: 'check' }
  | { kind: 'defeat'; rank: import('../types').CharacterInstance['rank']; byInstanceId?: string }
  /** One of the Mission controller's OWN characters was defeated (any rank, any cause; tokens don't count). */
  | { kind: 'own-loss'; rank: import('../types').CharacterInstance['rank'] };

/**
 * A Mission's ongoing Condition/Reward (§10b). Unlike a Jutsu/Assist card's
 * one-shot `resolve`, a Mission's effect can span many separate trigger
 * events (e.g. Squad Formation applies its reward once, then lingers
 * watching for a *different* ending condition) — `tick` is called at every
 * relevant trigger and returns whether the Mission is now done (discarded).
 */
export interface MissionDef {
  id: string;
  /** True if this Mission is capped at 1 copy per Character Deck instead of the Jutsu Deck's normal 3 (§10b). */
  unique?: boolean;
  tick: (state: GameState, owner: PlayerId, missionInstanceId: string, trigger: MissionTrigger) => { state: GameState; discard: boolean };
}

const registry: Record<string, HandCardDef> = {};
const missionRegistry: Record<string, MissionDef> = {};

export function registerHandCard(def: HandCardDef): void {
  registry[def.id] = def;
}

export function getHandCardDef(id: string): HandCardDef | undefined {
  return registry[id];
}

/** Every registered Jutsu Deck card — the deck builder's card pool. */
export function listHandCardDefs(): HandCardDef[] {
  return Object.values(registry);
}

export function registerMission(def: MissionDef): void {
  missionRegistry[def.id] = def;
}

export function getMissionDef(id: string): MissionDef | undefined {
  return missionRegistry[id];
}
