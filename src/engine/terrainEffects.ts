// Prototype rules: which Terrain a player has in play. The Terrain cards
// themselves (and the effects that need the board) live in cards/terrain.ts;
// this module only answers "is this Terrain in play", so the low-level rules
// (prototype.ts, board.ts, combat.ts, shinobi.ts) can check it without an
// import cycle.
import type { GameState, PlayerId } from './types';

export const TERRAIN = {
  akatsukiHideout: 'akatsuki-hideout',
  amegakure: 'terrain-amegakure',
  supplyDepot: 'terrain-supply-depot',
  blacksmithVillage: 'terrain-blacksmith-village',
  trainingGrounds: 'terrain-training-grounds',
  forestOfDeath: 'terrain-forest-of-death',
  hiddenMist: 'terrain-hidden-mist',
  shinobiGraveyard: 'terrain-shinobi-graveyard',
  valleyOfTheEnd: 'terrain-valley-of-the-end',
} as const;

/** Whether `player` has this Terrain in play, under the Prototype rules (the base game's Terrain work as SPEC.md says). */
export function hasTerrain(state: GameState, player: PlayerId, defId: string): boolean {
  return state.ruleset === 'prototype' && state.players[player].terrainInPlay?.defId === defId;
}

/** The Shinobi Amegakure, Village Hidden in the Rain buffs: the Rain Village Shinobi and Amegakure Civilian Rebels. */
export function isRainShinobi(defId: string): boolean {
  return /^shinobi-(rain-|amegakure-civilian-rebel$)/.test(defId);
}

/** Amegakure: +1 Damage, +1 Health and 1 Supply cheaper to play (to a minimum of 1), for this player's Rain Village Shinobi and Rebels. */
export function amegakureBuffs(state: GameState, player: PlayerId, defId: string): boolean {
  return hasTerrain(state, player, TERRAIN.amegakure) && isRainShinobi(defId);
}

/** A Terrain that works for both sides: in play on either. */
export function terrainOnEitherSide(state: GameState, defId: string): boolean {
  return hasTerrain(state, 'p1', defId) || hasTerrain(state, 'p2', defId);
}

/** Whether this player has already used this Terrain's once-per-turn effect this turn. */
export function terrainUsedThisTurn(state: GameState, player: PlayerId, defId: string): boolean {
  return state.players[player].terrainUsedTurn?.[defId] === state.turn;
}

export function markTerrainUsed(state: GameState, player: PlayerId, defId: string): GameState {
  const p = state.players[player];
  return { ...state, players: { ...state.players, [player]: { ...p, terrainUsedTurn: { ...p.terrainUsedTurn, [defId]: state.turn } } } };
}
