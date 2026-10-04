import { findOccupant, isCharacter, patchCharacter } from '../board';
import { canActivateNormalSpeed, pushStackItem, describeCost } from '../stack';
import { cursingHidan, targetingSurcharge } from '../abilities';
import { appendLog, appendWarning } from '../phases/phaseMachine';
import { getHandCardDef, needsEnablingCharacter } from './registry';
import type { HandCardContext, HandCardDef } from './registry';
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

/**
 * Itachi's Uchiha Prodigy: while he's in play (and not Disabled/Retreated),
 * Quick Technique Jutsu cards he could use — styleless, or matching his
 * Styles — cost his controller 1 less (minimum 1).
 */
function uchihaProdigyApplies(state: GameState, player: PlayerId, def: HandCardDef): boolean {
  if (def.cardType !== 'jutsu' || def.speed !== 'Quick') return false;
  return state.players[player].backRow.some(
    (c) => c && c.defId === 'itachi' && !c.status.disabled && !c.status.retreated && (def.style === 'None' || c.styles.includes(def.style)),
  );
}

export function resolveCost(def: HandCardDef, ctx: HandCardContext, payFromPool: number): number {
  let cost = typeof def.cost === 'function' ? def.cost(ctx, payFromPool) : def.cost;
  if (uchihaProdigyApplies(ctx.state, ctx.player, def) && cost > 1) cost -= 1;
  return cost + targetingSurcharge(ctx.state, ctx.player, ctx.targetInstanceIds);
}

/**
 * SPEC.md §10c: playing a Jutsu card requires an in-play, un-Disabled,
 * un-Retreated character able to enable it — Style: None cards accept any
 * character; otherwise the enabler's own Styles must include the card's
 * Style. Only cards with an ability Type need one (see
 * needsEnablingCharacter) — everything else is exempt.
 */
function checkEnabler(state: GameState, player: PlayerId, def: HandCardDef, enablingInstanceId: string): Legality {
  if (!needsEnablingCharacter(def)) return { ok: true };
  const found = findOccupant(state, enablingInstanceId);
  if (!found || !isCharacter(found.occupant) || found.player !== player) {
    return { ok: false, reason: `${player} has no such character to enable ${def.name}.` };
  }
  const enabler = found.occupant;
  if (enabler.status.disabled) return { ok: false, reason: `${enabler.name} is Disabled and can't enable a card.` };
  if (enabler.status.retreated) return { ok: false, reason: `${enabler.name} is Retreated and can't enable a card.` };
  if (def.style !== 'None' && !enabler.styles.includes(def.style)) {
    return { ok: false, reason: `${enabler.name} doesn't have Style: ${def.style}, needed to enable ${def.name}.` };
  }
  const sporeUntil = enabler.extra.cannotNegateOwnDamageUntilTurn as number | undefined;
  if (def.negatesTargetingOfSelf && sporeUntil !== undefined && state.turn <= sporeUntil) {
    return { ok: false, reason: `${enabler.name} is under Spore Technique and can't negate attacks on itself.` };
  }
  return { ok: true };
}

function checkTargets(state: GameState, player: PlayerId, def: HandCardDef, targetInstanceIds: string[]): Legality {
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
  if (!def) return { ok: false, reason: `Unknown Hand Deck card: ${handEntry.defId}.` };

  const enablerCheck = checkEnabler(state, player, def, enablingInstanceId);
  if (!enablerCheck.ok) return enablerCheck;

  if (def.speed === 'Normal' && !canActivateNormalSpeed(state, player)) {
    return { ok: false, reason: `${def.name} is Normal speed — can only be played on an empty stack during your own Main/Combat Phase.` };
  }
  // Normal-speed timing: non-combat cards (Terrain, Missions, deck searches...) are Main-Phase plays; Attack-type Jutsu are Combat-only and once per turn per named card; combat-relevant immediate effects (healing) may go in either.
  if (def.speed === 'Normal') {
    const timing = normalTiming(def);
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

  const targetCheck = checkTargets(state, player, def, targetInstanceIds);
  if (!targetCheck.ok) return targetCheck;

  const ctx: HandCardContext = { state, player, enablingInstanceId, targetInstanceIds, amount };
  if (!opts.ignoreCondition && def.legalityCheck && !def.legalityCheck(ctx)) {
    return { ok: false, reason: `${def.name}'s condition isn't met.` };
  }

  const cost = resolveCost(def, ctx, payFromPool);
  const enablerPool =
    needsEnablingCharacter(def)
      ? (() => {
          const found = findOccupant(state, enablingInstanceId);
          return found && isCharacter(found.occupant) ? found.occupant.chakraPool.current : 0;
        })()
      : 0;
  const totalPool = payFromPool;
  const totalGeneric = cost - payFromPool;
  if (totalPool < 0 || totalPool > enablerPool) {
    return { ok: false, reason: `Not enough Chakra pooled in the enabling character.` };
  }
  if (totalGeneric < 0 || totalGeneric > state.players[player].genericChakraAvailable) {
    return { ok: false, reason: `Not enough generic Chakra available.` };
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
  return { ...next, players: { ...next.players, [player]: { ...p, genericChakraAvailable: p.genericChakraAvailable - (cost - payFromPool) } } };
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
  const cost = resolveCost(def, ctx, payFromPool);

  let next = payCost(state, player, enablingInstanceId, cost, payFromPool, !!opts.trust);
  next = {
    ...next,
    players: { ...next.players, [player]: { ...next.players[player], hand: next.players[player].hand.filter((h) => h.instanceId !== cardInstanceId) } },
  };

  if (isAttackJutsu(def)) {
    const p = next.players[player];
    next = { ...next, players: { ...next.players, [player]: { ...p, attackJutsuUsedThisTurn: [...p.attackJutsuUsedThisTurn, def.name] } } };
  }

  if (def.cardType === 'jutsu' || def.cardType === 'assist') {
    const stackCtx: HandCardContext = { ...ctx, state: next };
    return pushStackItem(next, {
      id: `stack-${next.stack.length}-${cardInstanceId}`,
      controllerId: player,
      sourceInstanceId: enablingInstanceId || `${player}-hand`,
      sourceName: def.name,
      abilityId: def.id,
      abilityName: def.name,
      targets: targetInstanceIds,
      costText: describeCost(cost, payFromPool),
      resolve: (resolveState, item) => def.resolve({ ...stackCtx, state: resolveState, targetInstanceIds: item?.targets ?? targetInstanceIds }),
    });
  }

  // Terrain/Mission cards resolve (enter play) immediately, not via the stack.
  const paid = describeCost(cost, payFromPool);
  if (paid) next = appendLog(next, `${player} pays ${paid} to play ${def.cardType === 'mission' ? 'a Mission' : def.name}.`);
  return def.resolve({ ...ctx, state: next });
}
