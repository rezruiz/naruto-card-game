// Prototype rules (the Prototype build only — see variant.ts). A game created
// with ruleset 'prototype' plays the new direction from the Design Draft:
//
// - No generic Chakra spending: Chakra sources are still tapped, but that
//   Chakra can only be pooled. Every Chakra cost — a character's abilities and
//   the Jutsu cards a Leader enables — is paid from a Chakra Pool.
// - Supplies: a second resource that refills each turn. Your maximum is the
//   number of turns you've started (1 on your first turn), up to 20.
//   Shinobi cards cost Supplies, and so does every other non-Chakra cost.
// - Only Jutsu and Shinobi cards can be played as Chakra sources.
// - Shinobi: units with Damage and Health that fight on their own (shinobi.ts).
//
// Base-game states (no ruleset) never take any of these paths.
import { appendLog, appendWarning } from './phases/phaseMachine';
import type { GameState, PlayerId } from './types';

export function isPrototype(state: GameState): boolean {
  return state.ruleset === 'prototype';
}

export const SUPPLIES_CAP = 20;

/** How many turns this player has started this game (their first turn counts as 1). */
function turnsStarted(state: GameState, player: PlayerId): number {
  return player === state.firstPlayer ? Math.ceil(state.turn / 2) : Math.floor(state.turn / 2);
}

/** This player's Supplies maximum right now: 1 on their first turn, +1 each turn after, capped at 20. */
export function suppliesMax(state: GameState, player: PlayerId): number {
  return Math.min(SUPPLIES_CAP, Math.max(0, turnsStarted(state, player)));
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
