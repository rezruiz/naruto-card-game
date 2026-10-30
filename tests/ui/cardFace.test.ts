import { describe, expect, it } from 'vitest';
import { handCardSummary } from '../../src/ui/cardDisplay';
import { getHandCardDef } from '../../src/engine/cards/registry';
import '../../src/engine/cards';

describe('card face text', () => {
  it("leaves out the cost (the gem shows it) and a Shinobi's Damage/Health (the stat icons show them)", () => {
    expect(handCardSummary(getHandCardDef('shinobi-rain-jonin')!)).toBe('');
    expect(handCardSummary(getHandCardDef('shinobi-amegakure-civilian-rebel')!)).toBe('+1 Damage while you have Yahiko in play.');
    for (const id of ['reconnaissance', 'fireball-jutsu', 'unshakable-resolve']) expect(handCardSummary(getHandCardDef(id)!)).not.toMatch(/Cost:/);
  });
});
