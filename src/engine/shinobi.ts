// Prototype rules: Shinobi (Design Draft — "New Direction: Leaders, Shinobi and
// Supplies"). A Shinobi is a card from the Jutsu Deck that's played onto the
// front row for Supplies and fights on its own:
//
// - It has a base Damage and Health, and can't attack the turn it comes into
//   play (Field Orientation).
// - In its controller's Combat Phase it can attack an enemy Leader (a back-row
//   character; Pain's Path tokens count as Pain) or an enemy Shinobi.
// - After attacks are declared, the defending player chooses which of their
//   Shinobi defend — only attacks on a Leader can be defended, and each
//   Shinobi defends at most one attack. Leaders can't attack or defend.
// - Shinobi fighting each other deal their Damage to each other at the same
//   time; an undefended attack on a Leader deals the attacker's Damage to it.
// - A Shinobi that pooled Chakra this turn can't attack (it can still defend);
//   one that attacked can't pool Chakra (chakra.ts).
// - A defeated Shinobi goes to its owner's discard pile (combat.ts).
import { findOccupant, isCharacter, legalTokenSlots, hasFieldOrientation, patchOccupant, placeToken } from './board';
import { dealDamage } from './combat';
import { appendLog, appendWarning, otherPlayer } from './phases/phaseMachine';
import { registerHandCard, type HandCardDef } from './cards/registry';
import { equipmentDamageBonus } from './equipment';
import { TERRAIN, amegakureBuffs, hasTerrain, markTerrainUsed, terrainUsedThisTurn } from './terrainEffects';
import type { BoardOccupant, GameState, PlayerId, ShinobiAttack, Style, TokenInstance } from './types';

export function isShinobi(occ: BoardOccupant | null | undefined): occ is TokenInstance {
  return !!occ && !isCharacter(occ) && occ.extra.shinobi === true;
}

/** A Shinobi's Damage right now: its base Damage, plus any bonus for a named unit its controller has in play (Leader or Shinobi), its Terrain (Amegakure) and its Equipment. */
export function shinobiDamage(occ: BoardOccupant, state?: GameState): number {
  const base = (occ.extra.shinobiDamage as number | undefined) ?? 0;
  if (!state) return base;
  const bonus = occ.extra.shinobiLeaderBonus as { name: string; amount: number } | undefined;
  const p = state.players[occ.owner];
  const ally = bonus && [...p.backRow, ...p.frontRow].some((u) => u?.name === bonus.name) ? bonus.amount : 0;
  const amegakure = amegakureBuffs(state, occ.owner, occ.defId) ? 1 : 0;
  return base + ally + amegakure + equipmentDamageBonus(state, occ);
}

/** Rallying Words: a unit's next attack this turn deals +1. A Shinobi's attack spends it (its Leaders spend it on their abilities' attacks — combat.ts). */
function spendRally(state: GameState, attackerId: string): { state: GameState; bonus: number } {
  const attacker = findOccupant(state, attackerId)?.occupant;
  if (!attacker || attacker.extra.rallyingWordsBonusTurn !== state.turn || attacker.extra.rallyingSpentOn) return { state, bonus: 0 };
  const spent = patchOccupant(state, attackerId, (o) => ({ ...o, extra: { ...o.extra, rallyingSpentOn: `shinobi-attack-${state.turn}` } }));
  return { state: appendLog(spent, `Rallying Words: ${attacker.name}'s attack deals 1 additional damage.`), bonus: 1 };
}

/** A unit a Shinobi may attack: a Leader (back-row character, or one of Pain's Path tokens) or a Shinobi. */
function isAttackable(occ: BoardOccupant): boolean {
  return occ.extra.painPath === true || isCharacter(occ) || isShinobi(occ);
}

/** Attacks on a Leader can be defended; attacks on a Shinobi can't. */
export function targetsLeader(state: GameState, attack: ShinobiAttack): boolean {
  const target = findOccupant(state, attack.targetId)?.occupant;
  return !!target && !isShinobi(target);
}

// --- Cards --------------------------------------------------------------------

/**
 * The legendary rule (prototype): named characters are one of a kind — a player can't have two units
 * with the same name in play (Leaders and Shinobi alike). Generic units (Rain Village Genin…) aren't named.
 */
export function namedUnitInPlay(state: GameState, player: PlayerId, name: string): boolean {
  const p = state.players[player];
  return [...p.backRow, ...p.frontRow].some((u) => u?.name === name);
}

/** A Shinobi card. Placeholder Shinobi are vanilla; one with abilities (Yahiko) has a Pool and a TokenDef with the card's id (characters/yahikoShinobi.ts). */
function shinobiCard(
  id: string,
  name: string,
  cost: number,
  damage: number,
  health: number,
  leaderBonus?: { name: string; amount: number },
  opts: { named?: boolean; rank?: string; pool?: number; styles?: Style[]; synergy?: string[] } = {},
): HandCardDef {
  return {
    id,
    name,
    cardType: 'shinobi',
    cost,
    speed: 'Normal',
    style: 'None',
    type: 'None',
    maxTargets: 0,
    timing: 'main',
    shinobi: { damage, health, leaderBonus, ...opts },
    legalityCheck: (ctx) => legalTokenSlots(ctx.state, ctx.player).length > 0 && !(opts.named && namedUnitInPlay(ctx.state, ctx.player, name)),
    resolve: (ctx) => {
      const token: TokenInstance = {
        instanceId: `${ctx.player}-${id}-${ctx.state.log.length}`,
        defId: id,
        owner: ctx.player,
        name,
        maxHP: health,
        currentHP: health,
        ownerCharacterInstanceId: '',
        status: { disabled: false, retreated: false, enteredTurn: -1, hasAmbush: false, usedAbilitiesThisTurn: [], pooledThisTurn: false },
        extra: { shinobi: true, shinobiDamage: damage, ...(leaderBonus ? { shinobiLeaderBonus: leaderBonus } : {}) },
        ...(opts.pool ? { chakraPool: { current: 0, capacity: opts.pool } } : {}),
      };
      if (legalTokenSlots(ctx.state, ctx.player).length === 0) return appendLog(ctx.state, `${ctx.player}'s front row is full — ${name} can't come into play.`);
      let state = ctx.state;
      // Forest of Death: the first Shinobi you play each turn can attack that turn.
      const rushes = hasTerrain(state, ctx.player, TERRAIN.forestOfDeath) && !terrainUsedThisTurn(state, ctx.player, TERRAIN.forestOfDeath);
      if (rushes) state = markTerrainUsed(state, ctx.player, TERRAIN.forestOfDeath);
      const placed = rushes ? { ...token, extra: { ...token.extra, forestOfDeathTurn: state.turn } } : token;
      state = appendLog(placeToken(state, ctx.player, placed, { askPosition: true }), `${ctx.player} plays ${name} (${damage} Damage, ${health} Health).`);
      return rushes ? appendLog(state, `Forest of Death: ${name} can attack this turn.`) : state;
    },
  };
}

export const SHINOBI_CARDS: HandCardDef[] = [
  shinobiCard('shinobi-rain-genin', 'Rain Village Genin', 1, 1, 2),
  shinobiCard('shinobi-rain-scout', 'Rain Village Scout', 2, 2, 2),
  shinobiCard('shinobi-rain-chunin', 'Rain Village Chunin', 3, 2, 4),
  shinobiCard('shinobi-rain-jonin', 'Rain Village Jonin', 4, 3, 5),
  shinobiCard('shinobi-rain-elite-guard', 'Rain Village Elite Guard', 6, 4, 7),
  shinobiCard('shinobi-mercenary', 'Mercenary', 3, 2, 2),
  // The base game's D-rank character, as a 1/2 Shinobi (it keeps its D Rank for flavor): +1 Damage while Yahiko is in play.
  shinobiCard('shinobi-amegakure-civilian-rebel', 'Amegakure Civilian Rebel', 1, 1, 2, { name: 'Yahiko', amount: 1 }, { rank: 'D' }),
  // A Leader in the base game; a named B-rank Shinobi here, with its own Pool and abilities (characters/yahikoShinobi.ts).
  shinobiCard('shinobi-yahiko', 'Yahiko', 6, 2, 3, undefined, { named: true, rank: 'B', pool: 8, styles: ['Water', 'Fire', 'Wind'], synergy: ['Akatsuki', 'Pain', 'Konan'] }),
];
for (const def of SHINOBI_CARDS) registerHandCard(def);

/** The Shinobi in the Prototype build's starter deck (the Rebels and Yahiko were characters in the base game's Character Deck). The Scout is in the Deck Library only. */
export const PROTOTYPE_SHINOBI_MANIFEST: { defId: string; copies: number }[] = [
  { defId: 'shinobi-amegakure-civilian-rebel', copies: 3 },
  { defId: 'shinobi-rain-genin', copies: 1 },
  { defId: 'shinobi-rain-chunin', copies: 1 },
  { defId: 'shinobi-rain-jonin', copies: 1 },
  { defId: 'shinobi-rain-elite-guard', copies: 1 },
  { defId: 'shinobi-mercenary', copies: 2 },
  { defId: 'shinobi-yahiko', copies: 2 },
];

// --- Combat -------------------------------------------------------------------

/** Why this Shinobi can't attack right now (null = it can). */
export function attackBlocker(state: GameState, attackerId: string): string | null {
  const found = findOccupant(state, attackerId);
  if (!found || !isShinobi(found.occupant)) return 'Only Shinobi can attack.';
  const s = found.occupant;
  if (found.player !== state.activePlayer) return `${s.name} can only attack on its controller's turn.`;
  if (s.status.disabled) return `${s.name} is Disabled.`;
  if (hasFieldOrientation(state, s)) return `${s.name} came into play this turn and can't attack yet.`;
  if (s.status.pooledThisTurn) return `${s.name} pooled Chakra this turn and can't attack.`;
  if (s.extra.shinobiAttackedTurn === state.turn) return `${s.name} has already attacked this turn.`;
  if (state.shinobiCombat?.attacks.some((a) => a.attackerId === attackerId)) return `${s.name} is already attacking.`;
  return null;
}

export function declareShinobiAttack(state: GameState, attackerId: string, targetId: string): GameState {
  const relaxed = state.rules === 'trust';
  let working = state;
  if (state.phase !== 'Combat') {
    if (!relaxed) return appendLog(state, 'Shinobi can only attack during the Combat Phase.');
    working = appendWarning(working, 'A Shinobi attacks outside the Combat Phase — not legal under the strict rules, allowed anyway (trust mode).');
  }
  if (state.stack.length > 0) return appendLog(state, 'Wait for the stack to resolve before declaring attacks.');
  if (state.shinobiCombat?.step === 'defend') return appendLog(state, 'Attacks are already declared — the defender is choosing blockers.');
  const blocker = attackBlocker(working, attackerId);
  if (blocker) return appendLog(state, `Can't attack: ${blocker}`);
  const attacker = findOccupant(working, attackerId)!;
  const target = findOccupant(working, targetId);
  if (!target || target.player === attacker.player || !isAttackable(target.occupant)) return appendLog(state, `Can't attack: a Shinobi attacks an enemy Leader or an enemy Shinobi.`);
  if (target.occupant.status.retreated) return appendLog(state, `Can't attack: ${target.occupant.name} is Retreated.`);
  const combat = working.shinobiCombat ?? { step: 'declare' as const, attacks: [] };
  return appendLog({ ...working, shinobiCombat: { ...combat, attacks: [...combat.attacks, { attackerId, targetId }] } }, `${attacker.occupant.name} will attack ${target.occupant.name}.`);
}

export function cancelShinobiAttack(state: GameState, attackerId: string): GameState {
  const combat = state.shinobiCombat;
  if (!combat || combat.step !== 'declare') return state;
  const attacks = combat.attacks.filter((a) => a.attackerId !== attackerId);
  return { ...state, shinobiCombat: attacks.length ? { ...combat, attacks } : null };
}

/** The defending player's Shinobi that could stand in front of a Leader. */
function availableDefenders(state: GameState, defender: PlayerId): TokenInstance[] {
  return state.players[defender].frontRow.filter((t): t is TokenInstance => isShinobi(t) && !t.status.disabled);
}

export function confirmShinobiAttacks(state: GameState): GameState {
  const combat = state.shinobiCombat;
  if (!combat || combat.attacks.length === 0) return appendLog(state, 'No Shinobi attacks were declared.');
  if (combat.step !== 'declare') return state;
  const defender = otherPlayer(state.activePlayer);
  const defendable = combat.attacks.some((a) => targetsLeader(state, a));
  if (defendable && availableDefenders(state, defender).length > 0) {
    return appendLog({ ...state, shinobiCombat: { ...combat, step: 'defend' } }, `${state.activePlayer} confirms ${combat.attacks.length} attack${combat.attacks.length === 1 ? '' : 's'} — ${defender} chooses which Shinobi defend.`);
  }
  return resolveShinobiCombat(state);
}

export function assignShinobiDefender(state: GameState, attackerId: string, defenderId: string | null): GameState {
  const combat = state.shinobiCombat;
  if (!combat || combat.step !== 'defend') return appendLog(state, 'There are no attacks to defend right now.');
  const attack = combat.attacks.find((a) => a.attackerId === attackerId);
  if (!attack) return state;
  const defendingPlayer = otherPlayer(state.activePlayer);
  if (defenderId !== null) {
    if (!targetsLeader(state, attack)) return appendLog(state, "A Shinobi can only defend its Leader — not another Shinobi.");
    const found = findOccupant(state, defenderId);
    if (!found || found.player !== defendingPlayer || !isShinobi(found.occupant)) return appendLog(state, 'Only your own Shinobi can defend.');
    if (found.occupant.status.disabled) return appendLog(state, `${found.occupant.name} is Disabled and can't defend.`);
    if (combat.attacks.some((a) => a.defenderId === defenderId && a.attackerId !== attackerId)) return appendLog(state, `${found.occupant.name} is already defending against another attack.`);
  }
  const attacks = combat.attacks.map((a) => (a.attackerId === attackerId ? { ...a, defenderId: defenderId ?? undefined } : a));
  return { ...state, shinobiCombat: { ...combat, attacks } };
}

export function confirmShinobiDefense(state: GameState): GameState {
  if (state.shinobiCombat?.step !== 'defend') return state;
  return resolveShinobiCombat(state);
}

/** Two units deal their Damage to each other at the same time (`bonusA`: extra Damage on a's side, e.g. Rallying Words). */
function trade(state: GameState, a: string, b: string, bonusA = 0): GameState {
  const ua = findOccupant(state, a)?.occupant;
  const ub = findOccupant(state, b)?.occupant;
  if (!ua || !ub) return state;
  const toB = shinobiDamage(ua, state) + bonusA;
  const toA = isShinobi(ub) ? shinobiDamage(ub, state) : 0;
  let next = appendLog(state, `${ua.name} and ${ub.name} clash (${toB} / ${toA}).`);
  if (toB > 0) next = dealDamage(next, b, toB, { attackerInstanceId: a }).state;
  if (toA > 0 && findOccupant(next, a)) next = dealDamage(next, a, toA, { attackerInstanceId: b }).state;
  return next;
}

export function resolveShinobiCombat(state: GameState): GameState {
  const attacks = state.shinobiCombat?.attacks ?? [];
  let next: GameState = { ...state, shinobiCombat: null };
  for (const attack of attacks) {
    const attacker = findOccupant(next, attack.attackerId)?.occupant;
    if (!attacker) continue;
    next = patchOccupant(next, attack.attackerId, (o) => ({ ...o, extra: { ...o.extra, shinobiAttackedTurn: next.turn } }));
    const rally = spendRally(next, attack.attackerId);
    next = rally.state;
    if (attack.defenderId && findOccupant(next, attack.defenderId)) {
      const defender = findOccupant(next, attack.defenderId)!.occupant;
      next = appendLog(next, `${defender.name} defends against ${attacker.name}.`);
      next = trade(next, attack.attackerId, attack.defenderId, rally.bonus);
      continue;
    }
    const target = findOccupant(next, attack.targetId)?.occupant;
    if (!target) {
      next = appendLog(next, `${attacker.name}'s target is gone — the attack does nothing.`);
      continue;
    }
    if (isShinobi(target)) {
      next = trade(next, attack.attackerId, attack.targetId, rally.bonus);
    } else {
      let damage = shinobiDamage(attacker, next) + rally.bonus;
      // Hidden Mist: enemy Shinobi attacking your Leaders deal 1 less (to a minimum of 1).
      if (damage > 1 && hasTerrain(next, findOccupant(next, attack.targetId)!.player, TERRAIN.hiddenMist)) {
        damage -= 1;
        next = appendLog(next, `Hidden Mist: ${attacker.name}'s attack is reduced by 1.`);
      }
      next = appendLog(next, `${attacker.name} attacks ${target.name} for ${damage}.`);
      next = dealDamage(next, attack.targetId, damage, { attackerInstanceId: attack.attackerId }).state;
    }
  }
  return next;
}

/** Leaving Combat drops attacks that were declared but never confirmed. */
export function endShinobiCombat(state: GameState): GameState {
  if (!state.shinobiCombat) return state;
  return appendLog({ ...state, shinobiCombat: null }, 'Unresolved Shinobi attacks are dropped as Combat ends.');
}
