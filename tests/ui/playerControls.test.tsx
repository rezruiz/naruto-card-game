// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CharacterDetailsModal } from '../../src/ui/components/CharacterDetailsModal';
import { HandView } from '../../src/ui/components/HandView';
import { freshMain1, giveChakra } from '../engine/testUtils';
import type { GameState, HandEntry } from '../../src/engine/types';

// The player-facing controls for the core rules actions: Retreat / Return, Pool, Discard for Chakra, and playing a drawn Character (with its Reinforcement Tax).
const noop = () => {};

function modal(state: GameState, id: string, handlers: Partial<Record<'onRetreat' | 'onReturnFromRetreat' | 'onPool', (...a: never[]) => void>> = {}) {
  return render(
    <CharacterDetailsModal
      state={state}
      instanceId={id}
      canAct
      onClose={noop}
      onPool={(handlers.onPool as never) ?? noop}
      onActivate={noop}
      onRetreat={(handlers.onRetreat as never) ?? noop}
      onReturnFromRetreat={(handlers.onReturnFromRetreat as never) ?? noop}
    />,
  );
}

describe('character popup controls', () => {
  afterEach(cleanup);

  it('offers Retreat with its rank-scaled cost, and dispatches it', () => {
    const onRetreat = vi.fn();
    modal(freshMain1(), 'p1-kakuzu', { onRetreat }); // A rank -> 3
    fireEvent.click(screen.getByRole('button', { name: /retreat \(3 chakra\)/i }));
    expect(onRetreat).toHaveBeenCalledWith('p1-kakuzu');
  });

  it('shows cost 2 for a B-rank character and 1 for C', () => {
    modal(freshMain1(), 'p1-hidan'); // B rank
    expect(screen.getByRole('button', { name: /retreat \(2 chakra\)/i })).toBeTruthy();
  });

  it('a Retreated character offers Return from Retreat (free) instead, and no abilities', () => {
    const base = freshMain1();
    const retreated: GameState = {
      ...base,
      players: { ...base.players, p1: { ...base.players.p1, backRow: base.players.p1.backRow.map((c) => (c ? { ...c, status: { ...c.status, retreated: true } } : c)) } },
    };
    const onReturn = vi.fn();
    modal(retreated, 'p1-kakuzu', { onReturnFromRetreat: onReturn });
    expect(screen.queryByRole('button', { name: /^retreat/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^activate/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /return from retreat/i }));
    expect(onReturn).toHaveBeenCalledWith('p1-kakuzu');
  });

  it('pools 1 or all the available Chakra that fits, and only when there is some', () => {
    const onPool = vi.fn();
    const { unmount } = modal(giveChakra(freshMain1(), 'p1', 0), 'p1-hidan');
    expect((screen.getByRole('button', { name: 'Pool 1 Chakra' }) as HTMLButtonElement).disabled).toBe(true);
    unmount();

    modal(giveChakra(freshMain1(), 'p1', 4), 'p1-deidara', { onPool }); // capacity 3, 4 available -> fits 3
    fireEvent.click(screen.getByRole('button', { name: 'Pool 1 Chakra' }));
    expect(onPool).toHaveBeenLastCalledWith('p1-deidara', 1);
    fireEvent.click(screen.getByRole('button', { name: 'Pool 3' }));
    expect(onPool).toHaveBeenLastCalledWith('p1-deidara', 3);
  });
});

describe('hand controls', () => {
  afterEach(cleanup);

  const hand: HandEntry[] = [
    { kind: 'card', instanceId: 'c1', defId: 'substitution' },
    { kind: 'character', instanceId: 'h1', entryId: 'yahiko' },
  ];
  const props = {
    hand,
    canPlace: true,
    canAct: true,
    alreadyPlacedThisTurn: false,
    pendingCardInstanceId: null,
    onStartPlayCard: noop,
    onOpenDetails: noop,
  };

  it('shows the Reinforcement Tax on a Character card and plays it', () => {
    const onPlayCharacter = vi.fn();
    render(
      <HandView
        {...props}
        onPlaceChakraSource={noop}
        onPlayCharacter={onPlayCharacter}
        characterPlay={() => ({ label: 'Play (5 Chakra)', hint: 'Reinforcement Tax', disabled: false })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Play (5 Chakra)' }));
    expect(onPlayCharacter).toHaveBeenCalledWith('h1');
  });

  it('disables the Play button, with the reason, when there is no room on the board', () => {
    render(
      <HandView
        {...props}
        onPlaceChakraSource={noop}
        onPlayCharacter={noop}
        characterPlay={() => ({ label: 'Play (3 Chakra)', hint: '', disabled: true, reason: 'Your back row is full (5 characters).' })}
      />,
    );
    const button = screen.getByRole('button', { name: 'Play (3 Chakra)' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.title).toMatch(/back row is full/);
  });

  it('discards a hand card for Chakra, and blocks a second placement in a turn when the game says it was already placed', () => {
    const onPlace = vi.fn();
    const { rerender } = render(<HandView {...props} onPlaceChakraSource={onPlace} onPlayCharacter={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /discard for chakra/i }));
    expect(onPlace).toHaveBeenCalledWith('c1');
    rerender(<HandView {...props} alreadyPlacedThisTurn onPlaceChakraSource={onPlace} onPlayCharacter={noop} />);
    expect((screen.getByRole('button', { name: /discard for chakra/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
