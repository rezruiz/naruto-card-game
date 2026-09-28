// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StagedPanel } from '../../src/ui/components/StagedPanel';
import { freshMain1 } from '../engine/testUtils';
import type { GameState, StagedAction } from '../../src/engine/types';

const attack: StagedAction = {
  id: 's1',
  owner: 'p1',
  kind: 'ability',
  sourceInstanceId: 'p1-kakuzu',
  abilityId: 'earth-grudge-fear',
  label: 'Kakuzu: Earth Grudge Fear',
  targets: ['p2-hidan'],
  payFromPool: 0,
  warnings: [],
};
const response: StagedAction = { ...attack, id: 's2', owner: 'p2', label: 'Substitution', targets: [], warnings: ['Not enough generic Chakra available.'] };

const base = (patch: Partial<GameState>): GameState => ({ ...freshMain1(), rules: 'trust', ...patch });

describe('StagedPanel', () => {
  afterEach(cleanup);

  it('shows the queue in resolution order, with edit controls only on your own items and a warning on the flagged one', () => {
    const dispatch = vi.fn();
    render(<StagedPanel state={base({ staged: [attack, response] })} myPlayerId="p2" dispatch={dispatch} onRetarget={() => {}} canRetarget={() => true} />);

    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent).toContain('Kakuzu: Earth Grudge Fear');
    expect(items[1].textContent).toContain('Substitution');
    expect(items[1].textContent).toMatch(/Not legal under the strict rules/);
    expect(items[0].querySelector('button')).toBeNull(); // p1's item — not editable by p2
    fireEvent.click(items[1].querySelector('button[title^="Resolve earlier"]')!);
    expect(dispatch).toHaveBeenCalledWith({ type: 'MOVE_STAGED', stagedId: 's2', direction: 'earlier' });
  });

  it('prompts only the player being waited on, who can OK; the finalizer can reopen', () => {
    const dispatch = vi.fn();
    const state = base({ staged: [attack], pendingFinalize: { by: 'p1', advance: false, approvals: ['p1'] } });

    const { unmount } = render(<StagedPanel state={state} myPlayerId="p2" dispatch={dispatch} onRetarget={() => {}} canRetarget={() => false} />);
    fireEvent.click(screen.getByRole('button', { name: /OK — no response/ }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'APPROVE_RESOLVE', player: 'p2' });
    expect(screen.queryByRole('button', { name: /reopen/i })).toBeNull();
    unmount();

    render(<StagedPanel state={state} myPlayerId="p1" dispatch={dispatch} onRetarget={() => {}} canRetarget={() => false} />);
    expect(screen.queryByRole('button', { name: /OK — no response/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /reopen/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'CANCEL_FINALIZE', player: 'p1' });
  });

  it('gives only the active player the Resolve / Finalize buttons', () => {
    const dispatch = vi.fn();
    const state = base({});
    const { unmount } = render(<StagedPanel state={state} myPlayerId="p2" dispatch={dispatch} onRetarget={() => {}} canRetarget={() => false} />);
    expect(screen.queryByRole('button', { name: /finalize/i })).toBeNull();
    unmount();
    render(<StagedPanel state={state} myPlayerId="p1" dispatch={dispatch} onRetarget={() => {}} canRetarget={() => false} />);
    fireEvent.click(screen.getByRole('button', { name: /finalize main1 phase/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'FINALIZE_PHASE', player: 'p1' });
  });
});
