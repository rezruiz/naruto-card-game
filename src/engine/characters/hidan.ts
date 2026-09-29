import { findOccupant, isCharacter, patchCharacter } from '../board';
import { enqueueChoice, registerChoiceResolver } from '../choices';
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

// Condition: "target an enemy Hidan has already damaged" — combat.ts records
// every enemy Hidan's attacks damage (damagedEnemies). While the Curse is
// active his own side can't target him (abilities.ts / playHandCard.ts).
const curseTechnique: AbilityDef = {
  id: 'curse-technique',
  name: 'Curse Technique: Death Controlling Possessed Blood',
  cost: 6,
  speed: 'Normal',
  style: 'Ritual',
  type: 'Ninjutsu',
  isUltimate: true,
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    const target = ctx.targetInstanceIds[0];
    if (!found || !isCharacter(found.occupant) || !target) return false;
    return ((found.occupant.extra.damagedEnemies as string[] | undefined) ?? []).includes(target);
  },
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

/** Kakuzu on Hidan's side who can pay for the revival: in play, not Disabled/Retreated, Pool at capacity. */
function kakuzuWhoCanRevive(state: GameState, player: 'p1' | 'p2') {
  return state.players[player].backRow.find(
    (c) => c && c.defId === 'kakuzu' && !c.status.disabled && !c.status.retreated && c.chakraPool.capacity > 0 && c.chakraPool.current >= c.chakraPool.capacity,
  );
}

const REVIVE_CHOICE = 'hidan-kakuzu-revive';

/** Hidan's defeat goes through — his controller's decision about the revival has been made. */
function hidanDies(state: GameState, hidanId: string): GameState {
  const marked = setExtra(state, hidanId, { revivePending: false, reviveResolved: true });
  return dealDamage(marked, hidanId, 1, { cannotBeReduced: true, ongoing: true, unattributed: true }).state;
}

registerChoiceResolver(REVIVE_CHOICE, (state, choice, optionIds) => {
  const hidanId = choice.data.hidanId as string;
  const hidanFound = findOccupant(state, hidanId);
  if (!hidanFound || !isCharacter(hidanFound.occupant)) return state;
  const kakuzu = kakuzuWhoCanRevive(state, hidanFound.player);
  if (optionIds[0] !== 'revive' || !kakuzu) return hidanDies(appendLog(state, 'Hidan falls.'), hidanId);
  // Kakuzu spends his full Pool and stuns himself through his controller's next turn.
  const stunnedUntil = state.activePlayer === hidanFound.player ? state.turn + 2 : state.turn + 1;
  let next = patchCharacter(state, kakuzu.instanceId, (k) => ({ ...k, chakraPool: { ...k.chakraPool, current: 0 }, extra: { ...k.extra, stunnedUntilTurn: stunnedUntil } }));
  next = patchCharacter(next, hidanId, (h) => ({ ...h, currentHP: 3, extra: { ...h.extra, revivePending: false } }));
  return appendLog(next, 'Kakuzu stitches Hidan back together — Hidan returns at 3 HP; Kakuzu spends his Pool and is stunned through his next turn.');
});

// Jashin's Blessing (SPEC.md): first defeat survives at 1 HP instead. After
// that, if Kakuzu is in play with a full Pool when Hidan would be truly
// defeated, the controller is ASKED whether Kakuzu revives him at 3 HP
// (Kakuzu spends his full Pool and stuns himself through their next turn).
registerDefeatHook(DEF_ID, (state, targetInstanceId) => {
  const found = findOccupant(state, targetInstanceId);
  if (!found || !(isCharacter(found.occupant))) return null;
  const hidan = found.occupant;
  if (hidan.extra.usedSafetyNet) {
    if (hidan.extra.reviveResolved) return null; // decided — the defeat goes through
    if (hidan.extra.revivePending) return state; // still waiting on the answer; stays at 0 HP
    if (!kakuzuWhoCanRevive(state, found.player)) return null;
    const marked = setExtra(state, targetInstanceId, { revivePending: true });
    return enqueueChoice(appendLog(marked, 'Hidan would be defeated — Kakuzu can revive him.'), {
      player: found.player,
      prompt: "Hidan would be defeated. Have Kakuzu revive him at 3 HP? Kakuzu spends his full Chakra Pool and is stunned through your next turn.",
      options: [
        { id: 'revive', label: 'Revive Hidan' },
        { id: 'decline', label: 'Let him fall' },
      ],
      min: 1,
      max: 1,
      resolverId: REVIVE_CHOICE,
      data: { hidanId: targetInstanceId },
    });
  }

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
  return dealDamage(state, cursedTarget, amount, { unattributed: true }).state;
});
