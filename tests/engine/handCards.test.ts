import { describe, expect, it } from 'vitest';
import { activateAbility } from '../../src/engine/abilities';
import { gameReducer } from '../../src/engine/reducer';
import { dealDamage } from '../../src/engine/combat';
import { makeHandCardInstance } from '../../src/engine/deck';
import { redactStateFor } from '../../src/engine/redact';
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

describe('Fire Style: Fireball Jutsu', () => {
  const hp = (s: GameState, i: number) => s.players.p2.backRow[i]!.currentHP;

  it('deals 3 to the target and 1 to each of up to 2 chosen adjacent characters, costing 3 from the Pool', () => {
    let { state, instanceId } = withHandCard(freshMain1(), 'p1', 'fireball-jutsu');
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // Attack-type Jutsu are Combat-only
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, backRow: state.players.p1.backRow.map((c, i) => (i === 0 && c ? { ...c, chakraPool: { ...c.chakraPool, current: 3 } } : c)) } } };
    const before = [0, 1, 2, 3].map((i) => hp(state, i));

    state = gameReducer(state, { type: 'PLAY_HAND_CARD', instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: ['p2-hidan', 'p2-kakuzu', 'p2-deidara'], payFromPool: 3 });
    expect(state.stack).toHaveLength(1);
    expect(state.players.p1.backRow[0]!.chakraPool.current).toBe(0);
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
