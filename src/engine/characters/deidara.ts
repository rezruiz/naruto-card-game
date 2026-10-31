import { isPrototype } from '../prototype';
import { countTokensOfType, findOccupant, isCharacter, patchCharacter, placeToken } from '../board';
import { dealDamage, registerDefeatHook } from '../combat';
import { appendLog, appendWarning, otherPlayer } from '../phases/phaseMachine';
import { enqueueChoice, registerChoiceResolver } from '../choices';
import type { AbilityDef } from '../abilities';
import { registerCharacter, registerTokenDef } from './registry';
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
    extra: { sharedPoolOwner: ownerInstanceId }, // its abilities are paid from Deidara's Pool
  };
}

// Usable twice/turn — overrides the default once-per-turn cap. The 5-token
// cap is enforced here rather than in the shared pipeline, since it's a
// card-specific number on top of the flat 10-slot front row (SPEC.md §10).
const clSpiderAbility: AbilityDef = {
  id: 'c1-shi-wan',
  summons: [{ defId: CLAY_SPIDER_DEF_ID, name: 'Clay Spider' }],
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
    // Clay Spiders have Ambush — no Field Orientation; they can act the turn they're made.
    let next = placeToken(ctx.state, found.player, { ...token, status: { ...token.status, hasAmbush: true } }, { askPosition: true });
    next = addClayCharges(next, ctx.sourceInstanceId, 1);
    return appendLog(next, `Deidara creates a Clay Spider token and gains 1 Clay Charge (${clayCharges(next, ctx.sourceInstanceId)}).`);
  },
};

// The Clay Charge spend is the controller's choice (asked at activation,
// only when Deidara has one); resolve re-checks it's still there.
const detonationArt: AbilityDef = {
  id: 'detonation-art',
  name: 'Detonation Art',
  cost: 4,
  speed: 'Normal',
  style: 'Explosion',
  type: 'Ninjutsu',
  isDamaging: true,
  choices: (ctx) =>
    clayCharges(ctx.state, ctx.sourceInstanceId) >= 1
      ? [{ id: 'spendCharge', kind: 'yesno', prompt: 'Spend 1 Clay Charge for 3 damage instead of 1?' }]
      : [],
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    const upgraded = ctx.choices?.spendCharge === true && clayCharges(ctx.state, ctx.sourceInstanceId) >= 1;
    let state = upgraded ? addClayCharges(ctx.state, ctx.sourceInstanceId, -1) : ctx.state;
    state = appendLog(
      state,
      upgraded
        ? `Deidara spends 1 Clay Charge (${clayCharges(state, ctx.sourceInstanceId)} left) — upgraded Detonation Art.`
        : 'Deidara uses the base Detonation Art (no Clay Charge spent).',
    );
    return dealDamage(state, target, upgraded ? 3 : 1).state;
  },
};

// Condition: Deidara's Pool at max Capacity (checked at activation; the cost
// may then spend from it). Spends 2 Clay Charges.
const c3ShiSuri: AbilityDef = {
  id: 'c3-shi-suri',
  name: 'C3, Shi-Suri',
  cost: 7,
  speed: 'Normal',
  style: 'Explosion',
  type: 'Ninjutsu',
  isUltimate: true,
  isDamaging: true,
  maxTargets: 3,
  targetHint: 'The first unit you pick takes 4 damage; the others take 2.',
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found || !(isCharacter(found.occupant))) return false;
    const picks = ctx.targetInstanceIds;
    return picks.length >= 1 && new Set(picks).size === picks.length && clayCharges(ctx.state, ctx.sourceInstanceId) >= 2;
  },
  resolve: (ctx) => {
    const [target, ...others] = ctx.targetInstanceIds;
    if (!target) return ctx.state;
    let state = addClayCharges(ctx.state, ctx.sourceInstanceId, -2);
    state = dealDamage(state, target, 4).state;
    for (const id of others.slice(0, 2)) {
      if (findOccupant(state, id)) state = dealDamage(state, id, 2).state;
    }
    return appendLog(state, "Deidara's C3, Shi-Suri detonates.");
  },
};

// C2, Shi-Ryu: he takes to the air on his clay dragon, for as long as he's in play. board.ts's isOutOfReach and
// shinobi.ts apply what that means.
const c2ShiRyu: AbilityDef = {
  id: 'c2-shi-ryu',
  name: 'C2, Shi-Ryu',
  cost: 3,
  speed: 'Normal',
  style: 'Explosion',
  type: 'Ninjutsu',
  maxTargets: 0,
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    return !!found && found.occupant.extra.airborne !== true && clayCharges(ctx.state, ctx.sourceInstanceId) >= 5;
  },
  resolve: (ctx) => {
    const state = addClayCharges(ctx.state, ctx.sourceInstanceId, -5);
    const next = patchCharacter(state, ctx.sourceInstanceId, (d) => ({ ...d, extra: { ...d.extra, airborne: true } }));
    return appendLog(next, 'Deidara takes to the air on C2, Shi-Ryu — he is Airborne.');
  },
};

// --- Forbidden Technique — Death is an Explosion ---------------------------

/** The blast both versions share: `enemyDamage` to every enemy unit, `allyDamage` to every other friendly unit (Characters and Tokens alike). */
function deathIsAnExplosionBlast(state: GameState, deidaraId: string, enemyDamage: number, allyDamage: number): GameState {
  const found = findOccupant(state, deidaraId);
  if (!found) return state;
  const owner = found.player;
  const unitsOf = (s: GameState, p: PlayerId) => [...s.players[p].backRow, ...s.players[p].frontRow].filter((u) => u !== null).map((u) => u!.instanceId);
  let next = appendLog(state, `Deidara: "Art is an EXPLOSION!" — ${enemyDamage} to every enemy, ${allyDamage} to every ally.`);
  for (const id of unitsOf(next, otherPlayer(owner))) {
    if (findOccupant(next, id)) next = dealDamage(next, id, enemyDamage).state;
  }
  for (const id of unitsOf(next, owner)) {
    if (id !== deidaraId && findOccupant(next, id)) next = dealDamage(next, id, allyDamage).state;
  }
  return next;
}

/** Deidara dies as part of the technique — a real defeat (Health loss, Reinforcement, token fizzles), bypassing Version 2's own trigger. */
function deidaraDies(state: GameState, deidaraId: string): GameState {
  const found = findOccupant(state, deidaraId);
  if (!found) return state;
  const marked = patchCharacter(state, deidaraId, (d) => ({ ...d, currentHP: 0, extra: { ...d.extra, deathPending: false, deathResolved: true } }));
  return dealDamage(marked, deidaraId, 1, { cannotBeReduced: true, ongoing: true }).state;
}

/** Death is an Explosion's blast: 4 damage to every enemy, +1 per Clay Charge spent, up to 3. */
const BLAST_DAMAGE = 4;
const BLAST_MAX_CHARGES = 3;
const blastCharges = (state: GameState, instanceId: string) => Math.min(BLAST_MAX_CHARGES, clayCharges(state, instanceId));

// Version 1: a deliberate last stand — Deidara at 3 HP or less.
const deathIsAnExplosionV1: AbilityDef = {
  id: 'death-is-an-explosion-v1',
  name: 'Death is an Explosion (Version 1)',
  cost: 6,
  speed: 'Normal',
  style: 'Explosion',
  type: 'Ninjutsu',
  isForbidden: true,
  isDamaging: true,
  maxTargets: 0,
  choices: (ctx) => {
    const max = blastCharges(ctx.state, ctx.sourceInstanceId);
    return max > 0 ? [{ id: 'clayCharges', kind: 'number', prompt: 'Spend how many Clay Charges for +1 damage to every enemy each?', min: 0, max }] : [];
  },
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found || !isCharacter(found.occupant)) return false;
    return found.occupant.currentHP <= 3;
  },
  resolve: (ctx) => {
    if (!findOccupant(ctx.state, ctx.sourceInstanceId)) return ctx.state;
    const chosen = typeof ctx.choices?.clayCharges === 'number' ? ctx.choices.clayCharges : 0;
    const spent = Math.max(0, Math.min(blastCharges(ctx.state, ctx.sourceInstanceId), chosen));
    let state = addClayCharges(ctx.state, ctx.sourceInstanceId, -spent);
    state = deathIsAnExplosionBlast(state, ctx.sourceInstanceId, BLAST_DAMAGE + spent, 3);
    return deidaraDies(state, ctx.sourceInstanceId);
  },
};

// Version 2: a replacement for his death — when Deidara would be defeated
// with 6 Chakra to pay, he stays at 0 HP for a moment and his
// controller is ASKED whether to go out with the blast (never automatic).
// Damage can't pause mid-resolution for a Reactive activation, so the
// trigger is the defeat itself (a defeat hook), answered via a pending choice.
const V2_ID = 'death-is-an-explosion-v2';
const deathIsAnExplosionV2: AbilityDef = {
  id: V2_ID,
  name: 'Death is an Explosion (Version 2)',
  cost: 6,
  triggeredOnly: true,
  speed: 'Reactive',
  style: 'Explosion',
  type: 'Ninjutsu',
  isForbidden: true,
  isDamaging: true,
  maxTargets: 0,
  resolve: (ctx) => ctx.state,
};

registerDefeatHook(DEF_ID, (state, instanceId) => {
  const found = findOccupant(state, instanceId);
  if (!found || !isCharacter(found.occupant)) return null;
  const deidara = found.occupant;
  if (deidara.extra.deathResolved) return null; // his decision is made — the defeat goes through
  if (deidara.extra.deathPending) return state; // already waiting on the answer; stays at 0 HP
  // Prototype rules: like every ability, it's paid from his Pool.
  const available = isPrototype(state) ? deidara.chakraPool.current : state.players[found.player].genericChakraAvailable;
  if (available < 6 && state.rules !== 'trust') return null;
  const charges = Array.from({ length: blastCharges(state, instanceId) + 1 }, (_, spent) => spent);
  const marked = patchCharacter(state, instanceId, (d) => ({ ...d, extra: { ...d.extra, deathPending: true } }));
  return enqueueChoice(appendLog(marked, 'Deidara would be defeated — he can go out with Death is an Explosion.'), {
    player: found.player,
    prompt: `Deidara would be defeated. Activate Death is an Explosion (Version 2)? Costs 6 Chakra: ${BLAST_DAMAGE} damage to every enemy, +1 for each Clay Charge spent, and 5 to every ally. He dies either way.`,
    options: [
      ...charges.map((spent) => ({ id: `activate-${spent}`, label: `Activate — ${BLAST_DAMAGE + spent} damage (spend ${spent} Clay Charge${spent === 1 ? '' : 's'})` })),
      { id: 'decline', label: 'Decline — just fall' },
    ],
    min: 1,
    max: 1,
    resolverId: V2_ID,
    data: { instanceId },
  });
});

registerChoiceResolver(V2_ID, (state, choice, optionIds) => {
  const instanceId = choice.data.instanceId as string;
  const found = findOccupant(state, instanceId);
  if (!found || !isCharacter(found.occupant)) return state;
  if (!optionIds[0]?.startsWith('activate-')) return deidaraDies(appendLog(state, 'Deidara falls without detonating.'), instanceId);
  const spent = Number(optionIds[0].slice('activate-'.length));

  const player = found.player;
  const relaxed = state.rules === 'trust';
  const fromPool = isPrototype(state);
  const generic = state.players[player].genericChakraAvailable;
  const available = fromPool ? found.occupant.chakraPool.current : generic;
  if (available < 6 && !relaxed) {
    return deidaraDies(appendLog(state, `Not enough Chakra for Death is an Explosion (needs 6 available, has ${available}) — Deidara falls.`), instanceId);
  }
  let next = available < 6 ? appendWarning(state, `${player} is short ${6 - available} Chakra for Death is an Explosion (trust mode — allowed).`) : state;
  if (fromPool) next = patchCharacter(next, instanceId, (d) => ({ ...d, chakraPool: { ...d.chakraPool, current: Math.max(0, d.chakraPool.current - 6) } }));
  else
    next = { ...next, players: { ...next.players, [player]: { ...next.players[player], genericChakraAvailable: Math.max(0, generic - 6), fadingGenericChakra: Math.max(0, next.players[player].fadingGenericChakra - (6)) } } };
  next = addClayCharges(next, instanceId, -spent);
  next = deathIsAnExplosionBlast(next, instanceId, BLAST_DAMAGE + spent, 5);
  return deidaraDies(next, instanceId);
});

// --- Clay Spider token -------------------------------------------------------

function spiderIdsOf(state: GameState, player: PlayerId): string[] {
  return state.players[player].frontRow.filter((t) => t?.defId === CLAY_SPIDER_DEF_ID).map((t) => t!.instanceId);
}

/** Removes these spiders from the board (detonated / reverted to clay) — not a defeat. */
function removeSpiders(state: GameState, player: PlayerId, ids: string[]): GameState {
  const p = state.players[player];
  return { ...state, players: { ...state.players, [player]: { ...p, frontRow: p.frontRow.map((t) => (t && ids.includes(t.instanceId) ? null : t)) } } };
}

// "Choose any number of your Clay Spider tokens and 1 target; they all
// detonate against it for 1 damage each. 3 Chakra total per activation,
// regardless of spider count." How many spiders is the player's choice;
// the activating spider is always one of them. Detonated spiders are gone.
const selfDetonate: AbilityDef = {
  id: 'self-detonate',
  name: 'Self Detonate',
  cost: 2,
  speed: 'Quick',
  style: 'None', // Tokens can't carry Styles yet — Explosion is flavor here (same as Pain's Paths)
  type: 'Ninjutsu',
  isDamaging: true,
  usesPerTurn: 999, // "usable any number of times per turn"
  choices: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    const count = found ? spiderIdsOf(ctx.state, found.player).length : 1;
    return [{ id: 'spiders', kind: 'number', prompt: 'How many Clay Spiders detonate (1 damage each)?', min: 1, max: Math.max(1, count) }];
  },
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!target || !found) return ctx.state;
    const others = spiderIdsOf(ctx.state, found.player).filter((id) => id !== ctx.sourceInstanceId);
    const wanted = typeof ctx.choices?.spiders === 'number' ? Math.max(1, Math.floor(ctx.choices.spiders)) : 1;
    const detonating = [ctx.sourceInstanceId, ...others.slice(0, wanted - 1)];
    let state = removeSpiders(ctx.state, found.player, detonating);
    state = appendLog(state, `${detonating.length} Clay Spider(s) detonate.`);
    for (let i = 0; i < detonating.length; i++) {
      if (findOccupant(state, target)) state = dealDamage(state, target, 1).state;
    }
    return state;
  },
};

// "4 Clay Spider tokens revert to clay and are destroyed, generating 2 Clay Charges."
const combineSpiders: AbilityDef = {
  id: 'combine-clay-spiders',
  name: 'Combine',
  cost: 0,
  speed: 'Normal',
  style: 'None',
  type: 'Ninjutsu',
  maxTargets: 0,
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    return !!found && spiderIdsOf(ctx.state, found.player).length >= 4;
  },
  resolve: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found || isCharacter(found.occupant)) return ctx.state;
    const deidaraId = found.occupant.ownerCharacterInstanceId;
    const others = spiderIdsOf(ctx.state, found.player).filter((id) => id !== ctx.sourceInstanceId);
    if (others.length < 3) return appendLog(ctx.state, 'Combine needs 4 Clay Spiders.');
    let state = removeSpiders(ctx.state, found.player, [ctx.sourceInstanceId, ...others.slice(0, 3)]);
    state = addClayCharges(state, deidaraId, 2);
    return appendLog(state, `4 Clay Spiders revert to clay — Deidara gains 2 Clay Charges (${clayCharges(state, deidaraId)}).`);
  },
};

registerTokenDef({ id: CLAY_SPIDER_DEF_ID, name: 'Clay Spider', abilities: [selfDetonate, combineSpiders] });

registerCharacter({
  id: DEF_ID,
  // Airborne (C2, Shi-Ryu): a free Clay Charge each of his turns.
  onUpkeep: (state, instanceId) =>
    findOccupant(state, instanceId)?.occupant.extra.airborne === true ? appendLog(addClayCharges(state, instanceId, 1), 'Airborne: Deidara gains 1 Clay Charge.') : state,
  name: 'Deidara',
  rank: 'A',
  baseMaxHP: 10,
  basePoolCapacity: 10,
  styles: ['Explosion', 'Earth'],
  abilities: [clSpiderAbility, detonationArt, c2ShiRyu, deathIsAnExplosionV1, deathIsAnExplosionV2],
  ultimate: c3ShiSuri,
  initialExtra: { clayCharges: 0 },
  synergy: ['Akatsuki'],
});
