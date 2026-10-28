import { describe, expect, it } from 'vitest';
import { gameReducer } from '../../src/engine/reducer';
import { makeHandCardInstance } from '../../src/engine/deck';
import { shinobiDamage } from '../../src/engine/shinobi';
import { equipmentDamageBonus, equipmentOn } from '../../src/engine/equipment';
import { canBeChakraSource, getHandCardDef } from '../../src/engine/cards/registry';
import { suppliesAvailable } from '../../src/engine/prototype';
import { createSetupState } from '../../src/engine/state';
import { copyLimit } from '../../src/engine/decklist';
import { freshMain1 } from './testUtils';
import type { GameState, PlayerId, TokenInstance } from '../../src/engine/types';

// Prototype rules: Equipment (engine/equipment.ts).

/** A Prototype game on a late turn, so there are plenty of Supplies to spend. */
const proto = (s: GameState): GameState => ({ ...s, ruleset: 'prototype', turn: 21 });

function addToHand(state: GameState, player: PlayerId, defId: string) {
  const card = makeHandCardInstance(defId);
  const p = state.players[player];
  return { state: { ...state, players: { ...state.players, [player]: { ...p, hand: [...p.hand, { kind: 'card' as const, instanceId: card.instanceId, defId }] } } }, instanceId: card.instanceId };
}

function equip(state: GameState, player: PlayerId, defId: string, holderId: string): GameState {
  const card = addToHand(state, player, defId);
  return gameReducer(card.state, { type: 'PLAY_HAND_CARD', instanceId: card.instanceId, enablingInstanceId: '', targetInstanceIds: [holderId], payFromPool: 0 });
}

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

const unit = (s: GameState, id: string) => [...s.players.p1.backRow, ...s.players.p2.backRow, ...s.players.p1.frontRow, ...s.players.p2.frontRow].find((u) => u?.instanceId === id);

describe('Prototype: Equipment', () => {
  it('costs Supplies and attaches straight to a Leader, adding its buff', () => {
    const s = proto(freshMain1());
    const hp = unit(s, 'p1-hidan')!.maxHP;
    const before = suppliesAvailable(s, 'p1');
    const next = equip(s, 'p1', 'equip-forehead-protector', 'p1-hidan');
    expect(equipmentOn(next, 'p1-hidan')).toHaveLength(1);
    expect(unit(next, 'p1-hidan')!.maxHP).toBe(hp + 2);
    expect(unit(next, 'p1-hidan')!.currentHP).toBe(hp + 2);
    expect(suppliesAvailable(next, 'p1')).toBe(before - 1);
    expect(next.players.p1.hand.some((h) => h.kind === 'card' && h.defId === 'equip-forehead-protector')).toBe(false);
  });

  it("can't go on an enemy, on a token, or into play with no holder", () => {
    let s = proto(freshMain1());
    expect(equip(s, 'p1', 'equip-kunai-pouch', 'p2-hidan').players.p1.equipment ?? []).toHaveLength(0);
    expect(equip(s, 'p1', 'equip-kunai-pouch', '').players.p1.equipment ?? []).toHaveLength(0);
    const tokenSlot = s.players.p1.frontRow.findIndex((t) => t === null);
    const frontRow = s.players.p1.frontRow.slice();
    frontRow[tokenSlot] = { instanceId: 'p1-spider', defId: 'clay-spider', owner: 'p1', name: 'Clay Spider', maxHP: 1, currentHP: 1, ownerCharacterInstanceId: 'p1-deidara', status: { disabled: false, retreated: false, enteredTurn: 0, hasAmbush: false, usedAbilitiesThisTurn: [], pooledThisTurn: false }, extra: {} };
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, frontRow } } };
    expect(equip(s, 'p1', 'equip-kunai-pouch', 'p1-spider').players.p1.equipment ?? []).toHaveLength(0);
  });

  it('a unit can hold any number of Equipment, and their buffs add up', () => {
    const a = placeShinobi(proto(freshMain1()), 'p1', 'Jonin', 3, 5, 0);
    let s = equip(a.state, 'p1', 'equip-kunai-pouch', a.id);
    s = equip(s, 'p1', 'equip-kunai-pouch', a.id);
    s = equip(s, 'p1', 'equip-forehead-protector', a.id);
    expect(equipmentOn(s, a.id)).toHaveLength(3);
    expect(shinobiDamage(unit(s, a.id)!, s)).toBe(5);
    expect(unit(s, a.id)!.maxHP).toBe(7);
  });

  it("adds a Leader's Damage to each hit of its attacks", () => {
    const s = equip(proto(freshMain1()), 'p1', 'equip-trench-knives', 'p1-kakuzu');
    // Kakuzu has Wind Style: Chakra Trench Knives give +2.
    expect(equipmentDamageBonus(s, unit(s, 'p1-kakuzu')!)).toBe(2);
    expect(equipmentDamageBonus(equip(proto(freshMain1()), 'p1', 'equip-trench-knives', 'p1-hidan'), unit(s, 'p1-hidan')!)).toBe(1);
  });

  it('Flak Vest reduces each hit by 1, but never below 1', () => {
    const def = placeShinobi(proto(freshMain1()), 'p2', 'Chunin', 2, 6, 0);
    const att = placeShinobi(def.state, 'p1', 'Jonin', 3, 5, 0);
    let s = equip({ ...att.state, activePlayer: 'p2', priorityPlayer: 'p2' }, 'p2', 'equip-flak-vest', def.id);
    s = { ...s, activePlayer: 'p1', priorityPlayer: 'p1', phase: 'Combat' };
    s = gameReducer(s, { type: 'DECLARE_SHINOBI_ATTACK', attackerId: att.id, targetId: def.id });
    s = gameReducer(s, { type: 'CONFIRM_SHINOBI_ATTACKS' });
    expect(unit(s, def.id)!.currentHP).toBe(4); // 3 − 1
    expect(unit(s, att.id)!.currentHP).toBe(3); // the Chunin's 2 hits back, unreduced
  });

  it("stays in play, unattached, when its holder is defeated — and an Explosive Tag Vest hits the attacker", () => {
    const def = placeShinobi(proto(freshMain1()), 'p2', 'Genin', 1, 2, 0);
    const att = placeShinobi(def.state, 'p1', 'Jonin', 3, 5, 0);
    let s = equip({ ...att.state, activePlayer: 'p2', priorityPlayer: 'p2' }, 'p2', 'equip-explosive-tag-vest', def.id);
    s = { ...s, activePlayer: 'p1', priorityPlayer: 'p1', phase: 'Combat' };
    s = gameReducer(s, { type: 'DECLARE_SHINOBI_ATTACK', attackerId: att.id, targetId: def.id });
    s = gameReducer(s, { type: 'CONFIRM_SHINOBI_ATTACKS' });
    expect(unit(s, def.id)).toBeUndefined();
    expect(s.players.p2.equipment).toEqual([expect.objectContaining({ defId: 'equip-explosive-tag-vest', holderId: null })]);
    expect(unit(s, att.id)!.currentHP).toBe(2); // 5 − 1 (the Genin's hit) − 2 (the Vest)
  });

  it('re-equip moves it for its Re-equip cost, only in your Main Phase, taking the buff with it', () => {
    let s = equip(proto(freshMain1()), 'p1', 'equip-forehead-protector', 'p1-hidan');
    const hidanHP = unit(s, 'p1-hidan')!.maxHP;
    const kakuzuHP = unit(s, 'p1-kakuzu')!.maxHP;
    const id = s.players.p1.equipment![0].instanceId;
    expect(gameReducer({ ...s, phase: 'Combat' }, { type: 'REEQUIP', equipmentInstanceId: id, holderId: 'p1-kakuzu' }).players.p1.equipment![0].holderId).toBe('p1-hidan');
    const supplies = suppliesAvailable(s, 'p1');
    s = gameReducer(s, { type: 'REEQUIP', equipmentInstanceId: id, holderId: 'p1-kakuzu' });
    expect(s.players.p1.equipment![0].holderId).toBe('p1-kakuzu');
    expect(suppliesAvailable(s, 'p1')).toBe(supplies - 1);
    expect(unit(s, 'p1-hidan')!.maxHP).toBe(hidanHP - 2);
    expect(unit(s, 'p1-kakuzu')!.maxHP).toBe(kakuzuHP + 2);
  });

  it('Medical Pouch heals its holder in Upkeep', () => {
    // Hidan heals on his own too, so compare against the same turn without the Pouch.
    const toUpkeep = (start: GameState) => {
      let s: GameState = { ...start, players: { ...start.players, p1: { ...start.players.p1, backRow: start.players.p1.backRow.map((c) => (c?.instanceId === 'p1-hidan' ? { ...c, currentHP: 1 } : c)) } } };
      for (let i = 0; i < 7 * 2 && !(s.activePlayer === 'p1' && s.phase === 'Upkeep'); i++) s = gameReducer(s, { type: 'ADVANCE_PHASE' });
      expect(s.phase).toBe('Upkeep');
      return unit(s, 'p1-hidan')!.currentHP;
    };
    const plain = proto(freshMain1());
    expect(toUpkeep(equip(plain, 'p1', 'equip-medical-pouch', 'p1-hidan'))).toBe(toUpkeep(plain) + 1);
  });

  it("can't be discarded as Chakra; the Cloak is Unique; the starter deck carries them", () => {
    expect(canBeChakraSource(getHandCardDef('equip-kunai-pouch')!)).toBe(false);
    expect(copyLimit('hand', 'equip-akatsuki-cloak')).toBe(1);
    expect(copyLimit('hand', 'equip-kunai-pouch')).toBe(3);
    const setup = createSetupState('p1', 'strict', {}, { ruleset: 'prototype' });
    const all = [...setup.players.p1.handDeck, ...setup.players.p1.hand.filter((h) => h.kind === 'card')].map((c) => c.defId);
    expect(all.filter((d) => d.startsWith('equip-'))).toHaveLength(15); // 2 of each of 7, 1 Cloak
  });
});
