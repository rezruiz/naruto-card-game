import { describe, expect, it } from 'vitest';
import { gameReducer } from '../../src/engine/reducer';
import { makeHandCardInstance } from '../../src/engine/deck';
import { dealDamage } from '../../src/engine/combat';
import { equipmentOn } from '../../src/engine/equipment';
import { suppliesAvailable, suppliesMax } from '../../src/engine/prototype';
import { createSetupState } from '../../src/engine/state';
import { copyLimit } from '../../src/engine/decklist';
import { TERRAIN } from '../../src/engine/terrainEffects';
import { shinobiDamage } from '../../src/engine/shinobi';
import { prototypeCardCost } from '../../src/engine/cards/playHandCard';
import { getHandCardDef } from '../../src/engine/cards/registry';
import { freshMain1 } from './testUtils';
import type { GameAction, GameState, PlayerId, TokenInstance } from '../../src/engine/types';

// Prototype rules: Terrain (cards/terrain.ts, terrainEffects.ts).

const proto = (s: GameState): GameState => ({ ...s, ruleset: 'prototype', turn: 21 });

function play(state: GameState, player: PlayerId, defId: string, targets: string[] = []): GameState {
  const card = makeHandCardInstance(defId);
  const p = state.players[player];
  const withCard = { ...state, players: { ...state.players, [player]: { ...p, hand: [...p.hand, { kind: 'card' as const, instanceId: card.instanceId, defId }] } } };
  return gameReducer(withCard, { type: 'PLAY_HAND_CARD', instanceId: card.instanceId, enablingInstanceId: '', targetInstanceIds: targets, payFromPool: 0 });
}

function placeShinobi(state: GameState, player: PlayerId, defId: string, damage: number, health: number, slot: number): { state: GameState; id: string } {
  const id = `${player}-test-${defId}-${slot}`;
  const token: TokenInstance = {
    instanceId: id,
    defId,
    owner: player,
    name: defId,
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

const unit = (s: GameState, id: string) => [...s.players.p1.backRow, ...s.players.p2.backRow, ...s.players.p1.frontRow, ...s.players.p2.frontRow].find((u) => u?.instanceId === id);
const act = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);

describe('Prototype: Terrain', () => {
  it("Akatsuki Hideout: at your Upkeep, each of your Akatsuki Leaders gains 1 Chakra in its Pool (up to capacity) — until another Terrain replaces it", () => {
    const s = proto(freshMain1());
    const cap = unit(s, 'p1-hidan')!.chakraPool!.capacity;
    const hideout = play(s, 'p1', TERRAIN.akatsukiHideout);
    expect(hideout.players.p1.terrainInPlay?.defId).toBe(TERRAIN.akatsukiHideout);
    expect(unit(hideout, 'p1-hidan')!.chakraPool!.capacity).toBe(cap); // no bigger Pool any more
    const atUpkeep = gameReducer({ ...hideout, phase: 'Untap' }, { type: 'ADVANCE_PHASE' });
    expect(atUpkeep.phase).toBe('Upkeep');
    expect(unit(atUpkeep, 'p1-hidan')!.chakraPool!.current).toBe(unit(hideout, 'p1-hidan')!.chakraPool!.current + 1);
    expect(unit(atUpkeep, 'p1-hidan')!.status.pooledThisTurn).toBe(false); // not pooling: it can still act
    expect(unit(atUpkeep, 'p2-hidan')!.chakraPool!.current).toBe(unit(hideout, 'p2-hidan')!.chakraPool!.current); // one-way
    const full = { ...hideout, phase: 'Untap' as const, players: { ...hideout.players, p1: { ...hideout.players.p1, backRow: hideout.players.p1.backRow.map((c) => (c?.instanceId === 'p1-hidan' ? { ...c, chakraPool: { ...c.chakraPool, current: cap } } : c)) } } };
    expect(unit(gameReducer(full, { type: 'ADVANCE_PHASE' }), 'p1-hidan')!.chakraPool!.current).toBe(cap); // never past capacity
    const replaced = play(hideout, 'p1', TERRAIN.supplyDepot);
    expect(replaced.players.p1.terrainInPlay?.defId).toBe(TERRAIN.supplyDepot);
    expect(replaced.players.p1.discardPile.some((c) => c.defId === TERRAIN.akatsukiHideout)).toBe(true);
    const later = gameReducer({ ...replaced, phase: 'Untap' }, { type: 'ADVANCE_PHASE' });
    expect(unit(later, 'p1-hidan')!.chakraPool!.current).toBe(unit(replaced, 'p1-hidan')!.chakraPool!.current);
  });

  it('Amegakure: Amegakure Shinobi get +1 Damage and +1 Health and cost 1 less Supply (min 1), others don’t', () => {
    const a = placeShinobi(proto(freshMain1()), 'p1', 'shinobi-rain-chunin', 2, 4, 0);
    const b = placeShinobi(a.state, 'p1', 'shinobi-other', 2, 4, 1);
    const s = play(b.state, 'p1', TERRAIN.amegakure);
    expect(unit(s, a.id)!.maxHP).toBe(5);
    expect(unit(s, a.id)!.currentHP).toBe(5);
    expect(unit(s, b.id)!.maxHP).toBe(4);
    expect(shinobiDamage(unit(s, a.id)!, s)).toBe(3);
    expect(shinobiDamage(unit(s, b.id)!, s)).toBe(2);
    const ctx = { state: s, player: 'p1' as const, enablingInstanceId: '', targetInstanceIds: [] };
    expect(prototypeCardCost(s, getHandCardDef('shinobi-rain-jonin')!, ctx).cost).toBe(3); // 4 - 1
    expect(prototypeCardCost(s, getHandCardDef('shinobi-rain-genin')!, ctx).cost).toBe(1); // minimum 1
    expect(prototypeCardCost(s, getHandCardDef('shinobi-yahiko')!, ctx).cost).toBe(6); // not an Amegakure Shinobi
    // Played again (no change) — the buff isn't applied twice.
    expect(unit(act(s, { type: 'ADJUST_SUPPLIES', player: 'p1', delta: 0 }), a.id)!.maxHP).toBe(5);
  });

  it('Supply Depot: your Supplies maximum grows by 2 a turn instead of 1, never past 20', () => {
    const toNextTurn = (s: GameState) => {
      let next = gameReducer(s, { type: 'ADVANCE_PHASE' });
      for (let i = 0; i < 20 && !(next.activePlayer === 'p1' && next.phase === 'Untap'); i++) next = gameReducer(next, { type: 'ADVANCE_PHASE' });
      return next;
    };
    let s: GameState = { ...proto(freshMain1()), turn: 13, firstPlayer: 'p1' }; // p1's 7th turn: 7 Supplies
    expect(suppliesMax(s, 'p1')).toBe(7);
    s = { ...play({ ...s, players: { ...s.players, p1: { ...s.players.p1, suppliesSpent: -10 } } }, 'p1', TERRAIN.supplyDepot), phase: 'End' };
    expect(suppliesMax(s, 'p1')).toBe(7); // no change the turn it's played
    s = toNextTurn(s);
    expect(suppliesMax(s, 'p1')).toBe(9);
    s = toNextTurn({ ...s, phase: 'End' });
    expect(suppliesMax(s, 'p1')).toBe(11);
    s = toNextTurn({ ...s, phase: 'End' });
    expect(suppliesMax(s, 'p1')).toBe(13);
    expect(suppliesMax({ ...s, turn: 41 }, 'p1')).toBe(20); // capped
  });

  it('Blacksmith Village: Equipment costs 1 less, never below 1', () => {
    const holder = placeShinobi(proto(freshMain1()), 'p1', 'shinobi-rain-jonin', 3, 5, 0);
    const s = play(holder.state, 'p1', TERRAIN.blacksmithVillage);
    const before = suppliesAvailable(s, 'p1');
    const knives = play(s, 'p1', 'equip-trench-knives', [holder.id]); // 5 → 4
    expect(suppliesAvailable(knives, 'p1')).toBe(before - 4);
    const protector = play(knives, 'p1', 'equip-forehead-protector', [holder.id]); // 2 → 1
    expect(suppliesAvailable(protector, 'p1')).toBe(before - 5);
    expect(equipmentOn(protector, holder.id)).toHaveLength(2);
  });

  it('Training Grounds can pool into a Shinobi with a Pool (Yahiko), not one without', () => {
    const y = placeShinobi(proto(freshMain1()), 'p1', 'shinobi-yahiko', 2, 3, 0);
    const g = placeShinobi(y.state, 'p1', 'shinobi-rain-genin', 1, 2, 1);
    const withPool = { ...g.state, players: { ...g.state.players, p1: { ...g.state.players.p1, frontRow: g.state.players.p1.frontRow.map((t) => (t?.instanceId === y.id ? { ...t, chakraPool: { current: 0, capacity: 8 } } : t)) } } };
    const s = play(withPool, 'p1', TERRAIN.trainingGrounds);
    expect(unit(act(s, { type: 'USE_TRAINING_GROUNDS', leaderId: y.id }), y.id)!.chakraPool!.current).toBe(1);
    expect(unit(act(s, { type: 'USE_TRAINING_GROUNDS', leaderId: g.id }), g.id)!.chakraPool).toBeUndefined();
  });

  it('Training Grounds: once per turn, 1 Supply pools 1 Chakra into a Leader', () => {
    const s = play(proto(freshMain1()), 'p1', TERRAIN.trainingGrounds);
    const pool = unit(s, 'p1-hidan')!.chakraPool!.current;
    const supplies = suppliesAvailable(s, 'p1');
    const once = act(s, { type: 'USE_TRAINING_GROUNDS', leaderId: 'p1-hidan' });
    expect(unit(once, 'p1-hidan')!.chakraPool!.current).toBe(pool + 1);
    expect(suppliesAvailable(once, 'p1')).toBe(supplies - 1);
    const twice = act(once, { type: 'USE_TRAINING_GROUNDS', leaderId: 'p1-kakuzu' });
    expect(unit(twice, 'p1-kakuzu')!.chakraPool!.current).toBe(unit(once, 'p1-kakuzu')!.chakraPool!.current);
    // Not on an enemy Leader, and not without the Terrain.
    expect(unit(act(s, { type: 'USE_TRAINING_GROUNDS', leaderId: 'p2-hidan' }), 'p2-hidan')!.chakraPool!.current).toBe(unit(s, 'p2-hidan')!.chakraPool!.current);
    expect(unit(act(proto(freshMain1()), { type: 'USE_TRAINING_GROUNDS', leaderId: 'p1-hidan' }), 'p1-hidan')!.chakraPool!.current).toBe(pool);
  });

  it('Forest of Death: only the first Shinobi you play each turn can attack right away', () => {
    let s = play(proto(freshMain1()), 'p1', TERRAIN.forestOfDeath);
    s = play(s, 'p1', 'shinobi-rain-jonin');
    s = play(s, 'p1', 'shinobi-rain-genin');
    const [first, second] = s.players.p1.frontRow.filter((t) => t?.extra.shinobi === true) as TokenInstance[];
    s = { ...s, phase: 'Combat' };
    const first2 = act(s, { type: 'DECLARE_SHINOBI_ATTACK', attackerId: first.instanceId, targetId: 'p2-hidan' });
    expect(first2.shinobiCombat?.attacks).toHaveLength(1);
    const second2 = act(s, { type: 'DECLARE_SHINOBI_ATTACK', attackerId: second.instanceId, targetId: 'p2-hidan' });
    expect(second2.shinobiCombat ?? null).toBeNull();
  });

  it('Hidden Mist: enemy Shinobi hitting your Leaders deal 1 less, to a minimum of 1', () => {
    const base = { ...proto(freshMain1()), activePlayer: 'p2' as const, priorityPlayer: 'p2' as const };
    const misty = play(base, 'p2', TERRAIN.hiddenMist);
    const attack = (s: GameState, damage: number) => {
      const a = placeShinobi({ ...s, activePlayer: 'p1', priorityPlayer: 'p1', phase: 'Combat' }, 'p1', 'shinobi-rain-jonin', damage, 5, 0);
      const hp = unit(a.state, 'p2-hidan')!.currentHP;
      const after = act(a.state, { type: 'DECLARE_SHINOBI_ATTACK', attackerId: a.id, targetId: 'p2-hidan' }, { type: 'CONFIRM_SHINOBI_ATTACKS' });
      return hp - unit(after, 'p2-hidan')!.currentHP;
    };
    expect(attack(misty, 3)).toBe(2);
    expect(attack(misty, 1)).toBe(1);
    expect(attack(base, 3)).toBe(3);
  });

  it('Shinobi Graveyard: one of your Shinobi defeated gives you 1 Supply this turn', () => {
    let s = play(proto(freshMain1()), 'p1', TERRAIN.shinobiGraveyard);
    const mine = placeShinobi(s, 'p1', 'shinobi-rain-genin', 1, 1, 0);
    const theirs = placeShinobi(mine.state, 'p2', 'shinobi-rain-jonin', 3, 5, 0);
    s = { ...theirs.state, phase: 'Combat' };
    const supplies = suppliesAvailable(s, 'p1');
    s = act(s, { type: 'DECLARE_SHINOBI_ATTACK', attackerId: mine.id, targetId: theirs.id }, { type: 'CONFIRM_SHINOBI_ATTACKS' });
    expect(unit(s, mine.id)).toBeUndefined();
    expect(suppliesAvailable(s, 'p1')).toBe(supplies + 1);
  });

  it("Valley of the End: both players' Leaders deal +1 with damage-dealing abilities — Shinobi don't", () => {
    const valley = play(proto(freshMain1()), 'p1', TERRAIN.valleyOfTheEnd);
    // A hit from one of the enemy's Leaders, mid-resolution, counts too (both sides).
    const leaderHit = (s: GameState, from: string, to: string) => {
      const resolving = { itemId: 'item-1', sourceInstanceId: from, abilityId: 'earth-grudge-fear', controllerId: from.slice(0, 2) as PlayerId, targets: [to] };
      const hp = unit(s, to)!.currentHP;
      return hp - unit(dealDamage({ ...s, resolving }, to, 2).state, to)!.currentHP;
    };
    expect(leaderHit(valley, 'p1-kakuzu', 'p2-hidan')).toBe(3);
    expect(leaderHit(valley, 'p2-kakuzu', 'p1-hidan')).toBe(3);
    expect(leaderHit(proto(freshMain1()), 'p1-kakuzu', 'p2-hidan')).toBe(2);
    const a = placeShinobi({ ...valley, phase: 'Combat' }, 'p1', 'shinobi-rain-jonin', 3, 5, 0);
    const hp = unit(a.state, 'p2-hidan')!.currentHP;
    const after = act(a.state, { type: 'DECLARE_SHINOBI_ATTACK', attackerId: a.id, targetId: 'p2-hidan' }, { type: 'CONFIRM_SHINOBI_ATTACKS' });
    expect(hp - unit(after, 'p2-hidan')!.currentHP).toBe(3);
  });

  it('every Terrain is Unique in the Prototype, and the starter deck (within 80 cards) carries four of them', () => {
    // (Akatsuki Hideout is Unique only in the Prototype build — the base game's preset carries 2.)
    for (const id of Object.values(TERRAIN).filter((t) => t !== TERRAIN.akatsukiHideout)) expect(copyLimit('hand', id)).toBe(1);
    const setup = createSetupState('p1', 'strict', {}, { ruleset: 'prototype' });
    const all = [...setup.players.p1.handDeck, ...setup.players.p1.hand.filter((h) => h.kind === 'card')].map((c) => c.defId);
    const terrain = all.filter((d) => (Object.values(TERRAIN) as string[]).includes(d));
    expect(terrain).toHaveLength(4);
    expect(new Set(terrain).size).toBe(4);
    expect(all.length).toBeLessThanOrEqual(80);
  });
});
