import { describe, expect, it } from 'vitest';
import { activateAbility } from '../../src/engine/abilities';
import { dealDamage } from '../../src/engine/combat';
import { gameReducer } from '../../src/engine/reducer';
import { placeToken } from '../../src/engine/board';
import { makeThirdKazekage } from '../../src/engine/characters';
import { freshCombat, giveChakra, resolveTop, withCharacterAt } from './testUtils';

function withSasori() {
  return withCharacterAt(freshCombat(), 'p1', 0, 'sasori-hiruko'); // replaces p1's Kakuzu slot
}

// SPEC.md: Sasori's Chakra Strings: Third Kazekage trait creates this token
// automatically "when Sasori enters play" — no onEnterPlay hook/action exists
// in the engine yet (no Setup/deck/play-a-character system built), so tests
// place it explicitly, the same way a future Setup step would.
function withSasoriAndKazekage() {
  let state = withSasori();
  const token = makeThirdKazekage('p1', 'p1-sasori-hiruko');
  state = placeToken(state, 'p1', token);
  return { state, kazekageId: token.instanceId };
}

describe('Sasori', () => {
  it('transforms Hiruko into Hollow Body instead of being defeated, keeping the same instanceId', () => {
    let state = withSasori();
    state = dealDamage(state, 'p1-sasori-hiruko', 7).state; // exactly lethal for Hiruko's 7 HP
    const sasori = state.players.p1.backRow[0]!;
    expect(sasori.instanceId).toBe('p1-sasori-hiruko');
    expect(sasori.defId).toBe('sasori-hollow-body');
    expect(sasori.currentHP).toBe(4);
    expect(sasori.maxHP).toBe(4);
  });

  it("Third Kazekage doesn't fizzle when Hiruko transforms, but does fizzle when Hollow Body is truly defeated", () => {
    let { state, kazekageId } = withSasoriAndKazekage();
    state = dealDamage(state, 'p1-sasori-hiruko', 7).state; // transform, not a true defeat
    expect(state.players.p1.frontRow.some((t) => t?.instanceId === kazekageId)).toBe(true);

    state = dealDamage(state, 'p1-sasori-hiruko', 4).state; // Hollow Body's own 4 HP — true defeat
    expect(state.players.p1.backRow[0]).toBeNull();
    expect(state.players.p1.frontRow.some((t) => t?.instanceId === kazekageId)).toBe(false);
  });

  it('Tail Strike deals 2 damage and applies 2 Poison counters, which tick at ANY Upkeep (not just the controller\'s)', () => {
    let state = giveChakra(withSasori(), 'p1', 3);
    const hpBefore = state.players.p2.backRow[0]!.currentHP;
    state = activateAbility(state, 'p1-sasori-hiruko', 'tail-strike', ['p2-kakuzu'], 0);
    state = resolveTop(state);
    expect(state.players.p2.backRow[0]!.currentHP).toBe(hpBefore - 2);
    expect(state.players.p2.backRow[0]!.extra.poisonCounters).toBe(2);

    // Advance to p1's own Untap->Upkeep (poison ticks even though it's not
    // the poisoned character's (p2's) own Upkeep).
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // Combat
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // Main2
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // End
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // p2 Untap
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // p2 Upkeep — poison ticks here
    expect(state.players.p2.backRow[0]!.currentHP).toBe(hpBefore - 3); // 2 + 1 poison tick
    expect(state.players.p2.backRow[0]!.extra.poisonCounters).toBe(1);
  });

  it('Puppet Shell Guard negates a Ninjutsu/Physical attack targeting Third Kazekage', () => {
    let { state, kazekageId } = withSasoriAndKazekage();
    state = { ...state, activePlayer: 'p2', priorityPlayer: 'p2' };
    state = giveChakra(state, 'p2', 3);
    state = activateAbility(state, 'p2-kakuzu', 'earth-grudge-fear', [kazekageId], 0);
    expect(state.stack).toHaveLength(1);

    state = giveChakra(state, 'p1', 2);
    state = activateAbility(state, 'p1-sasori-hiruko', 'puppet-shell-guard', [], 0);
    expect(state.stack).toHaveLength(2);

    const kazekageHpBefore = state.players.p1.frontRow.find((t) => t?.instanceId === kazekageId)!.currentHP;
    state = gameReducer(state, { type: 'PASS_PRIORITY' });
    state = gameReducer(state, { type: 'PASS_PRIORITY' }); // resolves Puppet Shell Guard, negating the attack
    expect(state.stack).toHaveLength(0);
    expect(state.players.p1.frontRow.find((t) => t?.instanceId === kazekageId)!.currentHP).toBe(kazekageHpBefore);
  });

  it('Iron Sand Wall reduces the next hit against a friendly unit by 2', () => {
    let { state, kazekageId } = withSasoriAndKazekage();
    state = { ...state, activePlayer: 'p2', priorityPlayer: 'p2' };
    state = giveChakra(state, 'p2', 4);
    state = activateAbility(state, 'p2-kakuzu', 'searing-migraine', ['p1-hidan'], 0); // 4 damage, Ninjutsu
    expect(state.stack).toHaveLength(1);

    state = giveChakra(state, 'p1', 3);
    state = activateAbility(state, kazekageId, 'iron-sand-wall', ['p1-hidan'], 0);
    expect(state.stack).toHaveLength(2);

    const hidanHpBefore = state.players.p1.backRow[1]!.currentHP;
    state = gameReducer(state, { type: 'PASS_PRIORITY' });
    state = gameReducer(state, { type: 'PASS_PRIORITY' }); // resolves Iron Sand Wall
    state = gameReducer(state, { type: 'PASS_PRIORITY' });
    state = gameReducer(state, { type: 'PASS_PRIORITY' }); // resolves Searing Migraine, reduced by 2
    expect(state.players.p1.backRow[1]!.currentHP).toBe(hidanHpBefore - 2); // 4 - 2
  });

  it('Chakra Strings: Puppet Summon is capped at 3 Puppet Soldiers', () => {
    let state = giveChakra(withSasori(), 'p1', 3);
    // Transform to Hollow Body first — Puppet Summon only exists on that form.
    state = dealDamage(state, 'p1-sasori-hiruko', 7).state;
    state = {
      ...state,
      players: {
        ...state.players,
        p1: {
          ...state.players.p1,
          backRow: state.players.p1.backRow.map((c, i) => (i === 0 && c ? { ...c, status: { ...c.status, enteredTurn: -1 } } : c)),
          // Pre-place 3 Puppet Soldiers directly, since the ability's own
          // once-per-turn cap (unrelated to the 3-in-play cap being tested
          // here) would otherwise block back-to-back activations this turn.
          frontRow: state.players.p1.frontRow.map((_, i) =>
            i < 3
              ? {
                  instanceId: `puppet-soldier-test-${i}`,
                  defId: 'puppet-soldier',
                  owner: 'p1' as const,
                  name: 'Puppet Soldier',
                  maxHP: 2,
                  currentHP: 2,
                  ownerCharacterInstanceId: 'p1-sasori-hiruko',
                  status: { disabled: false, retreated: false, enteredTurn: -1, hasAmbush: false, usedAbilitiesThisTurn: [], pooledThisTurn: false },
                  extra: {},
                }
              : null,
          ),
        },
      },
    };
    expect(state.players.p1.frontRow.filter((t) => t?.defId === 'puppet-soldier')).toHaveLength(3);

    const stackBefore = state.stack.length;
    state = activateAbility(state, 'p1-sasori-hiruko', 'chakra-strings-puppet-summon', [], 0);
    expect(state.stack.length).toBe(stackBefore); // capped, rejected
  });
});
