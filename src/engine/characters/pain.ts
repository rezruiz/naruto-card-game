import { countTokensOfType, findOccupant, getCrossPatternTargets, patchOccupant, placeToken } from '../board';
import { dealDamage, healOccupant } from '../combat';
import { appendLog, otherPlayer } from '../phases/phaseMachine';
import { findAbility } from '../abilities';
import type { AbilityDef } from '../abilities';
import { registerTokenDef } from './registry';
import type { GameState, PlayerId, StackItem, TokenInstance } from '../types';

// NOTE: Pain has no HP or Chakra Pool of his own (design/SPEC.md's Six Paths
// trait) — he's represented entirely by 6 Path tokens, so there's no
// registerCharacter('pain', ...) at all here, only 6 TokenDefs. "When Pain
// enters play, spawn 6 Path tokens" has no engine hook to trigger from yet
// (no Setup/Character-Deck/play-a-character system exists — same documented
// gap as Sasori's Third Kazekage) — createSixPaths() below is the manual
// stand-in a future Setup step would call.

const DEVA_ID = 'deva-path';
const ASURA_ID = 'asura-path';
const HUMAN_ID = 'human-path';
const ANIMAL_ID = 'animal-path';
const PRETA_ID = 'preta-path';
const NARAKA_ID = 'naraka-path';
const PATH_IDS = [DEVA_ID, ASURA_ID, HUMAN_ID, ANIMAL_ID, PRETA_ID, NARAKA_ID];

const KU_ID = 'ku-three-headed-hound';
const WAR_RHINO_ID = 'war-rhino';
const BIRD_ID = 'giant-drill-beaked-bird';

function freshTokenStatus() {
  return { disabled: false, retreated: false, enteredTurn: -1, hasAmbush: false, usedAbilitiesThisTurn: [], pooledThisTurn: false };
}

let tokenCounter = 0;
function makePathToken(defId: string, name: string, owner: PlayerId, hp: number, poolCapacity: number): TokenInstance {
  tokenCounter += 1;
  return {
    instanceId: `${defId}-${owner}-${tokenCounter}`,
    defId,
    owner,
    name,
    maxHP: hp,
    currentHP: hp,
    // No actual "Pain" character instance exists to own these — a purely
    // nominal grouping id that never matches a real Character, so the
    // default fizzle-on-owner-defeat rule (combat.ts) never fires for them;
    // each Path is defeated (or not) entirely independently.
    ownerCharacterInstanceId: `pain-${owner}`,
    status: freshTokenStatus(),
    extra: {},
    chakraPool: { current: 0, capacity: poolCapacity },
  };
}

export function createSixPaths(owner: PlayerId): TokenInstance[] {
  return [
    makePathToken(DEVA_ID, 'Deva Path', owner, 8, 3),
    makePathToken(ASURA_ID, 'Asura Path', owner, 6, 2),
    makePathToken(HUMAN_ID, 'Human Path', owner, 4, 2),
    makePathToken(ANIMAL_ID, 'Animal Path', owner, 5, 2),
    makePathToken(PRETA_ID, 'Preta Path', owner, 5, 2),
    makePathToken(NARAKA_ID, 'Naraka Path', owner, 4, 2),
  ];
}

function makeBeast(defId: string, name: string, owner: PlayerId, animalPathInstanceId: string, extra: Record<string, unknown> = {}): TokenInstance {
  tokenCounter += 1;
  return {
    instanceId: `${defId}-${owner}-${tokenCounter}`,
    defId,
    owner,
    name,
    maxHP: defId === BIRD_ID ? 2 : 4,
    currentHP: defId === BIRD_ID ? 2 : 4,
    ownerCharacterInstanceId: `pain-${owner}`,
    status: freshTokenStatus(),
    extra: { fizzlesIfInstanceIdDefeated: animalPathInstanceId, ...extra },
  };
}

/** The Type of the ability behind a given stack item (looked up via its source's own defId), or undefined if it can't be resolved. */
function stackItemAbilityType(state: GameState, item: StackItem) {
  const attacker = findOccupant(state, item.sourceInstanceId);
  return attacker ? findAbility(attacker.occupant.defId, item.abilityId)?.type : undefined;
}

function isPhysical(state: GameState, item: StackItem): boolean {
  const type = stackItemAbilityType(state, item);
  return type === 'Taijutsu' || type === 'Bukijutsu';
}

// --- Deva Path -------------------------------------------------------------

const shinraTensei: AbilityDef = {
  id: 'shinra-tensei',
  name: 'Deva Path: Shinra Tensei',
  cost: 4,
  speed: 'Normal',
  style: 'None', // NOTE: Token sources can't carry Styles yet (see file-top comment) — Gravity is flavor-only here
  type: 'Ninjutsu',
  isDamaging: true,
  resolve: (ctx) => {
    const targetId = ctx.targetInstanceIds[0];
    if (!targetId) return ctx.state;
    let state = dealDamage(ctx.state, targetId, 3).state;
    const found = findOccupant(ctx.state, targetId);
    if (found) {
      for (const occ of getCrossPatternTargets(state, found.player, found.zone, found.index)) {
        state = dealDamage(state, occ.instanceId, 3).state;
      }
    }
    return appendLog(state, 'Shinra Tensei devastates the area in a cross pattern.');
  },
};

// NOTE (simplified for this pass, matching Crow Clone/Paper Clone precedent):
// full negation rather than a pure "fails to target" state, since a stack
// item's resolve is an opaque closure over its original target either way —
// functionally equivalent from the target's perspective.
const shinraTenseiV2: AbilityDef = {
  id: 'shinra-tensei-v2',
  name: 'Deva Path: Shinra Tensei, V2',
  cost: 4,
  speed: 'Reactive',
  style: 'None', // NOTE: Token sources can't carry Styles yet (see file-top comment) — Gravity is flavor-only here
  type: 'Ninjutsu',
  maxTargets: 0,
  legalityCheck: (ctx) => {
    const owner = pathOwnerOf(ctx.state, ctx.sourceInstanceId);
    return ctx.state.stack.some((item) => {
      if (!item.targets.includes(ctx.sourceInstanceId) || item.controllerId === owner) return false;
      const type = stackItemAbilityType(ctx.state, item);
      return type === 'Ninjutsu' || type === 'Taijutsu';
    });
  },
  resolve: (ctx) => negateAttackOn(ctx.state, ctx.sourceInstanceId, ctx.sourceInstanceId, 'Shinra Tensei, V2'),
};

// NOTE (simplified for this pass): the 2-row board's "pull closer" movement
// has no defined meaning yet (design/CHARACTER_LOG.md flags this as an open
// question even before this engine existed) — only the damage clause is
// implemented; the "+1 damage rest of turn, can't be protected" buff isn't
// wired in either (same gap as Iron Skin/Paper Body's unwired modifiers).
const banshoTennin: AbilityDef = {
  id: 'bansho-tennin',
  name: "Deva Path: Banshō Ten'in",
  cost: 4,
  speed: 'Normal',
  style: 'None', // NOTE: Token sources can't carry Styles yet (see file-top comment) — Gravity is flavor-only here
  type: 'Ninjutsu',
  isDamaging: true,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    return target ? dealDamage(ctx.state, target, 1).state : ctx.state;
  },
};

function pathOwnerOf(state: GameState, instanceId: string): PlayerId | undefined {
  return findOccupant(state, instanceId)?.player;
}

function allPathsOf(state: GameState, owner: PlayerId): TokenInstance[] {
  return state.players[owner].frontRow.filter((t): t is TokenInstance => !!t && PATH_IDS.includes(t.defId));
}

// NOTE (simplified for this pass): the full sequence (locks out every other
// Path until the delayed hit resolves, plus a separate 3-turn-cycle lockout
// on Deva Path itself, plus the "first Path ability used this turn" gate) —
// design/CHARACTER_LOG.md's most involved Ultimate — is reduced to its core,
// working effect: the full-Pool condition, and the delayed blanket 8 damage
// at the controller's next End Phase. No generic multi-turn ability-lockout
// system exists yet to enforce the rest.
const almightyPush: AbilityDef = {
  id: 'almighty-push',
  name: 'Deva Path: Almighty Push',
  cost: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    const pooled = found?.occupant.chakraPool?.current ?? 0;
    return 6 + pooled;
  },
  speed: 'Normal',
  style: 'None', // NOTE: Token sources can't carry Styles yet (see file-top comment) — Gravity is flavor-only here
  type: 'Ninjutsu',
  isUltimate: true,
  maxTargets: 0,
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    const pool = found?.occupant.chakraPool;
    return !!pool && pool.current >= pool.capacity;
  },
  resolve: (ctx) =>
    patchOccupant(ctx.state, ctx.sourceInstanceId, (o) => ({
      ...o,
      extra: { ...o.extra, almightyPushPending: true },
    })),
};

// --- Asura Path --------------------------------------------------------------

const mechanizedAssault: AbilityDef = {
  id: 'mechanized-assault',
  name: 'Asura Path: Mechanized Assault',
  cost: 3,
  speed: 'Normal',
  style: 'None',
  type: 'Taijutsu',
  isDamaging: true,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    return target ? dealDamage(ctx.state, target, 4).state : ctx.state;
  },
};

function negateAttackOn(state: GameState, guardianInstanceId: string, protectedInstanceId: string, guardName: string): GameState {
  const owner = pathOwnerOf(state, guardianInstanceId);
  const idx = state.stack.findIndex((item) => item.targets.includes(protectedInstanceId) && item.controllerId !== owner);
  if (idx === -1) return appendLog(state, `${guardName} finds nothing left to intercept.`);
  const negated = state.stack[idx];
  const next = { ...state, stack: [...state.stack.slice(0, idx), ...state.stack.slice(idx + 1)] };
  return appendLog(next, `${guardName} intercepts ${negated.abilityName}.`);
}

function anyPathTargetedByEnemy(
  ctx: { state: GameState; sourceInstanceId: string },
  typeFilter: (state: GameState, item: StackItem) => boolean,
): string | undefined {
  const owner = pathOwnerOf(ctx.state, ctx.sourceInstanceId);
  if (!owner) return undefined;
  const paths = allPathsOf(ctx.state, owner).map((p) => p.instanceId);
  const item = ctx.state.stack.find(
    (it) => it.controllerId !== owner && it.targets.some((t) => paths.includes(t)) && typeFilter(ctx.state, it),
  );
  return item?.targets.find((t) => paths.includes(t));
}

// NOTE (simplified for this pass, matching Sasori's Puppet Shell Guard/Iron
// Sand Wall precedent): full negation of the attack rather than a redirect
// onto Asura reduced by 1 — the engine can't re-target an already-pushed
// stack item's opaque resolve closure at a different unit.
const mechanizedGuard: AbilityDef = {
  id: 'mechanized-guard',
  name: 'Asura Path: Mechanized Guard',
  cost: 2,
  speed: 'Reactive',
  style: 'None',
  type: 'Taijutsu',
  maxTargets: 0,
  legalityCheck: (ctx) => !!anyPathTargetedByEnemy(ctx, isPhysical),
  resolve: (ctx) => {
    const targetId = anyPathTargetedByEnemy(ctx, isPhysical);
    if (!targetId) return appendLog(ctx.state, 'Mechanized Guard finds nothing left to intercept.');
    return negateAttackOn(ctx.state, ctx.sourceInstanceId, targetId, 'Mechanized Guard');
  },
};

// --- Human Path --------------------------------------------------------------

// NOTE (simplified for this pass): "draw 1 card" is dropped — no
// Character-Deck/hand-draw system exists in the engine yet.
const soulRip: AbilityDef = {
  id: 'soul-rip',
  name: 'Human Path: Soul Rip',
  cost: 2,
  speed: 'Normal',
  style: 'None',
  type: 'Ninjutsu',
  isDamaging: true,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    return target ? dealDamage(ctx.state, target, 2).state : ctx.state;
  },
};

// --- Animal Path (Summon — one ability per Beast, see file-top note) ---------

function summonBeast(id: string, name: string, factory: (owner: PlayerId, animalId: string) => TokenInstance): AbilityDef {
  return {
    id: `summon-${id}`,
    name: `Animal Path: Summon (${name})`,
    cost: 1,
    speed: 'Normal',
    style: 'None',
    type: 'Ninjutsu',
    maxTargets: 0,
    legalityCheck: (ctx) => {
      const found = findOccupant(ctx.state, ctx.sourceInstanceId);
      if (!found) return false;
      return countTokensOfType(ctx.state, found.player, id) === 0;
    },
    resolve: (ctx) => {
      const found = findOccupant(ctx.state, ctx.sourceInstanceId);
      if (!found) return ctx.state;
      return placeToken(ctx.state, found.player, factory(found.player, ctx.sourceInstanceId));
    },
  };
}

const summonKu = summonBeast(KU_ID, 'Ku, the Three-Headed Hound', (owner, animalId) => makeBeast(KU_ID, 'Ku, the Three-Headed Hound', owner, animalId));
const summonWarRhino = summonBeast(WAR_RHINO_ID, 'The War Rhino', (owner, animalId) => makeBeast(WAR_RHINO_ID, 'The War Rhino', owner, animalId));
const summonBird = summonBeast(BIRD_ID, 'Giant Drill-Beaked Bird', (owner, animalId) =>
  makeBeast(BIRD_ID, 'Giant Drill-Beaked Bird', owner, animalId, { evasiveNormalOnly: true }),
);

// --- Preta Path --------------------------------------------------------------

const chakraAbsorption: AbilityDef = {
  id: 'chakra-absorption',
  name: 'Preta Path: Chakra Absorption',
  cost: 2,
  speed: 'Reactive',
  style: 'None',
  type: 'Ninjutsu',
  maxTargets: 0,
  legalityCheck: (ctx) => !!anyPathTargetedByEnemy(ctx, (s, i) => stackItemAbilityType(s, i) === 'Ninjutsu'),
  resolve: (ctx) => {
    const targetId = anyPathTargetedByEnemy(ctx, (s, i) => stackItemAbilityType(s, i) === 'Ninjutsu');
    if (!targetId) return appendLog(ctx.state, 'Chakra Absorption finds nothing left to intercept.');
    let state = negateAttackOn(ctx.state, ctx.sourceInstanceId, targetId, 'Chakra Absorption');
    return patchOccupant(state, ctx.sourceInstanceId, (o) => ({ ...o, chakraPool: { ...o.chakraPool!, current: Math.min(o.chakraPool!.capacity, o.chakraPool!.current + 1) } }));
  },
};

const absorbImpact: AbilityDef = {
  id: 'absorb-impact',
  name: 'Preta Path: Absorb Impact',
  cost: 1,
  speed: 'Reactive',
  style: 'None',
  type: 'Taijutsu',
  maxTargets: 0,
  legalityCheck: (ctx) => !!anyPathTargetedByEnemy(ctx, isPhysical),
  resolve: (ctx) => {
    const targetId = anyPathTargetedByEnemy(ctx, isPhysical);
    if (!targetId) return appendLog(ctx.state, 'Absorb Impact finds nothing left to intercept.');
    return negateAttackOn(ctx.state, ctx.sourceInstanceId, targetId, 'Absorb Impact');
  },
};

// --- Naraka Path --------------------------------------------------------------

interface NarakaSchedule {
  kind: 'heal' | 'revive';
  targetInstanceId?: string; // for 'heal'
  reviveDefId?: string; // for 'revive'
}

const kingOfHellsJudgment: AbilityDef = {
  id: 'king-of-hells-judgment',
  name: "Naraka Path: King of Hell's Judgment",
  cost: 4,
  speed: 'Normal',
  style: 'None',
  type: 'Ninjutsu',
  targetSide: 'ally', // "Choose a Path token (including Naraka)" — always your own side
  resolve: (ctx) => {
    const targetId = ctx.targetInstanceIds[0] ?? ctx.sourceInstanceId;
    const entry: NarakaSchedule = { kind: 'heal', targetInstanceId: targetId };
    let state = patchOccupant(ctx.state, ctx.sourceInstanceId, (o) => ({
      ...o,
      extra: { ...o.extra, narakaSchedule: [...((o.extra.narakaSchedule as NarakaSchedule[]) ?? []), entry] },
    }));
    return appendLog(state, "King of Hell's Judgment will heal its target 3 HP at your next Upkeep, unless Naraka Path falls first.");
  },
};

// NOTE: the target is chosen by Path defId (e.g. 'deva-path'), passed as
// targetInstanceIds[0] — the defeated Path no longer exists as an instance to
// target directly, so this reuses the targeting API's string slot to carry a
// defId choice instead, the same pragmatic reuse as Sasori's Combine (which
// repurposes it as a multi-instance choice list).
const samsaraOfHeavenlyLifeTechnique: AbilityDef = {
  id: 'outer-path-samsara',
  name: 'Naraka Path: Outer Path — Samsara of Heavenly Life Technique',
  cost: 7,
  speed: 'Normal',
  style: 'None',
  type: 'Ninjutsu',
  maxTargets: 0,
  legalityCheck: (ctx) => {
    const chosenDefId = ctx.targetInstanceIds[0];
    if (!chosenDefId || !PATH_IDS.includes(chosenDefId)) return false;
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found) return false;
    return countTokensOfType(ctx.state, found.player, chosenDefId) === 0; // must currently be defeated
  },
  resolve: (ctx) => {
    const chosenDefId = ctx.targetInstanceIds[0];
    if (!chosenDefId) return ctx.state;
    const entry: NarakaSchedule = { kind: 'revive', reviveDefId: chosenDefId };
    let state = patchOccupant(ctx.state, ctx.sourceInstanceId, (o) => ({
      ...o,
      extra: { ...o.extra, narakaSchedule: [...((o.extra.narakaSchedule as NarakaSchedule[]) ?? []), entry] },
    }));
    return appendLog(state, 'Samsara of Heavenly Life Technique will revive its target at your next Upkeep, unless Naraka Path falls first.');
  },
};

const pathHpByDefId: Record<string, { name: string; hp: number; poolCapacity: number }> = {
  [DEVA_ID]: { name: 'Deva Path', hp: 8, poolCapacity: 3 },
  [ASURA_ID]: { name: 'Asura Path', hp: 6, poolCapacity: 2 },
  [HUMAN_ID]: { name: 'Human Path', hp: 4, poolCapacity: 2 },
  [ANIMAL_ID]: { name: 'Animal Path', hp: 5, poolCapacity: 2 },
  [PRETA_ID]: { name: 'Preta Path', hp: 5, poolCapacity: 2 },
  [NARAKA_ID]: { name: 'Naraka Path', hp: 4, poolCapacity: 2 },
};

// --- Path Beast tokens ---------------------------------------------------

const relentlessStrike: AbilityDef = {
  id: 'relentless-strike',
  name: 'Relentless Strike',
  cost: 1,
  speed: 'Normal',
  style: 'None',
  type: 'Taijutsu',
  isDamaging: true,
  maxTargets: 2,
  usesPerTurn: 2,
  resolve: (ctx) => {
    let state = ctx.state;
    for (const target of ctx.targetInstanceIds.slice(0, 2)) {
      state = dealDamage(state, target, 2).state;
    }
    return state;
  },
};

// NOTE (simplified for this pass): only the "Straight" path is implemented
// (2 more hits continuing left/right in the primary target's own row) — the
// "Bent" alternative (front-row primary, 2nd hit is the paired back-row
// Character, 3rd hit is that Character's neighbor) is dropped for scope;
// both still deal 3/2/1 down the path and stop early off the board's edge.
const rampagingCharge: AbilityDef = {
  id: 'rampaging-charge',
  name: 'Rampaging Charge',
  cost: 3,
  speed: 'Normal',
  style: 'None',
  type: 'Taijutsu',
  isDamaging: true,
  resolve: (ctx) => {
    const primaryId = ctx.targetInstanceIds[0];
    if (!primaryId) return ctx.state;
    let state = dealDamage(ctx.state, primaryId, 3).state;

    const found = findOccupant(ctx.state, primaryId);
    if (!found) return state;
    // Always continues rightward — no per-activation "attacker's choice of
    // side" channel exists yet (same class of gap as the dropped X-scaling
    // on Iron Sand Wall/Absorbed Vitality).
    const row = found.zone === 'back' ? ctx.state.players[found.player].backRow : ctx.state.players[found.player].frontRow;
    const remainingDamages = [2, 1];
    let idx = found.index;
    while (remainingDamages.length > 0) {
      idx += 1;
      const occ = row[idx];
      if (!occ) break;
      state = dealDamage(state, occ.instanceId, remainingDamages.shift()!).state;
    }
    return appendLog(state, 'The War Rhino tramples through in a straight line.');
  },
};

const drillPeck: AbilityDef = {
  id: 'drill-peck',
  name: 'Drill Peck',
  cost: 1,
  speed: 'Quick',
  style: 'None',
  type: 'Taijutsu',
  isDamaging: true,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    return target ? dealDamage(ctx.state, target, 1).state : ctx.state;
  },
};

registerTokenDef({
  id: DEVA_ID,
  name: 'Deva Path',
  abilities: [shinraTensei, shinraTenseiV2, banshoTennin, almightyPush],
  maxAbilitiesPerTurn: 2,
  onEndPhase: (state, instanceId) => {
    const found = findOccupant(state, instanceId);
    if (!found || !found.occupant.extra.almightyPushPending) return state;
    const owner = found.player;
    let next = patchOccupant(state, instanceId, (o) => ({ ...o, extra: { ...o.extra, almightyPushPending: false } }));
    const opponent = otherPlayer(owner);
    for (const c of next.players[opponent].backRow) {
      if (c) next = dealDamage(next, c.instanceId, 8).state;
    }
    for (const t of next.players[opponent].frontRow) {
      if (t) next = dealDamage(next, t.instanceId, 8).state;
    }
    return appendLog(next, 'Almighty Push devastates all enemy units.');
  },
});
registerTokenDef({ id: ASURA_ID, name: 'Asura Path', abilities: [mechanizedAssault, mechanizedGuard] });
registerTokenDef({ id: HUMAN_ID, name: 'Human Path', abilities: [soulRip] });
registerTokenDef({ id: ANIMAL_ID, name: 'Animal Path', abilities: [summonKu, summonWarRhino, summonBird] });
registerTokenDef({ id: PRETA_ID, name: 'Preta Path', abilities: [chakraAbsorption, absorbImpact] });
registerTokenDef({
  id: NARAKA_ID,
  name: 'Naraka Path',
  abilities: [kingOfHellsJudgment, samsaraOfHeavenlyLifeTechnique],
  onUpkeep: (state, instanceId) => {
    const found = findOccupant(state, instanceId);
    if (!found) return state;
    const owner = found.player;
    const schedule = (found.occupant.extra.narakaSchedule as NarakaSchedule[]) ?? [];
    if (schedule.length === 0) return state;

    let next = patchOccupant(state, instanceId, (o) => ({ ...o, extra: { ...o.extra, narakaSchedule: [] } }));
    for (const entry of schedule) {
      if (entry.kind === 'heal' && entry.targetInstanceId) {
        if (findOccupant(next, entry.targetInstanceId)) {
          next = healOccupant(next, entry.targetInstanceId, 3);
        }
      } else if (entry.kind === 'revive' && entry.reviveDefId) {
        const info = pathHpByDefId[entry.reviveDefId];
        if (info) {
          const token = makePathToken(entry.reviveDefId, info.name, owner, info.hp, info.poolCapacity);
          token.status.enteredTurn = next.turn; // fresh summoning sickness (§6.6)
          next = placeToken(next, owner, token);
        }
      }
    }
    return appendLog(next, "Naraka Path's delayed effects resolve.");
  },
});

registerTokenDef({ id: KU_ID, name: 'Ku, the Three-Headed Hound', abilities: [relentlessStrike] });
registerTokenDef({ id: WAR_RHINO_ID, name: 'The War Rhino', abilities: [rampagingCharge] });
registerTokenDef({ id: BIRD_ID, name: 'Giant Drill-Beaked Bird', abilities: [drillPeck] });
