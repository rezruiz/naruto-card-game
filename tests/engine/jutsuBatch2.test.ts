import { describe, expect, it } from 'vitest';
import { activateAbility } from '../../src/engine/abilities';
import { gameReducer } from '../../src/engine/reducer';
import { makeHandCardInstance } from '../../src/engine/deck';
import { freshCombat, freshMain1, giveChakra, resolveTop, withCharacterAt, playCard } from './testUtils';
import type { GameState, PlayerId } from '../../src/engine/types';

// The 2026-10-19 Jutsu batch (SPEC.md §13b): Mud Wall, Kunai Deflection,
// Water Shark Bullet, Great Breakthrough, Finishing Blow, Senbon Volley,
// Scroll of Techniques, Smoke Out, Reconnaissance.

function withHandCard(state: GameState, player: PlayerId, defId: string) {
  const card = makeHandCardInstance(defId);
  const next = {
    ...state,
    players: {
      ...state.players,
      [player]: { ...state.players[player], hand: [...state.players[player].hand, { kind: 'card' as const, instanceId: card.instanceId, defId: card.defId }] },
    },
  };
  return { state: next, instanceId: card.instanceId };
}

const hp = (s: GameState, player: PlayerId, i: number) => s.players[player].backRow[i]!.currentHP;

function patchBackRow(s: GameState, player: PlayerId, i: number, patch: (c: NonNullable<GameState['players']['p1']['backRow'][number]>) => object): GameState {
  return {
    ...s,
    players: { ...s.players, [player]: { ...s.players[player], backRow: s.players[player].backRow.map((c, j) => (j === i && c ? { ...c, ...patch(c) } : c)) } },
  };
}

/** p2 (active, Combat) aims the Thousand Hungry Sharks card (enabled by Kisame: all 4 damage, Water Ninjutsu) at p1's Hidan; p1 then has priority to respond. */
function p2AttacksHidan(state: GameState): GameState {
  const s: GameState = { ...giveChakra(state, 'p2', 6), activePlayer: 'p2', priorityPlayer: 'p2', phase: 'Combat' };
  return playCard(s, 'p2', 'jutsu-thousand-hungry-sharks', 'p2-kisame', ['p1-hidan']);
}

describe('Earth Style: Mud Wall', () => {
  it('prevents 2 of a Ninjutsu attack on a character you control', () => {
    let { state, instanceId } = withHandCard(giveChakra(freshMain1(), 'p1', 2), 'p1', 'mud-wall');
    state = p2AttacksHidan(state);
    const before = hp(state, 'p1', 1);
    state = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-deidara', targetInstanceIds: ['p1-hidan'], payFromPool: 0 });
    expect(state.stack).toHaveLength(2);
    state = resolveTop(resolveTop(state));
    expect(hp(state, 'p1', 1)).toBe(before - 2); // 4 damage, 2 prevented
  });

  it('needs an Earth-Style enabler', () => {
    let { state, instanceId } = withHandCard(giveChakra(freshMain1(), 'p1', 2), 'p1', 'mud-wall');
    state = p2AttacksHidan(state);
    state = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-hidan', targetInstanceIds: ['p1-hidan'], payFromPool: 0 });
    expect(state.stack).toHaveLength(1);
  });
});

describe('Kunai Deflection', () => {
  it('prevents 1 of an attack aimed at its own enabler, and only its enabler', () => {
    let { state, instanceId } = withHandCard(giveChakra(freshMain1(), 'p1', 2), 'p1', 'kunai-deflection');
    state = p2AttacksHidan(state);
    const refused = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-deidara', targetInstanceIds: [], payFromPool: 0 });
    expect(refused.stack).toHaveLength(1); // Deidara isn't the one being attacked

    const before = hp(state, 'p1', 1);
    state = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-hidan', targetInstanceIds: [], payFromPool: 0 });
    expect(state.stack).toHaveLength(2);
    state = resolveTop(resolveTop(state));
    expect(hp(state, 'p1', 1)).toBe(before - 3);
  });
});

describe('Water Style: Water Shark Bullet', () => {
  it('deals 2 and Absorbs 1 from the target into the enabler', () => {
    let { state, instanceId } = withHandCard(giveChakra(freshCombat(), 'p1', 3), 'p1', 'water-shark-bullet');
    state = patchBackRow(state, 'p2', 1, (c) => ({ chakraPool: { ...c.chakraPool, current: 1 } }));
    const hpBefore = hp(state, 'p2', 1);
    const kisamePoolBefore = state.players.p1.backRow[3]!.chakraPool.current;
    state = resolveTop(gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kisame', targetInstanceIds: ['p2-hidan'], payFromPool: 0 }));
    expect(hp(state, 'p2', 1)).toBe(hpBefore - 2);
    expect(state.players.p2.backRow[1]!.chakraPool.current).toBe(0);
    expect(state.players.p1.backRow[3]!.chakraPool.current).toBe(kisamePoolBefore + 1);
  });
});

describe('Wind Style: Great Breakthrough', () => {
  it('chooses up to 3 enemy units — a choice targets nothing, so Substitution has nothing to negate', () => {
    let { state, instanceId } = withHandCard(giveChakra(freshCombat(), 'p1', 3), 'p1', 'great-breakthrough');
    const sub = withHandCard(giveChakra(state, 'p2', 4), 'p2', 'substitution');
    state = sub.state;
    const before = [1, 2, 3].map((i) => hp(state, 'p2', i));

    state = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: ['p2-hidan', 'p2-deidara', 'p2-kisame'], payFromPool: 0 });
    expect(state.stack).toHaveLength(1);
    expect(state.stack[0].targets).toEqual([]);

    state = gameReducer(state, { type: 'PASS_PRIORITY' }); // p2 has priority now
    const withSub = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId: sub.instanceId, enablingInstanceId: 'p2-hidan', targetInstanceIds: [], payFromPool: 0 });
    expect(withSub.stack).toHaveLength(1); // refused — nothing targets Hidan

    state = gameReducer(state, { type: 'PASS_PRIORITY' });
    expect([1, 2, 3].map((i) => hp(state, 'p2', i))).toEqual(before.map((h) => h - 1));
  });
});

describe('Finishing Blow', () => {
  const play = (state: GameState) => {
    const card = withHandCard(giveChakra(state, 'p1', 2), 'p1', 'finishing-blow');
    return gameReducer(card.state, { type: 'PLAY_HAND_CARD', instanceId: card.instanceId, enablingInstanceId: 'p1-hidan', targetInstanceIds: ['p2-deidara'], payFromPool: 0 });
  };
  // Deidara (10 HP) — Hidan's Jashin's Blessing would keep him at 1 HP.
  const atHp = (n: number) => patchBackRow(freshCombat(), 'p2', 2, () => ({ currentHP: n }));

  it('needs a target at half its max HP or less (rounded down)', () => {
    expect(play(freshCombat()).stack).toHaveLength(0); // Deidara at 10/10
    expect(play(atHp(6)).stack).toHaveLength(0); // 6 > ⌊10/2⌋
  });

  it('deals 2, or 3 if the target is at 3 HP or less', () => {
    expect(hp(resolveTop(play(atHp(5))), 'p2', 2)).toBe(3);
    expect(resolveTop(play(atHp(3))).players.p2.backRow[2]).toBeNull(); // 3 damage defeats him
  });
});

describe('Senbon Volley', () => {
  const play = (state: GameState, enabler: string) => {
    const card = withHandCard(giveChakra(state, 'p1', 2), 'p1', 'senbon-volley');
    return resolveTop(gameReducer(card.state, { type: 'PLAY_HAND_CARD', instanceId: card.instanceId, enablingInstanceId: enabler, targetInstanceIds: ['p2-deidara'], payFromPool: 0 }));
  };

  it('deals 2, and adds 1 Poison counter only with a Poison-Style enabler', () => {
    const before = hp(freshCombat(), 'p2', 2);
    const plain = play(freshCombat(), 'p1-hidan');
    expect(hp(plain, 'p2', 2)).toBe(before - 2);
    expect(plain.players.p2.backRow[2]!.extra.poisonCounters ?? 0).toBe(0);

    const poisoned = play(withCharacterAt(freshCombat(), 'p1', 4, 'sasori-hiruko'), 'p1-sasori-hiruko');
    expect(hp(poisoned, 'p2', 2)).toBe(before - 2);
    expect(poisoned.players.p2.backRow[2]!.extra.poisonCounters).toBe(1);
  });
});

describe('Scroll of Techniques', () => {
  it("looks at the top 3 and takes a Jutsu matching one of your characters' Styles", () => {
    let { state, instanceId } = withHandCard(giveChakra(freshMain1(), 'p1', 1), 'p1', 'scroll-of-techniques');
    const top = ['explosive-tag', 'water-substitution', 'field-intelligence', 'jutsu-searing-migraine'].map(makeHandCardInstance);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, handDeck: [...top, ...state.players.p1.handDeck] } } };
    state = resolveTop(gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: '', targetInstanceIds: [], payFromPool: 0 }));
    const handIds = state.players.p1.hand.map((h) => (h.kind === 'card' ? h.defId : ''));
    expect(handIds).toContain('water-substitution'); // Water — Kisame matches; Explosive Tag (Style: None) never counts
    expect(handIds).not.toContain('jutsu-searing-migraine'); // 4th card, never looked at
    expect(state.players.p1.handDeck.some((c) => c.defId === 'explosive-tag')).toBe(true); // shuffled back
  });
});

describe('Smoke Out', () => {
  it('chooses a Retreated enemy character and forces it out, with Field Orientation', () => {
    let { state, instanceId } = withHandCard(giveChakra(freshMain1(), 'p1', 4), 'p1', 'smoke-out');
    state = patchBackRow(state, 'p2', 1, (c) => ({ status: { ...c.status, retreated: true } }));
    state = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: '', targetInstanceIds: ['p2-hidan'], payFromPool: 0 });
    expect(state.stack).toHaveLength(1);
    expect(state.stack[0].targets).toEqual([]); // a choice, not a target
    state = resolveTop(state);
    expect(state.players.p2.backRow[1]!.status.retreated).toBe(false);
    expect(state.players.p2.backRow[1]!.status.enteredTurn).toBe(state.turn);
    expect(state.players.p1.genericChakraAvailable).toBe(0);
  });

  it("can't choose a character that isn't Retreated", () => {
    const { state, instanceId } = withHandCard(giveChakra(freshMain1(), 'p1', 4), 'p1', 'smoke-out');
    const next = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: '', targetInstanceIds: ['p2-hidan'], payFromPool: 0 });
    expect(next.stack).toHaveLength(0);
  });
});

describe('Reconnaissance', () => {
  it('draws 1 for 1 Chakra, or 2 if you pay 2 more', () => {
    const play = (amount: number) => {
      const base = giveChakra(freshMain1(), 'p1', 3);
      const deck = ['explosive-tag', 'field-intelligence', 'smoke-out'].map(makeHandCardInstance);
      const card = withHandCard({ ...base, players: { ...base.players, p1: { ...base.players.p1, handDeck: deck } } }, 'p1', 'reconnaissance');
      const handBefore = card.state.players.p1.hand.length - 1;
      const state = resolveTop(gameReducer(card.state, { type: 'PLAY_HAND_CARD', instanceId: card.instanceId, enablingInstanceId: '', targetInstanceIds: [], payFromPool: 0, amount }));
      return { drawn: state.players.p1.hand.length - handBefore, left: state.players.p1.genericChakraAvailable };
    };
    expect(play(0)).toEqual({ drawn: 1, left: 2 });
    expect(play(1)).toEqual({ drawn: 2, left: 0 });
  });
});
