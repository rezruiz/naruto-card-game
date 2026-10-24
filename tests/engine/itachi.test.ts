import { describe, expect, it } from 'vitest';
import { activateAbility, checkLegality, findAbility } from '../../src/engine/abilities';
import { gameReducer } from '../../src/engine/reducer';
import { dealDamage } from '../../src/engine/combat';
import { makeHandCardInstance } from '../../src/engine/deck';
import { freshCombat, giveChakra, resolveTop } from './testUtils';
import type { GameState } from '../../src/engine/types';

describe('Itachi', () => {
  it('Failing Health caps Itachi at 2 ability activations per turn', () => {
    let state = giveChakra(freshCombat(), 'p1', 10);
    state = activateAbility(state, 'p1-itachi', 'crow-shuriken-barrage', ['p2-kakuzu'], 0);
    state = resolveTop(state);
    state = activateAbility(state, 'p1-itachi', 'great-fireball-technique', ['p2-kakuzu'], 0);
    state = resolveTop(state);

    const stackBefore = state.stack.length;
    state = activateAbility(state, 'p1-itachi', 'crow-shuriken-barrage', ['p2-hidan'], 0);
    expect(state.stack.length).toBe(stackBefore); // 3rd activation this turn rejected
  });

  it('Failing Health: never his Ultimate and his Forbidden Technique in the same turn', () => {
    let state = giveChakra(freshCombat(), 'p1', 16);
    state = resolveTop(activateAbility(state, 'p1-itachi', 'amaterasu', ['p2-itachi'], 0));
    const stackBefore = state.stack.length;
    state = activateAbility(state, 'p1-itachi', 'tsukuyomi-infinite-agony', ['p2-hidan'], 0);
    expect(state.stack.length).toBe(stackBefore);
  });

  it('Tsukuyomi deals 5 and stuns for the next turn cycle — no Mind Prison needed', () => {
    let state = giveChakra(freshCombat(), 'p1', 8);
    const hp = state.players.p2.backRow[1]!.currentHP;
    state = resolveTop(activateAbility(state, 'p1-itachi', 'tsukuyomi-infinite-agony', ['p2-hidan'], 0));
    expect(state.players.p2.backRow[1]!.currentHP).toBe(hp - 5);
    expect(state.players.p2.backRow[1]!.extra.stunnedUntilTurn).toBe(state.turn + 2);
  });

  it('Amaterasu deals 3 immediately, then 1 more at the start of each of the next 3 of Itachi\'s controller\'s Upkeeps', () => {
    let state = giveChakra(freshCombat(), 'p1', 8);
    // Target p2's own Itachi (11 HP) rather than Kakuzu, whose Five Hearts
    // would intercept a lethal-looking tick and muddy the HP math here.
    const hpBefore = state.players.p2.backRow[4]!.currentHP;
    state = activateAbility(state, 'p1-itachi', 'amaterasu', ['p2-itachi'], 0);
    state = resolveTop(state);
    expect(state.players.p2.backRow[4]!.currentHP).toBe(hpBefore - 3);

    // Advance to p1's next Upkeep (11 phases from Combat).
    for (let i = 0; i < 11; i++) state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    expect(state.activePlayer).toBe('p1');
    expect(state.phase).toBe('Upkeep');
    expect(state.players.p2.backRow[4]!.currentHP).toBe(hpBefore - 4);

    for (let round = 2; round <= 3; round++) {
      for (let i = 0; i < 14; i++) state = gameReducer(state, { type: 'ADVANCE_PHASE' });
      expect(state.players.p2.backRow[4]!.currentHP).toBe(hpBefore - 3 - round);
    }
    expect(state.players.p1.backRow[4]!.extra.amaterasuSchedule).toEqual([]);
  });
});

function withHandCard(state: GameState, player: 'p1' | 'p2', defId: string) {
  const card = makeHandCardInstance(defId);
  const p = state.players[player];
  return { state: { ...state, players: { ...state.players, [player]: { ...p, hand: [...p.hand, { kind: 'card' as const, instanceId: card.instanceId, defId }] } } }, instanceId: card.instanceId };
}
const play = (s: GameState, instanceId: string, enabler: string, targets: string[] = []) =>
  gameReducer(s, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: enabler, targetInstanceIds: targets, payFromPool: 0 });

describe('Genjutsu: Mind Prison (Jutsu card)', () => {
  it('costs 5 with a non-Genjutsu enabler, 2 with Itachi (3 for a Genjutsu user, −1 Genjutsu Master)', () => {
    for (const [enabler, cost] of [['p1-kakuzu', 5], ['p1-itachi', 2]] as const) {
      let { state, instanceId } = withHandCard(giveChakra(freshCombat(), 'p1', 5), 'p1', 'jutsu-mind-prison');
      state = play(state, instanceId, enabler, ['p2-kakuzu']);
      expect(state.stack).toHaveLength(1);
      expect(state.players.p1.genericChakraAvailable).toBe(5 - cost);
    }
  });

  it("stuns for the target's controller's turn: no abilities, no pooling, no enabling Jutsu cards", () => {
    let { state, instanceId } = withHandCard(giveChakra(freshCombat(), 'p1', 5), 'p1', 'jutsu-mind-prison');
    state = resolveTop(play(state, instanceId, 'p1-itachi', ['p2-kakuzu']));
    expect(state.players.p2.backRow[0]!.extra.stunnedUntilTurn).toBe(state.turn + 1);

    expect(checkLegality(state, 'p2-kakuzu', findAbility('kakuzu', 'earth-grudge-fear')!, ['p1-kakuzu'], 0).ok).toBe(false);
    state = { ...state, activePlayer: 'p2' };
    const poolBefore = state.players.p2.backRow[0]!.chakraPool.current;
    expect(gameReducer(state, { type: 'POOL_CHAKRA', instanceId: 'p2-kakuzu', amount: 1 }).players.p2.backRow[0]!.chakraPool.current).toBe(poolBefore);
    const sub = withHandCard(giveChakra(state, 'p2', 4), 'p2', 'substitution');
    expect(play(sub.state, sub.instanceId, 'p2-kakuzu').stack).toHaveLength(state.stack.length);
  });

  it("cast during the opponent's own turn, it lasts the rest of that turn only", () => {
    let { state, instanceId } = withHandCard(giveChakra(freshCombat(), 'p1', 5), 'p1', 'jutsu-mind-prison');
    state = resolveTop(play({ ...state, activePlayer: 'p2', priorityPlayer: 'p1' }, instanceId, 'p1-itachi', ['p2-kakuzu']));
    expect(state.players.p2.backRow[0]!.extra.stunnedUntilTurn).toBe(state.turn);
  });
});

describe('Genjutsu: Crow Clone (Jutsu card)', () => {
  it('needs a Sharingan user to enable it — Itachi has Sharingan', () => {
    const { state, instanceId } = withHandCard(giveChakra(freshCombat(), 'p1', 2), 'p1', 'jutsu-crow-clone');
    expect(play(state, instanceId, 'p1-kakuzu').stack).toHaveLength(0);
    expect(state.players.p1.backRow.find((c) => c?.defId === 'itachi')!.styles).toContain('Sharingan');
    // Any character with Sharingan can: give Kakuzu the tag.
    const tagged: GameState = { ...state, players: { ...state.players, p1: { ...state.players.p1, backRow: state.players.p1.backRow.map((c) => (c?.defId === 'kakuzu' ? { ...c, styles: [...c.styles, 'Sharingan'] } : c)) } } };
    expect(play(tagged, instanceId, 'p1-kakuzu').stack).toHaveLength(1);
  });

  it('negates targeting of Itachi and all new damage to him for the rest of the turn — lingering damage still lands', () => {
    let state = giveChakra(freshCombat(), 'p2', 4);
    state = { ...state, activePlayer: 'p2', priorityPlayer: 'p2' };
    state = activateAbility(state, 'p2-kakuzu', 'earth-grudge-fear', ['p1-itachi'], 0);
    expect(state.stack).toHaveLength(1);

    const card = withHandCard(giveChakra(state, 'p1', 2), 'p1', 'jutsu-crow-clone');
    state = play({ ...card.state, priorityPlayer: 'p1' }, card.instanceId, 'p1-itachi');
    expect(state.stack).toHaveLength(2);
    expect(state.players.p1.genericChakraAvailable).toBe(1); // 2, −1 for Genjutsu Master

    const hp = state.players.p1.backRow[4]!.currentHP;
    state = gameReducer(state, { type: 'PASS_PRIORITY' });
    state = gameReducer(state, { type: 'PASS_PRIORITY' });
    expect(state.stack).toHaveLength(0); // the attack lost its only target
    expect(state.players.p1.backRow[4]!.currentHP).toBe(hp);

    expect(checkLegality(state, 'p2-hidan', findAbility('hidan', 'triple-scythe-sweep')!, ['p1-itachi'], 0).ok).toBe(false);
    expect(dealDamage(state, 'p1-itachi', 3).dealt).toBe(0);
    expect(dealDamage(state, 'p1-itachi', 1, { ongoing: true, cannotBeReduced: true }).state.players.p1.backRow[4]!.currentHP).toBe(hp - 1);
  });
});

describe('Lingering effects on a defeated unit are dropped', () => {
  it("Amaterasu's scheduled burn and Itachi's per-target tallies forget a target once it's defeated", () => {
    let state = freshCombat();
    const itachiIndex = state.players.p1.backRow.findIndex((c) => c?.defId === 'itachi');
    state = {
      ...state,
      players: {
        ...state.players,
        p1: {
          ...state.players.p1,
          backRow: state.players.p1.backRow.map((c, i) =>
            i === itachiIndex && c
              ? { ...c, extra: { ...c.extra, amaterasuSchedule: [{ targetInstanceId: 'p2-kisame', ticksLeft: 2 }], damageTakenFrom: { 'p2-kisame': 3 } } }
              : c,
          ),
        },
      },
    };
    state = dealDamage(state, 'p2-kisame', 9999).state;
    const itachi = state.players.p1.backRow[itachiIndex]!;
    expect(itachi.extra.amaterasuSchedule).toEqual([]);
    expect(itachi.extra.damageTakenFrom).toEqual({});
  });
});

describe('Itachi: Summoning: Crows', () => {
  it('finds Genjutsu: Crow Clone in the Jutsu Deck, shuffles the rest and puts it on top', () => {
    let state = giveChakra({ ...freshCombat(), phase: 'Main1' }, 'p1', 1);
    const deck = ['substitution', 'jutsu-crow-clone', 'explosive-tag', 'reconnaissance'].map(makeHandCardInstance);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, handDeck: deck } } };
    state = resolveTop(activateAbility(state, 'p1-itachi', 'summoning-crows', [], 0));
    expect(state.players.p1.handDeck[0].defId).toBe('jutsu-crow-clone');
    expect(state.players.p1.handDeck).toHaveLength(4);
    expect(state.players.p1.genericChakraAvailable).toBe(0);
  });

  it('with no Crow Clone left it just shuffles', () => {
    let state = giveChakra({ ...freshCombat(), phase: 'Main1' }, 'p1', 1);
    const deck = ['substitution', 'explosive-tag'].map(makeHandCardInstance);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, handDeck: deck } } };
    state = resolveTop(activateAbility(state, 'p1-itachi', 'summoning-crows', [], 0));
    expect(state.players.p1.handDeck.map((c) => c.defId).sort()).toEqual(['explosive-tag', 'substitution']);
  });
});
