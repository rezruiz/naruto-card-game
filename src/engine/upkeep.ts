import { painPaths, painUnitId, patchCharacter, patchOccupant } from './board';
import { getCharacterDef } from './characters/registry';
import { getHandCardDef } from './cards/registry';
import { UPKEEP_BY_RANK } from './ranks';
import { enqueueChoice, registerChoiceResolver } from './choices';
import { appendLog } from './phases/phaseMachine';
import type { CharacterInstance, GameState, PlayerId } from './types';

/**
 * SPEC.md §6.5's starting-character-rank table — replaces the normal Upkeep
 * table entirely for whichever character was chosen at Setup (§3). Only
 * C/B/A/S are covered by the card text; an uncovered rank (D, SS, SSS) falls
 * back to the normal table rather than being silently free.
 */
export function startingCharacterTreatment(
  rank: CharacterInstance['rank'],
): { kind: 'grant'; amount: number } | { kind: 'pay'; amount: number } | null {
  switch (rank) {
    case 'C':
      return { kind: 'grant', amount: 2 };
    case 'B':
      return { kind: 'grant', amount: 1 };
    case 'A':
      return { kind: 'pay', amount: 0 };
    case 'S':
      return { kind: 'pay', amount: 2 };
    default:
      return null;
  }
}

/** SPEC.md §6.5's cap on the whole board's Synergy discount. */
export const SYNERGY_DISCOUNT_CAP = 2;

/** SPEC.md §6.5: Synergy/Terrain discounts never take a character's Upkeep below 1 (a character whose Upkeep is already 0 stays free). */
export const MIN_DISCOUNTED_UPKEEP = 1;

/**
 * SPEC.md §6.5 — the Synergy discount is board-wide: −1 upkeep for each
 * character past the first in your largest group sharing a Synergy tag,
 * capped at −2 in total (e.g. two Akatsuki characters: −1; three or more:
 * −2). How it's spread across characters: see upkeepCosts.
 */
export function boardSynergyDiscount(state: GameState, player: PlayerId): number {
  const counts = new Map<string, number>();
  for (const c of upkeepUnits(state, player)) {
    for (const tag of new Set(c.synergy)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const largest = Math.max(0, ...counts.values());
  return Math.min(SYNERGY_DISCOUNT_CAP, Math.max(0, largest - 1));
}

/** SPEC.md §10a — a Terrain in play may reduce a matching-Synergy character's Upkeep by 1 (e.g. Akatsuki Hideout), on top of the character-count discount above. */
function terrainDiscount(state: GameState, player: PlayerId, unit: UpkeepUnit): number {
  const terrain = state.players[player].terrainInPlay;
  if (!terrain) return 0;
  const terrainSynergy = getHandCardDef(terrain.defId)?.synergy ?? [];
  return terrainSynergy.some((tag) => unit.synergy.includes(tag)) ? 1 : 0;
}

/** Something that pays Upkeep as one character: a back-row character, or Pain of the Six Paths (his Path tokens, while any stands). */
interface UpkeepUnit {
  instanceId: string;
  name: string;
  rank: CharacterInstance['rank'];
  synergy: string[];
}

/** Pain's Synergy (SPEC §13) — he has no CharacterDef of his own to read it from. */
const PAIN_SYNERGY = ['Akatsuki'];

function upkeepUnits(state: GameState, player: PlayerId): UpkeepUnit[] {
  const units: UpkeepUnit[] = state.players[player].backRow
    .filter((c): c is CharacterInstance => c !== null)
    .map((c) => ({ instanceId: c.instanceId, name: c.name, rank: c.rank, synergy: getCharacterDef(c.defId)?.synergy ?? [] }));
  if (painPaths(state, player).length > 0) {
    units.push({ instanceId: painUnitId(player), name: 'Pain of the Six Paths', rank: 'S', synergy: PAIN_SYNERGY });
  }
  return units;
}

interface UpkeepLine {
  character: UpkeepUnit;
  isStarting: boolean;
  /** The starting character's C/B treatment: gains Chakra instead of paying. */
  grant?: number;
  base: number;
  terrain: number;
  synergy: number;
  amount: number;
}

/**
 * What every character of this player owes this Upkeep: its base (the Rank
 * table, or the starting character's own amount), minus a matching Terrain,
 * then the board-wide Synergy discount spread over the most expensive costs
 * first (so it always saves as much as it can). Discounts stop at 1 per
 * character; a character that already costs 0 stays free.
 */
function upkeepCosts(state: GameState, player: PlayerId): UpkeepLine[] {
  const p = state.players[player];
  const lines: UpkeepLine[] = [];
  for (const character of upkeepUnits(state, player)) {
    const isStarting = character.instanceId === p.startingCharacterInstanceId;
    const treatment = isStarting ? startingCharacterTreatment(character.rank) : null;
    if (treatment?.kind === 'grant') {
      lines.push({ character, isStarting, grant: treatment.amount, base: 0, terrain: 0, synergy: 0, amount: 0 });
      continue;
    }
    const base = treatment?.kind === 'pay' ? treatment.amount : UPKEEP_BY_RANK[character.rank];
    // Discounts can't take a paying character below 1 (§6.5); one that's already free stays free.
    const terrain = treatment?.kind === 'pay' ? 0 : Math.min(Math.max(0, base - MIN_DISCOUNTED_UPKEEP), terrainDiscount(state, player, character));
    lines.push({ character, isStarting, base, terrain, synergy: 0, amount: base - terrain });
  }
  let discount = boardSynergyDiscount(state, player);
  const byCost = lines.filter((l) => l.grant === undefined).sort((a, b) => b.amount - a.amount);
  while (discount > 0) {
    const target = byCost.filter((l) => l.amount > MIN_DISCOUNTED_UPKEEP).sort((a, b) => b.amount - a.amount)[0];
    if (!target) break;
    target.amount -= 1;
    target.synergy += 1;
    discount -= 1;
  }
  return lines;
}

function setDisabled(state: GameState, instanceId: string, disabled: boolean): GameState {
  // Pain is his Path tokens: Disabling (or re-enabling) Pain applies to every Path.
  const pain = (['p1', 'p2'] as PlayerId[]).find((pl) => painUnitId(pl) === instanceId);
  if (pain) {
    let next = state;
    for (const path of painPaths(state, pain)) next = patchOccupant(next, path.instanceId, (o) => ({ ...o, status: { ...o.status, disabled } }));
    return next;
  }
  return patchCharacter(state, instanceId, (c) => ({ ...c, status: { ...c.status, disabled } }));
}

function unitName(state: GameState, player: PlayerId, instanceId: string): string {
  return upkeepUnits(state, player).find((u) => u.instanceId === instanceId)?.name ?? 'A character';
}

function grantDirectly(state: GameState, instanceId: string, amount: number): GameState {
  return patchCharacter(state, instanceId, (c) => ({
    ...c,
    chakraPool: { ...c.chakraPool, current: Math.min(c.chakraPool.capacity, c.chakraPool.current + amount) },
  }));
}

/**
 * Taps up to `amount` of this player's currently untapped Chakra sources,
 * spent directly on Upkeep — this Chakra never touches
 * genericChakraAvailable (SPEC.md §4.2: it must come from sources tapped
 * "this turn" specifically to cover Upkeep, not from the separate pool of
 * Chakra available for the rest of the turn's ordinary spending).
 */
function tapSourcesForUpkeep(state: GameState, player: PlayerId, amount: number): GameState {
  const p = state.players[player];
  let remaining = amount;
  const chakraSources = p.chakraSources.map((s) => {
    if (!s.tapped && remaining > 0) {
      remaining -= 1;
      return { tapped: true };
    }
    return s;
  });
  return { ...state, players: { ...state.players, [player]: { ...p, chakraSources } } };
}

function untappedSourceCount(state: GameState, player: PlayerId): number {
  return state.players[player].chakraSources.filter((s) => !s.tapped).length;
}

export interface UpkeepPreviewEntry {
  instanceId: string;
  name: string;
  rank: CharacterInstance['rank'];
  isStarting: boolean;
  /** 'grant' = gains Chakra into its own Pool instead of paying; 'free' = costs 0; 'cost' = owes `amount` Chakra. */
  kind: 'grant' | 'free' | 'cost';
  amount: number;
  /** How the amount was reached (normal characters only): the Rank's base upkeep and each discount taken off it. */
  breakdown?: { base: number; synergy: number; terrain: number };
}

/**
 * A read-only preview of what this player's NEXT Upkeep Phase would do to
 * each character currently in play, using today's board (Synergy/Terrain
 * discounts can still change before it actually happens) — for a UI panel
 * that lets a player see their Upkeep obligations ahead of time, not just
 * after the fact in the log. Mirrors payUpkeep's own logic exactly but
 * never mutates state.
 */
export function previewUpkeep(state: GameState, player: PlayerId): UpkeepPreviewEntry[] {
  return upkeepCosts(state, player).map((l) => {
    const common = { instanceId: l.character.instanceId, name: l.character.name, rank: l.character.rank, isStarting: l.isStarting };
    if (l.grant !== undefined) return { ...common, kind: 'grant' as const, amount: l.grant };
    return { ...common, kind: l.amount === 0 ? ('free' as const) : ('cost' as const), amount: l.amount, breakdown: { base: l.base, synergy: l.synergy, terrain: l.terrain } };
  });
}

/**
 * A one-line reminder of what Upkeep will look like for a Character Deck
 * card the player is currently choosing between (§3's Setup pick, or a §8
 * Reinforcement draw) — shown on the reveal panel so the choice isn't made
 * blind. `reason: 'setup'` means picking it makes it the STARTING character
 * (the "1st character" exemption table, §6.5, applies); `reason:
 * 'reinforcement'` means it goes to hand and will pay the normal per-rank
 * table once played later.
 */
export function upkeepReminderText(rank: CharacterInstance['rank'], reason: 'setup' | 'reinforcement'): string {
  if (reason === 'setup') {
    const treatment = startingCharacterTreatment(rank);
    if (treatment?.kind === 'grant') {
      return `As your starting character: no upkeep — instead gains +${treatment.amount} Chakra into its own Pool every Upkeep.`;
    }
    if (treatment?.kind === 'pay') {
      return treatment.amount === 0
        ? 'As your starting character: upkeep is free.'
        : `As your starting character: upkeep is ${treatment.amount} (reduced from the normal ${UPKEEP_BY_RANK[rank]}).`;
    }
    return `Rank ${rank} has no starting-character bonus — pays the normal Rank upkeep (${UPKEEP_BY_RANK[rank]}/turn) like any other character.`;
  }
  const base = UPKEEP_BY_RANK[rank];
  return base === 0
    ? 'Upkeep once played: free (Rank ' + rank + ').'
    : `Upkeep once played: ${base} Chakra/turn (Rank ${rank}; Synergy or Terrain may reduce it further).`;
}

type Owed = { instanceId: string; cost: number };

function payOne(state: GameState, player: PlayerId, entry: Owed): GameState {
  return setDisabled(tapSourcesForUpkeep(state, player, entry.cost), entry.instanceId, false);
}

function disableOne(state: GameState, player: PlayerId, entry: Owed): GameState {
  const name = unitName(state, player, entry.instanceId);
  return appendLog(setDisabled(state, entry.instanceId, true), `${name}'s Upkeep (${entry.cost}) can't be paid — it's Disabled.`);
}

/**
 * §4.2: pays `owed` highest cost first. Within a group tied at the same
 * cost, if the untapped sources cover some but not all of them, the PLAYER
 * chooses which to pay (a pending choice) — then the rest of the list
 * continues from there. Anything unaffordable is Disabled, not defeated.
 */
function payInOrder(state: GameState, player: PlayerId, owed: Owed[]): GameState {
  let next = state;
  const sorted = owed.slice().sort((a, b) => b.cost - a.cost);
  for (let i = 0; i < sorted.length; ) {
    const cost = sorted[i].cost;
    const group = sorted.filter((e) => e.cost === cost);
    const rest = sorted.slice(i + group.length);
    const affordable = Math.floor(untappedSourceCount(next, player) / cost);
    if (affordable >= group.length) {
      for (const e of group) next = payOne(next, player, e);
    } else if (affordable === 0) {
      for (const e of group) next = disableOne(next, player, e);
    } else {
      const nameOf = (id: string) => unitName(next, player, id);
      return enqueueChoice(next, {
        player,
        prompt: `Upkeep: you can pay for ${affordable} of these ${group.length} characters (${cost} Chakra each) — choose which; the others are Disabled.`,
        options: group.map((e) => ({ id: e.instanceId, label: nameOf(e.instanceId) })),
        min: affordable,
        max: affordable,
        resolverId: 'upkeep-tie',
        data: { group, rest },
      });
    }
    i += group.length;
  }
  return next;
}

registerChoiceResolver('upkeep-tie', (state, choice, optionIds) => {
  const group = choice.data.group as Owed[];
  const rest = choice.data.rest as Owed[];
  let next = state;
  for (const e of group) next = optionIds.includes(e.instanceId) ? payOne(next, choice.player, e) : disableOne(next, choice.player, e);
  return payInOrder(next, choice.player, rest);
});

/**
 * SPEC.md §4.2/§6.5: pay per-character Upkeep at the start of this player's
 * Upkeep Phase. Payment is mandatory whenever affordable, highest cost
 * first; the player chooses only between characters tied at the cost where
 * the Chakra runs out (payInOrder). Unpaid characters are Disabled instead
 * of defeated (§6.5a). The starting character (§3) is exempt from this
 * table entirely, using its own Rank-scaled treatment instead.
 */
export function payUpkeep(state: GameState, player: PlayerId): GameState {
  let next = state;
  const payable: { instanceId: string; cost: number }[] = [];
  for (const line of upkeepCosts(state, player)) {
    if (line.grant !== undefined) {
      next = grantDirectly(next, line.character.instanceId, line.grant);
      next = setDisabled(next, line.character.instanceId, false);
      continue;
    }
    payable.push({ instanceId: line.character.instanceId, cost: line.amount });
  }

  for (const entry of payable.filter((e) => e.cost === 0)) {
    next = setDisabled(next, entry.instanceId, false);
  }
  return payInOrder(next, player, payable.filter((e) => e.cost > 0));
}
