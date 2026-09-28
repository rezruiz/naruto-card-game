import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../src/engine/state';
import { dealDamage, healOccupant } from '../../src/engine/combat';
import { placeToken } from '../../src/engine/board';
import type { TokenInstance } from '../../src/engine/types';

function makeToken(id: string, ownerInstanceId: string): TokenInstance {
  return {
    instanceId: id,
    defId: 'test-token',
    owner: 'p1',
    name: id,
    maxHP: 1,
    currentHP: 1,
    ownerCharacterInstanceId: ownerInstanceId,
    status: { disabled: false, retreated: false, enteredTurn: 1, hasAmbush: false, usedAbilitiesThisTurn: [], pooledThisTurn: false },
    extra: {},
  };
}

describe('dealDamage', () => {
  it('reduces currentHP and reports the amount dealt', () => {
    const state = createInitialState('p1');
    const { state: next, dealt, defeated } = dealDamage(state, 'p1-hidan', 3);
    expect(next.players.p1.backRow[1]?.currentHP).toBe(6); // Hidan HP 9
    expect(dealt).toBe(3);
    expect(defeated).toBe(false);
  });

  it('defeats a character with no defeat-replacement hook once HP hits 0', () => {
    const state = createInitialState('p1');
    const { state: next, defeated } = dealDamage(state, 'p1-deidara', 10); // Deidara HP 10, no hook
    expect(defeated).toBe(true);
    expect(next.players.p1.backRow[2]).toBeNull();
    expect(next.players.p1.health).toBe(15); // A rank: -5 Health
  });

  it("Kakuzu's Five Hearts intercepts lethal damage and revives instead of dying", () => {
    const state = createInitialState('p1');
    const { state: next, defeated } = dealDamage(state, 'p1-kakuzu', 100); // Kakuzu HP 6
    expect(defeated).toBe(false);
    const kakuzu = next.players.p1.backRow[0];
    expect(kakuzu).not.toBeNull();
    expect(kakuzu?.currentHP).toBe(kakuzu?.maxHP); // revives at full HP
    expect(kakuzu?.extra.hearts).toBe(4); // lost 1 of 5 Hearts
    expect(next.players.p1.health).toBe(20); // no player-Health loss — not a true defeat
  });

  it("Kakuzu's last Heart is a true defeat", () => {
    let state = createInitialState('p1');
    // Burn through all 5 Hearts.
    for (let i = 0; i < 4; i++) {
      state = dealDamage(state, 'p1-kakuzu', 100).state;
    }
    expect(state.players.p1.backRow[0]?.extra.hearts).toBe(1);
    const { state: next, defeated } = dealDamage(state, 'p1-kakuzu', 100);
    expect(defeated).toBe(true);
    expect(next.players.p1.backRow[0]).toBeNull();
  });

  it("Hidan's Jashin's Blessing survives his first defeat at 1 HP, but not a second", () => {
    let state = createInitialState('p1');
    let result = dealDamage(state, 'p1-hidan', 100); // Hidan HP 9
    expect(result.defeated).toBe(false);
    expect(result.state.players.p1.backRow[1]?.currentHP).toBe(1);
    expect(result.state.players.p1.backRow[1]?.extra.usedSafetyNet).toBe(true);

    result = dealDamage(result.state, 'p1-hidan', 5);
    expect(result.defeated).toBe(true);
    expect(result.state.players.p1.backRow[1]).toBeNull();
  });

  it('a token fizzles when the character that created it is defeated', () => {
    let state = createInitialState('p1');
    state = placeToken(state, 'p1', makeToken('tok-1', 'p1-deidara'));
    expect(state.players.p1.frontRow[0]?.instanceId).toBe('tok-1');

    state = dealDamage(state, 'p1-deidara', 100).state;
    expect(state.players.p1.backRow[2]).toBeNull();
    expect(state.players.p1.frontRow[0]).toBeNull();
  });
});

describe('healOccupant', () => {
  it('heals up to maxHP and no further', () => {
    let state = createInitialState('p1');
    state = dealDamage(state, 'p1-hidan', 5).state; // 9 -> 4
    state = healOccupant(state, 'p1-hidan', 100);
    expect(state.players.p1.backRow[1]?.currentHP).toBe(9);
  });
});
