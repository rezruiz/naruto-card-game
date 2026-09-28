import { dealDamage } from './combat';
import { findOccupant } from './board';
import type { BoardOccupant, GameState, PlayerId } from './types';

/**
 * SPEC.md's shared Poisoned status (design/CHARACTER_LOG.md, §Sasori): ticks
 * at EVERY Upkeep Phase in the game (not just its controller's) — loses 1
 * counter and takes 1 damage, until counters run out. Damage can't be
 * prevented or healed away (cannotBeReduced — a forward-compatible flag, same
 * convention as Itachi's Amaterasu; no reduction system exists to override
 * yet). Modeled generically here (not per-character) since it's a shared
 * status any character/token can carry, applied by multiple different
 * characters' abilities.
 */
function setPoisonCounters(state: GameState, instanceId: string, counters: number): GameState {
  const found = findOccupant(state, instanceId);
  if (!found) return state;
  const { player, zone, index, occupant } = found;
  const patched: BoardOccupant = { ...occupant, extra: { ...occupant.extra, poisonCounters: counters } };
  const p = state.players[player];
  if (zone === 'back') {
    const backRow = p.backRow.slice();
    backRow[index] = patched as typeof backRow[number];
    return { ...state, players: { ...state.players, [player]: { ...p, backRow } } };
  }
  const frontRow = p.frontRow.slice();
  frontRow[index] = patched as typeof frontRow[number];
  return { ...state, players: { ...state.players, [player]: { ...p, frontRow } } };
}

export function applyPoison(state: GameState, instanceId: string, amount: number): GameState {
  if (amount <= 0) return state;
  const found = findOccupant(state, instanceId);
  if (!found) return state;
  const current = (found.occupant.extra.poisonCounters as number) ?? 0;
  return setPoisonCounters(state, instanceId, current + amount);
}

/** Called once per Upkeep Phase transition, regardless of whose turn it is. */
export function tickAllPoison(state: GameState): GameState {
  let next = state;
  for (const player of ['p1', 'p2'] as PlayerId[]) {
    const occupants = [...next.players[player].backRow, ...next.players[player].frontRow].filter(
      (o): o is NonNullable<typeof o> => !!o,
    );
    for (const occ of occupants) {
      const found = findOccupant(next, occ.instanceId);
      const counters = found ? ((found.occupant.extra.poisonCounters as number) ?? 0) : 0;
      if (counters <= 0) continue;
      next = dealDamage(next, occ.instanceId, 1, { cannotBeReduced: true, ongoing: true }).state;
      next = setPoisonCounters(next, occ.instanceId, counters - 1);
    }
  }
  return next;
}
