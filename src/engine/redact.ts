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

  // Cards the opponent has revealed (Field Intelligence) stay face-up to this viewer.
  const redactedHand: HandEntry[] = opponent.hand.map((entry) =>
    opponent.revealedHandCards.includes(entry.instanceId)
      ? entry
      : entry.kind === 'card'
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

  // A choice over hidden cards (look at the top of your deck) stays private to its owner.
  const pendingChoices = state.pendingChoices.map((c) =>
    c.hidden && c.player === opponentId
      ? { ...c, prompt: 'Choosing from cards only they can see…', options: c.options.map((o) => ({ id: o.id, label: 'Hidden card' })), data: {} }
      : c,
  );

  // Declared-but-unresolved actions stay with their owner until the round is finalized.
  const staged = state.staged.map((a) =>
    a.owner === opponentId
      ? { ...a, label: 'Hidden declared action', sourceInstanceId: '', abilityId: undefined, cardInstanceId: undefined, cardDefId: undefined, targets: [], choices: undefined, warnings: [], payFromPool: 0, amount: undefined }
      : a,
  );
  const log = state.log.filter((entry) => !entry.visibleTo || entry.visibleTo === viewerId);

  return {
    ...state,
    stack,
    staged,
    log,
    pendingChoices,
    players: {
      ...state.players,
      [opponentId]: {
        ...opponent,
        hand: redactedHand,
        missionsInPlay: redactedMissions,
        pendingCharacterReveal: redactedReveal,
        characterDeck: opponent.characterDeck.map(() => '__hidden__'),
        // Setup: their starting character stays hidden until both players have confirmed (§3).
        ...(state.firstPlayerPending ? { backRow: opponent.backRow.map(() => null), frontRow: opponent.frontRow.map(() => null) } : {}),
        handDeck: opponent.handDeck.map((c) => ({ instanceId: c.instanceId, defId: '__hidden__' })),
      },
    },
  };
}
