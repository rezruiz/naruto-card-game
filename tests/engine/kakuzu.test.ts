import { describe, expect, it } from 'vitest';
import { activateAbility } from '../../src/engine/abilities';
import { gameReducer } from '../../src/engine/reducer';
import { dealDamage } from '../../src/engine/combat';
import { getCharacterDeckEntry } from '../../src/engine/characters';
import { makeHandCardInstance } from '../../src/engine/deck';
import { freshCombat, freshMain1, giveChakra, resolveTop } from './testUtils';
import type { GameState } from '../../src/engine/types';

const setKakuzu = (s: GameState, patch: (k: NonNullable<GameState['players']['p1']['backRow'][number]>) => object): GameState => ({
  ...s,
  players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c) => (c?.defId === 'kakuzu' ? ({ ...c, ...patch(c) } as typeof c) : c)) } },
});

describe('Kakuzu', () => {
  it('Earth Grudge Fear (2 Chakra) deals 1 damage to any target (including an ally)', () => {
    let state = giveChakra(freshCombat(), 'p1', 2);
    const hpBefore = state.players.p1.backRow[1]?.currentHP ?? 0; // Hidan, an ally
    state = activateAbility(state, 'p1-kakuzu', 'earth-grudge-fear', ['p1-hidan'], 0);
    expect(state.players.p1.genericChakraAvailable).toBe(0);
    state = resolveTop(state);
    expect(state.players.p1.backRow[1]?.currentHP).toBe(hpBefore - 1);
  });

  it('Iron Skin: −2 physical and −2 elemental for the next turn cycle, and Earth Grudge Fear deals +2', () => {
    let state = giveChakra(freshCombat(), 'p1', 6);
    state = resolveTop(activateAbility(state, 'p1-kakuzu', 'iron-skin', [], 0));
    expect(state.players.p1.backRow[0]!.extra.ironSkinUntilTurn).toBe(state.turn + 1);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, backRow: state.players.p1.backRow.map((c) => (c?.defId === 'kakuzu' ? { ...c, status: { ...c.status, usedAbilitiesThisTurn: [] } } : c)) } } };
    state = giveChakra(state, 'p1', 2);
    const hp = state.players.p2.backRow[1]!.currentHP;
    state = resolveTop(activateAbility(state, 'p1-kakuzu', 'earth-grudge-fear', ['p2-hidan'], 0));
    expect(state.players.p2.backRow[1]!.currentHP).toBe(hp - 3);
  });

  it("won't activate an ability requiring a Style Kakuzu doesn't have", () => {
    const state = setKakuzu(giveChakra(freshCombat(), 'p1', 5), (k) => ({ styles: k.styles.filter((s) => s !== 'Earth') }));
    expect(activateAbility(state, 'p1-kakuzu', 'iron-skin', [], 0).stack).toHaveLength(0);
  });

  describe('losing a Heart', () => {
    const fall = (pool: number) => {
      const s = setKakuzu(freshCombat(), (k) => ({ currentHP: 1, chakraPool: { ...k.chakraPool, current: pool } }));
      return dealDamage(s, 'p1-kakuzu', 1).state.players.p1.backRow[0]!;
    };

    it('keeps his Chakra when it still fits', () => {
      expect(fall(5).chakraPool).toEqual({ current: 5, capacity: 8 });
    });

    it('drops to the new max when it would be over', () => {
      expect(fall(10).chakraPool).toEqual({ current: 8, capacity: 8 });
    });
  });

  it('Patchwork Threads: 2 Chakra from his Pool after a kill — regain a Heart, heal 3, gain 2 Chakra to his Pool', () => {
    let state = freshMain1(); // pooling is a Main Phase action
    state = giveChakra(state, 'p1', 3);
    state = gameReducer(state, { type: 'POOL_CHAKRA', instanceId: 'p1-kakuzu', amount: 3 });
    for (let i = 0; i < 14; i++) state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    expect(state.activePlayer).toBe('p1');
    expect(state.phase).toBe('Main1');
    state = setKakuzu(state, (k) => ({ currentHP: 1, extra: { ...k.extra, hearts: 3 } }));
    // Its trigger: Kakuzu defeated someone this turn (combat.ts credits the kill).
    expect(activateAbility(state, 'p1-kakuzu', 'patchwork-threads', [], 2).stack).toHaveLength(0);
    state = setKakuzu(state, (k) => ({ extra: { ...k.extra, lastKillTurn: state.turn } }));
    // Paying from generic Chakra isn't allowed — it's 2 from his Pool.
    expect(activateAbility(giveChakra(state, 'p1', 2), 'p1-kakuzu', 'patchwork-threads', [], 0).stack).toHaveLength(0);
    state = resolveTop(activateAbility(state, 'p1-kakuzu', 'patchwork-threads', [], 2));
    const k = state.players.p1.backRow[0]!;
    expect(k.extra.hearts).toBe(4);
    expect(k.currentHP).toBe(4); // 1 + 3, at max
    expect(k.chakraPool.current).toBe(3); // 3 − 2 + 2
  });

  it('Patchwork Threads takes an elemental Style even if Kakuzu already has it; losing a Heart drops one copy', () => {
    let state = setKakuzu(freshCombat(), (k) => ({ extra: { ...k.extra, lastKillTurn: 0, lastKillStyles: ['Fire'] }, chakraPool: { ...k.chakraPool, current: 2 } }));
    state = { ...state, turn: 0 };
    state = resolveTop(activateAbility(state, 'p1-kakuzu', 'patchwork-threads', [], 2));
    expect(state.players.p1.backRow[0]!.styles.filter((s) => s === 'Fire')).toHaveLength(2);
    state = dealDamage(state, 'p1-kakuzu', 99, { cannotBeReduced: true }).state;
    expect(state.players.p1.backRow[0]!.styles.filter((s) => s === 'Fire')).toHaveLength(1);
  });

  it('Elemental Versatility: the first elemental jutsu each turn costs 1 less — Jutsu cards he enables included', () => {
    let state = giveChakra(freshCombat(), 'p1', 12);
    state = activateAbility(state, 'p1-kakuzu', 'iron-skin', [], 0); // Earth Ninjutsu, printed 5
    expect(state.players.p1.genericChakraAvailable).toBe(8);
    state = resolveTop(state);
    const card = makeHandCardInstance('jutsu-searing-migraine');
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, hand: [...state.players.p1.hand, { kind: 'card', instanceId: card.instanceId, defId: card.defId }] } } };
    state = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId: card.instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: ['p2-hidan'], payFromPool: 0 });
    expect(state.players.p1.genericChakraAvailable).toBe(5); // full 3 — the discount is spent
  });

  it('Heart Masks: entering play pulls Pressure Damage, Searing Migraine and False Darkness from the Jutsu Deck', () => {
    let state = freshMain1();
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, backRow: state.players.p1.backRow.map((c) => (c?.defId === 'kakuzu' ? null : c)) } } };
    const deck = ['substitution', 'jutsu-false-darkness', 'jutsu-pressure-damage', 'jutsu-searing-migraine', 'jutsu-searing-migraine'].map(makeHandCardInstance);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, handDeck: deck } } };
    const handBefore = state.players.p1.hand.length;
    state = getCharacterDeckEntry('kakuzu')!.spawn(state, 'p1', state.turn, false);
    const added = state.players.p1.hand.slice(handBefore).map((h) => (h as { defId: string }).defId).sort();
    expect(added).toEqual(['jutsu-false-darkness', 'jutsu-pressure-damage', 'jutsu-searing-migraine']);
    expect(state.players.p1.handDeck.map((c) => c.defId).sort()).toEqual(['jutsu-searing-migraine', 'substitution']);
  });
});
