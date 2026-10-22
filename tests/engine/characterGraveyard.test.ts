import { describe, expect, it } from 'vitest';
import { dealDamage } from '../../src/engine/combat';
import { gameReducer } from '../../src/engine/reducer';
import { placeToken } from '../../src/engine/board';
import { makeThirdKazekage } from '../../src/engine/characters';
import { freshCombat } from './testUtils';
import type { GameState } from '../../src/engine/types';

const trust = (s: GameState): GameState => ({ ...s, rules: 'trust' });

describe('Character graveyard', () => {
  it("a defeated character's card goes to its owner's Character graveyard", () => {
    const state = dealDamage(freshCombat(), 'p2-itachi', 99).state;
    expect(state.players.p2.backRow.some((c) => c?.defId === 'itachi')).toBe(false);
    expect(state.players.p2.characterGraveyard).toEqual(['itachi']);
    expect(state.players.p1.characterGraveyard).toEqual([]);
  });

  it("a token's defeat doesn't add anything", () => {
    const kazekage = makeThirdKazekage('p2', 'p2-itachi');
    let state = placeToken(freshCombat(), 'p2', kazekage);
    state = dealDamage(state, kazekage.instanceId, 99).state;
    expect(state.players.p2.frontRow.some((t) => t?.instanceId === kazekage.instanceId)).toBe(false);
    expect(state.players.p2.characterGraveyard).toEqual([]);
  });

  it('a card can be returned from the Character graveyard to hand (trust-mode correction)', () => {
    let state = trust(dealDamage(freshCombat(), 'p2-itachi', 99).state);
    const handBefore = state.players.p2.hand.length;
    state = gameReducer(state, { type: 'RETURN_FROM_CHARACTER_GRAVEYARD', player: 'p2', index: 0 });
    expect(state.players.p2.characterGraveyard).toEqual([]);
    expect(state.players.p2.hand).toHaveLength(handBefore + 1);
    expect(state.players.p2.hand.at(-1)).toMatchObject({ kind: 'character', entryId: 'itachi' });
  });
});

describe('Character Deck tools (trust mode)', () => {
  const withDeck = (s: GameState): GameState => ({
    ...trust(s),
    players: { ...s.players, p1: { ...s.players.p1, characterDeck: ['konan', 'zetsu', 'juzo', 'yahiko'] } },
  });

  it('search takes the chosen card to hand and shuffles the rest, without paying or raising the tax', () => {
    let state = withDeck(freshCombat());
    const taxBefore = state.players.p1.reinforcementsPlayed;
    state = gameReducer(state, { type: 'CHARACTER_DECK_TAKE', player: 'p1', index: 2 });
    expect(state.players.p1.hand.at(-1)).toMatchObject({ kind: 'character', entryId: 'juzo' });
    expect([...state.players.p1.characterDeck].sort()).toEqual(['konan', 'yahiko', 'zetsu']);
    expect(state.players.p1.reinforcementsPlayed).toBe(taxBefore);
  });

  it('shuffle keeps the same cards', () => {
    const state = gameReducer(withDeck(freshCombat()), { type: 'SHUFFLE_CHARACTER_DECK', player: 'p1' });
    expect([...state.players.p1.characterDeck].sort()).toEqual(['juzo', 'konan', 'yahiko', 'zetsu']);
  });
});
