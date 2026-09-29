import { placeChakraSource, poolChakra, tapChakraSource } from './chakra';
import { advancePhase, appendLog } from './phases/phaseMachine';
import { activateAbility } from './abilities';
import { passPriority } from './stack';
import { tickAllPoison } from './poison';
import { tickChakraSpores } from './chakraSpore';
import { tickScheduledHeals } from './scheduledHeals';
import { payUpkeep } from './upkeep';
import { retreat, returnFromRetreat } from './retreat';
import { chooseCharacter, drawCard, mulligan, revealCharacters } from './deck';
import { playCharacter } from './playCharacter';
import { playHandCard } from './cards/playHandCard';
import { runMissionTrigger } from './cards/missionRunner';
import { forceOutOfRetreat } from './retreatCollapse';
import {
  approveResolve,
  cancelFinalize,
  moveStaged,
  retargetStaged,
  stageAbility,
  stageCard,
  startFinalize,
  unstage,
  type TrustHooks,
} from './trust/staging';
import {
  adjustGenericChakra,
  adjustHp,
  adjustPlayerHealth,
  adjustPool,
  dealManualDamage,
  deckTake,
  deckToBottom,
  drawCards,
  moveHandCard,
  returnFromConsumed,
  returnFromDiscard,
  shuffleDeck,
  toggleStatus,
  untapChakraSource,
} from './trust/manual';
import type { GameAction, GameState, PlayerId } from './types';

/**
 * SPEC.md §3: initial Setup isn't done until both players have chosen a
 * starting character — nothing else should be actionable until then. Keyed
 * off startingCharacterInstanceId specifically (set once, during Setup, and
 * never touched again) rather than "any pendingCharacterReveal exists" —
 * a later mid-game Reinforcement reveal (§8) also sets pendingCharacterReveal,
 * but resolving it shouldn't halt the entire game for both players the way
 * incomplete initial Setup does; the affected player can just resolve it via
 * CHOOSE_CHARACTER whenever convenient while everything else keeps moving.
 */
export function setupPending(state: GameState): boolean {
  return state.players.p1.startingCharacterInstanceId === null || state.players.p2.startingCharacterInstanceId === null;
}

/**
 * SPEC.md §8: a character being defeated owes its controller a Reinforcement
 * draw-2-keep-1 reveal — combat.ts can't trigger this itself (importing
 * deck.ts from there would cycle back through characters -> combat.ts), so
 * every dispatched action first drains any such reveals still owed.
 */
function drainPendingReinforcements(state: GameState): GameState {
  let next = state;
  for (const player of ['p1', 'p2'] as PlayerId[]) {
    while (next.players[player].pendingReinforcementDraws > 0 && next.players[player].pendingCharacterReveal === null) {
      next = {
        ...next,
        players: { ...next.players, [player]: { ...next.players[player], pendingReinforcementDraws: next.players[player].pendingReinforcementDraws - 1 } },
      };
      next = revealCharacters(next, player, 2, 'reinforcement');
    }
  }
  return next;
}

/** SPEC.md §10b: feeds every queued "you defeated an enemy of Rank X" event (recorded by combat.ts) to that player's in-play Missions (the Bingo Book family) — same drain pattern as Reinforcement draws, for the same import-cycle reason. */
function drainPendingMissionDefeatEvents(state: GameState): GameState {
  let next = state;
  for (const player of ['p1', 'p2'] as PlayerId[]) {
    while (next.players[player].pendingDefeatEvents.length > 0) {
      const [event, ...rest] = next.players[player].pendingDefeatEvents;
      next = { ...next, players: { ...next.players, [player]: { ...next.players[player], pendingDefeatEvents: rest } } };
      next = runMissionTrigger(next, player, { kind: 'defeat', rank: event.rank });
    }
  }
  return next;
}

/** One phase forward, with all of the phase-entry automation (Upkeep payment, poison/spore/heal ticks, Draw Phase draw, Untap-triggered Missions). */
function advanceOnePhase(input: GameState): GameState {
  // A combat step that cleared a player's board forces their Retreated characters out and earns the attacker a second Combat (retreatCollapse.ts) instead of moving on.
  const state = forceOutOfRetreat(input);
  if (state.phase === 'Combat' && state.extraCombatPending) {
    return appendLog({ ...state, extraCombatPending: false }, `${state.activePlayer} begins a second Combat — attack actions not yet used this turn are still available.`);
  }
  let next = advancePhase(state);
  if (next.phase === 'Untap') {
    next = runMissionTrigger(next, next.activePlayer, { kind: 'untap' });
  }
  if (next.phase === 'Upkeep') {
    next = payUpkeep(next, next.activePlayer);
    next = tickAllPoison(next);
    next = tickChakraSpores(next, next.activePlayer);
    next = tickScheduledHeals(next, next.activePlayer);
  }
  if (next.phase === 'Draw') {
    // SPEC.md §4.3: the very first player's very first turn skips the Draw Phase.
    const skip = next.turn === 1 && next.activePlayer === next.firstPlayer;
    if (!skip) next = drawCard(next, next.activePlayer);
  }
  return next;
}

const AUTO_PHASES = new Set(['Untap', 'Upkeep', 'Draw']);

/** Trust mode: nobody needs to click through Untap/Upkeep/Draw — a new turn lands straight on Main Phase 1. */
function runToMainPhase(state: GameState): GameState {
  let next = state;
  while (next.rules === 'trust' && AUTO_PHASES.has(next.phase) && !next.winner && !setupPending(next)) next = advanceOnePhase(next);
  return next;
}

const trustHooks: TrustHooks = { advance: (s) => runToMainPhase(advanceOnePhase(s)) };

function drainAll(state: GameState): GameState {
  return drainPendingMissionDefeatEvents(drainPendingReinforcements(state));
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  const result = forceOutOfRetreat(reduce(state, action));
  // Trust mode resolves many actions in one go, so anything queued along the way (Reinforcement draws, Mission triggers) is settled immediately rather than at the next action.
  return result.rules === 'trust' ? runToMainPhase(drainAll(result)) : result;
}

function reduce(state: GameState, action: GameAction): GameState {
  const drained = drainAll(state);
  if (setupPending(drained) && action.type !== 'CHOOSE_CHARACTER' && action.type !== 'MULLIGAN') {
    return drained;
  }
  const trust = drained.rules === 'trust';

  switch (action.type) {
    case 'ADVANCE_PHASE':
      return advanceOnePhase(drained);
    case 'PLACE_CHAKRA_SOURCE':
      return placeChakraSource(drained, action.instanceId);
    case 'TAP_CHAKRA_SOURCE':
      return tapChakraSource(drained, action.sourceIndex, action.player);
    case 'POOL_CHAKRA':
      return poolChakra(drained, action.instanceId, action.amount);
    case 'ACTIVATE_ABILITY':
      return activateAbility(
        drained,
        action.instanceId,
        action.abilityId,
        action.targetInstanceIds,
        action.payFromPool,
      );
    case 'PASS_PRIORITY':
      return passPriority(drained);
    case 'RETREAT':
      return retreat(drained, action.instanceId);
    case 'RETURN_FROM_RETREAT':
      return returnFromRetreat(drained, action.instanceId);
    case 'CHOOSE_CHARACTER':
      return chooseCharacter(drained, action.player, action.entryId);
    case 'MULLIGAN':
      return mulligan(drained, action.player);
    case 'PLAY_CHARACTER':
      return playCharacter(drained, action.instanceId);
    case 'PLAY_HAND_CARD': {
      // A hand card's controller is whoever's hand it's in — not necessarily
      // the active player (Reactive-speed cards are played on the opponent's
      // turn, in response to their action).
      const owner = drained.players.p1.hand.some((h) => h.instanceId === action.instanceId) ? 'p1' : 'p2';
      return playHandCard(drained, owner, action.instanceId, action.enablingInstanceId, action.targetInstanceIds, action.payFromPool, action.amount);
    }
  }

  // Everything below is trust-mode only (staging, resolution, manual fixes).
  if (!trust) return drained;
  switch (action.type) {
    case 'STAGE_ABILITY':
      return stageAbility(drained, action.instanceId, action.abilityId, action.targetInstanceIds, action.payFromPool, trustHooks);
    case 'STAGE_CARD':
      return stageCard(drained, action.instanceId, action.enablingInstanceId, action.targetInstanceIds, action.payFromPool, action.amount, trustHooks);
    case 'RETARGET_STAGED':
      return retargetStaged(drained, action.stagedId, action.targetInstanceIds, trustHooks);
    case 'UNSTAGE':
      return unstage(drained, action.stagedId, trustHooks);
    case 'MOVE_STAGED':
      return moveStaged(drained, action.stagedId, action.direction, trustHooks);
    case 'RESOLVE_ACTIONS':
      return startFinalize(drained, action.player, false, trustHooks);
    case 'FINALIZE_PHASE':
      return startFinalize(drained, action.player, true, trustHooks);
    case 'APPROVE_RESOLVE':
      return approveResolve(drained, action.player, trustHooks);
    case 'CANCEL_FINALIZE':
      return cancelFinalize(drained, action.player);
    case 'ADJUST_HP':
      return adjustHp(drained, action.instanceId, action.delta);
    case 'DEAL_DAMAGE':
      return dealManualDamage(drained, action.instanceId, action.amount);
    case 'ADJUST_POOL':
      return adjustPool(drained, action.instanceId, action.delta);
    case 'TOGGLE_STATUS':
      return toggleStatus(drained, action.instanceId, action.status);
    case 'ADJUST_PLAYER_HEALTH':
      return adjustPlayerHealth(drained, action.player, action.delta);
    case 'ADJUST_GENERIC_CHAKRA':
      return adjustGenericChakra(drained, action.player, action.delta);
    case 'UNTAP_CHAKRA_SOURCE':
      return untapChakraSource(drained, action.player, action.sourceIndex);
    case 'MOVE_HAND_CARD':
      return moveHandCard(drained, action.player, action.instanceId, action.to);
    case 'RETURN_FROM_DISCARD':
      return returnFromDiscard(drained, action.player, action.instanceId);
    case 'RETURN_FROM_CONSUMED':
      return returnFromConsumed(drained, action.player, action.instanceId);
    case 'DRAW_CARDS':
      return drawCards(drained, action.player, action.count);
    case 'SHUFFLE_DECK':
      return shuffleDeck(drained, action.player);
    case 'DECK_TAKE':
      return deckTake(drained, action.player, action.instanceId, action.shuffle);
    case 'DECK_TO_BOTTOM':
      return deckToBottom(drained, action.player, action.instanceId);
    default:
      return drained;
  }
}
