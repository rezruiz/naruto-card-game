import { samehadaFusionAbsorb } from '../characters/kisame';
import { getCharacterDef, sharedVersatilitySource } from '../characters/registry';
import { findOccupant, isCharacter, patchCharacter, patchOccupant, isHidingLikeAMole, isPhasedOut, surfaceFromMole, isOutOfReach, blockedByWaterPrison } from '../board';
import { canActivateNormalSpeed, pushStackItem, describeCost } from '../stack';
import { cursingHidan } from '../abilities';
import { appendLog, appendWarning } from '../phases/phaseMachine';
import { isPrototype, spendSupplies, suppliesAvailable } from '../prototype';
import { getHandCardDef, needsEnablingCharacter, paysInChakra, targetedIds } from './registry';
import type { HandCardContext, HandCardDef } from './registry';
import { TERRAIN, amegakureBuffs, hasTerrain } from '../terrainEffects';
import { equipCostFor } from '../equipment';
import type { GameState, PlayerId } from '../types';

export interface Legality {
  ok: boolean;
  reason?: string;
}

function isAttackJutsu(def: HandCardDef): boolean {
  return def.cardType === 'jutsu' && !!def.isDamaging;
}

/** See HandCardDef.timing — defaults are inferred from the card's type. */
export function normalTiming(def: HandCardDef): 'main' | 'combat' | 'either' {
  if (def.timing) return def.timing;
  return isAttackJutsu(def) ? 'combat' : 'main';
}

/** Itachi's Genjutsu Master: Genjutsu cards he enables cost 1 less (minimum 1). */
function genjutsuMasterApplies(state: GameState, def: HandCardDef, enablingInstanceId: string): boolean {
  if (def.type !== 'Genjutsu' || !enablingInstanceId) return false;
  const enabler = findOccupant(state, enablingInstanceId)?.occupant;
  return !!enabler && enabler.defId === 'itachi';
}

/** Elemental Versatility (Kakuzu, Yahiko): the first elemental jutsu each turn costs 1 less — elemental Jutsu cards they enable included. */
function elementalVersatilityApplies(state: GameState, def: HandCardDef, enablingInstanceId: string): boolean {
  if (def.cardType !== 'jutsu' || def.type !== 'Ninjutsu' || def.style === 'None' || !enablingInstanceId) return false;
  const enabler = findOccupant(state, enablingInstanceId)?.occupant;
  return !!enabler && isCharacter(enabler) && !!getCharacterDef(enabler.defId)?.elementalVersatility && enabler.extra.elementalVersatilityUsedTurn !== state.turn;
}

/** Yahiko as a Shinobi: your first elemental Jutsu or ability each turn costs 1 less — the elemental Jutsu cards your Leaders enable included. The unit to mark used, if it applies. */
function sharedVersatilityFor(state: GameState, def: HandCardDef, player: PlayerId, enablingInstanceId: string): string | undefined {
  if (def.cardType !== 'jutsu' || def.type !== 'Ninjutsu' || def.style === 'None' || !enablingInstanceId) return undefined;
  return sharedVersatilitySource(state, player);
}

/** Prototype rules: how much of this card's cost must come from its enabler's Pool (an attack Jutsu's X). */
export function poolRequired(state: GameState, def: HandCardDef, ctx: HandCardContext): number {
  return isPrototype(state) ? (def.poolX?.(ctx) ?? 0) : 0;
}

export function resolveCost(def: HandCardDef, ctx: HandCardContext, payFromPool: number): number {
  let cost = typeof def.cost === 'function' ? def.cost(ctx, payFromPool) : def.cost;
  if (genjutsuMasterApplies(ctx.state, def, ctx.enablingInstanceId) && cost > 1) cost -= 1;
  // At most one Elemental Versatility discount per play, whichever sources apply.
  const versatile = elementalVersatilityApplies(ctx.state, def, ctx.enablingInstanceId) || !!sharedVersatilityFor(ctx.state, def, ctx.player, ctx.enablingInstanceId);
  if (versatile && cost > 1) cost -= 1;
  // Earth Style: Added Weight Rock Technique on the enabling character — +1 while it lasts.
  const enabler = ctx.enablingInstanceId ? findOccupant(ctx.state, ctx.enablingInstanceId)?.occupant : undefined;
  if (enabler && ((enabler.extra.addedWeightUntilTurn as number | undefined) ?? -1) >= ctx.state.turn) cost += 1;
  return cost;
}

/**
 * SPEC.md §10c: playing a Jutsu card requires an in-play, un-Disabled,
 * un-Retreated character able to enable it — Style: None cards accept any
 * character; otherwise the enabler's own Styles must include the card's
 * Style. Only cards with an ability Type need one (see
 * needsEnablingCharacter) — everything else is exempt.
 */
function checkEnabler(state: GameState, player: PlayerId, def: HandCardDef, enablingInstanceId: string): Legality {
  if (!needsEnablingCharacter(def, isPrototype(state))) return { ok: true };
  const found = findOccupant(state, enablingInstanceId);
  if (!found || !isCharacter(found.occupant) || found.player !== player) {
    return { ok: false, reason: `${player} has no such character to enable ${def.name}.` };
  }
  const enabler = found.occupant;
  if (enabler.status.disabled) return { ok: false, reason: `${enabler.name} is Disabled and can't enable a card.` };
  if (enabler.status.retreated) return { ok: false, reason: `${enabler.name} is Retreated and can't enable a card.` };
  const stunUntil = enabler.extra.stunnedUntilTurn as number | undefined;
  if (stunUntil !== undefined && state.turn <= stunUntil) return { ok: false, reason: `${enabler.name} is stunned and can't enable a card.` };
  if (blockedByWaterPrison(state, enabler.instanceId, def.type)) {
    return { ok: false, reason: `${enabler.name} is holding Water Prison and can only use Taijutsu and Bukijutsu.` };
  }
  if (def.style !== 'None' && !enabler.styles.includes(def.style)) {
    return { ok: false, reason: `${enabler.name} doesn't have Style: ${def.style}, needed to enable ${def.name}.` };
  }
  const sporeUntil = enabler.extra.cannotNegateOwnDamageUntilTurn as number | undefined;
  if (def.negatesTargetingOfSelf && sporeUntil !== undefined && state.turn <= sporeUntil) {
    return { ok: false, reason: `${enabler.name} is under Spore Technique and can't negate attacks on itself.` };
  }
  return { ok: true };
}

function checkTargets(state: GameState, player: PlayerId, def: HandCardDef, targetInstanceIds: string[], enablingInstanceId: string): Legality {
  if ((def.maxTargets ?? 1) === 0) return { ok: true };
  const side = def.targetSide ?? 'enemy';
  for (const targetId of targetInstanceIds) {
    const targetFound = findOccupant(state, targetId);
    if (!targetFound) return { ok: false, reason: 'No such target.' };
    const isAlly = targetFound.player === player;
    if (side === 'enemy' && isAlly) return { ok: false, reason: `${def.name} can only target an enemy.` };
    if (side === 'ally' && !isAlly) return { ok: false, reason: `${def.name} can only target an ally.` };
    if (isAlly && cursingHidan(targetFound.occupant)) return { ok: false, reason: `Hidan can't be targeted by friendly attacks while his Curse is active.` };
    if (targetFound.occupant.status.retreated && !def.allowRetreatedTarget) {
      const nonRetreatedExists = state.players[targetFound.player].backRow.some((c) => c && !c.status.retreated);
      if (nonRetreatedExists) return { ok: false, reason: `${targetFound.occupant.name} is Retreated and can't be targeted.` };
    }
    if (!isAlly && isOutOfReach(targetFound.occupant, def.type)) return { ok: false, reason: `${targetFound.occupant.name} is Airborne: ${def.type} can't reach it.` };
    if (isPhasedOut(state, targetFound.occupant)) return { ok: false, reason: `${targetFound.occupant.name} has phased out (Crow Clone) and can't be targeted this turn.` };
    // It can still target itself — with its own abilities or a card it enables.
    if (targetId !== enablingInstanceId && isHidingLikeAMole(state, targetFound.occupant)) return { ok: false, reason: `${targetFound.occupant.name} is Hiding Like a Mole and can't be targeted.` };
  }
  return { ok: true };
}

export function checkHandCardLegality(
  state: GameState,
  player: PlayerId,
  cardInstanceId: string,
  enablingInstanceId: string,
  targetInstanceIds: string[],
  payFromPool: number,
  amount?: number,
  /** ignoreCondition: skip the card's own legalityCheck — for trust mode's 'could they respond at all?' probe on multi-target cards. */
  opts: { ignoreCondition?: boolean } = {},
): Legality {
  const handEntry = state.players[player].hand.find((h) => h.instanceId === cardInstanceId);
  if (!handEntry || handEntry.kind !== 'card') return { ok: false, reason: `${player} has no such card in hand.` };
  const def = getHandCardDef(handEntry.defId);
  if (!def) return { ok: false, reason: `Unknown Jutsu Deck card: ${handEntry.defId}.` };

  const enablerCheck = checkEnabler(state, player, def, enablingInstanceId);
  if (!enablerCheck.ok) return enablerCheck;

  if (def.speed === 'Normal' && !canActivateNormalSpeed(state, player)) {
    return { ok: false, reason: `${def.name} is Normal speed — can only be played on an empty stack during your own Main/Combat Phase.` };
  }
  // Normal-speed timing: non-combat cards (Terrain, Missions, deck searches...) are Main-Phase plays; Attack-type Jutsu are Combat-only and once per turn per named card; combat-relevant immediate effects (healing) may go in either.
  if (def.speed === 'Normal') {
    // Prototype rules: every Normal-speed Jutsu may be played in either Main Phase or Combat.
    const timing = isPrototype(state) && def.cardType === 'jutsu' ? 'either' : normalTiming(def);
    if (timing === 'combat' && state.phase !== 'Combat') {
      return { ok: false, reason: `${def.name} is an Attack-type Jutsu — it can only be played during your Combat Phase.` };
    }
    if (timing === 'main' && state.phase === 'Combat') {
      return { ok: false, reason: `${def.name} isn't a combat effect — it can only be played during a Main Phase.` };
    }
    if (isAttackJutsu(def) && state.players[player].attackJutsuUsedThisTurn.includes(def.name)) {
      return { ok: false, reason: `${def.name} was already played this turn — each Attack-type Jutsu can only be used once per turn.` };
    }
  }
  if (def.speed !== 'Normal' && state.priorityPlayer !== player) {
    return { ok: false, reason: `${player} doesn't currently have priority.` };
  }

  const targetCheck = checkTargets(state, player, def, targetInstanceIds, enablingInstanceId);
  if (!targetCheck.ok) return targetCheck;

  const ctx: HandCardContext = { state, player, enablingInstanceId, targetInstanceIds, amount };
  if (!opts.ignoreCondition && def.legalityCheck && !def.legalityCheck(ctx)) {
    return { ok: false, reason: `${def.name}'s condition isn't met.` };
  }

  if (isPrototype(state) && !paysInChakra(def)) return prototypeCostCheck(state, player, def, ctx);

  const required = poolRequired(state, def, ctx);
  const fromPool = Math.max(payFromPool, required);
  const cost = resolveCost(def, ctx, fromPool);
  const enabler = findOccupant(state, enablingInstanceId);
  const enablerPool = enabler && isCharacter(enabler.occupant) ? enabler.occupant.chakraPool.current : 0;
  if (required > enablerPool) return { ok: false, reason: `${def.name}'s X must be paid from the enabling Leader's Pool (${required} needed, ${enablerPool} pooled).` };
  const totalPool = fromPool;
  const totalGeneric = cost - fromPool;
  if (totalPool < 0 || totalPool > enablerPool) {
    return { ok: false, reason: `Not enough Chakra pooled in the enabling character.` };
  }
  if (totalGeneric < 0 || totalGeneric > state.players[player].genericChakraAvailable) {
    return { ok: false, reason: `Not enough generic Chakra available.` };
  }

  return { ok: true };
}

/**
 * Prototype rules (prototype.ts): the Supplies cost of a card that isn't paid in Chakra (Shinobi, Missions, Terrain,
 * Assists, Equipment). A card can say otherwise (HandCardDef.paidWith).
 */
export function prototypeCardCost(state: GameState, def: HandCardDef, ctx: HandCardContext): { cost: number } {
  const cost = resolveCost(def, { ...ctx, state }, 0);
  if (def.cardType === 'equipment') {
    // An Equipment with a Leader cost (Medical Pouch) costs that much to attach to a Leader.
    const equipCost = equipCostFor(state, def.id, ctx.targetInstanceIds[0], cost);
    // Blacksmith Village: your Equipment costs 1 less Supply (to a minimum of 1).
    return { cost: hasTerrain(state, ctx.player, TERRAIN.blacksmithVillage) ? Math.max(1, equipCost - 1) : equipCost };
  }
  // Amegakure: your Amegakure Shinobi cost 1 less Supply (to a minimum of 1).
  if (def.cardType === 'shinobi' && amegakureBuffs(state, ctx.player, def.id)) return { cost: Math.max(1, cost - 1) };
  return { cost };
}

function prototypeCostCheck(state: GameState, player: PlayerId, def: HandCardDef, ctx: HandCardContext): Legality {
  const { cost } = prototypeCardCost(state, def, ctx);
  if (cost > suppliesAvailable(state, player)) {
    return { ok: false, reason: `Not enough Supplies (${cost} needed, ${suppliesAvailable(state, player)} left).` };
  }
  return { ok: true };
}

function payCost(state: GameState, player: PlayerId, enablingInstanceId: string, cost: number, payFromPool: number, soft = false): GameState {
  let next = state;
  if (soft) {
    const enabler = findOccupant(next, enablingInstanceId);
    const poolCurrent = enabler && isCharacter(enabler.occupant) ? enabler.occupant.chakraPool.current : 0;
    const fromPool = Math.min(payFromPool, poolCurrent);
    const fromGeneric = Math.min(cost - fromPool, next.players[player].genericChakraAvailable);
    if (fromPool + fromGeneric < cost) {
      next = appendWarning(next, `${player} is short ${cost - fromPool - fromGeneric} Chakra paying for this card (trust mode — allowed).`);
    }
    payFromPool = fromPool;
    cost = fromPool + fromGeneric;
  }
  if (payFromPool > 0) {
    next = patchCharacter(next, enablingInstanceId, (c) => ({ ...c, chakraPool: { ...c.chakraPool, current: c.chakraPool.current - payFromPool } }));
  }
  const p = next.players[player];
  return { ...next, players: { ...next.players, [player]: { ...p, genericChakraAvailable: p.genericChakraAvailable - (cost - payFromPool), fadingGenericChakra: Math.max(0, p.fadingGenericChakra - (cost - payFromPool)) } } };
}

/**
 * SPEC.md §10c/§7: plays a card from hand — checks legality, pays its cost,
 * removes it from hand, and (for Jutsu/Assist cards) pushes it onto the
 * stack, the same shared stack every character ability also resolves
 * through. Terrain/Mission cards enter play directly instead (handled by
 * their own resolve — see terrain.ts/missions.ts).
 */
export function playHandCard(
  state: GameState,
  player: PlayerId,
  cardInstanceId: string,
  enablingInstanceId: string,
  targetInstanceIds: string[],
  payFromPool: number,
  amount?: number,
  /** trust: skip the legality check and pay costs softly — the players have agreed the play is legal (trust mode). */
  opts: { trust?: boolean } = {},
): GameState {
  if (opts.trust) {
    if (!state.players[player].hand.some((h) => h.instanceId === cardInstanceId && h.kind === 'card')) {
      return appendLog(state, `${player} has no such card in hand.`);
    }
  } else {
    const legality = checkHandCardLegality(state, player, cardInstanceId, enablingInstanceId, targetInstanceIds, payFromPool, amount);
    if (!legality.ok) return appendLog(state, `Can't play that card: ${legality.reason}`);
  }

  const handEntry = state.players[player].hand.find((h) => h.instanceId === cardInstanceId)!;
  const def = getHandCardDef((handEntry as { defId: string }).defId)!;
  const ctx: HandCardContext = { state, player, enablingInstanceId, targetInstanceIds, amount };
  payFromPool = Math.max(payFromPool, poolRequired(state, def, ctx));
  let cost = resolveCost(def, ctx, payFromPool);
  let paidInSupplies = false;

  let next: GameState;
  if (isPrototype(state) && !paysInChakra(def)) {
    cost = prototypeCardCost(state, def, ctx).cost;
    payFromPool = 0;
    paidInSupplies = true;
    const paid = spendSupplies(state, player, cost, def.name);
    if (!paid) return appendLog(state, `Can't play ${def.name}: not enough Supplies.`);
    next = paid;
  } else {
    next = payCost(state, player, enablingInstanceId, cost, payFromPool, !!opts.trust);
  }
  if (elementalVersatilityApplies(state, def, enablingInstanceId)) {
    next = patchCharacter(next, enablingInstanceId, (c) => ({ ...c, extra: { ...c.extra, elementalVersatilityUsedTurn: state.turn } }));
  }
  const sharedFrom = sharedVersatilityFor(state, def, player, enablingInstanceId);
  if (sharedFrom) {
    next = patchOccupant(next, sharedFrom, (o) => ({ ...o, extra: { ...o.extra, elementalVersatilityUsedTurn: state.turn } }));
  }
  next = {
    ...next,
    players: { ...next.players, [player]: { ...next.players[player], hand: next.players[player].hand.filter((h) => h.instanceId !== cardInstanceId) } },
  };

  if (isAttackJutsu(def)) {
    const p = next.players[player];
    next = { ...next, players: { ...next.players, [player]: { ...p, attackJutsuUsedThisTurn: [...p.attackJutsuUsedThisTurn, def.name] } } };
  }

  if (def.cardType === 'jutsu' || def.cardType === 'assist') {
    const itemId = `stack-${next.stack.length}-${cardInstanceId}`;
    if (def.isDamaging && enablingInstanceId) next = surfaceFromMole(next, enablingInstanceId, itemId, def.type);
    const stackCtx: HandCardContext = { ...ctx, state: next };
    return pushStackItem(next, {
      id: itemId,
      controllerId: player,
      sourceInstanceId: enablingInstanceId || `${player}-hand`,
      sourceName: def.name,
      abilityId: def.id,
      abilityName: def.name,
      targets: targetedIds(def, targetInstanceIds),
      costText: paidInSupplies ? `${cost} Supplies` : describeCost(cost, payFromPool),
      // A choosing card's units ride along here, not on the stack item (nothing can retarget or negate a choice).
      resolve: (resolveState, item) => {
        const targets = def.chooses ? targetInstanceIds : (item?.targets ?? targetInstanceIds);
        const after = def.resolve({ ...stackCtx, state: resolveState, targetInstanceIds: targets });
        // Samehada Fusion: a transformed Kisame's Ninjutsu attacks (Jutsu cards he enables included) Absorb 1.
        return def.isDamaging && def.type === 'Ninjutsu' && enablingInstanceId ? samehadaFusionAbsorb(after, enablingInstanceId, targets) : after;
      },
    });
  }

  // Terrain/Mission cards resolve (enter play) immediately, not via the stack.
  const paid = paidInSupplies ? '' : describeCost(cost, payFromPool);
  if (paid) next = appendLog(next, `${player} pays ${paid} to play ${def.cardType === 'mission' ? 'a Mission' : def.name}.`);
  return def.resolve({ ...ctx, state: next });
}
