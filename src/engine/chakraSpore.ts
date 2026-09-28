import { findOccupant, isCharacter, patchCharacter } from './board';
import { appendLog } from './phases/phaseMachine';
import type { GameState, PlayerId } from './types';

/**
 * Zetsu Golem's Chakra Spore (design/CHARACTER_LOG.md, §Zetsu): planted on a
 * target by Golem Strike; drains up to 3 Chakra from the target's own Pool
 * into the planting Golem's (shared, per Zetsu's Reservoir) Pool, at the
 * start of the TARGET's own controller's next Upkeep Phase — not the
 * planter's.
 */
export function plantChakraSpore(state: GameState, targetInstanceId: string, sporePlanterId: string): GameState {
  return patchCharacter(state, targetInstanceId, (c) => ({
    ...c,
    extra: { ...c.extra, chakraSporePlantedBy: sporePlanterId, chakraSporeArmed: true },
  }));
}

/** Called once per Upkeep Phase transition, for whichever player's Upkeep it is. */
export function tickChakraSpores(state: GameState, upkeepingPlayer: PlayerId): GameState {
  let next = state;
  const occupants = [...next.players[upkeepingPlayer].backRow, ...next.players[upkeepingPlayer].frontRow].filter(
    (o): o is NonNullable<typeof o> => !!o,
  );
  for (const occ of occupants) {
    const found = findOccupant(next, occ.instanceId);
    if (!found || !isCharacter(found.occupant) || !found.occupant.extra.chakraSporeArmed) continue;

    const planterId = found.occupant.extra.chakraSporePlantedBy as string | undefined;
    const drained = Math.min(3, found.occupant.chakraPool.current);
    next = patchCharacter(next, occ.instanceId, (c) => ({
      ...c,
      chakraPool: { ...c.chakraPool, current: c.chakraPool.current - drained },
      extra: { ...c.extra, chakraSporeArmed: false, chakraSporePlantedBy: undefined },
    }));

    if (drained > 0 && planterId) {
      const planterFound = findOccupant(next, planterId);
      const poolOwnerId = planterFound
        ? isCharacter(planterFound.occupant)
          ? planterId
          : (planterFound.occupant.extra.sharedPoolOwner as string | undefined)
        : undefined;
      if (poolOwnerId) {
        next = patchCharacter(next, poolOwnerId, (c) => ({ ...c, chakraPool: { ...c.chakraPool, current: c.chakraPool.current + drained } }));
      }
      next = appendLog(next, `Chakra Spore drains ${drained} Chakra.`);
    }
  }
  return next;
}
