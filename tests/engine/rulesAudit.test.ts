import { describe, expect, it } from 'vitest';
import { gameReducer } from '../../src/engine/reducer';
import { payUpkeep, previewUpkeep, upkeepReminderText } from '../../src/engine/upkeep';
import { missionProgressText } from '../../src/engine/cards/missions';
import { dealDamage } from '../../src/engine/combat';
import { applyPoison } from '../../src/engine/poison';
import { registerCharacter } from '../../src/engine/characters/registry';
import { makeHandCardInstance } from '../../src/engine/deck';
import { createSetupState } from '../../src/engine/state';
import { freshCombat, freshMain1, giveChakra, resolveTop, withCharacterAt } from './testUtils';
import type { GameAction, GameState, PlayerId } from '../../src/engine/types';

// Rules-audit suite: each block pins a rule from design/SPEC.md (section noted) against the strict-mode engine.

// Neutral test characters (no Synergy, no passives) so the base tables can be checked without discounts.
for (const rank of ['C', 'B', 'A', 'S'] as const) {
  registerCharacter({ id: `t-${rank}`, name: `Test ${rank}`, rank, baseMaxHP: 9, basePoolCapacity: 6, styles: ['Fire'], abilities: [] });
}
registerCharacter({
  id: 't-hitter',
  name: 'Test Hitter',
  rank: 'C',
  baseMaxHP: 9,
  basePoolCapacity: 6,
  styles: ['Fire'],
  abilities: [
    { id: 'hit', name: 'Hit', cost: 3, speed: 'Normal', style: 'None', type: 'Taijutsu', isDamaging: true, resolve: (ctx) => dealDamage(ctx.state, ctx.targetInstanceIds[0], 1).state },
    { id: 'buff', name: 'Buff', cost: 1, speed: 'Normal', style: 'None', type: 'Ninjutsu', maxTargets: 0, resolve: (ctx) => ctx.state },
    { id: 'fire', name: 'Fire Only', cost: 1, speed: 'Normal', style: 'Water', type: 'Ninjutsu', maxTargets: 0, resolve: (ctx) => ctx.state },
    { id: 'quick-hit', name: 'Quick Hit', cost: 0, speed: 'Quick', style: 'None', type: 'Ninjutsu', maxTargets: 0, resolve: (ctx) => ctx.state },
  ],
});

const run = (s: GameState, ...actions: GameAction[]) => actions.reduce((acc, a) => gameReducer(acc, a), s);
const untapped = (s: GameState, p: PlayerId) => s.players[p].chakraSources.filter((x) => !x.tapped).length;
const sources = (s: GameState, p: PlayerId, n: number): GameState => ({
  ...s,
  players: { ...s.players, [p]: { ...s.players[p], chakraSources: Array.from({ length: n }, () => ({ tapped: false })) } },
});
const setBack = (s: GameState, p: PlayerId, defs: (string | null)[]): GameState => {
  let next = s;
  defs.forEach((d, i) => {
    if (d) next = withCharacterAt(next, p, i, d);
    else next = { ...next, players: { ...next.players, [p]: { ...next.players[p], backRow: next.players[p].backRow.map((c, j) => (j === i ? null : c)) } } };
  });
  return { ...next, players: { ...next.players, [p]: { ...next.players[p], startingCharacterInstanceId: 'no-starting-character' } } };
};
const char = (s: GameState, p: PlayerId, id: string) => s.players[p].backRow.find((c) => c?.instanceId === id)!;
const patchChar = (s: GameState, p: PlayerId, id: string, f: (c: NonNullable<GameState['players'][PlayerId]['backRow'][number]>) => object): GameState => ({
  ...s,
  players: { ...s.players, [p]: { ...s.players[p], backRow: s.players[p].backRow.map((c) => (c?.instanceId === id ? ({ ...c, ...f(c) } as typeof c) : c)) } },
});
const toPhase = (s: GameState, phase: string) => {
  let n = s;
  while (n.phase !== phase) n = gameReducer(n, { type: 'ADVANCE_PHASE' });
  return n;
};
const cleared = (s: GameState) => giveChakra(s, 'p1', 0);

describe('§4.2/§6.5 Upkeep', () => {
  const only = (defs: string[]) => setBack(freshMain1(), 'p1', [...defs, ...Array(5 - defs.length).fill(null)]);

  it('charges the per-rank table: C 0, B 1, A 2, S 3 — tapped from untapped sources', () => {
    for (const [rank, cost] of [['C', 0], ['B', 1], ['A', 2], ['S', 3]] as const) {
      const s = payUpkeep(sources(only([`t-${rank}`]), 'p1', 5), 'p1');
      expect(5 - untapped(s, 'p1'), rank).toBe(cost);
      expect(s.players.p1.backRow[0]!.status.disabled).toBe(false);
    }
  });

  it('pays highest cost first; what cannot be paid is Disabled, and cheaper characters still get paid', () => {
    // S(3), A(2), B(1) with 3 sources: S paid, then nothing left.
    let s = payUpkeep(sources(only(['t-B', 't-A', 't-S']), 'p1', 3), 'p1');
    expect(char(s, 'p1', 'p1-t-S').status.disabled).toBe(false);
    expect(char(s, 'p1', 'p1-t-A').status.disabled).toBe(true);
    expect(char(s, 'p1', 'p1-t-B').status.disabled).toBe(true);
    // With 2 sources S is unaffordable, so A is paid; B is then unaffordable.
    s = payUpkeep(sources(only(['t-B', 't-A', 't-S']), 'p1', 2), 'p1');
    expect(char(s, 'p1', 'p1-t-S').status.disabled).toBe(true);
    expect(char(s, 'p1', 'p1-t-A').status.disabled).toBe(false);
    expect(char(s, 'p1', 'p1-t-B').status.disabled).toBe(true);
  });

  it('asks the player which of several characters TIED at the cost where Chakra runs out to pay — never picks for them', () => {
    // Two A(2)s and a B(1), 3 sources: only one A can be paid → a choice between the two As; then the B takes the last source.
    let s = only(['t-A', 't-A', 't-B']);
    // Both As share an id from the helper — give the second its own.
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c, i) => (i === 1 && c ? { ...c, instanceId: 'p1-t-A-2' } : c)) } } };
    s = payUpkeep(sources(s, 'p1', 3), 'p1');
    const choice = s.pendingChoices[0];
    expect(choice).toBeDefined();
    expect(choice.player).toBe('p1');
    expect(choice.min).toBe(1);
    expect(choice.options).toHaveLength(2);
    const [first, second] = s.players.p1.backRow.filter((c) => c?.defId === 't-A').map((c) => c!.instanceId);
    s = gameReducer(s, { type: 'RESOLVE_CHOICE', choiceId: choice.id, optionIds: [second] });
    expect(s.pendingChoices).toHaveLength(0);
    expect(s.players.p1.backRow.find((c) => c?.instanceId === second)!.status.disabled).toBe(false);
    expect(s.players.p1.backRow.find((c) => c?.instanceId === first)!.status.disabled).toBe(true);
    expect(s.players.p1.backRow.find((c) => c?.defId === 't-B')!.status.disabled).toBe(false);
    expect(untapped(s, 'p1')).toBe(0);
  });

  it('is mandatory when affordable, and leftover sources stay untapped for the rest of the turn', () => {
    const s = payUpkeep(sources(only(['t-A']), 'p1', 5), 'p1');
    expect(untapped(s, 'p1')).toBe(3);
    expect(s.players.p1.genericChakraAvailable).toBe(0); // upkeep Chakra never lands in the spendable pool
  });

  it('un-Disables a character as soon as its upkeep is paid in a later Upkeep', () => {
    let s = payUpkeep(sources(only(['t-A']), 'p1', 0), 'p1');
    expect(s.players.p1.backRow[0]!.status.disabled).toBe(true);
    s = payUpkeep(sources(s, 'p1', 2), 'p1');
    expect(s.players.p1.backRow[0]!.status.disabled).toBe(false);
  });

  it('reduces upkeep by 1 per other character sharing a Synergy tag, floor 0 (Kakuzu + Hidan are both Akatsuki)', () => {
    const s = payUpkeep(sources(setBack(freshMain1(), 'p1', ['kakuzu', 'hidan', null, null, null]), 'p1', 5), 'p1');
    // Kakuzu A(2) -1 = 1; Hidan B(1) -1 = 0.
    expect(5 - untapped(s, 'p1')).toBe(1);
  });

  it("gives the starting character its own treatment: C +2 pooled, B +1 pooled, A free, S costs 2 — and it doesn't transfer", () => {
    for (const [rank, poolGain, cost] of [['C', 2, 0], ['B', 1, 0], ['A', 0, 0], ['S', 0, 2]] as const) {
      let s = only([`t-${rank}`]);
      s = { ...s, players: { ...s.players, p1: { ...s.players.p1, startingCharacterInstanceId: `p1-t-${rank}` } } };
      s = payUpkeep(sources(s, 'p1', 5), 'p1');
      expect(s.players.p1.backRow[0]!.chakraPool.current, rank).toBe(poolGain);
      expect(5 - untapped(s, 'p1'), rank).toBe(cost);
    }
    // A replacement (a different instance) is charged the normal table even if the starting character is gone.
    let s = only(['t-A']);
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, startingCharacterInstanceId: 'p1-gone' } } };
    expect(5 - untapped(payUpkeep(sources(s, 'p1', 5), 'p1'), 'p1')).toBe(2);
  });
});

describe('§6.5a Disabled', () => {
  it('cannot activate abilities or enable a hand card, but is still a valid, damageable target', () => {
    let s = giveChakra(setBack(freshMain1(), 'p1', ['t-hitter', null, null, null, null]), 'p1', 5);
    s = patchChar(s, 'p1', 'p1-t-hitter', (c) => ({ status: { ...c.status, disabled: true } }));
    const attempt = run(s, { type: 'ACTIVATE_ABILITY', instanceId: 'p1-t-hitter', abilityId: 'buff', targetInstanceIds: [], payFromPool: 0 });
    expect(attempt.stack).toHaveLength(0);
    expect(attempt.log.at(-1)!.text).toMatch(/Disabled/);

    const card = makeHandCardInstance('field-intelligence');
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, hand: [{ kind: 'card', ...card }] } } };
    const played = run(s, { type: 'PLAY_HAND_CARD', instanceId: card.instanceId, enablingInstanceId: 'p1-t-hitter', targetInstanceIds: [], payFromPool: 0 });
    expect(played.stack).toHaveLength(0);

    // Targetable and damageable by the opponent.
    const hit = dealDamage(s, 'p1-t-hitter', 2).state;
    expect(char(hit, 'p1', 'p1-t-hitter').currentHP).toBe(7);
  });

  it("does not trigger passives: Hidan's End-Phase regen is skipped while Disabled", () => {
    const base = patchChar(freshMain1(), 'p1', 'p1-hidan', (c) => ({ currentHP: 3, status: { ...c.status } }));
    const regen = (disabled: boolean) => {
      const s = patchChar(base, 'p1', 'p1-hidan', (c) => ({ status: { ...c.status, disabled } }));
      return char(toPhase(s, 'End'), 'p1', 'p1-hidan').currentHP;
    };
    expect(regen(false)).toBe(4);
    expect(regen(true)).toBe(3);
  });
});

describe('§6.5a Disabled: defeat-replacement passives still apply', () => {
  it("Kakuzu's Five Hearts still revives him while he is Disabled", () => {
    const disabled = patchChar(freshMain1(), 'p1', 'p1-kakuzu', (c) => ({ status: { ...c.status, disabled: true } }));
    const hit = dealDamage(disabled, 'p1-kakuzu', 99, { cannotBeReduced: true }).state;
    const kakuzu = hit.players.p1.backRow[0];
    expect(kakuzu).not.toBeNull();
    expect(kakuzu!.extra.hearts).toBe(4); // lost 1 Heart and revived instead of being defeated
  });
});

describe('§5.2 Chakra sources', () => {
  const withHand = (s: GameState) => {
    const cards = [makeHandCardInstance('substitution'), makeHandCardInstance('explosive-tag')];
    return { s: { ...s, players: { ...s.players, p1: { ...s.players.p1, hand: cards.map((c) => ({ kind: 'card' as const, ...c })) } } }, cards };
  };

  it('places one per turn (across both Main Phases), only in a Main Phase, consuming the hand card', () => {
    const { s, cards } = withHand(freshMain1());
    let next = run(s, { type: 'PLACE_CHAKRA_SOURCE', instanceId: cards[0].instanceId });
    expect(next.players.p1.chakraSources).toHaveLength(1);
    expect(next.players.p1.consumedPile).toHaveLength(1);
    expect(next.players.p1.hand).toHaveLength(1);

    next = run(next, { type: 'PLACE_CHAKRA_SOURCE', instanceId: cards[1].instanceId }); // second this turn
    expect(next.players.p1.chakraSources).toHaveLength(1);
    next = run(toPhase(next, 'Main2'), { type: 'PLACE_CHAKRA_SOURCE', instanceId: cards[1].instanceId }); // still the same turn
    expect(next.players.p1.chakraSources).toHaveLength(1);

    const inCombat = run(toPhase(s, 'Combat'), { type: 'PLACE_CHAKRA_SOURCE', instanceId: cards[0].instanceId });
    expect(inCombat.players.p1.chakraSources).toHaveLength(0);
  });

  it('untaps at your Untap Phase; unspent generic Chakra is lost at end of turn, including the opponent\'s', () => {
    let s = sources(freshMain1(), 'p1', 2);
    s = run(s, { type: 'TAP_CHAKRA_SOURCE', sourceIndex: 0 }, { type: 'TAP_CHAKRA_SOURCE', sourceIndex: 1 });
    expect(s.players.p1.genericChakraAvailable).toBe(2);
    s = giveChakra(s, 'p2', 3); // tapped on p1's turn to respond and never spent
    s = toPhase(s, 'Untap'); // wraps: p1's End Phase passes, p2's turn begins
    expect(s.players.p1.genericChakraAvailable).toBe(0);
    expect(s.players.p2.genericChakraAvailable).toBe(0);
    expect(untapped(s, 'p1')).toBe(0); // p1's sources untap on p1's own Untap, not p2's
    s = toPhase(gameReducer(s, { type: 'ADVANCE_PHASE' }), 'Untap'); // ...through p2's turn to p1's next Untap
    expect(untapped(s, 'p1')).toBe(2);
  });
});

describe('§5.3 Pooling', () => {
  const setup = () => giveChakra(setBack(freshMain1(), 'p1', ['t-hitter', 't-C', null, null, null]), 'p1', 5);
  const pool = (s: GameState, id: string, amount: number) => run(s, { type: 'POOL_CHAKRA', instanceId: id, amount });

  it('moves generic Chakra into the Pool, capped by remaining capacity, at sorcery speed only', () => {
    let s = pool(setup(), 'p1-t-hitter', 4);
    expect(char(s, 'p1', 'p1-t-hitter').chakraPool.current).toBe(4);
    expect(s.players.p1.genericChakraAvailable).toBe(1);
    s = pool(giveChakra(s, 'p1', 5), 'p1-t-hitter', 3); // only 2 room left
    expect(char(s, 'p1', 'p1-t-hitter').chakraPool.current).toBe(4);
    expect(pool(giveChakra(toPhase(setup(), 'Combat'), 'p1', 5), 'p1-t-hitter', 1).players.p1.backRow[0]!.chakraPool.current).toBe(0);
  });

  it('taps the character: pooled this turn => cannot act; acted this turn => cannot be pooled into', () => {
    let s = pool(setup(), 'p1-t-hitter', 1);
    const blocked = run(s, { type: 'ACTIVATE_ABILITY', instanceId: 'p1-t-hitter', abilityId: 'buff', targetInstanceIds: [], payFromPool: 0 });
    expect(blocked.stack).toHaveLength(0);
    // The reverse direction, using a different character that acts first.
    s = run(setup(), { type: 'ACTIVATE_ABILITY', instanceId: 'p1-t-hitter', abilityId: 'buff', targetInstanceIds: [], payFromPool: 0 });
    s = pool(giveChakra(resolveTop(s), 'p1', 5), 'p1-t-hitter', 1);
    expect(char(s, 'p1', 'p1-t-hitter').chakraPool.current).toBe(0);
    // A different, un-acted character can still be pooled into.
    expect(char(pool(s, 'p1-t-C', 1), 'p1', 'p1-t-C').chakraPool.current).toBe(1);
  });

  it('resets after your next Untap: a character pooled into last turn can act again', () => {
    let s = pool(setup(), 'p1-t-hitter', 1);
    s = toPhase(toPhase(s, 'Untap'), 'Main1'); // through p2's turn is not needed: two Untaps = p1's next turn
    s = toPhase(toPhase(s, 'Untap'), 'Main1');
    expect(s.activePlayer).toBe('p1');
    expect(char(s, 'p1', 'p1-t-hitter').status.pooledThisTurn).toBe(false);
  });
});

describe('§5.3/§8 Costs: generic Chakra vs a character\'s own Pool', () => {
  const setup = (generic: number, poolOnHitter = 0) =>
    patchChar(giveChakra(setBack(freshMain1(), 'p1', ['t-hitter', 't-C', null, null, null]), 'p1', generic), 'p1', 'p1-t-hitter', (c) => ({
      chakraPool: { ...c.chakraPool, current: poolOnHitter },
    }));
  const hit = (s: GameState, payFromPool: number) =>
    run(s, { type: 'ACTIVATE_ABILITY', instanceId: 'p1-t-hitter', abilityId: 'hit', targetInstanceIds: ['p2-hidan'], payFromPool });
  const combat = (s: GameState) => toPhase(s, 'Combat');

  it('pays entirely from generic Chakra', () => {
    const s = hit(combat(setup(3)), 0);
    expect(s.stack).toHaveLength(1);
    expect(s.players.p1.genericChakraAvailable).toBe(0);
  });

  it('pays entirely from the character\'s own Pool, or a split of both', () => {
    let s = hit(combat(setup(0, 3)), 3);
    expect(s.stack).toHaveLength(1);
    expect(char(s, 'p1', 'p1-t-hitter').chakraPool.current).toBe(0);
    s = hit(combat(setup(2, 1)), 1);
    expect(char(s, 'p1', 'p1-t-hitter').chakraPool.current).toBe(0);
    expect(s.players.p1.genericChakraAvailable).toBe(0);
  });

  it('rejects a cost that cannot be covered, and paying more from the Pool than it holds', () => {
    expect(hit(combat(setup(2)), 0).stack).toHaveLength(0);
    expect(hit(combat(setup(0, 1)), 3).stack).toHaveLength(0);
  });

  it("never lets one character's Pool pay for another's ability", () => {
    // The C character holds 5 pooled; the hitter has none and no generic Chakra.
    const s = patchChar(setup(0), 'p1', 'p1-t-C', (c) => ({ chakraPool: { ...c.chakraPool, current: 5 } }));
    expect(hit(combat(s), 3).stack).toHaveLength(0);
    expect(hit(combat(s), 0).stack).toHaveLength(0);
    expect(char(s, 'p1', 'p1-t-C').chakraPool.current).toBe(5);
  });

  it("a hand card can only be paid from the ENABLING character's Pool, not another's", () => {
    const card = makeHandCardInstance('field-intelligence'); // 1 Chakra, Style: None
    const base = (enabler: string) => {
      let s = setup(0);
      s = patchChar(s, 'p1', 'p1-t-C', (c) => ({ chakraPool: { ...c.chakraPool, current: 4 } }));
      s = { ...s, players: { ...s.players, p1: { ...s.players.p1, hand: [{ kind: 'card', ...card }] } } };
      return run(s, { type: 'PLAY_HAND_CARD', instanceId: card.instanceId, enablingInstanceId: enabler, targetInstanceIds: [], payFromPool: 1 });
    };
    expect(base('p1-t-C').stack).toHaveLength(1); // enabled by the character whose Pool pays
    expect(base('p1-t-hitter').stack).toHaveLength(0); // the hitter's Pool is empty; the other character's Pool can't stand in
  });

  it('a character needs the matching Style to enable a Style card', () => {
    const card = makeHandCardInstance('lightning-substitution'); // Style: Lightning
    let s = setup(9);
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, hand: [{ kind: 'card', ...card }] } } };
    const play = run(s, { type: 'PLAY_HAND_CARD', instanceId: card.instanceId, enablingInstanceId: 'p1-t-hitter', targetInstanceIds: [], payFromPool: 0 });
    expect(play.stack).toHaveLength(0);
    expect(play.log.at(-1)!.text).toMatch(/Style: Lightning/);
  });

  it("an ability's own Style is needed too", () => {
    const s = giveChakra(setup(5), 'p1', 5);
    const attempt = run(s, { type: 'ACTIVATE_ABILITY', instanceId: 'p1-t-hitter', abilityId: 'fire', targetInstanceIds: [], payFromPool: 0 });
    expect(attempt.stack).toHaveLength(0);
    expect(attempt.log.at(-1)!.text).toMatch(/Style: Water/);
  });
});

describe('§4.5/§9 once-per-turn limits and card timing', () => {
  const setup = () => giveChakra(setBack(freshMain1(), 'p1', ['t-hitter', null, null, null, null]), 'p1', 9);
  const buff = (s: GameState) => run(s, { type: 'ACTIVATE_ABILITY', instanceId: 'p1-t-hitter', abilityId: 'buff', targetInstanceIds: [], payFromPool: 0 });

  it('Normal-speed damage-dealing abilities are Combat-only; non-damaging (support) ones work in a Main Phase', () => {
    const hit = (st: GameState) => run(st, { type: 'ACTIVATE_ABILITY', instanceId: 'p1-t-hitter', abilityId: 'hit', targetInstanceIds: ['p2-hidan'], payFromPool: 0 });
    expect(hit(setup()).stack).toHaveLength(0); // Main Phase 1
    expect(hit(setup()).log.at(-1)!.text).toMatch(/Combat Phase/);
    expect(hit(toPhase(setup(), 'Main2')).stack).toHaveLength(0);
    expect(hit(toPhase(setup(), 'Combat')).stack).toHaveLength(1);
    expect(buff(setup()).stack).toHaveLength(1); // support ability, Main Phase, Normal speed
  });

  it('an ability cannot be used twice in a turn (unless its text says so), but can next turn', () => {
    let s = resolveTop(buff(setup()));
    expect(buff(s).stack).toHaveLength(0);
    expect(buff(s).log.at(-1)!.text).toMatch(/already used/);
    s = toPhase(toPhase(s, 'Untap'), 'Main1'); // p2's turn
    s = giveChakra(toPhase(toPhase(s, 'Untap'), 'Main1'), 'p1', 9); // p1's turn again
    expect(s.activePlayer).toBe('p1');
    expect(buff(s).stack).toHaveLength(1);
  });

  it("a Quick ability used on the opponent's turn doesn't burn your once-per-turn use on your own turn (and vice versa)", () => {
    const quick = (s: GameState) => run(s, { type: 'ACTIVATE_ABILITY', instanceId: 'p1-t-hitter', abilityId: 'quick-hit', targetInstanceIds: [], payFromPool: 0 });
    let s = resolveTop(quick(setup())); // used on p1's own turn
    s = toPhase(s, 'Combat');
    s = toPhase(s, 'Untap'); // p2's turn begins — a new turn
    expect(quick({ ...s, priorityPlayer: 'p1' }).stack).toHaveLength(1); // available again during p2's turn
  });

  it('Attack-type Jutsu: Combat Phase only, once per turn per named card; non-combat Normal cards: Main Phase only', () => {
    const tag = [makeHandCardInstance('explosive-tag'), makeHandCardInstance('explosive-tag')];
    const info = makeHandCardInstance('field-intelligence');
    let s = setup();
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, hand: [...tag, info].map((c) => ({ kind: 'card' as const, ...c })) } } };
    const playTag = (st: GameState, i: number) =>
      run(st, { type: 'PLAY_HAND_CARD', instanceId: tag[i].instanceId, enablingInstanceId: 'p1-t-hitter', targetInstanceIds: ['p2-hidan'], payFromPool: 0 });
    const playInfo = (st: GameState) => run(st, { type: 'PLAY_HAND_CARD', instanceId: info.instanceId, enablingInstanceId: 'p1-t-hitter', targetInstanceIds: [], payFromPool: 0 });

    expect(playTag(s, 0).stack).toHaveLength(0); // Main Phase: not allowed
    expect(playTag(s, 0).log.at(-1)!.text).toMatch(/Combat Phase/);
    expect(playInfo(toPhase(s, 'Combat')).stack).toHaveLength(0); // a non-combat Normal card (a draw effect) can't be played in Combat
    expect(playInfo(toPhase(s, 'Combat')).log.at(-1)!.text).toMatch(/Main Phase/);
    expect(playInfo(s).stack).toHaveLength(1); // ...but is fine in Main

    let c = toPhase(s, 'Combat');
    c = resolveTop(playTag(c, 0));
    const second = playTag(c, 1);
    expect(second.stack).toHaveLength(0);
    expect(second.log.at(-1)!.text).toMatch(/once per turn/);
  });
});

describe('Normal-speed card timing by kind', () => {
  const base = () => giveChakra(setBack(freshMain1(), 'p1', ['t-hitter', 't-C', null, null, null]), 'p1', 9);
  const play = (s: GameState, defId: string, targets: string[] = []) => {
    const card = makeHandCardInstance(defId);
    const withCard = { ...s, players: { ...s.players, p1: { ...s.players.p1, hand: [{ kind: 'card' as const, ...card }] } } };
    return run(withCard, { type: 'PLAY_HAND_CARD', instanceId: card.instanceId, enablingInstanceId: 'p1-t-hitter', targetInstanceIds: targets, payFromPool: 0 });
  };

  it('Terrain, Missions, and deck-search Jutsu: Main Phase only', () => {
    for (const id of ['akatsuki-hideout', 'unshakable-resolve', 'squad-formation', 'incoming-mission-assignment', 'battlefield-selection']) {
      expect(play(base(), id).log.at(-1)!.text, `${id} in Main`).not.toMatch(/Can't play/);
      const inCombat = play(toPhase(base(), 'Combat'), id);
      expect(inCombat.log.at(-1)!.text, `${id} in Combat`).toMatch(/Main Phase/);
    }
  });

  it("Deploy Medic Corps (a delayed heal that doesn't implicate combat) is Main Phase only", () => {
    const retreated = patchChar(base(), 'p1', 'p1-t-C', (c) => ({ status: { ...c.status, retreated: true } }));
    expect(play(retreated, 'deploy-medic-corps', ['p1-t-C']).stack).toHaveLength(1);
    const inCombat = play(toPhase(retreated, 'Combat'), 'deploy-medic-corps', ['p1-t-C']);
    expect(inCombat.stack).toHaveLength(0);
    expect(inCombat.log.at(-1)!.text).toMatch(/Main Phase/);
  });
});

describe('§6.5b Retreat', () => {
  const setup = () => giveChakra(setBack(freshMain1(), 'p1', ['t-hitter', 't-B', 't-A', 't-S', null]), 'p1', 9);
  const retreat = (s: GameState, id: string) => run(s, { type: 'RETREAT', instanceId: id });

  it('costs C 1 / B 2 / A 3 / S 3 Chakra (generic)', () => {
    for (const [id, cost] of [['p1-t-hitter', 1], ['p1-t-B', 2], ['p1-t-A', 3], ['p1-t-S', 3]] as const) {
      const s = retreat(setup(), id);
      expect(char(s, 'p1', id).status.retreated, id).toBe(true);
      expect(s.players.p1.genericChakraAvailable, id).toBe(9 - cost);
    }
    expect(retreat(giveChakra(setup(), 'p1', 2), 'p1-t-A').players.p1.backRow[2]!.status.retreated).toBe(false); // can't afford
  });

  it('is Main Phase only, refused for your only character, one that already acted, or a stunned one', () => {
    expect(char(retreat(toPhase(setup(), 'Combat'), 'p1-t-A'), 'p1', 'p1-t-A').status.retreated).toBe(false);
    const solo = giveChakra(setBack(freshMain1(), 'p1', ['t-A', null, null, null, null]), 'p1', 9);
    expect(char(retreat(solo, 'p1-t-A'), 'p1', 'p1-t-A').status.retreated).toBe(false);

    let acted = run(setup(), { type: 'ACTIVATE_ABILITY', instanceId: 'p1-t-hitter', abilityId: 'buff', targetInstanceIds: [], payFromPool: 0 });
    expect(char(retreat(acted, 'p1-t-hitter'), 'p1', 'p1-t-hitter').status.retreated).toBe(false);

    const stunned = patchChar(setup(), 'p1', 'p1-t-A', (c) => ({ extra: { ...c.extra, stunnedUntilTurn: 5 } }));
    expect(char(retreat(stunned, 'p1-t-A'), 'p1', 'p1-t-A').status.retreated).toBe(false);
    acted = stunned;
  });

  it('a Retreated character cannot act, enable a card, or take blanket damage — and stays in its slot', () => {
    const s = retreat(setup(), 'p1-t-hitter');
    expect(s.players.p1.backRow[0]!.instanceId).toBe('p1-t-hitter');
    const act = run(s, { type: 'ACTIVATE_ABILITY', instanceId: 'p1-t-hitter', abilityId: 'buff', targetInstanceIds: [], payFromPool: 0 });
    expect(act.stack).toHaveLength(0);

    const card = makeHandCardInstance('field-intelligence');
    const withCard = { ...s, players: { ...s.players, p1: { ...s.players.p1, hand: [{ kind: 'card' as const, ...card }] } } };
    expect(run(withCard, { type: 'PLAY_HAND_CARD', instanceId: card.instanceId, enablingInstanceId: 'p1-t-hitter', targetInstanceIds: [], payFromPool: 0 }).stack).toHaveLength(0);

    // Damage that reaches it without targeting (a blanket/splash effect) does nothing.
    expect(char(dealDamage(s, 'p1-t-hitter', 4).state, 'p1', 'p1-t-hitter').currentHP).toBe(9);
  });

  it('cannot be targeted by an enemy ability — unless its controller has no non-Retreated character left', () => {
    const attack = (s: GameState) =>
      run(toPhase(giveChakra(setBack(s, 'p1', ['t-hitter', null, null, null, null]), 'p1', 9), 'Combat'), {
        type: 'ACTIVATE_ABILITY',
        instanceId: 'p1-t-hitter',
        abilityId: 'hit',
        targetInstanceIds: ['p2-kakuzu'],
        payFromPool: 0,
      });
    const retreatP2 = (s: GameState, ids: string[]) => ({
      ...s,
      players: { ...s.players, p2: { ...s.players.p2, backRow: s.players.p2.backRow.map((c) => (c && ids.includes(c.instanceId) ? { ...c, status: { ...c.status, retreated: true } } : c)) } },
    });
    const base = freshMain1();
    const oneRetreated = attack(retreatP2(base, ['p2-kakuzu']));
    expect(oneRetreated.stack).toHaveLength(0);
    expect(oneRetreated.log.at(-1)!.text).toMatch(/Retreated and can't be targeted/);
    const allRetreated = attack(retreatP2(base, ['p2-kakuzu', 'p2-hidan', 'p2-deidara', 'p2-kisame', 'p2-itachi']));
    expect(allRetreated.stack).toHaveLength(1);
  });

  it('is targetable/damageable again once ALL of its controller\'s characters are Retreated', () => {
    let s = giveChakra(setBack(freshMain1(), 'p1', ['t-C', 't-C', null, null, null]), 'p1', 9);
    s = patchChar(s, 'p1', 'p1-t-C', (c) => ({ status: { ...c.status, retreated: true } }));
    // both slots hold the same instance id in this fixture, so patch by index instead
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c) => (c ? { ...c, status: { ...c.status, retreated: true } } : c)) } } };
    expect(dealDamage(s, s.players.p1.backRow[0]!.instanceId, 4).state.players.p1.backRow[0]!.currentHP).toBe(5);
  });

  it("returning is free, and the character is then 'summoning sick' for damage abilities but can use non-damaging ones", () => {
    let s = retreat(setup(), 'p1-t-hitter');
    s = giveChakra(s, 'p1', 9);
    const before = s.players.p1.genericChakraAvailable;
    s = run(s, { type: 'RETURN_FROM_RETREAT', instanceId: 'p1-t-hitter' });
    expect(char(s, 'p1', 'p1-t-hitter').status.retreated).toBe(false);
    expect(s.players.p1.genericChakraAvailable).toBe(before);
    const hit = run(toPhase(s, 'Combat'), { type: 'ACTIVATE_ABILITY', instanceId: 'p1-t-hitter', abilityId: 'hit', targetInstanceIds: ['p2-hidan'], payFromPool: 0 });
    expect(hit.stack).toHaveLength(0);
    expect(hit.log.at(-1)!.text).toMatch(/summoning sickness/);
    const buff = run(s, { type: 'ACTIVATE_ABILITY', instanceId: 'p1-t-hitter', abilityId: 'buff', targetInstanceIds: [], payFromPool: 0 });
    expect(buff.stack).toHaveLength(1);
  });

  it("a Retreated character's passives don't trigger (Hidan's regen), but an ongoing poison keeps ticking", () => {
    const hurt = patchChar(freshMain1(), 'p1', 'p1-hidan', (c) => ({ currentHP: 3, status: { ...c.status, retreated: true } }));
    expect(char(toPhase(hurt, 'End'), 'p1', 'p1-hidan').currentHP).toBe(3);

    // Poison was already ticking before it retreated, so it keeps ticking (§6.5b's ongoing-effect exception).
    const poisoned = patchChar(applyPoison(freshMain1(), 'p1-kisame', 2), 'p1', 'p1-kisame', (c) => ({ status: { ...c.status, retreated: true } }));
    const hpBefore = char(poisoned, 'p1', 'p1-kisame').currentHP;
    expect(char(toPhase(toPhase(poisoned, 'Untap'), 'Upkeep'), 'p1', 'p1-kisame').currentHP).toBe(hpBefore - 1);
  });
});

describe('§6.6 Summoning sickness, Ambush, Retaliation', () => {
  const fresh = () => giveChakra(setBack(freshMain1(), 'p1', ['t-hitter', null, null, null, null]), 'p1', 9);
  const sick = (s: GameState) => patchChar(s, 'p1', 'p1-t-hitter', (c) => ({ status: { ...c.status, enteredTurn: s.turn } }));
  const hit = (s: GameState) => run(toPhase(s, 'Combat'), { type: 'ACTIVATE_ABILITY', instanceId: 'p1-t-hitter', abilityId: 'hit', targetInstanceIds: ['p2-hidan'], payFromPool: 0 });

  it('blocks damage-dealing abilities the turn it enters, not non-damaging ones, and not after that turn', () => {
    expect(hit(sick(fresh())).stack).toHaveLength(0);
    const nonDamaging = run(sick(fresh()), { type: 'ACTIVATE_ABILITY', instanceId: 'p1-t-hitter', abilityId: 'buff', targetInstanceIds: [], payFromPool: 0 });
    expect(nonDamaging.stack).toHaveLength(1);
    expect(hit(fresh()).stack).toHaveLength(1);
  });

  it('Ambush ignores summoning sickness', () => {
    const s = patchChar(sick(fresh()), 'p1', 'p1-t-hitter', (c) => ({ status: { ...c.status, hasAmbush: true } }));
    expect(hit(s).stack).toHaveLength(1);
  });

  it('Retaliation: after a defeat, the next character played has Ambush, once', () => {
    let s = giveChakra(freshMain1(), 'p1', 9);
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c, i) => (i >= 3 ? null : c)) } } }; // leave room on the board
    s = dealDamage(s, 'p1-hidan', 99, { cannotBeReduced: true }).state; // Hidan survives his first defeat; hit again
    s = dealDamage(s, 'p1-hidan', 99, { cannotBeReduced: true }).state;
    expect(s.players.p1.retaliationPending).toBe(true);
    const entry = { kind: 'character' as const, instanceId: 'p1-c1', entryId: 'yahiko' };
    const entry2 = { kind: 'character' as const, instanceId: 'p1-c2', entryId: 'amegakure-civilian-rebel' };
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, hand: [entry, entry2] } } };
    s = run(s, { type: 'PLAY_CHARACTER', instanceId: 'p1-c1' });
    const yahiko = s.players.p1.backRow.find((c) => c?.defId === 'yahiko')!;
    expect(yahiko.status.hasAmbush).toBe(true);
    expect(s.players.p1.retaliationPending).toBe(false);
    s = run(giveChakra(s, 'p1', 9), { type: 'PLAY_CHARACTER', instanceId: 'p1-c2' });
    expect(s.players.p1.backRow.find((c) => c?.defId === 'amegakure-civilian-rebel')!.status.hasAmbush).toBe(false);
  });

  it("the starting character is sick on its controller's first turn — including the player who goes second (turn 2)", () => {
    for (const first of ['p1', 'p2'] as const) {
      let s = createSetupState(first);
      for (const p of ['p1', 'p2'] as const) {
        const reveal = s.players[p].pendingCharacterReveal!;
        // Pain spawns front-row tokens rather than a back-row character, so pick anyone else.
        s = gameReducer(s, { type: 'CHOOSE_CHARACTER', player: p, entryId: reveal.revealed.find((id) => id !== 'pain') ?? reveal.revealed[0] });
      }
      const second = first === 'p1' ? 'p2' : 'p1';
      for (const p of [first, second] as const) {
        const starting = s.players[p].backRow.find((c) => c)!;
        const firstTurn = p === first ? 1 : 2;
        expect(starting.status.enteredTurn, `${p} starting character`).toBe(firstTurn);
      }
    }
  });
});

describe('§4.3/§8 Draw, deck-out, and the Reinforcement Tax', () => {
  const hand = (s: GameState, p: PlayerId, ids: string[]): GameState => ({
    ...s,
    players: { ...s.players, [p]: { ...s.players[p], hand: ids.map((id, i) => ({ kind: 'character' as const, instanceId: `${p}-c${i}`, entryId: id })) } },
  });
  const play = (s: GameState, i: number) => run(s, { type: 'PLAY_CHARACTER', instanceId: `p1-c${i}` });
  const start = () => setBack(freshMain1(), 'p1', ['t-C', null, null, null, null]);

  it('playing a character from hand costs nothing, at any tax level', () => {
    let s = hand(giveChakra(start(), 'p1', 5), 'p1', ['yahiko', 'amegakure-civilian-rebel']);
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, reinforcementsPlayed: 3 } } };
    s = play(play(s, 0), 1);
    expect(s.players.p1.backRow.filter((c) => c)).toHaveLength(3);
    expect(s.players.p1.genericChakraAvailable).toBe(5);
  });

  it("the Character Deck tax can't be paid from a character's Pool, and the draw is refused (nothing spent) when generic Chakra is short", () => {
    let s = patchChar(start(), 'p1', 'p1-t-C', (c) => ({ chakraPool: { ...c.chakraPool, current: 6 } }));
    s = giveChakra(s, 'p1', 2);
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, characterDeck: ['konan', 'zetsu'] } } };
    const after = run(s, { type: 'DRAW_CHARACTER_DECK', player: 'p1' });
    expect(after.players.p1.pendingCharacterReveal).toBeNull();
    expect(after.players.p1.genericChakraAvailable).toBe(2);
    expect(char(after, 'p1', 'p1-t-C').chakraPool.current).toBe(6);
    expect(after.players.p1.reinforcementsPlayed).toBe(0);
  });

  it('respects the 5-character board limit', () => {
    let s = setBack(freshMain1(), 'p1', ['t-C', 't-C', 't-C', 't-C', 't-C']);
    s = hand(giveChakra(s, 'p1', 9), 'p1', ['yahiko']);
    const after = play(s, 0);
    expect(after.players.p1.hand).toHaveLength(1);
  });

  it('a draw looks at 2: the pick goes to hand, the other to the bottom of the Character Deck', () => {
    let s = giveChakra(start(), 'p1', 3);
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, characterDeck: ['konan', 'zetsu', 'juzo'] } } };
    s = run(s, { type: 'DRAW_CHARACTER_DECK', player: 'p1' });
    expect(s.players.p1.pendingCharacterReveal?.revealed).toEqual(['konan', 'zetsu']);
    s = gameReducer(s, { type: 'CHOOSE_CHARACTER', player: 'p1', entryId: 'zetsu' });
    expect(s.players.p1.hand.some((h) => h.kind === 'character' && h.entryId === 'zetsu')).toBe(true);
    expect(s.players.p1.characterDeck).toEqual(['juzo', 'konan']);
  });

  it('a C+ defeat does NOT auto-reveal anything — it offers an optional Reinforcement', () => {
    let s = freshMain1();
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, characterDeck: ['konan', 'zetsu', 'juzo'] } } };
    s = dealDamage(s, 'p1-hidan', 99, { cannotBeReduced: true }).state;
    s = dealDamage(s, 'p1-hidan', 99, { cannotBeReduced: true }).state;
    s = gameReducer(s, { type: 'PASS_PRIORITY' }); // any action settles the trigger
    expect(s.players.p1.pendingCharacterReveal).toBeNull();
    expect(s.players.p1.reinforcementOffers.length + (s.players.p1.mustPlayCharacter ? 1 : 0)).toBe(1);
  });

  it("the first player skips only their very first draw; everyone else draws each Draw Phase (by clicking Draw); an empty deck costs 3 Health", () => {
    let s = createSetupState('p1');
    for (const p of ['p1', 'p2'] as const) {
      s = gameReducer(s, { type: 'CHOOSE_CHARACTER', player: p, entryId: s.players[p].pendingCharacterReveal!.revealed[0] });
    }
    const drawTurn = (st: GameState) => toPhase(gameReducer(toPhase(st, 'Draw'), { type: 'DRAW_PHASE_CARD' }), 'Main1');
    const handSize = (st: GameState, p: PlayerId) => st.players[p].hand.length;
    const p1Start = handSize(s, 'p1');
    s = drawTurn(s); // p1 turn 1: no draw
    expect(handSize(s, 'p1')).toBe(p1Start);
    const p2Start = handSize(s, 'p2');
    s = drawTurn(toPhase(s, 'Untap')); // p2 turn 2: draws 1
    expect(handSize(s, 'p2')).toBe(p2Start + 1);
    s = drawTurn(toPhase(s, 'Untap')); // p1 turn 3: draws 1
    expect(handSize(s, 'p1')).toBe(p1Start + 1);

    const empty = { ...s, players: { ...s.players, p2: { ...s.players.p2, handDeck: [] } } };
    const hpBefore = empty.players.p2.health;
    const after = gameReducer(toPhase(toPhase(empty, 'Untap'), 'Draw'), { type: 'DRAW_PHASE_CARD' });
    expect(after.players.p2.health).toBe(hpBefore - 3);
  });
});

describe('§6.5b Retreat collapse: clearing the board forces Retreated characters out', () => {
  // p2: a fragile active character (t-C, 1 HP) plus a Retreated t-B. p1: a hitter that can kill it.
  const setup = (rules: 'strict' | 'trust' = 'strict'): GameState => {
    let s = giveChakra(setBack(freshCombat(), 'p1', ['t-hitter', null, null, null, null]), 'p1', 9);
    s = setBack(s, 'p2', ['t-C', 't-B', null, null, null]);
    s = patchChar(s, 'p2', 'p2-t-C', () => ({ currentHP: 1 }));
    s = patchChar(s, 'p2', 'p2-t-B', (c) => ({ status: { ...c.status, retreated: true } }));
    return { ...s, rules };
  };
  const b = (s: GameState) => s.players.p2.backRow.find((c) => c?.instanceId === 'p2-t-B')!;
  const hit = (target: string): GameAction => ({ type: 'ACTIVATE_ABILITY', instanceId: 'p1-t-hitter', abilityId: 'hit', targetInstanceIds: [target], payFromPool: 0 });

  it('strict: the retreated character is forced out immediately, and the attacker gets a second Combat', () => {
    let s = resolveTop(run(setup(), hit('p2-t-C')));
    expect(s.players.p2.backRow.some((c) => c?.instanceId === 'p2-t-C')).toBe(false); // cleared
    expect(b(s).status.retreated).toBe(false); // forced out at once
    expect(s.extraCombatPending).toBe(true);

    // p2's C-rank fell with another C+ (the Retreated B) still in play: an optional paid Reinforcement they must answer first.
    expect(s.players.p2.reinforcementOffers).toEqual(['paid']);
    expect(gameReducer(s, { type: 'ADVANCE_PHASE' }).phase).toBe('Combat');
    expect(gameReducer(s, { type: 'ADVANCE_PHASE' }).extraCombatPending).toBe(true); // refused, not advanced
    s = gameReducer(s, { type: 'DECLINE_REINFORCEMENT', player: 'p2' });

    s = gameReducer(s, { type: 'ADVANCE_PHASE' }); // finishing the combat step -> second Combat instead of Main 2
    expect(s.phase).toBe('Combat');
    expect(s.activePlayer).toBe('p1');
    expect(s.extraCombatPending).toBe(false);
    s = gameReducer(s, { type: 'ADVANCE_PHASE' }); // and only once
    expect(s.phase).toBe('Main2');
  });

  it('the second Combat only offers attack actions not already used this turn', () => {
    let s = resolveTop(run(setup(), hit('p2-t-C')));
    s = gameReducer(s, { type: 'ADVANCE_PHASE' });
    const again = run(s, hit('p2-t-B')); // the hitter already used Hit this turn
    expect(again.stack).toHaveLength(0);
    expect(again.log.at(-1)!.text).toMatch(/already used/);
  });

  it('trust: Finalize Combat resolves the step, forces the character out, and holds the phase for a second Combat', () => {
    let s = run(setup('trust'), { type: 'STAGE_ABILITY', instanceId: 'p1-t-hitter', abilityId: 'hit', targetInstanceIds: ['p2-t-C'], payFromPool: 0 });
    s = run(s, { type: 'FINALIZE_PHASE', player: 'p1' });
    expect(s.staged).toHaveLength(0);
    expect(b(s).status.retreated).toBe(false);
    expect(s.phase).toBe('Combat');
    expect(s.log.some((l) => /second Combat/.test(l.text))).toBe(true);
    s = run(s, { type: 'FINALIZE_PHASE', player: 'p1' }); // the second combat step
    expect(s.phase).toBe('Main2');
  });

  it("the retreated character stays immune to attacks queued in the same step, even after the last active one falls", () => {
    let s = run(setup('trust'), { type: 'STAGE_ABILITY', instanceId: 'p1-t-hitter', abilityId: 'hit', targetInstanceIds: ['p2-t-C'], payFromPool: 0 });
    s = run(s, { type: 'STAGE_ABILITY', instanceId: 'p1-t-hitter', abilityId: 'hit', targetInstanceIds: ['p2-t-B'], payFromPool: 0 });
    const before = b(s).currentHP;
    s = run(s, { type: 'FINALIZE_PHASE', player: 'p1' });
    expect(b(s).currentHP).toBe(before); // the second attack found it still Retreated
    expect(b(s).status.retreated).toBe(false); // ...and it's forced out once the step ends
  });

  it('outside a combat step the character is forced out, but nobody gets an extra Combat', () => {
    let s = { ...setup(), phase: 'Main1' as const };
    s = gameReducer(dealDamageAction(s), { type: 'MULLIGAN', player: 'p1' }); // any reducer action settles the state
    expect(b(s).status.retreated).toBe(false);
    expect(s.extraCombatPending).toBe(false);
  });

  it('does nothing while the controller still has a non-Retreated character', () => {
    const s = resolveTop(run(setup(), hit('p2-t-B'))); // targeting the Retreated one is refused
    expect(b(s).status.retreated).toBe(true);
    expect(s.extraCombatPending).toBe(false);
  });
});

function dealDamageAction(s: GameState): GameState {
  return dealDamage(s, 'p2-t-C', 5).state;
}

describe('Manual: Consumed pile retrieval (fixing an accidental/wrong Chakra placement)', () => {
  const setup = () => {
    const cards = ['substitution', 'chakra-transfer'].map((d) => makeHandCardInstance(d));
    let s: GameState = { ...freshMain1(), rules: 'trust' }; // these are trust-mode-only manual tools
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, hand: cards.map((c) => ({ kind: 'card' as const, ...c })) } } };
    return { s, cards };
  };

  it('returns the card to hand and removes the linked, still-untapped Chakra source', () => {
    const { s, cards } = setup();
    let state = run(s, { type: 'PLACE_CHAKRA_SOURCE', instanceId: cards[0].instanceId });
    expect(state.players.p1.chakraSources).toHaveLength(1);
    expect(state.players.p1.consumedPile).toHaveLength(1);

    state = run(state, { type: 'RETURN_FROM_CONSUMED', player: 'p1', instanceId: cards[0].instanceId });
    expect(state.players.p1.consumedPile).toHaveLength(0);
    expect(state.players.p1.chakraSources).toHaveLength(0);
    expect(state.players.p1.hand.some((h) => h.instanceId === cards[0].instanceId)).toBe(true);
    expect(state.players.p1.chakraSourcePlacedThisTurn).toBe(false); // free to place again this turn
  });

  it('refunds 1 Chakra if the linked source had already been tapped, and only removes the matching source when two were placed', () => {
    const { s, cards } = setup();
    let state = run(s, { type: 'PLACE_CHAKRA_SOURCE', instanceId: cards[0].instanceId }, { type: 'TAP_CHAKRA_SOURCE', sourceIndex: 0 });
    // Bingo Book B's bonus lets a 2nd placement through even though one was already placed this turn.
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, bonusChakraSourcePlacements: 1 } } };
    state = run(state, { type: 'PLACE_CHAKRA_SOURCE', instanceId: cards[1].instanceId });
    expect(state.players.p1.chakraSources).toHaveLength(2);
    expect(state.players.p1.genericChakraAvailable).toBe(1);

    // Retrieve the SECOND (wrongly Consumed) card — its own (untapped) source is removed, not the first, tapped one.
    state = run(state, { type: 'RETURN_FROM_CONSUMED', player: 'p1', instanceId: cards[1].instanceId });
    expect(state.players.p1.chakraSources).toHaveLength(1);
    expect(state.players.p1.chakraSources[0].tapped).toBe(true); // the first source survives, untouched
    expect(state.players.p1.genericChakraAvailable).toBe(1); // no refund — that source was never tapped

    // Now retrieve the first (tapped) one too — its Chakra is refunded.
    state = run(state, { type: 'RETURN_FROM_CONSUMED', player: 'p1', instanceId: cards[0].instanceId });
    expect(state.players.p1.chakraSources).toHaveLength(0);
    expect(state.players.p1.genericChakraAvailable).toBe(0);
    expect(state.players.p1.hand.map((h) => h.instanceId).sort()).toEqual([cards[0].instanceId, cards[1].instanceId].sort());
  });

  it('does nothing for an unknown instance id, and is a no-op in strict mode', () => {
    const { s, cards } = setup();
    let state = run(s, { type: 'PLACE_CHAKRA_SOURCE', instanceId: cards[0].instanceId });
    const before = state;
    state = run(state, { type: 'RETURN_FROM_CONSUMED', player: 'p1', instanceId: 'no-such-card' });
    expect(state.players.p1.consumedPile).toEqual(before.players.p1.consumedPile);

    const strict = gameReducer(freshMain1(), { type: 'RETURN_FROM_CONSUMED', player: 'p1', instanceId: 'anything' } as GameAction);
    expect(strict).toEqual(freshMain1());
  });
});

describe('Upkeep preview and reminder text (for the standing panel and the character-reveal picker)', () => {
  it('previews a grant for a C/B-rank starting character, a reduced/free cost for A/S, and the normal table for everyone else', () => {
    const s = setBack(freshMain1(), 'p1', ['t-C', 't-B', 't-A', 't-S', null]);
    for (const id of ['p1-t-C', 'p1-t-B', 'p1-t-A', 'p1-t-S']) {
      const withStarting = { ...s, players: { ...s.players, p1: { ...s.players.p1, startingCharacterInstanceId: id } } };
      const entries = previewUpkeep(withStarting, 'p1');
      const starting = entries.find((e) => e.instanceId === id)!;
      const rest = entries.filter((e) => e.instanceId !== id);
      if (id === 'p1-t-C') expect(starting).toMatchObject({ kind: 'grant', amount: 2 });
      if (id === 'p1-t-B') expect(starting).toMatchObject({ kind: 'grant', amount: 1 });
      if (id === 'p1-t-A') expect(starting).toMatchObject({ kind: 'free', amount: 0 });
      if (id === 'p1-t-S') expect(starting).toMatchObject({ kind: 'cost', amount: 2 });
      // The other three (not the starting character) still use the normal per-rank table.
      const byRank = Object.fromEntries(rest.map((e) => [e.rank, e]));
      if (id !== 'p1-t-C') expect(byRank['C']).toMatchObject({ kind: 'free', amount: 0 });
      if (id !== 'p1-t-B') expect(byRank['B']).toMatchObject({ kind: 'cost', amount: 1 });
      if (id !== 'p1-t-A') expect(byRank['A']).toMatchObject({ kind: 'cost', amount: 2 });
      if (id !== 'p1-t-S') expect(byRank['S']).toMatchObject({ kind: 'cost', amount: 3 });
    }
  });

  it('matches what payUpkeep actually does', () => {
    const s = setBack(freshMain1(), 'p1', ['kakuzu', 'hidan', null, null, null]);
    const preview = previewUpkeep(s, 'p1');
    const kakuzu = preview.find((e) => e.instanceId === 'p1-kakuzu')!;
    expect(kakuzu.kind).toBe('cost');
    const paid = payUpkeep(sources(s, 'p1', kakuzu.amount + preview.find((e) => e.instanceId === 'p1-hidan')!.amount), 'p1');
    expect(char(paid, 'p1', 'p1-kakuzu').status.disabled).toBe(false);
    expect(char(paid, 'p1', 'p1-hidan').status.disabled).toBe(false);
  });

  it('gives the right reminder text for a Setup pick (the "1st character" bonus) vs. a Reinforcement pick (the normal table)', () => {
    expect(upkeepReminderText('C', 'setup')).toMatch(/no upkeep.*\+2 Chakra/);
    expect(upkeepReminderText('B', 'setup')).toMatch(/no upkeep.*\+1 Chakra/);
    expect(upkeepReminderText('A', 'setup')).toMatch(/upkeep is free/);
    expect(upkeepReminderText('S', 'setup')).toMatch(/upkeep is 2 \(reduced from the normal 3\)/);
    expect(upkeepReminderText('D', 'setup')).toMatch(/no starting-character bonus/i);

    expect(upkeepReminderText('C', 'reinforcement')).toMatch(/free/);
    expect(upkeepReminderText('B', 'reinforcement')).toMatch(/1 Chakra\/turn/);
    expect(upkeepReminderText('S', 'reinforcement')).toMatch(/3 Chakra\/turn/);
  });
});

describe('§10a/§10b: Terrain and Mission cards are not enabled by a character', () => {
  const play = (defId: string) => {
    const s = giveChakra(setBack(freshMain1(), 'p1', ['t-C', null, null, null, null]), 'p1', 3);
    const card = makeHandCardInstance(defId);
    const withCard = { ...s, players: { ...s.players, p1: { ...s.players.p1, hand: [{ kind: 'card' as const, ...card }] } } };
    // '' — deliberately no enabling character, unlike a Jutsu card.
    return run(withCard, { type: 'PLAY_HAND_CARD', instanceId: card.instanceId, enablingInstanceId: '', targetInstanceIds: [], payFromPool: 0 });
  };

  it('a Terrain card plays with no enabling character', () => {
    const s = play('akatsuki-hideout');
    expect(s.players.p1.terrainInPlay?.defId).toBe('akatsuki-hideout');
    expect(s.log.at(-1)!.text).not.toMatch(/Can't play/);
  });

  it('a Mission card plays with no enabling character', () => {
    const s = play('unshakable-resolve');
    expect(s.players.p1.missionsInPlay).toHaveLength(1);
    expect(s.log.at(-1)!.text).not.toMatch(/Can't play/);
  });

  it('a Jutsu card still needs one (the requirement is Jutsu-specific, not "every non-Assist card")', () => {
    const s = play('field-intelligence');
    expect(s.log.at(-1)!.text).toMatch(/no such character to enable/);
    expect(s.players.p1.hand).toHaveLength(1); // rejected — the card never left hand
  });
});

describe("§10b Unshakable Resolve: the 6-Untap timing (an off-by-one bug meant it used to take 7)", () => {
  const setup = () => {
    let s = giveChakra(setBack(freshMain1(), 'p1', ['t-C', null, null, null, null]), 'p1', 1);
    // A real (non-empty) Hand Deck for both players — freshMain1()'s default is empty, which would otherwise
    // deal 3 Health deck-out damage on every one of these many Draw Phases and confound the Health-loss check below.
    const filler = Array.from({ length: 20 }, () => makeHandCardInstance('field-intelligence'));
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, handDeck: filler }, p2: { ...s.players.p2, handDeck: filler } } };
    const card = makeHandCardInstance('unshakable-resolve');
    const withCard = { ...s, players: { ...s.players, p1: { ...s.players.p1, hand: [{ kind: 'card' as const, ...card }] } } };
    return run(withCard, { type: 'PLAY_HAND_CARD', instanceId: card.instanceId, enablingInstanceId: '', targetInstanceIds: [], payFromPool: 0 });
  };
  const mission = (s: GameState) => s.players.p1.missionsInPlay[0];
  /** Advances until the next time it becomes p1's own Untap Phase. */
  const toNextP1Untap = (s: GameState): GameState => {
    let n = gameReducer(s, { type: 'ADVANCE_PHASE' });
    while (!(n.activePlayer === 'p1' && n.phase === 'Untap')) n = gameReducer(n, { type: 'ADVANCE_PHASE' });
    return n;
  };

  it('records its Health baseline and starts at 0/6 the instant it is played — not on the first tick', () => {
    const s = setup();
    expect(mission(s).extra).toMatchObject({ healthAtPlay: 20, untaps: 0 });
  });

  it('fires on the 6th of its own Untap Phases after being played, not the 7th', () => {
    let s = setup();
    for (let i = 1; i <= 5; i++) {
      s = toNextP1Untap(s);
      expect(mission(s)?.extra.untaps, `after Untap #${i}`).toBe(i);
      expect(s.players.p1.missionsInPlay, `after Untap #${i}`).toHaveLength(1); // not yet resolved
    }
    s = toNextP1Untap(s); // the 6th
    expect(s.players.p1.missionsInPlay).toHaveLength(0); // resolved and discarded
    expect(s.log.some((l) => /Unshakable Resolve succeeds/.test(l.text))).toBe(true);
    expect(char(s, 'p1', 'p1-t-C').chakraPool.current).toBe(5);
    expect(char(s, 'p1', 'p1-t-C').currentHP).toBe(char(s, 'p1', 'p1-t-C').maxHP); // healed 5, capped at max
  });

  it('fails instead if the controller has lost 10+ Health since it was played', () => {
    let s = setup();
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, health: 9 } } }; // 20 -> 9, an 11-Health drop
    s = toNextP1Untap(s);
    expect(s.players.p1.missionsInPlay).toHaveLength(0);
    expect(s.log.some((l) => /Unshakable Resolve fails/.test(l.text))).toBe(true);
  });
});

describe('Mission progress display (missionProgressText)', () => {
  it('reports N/6 Untaps for Unshakable Resolve, and Squad Formation\'s active state', () => {
    expect(missionProgressText('unshakable-resolve', { untaps: 3 })).toBe('3/6 Untaps');
    expect(missionProgressText('unshakable-resolve', {})).toBeUndefined(); // not yet played (no state to show)
    expect(missionProgressText('squad-formation', { active: false })).toMatch(/waiting/i);
    expect(missionProgressText('squad-formation', { active: true })).toMatch(/active/i);
    expect(missionProgressText('bingo-book-s', {})).toBeUndefined(); // no visible progress to report
  });
});

describe('Trust mode: Chakra-source-placement timing is flagged, not silently ignored', () => {
  const withCard = () => {
    const s = { ...freshMain1(), rules: 'trust' as const };
    const card = makeHandCardInstance('substitution');
    return { s: { ...s, players: { ...s.players, p1: { ...s.players.p1, hand: [{ kind: 'card' as const, ...card }] } } }, card };
  };

  it('placing outside a Main Phase still succeeds, but logs an advisory warning', () => {
    const { s, card } = withCard();
    const inCombat = { ...s, phase: 'Combat' as const };
    const after = run(inCombat, { type: 'PLACE_CHAKRA_SOURCE', instanceId: card.instanceId });
    expect(after.players.p1.chakraSources).toHaveLength(1); // still placed
    expect(after.log.some((l) => /outside a Main Phase.*not legal under the strict rules/.test(l.text))).toBe(true);
  });

  it('placing a second one in the same turn still succeeds, but logs an advisory warning', () => {
    const { s, card } = withCard();
    const card2 = makeHandCardInstance('substitution');
    let state = { ...s, players: { ...s.players, p1: { ...s.players.p1, hand: [...s.players.p1.hand, { kind: 'card' as const, ...card2 }] } } };
    state = run(state, { type: 'PLACE_CHAKRA_SOURCE', instanceId: card.instanceId });
    expect(state.log.at(-1)!.text).not.toMatch(/not legal/); // the first one this turn is perfectly legal
    state = run(state, { type: 'PLACE_CHAKRA_SOURCE', instanceId: card2.instanceId });
    expect(state.players.p1.chakraSources).toHaveLength(2); // still placed
    expect(state.log.some((l) => /more than one Chakra source.*not legal under the strict rules/.test(l.text))).toBe(true);
  });

  it('the same violation in strict mode is still rejected outright', () => {
    const s = { ...freshMain1(), phase: 'Combat' as const };
    const card = makeHandCardInstance('substitution');
    const withHand = { ...s, players: { ...s.players, p1: { ...s.players.p1, hand: [{ kind: 'card' as const, ...card }] } } };
    const after = run(withHand, { type: 'PLACE_CHAKRA_SOURCE', instanceId: card.instanceId });
    expect(after.players.p1.chakraSources).toHaveLength(0);
    expect(after.log.at(-1)!.text).toMatch(/cannot place a Chakra source outside a Main Phase/);
  });
});
