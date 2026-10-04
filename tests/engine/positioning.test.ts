import { describe, expect, it } from 'vitest';
import { legalCharacterSlots, legalTokenSlots, placeCharacter, placeToken } from '../../src/engine/board';
import { createCharacterInstance, createSixPaths } from '../../src/engine/characters';
import { gameReducer } from '../../src/engine/reducer';
import { freshMain1 } from './testUtils';
import type { GameState } from '../../src/engine/types';

const ids = (s: GameState) => s.players.p1.backRow.map((c) => c?.instanceId ?? null);
const withBack = (s: GameState, row: (string | null)[]): GameState => {
  const pool = freshMain1().players.p1.backRow;
  return { ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: row.map((id) => (id ? pool.find((c) => c?.instanceId === id)! : null)) } } };
};

describe('Selective positioning (§9)', () => {
  it('a new character must go beside one of yours, or into an occupied slot (pushing it aside)', () => {
    const s = withBack(freshMain1(), [null, 'p1-kakuzu', null, null, null]);
    expect(legalCharacterSlots(s, 'p1')).toEqual([0, 1, 2]);
  });

  it('with no characters in play, any slot is fine', () => {
    expect(legalCharacterSlots(withBack(freshMain1(), [null, null, null, null, null]), 'p1')).toEqual([0, 1, 2, 3, 4]);
  });

  it("taking an occupied slot shifts the characters there toward the nearest gap", () => {
    let s = withBack(freshMain1(), ['p1-kakuzu', 'p1-hidan', null, null, null]);
    const newcomer = createCharacterInstance('juzo', 'p1', 'p1-juzo-new', s.turn);
    s = placeCharacter(s, 'p1', newcomer, 0);
    expect(ids(s)).toEqual(['p1-juzo-new', 'p1-kakuzu', 'p1-hidan', null, null]);
  });

  it('an illegal slot falls back to the first legal empty slot', () => {
    let s = withBack(freshMain1(), ['p1-kakuzu', null, null, null, null]);
    s = placeCharacter(s, 'p1', createCharacterInstance('juzo', 'p1', 'p1-juzo-new', s.turn), 4);
    expect(ids(s)).toEqual(['p1-kakuzu', 'p1-juzo-new', null, null, null]);
  });

  it('PLAY_CHARACTER puts the card in the chosen slot', () => {
    let s = withBack(freshMain1(), [null, null, 'p1-kakuzu', null, null]);
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, hand: [...s.players.p1.hand, { kind: 'character', instanceId: 'h-juzo', entryId: 'juzo' }] } } };
    s = gameReducer(s, { type: 'PLAY_CHARACTER', instanceId: 'h-juzo', slot: 1 });
    expect(s.players.p1.backRow[1]?.defId).toBe('juzo');
  });

  it('tokens go beside an existing token and never push one aside; with tokens out, the controller is asked where', () => {
    let s = freshMain1();
    const [deva, asura] = createSixPaths('p1');
    s = placeToken(s, 'p1', deva);
    expect(s.pendingChoices).toHaveLength(0); // first token on an empty row: no question
    expect(legalTokenSlots(s, 'p1')).toEqual([1]);
    s = placeToken(s, 'p1', asura, { askPosition: true });
    expect(s.pendingChoices).toHaveLength(0); // only one legal slot
  });
});
