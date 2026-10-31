// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CharacterCard } from '../../src/ui/components/CharacterCard';
import { TokenCard } from '../../src/ui/components/TokenCard';
import { TRACKED_EFFECT_LABELS, trackedInfo } from '../../src/ui/effectInfo';
import { makeThirdKazekage } from '../../src/engine/characters';
import { placeToken } from '../../src/engine/board';
import { makeHandCardInstance } from '../../src/engine/deck';
import { gameReducer } from '../../src/engine/reducer';
import { freshMain1 } from '../engine/testUtils';
import type { CharacterInstance, GameState } from '../../src/engine/types';

const noop = () => {};

function leader(state: GameState): CharacterInstance {
  return state.players.p1.backRow.find((c) => c?.instanceId === 'p1-hidan')!;
}

function card(state: GameState, props: { onOpenDetails?: () => void; onOpenInfo?: () => void; isTargetable?: boolean; onClickAsTarget?: () => void }) {
  return render(<CharacterCard character={leader(state)} state={state} isTargetable={props.isTargetable ?? false} onClickAsTarget={props.onClickAsTarget ?? noop} onOpenDetails={props.onOpenDetails ?? noop} onOpenInfo={props.onOpenInfo} />);
}

const poisoned = (s: GameState): GameState => ({ ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c) => (c?.instanceId === 'p1-hidan' ? { ...c, extra: { ...c.extra, poisonCounters: 3 } } : c)) } } });

describe('clicking an effect on a unit', () => {
  afterEach(cleanup);

  it('opens that effect, not the unit', () => {
    const onOpenInfo = vi.fn();
    const onOpenDetails = vi.fn();
    card(poisoned(freshMain1()), { onOpenInfo, onOpenDetails });
    fireEvent.click(screen.getByText('Poison: 3'));
    expect(onOpenDetails).not.toHaveBeenCalled();
    expect(onOpenInfo.mock.calls[0][0]).toMatchObject({ name: 'Poison', subtitle: 'Hidan: 3' });
    expect(onOpenInfo.mock.calls[0][0].text).toMatch(/loses 1 Poison counter/);
  });

  it('opens a Style too, and the rest of the card still opens the unit', () => {
    const onOpenInfo = vi.fn();
    const onOpenDetails = vi.fn();
    card(freshMain1(), { onOpenInfo, onOpenDetails });
    fireEvent.click(screen.getByText('Ritual'));
    expect(onOpenInfo.mock.calls[0][0].name).toBe('Ritual Style');
    fireEvent.click(screen.getByText('Hidan'));
    expect(onOpenDetails).toHaveBeenCalledWith('p1-hidan');
  });

  it('opens Equipment text', () => {
    const base: GameState = { ...freshMain1(), ruleset: 'prototype' };
    const pouch = makeHandCardInstance('equip-chakra-scroll');
    const p = base.players.p1;
    const withCard = { ...base, players: { ...base.players, p1: { ...p, suppliesSpent: -20, hand: [...p.hand, { kind: 'card' as const, instanceId: pouch.instanceId, defId: 'equip-chakra-scroll' }] } } };
    const s = gameReducer(withCard, { type: 'PLAY_HAND_CARD', instanceId: pouch.instanceId, enablingInstanceId: '', targetInstanceIds: ['p1-hidan'], payFromPool: 0 });
    const onOpenInfo = vi.fn();
    card(s, { onOpenInfo });
    fireEvent.click(screen.getByText('Chakra Storage Scroll'));
    expect(onOpenInfo.mock.calls[0][0]).toMatchObject({ name: 'Chakra Storage Scroll', subtitle: 'Equipment on Hidan' });
    expect(onOpenInfo.mock.calls[0][0].text).toBeTruthy();
  });

  it('selects the unit instead while it is being targeted', () => {
    const onOpenInfo = vi.fn();
    const onClickAsTarget = vi.fn();
    card(poisoned(freshMain1()), { onOpenInfo, onClickAsTarget, isTargetable: true });
    fireEvent.click(screen.getByText('Poison: 3'));
    expect(onOpenInfo).not.toHaveBeenCalled();
    expect(onClickAsTarget).toHaveBeenCalledWith('p1-hidan');
  });

  it("opens a token's listed ability", () => {
    const base: GameState = { ...freshMain1(), ruleset: 'prototype' };
    const token = makeThirdKazekage('p1', 'p1-hidan');
    const s = placeToken(base, 'p1', token);
    const onOpenInfo = vi.fn();
    const onOpenDetails = vi.fn();
    render(<TokenCard token={s.players.p1.frontRow.find((t) => t?.instanceId === token.instanceId)!} state={s} isTargetable={false} onClickAsTarget={noop} onOpenDetails={onOpenDetails} onOpenInfo={onOpenInfo} />);
    fireEvent.click(screen.getByText('Iron Sand Barrage'));
    expect(onOpenDetails).not.toHaveBeenCalled();
    expect(onOpenInfo.mock.calls[0][0]).toMatchObject({ name: 'Iron Sand Barrage', text: 'Deal 3 damage.' });
  });
});

describe('effect text', () => {
  it('covers every effect a card can show, from a real source', () => {
    const source = readFileSync('src/engine/characters/progressText.ts', 'utf8');
    const shown = [...source.matchAll(/label: (?:'([^']+)'|"([^"]+)"),[^\n]*key: (?:true|!!v)/g)].map((m) => m[1] ?? m[2]);
    expect(shown.length).toBeGreaterThan(30);
    expect(shown.filter((label) => !TRACKED_EFFECT_LABELS.has(label))).toEqual([]);
    for (const label of TRACKED_EFFECT_LABELS) {
      expect(trackedInfo({ label, value: 'VALUE' }, 'Unit').text, label).not.toBe('VALUE');
    }
  });
});
