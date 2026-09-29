import type { AbilitySpeed, AbilityType, GameState, PlayerId, Style } from '../types';

export interface HandCardContext {
  state: GameState;
  player: PlayerId;
  /** The in-play character enabling this play (§5.3/§10c) — only a Jutsu card needs one; it's '' for Assist, Terrain and Mission cards, none of which are played "through" any particular character. */
  enablingInstanceId: string;
  targetInstanceIds: string[];
  /** A player-chosen numeric amount, for the rare card with a variable magnitude the controller picks (e.g. Chakra Transfer's X) — see HandCardDef.needsAmountChoice. Undefined when the card doesn't use one, or when resolved programmatically (tests) without picking one — cards reading this should fall back to their old auto-choice in that case. */
  amount?: number;
}

export interface HandCardDef {
  id: string;
  name: string;
  cardType: 'jutsu' | 'assist' | 'terrain' | 'mission';
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
  needsAmountChoice?: boolean;
  /** UI label for the amount stepper, e.g. "Chakra to transfer". */
  amountLabel?: string;
  /** Upper bound offered to the player for the amount stepper — called once targets/enabler are chosen. */
  maxAmount?: (ctx: HandCardContext) => number;
  legalityCheck?: (ctx: HandCardContext) => boolean;
  /** For 'jutsu'/'assist': the card's actual effect. For 'terrain'/'mission': what happens the moment it's played (almost always just entering play — see terrainInPlay/missionsInPlay in playHandCard.ts, which handles placement generically before this runs). */
  resolve: (ctx: HandCardContext) => GameState;
  /** Synergy tag(s), mainly relevant for Terrain cards (§10a) that other cards check for (e.g. Chidori Interception's cost discount "if an Akatsuki-Synergy Terrain is in play"). */
  synergy?: string[];
}

/** What just happened, offered to every in-play Mission so it can decide whether it cares (§10b's Condition is checked at a variety of different trigger points across the 6 example cards, not one shared moment). */
export type MissionTrigger = { kind: 'untap' } | { kind: 'defeat'; rank: import('../types').CharacterInstance['rank'] };

/**
 * A Mission's ongoing Condition/Reward (§10b). Unlike a Jutsu/Assist card's
 * one-shot `resolve`, a Mission's effect can span many separate trigger
 * events (e.g. Squad Formation applies its reward once, then lingers
 * watching for a *different* ending condition) — `tick` is called at every
 * relevant trigger and returns whether the Mission is now done (discarded).
 */
export interface MissionDef {
  id: string;
  /** True if this Mission is capped at 1 copy per Character Deck instead of the Hand Deck's normal 3 (§10b). */
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

export function registerMission(def: MissionDef): void {
  missionRegistry[def.id] = def;
}

export function getMissionDef(id: string): MissionDef | undefined {
  return missionRegistry[id];
}
