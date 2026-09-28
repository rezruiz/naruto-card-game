import { countTokensOfType, findOccupant, isCharacter, patchCharacter, placeToken } from '../board';
import { dealDamage, registerDefeatHook } from '../combat';
import { appendLog, otherPlayer } from '../phases/phaseMachine';
import { applyPoison } from '../poison';
import { findAbility } from '../abilities';
import type { AbilityDef } from '../abilities';
import { registerCharacter, registerTokenDef } from './registry';
import type { GameState, PlayerId, StackItem, TokenInstance } from '../types';

const HIRUKO_ID = 'sasori-hiruko';
const HOLLOW_BODY_ID = 'sasori-hollow-body';
const THIRD_KAZEKAGE_ID = 'third-kazekage';
const PUPPET_SOLDIER_ID = 'puppet-soldier';

function freshTokenStatus() {
  return { disabled: false, retreated: false, enteredTurn: -1, hasAmbush: false, usedAbilitiesThisTurn: [], pooledThisTurn: false };
}

let tokenCounter = 0;
export function makeThirdKazekage(owner: PlayerId, ownerInstanceId: string): TokenInstance {
  tokenCounter += 1;
  return {
    instanceId: `third-kazekage-${owner}-${tokenCounter}`,
    defId: THIRD_KAZEKAGE_ID,
    owner,
    name: 'Third Kazekage',
    maxHP: 5,
    currentHP: 5,
    ownerCharacterInstanceId: ownerInstanceId,
    status: freshTokenStatus(),
    extra: {},
  };
}

function makePuppetSoldier(owner: PlayerId, ownerInstanceId: string): TokenInstance {
  tokenCounter += 1;
  return {
    instanceId: `puppet-soldier-${owner}-${tokenCounter}`,
    defId: PUPPET_SOLDIER_ID,
    owner,
    name: 'Puppet Soldier',
    maxHP: 2,
    currentHP: 2,
    ownerCharacterInstanceId: ownerInstanceId,
    status: freshTokenStatus(),
    extra: {},
  };
}

/** Was the given stack item's own ability Ninjutsu, Taijutsu, or Bukijutsu (SPEC.md's "Physical" grouping, §6.8)? */
function isNinjutsuOrPhysical(state: GameState, item: StackItem): boolean {
  const attacker = findOccupant(state, item.sourceInstanceId);
  if (!attacker) return false;
  const ability = findAbility(attacker.occupant.defId, item.abilityId);
  return !!ability && (ability.type === 'Ninjutsu' || ability.type === 'Taijutsu' || ability.type === 'Bukijutsu');
}

const tailStrike: AbilityDef = {
  id: 'tail-strike',
  name: 'Tail Strike',
  cost: 3,
  speed: 'Normal',
  style: 'None',
  type: 'Taijutsu',
  isDamaging: true,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    let state = dealDamage(ctx.state, target, 2).state;
    return applyPoison(state, target, 2);
  },
};

// NOTE (simplified for this pass, matching Crow Clone/Paper Clone/Yahiko's
// Ultimate precedent): full negation rather than redirect-and-reduce — a
// stack item's resolve is an opaque closure over its original target, so the
// engine can't re-target it at Hiruko instead.
const puppetShellGuard: AbilityDef = {
  id: 'puppet-shell-guard',
  name: 'Puppet Shell Guard',
  cost: 2,
  speed: 'Reactive',
  style: 'None',
  type: 'Taijutsu',
  maxTargets: 0,
  legalityCheck: (ctx) => {
    const kazekage = ctx.state.players[
      findOccupant(ctx.state, ctx.sourceInstanceId)?.player ?? 'p1'
    ].frontRow.find((t) => t?.defId === THIRD_KAZEKAGE_ID && t.ownerCharacterInstanceId === ctx.sourceInstanceId);
    if (!kazekage) return false;
    return ctx.state.stack.some((item) => item.targets.includes(kazekage.instanceId) && isNinjutsuOrPhysical(ctx.state, item));
  },
  resolve: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found) return ctx.state;
    const kazekage = ctx.state.players[found.player].frontRow.find(
      (t) => t?.defId === THIRD_KAZEKAGE_ID && t.ownerCharacterInstanceId === ctx.sourceInstanceId,
    );
    if (!kazekage) return ctx.state;
    let state = ctx.state;
    const idx = state.stack.findIndex((item) => item.targets.includes(kazekage.instanceId) && isNinjutsuOrPhysical(state, item));
    if (idx === -1) return appendLog(state, 'Puppet Shell Guard finds nothing left to intercept.');
    const negated = state.stack[idx];
    state = { ...state, stack: [...state.stack.slice(0, idx), ...state.stack.slice(idx + 1)] };
    return appendLog(state, `Hiruko intercepts ${negated.abilityName}, shielding Third Kazekage.`);
  },
};

const poisonSenbon: AbilityDef = {
  id: 'poison-senbon',
  name: 'Poison Senbon',
  cost: 2,
  speed: 'Normal',
  style: 'Poison',
  type: 'Taijutsu',
  isDamaging: true,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    let state = dealDamage(ctx.state, target, 1).state;
    return applyPoison(state, target, 2);
  },
};

const puppetSummon: AbilityDef = {
  id: 'chakra-strings-puppet-summon',
  name: 'Chakra Strings: Puppet Summon',
  cost: 2,
  speed: 'Normal',
  style: 'None',
  type: 'Ninjutsu',
  maxTargets: 0,
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found) return false;
    return countTokensOfType(ctx.state, found.player, PUPPET_SOLDIER_ID) < 3;
  },
  resolve: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found) return ctx.state;
    const token = makePuppetSoldier(found.player, ctx.sourceInstanceId);
    return placeToken(ctx.state, found.player, token);
  },
};

const puppetPerformanceHundredPuppets: AbilityDef = {
  id: 'puppet-performance-hundred-puppets',
  name: 'Puppet Performance: Hundred Puppets',
  cost: 6,
  speed: 'Normal',
  style: 'Poison',
  type: 'Ninjutsu',
  isDamaging: true,
  isUltimate: true,
  maxTargets: 0,
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found || !isCharacter(found.occupant)) return false;
    return found.occupant.chakraPool.current >= found.occupant.chakraPool.capacity;
  },
  resolve: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found) return ctx.state;
    const opponent = otherPlayer(found.player);
    let state = ctx.state;
    for (const c of state.players[opponent].backRow) {
      if (!c) continue;
      state = dealDamage(state, c.instanceId, 2).state;
      state = applyPoison(state, c.instanceId, 3);
    }
    for (const t of state.players[opponent].frontRow) {
      if (!t) continue;
      state = dealDamage(state, t.instanceId, 2).state;
      state = applyPoison(state, t.instanceId, 3);
    }
    return state;
  },
};

const ironSandBarrage: AbilityDef = {
  id: 'iron-sand-barrage',
  name: 'Iron Sand Barrage',
  cost: 3,
  speed: 'Normal',
  style: 'None',
  type: 'Ninjutsu',
  isDamaging: true,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    return target ? dealDamage(ctx.state, target, 3).state : ctx.state;
  },
};

const goldDustPoison: AbilityDef = {
  id: 'gold-dust-poison',
  name: 'Gold Dust Poison',
  cost: 2,
  speed: 'Normal',
  style: 'None',
  type: 'Ninjutsu',
  isDamaging: true,
  maxTargets: 2,
  resolve: (ctx) => {
    let state = ctx.state;
    for (const target of ctx.targetInstanceIds.slice(0, 2)) {
      state = dealDamage(state, target, 1).state;
      state = applyPoison(state, target, 1);
    }
    return state;
  },
};

// NOTE (simplified for this pass): the "+X Chakra for +X reduction, up to
// X=4" scaling is dropped (fixed at the base -2) — there's no action-level
// channel yet for the controller to choose a numeric X at activation, the
// same gap noted for Deidara's Detonation Art / Konan's Paper Bomb Tag.
// Implemented as a real, working reduction via the engine's generic
// damage-prevention pool (combat.ts's dealDamage) — unlike Puppet Shell
// Guard, this one is a genuine reduction on the original target, not a
// redirect, matching design/CHARACTER_LOG.md's own distinction.
const ironSandWall: AbilityDef = {
  id: 'iron-sand-wall',
  name: 'Iron Sand Wall',
  cost: 3,
  speed: 'Reactive',
  style: 'None',
  type: 'Ninjutsu',
  targetSide: 'ally', // "protects any friendly unit"
  legalityCheck: (ctx) => {
    const allyId = ctx.targetInstanceIds[0];
    if (!allyId) return false;
    return ctx.state.stack.some((item) => item.targets.includes(allyId) && isNinjutsuOrPhysical(ctx.state, item));
  },
  resolve: (ctx) => {
    const allyId = ctx.targetInstanceIds[0];
    if (!allyId) return ctx.state;
    const state = patchCharacter(ctx.state, allyId, (c) => ({
      ...c,
      extra: { ...c.extra, damagePreventionRemaining: 2, damagePreventionUntilTurn: ctx.state.turn },
    }));
    return appendLog(state, 'Iron Sand Wall reduces the next hit against its target by 2.');
  },
};

const puppetStrike: AbilityDef = {
  id: 'puppet-strike',
  name: 'Puppet Strike',
  cost: 0,
  speed: 'Normal',
  style: 'None',
  type: 'Taijutsu',
  isDamaging: true,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    return target ? dealDamage(ctx.state, target, 1).state : ctx.state;
  },
};

registerCharacter({
  id: HIRUKO_ID,
  name: 'Sasori (Hiruko)',
  rank: 'A',
  baseMaxHP: 7,
  basePoolCapacity: 2,
  styles: ['Poison'],
  abilities: [tailStrike, puppetShellGuard],
  synergy: ['Akatsuki', 'Deidara'],
});

registerCharacter({
  id: HOLLOW_BODY_ID,
  name: 'Sasori (Hollow Body)',
  rank: 'A',
  baseMaxHP: 4,
  basePoolCapacity: 2,
  styles: ['Poison'],
  abilities: [poisonSenbon, puppetSummon],
  ultimate: puppetPerformanceHundredPuppets,
  synergy: ['Akatsuki', 'Deidara'],
});

registerTokenDef({ id: THIRD_KAZEKAGE_ID, name: 'Third Kazekage', abilities: [ironSandBarrage, goldDustPoison, ironSandWall] });
registerTokenDef({ id: PUPPET_SOLDIER_ID, name: 'Puppet Soldier', abilities: [puppetStrike] });

// Puppet Shell: Hiruko — reaching 0 HP as Hiruko isn't a true defeat, it's a
// transformation into Hollow Body (design/CHARACTER_LOG.md): same instanceId
// (so Third Kazekage's ownerCharacterInstanceId link, and anything else
// pointing at Sasori, stays valid), fresh full HP/Pool, fresh summoning
// sickness (an explicit ruling, not pure narrative continuation).
registerDefeatHook(HIRUKO_ID, (state, targetInstanceId) => {
  const found = findOccupant(state, targetInstanceId);
  if (!found || !isCharacter(found.occupant)) return null;
  const { player, index, occupant } = found;
  const p = state.players[player];
  const backRow = p.backRow.slice();
  backRow[index] = {
    ...occupant,
    defId: HOLLOW_BODY_ID,
    name: 'Sasori (Hollow Body)',
    maxHP: 4,
    currentHP: 4,
    chakraPool: { current: 0, capacity: 2 },
    status: { ...occupant.status, enteredTurn: state.turn },
  };
  const next = { ...state, players: { ...state.players, [player]: { ...p, backRow } } };
  return appendLog(next, 'Hiruko falls — Sasori emerges as Hollow Body, his true form.');
});
