import { getCharacterDeckEntry } from './characters';
import { patchCharacter } from './board';
import { appendLog } from './phases/phaseMachine';
import type { GameState, PlayerId } from './types';

const MAIN_PHASES = new Set(['Main1', 'Main2']);

/** SPEC.md §8 — Reinforcement Tax: 3/5/7/9/... Chakra, +2 each time, never resets. */
function reinforcementTax(reinforcementsPlayed: number): number {
  return 3 + 2 * reinforcementsPlayed;
}

/** What playing a Character card from hand would cost this player right now (§8) — waived when they control no characters, reduced by Bingo Book: Threat Level A's discount. */
export function reinforcementCost(state: GameState, player: PlayerId): { cost: number; waived: boolean } {
  const p = state.players[player];
  const waived = p.backRow.every((c) => c === null);
  if (waived) return { cost: 0, waived };
  const base = reinforcementTax(p.reinforcementsPlayed);
  return { cost: base - Math.min(base, p.nextReinforcementDiscount), waived };
}

/**
 * SPEC.md §8: play a Character card from hand — every one after your free
 * starting character (§6.7) costs the escalating Reinforcement Tax, paid
 * from generic Chakra, unless the Empty-Board Waiver applies (0 characters
 * currently in play — waived, and doesn't advance the tax counter).
 */
export function playCharacter(state: GameState, instanceId: string): GameState {
  const relaxed = state.rules === 'trust';
  const player =
    (relaxed ? (['p1', 'p2'] as const).find((id) => state.players[id].hand.some((h) => h.instanceId === instanceId)) : undefined) ?? state.activePlayer;
  const p = state.players[player];

  let working = state;
  if (!MAIN_PHASES.has(state.phase)) {
    if (!relaxed) return appendLog(state, `${player} can only play a character during their own Main Phase.`);
    working = appendLog(working, `${player} plays a character outside their own Main Phase — not legal under the strict rules, allowed anyway (trust mode).`);
  }
  const handEntry = p.hand.find((h) => h.instanceId === instanceId);
  if (!handEntry || handEntry.kind !== 'character') {
    return appendLog(working, `${player} has no such Character card in hand.`);
  }
  const entry = getCharacterDeckEntry(handEntry.entryId);
  if (!entry) return appendLog(working, `Unknown Character card: ${handEntry.entryId}.`);
  if (!entry.hasRoom(working, player)) {
    return appendLog(working, `${player} doesn't have room in play for ${entry.name}.`);
  }

  // Empty-Board Waiver / Bingo Book: Threat Level A's one-time discount (§13a) — see reinforcementCost.
  const { cost: fullCost, waived } = reinforcementCost(working, player);
  const discount = waived ? 0 : Math.min(reinforcementTax(p.reinforcementsPlayed), p.nextReinforcementDiscount);
  const cost = relaxed ? Math.min(fullCost, p.genericChakraAvailable) : fullCost;
  if (!relaxed && cost > p.genericChakraAvailable) {
    return appendLog(working, `${player} doesn't have ${cost} Chakra available for the Reinforcement Tax.`);
  }

  const beforeBackRow = working.players[player].backRow;
  // Retaliation (§6.6) or Bingo Book: Threat Level A's Ambush reward — either grants Ambush to this entry.
  const hasAmbush = p.retaliationPending;
  let next = entry.spawn(working, player, working.turn, hasAmbush);
  const np = next.players[player];
  next = {
    ...next,
    players: {
      ...next.players,
      [player]: {
        ...np,
        genericChakraAvailable: np.genericChakraAvailable - cost,
        hand: np.hand.filter((h) => h.instanceId !== instanceId),
        reinforcementsPlayed: waived ? np.reinforcementsPlayed : np.reinforcementsPlayed + 1,
        retaliationPending: false,
        nextReinforcementDiscount: waived ? np.nextReinforcementDiscount : np.nextReinforcementDiscount - discount,
        nextCharacterFullyStunned: false,
      },
    },
  };

  // Bingo Book: Threat Level S's reward — stricter than normal summoning
  // sickness (blocks every ability, not just damage-dealing ones). Applied
  // via the engine's existing generic full-stun field. NOTE (simplified):
  // if the entry is Pain (spawns 6 Path tokens, not a back-row character),
  // this is skipped — no single new occupant to unambiguously apply it to.
  if (p.nextCharacterFullyStunned) {
    const newSlotIndex = next.players[player].backRow.findIndex((c, i) => c && !beforeBackRow[i]);
    if (newSlotIndex !== -1) {
      const newInstanceId = next.players[player].backRow[newSlotIndex]!.instanceId;
      next = patchCharacter(next, newInstanceId, (c) => ({ ...c, extra: { ...c.extra, stunnedUntilTurn: state.turn } }));
    }
  }

  return appendLog(next, `${player} plays ${entry.name}${waived ? ' (Empty-Board Waiver, free)' : ` (Reinforcement Tax: ${cost})`}.`);
}
