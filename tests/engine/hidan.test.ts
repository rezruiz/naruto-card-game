import { describe, expect, it } from 'vitest';
import { activateAbility } from '../../src/engine/abilities';
import { gameReducer } from '../../src/engine/reducer';
import { dealDamage } from '../../src/engine/combat';
import { enableAll, freshCombat, giveChakra, resolveTop } from './testUtils';
import type { GameState } from '../../src/engine/types';

/** Curse Technique's condition: Hidan must already have damaged the target (combat.ts records it). */
const hidanHasDamaged = (s: GameState, targetId: string): GameState => ({
  ...s,
  players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c) => (c?.defId === 'hidan' ? { ...c, extra: { ...c.extra, damagedEnemies: [targetId] } } : c)) } },
});

describe('Hidan', () => {
  it("Curse Technique can only target an enemy Hidan has already damaged", () => {
    const state = giveChakra(freshCombat(), 'p1', 6);
    expect(activateAbility(state, 'p1-hidan', 'curse-technique', ['p2-kakuzu'], 0).stack).toHaveLength(0);
    let hit = activateAbility(giveChakra(state, 'p1', 8), 'p1-hidan', 'triple-scythe-sweep', ['p2-kakuzu'], 0);
    hit = resolveTop(hit);
    expect(hit.players.p1.backRow[1]?.extra.damagedEnemies).toEqual(['p2-kakuzu']);
  });

  it('Curse Technique activates and binds a Cursed target', () => {
    let state = giveChakra(freshCombat(), 'p1', 6);
    state = activateAbility(hidanHasDamaged(state, 'p2-kakuzu'), 'p1-hidan', 'curse-technique', ['p2-kakuzu'], 0);
    state = resolveTop(state);
    expect(state.players.p1.backRow[1]?.extra.curseActive).toBe(true);
    expect(state.players.p1.backRow[1]?.extra.cursedTarget).toBe('p2-kakuzu');
  });

  it('while Cursing, Triple Scythe Sweep costs 1 and can hit Hidan himself — even the turn the Curse went up', () => {
    let state = giveChakra(freshCombat(), 'p1', 7);
    state = activateAbility(hidanHasDamaged(state, 'p2-kakuzu'), 'p1-hidan', 'curse-technique', ['p2-kakuzu'], 0);
    state = resolveTop(state);
    expect(state.players.p1.genericChakraAvailable).toBe(1);

    const p2HpBefore = state.players.p2.backRow[0]!.currentHP;
    const hidanHpBefore = state.players.p1.backRow[1]!.currentHP;
    state = activateAbility(state, 'p1-hidan', 'triple-scythe-sweep', ['p1-hidan'], 0);
    expect(state.stack).toHaveLength(1);
    expect(state.players.p1.genericChakraAvailable).toBe(0);
    state = resolveTop(state);
    expect(state.players.p1.backRow[1]!.currentHP).toBe(hidanHpBefore - 1);
    expect(state.players.p2.backRow[0]!.currentHP).toBe(p2HpBefore - 2); // mirrored 1, +1 extra
  });

  it("without a Curse he can't target himself and it costs 3; self-damage never drops him below 3 HP", () => {
    let state = giveChakra(freshCombat(), 'p1', 3);
    expect(activateAbility(state, 'p1-hidan', 'triple-scythe-sweep', ['p1-hidan'], 0).stack).toHaveLength(0);
    state = activateAbility(state, 'p1-hidan', 'triple-scythe-sweep', ['p2-hidan'], 0);
    expect(state.players.p1.genericChakraAvailable).toBe(0);

    let cursed = giveChakra(freshCombat(), 'p1', 7);
    cursed = resolveTop(activateAbility(hidanHasDamaged(cursed, 'p2-kakuzu'), 'p1-hidan', 'curse-technique', ['p2-kakuzu'], 0));
    cursed = { ...cursed, players: { ...cursed.players, p1: { ...cursed.players.p1, backRow: cursed.players.p1.backRow.map((c) => (c?.defId === 'hidan' ? { ...c, currentHP: 3 } : c)) } } };
    cursed = resolveTop(activateAbility(cursed, 'p1-hidan', 'triple-scythe-sweep', ['p1-hidan'], 0));
    expect(cursed.players.p1.backRow[1]!.currentHP).toBe(3);
  });

  it('the Curse ends when the Cursed enemy is defeated', () => {
    let state = giveChakra(freshCombat(), 'p1', 6);
    state = resolveTop(activateAbility(hidanHasDamaged(state, 'p2-itachi'), 'p1-hidan', 'curse-technique', ['p2-itachi'], 0));
    expect(state.players.p1.backRow[1]!.extra.curseActive).toBe(true);
    state = dealDamage(state, 'p2-itachi', 99, { cannotBeReduced: true }).state;
    expect(state.players.p2.backRow.some((c) => c?.instanceId === 'p2-itachi')).toBe(false);
    expect(state.players.p1.backRow[1]!.extra.curseActive).toBe(false);
  });

  it('regenerates 1 HP at End Phase (2 while the Ultimate is active)', () => {
    let state = freshCombat();
    state = dealDamage(state, 'p1-hidan', 5).state; // 9 -> 4
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // Combat
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // Main2
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // End — regen hook fires here
    expect(state.players.p1.backRow[1]?.currentHP).toBe(5);
  });
});
