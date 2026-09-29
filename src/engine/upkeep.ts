import { patchCharacter } from './board';
import { getCharacterDef } from './characters/registry';
import { getHandCardDef } from './cards/registry';
import { UPKEEP_BY_RANK } from './ranks';
import type { CharacterInstance, GameState, PlayerId } from './types';

/**
 * SPEC.md §6.5's starting-character-rank table — replaces the normal Upkeep
 * table entirely for whichever character was chosen at Setup (§3). Only
 * C/B/A/S are covered by the card text; an uncovered rank (D, SS, SSS) falls
 * back to the normal table rather than being silently free.
 */
function startingCharacterTreatment(
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

/** SPEC.md §6.5 — 1 less Chakra per OTHER in-play character sharing at least one Synergy tag with this one, floor 0. */
function synergyDiscount(state: GameState, player: PlayerId, character: CharacterInstance): number {
  const mySynergy = getCharacterDef(character.defId)?.synergy ?? [];
  if (mySynergy.length === 0) return 0;
  let matches = 0;
  for (const other of state.players[player].backRow) {
    if (!other || other.instanceId === character.instanceId) continue;
    const theirSynergy = getCharacterDef(other.defId)?.synergy ?? [];
    if (theirSynergy.some((tag) => mySynergy.includes(tag))) matches += 1;
  }
  return matches;
}

/** SPEC.md §10a — a Terrain in play may reduce a matching-Synergy character's Upkeep by 1 (e.g. Akatsuki Hideout), on top of the character-count discount above. */
function terrainDiscount(state: GameState, player: PlayerId, character: CharacterInstance): number {
  const terrain = state.players[player].terrainInPlay;
  if (!terrain) return 0;
  const terrainDef = getHandCardDef(terrain.defId);
  const mySynergy = getCharacterDef(character.defId)?.synergy ?? [];
  const terrainSynergy = terrainDef?.synergy ?? [];
  return terrainSynergy.some((tag) => mySynergy.includes(tag)) ? 1 : 0;
}

function normalUpkeepCost(state: GameState, player: PlayerId, character: CharacterInstance): number {
  return Math.max(0, UPKEEP_BY_RANK[character.rank] - synergyDiscount(state, player, character) - terrainDiscount(state, player, character));
}

function setDisabled(state: GameState, instanceId: string, disabled: boolean): GameState {
  return patchCharacter(state, instanceId, (c) => ({ ...c, status: { ...c.status, disabled } }));
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
  const p = state.players[player];
  const startingId = p.startingCharacterInstanceId;
  const entries: UpkeepPreviewEntry[] = [];

  for (const character of p.backRow) {
    if (!character) continue;
    const isStarting = character.instanceId === startingId;
    const treatment = isStarting ? startingCharacterTreatment(character.rank) : null;

    if (treatment?.kind === 'grant') {
      entries.push({ instanceId: character.instanceId, name: character.name, rank: character.rank, isStarting, kind: 'grant', amount: treatment.amount });
    } else {
      const cost = treatment?.kind === 'pay' ? treatment.amount : normalUpkeepCost(state, player, character);
      entries.push({ instanceId: character.instanceId, name: character.name, rank: character.rank, isStarting, kind: cost === 0 ? 'free' : 'cost', amount: cost });
    }
  }
  return entries;
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

/**
 * SPEC.md §4.2/§6.5: pay per-character Upkeep at the start of this player's
 * Upkeep Phase. Payment is mandatory whenever affordable, paid in descending
 * cost order (ties broken by board position — no interactive tie-break
 * prompt exists yet, a documented simplification); anything left unpaid
 * Disables that character instead of defeating it (§6.5a). The starting
 * character (§3) is exempt from this table entirely, using its own
 * Rank-scaled treatment instead.
 */
export function payUpkeep(state: GameState, player: PlayerId): GameState {
  let next = state;
  const p = next.players[player];
  const startingId = p.startingCharacterInstanceId;

  const payable: { instanceId: string; cost: number }[] = [];
  for (const character of p.backRow) {
    if (!character) continue;
    const isStarting = character.instanceId === startingId;
    const treatment = isStarting ? startingCharacterTreatment(character.rank) : null;

    if (treatment?.kind === 'grant') {
      next = grantDirectly(next, character.instanceId, treatment.amount);
      next = setDisabled(next, character.instanceId, false);
      continue;
    }
    const cost = treatment?.kind === 'pay' ? treatment.amount : normalUpkeepCost(next, player, character);
    payable.push({ instanceId: character.instanceId, cost });
  }

  for (const entry of payable.filter((e) => e.cost === 0)) {
    next = setDisabled(next, entry.instanceId, false);
  }
  const owed = payable.filter((e) => e.cost > 0).sort((a, b) => b.cost - a.cost);
  for (const entry of owed) {
    if (untappedSourceCount(next, player) >= entry.cost) {
      next = tapSourcesForUpkeep(next, player, entry.cost);
      next = setDisabled(next, entry.instanceId, false);
    } else {
      next = setDisabled(next, entry.instanceId, true);
    }
  }

  return next;
}
