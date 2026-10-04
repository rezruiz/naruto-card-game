import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { activateAbility, findAbility } from '../../src/engine/abilities';
import { placeToken } from '../../src/engine/board';
import { createSixPaths, getCharacterDef, getTokenDef, makeThirdKazekage } from '../../src/engine/characters';
import { abilityCostText, abilityText, traitLines } from '../../src/ui/abilityText';
import { DISPLAYED_EXTRA_KEYS, trackedResources } from '../../src/engine/characters/progressText';
import { makeHandCardInstance } from '../../src/engine/deck';
import { redactStateFor } from '../../src/engine/redact';
import { gameReducer } from '../../src/engine/reducer';
import { getHandCardDef } from '../../src/engine/cards/registry';
import type { GameState } from '../../src/engine/types';
import { freshCombat, freshMain1, giveChakra, resolveTop, withCharacterAt } from './testUtils';

const withHandCard = (s: GameState, player: 'p1' | 'p2', defId: string): { state: GameState; id: string } => {
  const card = makeHandCardInstance(defId);
  return {
    state: { ...s, players: { ...s.players, [player]: { ...s.players[player], hand: [...s.players[player].hand, { kind: 'card', ...card }] } } },
    id: card.instanceId,
  };
};

describe('Field Intelligence: the opponent really reveals 2 cards of their choice', () => {
  it('asks the opponent to reveal, then shows exactly those cards to the caster (even over the network)', () => {
    let s = giveChakra(freshMain1(), 'p1', 5);
    const fi = withHandCard(s, 'p1', 'field-intelligence');
    s = fi.state;
    let p2 = s.players.p2;
    const a = makeHandCardInstance('substitution');
    const b = makeHandCardInstance('explosive-tag');
    const c = makeHandCardInstance('chakra-transfer');
    p2 = { ...p2, hand: [a, b, c].map((x) => ({ kind: 'card' as const, ...x })) };
    s = { ...s, players: { ...s.players, p2 } };

    s = gameReducer(s, { type: 'PLAY_HAND_CARD', instanceId: fi.id, enablingInstanceId: '', targetInstanceIds: [], payFromPool: 0 });
    s = resolveTop(s);
    expect(s.players.p2.pendingHandReveal).toEqual({ requestedBy: 'p1', count: 2 });

    // Hidden from p1 until revealed.
    expect(redactStateFor(s, 'p1').players.p2.hand.every((h) => h.kind === 'card' && h.defId === '__hidden__')).toBe(true);

    s = gameReducer(s, { type: 'REVEAL_HAND_CARDS', player: 'p2', instanceIds: [a.instanceId] }); // too few — refused
    expect(s.players.p2.pendingHandReveal).not.toBeNull();
    s = gameReducer(s, { type: 'REVEAL_HAND_CARDS', player: 'p2', instanceIds: [a.instanceId, c.instanceId] });
    expect(s.players.p2.pendingHandReveal).toBeNull();
    expect(s.log.at(-1)!.text).toMatch(/Substitution/);
    expect(s.log.at(-1)!.text).toMatch(/Chakra Transfer/);

    const view = redactStateFor(s, 'p1').players.p2.hand;
    const visible = view.filter((h) => h.kind === 'card' && h.defId !== '__hidden__').map((h) => (h.kind === 'card' ? h.defId : ''));
    expect(visible.sort()).toEqual(['chakra-transfer', 'substitution']);
  });
});

describe('Trust mode: return a played character to hand (manual correction)', () => {
  it('puts the card back in hand, resets it, fizzles its tokens — and is not a defeat', () => {
    let s = { ...freshMain1(), rules: 'trust' as const };
    const deidara = s.players.p1.backRow.find((c) => c?.defId === 'deidara')!;
    const healthBefore = s.players.p1.health;
    s = gameReducer(s, { type: 'RETURN_CHARACTER_TO_HAND', instanceId: deidara.instanceId });
    expect(s.players.p1.backRow.some((c) => c?.instanceId === deidara.instanceId)).toBe(false);
    expect(s.players.p1.hand.some((h) => h.kind === 'character' && h.entryId === 'deidara')).toBe(true);
    expect(s.players.p1.health).toBe(healthBefore);
    expect(s.players.p1.reinforcementOffers).toEqual([]);
  });

  it("isn't available under the strict rules", () => {
    let s = freshMain1();
    const before = s.players.p1.backRow.filter(Boolean).length;
    s = gameReducer(s, { type: 'RETURN_CHARACTER_TO_HAND', instanceId: 'p1-deidara' });
    expect(s.players.p1.backRow.filter(Boolean).length).toBe(before);
  });
});

describe('Trust mode: return a Mission or Terrain in play to hand (manual correction)', () => {
  it('a Terrain goes back to its owner’s hand', () => {
    let s = giveChakra({ ...freshMain1(), rules: 'trust' as const }, 'p1', 5);
    const card = withHandCard(s, 'p1', 'akatsuki-hideout');
    s = gameReducer(card.state, { type: 'PLAY_HAND_CARD', instanceId: card.id, enablingInstanceId: '', targetInstanceIds: [], payFromPool: 0 });
    const terrain = s.players.p1.terrainInPlay!;
    expect(terrain.defId).toBe('akatsuki-hideout');
    s = gameReducer(s, { type: 'RETURN_IN_PLAY_CARD_TO_HAND', instanceId: terrain.instanceId });
    expect(s.players.p1.terrainInPlay).toBeNull();
    expect(s.players.p1.hand.some((h) => h.kind === 'card' && h.defId === 'akatsuki-hideout')).toBe(true);
  });

  it('a Mission goes back to hand with its progress reset — Squad Formation’s group markers come off', () => {
    let s = { ...freshMain1(), rules: 'trust' as const };
    const group = ['p1-kakuzu', 'p1-hidan', 'p1-deidara'];
    s = {
      ...s,
      players: {
        ...s.players,
        p1: {
          ...s.players.p1,
          missionsInPlay: [{ instanceId: 'm-1', defId: 'squad-formation', owner: 'p1', extra: { active: true, group } }],
          backRow: s.players.p1.backRow.map((c) => (c && group.includes(c.instanceId) ? { ...c, extra: { ...c.extra, squadFormationGroup: group } } : c)),
        },
      },
    };
    s = gameReducer(s, { type: 'RETURN_IN_PLAY_CARD_TO_HAND', instanceId: 'm-1' });
    expect(s.players.p1.missionsInPlay).toHaveLength(0);
    expect(s.players.p1.hand.some((h) => h.kind === 'card' && h.defId === 'squad-formation')).toBe(true);
    expect(s.players.p1.backRow.every((c) => !c?.extra.squadFormationGroup)).toBe(true);
  });

  it("isn't available under the strict rules", () => {
    let s = freshMain1();
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, missionsInPlay: [{ instanceId: 'm-1', defId: 'squad-formation', owner: 'p1', extra: {} }] } } };
    expect(gameReducer(s, { type: 'RETURN_IN_PLAY_CARD_TO_HAND', instanceId: 'm-1' }).players.p1.missionsInPlay).toHaveLength(1);
  });
});

describe('Akatsuki Hideout costs 2 Chakra', () => {
  it('is refused with 1 Chakra and costs 2 when played', () => {
    const card = withHandCard(giveChakra(freshMain1(), 'p1', 1), 'p1', 'akatsuki-hideout');
    expect(gameReducer(card.state, { type: 'PLAY_HAND_CARD', instanceId: card.id, enablingInstanceId: '', targetInstanceIds: [], payFromPool: 0 }).players.p1.terrainInPlay).toBeNull();
    const rich = withHandCard(giveChakra(freshMain1(), 'p1', 3), 'p1', 'akatsuki-hideout');
    const played = gameReducer(rich.state, { type: 'PLAY_HAND_CARD', instanceId: rich.id, enablingInstanceId: '', targetInstanceIds: [], payFromPool: 0 });
    expect(played.players.p1.terrainInPlay?.defId).toBe('akatsuki-hideout');
    expect(played.players.p1.genericChakraAvailable).toBe(1);
  });
});

describe('Trust mode toggle (SET_RULES)', () => {
  it('switches modes, but not while actions are declared', () => {
    let s = gameReducer(freshMain1(), { type: 'SET_RULES', rules: 'trust' });
    expect(s.rules).toBe('trust');
    s = gameReducer(s, { type: 'STAGE_ABILITY', instanceId: 'p1-deidara', abilityId: 'explosive-clay', targetInstanceIds: [], payFromPool: 0 });
    expect(s.staged).toHaveLength(1);
    s = gameReducer(s, { type: 'SET_RULES', rules: 'strict' });
    expect(s.rules).toBe('trust');
    s = gameReducer(s, { type: 'UNSTAGE', stagedId: s.staged[0].id });
    s = gameReducer(s, { type: 'SET_RULES', rules: 'strict' });
    expect(s.rules).toBe('strict');
  });
});

describe('Optional choices are the player’s (J1)', () => {
  it('Zetsu, Absorbed Vitality: X is chosen (1 up to the Reservoir), costs X and heals X−1', () => {
    let s = withCharacterAt(freshCombat(), 'p1', 0, 'zetsu');
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c, i) => (i === 0 && c ? { ...c, chakraPool: { ...c.chakraPool, current: 5 } } : i === 1 && c ? { ...c, currentHP: 2 } : c)) } } };
    const ability = findAbility('zetsu', 'absorbed-vitality')!;
    const spec = ability.choices!({ state: s, sourceInstanceId: 'p1-zetsu', targetInstanceIds: ['p1-hidan'] })[0];
    expect(spec).toMatchObject({ kind: 'number', min: 1, max: 5 });

    s = activateAbility(s, 'p1-zetsu', 'absorbed-vitality', ['p1-hidan'], 3, { choices: { x: 3 } });
    expect(s.players.p1.backRow[0]!.chakraPool.current).toBe(2); // paid 3 of 5
    s = resolveTop(s);
    expect(s.players.p1.backRow[1]!.currentHP).toBe(4); // healed X−1 = 2
  });

  it('Pain, Rampaging Charge: Straight continues along the row in the chosen direction; Bent turns into the back row', () => {
    const rhinoState = () => {
      let s = freshCombat();
      const rhino = { ...makeThirdKazekage('p1', 'p1-kakuzu'), defId: 'war-rhino', name: 'The War Rhino', instanceId: 'p1-rhino', status: { ...makeThirdKazekage('p1', 'p1-kakuzu').status, enteredTurn: -1 } };
      s = placeToken(s, 'p1', rhino);
      return giveChakra(s, 'p1', 3);
    };
    const hp = (s: GameState, i: number) => s.players.p2.backRow[i]!.currentHP;

    // Straight, left, from p2's middle character (index 2): hits 2 → 1 (2 dmg) → 0 (1 dmg).
    let s = rhinoState();
    const before = [0, 1, 2, 3, 4].map((i) => hp(s, i));
    s = activateAbility(s, 'p1-rhino', 'rampaging-charge', [s.players.p2.backRow[2]!.instanceId], 0, { choices: { path: 'straight', side: 'left' } });
    s = resolveTop(s);
    expect([0, 1, 2, 3, 4].map((i) => before[i] - hp(s, i))).toEqual([1, 2, 3, 0, 0]);

    // Bent is only offered when the primary target is in the front row.
    const ability = findAbility('war-rhino', 'rampaging-charge')!;
    const pathOptions = (target: string, st: GameState) => {
      const spec = ability.choices!({ state: st, sourceInstanceId: 'p1-rhino', targetInstanceIds: [target] }).find((c) => c.id === 'path');
      return spec && spec.kind === 'option' ? spec.options.map((o) => o.id) : [];
    };
    expect(pathOptions(s.players.p2.backRow[2]!.instanceId, s)).toEqual(['straight']);

    // Bent, right, from a p2 front-row token in front of column 1: token (3) → back-row char 1 (2) → its right neighbor, char 2 (1).
    s = rhinoState();
    const token = { ...makeThirdKazekage('p2', s.players.p2.backRow[1]!.instanceId), instanceId: 'p2-front-token', maxHP: 9, currentHP: 9 };
    const frontRow = s.players.p2.frontRow.slice();
    frontRow[2] = token; // front slots 2/3 pair with back column 1
    s = { ...s, players: { ...s.players, p2: { ...s.players.p2, frontRow } } };
    expect(pathOptions('p2-front-token', s)).toEqual(['straight', 'bent']);
    const beforeBack = [0, 1, 2, 3, 4].map((i) => hp(s, i));
    s = activateAbility(s, 'p1-rhino', 'rampaging-charge', ['p2-front-token'], 0, { choices: { path: 'bent', side: 'right' } });
    s = resolveTop(s);
    expect(s.players.p2.frontRow[2]!.currentHP).toBe(6);
    expect([0, 1, 2, 3, 4].map((i) => beforeBack[i] - hp(s, i))).toEqual([0, 2, 1, 0, 0]);
  });
});

describe('Resolution-time choices are the player’s (J2)', () => {
  it('Mission at the cap: the controller picks which Mission is replaced', () => {
    let s = giveChakra(freshMain1(), 'p1', 10);
    // 5 characters → cap 5; fill it, then play a 6th.
    const missions = ['squad-formation', 'squad-formation', 'squad-formation', 'squad-formation', 'squad-formation'].map((defId, i) => ({ instanceId: `m-${i}`, defId, owner: 'p1' as const, extra: {} }));
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, missionsInPlay: missions } } };
    const card = withHandCard(s, 'p1', 'unshakable-resolve');
    s = gameReducer(card.state, { type: 'PLAY_HAND_CARD', instanceId: card.id, enablingInstanceId: '', targetInstanceIds: [], payFromPool: 0 });
    s = resolveTop(s);
    const choice = s.pendingChoices[0];
    expect(choice?.resolverId).toBe('mission-replace');
    expect(choice.options.map((o) => o.id)).toEqual(missions.map((m) => m.instanceId));
    s = gameReducer(s, { type: 'RESOLVE_CHOICE', choiceId: choice.id, optionIds: ['m-3'] });
    expect(s.players.p1.missionsInPlay.map((m) => m.instanceId)).not.toContain('m-3');
    expect(s.players.p1.missionsInPlay).toHaveLength(5);
    expect(s.players.p1.discardPile.some((c) => c.instanceId === 'm-3')).toBe(true);
  });

  it('a pending choice blocks moving to the next phase under the strict rules', () => {
    let s = freshMain1();
    s = { ...s, pendingChoices: [{ id: 'c1', player: 'p1', prompt: 'x', options: [{ id: 'a', label: 'A' }], min: 1, max: 1, resolverId: 'none', data: {} }] };
    s = gameReducer(s, { type: 'ADVANCE_PHASE' });
    expect(s.phase).toBe('Main1');
  });
});

describe('Every tracked resource is visible (progressText guard)', () => {
  it('has a display entry for every `extra` key a character/token/effect file writes', () => {
    const dir = join(__dirname, '../../src/engine');
    const files = [
      ...readdirSync(join(dir, 'characters')).map((f) => join(dir, 'characters', f)),
      ...['combat.ts', 'poison.ts', 'chakraSpore.ts', 'scheduledHeals.ts', 'abilities.ts', 'playCharacter.ts'].map((f) => join(dir, f)),
      join(dir, 'cards', 'missions.ts'),
    ].filter((f) => f.endsWith('.ts') && !f.endsWith('progressText.ts'));
    const missionOnly = new Set(['faceDown', 'healthAtPlay', 'untaps', 'losses', 'active', 'group', 'redirectTo']);
    const keys = new Set<string>();
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/extra\.(\w+)/g)) keys.add(m[1]);
      for (const m of src.matchAll(/extra: \{ \.\.\.\w+\.extra, (\w+):/g)) keys.add(m[1]);
      for (const m of src.matchAll(/initialExtra: \{ (\w+):/g)) keys.add(m[1]);
    }
    const missing = [...keys].filter((k) => !missionOnly.has(k) && !DISPLAYED_EXTRA_KEYS.has(k));
    expect(missing).toEqual([]);
  });

  it('shows Deidara’s Clay Charges and Kakuzu’s Hearts on the card', () => {
    const s = freshMain1();
    const deidara = s.players.p1.backRow.find((c) => c?.defId === 'deidara')!;
    const kakuzu = s.players.p1.backRow.find((c) => c?.defId === 'kakuzu')!;
    expect(trackedResources(s, deidara)).toContainEqual({ label: 'Clay Charges', value: '1', key: true });
    expect(trackedResources(s, kakuzu)).toContainEqual({ label: 'Hearts', value: '5/5', key: true });
  });
});

describe('Condensed ability text (the clickable ability boxes)', () => {
  it('every character and token ability has condensed text and a cost label, and every unit has trait lines on file', () => {
    const characters = ['kakuzu', 'hidan', 'deidara', 'kisame', 'itachi', 'konan', 'sasori-hiruko', 'sasori-hollow-body', 'zetsu', 'juzo', 'yahiko', 'amegakure-civilian-rebel'];
    const tokens = ['deva-path', 'asura-path', 'human-path', 'animal-path', 'preta-path', 'naraka-path', 'ku-three-headed-hound', 'war-rhino', 'giant-drill-beaked-bird', 'third-kazekage', 'puppet-soldier', 'white-zetsu-clone', 'zetsu-golem', 'clay-spider'];
    const s = freshMain1();
    const missing: string[] = [];
    for (const id of characters) {
      const def = getCharacterDef(id)!;
      expect(def, id).toBeDefined();
      for (const a of [...def.abilities, ...(def.ultimate ? [def.ultimate] : [])]) {
        if (!abilityText(a)) missing.push(`${id}: ${a.id}`);
        expect(abilityCostText(s, 'p1-kakuzu', a), a.id).toMatch(/Chakra|Pool|cost/);
      }
    }
    for (const id of tokens) {
      for (const a of getTokenDef(id)?.abilities ?? []) if (!abilityText(a)) missing.push(`${id}: ${a.id}`);
    }
    expect(missing).toEqual([]);
    for (const id of [...characters, ...tokens]) expect(traitLines(id), id).toBeInstanceOf(Array);
  });
});

describe('"N + entire Pool" costs and Soul Rip', () => {
  it('Almighty Push spends Deva Path’s whole Pool plus 6 generic, even though the UI asks to pay 0 from the Pool', () => {
    let s = giveChakra(freshMain1(), 'p1', 6);
    const deva = createSixPaths('p1')[0];
    s = placeToken(s, 'p1', { ...deva, chakraPool: { current: 3, capacity: 3 } });
    s = activateAbility(s, deva.instanceId, 'almighty-push', [], 0);
    expect(s.stack).toHaveLength(1);
    expect(s.players.p1.genericChakraAvailable).toBe(0);
    expect(s.players.p1.frontRow.find((t) => t?.instanceId === deva.instanceId)!.chakraPool!.current).toBe(0);
  });

  it('Soul Rip draws a card when it defeats its target', () => {
    let s = { ...freshCombat(), players: { ...freshCombat().players } };
    const human = createSixPaths('p1')[2];
    s = placeToken(giveChakra(s, 'p1', 2), 'p1', human);
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, handDeck: [makeHandCardInstance('substitution')] }, p2: { ...s.players.p2, backRow: s.players.p2.backRow.map((c, i) => (i === 3 && c ? { ...c, currentHP: 2 } : c)) } } };
    const target = s.players.p2.backRow[3]!.instanceId; // Kisame: no defeat-replacement
    const handBefore = s.players.p1.hand.length;
    s = resolveTop(activateAbility(s, human.instanceId, 'soul-rip', [target], 0));
    expect(s.players.p2.backRow.some((c) => c?.instanceId === target)).toBe(false);
    expect(s.players.p1.hand.length).toBe(handBefore + 1);
  });
});

describe('Sasori enters with his Third Kazekage', () => {
  it('playing Sasori from hand also creates the Third Kazekage token', () => {
    let s = freshMain1();
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, backRow: s.players.p1.backRow.map((c, i) => (i === 4 ? null : c)), hand: [{ kind: 'character', instanceId: 'sasori-card', entryId: 'sasori-hiruko' }] } } };
    s = gameReducer(s, { type: 'PLAY_CHARACTER', instanceId: 'sasori-card' });
    const sasori = s.players.p1.backRow.find((c) => c?.defId === 'sasori-hiruko')!;
    expect(sasori).toBeDefined();
    const kazekage = s.players.p1.frontRow.find((t) => t?.defId === 'third-kazekage');
    expect(kazekage?.ownerCharacterInstanceId).toBe(sasori.instanceId);
  });
});

describe('Look at the top X: the player picks which matching card (X itself is fixed by the card)', () => {
  it('Incoming Mission Assignment: two Missions in the top 6 — the player picks one, the rest go back; the opponent can’t see them', () => {
    let s = giveChakra(freshMain1(), 'p1', 5);
    const card = withHandCard(s, 'p1', 'incoming-mission-assignment');
    s = card.state;
    const deck = ['substitution', 'squad-formation', 'explosive-tag', 'unshakable-resolve', 'chakra-transfer', 'substitution', 'bingo-book-s'].map((d) => makeHandCardInstance(d));
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, handDeck: deck } } };
    s = resolveTop(gameReducer(s, { type: 'PLAY_HAND_CARD', instanceId: card.id, enablingInstanceId: '', targetInstanceIds: [], payFromPool: 0 }));

    const choice = s.pendingChoices[0];
    expect(choice.options.map((o) => o.label)).toEqual(['Squad Formation', 'Unshakable Resolve']); // only the 2 Missions among the top 6 (not the 7th card)
    expect(s.players.p1.handDeck).toHaveLength(1); // the 6 looked at are set aside while choosing
    const opponentView = redactStateFor(s, 'p2').pendingChoices[0];
    expect(opponentView.options.every((o) => o.label === 'Hidden card')).toBe(true);

    const pick = deck[3].instanceId; // Unshakable Resolve
    s = gameReducer(s, { type: 'RESOLVE_CHOICE', choiceId: choice.id, optionIds: [pick] });
    expect(s.players.p1.hand.some((h) => h.instanceId === pick)).toBe(true);
    expect(s.players.p1.handDeck).toHaveLength(6); // 5 others shuffled back + the untouched 7th
  });

  it('with a single match there is nothing to choose — it is taken', () => {
    let s = giveChakra(freshMain1(), 'p1', 5);
    const card = withHandCard(s, 'p1', 'battlefield-selection');
    s = card.state;
    const deck = ['substitution', 'akatsuki-hideout', 'explosive-tag'].map((d) => makeHandCardInstance(d));
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, handDeck: deck } } };
    s = resolveTop(gameReducer(s, { type: 'PLAY_HAND_CARD', instanceId: card.id, enablingInstanceId: '', targetInstanceIds: [], payFromPool: 0 }));
    expect(s.pendingChoices).toHaveLength(0);
    expect(s.players.p1.hand.some((h) => h.instanceId === deck[1].instanceId)).toBe(true);
  });
});

describe('Hand card defs used above exist', () => {
  it('field-intelligence and unshakable-resolve are registered', () => {
    expect(getHandCardDef('field-intelligence')).toBeDefined();
    expect(getHandCardDef('unshakable-resolve')).toBeDefined();
  });
});
