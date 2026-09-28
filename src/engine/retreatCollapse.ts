import { appendLog } from './phases/phaseMachine';
import type { GameState, PlayerId } from './types';

/**
 * SPEC.md §6.5b's "zero non-Retreated characters" exception, made immediate:
 * the moment a player has retreated characters but no non-Retreated one left,
 * every retreated character is forced out of Retreat (treated as re-entering
 * play, like a voluntary return).
 *
 * If that happens during the Combat Phase to the *non-active* player — i.e.
 * the attacker's combat step is what cleared their board — the attacker gets a
 * second combat opportunity (extraCombatPending), where they may use any
 * attack actions they haven't already used this turn (the once-per-turn caps
 * still apply). Forced out any other way, there is no extra combat.
 */
export function forceOutOfRetreat(state: GameState): GameState {
  let next = state;
  let attackerGetsExtraCombat = false;

  for (const player of ['p1', 'p2'] as PlayerId[]) {
    const characters = next.players[player].backRow.filter((c): c is NonNullable<typeof c> => !!c);
    const anyRetreated = characters.some((c) => c.status.retreated);
    if (!anyRetreated || characters.some((c) => !c.status.retreated)) continue;

    const p = next.players[player];
    next = {
      ...next,
      players: {
        ...next.players,
        [player]: {
          ...p,
          backRow: p.backRow.map((c) => (c && c.status.retreated ? { ...c, status: { ...c.status, retreated: false, enteredTurn: next.turn } } : c)),
        },
      },
    };
    next = appendLog(next, `${player} has no non-Retreated characters left — their Retreated characters are forced out of Retreat.`);
    if (next.phase === 'Combat' && player !== next.activePlayer) attackerGetsExtraCombat = true;
  }

  return attackerGetsExtraCombat ? appendLog({ ...next, extraCombatPending: true }, `${next.activePlayer} clears the board and gets a second Combat.`) : next;
}
