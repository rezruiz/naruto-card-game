import { describe, expect, it } from 'vitest';
import { activateAbility } from '../../src/engine/abilities';
import { gameReducer } from '../../src/engine/reducer';
import { freshCombat, giveChakra, resolveTop, withCharacterAt } from './testUtils';

function withKonan() {
  return withCharacterAt(freshCombat(), 'p1', 0, 'konan'); // replaces p1's Kakuzu slot
}

describe('Konan', () => {
  it('Paper Shuriken Storm deals 2 damage to up to 2 targets', () => {
    let state = giveChakra(withKonan(), 'p1', 2);
    const hidanHpBefore = state.players.p2.backRow[1]!.currentHP;
    const deidaraHpBefore = state.players.p2.backRow[2]!.currentHP;
    state = activateAbility(state, 'p1-konan', 'paper-shuriken-storm', ['p2-hidan', 'p2-deidara'], 0);
    state = resolveTop(state);
    expect(state.players.p2.backRow[1]!.currentHP).toBe(hidanHpBefore - 2);
    expect(state.players.p2.backRow[2]!.currentHP).toBe(deidaraHpBefore - 2);
  });

  it('Fold Shikigami is usable twice per turn and generates a Charge each time', () => {
    let state = giveChakra(withKonan(), 'p1', 2);
    expect(state.players.p1.backRow[0]!.extra.shikigamiCharges).toBe(1); // Origami Mastery
    state = activateAbility(state, 'p1-konan', 'fold-shikigami', [], 0);
    state = resolveTop(state);
    state = activateAbility(state, 'p1-konan', 'fold-shikigami', [], 0);
    state = resolveTop(state);
    expect(state.players.p1.backRow[0]!.extra.shikigamiCharges).toBe(3);

    const stackBefore = state.stack.length;
    state = activateAbility(state, 'p1-konan', 'fold-shikigami', [], 0);
    expect(state.stack.length).toBe(stackBefore); // 3rd this turn rejected
  });

  it('Paper Bomb Tag deals 5 (not 3) and spends a Charge when the player chooses to', () => {
    let state = giveChakra(withKonan(), 'p1', 3);
    const targetHpBefore = state.players.p2.backRow[0]!.currentHP;
    state = activateAbility(state, 'p1-konan', 'paper-bomb-tag', ['p2-kakuzu'], 0, { choices: { spendCharge: true } });
    state = resolveTop(state);
    expect(state.players.p2.backRow[0]!.currentHP).toBe(targetHpBefore - 5);
    expect(state.players.p1.backRow[0]!.extra.shikigamiCharges).toBe(0); // spent
  });

  it('Paper Bomb Tag keeps the Charge and deals the base 3 when the player declines', () => {
    let state = giveChakra(withKonan(), 'p1', 3);
    const targetHpBefore = state.players.p2.backRow[0]!.currentHP;
    state = activateAbility(state, 'p1-konan', 'paper-bomb-tag', ['p2-kakuzu'], 0, { choices: { spendCharge: false } });
    state = resolveTop(state);
    expect(state.players.p2.backRow[0]!.currentHP).toBe(targetHpBefore - 3);
    expect(state.players.p1.backRow[0]!.extra.shikigamiCharges).toBe(1); // kept
  });

  it('Paper Clone negates an enemy ability targeting Konan (no once-per-attacker limit)', () => {
    let state = withKonan();
    state = {
      ...state,
      players: {
        ...state.players,
        p1: {
          ...state.players.p1,
          backRow: state.players.p1.backRow.map((c, i) => (i === 0 && c ? { ...c, extra: { ...c.extra, shikigamiCharges: 2 } } : c)),
        },
      },
    };
    state = { ...state, activePlayer: 'p2', priorityPlayer: 'p2' };
    state = giveChakra(state, 'p2', 3);
    state = activateAbility(state, 'p2-kakuzu', 'earth-grudge-fear', ['p1-konan'], 0);
    expect(state.stack).toHaveLength(1);

    state = giveChakra(state, 'p1', 2);
    state = activateAbility(state, 'p1-konan', 'paper-clone', [], 0);
    expect(state.stack).toHaveLength(2);

    const konanHpBefore = state.players.p1.backRow[0]!.currentHP;
    state = gameReducer(state, { type: 'PASS_PRIORITY' });
    state = gameReducer(state, { type: 'PASS_PRIORITY' }); // resolves Paper Clone, negating Earth Grudge Fear
    expect(state.stack).toHaveLength(0);
    expect(state.players.p1.backRow[0]!.currentHP).toBe(konanHpBefore);
    expect(state.players.p1.backRow[0]!.extra.shikigamiCharges).toBe(0); // spent 2 (started at 2 via patch)
  });

  it('Paper Person of God Technique hits immediately for 3, then again at the End Phase of the opponent\'s next turn', () => {
    let state = withKonan();
    state = {
      ...state,
      players: {
        ...state.players,
        p1: {
          ...state.players.p1,
          backRow: state.players.p1.backRow.map((c, i) =>
            i === 0 && c ? { ...c, chakraPool: { current: c.chakraPool.capacity, capacity: c.chakraPool.capacity }, extra: { ...c.extra, shikigamiCharges: 4 } } : c,
          ),
        },
      },
    };
    state = giveChakra(state, 'p1', 6);

    // Deidara/Itachi (not Kakuzu or Hidan) — Kakuzu's Five Hearts would
    // intercept a lethal-looking hit, and Hidan's own End Phase regen (which
    // fires on his controller's End Phase, i.e. exactly when the delayed hit
    // also lands) would muddy the HP math here.
    const deidaraHpBefore = state.players.p2.backRow[2]!.currentHP;
    const itachiHpBefore = state.players.p2.backRow[4]!.currentHP;
    state = activateAbility(state, 'p1-konan', 'paper-person-of-god-technique', [], 0);
    expect(state.stack).toHaveLength(1);
    state = resolveTop(state);

    expect(state.players.p2.backRow[2]!.currentHP).toBe(deidaraHpBefore - 3);
    expect(state.players.p2.backRow[4]!.currentHP).toBe(itachiHpBefore - 3);

    // Advance to the End Phase of p2's (the opponent's) next turn: p1's
    // remaining phases (Main2, End = 2 from Combat) then p2's Untap..End (7) = 9.
    for (let i = 0; i < 9; i++) state = gameReducer(state, { type: 'ADVANCE_PHASE' });
    expect(state.activePlayer).toBe('p2');
    expect(state.phase).toBe('End');

    expect(state.players.p2.backRow[2]!.currentHP).toBe(deidaraHpBefore - 6);
    expect(state.players.p2.backRow[4]!.currentHP).toBe(itachiHpBefore - 6);
    expect(state.players.p1.backRow[0]!.extra.paperPersonPending).toBe(false);
  });
});
