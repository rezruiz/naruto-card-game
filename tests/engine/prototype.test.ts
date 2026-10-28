import { describe, expect, it } from 'vitest';
import { activateAbility } from '../../src/engine/abilities';
import { gameReducer } from '../../src/engine/reducer';
import { makeHandCardInstance } from '../../src/engine/deck';
import { getAdjacent, legalCharacterSlots, legalTokenSlots, maxCharacters, placeCharacter } from '../../src/engine/board';
import { previewUpkeep } from '../../src/engine/upkeep';
import { shinobiDamage } from '../../src/engine/shinobi';
import { suppliesAvailable, suppliesMax } from '../../src/engine/prototype';
import { currentTax } from '../../src/engine/playCharacter';
import { canBeChakraSource, getHandCardDef, needsEnablingCharacter, paysInChakra } from '../../src/engine/cards/registry';
import { createSetupState } from '../../src/engine/state';
import { freshMain1, giveChakra, resolveTop, withCharacterAt } from './testUtils';
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

describe('Prototype: Chakra is paid only from Pools', () => {
  it("a Leader's ability can't use generic Chakra — only its own Pool", () => {
    const s = { ...proto(giveChakra(freshMain1(), 'p1', 5)), phase: 'Combat' as const };
    expect(activateAbility(s, 'p1-kakuzu', 'earth-grudge-fear', ['p2-hidan'], 0).stack).toHaveLength(0);
    const pooled = activateAbility(withPool(s, 'p1-kakuzu', 2), 'p1-kakuzu', 'earth-grudge-fear', ['p2-hidan'], 0);
    expect(pooled.stack).toHaveLength(1);
    expect(unit(pooled, 'p1-kakuzu')!.chakraPool!.current).toBe(0);
    expect(pooled.players.p1.genericChakraAvailable).toBe(5); // untouched
  });

  it("a Jutsu card is paid from its enabling Leader's Pool, and even a Type: None Jutsu needs a Leader", () => {
    let s = proto(giveChakra(freshMain1(), 'p1', 5));
    const recon = addToHand(s, 'p1', 'reconnaissance');
    expect(gameReducer(recon.state, { type: 'PLAY_HAND_CARD', instanceId: recon.instanceId, enablingInstanceId: '', targetInstanceIds: [], payFromPool: 0 }).stack).toHaveLength(0);
    s = withPool(recon.state, 'p1-hidan', 1);
    const played = gameReducer(s, { type: 'PLAY_HAND_CARD', instanceId: recon.instanceId, enablingInstanceId: 'p1-hidan', targetInstanceIds: [], payFromPool: 0 });
    expect(played.stack).toHaveLength(1);
    expect(unit(played, 'p1-hidan')!.chakraPool!.current).toBe(0);
    expect(played.players.p1.genericChakraAvailable).toBe(5);
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
    expect(all.filter((d) => d.startsWith('shinobi-'))).toHaveLength(12); // 2 of each of the 6 Shinobi, Rebels included
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

describe('Prototype: drawing a new Leader', () => {
  /** p1 in Main 1 on their 11th turn (10+ Supplies), with a known Character Deck. */
  function leaderDrawState(deck: string[]): GameState {
    const s = proto(freshMain1());
    return { ...s, turn: 21, players: { ...s.players, p1: { ...s.players.p1, characterDeck: deck, suppliesSpent: 0 } } };
  }

  it('costs a flat 10 Supplies, every time', () => {
    let s = leaderDrawState(['konan', 'zetsu', 'juzo', 'yahiko']);
    expect(currentTax(s, 'p1')).toBe(10);
    s = gameReducer(s, { type: 'DRAW_CHARACTER_DECK', player: 'p1' });
    expect(suppliesAvailable(s, 'p1')).toBe(suppliesMax(s, 'p1') - 10);
    s = gameReducer(s, { type: 'CHOOSE_CHARACTER', player: 'p1', entryId: 'zetsu' });
    expect(currentTax(s, 'p1')).toBe(10);
  });

  it('shows the whole Character Deck and gives exactly the Leader picked — no D-rank bonus — and leaves the rest in order (no shuffle)', () => {
    const deck = ['konan', 'amegakure-civilian-rebel', 'juzo', 'yahiko', 'amegakure-civilian-rebel'];
    let s = gameReducer(leaderDrawState(deck), { type: 'DRAW_CHARACTER_DECK', player: 'p1' });
    expect(s.players.p1.pendingCharacterReveal?.revealed).toEqual(deck);
    const handBefore = s.players.p1.hand.length;
    s = gameReducer(s, { type: 'CHOOSE_CHARACTER', player: 'p1', entryId: 'yahiko' });
    const added = s.players.p1.hand.slice(handBefore);
    expect(added).toEqual([expect.objectContaining({ kind: 'character', entryId: 'yahiko' })]);
    expect(s.players.p1.characterDeck).toEqual(['konan', 'amegakure-civilian-rebel', 'juzo', 'amegakure-civilian-rebel']);
    expect(s.players.p1.pendingCharacterReveal).toBeNull();
  });

  it("can't be drawn without 10 Supplies under the strict rules", () => {
    const s = { ...leaderDrawState(['konan', 'zetsu']), turn: 5, rules: 'strict' as const };
    const next = gameReducer(s, { type: 'DRAW_CHARACTER_DECK', player: 'p1' });
    expect(next.players.p1.pendingCharacterReveal).toBeNull();
    expect(next.players.p1.characterDeck).toEqual(['konan', 'zetsu']);
  });
});

describe('Prototype: Amegakure Civilian Rebel is a Shinobi', () => {
  it('is not dealt into the Leader Deck, and the starter deck has 2 Rebel Shinobi', () => {
    const s = createSetupState('p1', 'trust', {}, { ruleset: 'prototype' });
    const p = s.players.p1;
    const leaders = [...p.characterDeck, ...(p.pendingCharacterReveal?.revealed ?? [])];
    expect(leaders).not.toContain('amegakure-civilian-rebel');
    const cards = [...p.handDeck.map((c) => c.defId), ...p.hand.flatMap((h) => (h.kind === 'card' ? [h.defId] : []))];
    expect(cards.filter((id) => id === 'shinobi-amegakure-civilian-rebel')).toHaveLength(2);
  });

  it('deals 1 Damage, or 2 while its controller has Yahiko in play', () => {
    let s = proto(freshMain1());
    ({ state: s } = placeShinobi(s, 'p1', 'Rebel', 1, 3, 0));
    const rebel = { ...s.players.p1.frontRow[0]!, extra: { shinobi: true, shinobiDamage: 1, shinobiLeaderBonus: { defId: 'yahiko', amount: 1 } } };
    const withoutYahiko = { ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c) => (c?.defId === 'yahiko' ? null : c)) } } };
    expect(shinobiDamage(rebel, withoutYahiko)).toBe(1);
    expect(shinobiDamage(rebel, withCharacterAt(withoutYahiko, 'p1', 4, 'yahiko'))).toBe(2);
  });
});
