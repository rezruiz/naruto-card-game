import { findOccupant, isCharacter, patchOccupant } from '../board';
import { getCharacterDef } from '../characters/registry';
import { appendLog, appendWarning } from '../phases/phaseMachine';
import { spendSupplies } from '../prototype';
import { TERRAIN, amegakureBuffs, hasTerrain, markTerrainUsed, terrainUsedThisTurn } from '../terrainEffects';
import { registerHandCard } from './registry';
import type { HandCardContext, HandCardDef } from './registry';
import type { BoardOccupant, GameState, PlayerId } from '../types';

/** Playing a Terrain puts it in play; one already there is replaced (discarded) — SPEC.md §10a. */
function enterPlay(ctx: HandCardContext, def: HandCardDef): GameState {
  const p = ctx.state.players[ctx.player];
  const oldTerrain = p.terrainInPlay;
  const played = { instanceId: `terrain-${ctx.player}-${Date.now()}`, defId: def.id };
  const next = {
    ...ctx.state,
    players: {
      ...ctx.state.players,
      [ctx.player]: { ...p, terrainInPlay: played, discardPile: oldTerrain ? [...p.discardPile, oldTerrain] : p.discardPile },
    },
  };
  return appendLog(next, `${ctx.player} plays ${def.name} as their Terrain.`);
}

const akatsukiHideout: HandCardDef = {
  id: TERRAIN.akatsukiHideout,
  name: 'Akatsuki Hideout',
  cardType: 'terrain',
  cost: 2,
  speed: 'Normal',
  style: 'None',
  type: 'None',
  maxTargets: 0,
  synergy: ['Akatsuki'],
  // Base game: Akatsuki-Synergy characters' Upkeep -1 (min 0), read live by
  // upkeep.ts's payUpkeep. Prototype (no Upkeep): at your Upkeep, each of your
  // Akatsuki Leaders gains 1 Chakra in its Pool (tickHideout below). This
  // resolve only handles entering play.
  prototypeText: "Cost: 2 Supplies · Synergy: Akatsuki\nEffect: At your Upkeep, add 1 Chakra to each of your Akatsuki Leaders' Pools.",
  resolve: (ctx) => enterPlay(ctx, akatsukiHideout),
};

registerHandCard(akatsukiHideout);

// --- Prototype Terrain ---------------------------------------------------------
// Each is Unique (1 per deck), costs Supplies, and works one-way (only its
// controller's side) unless it says "both sides". The effects are checked
// live where they apply (terrainEffects.ts names them).

function terrainCard(id: string, name: string, cost: number, effect: string, extra: Partial<HandCardDef> = {}): HandCardDef {
  const def: HandCardDef = {
    id,
    name,
    cardType: 'terrain',
    cost,
    speed: 'Normal',
    style: 'None',
    type: 'None',
    maxTargets: 0,
    timing: 'main',
    unique: true,
    text: `Cost: ${cost} ${cost === 1 ? 'Supply' : 'Supplies'}${extra.synergy ? ` · Synergy: ${extra.synergy.join(', ')}` : ''} · Unique\nEffect: ${effect}`,
    resolve: (ctx) => enterPlay(ctx, def),
    ...extra,
  };
  return def;
}

export const PROTOTYPE_TERRAIN_CARDS: HandCardDef[] = [
  terrainCard(TERRAIN.amegakure, 'Amegakure, Village Hidden in the Rain', 3, 'Your Rain Village Shinobi and Amegakure Civilian Rebels get +1 Damage and +1 Health, and cost 1 less Supply to play (to a minimum of 1).', { synergy: ['Akatsuki'] }),
  terrainCard(TERRAIN.supplyDepot, 'Supply Depot', 1, 'Your Supplies maximum is 1 higher.'),
  terrainCard(TERRAIN.blacksmithVillage, 'Blacksmith Village', 2, 'Your Equipment costs 1 less Supply (to a minimum of 1).'),
  terrainCard(TERRAIN.trainingGrounds, 'Training Grounds', 2, 'Once per turn, in your Main Phase, you may pay 1 Supply to pool 1 Chakra into one of your Leaders.'),
  terrainCard(TERRAIN.forestOfDeath, 'Forest of Death', 3, 'The first Shinobi you play each turn can attack that turn.'),
  terrainCard(TERRAIN.hiddenMist, 'Hidden Mist', 3, 'Enemy Shinobi attacking your Leaders deal 1 less damage (to a minimum of 1).', { style: 'Water' }),
  terrainCard(TERRAIN.shinobiGraveyard, 'Shinobi Graveyard', 2, 'When one of your Shinobi is defeated, gain 1 Supply this turn.'),
  terrainCard(TERRAIN.valleyOfTheEnd, 'Valley of the End', 4, "Both sides: every Leader's damage-dealing Jutsu and abilities deal +1 damage (each hit)."),
];
for (const def of PROTOTYPE_TERRAIN_CARDS) registerHandCard(def);

/** The Prototype build's starter deck carries 1 each of the Terrain that suit it (with Akatsuki Hideout, 5 in all — the deck stays within 80 cards); the rest are in the deck builder. */
export const PROTOTYPE_TERRAIN_MANIFEST: { defId: string; copies: number }[] = [TERRAIN.akatsukiHideout, TERRAIN.amegakure, TERRAIN.supplyDepot, TERRAIN.blacksmithVillage, TERRAIN.trainingGrounds].map((defId) => ({ defId, copies: 1 }));

// --- Akatsuki Hideout: Chakra at your Upkeep ------------------------------------

/** A Leader: a character in play, or one of Pain's Path tokens (they count as Pain). */
function isLeader(o: BoardOccupant): boolean {
  return isCharacter(o) || o.extra.painPath === true;
}

function isAkatsukiLeader(o: BoardOccupant): boolean {
  if (o.extra.painPath === true) return true;
  return isCharacter(o) && !!getCharacterDef(o.defId)?.synergy?.includes('Akatsuki');
}

/**
 * Upkeep Phase (Prototype only): with Akatsuki Hideout in play, each of your Akatsuki Leaders gains 1 Chakra in
 * its Pool, up to the Pool's capacity. It isn't pooling, so the Leader can still act this turn. Pain counts as
 * one Leader: the Chakra goes to the first of his Paths with room.
 */
export function tickHideout(state: GameState, player: PlayerId): GameState {
  if (state.ruleset !== 'prototype' || !hasTerrain(state, player, TERRAIN.akatsukiHideout)) return state;
  let next = state;
  let painFed = false;
  const p = state.players[player];
  for (const o of [...p.backRow, ...p.frontRow]) {
    if (!o || !isAkatsukiLeader(o) || !o.chakraPool || o.chakraPool.current >= o.chakraPool.capacity) continue;
    if (o.extra.painPath === true) {
      if (painFed) continue;
      painFed = true;
    }
    next = patchOccupant(next, o.instanceId, (u) => ({ ...u, chakraPool: { ...u.chakraPool!, current: u.chakraPool!.current + 1 } }));
    next = appendLog(next, `Akatsuki Hideout: ${o.name} gains 1 Chakra in its Pool.`);
  }
  return next;
}

// --- Stat buff: Amegakure (Health) ----------------------------------------------

/**
 * Run after every action (Prototype only): puts Amegakure's buff on the units that should have it and takes it
 * off the ones that shouldn't any more — the Terrain was replaced, a new unit came into play, … Each unit
 * remembers what it was given, so nothing is applied twice. Taking Health away never defeats a unit: it keeps
 * at least 1 HP. (It also takes off the Pool bonus the Hideout used to give, from older saves.)
 */
export function sweepTerrain(state: GameState): GameState {
  if (state.ruleset !== 'prototype') return state;
  let next = state;
  for (const player of ['p1', 'p2'] as PlayerId[]) {
    const p = state.players[player];
    for (const o of [...p.backRow, ...p.frontRow]) {
      if (!o) continue;
      const pool = 0;
      const health = o.extra.shinobi === true && amegakureBuffs(state, player, o.defId) ? 1 : 0;
      const poolDelta = pool - ((o.extra.terrainPoolBonus as number | undefined) ?? 0);
      const healthDelta = health - ((o.extra.terrainHealthBonus as number | undefined) ?? 0);
      if (!poolDelta && !healthDelta) continue;
      next = patchOccupant(next, o.instanceId, (u) => {
        let out: BoardOccupant = { ...u, extra: { ...u.extra, terrainPoolBonus: pool, terrainHealthBonus: health } };
        if (healthDelta) {
          const maxHP = Math.max(1, u.maxHP + healthDelta);
          out = { ...out, maxHP, currentHP: healthDelta > 0 ? u.currentHP + healthDelta : Math.max(1, Math.min(u.currentHP, maxHP)) };
        }
        if (poolDelta && u.chakraPool) {
          const capacity = Math.max(0, u.chakraPool.capacity + poolDelta);
          out = { ...out, chakraPool: { capacity, current: Math.min(u.chakraPool.current, capacity) } };
        }
        return out;
      });
    }
  }
  return next;
}

// --- Training Grounds ----------------------------------------------------------

/** Why this player can't use Training Grounds on this Leader right now (null = they can). Trust mode only checks that the Terrain and the Leader are there. */
export function trainingGroundsBlocker(state: GameState, player: PlayerId, leaderId?: string): string | null {
  if (!hasTerrain(state, player, TERRAIN.trainingGrounds)) return 'You need Training Grounds in play.';
  const trust = state.rules === 'trust';
  if (!trust) {
    if (state.activePlayer !== player || (state.phase !== 'Main1' && state.phase !== 'Main2')) return 'Only in your Main Phase.';
    if (state.stack.length > 0) return 'Wait for the stack to resolve.';
    if (terrainUsedThisTurn(state, player, TERRAIN.trainingGrounds)) return 'Already used this turn.';
  }
  if (leaderId === undefined) return null;
  const found = findOccupant(state, leaderId);
  if (!found || found.player !== player || !isLeader(found.occupant) || !found.occupant.chakraPool) return 'Choose one of your Leaders.';
  const pool = found.occupant.chakraPool;
  if (pool.current >= pool.capacity) return `${found.occupant.name}'s Chakra Pool is full.`;
  return null;
}

/** Training Grounds, for the Leader's controller. */
export function activateTrainingGrounds(state: GameState, leaderId: string): GameState {
  const player = findOccupant(state, leaderId)?.player ?? state.activePlayer;
  const blocker = trainingGroundsBlocker(state, player, leaderId);
  if (blocker) return appendLog(state, `Can't use Training Grounds: ${blocker}`);
  let next = state;
  if (state.rules === 'trust' && terrainUsedThisTurn(state, player, TERRAIN.trainingGrounds)) next = appendWarning(next, 'Training Grounds is used again this turn — allowed (trust mode).');
  const paid = spendSupplies(next, player, 1, 'Training Grounds');
  if (!paid) return appendLog(state, "Can't use Training Grounds: not enough Supplies (1 needed).");
  next = markTerrainUsed(paid, player, TERRAIN.trainingGrounds);
  next = patchOccupant(next, leaderId, (o) => ({ ...o, chakraPool: { ...o.chakraPool!, current: o.chakraPool!.current + 1 } }));
  return appendLog(next, `Training Grounds: ${player} pools 1 Chakra into ${findOccupant(next, leaderId)!.occupant.name}.`);
}
