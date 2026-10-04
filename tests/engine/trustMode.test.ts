import { describe, expect, it } from 'vitest';
import { gameReducer } from '../../src/engine/reducer';
import { redactStateFor } from '../../src/engine/redact';
import { makeHandCardInstance } from '../../src/engine/deck';
import { registerCharacter } from '../../src/engine/characters/registry';
import { hasMeaningfulResponse } from '../../src/engine/trust/staging';
import { freshCombat, freshMain1, giveChakra, withCharacterAt } from './testUtils';
import type { GameAction, GameState, PlayerId } from '../../src/engine/types';

// Same quick-start board as the strict-mode tests, just flipped into trust mode.
function trustMain1(): GameState {
  return { ...freshMain1(), rules: 'trust' };
}

function run(state: GameState, ...actions: GameAction[]): GameState {
  return actions.reduce((s, a) => gameReducer(s, a), state);
}

function withChakra(state: GameState, player: PlayerId, generic: number, untappedSources = 0): GameState {
  const p = state.players[player];
  return {
    ...state,
    players: {
      ...state.players,
      [player]: { ...p, genericChakraAvailable: generic, chakraSources: Array.from({ length: untappedSources }, () => ({ tapped: false })) },
    },
  };
}

function withCard(state: GameState, player: PlayerId, defId: string) {
  const card = makeHandCardInstance(defId);
  const p = state.players[player];
  return { state: { ...state, players: { ...state.players, [player]: { ...p, hand: [...p.hand, { kind: 'card' as const, ...card }] } } }, instanceId: card.instanceId };
}

const hp = (s: GameState, player: PlayerId, id: string) => [...s.players[player].backRow, ...s.players[player].frontRow].find((o) => o?.instanceId === id)!.currentHP;
// Declared in Main 1, so out of timing (damage is Combat-only) — forced through; these tests are about the declare/resolve flow.
const stage = (targets: string[]): GameAction => ({ type: 'STAGE_ABILITY', instanceId: 'p1-kakuzu', abilityId: 'earth-grudge-fear', targetInstanceIds: targets, payFromPool: 0, force: true });

describe('trust mode: staging', () => {
  it('declaring an action computes nothing until the round is finalized, and it can be retargeted first', () => {
    let s = withChakra(trustMain1(), 'p1', 5);
    const hidanHp = hp(s, 'p2', 'p2-hidan');
    const kisameHp = hp(s, 'p2', 'p2-kisame');

    s = run(s, stage(['p2-hidan']));
    expect(s.staged).toHaveLength(1);
    expect(hp(s, 'p2', 'p2-hidan')).toBe(hidanHp);
    expect(s.players.p1.genericChakraAvailable).toBe(5); // nothing paid yet

    s = run(s, { type: 'RETARGET_STAGED', stagedId: s.staged[0].id, targetInstanceIds: ['p2-kisame'] });
    s = run(s, { type: 'FINALIZE_PHASE', player: 'p1' });

    expect(hp(s, 'p2', 'p2-hidan')).toBe(hidanHp);
    expect(hp(s, 'p2', 'p2-kisame')).toBe(kisameHp - 1);
    expect(s.players.p1.genericChakraAvailable).toBe(4); // cost paid at resolution
    expect(s.staged).toHaveLength(0);
    expect(s.pendingFinalize).toBeNull();
    expect(s.phase).toBe('Combat'); // Finalize Phase moved on from Main1
  });

  it('a declared action can be withdrawn', () => {
    let s = withChakra(trustMain1(), 'p1', 5);
    s = run(s, stage(['p2-hidan']));
    s = run(s, { type: 'UNSTAGE', stagedId: s.staged[0].id });
    expect(s.staged).toHaveLength(0);
  });

  it('an illegal declaration is refused (and only its author is told) unless it is forced through', () => {
    // In the Main Phase a damaging Normal-speed ability is out of timing (§4.5).
    const unforced: GameAction = { type: 'STAGE_ABILITY', instanceId: 'p1-kakuzu', abilityId: 'earth-grudge-fear', targetInstanceIds: ['p2-hidan'], payFromPool: 0 };
    const refused = run(withChakra(trustMain1(), 'p1', 1), unforced);
    expect(refused.staged).toHaveLength(0);
    expect(refused.log.at(-1)!.visibleTo).toBe('p1');
    expect(redactStateFor(refused, 'p2').log.some((l) => /Earth Grudge Fear/.test(l.text))).toBe(false);

    const forced = run(withChakra(trustMain1(), 'p1', 1), stage(['p2-hidan']));
    expect(forced.staged[0].warnings.join(' ')).toMatch(/Combat Phase/);
  });

  it('costs are paid at resolution: with too little Chakra tapped nothing resolves until the player taps more', () => {
    let s: GameState = { ...trustMain1(), phase: 'Combat' }; // p1 has 0 Chakra available
    s = run(s, stage(['p2-hidan']), { type: 'RESOLVE_ACTIONS', player: 'p1' });
    expect(s.staged).toHaveLength(1); // not resolved
    expect(s.log.at(-1)!.warning).toBe(true);
    expect(s.log.at(-1)!.text).toMatch(/tap your Chakra/);

    s = run(withChakra(s, 'p1', 1), { type: 'RESOLVE_ACTIONS', player: 'p1' });
    expect(s.staged).toHaveLength(0);
    expect(hp(s, 'p2', 'p2-hidan')).toBe(hp(trustMain1(), 'p2', 'p2-hidan') - 1);
    expect(s.players.p1.genericChakraAvailable).toBe(0);
  });

  it('a shortfall the Pool could cover is asked about — the Pool is never used unless the player says yes', () => {
    let s: GameState = withChakra({ ...trustMain1(), phase: 'Combat' }, 'p1', 0);
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c, i) => (i === 0 && c ? { ...c, chakraPool: { ...c.chakraPool, current: 2 } } : c)) } } };
    s = run(s, stage(['p2-hidan']), { type: 'RESOLVE_ACTIONS', player: 'p1' });
    const ask = s.pendingChoices.find((c) => c.resolverId === 'staged-pool-top-up')!;
    expect(ask).toBeDefined();
    s = run(s, { type: 'RESOLVE_CHOICE', choiceId: ask.id, optionIds: ['yes'] }, { type: 'RESOLVE_ACTIONS', player: 'p1' });
    expect(s.staged).toHaveLength(0);
    expect(s.players.p1.backRow[0]!.chakraPool.current).toBe(1);
  });

  it("the opponent sees only that an action was declared — what it is stays hidden until the round is finalized", () => {
    const s = run(withChakra(trustMain1(), 'p1', 1), stage(['p2-hidan']));
    const seen = redactStateFor(s, 'p2');
    expect(seen.staged[0].label).toBe('Hidden declared action');
    expect(seen.staged[0].targets).toEqual([]);
    expect(seen.log.some((l) => /Earth Grudge Fear/.test(l.text))).toBe(false);
    expect(seen.log.some((l) => l.text === 'p1 declares an action.')).toBe(true);
  });
});

describe('trust mode: response prompts', () => {
  it('does not ask an opponent who has nothing meaningful to respond with', () => {
    let s = withChakra(trustMain1(), 'p1', 5);
    s = run(s, stage(['p2-hidan']), { type: 'RESOLVE_ACTIONS', player: 'p1' });
    expect(s.pendingFinalize).toBeNull(); // resolved straight away — no OK click needed
    expect(s.staged).toHaveLength(0);
  });

  it('asks an opponent who could legally respond, lets them respond, then resolves in stack order', () => {
    // p1 has just enough Chakra for the attack and nothing to respond with.
    let s = withChakra(trustMain1(), 'p1', 1);
    const withSub = withCard(s, 'p2', 'substitution');
    s = withChakra(withSub.state, 'p2', 4);
    const before = hp(s, 'p2', 'p2-kakuzu');

    s = run(s, stage(['p2-kakuzu']), { type: 'RESOLVE_ACTIONS', player: 'p1' });
    // p2 holds a Reactive Substitution and has 4 Chakra → a meaningful response exists, so we wait for them.
    expect(s.pendingFinalize?.approvals).toEqual(['p1']);
    expect(s.staged).toHaveLength(1);

    s = run(s, { type: 'STAGE_CARD', instanceId: withSub.instanceId, enablingInstanceId: 'p2-kakuzu', targetInstanceIds: [], payFromPool: 0 });
    // p1 has nothing meaningful left to say, so the round resolves immediately: Substitution (declared last, so resolved first) negates the attack.
    expect(s.pendingFinalize).toBeNull();
    expect(s.staged).toHaveLength(0);
    expect(s.log.some((l) => /Substitution negates/.test(l.text))).toBe(true);
    expect(hp(s, 'p2', 'p2-kakuzu')).toBe(before);
    expect(s.players.p2.hand.some((h) => h.instanceId === withSub.instanceId)).toBe(false);
  });

  it('lets the opponent approve explicitly, and the declaring player reopen the round instead', () => {
    let s = withChakra(trustMain1(), 'p1', 5);
    s = withChakra(withCard(s, 'p2', 'substitution').state, 'p2', 4);
    s = run(s, stage(['p2-kakuzu']), { type: 'RESOLVE_ACTIONS', player: 'p1' });
    expect(s.pendingFinalize).not.toBeNull();

    const reopened = run(s, { type: 'CANCEL_FINALIZE', player: 'p1' });
    expect(reopened.pendingFinalize).toBeNull();
    expect(reopened.staged).toHaveLength(1);

    const before = hp(s, 'p2', 'p2-kakuzu');
    s = run(s, { type: 'APPROVE_RESOLVE', player: 'p2' });
    expect(s.pendingFinalize).toBeNull();
    expect(hp(s, 'p2', 'p2-kakuzu')).toBe(before - 1);
  });
});

describe('trust mode: could-they-respond check', () => {
  // A Quick, two-target ability whose own condition demands BOTH targets be chosen — the check should still only need one valid target.
  registerCharacter({
    id: 'test-quick-duo',
    name: 'Test Quick Duo',
    rank: 'C',
    baseMaxHP: 5,
    basePoolCapacity: 4,
    styles: [],
    abilities: [
      {
        id: 'duo-strike',
        name: 'Duo Strike',
        cost: 2,
        speed: 'Quick',
        style: 'None',
        type: 'Ninjutsu',
        isDamaging: true,
        maxTargets: 2,
        legalityCheck: (ctx) => ctx.targetInstanceIds.length === 2,
        resolve: (ctx) => ctx.state,
      },
    ],
  });

  const duoOnly = (): GameState => {
    let s = withCharacterAt(trustMain1(), 'p2', 0, 'test-quick-duo');
    const p2 = s.players.p2;
    s = { ...s, players: { ...s.players, p2: { ...p2, backRow: p2.backRow.map((c, i) => (i === 0 ? c : null)) } } };
    return s;
  };

  it('counts a multi-target ability as a response if the player can pay and can pick at least one target', () => {
    expect(hasMeaningfulResponse(withChakra(duoOnly(), 'p2', 2), 'p2')).toBe(true);
  });

  it('counts Chakra from a Pool or from untapped sources, but not when the player cannot pay', () => {
    expect(hasMeaningfulResponse(withChakra(duoOnly(), 'p2', 0), 'p2')).toBe(false);
    expect(hasMeaningfulResponse(withChakra(duoOnly(), 'p2', 0, 2), 'p2')).toBe(true); // two untapped sources
    let pooled = withChakra(duoOnly(), 'p2', 0);
    const p2 = pooled.players.p2;
    pooled = { ...pooled, players: { ...pooled.players, p2: { ...p2, backRow: p2.backRow.map((c) => (c ? { ...c, chakraPool: { ...c.chakraPool, current: 2 } } : c)) } } };
    expect(hasMeaningfulResponse(pooled, 'p2')).toBe(true); // paid from the character's own Pool
  });
});

describe('trust mode: resolution order (first activated, first resolved)', () => {
  it('resolves declared actions in the order they were declared', () => {
    let s = withChakra(trustMain1(), 'p1', 2);
    s = run(s, stage(['p2-hidan']), stage(['p2-kisame']), { type: 'RESOLVE_ACTIONS', player: 'p1' });
    const order = s.log.filter((l) => l.text.startsWith('Resolving')).map((l) => l.text);
    expect(order).toHaveLength(2);
    // Both are the same ability, so tell them apart by who took the damage, in log order.
    const damaged = s.log.filter((l) => /takes 1 damage/.test(l.text)).map((l) => l.text);
    expect(damaged[0]).toMatch(/Hidan/);
    expect(damaged[1]).toMatch(/Kisame/);
  });

  it("lets a responder's Substitution land ahead of the attack it answers — and moving it behind makes it too late", () => {
    const setup = () => {
      let s = withChakra(trustMain1(), 'p1', 2);
      const sub = withCard(s, 'p2', 'substitution');
      s = withChakra(sub.state, 'p2', 4);
      // p1 declares two attacks: one at Hidan, one at Kakuzu (p2's enabler). Finalizing prompts p2, who can respond.
      s = run(s, stage(['p2-hidan']), stage(['p2-kakuzu']), { type: 'RESOLVE_ACTIONS', player: 'p1' });
      expect(s.pendingFinalize).not.toBeNull();
      return { s, sub };
    };
    const kakuzuHp = (s: GameState) => hp(s, 'p2', 'p2-kakuzu');

    // Default placement: right ahead of the attack aimed at Kakuzu, so it negates it.
    let { s, sub } = setup();
    const before = kakuzuHp(s);
    s = run(s, { type: 'STAGE_CARD', instanceId: sub.instanceId, enablingInstanceId: 'p2-kakuzu', targetInstanceIds: [], payFromPool: 0 });
    expect(kakuzuHp(s)).toBe(before);

    // Same response, but the responder chooses to slot it in *after* that attack — too late to help.
    ({ s, sub } = setup());
    // Hold the round open so p2 can reposition before it resolves: p1 reopens, p2 declares, moves it later, p1 resolves again.
    s = run(s, { type: 'CANCEL_FINALIZE', player: 'p1' });
    s = run(s, { type: 'STAGE_CARD', instanceId: sub.instanceId, enablingInstanceId: 'p2-kakuzu', targetInstanceIds: [], payFromPool: 0 });
    expect(s.staged.map((a) => a.kind + ':' + (a.cardDefId ?? a.abilityId))).toEqual(['ability:earth-grudge-fear', 'card:substitution', 'ability:earth-grudge-fear']);
    s = run(s, { type: 'MOVE_STAGED', stagedId: s.staged[1].id, direction: 'later' });
    expect(s.staged[2].kind).toBe('card');
    s = run(s, { type: 'RESOLVE_ACTIONS', player: 'p1' }, { type: 'APPROVE_RESOLVE', player: 'p2' });
    expect(kakuzuHp(s)).toBe(before - 1);
    expect(s.log.some((l) => /finds nothing left to negate/.test(l.text))).toBe(true);
  });
});

describe('trust mode: turn flow', () => {
  it('Finalize Phase with nothing declared just advances; with Auto-draw off a new turn runs Untap/Upkeep and waits at Draw for the manual draw', () => {
    let s = run(trustMain1(), { type: 'SET_OPTION', option: 'autoDraw', value: false });
    s = run(s, { type: 'FINALIZE_PHASE', player: 'p1' }); // Main1 -> Combat
    s = run(s, { type: 'FINALIZE_PHASE', player: 'p1' }); // -> Main2
    s = run(s, { type: 'FINALIZE_PHASE', player: 'p1' }); // -> End
    expect(s.phase).toBe('End');
    s = run(s, { type: 'FINALIZE_PHASE', player: 'p1' }); // -> p2's turn: Untap/Upkeep run automatically
    expect(s.activePlayer).toBe('p2');
    expect(s.phase).toBe('Draw');
    expect(s.turn).toBe(2);
    const deckBefore = s.players.p2.handDeck.length;
    s = run(s, { type: 'DRAW_PHASE_CARD' });
    expect(s.players.p2.handDeck.length).toBe(Math.max(0, deckBefore - 1));
    expect(s.phase).toBe('Main1');
  });

  it("only the active player can finalize", () => {
    const s = run(trustMain1(), { type: 'FINALIZE_PHASE', player: 'p2' });
    expect(s.phase).toBe('Main1');
    expect(s.pendingFinalize).toBeNull();
  });

  it('lets either player tap their own Chakra source at any time', () => {
    let s = withChakra(trustMain1(), 'p2', 0, 2);
    s = run(s, { type: 'TAP_CHAKRA_SOURCE', sourceIndex: 0, player: 'p2' }); // p1's turn, p2 taps
    expect(s.players.p2.genericChakraAvailable).toBe(1);
    expect(s.players.p2.chakraSources[0].tapped).toBe(true);
  });
});

describe('trust mode: manual adjustments and deck tools', () => {
  it('adjusts HP, Pool, Health, and Chakra, all logged as manual', () => {
    let s = trustMain1();
    const maxHp = s.players.p1.backRow[0]!.maxHP;
    s = run(s, { type: 'ADJUST_HP', instanceId: 'p1-kakuzu', delta: -2 });
    expect(hp(s, 'p1', 'p1-kakuzu')).toBe(maxHp - 2);
    s = run(s, { type: 'ADJUST_HP', instanceId: 'p1-kakuzu', delta: 99 });
    expect(hp(s, 'p1', 'p1-kakuzu')).toBe(maxHp); // capped at max
    s = run(s, { type: 'ADJUST_POOL', instanceId: 'p1-kakuzu', delta: 2 }, { type: 'ADJUST_PLAYER_HEALTH', player: 'p1', delta: -3 }, { type: 'ADJUST_GENERIC_CHAKRA', player: 'p1', delta: 2 });
    expect(s.players.p1.backRow[0]!.chakraPool.current).toBe(2);
    expect(s.players.p1.health).toBe(17);
    expect(s.players.p1.genericChakraAvailable).toBe(2);
    expect(s.log.filter((l) => l.text.startsWith('(manual)')).length).toBeGreaterThanOrEqual(4);
    s = run(s, { type: 'TOGGLE_STATUS', instanceId: 'p1-hidan', status: 'disabled' });
    expect(s.players.p1.backRow[1]!.status.disabled).toBe(true);
  });

  it('searches the deck, looks at the top, moves cards between zones, and shuffles', () => {
    let s = trustMain1();
    const cards = ['substitution', 'chakra-transfer', 'explosive-tag'].map((d) => makeHandCardInstance(d));
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, handDeck: cards, hand: [] } } };

    s = run(s, { type: 'DECK_TO_BOTTOM', player: 'p1', instanceId: cards[0].instanceId });
    expect(s.players.p1.handDeck.map((c) => c.defId)).toEqual(['chakra-transfer', 'explosive-tag', 'substitution']);

    s = run(s, { type: 'DECK_TAKE', player: 'p1', instanceId: cards[2].instanceId, shuffle: true });
    expect(s.players.p1.hand.map((h) => h.instanceId)).toEqual([cards[2].instanceId]);
    expect(s.players.p1.handDeck).toHaveLength(2);

    s = run(s, { type: 'MOVE_HAND_CARD', player: 'p1', instanceId: cards[2].instanceId, to: 'discard' });
    expect(s.players.p1.discardPile).toHaveLength(1);
    s = run(s, { type: 'RETURN_FROM_DISCARD', player: 'p1', instanceId: cards[2].instanceId });
    expect(s.players.p1.hand).toHaveLength(1);

    s = run(s, { type: 'DRAW_CARDS', player: 'p1', count: 2 }, { type: 'SHUFFLE_DECK', player: 'p1' });
    expect(s.players.p1.hand).toHaveLength(3);
    expect(s.players.p1.handDeck).toHaveLength(0);
  });

  it('ignores trust-only actions in strict mode', () => {
    const strict = freshMain1();
    const after = gameReducer(strict, { type: 'ADJUST_HP', instanceId: 'p1-kakuzu', delta: -2 });
    expect(after.players.p1.backRow[0]!.currentHP).toBe(strict.players.p1.backRow[0]!.currentHP);
  });
});

describe('redaction with cards on the stack', () => {
  it('produces a fully serializable state even when the stack holds resolve closures', () => {
    let s = withChakra(freshCombat(), 'p1', 5);
    s = gameReducer(s, { type: 'ACTIVATE_ABILITY', instanceId: 'p1-kakuzu', abilityId: 'earth-grudge-fear', targetInstanceIds: ['p2-hidan'], payFromPool: 0 });
    expect(s.stack).toHaveLength(1);
    const view = redactStateFor(s, 'p2');
    expect(view.stack).toHaveLength(1);
    expect(typeof (view.stack[0] as { resolve?: unknown }).resolve).toBe('undefined');
    expect(() => JSON.parse(JSON.stringify(view))).not.toThrow();
  });
});

describe('Trust mode flags illegal pooling and acting after pooling', () => {
  const warnings = (s: GameState) => s.log.filter((l) => l.warning).map((l) => l.text);

  it('pooling into a unit that already acted goes through, with a warning', () => {
    let s = giveChakra({ ...freshMain1(), rules: 'trust' }, 'p1', 5);
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c, i) => (i === 0 && c ? { ...c, status: { ...c.status, usedAbilitiesThisTurn: ['earth-grudge-fear'] } } : c)) } } };
    const poolBefore = s.players.p1.backRow[0]!.chakraPool.current;
    s = gameReducer(s, { type: 'POOL_CHAKRA', instanceId: 'p1-kakuzu', amount: 1 });
    expect(s.players.p1.backRow[0]!.chakraPool.current).toBe(poolBefore + 1);
    expect(warnings(s).some((w) => w.includes('already acted'))).toBe(true);
  });

  it('declaring an ability for a unit pooled into this turn raises a warning', () => {
    let s = giveChakra({ ...freshMain1(), rules: 'trust' }, 'p1', 5);
    s = gameReducer(s, { type: 'POOL_CHAKRA', instanceId: 'p1-kakuzu', amount: 1 });
    s = gameReducer(s, { type: 'STAGE_ABILITY', instanceId: 'p1-kakuzu', abilityId: 'earth-grudge-fear', targetInstanceIds: ['p2-hidan'], payFromPool: 0 });
    expect(warnings(s).some((w) => w.includes('pooled into this turn'))).toBe(true);
  });
});

describe('Always confirm', () => {
  const declareAndFinalize = (s: GameState) =>
    run(
      giveChakra(s, 'p1', 3),
      { type: 'STAGE_ABILITY', instanceId: 'p1-deidara', abilityId: 'explosive-clay', targetInstanceIds: [], payFromPool: 0 },
      { type: 'FINALIZE_PHASE', player: 'p1' },
    );

  it("off (default): a player with nothing to respond with is approved for automatically", () => {
    const s = declareAndFinalize(trustMain1());
    expect(s.pendingFinalize).toBeNull();
  });

  it('on: the round waits for the other player to confirm', () => {
    let s = declareAndFinalize(run(trustMain1(), { type: 'SET_OPTION', option: 'alwaysConfirm', value: true }));
    expect(s.pendingFinalize).not.toBeNull();
    expect(s.pendingFinalize!.approvals).not.toContain('p2');
    s = run(s, { type: 'APPROVE_RESOLVE', player: 'p2' });
    expect(s.pendingFinalize).toBeNull();
  });
});

describe('Clicking a phase', () => {
  it('jumps forward through the phases in between', () => {
    const s = run(freshMain1(), { type: 'GO_TO_PHASE', phase: 'Main2' });
    expect(s.phase).toBe('Main2');
  });

  it('going back is refused under the strict rules', () => {
    const s = run(freshMain1(), { type: 'GO_TO_PHASE', phase: 'Main2' }, { type: 'GO_TO_PHASE', phase: 'Main1' });
    expect(s.phase).toBe('Main2');
  });

  it('going back is allowed in trust mode, with a warning', () => {
    const s = run(trustMain1(), { type: 'GO_TO_PHASE', phase: 'Combat' }, { type: 'GO_TO_PHASE', phase: 'Main1' });
    expect(s.phase).toBe('Main1');
    expect(s.log.at(-1)!.warning).toBe(true);
  });
});

describe('Setup picks stay secret until both players confirm', () => {
  it("the opponent can't see your starting character, or read it in the log, until both have confirmed", async () => {
    const { createSetupState } = await import('../../src/engine/state');
    let s = createSetupState(undefined, 'strict');
    const pick = s.players.p2.pendingCharacterReveal!.revealed[0];
    s = gameReducer(s, { type: 'CHOOSE_CHARACTER', player: 'p2', entryId: pick });
    const seenByP1 = redactStateFor(s, 'p1');
    expect(seenByP1.players.p2.backRow.every((c) => c === null)).toBe(true);
    expect(seenByP1.players.p2.frontRow.every((t) => t === null)).toBe(true);
    expect(s.log.some((l) => l.text === 'p2 has chosen their starting character.')).toBe(true);

    s = gameReducer(s, { type: 'CHOOSE_CHARACTER', player: 'p1', entryId: s.players.p1.pendingCharacterReveal!.revealed[0] });
    expect(redactStateFor(s, 'p1').players.p2.backRow.some((c) => c !== null) || redactStateFor(s, 'p1').players.p2.frontRow.some((t) => t !== null)).toBe(true);
    expect(s.log.some((l) => l.text.startsWith('Starting characters revealed'))).toBe(true);
  });
});
