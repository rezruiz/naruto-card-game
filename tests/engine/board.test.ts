import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../src/engine/state';
import { BACK_ROW_SIZE, MAX_CHARACTERS, getAdjacent, getCrossPatternTargets, legalCharacterSlots, pairedBackColumn, pairedFrontSlots, placeToken } from '../../src/engine/board';
import type { TokenInstance } from '../../src/engine/types';

describe('back row positions vs. the character cap (SPEC.md §6.5, §9)', () => {
  it('the back row has 10 positions but holds at most 5 characters', () => {
    const state = createInitialState('p1'); // 5 characters in slots 0-4
    expect(BACK_ROW_SIZE).toBe(10);
    expect(state.players.p1.backRow.filter(Boolean)).toHaveLength(MAX_CHARACTERS);
    expect(legalCharacterSlots(state, 'p1')).toEqual([]); // at the cap, even with empty positions left

    const four = { ...state, players: { ...state.players, p1: { ...state.players.p1, backRow: state.players.p1.backRow.map((c, i) => (i === 4 ? null : c)) } } };
    expect(legalCharacterSlots(four, 'p1')).toEqual([0, 1, 2, 3, 4]); // beside Deidara (slot 3), or onto any of the 4
  });
});

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
  it('lines the rows up one-to-one: front slot N is directly in front of back slot N', () => {
    expect(pairedFrontSlots(0)).toEqual([0]);
    expect(pairedFrontSlots(7)).toEqual([7]);
    expect(pairedBackColumn(3)).toBe(3);
  });

  it('a token sees left/right neighbors in its own row, and only the character directly behind it', () => {
    let state = createInitialState('p1');
    for (const id of ['tok-0', 'tok-1', 'tok-2']) state = placeToken(state, 'p1', makeToken(id, 'p1-kakuzu')); // front slots 0-2
    const adj = getAdjacent(state, 'p1', 'front', 1);
    expect(adj.left?.instanceId).toBe('tok-0');
    expect(adj.right?.instanceId).toBe('tok-2');
    expect(adj.back?.name).toBe('Hidan'); // back slot 1, not Kakuzu
    expect(getAdjacent(state, 'p1', 'back', 1).front?.instanceId).toBe('tok-1');
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

  it('back-row character sees the token directly in front of it', () => {
    let state = createInitialState('p1');
    state = placeToken(state, 'p1', makeToken('tok-1', 'p1-kakuzu')); // front slot 0, in front of back slot 0
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
