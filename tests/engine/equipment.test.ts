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

function placeShinobi(state: GameState, player: PlayerId, name: string, damage: number, health: number, slot: number, defId = 'shinobi-rain-genin'): { state: GameState; id: string } {
  const id = `${player}-test-${name}`;
  const token: TokenInstance = {
    instanceId: id,
    defId,
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
  it('costs its one Supply cost and enters play on a Shinobi, adding its buff', () => {
    const a = placeShinobi(proto(freshMain1()), 'p1', 'Jonin', 3, 5, 0);
    const s = a.state;
    const before = suppliesAvailable(s, 'p1');
    const next = equip(s, 'p1', 'equip-forehead-protector', a.id);
    expect(equipmentOn(next, a.id)).toHaveLength(1);
    expect(unit(next, a.id)!.maxHP).toBe(7);
    expect(unit(next, a.id)!.currentHP).toBe(7);
    expect(suppliesAvailable(next, 'p1')).toBe(before - 2);
    expect(next.players.p1.hand.some((h) => h.kind === 'card' && h.defId === 'equip-forehead-protector')).toBe(false);
  });

  it("can't go on a Leader, an enemy, a token, or into play with no holder", () => {
    let s = proto(freshMain1());
    expect(equip(s, 'p1', 'equip-kunai-pouch', 'p1-hidan').players.p1.equipment ?? []).toHaveLength(0);
    const enemy = placeShinobi(s, 'p2', 'Genin', 1, 2, 0);
    expect(equip(enemy.state, 'p1', 'equip-kunai-pouch', enemy.id).players.p1.equipment ?? []).toHaveLength(0);
    expect(equip(s, 'p1', 'equip-kunai-pouch', '').players.p1.equipment ?? []).toHaveLength(0);
    const tokenSlot = s.players.p1.frontRow.findIndex((t) => t === null);
    const frontRow = s.players.p1.frontRow.slice();
    frontRow[tokenSlot] = { instanceId: 'p1-spider', defId: 'clay-spider', owner: 'p1', name: 'Clay Spider', maxHP: 1, currentHP: 1, ownerCharacterInstanceId: 'p1-deidara', status: { disabled: false, retreated: false, enteredTurn: 0, hasAmbush: false, usedAbilitiesThisTurn: [], pooledThisTurn: false }, extra: {} };
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, frontRow } } };
    expect(equip(s, 'p1', 'equip-kunai-pouch', 'p1-spider').players.p1.equipment ?? []).toHaveLength(0);
  });

  it('Chakra Storage Scroll is the exception: it can go on a Leader, and its Pool holds 2 more', () => {
    const s = proto(freshMain1());
    const cap = unit(s, 'p1-hidan')!.chakraPool!.capacity;
    const next = equip(s, 'p1', 'equip-chakra-scroll', 'p1-hidan');
    expect(equipmentOn(next, 'p1-hidan')).toHaveLength(1);
    expect(unit(next, 'p1-hidan')!.chakraPool!.capacity).toBe(cap + 2);
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

  it("reads a Shinobi's Styles and Synergy: Trench Knives +2 with Wind, the Akatsuki Cloak's +1 for Yahiko", () => {
    const y = placeShinobi({ ...proto(freshMain1()), turn: 41 }, 'p1', 'Yahiko', 2, 3, 0, 'shinobi-yahiko'); // 20 Supplies
    const g = placeShinobi(y.state, 'p1', 'Genin', 1, 2, 1);
    let s = equip(g.state, 'p1', 'equip-trench-knives', y.id);
    s = equip(s, 'p1', 'equip-trench-knives', g.id);
    expect(equipmentDamageBonus(s, unit(s, y.id)!)).toBe(2); // Yahiko has Wind Style
    expect(equipmentDamageBonus(s, unit(s, g.id)!)).toBe(1);
    s = equip(s, 'p1', 'equip-akatsuki-cloak', y.id);
    expect(equipmentDamageBonus(s, unit(s, y.id)!)).toBe(3); // + the Cloak's Akatsuki bonus
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

  it("goes to the discard pile when its holder is defeated — and an Explosive Tag Vest hits the attacker first", () => {
    const def = placeShinobi(proto(freshMain1()), 'p2', 'Genin', 1, 2, 0);
    const att = placeShinobi(def.state, 'p1', 'Jonin', 3, 5, 0);
    let s = equip({ ...att.state, activePlayer: 'p2', priorityPlayer: 'p2' }, 'p2', 'equip-explosive-tag-vest', def.id);
    s = { ...s, activePlayer: 'p1', priorityPlayer: 'p1', phase: 'Combat' };
    s = gameReducer(s, { type: 'DECLARE_SHINOBI_ATTACK', attackerId: att.id, targetId: def.id });
    s = gameReducer(s, { type: 'CONFIRM_SHINOBI_ATTACKS' });
    expect(unit(s, def.id)).toBeUndefined();
    expect(s.players.p2.equipment ?? []).toEqual([]);
    expect(s.players.p2.discardPile.map((c) => c.defId)).toContain('equip-explosive-tag-vest');
    expect(unit(s, att.id)!.currentHP).toBe(2); // 5 − 1 (the Genin's hit) − 2 (the Vest)
  });

  it('Medical Pouch: at your Upkeep you may pay 1 Supply to heal the holder 1', () => {
    const a = placeShinobi(proto(freshMain1()), 'p1', 'Jonin', 3, 5, 0);
    const equipped = equip(a.state, 'p1', 'equip-medical-pouch', a.id);
    const hurt = (s: GameState, hp: number): GameState => ({ ...s, players: { ...s.players, p1: { ...s.players.p1, frontRow: s.players.p1.frontRow.map((t) => (t?.instanceId === a.id ? { ...t, currentHP: hp } : t)) } } });
    const toUpkeep = (start: GameState) => {
      let s = start;
      for (let i = 0; i < 7 * 2 && !(s.activePlayer === 'p1' && s.phase === 'Upkeep'); i++) s = gameReducer(s, { type: 'ADVANCE_PHASE' });
      expect(s.phase).toBe('Upkeep');
      return s;
    };
    const s = toUpkeep(hurt(equipped, 2));
    const choice = s.pendingChoices.find((c) => c.resolverId === 'equipment-upkeep-heal')!;
    expect(choice.player).toBe('p1');
    const supplies = suppliesAvailable(s, 'p1');
    const healed = gameReducer(s, { type: 'RESOLVE_CHOICE', choiceId: choice.id, optionIds: ['heal'] });
    expect(unit(healed, a.id)!.currentHP).toBe(3);
    expect(suppliesAvailable(healed, 'p1')).toBe(supplies - 1);
    const skipped = gameReducer(s, { type: 'RESOLVE_CHOICE', choiceId: choice.id, optionIds: ['skip'] });
    expect(unit(skipped, a.id)!.currentHP).toBe(2);
    expect(suppliesAvailable(skipped, 'p1')).toBe(supplies);
    // Not asked while the holder is at full Health.
    expect(toUpkeep(equipped).pendingChoices.some((c) => c.resolverId === 'equipment-upkeep-heal')).toBe(false);
  });

  it('Medical Pouch costs 2 Supplies on a Shinobi but 8 on a Leader, and its heal costs 4 on a Leader', () => {
    const a = placeShinobi(proto(freshMain1()), 'p1', 'Jonin', 3, 5, 0);
    const before = suppliesAvailable(a.state, 'p1');
    expect(suppliesAvailable(equip(a.state, 'p1', 'equip-medical-pouch', a.id), 'p1')).toBe(before - 2);
    let s = equip(a.state, 'p1', 'equip-medical-pouch', 'p1-kisame');
    expect(equipmentOn(s, 'p1-kisame')).toHaveLength(1);
    expect(suppliesAvailable(s, 'p1')).toBe(before - 8);
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c) => (c?.instanceId === 'p1-kisame' ? { ...c, currentHP: c.maxHP - 2 } : c)) } } };
    for (let i = 0; i < 7 * 2 && !(s.activePlayer === 'p1' && s.phase === 'Upkeep'); i++) s = gameReducer(s, { type: 'ADVANCE_PHASE' });
    const choice = s.pendingChoices.find((c) => c.resolverId === 'equipment-upkeep-heal')!;
    expect(choice.data.cost).toBe(4);
    const hp = unit(s, 'p1-kisame')!.currentHP;
    const supplies = suppliesAvailable(s, 'p1');
    const healed = gameReducer(s, { type: 'RESOLVE_CHOICE', choiceId: choice.id, optionIds: ['heal'] });
    expect(unit(healed, 'p1-kisame')!.currentHP).toBe(hp + 1);
    expect(suppliesAvailable(healed, 'p1')).toBe(supplies - 4);
  });

  it("can't be discarded as Chakra; the Cloak is Unique; the starter deck carries 2 Medical Pouches and 2 Chakra Storage Scrolls", () => {
    expect(canBeChakraSource(getHandCardDef('equip-kunai-pouch')!)).toBe(false);
    expect(copyLimit('hand', 'equip-akatsuki-cloak')).toBe(1);
    expect(copyLimit('hand', 'equip-kunai-pouch')).toBe(3);
    const setup = createSetupState('p1', 'strict', {}, { ruleset: 'prototype' });
    const all = [...setup.players.p1.handDeck, ...setup.players.p1.hand.filter((h) => h.kind === 'card')].map((c) => c.defId);
    expect(all.filter((d) => d.startsWith('equip-')).sort()).toEqual(['equip-chakra-scroll', 'equip-chakra-scroll', 'equip-medical-pouch', 'equip-medical-pouch']); // the rest are in the Deck Library
  });
});
