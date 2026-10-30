// Prototype rules (the Prototype build only — see variant.ts). A game created
// with ruleset 'prototype' plays the new direction from the Design Draft:
//
// - No generic Chakra spending: Chakra sources are still tapped, but that
//   Chakra can only be pooled. Every Chakra cost — a character's abilities and
//   the Jutsu cards a Leader enables — is paid from a Chakra Pool.
// - Supplies: a second resource that refills each turn. Your maximum is the
//   number of turns you've started (1 on your first turn), up to 20.
//   Jutsu cards cost Chakra; every other card (Shinobi, Missions, Terrain,
//   Assists) costs Supplies, and so does every other non-Chakra cost.
// - Only Jutsu and Shinobi cards can be discarded as Chakra sources.
//   Both are defaults: a card can say otherwise (HandCardDef.paidWith / chakraSource).
// - Shinobi: units with Damage and Health that fight on their own (shinobi.ts).
//
// Base-game states (no ruleset) never take any of these paths.
import { appendLog, appendWarning } from './phases/phaseMachine';
import { TERRAIN, hasTerrain } from './terrainEffects';
import { painPaths } from './board';
import type { GameState, PlayerId } from './types';

export function isPrototype(state: GameState): boolean {
  return state.ruleset === 'prototype';
}

export const SUPPLIES_CAP = 20;

/**
 * Bringing out a new Leader (deck.ts). After one of your Leaders is defeated it's free: pick any Leader from your
 * Leader Deck. Deploying one early, while your Leaders still stand, costs 8 Supplies, then 10, then 12 from then on
 * (only early deploys count): reveal 2 random Leaders and deploy 1.
 */
export const EARLY_DEPLOY_COSTS = [8, 10, 12];

/** What this player's next early Leader deploy costs, given how many they've made so far. */
export function earlyDeployCost(deploysSoFar: number): number {
  return EARLY_DEPLOY_COSTS[Math.min(deploysSoFar, EARLY_DEPLOY_COSTS.length - 1)];
}

/** Character Deck cards that aren't Leaders in the Prototype — they're Shinobi in the main deck instead (shinobi.ts). */
export const NOT_LEADERS = new Set(['amegakure-civilian-rebel', 'yahiko']);

/** How many turns this player has started this game (their first turn counts as 1). */
function turnsStarted(state: GameState, player: PlayerId): number {
  return player === state.firstPlayer ? Math.ceil(state.turn / 2) : Math.floor(state.turn / 2);
}

/** This player's Supplies maximum right now: 1 on their first turn, +1 each turn after (+2 while Supply Depot is in play), capped at 20. */
export function suppliesMax(state: GameState, player: PlayerId): number {
  return Math.min(SUPPLIES_CAP, Math.max(0, turnsStarted(state, player)) + (state.players[player].supplyGrowthBonus ?? 0));
}

/** Start of a player's turn (Untap): with Supply Depot in play, their Supplies maximum grows by 1 more than usual. */
export function tickSupplyDepot(state: GameState, player: PlayerId): GameState {
  if (!isPrototype(state) || !hasTerrain(state, player, TERRAIN.supplyDepot)) return state;
  const p = state.players[player];
  const next = { ...state, players: { ...state.players, [player]: { ...p, supplyGrowthBonus: (p.supplyGrowthBonus ?? 0) + 1 } } };
  return appendLog(next, `Supply Depot: ${player}'s Supplies grow by 2 this turn.`);
}

export function suppliesAvailable(state: GameState, player: PlayerId): number {
  return Math.max(0, suppliesMax(state, player) - (state.players[player].suppliesSpent ?? 0));
}

/**
 * Spends Supplies for `what`. Under the strict rules a shortfall refuses (returns null);
 * trust mode spends what's there and logs the shortfall as a warning.
 */
export function spendSupplies(state: GameState, player: PlayerId, amount: number, what: string): GameState | null {
  if (amount <= 0) return state;
  const available = suppliesAvailable(state, player);
  let next = state;
  if (amount > available) {
    if (state.rules !== 'trust') return null;
    next = appendWarning(next, `${player} is short ${amount - available} Supplies for ${what} (trust mode — allowed).`);
  }
  const paid = Math.min(amount, available);
  const p = next.players[player];
  next = { ...next, players: { ...next.players, [player]: { ...p, suppliesSpent: (p.suppliesSpent ?? 0) + paid } } };
  return appendLog(next, `${player} pays ${paid} Supplies for ${what}.`);
}

/** Trust-mode correction: add (or remove) Supplies for this turn. */
export function adjustSupplies(state: GameState, player: PlayerId, delta: number): GameState {
  const p = state.players[player];
  const spent = (p.suppliesSpent ?? 0) - delta;
  return appendLog({ ...state, players: { ...state.players, [player]: { ...p, suppliesSpent: spent } } }, `${player}'s Supplies adjusted by ${delta > 0 ? '+' : ''}${delta} (manual).`);
}

/**
 * Prototype rules: there's no player Health. A player loses when every one of their characters has been
 * defeated — none left in play (Pain counts while any Path stands), in hand, being revealed, or in the
 * Character Deck. This counts what's left.
 */
export function charactersRemaining(state: GameState, player: PlayerId): number {
  const p = state.players[player];
  const inPlay = p.backRow.filter((c) => c !== null).length + (painPaths(state, player).length > 0 ? 1 : 0);
  const inHand = p.hand.filter((h) => h.kind === 'character').length;
  const revealed = p.pendingCharacterReveal?.revealed.length ?? 0;
  return inPlay + inHand + revealed + p.characterDeck.length;
}

