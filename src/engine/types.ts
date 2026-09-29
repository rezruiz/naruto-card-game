export type PlayerId = 'p1' | 'p2';

export const PHASE_ORDER = [
  'Untap',
  'Upkeep',
  'Draw',
  'Main1',
  'Combat',
  'Main2',
  'End',
] as const;

export type Phase = (typeof PHASE_ORDER)[number];

export interface LogEntry {
  id: string;
  turn: number;
  phase: Phase;
  text: string;
}

export interface ChakraSource {
  tapped: boolean;
}

export type Style =
  | 'None'
  | 'Fire'
  | 'Water'
  | 'Wind'
  | 'Earth'
  | 'Lightning'
  | 'Explosion'
  | 'Gravity'
  | 'Paper'
  | 'Yang'
  | 'Poison'
  | 'Ritual';

export type AbilityType = 'Ninjutsu' | 'Taijutsu' | 'Bukijutsu' | 'Genjutsu' | 'None';

export type AbilitySpeed = 'Normal' | 'Quick' | 'Reactive';

export interface CharacterStatus {
  disabled: boolean;
  retreated: boolean;
  /** Turn number this unit entered play on — used to check summoning sickness (SPEC.md §6.6). */
  enteredTurn: number;
  hasAmbush: boolean;
  usedAbilitiesThisTurn: string[];
  /** Pooled Chakra into this unit this turn — blocks it from acting the rest of the turn (SPEC.md §5.3's pool-XOR-act rule). Reset at Untap. */
  pooledThisTurn: boolean;
}

export interface CharacterInstance {
  instanceId: string;
  defId: string;
  owner: PlayerId;
  name: string;
  rank: 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS';
  maxHP: number;
  currentHP: number;
  chakraPool: { current: number; capacity: number };
  styles: Style[];
  status: CharacterStatus;
  /** Per-card bespoke state bag (Kakuzu's hearts, Deidara's Clay Charges, Hidan's Cursed target, etc.). */
  extra: Record<string, unknown>;
}

export interface TokenInstance {
  instanceId: string;
  defId: string;
  owner: PlayerId;
  name: string;
  maxHP: number;
  currentHP: number;
  /** The character instance this token belongs to (fizzle-on-owner-defeated rules, SPEC.md §10). */
  ownerCharacterInstanceId: string;
  status: CharacterStatus;
  extra: Record<string, unknown>;
  /**
   * A Token normally has no Chakra Pool of its own (SPEC.md §10 default).
   * Pain's Path tokens are the one exception — each pools individually into
   * its own separately-capped Pool (Rinnegan Reservoir). Present only for
   * that kind of Token; absent (undefined) for every ordinary Token.
   */
  chakraPool?: { current: number; capacity: number };
}

export type BoardOccupant = CharacterInstance | TokenInstance;

/** A Jutsu/Mission/Terrain/Assist card drawn from the 40-card Hand Deck (SPEC.md §2, §10c). */
export interface HandCardInstance {
  instanceId: string;
  defId: string;
}

/**
 * A single entry in a player's hand — either a Hand Deck card, or a
 * Character card drawn via a Character Deck trigger (§8) and not yet
 * played. Both live in the same "hand" zone per SPEC.md §2/§8, even though
 * they come from two entirely separate decks.
 */
export type HandEntry =
  | ({ kind: 'card' } & HandCardInstance)
  | { kind: 'character'; instanceId: string; entryId: string };

/**
 * SPEC.md §9: 5-column back row (Characters), 10-slot front row (Tokens),
 * front slots 2*col/2*col+1 pair with backRow[col].
 */
export interface PlayerState {
  id: PlayerId;
  health: number;
  genericChakraAvailable: number;
  chakraSources: ChakraSource[];
  chakraSourcePlacedThisTurn: boolean;
  hand: HandEntry[];
  backRow: (CharacterInstance | null)[];
  frontRow: (TokenInstance | null)[];
  /** The character chosen as this player's starting character at Setup (SPEC.md §3) — drives its special Upkeep-Phase treatment (§6.5) instead of the normal per-rank table. Untransferable if that character is later defeated. */
  startingCharacterInstanceId: string | null;
  /** Set when one of this player's characters is defeated; consumed by the next character they play, granting it Ambush for that one entry (SPEC.md §6.6's Retaliation exception). */
  retaliationPending: boolean;
  /**
   * This player's own characters defeated since the reducer last looked
   * (§8's Reinforcement trigger) — recorded by combat.ts at the moment of
   * defeat (`lastCPlus`: no other C-rank-or-higher character was left in
   * play right after it fell, D-ranks ignored), turned into an offer or a
   * forced play by the reducer (which, unlike combat.ts, can see hand
   * cards' ranks without an import cycle).
   */
  pendingReinforcementEvents: { rank: CharacterInstance['rank']; lastCPlus: boolean }[];
  /** Reinforcement offers awaiting ACCEPT/DECLINE, oldest first: 'paid' = pay the current tax to look 2 / pick 1 (the tax counter doesn't move); 'free' = the last-C+-defeated free draw. */
  reinforcementOffers: ('paid' | 'free')[];
  /** §8: this player's last C+ character fell while they held a C+ character card — they must play one (free, ignoring timing) before doing anything else. */
  mustPlayCharacter: boolean;
  /** This turn's Draw Phase draw has been taken (§4.3) — the draw is a manual click, once per turn. Reset every Untap. */
  drawnThisDrawPhase: boolean;
  /** Field Intelligence (§13b): this player must reveal `count` hand cards of their choice to `requestedBy`. */
  pendingHandReveal: { requestedBy: PlayerId; count: number } | null;
  /** Hand cards this player has revealed (Field Intelligence) — shown to the opponent even over the network until they leave hand or the turn ends. */
  revealedHandCards: string[];
  /** Remaining shuffled Hand Deck (Jutsu/Mission/Terrain/Assist cards), §2. */
  handDeck: HandCardInstance[];
  /** Remaining shuffled Character Deck, as entry ids (§2, §8) — see characters/deckEntries.ts. */
  characterDeck: string[];
  /** Cards spent to place Chakra sources (§5.2) — separate from, and far more permanent than, the discard pile. */
  consumedPile: HandCardInstance[];
  discardPile: HandCardInstance[];
  /**
   * Character Deck entries currently revealed and awaiting a CHOOSE_CHARACTER
   * action (§3's Setup draw, or a §8 Reinforcement draw) — null when nothing
   * is pending. `reason` distinguishes the Setup draw (the chosen card is
   * played onto the board immediately, for free — §3) from a Reinforcement
   * draw (the chosen card goes to hand, played later via PLAY_CHARACTER,
   * paying the Reinforcement Tax — §8). D-rank entries among `revealed` are
   * always added to hand normally, on top of the one main pick, per §8.
   */
  pendingCharacterReveal: { revealed: string[]; reason: 'setup' | 'reinforcement' } | null;
  /** How many paid manual Character Deck draws (§8) this player has made — only ever increases, drives the escalating tax (3/5/7/8, capped). Reinforcement-trigger draws never advance it. */
  reinforcementsPlayed: number;
  /** How many times this player has mulliganed so far this game (§3) — the first is free (redraw 6); each one after draws 1 fewer. */
  mulligansSoFar: number;
  /** At most 1 Terrain card active at once (§10a) — playing another replaces it. */
  terrainInPlay: HandCardInstance | null;
  /** Missions currently in play (§10b) — capped at the number of characters this player controls; playing past that cap replaces one of the controller's choice (auto: the oldest — a documented simplification, no interactive choice channel exists yet). */
  missionsInPlay: MissionInstance[];
  /** Enemy characters defeated by this player, awaiting a Mission tick (e.g. the Bingo Book family) — drained by the reducer each action, same pattern as pendingReinforcementDraws. */
  pendingDefeatEvents: { rank: CharacterInstance['rank'] }[];
  /** Bingo Book: Threat Level S's reward — the next character this player plays is fully stunned (no abilities at all) the turn it enters, stricter than the normal summoning-sickness default. */
  nextCharacterFullyStunned: boolean;
  /** Bingo Book: Threat Level A's reward — Chakra discount applied to this player's next-paid Reinforcement Tax (§8). */
  nextReinforcementDiscount: number;
  /** Names of Attack-type Jutsu cards this player has played this turn — each may be played only once per turn (§4.5, §9). Reset every Untap. */
  attackJutsuUsedThisTurn: string[];
  /** Bingo Book: Threat Level B's reward — lets this player place 1 extra Chakra source on top of the normal once-per-turn cap, the next time they place one. */
  bonusChakraSourcePlacements: number;
}

/** A Mission card actually in play (§10b) — distinct from a plain HandCardInstance since it needs its own per-instance bookkeeping (Unshakable Resolve's turn count, Squad Formation's chosen group, ...). */
export interface MissionInstance {
  instanceId: string;
  defId: string;
  owner: PlayerId;
  extra: Record<string, unknown>;
}

export interface StackItem {
  id: string;
  controllerId: PlayerId;
  sourceInstanceId: string;
  sourceName: string;
  abilityId: string;
  abilityName: string;
  targets: string[];
  /** Pure resolution function — applied to state when this item resolves off the stack. */
  resolve: (state: GameState) => GameState;
}

/**
 * 'strict' = the engine enforces every timing/legality rule (the original
 * mode, and what the engine test suite exercises). 'trust' = playtest mode:
 * players declare actions verbally-agreed and the engine only computes their
 * effects — legality problems become advisory warnings on the staged action.
 */
export type RulesMode = 'strict' | 'trust';

/** A declared-but-not-yet-resolved action (trust mode). Plain data so it survives being sent over the network; editable/removable until resolved. */
export interface StagedAction {
  id: string;
  owner: PlayerId;
  kind: 'ability' | 'card';
  /** The acting character/token (ability) or the enabling character (card; '' for Assist). */
  sourceInstanceId: string;
  abilityId?: string;
  cardInstanceId?: string;
  cardDefId?: string;
  /** Display label, e.g. "Kakuzu: Earth Grudge Fear". */
  label: string;
  targets: string[];
  payFromPool: number;
  amount?: number;
  /** The player's answers to the ability's optional choices (AbilityDef.choices), e.g. whether to spend a Clay Charge. */
  choices?: AbilityChoices;
  /** Advisory only — why the strict rules would have blocked this, computed when it was declared/retargeted. */
  warnings: string[];
}

/** Trust mode's 'Resolve Actions' / 'Finalize Phase' handshake: resolves once every player has approved (or had no meaningful response to make). */
export interface PendingFinalize {
  by: PlayerId;
  /** True for 'Finalize Phase' (resolve, then advance to the next phase); false for a plain 'Resolve Actions'. */
  advance: boolean;
  approvals: PlayerId[];
}

/** A player's answers to an ability's optional choices, keyed by ChoiceSpec id. */
export type AbilityChoices = Record<string, boolean | number | string>;

/**
 * A decision the engine needs from one specific player mid-resolution
 * (e.g. which Mission to replace, which characters to pay Upkeep for).
 * Plain data — the follow-up is looked up by `resolverId` in choices.ts, so
 * it survives the network and undo snapshots.
 */
export interface PendingChoice {
  id: string;
  player: PlayerId;
  prompt: string;
  options: { id: string; label: string }[];
  /** How many options must be picked (inclusive range). */
  min: number;
  max: number;
  resolverId: string;
  data: Record<string, unknown>;
}

export interface GameState {
  /** The first-player coin flip hasn't happened yet — per SPEC.md §3 it comes after both players finish Setup (character pick + mulligans). */
  firstPlayerPending: boolean;
  /** Decisions waiting on a specific player (oldest first) — see PendingChoice. */
  pendingChoices: PendingChoice[];
  /** Set when a combat step clears a player's board and forces their Retreated characters out (retreatCollapse.ts): the next advance out of Combat is replaced by a second Combat. */
  extraCombatPending: boolean;
  /** Retreated characters that stay immune for the whole of the round currently resolving, even if their controller's last non-Retreated character falls mid-resolution (they're forced out only once the step is over). */
  resolutionShield: string[];
  rules: RulesMode;
  staged: StagedAction[];
  pendingFinalize: PendingFinalize | null;
  turn: number;
  /** Whoever went first (SPEC.md §3) — their very first turn skips the Draw Phase (§4.3), a rule that must key off the same player every game, not just "whoever's active now." */
  firstPlayer: PlayerId;
  activePlayer: PlayerId;
  phase: Phase;
  players: Record<PlayerId, PlayerState>;
  log: LogEntry[];
  winner: PlayerId | 'draw' | null;
  stack: StackItem[];
  /** Player who currently holds priority (stack/priority system, SPEC.md §7). */
  priorityPlayer: PlayerId | null;
  /** Consecutive passes seen at the current stack depth — 2 in a row resolves the top item. */
  passesInARow: number;
}

export type GameAction =
  | { type: 'ADVANCE_PHASE' }
  | { type: 'PLACE_CHAKRA_SOURCE'; instanceId: string }
  | { type: 'TAP_CHAKRA_SOURCE'; sourceIndex: number; player?: PlayerId }
  | { type: 'POOL_CHAKRA'; instanceId: string; amount: number }
  | {
      type: 'ACTIVATE_ABILITY';
      instanceId: string;
      abilityId: string;
      targetInstanceIds: string[];
      /** How much of the cost to pay from the character's own Pool vs the generic pool. */
      payFromPool: number;
      choices?: AbilityChoices;
    }
  | { type: 'PASS_PRIORITY' }
  | { type: 'SET_RULES'; rules: RulesMode }
  | { type: 'DRAW_PHASE_CARD' }
  | { type: 'DRAW_CHARACTER_DECK'; player: PlayerId }
  | { type: 'ACCEPT_REINFORCEMENT'; player: PlayerId }
  | { type: 'DECLINE_REINFORCEMENT'; player: PlayerId }
  | { type: 'REVEAL_HAND_CARDS'; player: PlayerId; instanceIds: string[] }
  | { type: 'RESOLVE_CHOICE'; choiceId: string; optionIds: string[] }
  | { type: 'SET_SQUAD_REDIRECT'; missionInstanceId: string; redirectTo: string | null }
  // --- Trust mode: staging & resolution ---
  | { type: 'STAGE_ABILITY'; instanceId: string; abilityId: string; targetInstanceIds: string[]; payFromPool: number; choices?: AbilityChoices }
  | { type: 'STAGE_CARD'; instanceId: string; enablingInstanceId: string; targetInstanceIds: string[]; payFromPool: number; amount?: number }
  | { type: 'RETARGET_STAGED'; stagedId: string; targetInstanceIds: string[] }
  | { type: 'UNSTAGE'; stagedId: string }
  | { type: 'MOVE_STAGED'; stagedId: string; direction: 'earlier' | 'later' }
  | { type: 'RESOLVE_ACTIONS'; player: PlayerId }
  | { type: 'FINALIZE_PHASE'; player: PlayerId }
  | { type: 'APPROVE_RESOLVE'; player: PlayerId }
  | { type: 'CANCEL_FINALIZE'; player: PlayerId }
  // --- Trust mode: manual adjustments (Cockatrice-style) & deck tools ---
  | { type: 'ADJUST_HP'; instanceId: string; delta: number }
  | { type: 'DEAL_DAMAGE'; instanceId: string; amount: number }
  | { type: 'ADJUST_POOL'; instanceId: string; delta: number }
  | { type: 'TOGGLE_STATUS'; instanceId: string; status: 'disabled' | 'retreated' }
  | { type: 'ADJUST_PLAYER_HEALTH'; player: PlayerId; delta: number }
  | { type: 'ADJUST_GENERIC_CHAKRA'; player: PlayerId; delta: number }
  | { type: 'UNTAP_CHAKRA_SOURCE'; player: PlayerId; sourceIndex: number }
  | { type: 'MOVE_HAND_CARD'; player: PlayerId; instanceId: string; to: 'discard' | 'deck-top' | 'deck-bottom' }
  | { type: 'RETURN_FROM_DISCARD'; player: PlayerId; instanceId: string }
  | { type: 'RETURN_FROM_CONSUMED'; player: PlayerId; instanceId: string }
  | { type: 'DRAW_CARDS'; player: PlayerId; count: number }
  | { type: 'SHUFFLE_DECK'; player: PlayerId }
  | { type: 'DECK_TAKE'; player: PlayerId; instanceId: string; shuffle: boolean }
  | { type: 'DECK_TO_BOTTOM'; player: PlayerId; instanceId: string }
  | { type: 'RETURN_CHARACTER_TO_HAND'; instanceId: string }
  | { type: 'RETREAT'; instanceId: string }
  | { type: 'RETURN_FROM_RETREAT'; instanceId: string }
  | { type: 'CHOOSE_CHARACTER'; player: PlayerId; entryId: string }
  | { type: 'MULLIGAN'; player: PlayerId }
  | { type: 'PLAY_CHARACTER'; instanceId: string }
  | {
      type: 'PLAY_HAND_CARD';
      instanceId: string;
      /** Which in-play character enables this card (§5.3/§10c's Style-affinity rule) — irrelevant for Assist cards, which ignore that requirement entirely and may be omitted (pass ''). */
      enablingInstanceId: string;
      targetInstanceIds: string[];
      payFromPool: number;
      /** A player-chosen numeric amount for cards that need one (e.g. Chakra Transfer's X) — see HandCardDef.needsAmountChoice. */
      amount?: number;
    };
