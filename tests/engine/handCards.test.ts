import { describe, expect, it } from 'vitest';
import { activateAbility } from '../../src/engine/abilities';
import { gameReducer } from '../../src/engine/reducer';
import { dealDamage } from '../../src/engine/combat';
import { makeHandCardInstance } from '../../src/engine/deck';
import { previewUpkeep } from '../../src/engine/upkeep';
import { redactStateFor } from '../../src/engine/redact';
import { freshMain1, giveChakra, playCard, resolveTop } from './testUtils';
import type { GameState } from '../../src/engine/types';

function withHandCard(state: GameState, player: 'p1' | 'p2', defId: string) {
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

describe('Substitution family (SPEC.md §13b)', () => {
  it('negates a targeted attack aimed at the enabling character, costing 2 (not 4) if paid from its own Pool', () => {
    let { state, instanceId } = withHandCard(giveChakra(freshMain1(), 'p2', 3), 'p1', 'substitution');
    state = { ...state, activePlayer: 'p2', priorityPlayer: 'p2', phase: 'Combat' };
    state = activateAbility(state, 'p2-kakuzu', 'earth-grudge-fear', ['p1-hidan'], 0);
    expect(state.stack).toHaveLength(1);

    // Fund entirely from Hidan's own Pool.
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, backRow: state.players.p1.backRow.map((c, i) => (i === 1 && c ? { ...c, chakraPool: { ...c.chakraPool, current: 2 } } : c)) } } };
    state = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-hidan', targetInstanceIds: [], payFromPool: 2 });
    expect(state.stack).toHaveLength(2);
    expect(state.players.p1.backRow[1]!.chakraPool.current).toBe(0); // paid 2 from Pool

    const hidanHpBefore = state.players.p1.backRow[1]!.currentHP;
    state = gameReducer(state, { type: 'PASS_PRIORITY' });
    state = gameReducer(state, { type: 'PASS_PRIORITY' }); // resolves Substitution, negating Earth Grudge Fear
    expect(state.stack).toHaveLength(0);
    expect(state.players.p1.backRow[1]!.currentHP).toBe(hidanHpBefore); // never took the damage
  });

  it('Lightning Substitution deals 2 to the source of a negated Taijutsu attack', () => {
    // Kakuzu (not Hidan) enables this — Lightning Substitution requires
    // Style: Lightning, and Hidan's only Style is Ritual.
    let { state, instanceId } = withHandCard(giveChakra(freshMain1(), 'p2', 3), 'p1', 'lightning-substitution');
    state = { ...state, activePlayer: 'p2', priorityPlayer: 'p2', phase: 'Combat' };
    state = activateAbility(state, 'p2-kakuzu', 'earth-grudge-fear', ['p1-kakuzu'], 0); // Type: Taijutsu
    expect(state.stack).toHaveLength(1);

    state = giveChakra(state, 'p1', 4);
    state = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: [], payFromPool: 0 });
    expect(state.stack).toHaveLength(2);

    const kakuzuHpBefore = state.players.p2.backRow[0]!.currentHP;
    state = gameReducer(state, { type: 'PASS_PRIORITY' });
    state = gameReducer(state, { type: 'PASS_PRIORITY' });
    expect(state.players.p2.backRow[0]!.currentHP).toBe(kakuzuHpBefore - 2); // punished for the negated Taijutsu attack
  });
});

describe('Deck-inspection Jutsu cards', () => {
  it('Incoming Mission Assignment finds a Mission among the top 6 and adds it to hand', () => {
    let { state, instanceId } = withHandCard(freshMain1(), 'p1', 'incoming-mission-assignment');
    // Stack the top of the deck: 5 non-Missions, then 1 Mission.
    state = {
      ...state,
      players: {
        ...state.players,
        p1: {
          ...state.players.p1,
          handDeck: [
            makeHandCardInstance('explosive-tag'),
            makeHandCardInstance('explosive-tag'),
            makeHandCardInstance('explosive-tag'),
            makeHandCardInstance('explosive-tag'),
            makeHandCardInstance('explosive-tag'),
            makeHandCardInstance('unshakable-resolve'),
            makeHandCardInstance('chakra-transfer'),
          ],
        },
      },
    };
    const deckSizeBefore = state.players.p1.handDeck.length;
    state = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: [], payFromPool: 0 });
    state = resolveTop(state);
    expect(state.players.p1.hand.some((h) => h.kind === 'card' && h.defId === 'unshakable-resolve')).toBe(true);
    expect(state.players.p1.handDeck).toHaveLength(deckSizeBefore - 1); // -1 taken, rest shuffled back (net -1 vs before the look)
  });
});

describe('Chakra Transfer', () => {
  it("moves X Chakra from one ally's Pool to another's, minus a 1-Chakra tax", () => {
    let state = freshMain1();
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, backRow: state.players.p1.backRow.map((c, i) => (i === 0 && c ? { ...c, chakraPool: { ...c.chakraPool, current: 4 } } : c)) } } };
    const { state: withCard, instanceId } = withHandCard(state, 'p1', 'chakra-transfer');
    state = withCard;
    const hidanCapacity = state.players.p1.backRow[1]!.chakraPool.capacity;

    state = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: ['p1-kakuzu', 'p1-hidan'], payFromPool: 0 });
    state = resolveTop(state);
    expect(state.players.p1.backRow[0]!.chakraPool.current).toBe(0);
    expect(state.players.p1.backRow[1]!.chakraPool.current).toBe(Math.min(3, hidanCapacity)); // 4 - 1 tax, capped by room
  });
});

describe('Deploy Medic Corps', () => {
  it('heals a Retreated ally 1 HP at each of the next 4 Upkeeps, cancelled if it returns from Retreat', () => {
    // Deidara (not Hidan) — Hidan has his own unrelated End Phase regen
    // trait, which would otherwise confound this test's HP math.
    let state = giveChakra(freshMain1(), 'p1', 5);
    state = dealDamage(state, 'p1-deidara', 3).state; // damaged first — a Retreated character can't be damaged (§6.5b)
    state = gameReducer(state, { type: 'RETREAT', instanceId: 'p1-deidara' });
    const { state: withCard, instanceId } = withHandCard(state, 'p1', 'deploy-medic-corps');
    state = withCard;
    const hpBefore = state.players.p1.backRow[2]!.currentHP;

    state = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: ['p1-deidara'], payFromPool: 0 });
    state = resolveTop(state);

    while (!(state.activePlayer === 'p1' && state.phase === 'Upkeep')) state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    expect(state.players.p1.backRow[2]!.currentHP).toBe(hpBefore + 1);

    // Return from Retreat (Main Phase only) — the remaining ticks should be cancelled.
    while (!(state.phase === 'Main1' || state.phase === 'Main2')) state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    state = gameReducer(state, { type: 'RETURN_FROM_RETREAT', instanceId: 'p1-deidara' });
    expect(state.players.p1.backRow[2]!.status.retreated).toBe(false); // sanity-check the return actually took effect
    const hpAfterReturn = state.players.p1.backRow[2]!.currentHP;
    for (let i = 0; i < 20; i++) state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    expect(state.players.p1.backRow[2]!.currentHP).toBe(hpAfterReturn); // no further heals — cancelled
  });
});

describe('Medical Chakra Infusion', () => {
  it('heals one of your characters 2 HP, never above max HP', () => {
    let state = giveChakra(freshMain1(), 'p1', 2);
    state = dealDamage(state, 'p1-deidara', 3).state;
    const hpBefore = state.players.p1.backRow[2]!.currentHP;
    const first = withHandCard(state, 'p1', 'medical-chakra-infusion');
    state = gameReducer(first.state, { type: 'PLAY_HAND_CARD', instanceId: first.instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: ['p1-deidara'], payFromPool: 0 });
    state = resolveTop(state);
    expect(state.players.p1.backRow[2]!.currentHP).toBe(hpBefore + 2);

    // 1 damage left — the second copy heals only up to max.
    const second = withHandCard(state, 'p1', 'medical-chakra-infusion');
    state = gameReducer(second.state, { type: 'PLAY_HAND_CARD', instanceId: second.instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: ['p1-deidara'], payFromPool: 0 });
    state = resolveTop(state);
    expect(state.players.p1.backRow[2]!.currentHP).toBe(state.players.p1.backRow[2]!.maxHP);
  });

  it('logs the cost that was paid', () => {
    let state = giveChakra(freshMain1(), 'p1', 1);
    state = dealDamage(state, 'p1-deidara', 3).state;
    const { state: withCard, instanceId } = withHandCard(state, 'p1', 'medical-chakra-infusion');
    state = gameReducer(withCard, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: ['p1-deidara'], payFromPool: 0 });
    expect(state.log.some((l) => l.text.includes('Medical Chakra Infusion — paid 1 Chakra'))).toBe(true);
  });

  it("can't target an enemy character", () => {
    let state = giveChakra(freshMain1(), 'p1', 1);
    state = dealDamage(state, 'p2-deidara', 3).state;
    const { state: withCard, instanceId } = withHandCard(state, 'p1', 'medical-chakra-infusion');
    state = gameReducer(withCard, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: ['p2-deidara'], payFromPool: 0 });
    expect(state.stack).toHaveLength(0);
  });
});

describe('Chakra Suppression', () => {
  const deidaraPool = (s: GameState) => s.players.p2.backRow[2]!.chakraPool.current;
  const p2Turn = (s: GameState, turn: number): GameState => giveChakra({ ...s, activePlayer: 'p2', priorityPlayer: 'p2', phase: 'Main1', turn }, 'p2', 1);

  it("locks an enemy character's Pool through its controller's next turn", () => {
    let { state, instanceId } = withHandCard(giveChakra(freshMain1(), 'p1', 2), 'p1', 'chakra-suppression');
    const castTurn = state.turn;
    state = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: ['p2-deidara'], payFromPool: 0 });
    state = resolveTop(state);

    const locked = gameReducer(p2Turn(state, castTurn + 1), { type: 'POOL_CHAKRA', instanceId: 'p2-deidara', amount: 1 });
    expect(deidaraPool(locked)).toBe(deidaraPool(state));

    const later = gameReducer(p2Turn(state, castTurn + 3), { type: 'POOL_CHAKRA', instanceId: 'p2-deidara', amount: 1 });
    expect(deidaraPool(later)).toBe(deidaraPool(state) + 1);
  });

  it("cast on the enemy's own turn (Quick), it covers the rest of that turn and their next one", () => {
    let { state, instanceId } = withHandCard(freshMain1(), 'p1', 'chakra-suppression');
    state = giveChakra(p2Turn(state, state.turn + 1), 'p1', 2);
    const castTurn = state.turn;
    state = gameReducer({ ...state, priorityPlayer: 'p1' }, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: ['p2-deidara'], payFromPool: 0 });
    expect(state.stack).toHaveLength(1);
    state = resolveTop(state);
    expect(state.players.p2.backRow[2]!.extra.poolLockedUntilTurn).toBe(castTurn + 2);
  });

  it("can't target your own character", () => {
    const { state, instanceId } = withHandCard(giveChakra(freshMain1(), 'p1', 2), 'p1', 'chakra-suppression');
    const next = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: ['p1-deidara'], payFromPool: 0 });
    expect(next.stack).toHaveLength(0);
  });
});

describe('Fireball Jutsu', () => {
  const hp = (s: GameState, i: number) => s.players.p2.backRow[i]!.currentHP;

  it('deals 3 to the target and 1 to each of up to 2 chosen adjacent characters, for 3 Chakra (here all from the Pool)', () => {
    let { state, instanceId } = withHandCard(freshMain1(), 'p1', 'fireball-jutsu');
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // Attack-type Jutsu are Combat-only
    // Itachi enables it (Fire, and no Elemental Versatility to muddy the cost).
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, backRow: state.players.p1.backRow.map((c, i) => (i === 4 && c ? { ...c, chakraPool: { ...c.chakraPool, current: 3 } } : c)) } } };
    const before = [0, 1, 2, 3].map((i) => hp(state, i));

    state = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-itachi', targetInstanceIds: ['p2-hidan', 'p2-kakuzu', 'p2-deidara'], payFromPool: 3 });
    expect(state.stack).toHaveLength(1);
    expect(state.players.p1.backRow[4]!.chakraPool.current).toBe(0);
    state = resolveTop(state);
    expect(hp(state, 1)).toBe(before[1] - 3);
    expect(hp(state, 0)).toBe(before[0] - 1);
    expect(hp(state, 2)).toBe(before[2] - 1);
    expect(hp(state, 3)).toBe(before[3]); // not chosen
  });

  it('refuses a splash target that is not adjacent to the primary', () => {
    let { state, instanceId } = withHandCard(giveChakra(freshMain1(), 'p1', 4), 'p1', 'fireball-jutsu');
    state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    state = gameReducer(giveChakra(state, 'p1', 4), { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: ['p2-hidan', 'p2-kisame'], payFromPool: 0 });
    expect(state.stack).toHaveLength(0);
  });
  it('costs a flat 3 from generic Chakra too (no Pool discount)', () => {
    let { state, instanceId } = withHandCard(freshMain1(), 'p1', 'fireball-jutsu');
    state = gameReducer(giveChakra(state, 'p1', 3), { type: 'ADVANCE_PHASE' });
    state = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-itachi', targetInstanceIds: ['p2-hidan'], payFromPool: 0 });
    expect(state.stack).toHaveLength(1);
    expect(state.players.p1.genericChakraAvailable).toBe(0);
  });
});

describe("Kakuzu's mask cards", () => {
  it('Searing Migraine (enabled by Kakuzu) deals 4 for 3 Chakra — 2 with his Elemental Versatility; Pressure Damage hits up to 2 enemies for 3', () => {
    let state = gameReducer(giveChakra(freshMain1(), 'p1', 6), { type: 'ADVANCE_PHASE' }); // Combat
    const hp = (s: GameState, i: number) => s.players.p2.backRow[i]!.currentHP;
    const before = [hp(state, 1), hp(state, 2), hp(state, 3)];

    const migraine = withHandCard(state, 'p1', 'jutsu-searing-migraine');
    state = gameReducer(migraine.state, { type: 'PLAY_HAND_CARD', instanceId: migraine.instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: ['p2-hidan'], payFromPool: 0 });
    expect(state.players.p1.genericChakraAvailable).toBe(4);
    state = resolveTop(state);
    expect(hp(state, 1)).toBe(before[0] - 4);

    const pressure = withHandCard(state, 'p1', 'jutsu-pressure-damage');
    state = resolveTop(gameReducer(pressure.state, { type: 'PLAY_HAND_CARD', instanceId: pressure.instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: ['p2-deidara', 'p2-kisame'], payFromPool: 0 }));
    expect([hp(state, 2), hp(state, 3)]).toEqual([before[1] - 3, before[2] - 3]);
  });
});

describe('Water Dragon Jutsu', () => {
  const combat = (chakra: number) => gameReducer(giveChakra(freshMain1(), 'p1', chakra), { type: 'ADVANCE_PHASE' });
  const hidanHp = (s: GameState) => s.players.p2.backRow[1]!.currentHP;

  it('costs 1 + X from generic Chakra and deals X', () => {
    const before = combat(4);
    const { state, instanceId } = withHandCard(before, 'p1', 'water-dragon-jutsu');
    let s = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kisame', targetInstanceIds: ['p2-hidan'], payFromPool: 0, amount: 3 });
    expect(s.players.p1.genericChakraAvailable).toBe(0);
    s = resolveTop(s);
    expect(hidanHp(s)).toBe(hidanHp(before) - 3);
  });

  it('costs just X when paid from the Pool, and X is capped at 5', () => {
    let s = combat(0);
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c) => (c?.instanceId === 'p1-kisame' ? { ...c, chakraPool: { ...c.chakraPool, current: 5 } } : c)) } } };
    const before = hidanHp(s);
    const { state, instanceId } = withHandCard(s, 'p1', 'water-dragon-jutsu');
    s = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kisame', targetInstanceIds: ['p2-hidan'], payFromPool: 5, amount: 9 });
    expect(s.players.p1.backRow.find((c) => c?.instanceId === 'p1-kisame')!.chakraPool.current).toBe(0);
    s = resolveTop(s);
    expect(hidanHp(s)).toBe(before - 5);
  });
});

describe('Explosive Tag', () => {
  it('deals 1 damage to the primary target and 1 to an adjacent character', () => {
    let { state, instanceId } = withHandCard(giveChakra(freshMain1(), 'p1', 3), 'p1', 'explosive-tag');
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // Attack-type Jutsu are played during Combat (§4.5)
    const kakuzuHpBefore = state.players.p2.backRow[0]!.currentHP;
    const hidanHpBefore = state.players.p2.backRow[1]!.currentHP; // adjacent (right of Kakuzu)

    state = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: ['p2-kakuzu', 'p2-hidan'], payFromPool: 0 });
    expect(state.stack).toHaveLength(1);
    state = resolveTop(state);

    expect(state.players.p2.backRow[0]!.currentHP).toBe(kakuzuHpBefore - 1);
    expect(state.players.p2.backRow[1]!.currentHP).toBe(hidanHpBefore - 1);
  });
});

describe('Chidori Interception (Assist)', () => {
  it('punishes an enemy activating a targeted damaging ability, without stopping it, and costs 0 with a matching Terrain in play', () => {
    let state = freshMain1();
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, terrainInPlay: { instanceId: 'terrain-test', defId: 'akatsuki-hideout' } } },
    };
    const { state: withCard, instanceId } = withHandCard(state, 'p1', 'chidori-interception');
    state = withCard;

    state = { ...state, activePlayer: 'p2', priorityPlayer: 'p2', phase: 'Combat' };
    state = giveChakra(state, 'p2', 3);
    state = activateAbility(state, 'p2-kakuzu', 'earth-grudge-fear', ['p1-hidan'], 0);
    expect(state.stack).toHaveLength(1);

    state = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: '', targetInstanceIds: [], payFromPool: 0 });
    expect(state.stack).toHaveLength(2); // both on the stack — Chidori doesn't negate

    const kakuzuHpBefore = state.players.p2.backRow[0]!.currentHP;
    const hidanHpBefore = state.players.p1.backRow[1]!.currentHP;
    state = gameReducer(state, { type: 'PASS_PRIORITY' });
    state = gameReducer(state, { type: 'PASS_PRIORITY' }); // resolves Chidori first (LIFO)
    expect(state.players.p2.backRow[0]!.currentHP).toBe(kakuzuHpBefore - 2); // punished

    state = gameReducer(state, { type: 'PASS_PRIORITY' });
    state = gameReducer(state, { type: 'PASS_PRIORITY' }); // Earth Grudge Fear still resolves normally
    expect(state.players.p1.backRow[1]!.currentHP).toBe(hidanHpBefore - 1);
  });
});

describe('Akatsuki Hideout (Terrain)', () => {
  // Kakuzu (starting, free) plus one other Akatsuki character: the Synergy discount (−1) goes to the other one.
  const withPartner = (index: number) => {
    const state = freshMain1();
    const partner = state.players.p1.backRow[index]!;
    return { state: { ...state, players: { ...state.players, p1: { ...state.players.p1, backRow: state.players.p1.backRow.map((c, i) => (i === 0 ? c : i === 1 ? partner : null)) } } }, partner };
  };
  const owed = (s: ReturnType<typeof freshMain1>, id: string) => previewUpkeep(s, 'p1').find((e) => e.instanceId === id)!.amount;
  const hideout = (s: ReturnType<typeof freshMain1>) => ({ ...s, players: { ...s.players, p1: { ...s.players.p1, terrainInPlay: { instanceId: 't1', defId: 'akatsuki-hideout' } } } });

  it("reduces Akatsuki-Synergy characters' Upkeep by 1, on top of the Synergy discount", () => {
    const { state, partner } = withPartner(3); // Kisame, S: 3 − 1 Synergy = 2
    expect(owed(state, partner.instanceId)).toBe(2);
    expect(owed(hideout(state), partner.instanceId)).toBe(1);
  });

  it("never takes a character's Upkeep below 1", () => {
    const { state, partner } = withPartner(2); // Deidara, A: 2 − 1 Synergy = 1 — already at the floor
    expect(owed(state, partner.instanceId)).toBe(1);
    expect(owed(hideout(state), partner.instanceId)).toBe(1);
  });
});

describe('Missions (SPEC.md §13a)', () => {
  it('Bingo Book: Threat Level C draws a card when a C-rank enemy is defeated', () => {
    let { state, instanceId } = withHandCard(freshMain1(), 'p1', 'bingo-book-c');
    // freshMain1()'s quick-start players have an empty Jutsu Deck by default
    // — give p1 something to actually draw, so the "Draw a card" reward has
    // something to prove rather than triggering the deck-out damage rule.
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, handDeck: [makeHandCardInstance('explosive-tag')] } } };
    state = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: [], payFromPool: 0 });
    expect(state.players.p1.missionsInPlay).toHaveLength(1);

    // No C-rank character exists in the default 5-character roster, so this
    // simulates combat.ts's own half of the event (already covered directly
    // in coreSystems.test.ts) and tests the Mission's reaction to it.
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, pendingDefeatEvents: [{ rank: 'C' }] } } };
    const cardsInHandBefore = state.players.p1.hand.filter((h) => h.kind === 'card').length;
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // triggers the drain, which runs the Mission tick
    expect(state.players.p1.missionsInPlay).toHaveLength(0); // resolved and discarded
    expect(state.players.p1.hand.filter((h) => h.kind === 'card').length).toBe(cardsInHandBefore + 1); // "Draw a card"
  });

  it('a Mission is discarded the moment its Condition fails, not at its next Untap', () => {
    let state = freshMain1();
    const health = state.players.p1.health;
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, missionsInPlay: [{ instanceId: 'm-ur', defId: 'unshakable-resolve', owner: 'p1', extra: { healthAtPlay: health, untaps: 2, faceDown: true } }] } } };
    state = gameReducer(state, { type: 'PASS_PRIORITY' });
    expect(state.players.p1.missionsInPlay).toHaveLength(1); // still on track
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, health: health - 10 } } };
    state = gameReducer(state, { type: 'PASS_PRIORITY' }); // any action — no Untap needed
    expect(state.players.p1.missionsInPlay).toHaveLength(0);
  });

  it('every Mission enters face down — the opponent sees only that a Mission is there', () => {
    for (const defId of ['unshakable-resolve', 'bingo-book-s', 'bingo-book-a', 'bingo-book-b', 'bingo-book-c', 'squad-formation', 'emergency-relief']) {
      const { state, instanceId } = withHandCard(giveChakra(freshMain1(), 'p1', 1), 'p1', defId);
      const next = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: '', targetInstanceIds: [], payFromPool: 0 });
      expect(next.players.p1.missionsInPlay[0]?.extra.faceDown).toBe(true);
      expect(redactStateFor(next, 'p2').players.p1.missionsInPlay[0].defId).toBe('__hidden__');
    }
  });

  it('Squad Formation selects a group of 3 once control reaches 3, and redirects damage among them', () => {
    let { state, instanceId } = withHandCard(freshMain1(), 'p1', 'squad-formation');
    state = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: [], payFromPool: 0 });
    // p1 already has 5 characters in play (the default roster) — the very
    // next Untap Phase should select the group immediately.
    while (!(state.activePlayer === 'p1' && state.phase === 'Untap')) state = gameReducer(state, { type: 'ADVANCE_PHASE' });

    const group = state.players.p1.backRow[0]!.extra.squadFormationGroup as string[] | undefined;
    expect(group).toBeDefined();
    expect(group).toHaveLength(3);

    const [target, absorber] = group!;
    const hp = (s: typeof state, id: string) => s.players.p1.backRow.find((c) => c?.instanceId === id)!.currentHP;

    // The redirect is the controller's choice, never automatic: Off by default, so the hit lands where it was aimed.
    let result = dealDamage(state, target, 1);
    expect(hp(state, target) - hp(result.state, target)).toBe(1);

    // With a redirect chosen, a hit on any other member goes to the chosen one instead.
    const mission = state.players.p1.missionsInPlay[0];
    expect(mission.extra.faceDown).toBe(false); // revealed once its Condition was met
    state = gameReducer(state, { type: 'SET_SQUAD_REDIRECT', missionInstanceId: mission.instanceId, redirectTo: absorber });
    result = dealDamage(state, target, 1);
    expect(hp(result.state, target)).toBe(hp(state, target)); // untouched — redirected away
    expect(hp(state, absorber) - hp(result.state, absorber)).toBe(1);
  });
});

describe('Earth Style: Added Weight Rock Technique', () => {
  it('Quick, 2, Earth: the target\'s abilities and the Jutsu cards it enables cost 1 more through its controller\'s next turn', () => {
    let { state, instanceId } = withHandCard(giveChakra(freshMain1(), 'p1', 2), 'p1', 'jutsu-added-weight-rock');
    expect(gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-hidan', targetInstanceIds: ['p2-kakuzu'], payFromPool: 0 }).stack).toHaveLength(0); // needs Earth
    state = resolveTop(gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: ['p2-kakuzu'], payFromPool: 0 }));
    const until = state.players.p2.backRow[0]!.extra.addedWeightUntilTurn as number;
    expect(until).toBe(state.turn + 1);

    // On p2's turn, Kakuzu's Earth Grudge Fear (2) costs 3, and a card he enables costs 1 more.
    let p2: GameState = { ...state, turn: until, activePlayer: 'p2', priorityPlayer: 'p2', phase: 'Combat' };
    p2 = giveChakra(p2, 'p2', 3);
    p2 = activateAbility(p2, 'p2-kakuzu', 'earth-grudge-fear', ['p1-hidan'], 0);
    expect(p2.players.p2.genericChakraAvailable).toBe(0);
    const card = withHandCard({ ...giveChakra(state, 'p2', 5), turn: until, activePlayer: 'p2', priorityPlayer: 'p2', phase: 'Combat' }, 'p2', 'jutsu-searing-migraine');
    // Searing Migraine is 3; −1 Elemental Versatility, +1 Added Weight → 3.
    const played = gameReducer(card.state, { type: 'PLAY_HAND_CARD', instanceId: card.instanceId, enablingInstanceId: 'p2-kakuzu', targetInstanceIds: ['p1-hidan'], payFromPool: 0 });
    expect(played.players.p2.genericChakraAvailable).toBe(2);

    // Gone the turn after.
    const later: GameState = { ...giveChakra(state, 'p2', 2), turn: until + 1, activePlayer: 'p2', priorityPlayer: 'p2', phase: 'Combat' };
    expect(activateAbility(later, 'p2-kakuzu', 'earth-grudge-fear', ['p1-hidan'], 0).players.p2.genericChakraAvailable).toBe(0);
  });

  it("cast on the target's own turn, it lasts through their following turn", () => {
    let { state, instanceId } = withHandCard(giveChakra({ ...freshMain1(), activePlayer: 'p2', priorityPlayer: 'p1' }, 'p1', 2), 'p1', 'jutsu-added-weight-rock');
    state = resolveTop(gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: ['p2-kakuzu'], payFromPool: 0 }));
    expect(state.players.p2.backRow[0]!.extra.addedWeightUntilTurn).toBe(state.turn + 2);
  });
});

describe('Earth Style: Earth Flow River', () => {
  it('1 damage to the target and each enemy beside it in its row; those characters can\'t Retreat through their controller\'s next turn', () => {
    let { state, instanceId } = withHandCard(giveChakra(freshMain1(), 'p1', 3), 'p1', 'jutsu-earth-flow-river');
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // Combat (an Attack-type card)
    const row = state.players.p2.backRow;
    const mid = row.findIndex((c, i) => c && row[i - 1] && row[i + 1]);
    const [l, t, r] = [row[mid - 1]!, row[mid]!, row[mid + 1]!];
    const others = row.filter((c, i) => c && Math.abs(i - mid) > 1).map((c) => [c!.instanceId, c!.currentHP] as const);
    state = resolveTop(gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: [t.instanceId], payFromPool: 0 }));
    const hp = (id: string) => state.players.p2.backRow.find((c) => c?.instanceId === id)?.currentHP;
    expect([hp(l.instanceId), hp(t.instanceId), hp(r.instanceId)]).toEqual([l.currentHP - 1, t.currentHP - 1, r.currentHP - 1]);
    for (const [id, before] of others) expect(hp(id)).toBe(before);
    const lock = state.players.p2.backRow.find((c) => c?.instanceId === t.instanceId)!.extra.retreatLockedUntilTurn as number;
    expect(lock).toBe(state.turn + 1);

    // On p2's turn, Retreat is refused.
    let p2: GameState = { ...giveChakra(state, 'p2', 5), turn: lock, activePlayer: 'p2', priorityPlayer: 'p2', phase: 'Main1' };
    p2 = gameReducer(p2, { type: 'RETREAT', instanceId: t.instanceId });
    expect(p2.players.p2.backRow.find((c) => c?.instanceId === t.instanceId)!.status.retreated).toBe(false);
  });

  it('needs an Earth enabler', () => {
    let { state, instanceId } = withHandCard(giveChakra(freshMain1(), 'p1', 3), 'p1', 'jutsu-earth-flow-river');
    state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    expect(gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-hidan', targetInstanceIds: ['p2-hidan'], payFromPool: 0 }).stack).toHaveLength(0);
  });
});

describe('Fire Style: Phoenix Flower', () => {
  function setup() {
    let { state, instanceId } = withHandCard(giveChakra(freshMain1(), 'p1', 3), 'p1', 'jutsu-phoenix-flower');
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // Combat (an Attack-type card)
    const row = state.players.p2.backRow;
    const i = row.findIndex((c, k) => c && row[k + 1]);
    return { state, instanceId, a: row[i]!, b: row[i + 1]!, far: row.find((c, k) => c && Math.abs(k - i) > 1 && Math.abs(k - (i + 1)) > 1) };
  }
  const hp = (state: GameState, id: string) => state.players.p2.backRow.find((c) => c?.instanceId === id)?.currentHP;
  const play = (state: GameState, instanceId: string, targets: string[], amount?: number) =>
    gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: targets, payFromPool: 0, amount });

  it('splits 3 damage between 2 adjacent enemy targets as chosen — 0 allowed', () => {
    const { state, instanceId, a, b } = setup();
    let next = resolveTop(play(state, instanceId, [a.instanceId, b.instanceId], 1));
    expect([hp(next, a.instanceId), hp(next, b.instanceId)]).toEqual([a.currentHP - 1, b.currentHP - 2]);
    next = resolveTop(play(state, instanceId, [a.instanceId, b.instanceId], 0));
    expect([hp(next, a.instanceId), hp(next, b.instanceId)]).toEqual([a.currentHP, b.currentHP - 3]);
  });

  it('a single target takes all 3; the 2 targets must be different and adjacent', () => {
    const { state, instanceId, a, b, far } = setup();
    expect(hp(resolveTop(play(state, instanceId, [a.instanceId])), a.instanceId)).toBe(a.currentHP - 3);
    expect(play(state, instanceId, [a.instanceId, a.instanceId], 1).stack).toHaveLength(0);
    if (far) expect(play(state, instanceId, [a.instanceId, far.instanceId], 1).stack).toHaveLength(0);
    expect(play(state, instanceId, [a.instanceId, b.instanceId], 1).stack).toHaveLength(1);
  });
});

describe('Fire Style: Dragon Fire Technique', () => {
  const hp = (state: GameState, id: string) => state.players.p2.backRow.find((c) => c?.instanceId === id)?.currentHP;
  function setup() {
    let { state, instanceId } = withHandCard(giveChakra(freshMain1(), 'p1', 4), 'p1', 'jutsu-dragon-fire');
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // Combat (an Attack-type card)
    return { state, instanceId, row: state.players.p2.backRow };
  }
  const play = (state: GameState, instanceId: string, targets: string[]) =>
    gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: targets, payFromPool: 0 });

  it('3 to the target, 2 to the adjacent unit in the chosen direction, 1 to the next one on', () => {
    const { state, instanceId, row } = setup();
    const i = row.findIndex((c, k) => c && row[k + 1] && row[k + 2]);
    const [a, b, c] = [row[i]!, row[i + 1]!, row[i + 2]!];
    const next = resolveTop(play(state, instanceId, [a.instanceId, b.instanceId]));
    expect([hp(next, a.instanceId), hp(next, b.instanceId), hp(next, c.instanceId)]).toEqual([a.currentHP - 3, b.currentHP - 2, c.currentHP - 1]);
  });

  it('stops at the edge or an empty space; the 2nd pick must be adjacent, and is required when a neighbor exists', () => {
    const { state, instanceId, row } = setup();
    const last = row.reduce((m, c, k) => (c ? k : m), -1);
    const [a, b] = [row[last]!, row[last - 1]!];
    // Toward the start of the row from its last unit, the line runs on; from the second-to-last toward the end, it stops after 2.
    const edge = resolveTop(play(state, instanceId, [b.instanceId, a.instanceId]));
    expect([hp(edge, b.instanceId), hp(edge, a.instanceId)]).toEqual([b.currentHP - 3, a.currentHP - 2]);
    expect(play(state, instanceId, [a.instanceId]).stack).toHaveLength(0); // has a neighbor: must pick a direction
    const far = row.find((c, k) => c && k < last - 1);
    if (far) expect(play(state, instanceId, [a.instanceId, far.instanceId]).stack).toHaveLength(0);
  });
});

describe('Wind Style: Vacuum Bullets', () => {
  const hp = (state: GameState, id: string) => state.players.p2.backRow.find((c) => c?.instanceId === id)?.currentHP;
  function setup(chakra: number) {
    let { state, instanceId } = withHandCard(giveChakra(freshMain1(), 'p1', chakra), 'p1', 'jutsu-vacuum-bullets');
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // Combat (an Attack-type card)
    const units = state.players.p2.backRow.filter((c) => c !== null);
    const pick = (defId: string) => units.find((u) => u!.defId === defId)!; // plain HP, no Hearts/Immortality
    return { state, instanceId, a: pick('deidara'), b: pick('kisame') };
  }
  const play = (state: GameState, instanceId: string, targets: string[]) =>
    gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: targets, payFromPool: 0 });

  it('costs 3 + X and deals 2 damage X times; the same unit can be picked more than once', () => {
    // Kakuzu enables it, so Elemental Versatility takes 1 off: 3 + 3 − 1 = 5.
    const { state, instanceId, a, b } = setup(5);
    const played = play(state, instanceId, [a.instanceId, b.instanceId, a.instanceId]);
    expect(played.players.p1.genericChakraAvailable).toBe(0);
    const next = resolveTop(played);
    expect([hp(next, a.instanceId), hp(next, b.instanceId)]).toEqual([a.currentHP - 4, b.currentHP - 2]);
  });

  it('X = 1 costs 4; it needs at least 1 target and Chakra for X', () => {
    // Through Kakuzu (−1): X = 1 costs 3, X = 2 costs 4.
    const { state, instanceId, a, b } = setup(3);
    expect(play(state, instanceId, [a.instanceId, b.instanceId]).stack).toHaveLength(0); // 4 needed, 3 available
    expect(play(state, instanceId, []).stack).toHaveLength(0);
    const played = play(state, instanceId, [a.instanceId]);
    expect(played.players.p1.genericChakraAvailable).toBe(0);
    expect(hp(resolveTop(played), a.instanceId)).toBe(a.currentHP - 2);
  });
});

describe('Wind Style: Air Bullets', () => {
  it('costs 1 + X (X up to 4) and deals 1 damage X times; the same unit can be picked more than once', () => {
    let { state, instanceId } = withHandCard(giveChakra(freshMain1(), 'p1', 4), 'p1', 'jutsu-air-bullets');
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // Combat (an Attack-type card)
    const units = state.players.p2.backRow.filter((c) => c !== null);
    const [a, b] = [units.find((u) => u!.defId === 'deidara')!, units.find((u) => u!.defId === 'kisame')!];
    const play = (targets: string[]) => gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: targets, payFromPool: 0 });
    expect(play([a.instanceId, a.instanceId, b.instanceId, a.instanceId, b.instanceId]).stack).toHaveLength(0); // X can't be 5
    // Through Kakuzu (Elemental Versatility −1): 1 + 4 − 1 = 4.
    const played = play([a.instanceId, a.instanceId, b.instanceId, a.instanceId]);
    expect(played.players.p1.genericChakraAvailable).toBe(0);
    const next = resolveTop(played);
    const hp = (id: string) => next.players.p2.backRow.find((c) => c?.instanceId === id)?.currentHP;
    expect([hp(a.instanceId), hp(b.instanceId)]).toEqual([a.currentHP - 3, b.currentHP - 1]);
  });
});

describe('Earth Style: Hiding Like a Mole Technique', () => {
  const hp = (s: GameState, id: string) => [...s.players.p1.backRow, ...s.players.p2.backRow].find((c) => c?.instanceId === id)?.currentHP;
  const hidden = () => resolveTop(playCard(giveChakra(freshMain1(), 'p1', 20), 'p1', 'jutsu-hiding-like-a-mole', 'p1-kakuzu'));

  it("the enabler can't be targeted through its controller's next turn, except by itself", () => {
    const s = hidden();
    expect(s.players.p1.backRow.find((c) => c?.instanceId === 'p1-kakuzu')!.extra.moleHiddenUntilTurn).toBe(s.turn + 2);
    const theirs: GameState = { ...giveChakra(s, 'p2', 20), turn: s.turn + 1, activePlayer: 'p2', priorityPlayer: 'p2', phase: 'Combat' };
    expect(activateAbility(theirs, 'p2-kakuzu', 'earth-grudge-fear', ['p1-kakuzu'], 0).stack).toHaveLength(0);
    expect(playCard(theirs, 'p2', 'jutsu-searing-migraine', 'p2-kakuzu', ['p1-kakuzu']).stack).toHaveLength(0);
    expect(activateAbility({ ...theirs, turn: s.turn + 3 }, 'p2-kakuzu', 'earth-grudge-fear', ['p1-kakuzu'], 0).stack).toHaveLength(1);
    expect(activateAbility({ ...s, phase: 'Combat' }, 'p1-kakuzu', 'earth-grudge-fear', ['p1-kakuzu'], 0).stack).toHaveLength(1);
  });

  const kakuzu = (s: GameState) => s.players.p1.backRow.find((c) => c?.instanceId === 'p1-kakuzu')!;

  it('activating an attack ends it on the spot, before the attack resolves; a Taijutsu attack deals +2', () => {
    const s: GameState = { ...hidden(), phase: 'Combat' };
    const activated = activateAbility(s, 'p1-kakuzu', 'earth-grudge-fear', ['p2-deidara'], 0);
    expect(activated.stack).toHaveLength(1);
    expect(kakuzu(activated).extra.moleHiddenUntilTurn).toBeUndefined(); // targetable while its attack is still on the stack
    // p2 can answer with a Quick card aimed at it — refused while it was hidden, legal now.
    expect(playCard({ ...giveChakra(s, 'p2', 5), priorityPlayer: 'p2' }, 'p2', 'jutsu-added-weight-rock', 'p2-kakuzu', ['p1-kakuzu']).stack).toHaveLength(0);
    expect(playCard({ ...giveChakra(activated, 'p2', 5), priorityPlayer: 'p2' }, 'p2', 'jutsu-added-weight-rock', 'p2-kakuzu', ['p1-kakuzu']).stack).toHaveLength(2);
    expect(kakuzu(activated).extra.moleBonusItem).toBe(activated.stack[0].id); // the +2 belongs to this one attack
    const taijutsu = resolveTop(activated);
    expect(hp(s, 'p2-deidara')! - hp(taijutsu, 'p2-deidara')!).toBe(3); // 1 + 2
  });

  it('a non-Taijutsu attack ends it with no bonus; a non-attack card does not end it', () => {
    const s: GameState = { ...hidden(), phase: 'Combat' };
    const ninjutsu = playCard(s, 'p1', 'jutsu-searing-migraine', 'p1-kakuzu', ['p2-deidara']);
    expect(kakuzu(ninjutsu).extra.moleHiddenUntilTurn).toBeUndefined();
    expect(hp(s, 'p2-deidara')! - hp(resolveTop(ninjutsu), 'p2-deidara')!).toBe(4); // Searing Migraine's 4, no +2
    const weight = playCard(s, 'p1', 'jutsu-added-weight-rock', 'p1-kakuzu', ['p2-deidara']);
    expect(weight.stack).toHaveLength(1);
    expect(kakuzu(weight).extra.moleHiddenUntilTurn).toBe(s.turn + 2);
  });
});
