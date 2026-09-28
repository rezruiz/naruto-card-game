import type { GameState, HandEntry, PlayerId, StackItem } from './types';

/**
 * SPEC.md's local-hotseat stance assumes every hand is already visible (two
 * people at one table). Remote play (§ networking, M6) actually needs to
 * hide information a real opponent shouldn't see before it leaves the host:
 * the contents of the *other* player's hand, and any face-down Mission in
 * play (the Bingo Book family, §10b) that hasn't been revealed yet. This is
 * the one deliberate departure from the spec's "fully open" stance, and only
 * applies to the copy of state sent to a given viewer over the network —
 * local hotseat mode never calls this at all.
 */
export function redactStateFor(state: GameState, viewerId: PlayerId): GameState {
  const opponentId: PlayerId = viewerId === 'p1' ? 'p2' : 'p1';
  const opponent = state.players[opponentId];

  const redactedHand: HandEntry[] = opponent.hand.map((entry) =>
    entry.kind === 'card'
      ? { kind: 'card', instanceId: entry.instanceId, defId: '__hidden__' }
      : { kind: 'character', instanceId: entry.instanceId, entryId: '__hidden__' },
  );

  const pending = opponent.pendingCharacterReveal;
  const redactedReveal = pending ? { ...pending, revealed: pending.revealed.map(() => '__hidden__') } : null;

  const redactedMissions = opponent.missionsInPlay.map((m) => (m.extra.faceDown ? { ...m, defId: '__hidden__' } : m));

  // Stack items carry a resolve closure, which can't cross the network (and the viewer never runs it anyway).
  const stack = state.stack.map((item) => {
    const { resolve: _resolve, ...serializable } = item;
    return serializable as StackItem;
  });

  return {
    ...state,
    stack,
    players: {
      ...state.players,
      [opponentId]: {
        ...opponent,
        hand: redactedHand,
        missionsInPlay: redactedMissions,
        pendingCharacterReveal: redactedReveal,
        characterDeck: opponent.characterDeck.map(() => '__hidden__'),
        handDeck: opponent.handDeck.map((c) => ({ instanceId: c.instanceId, defId: '__hidden__' })),
      },
    },
  };
}
