import type { CharacterInstance, GameState, PlayerId, Style } from '../types';
import type { AbilityDef } from '../abilities';
import type { OnWouldBeDefeatedHook } from '../combat';

export interface CharacterDef {
  id: string;
  name: string;
  rank: CharacterInstance['rank'];
  baseMaxHP: number;
  basePoolCapacity: number;
  styles: Style[];
  abilities: AbilityDef[];
  ultimate?: AbilityDef;
  onWouldBeDefeated?: OnWouldBeDefeatedHook;
  onEndPhase?: (state: GameState, instanceId: string) => GameState;
  onUpkeep?: (state: GameState, instanceId: string) => GameState;
  /**
   * Fires at EVERY End Phase, both players' alike (unlike onEndPhase, which
   * only fires at this character's own controller's End Phase) — for effects
   * scheduled against the opponent's End Phase specifically (e.g. Konan's
   * Ultimate). `endingPlayer` is whoever's End Phase is currently resolving.
   */
  onAnyEndPhase?: (state: GameState, instanceId: string, endingPlayer: PlayerId) => GameState;
  /** Caps total ability activations per turn across all of this character's abilities (e.g. Itachi's Deterioration). */
  maxAbilitiesPerTurn?: number;
  /** First elemental jutsu (Type: Ninjutsu, Style !== None) each turn costs 1 less, min 1 (Kakuzu's/Yahiko's Elemental Versatility). */
  elementalVersatility?: boolean;
  /** Grants each OTHER ally character's first ability each turn a 1-Chakra discount, min 1 (Yahiko's Inspiring Leader). */
  grantsInspiringLeader?: boolean;
  /** Blocks the normal §5.3 Chakra-pooling action into this character (Zetsu's No Self-Pooling — only absorption effects fill his Pool). */
  noSelfPooling?: boolean;
  /** Extra per-card state a fresh instance starts with (Kakuzu's hearts, Deidara's Clay Charges, ...). */
  initialExtra?: Record<string, unknown>;
  /**
   * A Disabled or Retreated character's triggered Traits/Passives don't fire (§6.5a/§6.5b; defeat-replacement
   * passives are the exception and always apply), so its onUpkeep/onEndPhase/onAnyEndPhase hooks are skipped — except the hooks listed here, which
   * only process an already-activated ongoing effect (Amaterasu's burn, Spore Technique's drain, ...)
   * that the spec says keeps running.
   */
  runsHooksWhenInert?: ('upkeep' | 'endPhase' | 'anyEndPhase')[];
  /** Synergy tag(s) (SPEC.md §6.4) — drives the Upkeep Synergy discount (§6.5) and Synergy-conditional card text. Flavor otherwise, never required to legally play/activate anything. */
  synergy?: string[];
}

const registry: Record<string, CharacterDef> = {};

export function registerCharacter(def: CharacterDef): void {
  registry[def.id] = def;
}

export function getCharacterDef(id: string): CharacterDef | undefined {
  return registry[id];
}

/**
 * A Token that can activate its own abilities (e.g. Sasori's Third Kazekage
 * and Puppet Soldier) — much lighter than CharacterDef, since Tokens have no
 * Chakra Pool, Styles, or Ultimate of their own (SPEC.md §10 default).
 */
export interface TokenDef {
  id: string;
  name: string;
  abilities: AbilityDef[];
  /** Caps total ability activations per turn across all of this Token's abilities (e.g. Deva Path's "only 2 of its own abilities per turn"). */
  maxAbilitiesPerTurn?: number;
  /** Fires at this Token's own controller's Upkeep Phase (e.g. Naraka Path's delayed heal/revive). */
  onUpkeep?: (state: GameState, instanceId: string) => GameState;
  /** Fires at this Token's own controller's End Phase (e.g. Deva Path's Almighty Push). */
  onEndPhase?: (state: GameState, instanceId: string) => GameState;
}

const tokenRegistry: Record<string, TokenDef> = {};

export function registerTokenDef(def: TokenDef): void {
  tokenRegistry[def.id] = def;
}

export function getTokenDef(id: string): TokenDef | undefined {
  return tokenRegistry[id];
}

export function createCharacterInstance(defId: string, owner: PlayerId, instanceId: string, turn: number): CharacterInstance {
  const def = registry[defId];
  if (!def) throw new Error(`Unknown character def: ${defId}`);
  return {
    instanceId,
    defId,
    owner,
    name: def.name,
    rank: def.rank,
    maxHP: def.baseMaxHP,
    currentHP: def.baseMaxHP,
    chakraPool: { current: 0, capacity: def.basePoolCapacity },
    styles: def.styles,
    status: { disabled: false, retreated: false, enteredTurn: turn, hasAmbush: false, usedAbilitiesThisTurn: [], pooledThisTurn: false },
    extra: { ...(def.initialExtra ?? {}) },
  };
}
