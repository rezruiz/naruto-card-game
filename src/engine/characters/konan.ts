import { findOccupant, isCharacter, patchCharacter } from '../board';
import { dealDamage } from '../combat';
import { appendLog, otherPlayer } from '../phases/phaseMachine';
import type { AbilityDef } from '../abilities';
import { registerCharacter } from './registry';
import type { GameState, PlayerId } from '../types';

const DEF_ID = 'konan';

// NOTE (simplified for this pass, same as Kakuzu's Iron Skin): Paper Body's
// incoming-damage modifiers (-2 vs Taijutsu, +1 vs Fire Style) aren't wired
// into combat.dealDamage yet — no generic damage-modifier system exists.

function dealToAllEnemyUnits(state: GameState, owner: PlayerId, amount: number): GameState {
  const opponent = otherPlayer(owner);
  let next = state;
  for (const c of next.players[opponent].backRow) {
    if (c) next = dealDamage(next, c.instanceId, amount).state;
  }
  for (const t of next.players[opponent].frontRow) {
    if (t) next = dealDamage(next, t.instanceId, amount).state;
  }
  return next;
}

const paperShurikenStorm: AbilityDef = {
  id: 'paper-shuriken-storm',
  name: 'Paper Shuriken Storm',
  cost: 2,
  speed: 'Normal',
  style: 'Paper',
  type: 'Ninjutsu',
  isDamaging: true,
  maxTargets: 2,
  resolve: (ctx) => {
    let state = ctx.state;
    for (const target of ctx.targetInstanceIds.slice(0, 2)) {
      state = dealDamage(state, target, 2).state;
    }
    return state;
  },
};

const foldShikigami: AbilityDef = {
  id: 'fold-shikigami',
  name: 'Fold Shikigami',
  cost: 1,
  speed: 'Normal',
  style: 'Paper',
  type: 'Ninjutsu',
  maxTargets: 0,
  usesPerTurn: 2,
  resolve: (ctx) =>
    patchCharacter(ctx.state, ctx.sourceInstanceId, (k) => ({
      ...k,
      extra: { ...k.extra, shikigamiCharges: ((k.extra.shikigamiCharges as number) ?? 0) + 1 },
    })),
};

function shikigamiCharges(state: GameState, instanceId: string): number {
  const found = findOccupant(state, instanceId);
  return found && isCharacter(found.occupant) ? ((found.occupant.extra.shikigamiCharges as number) ?? 0) : 0;
}

// Spending a Shikigami Charge is the controller's choice (asked at
// activation, only when Konan has one); resolve re-checks it's still there.
const paperBombTag: AbilityDef = {
  id: 'paper-bomb-tag',
  name: 'Paper Bomb Tag',
  cost: 3,
  speed: 'Normal',
  style: 'Paper',
  type: 'Ninjutsu',
  isDamaging: true,
  choices: (ctx) =>
    shikigamiCharges(ctx.state, ctx.sourceInstanceId) >= 1
      ? [{ id: 'spendCharge', kind: 'yesno', prompt: 'Spend 1 Shikigami Charge for 5 damage instead of 3?' }]
      : [],
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    const spend = ctx.choices?.spendCharge === true && shikigamiCharges(ctx.state, ctx.sourceInstanceId) >= 1;
    let state = ctx.state;
    if (spend) {
      state = patchCharacter(state, ctx.sourceInstanceId, (k) => ({
        ...k,
        extra: { ...k.extra, shikigamiCharges: (k.extra.shikigamiCharges as number) - 1 },
      }));
    }
    state = appendLog(
      state,
      spend
        ? `Konan spends 1 Shikigami Charge (${shikigamiCharges(state, ctx.sourceInstanceId)} left) — upgraded Paper Bomb Tag.`
        : 'Konan uses the base Paper Bomb Tag (no Charge spent).',
    );
    return dealDamage(state, target, spend ? 5 : 3).state;
  },
};

// A second real (not stubbed) use of the target-negation primitive first
// built for Itachi's Crow Clone — no "once per attacker" restriction here
// (design/CHARACTER_LOG.md), so no permanent tracking is needed.
const paperClone: AbilityDef = {
  id: 'paper-clone',
  name: 'Paper Clone',
  cost: 2,
  speed: 'Reactive',
  style: 'Paper',
  type: 'Ninjutsu',
  maxTargets: 0,
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found || !isCharacter(found.occupant)) return false;
    const konan = found.occupant;
    if (((konan.extra.shikigamiCharges as number) ?? 0) < 2) return false;
    return ctx.state.stack.some((item) => item.targets.includes(ctx.sourceInstanceId) && item.controllerId !== konan.owner);
  },
  resolve: (ctx) => {
    let state = ctx.state;
    const found = findOccupant(state, ctx.sourceInstanceId);
    if (!found || !isCharacter(found.occupant)) return state;
    const konan = found.occupant;
    const idx = state.stack.findIndex((item) => item.targets.includes(ctx.sourceInstanceId) && item.controllerId !== konan.owner);
    if (idx === -1) return appendLog(state, 'Paper Clone finds nothing left to negate.');

    const negated = state.stack[idx];
    state = { ...state, stack: [...state.stack.slice(0, idx), ...state.stack.slice(idx + 1)] };
    state = patchCharacter(state, ctx.sourceInstanceId, (k) => ({
      ...k,
      extra: { ...k.extra, shikigamiCharges: (k.extra.shikigamiCharges as number) - 2 },
    }));
    return appendLog(state, `Konan disperses into paper — Paper Clone negates ${negated.sourceName}'s ${negated.abilityName}.`);
  },
};

const paperPersonOfGodTechnique: AbilityDef = {
  id: 'paper-person-of-god-technique',
  name: 'Paper Person of God Technique',
  cost: 6,
  speed: 'Normal',
  style: 'Paper',
  type: 'Ninjutsu',
  isDamaging: true,
  isUltimate: true,
  maxTargets: 0,
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found || !isCharacter(found.occupant)) return false;
    const k = found.occupant;
    return k.chakraPool.current >= k.chakraPool.capacity && ((k.extra.shikigamiCharges as number) ?? 0) >= 4;
  },
  resolve: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found || !isCharacter(found.occupant)) return ctx.state;
    const owner = found.player;

    let state = patchCharacter(ctx.state, ctx.sourceInstanceId, (k) => ({
      ...k,
      extra: { ...k.extra, shikigamiCharges: (k.extra.shikigamiCharges as number) - 4, paperPersonPending: true },
    }));
    state = dealToAllEnemyUnits(state, owner, 3);
    return appendLog(state, "Paper Person of God Technique's second wave will hit at the End Phase of the opponent's next turn.");
  },
};

registerCharacter({
  id: DEF_ID,
  name: 'Konan',
  rank: 'A',
  baseMaxHP: 11,
  basePoolCapacity: 4,
  styles: ['Paper', 'Wind', 'Earth', 'Water', 'Yang'],
  abilities: [paperShurikenStorm, foldShikigami, paperBombTag, paperClone],
  ultimate: paperPersonOfGodTechnique,
  initialExtra: { shikigamiCharges: 1, paperPersonPending: false },
  synergy: ['Akatsuki'],
  runsHooksWhenInert: ['anyEndPhase'], // Paper Person's delayed second wave was already activated
  onAnyEndPhase: (state, instanceId, endingPlayer) => {
    const found = findOccupant(state, instanceId);
    if (!found || !isCharacter(found.occupant)) return state;
    const konan = found.occupant;
    if (!konan.extra.paperPersonPending || endingPlayer === konan.owner) return state;

    let next = patchCharacter(state, instanceId, (k) => ({ ...k, extra: { ...k.extra, paperPersonPending: false } }));
    next = dealToAllEnemyUnits(next, konan.owner, 3);
    return appendLog(next, "Paper Person of God Technique's delayed second wave hits.");
  },
});
