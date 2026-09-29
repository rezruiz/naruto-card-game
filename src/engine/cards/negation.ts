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

/**
 * The shared "redirect it onto X instead, reduced by N" pattern (Puppet
 * Shell Guard, Mechanized Guard, Chakra Absorption, Absorb Impact, Yahiko
 * Sacrifices Himself): the waiting attack's target is rewritten to the new
 * unit — every part of its effect follows — and the damage it deals there
 * is adjusted when it resolves (combat.ts reads StackItem.damageAdjust).
 */
export function redirectAttack(
  state: GameState,
  stackItemId: string,
  fromInstanceId: string,
  toInstanceId: string,
  adjust: { reduceBy?: number; toZero?: boolean },
  guardName: string,
): GameState {
  const idx = state.stack.findIndex((item) => item.id === stackItemId);
  if (idx === -1) return appendLog(state, `${guardName} finds nothing left to redirect.`);
  const item = state.stack[idx];
  const targets = item.targets.map((t) => (t === fromInstanceId ? toInstanceId : t));
  const damageAdjust = { ...(item.damageAdjust ?? {}), [toInstanceId]: adjust };
  const stack = state.stack.slice();
  stack[idx] = { ...item, targets, damageAdjust };
  const fromName = findOccupant(state, fromInstanceId)?.occupant.name ?? 'its target';
  const toName = findOccupant(state, toInstanceId)?.occupant.name ?? 'the guard';
  const detail = adjust.toZero ? ', reduced to 0' : adjust.reduceBy ? `, reduced by ${adjust.reduceBy}` : '';
  return appendLog({ ...state, stack }, `${guardName} redirects ${item.abilityName} from ${fromName} onto ${toName}${detail}.`);
}

/**
 * "What would happen if this waiting attack resolved right now?" — runs it
 * on a throwaway copy of the state (the engine is pure, so nothing leaks).
 * Used for conditions like Yahiko's "an attack that would defeat it,
 * calculated after any damage-reduction effects".
 */
export function simulateResolution(state: GameState, item: StackItem): GameState {
  const sim: GameState = {
    ...state,
    stack: state.stack.filter((i) => i.id !== item.id),
    resolving: {
      itemId: item.id,
      sourceInstanceId: item.sourceInstanceId,
      abilityId: item.abilityId,
      controllerId: item.controllerId,
      targets: item.targets,
      damageAdjust: item.damageAdjust,
    },
  };
  try {
    return item.resolve(sim, item);
  } catch {
    return state;
  }
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
