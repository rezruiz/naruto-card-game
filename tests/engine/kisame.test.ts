import { describe, expect, it } from 'vitest';
import { activateAbility, checkLegality, findAbility } from '../../src/engine/abilities';
import { dealDamage } from '../../src/engine/combat';
import { gameReducer } from '../../src/engine/reducer';
import { freshCombat, giveChakra, resolveTop } from './testUtils';

describe('Kisame', () => {
  it('Samehada Strike deals 1 damage, absorbs 1 Chakra, and tracks the absorbed-Chakra counter', () => {
    let state = freshCombat();
    // Pool some Chakra onto the target directly so the drain half of Absorb has something to take.
    state = {
      ...state,
      players: {
        ...state.players,
        p2: {
          ...state.players.p2,
          backRow: state.players.p2.backRow.map((c, i) => (i === 0 && c ? { ...c, chakraPool: { ...c.chakraPool, current: 2 } } : c)),
        },
      },
    };

    const targetHpBefore = state.players.p2.backRow[0]!.currentHP;
    state = activateAbility(state, 'p1-kisame', 'samehada-strike', ['p2-kakuzu'], 0);
    expect(state.stack).toHaveLength(1);
    state = resolveTop(state);

    expect(state.players.p2.backRow[0]!.currentHP).toBe(targetHpBefore - 1);
    expect(state.players.p2.backRow[0]!.chakraPool.current).toBe(1); // drained 1
    expect(state.players.p1.backRow[3]!.chakraPool.current).toBe(1); // Kisame gained 1
    expect(state.players.p1.backRow[3]!.extra.absorbedChakra).toBe(1);
  });

  it("Water Prison Jutsu locks a lower-rank target out of targeted abilities for 3 turns", () => {
    let state = giveChakra(freshCombat(), 'p1', 4);
    state = activateAbility(state, 'p1-kisame', 'water-prison-jutsu', ['p2-kakuzu'], 0);
    state = resolveTop(state);

    expect(state.players.p2.backRow[0]!.extra.targetLockUntilTurn).toBe(state.turn + 3);

    // A targeted ability from the locked character is rejected...
    const ability = findAbility('kakuzu', 'earth-grudge-fear')!;
    const legality = checkLegality(state, 'p2-kakuzu', ability, ['p1-kakuzu'], 0);
    expect(legality.ok).toBe(false);
  });

  it('enters Samehada Shark Transformation once 6 Chakra has been absorbed, boosting HP and Pool capacity', () => {
    let state = freshCombat();
    const hpBefore = state.players.p1.backRow[3]!.maxHP;
    const capBefore = state.players.p1.backRow[3]!.chakraPool.capacity;
    state = {
      ...state,
      players: {
        ...state.players,
        p1: {
          ...state.players.p1,
          backRow: state.players.p1.backRow.map((c, i) => (i === 3 && c ? { ...c, extra: { ...c.extra, absorbedChakra: 6 } } : c)),
        },
      },
    };

    state = activateAbility(state, 'p1-kisame', 'samehada-shark-transformation', [], 0);
    expect(state.stack).toHaveLength(1);
    state = resolveTop(state);

    expect(state.players.p1.backRow[3]!.extra.transformed).toBe(true);
    expect(state.players.p1.backRow[3]!.maxHP).toBe(hpBefore + 6);
    expect(state.players.p1.backRow[3]!.chakraPool.capacity).toBe(capBefore + 6);
  });

  it('reverts transformation once >=7 post-transformation damage has been taken', () => {
    let state = freshCombat();
    state = {
      ...state,
      players: {
        ...state.players,
        p1: {
          ...state.players.p1,
          backRow: state.players.p1.backRow.map((c, i) =>
            i === 3 && c ? { ...c, maxHP: c.maxHP + 6, currentHP: c.currentHP + 6, chakraPool: { ...c.chakraPool, capacity: c.chakraPool.capacity + 6 }, extra: { ...c.extra, transformed: true, transformDamageTaken: 0 } } : c,
          ),
        },
      },
    };
    const transformedMaxHP = state.players.p1.backRow[3]!.maxHP;
    const transformedCapacity = state.players.p1.backRow[3]!.chakraPool.capacity;

    state = dealDamage(state, 'p1-kisame', 4).state;
    expect(state.players.p1.backRow[3]!.extra.transformed).toBe(true); // not enough yet

    state = dealDamage(state, 'p1-kisame', 3).state; // total 7 — reverts
    expect(state.players.p1.backRow[3]!.extra.transformed).toBe(false);
    expect(state.players.p1.backRow[3]!.maxHP).toBe(transformedMaxHP - 6);
    expect(state.players.p1.backRow[3]!.chakraPool.capacity).toBe(transformedCapacity - 6);
  });

  it('reverts transformation at Upkeep if Pool has dropped to <=3', () => {
    let state = freshCombat();
    state = {
      ...state,
      players: {
        ...state.players,
        p1: {
          ...state.players.p1,
          backRow: state.players.p1.backRow.map((c, i) =>
            i === 3 && c
              ? { ...c, maxHP: c.maxHP + 6, chakraPool: { current: 2, capacity: c.chakraPool.capacity + 6 }, extra: { ...c.extra, transformed: true, transformDamageTaken: 0 } }
              : c,
          ),
        },
      },
    };

    // Advance through the rest of p1's turn, all of p2's turn, and into p1's next Upkeep Phase.
    for (let i = 0; i < 11; i++) state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    expect(state.activePlayer).toBe('p1');
    expect(state.phase).toBe('Upkeep');

    expect(state.players.p1.backRow[3]!.extra.transformed).toBe(false);
  });
});
