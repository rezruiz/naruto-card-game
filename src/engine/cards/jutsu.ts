import { dealSplitDamage, SHARKS_DAMAGE } from '../characters/kisame';
import { getCharacterDef } from '../characters/registry';
import { findOccupant, getAdjacent, isCharacter, patchCharacter } from '../board';
import { absorbChakra, dealDamage, healOccupant } from '../combat';
import { appendLog, otherPlayer } from '../phases/phaseMachine';
import { drawCard, lookAndTakeCardType, lookAndTakeMatching } from '../deck';
import { applyPoison } from '../poison';
import { scheduleHeal } from '../scheduledHeals';
import { isPrototype } from '../prototype';
import { negateFirstMatchingAttack, stackItemInfo } from './negation';
import { getHandCardDef, registerHandCard } from './registry';
import type { HandCardDef } from './registry';
import type { GameState, PlayerId } from '../types';

function isAttack(info: ReturnType<typeof stackItemInfo>): boolean {
  return !!info && info.isDamaging;
}

// --- The Substitution family --------------------------------------------

const substitution: HandCardDef = {
  id: 'substitution',
  name: 'Substitution',
  usesEnabler: true,
  cardType: 'jutsu',
  negatesTargetingOfSelf: true,
  cost: (_ctx, payFromPool) => (payFromPool > 0 ? 2 : 4),
  offersPoolDiscount: true,
  speed: 'Reactive',
  style: 'None',
  type: 'Ninjutsu',
  maxTargets: 0,
  legalityCheck: (ctx) => ctx.state.stack.some((item) => item.targets.includes(ctx.enablingInstanceId) && isAttack(stackItemInfo(ctx.state, item))),
  resolve: (ctx) => negateFirstMatchingAttack(ctx.state, ctx.player, ctx.enablingInstanceId, 'Substitution', isAttack).state,
};

const lightningSubstitution: HandCardDef = {
  id: 'lightning-substitution',
  name: 'Lightning Substitution',
  cardType: 'jutsu',
  negatesTargetingOfSelf: true,
  cost: (_ctx, payFromPool) => (payFromPool > 0 ? 2 : 4),
  offersPoolDiscount: true,
  speed: 'Reactive',
  style: 'Lightning',
  type: 'Ninjutsu',
  maxTargets: 0,
  legalityCheck: (ctx) => ctx.state.stack.some((item) => item.targets.includes(ctx.enablingInstanceId) && isAttack(stackItemInfo(ctx.state, item))),
  resolve: (ctx) => {
    const { state, negated } = negateFirstMatchingAttack(ctx.state, ctx.player, ctx.enablingInstanceId, 'Lightning Substitution', isAttack);
    if (negated && stackItemInfo(ctx.state, negated)?.type === 'Taijutsu') {
      return dealDamage(state, negated.sourceInstanceId, 2).state;
    }
    return state;
  },
};

const waterSubstitution: HandCardDef = {
  id: 'water-substitution',
  name: 'Water Substitution',
  cardType: 'jutsu',
  negatesTargetingOfSelf: true,
  cost: (_ctx, payFromPool) => (payFromPool > 0 ? 1 : 3),
  offersPoolDiscount: true,
  speed: 'Reactive',
  style: 'Water',
  type: 'Ninjutsu',
  maxTargets: 0,
  legalityCheck: (ctx) => ctx.state.stack.some((item) => item.targets.includes(ctx.enablingInstanceId) && isAttack(stackItemInfo(ctx.state, item))),
  resolve: (ctx) => negateFirstMatchingAttack(ctx.state, ctx.player, ctx.enablingInstanceId, 'Water Substitution', isAttack).state,
};

// --- Deck-inspection cards ------------------------------------------------

const incomingMissionAssignment: HandCardDef = {
  id: 'incoming-mission-assignment',
  name: 'Incoming Mission Assignment',
  cardType: 'jutsu',
  cost: 0,
  speed: 'Normal',
  style: 'None',
  type: 'None',
  maxTargets: 0,
  resolve: (ctx) => lookAndTakeCardType(ctx.state, ctx.player, 6, 'mission'),
};

const battlefieldSelection: HandCardDef = {
  id: 'battlefield-selection',
  name: 'Battlefield Selection',
  cardType: 'jutsu',
  cost: 0,
  speed: 'Normal',
  style: 'None',
  type: 'None',
  maxTargets: 0,
  resolve: (ctx) => lookAndTakeCardType(ctx.state, ctx.player, 6, 'terrain'),
};

// --- Miscellaneous Jutsu ---------------------------------------------------

const chakraTransfer: HandCardDef = {
  id: 'chakra-transfer',
  name: 'Chakra Transfer',
  cardType: 'jutsu',
  cost: 0,
  speed: 'Normal',
  timing: 'either', // healing/support — Main or Combat (§4.5)
  style: 'None',
  type: 'Ninjutsu',
  maxTargets: 2,
  targetSide: 'ally',
  needsAmountChoice: true,
  amountLabel: 'Chakra to transfer (X)',
  // The player's choice is capped by the source's current Pool — resolve()
  // falls back to that same full amount if called without one (e.g. from a
  // test dispatching PLAY_HAND_CARD directly, with no amount picked).
  maxAmount: (ctx) => {
    const found = findOccupant(ctx.state, ctx.targetInstanceIds[0]);
    return found && isCharacter(found.occupant) ? found.occupant.chakraPool.current : 0;
  },
  legalityCheck: (ctx) => {
    const [a, b] = ctx.targetInstanceIds;
    if (!a || !b || a === b) return false;
    const foundA = findOccupant(ctx.state, a);
    return !!foundA && isCharacter(foundA.occupant) && foundA.occupant.chakraPool.current >= 1;
  },
  resolve: (ctx) => {
    const [a, b] = ctx.targetInstanceIds;
    const foundA = findOccupant(ctx.state, a);
    if (!foundA || !isCharacter(foundA.occupant)) return ctx.state;
    const x = Math.max(0, Math.min(ctx.amount ?? foundA.occupant.chakraPool.current, foundA.occupant.chakraPool.current));
    let state = patchCharacter(ctx.state, a, (c) => ({ ...c, chakraPool: { ...c.chakraPool, current: c.chakraPool.current - x } }));
    const foundB = findOccupant(state, b);
    if (foundB && isCharacter(foundB.occupant)) {
      const room = foundB.occupant.chakraPool.capacity - foundB.occupant.chakraPool.current;
      const added = Math.max(0, Math.min(x - 1, room));
      state = patchCharacter(state, b, (c) => ({ ...c, chakraPool: { ...c.chakraPool, current: c.chakraPool.current + added } }));
    }
    return appendLog(state, `Chakra Transfer moves ${x} Chakra, minus a 1-Chakra tax.`);
  },
};

// "Your opponent reveals 2 cards of their choice from hand. Draw 1 card."
// The reveal is a real pending decision for the OPPONENT (handReveal.ts) —
// they pick which cards; the caster sees them (log + un-redacted in hand).
const fieldIntelligence: HandCardDef = {
  id: 'field-intelligence',
  name: 'Field Intelligence',
  cardType: 'jutsu',
  cost: 1,
  speed: 'Normal',
  style: 'None',
  type: 'None',
  maxTargets: 0,
  resolve: (ctx) => {
    const opponent = otherPlayer(ctx.player);
    const count = Math.min(2, ctx.state.players[opponent].hand.length);
    let state = ctx.state;
    if (count > 0) {
      state = { ...state, players: { ...state.players, [opponent]: { ...state.players[opponent], pendingHandReveal: { requestedBy: ctx.player, count } } } };
      state = appendLog(state, `Field Intelligence: ${opponent} must reveal ${count} card(s) of their choice from hand to ${ctx.player}.`);
    } else {
      state = appendLog(state, `Field Intelligence: ${opponent} has no cards in hand to reveal.`);
    }
    return drawCard(state, ctx.player);
  },
};

const deployMedicCorps: HandCardDef = {
  id: 'deploy-medic-corps',
  name: 'Deploy Medic Corps',
  cardType: 'jutsu',
  cost: 2,
  speed: 'Normal',
  timing: 'either', // healing/support — Main or Combat (§4.5)
  style: 'None',
  type: 'Ninjutsu',
  targetSide: 'ally',
  allowRetreatedTarget: true,
  legalityCheck: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    const found = target ? findOccupant(ctx.state, target) : undefined;
    return !!found && found.occupant.status.retreated;
  },
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    const state = scheduleHeal(ctx.state, target, 1, 4, true);
    return appendLog(state, 'Deploy Medic Corps will heal its target 1 HP at the start of each of your next 4 Upkeeps.');
  },
};

const medicalChakraInfusion: HandCardDef = {
  id: 'medical-chakra-infusion',
  name: 'Medical Chakra Infusion',
  cardType: 'jutsu',
  cost: 1,
  speed: 'Normal',
  timing: 'either', // healing/support — Main or Combat (§4.5)
  style: 'None',
  type: 'Ninjutsu',
  targetSide: 'ally',
  prototypeText: 'Style: None, Type: Ninjutsu\nCost: 1 Chakra.\nEffect: Heal 2 HP to one of your Leaders or Shinobi (cannot exceed max HP).',
  // "One of your characters" — like the Mission rewards, a token (e.g. a Pain Path) isn't a character. Prototype rules: a Shinobi counts.
  legalityCheck: (ctx) => {
    const found = ctx.targetInstanceIds[0] ? findOccupant(ctx.state, ctx.targetInstanceIds[0]) : undefined;
    return !!found && found.player === ctx.player && (isCharacter(found.occupant) || found.occupant.extra.shinobi === true);
  },
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    return target ? healOccupant(appendLog(ctx.state, 'Medical Chakra Infusion heals 2 HP.'), target, 2) : ctx.state;
  },
};

// "Until its controller's next turn" is read as THROUGH that turn (the
// Kakuzu-revival-stun convention) — enemies only pool on their own turn, so a lock
// that ended as their turn began would do nothing when cast on yours.
const chakraSuppression: HandCardDef = {
  id: 'chakra-suppression',
  name: 'Chakra Suppression',
  cardType: 'jutsu',
  cost: 2,
  speed: 'Quick',
  style: 'None',
  type: 'Sealing',
  targetSide: 'enemy',
  legalityCheck: (ctx) => {
    const found = ctx.targetInstanceIds[0] ? findOccupant(ctx.state, ctx.targetInstanceIds[0]) : undefined;
    return !!found && found.player !== ctx.player && isCharacter(found.occupant);
  },
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    const found = target ? findOccupant(ctx.state, target) : undefined;
    if (!found || !isCharacter(found.occupant)) return ctx.state;
    const until = ctx.state.activePlayer === found.player ? ctx.state.turn + 2 : ctx.state.turn + 1;
    const state = patchCharacter(ctx.state, found.occupant.instanceId, (c) => ({ ...c, extra: { ...c.extra, poolLockedUntilTurn: until } }));
    return appendLog(state, `Chakra Suppression: ${found.occupant.name} can't be pooled into through its controller's next turn.`);
  },
};

// Unlike the Substitution family, this isn't scoped to the enabling
// character — it can negate any qualifying enemy attack on the board.
const jutsuDisruption: HandCardDef = {
  id: 'jutsu-disruption',
  name: 'Jutsu Disruption',
  cardType: 'jutsu',
  cost: 2,
  speed: 'Reactive',
  style: 'None',
  type: 'Ninjutsu',
  targetSide: 'any',
  legalityCheck: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return false;
    return ctx.state.stack.some((item) => {
      if (!item.targets.includes(target)) return false;
      const info = stackItemInfo(ctx.state, item);
      return !!info && info.isDamaging && info.type === 'Ninjutsu' && !info.isUltimate && !info.isForbidden;
    });
  },
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    return negateFirstMatchingAttack(
      ctx.state,
      ctx.player,
      target,
      'Jutsu Disruption',
      (info) => info.isDamaging && info.type === 'Ninjutsu' && !info.isUltimate && !info.isForbidden,
    ).state;
  },
};

const explosiveTag: HandCardDef = {
  id: 'explosive-tag',
  name: 'Explosive Tag',
  cardType: 'jutsu',
  cost: 1,
  speed: 'Normal',
  style: 'None',
  type: 'Bukijutsu',
  isDamaging: true,
  maxTargets: 2,
  legalityCheck: (ctx) => {
    const [primary, secondary] = ctx.targetInstanceIds;
    if (!primary) return false;
    if (!secondary) return true; // the 2nd hit is optional (adjacency isn't always available)
    const found = findOccupant(ctx.state, primary);
    if (!found) return false;
    const adj = getAdjacent(ctx.state, found.player, found.zone, found.index);
    return [adj.left, adj.right, adj.front, adj.back].some((o) => o?.instanceId === secondary);
  },
  resolve: (ctx) => {
    const [primary, secondary] = ctx.targetInstanceIds;
    if (!primary) return ctx.state;
    let state = dealDamage(ctx.state, primary, 1).state;
    if (secondary) state = dealDamage(state, secondary, 1).state;
    return state;
  },
};

// The first target is the primary (3 damage); up to 2 more targets, each
// adjacent to it (front/behind/left/right, §9), take 1. Same adjacency
// reading as Explosive Tag.
const fireballJutsu: HandCardDef = {
  id: 'fireball-jutsu',
  name: 'Fireball Jutsu',
  cardType: 'jutsu',
  cost: 3,
  speed: 'Normal',
  style: 'Fire',
  type: 'Ninjutsu',
  isDamaging: true,
  maxTargets: 3,
  legalityCheck: (ctx) => {
    const [primary, ...splash] = ctx.targetInstanceIds;
    if (!primary || new Set(ctx.targetInstanceIds).size !== ctx.targetInstanceIds.length) return false;
    const found = findOccupant(ctx.state, primary);
    if (!found) return false;
    const adj = getAdjacent(ctx.state, found.player, found.zone, found.index);
    const adjacentIds = [adj.left, adj.right, adj.front, adj.back].map((o) => o?.instanceId);
    return splash.every((id) => adjacentIds.includes(id));
  },
  resolve: (ctx) => {
    const [primary, ...splash] = ctx.targetInstanceIds;
    if (!primary) return ctx.state;
    let state = dealDamage(ctx.state, primary, 3).state;
    for (const id of splash) state = dealDamage(state, id, 1).state;
    return state;
  },
};

// Kakuzu's mask techniques as Jutsu cards. Their ids are prefixed so they
// never collide with his own abilities of the same names (the stack looks up
// an enabler's ability by id before it looks for a card).
const pressureDamageCard: HandCardDef = {
  id: 'jutsu-pressure-damage',
  name: 'Pressure Damage',
  cardType: 'jutsu',
  cost: 4,
  speed: 'Normal',
  style: 'Wind',
  type: 'Ninjutsu',
  isDamaging: true,
  maxTargets: 2,
  targetSide: 'enemy',
  legalityCheck: (ctx) => ctx.targetInstanceIds.length >= 1 && new Set(ctx.targetInstanceIds).size === ctx.targetInstanceIds.length,
  resolve: (ctx) => {
    let state = ctx.state;
    for (const target of ctx.targetInstanceIds.slice(0, 2)) state = dealDamage(state, target, 3).state;
    return state;
  },
};

const searingMigraineCard: HandCardDef = {
  id: 'jutsu-searing-migraine',
  name: 'Searing Migraine',
  cardType: 'jutsu',
  cost: 3,
  speed: 'Normal',
  style: 'Fire',
  type: 'Ninjutsu',
  isDamaging: true,
  targetSide: 'enemy',
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    return target ? dealDamage(ctx.state, target, 4).state : ctx.state;
  },
};

const falseDarknessCard: HandCardDef = {
  id: 'jutsu-false-darkness',
  name: 'False Darkness',
  cardType: 'jutsu',
  cost: 2,
  speed: 'Quick',
  style: 'Lightning',
  type: 'Ninjutsu',
  isDamaging: true,
  targetSide: 'enemy',
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    return target ? dealDamage(ctx.state, target, 2).state : ctx.state;
  },
};

// --- Jutsu batch 2 (2026-10-19) ---------------------------------------------

/** Ninjutsu and Physical (Taijutsu/Bukijutsu) attacks — what a physical block can stop; never Genjutsu (§9). */
function isNinjutsuOrPhysicalAttack(info: ReturnType<typeof stackItemInfo>): boolean {
  return !!info && info.isDamaging && (info.type === 'Ninjutsu' || info.type === 'Taijutsu' || info.type === 'Bukijutsu');
}

/** The first enemy attack waiting on the stack, aimed at `protectedId`, that a physical block can stop. */
function blockableAttackOn(state: GameState, player: PlayerId, protectedId: string) {
  return state.stack.find((item) => item.controllerId !== player && item.targets.includes(protectedId) && isNinjutsuOrPhysicalAttack(stackItemInfo(state, item)));
}

/**
 * "Prevent N of its damage": the waiting attack still targets and resolves,
 * it just deals N less to that character (combat.ts reads damageAdjust).
 * Two preventions on the same attack add up.
 */
function preventAttackDamage(state: GameState, player: PlayerId, protectedId: string, amount: number, cardName: string): GameState {
  const item = blockableAttackOn(state, player, protectedId);
  if (!item) return appendLog(state, `${cardName} finds no attack left to block.`);
  const current = item.damageAdjust?.[protectedId] ?? {};
  const damageAdjust = { ...(item.damageAdjust ?? {}), [protectedId]: { ...current, reduceBy: (current.reduceBy ?? 0) + amount } };
  const stack = state.stack.map((it) => (it.id === item.id ? { ...it, damageAdjust } : it));
  const name = findOccupant(state, protectedId)?.occupant.name ?? 'its target';
  return appendLog({ ...state, stack }, `${cardName} will prevent ${amount} of ${item.abilityName}'s damage to ${name}.`);
}

const mudWall: HandCardDef = {
  id: 'mud-wall',
  name: 'Earth Style: Mud Wall',
  cardType: 'jutsu',
  cost: (_ctx, payFromPool) => (payFromPool > 0 ? 1 : 2),
  offersPoolDiscount: true,
  speed: 'Reactive',
  style: 'Earth',
  type: 'Ninjutsu',
  targetSide: 'ally',
  // "A character you control" — a token isn't a character.
  legalityCheck: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    const found = target ? findOccupant(ctx.state, target) : undefined;
    return !!found && found.player === ctx.player && isCharacter(found.occupant) && !!blockableAttackOn(ctx.state, ctx.player, target);
  },
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    return target ? preventAttackDamage(ctx.state, ctx.player, target, 2, 'Earth Style: Mud Wall') : ctx.state;
  },
};

// Prevention, not negation — so Spore Technique (which only blocks negating
// your own targeting) doesn't stop it.
const kunaiDeflection: HandCardDef = {
  id: 'kunai-deflection',
  name: 'Kunai Deflection',
  usesEnabler: true,
  cardType: 'jutsu',
  cost: (_ctx, payFromPool) => (payFromPool > 0 ? 1 : 2),
  offersPoolDiscount: true,
  speed: 'Reactive',
  style: 'None',
  type: 'Taijutsu',
  maxTargets: 0,
  legalityCheck: (ctx) => !!blockableAttackOn(ctx.state, ctx.player, ctx.enablingInstanceId),
  resolve: (ctx) => preventAttackDamage(ctx.state, ctx.player, ctx.enablingInstanceId, 1, 'Kunai Deflection'),
};

const waterSharkBullet: HandCardDef = {
  id: 'water-shark-bullet',
  name: 'Water Style: Water Shark Bullet',
  cardType: 'jutsu',
  cost: 3,
  speed: 'Normal',
  style: 'Water',
  type: 'Ninjutsu',
  isDamaging: true,
  targetSide: 'enemy',
  // "Deal 2 damage, Absorb 1" — independent clauses (§6.8a): the enabler gains 1 even if the target has nothing pooled.
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    const state = dealDamage(ctx.state, target, 2).state;
    return absorbChakra(state, ctx.enablingInstanceId, target, 1);
  },
};

// Chooses (doesn't target) its up-to-3 enemy units — Characters or Tokens —
// so nothing can negate or redirect any of the hits (§9).
const greatBreakthrough: HandCardDef = {
  id: 'great-breakthrough',
  name: 'Wind Style: Great Breakthrough',
  cardType: 'jutsu',
  cost: 2,
  speed: 'Normal',
  style: 'Wind',
  type: 'Ninjutsu',
  isDamaging: true,
  chooses: true,
  maxTargets: 3,
  targetSide: 'enemy',
  legalityCheck: (ctx) => ctx.targetInstanceIds.length >= 1 && new Set(ctx.targetInstanceIds).size === ctx.targetInstanceIds.length,
  resolve: (ctx) => {
    let state = ctx.state;
    for (const unit of ctx.targetInstanceIds.slice(0, 3)) state = dealDamage(state, unit, 1).state;
    return state;
  },
};

/** Finishing Blow's condition: an enemy character at half its max HP or less (rounded down). */
function finishable(state: GameState, player: PlayerId, instanceId: string | undefined) {
  const found = instanceId ? findOccupant(state, instanceId) : undefined;
  if (!found || found.player === player || !isCharacter(found.occupant)) return undefined;
  return found.occupant.currentHP <= Math.floor(found.occupant.maxHP / 2) ? found.occupant : undefined;
}

const finishingBlow: HandCardDef = {
  id: 'finishing-blow',
  name: 'Finishing Blow',
  cardType: 'jutsu',
  cost: 2,
  speed: 'Normal',
  style: 'None',
  type: 'Taijutsu',
  isDamaging: true,
  targetSide: 'enemy',
  legalityCheck: (ctx) => !!finishable(ctx.state, ctx.player, ctx.targetInstanceIds[0]),
  // Re-checked on resolution: a target healed above half its max HP in the meantime is no longer a legal target.
  resolve: (ctx) => {
    const target = finishable(ctx.state, ctx.player, ctx.targetInstanceIds[0]);
    if (!target) return appendLog(ctx.state, 'Finishing Blow fizzles — its target is no longer at half its max HP or less.');
    return dealDamage(ctx.state, target.instanceId, target.currentHP <= 3 ? 3 : 2).state;
  },
};

const senbonVolley: HandCardDef = {
  id: 'senbon-volley',
  name: 'Senbon Volley',
  cardType: 'jutsu',
  cost: 2,
  speed: 'Normal',
  style: 'None',
  type: 'Bukijutsu',
  isDamaging: true,
  targetSide: 'enemy',
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    const state = dealDamage(ctx.state, target, 2).state;
    const enabler = findOccupant(state, ctx.enablingInstanceId);
    const poisonUser = !!enabler && isCharacter(enabler.occupant) && enabler.occupant.styles.includes('Poison');
    return poisonUser && findOccupant(state, target) ? applyPoison(state, target, 1) : state;
  },
};

// "Jutsu card" includes Assist cards (a Jutsu sub-category, §10c); a Style:
// None card never counts as a match.
const scrollOfTechniques: HandCardDef = {
  id: 'scroll-of-techniques',
  name: 'Scroll of Techniques',
  cardType: 'jutsu',
  cost: 1,
  speed: 'Normal',
  style: 'None',
  type: 'None',
  maxTargets: 0,
  resolve: (ctx) => {
    const styles = new Set(ctx.state.players[ctx.player].backRow.flatMap((c) => c?.styles ?? []));
    return lookAndTakeMatching(ctx.state, ctx.player, 3, 'Style-matching Jutsu', (card) => {
      const def = getHandCardDef(card.defId);
      return !!def && (def.cardType === 'jutsu' || def.cardType === 'assist') && def.style !== 'None' && styles.has(def.style);
    });
  },
};

// Chooses (doesn't target) a Retreated enemy — the explicit exception to
// Retreat immunity (§6.5b), like Deploy Medic Corps. Nothing can stop the choice.
const smokeOut: HandCardDef = {
  id: 'smoke-out',
  name: 'Smoke Out',
  cardType: 'jutsu',
  cost: 4,
  speed: 'Normal',
  style: 'None',
  type: 'None',
  chooses: true,
  targetSide: 'enemy',
  allowRetreatedTarget: true,
  legalityCheck: (ctx) => {
    const found = ctx.targetInstanceIds[0] ? findOccupant(ctx.state, ctx.targetInstanceIds[0]) : undefined;
    return !!found && found.player !== ctx.player && isCharacter(found.occupant) && found.occupant.status.retreated;
  },
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    const found = target ? findOccupant(ctx.state, target) : undefined;
    if (!found || !isCharacter(found.occupant) || !found.occupant.status.retreated) return appendLog(ctx.state, 'Smoke Out finds no Retreated character to force out.');
    // Returning from Retreat counts as entering play for Field Orientation (§6.6).
    const state = patchCharacter(ctx.state, found.occupant.instanceId, (c) => ({ ...c, status: { ...c.status, retreated: false, enteredTurn: ctx.state.turn } }));
    return appendLog(state, `Smoke Out forces ${found.occupant.name} out of Retreat.`);
  },
};

// The extra draw is an additional cost the player opts into when playing it
// (amount 1 = pay 2 more Chakra and draw a second card).
const reconnaissance: HandCardDef = {
  id: 'reconnaissance',
  name: 'Reconnaissance',
  cardType: 'jutsu',
  cost: (ctx) => (ctx.amount ? 3 : 1),
  speed: 'Normal',
  style: 'None',
  type: 'None',
  maxTargets: 0,
  needsAmountChoice: true,
  amountLabel: 'Pay 2 more Chakra to draw a 2nd card (1 = yes)',
  maxAmount: () => 1,
  resolve: (ctx) => {
    const state = drawCard(ctx.state, ctx.player);
    return ctx.amount ? drawCard(state, ctx.player) : state;
  },
};

// "1+X: deal X (max 5); paying from the Pool, the cost is just X" — the
// Substitution-family Pool discount, scaled by the X the player picks.
// Prototype rules: X always comes from the Pool, so there's no discount left to offer.
const waterDragonJutsu: HandCardDef = {
  id: 'water-dragon-jutsu',
  name: 'Water Dragon Jutsu',
  cardType: 'jutsu',
  cost: (ctx, payFromPool) => {
    const x = Math.max(1, Math.min(5, ctx.amount ?? 1));
    return payFromPool > 0 && !isPrototype(ctx.state) ? x : 1 + x;
  },
  poolX: (ctx) => Math.max(1, Math.min(5, ctx.amount ?? 1)),
  prototypeText: "Style: Water, Type: Ninjutsu\nCost: 1 + X Chakra.\nEffect: Pay X from the enabling character's Pool. Deal X damage to an enemy character (X is at most 5).",
  offersPoolDiscount: true,
  speed: 'Normal',
  style: 'Water',
  type: 'Ninjutsu',
  isDamaging: true,
  targetSide: 'enemy',
  needsAmountChoice: true,
  amountLabel: 'Damage (X, max 5)',
  maxAmount: () => 5,
  legalityCheck: (ctx) => {
    const found = ctx.targetInstanceIds[0] ? findOccupant(ctx.state, ctx.targetInstanceIds[0]) : undefined;
    return !!found && found.player !== ctx.player && isCharacter(found.occupant);
  },
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    const x = Math.max(1, Math.min(5, ctx.amount ?? 1));
    return target ? dealDamage(ctx.state, target, x).state : ctx.state;
  },
};

// --- Itachi's Genjutsu (moved off his card) -----------------------------------

/** A Genjutsu user: a character with at least one Genjutsu-Type ability. */
function isGenjutsuUser(state: GameState, instanceId: string): boolean {
  const found = instanceId ? findOccupant(state, instanceId) : undefined;
  if (!found || !isCharacter(found.occupant)) return false;
  const def = getCharacterDef(found.occupant.defId);
  return !!def && [...def.abilities, ...(def.ultimate ? [def.ultimate] : [])].some((a) => a.type === 'Genjutsu');
}

// Stuns for the target's controller's turn only: cast on your turn, through
// their next turn; cast on theirs (it's Quick), the rest of that turn.
const mindPrisonCard: HandCardDef = {
  id: 'jutsu-mind-prison',
  name: 'Genjutsu: Mind Prison',
  usesEnabler: true,
  cardType: 'jutsu',
  cost: (ctx) => (isGenjutsuUser(ctx.state, ctx.enablingInstanceId) ? 3 : 5),
  speed: 'Quick',
  style: 'None',
  type: 'Genjutsu',
  targetSide: 'enemy',
  legalityCheck: (ctx) => {
    const found = ctx.targetInstanceIds[0] ? findOccupant(ctx.state, ctx.targetInstanceIds[0]) : undefined;
    return !!found && found.player !== ctx.player && isCharacter(found.occupant);
  },
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    const found = target ? findOccupant(ctx.state, target) : undefined;
    if (!found || !isCharacter(found.occupant)) return ctx.state;
    const until = found.player === ctx.state.activePlayer ? ctx.state.turn : ctx.state.turn + 1;
    const state = patchCharacter(ctx.state, found.occupant.instanceId, (c) => ({ ...c, extra: { ...c.extra, stunnedUntilTurn: until } }));
    return appendLog(state, `Mind Prison stuns ${found.occupant.name} for its controller's turn — no abilities, pooling or Jutsu cards.`);
  },
};

// Itachi only. Every attack waiting to target him loses him as a target, and
// for the rest of the turn he can't be targeted or take new damage.
const crowCloneCard: HandCardDef = {
  id: 'jutsu-crow-clone',
  name: 'Genjutsu: Crow Clone',
  usesEnabler: true,
  cardType: 'jutsu',
  cost: 2,
  speed: 'Quick',
  style: 'None',
  type: 'Genjutsu',
  maxTargets: 0,
  negatesTargetingOfSelf: true,
  requiresSharingan: true,
  // Condition: the enabling character has Sharingan (a Style tag — Itachi has it).
  legalityCheck: (ctx) => {
    const enabler = findOccupant(ctx.state, ctx.enablingInstanceId)?.occupant;
    return !!enabler && isCharacter(enabler) && enabler.styles.includes('Sharingan');
  },
  resolve: (ctx) => {
    const userId = ctx.enablingInstanceId;
    const user = findOccupant(ctx.state, userId);
    if (!user) return ctx.state;
    const stack = ctx.state.stack
      .map((item) => (item.targets.includes(userId) ? { ...item, targets: item.targets.filter((t) => t !== userId) } : item))
      .filter((item) => !(item.targets.length === 0 && ctx.state.stack.find((o) => o.id === item.id)!.targets.includes(userId)));
    const state = patchCharacter({ ...ctx.state, stack }, userId, (c) => ({ ...c, extra: { ...c.extra, phasedOutTurn: ctx.state.turn } }));
    return appendLog(state, `${user.occupant.name} phases out — Crow Clone: no targeting of it and no new damage to it for the rest of this turn.`);
  },
};

// The card version of Kisame's ability (he also has it at 8). 4 damage split
// however the player likes (dealSplitDamage, kisame.ts). Samehada Fusion: a
// transformed Kisame enabling it deals 1 more.
function sharksEnabledByTransformedKisame(state: GameState, enablerId: string): boolean {
  const e = enablerId ? findOccupant(state, enablerId)?.occupant : undefined;
  return !!e && e.defId === 'kisame' && e.extra.transformed === true;
}
const thousandHungrySharks: HandCardDef = {
  id: 'jutsu-thousand-hungry-sharks',
  name: 'Water Style: Thousand Hungry Sharks',
  cardType: 'jutsu',
  cost: 6,
  speed: 'Normal',
  style: 'Water',
  type: 'Ninjutsu',
  isDamaging: true,
  targetSide: 'enemy',
  maxTargets: SHARKS_DAMAGE,
  legalityCheck: (ctx) => ctx.targetInstanceIds.length >= 1,
  resolve: (ctx) => {
    const picks = ctx.targetInstanceIds.slice(0, SHARKS_DAMAGE + 1);
    return dealSplitDamage(ctx.state, picks, SHARKS_DAMAGE + (sharksEnabledByTransformedKisame(ctx.state, ctx.enablingInstanceId) ? 1 : 0));
  },
};

// Through the end of the target's controller's next turn (cast on your turn,
// that's their coming turn; cast on theirs, it's Quick, through their following
// one): its abilities and the Jutsu cards it enables cost 1 more (abilities.ts /
// playHandCard.ts read addedWeightUntilTurn).
const addedWeightRock: HandCardDef = {
  id: 'jutsu-added-weight-rock',
  name: 'Earth Style: Added Weight Rock Technique',
  cardType: 'jutsu',
  cost: 2,
  speed: 'Quick',
  style: 'Earth',
  type: 'Ninjutsu',
  targetSide: 'enemy',
  legalityCheck: (ctx) => {
    const found = ctx.targetInstanceIds[0] ? findOccupant(ctx.state, ctx.targetInstanceIds[0]) : undefined;
    return !!found && found.player !== ctx.player && isCharacter(found.occupant);
  },
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    const found = target ? findOccupant(ctx.state, target) : undefined;
    if (!found || !isCharacter(found.occupant)) return ctx.state;
    const until = ctx.state.activePlayer === found.player ? ctx.state.turn + 2 : ctx.state.turn + 1;
    const state = patchCharacter(ctx.state, found.occupant.instanceId, (c) => ({ ...c, extra: { ...c.extra, addedWeightUntilTurn: until } }));
    return appendLog(state, `Added Weight Rock Technique: ${found.occupant.name}'s abilities and the Jutsu cards it enables cost 1 more through its controller's next turn.`);
  },
};

// 1 damage to the target and to each enemy unit beside it in its row (left/right,
// not across rows); the characters hit can't Retreat through their controller's
// next turn (retreat.ts reads retreatLockedUntilTurn).
const earthFlowRiver: HandCardDef = {
  id: 'jutsu-earth-flow-river',
  name: 'Earth Style: Earth Flow River',
  cardType: 'jutsu',
  cost: 3,
  speed: 'Normal',
  style: 'Earth',
  type: 'Ninjutsu',
  isDamaging: true,
  targetSide: 'enemy',
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    const found = target ? findOccupant(ctx.state, target) : undefined;
    if (!found) return ctx.state;
    const adj = getAdjacent(ctx.state, found.player, found.zone, found.index);
    const hit = [found.occupant.instanceId, ...[adj.left, adj.right].filter((o) => o !== null).map((o) => o!.instanceId)];
    const until = ctx.state.activePlayer === found.player ? ctx.state.turn + 2 : ctx.state.turn + 1;
    let state = appendLog(ctx.state, 'Earth Flow River turns the ground to mud.');
    for (const id of hit) {
      if (findOccupant(state, id)) state = dealDamage(state, id, 1).state;
      const still = findOccupant(state, id);
      if (still && isCharacter(still.occupant)) {
        state = patchCharacter(state, id, (c) => ({ ...c, extra: { ...c.extra, retreatLockedUntilTurn: Math.max(until, (c.extra.retreatLockedUntilTurn as number | undefined) ?? -1) } }));
      }
    }
    return state;
  },
};

// 3 damage split between 1 or 2 enemy units adjacent to each other (front/
// behind/left/right, §9). With 2 targets the player picks how much the first
// takes (0–3, §9 Split damage: 0 is allowed); the second takes the rest.
const PHOENIX_FLOWER_DAMAGE = 3;
const phoenixFlower: HandCardDef = {
  id: 'jutsu-phoenix-flower',
  name: 'Fire Style: Phoenix Flower',
  cardType: 'jutsu',
  cost: 3,
  speed: 'Normal',
  style: 'Fire',
  type: 'Ninjutsu',
  isDamaging: true,
  targetSide: 'enemy',
  maxTargets: 2,
  needsAmountChoice: (targets) => targets.length === 2,
  amountLabel: 'Damage to the first target (the second takes the rest)',
  maxAmount: () => PHOENIX_FLOWER_DAMAGE,
  legalityCheck: (ctx) => {
    const [first, second] = ctx.targetInstanceIds;
    if (!first) return false;
    if (!second) return true;
    if (second === first) return false;
    const found = findOccupant(ctx.state, first);
    if (!found) return false;
    const adj = getAdjacent(ctx.state, found.player, found.zone, found.index);
    return [adj.left, adj.right, adj.front, adj.back].some((o) => o?.instanceId === second);
  },
  resolve: (ctx) => {
    const [first, second] = ctx.targetInstanceIds;
    if (!first) return ctx.state;
    const toFirst = second ? Math.max(0, Math.min(PHOENIX_FLOWER_DAMAGE, ctx.amount ?? 2)) : PHOENIX_FLOWER_DAMAGE;
    let state = ctx.state;
    if (toFirst > 0 && findOccupant(state, first)) state = dealDamage(state, first, toFirst).state;
    if (second && PHOENIX_FLOWER_DAMAGE - toFirst > 0 && findOccupant(state, second)) state = dealDamage(state, second, PHOENIX_FLOWER_DAMAGE - toFirst).state;
    return state;
  },
};

// 3 / 2 / 1 down a line: the target, the unit adjacent to it in the direction
// the player picks (the 2nd pick, front/behind/left/right, §9), then the next
// unit on in that same direction. The line is fixed before any damage lands and
// stops at the first empty space or edge. With no adjacent unit, the 2nd pick is
// skipped; when one exists it's required.
type Direction = 'left' | 'right' | 'front' | 'back';
function dragonFireLine(state: GameState, first: string, second: string | undefined): string[] | null {
  const a = findOccupant(state, first);
  if (!a) return null;
  const adj = getAdjacent(state, a.player, a.zone, a.index);
  const dirs: Direction[] = ['left', 'right', 'front', 'back'];
  if (!second) return dirs.some((d) => adj[d]) ? null : [first];
  const dir = dirs.find((d) => adj[d]?.instanceId === second);
  if (!dir) return null;
  const b = findOccupant(state, second)!;
  const third = getAdjacent(state, b.player, b.zone, b.index)[dir];
  return third ? [first, second, third.instanceId] : [first, second];
}
const dragonFire: HandCardDef = {
  id: 'jutsu-dragon-fire',
  name: 'Fire Style: Dragon Fire Technique',
  cardType: 'jutsu',
  cost: 4,
  speed: 'Normal',
  style: 'Fire',
  type: 'Ninjutsu',
  isDamaging: true,
  targetSide: 'enemy',
  maxTargets: 2,
  legalityCheck: (ctx) => !!ctx.targetInstanceIds[0] && dragonFireLine(ctx.state, ctx.targetInstanceIds[0], ctx.targetInstanceIds[1]) !== null,
  resolve: (ctx) => {
    const [first, second] = ctx.targetInstanceIds;
    const line = first ? dragonFireLine(ctx.state, first, second) : null;
    if (!line) return ctx.state;
    let state = ctx.state;
    line.forEach((id, i) => {
      if (findOccupant(state, id)) state = dealDamage(state, id, 3 - i).state;
    });
    return state;
  },
};

// Wind Style "bullets": X is the number of picks (1 to maxX), and each pick is
// its own instance of damage — picking a unit twice hits it twice (reduction
// applies to each hit). Cost: base + X.
function windBullets(id: string, name: string, base: number, perHit: number, maxX: number): HandCardDef {
  return {
    id,
    name,
    cardType: 'jutsu',
    cost: (ctx) => base + Math.max(1, Math.min(maxX, ctx.targetInstanceIds.length)),
    poolX: (ctx) => Math.max(1, Math.min(maxX, ctx.targetInstanceIds.length)),
    prototypeText: `Style: Wind, Type: Ninjutsu\nCost: ${base} + X Chakra (X is at most ${maxX}).\nEffect: Pay X from the enabling character's Pool. X times, deal ${perHit} damage to target enemy unit. You may choose the same unit more than once.`,
    speed: 'Normal',
    style: 'Wind',
    type: 'Ninjutsu',
    isDamaging: true,
    targetSide: 'enemy',
    maxTargets: maxX,
    legalityCheck: (ctx) => ctx.targetInstanceIds.length >= 1 && ctx.targetInstanceIds.length <= maxX,
    resolve: (ctx) => {
      let state = ctx.state;
      for (const target of ctx.targetInstanceIds.slice(0, maxX)) {
        if (findOccupant(state, target)) state = dealDamage(state, target, perHit).state;
      }
      return state;
    },
  };
}
const vacuumBullets = windBullets('jutsu-vacuum-bullets', 'Wind Style: Vacuum Bullets', 3, 2, 3);
const airBullets = windBullets('jutsu-air-bullets', 'Wind Style: Air Bullets', 1, 1, 4);

// The enabler can't be targeted through the end of its controller's next turn
// (board.ts isHidingLikeAMole). Activating an attack ends it on the spot, and a
// Taijutsu attack gets +2 (board.ts surfaceFromMole, combat.ts).
const hidingLikeAMole: HandCardDef = {
  id: 'jutsu-hiding-like-a-mole',
  name: 'Earth Style: Hiding Like a Mole Technique',
  cardType: 'jutsu',
  cost: 4,
  speed: 'Normal',
  style: 'Earth',
  type: 'Ninjutsu',
  maxTargets: 0,
  resolve: (ctx) => {
    const found = ctx.enablingInstanceId ? findOccupant(ctx.state, ctx.enablingInstanceId) : undefined;
    if (!found || !isCharacter(found.occupant)) return ctx.state;
    const until = ctx.state.activePlayer === found.player ? ctx.state.turn + 2 : ctx.state.turn + 1;
    const state = patchCharacter(ctx.state, found.occupant.instanceId, (c) => ({ ...c, extra: { ...c.extra, moleHiddenUntilTurn: until, moleBonusItem: undefined } }));
    return appendLog(state, `${found.occupant.name} burrows underground (Hiding Like a Mole): it can't be targeted through turn ${until}.`);
  },
};

for (const def of [
  substitution,
  lightningSubstitution,
  waterSubstitution,
  incomingMissionAssignment,
  battlefieldSelection,
  chakraTransfer,
  fieldIntelligence,
  deployMedicCorps,
  medicalChakraInfusion,
  chakraSuppression,
  jutsuDisruption,
  explosiveTag,
  fireballJutsu,
  pressureDamageCard,
  searingMigraineCard,
  falseDarknessCard,
  mudWall,
  kunaiDeflection,
  waterSharkBullet,
  greatBreakthrough,
  finishingBlow,
  senbonVolley,
  scrollOfTechniques,
  smokeOut,
  reconnaissance,
  waterDragonJutsu,
  mindPrisonCard,
  crowCloneCard,
  thousandHungrySharks,
  addedWeightRock,
  earthFlowRiver,
  phoenixFlower,
  dragonFire,
  vacuumBullets,
  airBullets,
  hidingLikeAMole,
]) {
  registerHandCard(def);
}
