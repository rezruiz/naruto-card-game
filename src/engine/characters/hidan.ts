import { findOccupant, isCharacter } from '../board';
import { dealDamage, healOccupant, registerDamageTakenHook, registerDefeatHook } from '../combat';
import { appendLog } from '../phases/phaseMachine';
import type { AbilityDef } from '../abilities';
import { registerCharacter } from './registry';
import type { GameState } from '../types';

const DEF_ID = 'hidan';

function setExtra(state: GameState, instanceId: string, patch: Record<string, unknown>): GameState {
  const found = findOccupant(state, instanceId);
  if (!found || !(isCharacter(found.occupant))) return state;
  const { player, index, occupant } = found;
  const p = state.players[player];
  const backRow = p.backRow.slice();
  backRow[index] = { ...occupant, extra: { ...occupant.extra, ...patch } };
  return { ...state, players: { ...state.players, [player]: { ...p, backRow } } };
}

// Triple Scythe Sweep can target Hidan himself for 0 Chakra while his Curse
// is active — a self-targeting exception, and the first ability with a
// context-dependent cost validated by this pass.
const tripleScytheSweep: AbilityDef = {
  id: 'triple-scythe-sweep',
  name: 'Triple Scythe Sweep',
  cost: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    const selfTarget = ctx.targetInstanceIds[0] === ctx.sourceInstanceId;
    const curseActive = found && isCharacter(found.occupant) && found.occupant.extra.curseActive === true;
    return selfTarget && curseActive ? 0 : 2;
  },
  speed: 'Normal',
  style: 'None',
  type: 'Taijutsu',
  isDamaging: true,
  targetSide: 'any', // normally an enemy attack, but can self-target while Curse Technique is active
  legalityCheck: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    const selfTarget = target === ctx.sourceInstanceId;
    if (!selfTarget) return true;
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found || !(isCharacter(found.occupant))) return false;
    const hidan = found.occupant;
    // §6.5b-style same-turn restriction: can't self-target the turn the
    // Curse was activated.
    return hidan.extra.curseActive === true && hidan.extra.curseActivatedTurn !== ctx.state.turn;
  },
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    const selfTarget = target === ctx.sourceInstanceId;
    let state = ctx.state;

    if (selfTarget) {
      // §6.5b-style floor: this self-damage can't drop Hidan below 3 HP.
      const found = findOccupant(state, ctx.sourceInstanceId);
      if (!found || !(isCharacter(found.occupant))) return state;
      const hidan = found.occupant;
      const cursedTarget = hidan.extra.cursedTarget as string | undefined;
      const dmg = Math.min(2, Math.max(0, hidan.currentHP - 3));
      state = dealDamage(state, ctx.sourceInstanceId, dmg, { skipDamageTakenHook: true }).state;
      // +1 extra damage to the Cursed enemy on self-inflicted hits.
      if (cursedTarget) state = dealDamage(state, cursedTarget, dmg + 1).state;
      return state;
    }

    return dealDamage(state, target, 2).state;
  },
};

// NOTE (simplified for this pass): the Condition ("target an enemy Hidan has
// already damaged") isn't enforced yet — no per-target damage history is
// tracked. The self-untargetable-by-friendlies clause is also not yet
// enforced (no "friendly attack" distinction in getLegalTargets yet).
const curseTechnique: AbilityDef = {
  id: 'curse-technique',
  name: 'Curse Technique: Death Controlling Possessed Blood',
  cost: 6,
  speed: 'Normal',
  style: 'Ritual',
  type: 'Ninjutsu',
  isUltimate: true,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    let state = setExtra(ctx.state, ctx.sourceInstanceId, {
      curseActive: true,
      curseActivatedTurn: ctx.state.turn,
      cursedTarget: target,
    });
    return appendLog(state, `Hidan binds his blood to a target — Curse Technique is active.`);
  },
};

registerCharacter({
  id: DEF_ID,
  name: 'Hidan',
  rank: 'B',
  baseMaxHP: 9,
  basePoolCapacity: 1,
  synergy: ['Akatsuki', 'Kakuzu'],
  styles: ['Ritual'],
  abilities: [tripleScytheSweep],
  ultimate: curseTechnique,
  initialExtra: { usedSafetyNet: false, curseActive: false },
  // Regenerates 1 HP each End Phase (2 while the Ultimate is active).
  onEndPhase: (state, instanceId) => {
    const found = findOccupant(state, instanceId);
    if (!found || !(isCharacter(found.occupant))) return state;
    const amount = found.occupant.extra.curseActive ? 2 : 1;
    return healOccupant(state, instanceId, amount);
  },
});

// Jashin's Blessing (SPEC.md): first defeat survives at 1 HP instead.
// NOTE (simplified for this pass): the Kakuzu cross-character revival clause
// isn't implemented — it needs coordinated state changes across two
// characters' defeat-hook logic, deferred to a later pass.
registerDefeatHook(DEF_ID, (state, targetInstanceId) => {
  const found = findOccupant(state, targetInstanceId);
  if (!found || !(isCharacter(found.occupant))) return null;
  const hidan = found.occupant;
  if (hidan.extra.usedSafetyNet) return null; // one-time only — true defeat proceeds.

  const p = state.players[found.player];
  const backRow = p.backRow.slice();
  backRow[found.index] = { ...hidan, currentHP: 1, extra: { ...hidan.extra, usedSafetyNet: true } };
  const next = { ...state, players: { ...state.players, [found.player]: { ...p, backRow } } };
  return appendLog(next, `Jashin's Blessing: Hidan survives his first defeat at 1 HP.`);
});

// While Curse Technique is active, all damage Hidan takes is mirrored onto
// his Cursed target — the ongoing-state validation case for this pass.
registerDamageTakenHook(DEF_ID, (state, targetInstanceId, amount) => {
  const found = findOccupant(state, targetInstanceId);
  if (!found || !(isCharacter(found.occupant))) return null;
  const hidan = found.occupant;
  if (!hidan.extra.curseActive) return null;
  const cursedTarget = hidan.extra.cursedTarget as string | undefined;
  if (!cursedTarget) return null;
  return dealDamage(state, cursedTarget, amount).state;
});
