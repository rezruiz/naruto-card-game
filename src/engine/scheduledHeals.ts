import { findOccupant, patchOccupant } from './board';
import { healOccupant } from './combat';
import { appendLog } from './phases/phaseMachine';
import type { GameState, PlayerId } from './types';

interface ScheduledHeal {
  amount: number;
  ticksLeft: number;
  /** Cancelled early if the target stops being Retreated (Deploy Medic Corps, §13b) — checked every tick, not just once. */
  cancelIfNotRetreated?: boolean;
}

/** A generic "heal N at the start of each of your next K Upkeep Phases" effect — not tied to any one character's own hooks, since the target could be any character a card names. */
export function scheduleHeal(state: GameState, targetInstanceId: string, amount: number, ticks: number, cancelIfNotRetreated = false): GameState {
  return patchOccupant(state, targetInstanceId, (o) => ({
    ...o,
    extra: {
      ...o.extra,
      scheduledHeals: [...((o.extra.scheduledHeals as ScheduledHeal[]) ?? []), { amount, ticksLeft: ticks, cancelIfNotRetreated }],
    },
  }));
}

/** Called once per Upkeep Phase transition, for whichever player's Upkeep it is (mirrors poison.ts's tickAllPoison). */
export function tickScheduledHeals(state: GameState, upkeepingPlayer: PlayerId): GameState {
  let next = state;
  const occupants = [...next.players[upkeepingPlayer].backRow, ...next.players[upkeepingPlayer].frontRow].filter(
    (o): o is NonNullable<typeof o> => !!o,
  );
  for (const occ of occupants) {
    const found = findOccupant(next, occ.instanceId);
    const schedule = (found?.occupant.extra.scheduledHeals as ScheduledHeal[]) ?? [];
    if (schedule.length === 0) continue;

    const remaining: ScheduledHeal[] = [];
    for (const entry of schedule) {
      const stillRetreated = !entry.cancelIfNotRetreated || found!.occupant.status.retreated;
      if (!stillRetreated) {
        next = appendLog(next, `${found!.occupant.name}'s scheduled heal is cancelled — no longer Retreated.`);
        continue;
      }
      next = healOccupant(next, occ.instanceId, entry.amount);
      if (entry.ticksLeft - 1 > 0) remaining.push({ ...entry, ticksLeft: entry.ticksLeft - 1 });
    }
    next = patchOccupant(next, occ.instanceId, (o) => ({ ...o, extra: { ...o.extra, scheduledHeals: remaining } }));
  }
  return next;
}
