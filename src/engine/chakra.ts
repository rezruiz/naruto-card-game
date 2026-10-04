import { appendLog } from './phases/phaseMachine';
import { findOccupant, isCharacter, patchOccupant } from './board';
import { getCharacterDef } from './characters/registry';
import type { BoardOccupant, GameState, PlayerId } from './types';

const MAIN_PHASES = new Set(['Main1', 'Main2']);

function updatePlayer(state: GameState, player: PlayerId, patch: Partial<GameState['players'][PlayerId]>): GameState {
  return {
    ...state,
    players: { ...state.players, [player]: { ...state.players[player], ...patch } },
  };
}

/**
 * §5.2: place 1 Chakra source, removing a hand card from the game to
 * fund it (a physical-table convenience in paper play; no mechanical
 * effect digitally). Sorcery speed (own Main Phase only), once per turn
 * across both Main Phases.
 */
export function placeChakraSource(state: GameState, instanceId: string): GameState {
  const relaxed = state.rules === 'trust';
  // Trust mode: either player may act any time, so the actor is whoever holds the card, not whoever's turn it is.
  const player = (relaxed ? (['p1', 'p2'] as PlayerId[]).find((id) => state.players[id].hand.some((h) => h.instanceId === instanceId)) : undefined) ?? state.activePlayer;
  const p = state.players[player];
  let working = state;

  if (!MAIN_PHASES.has(state.phase)) {
    if (!relaxed) return appendLog(state, `${player} cannot place a Chakra source outside a Main Phase.`);
    working = appendLog(working, `${player} places a Chakra source outside a Main Phase — not legal under the strict rules, allowed anyway (trust mode).`);
  }
  // Bingo Book: Threat Level B's reward (§13a) lets this placement go ahead
  // even if one was already placed this turn, consuming the bonus instead.
  const usingBonus = p.chakraSourcePlacedThisTurn && p.bonusChakraSourcePlacements > 0;
  if (p.chakraSourcePlacedThisTurn && !usingBonus) {
    if (!relaxed) return appendLog(state, `${player} has already placed a Chakra source this turn.`);
    working = appendLog(working, `${player} places more than one Chakra source this turn — not legal under the strict rules, allowed anyway (trust mode).`);
  }
  const entry = p.hand.find((h) => h.instanceId === instanceId);
  if (!entry) {
    return appendLog(working, `${player} has no such card in hand to place as a Chakra source.`);
  }
  // IMPLEMENTATION_PLAN.md's flagged assumption: only Hand Deck cards
  // (Jutsu/Mission/Terrain/Assist) can be Consumed this way, not an
  // as-yet-unplayed Character card.
  if (entry.kind !== 'card') {
    return appendLog(working, `${player} can't Consume a Character card as a Chakra source.`);
  }

  const hand = p.hand.filter((h) => h.instanceId !== instanceId);
  const next = updatePlayer(working, player, {
    hand,
    consumedPile: [...p.consumedPile, { instanceId: entry.instanceId, defId: entry.defId }],
    chakraSources: [...p.chakraSources, { tapped: false }],
    chakraSourcePlacedThisTurn: true,
    bonusChakraSourcePlacements: usingBonus ? p.bonusChakraSourcePlacements - 1 : p.bonusChakraSourcePlacements,
  });
  return appendLog(next, `${player} places a Chakra source${usingBonus ? ' (bonus placement)' : ''}.`);
}

/** §5.2: tap an untapped Chakra source to add 1 Chakra to the generic pool. */
export function tapChakraSource(state: GameState, sourceIndex: number, actor?: PlayerId): GameState {
  const player = actor ?? state.activePlayer;
  const p = state.players[player];
  const source = p.chakraSources[sourceIndex];

  if (!source) {
    return appendLog(state, `${player} has no Chakra source at that position.`);
  }
  if (source.tapped) {
    return appendLog(state, `${player}'s Chakra source is already tapped.`);
  }

  const chakraSources = p.chakraSources.map((s, i) => (i === sourceIndex ? { tapped: true } : s));
  const next = updatePlayer(state, player, {
    chakraSources,
    genericChakraAvailable: p.genericChakraAvailable + 1,
  });
  return appendLog(next, `${player} taps a Chakra source (+1 Chakra).`);
}

/**
 * §5.3: pool generic Chakra into a unit's personal Chakra Pool. Sorcery
 * speed only, capped at its remaining capacity. Almost always a back-row
 * Character, but Pain's Path tokens are the one Token type that also pools
 * individually (Rinnegan Reservoir, §10 exception) — so this checks the
 * front row too, for any Token that carries its own chakraPool.
 */
export function poolChakra(state: GameState, instanceId: string, amount: number): GameState {
  const relaxed = state.rules === 'trust';
  const player = (relaxed ? findOccupant(state, instanceId)?.player : undefined) ?? state.activePlayer;
  const p = state.players[player];
  const unit: BoardOccupant | undefined =
    p.backRow.find((c) => c?.instanceId === instanceId) ?? p.frontRow.find((t) => t?.instanceId === instanceId) ?? undefined;
  const pool = unit?.chakraPool;

  if (amount <= 0) {
    return state;
  }
  let working = state;
  if (!MAIN_PHASES.has(state.phase)) {
    if (!relaxed) return appendLog(state, `${player} cannot pool Chakra outside a Main Phase.`);
    working = appendLog(working, `${player} pools Chakra outside a Main Phase — not legal under the strict rules, allowed anyway (trust mode).`);
  }
  if (!unit || !pool) {
    return appendLog(working, `${player} has no such unit with a Pool to pool Chakra into.`);
  }
  const stunUntil = unit.extra.stunnedUntilTurn as number | undefined;
  if (!relaxed && stunUntil !== undefined && state.turn <= stunUntil) {
    return appendLog(working, `${unit.name} is stunned and can't be pooled into.`);
  }
  const poolLockUntil = unit.extra.poolLockedUntilTurn as number | undefined;
  if (!relaxed && poolLockUntil !== undefined && state.turn <= poolLockUntil) {
    return appendLog(working, `${unit.name} is under Chakra Suppression and can't be pooled into.`);
  }
  if (!relaxed && isCharacter(unit) && getCharacterDef(unit.defId)?.noSelfPooling) {
    return appendLog(working, `${unit.name}'s Pool can't be filled by pooling — only by absorption.`);
  }
  // Pool-XOR-act (§5.3): a unit that's already used an active ability this
  // turn can't be pooled into, and pooling into it blocks it from acting for
  // the rest of the turn (checked in abilities.ts's checkLegality).
  if (!relaxed && unit.status.usedAbilitiesThisTurn.length > 0) {
    return appendLog(working, `${unit.name} has already acted this turn and can't be pooled into.`);
  }
  if (amount > p.genericChakraAvailable) {
    return appendLog(working, `${player} doesn't have ${amount} Chakra available to pool.`);
  }
  const room = pool.capacity - pool.current;
  if (amount > room) {
    return appendLog(working, `${player} can't pool ${amount} into ${unit.name}'s Chakra Pool — only ${room} room left.`);
  }

  let next = patchOccupant(working, instanceId, (o) => ({
    ...o,
    chakraPool: { current: o.chakraPool!.current + amount, capacity: pool.capacity },
    status: { ...o.status, pooledThisTurn: true },
  }));
  next = updatePlayer(next, player, { genericChakraAvailable: p.genericChakraAvailable - amount });
  return appendLog(next, `${player} pools ${amount} Chakra into ${unit.name}'s Chakra Pool.`);
}
