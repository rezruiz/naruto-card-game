import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../src/engine/state';
import { getAdjacent, getCrossPatternTargets, pairedFrontSlots, placeToken } from '../../src/engine/board';
import type { TokenInstance } from '../../src/engine/types';

function makeToken(id: string, ownerInstanceId: string): TokenInstance {
  return {
    instanceId: id,
    defId: 'test-token',
    owner: 'p1',
    name: id,
    maxHP: 1,
    currentHP: 1,
    ownerCharacterInstanceId: ownerInstanceId,
    status: { disabled: false, retreated: false, enteredTurn: 1, hasAmbush: false, usedAbilitiesThisTurn: [], pooledThisTurn: false },
    extra: {},
  };
}

describe('board adjacency (SPEC.md §9)', () => {
  it('pairs front-row slots 2N/2N+1 with back-row column N', () => {
    expect(pairedFrontSlots(0)).toEqual([0, 1]);
    expect(pairedFrontSlots(2)).toEqual([4, 5]);
  });

  it('back-row occupant sees same-row left/right neighbors', () => {
    const state = createInitialState('p1');
    const adj = getAdjacent(state, 'p1', 'back', 1); // hidan, between kakuzu and deidara
    expect(adj.left?.name).toBe('Kakuzu');
    expect(adj.right?.name).toBe('Deidara');
  });

  it('edge-of-row has no left/right neighbor on that side', () => {
    const state = createInitialState('p1');
    const adj = getAdjacent(state, 'p1', 'back', 0); // Kakuzu, leftmost
    expect(adj.left).toBeNull();
  });

  it('front-row token sees the character in its paired back column', () => {
    let state = createInitialState('p1');
    state = placeToken(state, 'p1', makeToken('tok-1', 'p1-kakuzu')); // lands in front slot 0
    const adj = getAdjacent(state, 'p1', 'front', 0);
    expect(adj.back?.name).toBe('Kakuzu');
  });

  it('back-row character sees a token in either of its paired front slots', () => {
    let state = createInitialState('p1');
    state = placeToken(state, 'p1', makeToken('tok-1', 'p1-kakuzu')); // front slot 0, paired with back col 0
    const adj = getAdjacent(state, 'p1', 'back', 0);
    expect(adj.front?.instanceId).toBe('tok-1');
  });

  it('cross pattern collects only the occupied adjacent slots, up to 4', () => {
    let state = createInitialState('p1');
    state = placeToken(state, 'p1', makeToken('tok-1', 'p1-kakuzu')); // paired with back col 0
    const targets = getCrossPatternTargets(state, 'p1', 'back', 1); // Hidan: left=Kakuzu, right=Deidara, front=none (col 1 empty)
    const names = targets.map((t) => t.name).sort();
    expect(names).toEqual(['Deidara', 'Kakuzu']);
  });

  it('never reaches across into the other player’s rows', () => {
    const state = createInitialState('p1');
    const adj = getAdjacent(state, 'p1', 'back', 0);
    // p2's board is a mirror but getAdjacent only ever looks at the given player's own rows.
    expect(adj.left).toBeNull();
    expect(adj.right?.name).toBe('Hidan');
  });
});
