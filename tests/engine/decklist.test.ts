import { describe, expect, it } from 'vitest';
import { createSetupState } from '../../src/engine/state';
import { characterPool, copyLimit, handCardPool, presetDeck, toManifests, validateDeck, type DeckList } from '../../src/engine/decklist';

/** A legal custom deck: 50 Hand Deck cards, 12 characters within the rank caps. */
function legalDeck(): DeckList {
  return {
    id: 'test-deck',
    name: 'Test',
    handDeck: {
      substitution: 3,
      'lightning-substitution': 3,
      'water-substitution': 3,
      'medical-chakra-infusion': 3,
      'chakra-suppression': 3,
      'explosive-tag': 3,
      'kunai-deflection': 3,
      'finishing-blow': 3,
      'senbon-volley': 3,
      'scroll-of-techniques': 3,
      'smoke-out': 3,
      reconnaissance: 3,
      'great-breakthrough': 3,
      'mud-wall': 3,
      'water-shark-bullet': 3,
      'jutsu-disruption': 3,
      'akatsuki-hideout': 2,
    },
    characterDeck: {
      kakuzu: 1,
      hidan: 1,
      deidara: 1,
      kisame: 1,
      itachi: 1,
      konan: 1,
      'sasori-hiruko': 1,
      zetsu: 1,
      juzo: 1,
      yahiko: 1,
      'amegakure-civilian-rebel': 2,
    },
  };
}

describe('Deck library — deck lists (SPEC.md §2)', () => {
  it('a deck within every construction rule is legal', () => {
    expect(validateDeck(legalDeck())).toEqual([]);
  });

  it('flags deck sizes, copy limits and rank caps', () => {
    const deck = legalDeck();
    expect(validateDeck({ ...deck, handDeck: { ...deck.handDeck, 'akatsuki-hideout': 1 } }).some((e) => e.includes('Hand Deck has 49'))).toBe(true);
    expect(validateDeck({ ...deck, handDeck: { ...deck.handDeck, substitution: 4 } }).some((e) => e.startsWith('Substitution: at most 3'))).toBe(true);
    expect(validateDeck({ ...deck, characterDeck: { ...deck.characterDeck, kakuzu: 2 } }).some((e) => e.includes('only D Rank'))).toBe(true);
    expect(validateDeck({ ...deck, characterDeck: { ...deck.characterDeck, 'amegakure-civilian-rebel': 5 } })).toEqual([]); // D Rank: any number (12 → 15 cards)
  });

  it('copy limits: 3 per Hand Deck card, 1 per character, unlimited D Rank', () => {
    expect(copyLimit('hand', 'substitution')).toBe(3);
    expect(copyLimit('character', 'kakuzu')).toBe(1);
    expect(copyLimit('character', 'amegakure-civilian-rebel')).toBe(Infinity);
  });

  it('the card pool lists every registered card, including ones not in the preset deck', () => {
    expect(handCardPool().map((d) => d.id)).toEqual(expect.arrayContaining(['substitution', 'great-breakthrough', 'reconnaissance', 'akatsuki-hideout', 'unshakable-resolve']));
    expect(characterPool().map((c) => c.id)).toEqual(expect.arrayContaining(['kakuzu', 'pain', 'amegakure-civilian-rebel']));
  });

  it('the preset matches the starter decks (47 hand cards, 13 characters)', () => {
    const { hand, characters } = toManifests(presetDeck());
    expect(hand.reduce((a, c) => a + c.copies, 0)).toBe(47);
    expect(characters).toHaveLength(13);
  });

  it('createSetupState deals each player from their own deck', () => {
    const deck = legalDeck();
    const state = createSetupState('p1', 'trust', { p1: deck });
    const p1Cards = [...state.players.p1.handDeck, ...state.players.p1.hand.filter((h) => h.kind === 'card')].map((c) => c.defId);
    expect(p1Cards).toHaveLength(50);
    expect(new Set(p1Cards)).toEqual(new Set(Object.keys(deck.handDeck)));
    // p2 had no deck chosen — the preset (47 cards).
    const p2Cards = [...state.players.p2.handDeck, ...state.players.p2.hand.filter((h) => h.kind === 'card')];
    expect(p2Cards).toHaveLength(47);
    // p1's Character Deck (minus the 3 revealed at Setup) only holds cards from their deck.
    const revealed = state.players.p1.pendingCharacterReveal?.revealed ?? [];
    expect([...state.players.p1.characterDeck, ...revealed].every((id) => id in deck.characterDeck)).toBe(true);
    expect(state.players.p1.characterDeck).not.toContain('pain');
  });

  it('unknown card ids in a saved deck are ignored when dealing', () => {
    const deck = { ...legalDeck(), handDeck: { ...legalDeck().handDeck, 'no-such-card': 3 } };
    expect(validateDeck(deck).some((e) => e.includes('Unknown'))).toBe(true);
    expect(toManifests(deck).hand.some((h) => h.defId === 'no-such-card')).toBe(false);
  });
});
