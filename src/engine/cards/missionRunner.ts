import { getMissionDef } from './registry';
import type { MissionTrigger } from './registry';
import type { GameState, PlayerId } from '../types';

/** Runs every one of `owner`'s in-play Missions against a single trigger event, discarding any that report themselves done. */
export function runMissionTrigger(state: GameState, owner: PlayerId, trigger: MissionTrigger): GameState {
  let next = state;
  const missionIds = next.players[owner].missionsInPlay.map((m) => m.instanceId);
  for (const instanceId of missionIds) {
    const mission = next.players[owner].missionsInPlay.find((m) => m.instanceId === instanceId);
    if (!mission) continue; // an earlier mission in this same pass may have discarded it (shouldn't normally happen, but safe)
    const def = getMissionDef(mission.defId);
    if (!def) continue;

    const result = def.tick(next, owner, instanceId, trigger);
    next = result.state;
    if (result.discard) {
      const p = next.players[owner];
      next = { ...next, players: { ...next.players, [owner]: { ...p, missionsInPlay: p.missionsInPlay.filter((m) => m.instanceId !== instanceId) } } };
    }
  }
  return next;
}
