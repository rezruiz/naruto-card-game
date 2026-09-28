import { describe, expect, it } from 'vitest';
import { createSetupState } from '../../src/engine/state';
import { redactStateFor } from '../../src/engine/redact';

describe('redactStateFor', () => {
  it("hides the opponent's hand, Character Deck draws, and decks, but not the viewer's own", () => {
    const state = createSetupState('p1');
    const view = redactStateFor(state, 'p1');
    const opp = view.players.p2;

    expect(opp.pendingCharacterReveal!.revealed.every((id) => id === '__hidden__')).toBe(true);
    expect(opp.characterDeck.every((id) => id === '__hidden__')).toBe(true);
    expect(opp.handDeck.every((c) => c.defId === '__hidden__')).toBe(true);
    expect(opp.hand.every((h) => (h.kind === 'card' ? h.defId : h.entryId) === '__hidden__')).toBe(true);

    expect(view.players.p1.pendingCharacterReveal!.revealed.every((id) => id !== '__hidden__')).toBe(true);
    expect(view.players.p1.characterDeck.every((id) => id !== '__hidden__')).toBe(true);
  });
});
