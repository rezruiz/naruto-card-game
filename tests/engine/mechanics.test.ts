import { describe, expect, it } from 'vitest';
import { activateAbility } from '../../src/engine/abilities';
import { placeToken } from '../../src/engine/board';
import { createSixPaths, getTokenDef } from '../../src/engine/characters';
import { dealDamage } from '../../src/engine/combat';
import { registerHandCard } from '../../src/engine/cards/registry';
import { makeHandCardInstance } from '../../src/engine/deck';
import { gameReducer } from '../../src/engine/reducer';
import type { AbilityChoices, GameState, PlayerId, TokenInstance } from '../../src/engine/types';
import { freshCombat, freshMain1, giveChakra, playCard, resolveTop, withCharacterAt } from './testUtils';

// Engine mechanics that used to be "simplified": source-aware damage modifiers, cost modifiers,
// kill/damage tracking, redirects, and Pain's Rinnegan/Almighty Push/Beast bookkeeping.

const unit = (s: GameState, id: string) => [...s.players.p1.backRow, ...s.players.p1.frontRow, ...s.players.p2.backRow, ...s.players.p2.frontRow].find((u) => u?.instanceId === id)!;
const hp = (s: GameState, id: string) => unit(s, id).currentHP;
const ownerOf = (id: string): PlayerId => (id.startsWith('p2') || id.includes('-p2-') ? 'p2' : 'p1');
const setExtra = (s: GameState, id: string, patch: Record<string, unknown>): GameState => {
  const map = <T extends { instanceId: string; extra: Record<string, unknown> } | null>(u: T): T => (u && u.instanceId === id ? { ...u, extra: { ...u.extra, ...patch } } : u);
  return {
    ...s,
    players: {
      p1: { ...s.players.p1, backRow: s.players.p1.backRow.map(map), frontRow: s.players.p1.frontRow.map(map) },
      p2: { ...s.players.p2, backRow: s.players.p2.backRow.map(map), frontRow: s.players.p2.frontRow.map(map) },
    },
  };
};

/** `attacker` (owner inferred from its id) uses an ability in Combat with plenty of Chakra; the item is pushed but not resolved. */
function use(s: GameState, attacker: string, abilityId: string, targets: string[], choices?: AbilityChoices, payFromPool = 0): GameState {
  const owner = ownerOf(attacker);
  const ready = giveChakra({ ...s, activePlayer: owner, priorityPlayer: owner, phase: 'Combat' }, owner, 20);
  return activateAbility(ready, attacker, abilityId, targets, payFromPool, { choices });
}
const hit = (s: GameState, attacker: string, abilityId: string, targets: string[]) => resolveTop(use(s, attacker, abilityId, targets));

function withPaths(s: GameState, owner: PlayerId): { s: GameState; paths: TokenInstance[] } {
  const paths = createSixPaths(owner).map((t) => ({ ...t, status: { ...t.status, enteredTurn: 0 } }));
  let next = s;
  for (const t of paths) next = placeToken(next, owner, t);
  return { s: next, paths };
}

describe('Damage modifiers (who hits, with what)', () => {
  it("Konan's Paper Body: −2 from Taijutsu, +1 from Fire", () => {
    const s = withCharacterAt(freshCombat(), 'p1', 0, 'konan');
    expect(hp(hit(s, 'p2-hidan', 'triple-scythe-sweep', ['p1-konan']), 'p1-konan')).toBe(11); // 1 − 2
    expect(hp(hit(s, 'p2-itachi', 'great-fireball-technique', ['p1-konan']), 'p1-konan')).toBe(7); // Fire 3 + 1
  });

  it("Juzo's Iron-Forged Body: −1 from Taijutsu, never below 1", () => {
    const s = withCharacterAt(freshCombat(), 'p1', 0, 'juzo');
    expect(hp(hit(s, 'p2-hidan', 'triple-scythe-sweep', ['p1-juzo']), 'p1-juzo')).toBe(8); // 1 stays 1
    expect(hp(hit(s, 'p2-kakuzu', 'earth-grudge-fear', ['p1-juzo']), 'p1-juzo')).toBe(8); // 1 stays 1
  });

  it("Itachi's Sharingan Foresight: −1 from Quick abilities and Quick Jutsu targeting him", () => {
    const s = giveChakra({ ...freshCombat(), activePlayer: 'p2', priorityPlayer: 'p2' }, 'p2', 20);
    expect(hp(resolveTop(playCard(s, 'p2', 'jutsu-false-darkness', 'p2-kakuzu', ['p1-itachi'])), 'p1-itachi')).toBe(11); // Quick 2 − 1 (Itachi has 12 HP)
    expect(hp(resolveTop(playCard(s, 'p2', 'jutsu-thousand-hungry-sharks', 'p2-kisame', ['p1-itachi'])), 'p1-itachi')).toBe(8); // Normal 4
  });

  it("Kakuzu's Iron Skin: −2 physical and −2 elemental until the end of the next turn", () => {
    let s = hit(freshCombat(), 'p1-kakuzu', 'iron-skin', []);
    expect(hp(hit(s, 'p2-hidan', 'triple-scythe-sweep', ['p1-kakuzu']), 'p1-kakuzu')).toBe(4); // 1 − 2
    s = resolveTop(playCard(giveChakra({ ...s, activePlayer: 'p2', priorityPlayer: 'p2', phase: 'Combat' }, 'p2', 20), 'p2', 'jutsu-thousand-hungry-sharks', 'p2-kisame', ['p1-kakuzu'])); // Water Ninjutsu 4 − 2
    expect(hp(s, 'p1-kakuzu')).toBe(2);
  });

  it("Rallying Words: an ally's next attack this turn deals +1", () => {
    let s = withCharacterAt(freshCombat(), 'p1', 0, 'yahiko');
    s = resolveTop(use({ ...s, phase: 'Main1' }, 'p1-yahiko', 'rallying-words', []));
    const before = hp(s, 'p2-deidara');
    s = hit(s, 'p1-hidan', 'triple-scythe-sweep', ['p2-deidara']);
    expect(before - hp(s, 'p2-deidara')).toBe(2); // 1 + 1
    expect(unit(s, 'p1-hidan').extra.rallyingSpentOn).toBeDefined(); // used up
  });

  it("Banshō Ten'in: +1 damage for the rest of the turn, and damage prevention can't protect it", () => {
    let { s } = withPaths(freshCombat(), 'p1');
    const deva = s.players.p1.frontRow.find((t) => t?.defId === 'deva-path')!.instanceId;
    s = setExtra(s, 'p2-kisame', { damagePreventionRemaining: 5, damagePreventionUntilTurn: s.turn });
    s = hit(s, deva, 'bansho-tennin', ['p2-kisame']); // its own 1 is still prevented
    const before = hp(s, 'p2-kisame');
    s = hit(s, 'p1-kakuzu', 'earth-grudge-fear', ['p2-kisame']);
    expect(before - hp(s, 'p2-kisame')).toBe(2); // 1 + 1, prevention bypassed
  });
});

describe('Cost modifiers', () => {
  it("an enemy Ninjutsu attack on a transformed Kisame lets him Absorb 1 from its user (no extra cost to target him)", () => {
    let s = setExtra(freshCombat(), 'p2-kisame', { transformed: true, absorbedChakra: 10 });
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c) => (c?.defId === 'itachi' ? { ...c, chakraPool: { ...c.chakraPool, current: 2 } } : c)) } } };
    s = use(s, 'p1-itachi', 'great-fireball-technique', ['p2-kisame']);
    expect(s.players.p1.genericChakraAvailable).toBe(15); // printed 5, no surcharge
    s = resolveTop(s);
    expect(unit(s, 'p2-kisame').extra.absorbedChakra).toBe(11);
    expect(unit(s, 'p1-itachi').chakraPool!.current).toBe(1);
    // A Taijutsu attack doesn't feed it.
    const t = resolveTop(use(setExtra(freshCombat(), 'p2-kisame', { transformed: true, absorbedChakra: 10 }), 'p1-itachi', 'crow-shuriken-barrage', ['p2-kisame']));
    expect(unit(t, 'p2-kisame').extra.absorbedChakra).toBe(10);
  });

  it("Bingo Book C's reward: the next ability of the character that made the kill costs 2 less (once)", () => {
    let s = setExtra(freshCombat(), 'p1-hidan', { nextAbilityDiscount: 2 });
    s = use(s, 'p1-hidan', 'triple-scythe-sweep', ['p2-deidara']);
    expect(s.players.p1.genericChakraAvailable).toBe(19); // 3 − 2
    expect(unit(s, 'p1-hidan').extra.nextAbilityDiscount).toBe(0);
  });

  it('Genjutsu Master: a Genjutsu card Itachi enables costs 1 less (min 1) — not when someone else enables it', () => {
    registerHandCard({ id: 't-genjutsu', name: 'Test Genjutsu', cardType: 'jutsu', cost: 3, speed: 'Quick', style: 'None', type: 'Genjutsu', maxTargets: 0, timing: 'either', resolve: (ctx) => ctx.state });
    for (const [enabler, paid] of [['p1-itachi', 2], ['p1-kakuzu', 3]] as const) {
      const card = makeHandCardInstance('t-genjutsu');
      let s = giveChakra({ ...freshCombat(), priorityPlayer: 'p1' }, 'p1', 10);
      s = { ...s, players: { ...s.players, p1: { ...s.players.p1, hand: [{ kind: 'card', ...card }] } } };
      s = gameReducer(s, { type: 'PLAY_HAND_CARD', instanceId: card.instanceId, enablingInstanceId: enabler, targetInstanceIds: [], payFromPool: 0 });
      expect(s.players.p1.genericChakraAvailable).toBe(10 - paid);
    }
  });
});

describe('Conditions that track who damaged or defeated whom', () => {
  it("Hidan can't be targeted by his own side while his Curse is active", () => {
    const s = setExtra(freshCombat(), 'p1-hidan', { curseActive: true, cursedTarget: 'p2-kisame' });
    expect(use(s, 'p1-kakuzu', 'earth-grudge-fear', ['p1-hidan']).stack).toHaveLength(0);
  });

  it('Water Prison ends early only if a single hit deals Kisame 3 or more damage', () => {
    let s = setExtra(freshCombat(), 'p2-itachi', { targetLockUntilTurn: 99, targetLockBy: 'p1-kisame' });
    s = hit(s, 'p2-hidan', 'triple-scythe-sweep', ['p1-kisame']); // 1 damage holds
    expect(unit(s, 'p2-itachi').extra.targetLockUntilTurn).toBe(99);
    s = dealDamage(s, 'p1-kisame', 2).state; // two small hits don't add up
    expect(unit(s, 'p2-itachi').extra.targetLockUntilTurn).toBe(99);
    s = dealDamage(s, 'p1-kisame', 3).state;
    expect(unit(s, 'p2-itachi').extra.targetLockUntilTurn).toBeUndefined();
  });

  it("Tsukuyomi: refused against a target that has dealt Itachi more than 6 damage", () => {
    const base = freshCombat();
    expect(use(setExtra(base, 'p1-itachi', { damageTakenFrom: { 'p2-hidan': 7 } }), 'p1-itachi', 'tsukuyomi-infinite-agony', ['p2-hidan']).stack).toHaveLength(0);
    expect(use(setExtra(base, 'p1-itachi', { damageTakenFrom: { 'p2-hidan': 6 } }), 'p1-itachi', 'tsukuyomi-infinite-agony', ['p2-hidan']).stack).toHaveLength(1);
    const tallied = hit(freshCombat(), 'p2-hidan', 'triple-scythe-sweep', ['p1-itachi']);
    expect(unit(tallied, 'p1-itachi').extra.damageTakenFrom).toEqual({ 'p2-hidan': 1 });
  });

  it('a kill is credited to the attacker — Patchwork Threads then takes an elemental Style from the defeated', () => {
    let s = setExtra(freshCombat(), 'p2-kisame', {});
    s = { ...s, players: { ...s.players, p2: { ...s.players.p2, backRow: s.players.p2.backRow.map((c) => (c?.defId === 'kisame' ? { ...c, currentHP: 1 } : c)) } } };
    s = hit(s, 'p1-kakuzu', 'earth-grudge-fear', ['p2-kisame']);
    expect(unit(s, 'p1-kakuzu').extra.lastKillTurn).toBe(s.turn);
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c) => (c?.defId === 'kakuzu' ? { ...c, chakraPool: { ...c.chakraPool, current: 2 }, status: { ...c.status, usedAbilitiesThisTurn: [] } } : c)) } } };
    s = resolveTop(use({ ...s, phase: 'Main1' }, 'p1-kakuzu', 'patchwork-threads', [], undefined, 2));
    expect(unit(s, 'p1-kakuzu').styles).toContain('Water');
  });
});

describe('Redirects (the attack moves to the defender, with the reduction)', () => {
  it('Mechanized Guard: a physical attack on another Path lands on Asura, −1', () => {
    const { s: base, paths } = withPaths(freshCombat(), 'p1');
    const [deva, asura] = paths;
    let s = use(base, 'p2-hidan', 'triple-scythe-sweep', [deva.instanceId]);
    s = activateAbility(giveChakra({ ...s, priorityPlayer: 'p1' }, 'p1', 5), asura.instanceId, 'mechanized-guard', [], 0);
    for (let i = 0; i < 4; i++) s = gameReducer(s, { type: 'PASS_PRIORITY' });
    expect(hp(s, deva.instanceId)).toBe(7); // untouched at full HP (Deva Path HP 7)
    expect(hp(s, asura.instanceId)).toBe(6); // 1 − 1
  });

  it('Chakra Absorption: a Ninjutsu attack on a Path lands on Preta, reduced to 0, and Preta gains 1 Chakra', () => {
    const { s: base, paths } = withPaths(freshCombat(), 'p1');
    const human = paths[2];
    const preta = paths[4];
    let s = playCard(giveChakra({ ...base, activePlayer: 'p2', priorityPlayer: 'p2', phase: 'Combat' }, 'p2', 20), 'p2', 'jutsu-thousand-hungry-sharks', 'p2-kisame', [human.instanceId]);
    s = activateAbility(giveChakra({ ...s, priorityPlayer: 'p1' }, 'p1', 5), preta.instanceId, 'chakra-absorption', [], 0);
    for (let i = 0; i < 4; i++) s = gameReducer(s, { type: 'PASS_PRIORITY' });
    expect(hp(s, human.instanceId)).toBe(4);
    expect(hp(s, preta.instanceId)).toBe(5);
    expect(unit(s, preta.instanceId).chakraPool!.current).toBe(1);
  });
});

describe("Pain's bookkeeping", () => {
  it('Rinnegan Reservoir: a Path can pay from another Path’s Pool', () => {
    const { s: base, paths } = withPaths(freshCombat(), 'p1');
    const [deva, , human] = paths;
    const s0 = setExtra(base, deva.instanceId, {});
    const s1 = { ...s0, players: { ...s0.players, p1: { ...s0.players.p1, frontRow: s0.players.p1.frontRow.map((t) => (t?.instanceId === deva.instanceId ? { ...t, chakraPool: { current: 3, capacity: 3 } } : t)) } } };
    const s = activateAbility({ ...s1, activePlayer: 'p1', priorityPlayer: 'p1', phase: 'Combat', players: { ...s1.players, p1: { ...s1.players.p1, genericChakraAvailable: 0 } } }, human.instanceId, 'soul-rip', ['p2-deidara'], 2);
    expect(s.stack).toHaveLength(1);
    expect(unit(s, deva.instanceId).chakraPool!.current).toBe(1);
  });

  it('Almighty Push: must be the first Path ability this turn; locks the other Paths until it lands, and Deva for 3 turn cycles', () => {
    const { s: base, paths } = withPaths({ ...freshCombat(), phase: 'Main1' }, 'p1');
    const [deva, asura] = paths;
    const full = { ...base, players: { ...base.players, p1: { ...base.players.p1, frontRow: base.players.p1.frontRow.map((t) => (t?.instanceId === deva.instanceId ? { ...t, chakraPool: { current: 3, capacity: 3 } } : t)) } } };
    const afterAsura = setExtra(full, asura.instanceId, {});
    const asuraUsed = { ...afterAsura, players: { ...afterAsura.players, p1: { ...afterAsura.players.p1, frontRow: afterAsura.players.p1.frontRow.map((t) => (t?.instanceId === asura.instanceId ? { ...t, status: { ...t.status, usedAbilitiesThisTurn: ['mechanized-assault'] } } : t)) } } };
    expect(use({ ...asuraUsed, phase: 'Main1' }, deva.instanceId, 'almighty-push', []).stack).toHaveLength(0);

    let s = resolveTop(activateAbility(giveChakra({ ...full, activePlayer: 'p1', priorityPlayer: 'p1' }, 'p1', 6), deva.instanceId, 'almighty-push', [], 0));
    expect(unit(s, asura.instanceId).extra.lockedByAlmightyPush).toBe(deva.instanceId);
    expect(unit(s, deva.instanceId).extra.abilityLockUntilTurn).toBe(s.turn + 6);
    expect(use(s, asura.instanceId, 'mechanized-assault', ['p2-deidara']).stack).toHaveLength(0);
  });

  it('a defeated Path Beast goes on cooldown for 2 of its controller’s Upkeeps', () => {
    const { s: base, paths } = withPaths({ ...freshCombat(), phase: 'Main1' }, 'p1');
    const animal = paths[3];
    let s = resolveTop(activateAbility(giveChakra({ ...base, activePlayer: 'p1', priorityPlayer: 'p1' }, 'p1', 5), animal.instanceId, 'summon-ku-three-headed-hound', [], 0));
    const ku = s.players.p1.frontRow.find((t) => t?.defId === 'ku-three-headed-hound')!;
    s = dealDamage(s, ku.instanceId, 99).state;
    expect(unit(s, animal.instanceId).extra.beastCooldowns).toEqual({ 'ku-three-headed-hound': 2 });
    const upkeep = getTokenDef('animal-path')!.onUpkeep!;
    s = upkeep(s, animal.instanceId);
    expect(unit(s, animal.instanceId).extra.beastCooldowns).toEqual({ 'ku-three-headed-hound': 1 });
    s = upkeep(s, animal.instanceId);
    expect(unit(s, animal.instanceId).extra.beastCooldowns).toEqual({});
  });
});

describe('Other passives', () => {
  it('Kakuzu can revive Hidan at 3 HP — the controller is asked; Kakuzu spends his full Pool and is stunned', () => {
    let s = setExtra(freshCombat(), 'p1-hidan', { usedSafetyNet: true });
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c) => (c?.defId === 'kakuzu' ? { ...c, chakraPool: { ...c.chakraPool, current: c.chakraPool.capacity } } : c)) } } };
    s = dealDamage(s, 'p1-hidan', 99).state;
    const choice = s.pendingChoices[0];
    expect(choice.player).toBe('p1');
    s = gameReducer(s, { type: 'RESOLVE_CHOICE', choiceId: choice.id, optionIds: ['revive'] });
    expect(hp(s, 'p1-hidan')).toBe(3);
    expect(unit(s, 'p1-kakuzu').chakraPool!.current).toBe(0);
    expect(unit(s, 'p1-kakuzu').extra.stunnedUntilTurn).toBeGreaterThanOrEqual(s.turn);
  });

  it('Zetsu Golem regenerates 1 at Upkeep only if it took no damage since the last check', () => {
    const golem: TokenInstance = {
      instanceId: 'golem-1',
      defId: 'zetsu-golem',
      owner: 'p1',
      name: 'Zetsu Golem',
      maxHP: 6,
      currentHP: 4,
      ownerCharacterInstanceId: 'p1-kakuzu',
      status: { disabled: false, retreated: false, enteredTurn: -1, hasAmbush: false, usedAbilitiesThisTurn: [], pooledThisTurn: false },
      extra: { createdTurn: 0 },
    };
    const upkeep = getTokenDef('zetsu-golem')!.onUpkeep!;
    let s = placeToken(freshCombat(), 'p1', golem);
    s = upkeep(s, 'golem-1');
    expect(hp(s, 'golem-1')).toBe(5);
    s = setExtra({ ...s, turn: s.turn + 1 }, 'golem-1', { lastDamagedTurn: s.turn + 1 });
    s = upkeep({ ...s, turn: s.turn + 1 }, 'golem-1');
    expect(hp(s, 'golem-1')).toBe(5); // was hit since the last check — no regen
  });

  it("Spore Technique: the spored unit can't negate an attack on itself with its own ability", () => {
    let s = setExtra(freshCombat(), 'p1-itachi', { cannotNegateOwnDamageUntilTurn: 99 });
    s = use(s, 'p2-hidan', 'triple-scythe-sweep', ['p1-itachi']);
    s = playCard(giveChakra({ ...s, priorityPlayer: 'p1' }, 'p1', 5), 'p1', 'jutsu-crow-clone', 'p1-itachi');
    expect(s.stack).toHaveLength(1); // Crow Clone refused
  });
});

describe('Absorb (§6.8b)', () => {
  it('by default adds fading generic Chakra: spent first, and whatever is left fades at the next phase change', async () => {
    const { absorbChakra } = await import('../../src/engine/combat');
    let s = giveChakra(freshMain1(), 'p1', 3);
    s = absorbChakra(s, 'p1-itachi', 'p2-hidan', 2); // Itachi doesn't store absorbed Chakra in his Pool
    expect(s.players.p1.genericChakraAvailable).toBe(5);
    expect(s.players.p1.fadingGenericChakra).toBe(2);
    s = gameReducer(s, { type: 'POOL_CHAKRA', instanceId: 'p1-kakuzu', amount: 1 }); // spends 1 — the absorbed Chakra first
    expect(s.players.p1.fadingGenericChakra).toBe(1);
    s = gameReducer(s, { type: 'ADVANCE_PHASE' });
    expect(s.players.p1.genericChakraAvailable).toBe(3); // the 1 absorbed Chakra left faded; the 3 tapped stayed
    expect(s.players.p1.fadingGenericChakra).toBe(0);
  });

  it("Kisame's Samehada stores absorbed Chakra in his Pool; what doesn't fit becomes fading generic Chakra", async () => {
    const { absorbChakra } = await import('../../src/engine/combat');
    let s = freshMain1();
    const kisame = s.players.p1.backRow.find((c) => c?.defId === 'kisame')!;
    const cap = kisame.chakraPool.capacity;
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c) => (c?.defId === 'kisame' ? { ...c, chakraPool: { ...c.chakraPool, current: cap - 1 } } : c)) } } };
    s = absorbChakra(s, kisame.instanceId, 'p2-hidan', 3);
    expect(s.players.p1.backRow.find((c) => c?.defId === 'kisame')!.chakraPool.current).toBe(cap);
    expect(s.players.p1.fadingGenericChakra).toBe(2);
  });
});
