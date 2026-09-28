import { afterEach, describe, expect, it, vi } from 'vitest';
import { activateAbility } from '../../src/engine/abilities';
import { gameReducer } from '../../src/engine/reducer';
import { freshCombat, giveChakra, resolveTop, withCharacterAt } from './testUtils';

function withJuzo() {
  return withCharacterAt(freshCombat(), 'p1', 0, 'juzo'); // replaces p1's Kakuzu slot
}

function setHp(state: ReturnType<typeof withJuzo>, player: 'p1' | 'p2', index: number, hp: number) {
  return {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...state.players[player],
        backRow: state.players[player].backRow.map((c, i) => (i === index && c ? { ...c, currentHP: hp } : c)),
      },
    },
  };
}

describe('Juzo Biwa', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Cleaving Strike's kill bonus (heal 3, splash 1) only fires if it defeats the primary target", () => {
    // Deidara (not Kakuzu/Hidan) — neither has an onWouldBeDefeated hook, so
    // a lethal hit actually removes it instead of reviving/surviving it.
    let state = giveChakra(withJuzo(), 'p1', 3);
    state = setHp(state, 'p1', 0, 5); // Juzo hurt, so the heal is visible (not capped by max HP)
    state = setHp(state, 'p2', 2, 3); // Deidara at exactly 3 HP — 3 damage kills it
    const hidanHpBefore = state.players.p2.backRow[1]!.currentHP;

    state = activateAbility(state, 'p1-juzo', 'cleaving-strike', ['p2-deidara', 'p2-hidan'], 0);
    state = resolveTop(state);

    expect(state.players.p2.backRow[2]).toBeNull(); // defeated
    expect(state.players.p1.backRow[0]!.currentHP).toBe(8); // healed 5 -> 8
    expect(state.players.p2.backRow[1]!.currentHP).toBe(hidanHpBefore - 1); // splash
  });

  it('Cleaving Strike is usable twice per turn, not three times', () => {
    let state = giveChakra(withJuzo(), 'p1', 6);
    state = activateAbility(state, 'p1-juzo', 'cleaving-strike', ['p2-kakuzu'], 0);
    state = resolveTop(state);
    state = activateAbility(state, 'p1-juzo', 'cleaving-strike', ['p2-kakuzu'], 0);
    state = resolveTop(state);

    const stackBefore = state.stack.length;
    state = activateAbility(state, 'p1-juzo', 'cleaving-strike', ['p2-kakuzu'], 0);
    expect(state.stack.length).toBe(stackBefore);
  });

  it('Hiding Mist gives attackers a coin flip to fail targeting Juzo, through end of turn', () => {
    let state = giveChakra(withJuzo(), 'p1', 2);
    state = activateAbility(state, 'p1-juzo', 'hiding-mist', [], 0);
    state = resolveTop(state);
    expect(state.players.p1.backRow[0]!.extra.evasiveActive).toBe(true);

    state = { ...state, activePlayer: 'p2', priorityPlayer: 'p2' };
    state = giveChakra(state, 'p2', 5);

    vi.spyOn(Math, 'random').mockReturnValue(0.1); // below 0.5 — targeting fails (evaded)
    const stackBefore = state.stack.length;
    state = activateAbility(state, 'p2-kakuzu', 'earth-grudge-fear', ['p1-juzo'], 0);
    expect(state.stack.length).toBe(stackBefore); // evaded

    vi.spyOn(Math, 'random').mockReturnValue(0.9); // above 0.5 — targeting connects
    state = activateAbility(state, 'p2-kakuzu', 'earth-grudge-fear', ['p1-juzo'], 0);
    expect(state.stack.length).toBe(stackBefore + 1);
  });

  it('Hiding Mist clears at Juzo\'s own End Phase', () => {
    let state = giveChakra(withJuzo(), 'p1', 2);
    state = activateAbility(state, 'p1-juzo', 'hiding-mist', [], 0);
    state = resolveTop(state);
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // Combat
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // Main2
    state = gameReducer(state, { type: 'ADVANCE_PHASE' }); // End — clears here
    expect(state.players.p1.backRow[0]!.extra.evasiveActive).toBe(false);
  });

  it('Kubikiribōchō Unleashed deals 5, and on a kill heals 3 (trait) + 6 (own clause) = 9', () => {
    let state = giveChakra(withJuzo(), 'p1', 5);
    state = setHp(state, 'p1', 0, 1); // Juzo hurt, so the heal is visible
    state = setHp(state, 'p2', 2, 5); // Deidara at exactly 5 HP — 5 damage kills it

    state = activateAbility(state, 'p1-juzo', 'kubikiribouchou-unleashed', ['p2-deidara'], 0);
    state = resolveTop(state);

    expect(state.players.p2.backRow[2]).toBeNull();
    expect(state.players.p1.backRow[0]!.currentHP).toBe(Math.min(1 + 9, state.players.p1.backRow[0]!.maxHP));
  });
});
