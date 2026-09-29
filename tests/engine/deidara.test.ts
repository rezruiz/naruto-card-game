import { describe, expect, it } from 'vitest';
import { activateAbility, findAbility } from '../../src/engine/abilities';
import { gameReducer } from '../../src/engine/reducer';
import { dealDamage } from '../../src/engine/combat';
import type { GameState } from '../../src/engine/types';
import { freshCombat, freshMain1, giveChakra, resolveTop } from './testUtils';

const deidaraOf = (s: GameState) => s.players.p1.backRow.find((c) => c?.defId === 'deidara');
const setDeidara = (s: GameState, patch: (d: NonNullable<ReturnType<typeof deidaraOf>>) => object): GameState => ({
  ...s,
  players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c) => (c?.defId === 'deidara' ? ({ ...c, ...patch(c) } as typeof c) : c)) } },
});
const unitsHp = (s: GameState, p: 'p1' | 'p2') => [...s.players[p].backRow, ...s.players[p].frontRow].filter(Boolean).map((u) => [u!.instanceId, u!.currentHP] as const);

describe('Deidara — Death is an Explosion (Forbidden Technique)', () => {
  const armed = (hp: number, charges: number) =>
    setDeidara(giveChakra(freshCombat(), 'p1', 20), (d) => ({ currentHP: hp, chakraPool: { ...d.chakraPool, current: d.chakraPool.capacity }, extra: { ...d.extra, clayCharges: charges } }));

  it('Version 1: at 3 HP or less with a full Pool and 4 Clay Charges — 8 to every enemy, 3 to every ally, Deidara dies; the whole Pool is spent', () => {
    let s = armed(3, 4);
    const enemiesBefore = new Map(unitsHp(s, 'p2'));
    const alliesBefore = new Map(unitsHp(s, 'p1'));
    const deidaraId = deidaraOf(s)!.instanceId;
    s = activateAbility(s, deidaraId, 'death-is-an-explosion-v1', [], 0);
    expect(s.stack).toHaveLength(1);
    expect(s.players.p1.genericChakraAvailable).toBe(15); // 5 generic — the Pool (3) paid the rest
    expect(deidaraOf(s)!.chakraPool.current).toBe(0);
    s = resolveTop(s);
    expect(deidaraOf(s)).toBeUndefined(); // he dies
    expect(s.log.some((l) => /Art is an EXPLOSION/.test(l.text))).toBe(true);
    // Every enemy took 8 (several of p2's roster revive instead of dying — Kakuzu's Hearts, Hidan's Blessing — so check the log, not survivors' HP).
    expect(s.log.filter((l) => /takes 8 damage/.test(l.text)).length).toBe(enemiesBefore.size);
    const hidanAfter = s.players.p1.backRow.find((c) => c?.defId === 'hidan');
    if (hidanAfter) expect(hidanAfter.currentHP).toBeLessThan(alliesBefore.get(hidanAfter.instanceId)!);
  });

  it('Version 1 is refused above 3 HP, without a full Pool, or with too few Clay Charges', () => {
    for (const s of [armed(4, 4), armed(3, 3), setDeidara(armed(3, 4), (d) => ({ chakraPool: { ...d.chakraPool, current: 0 } }))]) {
      expect(activateAbility(s, deidaraOf(s)!.instanceId, 'death-is-an-explosion-v1', [], 0).stack).toHaveLength(0);
    }
  });

  it('Version 2: when Deidara would be defeated (full Pool, 5 Charges) the player is asked — Activate blasts and he dies', () => {
    let s = armed(2, 5);
    const deidaraId = deidaraOf(s)!.instanceId;
    s = dealDamage(s, deidaraId, 5).state;
    expect(deidaraOf(s)?.currentHP).toBe(0); // held at 0 HP, waiting on the answer
    const choice = s.pendingChoices[0];
    expect(choice.player).toBe('p1');
    s = gameReducer(s, { type: 'RESOLVE_CHOICE', choiceId: choice.id, optionIds: ['activate'] });
    expect(deidaraOf(s)).toBeUndefined();
    expect(s.players.p1.genericChakraAvailable).toBe(14);
    expect(s.log.some((l) => /Art is an EXPLOSION/.test(l.text))).toBe(true);
  });

  it('Version 2: declining just lets him fall; without a full Pool and 5 Charges there is no prompt at all', () => {
    let s = armed(2, 5);
    s = dealDamage(s, deidaraOf(s)!.instanceId, 5).state;
    s = gameReducer(s, { type: 'RESOLVE_CHOICE', choiceId: s.pendingChoices[0].id, optionIds: ['decline'] });
    expect(deidaraOf(s)).toBeUndefined();
    expect(s.log.some((l) => /Art is an EXPLOSION/.test(l.text))).toBe(false);

    let t = armed(2, 4);
    t = dealDamage(t, deidaraOf(t)!.instanceId, 5).state;
    expect(t.pendingChoices).toHaveLength(0);
    expect(deidaraOf(t)).toBeUndefined();
  });

  it("Version 2 can't be activated by hand — it only fires from its trigger", () => {
    const s = armed(2, 5);
    expect(activateAbility(s, deidaraOf(s)!.instanceId, 'death-is-an-explosion-v2', [], 0).stack).toHaveLength(0);
  });
});

describe('Clay Spider token', () => {
  const withSpiders = (n: number) => {
    let s = giveChakra(freshCombat(), 'p1', 10);
    for (let i = 0; i < n; i++) {
      s = setDeidara(s, (d) => ({ status: { ...d.status, usedAbilitiesThisTurn: [] } })); // C1 is 2×/turn — pretend a new turn between summons
      s = resolveTop(activateAbility({ ...s, phase: 'Main1' }, 'p1-deidara', 'c1-shi-wan', [], 0));
    }
    s = { ...s, phase: 'Combat', players: { ...s.players, p1: { ...s.players.p1, frontRow: s.players.p1.frontRow.map((t) => (t ? { ...t, status: { ...t.status, usedAbilitiesThisTurn: [] } } : t)) } } };
    return s;
  };
  const spiders = (s: GameState) => s.players.p1.frontRow.filter((t) => t?.defId === 'clay-spider').map((t) => t!.instanceId);

  it('Self Detonate: the player picks how many spiders detonate at one target — 1 damage each, 1 Chakra total, spiders destroyed', () => {
    let s = withSpiders(2);
    expect(spiders(s)).toHaveLength(2);
    const hpBefore = s.players.p2.backRow[1]!.currentHP;
    const chakraBefore = s.players.p1.genericChakraAvailable;
    s = activateAbility({ ...s, priorityPlayer: 'p1' }, spiders(s)[0], 'self-detonate', ['p2-hidan'], 0, { choices: { spiders: 2 } });
    expect(s.players.p1.genericChakraAvailable).toBe(chakraBefore - 1);
    s = resolveTop(s);
    expect(spiders(s)).toHaveLength(0);
    expect(s.players.p2.backRow[1]!.currentHP).toBe(hpBefore - 2);
  });

  it('Combine: 4 spiders revert to clay for 2 Clay Charges', () => {
    let s = withSpiders(4);
    s = { ...s, phase: 'Main1' };
    const before = deidaraOf(s)!.extra.clayCharges as number;
    s = resolveTop(activateAbility(s, spiders(s)[0], 'combine-clay-spiders', [], 0));
    expect(spiders(s)).toHaveLength(0);
    expect(deidaraOf(s)!.extra.clayCharges).toBe(before + 2);
  });
});

describe('Deidara', () => {
  it('Explosive Clay generates a Clay Charge and can be used up to 3 times per turn', () => {
    let state = giveChakra(freshCombat(), 'p1', 3);
    expect(state.players.p1.backRow[2]?.extra.clayCharges).toBe(1); // starts with 1

    for (let i = 0; i < 3; i++) {
      state = activateAbility(state, 'p1-deidara', 'explosive-clay', [], 0);
      state = resolveTop(state);
    }
    expect(state.players.p1.backRow[2]?.extra.clayCharges).toBe(4);

    // 4th activation this turn should be rejected (usesPerTurn: 3).
    const stackBefore = state.stack.length;
    state = activateAbility(state, 'p1-deidara', 'explosive-clay', [], 0);
    expect(state.stack.length).toBe(stackBefore);
  });

  it('C1, Shi-Wan creates a Clay Spider token, capped at 5', () => {
    let state = giveChakra(freshCombat(), 'p1', 10);
    for (let i = 0; i < 2; i++) {
      state = activateAbility(state, 'p1-deidara', 'c1-shi-wan', [], 0);
      state = resolveTop(state);
    }
    expect(state.players.p1.frontRow.filter((t) => t?.defId === 'clay-spider')).toHaveLength(2);

    // usesPerTurn is 2 — a 3rd this turn is rejected regardless of the 5-cap.
    const stackBefore = state.stack.length;
    state = activateAbility(state, 'p1-deidara', 'c1-shi-wan', [], 0);
    expect(state.stack.length).toBe(stackBefore);
  });

  it('Detonation Art deals 4 (not 2) and spends a Clay Charge when the player chooses to spend it', () => {
    let state = giveChakra(freshCombat(), 'p1', 3);
    const targetHpBefore = state.players.p2.backRow[0]?.currentHP ?? 0;
    state = activateAbility(state, 'p1-deidara', 'detonation-art', ['p2-kakuzu'], 0, { choices: { spendCharge: true } });
    state = resolveTop(state);
    expect(state.players.p2.backRow[0]?.currentHP).toBe(targetHpBefore - 4);
    expect(state.players.p1.backRow[2]?.extra.clayCharges).toBe(0); // spent
  });

  it("Detonation Art never spends a Clay Charge on its own — declining (or not being asked) deals the base 2 and keeps it", () => {
    for (const choices of [{ spendCharge: false }, undefined]) {
      let state = giveChakra(freshCombat(), 'p1', 3);
      const targetHpBefore = state.players.p2.backRow[0]?.currentHP ?? 0;
      state = activateAbility(state, 'p1-deidara', 'detonation-art', ['p2-kakuzu'], 0, { choices });
      state = resolveTop(state);
      expect(state.players.p2.backRow[0]?.currentHP).toBe(targetHpBefore - 2);
      expect(state.players.p1.backRow[2]?.extra.clayCharges).toBe(1); // kept
    }
  });

  it('only asks about the Clay Charge when Deidara has one', () => {
    const state = freshCombat();
    const ability = findAbility('deidara', 'detonation-art')!;
    const ctx = { state, sourceInstanceId: 'p1-deidara', targetInstanceIds: ['p2-kakuzu'] };
    expect(ability.choices!(ctx).map((c) => c.id)).toEqual(['spendCharge']);
    const noCharges = { ...state, players: { ...state.players, p1: { ...state.players.p1, backRow: state.players.p1.backRow.map((c) => (c?.defId === 'deidara' ? { ...c, extra: { ...c.extra, clayCharges: 0 } } : c)) } } };
    expect(ability.choices!({ ...ctx, state: noCharges })).toEqual([]);
  });

  it('C3, Shi-Suri requires a full Pool and 5 Clay Charges, and hits in a cross pattern', () => {
    let state = freshMain1(); // pooling is a Main Phase action
    // Not enough Charges or Pool yet — rejected.
    const stackBefore = state.stack.length;
    state = activateAbility({ ...state, phase: 'Combat' }, 'p1-deidara', 'c3-shi-suri', ['p2-kakuzu'], 0);
    expect(state.stack.length).toBe(stackBefore);
    state = { ...state, phase: 'Main1' };

    // Fill Deidara's Pool (capacity 3) and stock 5 Clay Charges.
    state = giveChakra(state, 'p1', 3);
    state = gameReducer(state, { type: 'POOL_CHAKRA', instanceId: 'p1-deidara', amount: 3 });
    // Pooling taps Deidara for the rest of *this* turn (§5.3's pool-XOR-act
    // rule) — advance to a later turn before activating his Ultimate.
    for (let i = 0; i < 15; i++) state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    expect(state.activePlayer).toBe('p1');
    expect(state.phase).toBe('Combat'); // damaging Normal-speed abilities are a Combat action (§4.5)
    state = {
      ...state,
      players: {
        ...state.players,
        p1: {
          ...state.players.p1,
          backRow: state.players.p1.backRow.map((c, i) =>
            i === 2 && c ? { ...c, extra: { ...c.extra, clayCharges: 5 } } : c,
          ),
        },
      },
    };
    state = giveChakra(state, 'p1', 5);

    const kakuzuHpBefore = state.players.p2.backRow[0]?.currentHP ?? 0; // primary target
    const hidanHpBefore = state.players.p2.backRow[1]?.currentHP ?? 0; // right neighbor — cross pattern

    state = activateAbility(state, 'p1-deidara', 'c3-shi-suri', ['p2-kakuzu'], 0);
    expect(state.stack).toHaveLength(1);
    state = resolveTop(state);

    expect(state.players.p2.backRow[0]?.currentHP).toBe(kakuzuHpBefore - 5); // primary hit
    expect(state.players.p2.backRow[1]?.currentHP).toBe(hidanHpBefore - 3); // cross-pattern splash
  });
});
