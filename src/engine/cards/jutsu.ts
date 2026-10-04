import { findOccupant, getAdjacent, isCharacter, patchCharacter } from '../board';
import { dealDamage, healOccupant } from '../combat';
import { appendLog, otherPlayer } from '../phases/phaseMachine';
import { drawCard, lookAndTakeCardType } from '../deck';
import { scheduleHeal } from '../scheduledHeals';
import { negateFirstMatchingAttack, stackItemInfo } from './negation';
import { registerHandCard } from './registry';
import type { HandCardDef } from './registry';

function isAttack(info: ReturnType<typeof stackItemInfo>): boolean {
  return !!info && info.isDamaging;
}

// --- The Substitution family --------------------------------------------

const substitution: HandCardDef = {
  id: 'substitution',
  name: 'Substitution',
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
  // "One of your characters" — like the Mission rewards, a token (e.g. a Pain Path) isn't a character.
  legalityCheck: (ctx) => {
    const found = ctx.targetInstanceIds[0] ? findOccupant(ctx.state, ctx.targetInstanceIds[0]) : undefined;
    return !!found && found.player === ctx.player && isCharacter(found.occupant);
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
  name: 'Fire Style: Fireball Jutsu',
  cardType: 'jutsu',
  cost: (_ctx, payFromPool) => (payFromPool > 0 ? 3 : 4),
  offersPoolDiscount: true,
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
]) {
  registerHandCard(def);
}
