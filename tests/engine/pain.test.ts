import { describe, expect, it } from 'vitest';
import { activateAbility } from '../../src/engine/abilities';
import { dealDamage } from '../../src/engine/combat';
import { gameReducer } from '../../src/engine/reducer';
import { placeToken } from '../../src/engine/board';
import { createSixPaths } from '../../src/engine/characters';
import { freshCombat, freshMain1, giveChakra, resolveTop } from './testUtils';
import type { GameState, PlayerId } from '../../src/engine/types';

function withSixPaths(state: GameState, player: PlayerId): { state: GameState; ids: Record<string, string> } {
  let next = state;
  const ids: Record<string, string> = {};
  for (const token of createSixPaths(player)) {
    next = placeToken(next, player, { ...token, status: { ...token.status, enteredTurn: 0 } }); // in play since before this turn
    ids[token.defId] = token.instanceId;
  }
  return { state: next, ids };
}

describe('Pain of the Six Paths', () => {
  it('each Path pools Chakra individually into its own Pool (Rinnegan Reservoir)', () => {
    const { state: base, ids } = withSixPaths(freshMain1(), 'p1'); // pooling is a Main Phase action
    let state = giveChakra(base, 'p1', 5);
    state = gameReducer(state, { type: 'POOL_CHAKRA', instanceId: ids['deva-path'], amount: 3 });
    state = gameReducer(state, { type: 'POOL_CHAKRA', instanceId: ids['naraka-path'], amount: 2 });

    const deva = state.players.p1.frontRow.find((t) => t?.instanceId === ids['deva-path'])!;
    const naraka = state.players.p1.frontRow.find((t) => t?.instanceId === ids['naraka-path'])!;
    expect(deva.chakraPool!.current).toBe(3);
    expect(naraka.chakraPool!.current).toBe(2);
  });

  it('Shinra Tensei deals 3 to the primary target plus 3 in a cross pattern', () => {
    const { state: base, ids } = withSixPaths(freshCombat(), 'p1');
    let state = giveChakra(base, 'p1', 4);
    const kakuzuHpBefore = state.players.p2.backRow[0]!.currentHP;
    const hidanHpBefore = state.players.p2.backRow[1]!.currentHP; // cross-pattern neighbor

    state = activateAbility(state, ids['deva-path'], 'shinra-tensei', ['p2-kakuzu'], 0);
    expect(state.stack).toHaveLength(1);
    state = resolveTop(state);

    expect(state.players.p2.backRow[0]!.currentHP).toBe(kakuzuHpBefore - 3);
    expect(state.players.p2.backRow[1]!.currentHP).toBe(hidanHpBefore - 3);
  });

  it('Deva Path can only use up to 2 of its own abilities per turn', () => {
    const { state: base, ids } = withSixPaths(freshCombat(), 'p1');
    let state = giveChakra(base, 'p1', 20);
    state = activateAbility(state, ids['deva-path'], 'shinra-tensei', ['p2-kakuzu'], 0);
    state = resolveTop(state);
    state = activateAbility(state, ids['deva-path'], 'bansho-tennin', ['p2-kakuzu'], 0);
    state = resolveTop(state);

    const stackBefore = state.stack.length;
    state = activateAbility(state, ids['deva-path'], 'shinra-tensei', ['p2-kakuzu'], 0);
    expect(state.stack.length).toBe(stackBefore); // 3rd this turn rejected
  });

  it('Shinra Tensei V2 negates an attack aimed at Deva Path specifically', () => {
    const { state: base, ids } = withSixPaths(freshCombat(), 'p1');
    let state = { ...base, activePlayer: 'p2' as const, priorityPlayer: 'p2' as const };
    state = giveChakra(state, 'p2', 3);
    state = activateAbility(state, 'p2-kakuzu', 'earth-grudge-fear', [ids['deva-path']], 0);
    expect(state.stack).toHaveLength(1);

    state = giveChakra(state, 'p1', 4);
    state = activateAbility(state, ids['deva-path'], 'shinra-tensei-v2', [], 0);
    expect(state.stack).toHaveLength(2);

    const devaHpBefore = state.players.p1.frontRow.find((t) => t?.instanceId === ids['deva-path'])!.currentHP;
    state = gameReducer(state, { type: 'PASS_PRIORITY' });
    state = gameReducer(state, { type: 'PASS_PRIORITY' }); // resolves Shinra Tensei V2, negating Earth Grudge Fear
    expect(state.stack).toHaveLength(0);
    expect(state.players.p1.frontRow.find((t) => t?.instanceId === ids['deva-path'])!.currentHP).toBe(devaHpBefore);
  });

  it('Mechanized Guard negates a Physical attack on any Path, but not a Ninjutsu one', () => {
    const { state: base, ids } = withSixPaths(freshCombat(), 'p1');
    let state = { ...base, activePlayer: 'p2' as const, priorityPlayer: 'p2' as const };
    state = giveChakra(state, 'p2', 4);
    // Searing Migraine is Ninjutsu — Mechanized Guard shouldn't be able to intercept it.
    state = activateAbility(state, 'p2-kakuzu', 'searing-migraine', [ids['human-path']], 0);
    expect(state.stack).toHaveLength(1);

    state = giveChakra(state, 'p1', 2);
    const stackBefore = state.stack.length;
    state = activateAbility(state, ids['asura-path'], 'mechanized-guard', [], 0);
    expect(state.stack.length).toBe(stackBefore); // rejected — wrong Type
  });

  it('Animal Path Summon creates a Beast (max 1 in play), and it fizzles when Animal Path is defeated', () => {
    const { state: base, ids } = withSixPaths(freshCombat(), 'p1');
    let state = giveChakra(base, 'p1', 3);
    state = activateAbility(state, ids['animal-path'], 'summon-ku-three-headed-hound', [], 0);
    expect(state.stack).toHaveLength(1);
    state = resolveTop(state);
    expect(state.players.p1.frontRow.some((t) => t?.defId === 'ku-three-headed-hound')).toBe(true);

    const stackBefore = state.stack.length;
    state = activateAbility(state, ids['animal-path'], 'summon-ku-three-headed-hound', [], 0);
    expect(state.stack.length).toBe(stackBefore); // already 1 in play, rejected

    // Defeat Animal Path (HP 5) — the Beast should fizzle along with it.
    state = dealDamage(state, ids['animal-path'], 10).state;
    expect(state.players.p1.frontRow.some((t) => t?.instanceId === ids['animal-path'])).toBe(false);
    expect(state.players.p1.frontRow.some((t) => t?.defId === 'ku-three-headed-hound')).toBe(false);
  });

  it("Naraka Path's King of Hell's Judgment heals at your next Upkeep, but is cancelled if Naraka dies first", () => {
    const { state: base, ids } = withSixPaths(freshCombat(), 'p1');
    let state = giveChakra(base, 'p1', 4);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, frontRow: state.players.p1.frontRow.map((t) => (t?.instanceId === ids['deva-path'] ? { ...t, currentHP: 1 } : t)) },
      },
    };
    state = activateAbility(state, ids['naraka-path'], 'king-of-hells-judgment', [ids['deva-path']], 0);
    state = resolveTop(state);

    // Advance to p1's next Upkeep (11 phases from Combat).
    for (let i = 0; i < 11; i++) state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    expect(state.activePlayer).toBe('p1');
    expect(state.phase).toBe('Upkeep');
    expect(state.players.p1.frontRow.find((t) => t?.instanceId === ids['deva-path'])!.currentHP).toBe(4); // 1 + 3
  });

  it('Samsara of Heavenly Life Technique revives a defeated Path at full HP with Field Orientation', () => {
    const { state: base, ids } = withSixPaths(freshCombat(), 'p1');
    let state = dealDamage(base, ids['human-path'], 10).state; // defeat Human Path (4 HP)
    expect(state.players.p1.frontRow.some((t) => t?.instanceId === ids['human-path'])).toBe(false);

    state = giveChakra(state, 'p1', 7);
    state = activateAbility(state, ids['naraka-path'], 'outer-path-samsara', ['human-path'], 0);
    expect(state.stack).toHaveLength(1);
    state = resolveTop(state);

    // Advance to p1's next Upkeep.
    for (let i = 0; i < 12; i++) state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    const revived = state.players.p1.frontRow.find((t) => t?.defId === 'human-path');
    expect(revived).toBeDefined();
    expect(revived!.currentHP).toBe(4);
    expect(revived!.status.enteredTurn).toBe(state.turn); // fresh Field Orientation
  });
});
