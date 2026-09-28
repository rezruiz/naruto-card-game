import { describe, expect, it } from 'vitest';
import { activateAbility } from '../../src/engine/abilities';
import { gameReducer } from '../../src/engine/reducer';
import { dealDamage } from '../../src/engine/combat';
import { freshCombat, giveChakra, resolveTop } from './testUtils';

describe('Hidan', () => {
  it('Curse Technique activates and binds a Cursed target', () => {
    let state = giveChakra(freshCombat(), 'p1', 6);
    state = activateAbility(state, 'p1-hidan', 'curse-technique', ['p2-kakuzu'], 0);
    state = resolveTop(state);
    expect(state.players.p1.backRow[1]?.extra.curseActive).toBe(true);
    expect(state.players.p1.backRow[1]?.extra.cursedTarget).toBe('p2-kakuzu');
  });

  it("can't self-target the same turn the Curse was activated", () => {
    let state = giveChakra(freshCombat(), 'p1', 8);
    state = activateAbility(state, 'p1-hidan', 'curse-technique', ['p2-kakuzu'], 0);
    state = resolveTop(state);

    const stackBefore = state.stack.length;
    state = activateAbility(state, 'p1-hidan', 'triple-scythe-sweep', ['p1-hidan'], 0);
    expect(state.stack.length).toBe(stackBefore); // rejected — same-turn restriction
  });

  it('self-targeting costs 0 Chakra while Curse is active, and mirrors damage to the Cursed target', () => {
    let state = giveChakra(freshCombat(), 'p1', 8);
    state = activateAbility(state, 'p1-hidan', 'curse-technique', ['p2-kakuzu'], 0);
    state = resolveTop(state);

    // Advance two full rounds (back to p1's own Main1) so the same-turn
    // self-target restriction clears, and so we're back on p1's own turn
    // (Normal-speed abilities require the activating player to be active).
    for (let i = 0; i < 14; i++) state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    expect(state.activePlayer).toBe('p1');
    state = giveChakra(state, 'p1', 0); // 0 generic Chakra left — self-target must still be legal (costs 0)

    const p2HpBefore = state.players.p2.backRow[0]?.currentHP ?? 0;
    const hidanHpBefore = state.players.p1.backRow[1]?.currentHP ?? 0;
    state = activateAbility(state, 'p1-hidan', 'triple-scythe-sweep', ['p1-hidan'], 0);
    expect(state.stack).toHaveLength(1); // legal despite 0 generic Chakra
    state = resolveTop(state);

    // Hidan takes self-damage (floored at 3 HP min), mirrored + 1 onto the Cursed target.
    expect(state.players.p1.backRow[1]!.currentHP).toBeLessThanOrEqual(hidanHpBefore);
    expect(state.players.p2.backRow[0]!.currentHP).toBeLessThan(p2HpBefore);
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
