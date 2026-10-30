// Prototype rules: Equipment (Design Draft — "Equipment"). An Equipment card
// from the Jutsu Deck is gear for a unit:
//
// - It costs Supplies, and is attached the moment it's played to a Shinobi its
//   controller has in play — never a Leader or a token. It's never played
//   unattached.
// - A unit can hold any number of Equipment; their buffs add up, and each one
//   only counts while it's attached.
// - It has one cost, paid as it enters play onto its holder. It never moves.
// - When its holder is defeated (or leaves play any other way), the Equipment
//   goes to its owner's discard pile.
// - It can't be discarded as Chakra (not a Jutsu or Shinobi).
//
// Health and Chakra Pool capacity buffs are written onto the holder when the
// Equipment attaches; Damage, damage reduction, healing and the defeat trigger
// are read live (shinobi.ts, combat.ts, the Upkeep Phase).
import { findOccupant, isCharacter, occupantIds, patchOccupant } from './board';
import { dealDamage, healOccupant } from './combat';
import { appendLog } from './phases/phaseMachine';
import { spendSupplies, suppliesAvailable } from './prototype';
import { enqueueChoice, registerChoiceResolver } from './choices';
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

/**
 * Why this unit can't hold `player`'s Equipment `defId` (null = it can): it must be a Shinobi they control — not a
 * token, and not a Leader unless the card says so (EquipmentStats.leaderHolder, e.g. Chakra Storage Scroll).
 */
export function holderBlocker(state: GameState, player: PlayerId, holderId: string | undefined, defId?: string): string | null {
  const leaders = !!(defId && equipmentStats(defId)?.leaderHolder);
  const allowed = leaders ? 'a Leader or Shinobi' : 'a Shinobi';
  const found = holderId ? findOccupant(state, holderId) : null;
  if (!found) return `Choose ${allowed} to attach it to.`;
  if (found.player !== player) return `Equipment can only go on your own ${leaders ? 'Leaders and Shinobi' : 'Shinobi'}.`;
  const o = found.occupant;
  const isLeader = isCharacter(o) || o.extra.painPath === true;
  if (o.extra.shinobi !== true && !(leaders && isLeader)) return `${o.name} is ${isLeader ? 'a Leader' : 'a token'} — this Equipment can only go on ${allowed}.`;
  return null;
}

/** A Leader in play: a character, or one of Pain's Path tokens. */
function isLeaderUnit(o: BoardOccupant): boolean {
  return isCharacter(o) || o.extra.painPath === true;
}

/** Supplies to put this Equipment onto this holder: its printed cost, or its Leader cost when the holder is a Leader. Before Blacksmith Village. */
export function equipCostFor(state: GameState, defId: string, holderId: string | undefined, base: number): number {
  const stats = equipmentStats(defId);
  const holder = holderId ? findOccupant(state, holderId)?.occupant : undefined;
  return stats?.leaderCost !== undefined && holder && isLeaderUnit(holder) ? stats.leaderCost : base;
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

/** Takes an Equipment off its holder (if it still has one in play), before it goes to the discard pile. */
function detach(state: GameState, equip: EquipmentInstance): GameState {
  const stats = equipmentStats(equip.defId);
  let next = patchEquipment(state, equip.owner, equip.instanceId, (e) => ({ ...e, holderId: null }));
  if (stats && equip.holderId && findOccupant(next, equip.holderId)) next = applyStatBuffs(next, equip.holderId, stats, -1);
  return next;
}

// --- Buffs read live -----------------------------------------------------------

function holderHasSynergy(holder: BoardOccupant, synergy: string): boolean {
  const synergies = isCharacter(holder) ? getCharacterDef(holder.defId)?.synergy : getHandCardDef(holder.defId)?.shinobi?.synergy;
  return !!synergies?.includes(synergy);
}

/** The extra Damage this unit's Equipment gives it right now — a Shinobi's attacks, and a Leader's damage-dealing abilities and the Jutsu cards it enables. */
export function equipmentDamageBonus(state: GameState, holder: BoardOccupant): number {
  let bonus = 0;
  for (const e of equipmentOn(state, holder.instanceId)) {
    const stats = equipmentStats(e.defId);
    if (!stats) continue;
    bonus += stats.damage ?? 0;
    const cond = stats.conditionalDamage;
    const styles = isCharacter(holder) ? holder.styles : (getHandCardDef(holder.defId)?.shinobi?.styles ?? []);
    if (cond && ((cond.style && styles.includes(cond.style)) || (cond.synergy && holderHasSynergy(holder, cond.synergy)))) bonus += cond.amount;
  }
  return bonus;
}

/** How much each damage instance this unit takes is reduced by its Equipment (to a minimum of 1). */
export function equipmentDamageReduction(state: GameState, holderId: string): number {
  return equipmentOn(state, holderId).reduce((sum, e) => sum + (equipmentStats(e.defId)?.damageReduction ?? 0), 0);
}

const EQUIPMENT_HEAL_CHOICE = 'equipment-upkeep-heal';

/**
 * Upkeep Phase: Equipment that heals its holder each turn (Medical Pouch). One with a Supply cost is optional,
 * so its controller is asked each time — only while the holder is hurt, and (strict rules) can pay.
 */
export function tickEquipmentHeals(state: GameState, player: PlayerId): GameState {
  let next = state;
  for (const e of state.players[player].equipment ?? []) {
    const stats = equipmentStats(e.defId);
    const heal = stats?.healEachTurn ?? 0;
    const holder = e.holderId ? findOccupant(next, e.holderId)?.occupant : undefined;
    if (!heal || !holder) continue;
    const name = getHandCardDef(e.defId)?.name ?? 'Equipment';
    const cost = (isLeaderUnit(holder) ? stats?.leaderHealCost : undefined) ?? stats?.healCost ?? 0;
    if (cost > 0) {
      if (holder.currentHP >= holder.maxHP) continue;
      if (state.rules !== 'trust' && suppliesAvailable(next, player) < cost) continue;
      next = enqueueChoice(next, {
        player,
        prompt: `${name}: pay ${cost} ${cost === 1 ? 'Supply' : 'Supplies'} to heal ${holder.name} ${heal}?`,
        options: [
          { id: 'heal', label: `Heal ${heal} (${cost} ${cost === 1 ? 'Supply' : 'Supplies'})` },
          { id: 'skip', label: 'Skip' },
        ],
        min: 1,
        max: 1,
        resolverId: EQUIPMENT_HEAL_CHOICE,
        data: { holderId: holder.instanceId, heal, cost, name },
      });
      continue;
    }
    next = appendLog(next, `${name}: ${holder.name} heals ${heal}.`);
    next = healOccupant(next, holder.instanceId, heal);
  }
  return next;
}

registerChoiceResolver(EQUIPMENT_HEAL_CHOICE, (state, choice, optionIds) => {
  const { holderId, heal, cost, name } = choice.data as { holderId: string; heal: number; cost: number; name: string };
  const holder = findOccupant(state, holderId)?.occupant;
  if (optionIds[0] !== 'heal' || !holder) return appendLog(state, `${choice.player} skips ${name}.`);
  const paid = spendSupplies(state, choice.player, cost, name);
  if (!paid) return appendLog(state, `Not enough Supplies for ${name}.`);
  return healOccupant(appendLog(paid, `${name}: ${holder.name} heals ${heal}.`), holderId, heal);
});

/** Takes an Equipment out of play into its owner's discard pile (its holder's buffs come off first if the holder is still in play). */
function discardEquipment(state: GameState, equip: EquipmentInstance): GameState {
  const next = detach(state, equip);
  const p = next.players[equip.owner];
  return {
    ...next,
    players: {
      ...next.players,
      [equip.owner]: {
        ...p,
        equipment: (p.equipment ?? []).filter((e) => e.instanceId !== equip.instanceId),
        discardPile: [...p.discardPile, { instanceId: equip.instanceId, defId: equip.defId }],
      },
    },
  };
}

/**
 * The holder was just defeated (combat.ts): its Equipment goes to the discard pile — and Equipment that
 * strikes back (Explosive Tag Vest) deals its damage to the unit whose attack made the kill.
 */
export function onHolderDefeated(state: GameState, holderId: string, killerInstanceId?: string): GameState {
  let next = state;
  for (const e of equipmentOn(state, holderId)) {
    next = discardEquipment(next, e);
    const name = getHandCardDef(e.defId)?.name ?? 'Equipment';
    const retaliation = equipmentStats(e.defId)?.defeatRetaliation ?? 0;
    const killer = killerInstanceId ? findOccupant(next, killerInstanceId)?.occupant : undefined;
    if (retaliation > 0 && killer) {
      next = appendLog(next, `${name} goes off — ${retaliation} damage to ${killer.name}.`);
      next = dealDamage(next, killer.instanceId, retaliation, { unattributed: true }).state;
    }
    next = appendLog(next, `${name} goes to the discard pile.`);
  }
  return next;
}

/** Run after every action: Equipment whose holder has left play some other way (returned to hand, …) goes to the discard pile too. */
export function sweepEquipment(state: GameState): GameState {
  const inPlay = occupantIds(state);
  let next = state;
  for (const e of allEquipment(state)) {
    if (!e.holderId || !inPlay.has(e.holderId)) next = appendLog(discardEquipment(next, e), `${getHandCardDef(e.defId)?.name ?? 'Equipment'} goes to the discard pile.`);
  }
  return next;
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
    text: `Cost: ${cost} ${cost === 1 ? 'Supply' : 'Supplies'}${stats.leaderCost !== undefined ? ` (${stats.leaderCost} on a Leader)` : ''}\nEffect: Attach to ${stats.leaderHolder ? 'a Leader or Shinobi' : 'a Shinobi'} you control. ${effect}`,
    legalityCheck: (ctx) => holderBlocker(ctx.state, ctx.player, ctx.targetInstanceIds[0], id) === null,
    resolve: (ctx) => {
      const equip: EquipmentInstance = { instanceId: `${ctx.player}-${id}-${ctx.state.log.length}`, defId: id, owner: ctx.player, holderId: null };
      const p = ctx.state.players[ctx.player];
      let next: GameState = { ...ctx.state, players: { ...ctx.state.players, [ctx.player]: { ...p, equipment: [...(p.equipment ?? []), equip] } } };
      const holderId = ctx.targetInstanceIds[0];
      const blocker = holderBlocker(next, ctx.player, holderId, id);
      if (blocker) return appendLog(discardEquipment(next, equip), `${name} goes to the discard pile — ${blocker}`);
      next = attach(next, equip, holderId);
      return appendLog(next, `${ctx.player} equips ${findOccupant(next, holderId)!.occupant.name} with ${name}.`);
    },
    ...extra,
  };
}

export const EQUIPMENT_CARDS: HandCardDef[] = [
  equipmentCard('equip-forehead-protector', 'Forehead Protector', 2, { health: 2 }, 'The holder gets +2 Health.'),
  equipmentCard('equip-kunai-pouch', 'Kunai & Shuriken Pouch', 3, { damage: 1 }, 'The holder gets +1 Damage.'),
  equipmentCard('equip-chakra-scroll', 'Chakra Storage Scroll', 3, { poolCapacity: 2, leaderHolder: true }, "The holder's Chakra Pool holds 2 more."),
  equipmentCard(
    'equip-medical-pouch',
    'Medical Pouch',
    2,
    { healEachTurn: 1, healCost: 1, leaderHolder: true, leaderCost: 8, leaderHealCost: 4 },
    'At your Upkeep, you may pay 1 Supply to heal the holder 1 — 4 Supplies if it’s a Leader.',
  ),
  equipmentCard('equip-explosive-tag-vest', 'Explosive Tag Vest', 3, { defeatRetaliation: 2 }, 'When the holder is defeated by an attack, deal 2 damage to the attacker.'),
  equipmentCard('equip-flak-vest', 'Flak Vest', 5, { damageReduction: 1 }, 'Each time the holder takes damage, reduce it by 1 (to a minimum of 1).'),
  equipmentCard('equip-trench-knives', 'Chakra Trench Knives', 5, { damage: 1, conditionalDamage: { style: 'Wind', amount: 1 } }, 'The holder gets +1 Damage, or +2 if it has Wind Style.'),
  equipmentCard('equip-akatsuki-cloak', 'Akatsuki Cloak', 5, { health: 3, conditionalDamage: { synergy: 'Akatsuki', amount: 1 } }, 'Unique. The holder gets +3 Health; an Akatsuki holder also gets +1 Damage.', {
    unique: true,
    synergy: ['Akatsuki'],
  }),
];
for (const def of EQUIPMENT_CARDS) registerHandCard(def);

/** 2 of each Equipment (1 of a Unique one) — the Prototype's starter deck used to carry these; Equipment is now in the Deck Library only. */
export const PROTOTYPE_EQUIPMENT_MANIFEST: { defId: string; copies: number }[] = EQUIPMENT_CARDS.map((d) => ({ defId: d.id, copies: d.unique ? 1 : 2 }));
