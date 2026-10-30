import { findOccupant, isCharacter, patchCharacter } from '../board';
import { dealDamage } from '../combat';
import { appendLog } from '../phases/phaseMachine';
import { shuffle } from '../deck';
import { enqueueChoice, registerChoiceResolver } from '../choices';
import { getHandCardDef } from '../cards/registry';
import type { AbilityDef } from '../abilities';
import { registerCharacter } from './registry';
import type { GameState, PlayerId } from '../types';

const DEF_ID = 'itachi';

const crowShurikenBarrage: AbilityDef = {
  id: 'crow-shuriken-barrage',
  name: 'Crow Shuriken Barrage',
  cost: 2,
  speed: 'Normal',
  style: 'None',
  type: 'Taijutsu',
  isDamaging: true,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    return target ? dealDamage(ctx.state, target, 1).state : ctx.state;
  },
};

const greatFireballTechnique: AbilityDef = {
  id: 'great-fireball-technique',
  name: 'Fire Release: Great Fireball',
  cost: 5,
  speed: 'Normal',
  style: 'Fire',
  type: 'Ninjutsu',
  isDamaging: true,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    return target ? dealDamage(ctx.state, target, 3).state : ctx.state;
  },
};

const CROW_CLONE_ID = 'jutsu-crow-clone';

// "Search your Extra Deck for a Genjutsu: Crow Clone and put it on top of your
// Jutsu Deck." No copy in the Extra Deck: nothing happens.
const crowSubstitution: AbilityDef = {
  id: 'crow-substitution',
  name: 'Summoning: Crow Substitution',
  cost: 1,
  speed: 'Normal',
  style: 'None',
  type: 'Ninjutsu',
  maxTargets: 0,
  resolve: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found) return ctx.state;
    const p = ctx.state.players[found.player];
    const pile = p.extraDeck ?? [];
    const crow = pile.find((c) => c.defId === CROW_CLONE_ID);
    if (!crow) return appendLog(ctx.state, `Summoning: Crow Substitution — no Genjutsu: Crow Clone in ${found.player}'s Extra Deck.`);
    const state = {
      ...ctx.state,
      players: { ...ctx.state.players, [found.player]: { ...p, extraDeck: pile.filter((c) => c !== crow), handDeck: [crow, ...p.handDeck] } },
    };
    return appendLog(state, `Summoning: Crow Substitution — ${found.player} puts Genjutsu: Crow Clone from their Extra Deck on top of their Jutsu Deck.`);
  },
};

/** A Sharingan Genjutsu card: a Genjutsu card that needs a Sharingan user to enable it (HandCardDef.requiresSharingan). */
function isSharinganGenjutsu(defId: string): boolean {
  const def = getHandCardDef(defId);
  return !!def && def.type === 'Genjutsu' && !!def.requiresSharingan;
}

const SHARINGAN_INSIGHT_CHOICE = 'itachi-sharingan-insight';

/** Takes one copy of `defId` from the Jutsu Deck into hand, then shuffles the deck. */
function tutorToHand(state: GameState, player: PlayerId, defId: string): GameState {
  const p = state.players[player];
  const card = p.handDeck.find((c) => c.defId === defId);
  if (!card) return state;
  const handDeck = shuffle(p.handDeck.filter((c) => c !== card));
  const next = { ...state, players: { ...state.players, [player]: { ...p, handDeck, hand: [...p.hand, { kind: 'card' as const, instanceId: card.instanceId, defId }] } } };
  return appendLog(next, `Sharingan Insight: ${player} adds ${getHandCardDef(defId)?.name ?? 'a Genjutsu card'} to hand and shuffles the Jutsu Deck.`);
}

// "When Itachi enters play, search your Jutsu Deck for a Sharingan Genjutsu card, add it to your hand, then
// shuffle." Several different ones: the player picks which.
function sharinganInsight(state: GameState, player: PlayerId): GameState {
  const options = [...new Set(state.players[player].handDeck.map((c) => c.defId).filter(isSharinganGenjutsu))];
  if (options.length === 0) {
    const p = state.players[player];
    return appendLog({ ...state, players: { ...state.players, [player]: { ...p, handDeck: shuffle(p.handDeck) } } }, `Sharingan Insight: no Sharingan Genjutsu card in ${player}'s Jutsu Deck — it's shuffled.`);
  }
  if (options.length === 1) return tutorToHand(state, player, options[0]);
  return enqueueChoice(state, {
    player,
    prompt: 'Sharingan Insight: choose a Sharingan Genjutsu card from your Jutsu Deck to add to your hand.',
    options: options.map((id) => ({ id, label: getHandCardDef(id)?.name ?? id })),
    min: 1,
    max: 1,
    resolverId: SHARINGAN_INSIGHT_CHOICE,
    data: {},
    hidden: true,
  });
}

registerChoiceResolver(SHARINGAN_INSIGHT_CHOICE, (state, choice, optionIds) => tutorToHand(state, choice.player, optionIds[0]));

// The delayed ticks fire on Itachi's controller's Upkeep (onUpkeep below).
// "Damage cannot be reduced": every tick is dealt with cannotBeReduced, which
// skips every reduction in combat.ts (Iron Skin, Paper Body, prevention...).
const amaterasu: AbilityDef = {
  id: 'amaterasu',
  name: 'Amaterasu',
  cost: 7,
  speed: 'Normal',
  style: 'Fire',
  type: 'Ninjutsu',
  isDamaging: true,
  isUltimate: true,
  // Failing Health: not in the same turn as his Forbidden Technique.
  legalityCheck: (ctx) => !usedThisTurn(ctx.state, ctx.sourceInstanceId, 'tsukuyomi-infinite-agony'),
  resolve: (ctx) => {
    const targetId = ctx.targetInstanceIds[0];
    if (!targetId) return ctx.state;
    let state = dealDamage(ctx.state, targetId, 3, { cannotBeReduced: true }).state;
    state = patchCharacter(state, ctx.sourceInstanceId, (k) => ({
      ...k,
      extra: {
        ...k.extra,
        amaterasuSchedule: [...((k.extra.amaterasuSchedule as { targetInstanceId: string; ticksLeft: number }[]) ?? []), { targetInstanceId: targetId, ticksLeft: 3 }],
      },
    }));
    return appendLog(state, 'Amaterasu will deal 1 more damage at the start of each of your next 3 Upkeeps.');
  },
};

// Condition: the target hasn't dealt more than 6 damage to Itachi this game
// (a per-attacker tally kept by combat.ts).
const tsukuyomiInfiniteAgony: AbilityDef = {
  id: 'tsukuyomi-infinite-agony',
  name: 'Mangekyō Sharingan: Tsukuyomi - Infinite Agony',
  cost: 8,
  speed: 'Normal',
  style: 'None',
  type: 'Genjutsu',
  isDamaging: true,
  isForbidden: true,
  legalityCheck: (ctx) => {
    const source = findOccupant(ctx.state, ctx.sourceInstanceId);
    const targetId = ctx.targetInstanceIds[0];
    if (!source || !isCharacter(source.occupant) || !targetId) return false;
    // Failing Health: not in the same turn as his Ultimate.
    if (usedThisTurn(ctx.state, ctx.sourceInstanceId, 'amaterasu')) return false;
    const taken = ((source.occupant.extra.damageTakenFrom as Record<string, number> | undefined) ?? {})[targetId] ?? 0;
    return taken <= 6;
  },
  resolve: (ctx) => {
    const targetId = ctx.targetInstanceIds[0];
    if (!targetId) return ctx.state;
    let state = dealDamage(ctx.state, targetId, 5).state;
    state = patchCharacter(state, targetId, (t) => ({ ...t, extra: { ...t.extra, stunnedUntilTurn: ctx.state.turn + 2 } }));
    return appendLog(state, 'Tsukuyomi stuns its target for the next turn cycle.');
  },
};

function usedThisTurn(state: Parameters<typeof findOccupant>[0], instanceId: string, abilityId: string): boolean {
  const found = findOccupant(state, instanceId);
  return !!found && found.occupant.status.usedAbilitiesThisTurn.includes(abilityId);
}

registerCharacter({
  id: DEF_ID,
  name: 'Itachi',
  rank: 'S',
  baseMaxHP: 12,
  basePoolCapacity: 12,
  styles: ['Fire', 'Sharingan'],
  abilities: [crowShurikenBarrage, greatFireballTechnique, crowSubstitution, tsukuyomiInfiniteAgony],
  ultimate: amaterasu,
  maxAbilitiesPerTurn: 2,
  runsHooksWhenInert: ['upkeep'], // Amaterasu's burn keeps ticking even if Itachi Retreats — an already-activated effect (§6.5b)
  initialExtra: { amaterasuSchedule: [] },
  synergy: ['Akatsuki'],
  onEnterPlay: (state, _instanceId, player) => sharinganInsight(state, player),
  onUpkeep: (state, instanceId) => {
    const found = findOccupant(state, instanceId);
    if (!found || !isCharacter(found.occupant)) return state;
    const schedule = (found.occupant.extra.amaterasuSchedule as { targetInstanceId: string; ticksLeft: number }[]) ?? [];
    if (schedule.length === 0) return state;

    let next = state;
    const remaining: { targetInstanceId: string; ticksLeft: number }[] = [];
    for (const tick of schedule) {
      if (findOccupant(next, tick.targetInstanceId)) {
        next = dealDamage(next, tick.targetInstanceId, 1, { cannotBeReduced: true, ongoing: true }).state;
      }
      if (tick.ticksLeft - 1 > 0) remaining.push({ ...tick, ticksLeft: tick.ticksLeft - 1 });
    }
    return patchCharacter(next, instanceId, (k) => ({ ...k, extra: { ...k.extra, amaterasuSchedule: remaining } }));
  },
});
