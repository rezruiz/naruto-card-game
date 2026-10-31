import { describe, expect, it } from 'vitest';
import { activateAbility } from '../../src/engine/abilities';
import { gameReducer } from '../../src/engine/reducer';
import { drawCard, makeHandCardInstance } from '../../src/engine/deck';
import { dealDamage } from '../../src/engine/combat';
import { getAdjacent, legalCharacterSlots, legalTokenSlots, maxCharacters, placeCharacter, placeToken } from '../../src/engine/board';
import { previewUpkeep } from '../../src/engine/upkeep';
import { attackBlocker, shinobiDamage } from '../../src/engine/shinobi';
import { makeThirdKazekage } from '../../src/engine/characters';
import { charactersRemaining, suppliesAvailable, suppliesMax } from '../../src/engine/prototype';
import { currentTax } from '../../src/engine/playCharacter';
import { canBeChakraSource, getHandCardDef, needsEnablingCharacter, paysInChakra } from '../../src/engine/cards/registry';
import { checkHandCardLegality, resolveCost as cardCost } from '../../src/engine/cards/playHandCard';
import { createSetupState } from '../../src/engine/state';
import { freshCombat, freshMain1, giveChakra, resolveTop, withCharacterAt } from './testUtils';
import type { GameState, PlayerId, TokenInstance } from '../../src/engine/types';

// Prototype rules (engine/prototype.ts, engine/shinobi.ts) — only for games created with ruleset 'prototype'.

const proto = (s: GameState): GameState => ({ ...s, ruleset: 'prototype' });

function withPool(state: GameState, id: string, amount: number): GameState {
  const patch = (p: GameState['players']['p1']) => ({ ...p, backRow: p.backRow.map((c) => (c && c.instanceId === id ? { ...c, chakraPool: { ...c.chakraPool, current: amount } } : c)) });
  return { ...state, players: { p1: patch(state.players.p1), p2: patch(state.players.p2) } };
}

function addToHand(state: GameState, player: PlayerId, defId: string) {
  const card = makeHandCardInstance(defId);
  const p = state.players[player];
  return { state: { ...state, players: { ...state.players, [player]: { ...p, hand: [...p.hand, { kind: 'card' as const, instanceId: card.instanceId, defId }] } } }, instanceId: card.instanceId };
}

const unit = (s: GameState, id: string) => [...s.players.p1.backRow, ...s.players.p2.backRow, ...s.players.p1.frontRow, ...s.players.p2.frontRow].find((u) => u?.instanceId === id);
const shinobiOf = (s: GameState, player: PlayerId) => s.players[player].frontRow.filter((t): t is TokenInstance => !!t && t.extra.shinobi === true);

/** Puts a Shinobi straight onto `player`'s front row (no Field Orientation) for combat tests. */
function placeShinobi(state: GameState, player: PlayerId, name: string, damage: number, health: number, slot: number): { state: GameState; id: string } {
  const id = `${player}-test-${name}`;
  const token: TokenInstance = {
    instanceId: id,
    defId: 'shinobi-rain-genin',
    owner: player,
    name,
    maxHP: health,
    currentHP: health,
    ownerCharacterInstanceId: '',
    status: { disabled: false, retreated: false, enteredTurn: 0, hasAmbush: false, usedAbilitiesThisTurn: [], pooledThisTurn: false },
    extra: { shinobi: true, shinobiDamage: damage },
  };
  const frontRow = state.players[player].frontRow.slice();
  frontRow[slot] = token;
  return { state: { ...state, players: { ...state.players, [player]: { ...state.players[player], frontRow } } }, id };
}

describe('Prototype: paying Chakra', () => {
  it("a Leader's ability can't use generic Chakra — only its own Pool", () => {
    const s = { ...proto(giveChakra(freshMain1(), 'p1', 5)), phase: 'Combat' as const };
    expect(activateAbility(s, 'p1-kakuzu', 'earth-grudge-fear', ['p2-hidan'], 0).stack).toHaveLength(0);
    const pooled = activateAbility(withPool(s, 'p1-kakuzu', 2), 'p1-kakuzu', 'earth-grudge-fear', ['p2-hidan'], 0);
    expect(pooled.stack).toHaveLength(1);
    expect(unit(pooled, 'p1-kakuzu')!.chakraPool!.current).toBe(0);
    expect(pooled.players.p1.genericChakraAvailable).toBe(5); // untouched
  });

  it('a Jutsu with no Style that doesn\'t attack needs no enabler, and is paid with tapped Chakra', () => {
    const s = proto(giveChakra(freshMain1(), 'p1', 5));
    const recon = addToHand(s, 'p1', 'reconnaissance');
    const played = gameReducer(recon.state, { type: 'PLAY_HAND_CARD', instanceId: recon.instanceId, enablingInstanceId: '', targetInstanceIds: [], payFromPool: 0 });
    expect(played.stack).toHaveLength(1);
    expect(played.players.p1.genericChakraAvailable).toBe(4);
    const broke = addToHand(proto(freshMain1()), 'p1', 'reconnaissance');
    expect(gameReducer(broke.state, { type: 'PLAY_HAND_CARD', instanceId: broke.instanceId, enablingInstanceId: '', targetInstanceIds: [], payFromPool: 0 }).stack).toHaveLength(0);
  });

  it('a Jutsu with a Style or an attack, or text about its enabler, still needs one', () => {
    const needs = (id: string) => needsEnablingCharacter(getHandCardDef(id)!, true);
    expect(['fireball-jutsu', 'senbon-volley', 'substitution', 'kunai-deflection'].map(needs)).toEqual([true, true, true, true]);
    expect(['field-intelligence', 'medical-chakra-infusion', 'jutsu-disruption', 'chakra-suppression'].map(needs)).toEqual([false, false, false, false]);
  });

  it("a Jutsu can be paid with tapped Chakra, its enabler's Pool, or both", () => {
    const base = withPool(proto(giveChakra(freshMain1(), 'p1', 1)), 'p1-kisame', 5);
    const play = (payFromPool: number) => {
      const card = addToHand({ ...base, phase: 'Combat' }, 'p1', 'senbon-volley');
      return gameReducer(card.state, { type: 'PLAY_HAND_CARD', instanceId: card.instanceId, enablingInstanceId: 'p1-kisame', targetInstanceIds: ['p2-deidara'], payFromPool });
    };
    const cost = getHandCardDef('senbon-volley')!.cost as number;
    const fromPool = play(cost);
    expect(fromPool.stack).toHaveLength(1);
    expect(unit(fromPool, 'p1-kisame')!.chakraPool!.current).toBe(5 - cost);
    expect(fromPool.players.p1.genericChakraAvailable).toBe(1);
    const mixed = play(cost - 1);
    expect(mixed.stack).toHaveLength(1);
    expect(unit(mixed, 'p1-kisame')!.chakraPool!.current).toBe(5 - (cost - 1));
    expect(mixed.players.p1.genericChakraAvailable).toBe(0);
  });

  it('a Pool discount applies only when paid from the Pool', () => {
    const s = proto(freshMain1());
    const def = getHandCardDef('substitution')!;
    const ctx = { state: s, player: 'p1' as const, enablingInstanceId: 'p1-kisame', targetInstanceIds: [] };
    expect(cardCost(def, ctx, 0)).toBe(4);
    expect(cardCost(def, ctx, 1)).toBe(2);
  });

  describe('an attack Jutsu\'s X comes from the Pool', () => {
    // Kakuzu's Elemental Versatility would otherwise take 1 off these Wind Jutsu.
    const noVersatility = (s: GameState): GameState => ({ ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c) => (c ? { ...c, extra: { ...c.extra, elementalVersatilityUsedTurn: s.turn } } : c)) } } });
    const playBullets = (generic: number, pool: number, targets: string[]) => {
      const base = noVersatility(withPool(proto(giveChakra(freshMain1(), 'p1', generic)), 'p1-kakuzu', pool));
      const card = addToHand({ ...base, phase: 'Combat' }, 'p1', 'jutsu-air-bullets');
      return gameReducer(card.state, { type: 'PLAY_HAND_CARD', instanceId: card.instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: targets, payFromPool: 0 });
    };

    it('takes X from the Pool and the base cost from tapped Chakra', () => {
      const s = playBullets(1, 2, ['p2-deidara', 'p2-deidara']); // 1 + 2
      expect(s.stack).toHaveLength(1);
      expect(unit(s, 'p1-kakuzu')!.chakraPool!.current).toBe(0);
      expect(s.players.p1.genericChakraAvailable).toBe(0);
    });

    it("can't pay X with tapped Chakra", () => {
      const s = playBullets(5, 1, ['p2-deidara', 'p2-deidara']);
      expect(s.stack).toHaveLength(0);
      expect(s.players.p1.genericChakraAvailable).toBe(5);
    });

    it('lets the Pool pay the base cost too', () => {
      const base = noVersatility(withPool(proto(freshMain1()), 'p1-kakuzu', 3));
      const card = addToHand({ ...base, phase: 'Combat' }, 'p1', 'jutsu-air-bullets');
      const s = gameReducer(card.state, { type: 'PLAY_HAND_CARD', instanceId: card.instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: ['p2-deidara', 'p2-deidara'], payFromPool: 3 });
      expect(s.stack).toHaveLength(1);
      expect(unit(s, 'p1-kakuzu')!.chakraPool!.current).toBe(0);
    });

    it('Water Dragon Jutsu costs 1 + X with no discount', () => {
      const s = proto(freshMain1());
      const def = getHandCardDef('water-dragon-jutsu')!;
      const ctx = { state: s, player: 'p1' as const, enablingInstanceId: 'p1-kisame', targetInstanceIds: [], amount: 3 };
      expect(cardCost(def, ctx, 3)).toBe(4);
      expect(def.poolX!(ctx)).toBe(3);
    });

    it('stays out of the base game', () => {
      const def = getHandCardDef('water-dragon-jutsu')!;
      const ctx = { state: freshMain1(), player: 'p1' as const, enablingInstanceId: 'p1-kisame', targetInstanceIds: [], amount: 3 };
      expect(cardCost(def, ctx, 1)).toBe(3);
    });
  });

  it('enabling a Jutsu leaves a Leader free to be pooled into, and the other way round', () => {
    const base = withPool(proto(giveChakra(freshMain1(), 'p1', 5)), 'p1-kakuzu', 2);
    const card = addToHand({ ...base, phase: 'Combat' }, 'p1', 'jutsu-air-bullets');
    const played = gameReducer(card.state, { type: 'PLAY_HAND_CARD', instanceId: card.instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: ['p2-deidara'], payFromPool: 0 });
    expect(played.stack).toHaveLength(1);
    const after = gameReducer({ ...played, stack: [], phase: 'Main2' }, { type: 'POOL_CHAKRA', instanceId: 'p1-kakuzu', amount: 1 });
    expect(unit(after, 'p1-kakuzu')!.chakraPool!.current).toBe(unit(played, 'p1-kakuzu')!.chakraPool!.current + 1);

    const pooled = gameReducer({ ...base, phase: 'Main1' }, { type: 'POOL_CHAKRA', instanceId: 'p1-kakuzu', amount: 1 });
    const second = addToHand({ ...pooled, phase: 'Combat' }, 'p1', 'jutsu-air-bullets');
    const enabled = gameReducer(second.state, { type: 'PLAY_HAND_CARD', instanceId: second.instanceId, enablingInstanceId: 'p1-kakuzu', targetInstanceIds: ['p2-deidara'], payFromPool: 0 });
    expect(enabled.stack).toHaveLength(1);
  });

  it('Medical Chakra Infusion heals a Leader or a Shinobi, but not a plain Token or an enemy', () => {
    const base = proto(giveChakra(freshMain1(), 'p1', 5));
    const placed = placeShinobi(base, 'p1', 'Genin', 1, 5, 0);
    const legal = (target: string, s: GameState = placed.state) => {
      const card = addToHand(s, 'p1', 'medical-chakra-infusion');
      return checkHandCardLegality(card.state, 'p1', card.instanceId, '', [target], 0).ok;
    };
    expect(legal('p1-hidan')).toBe(true);
    expect(legal(placed.id)).toBe(true);
    expect(legal('p2-hidan')).toBe(false);
    const token = makeThirdKazekage('p1', 'p1-hidan');
    expect(legal(token.instanceId, placeToken(placed.state, 'p1', token))).toBe(false);
  });

  describe('Deidara, Prototype', () => {
    describe('C2, Shi-Ryu', () => {
      const flying = () => {
        const s = activateAbility(setCharges(deidara(0, 3, 10), 5), 'p1-deidara', 'c2-shi-ryu', [], 0);
        expect(s.stack).toHaveLength(1);
        return resolveTop(s);
      };
      const setCharges = (s: GameState, clayCharges: number): GameState => ({ ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c) => (c?.defId === 'deidara' ? { ...c, extra: { ...c.extra, clayCharges } } : c)) } } });

      it('spends 3 Chakra from his Pool and 5 Clay Charges, and needs all 5', () => {
        const s = flying();
        expect(unit(s, 'p1-deidara')!.extra.airborne).toBe(true);
        expect(unit(s, 'p1-deidara')!.extra.clayCharges).toBe(0);
        expect(unit(s, 'p1-deidara')!.chakraPool!.current).toBe(0);
        expect(activateAbility(setCharges(deidara(0, 3, 10), 4), 'p1-deidara', 'c2-shi-ryu', [], 0).stack).toHaveLength(0);
      });

      it("enemy Shinobi attacks, Taijutsu and Bukijutsu can't target him", () => {
        const s = { ...flying(), activePlayer: 'p2' as const, priorityPlayer: 'p2' as const, phase: 'Combat' as const };
        const a = placeShinobi(s, 'p2', 'Jonin', 3, 5, 0);
        expect(gameReducer(a.state, { type: 'DECLARE_SHINOBI_ATTACK', attackerId: a.id, targetId: 'p1-deidara' }).shinobiCombat ?? null).toBeNull();
        for (const defId of ['senbon-volley', 'finishing-blow']) {
          const card = addToHand(withPool(a.state, 'p2-kisame', 5), 'p2', defId);
          expect(checkHandCardLegality(card.state, 'p2', card.instanceId, 'p2-kisame', ['p1-deidara'], 2).reason).toMatch(/Airborne/);
        }
      });

      it('Ninjutsu still reaches him, and he stays up however much damage he takes', () => {
        const s = { ...flying(), activePlayer: 'p2' as const, priorityPlayer: 'p2' as const };
        const card = addToHand(withPool(s, 'p2-kisame', 5), 'p2', 'fireball-jutsu');
        expect(checkHandCardLegality(card.state, 'p2', card.instanceId, 'p2-kisame', ['p1-deidara'], 3).reason ?? '').not.toMatch(/Airborne/);
        const hit = dealDamage(s, 'p1-deidara', 9).state;
        expect(unit(hit, 'p1-deidara')!.extra.airborne).toBe(true);
      });

      it('gains 1 Clay Charge at each of your Upkeeps, for free', () => {
        const upkeep = (s: GameState) => gameReducer({ ...s, phase: 'Untap', activePlayer: 'p1', priorityPlayer: 'p1' }, { type: 'ADVANCE_PHASE' });
        const s = upkeep(flying());
        expect(s.phase).toBe('Upkeep');
        expect(unit(s, 'p1-deidara')!.extra.clayCharges).toBe(1);
        expect(unit(s, 'p1-deidara')!.chakraPool!.current).toBe(0);
        expect(unit(upkeep(setCharges(deidara(0, 3, 10), 0)), 'p1-deidara')!.extra.clayCharges).toBe(0); // not Airborne
      });

      it('his other abilities keep their normal Clay Charge costs', () => {
        const s = flying();
        const backRow = s.players.p1.backRow.map((c) => (c?.defId === 'deidara' ? { ...c, chakraPool: { ...c.chakraPool, current: 7 }, status: { ...c.status, usedAbilitiesThisTurn: [] }, extra: { ...c.extra, clayCharges: 1 } } : c));
        expect(activateAbility({ ...s, players: { ...s.players, p1: { ...s.players.p1, backRow } } }, 'p1-deidara', 'c3-shi-suri', ['p2-kakuzu'], 0).stack).toHaveLength(0);
      });

      it("can't be used again while Airborne", () => {
        expect(activateAbility(setCharges(withPool(flying(), 'p1-deidara', 4), 5), 'p1-deidara', 'c2-shi-ryu', [], 0).stack).toHaveLength(0);
      });
    });

    it("Self Detonate pays from Deidara's Pool", () => {
      let s = resolveTop(activateAbility(deidara(0, 5, 10), 'p1-deidara', 'c1-shi-wan', [], 0));
      const spider = s.players.p1.frontRow.find((t) => t?.defId === 'clay-spider')!;
      s = activateAbility(s, spider.instanceId, 'self-detonate', ['p2-hidan'], 0, { choices: { spiders: 1 } });
      expect(s.stack).toHaveLength(1);
      expect(unit(s, 'p1-deidara')!.chakraPool!.current).toBe(2); // 5 − 1 (C1) − 2
    });

    const deidara = (generic: number, pool: number, hp = 3) => {
      const s = withPool(proto(giveChakra(freshCombat(), 'p1', generic)), 'p1-deidara', pool);
      const backRow = s.players.p1.backRow.map((c) => (c?.defId === 'deidara' ? { ...c, currentHP: hp, status: { ...c.status, enteredTurn: 0 }, extra: { ...c.extra, clayCharges: 5 } } : c));
      return { ...s, players: { ...s.players, p1: { ...s.players.p1, backRow } } };
    };

    it('C3 deals 4 to the first unit and 2 to up to 2 others, anywhere on the board, even if the first falls', () => {
      let s = deidara(0, 7, 10);
      const [far, second, first] = [s.players.p2.backRow[0]!.instanceId, s.players.p2.backRow[1]!.instanceId, s.players.p2.backRow[3]!.instanceId];
      const third = s.players.p2.backRow[4]!.instanceId;
      const hp = (id: string, from: GameState) => unit(from, id)!.currentHP;
      const before = { far: hp(far, s), second: hp(second, s), third: hp(third, s) };
      s = { ...s, players: { ...s.players, p2: { ...s.players.p2, backRow: s.players.p2.backRow.map((c) => (c?.instanceId === first ? { ...c, currentHP: 1, extra: { ...c.extra, hearts: 1 } } : c)) } } };
      s = resolveTop(activateAbility(s, 'p1-deidara', 'c3-shi-suri', [first, second, third], 0));
      expect(unit(s, first)).toBeUndefined();
      expect(hp(second, s)).toBe(before.second - 2);
      expect(hp(third, s)).toBe(before.third - 2);
      expect(hp(far, s)).toBe(before.far);
    });

    it('C3 can pick one unit, but not more than 3 or the same unit twice', () => {
      const id = 'p1-deidara';
      expect(activateAbility(deidara(0, 7, 10), id, 'c3-shi-suri', ['p2-kakuzu'], 0).stack).toHaveLength(1);
      expect(activateAbility(deidara(0, 7, 10), id, 'c3-shi-suri', ['p2-kakuzu', 'p2-kakuzu'], 0).stack).toHaveLength(0);
    });

    it('Version 1 pays 6 from the Pool and leaves the rest of it', () => {
      const s = activateAbility(deidara(5, 8), 'p1-deidara', 'death-is-an-explosion-v1', [], 0);
      expect(s.stack).toHaveLength(1);
      expect(s.players.p1.genericChakraAvailable).toBe(5);
      expect(unit(s, 'p1-deidara')!.chakraPool!.current).toBe(2);
    });

    it("Version 1 can't use tapped Chakra", () => {
      expect(activateAbility(deidara(10, 5), 'p1-deidara', 'death-is-an-explosion-v1', [], 0).stack).toHaveLength(0);
    });

    it('Version 2 pays from the Pool, so it works whoever\'s turn it is', () => {
      let s = { ...deidara(0, 7), activePlayer: 'p2' as const, priorityPlayer: 'p2' as const };
      s = dealDamage(s, 'p1-deidara', 3).state;
      s = gameReducer(s, { type: 'RESOLVE_CHOICE', choiceId: s.pendingChoices[0].id, optionIds: ['activate-2'] });
      expect(s.log.some((l) => /Art is an EXPLOSION!" — 6 to every enemy, 5 to every ally/.test(l.text))).toBe(true);
    });

    it.each([
      [0, 4],
      [1, 5],
      [3, 7],
    ])('Version 1 with %i Clay Charges deals %i to every enemy', (spend, damage) => {
      const start = deidara(0, 6);
      const s = resolveTop(activateAbility(start, 'p1-deidara', 'death-is-an-explosion-v1', [], 0, { choices: { clayCharges: spend } }));
      expect(s.log.some((l) => l.text.includes(`${damage} to every enemy, 3 to every ally`))).toBe(true);
    });

    it("can't spend more than 3 Clay Charges on it", () => {
      const s = resolveTop(activateAbility(deidara(0, 6), 'p1-deidara', 'death-is-an-explosion-v1', [], 0, { choices: { clayCharges: 5 } }));
      expect(s.log.some((l) => l.text.includes('7 to every enemy'))).toBe(true);
    });

    it('Version 2 without 6 in the Pool: no prompt, he just falls', () => {
      const s = dealDamage(deidara(20, 5), 'p1-deidara', 3).state;
      expect(s.pendingChoices).toHaveLength(0);
      expect(s.log.some((l) => /Art is an EXPLOSION/.test(l.text))).toBe(false);
      expect(unit(s, 'p1-deidara')).toBeUndefined();
    });

    it('C3 works with 7 in the Pool, not full, and other abilities still ignore tapped Chakra', () => {
      const s = activateAbility(deidara(0, 7, 10), 'p1-deidara', 'c3-shi-suri', ['p2-kakuzu'], 0);
      expect(s.stack).toHaveLength(1);
      expect(unit(s, 'p1-deidara')!.chakraPool!.current).toBe(0);
      expect(activateAbility(deidara(20, 6, 10), 'p1-deidara', 'c3-shi-suri', ['p2-kakuzu'], 0).stack).toHaveLength(0);
    });
  });

  it("using an ability still blocks pooling into that unit", () => {
    const s = { ...withPool(proto(giveChakra(freshMain1(), 'p1', 5)), 'p1-kakuzu', 2), phase: 'Combat' as const };
    const acted = resolveTop(activateAbility(s, 'p1-kakuzu', 'earth-grudge-fear', ['p2-hidan'], 0));
    const after = gameReducer({ ...acted, phase: 'Main2' }, { type: 'POOL_CHAKRA', instanceId: 'p1-kakuzu', amount: 1 });
    expect(unit(after, 'p1-kakuzu')!.chakraPool!.current).toBe(unit(acted, 'p1-kakuzu')!.chakraPool!.current);
  });

  it("Kakuzu's kill credit for Patchwork Threads comes from a Leader, not a Shinobi", () => {
    const a = placeShinobi(proto(freshMain1()), 'p2', 'Genin', 1, 1, 0);
    const s = dealDamage(a.state, a.id, 1, { attackerInstanceId: 'p1-kakuzu' } as never).state;
    expect(unit(s, a.id)).toBeUndefined();
    expect(unit(s, 'p1-kakuzu')!.extra.lastKillTurn).toBeUndefined();
  });

  it('only Jutsu and Shinobi cards can be placed as Chakra sources', () => {
    const s = proto(freshMain1());
    const mission = addToHand(s, 'p1', 'unshakable-resolve');
    expect(gameReducer(mission.state, { type: 'PLACE_CHAKRA_SOURCE', instanceId: mission.instanceId }).players.p1.chakraSources).toHaveLength(0);
    const shinobi = addToHand(s, 'p1', 'shinobi-rain-genin');
    expect(gameReducer(shinobi.state, { type: 'PLACE_CHAKRA_SOURCE', instanceId: shinobi.instanceId }).players.p1.chakraSources).toHaveLength(1);
  });

  it('by default Jutsu cost Chakra and every other card costs Supplies; a card can override either rule', () => {
    const def = (cardType: 'jutsu' | 'assist' | 'terrain' | 'mission' | 'shinobi', extra: object = {}) => ({ cardType, type: 'None' as const, ...extra });
    expect(['jutsu', 'shinobi', 'mission', 'terrain', 'assist'].map((t) => paysInChakra(def(t as 'jutsu')))).toEqual([true, false, false, false, false]);
    expect(['jutsu', 'shinobi', 'mission', 'terrain', 'assist'].map((t) => canBeChakraSource(def(t as 'jutsu')))).toEqual([true, true, false, false, false]);
    // Card-dependent exceptions.
    expect(paysInChakra(def('mission', { paidWith: 'chakra' }))).toBe(true);
    expect(needsEnablingCharacter(def('mission', { paidWith: 'chakra' }), true)).toBe(true);
    expect(paysInChakra(def('jutsu', { paidWith: 'supplies' }))).toBe(false);
    expect(needsEnablingCharacter(def('jutsu', { paidWith: 'supplies' }), true)).toBe(false);
    expect(canBeChakraSource(def('terrain', { chakraSource: true }))).toBe(true);
    expect(canBeChakraSource(def('jutsu', { chakraSource: false }))).toBe(false);
    // The real cards follow the defaults.
    expect(paysInChakra(getHandCardDef('unshakable-resolve')!)).toBe(false);
    expect(canBeChakraSource(getHandCardDef('unshakable-resolve')!)).toBe(false);
  });
});

describe('Prototype: Third Kazekage in Shinobi combat', () => {
  function setup() {
    const combat: GameState = { ...proto(freshMain1()), phase: 'Combat' };
    const a = placeShinobi(combat, 'p1', 'Jonin', 3, 5, 0);
    const kazekage = makeThirdKazekage('p2', 'p2-deidara');
    return { state: placeToken(a.state, 'p2', kazekage), attacker: a.id, kazekage: kazekage.instanceId };
  }

  it('blocks a Shinobi attack on a Leader, taking the hit and dealing nothing back', () => {
    const { state, attacker, kazekage } = setup();
    const hp = unit(state, 'p2-deidara')!.currentHP;
    let s = gameReducer(state, { type: 'DECLARE_SHINOBI_ATTACK', attackerId: attacker, targetId: 'p2-deidara' });
    s = gameReducer(s, { type: 'CONFIRM_SHINOBI_ATTACKS' });
    expect(s.shinobiCombat?.step).toBe('defend');
    s = gameReducer(s, { type: 'ASSIGN_SHINOBI_DEFENDER', attackerId: attacker, defenderId: kazekage });
    s = gameReducer(s, { type: 'CONFIRM_SHINOBI_DEFENSE' });
    expect(unit(s, 'p2-deidara')!.currentHP).toBe(hp);
    expect(unit(s, kazekage)!.currentHP).toBe(3); // 6 − 3
    expect(unit(s, attacker)!.currentHP).toBe(5);
  });

  it('may decline to block', () => {
    const { state, attacker } = setup();
    const hp = unit(state, 'p2-deidara')!.currentHP;
    let s = gameReducer(state, { type: 'DECLARE_SHINOBI_ATTACK', attackerId: attacker, targetId: 'p2-deidara' });
    s = gameReducer(s, { type: 'CONFIRM_SHINOBI_ATTACKS' });
    s = gameReducer(s, { type: 'CONFIRM_SHINOBI_DEFENSE' });
    expect(unit(s, 'p2-deidara')!.currentHP).toBe(hp - 3);
  });

  it('can be attacked directly, and that attack can\'t be defended', () => {
    const { state, attacker, kazekage } = setup();
    let s = gameReducer(state, { type: 'DECLARE_SHINOBI_ATTACK', attackerId: attacker, targetId: kazekage });
    expect(s.shinobiCombat?.attacks).toHaveLength(1);
    s = gameReducer(s, { type: 'CONFIRM_SHINOBI_ATTACKS' }); // resolves at once
    expect(s.shinobiCombat ?? null).toBeNull();
    expect(unit(s, kazekage)!.currentHP).toBe(3);
    expect(unit(s, attacker)!.currentHP).toBe(5);
  });

  it("isn't a Shinobi otherwise: it can't attack", () => {
    const { state, kazekage } = setup();
    expect(attackBlocker({ ...state, activePlayer: 'p2' }, kazekage)).toBe('Only Shinobi can attack.');
  });

  it("other Tokens still can't be attacked or defend", () => {
    const { state, attacker } = setup();
    const soldier = placeShinobi(state, 'p2', 'Plain', 1, 1, 5);
    const plain = { ...soldier.state, players: { ...soldier.state.players, p2: { ...soldier.state.players.p2, frontRow: soldier.state.players.p2.frontRow.map((t) => (t?.instanceId === soldier.id ? { ...t, defId: 'puppet-soldier', extra: {} } : t)) } } };
    expect(gameReducer(plain, { type: 'DECLARE_SHINOBI_ATTACK', attackerId: attacker, targetId: soldier.id }).shinobiCombat ?? null).toBeNull();
  });
});

describe('Prototype: starting hand', () => {
  it('deals 7 cards; the first mulligan redraws 7, the second 6 (the base game stays at 6)', () => {
    let s = createSetupState('p1', 'strict', {}, { ruleset: 'prototype' });
    const cards = () => s.players.p1.hand.filter((h) => h.kind === 'card');
    expect(cards()).toHaveLength(7);
    s = gameReducer(s, { type: 'MULLIGAN', player: 'p1' });
    expect(cards()).toHaveLength(7);
    s = gameReducer(s, { type: 'MULLIGAN', player: 'p1' });
    expect(cards()).toHaveLength(6);
    expect(createSetupState('p1').players.p1.hand.filter((h) => h.kind === 'card')).toHaveLength(6);
  });
});

describe('Prototype: Jutsu and ability timing', () => {
  const inPhase = (s: GameState, phase: 'Main1' | 'Combat' | 'Main2'): GameState => ({ ...s, phase });

  it.each(['Main1', 'Combat', 'Main2'] as const)('a damaging ability works in %s', (phase) => {
    const placed = placeShinobi(proto(freshMain1()), 'p1', 'Water Specialist', 2, 6, 0);
    const frontRow = placed.state.players.p1.frontRow.map((t) => (t?.instanceId === placed.id ? { ...t, defId: 'shinobi-rain-jonin-water', chakraPool: { current: 2, capacity: 4 } } : t));
    const s = inPhase({ ...placed.state, players: { ...placed.state.players, p1: { ...placed.state.players.p1, frontRow } } }, phase);
    const hp = unit(s, 'p2-deidara')!.currentHP;
    const after = resolveTop(activateAbility(s, placed.id, 'rain-water-bullet', ['p2-deidara'], 0));
    expect(unit(after, 'p2-deidara')!.currentHP).toBe(hp - 2);
  });

  it.each(['Main1', 'Combat', 'Main2'] as const)('Attack-type and tactical Jutsu are both legal in %s', (phase) => {
    let s = withPool(proto(giveChakra(freshMain1(), 'p1', 1)), 'p1-kisame', 5);
    const senbon = addToHand(s, 'p1', 'senbon-volley');
    const recon = addToHand(senbon.state, 'p1', 'reconnaissance');
    s = inPhase(recon.state, phase);
    const cost = getHandCardDef('senbon-volley')!.cost as number;
    expect(checkHandCardLegality(s, 'p1', senbon.instanceId, 'p1-kisame', ['p2-deidara'], cost)).toEqual({ ok: true });
    expect(checkHandCardLegality(s, 'p1', recon.instanceId, '', [], 0)).toEqual({ ok: true });
  });

  it('stays on your own turn, keeps Attack-type Jutsu once per turn, and leaves Terrain as a Main Phase play', () => {
    let s = withPool(proto(freshMain1()), 'p1-kisame', 5);
    const senbon = addToHand(s, 'p1', 'senbon-volley');
    const terrain = addToHand(senbon.state, 'p1', 'akatsuki-hideout');
    s = inPhase(terrain.state, 'Combat');
    expect(checkHandCardLegality({ ...s, activePlayer: 'p2' }, 'p1', senbon.instanceId, 'p1-kisame', ['p2-deidara'], 0).ok).toBe(false);
    expect(checkHandCardLegality({ ...s, phase: 'End' }, 'p1', senbon.instanceId, 'p1-kisame', ['p2-deidara'], 0).ok).toBe(false);
    expect(checkHandCardLegality(s, 'p1', terrain.instanceId, '', [], 0).reason).toMatch(/only be played during a Main Phase/);
    const used = { ...s, players: { ...s.players, p1: { ...s.players.p1, attackJutsuUsedThisTurn: ['Senbon Volley'] } } };
    expect(checkHandCardLegality(used, 'p1', senbon.instanceId, 'p1-kisame', ['p2-deidara'], 0).ok).toBe(false);
  });
});

describe('Prototype: Supplies', () => {
  it('your maximum is the number of turns you have started (up to 20) and refills each turn', () => {
    const s = proto(freshMain1()); // turn 1, p1 went first
    expect([suppliesMax(s, 'p1'), suppliesMax(s, 'p2')]).toEqual([1, 0]);
    expect(suppliesMax({ ...s, turn: 6 }, 'p2')).toBe(3);
    expect(suppliesMax({ ...s, turn: 99 }, 'p1')).toBe(20);
    const spent = { ...s, players: { ...s.players, p1: { ...s.players.p1, suppliesSpent: 1 } } };
    expect(suppliesAvailable(spent, 'p1')).toBe(0);
    let next = spent;
    for (let i = 0; i < 7 * 2; i++) next = gameReducer(next, { type: 'ADVANCE_PHASE' }); // around to p1's next turn
    expect(next.activePlayer).toBe('p1');
    expect(suppliesAvailable(next, 'p1')).toBe(2);
  });

  it('Shinobi and Missions cost Supplies, not Chakra', () => {
    let s = proto(giveChakra(freshMain1(), 'p1', 5));
    const genin = addToHand(s, 'p1', 'shinobi-rain-genin');
    s = gameReducer(genin.state, { type: 'PLAY_HAND_CARD', instanceId: genin.instanceId, enablingInstanceId: '', targetInstanceIds: [], payFromPool: 0 });
    expect(shinobiOf(s, 'p1')).toHaveLength(1);
    expect(suppliesAvailable(s, 'p1')).toBe(0);
    expect(s.players.p1.genericChakraAvailable).toBe(5);
    const scout = addToHand(s, 'p1', 'shinobi-rain-scout');
    expect(shinobiOf(gameReducer(scout.state, { type: 'PLAY_HAND_CARD', instanceId: scout.instanceId, enablingInstanceId: '', targetInstanceIds: [], payFromPool: 0 }), 'p1')).toHaveLength(1); // 2 Supplies: refused
  });

  it('a new Prototype game carries the ruleset and the Shinobi starter cards', () => {
    const s = createSetupState('p1', 'strict', {}, { ruleset: 'prototype' });
    expect(s.ruleset).toBe('prototype');
    const all = [...s.players.p1.handDeck, ...s.players.p1.hand.filter((h) => h.kind === 'card')].map((c) => c.defId);
    expect(all.filter((d) => d.startsWith('shinobi-'))).toHaveLength(13); // 3 Rebels, 2 Yahiko, 2 Mercenaries, a plain Amegakure Jonin, 1 of each Jonin specialist and Elite Guard
    expect(createSetupState('p1').ruleset).toBeUndefined();
  });
});

describe('Prototype: Shinobi combat', () => {
  const combat = (s: GameState): GameState => ({ ...proto(s), phase: 'Combat' });

  it("a Shinobi can't attack the turn it comes into play", () => {
    let s = proto(freshMain1());
    const genin = addToHand(s, 'p1', 'shinobi-rain-genin');
    s = gameReducer(genin.state, { type: 'PLAY_HAND_CARD', instanceId: genin.instanceId, enablingInstanceId: '', targetInstanceIds: [], payFromPool: 0 });
    const id = shinobiOf(s, 'p1')[0].instanceId;
    s = gameReducer({ ...s, phase: 'Combat' }, { type: 'DECLARE_SHINOBI_ATTACK', attackerId: id, targetId: 'p2-hidan' });
    expect(s.shinobiCombat ?? null).toBeNull();
  });

  it('an undefended attack on a Leader deals the Shinobi\'s Damage to it', () => {
    const a = placeShinobi(combat(freshMain1()), 'p1', 'Jonin', 3, 5, 0);
    const hp = unit(a.state, 'p2-deidara')!.currentHP;
    let s = gameReducer(a.state, { type: 'DECLARE_SHINOBI_ATTACK', attackerId: a.id, targetId: 'p2-deidara' });
    s = gameReducer(s, { type: 'CONFIRM_SHINOBI_ATTACKS' }); // p2 has no Shinobi: resolves at once
    expect(unit(s, 'p2-deidara')!.currentHP).toBe(hp - 3);
    expect(s.shinobiCombat ?? null).toBeNull();
    expect(gameReducer(s, { type: 'DECLARE_SHINOBI_ATTACK', attackerId: a.id, targetId: 'p2-deidara' }).shinobiCombat ?? null).toBeNull(); // once per turn
  });

  it('the defending player chooses a Shinobi to defend their Leader; the two trade Damage', () => {
    const a = placeShinobi(combat(freshMain1()), 'p1', 'Jonin', 3, 5, 0);
    const d = placeShinobi(a.state, 'p2', 'Chunin', 2, 4, 0);
    const hp = unit(d.state, 'p2-deidara')!.currentHP;
    let s = gameReducer(d.state, { type: 'DECLARE_SHINOBI_ATTACK', attackerId: a.id, targetId: 'p2-deidara' });
    s = gameReducer(s, { type: 'CONFIRM_SHINOBI_ATTACKS' });
    expect(s.shinobiCombat?.step).toBe('defend');
    s = gameReducer(s, { type: 'ASSIGN_SHINOBI_DEFENDER', attackerId: a.id, defenderId: d.id });
    s = gameReducer(s, { type: 'CONFIRM_SHINOBI_DEFENSE' });
    expect(unit(s, 'p2-deidara')!.currentHP).toBe(hp);
    expect(unit(s, a.id)!.currentHP).toBe(3); // 5 − 2
    expect(unit(s, d.id)!.currentHP).toBe(1); // 4 − 3
  });

  it("attacks on a Shinobi can't be defended; a defeated Shinobi goes to the discard pile", () => {
    const a = placeShinobi(combat(freshMain1()), 'p1', 'Jonin', 3, 5, 0);
    const t = placeShinobi(a.state, 'p2', 'Genin', 1, 2, 0);
    const d = placeShinobi(t.state, 'p2', 'Chunin', 2, 4, 1);
    let s = gameReducer(d.state, { type: 'DECLARE_SHINOBI_ATTACK', attackerId: a.id, targetId: t.id });
    s = gameReducer(s, { type: 'CONFIRM_SHINOBI_ATTACKS' }); // nothing defendable: resolves at once
    expect(unit(s, t.id)).toBeUndefined();
    expect(s.players.p2.discardPile.map((c) => c.defId)).toContain('shinobi-rain-genin');
    expect(unit(s, a.id)!.currentHP).toBe(4); // took the Genin's 1
  });

  it("a Shinobi that pooled Chakra this turn can't attack", () => {
    const a = placeShinobi(combat(freshMain1()), 'p1', 'Jonin', 3, 5, 0);
    const pooled = { ...a.state, players: { ...a.state.players, p1: { ...a.state.players.p1, frontRow: a.state.players.p1.frontRow.map((u) => (u?.instanceId === a.id ? { ...u, status: { ...u.status, pooledThisTurn: true } } : u)) } } };
    expect(gameReducer(pooled, { type: 'DECLARE_SHINOBI_ATTACK', attackerId: a.id, targetId: 'p2-deidara' }).shinobiCombat ?? null).toBeNull();
  });

  it("a Leader can't be declared as an attacker, and Shinobi attacks don't exist in the base game's flow", () => {
    const s = combat(freshMain1());
    expect(gameReducer(s, { type: 'DECLARE_SHINOBI_ATTACK', attackerId: 'p1-kakuzu', targetId: 'p2-deidara' }).shinobiCombat ?? null).toBeNull();
  });

  it('declared attacks are dropped if Combat ends without confirming them', () => {
    const a = placeShinobi(combat(freshMain1()), 'p1', 'Jonin', 3, 5, 0);
    let s = gameReducer(a.state, { type: 'DECLARE_SHINOBI_ATTACK', attackerId: a.id, targetId: 'p2-deidara' });
    expect(s.shinobiCombat?.attacks).toHaveLength(1);
    s = gameReducer(s, { type: 'ADVANCE_PHASE' });
    expect(s.shinobiCombat ?? null).toBeNull();
  });
});

describe('Prototype: other costs move to Supplies', () => {
  it('there is no Upkeep: nothing is paid and no Leader is Disabled for it', () => {
    let s = proto(freshMain1());
    expect(previewUpkeep(s, 'p2')).toEqual([]);
    for (let i = 0; i < 5; i++) s = gameReducer(s, { type: 'ADVANCE_PHASE' }); // Main1 → … → p2 Upkeep
    expect(s.activePlayer).toBe('p2');
    expect(s.phase).toBe('Upkeep');
    expect(suppliesAvailable(s, 'p2')).toBe(suppliesMax(s, 'p2'));
    expect(s.players.p2.chakraSources.every((c) => !c.tapped)).toBe(true);
    expect(s.players.p2.backRow.filter(Boolean).every((c) => !c!.status.disabled)).toBe(true);
    void resolveTop;
  });
});

describe('Prototype: open lanes, no board shape', () => {
  it('no limit on Leaders: a full lane grows, and each new Leader joins the end with no position to pick', () => {
    const base = freshMain1();
    const s = proto(base);
    expect(maxCharacters(s)).toBe(Infinity);
    expect(maxCharacters(base)).toBe(5);
    const row = s.players.p1.backRow;
    expect(legalCharacterSlots(s, 'p1')).toEqual([row.indexOf(null)]);
    const full = { ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: row.map((c) => c ?? row.find(Boolean)!) } } };
    expect(legalCharacterSlots(full, 'p1')).toEqual([row.length]);
    const placed = placeCharacter(full, 'p1', { ...row.find(Boolean)!, instanceId: 'p1-extra-leader' });
    expect(placed.players.p1.backRow).toHaveLength(row.length + 1);
    expect(placed.players.p1.backRow[row.length]?.instanceId).toBe('p1-extra-leader');
  });

  it('no limit on Shinobi and tokens: a full lane grows', () => {
    let s = proto(freshMain1());
    for (let i = 0; i < s.players.p1.frontRow.length; i++) ({ state: s } = placeShinobi(s, 'p1', `S${i}`, 1, 2, i));
    expect(legalTokenSlots(s, 'p1')).toEqual([s.players.p1.frontRow.length]);
  });

  it('a new Shinobi or token goes into the first open spot without asking', () => {
    let s = proto(freshMain1());
    ({ state: s } = placeShinobi(s, 'p1', 'A', 1, 2, 0));
    ({ state: s } = placeShinobi(s, 'p1', 'B', 1, 2, 3));
    expect(legalTokenSlots(s, 'p1')).toEqual([1]);
  });

  it('neighbours are the nearest units in the same lane, with nothing in front or behind', () => {
    let s = proto(freshMain1());
    ({ state: s } = placeShinobi(s, 'p1', 'A', 1, 2, 0));
    ({ state: s } = placeShinobi(s, 'p1', 'B', 1, 2, 4));
    ({ state: s } = placeShinobi(s, 'p1', 'C', 1, 2, 7));
    const adj = getAdjacent(s, 'p1', 'front', 4);
    expect(adj.left?.name).toBe('A');
    expect(adj.right?.name).toBe('C');
    expect(adj.front).toBeNull();
    expect(adj.back).toBeNull();
  });
});

describe('Prototype: bringing out new Leaders', () => {
  /** p1 in Main 1 on their 11th turn (plenty of Supplies), with a known Leader Deck. */
  function leaderDrawState(deck: string[]): GameState {
    const s = proto(freshMain1());
    return { ...s, turn: 21, players: { ...s.players, p1: { ...s.players.p1, characterDeck: deck, suppliesSpent: 0 } } };
  }
  const leaders = (s: GameState) => s.players.p1.backRow.filter(Boolean).map((c) => c!.defId);

  it('an early deploy costs 8 Supplies, then 10, then 12 from then on', () => {
    let s = { ...leaderDrawState(['konan', 'zetsu', 'juzo', 'sasori-hiruko']), turn: 41 }; // 20 Supplies a turn
    const costs: number[] = [];
    for (let i = 0; i < 4; i++) {
      costs.push(currentTax(s, 'p1'));
      s = gameReducer({ ...s, players: { ...s.players, p1: { ...s.players.p1, suppliesSpent: 0 } } }, { type: 'DRAW_CHARACTER_DECK', player: 'p1' });
      expect(suppliesMax(s, 'p1') - suppliesAvailable(s, 'p1')).toBe(costs[i]);
      const count = leaders(s).length;
      s = gameReducer(s, { type: 'CHOOSE_CHARACTER', player: 'p1', entryId: s.players.p1.pendingCharacterReveal!.revealed[0] });
      expect(leaders(s)).toHaveLength(count + 1);
    }
    expect(costs).toEqual([8, 10, 12, 12]);
  });

  it('an early deploy reveals 2 random Leaders; the one picked goes straight into play and the other goes back', () => {
    const deck = ['konan', 'zetsu', 'juzo', 'sasori-hiruko'];
    let s = gameReducer(leaderDrawState(deck), { type: 'DRAW_CHARACTER_DECK', player: 'p1' });
    const revealed = s.players.p1.pendingCharacterReveal!.revealed;
    expect(revealed).toHaveLength(2);
    expect(deck).toEqual(expect.arrayContaining(revealed));
    const handBefore = s.players.p1.hand.length;
    const count = leaders(s).length;
    s = gameReducer(s, { type: 'CHOOSE_CHARACTER', player: 'p1', entryId: revealed[1] });
    expect(leaders(s)).toHaveLength(count + 1);
    expect(s.players.p1.hand).toHaveLength(handBefore); // not to hand
    expect(s.players.p1.characterDeck.slice().sort()).toEqual(deck.filter((id) => id !== revealed[1]).sort());
    expect(s.players.p1.pendingCharacterReveal).toBeNull();
  });

  it("can't deploy early without the Supplies under the strict rules", () => {
    const s = { ...leaderDrawState(['konan', 'zetsu']), turn: 5, rules: 'strict' as const };
    const next = gameReducer(s, { type: 'DRAW_CHARACTER_DECK', player: 'p1' });
    expect(next.players.p1.pendingCharacterReveal).toBeNull();
    expect(next.players.p1.characterDeck).toEqual(['konan', 'zetsu']);
  });

  it('when a Leader is defeated, you may bring out any Leader from your Leader Deck, free, straight into play', () => {
    let s = { ...leaderDrawState(['konan', 'zetsu', 'juzo']), rules: 'trust' as const };
    const supplies = suppliesAvailable(s, 'p1');
    s = gameReducer(s, { type: 'DEAL_DAMAGE', instanceId: 'p1-kisame', amount: 99 });
    expect(leaders(s)).not.toContain('kisame');
    expect(s.players.p1.reinforcementOffers).toEqual(['free']);
    s = gameReducer(s, { type: 'ACCEPT_REINFORCEMENT', player: 'p1' });
    expect(s.players.p1.pendingCharacterReveal?.revealed).toEqual(['konan', 'zetsu', 'juzo']); // the whole Leader Deck
    s = gameReducer(s, { type: 'CHOOSE_CHARACTER', player: 'p1', entryId: 'juzo' });
    expect(leaders(s)).toContain('juzo');
    expect(s.players.p1.characterDeck).toEqual(['konan', 'zetsu']);
    expect(suppliesAvailable(s, 'p1')).toBe(supplies); // free
    expect(currentTax(s, 'p1')).toBe(8); // doesn't count as an early deploy
  });
});

describe('Prototype: Amegakure Civilian Rebel is a Shinobi', () => {
  it('is not dealt into the Leader Deck, and the starter deck has 3 Rebel Shinobi', () => {
    const s = createSetupState('p1', 'trust', {}, { ruleset: 'prototype' });
    const p = s.players.p1;
    const leaders = [...p.characterDeck, ...(p.pendingCharacterReveal?.revealed ?? [])];
    expect(leaders).not.toContain('amegakure-civilian-rebel');
    const cards = [...p.handDeck.map((c) => c.defId), ...p.hand.flatMap((h) => (h.kind === 'card' ? [h.defId] : []))];
    expect(cards.filter((id) => id === 'shinobi-amegakure-civilian-rebel')).toHaveLength(3);
  });

  it('deals 1 Damage, or 2 while its controller has Yahiko in play', () => {
    let s = proto(freshMain1());
    ({ state: s } = placeShinobi(s, 'p1', 'Rebel', 1, 3, 0));
    const rebel = { ...s.players.p1.frontRow[0]!, extra: { shinobi: true, shinobiDamage: 1, shinobiLeaderBonus: { name: 'Yahiko', amount: 1 } } };
    const withoutYahiko = { ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c) => (c?.defId === 'yahiko' ? null : c)) } } };
    expect(shinobiDamage(rebel, withoutYahiko)).toBe(1);
    expect(shinobiDamage(rebel, withCharacterAt(withoutYahiko, 'p1', 4, 'yahiko'))).toBe(2);
    expect(shinobiDamage(rebel, placeYahiko(withoutYahiko, 'p1', 1, 0).state)).toBe(2); // Yahiko as a Shinobi counts too
  });
});

describe('Prototype: no Health — you lose when all your characters are defeated', () => {
  it("defeats don't cost Health, and the game goes on while any character is left anywhere", () => {
    let s = proto(freshMain1());
    const health = s.players.p2.health;
    s = dealDamage(s, 'p2-deidara', 99).state;
    expect(s.players.p2.backRow.some((c) => c?.defId === 'deidara')).toBe(false);
    expect(s.players.p2.health).toBe(health);
    expect(s.winner).toBeNull();
  });

  it('the last character falling — none in play, in hand or in the Character Deck — loses the game', () => {
    let s = proto(freshMain1());
    const p2 = s.players.p2;
    s = { ...s, players: { ...s.players, p2: { ...p2, backRow: p2.backRow.map((c) => (c?.defId === 'deidara' ? c : null)), characterDeck: [], hand: p2.hand.filter((h) => h.kind !== 'character') } } };
    expect(charactersRemaining(s, 'p2')).toBe(1);
    s = dealDamage(s, 'p2-deidara', 99).state;
    expect(s.winner).toBe('p1');
  });

  it('a character still in the Character Deck keeps you in the game', () => {
    let s = proto(freshMain1());
    const p2 = s.players.p2;
    s = { ...s, players: { ...s.players, p2: { ...p2, backRow: p2.backRow.map((c) => (c?.defId === 'deidara' ? c : null)), characterDeck: ['konan'], hand: [] } } };
    s = dealDamage(s, 'p2-deidara', 99).state;
    expect(s.winner).toBeNull();
  });

  it('an empty Jutsu Deck just means no draw', () => {
    let s = proto(freshMain1());
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, handDeck: [] } } };
    const after = drawCard(s, 'p1');
    expect(after.players.p1.health).toBe(s.players.p1.health);
  });
});


describe('Prototype: Shinobi copies and the legendary rule', () => {
  it('a deck holds at most 3 of each Shinobi', async () => {
    const { copyLimit } = await import('../../src/engine/decklist');
    expect(copyLimit('hand', 'shinobi-rain-genin')).toBe(3);
  });

  it("you can't have two named units with the same name in play; generic Shinobi can repeat", async () => {
    const { namedUnitInPlay } = await import('../../src/engine/shinobi');
    let s = proto(freshMain1());
    ({ state: s } = placeShinobi(s, 'p1', 'Amegakure Genin', 1, 2, 0));
    expect(namedUnitInPlay(s, 'p1', 'Amegakure Genin')).toBe(true);
    const genin = addToHand(s, 'p1', 'shinobi-rain-genin');
    expect(shinobiOf(gameReducer(genin.state, { type: 'PLAY_HAND_CARD', instanceId: genin.instanceId, enablingInstanceId: '', targetInstanceIds: [], payFromPool: 0 }), 'p1')).toHaveLength(2); // generic: allowed
    expect(namedUnitInPlay(s, 'p1', 'Kakuzu')).toBe(true); // a Leader counts too
    expect(namedUnitInPlay(s, 'p2', 'Amegakure Genin')).toBe(false); // per player
  });

  it('the Rebel is a 1/2', () => {
    expect(getHandCardDef('shinobi-amegakure-civilian-rebel')?.shinobi).toMatchObject({ damage: 1, health: 2, rank: 'D' });
  });
});

/** Puts Yahiko (the Shinobi) straight onto `player`'s front row with `pool` Chakra in his Pool. */
function placeYahiko(state: GameState, player: PlayerId, slot: number, pool: number): { state: GameState; id: string } {
  const id = `${player}-yahiko-shinobi`;
  const token: TokenInstance = {
    instanceId: id,
    defId: 'shinobi-yahiko',
    owner: player,
    name: 'Yahiko',
    maxHP: 3,
    currentHP: 3,
    ownerCharacterInstanceId: '',
    status: { disabled: false, retreated: false, enteredTurn: 0, hasAmbush: false, usedAbilitiesThisTurn: [], pooledThisTurn: false },
    extra: { shinobi: true, shinobiDamage: 2 },
    chakraPool: { current: pool, capacity: 8 },
  };
  const frontRow = state.players[player].frontRow.slice();
  frontRow[slot] = token;
  return { state: { ...state, players: { ...state.players, [player]: { ...state.players[player], frontRow } } }, id };
}

describe('Prototype: Yahiko is a B-rank Shinobi', () => {
  it('is a named 6-Supply 2/3 Shinobi with a Pool of 8: 2 in the starter deck, none in the Leader Deck', () => {
    expect(getHandCardDef('shinobi-yahiko')).toMatchObject({ cost: 6, shinobi: { damage: 2, health: 3, named: true, rank: 'B', pool: 8 } });
    const p = createSetupState('p1', 'trust', {}, { ruleset: 'prototype' }).players.p1;
    expect([...p.characterDeck, ...(p.pendingCharacterReveal?.revealed ?? [])]).not.toContain('yahiko');
    const cards = [...p.handDeck.map((c) => c.defId), ...p.hand.flatMap((h) => (h.kind === 'card' ? [h.defId] : []))];
    expect(cards.filter((id) => id === 'shinobi-yahiko')).toHaveLength(2);
  });

  it("comes into play with an empty Pool of 8, and a second Yahiko can't join him", () => {
    let s = { ...proto(freshMain1()), turn: 14 };
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c) => (c?.defId === 'yahiko' ? null : c)) } } };
    const first = addToHand(s, 'p1', 'shinobi-yahiko');
    s = gameReducer(first.state, { type: 'PLAY_HAND_CARD', instanceId: first.instanceId, enablingInstanceId: '', targetInstanceIds: [], payFromPool: 0 });
    expect(shinobiOf(s, 'p1').map((t) => [t.name, t.chakraPool])).toEqual([['Yahiko', { current: 0, capacity: 8 }]]);
    const second = addToHand(s, 'p1', 'shinobi-yahiko');
    expect(shinobiOf(gameReducer(second.state, { type: 'PLAY_HAND_CARD', instanceId: second.instanceId, enablingInstanceId: '', targetInstanceIds: [], payFromPool: 0 }), 'p1')).toHaveLength(1);
  });

  it('Pillar Encirclement: each hit he takes is reduced by 2 until his next turn, and Elemental Versatility makes it cost 2', () => {
    const y = placeYahiko(proto(freshMain1()), 'p1', 0, 3);
    let s = activateAbility(y.state, y.id, 'pillar-encirclement', [], 0);
    expect(unit(s, y.id)!.chakraPool!.current).toBe(1); // first elemental ability this turn: 3 - 1
    s = resolveTop(s);
    s = dealDamage(s, y.id, 3).state;
    expect(unit(s, y.id)!.currentHP).toBe(2); // 3 - 2 = 1 damage
    s = dealDamage({ ...s, turn: s.turn + 1 }, y.id, 1).state;
    expect(unit(s, y.id)!.currentHP).toBe(2); // still on during the opponent's turn
    s = dealDamage({ ...s, turn: s.turn + 1 }, y.id, 1).state;
    expect(unit(s, y.id)!.currentHP).toBe(1); // gone on his controller's next turn
  });

  it("Rallying Words: a Shinobi's next attack this turn deals 1 more", () => {
    const y = placeYahiko(proto(freshMain1()), 'p1', 0, 3);
    const a = placeShinobi(y.state, 'p1', 'Jonin', 3, 5, 1);
    let s = resolveTop(activateAbility(a.state, y.id, 'rallying-words', [], 0));
    const hp = unit(s, 'p2-deidara')!.currentHP;
    s = gameReducer({ ...s, phase: 'Combat' }, { type: 'DECLARE_SHINOBI_ATTACK', attackerId: a.id, targetId: 'p2-deidara' });
    s = gameReducer(s, { type: 'CONFIRM_SHINOBI_ATTACKS' });
    expect(unit(s, 'p2-deidara')!.currentHP).toBe(hp - 4);
  });

  /** p1's Leaders cut down to `keepLeaders` (Hidan at 1 HP, survival spent), plus Yahiko with 5 Chakra under Pillar Encirclement; p2's Earth Grudge Fear (1 damage) aimed at Hidan. */
  function lethalOnHidan(keepLeaders: string[]) {
    let s = proto(freshCombat());
    s = {
      ...s,
      players: {
        ...s.players,
        p1: {
          ...s.players.p1,
          backRow: s.players.p1.backRow.map((c) => (!c || !keepLeaders.includes(c.defId) ? null : c.defId === 'hidan' ? { ...c, currentHP: 1, extra: { ...c.extra, usedSafetyNet: true } } : c)),
        },
      },
    };
    const y = placeYahiko(s, 'p1', 0, 5);
    const turn = s.turn;
    s = { ...y.state, players: { ...y.state.players, p1: { ...y.state.players.p1, frontRow: y.state.players.p1.frontRow.map((t) => (t?.instanceId === y.id ? { ...t, extra: { ...t.extra, pillarEncirclementUntilTurn: turn } } : t)) } } };
    s = { ...withPool(s, 'p2-kakuzu', 3), activePlayer: 'p2', priorityPlayer: 'p2' };
    s = activateAbility(s, 'p2-kakuzu', 'earth-grudge-fear', ['p1-hidan'], 0);
    expect(s.stack).toHaveLength(1);
    return { state: s, yahiko: y.id };
  }

  it("Selfless Resolve takes a lethal hit for an ally, and Pillar Encirclement can't reduce it", () => {
    const { state, yahiko } = lethalOnHidan(['hidan']);
    let s = activateAbility(state, yahiko, 'selfless-resolve', ['p1-hidan'], 0);
    expect(s.stack).toHaveLength(2);
    expect(unit(s, yahiko)!.chakraPool!.current).toBe(0); // 5 Chakra from his own Pool
    for (let i = 0; i < 4; i++) s = gameReducer(s, { type: 'PASS_PRIORITY' });
    expect(s.stack).toHaveLength(0);
    expect(unit(s, 'p1-hidan')!.currentHP).toBe(1); // untouched
    expect(unit(s, yahiko)!.currentHP).toBe(2); // took the full 1
  });

  it('needs the opponent to control at least 2 more characters (Leaders and Shinobi)', () => {
    const { state, yahiko } = lethalOnHidan(['hidan', 'kakuzu', 'deidara']);
    const count = (p: GameState['players']['p1']) => [...p.backRow, ...p.frontRow].filter(Boolean).length;
    expect(count(state.players.p2)).toBeLessThan(count(state.players.p1) + 2);
    expect(activateAbility(state, yahiko, 'selfless-resolve', ['p1-hidan'], 0).stack).toHaveLength(1);
  });
});

describe('Prototype: the starter Leader Deck', () => {
  it('is Itachi, Kisame, Sasori, Deidara, Kakuzu and Hidan — exactly the 50-point budget', async () => {
    const { characterDeckCost, presetDeck } = await import('../../src/engine/decklist');
    const p = createSetupState('p1', 'trust', {}, { ruleset: 'prototype' }).players.p1;
    expect([...p.characterDeck, ...(p.pendingCharacterReveal?.revealed ?? [])].sort()).toEqual(['deidara', 'hidan', 'itachi', 'kakuzu', 'kisame', 'sasori-hiruko']);
    expect(characterDeckCost({ ...presetDeck(), characterDeck: { itachi: 1, kisame: 1, 'sasori-hiruko': 1, deidara: 1, kakuzu: 1, hidan: 1 } })).toBe(50);
  });
});

describe('Prototype: the Extra Deck', () => {
  it("starts with Kakuzu's three mask techniques and 3 Crow Clones, none of them in the Main Deck", () => {
    const p = createSetupState('p1', 'trust', {}, { ruleset: 'prototype' }).players.p1;
    expect((p.extraDeck ?? []).map((c) => c.defId).sort()).toEqual(['jutsu-crow-clone', 'jutsu-crow-clone', 'jutsu-crow-clone', 'jutsu-false-darkness', 'jutsu-pressure-damage', 'jutsu-searing-migraine']);
    const main = [...p.handDeck.map((c) => c.defId), ...p.hand.flatMap((h) => (h.kind === 'card' ? [h.defId] : []))];
    expect(main.filter((id) => ['jutsu-false-darkness', 'jutsu-pressure-damage', 'jutsu-searing-migraine', 'jutsu-crow-clone'].includes(id))).toEqual([]);
    expect(createSetupState('p1').players.p1.extraDeck).toBeUndefined(); // base game: no Extra Deck
  });

  it("Kakuzu's Heart Masks pulls his mask techniques from the Extra Deck into hand", async () => {
    const { getCharacterDef } = await import('../../src/engine/characters/registry');
    let s = proto(freshMain1());
    const extraDeck = ['jutsu-pressure-damage', 'jutsu-searing-migraine', 'jutsu-false-darkness', 'fireball-jutsu'].map((defId) => makeHandCardInstance(defId));
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, extraDeck } } };
    const mainBefore = s.players.p1.handDeck.length;
    s = getCharacterDef('kakuzu')!.onEnterPlay!(s, 'p1-kakuzu', 'p1');
    const handIds = s.players.p1.hand.flatMap((h) => (h.kind === 'card' ? [h.defId] : []));
    expect(handIds).toEqual(expect.arrayContaining(['jutsu-pressure-damage', 'jutsu-searing-migraine', 'jutsu-false-darkness']));
    expect(s.players.p1.extraDeck!.map((c) => c.defId)).toEqual(['fireball-jutsu']);
    expect(s.players.p1.handDeck).toHaveLength(mainBefore); // the Main Deck is untouched
  });

  it("a card's copy limit counts its copies in the Main Deck and the Extra Deck together", async () => {
    const { validateDeck, presetDeck } = await import('../../src/engine/decklist');
    const deck = { ...presetDeck(), handDeck: { ...presetDeck().handDeck, 'fireball-jutsu': 2 }, extraDeck: { 'fireball-jutsu': 2 } };
    expect(validateDeck(deck).some((e) => e.startsWith('Fireball Jutsu'))).toBe(true);
  });
});

describe('Prototype: the Amegakure Jonin specialists', () => {
  /** Puts a specialist straight onto p1's front row with `pool` Chakra in its Pool, in Combat. */
  function placeSpecialist(defId: string, pool: number): { state: GameState; id: string } {
    const s = { ...proto(freshMain1()), phase: 'Combat' as const };
    const placed = placeShinobi(s, 'p1', defId, 3, 5, 0);
    const frontRow = placed.state.players.p1.frontRow.map((t) => (t?.instanceId === placed.id ? { ...t, defId, chakraPool: { current: pool, capacity: 4 } } : t));
    return { state: { ...placed.state, players: { ...placed.state.players, p1: { ...placed.state.players.p1, frontRow } } }, id: placed.id };
  }

  it('are 5-Supply 2/6 Shinobi with a Pool of 4, one of each in the starter deck', () => {
    for (const id of ['shinobi-rain-jonin-water', 'shinobi-rain-jonin-wind', 'shinobi-rain-jonin-poison']) {
      expect(getHandCardDef(id)).toMatchObject({ cost: 5, shinobi: { damage: 2, health: 6, pool: 4 } });
    }
  });

  it('Water Specialist: Rain Water Bullet (2 Chakra) deals 2 damage', () => {
    const w = placeSpecialist('shinobi-rain-jonin-water', 4);
    const hp = unit(w.state, 'p2-deidara')!.currentHP;
    const s = resolveTop(activateAbility(w.state, w.id, 'rain-water-bullet', ['p2-deidara'], 0));
    expect(unit(s, 'p2-deidara')!.currentHP).toBe(hp - 2);
    expect(unit(s, w.id)!.chakraPool!.current).toBe(2);
  });

  it('Wind Specialist: Gale Blade (3 Chakra) deals 1 to each of up to 2 enemy units', () => {
    const w = placeSpecialist('shinobi-rain-jonin-wind', 4);
    const a = unit(w.state, 'p2-deidara')!.currentHP;
    const b = unit(w.state, 'p2-kisame')!.currentHP;
    const s = resolveTop(activateAbility(w.state, w.id, 'gale-blade', ['p2-deidara', 'p2-kisame'], 0));
    expect([unit(s, 'p2-deidara')!.currentHP, unit(s, 'p2-kisame')!.currentHP]).toEqual([a - 1, b - 1]);
    expect(unit(s, w.id)!.chakraPool!.current).toBe(1);
  });

  it('Poison Specialist: Poison Fog (4 Chakra) gives 2 Poison to each of up to 2 adjacent enemy Shinobi — not Leaders', () => {
    const p = placeSpecialist('shinobi-rain-jonin-poison', 4);
    const e1 = placeShinobi(p.state, 'p2', 'Genin A', 1, 2, 0);
    const e2 = placeShinobi(e1.state, 'p2', 'Genin B', 1, 2, 1);
    expect(activateAbility(e2.state, p.id, 'poison-fog', ['p2-deidara'], 0).stack).toHaveLength(0); // a Leader isn't a Shinobi
    const s = resolveTop(activateAbility(e2.state, p.id, 'poison-fog', [e1.id, e2.id], 0));
    expect([unit(s, e1.id)!.extra.poisonCounters, unit(s, e2.id)!.extra.poisonCounters]).toEqual([2, 2]);
    expect(unit(s, p.id)!.chakraPool!.current).toBe(0);
  });
});

describe('Prototype: the Amegakure Elite Guards', () => {
  it('Sensor (7 Supplies, 4/7): entering play logs your opponent\'s hand and draws you a card', () => {
    let s = { ...proto(freshMain1()), turn: 41 };
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, handDeck: [makeHandCardInstance('reconnaissance')] } } };
    const card = addToHand(s, 'p1', 'shinobi-rain-elite-sensor');
    const handBefore = card.state.players.p1.hand.length;
    s = gameReducer(card.state, { type: 'PLAY_HAND_CARD', instanceId: card.instanceId, enablingInstanceId: '', targetInstanceIds: [], payFromPool: 0 });
    expect(shinobiOf(s, 'p1').some((t) => t.name === 'Amegakure Elite Guard: Sensor')).toBe(true);
    expect(s.players.p1.hand).toHaveLength(handBefore); // played 1, drew 1
    expect(s.players.p1.handDeck).toHaveLength(0);
    expect(s.log.some((l) => l.text.startsWith("Rain Sensing: p1 looks at p2's hand"))).toBe(true);
    // A snapshot for p1's hand window: p2's hand as it was, not a live view.
    const peek = s.handPeeks![0];
    expect(peek).toMatchObject({ viewer: 'p1', owner: 'p2', source: 'Rain Sensing' });
    expect(peek.cards).toEqual(card.state.players.p2.hand);
    const later = { ...s, players: { ...s.players, p2: { ...s.players.p2, hand: [] } } };
    expect(later.handPeeks![0].cards).toHaveLength(card.state.players.p2.hand.length);
  });

  it("Bodyguard: Rain Shield (4 Chakra) reduces each hit on one of your units by 2 until your next turn", () => {
    let s = { ...proto(freshMain1()), phase: 'Main1' as const };
    const placed = placeShinobi(s, 'p1', 'Bodyguard', 4, 7, 0);
    const frontRow = placed.state.players.p1.frontRow.map((t) => (t?.instanceId === placed.id ? { ...t, defId: 'shinobi-rain-elite-bodyguard', chakraPool: { current: 4, capacity: 4 } } : t));
    s = { ...placed.state, players: { ...placed.state.players, p1: { ...placed.state.players.p1, frontRow } } };
    s = resolveTop(activateAbility(s, placed.id, 'rain-shield', ['p1-kisame'], 0));
    const hp = unit(s, 'p1-kisame')!.currentHP;
    s = dealDamage(s, 'p1-kisame', 3).state;
    expect(unit(s, 'p1-kisame')!.currentHP).toBe(hp - 1);
    s = dealDamage({ ...s, turn: s.turn + 2 }, 'p1-kisame', 3).state;
    expect(unit(s, 'p1-kisame')!.currentHP).toBe(hp - 4); // gone on your next turn
  });
});
