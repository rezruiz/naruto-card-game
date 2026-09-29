import { findOccupant, isCharacter, patchCharacter } from '../board';
import { dealDamage, healOccupant, registerDefeatHook } from '../combat';
import { appendLog } from '../phases/phaseMachine';
import type { AbilityDef } from '../abilities';
import { registerCharacter } from './registry';
import type { GameState, Style } from '../types';

const DEF_ID = 'kakuzu';

// Five Hearts' Style-loss step needs an ordered list to drop from deterministically.
const HEART_STYLE_ORDER: Style[] = ['Fire', 'Lightning', 'Wind', 'Earth'];

function poolCapacityForHearts(hearts: number): number {
  return Math.max(0, hearts - 1) * 2;
}

const earthGrudgeFear: AbilityDef = {
  id: 'earth-grudge-fear',
  name: 'Earth Grudge Fear',
  cost: 1,
  speed: 'Normal',
  style: 'None',
  type: 'Taijutsu',
  isDamaging: true,
  targetSide: 'any', // "Deal 1 damage to any target" (SPEC.md §9's "any target" keyword)
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    return dealDamage(ctx.state, target, 1).state;
  },
};

const pressureDamage: AbilityDef = {
  id: 'pressure-damage',
  name: 'Pressure Damage',
  cost: 3,
  speed: 'Normal',
  style: 'Wind',
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

const searingMigraine: AbilityDef = {
  id: 'searing-migraine',
  name: 'Searing Migraine',
  cost: 4,
  speed: 'Normal',
  style: 'Fire',
  type: 'Ninjutsu',
  isDamaging: true,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    return dealDamage(ctx.state, target, 4).state;
  },
};

const falseDarkness: AbilityDef = {
  id: 'false-darkness',
  name: 'False Darkness',
  cost: 3,
  speed: 'Quick',
  style: 'Lightning',
  type: 'Ninjutsu',
  isDamaging: true,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    return dealDamage(ctx.state, target, 2).state;
  },
};

// "Kakuzu takes −2 damage from physical attacks and −1 from elemental attacks
// for the next turn cycle, and strikes for 2 physical damage." The reduction
// lasts through the opponent's next turn (combat.ts reads ironSkinUntilTurn).
const ironSkin: AbilityDef = {
  id: 'iron-skin',
  name: 'Iron Skin',
  cost: 5,
  speed: 'Normal',
  style: 'Earth',
  type: 'Ninjutsu',
  isDamaging: true,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    let state = patchCharacter(ctx.state, ctx.sourceInstanceId, (k) => ({ ...k, extra: { ...k.extra, ironSkinUntilTurn: ctx.state.turn + 1 } }));
    state = appendLog(state, 'Kakuzu hardens his skin: −2 from physical and −1 from elemental attacks until the end of the next turn.');
    if (target) state = dealDamage(state, target, 2).state;
    return state;
  },
};

const ELEMENTAL_STYLES: Style[] = ['Fire', 'Water', 'Wind', 'Earth', 'Lightning'];

/** Elemental Styles the character Kakuzu just defeated had that he doesn't (Patchwork Threads can take one). */
function stealableStyles(state: GameState, kakuzuId: string): Style[] {
  const found = findOccupant(state, kakuzuId);
  if (!found || !isCharacter(found.occupant)) return [];
  const k = found.occupant;
  const defeated = (k.extra.lastKillStyles as Style[] | undefined) ?? [];
  return defeated.filter((s) => ELEMENTAL_STYLES.includes(s) && !k.styles.includes(s));
}

// Trigger: "whenever Kakuzu defeats any shinobi" — usable the same turn one
// of his attacks defeats a character (combat.ts credits the kill), with 2+
// pooled. Takes one elemental Style the defeated character had that he
// doesn't — the player's choice when there's more than one.
const patchworkThreads: AbilityDef = {
  id: 'patchwork-threads',
  name: 'Earth Grudge Fear: Patchwork Threads',
  cost: 0,
  speed: 'Normal',
  style: 'None',
  type: 'Ninjutsu',
  isUltimate: true,
  maxTargets: 0,
  legalityCheck: (ctx) => {
    const found = findOccupant(ctx.state, ctx.sourceInstanceId);
    return !!found && isCharacter(found.occupant) && found.occupant.chakraPool.current >= 2 && found.occupant.extra.lastKillTurn === ctx.state.turn;
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
      chakraPool: { current: 2, capacity },
      maxHP: kakuzu.maxHP,
    };
    let state: GameState = { ...ctx.state, players: { ...ctx.state.players, [player]: { ...p, backRow } } };
    state = healOccupant(state, ctx.sourceInstanceId, 5);
    state = appendLog(state, `Kakuzu regenerates a Heart (now ${newHearts}) and ends with 2 Chakra pooled.`);
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
  baseMaxHP: 6,
  basePoolCapacity: poolCapacityForHearts(5),
  styles: ['Earth', 'Wind', 'Lightning', 'Fire'],
  abilities: [earthGrudgeFear, ironSkin, pressureDamage, searingMigraine, falseDarkness],
  ultimate: patchworkThreads,
  elementalVersatility: true,
  initialExtra: { hearts: 5 },
  synergy: ['Akatsuki'],
});

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
  const styleToLose = remainingStyles[0];
  const newStyles = styleToLose ? kakuzu.styles.filter((s) => s !== styleToLose) : kakuzu.styles;
  const newLostStyles = styleToLose ? [...lostStyles, styleToLose] : lostStyles;

  const p = state.players[player];
  const backRow = p.backRow.slice();
  backRow[index] = {
    ...kakuzu,
    currentHP: kakuzu.maxHP,
    styles: newStyles,
    chakraPool: { current: 0, capacity: poolCapacityForHearts(newHearts) },
    extra: { ...kakuzu.extra, hearts: newHearts, lostStyles: newLostStyles },
  };
  const next = { ...state, players: { ...state.players, [player]: { ...p, backRow } } };
  return appendLog(
    next,
    `Kakuzu loses a Heart (${newHearts} left)${styleToLose ? ` and his ${styleToLose} Style` : ''}, then revives at full HP.`,
  );
});
