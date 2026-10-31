import { getCharacterDef } from '../../src/engine/characters';
import { describe, expect, it } from 'vitest';
import { activateAbility, checkLegality, findAbility } from '../../src/engine/abilities';
import { dealDamage } from '../../src/engine/combat';
import { gameReducer } from '../../src/engine/reducer';
import { freshCombat, giveChakra, playCard, resolveTop } from './testUtils';

describe('Kisame', () => {
  it('Samehada Strike (2 from his Pool) deals 1 damage, Absorbs 3 into his Pool, and tracks the absorbed-Chakra counter', () => {
    let state = freshCombat();
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, backRow: state.players.p1.backRow.map((c) => (c?.defId === 'kisame' ? { ...c, chakraPool: { ...c.chakraPool, current: 2 } } : c)) } } };
    expect(activateAbility(giveChakra(state, 'p1', 2), 'p1-kisame', 'samehada-strike', ['p2-kakuzu'], 0).stack).toHaveLength(0); // must be paid from the Pool
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
    state = activateAbility(state, 'p1-kisame', 'samehada-strike', ['p2-kakuzu'], 2);
    expect(state.stack).toHaveLength(1);
    state = resolveTop(state);

    expect(state.players.p2.backRow[0]!.currentHP).toBe(targetHpBefore - 1);
    expect(state.players.p2.backRow[0]!.chakraPool.current).toBe(0); // drained all it had
    expect(state.players.p1.backRow[3]!.chakraPool.current).toBe(3); // 2 − 2 + 3
    expect(state.players.p1.backRow[3]!.extra.absorbedChakra).toBe(3);
  });

  it('Samehada Strike Evolved needs 9+ absorbed and 6+ pooled: deal 2, Absorb 4', () => {
    const setK = (s: ReturnType<typeof freshCombat>, absorbed: number, pooled: number) => ({ ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c) => (c?.defId === 'kisame' ? { ...c, chakraPool: { ...c.chakraPool, current: pooled }, extra: { ...c.extra, absorbedChakra: absorbed } } : c)) } } });
    expect(activateAbility(setK(freshCombat(), 8, 6), 'p1-kisame', 'samehada-strike-evolved', ['p2-hidan'], 2).stack).toHaveLength(0);
    expect(activateAbility(setK(freshCombat(), 9, 5), 'p1-kisame', 'samehada-strike-evolved', ['p2-hidan'], 2).stack).toHaveLength(0);
    let state = setK(freshCombat(), 9, 6);
    const hp = state.players.p2.backRow[1]!.currentHP;
    state = resolveTop(activateAbility(state, 'p1-kisame', 'samehada-strike-evolved', ['p2-hidan'], 2));
    expect(state.players.p2.backRow[1]!.currentHP).toBe(hp - 2);
    expect(state.players.p1.backRow[3]!.chakraPool.current).toBe(8); // 6 − 2 + 4
    expect(state.players.p1.backRow[3]!.extra.absorbedChakra).toBe(13);
  });

  describe('while holding Water Prison, Kisame', () => {
    const holding = () => {
      let state = giveChakra(freshCombat(), 'p1', 20);
      state = resolveTop(activateAbility(state, 'p1-kisame', 'water-prison-jutsu', ['p2-kakuzu'], 0));
      const backRow = state.players.p1.backRow.map((c) => (c?.defId === 'kisame' ? { ...c, status: { ...c.status, usedAbilitiesThisTurn: [] } } : c));
      return { ...state, players: { ...state.players, p1: { ...state.players.p1, backRow } } };
    };

    it("can't use anything but Taijutsu and Bukijutsu", () => {
      const s = activateAbility(holding(), 'p1-kisame', 'thousand-hungry-sharks', ['p2-hidan'], 0);
      expect(s.stack).toHaveLength(0);
      expect(s.log.at(-1)?.text).toMatch(/holding Water Prison/);
    });

    it("can't enable a Ninjutsu Jutsu card, but can enable a Bukijutsu one", () => {
      expect(playCard(holding(), 'p1', 'jutsu-thousand-hungry-sharks', 'p1-kisame', ['p2-hidan']).stack).toHaveLength(0);
      expect(playCard(holding(), 'p1', 'senbon-volley', 'p1-kisame', ['p2-hidan']).stack).toHaveLength(1);
    });

    it("can't start his Shark Transformation", () => {
      const s = holding();
      const backRow = s.players.p1.backRow.map((c) => (c?.defId === 'kisame' ? { ...c, extra: { ...c.extra, absorbedChakra: 10 } } : c));
      expect(activateAbility({ ...s, players: { ...s.players, p1: { ...s.players.p1, backRow } } }, 'p1-kisame', 'samehada-shark-transformation', [], 0).stack).toHaveLength(0);
    });

    it('can still use Samehada Strike, which is Bukijutsu', () => {
      const start = holding();
      const backRow = start.players.p1.backRow.map((c) => (c?.defId === 'kisame' ? { ...c, chakraPool: { ...c.chakraPool, current: 2 } } : c));
      const s = activateAbility({ ...start, players: { ...start.players, p1: { ...start.players.p1, backRow } } }, 'p1-kisame', 'samehada-strike', ['p2-hidan'], 2);
      expect(s.stack).toHaveLength(1);
    });

    it('can use Ninjutsu again once the prison breaks', () => {
      const s = dealDamage(holding(), 'p1-kisame', 3).state;
      expect(activateAbility(s, 'p1-kisame', 'thousand-hungry-sharks', ['p2-hidan'], 0).stack).toHaveLength(1);
    });

    it('can use Ninjutsu again once the prison runs out', () => {
      const s = holding();
      expect(activateAbility({ ...s, turn: s.turn + 3 }, 'p1-kisame', 'thousand-hungry-sharks', ['p2-hidan'], 0).stack).toHaveLength(1);
    });
  });

  it("Water Prison Jutsu locks a lower-rank target out of targeted abilities for 2 turns", () => {
    expect(activateAbility(giveChakra(freshCombat(), 'p1', 4), 'p1-kisame', 'water-prison-jutsu', ['p2-kakuzu'], 0).stack).toHaveLength(0); // costs 5
    let state = giveChakra(freshCombat(), 'p1', 5);
    state = activateAbility(state, 'p1-kisame', 'water-prison-jutsu', ['p2-kakuzu'], 0);
    state = resolveTop(state);

    expect(state.players.p2.backRow[0]!.extra.targetLockUntilTurn).toBe(state.turn + 2);
    // Disabled while transformed (Samehada Fusion).
    const shark = giveChakra(freshCombat(), 'p1', 5);
    const tf = { ...shark, players: { ...shark.players, p1: { ...shark.players.p1, backRow: shark.players.p1.backRow.map((c) => (c?.defId === 'kisame' ? { ...c, extra: { ...c.extra, transformed: true } } : c)) } } };
    expect(activateAbility(tf, 'p1-kisame', 'water-prison-jutsu', ['p2-kakuzu'], 0).stack).toHaveLength(0);

    // A targeted ability from the locked character is rejected...
    const ability = findAbility('kakuzu', 'earth-grudge-fear')!;
    const legality = checkLegality(state, 'p2-kakuzu', ability, ['p1-kakuzu'], 0);
    expect(legality.ok).toBe(false);
  });

  it('enters Samehada Shark Transformation once 10 Chakra has been absorbed, boosting HP and Pool capacity', () => {
    let state = freshCombat();
    const hpBefore = state.players.p1.backRow[3]!.maxHP;
    const capBefore = state.players.p1.backRow[3]!.chakraPool.capacity;
    state = {
      ...state,
      players: {
        ...state.players,
        p1: {
          ...state.players.p1,
          backRow: state.players.p1.backRow.map((c, i) => (i === 3 && c ? { ...c, extra: { ...c.extra, absorbedChakra: 10 } } : c)),
        },
      },
    };

    const short = { ...state, players: { ...state.players, p1: { ...state.players.p1, backRow: state.players.p1.backRow.map((c, i) => (i === 3 && c ? { ...c, extra: { ...c.extra, absorbedChakra: 9 } } : c)) } } };
    expect(activateAbility(short, 'p1-kisame', 'samehada-shark-transformation', [], 0).stack).toHaveLength(0);
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

describe('Water Style: Thousand Hungry Sharks (Jutsu card)', () => {
  const combat = (s: ReturnType<typeof freshCombat>) => giveChakra(s, 'p1', 6);
  const hp = (s: ReturnType<typeof freshCombat>, i: number) => s.players.p2.backRow[i]!.currentHP;

  it("Kisame also has it as his own ability, at 7 — same split, Fusion's +1 and Absorb 1 apply", () => {
    expect(findAbility('kisame', 'thousand-hungry-sharks')?.cost).toBe(7);
    let s = giveChakra(freshCombat(), 'p1', 7);
    const before = [hp(s, 1), hp(s, 4)];
    s = activateAbility(s, 'p1-kisame', 'thousand-hungry-sharks', ['p2-hidan', 'p2-itachi', 'p2-itachi'], 0);
    expect(s.players.p1.genericChakraAvailable).toBe(0);
    s = resolveTop(s);
    expect([hp(s, 1), hp(s, 4)]).toEqual([before[0] - 1, before[1] - 3]);

    let t = giveChakra(freshCombat(), 'p1', 8);
    t = { ...t, players: { ...t.players, p1: { ...t.players.p1, backRow: t.players.p1.backRow.map((c) => (c?.defId === 'kisame' ? { ...c, extra: { ...c.extra, transformed: true, absorbedChakra: 10 } } : c)) } } };
    const hpBefore = hp(t, 4);
    t = resolveTop(activateAbility(t, 'p1-kisame', 'thousand-hungry-sharks', ['p2-itachi'], 0));
    expect(hp(t, 4)).toBe(hpBefore - 5);
    expect(t.players.p1.backRow.find((c) => c?.defId === 'kisame')!.extra.absorbedChakra).toBe(11);
  });

  it('costs 6 and splits 4 damage: one pick per point, a unit picked twice takes 2', () => {
    let s = combat(freshCombat());
    const before = [hp(s, 1), hp(s, 3), hp(s, 4)];
    s = playCard(s, 'p1', 'jutsu-thousand-hungry-sharks', 'p1-kisame', ['p2-hidan', 'p2-kisame', 'p2-itachi', 'p2-hidan']);
    expect(s.players.p1.genericChakraAvailable).toBe(0);
    s = resolveTop(s);
    expect([hp(s, 1), hp(s, 3), hp(s, 4)]).toEqual([before[0] - 2, before[1] - 1, before[2] - 1]);
  });

  it('whatever is left unassigned lands on the last pick — one pick takes all 4', () => {
    let s = combat(freshCombat());
    const before = hp(s, 4);
    s = resolveTop(playCard(s, 'p1', 'jutsu-thousand-hungry-sharks', 'p1-kisame', ['p2-itachi']));
    expect(hp(s, 4)).toBe(before - 4);
  });

  it('needs a Water enabler, and enemies only', () => {
    expect(playCard(combat(freshCombat()), 'p1', 'jutsu-thousand-hungry-sharks', 'p1-hidan', ['p2-itachi']).stack).toHaveLength(0);
    expect(playCard(combat(freshCombat()), 'p1', 'jutsu-thousand-hungry-sharks', 'p1-kisame', ['p1-itachi']).stack).toHaveLength(0);
  });

  it('a transformed Kisame enabling it deals 1 more, at the same cost (Samehada Fusion)', () => {
    let s = combat(freshCombat());
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c) => (c?.defId === 'kisame' ? { ...c, extra: { ...c.extra, transformed: true } } : c)) } } };
    const before = hp(s, 4);
    s = playCard(s, 'p1', 'jutsu-thousand-hungry-sharks', 'p1-kisame', ['p2-itachi']);
    expect(s.players.p1.genericChakraAvailable).toBe(0);
    s = resolveTop(s);
    expect(hp(s, 4)).toBe(before - 5);
  });
});

describe('Samehada Fusion: Absorb 1 on Kisame\'s Ninjutsu attacks while transformed', () => {
  const transformed = (s: ReturnType<typeof freshCombat>) => ({ ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c) => (c?.defId === 'kisame' ? { ...c, extra: { ...c.extra, transformed: true, absorbedChakra: 6 }, chakraPool: { current: 3, capacity: 18 } } : c)) } } });
  const kisame = (s: ReturnType<typeof freshCombat>) => s.players.p1.backRow.find((c) => c?.defId === 'kisame')!;
  const poolOn = (s: ReturnType<typeof freshCombat>, id: string, n: number) => ({ ...s, players: { ...s.players, p2: { ...s.players.p2, backRow: s.players.p2.backRow.map((c) => (c?.instanceId === id ? { ...c, chakraPool: { ...c.chakraPool, current: n } } : c)) } } });

  it('a Jutsu card he enables (Thousand Hungry Sharks) absorbs 1 from its first target into his Pool', () => {
    let s = poolOn(giveChakra(transformed(freshCombat()), 'p1', 6), 'p2-itachi', 2);
    s = resolveTop(playCard(s, 'p1', 'jutsu-thousand-hungry-sharks', 'p1-kisame', ['p2-itachi']));
    expect(kisame(s).chakraPool.current).toBe(4);
    expect(kisame(s).extra.absorbedChakra).toBe(7);
    expect(s.players.p2.backRow[4]!.chakraPool.current).toBe(1);
  });

  it('his own Ninjutsu attack (Super Shark Bomb) absorbs 1 on top of its Absorb 2', () => {
    let s = transformed(freshCombat());
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c) => (c?.defId === 'kisame' ? { ...c, chakraPool: { current: 8, capacity: 18 } } : c)) } } };
    s = resolveTop(activateAbility(s, 'p1-kisame', 'super-shark-bomb-jutsu', ['p2-itachi'], 6));
    expect(kisame(s).extra.absorbedChakra).toBe(9); // 6 + 2 + 1
  });

  it('not while untransformed, and not on a card someone else enables', () => {
    let s = giveChakra(freshCombat(), 'p1', 6);
    s = resolveTop(playCard(s, 'p1', 'jutsu-thousand-hungry-sharks', 'p1-kisame', ['p2-itachi']));
    expect(kisame(s).extra.absorbedChakra).toBe(0);
  });
});

describe('Ultimate: Water Style: Super Shark Bomb Jutsu', () => {
  const withPool = (s: ReturnType<typeof freshCombat>, kisamePool: number, targetPool: number) => ({
    ...s,
    players: {
      p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c) => (c?.defId === 'kisame' ? { ...c, chakraPool: { ...c.chakraPool, current: kisamePool } } : c)) },
      p2: { ...s.players.p2, backRow: s.players.p2.backRow.map((c) => (c?.instanceId === 'p2-itachi' ? { ...c, chakraPool: { ...c.chakraPool, current: targetPool } } : c)) },
    },
  });

  it('is his Ultimate, not a regular ability', () => {
    expect(getCharacterDef('kisame')!.ultimate?.id).toBe('super-shark-bomb-jutsu');
    expect(getCharacterDef('kisame')!.abilities.some((a) => a.id === 'super-shark-bomb-jutsu')).toBe(false);
  });

  it('costs 6 paid from his Pool only', () => {
    expect(activateAbility(giveChakra(withPool(freshCombat(), 6, 0), 'p1', 6), 'p1-kisame', 'super-shark-bomb-jutsu', ['p2-itachi'], 0).stack).toHaveLength(0);
    const s = activateAbility(withPool(freshCombat(), 6, 0), 'p1-kisame', 'super-shark-bomb-jutsu', ['p2-itachi'], 6);
    expect(s.stack).toHaveLength(1);
    expect(s.players.p1.backRow.find((c) => c?.defId === 'kisame')!.chakraPool.current).toBe(0);
  });

  it('deals 3 + the Chakra pooled on the target, then Absorbs 2', () => {
    let s = withPool(freshCombat(), 6, 3);
    const hp = s.players.p2.backRow[4]!.currentHP;
    s = resolveTop(activateAbility(s, 'p1-kisame', 'super-shark-bomb-jutsu', ['p2-itachi'], 6));
    expect(s.players.p2.backRow[4]!.currentHP).toBe(hp - 6);
    expect(s.players.p2.backRow[4]!.chakraPool.current).toBe(1);
    const k = s.players.p1.backRow.find((c) => c?.defId === 'kisame')!;
    expect(k.chakraPool.current).toBe(2);
    expect(k.extra.absorbedChakra).toBe(2);
  });
});
