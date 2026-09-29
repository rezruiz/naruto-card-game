import { describe, expect, it } from 'vitest';
import { cardStage, newPendingCard } from '../../src/ui/cardFlow';
import type { HandCardDef } from '../../src/engine/cards/registry';

function def(overrides: Partial<HandCardDef>): HandCardDef {
  return {
    id: 'x',
    name: 'X',
    cardType: 'jutsu',
    cost: 1,
    speed: 'Normal',
    style: 'None',
    type: 'Ninjutsu',
    resolve: (ctx) => ctx.state,
    ...overrides,
  };
}

describe('cardStage (the enabler -> pool-discount -> target(s) -> amount pipeline)', () => {
  it('an untargeted, non-assist, no-discount card is ready as soon as an enabler is picked', () => {
    const p0 = newPendingCard('p1', 'c1', def({ maxTargets: 0 }));
    expect(cardStage(p0)).toBe('enabler');
    const p1 = { ...p0, enablingInstanceId: 'p1-kakuzu' };
    expect(cardStage(p1)).toBe('ready');
  });

  it('an Assist card skips the enabler stage entirely', () => {
    const p0 = newPendingCard('p1', 'c1', def({ cardType: 'assist', maxTargets: 0 }));
    expect(cardStage(p0)).toBe('ready');
  });

  it('Terrain, Mission and Type: None Jutsu cards skip the enabler stage too — only technique Jutsu need one', () => {
    for (const overrides of [{ cardType: 'terrain' as const }, { cardType: 'mission' as const }, { type: 'None' as const }]) {
      expect(cardStage(newPendingCard('p1', 'c1', def({ ...overrides, maxTargets: 0 })))).toBe('ready');
    }
  });

  it('a pool-discount card inserts a payFromPool stage after the enabler, before any targets', () => {
    const p0 = newPendingCard('p1', 'c1', def({ offersPoolDiscount: true, maxTargets: 0 }));
    expect(cardStage(p0)).toBe('enabler');
    const p1 = { ...p0, enablingInstanceId: 'p1-kakuzu' };
    expect(cardStage(p1)).toBe('payFromPool');
    const p2 = { ...p1, payFromPool: 0 };
    expect(cardStage(p2)).toBe('ready');
  });

  it('collects targets one at a time up to maxTargets, then needs an amount before it is ready', () => {
    const p0 = newPendingCard('p1', 'c1', def({ maxTargets: 2, needsAmountChoice: true }));
    const p1 = { ...p0, enablingInstanceId: 'p1-kakuzu' };
    expect(cardStage(p1)).toBe('target');
    const p2 = { ...p1, targets: ['a'] };
    expect(cardStage(p2)).toBe('target');
    const p3 = { ...p2, targets: ['a', 'b'] };
    expect(cardStage(p3)).toBe('amount');
    const p4 = { ...p3, amount: 3 };
    expect(cardStage(p4)).toBe('ready');
  });

  it('targetsConfirmed lets an optional 2nd target be skipped without waiting for maxTargets', () => {
    const p0 = newPendingCard('p1', 'c1', def({ maxTargets: 2 }));
    const p1 = { ...p0, enablingInstanceId: 'p1-kakuzu', targets: ['a'] };
    expect(cardStage(p1)).toBe('target');
    const p2 = { ...p1, targetsConfirmed: true };
    expect(cardStage(p2)).toBe('ready');
  });
});
