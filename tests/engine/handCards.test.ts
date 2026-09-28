import { describe, expect, it } from 'vitest';
import { activateAbility } from '../../src/engine/abilities';
import { gameReducer } from '../../src/engine/reducer';
import { dealDamage } from '../../src/engine/combat';
import { makeHandCardInstance } from '../../src/engine/deck';
import { freshMain1, giveChakra, resolveTop } from './testUtils';
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
  it('reduces Akatsuki-Synergy characters\' Upkeep by 1, on top of the Synergy character-count discount', () => {
    // Isolate to just Kakuzu (starting, free anyway) + Hidan so Hidan's
    // Upkeep isn't already fully discounted by the full 5-character roster.
    let state = freshMain1();
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, backRow: state.players.p1.backRow.map((c, i) => (i === 0 || i === 1 ? c : null)) } } };
    // Hidan: B rank (1 upkeep), 1 Synergy match with Kakuzu -> already 0 without Terrain.
    // Use Deidara instead (A rank, 2 upkeep) so there's a nonzero cost left to reduce.
    const deidara = freshMain1().players.p1.backRow[2]!;
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, backRow: state.players.p1.backRow.map((c, i) => (i === 1 ? deidara : c)) } } };

    const withoutTerrain = state;
    const withTerrain = { ...state, players: { ...state.players, p1: { ...state.players.p1, terrainInPlay: { instanceId: 't1', defId: 'akatsuki-hideout' } } } };

    let a = withoutTerrain;
    while (!(a.activePlayer === 'p1' && a.phase === 'Upkeep')) a = gameReducer(a, { type: 'ADVANCE_PHASE' });
    let b = withTerrain;
    while (!(b.activePlayer === 'p1' && b.phase === 'Upkeep')) b = gameReducer(b, { type: 'ADVANCE_PHASE' });

    // With 0 Chakra sources, Deidara (2 upkeep, 1 Synergy discount -> 1 owed) goes Disabled without the Terrain...
    expect(a.players.p1.backRow[1]!.status.disabled).toBe(true);
    // ...but the Terrain's extra -1 fully covers it (1 - 1 = 0).
    expect(b.players.p1.backRow[1]!.status.disabled).toBe(false);
  });
});

describe('Missions (SPEC.md §13a)', () => {
  it('Bingo Book: Threat Level C draws a card when a C-rank enemy is defeated', () => {
    let { state, instanceId } = withHandCard(freshMain1(), 'p1', 'bingo-book-c');
    // freshMain1()'s quick-start players have an empty Hand Deck by default
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

  it('Squad Formation selects a group of 3 once control reaches 3, and redirects damage among them', () => {
    let { state, instanceId } = withHandCard(freshMain1(), 'p1', 'squad-formation');
    state = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: [], payFromPool: 0 });
    // p1 already has 5 characters in play (the default roster) — the very
    // next Untap Phase should select the group immediately.
    while (!(state.activePlayer === 'p1' && state.phase === 'Untap')) state = gameReducer(state, { type: 'ADVANCE_PHASE' });

    const group = state.players.p1.backRow[0]!.extra.squadFormationGroup as string[] | undefined;
    expect(group).toBeDefined();
    expect(group).toHaveLength(3);

    // Damage aimed at one member should redirect to a *different* one —
    // which of the (tied-HP) others absorbs it is an implementation detail,
    // so this only checks the target itself took nothing.
    const target = group![0];
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, backRow: state.players.p1.backRow.map((c) => (c && c.instanceId === target ? { ...c, currentHP: 1 } : c)) },
      },
    };
    const result = dealDamage(state, target, 2);
    const hitTarget = result.state.players.p1.backRow.find((c) => c?.instanceId === target)!;
    expect(hitTarget.currentHP).toBe(1); // untouched — redirected away

    const groupTotalHpAfter = group!.reduce((sum, id) => sum + result.state.players.p1.backRow.find((c) => c?.instanceId === id)!.currentHP, 0);
    const groupTotalHpBefore = group!.reduce((sum, id) => sum + state.players.p1.backRow.find((c) => c?.instanceId === id)!.currentHP, 0);
    expect(groupTotalHpBefore - groupTotalHpAfter).toBe(2); // the 2 damage landed on *someone* in the group, just not the original target
  });
});
