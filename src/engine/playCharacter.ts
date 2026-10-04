import { getCharacterDeckEntry } from './characters';
import { patchOccupant } from './board';
import { appendLog, appendWarning } from './phases/phaseMachine';
import type { GameState, PlayerId } from './types';

const MAIN_PHASES = new Set(['Main1', 'Main2']);

/** SPEC.md §8 — the Character Deck draw tax: 3/5/7/8 Chakra, then stays at 8. Driven only by paid manual draws; never resets. */
export function reinforcementTax(paidDraws: number): number {
  return Math.min(8, 3 + 2 * paidDraws);
}

/** What drawing from the Character Deck costs this player right now (§8): the escalating tax, less Bingo Book: Threat Level A's one-time discount. */
export function currentTax(state: GameState, player: PlayerId): number {
  const p = state.players[player];
  const base = reinforcementTax(p.reinforcementsPlayed);
  return base - Math.min(base, p.nextReinforcementDiscount);
}

/**
 * SPEC.md §8: play a Character card from hand — always free (the tax is
 * paid when the card is DRAWN from the Character Deck, not when it's
 * played). Normal timing is your own Main Phase; a forced play
 * (mustPlayCharacter — your last C+ character fell while you held a C+
 * character card) ignores timing entirely, and playing a C+ card satisfies it.
 */
export function playCharacter(state: GameState, instanceId: string, slot?: number): GameState {
  const relaxed = state.rules === 'trust';
  const player =
    (['p1', 'p2'] as const).find((id) => state.players[id].hand.some((h) => h.instanceId === instanceId && h.kind === 'character')) ?? state.activePlayer;
  const p = state.players[player];
  const forced = p.mustPlayCharacter;

  let working = state;
  const onTime = MAIN_PHASES.has(state.phase) && state.activePlayer === player;
  if (!forced && !onTime) {
    if (!relaxed) return appendLog(state, `${player} can only play a character during their own Main Phase.`);
    working = appendWarning(working, `${player} plays a character outside their own Main Phase — not legal under the strict rules, allowed anyway (trust mode).`);
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
  const satisfiesForced = forced && entry.rank !== 'D';

  const beforeBackRow = working.players[player].backRow;
  // Retaliation (§6.6) or Bingo Book: Threat Level A's Ambush reward — either grants Ambush to this entry.
  const hasAmbush = p.retaliationPending;
  let next = entry.spawn(working, player, working.turn, hasAmbush, slot);
  const np = next.players[player];
  next = {
    ...next,
    players: {
      ...next.players,
      [player]: {
        ...np,
        hand: np.hand.filter((h) => h.instanceId !== instanceId),
        retaliationPending: false,
        nextCharacterFullyStunned: false,
        mustPlayCharacter: satisfiesForced ? false : np.mustPlayCharacter,
      },
    },
  };

  // Bingo Book: Threat Level S's reward — stricter than normal Field
  // Orientation (blocks every ability, not just damage-dealing ones), via the
  // generic full-stun field. Applies to everything this card put into play —
  // the new character, or all of Pain's Path tokens (and Sasori's Kazekage).
  if (p.nextCharacterFullyStunned) {
    const beforeIds = new Set([...beforeBackRow, ...working.players[player].frontRow].filter((u) => u !== null).map((u) => u!.instanceId));
    const entered = [...next.players[player].backRow, ...next.players[player].frontRow].filter((u) => u !== null && !beforeIds.has(u.instanceId));
    for (const u of entered) {
      next = patchOccupant(next, u!.instanceId, (o) => ({ ...o, extra: { ...o.extra, stunnedUntilTurn: state.turn } }));
    }
  }

  return appendLog(next, `${player} plays ${entry.name} (free${satisfiesForced ? ' — required after losing their last C+ character' : ''}).`);
}
