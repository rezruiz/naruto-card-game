// Prototype rules: Equipment (Design Draft — "Equipment"). An Equipment card
// from the Jutsu Deck is gear for a unit:
//
// - It costs Supplies, and is attached the moment it's played to a Leader or
//   Shinobi its controller has in play — never a token. It's never played
//   unattached.
// - A unit can hold any number of Equipment; their buffs add up, and each one
//   only counts while it's attached.
// - When its holder leaves play, the Equipment stays in play, unattached and
//   doing nothing, in its controller's Equipment area.
// - In its controller's Main Phase it can be moved to another of their Leaders
//   or Shinobi by paying its Re-equip cost in Supplies (REEQUIP).
// - It can't be discarded as Chakra (not a Jutsu or Shinobi).
//
// Health and Chakra Pool capacity buffs are written onto the holder when the
// Equipment attaches and taken off again if it moves away; Damage, damage
// reduction, healing and the defeat trigger are read live (shinobi.ts,
// combat.ts, the Upkeep Phase).
import { findOccupant, isCharacter, occupantIds, patchOccupant } from './board';
import { dealDamage, healOccupant } from './combat';
import { appendLog, appendWarning } from './phases/phaseMachine';
import { spendSupplies } from './prototype';
import { getCharacterDef } from './characters/registry';
import { getHandCardDef, registerHandCard, type EquipmentStats, type HandCardDef } from './cards/registry';
import type { BoardOccupant, EquipmentInstance, GameState, PlayerId } from './types';

const PLAYERS: PlayerId[] = ['p1', 'p2'];

export function equipmentStats(defId: string): EquipmentStats | undefined {
  return getHandCardDef(defId)?.equipment;
}

/** Every Equipment in play, both players'. */
function allEquipment(state: GameState): EquipmentInstance[] {
  return PLAYERS.flatMap((p) => state.players[p].equipment ?? []);
}

/** The Equipment attached to this unit. */
export function equipmentOn(state: GameState, holderId: string): EquipmentInstance[] {
  return allEquipment(state).filter((e) => e.holderId === holderId);
}

/** Why this unit can't hold `player`'s Equipment (null = it can): it must be a Leader or Shinobi they control, not a token. */
export function holderBlocker(state: GameState, player: PlayerId, holderId: string | undefined): string | null {
  const found = holderId ? findOccupant(state, holderId) : null;
  if (!found) return 'Choose a Leader or Shinobi to attach it to.';
  if (found.player !== player) return 'Equipment can only go on your own Leaders and Shinobi.';
  const o = found.occupant;
  if (!isCharacter(o) && o.extra.shinobi !== true) return `${o.name} is a token — Equipment can only go on a Leader or a Shinobi.`;
  return null;
}

function patchEquipment(state: GameState, owner: PlayerId, instanceId: string, patch: (e: EquipmentInstance) => EquipmentInstance): GameState {
  const p = state.players[owner];
  return { ...state, players: { ...state.players, [owner]: { ...p, equipment: (p.equipment ?? []).map((e) => (e.instanceId === instanceId ? patch(e) : e)) } } };
}

/** Puts (or takes off, sign = -1) an Equipment's Health and Pool capacity buffs on a unit in play. Taking them off never defeats it: it keeps at least 1 HP. */
function applyStatBuffs(state: GameState, holderId: string, stats: EquipmentStats, sign: 1 | -1): GameState {
  const health = (stats.health ?? 0) * sign;
  const capacity = (stats.poolCapacity ?? 0) * sign;
  if (!health && !capacity) return state;
  return patchOccupant(state, holderId, (o) => {
    let next: BoardOccupant = o;
    if (health) {
      const maxHP = Math.max(1, o.maxHP + health);
      next = { ...next, maxHP, currentHP: health > 0 ? o.currentHP + health : Math.max(1, Math.min(o.currentHP, maxHP)) };
    }
    if (capacity && o.chakraPool && Number.isFinite(o.chakraPool.capacity)) {
      const cap = Math.max(0, o.chakraPool.capacity + capacity);
      next = { ...next, chakraPool: { capacity: cap, current: Math.min(o.chakraPool.current, cap) } };
    }
    return next;
  });
}

/** Attaches an Equipment (already in its owner's Equipment area) to a unit. */
function attach(state: GameState, equip: EquipmentInstance, holderId: string): GameState {
  const stats = equipmentStats(equip.defId);
  let next = patchEquipment(state, equip.owner, equip.instanceId, (e) => ({ ...e, holderId }));
  if (stats) next = applyStatBuffs(next, holderId, stats, 1);
  return next;
}

/** Takes an Equipment off its holder (if it still has one in play), leaving it unattached. */
function detach(state: GameState, equip: EquipmentInstance): GameState {
  const stats = equipmentStats(equip.defId);
  let next = patchEquipment(state, equip.owner, equip.instanceId, (e) => ({ ...e, holderId: null }));
  if (stats && equip.holderId && findOccupant(next, equip.holderId)) next = applyStatBuffs(next, equip.holderId, stats, -1);
  return next;
}

// --- Buffs read live -----------------------------------------------------------

function holderHasSynergy(holder: BoardOccupant, synergy: string): boolean {
  return isCharacter(holder) && !!getCharacterDef(holder.defId)?.synergy?.includes(synergy);
}

/** The extra Damage this unit's Equipment gives it right now — a Shinobi's attacks, and a Leader's damage-dealing abilities and the Jutsu cards it enables. */
export function equipmentDamageBonus(state: GameState, holder: BoardOccupant): number {
  let bonus = 0;
  for (const e of equipmentOn(state, holder.instanceId)) {
    const stats = equipmentStats(e.defId);
    if (!stats) continue;
    bonus += stats.damage ?? 0;
    const cond = stats.conditionalDamage;
    if (cond && ((cond.style && isCharacter(holder) && holder.styles.includes(cond.style)) || (cond.synergy && holderHasSynergy(holder, cond.synergy)))) bonus += cond.amount;
  }
  return bonus;
}

/** How much each damage instance this unit takes is reduced by its Equipment (to a minimum of 1). */
export function equipmentDamageReduction(state: GameState, holderId: string): number {
  return equipmentOn(state, holderId).reduce((sum, e) => sum + (equipmentStats(e.defId)?.damageReduction ?? 0), 0);
}

/** Upkeep Phase: Equipment that heals its holder each turn (Medical Pouch). */
export function tickEquipmentHeals(state: GameState, player: PlayerId): GameState {
  let next = state;
  for (const e of state.players[player].equipment ?? []) {
    const heal = equipmentStats(e.defId)?.healEachTurn ?? 0;
    if (!heal || !e.holderId || !findOccupant(next, e.holderId)) continue;
    next = appendLog(next, `${getHandCardDef(e.defId)?.name}: ${findOccupant(next, e.holderId)!.occupant.name} heals ${heal}.`);
    next = healOccupant(next, e.holderId, heal);
  }
  return next;
}

/**
 * The holder was just defeated (combat.ts): its Equipment stays in play, unattached — and Equipment that
 * strikes back (Explosive Tag Vest) deals its damage to the unit whose attack made the kill.
 */
export function onHolderDefeated(state: GameState, holderId: string, killerInstanceId?: string): GameState {
  let next = state;
  for (const e of equipmentOn(state, holderId)) {
    next = detach(next, e);
    const name = getHandCardDef(e.defId)?.name ?? 'Equipment';
    const retaliation = equipmentStats(e.defId)?.defeatRetaliation ?? 0;
    const killer = killerInstanceId ? findOccupant(next, killerInstanceId)?.occupant : undefined;
    if (retaliation > 0 && killer) {
      next = appendLog(next, `${name} goes off — ${retaliation} damage to ${killer.name}.`);
      next = dealDamage(next, killer.instanceId, retaliation, { unattributed: true }).state;
    }
    next = appendLog(next, `${name} is left unattached.`);
  }
  return next;
}

/** Run after every action: Equipment whose holder has left play some other way (returned to hand, …) is left unattached. */
export function sweepEquipment(state: GameState): GameState {
  const inPlay = occupantIds(state);
  let next = state;
  for (const e of allEquipment(state)) {
    if (e.holderId && !inPlay.has(e.holderId)) next = appendLog(detach(next, e), `${getHandCardDef(e.defId)?.name ?? 'Equipment'} is left unattached.`);
  }
  return next;
}

// --- Re-equip ------------------------------------------------------------------

/** Moves an Equipment to another Leader or Shinobi its owner controls, for its Re-equip cost in Supplies — in the owner's Main Phase, on an empty stack. */
export function reequip(state: GameState, equipmentInstanceId: string, holderId: string): GameState {
  const equip = allEquipment(state).find((e) => e.instanceId === equipmentInstanceId);
  if (!equip) return appendLog(state, 'No such Equipment in play.');
  const def = getHandCardDef(equip.defId);
  const stats = def?.equipment;
  if (!def || !stats) return state;
  const relaxed = state.rules === 'trust';
  let working = state;
  const timing = state.phase !== 'Main1' && state.phase !== 'Main2' ? 'only in your Main Phase' : state.activePlayer !== equip.owner || state.stack.length > 0 ? 'only on your own turn, with nothing on the stack' : null;
  if (timing) {
    if (!relaxed) return appendLog(state, `Can't re-equip ${def.name}: ${timing}.`);
    working = appendWarning(working, `${def.name} is re-equipped outside its timing (${timing}) — allowed (trust mode).`);
  }
  const blocker = holderBlocker(working, equip.owner, holderId);
  if (blocker) return appendLog(state, `Can't re-equip ${def.name}: ${blocker}`);
  if (equip.holderId === holderId) return appendLog(state, `${def.name} is already on that unit.`);
  const paid = spendSupplies(working, equip.owner, stats.reequipCost, `re-equipping ${def.name}`);
  if (!paid) return appendLog(state, `Can't re-equip ${def.name}: not enough Supplies (${stats.reequipCost} needed).`);
  const holder = findOccupant(paid, holderId)!.occupant;
  return appendLog(attach(detach(paid, equip), { ...equip, holderId: null }, holderId), `${equip.owner} re-equips ${def.name} onto ${holder.name}.`);
}

// --- Cards ---------------------------------------------------------------------

function equipmentCard(id: string, name: string, cost: number, stats: EquipmentStats, effect: string, extra: Partial<HandCardDef> = {}): HandCardDef {
  return {
    id,
    name,
    cardType: 'equipment',
    cost,
    speed: 'Normal',
    style: 'None',
    type: 'None',
    maxTargets: 1,
    targetSide: 'ally',
    // Attaching isn't targeting (nothing can negate or redirect it).
    chooses: true,
    timing: 'main',
    equipment: stats,
    text: `Cost: ${cost} ${cost === 1 ? 'Supply' : 'Supplies'} · Re-equip: ${stats.reequipCost}\nEffect: Attach to a Leader or Shinobi you control. ${effect}`,
    legalityCheck: (ctx) => holderBlocker(ctx.state, ctx.player, ctx.targetInstanceIds[0]) === null,
    resolve: (ctx) => {
      const equip: EquipmentInstance = { instanceId: `${ctx.player}-${id}-${ctx.state.log.length}`, defId: id, owner: ctx.player, holderId: null };
      const p = ctx.state.players[ctx.player];
      let next: GameState = { ...ctx.state, players: { ...ctx.state.players, [ctx.player]: { ...p, equipment: [...(p.equipment ?? []), equip] } } };
      const holderId = ctx.targetInstanceIds[0];
      const blocker = holderBlocker(next, ctx.player, holderId);
      if (blocker) return appendLog(next, `${name} comes into play unattached — ${blocker}`);
      next = attach(next, equip, holderId);
      return appendLog(next, `${ctx.player} equips ${findOccupant(next, holderId)!.occupant.name} with ${name}.`);
    },
    ...extra,
  };
}

export const EQUIPMENT_CARDS: HandCardDef[] = [
  equipmentCard('equip-forehead-protector', 'Forehead Protector', 1, { reequipCost: 1, health: 2 }, 'The holder gets +2 Health.'),
  equipmentCard('equip-kunai-pouch', 'Kunai & Shuriken Pouch', 2, { reequipCost: 1, damage: 1 }, 'The holder gets +1 Damage.'),
  equipmentCard('equip-chakra-scroll', 'Chakra Storage Scroll', 2, { reequipCost: 1, poolCapacity: 2 }, "The holder's Chakra Pool holds 2 more (Leaders only)."),
  equipmentCard('equip-medical-pouch', 'Medical Pouch', 2, { reequipCost: 1, healEachTurn: 1 }, 'At the start of your turn (Upkeep), heal the holder 1.'),
  equipmentCard('equip-explosive-tag-vest', 'Explosive Tag Vest', 2, { reequipCost: 1, defeatRetaliation: 2 }, 'When the holder is defeated by an attack, deal 2 damage to the attacker.'),
  equipmentCard('equip-flak-vest', 'Flak Vest', 3, { reequipCost: 2, damageReduction: 1 }, 'Each time the holder takes damage, reduce it by 1 (to a minimum of 1).'),
  equipmentCard('equip-trench-knives', 'Chakra Trench Knives', 3, { reequipCost: 2, damage: 1, conditionalDamage: { style: 'Wind', amount: 1 } }, 'The holder gets +1 Damage, or +2 if it has Wind Style.'),
  equipmentCard('equip-akatsuki-cloak', 'Akatsuki Cloak', 3, { reequipCost: 2, health: 3, conditionalDamage: { synergy: 'Akatsuki', amount: 1 } }, 'Unique. The holder gets +3 Health; an Akatsuki holder also gets +1 Damage.', {
    unique: true,
    synergy: ['Akatsuki'],
  }),
];
for (const def of EQUIPMENT_CARDS) registerHandCard(def);

/** The Prototype build's starter deck carries 2 of each Equipment (1 of a Unique one). */
export const PROTOTYPE_EQUIPMENT_MANIFEST: { defId: string; copies: number }[] = EQUIPMENT_CARDS.map((d) => ({ defId: d.id, copies: d.unique ? 1 : 2 }));
