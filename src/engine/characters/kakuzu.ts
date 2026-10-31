import { findOccupant, isCharacter, patchCharacter } from '../board';
import { dealDamage, healOccupant, registerDefeatHook } from '../combat';
import { appendLog } from '../phases/phaseMachine';
import type { AbilityDef } from '../abilities';
import { registerCharacter } from './registry';
import { shuffle } from '../deck';
import { isPrototype } from '../prototype';
import type { GameState, PlayerId, Style } from '../types';

const DEF_ID = 'kakuzu';

// Five Hearts' Style-loss step needs an ordered list to drop from deterministically.
const HEART_STYLE_ORDER: Style[] = ['Fire', 'Lightning', 'Wind', 'Earth'];

function poolCapacityForHearts(hearts: number): number {
  return hearts * 2;
}

const earthGrudgeFear: AbilityDef = {
  id: 'earth-grudge-fear',
  name: 'Earth Grudge Fear',
  cost: 2,
  speed: 'Normal',
  style: 'None',
  type: 'Taijutsu',
  isDamaging: true,
  targetSide: 'any', // "Deal 1 damage to any target" (SPEC.md §9's "any target" keyword)
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    const kakuzu = findOccupant(ctx.state, ctx.sourceInstanceId)?.occupant;
    const hardened = !!kakuzu && ((kakuzu.extra.ironSkinUntilTurn as number | undefined) ?? -1) >= ctx.state.turn;
    return dealDamage(ctx.state, target, hardened ? 3 : 1).state;
  },
};

// For the next turn cycle Kakuzu takes −2 from physical and −2 from elemental
// attacks (combat.ts reads ironSkinUntilTurn), and Earth Grudge Fear deals +2.
const ironSkin: AbilityDef = {
  id: 'iron-skin',
  name: 'Iron Skin',
  cost: 5,
  speed: 'Normal',
  style: 'Earth',
  type: 'Ninjutsu',
  maxTargets: 0,
  resolve: (ctx) => {
    const state = patchCharacter(ctx.state, ctx.sourceInstanceId, (k) => ({ ...k, extra: { ...k.extra, ironSkinUntilTurn: ctx.state.turn + 1 } }));
    return appendLog(state, 'Kakuzu hardens his skin: −2 from physical and −2 from elemental attacks, and Earth Grudge Fear deals +2, through the next turn.');
  },
};

const ELEMENTAL_STYLES: Style[] = ['Fire', 'Water', 'Wind', 'Earth', 'Lightning'];

/** Elemental Styles the character Kakuzu just defeated had (Patchwork Threads takes one — even one he already has). */
function stealableStyles(state: GameState, kakuzuId: string): Style[] {
  const found = findOccupant(state, kakuzuId);
  if (!found || !isCharacter(found.occupant)) return [];
  const defeated = (found.occupant.extra.lastKillStyles as Style[] | undefined) ?? [];
  return [...new Set(defeated.filter((s) => ELEMENTAL_STYLES.includes(s)))];
}

// Trigger: "whenever Kakuzu defeats any shinobi" — usable the same turn one
// of his attacks defeats a character (combat.ts credits the kill). 2 Chakra,
// paid from his Pool. Takes one elemental Style the defeated character had —
// the player's choice when there's more than one; duplicates are allowed.
const patchworkThreads: AbilityDef = {
  id: 'patchwork-threads',
  name: 'Earth Grudge Fear: Patchwork Threads',
  cost: 2,
  requiresFullPoolPayment: true,
  speed: 'Normal',
  style: 'None',
  type: 'Ninjutsu',
  isUltimate: true,
  maxTargets: 0,
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    return !!found && isCharacter(found.occupant) && found.occupant.extra.lastKillTurn === ctx.state.turn;
  },
  choices: (ctx) => {
    const options = stealableStyles(ctx.state, ctx.sourceInstanceId);
    return options.length > 1 ? [{ id: 'style', kind: 'option', prompt: 'Take which Style from the defeated character?', options: options.map((s) => ({ id: s, label: s })) }] : [];
  },
  resolve: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    if (!found || !(isCharacter(found.occupant))) return ctx.state;
    const { player, index, occupant: kakuzu } = found;
    const hearts = (kakuzu.extra.hearts as number) ?? 1;
    const newHearts = Math.min(5, hearts + 1);
    const capacity = poolCapacityForHearts(newHearts);

    const p = ctx.state.players[player];
    const backRow = p.backRow.slice();
    backRow[index] = {
      ...kakuzu,
      extra: { ...kakuzu.extra, hearts: newHearts },
      chakraPool: { current: Math.min(capacity, kakuzu.chakraPool.current + 2), capacity },
      maxHP: kakuzu.maxHP,
    };
    let state: GameState = { ...ctx.state, players: { ...ctx.state.players, [player]: { ...p, backRow } } };
    state = healOccupant(state, ctx.sourceInstanceId, 3);
    state = appendLog(state, `Kakuzu regenerates a Heart (now ${newHearts}), heals 3 and gains 2 Chakra to his Pool.`);
    const stealable = stealableStyles(state, ctx.sourceInstanceId);
    const chosen = typeof ctx.choices?.style === 'string' && stealable.includes(ctx.choices.style as Style) ? (ctx.choices.style as Style) : stealable.length === 1 ? stealable[0] : undefined;
    if (chosen) {
      state = patchCharacter(state, ctx.sourceInstanceId, (k) => ({ ...k, styles: [...k.styles, chosen], extra: { ...k.extra, lastKillStyles: [] } }));
      state = appendLog(state, `Kakuzu stitches in a new heart — he gains ${chosen} Style.`);
    }
    return state;
  },
};

registerCharacter({
  id: DEF_ID,
  name: 'Kakuzu',
  rank: 'A',
  baseMaxHP: 4,
  basePoolCapacity: poolCapacityForHearts(5),
  styles: ['Earth', 'Wind', 'Lightning', 'Fire'],
  abilities: [earthGrudgeFear, ironSkin],
  ultimate: patchworkThreads,
  elementalVersatility: true,
  initialExtra: { hearts: 5 },
  synergy: ['Akatsuki'],
  onEnterPlay: (state, _instanceId, player) => heartMasks(state, player),
});

// Heart Masks: when Kakuzu enters play (any way, the starting pick included),
// add 1 copy each of his three mask techniques to hand — from the Extra Deck in
// the Prototype, otherwise by searching the Jutsu Deck (then shuffling).
const HEART_MASK_CARDS = ['jutsu-pressure-damage', 'jutsu-searing-migraine', 'jutsu-false-darkness'];

function heartMasks(state: GameState, player: PlayerId): GameState {
  const p = state.players[player];
  if (isPrototype(state)) {
    const pile = (p.extraDeck ?? []).slice();
    const pulled: typeof pile = [];
    for (const defId of HEART_MASK_CARDS) {
      const i = pile.findIndex((c) => c.defId === defId);
      if (i >= 0) pulled.push(...pile.splice(i, 1));
    }
    const withMasks = [...p.hand, ...pulled.map((c) => ({ kind: 'card' as const, instanceId: c.instanceId, defId: c.defId }))];
    const pulledState = { ...state, players: { ...state.players, [player]: { ...p, extraDeck: pile, hand: withMasks } } };
    return appendLog(pulledState, `Heart Masks: ${player} adds ${pulled.length} mask card${pulled.length === 1 ? '' : 's'} from their Extra Deck to hand.`);
  }
  const deck = p.handDeck.slice();
  const found: typeof deck = [];
  for (const defId of HEART_MASK_CARDS) {
    const i = deck.findIndex((c) => c.defId === defId);
    if (i >= 0) found.push(...deck.splice(i, 1));
  }
  const hand = [...p.hand, ...found.map((c) => ({ kind: 'card' as const, instanceId: c.instanceId, defId: c.defId }))];
  const next = { ...state, players: { ...state.players, [player]: { ...p, handDeck: shuffle(deck), hand } } };
  return appendLog(next, `Heart Masks: ${player} searches the Jutsu Deck and adds ${found.length} mask card${found.length === 1 ? '' : 's'} to hand, then shuffles.`);
}

// Five Hearts (SPEC.md): whenever Kakuzu would be defeated with >1 Heart
// remaining, he loses 1 Heart + a Style and revives instead. This is the
// canonical validation case for the engine's onWouldBeDefeated hook.
registerDefeatHook(DEF_ID, (state, targetInstanceId) => {
  const found = findOccupant(state, targetInstanceId);
  if (!found || !(isCharacter(found.occupant))) return null;
  const { player, index, occupant: kakuzu } = found;
  const hearts = (kakuzu.extra.hearts as number) ?? 1;
  if (hearts <= 1) return null; // last Heart — true defeat proceeds normally.

  const newHearts = hearts - 1;
  const lostStyles = (kakuzu.extra.lostStyles as Style[]) ?? [];
  const remainingStyles = HEART_STYLE_ORDER.filter((s) => !lostStyles.includes(s) && kakuzu.styles.includes(s));
  const styleToLose = remainingStyles[0] ?? [...HEART_STYLE_ORDER, 'Water' as Style].find((s) => kakuzu.styles.includes(s));
  // Duplicate Styles (Patchwork Threads) — losing a Heart removes one copy.
  const dropAt = styleToLose ? kakuzu.styles.indexOf(styleToLose) : -1;
  const newStyles = dropAt >= 0 ? kakuzu.styles.filter((_, i) => i !== dropAt) : kakuzu.styles;
  const newLostStyles = styleToLose ? [...lostStyles, styleToLose] : lostStyles;

  const p = state.players[player];
  const backRow = p.backRow.slice();
  const capacity = poolCapacityForHearts(newHearts);
  backRow[index] = {
    ...kakuzu,
    currentHP: kakuzu.maxHP,
    styles: newStyles,
    // He keeps his Chakra, down to the smaller Pool's new maximum.
    chakraPool: { current: Math.min(kakuzu.chakraPool.current, capacity), capacity },
    extra: { ...kakuzu.extra, hearts: newHearts, lostStyles: newLostStyles },
  };
  const next = { ...state, players: { ...state.players, [player]: { ...p, backRow } } };
  return appendLog(
    next,
    `Kakuzu loses a Heart (${newHearts} left)${styleToLose ? ` and his ${styleToLose} Style` : ''}, then revives at full HP.`,
  );
});
