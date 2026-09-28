import { countTokensOfType, findOccupant, getCrossPatternTargets, isCharacter, placeToken } from '../board';
import { dealDamage } from '../combat';
import { appendLog } from '../phases/phaseMachine';
import type { AbilityDef } from '../abilities';
import { registerCharacter } from './registry';
import type { GameState, PlayerId, TokenInstance } from '../types';

const DEF_ID = 'deidara';
const CLAY_SPIDER_DEF_ID = 'clay-spider';
const CLAY_SPIDER_CAP = 5;

function addClayCharges(state: GameState, instanceId: string, delta: number): GameState {
  const found = findOccupant(state, instanceId);
  if (!found || !(isCharacter(found.occupant))) return state;
  const { player, index, occupant } = found;
  const current = (occupant.extra.clayCharges as number) ?? 0;
  const p = state.players[player];
  const backRow = p.backRow.slice();
  backRow[index] = { ...occupant, extra: { ...occupant.extra, clayCharges: Math.max(0, current + delta) } };
  return { ...state, players: { ...state.players, [player]: { ...p, backRow } } };
}

function clayCharges(state: GameState, instanceId: string): number {
  const found = findOccupant(state, instanceId);
  if (!found || !(isCharacter(found.occupant))) return 0;
  return (found.occupant.extra.clayCharges as number) ?? 0;
}

let clayTokenCounter = 0;
function makeClaySpider(owner: PlayerId, ownerInstanceId: string): TokenInstance {
  clayTokenCounter += 1;
  return {
    instanceId: `clay-spider-${owner}-${clayTokenCounter}`,
    defId: CLAY_SPIDER_DEF_ID,
    owner,
    name: 'Clay Spider',
    maxHP: 1,
    currentHP: 1,
    ownerCharacterInstanceId: ownerInstanceId,
    status: { disabled: false, retreated: false, enteredTurn: -1, hasAmbush: false, usedAbilitiesThisTurn: [], pooledThisTurn: false },
    extra: {},
  };
}

// Usable up to 3 times/turn — overrides the default once-per-turn cap
// (SPEC.md §9).
const explosiveClay: AbilityDef = {
  id: 'explosive-clay',
  name: 'Explosive Clay',
  cost: 1,
  speed: 'Normal',
  style: 'Explosion',
  type: 'Ninjutsu',
  usesPerTurn: 3,
  maxTargets: 0,
  resolve: (ctx) => appendLog(addClayCharges(ctx.state, ctx.sourceInstanceId, 1), 'Deidara generates 1 Clay Charge.'),
};

// Usable twice/turn — overrides the default once-per-turn cap. The 5-token
// cap is enforced here rather than in the shared pipeline, since it's a
// card-specific number on top of the flat 10-slot front row (SPEC.md §10).
const clSpiderAbility: AbilityDef = {
  id: 'c1-shi-wan',
  name: 'C1, Shi-Wan: Clay Spider',
  cost: 1,
  speed: 'Normal',
  style: 'Explosion',
  type: 'Ninjutsu',
  usesPerTurn: 2,
  maxTargets: 0,
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found) return false;
    return countTokensOfType(ctx.state, found.player, CLAY_SPIDER_DEF_ID) < CLAY_SPIDER_CAP;
  },
  resolve: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found) return ctx.state;
    const token = makeClaySpider(found.player, ctx.sourceInstanceId);
    const next = placeToken(ctx.state, found.player, token);
    return appendLog(next, 'Deidara creates a Clay Spider token.');
  },
};

// Auto-spends 1 Clay Charge for the upgraded 4-damage version whenever one is
// available (SIMPLIFIED for this pass — the real card lets the player choose
// whether to spend it; there's no generic optional-resource-spend UI/input
// channel yet, so this always upgrades when it can).
const detonationArt: AbilityDef = {
  id: 'detonation-art',
  name: 'Detonation Art',
  cost: 3,
  speed: 'Normal',
  style: 'Explosion',
  type: 'Ninjutsu',
  isDamaging: true,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    const charges = clayCharges(ctx.state, ctx.sourceInstanceId);
    const upgraded = charges >= 1;
    let state = upgraded ? addClayCharges(ctx.state, ctx.sourceInstanceId, -1) : ctx.state;
    state = dealDamage(state, target, upgraded ? 4 : 2).state;
    return state;
  },
};

// NOTE (simplified for this pass): requires Deidara's Pool at max Capacity
// to activate (SPEC.md's Condition) — enforced below. Spends 5 Clay Charges,
// so realistically needs several turns of Explosive Clay first.
const c3ShiSuri: AbilityDef = {
  id: 'c3-shi-suri',
  name: 'C3, Shi-Suri',
  cost: 5,
  speed: 'Normal',
  style: 'Explosion',
  type: 'Ninjutsu',
  isUltimate: true,
  isDamaging: true,
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found || !(isCharacter(found.occupant))) return false;
    const pool = found.occupant.chakraPool;
    return pool.current >= pool.capacity && clayCharges(ctx.state, ctx.sourceInstanceId) >= 5;
  },
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    let state = addClayCharges(ctx.state, ctx.sourceInstanceId, -5);
    state = dealDamage(state, target, 5).state;

    const found = findOccupant(state, target);
    if (found) {
      // Cross-pattern splash: left/right/front/back of the primary target
      // (SPEC.md §9) — the main validation point for this character.
      const splash = getCrossPatternTargets(state, found.player, found.zone, found.index);
      for (const occ of splash) {
        state = dealDamage(state, occ.instanceId, 3).state;
      }
    }
    return appendLog(state, "Deidara's C3, Shi-Suri detonates in a cross pattern.");
  },
};

registerCharacter({
  id: DEF_ID,
  name: 'Deidara',
  rank: 'A',
  baseMaxHP: 10,
  basePoolCapacity: 3,
  styles: ['Explosion', 'Earth'],
  abilities: [explosiveClay, clSpiderAbility, detonationArt],
  ultimate: c3ShiSuri,
  initialExtra: { clayCharges: 1 }, // Art is an Explosion: starts with 1 Clay Charge.
  synergy: ['Akatsuki'],
});
