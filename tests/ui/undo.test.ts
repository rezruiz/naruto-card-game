import { describe, expect, it } from 'vitest';
import { gameReducer } from '../../src/engine/reducer';
import { recordUndo, UNDO_LIMIT, undoLabelFor, type UndoEntry } from '../../src/ui/undo';
import { freshMain1 } from '../engine/testUtils';
import type { GameAction, GameState, PlayerId, TokenInstance } from '../../src/engine/types';

function placeShinobi(state: GameState, player: PlayerId, name: string, damage: number, health: number): { state: GameState; id: string } {
  const id = `${player}-test-${name}`;
  const token: TokenInstance = {
    instanceId: id,
    defId: 'shinobi-rain-genin',
    owner: player,
    name,
    maxHP: health,
    currentHP: health,
    ownerCharacterInstanceId: '',
    status: { disabled: false, retreated: false, enteredTurn: 0, hasAmbush: false, usedAbilitiesThisTurn: [], pooledThisTurn: false },
    extra: { shinobi: true, shinobiDamage: damage },
  };
  const frontRow = state.players[player].frontRow.slice();
  frontRow[0] = token;
  return { state: { ...state, players: { ...state.players, [player]: { ...state.players[player], frontRow } } }, id };
}

/** Plays actions the way the app does, keeping the undo history. */
function play(start: GameState, actions: GameAction[]) {
  let state = start;
  let history: UndoEntry[] = [];
  for (const action of actions) {
    const next = gameReducer(state, action);
    history = recordUndo(history, action, state, next);
    state = next;
  }
  return { state, history };
}

describe('Undo', () => {
  it('steps back through a Shinobi attack and defense, one action at a time', () => {
    const a = placeShinobi({ ...freshMain1(), ruleset: 'prototype', phase: 'Combat' }, 'p1', 'Jonin', 3, 5);
    const d = placeShinobi(a.state, 'p2', 'Chunin', 2, 4);
    const { state, history } = play(d.state, [
      { type: 'DECLARE_SHINOBI_ATTACK', attackerId: a.id, targetId: 'p2-deidara' },
      { type: 'CONFIRM_SHINOBI_ATTACKS' },
      { type: 'ASSIGN_SHINOBI_DEFENDER', attackerId: a.id, defenderId: d.id },
      { type: 'CONFIRM_SHINOBI_DEFENSE' },
    ]);
    expect(history.map((h) => h.label)).toEqual(['Declare attack', 'Confirm attacks', 'Assign defender', 'Confirm defenders']);
    expect(state.players.p1.frontRow[0]?.currentHP).toBe(3); // the trade happened

    // Back to defenders still being chosen, with the damage gone.
    const beforeDefense = history[3].state;
    expect(beforeDefense.shinobiCombat?.step).toBe('defend');
    expect(beforeDefense.shinobiCombat?.attacks[0].defenderId).toBe(d.id);
    expect(beforeDefense.players.p1.frontRow[0]?.currentHP).toBe(5);
    expect(history[0].state).toBe(d.state);
  });

  it('takes every game action but not the settings', () => {
    expect(undoLabelFor({ type: 'PASS_TURN' })).toBe('Pass turn');
    expect(undoLabelFor({ type: 'ADJUST_PLAYER_HEALTH', player: 'p1', delta: -1 })).toBe('Health change');
    expect(undoLabelFor({ type: 'SET_OPTION', option: 'autoDraw', value: false })).toBeUndefined();
    expect(undoLabelFor({ type: 'SET_RULES', rules: 'strict' })).toBeUndefined();
  });

  it("doesn't spend a step on a blocked action", () => {
    const s = { ...freshMain1(), ruleset: 'prototype' as const, phase: 'Combat' as const };
    const blocked = gameReducer(s, { type: 'DECLARE_SHINOBI_ATTACK', attackerId: 'nobody', targetId: 'p2-deidara' });
    expect(recordUndo([], { type: 'DECLARE_SHINOBI_ATTACK', attackerId: 'nobody', targetId: 'p2-deidara' }, s, blocked)).toEqual([]);
  });

  it('keeps the most recent actions when the history is full', () => {
    let history: UndoEntry[] = [];
    const s = freshMain1();
    for (let i = 0; i < UNDO_LIMIT + 5; i++) history = recordUndo(history, { type: 'ADJUST_PLAYER_HEALTH', player: 'p1', delta: i }, s, { ...s, turn: i + 1 });
    expect(history).toHaveLength(UNDO_LIMIT);
  });
});
