import { PHASE_ORDER } from './types';
import { placeChakraSource, poolChakra, tapChakraSource } from './chakra';
import { advancePhase, appendLog, appendWarning } from './phases/phaseMachine';
import { activateAbility } from './abilities';
import { passPriority } from './stack';
import { tickAllPoison } from './poison';
import { tickChakraSpores } from './chakraSpore';
import { tickScheduledHeals } from './scheduledHeals';
import { payUpkeep } from './upkeep';
import { retreat, returnFromRetreat } from './retreat';
import { chooseCharacter, drawForDrawPhase, drawFromCharacterDeck, mulligan } from './deck';
import { currentTax, playCharacter } from './playCharacter';
import { getCharacterDeckEntry } from './characters';
import { revealHandCards } from './handReveal';
import { resolveChoice } from './choices';
import { returnCharacterToHand, returnInPlayCardToHand } from './trust/returnToHand';
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
import type { GameAction, GameState, PlayerId, PlayerState, Phase } from './types';

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
 * SPEC.md §8: turns each of a player's defeated characters (recorded by
 * combat.ts — it can't see hand cards' ranks without an import cycle) into
 * what the Reinforcement rule gives them:
 * - a D-rank defeat: nothing.
 * - a C+ defeat with another C+ still in play: an optional offer to pay the
 *   current tax for a look-2-pick-1 (the tax counter doesn't move).
 * - their LAST C+ in play (D-ranks ignored): if they hold a C+ character
 *   card, they must play one; otherwise an optional FREE look-2-pick-1.
 */
function drainPendingReinforcements(state: GameState): GameState {
  let next = state;
  for (const player of ['p1', 'p2'] as PlayerId[]) {
    const events = next.players[player].pendingReinforcementEvents;
    if (events.length === 0) continue;
    let p: PlayerState = { ...next.players[player], pendingReinforcementEvents: [] };
    const notes: string[] = [];
    for (const event of events) {
      // Emergency Relief counts every own loss, D-ranks included.
      next = runMissionTrigger({ ...next, players: { ...next.players, [player]: p } }, player, { kind: 'own-loss', rank: event.rank });
      p = next.players[player];
      if (event.rank === 'D') {
        notes.push(`${player}'s D-rank character doesn't trigger a Reinforcement.`);
        continue;
      }
      if (!event.lastCPlus) {
        p = { ...p, reinforcementOffers: [...p.reinforcementOffers, 'paid'] };
        notes.push(`${player} may pay ${currentTax(next, player)} Chakra for a Reinforcement draw (look at 2, keep 1).`);
        continue;
      }
      const cPlusInHand = p.hand.some((h) => h.kind === 'character' && (getCharacterDeckEntry(h.entryId)?.rank ?? 'D') !== 'D');
      if (cPlusInHand) {
        p = { ...p, mustPlayCharacter: true };
        notes.push(`${player} lost their last C+ character and must play a C+ character from hand now (free).`);
      } else {
        p = { ...p, reinforcementOffers: [...p.reinforcementOffers, 'free'] };
        notes.push(`${player} lost their last C+ character — they may take a free Reinforcement draw (look at 2, keep 1).`);
      }
    }
    next = { ...next, players: { ...next.players, [player]: p } };
    for (const note of notes) next = appendLog(next, note);
  }
  return next;
}

/**
 * SPEC.md §3: the first-player coin flip happens once BOTH players have
 * finished Setup. Starting characters were placed before anyone knew who
 * goes first, so their Field Orientation turn is set here (turn 1 for the
 * first player, turn 2 for the second).
 */
function flipForFirstPlayer(state: GameState): GameState {
  if (!state.firstPlayerPending || setupPending(state)) return state;
  const first: PlayerId = Math.random() < 0.5 ? 'p1' : 'p2';
  const players = { ...state.players };
  for (const id of ['p1', 'p2'] as PlayerId[]) {
    const enteredTurn = id === first ? 1 : 2;
    const p = players[id];
    players[id] = {
      ...p,
      backRow: p.backRow.map((c) => (c ? { ...c, status: { ...c.status, enteredTurn } } : c)),
      frontRow: p.frontRow.map((t) => (t ? { ...t, status: { ...t.status, enteredTurn } } : t)),
    };
  }
  // Both picks were kept secret until now (§3) — reveal them together.
  const startingName = (id: PlayerId) => {
    const p = players[id];
    if (p.frontRow.some((t) => t?.extra.painPath)) return 'Pain of the Six Paths';
    return p.backRow.find((c) => c?.instanceId === p.startingCharacterInstanceId)?.name ?? 'a character';
  };
  const revealed = appendLog(
    { ...state, players, firstPlayerPending: false, firstPlayer: first, activePlayer: first, priorityPlayer: first },
    `Starting characters revealed — p1: ${startingName('p1')}, p2: ${startingName('p2')}.`,
  );
  return appendLog(revealed, `Setup complete — coin flip: ${first} goes first.`);
}

/** Anything a player still has to answer before the game should move to the next phase — null when nothing is outstanding. */
export function outstandingDecision(state: GameState): string | null {
  for (const player of ['p1', 'p2'] as PlayerId[]) {
    const p = state.players[player];
    if (p.mustPlayCharacter) return `${player} must play a C+ character from hand first.`;
    if (p.reinforcementOffers.length > 0) return `${player} hasn't answered their Reinforcement offer yet.`;
    if (p.pendingHandReveal) return `${player} hasn't revealed their cards for Field Intelligence yet.`;
    if (p.pendingCharacterReveal) return `${player} hasn't picked from their Character Deck reveal yet.`;
  }
  const choice = state.pendingChoices[0];
  return choice ? `${choice.player} still has a choice to make: ${choice.prompt}` : null;
}

function answerReinforcement(state: GameState, player: PlayerId, accept: boolean): GameState {
  const p = state.players[player];
  const [offer, ...rest] = p.reinforcementOffers;
  if (!offer) return appendLog(state, `${player} has no Reinforcement offer to answer.`);
  if (!accept) {
    return appendLog({ ...state, players: { ...state.players, [player]: { ...p, reinforcementOffers: rest } } }, `${player} declines the Reinforcement draw.`);
  }
  const drawn = drawFromCharacterDeck(state, player, offer === 'free' ? 'reinforcement-free' : 'reinforcement-paid');
  // Only consume the offer if the draw actually happened (e.g. not refused for lack of Chakra — tap more and try again).
  if (!drawn.players[player].pendingCharacterReveal) return drawn;
  return { ...drawn, players: { ...drawn.players, [player]: { ...drawn.players[player], reinforcementOffers: rest } } };
}

function setRules(state: GameState, rules: GameState['rules']): GameState {
  if (state.rules === rules) return state;
  if (state.staged.length > 0 || state.pendingFinalize) {
    return appendLog(state, "Can't switch rules modes while actions are declared or being resolved — resolve or withdraw them first.");
  }
  return appendLog({ ...state, rules }, rules === 'trust' ? 'Trust mode turned ON — declared actions, advisory warnings.' : 'Trust mode turned OFF — the engine now enforces every rule.');
}

function setSquadRedirect(state: GameState, missionInstanceId: string, redirectTo: string | null): GameState {
  for (const player of ['p1', 'p2'] as PlayerId[]) {
    const p = state.players[player];
    const mission = p.missionsInPlay.find((m) => m.instanceId === missionInstanceId);
    if (!mission) continue;
    const missionsInPlay = p.missionsInPlay.map((m) => (m.instanceId === missionInstanceId ? { ...m, extra: { ...m.extra, redirectTo } } : m));
    const name = redirectTo ? (state.players[player].backRow.find((c) => c?.instanceId === redirectTo)?.name ?? 'a group member') : null;
    return appendLog(
      { ...state, players: { ...state.players, [player]: { ...p, missionsInPlay } } },
      name ? `${player} sets Squad Formation to redirect hits to ${name}.` : `${player} turns Squad Formation's redirect off.`,
    );
  }
  return state;
}

/** SPEC.md §10b: feeds every queued "you defeated an enemy of Rank X" event (recorded by combat.ts) to that player's in-play Missions (the Bingo Book family) — same drain pattern as Reinforcement draws, for the same import-cycle reason. */
function drainPendingMissionDefeatEvents(state: GameState): GameState {
  let next = state;
  for (const player of ['p1', 'p2'] as PlayerId[]) {
    while (next.players[player].pendingDefeatEvents.length > 0) {
      const [event, ...rest] = next.players[player].pendingDefeatEvents;
      next = { ...next, players: { ...next.players, [player]: { ...next.players[player], pendingDefeatEvents: rest } } };
      next = runMissionTrigger(next, player, { kind: 'defeat', rank: event.rank, byInstanceId: event.byInstanceId });
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
  // The Draw Phase draw itself is a manual click (DRAW_PHASE_CARD), never automatic.
  return next;
}

/** Guards a phase advance against unanswered decisions: refused under the strict rules, allowed with an advisory in trust mode. */
function guardedAdvance(state: GameState, advance: (s: GameState) => GameState): GameState {
  const outstanding = outstandingDecision(state);
  if (!outstanding) return advance(state);
  if (state.rules !== 'trust') return appendLog(state, `Can't move to the next phase yet: ${outstanding}`);
  return advance(appendWarning(state, `Moving on with a decision still open — ${outstanding} (trust mode — allowed).`));
}

const AUTO_PHASES = new Set(['Untap', 'Upkeep']);

/** True when an advance didn't move the game on at all (an open decision blocked it under the strict rules). A granted second Combat keeps the phase but does move on. */
function advanceWasBlocked(before: GameState, after: GameState): boolean {
  return after.phase === before.phase && after.turn === before.turn && after.extraCombatPending === before.extraCombatPending;
}

/**
 * Ends the active player's turn: steps through the rest of it (End-of-turn
 * effects included) into the other player's — in trust mode on to their
 * Main 1 (Untap, Upkeep and auto-draw run as usual). Stops early if an open
 * decision blocks a step under the strict rules.
 */
function passTurn(state: GameState): GameState {
  if (state.staged.length > 0 || state.pendingFinalize) return appendLog(state, 'Resolve or withdraw the declared actions before passing the turn.');
  const passing = state.activePlayer;
  let next = appendLog(state, `${passing} passes the turn.`);
  for (let guard = 0; guard < PHASE_ORDER.length + 1 && next.activePlayer === passing && !next.winner; guard++) {
    const before = next;
    next = guardedAdvance(next, advanceOnePhase);
    if (advanceWasBlocked(before, next)) return next;
  }
  return next;
}

/**
 * Clicking a phase (this turn): forward steps through each phase with its
 * normal automation (Upkeep payment, auto-draw) and checks; back just moves
 * the marker — nothing is re-run — and is a trust-mode correction only.
 */
function goToPhase(state: GameState, target: Phase): GameState {
  if (state.staged.length > 0 || state.pendingFinalize) return appendLog(state, 'Resolve or withdraw the declared actions before changing phase.');
  const from = PHASE_ORDER.indexOf(state.phase);
  const to = PHASE_ORDER.indexOf(target);
  if (to === from) return state;
  if (to < from) {
    if (state.rules !== 'trust') return appendLog(state, `Can't go back to ${target} under the strict rules.`);
    return appendWarning({ ...state, phase: target }, `${state.activePlayer} goes back to ${target} (manual) — nothing from the phases in between is undone or re-run (trust mode).`);
  }
  let next = state;
  const turn = state.turn;
  while (next.phase !== target && next.turn === turn && !next.winner) {
    const before = next;
    if (next.rules === 'trust' && next.phase === 'Draw' && next.options?.autoDraw !== false && !next.players[next.activePlayer].drawnThisDrawPhase) {
      next = drawForDrawPhase(next);
    }
    next = guardedAdvance(next, advanceOnePhase);
    if (advanceWasBlocked(before, next)) break;
  }
  return next;
}

/** Trust mode: nobody needs to click through Untap/Upkeep — a new turn lands on the Draw Phase, waiting for the manual draw. */
function runToMainPhase(state: GameState): GameState {
  let next = state;
  // Auto-draw (on by default): the Draw Phase takes its draw and moves on, like Untap/Upkeep.
  const autoDraw = (s: GameState) => s.phase === 'Draw' && s.options?.autoDraw !== false;
  while (next.rules === 'trust' && (AUTO_PHASES.has(next.phase) || autoDraw(next)) && !next.winner && !setupPending(next) && !next.firstPlayerPending) {
    if (autoDraw(next) && !next.players[next.activePlayer].drawnThisDrawPhase) next = drawForDrawPhase(next);
    next = advanceOnePhase(next);
  }
  return next;
}

const trustHooks: TrustHooks = { advance: (s) => runToMainPhase(advanceOnePhase(s)) };

/** SPEC.md §10b: a Mission is discarded the moment its Condition fails — checked after every action. */
function checkMissions(state: GameState): GameState {
  let next = state;
  for (const player of ['p1', 'p2'] as PlayerId[]) {
    if (next.players[player].missionsInPlay.length > 0) next = runMissionTrigger(next, player, { kind: 'check' });
  }
  return next;
}

function drainAll(state: GameState): GameState {
  return checkMissions(drainPendingMissionDefeatEvents(drainPendingReinforcements(state)));
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  // Anything queued along the way (Reinforcement triggers, Mission triggers) is settled immediately, so its prompt shows up right when the defeat resolves.
  const result = flipForFirstPlayer(drainAll(forceOutOfRetreat(reduce(state, action))));
  return result.rules === 'trust' ? runToMainPhase(result) : result;
}

const SETUP_ACTIONS = new Set<GameAction['type']>(['CHOOSE_CHARACTER', 'MULLIGAN', 'SET_RULES', 'SET_OPTION']);

function reduce(state: GameState, action: GameAction): GameState {
  const drained = drainAll(state);
  if (setupPending(drained) && !SETUP_ACTIONS.has(action.type)) {
    return drained;
  }
  const trust = drained.rules === 'trust';

  switch (action.type) {
    case 'ADVANCE_PHASE':
      return guardedAdvance(drained, advanceOnePhase);
    case 'SET_RULES':
      return setRules(drained, action.rules);
    case 'PASS_TURN':
      return passTurn(drained);
    case 'GO_TO_PHASE':
      return goToPhase(drained, action.phase);
    case 'SET_OPTION':
      return appendLog(
        { ...drained, options: { ...drained.options, [action.option]: action.value } },
        `${action.option === 'autoDraw' ? 'Auto-draw' : 'Always confirm'} turned ${action.value ? 'on' : 'off'}.`,
      );
    case 'DRAW_PHASE_CARD': {
      const drawn = drawForDrawPhase(drained);
      // Trust mode: nothing else happens in the Draw Phase, so taking the draw moves straight on to Main Phase 1.
      return trust && drawn.phase === 'Draw' && drawn.players[drawn.activePlayer].drawnThisDrawPhase ? advanceOnePhase(drawn) : drawn;
    }
    case 'DRAW_CHARACTER_DECK':
      return drawFromCharacterDeck(drained, action.player, 'manual');
    case 'ACCEPT_REINFORCEMENT':
      return answerReinforcement(drained, action.player, true);
    case 'DECLINE_REINFORCEMENT':
      return answerReinforcement(drained, action.player, false);
    case 'REVEAL_HAND_CARDS':
      return revealHandCards(drained, action.player, action.instanceIds);
    case 'RESOLVE_CHOICE':
      return resolveChoice(drained, action.choiceId, action.optionIds);
    case 'SET_SQUAD_REDIRECT':
      return setSquadRedirect(drained, action.missionInstanceId, action.redirectTo);
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
        { choices: action.choices },
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
      return playCharacter(drained, action.instanceId, action.slot);
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
      return stageAbility(drained, action.instanceId, action.abilityId, action.targetInstanceIds, action.payFromPool, trustHooks, action.choices, action.force);
    case 'STAGE_CARD':
      return stageCard(drained, action.instanceId, action.enablingInstanceId, action.targetInstanceIds, action.payFromPool, action.amount, trustHooks, action.force);
    case 'RETARGET_STAGED':
      return retargetStaged(drained, action.stagedId, action.targetInstanceIds, trustHooks);
    case 'UNSTAGE':
      return unstage(drained, action.stagedId, trustHooks);
    case 'MOVE_STAGED':
      return moveStaged(drained, action.stagedId, action.direction, trustHooks);
    case 'RESOLVE_ACTIONS':
      return startFinalize(drained, action.player, false, trustHooks);
    case 'FINALIZE_PHASE':
      return startFinalize(outstandingDecision(drained) ? appendLog(drained, `Heads up — ${outstandingDecision(drained)}`) : drained, action.player, true, trustHooks);
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
    case 'RETURN_CHARACTER_TO_HAND':
      return returnCharacterToHand(drained, action.instanceId);
    case 'RETURN_IN_PLAY_CARD_TO_HAND':
      return returnInPlayCardToHand(drained, action.instanceId);
    default:
      return drained;
  }
}
