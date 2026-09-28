import { findOccupant, isCharacter, patchOccupant } from '../board';
import { applyHealthLoss, dealDamage } from '../combat';
import { drawCard, shuffle } from '../deck';
import { appendLog } from '../phases/phaseMachine';
import type { GameState, PlayerId } from '../types';

/**
 * Cockatrice-style manual adjustments and deck tools (trust mode). Every
 * one is logged as "(manual)" so the opponent can see exactly what was
 * changed — the point is to fix honest mistakes without a rules dispute
 * stalling the game, not to bypass accountability.
 */

function withPlayer(state: GameState, player: PlayerId, patch: Partial<GameState['players'][PlayerId]>): GameState {
  return { ...state, players: { ...state.players, [player]: { ...state.players[player], ...patch } } };
}

export function adjustHp(state: GameState, instanceId: string, delta: number): GameState {
  const found = findOccupant(state, instanceId);
  if (!found) return state;
  const before = found.occupant.currentHP;
  const after = Math.min(found.occupant.maxHP, Math.max(1, before + delta));
  const next = patchOccupant(state, instanceId, (o) => ({ ...o, currentHP: after }));
  return appendLog(next, `(manual) ${found.occupant.name} HP ${before} → ${after}.`);
}

/** Damage through the real pipeline (prevention, defeat hooks, Health loss, Reinforcement draws) — for "the engine forgot this damage." */
export function dealManualDamage(state: GameState, instanceId: string, amount: number): GameState {
  const found = findOccupant(state, instanceId);
  if (!found || amount <= 0) return state;
  return dealDamage(appendLog(state, `(manual) ${amount} damage to ${found.occupant.name}.`), instanceId, amount).state;
}

export function adjustPool(state: GameState, instanceId: string, delta: number): GameState {
  const found = findOccupant(state, instanceId);
  const pool = found && (isCharacter(found.occupant) ? found.occupant.chakraPool : found.occupant.chakraPool);
  if (!found || !pool) return state;
  const after = Math.max(0, pool.current + delta);
  const next = patchOccupant(state, instanceId, (o) => ({ ...o, chakraPool: { ...o.chakraPool!, current: after } }));
  return appendLog(next, `(manual) ${found.occupant.name} Pool ${pool.current} → ${after}.`);
}

export function toggleStatus(state: GameState, instanceId: string, status: 'disabled' | 'retreated'): GameState {
  const found = findOccupant(state, instanceId);
  if (!found) return state;
  const value = !found.occupant.status[status];
  const next = patchOccupant(state, instanceId, (o) => ({ ...o, status: { ...o.status, [status]: value } }));
  return appendLog(next, `(manual) ${found.occupant.name} ${status} → ${value ? 'yes' : 'no'}.`);
}

export function adjustPlayerHealth(state: GameState, player: PlayerId, delta: number): GameState {
  if (delta === 0) return state;
  const next =
    delta < 0
      ? applyHealthLoss(state, player, -delta)
      : withPlayer(state, player, { health: state.players[player].health + delta });
  return appendLog(next, `(manual) ${player} Health adjusted by ${delta > 0 ? '+' : ''}${delta}.`);
}

export function adjustGenericChakra(state: GameState, player: PlayerId, delta: number): GameState {
  const before = state.players[player].genericChakraAvailable;
  const after = Math.max(0, before + delta);
  return appendLog(withPlayer(state, player, { genericChakraAvailable: after }), `(manual) ${player} available Chakra ${before} → ${after}.`);
}

/** Undo a mis-tap: untaps the source and takes back the Chakra it produced (if it's still unspent). */
export function untapChakraSource(state: GameState, player: PlayerId, sourceIndex: number): GameState {
  const p = state.players[player];
  if (!p.chakraSources[sourceIndex]?.tapped) return state;
  const next = withPlayer(state, player, {
    chakraSources: p.chakraSources.map((s, i) => (i === sourceIndex ? { tapped: false } : s)),
    genericChakraAvailable: Math.max(0, p.genericChakraAvailable - 1),
  });
  return appendLog(next, `(manual) ${player} untaps a Chakra source.`);
}

export function moveHandCard(state: GameState, player: PlayerId, instanceId: string, to: 'discard' | 'deck-top' | 'deck-bottom'): GameState {
  const p = state.players[player];
  const entry = p.hand.find((h) => h.instanceId === instanceId);
  if (!entry || entry.kind !== 'card') return state;
  const card = { instanceId: entry.instanceId, defId: entry.defId };
  const hand = p.hand.filter((h) => h.instanceId !== instanceId);
  const patch =
    to === 'discard'
      ? { hand, discardPile: [...p.discardPile, card] }
      : to === 'deck-top'
        ? { hand, handDeck: [card, ...p.handDeck] }
        : { hand, handDeck: [...p.handDeck, card] };
  return appendLog(withPlayer(state, player, patch), `(manual) ${player} moves a card from hand to ${to === 'discard' ? 'the discard pile' : to === 'deck-top' ? 'the top of the deck' : 'the bottom of the deck'}.`);
}

export function returnFromDiscard(state: GameState, player: PlayerId, instanceId: string): GameState {
  const p = state.players[player];
  const card = p.discardPile.find((c) => c.instanceId === instanceId);
  if (!card) return state;
  const next = withPlayer(state, player, {
    discardPile: p.discardPile.filter((c) => c.instanceId !== instanceId),
    hand: [...p.hand, { kind: 'card', instanceId: card.instanceId, defId: card.defId }],
  });
  return appendLog(next, `(manual) ${player} returns a card from the discard pile to hand.`);
}

export function drawCards(state: GameState, player: PlayerId, count: number): GameState {
  let next = state;
  for (let i = 0; i < count; i++) next = drawCard(next, player);
  return appendLog(next, `${player} draws ${count} card${count === 1 ? '' : 's'}.`);
}

export function shuffleDeck(state: GameState, player: PlayerId): GameState {
  return appendLog(withPlayer(state, player, { handDeck: shuffle(state.players[player].handDeck) }), `${player} shuffles their deck.`);
}

/** Deck search / look-at-top-X: take one card from the deck into hand (optionally reshuffling afterward, as a search does). */
export function deckTake(state: GameState, player: PlayerId, instanceId: string, doShuffle: boolean): GameState {
  const p = state.players[player];
  const card = p.handDeck.find((c) => c.instanceId === instanceId);
  if (!card) return state;
  const rest = p.handDeck.filter((c) => c.instanceId !== instanceId);
  const next = withPlayer(state, player, {
    handDeck: doShuffle ? shuffle(rest) : rest,
    hand: [...p.hand, { kind: 'card', instanceId: card.instanceId, defId: card.defId }],
  });
  return appendLog(next, `${player} takes a card from their deck${doShuffle ? ' and shuffles' : ''}.`);
}

/** Look-at-top-X: put a card from the deck on the bottom. */
export function deckToBottom(state: GameState, player: PlayerId, instanceId: string): GameState {
  const p = state.players[player];
  const card = p.handDeck.find((c) => c.instanceId === instanceId);
  if (!card) return state;
  return appendLog(
    withPlayer(state, player, { handDeck: [...p.handDeck.filter((c) => c.instanceId !== instanceId), card] }),
    `${player} puts a card on the bottom of their deck.`,
  );
}
