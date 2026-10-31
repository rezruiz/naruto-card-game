// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ShinobiCombatPanel } from '../../src/ui/components/ShinobiCombatPanel';
import { makeThirdKazekage } from '../../src/engine/characters';
import { placeToken } from '../../src/engine/board';
import { freshMain1 } from '../engine/testUtils';
import type { GameState, TokenInstance } from '../../src/engine/types';

function setup(): { state: GameState; attackerId: string; kazekageId: string } {
  const base: GameState = { ...freshMain1(), ruleset: 'prototype', phase: 'Combat' };
  const attacker: TokenInstance = {
    instanceId: 'p1-jonin',
    defId: 'shinobi-rain-genin',
    owner: 'p1',
    name: 'Jonin',
    maxHP: 5,
    currentHP: 5,
    ownerCharacterInstanceId: '',
    status: { disabled: false, retreated: false, enteredTurn: 0, hasAmbush: false, usedAbilitiesThisTurn: [], pooledThisTurn: false },
    extra: { shinobi: true, shinobiDamage: 3 },
  };
  const kazekage = makeThirdKazekage('p2', 'p2-deidara');
  return { state: placeToken(placeToken(base, 'p1', attacker), 'p2', kazekage), attackerId: attacker.instanceId, kazekageId: kazekage.instanceId };
}

describe('Shinobi combat panel with Third Kazekage', () => {
  afterEach(cleanup);

  it('offers it as an attack target, shown with its stats', () => {
    const { state } = setup();
    render(<ShinobiCombatPanel state={state} isMyBoard={() => true} dispatch={vi.fn()} />);
    expect(screen.getByRole('option', { name: 'Third Kazekage (0/6)' })).toBeTruthy();
  });

  it('offers it as a defender, and assigning it dispatches the block', () => {
    const { state, attackerId, kazekageId } = setup();
    const dispatch = vi.fn();
    const defending: GameState = { ...state, shinobiCombat: { step: 'defend', attacks: [{ attackerId, targetId: 'p2-deidara' }] } };
    render(<ShinobiCombatPanel state={defending} isMyBoard={() => true} dispatch={dispatch} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: kazekageId } });
    expect(dispatch).toHaveBeenCalledWith({ type: 'ASSIGN_SHINOBI_DEFENDER', attackerId, defenderId: kazekageId });
  });
});
