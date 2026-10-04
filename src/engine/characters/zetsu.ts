import { countTokensOfType, findOccupant, isCharacter, patchCharacter, patchOccupant, placeToken } from '../board';
import { absorbChakra, dealDamage, healOccupant } from '../combat';
import { appendLog } from '../phases/phaseMachine';
import { plantChakraSpore } from '../chakraSpore';
import type { AbilityDef } from '../abilities';
import { registerCharacter, registerTokenDef } from './registry';
import type { GameState, PlayerId, TokenInstance } from '../types';

const DEF_ID = 'zetsu';
const CLONE_ID = 'white-zetsu-clone';
const GOLEM_ID = 'zetsu-golem';
const MAX_CLONES = 5;

function freshTokenStatus() {
  return { disabled: false, retreated: false, enteredTurn: -1, hasAmbush: false, usedAbilitiesThisTurn: [], pooledThisTurn: false };
}

let tokenCounter = 0;
function makeClone(owner: PlayerId, ownerInstanceId: string): TokenInstance {
  tokenCounter += 1;
  return {
    instanceId: `white-zetsu-clone-${owner}-${tokenCounter}`,
    defId: CLONE_ID,
    owner,
    name: 'White Zetsu Clone',
    maxHP: 2,
    currentHP: 2,
    ownerCharacterInstanceId: ownerInstanceId,
    status: freshTokenStatus(),
    extra: { sharedPoolOwner: ownerInstanceId },
  };
}

function makeGolem(owner: PlayerId, ownerInstanceId: string, hp: number): TokenInstance {
  tokenCounter += 1;
  return {
    instanceId: `zetsu-golem-${owner}-${tokenCounter}`,
    defId: GOLEM_ID,
    owner,
    name: 'Zetsu Golem',
    maxHP: hp,
    currentHP: hp,
    ownerCharacterInstanceId: ownerInstanceId,
    status: freshTokenStatus(),
    extra: { sharedPoolOwner: ownerInstanceId },
  };
}

/** Resolves the Chakra Pool a source actually pays from (itself, or a Zetsu-family Token's shared owner) — mirrors abilities.ts's internal resolvePoolOwner. */
function poolOwnerCurrent(state: import('../types').GameState, instanceId: string): number {
  const found = findOccupant(state, instanceId);
  if (!found) return 0;
  if (isCharacter(found.occupant)) return found.occupant.chakraPool.current;
  const ownerId = found.occupant.extra.sharedPoolOwner as string | undefined;
  if (!ownerId) return 0;
  const ownerFound = findOccupant(state, ownerId);
  return ownerFound && isCharacter(ownerFound.occupant) ? ownerFound.occupant.chakraPool.current : 0;
}

const modeSwitch: AbilityDef = {
  id: 'dual-nature-switch',
  name: 'Dual Nature: Switch Mode',
  cost: 0,
  speed: 'Normal',
  style: 'None',
  type: 'None',
  maxTargets: 0,
  usesPerTurn: 999, // "any number of times per turn" (SPEC.md)
  resolve: (ctx) =>
    patchCharacter(ctx.state, ctx.sourceInstanceId, (k) => ({
      ...k,
      extra: { ...k.extra, mode: k.extra.mode === 'white' ? 'black' : 'white' },
    })),
};

// NOTE (implementation choice): "any character was defeated this turn" is
// read off the shared action log (every defeat logs "<name> is defeated.")
// rather than a dedicated tracked flag — functionally correct, just an
// unusual way to answer the question, worth flagging if a cleaner tracked
// event bus is ever added to the engine.
const corpseConsumption: AbilityDef = {
  id: 'white-zetsu-corpse-consumption',
  name: 'White Zetsu: Corpse Consumption',
  cost: 2,
  speed: 'Normal',
  style: 'None',
  type: 'Ninjutsu',
  maxTargets: 0,
  sharedUseGroup: 'dual-nature-ability',
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    return !!found && isCharacter(found.occupant) && found.occupant.extra.mode === 'white';
  },
  resolve: (ctx) => {
    const anyDefeated = ctx.state.log.some((e) => e.turn === ctx.state.turn && e.text.endsWith('is defeated.'));
    return healOccupant(ctx.state, ctx.sourceInstanceId, anyDefeated ? 4 : 2);
  },
};

function tagDamagedByZetsuFamily(state: import('../types').GameState, targetId: string, turn: number) {
  return patchCharacter(state, targetId, (c) => ({ ...c, extra: { ...c.extra, damagedByZetsuFamilyTurn: turn } }));
}

const sinisterWhisper: AbilityDef = {
  id: 'black-zetsu-sinister-whisper',
  name: 'Black Zetsu: Sinister Whisper',
  cost: 2,
  speed: 'Normal',
  style: 'None',
  type: 'Genjutsu',
  isDamaging: true,
  sharedUseGroup: 'dual-nature-ability',
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    return !!found && isCharacter(found.occupant) && found.occupant.extra.mode === 'black';
  },
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    let state = dealDamage(ctx.state, target, 1).state;
    state = absorbChakra(state, ctx.sourceInstanceId, target, 1);
    return tagDamagedByZetsuFamily(state, target, ctx.state.turn);
  },
};

const combineZetsuGolem: AbilityDef = {
  id: 'combine-zetsu-golem',
  summons: [{ defId: GOLEM_ID, name: 'Zetsu Golem' }],
  name: 'Combine: Zetsu Golem',
  cost: 4,
  speed: 'Normal',
  style: 'None',
  type: 'Ninjutsu',
  maxTargets: 5,
  targetSide: 'ally', // targetInstanceIds here is "which of your own Clones to consume," not enemies

  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found) return false;
    if (countTokensOfType(ctx.state, found.player, CLONE_ID) < 3) return false;
    const clones = ctx.targetInstanceIds.filter((id) => {
      const t = ctx.state.players[found.player].frontRow.find((tok) => tok?.instanceId === id);
      return t?.defId === CLONE_ID;
    });
    return clones.length >= 3;
  },
  resolve: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found) return ctx.state;
    const chosen = ctx.targetInstanceIds
      .map((id) => ctx.state.players[found.player].frontRow.find((t) => t?.instanceId === id))
      .filter((t): t is TokenInstance => !!t && t.defId === CLONE_ID);
    const combinedHP = chosen.reduce((sum, t) => sum + t.currentHP, 0);

    const frontRow = ctx.state.players[found.player].frontRow.map((t) =>
      t && chosen.some((c) => c.instanceId === t.instanceId) ? null : t,
    );
    let state = { ...ctx.state, players: { ...ctx.state.players, [found.player]: { ...ctx.state.players[found.player], frontRow } } };
    state = appendLog(state, `${chosen.length} White Zetsu Clones combine into a Zetsu Golem (${combinedHP} HP).`);
    const golem = makeGolem(found.player, ctx.sourceInstanceId, Math.max(1, combinedHP));
    return placeToken(state, found.player, { ...golem, extra: { ...golem.extra, createdTurn: state.turn } }, { askPosition: true });
  },
};

// Shared by Zetsu himself, every White Zetsu Clone, and every Zetsu Golem —
// the exact same AbilityDef object is registered on all three (registry.ts).
/** Absorbed Vitality's X — the controller's choice (1 to whatever the shared Reservoir holds); defaults to the most they can pay only when no choice was recorded (engine-internal callers). */
function vitalityX(ctx: { state: GameState; sourceInstanceId: string; choices?: Record<string, unknown> }): number {
  const available = poolOwnerCurrent(ctx.state, ctx.sourceInstanceId);
  const chosen = ctx.choices?.x;
  const x = typeof chosen === 'number' ? Math.floor(chosen) : available;
  return Math.max(1, Math.min(x, Math.max(1, available)));
}

// "X Chakra, paid from the shared Reservoir only: Heal X-1" — X is chosen
// by the controller at activation, up to what the Reservoir holds.
const absorbedVitality: AbilityDef = {
  id: 'absorbed-vitality',
  name: 'Absorbed Vitality',
  cost: (ctx) => vitalityX(ctx),
  speed: 'Normal',
  style: 'None',
  type: 'Ninjutsu',
  targetSide: 'ally', // "heal X-1 HP to an ally or itself"
  requiresFullPoolPayment: true,
  legalityCheck: (ctx) => poolOwnerCurrent(ctx.state, ctx.sourceInstanceId) >= 1,
  choices: (ctx) => {
    const available = poolOwnerCurrent(ctx.state, ctx.sourceInstanceId);
    return available >= 1 ? [{ id: 'x', kind: 'number', prompt: 'Choose X (Chakra from the shared Reservoir) — heals X−1', min: 1, max: available }] : [];
  },
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0] ?? ctx.sourceInstanceId;
    const x = typeof ctx.choices?.x === 'number' ? Math.max(1, Math.floor(ctx.choices.x)) : 1;
    return appendLog(healOccupant(ctx.state, target, x - 1), `Absorbed Vitality: X = ${x}, heals ${x - 1}.`);
  },
};

// Until the end of your next turn the target can't negate the targeting of
// damage dealt to it with an ability of its own (or a hand card it enables —
// every AbilityDef/HandCardDef marked negatesTargetingOfSelf is refused, see
// abilities.ts / playHandCard.ts), and can't use Taijutsu; Absorb 1 from it at
// your next 2 End Phases.
const sporeTechnique: AbilityDef = {
  id: 'spore-technique',
  name: 'Spore Technique',
  cost: 4,
  speed: 'Normal',
  style: 'None',
  type: 'Ninjutsu',
  legalityCheck: (ctx) => {
    const targetId = ctx.targetInstanceIds[0];
    if (!targetId) return false;
    const targetFound = findOccupant(ctx.state, targetId);
    return !!targetFound && targetFound.occupant.extra.damagedByZetsuFamilyTurn === ctx.state.turn;
  },
  resolve: (ctx) => {
    const targetId = ctx.targetInstanceIds[0];
    if (!targetId) return ctx.state;
    let state = patchCharacter(ctx.state, targetId, (c) => ({
      ...c,
      extra: { ...c.extra, taijutsuLockedUntilTurn: ctx.state.turn + 2, cannotNegateOwnDamageUntilTurn: ctx.state.turn + 2 },
    }));
    state = patchCharacter(state, ctx.sourceInstanceId, (k) => ({
      ...k,
      extra: {
        ...k.extra,
        sporeSchedule: [...((k.extra.sporeSchedule as { targetInstanceId: string; ticksLeft: number }[]) ?? []), { targetInstanceId: targetId, ticksLeft: 2 }],
      },
    }));
    return appendLog(state, "Spore Technique locks its target's Taijutsu and will Absorb 1 from it at your next 2 End Phases.");
  },
};

const whiteZetsuArmy: AbilityDef = {
  id: 'white-zetsu-army',
  summons: [{ defId: CLONE_ID, name: 'White Zetsu Clone' }],
  name: 'White Zetsu Army',
  cost: 5,
  speed: 'Normal',
  style: 'None',
  type: 'Ninjutsu',
  isUltimate: true,
  maxTargets: 0,
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    return !!found && isCharacter(found.occupant) && found.occupant.extra.mode === 'white';
  },
  resolve: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found) return ctx.state;
    let state = ctx.state;
    const room = MAX_CLONES - countTokensOfType(state, found.player, CLONE_ID);
    const toCreate = Math.min(3, Math.max(0, room));
    for (let i = 0; i < toCreate; i++) {
      state = placeToken(state, found.player, makeClone(found.player, ctx.sourceInstanceId), { askPosition: true });
    }
    return appendLog(state, `Zetsu creates ${toCreate} White Zetsu Clone token(s).`);
  },
};

const cloneStrike: AbilityDef = {
  id: 'clone-strike',
  name: 'Clone Strike',
  cost: 1,
  speed: 'Normal',
  style: 'None',
  type: 'Genjutsu',
  isDamaging: true,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    let state = dealDamage(ctx.state, target, 1).state;
    state = absorbChakra(state, ctx.sourceInstanceId, target, 1);
    return tagDamagedByZetsuFamily(state, target, ctx.state.turn);
  },
};

const golemStrike: AbilityDef = {
  id: 'golem-strike',
  name: 'Golem Strike',
  cost: 1,
  speed: 'Normal',
  style: 'None',
  type: 'Taijutsu',
  isDamaging: true,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    const state = dealDamage(ctx.state, target, 3).state;
    return plantChakraSpore(state, target, ctx.sourceInstanceId);
  },
};

registerCharacter({
  id: DEF_ID,
  name: 'Zetsu',
  rank: 'B',
  baseMaxHP: 7,
  basePoolCapacity: Infinity,
  styles: [],
  abilities: [modeSwitch, corpseConsumption, sinisterWhisper, combineZetsuGolem, absorbedVitality, sporeTechnique],
  ultimate: whiteZetsuArmy,
  noSelfPooling: true,
  initialExtra: { mode: 'white' },
  synergy: ['Akatsuki'],
  runsHooksWhenInert: ['endPhase'], // Spore Technique's drain was already activated; the Upkeep self-heal is a passive and does not run
  onUpkeep: (state, instanceId) => healOccupant(state, instanceId, 1),
  onEndPhase: (state, instanceId) => {
    const found = findOccupant(state, instanceId);
    if (!found || !isCharacter(found.occupant)) return state;
    const schedule = (found.occupant.extra.sporeSchedule as { targetInstanceId: string; ticksLeft: number }[]) ?? [];
    if (schedule.length === 0) return state;

    let next = state;
    const remaining: { targetInstanceId: string; ticksLeft: number }[] = [];
    for (const tick of schedule) {
      if (findOccupant(next, tick.targetInstanceId)) {
        next = absorbChakra(next, instanceId, tick.targetInstanceId, 1);
      }
      if (tick.ticksLeft - 1 > 0) remaining.push({ ...tick, ticksLeft: tick.ticksLeft - 1 });
    }
    return patchCharacter(next, instanceId, (k) => ({ ...k, extra: { ...k.extra, sporeSchedule: remaining } }));
  },
});

registerTokenDef({ id: CLONE_ID, name: 'White Zetsu Clone', abilities: [cloneStrike, absorbedVitality] });
registerTokenDef({
  id: GOLEM_ID,
  name: 'Zetsu Golem',
  abilities: [golemStrike, absorbedVitality],
  // Regeneration: "At the start of your Upkeep Phase, if the Golem took no damage last turn, heal it 1 HP."
  // combat.ts stamps lastDamagedTurn on every hit; this checks it against the previous Upkeep's check.
  onUpkeep: (state, instanceId) => {
    const found = findOccupant(state, instanceId);
    if (!found) return state;
    const golem = found.occupant;
    const since = (golem.extra.regenCheckedTurn as number | undefined) ?? (golem.extra.createdTurn as number | undefined) ?? -1;
    const lastHit = golem.extra.lastDamagedTurn as number | undefined;
    let next = patchOccupant(state, instanceId, (o) => ({ ...o, extra: { ...o.extra, regenCheckedTurn: state.turn } }));
    if ((lastHit === undefined || lastHit <= since) && golem.currentHP < golem.maxHP) {
      next = appendLog(healOccupant(next, instanceId, 1), 'Zetsu Golem regenerates (no damage taken last turn).');
    }
    return next;
  },
});
