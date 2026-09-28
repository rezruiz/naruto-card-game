import { findOccupant } from '../board';
import { appendLog } from '../phases/phaseMachine';
import { findAbility } from '../abilities';
import { getHandCardDef } from './registry';
import type { AbilityType, GameState, PlayerId, StackItem } from '../types';

interface StackItemInfo {
  isDamaging: boolean;
  type: AbilityType;
  isUltimate: boolean;
  isForbidden: boolean;
}

/** Resolves a stack item's underlying AbilityDef (character/token) or HandCardDef (a played Jutsu/Assist card) — the two live in separate registries but a negation card needs to see through either. */
export function stackItemInfo(state: GameState, item: StackItem): StackItemInfo | undefined {
  const attacker = findOccupant(state, item.sourceInstanceId);
  const ability = attacker ? findAbility(attacker.occupant.defId, item.abilityId) : undefined;
  if (ability) {
    return { isDamaging: !!ability.isDamaging, type: ability.type, isUltimate: !!ability.isUltimate, isForbidden: !!ability.isForbidden };
  }
  const cardDef = getHandCardDef(item.abilityId);
  if (cardDef) return { isDamaging: !!cardDef.isDamaging, type: cardDef.type, isUltimate: false, isForbidden: false };
  return undefined;
}

/** Removes the first stack item matching `predicate` and targeting `targetInstanceId` from an enemy controller — the shared "negate its targeting" pattern (Substitution family, Jutsu Disruption, and every character-side negation ability this session). Returns the negated item (for cards with a bonus effect keyed off it) alongside the resulting state. */
export function negateFirstMatchingAttack(
  state: GameState,
  controllerId: PlayerId,
  targetInstanceId: string,
  cardName: string,
  predicate: (info: StackItemInfo) => boolean,
): { state: GameState; negated: StackItem | null } {
  const idx = state.stack.findIndex((item) => {
    if (!item.targets.includes(targetInstanceId) || item.controllerId === controllerId) return false;
    const info = stackItemInfo(state, item);
    return !!info && predicate(info);
  });
  if (idx === -1) return { state: appendLog(state, `${cardName} finds nothing left to negate.`), negated: null };
  const negated = state.stack[idx];
  let next = { ...state, stack: [...state.stack.slice(0, idx), ...state.stack.slice(idx + 1)] };
  next = appendLog(next, `${cardName} negates ${negated.abilityName}, targeting fails.`);
  return { state: next, negated };
}
