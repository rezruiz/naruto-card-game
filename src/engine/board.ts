import { appendLog, otherPlayer } from './phases/phaseMachine';
import { enqueueChoice, registerChoiceResolver } from './choices';
import type {
  BoardOccupant,
  CharacterInstance,
  GameState,
  PlayerId,
  TokenInstance,
} from './types';

export const BACK_ROW_SIZE = 5;
export const FRONT_ROW_SIZE = 10;

// `rank` (not `chakraPool`) is the discriminator: Pain's Path tokens are the
// one Token type that also carries a chakraPool (§10 exception), so that
// field alone can no longer tell a Character and a Token apart. `rank` (and
// `ownerCharacterInstanceId`, its Token-only counterpart) stays unique to each.
export function isCharacter(occ: BoardOccupant): occ is CharacterInstance {
  return 'rank' in occ;
}

/**
 * Places a token in the first open front-row slot. Returns the unchanged
 * state (with a log note) if the front row is full (SPEC.md §10 — the flat
 * 10-slot cap, separate from any card-specific token cap the caller should
 * check itself before calling this).
 */
export function placeToken(state: GameState, player: PlayerId, token: TokenInstance, opts: { askPosition?: boolean } = {}): GameState {
  const p = state.players[player];
  const legal = legalTokenSlots(state, player);
  if (legal.length === 0) return state;
  const frontRow = p.frontRow.slice();
  // A token has Field Orientation the turn it's created (§6.6), like a
  // character — unless it has Ambush (e.g. Deidara's Clay Spiders) or its
  // creator already set the turn it entered.
  frontRow[legal[0]] = token.status.enteredTurn === -1 ? { ...token, status: { ...token.status, enteredTurn: state.turn } } : token;
  const next = { ...state, players: { ...state.players, [player]: { ...p, frontRow } } };
  // With other tokens already out, its controller picks where it goes (next to one of them), as part
  // of creating it — tokens can't be moved afterwards (§9). The first token on an empty row just goes in.
  const hadTokens = p.frontRow.some((t) => t !== null);
  if (!opts.askPosition || !hadTokens || legal.length < 2) return next;
  return enqueueChoice(next, {
    player,
    prompt: `Where does the new ${token.name} go?`,
    options: legal.map((i) => ({ id: String(i), label: `Front slot ${i + 1}` })),
    min: 1,
    max: 1,
    resolverId: TOKEN_SLOT_CHOICE,
    data: { tokenId: token.instanceId },
  });
}

/**
 * SPEC.md §9 positioning: a new character goes next to one of yours if it
 * can — into an empty slot beside a character, or into an occupied slot,
 * pushing the characters there aside. With no character in play, any slot.
 */
export function legalCharacterSlots(state: GameState, player: PlayerId): number[] {
  const row = state.players[player].backRow;
  const filled = row.flatMap((c, i) => (c ? [i] : []));
  if (filled.length === row.length) return [];
  if (filled.length === 0) return row.map((_, i) => i);
  const besideOne = row.flatMap((c, i) => (c === null && (row[i - 1] || row[i + 1]) ? [i] : []));
  return [...besideOne, ...filled].sort((a, b) => a - b);
}

/**
 * Tokens: a new token goes next to one of your tokens if it can (any empty
 * front slot otherwise). Unlike characters, tokens never push others aside —
 * once created, a token isn't repositioned.
 */
export function legalTokenSlots(state: GameState, player: PlayerId, ignoreId?: string): number[] {
  const row = state.players[player].frontRow.map((t) => (t && t.instanceId === ignoreId ? null : t));
  const empty = row.flatMap((t, i) => (t === null ? [i] : []));
  if (empty.length === row.length) return empty;
  const beside = empty.filter((i) => row[i - 1] || row[i + 1]);
  return beside.length > 0 ? beside : empty;
}

/** Puts `item` at `index`; if that slot is taken, the occupants between it and the nearest empty slot each shift one step toward that gap. */
function insertIntoRow<T>(row: (T | null)[], index: number, item: T): (T | null)[] | null {
  const out = row.slice();
  if (out[index] === null) {
    out[index] = item;
    return out;
  }
  let gap = -1;
  for (let d = 1; d < out.length && gap === -1; d++) {
    if (index + d < out.length && out[index + d] === null) gap = index + d;
    else if (index - d >= 0 && out[index - d] === null) gap = index - d;
  }
  if (gap === -1) return null;
  if (gap > index) for (let i = gap; i > index; i--) out[i] = out[i - 1];
  else for (let i = gap; i < index; i++) out[i] = out[i + 1];
  out[index] = item;
  return out;
}

const TOKEN_SLOT_CHOICE = 'token-slot';

registerChoiceResolver(TOKEN_SLOT_CHOICE, (state, choice, optionIds) => {
  const tokenId = choice.data.tokenId as string;
  const slot = Number(optionIds[0]);
  const p = state.players[choice.player];
  const from = p.frontRow.findIndex((t) => t?.instanceId === tokenId);
  if (from === -1 || from === slot) return state;
  // Re-check against the row as it is now (another new token may have landed since).
  if (!legalTokenSlots(state, choice.player, tokenId).includes(slot) || p.frontRow[slot] !== null) {
    return appendLog(state, `Front slot ${slot + 1} isn't available any more — the token stays where it is.`);
  }
  const frontRow = p.frontRow.slice();
  frontRow[slot] = frontRow[from];
  frontRow[from] = null;
  return { ...state, players: { ...state.players, [choice.player]: { ...p, frontRow } } };
});

/** Pain of the Six Paths has no CharacterInstance — his 6 Path tokens all point at this nominal id. */
export function painUnitId(player: PlayerId): string {
  return `pain-${player}`;
}

/** This player's Pain Path tokens in play (not his Beasts) — while any remain, Pain is a character in play. */
export function painPaths(state: GameState, player: PlayerId): TokenInstance[] {
  return state.players[player].frontRow.filter((t): t is TokenInstance => !!t?.extra.painPath);
}

export function countTokensOfType(state: GameState, player: PlayerId, defId: string): number {
  return state.players[player].frontRow.filter((t) => t?.defId === defId).length;
}

/**
 * Places a character in the first open back-row slot (SPEC.md §9 — new
 * units join at the right end of their row). Returns the unchanged state
 * (with a log note) if the back row is full (§6.5's 5-character cap) — the
 * caller should generally check room before paying any cost.
 */
export function placeCharacter(state: GameState, player: PlayerId, character: CharacterInstance, slot?: number): GameState {
  const p = state.players[player];
  const legal = legalCharacterSlots(state, player);
  if (legal.length === 0) return state;
  // The chosen slot if it's legal; otherwise the first empty legal slot.
  const target = slot !== undefined && legal.includes(slot) ? slot : (legal.find((i) => p.backRow[i] === null) ?? legal[0]);
  const backRow = insertIntoRow(p.backRow, target, character);
  if (!backRow) return state;
  return { ...state, players: { ...state.players, [player]: { ...p, backRow } } };
}

export function isToken(occ: BoardOccupant): occ is TokenInstance {
  return !isCharacter(occ);
}

/** Back-row column paired with a given front-row slot (SPEC.md §9). */
export function pairedBackColumn(frontIndex: number): number {
  return Math.floor(frontIndex / 2);
}

/** The 1-2 front-row slots paired with a given back-row column. */
export function pairedFrontSlots(backColumn: number): number[] {
  return [backColumn * 2, backColumn * 2 + 1];
}

export function findOccupant(
  state: GameState,
  instanceId: string,
): { player: PlayerId; zone: 'back' | 'front'; index: number; occupant: BoardOccupant } | null {
  for (const player of ['p1', 'p2'] as PlayerId[]) {
    const p = state.players[player];
    const backIndex = p.backRow.findIndex((c) => c?.instanceId === instanceId);
    if (backIndex !== -1) {
      return { player, zone: 'back', index: backIndex, occupant: p.backRow[backIndex]! };
    }
    const frontIndex = p.frontRow.findIndex((t) => t?.instanceId === instanceId);
    if (frontIndex !== -1) {
      return { player, zone: 'front', index: frontIndex, occupant: p.frontRow[frontIndex]! };
    }
  }
  return null;
}

/** Shared find-and-replace helper for a single back-row character's fields. */
export function patchCharacter(
  state: GameState,
  instanceId: string,
  patch: (c: CharacterInstance) => CharacterInstance,
): GameState {
  const found = findOccupant(state, instanceId);
  if (!found || !isCharacter(found.occupant)) return state;
  const { player, index, occupant } = found;
  const p = state.players[player];
  const backRow = p.backRow.slice();
  backRow[index] = patch(occupant);
  return { ...state, players: { ...state.players, [player]: { ...p, backRow } } };
}

/** Row-agnostic version of patchCharacter — works for a Token too (e.g. Pain's Path tokens, which carry their own Chakra Pool despite living in the front row). */
export function patchOccupant(
  state: GameState,
  instanceId: string,
  patch: (o: BoardOccupant) => BoardOccupant,
): GameState {
  const found = findOccupant(state, instanceId);
  if (!found) return state;
  const { player, zone, index, occupant } = found;
  const p = state.players[player];
  if (zone === 'back') {
    const backRow = p.backRow.slice();
    backRow[index] = patch(occupant) as (typeof backRow)[number];
    return { ...state, players: { ...state.players, [player]: { ...p, backRow } } };
  }
  const frontRow = p.frontRow.slice();
  frontRow[index] = patch(occupant) as (typeof frontRow)[number];
  return { ...state, players: { ...state.players, [player]: { ...p, frontRow } } };
}

export interface Adjacency {
  left: BoardOccupant | null;
  right: BoardOccupant | null;
  front: BoardOccupant | null;
  back: BoardOccupant | null;
}

/**
 * SPEC.md §9: same-row left/right, cross-row front/back via column pairing.
 * Only ever looks within the given player's own rows — never across players.
 */
export function getAdjacent(
  state: GameState,
  player: PlayerId,
  zone: 'back' | 'front',
  index: number,
): Adjacency {
  const p = state.players[player];
  const row = zone === 'back' ? p.backRow : p.frontRow;

  const left = index - 1 >= 0 ? row[index - 1] : null;
  const right = index + 1 < row.length ? row[index + 1] : null;

  let front: BoardOccupant | null = null;
  let back: BoardOccupant | null = null;
  if (zone === 'back') {
    // Back row occupant's "front" is whatever sits in its paired front slots.
    const [a, b] = pairedFrontSlots(index);
    front = p.frontRow[a] ?? p.frontRow[b] ?? null;
  } else {
    // Front row occupant's "back" is the character in its paired back column.
    back = p.backRow[pairedBackColumn(index)];
  }

  return { left, right, front, back };
}

/** Cross-pattern targets: up to 4 additional occupants around the epicenter (SPEC.md §9). */
export function getCrossPatternTargets(
  state: GameState,
  player: PlayerId,
  zone: 'back' | 'front',
  index: number,
): BoardOccupant[] {
  const { left, right, front, back } = getAdjacent(state, player, zone, index);
  return [left, right, front, back].filter((o): o is BoardOccupant => o !== null);
}

export function hasFieldOrientation(state: GameState, occ: BoardOccupant): boolean {
  if (occ.status.hasAmbush) return false;
  return occ.status.enteredTurn === state.turn;
}

/**
 * SPEC.md §9 free targeting + §6.5b Retreat immunity.
 * `anyTarget` mirrors the "any target" keyword override (enemy-only by default).
 */
export function getLegalTargets(
  state: GameState,
  sourcePlayer: PlayerId,
  opts: { anyTarget?: boolean; requireDamaging?: boolean } = {},
): BoardOccupant[] {
  const results: BoardOccupant[] = [];
  const players: PlayerId[] = opts.anyTarget ? ['p1', 'p2'] : [otherPlayer(sourcePlayer)];

  for (const player of players) {
    const p = state.players[player];
    const nonRetreatedExists = p.backRow.some((c) => c && !c.status.retreated);
    for (const occ of [...p.backRow, ...p.frontRow]) {
      if (!occ) continue;
      if (occ.status.retreated && nonRetreatedExists) continue; // §6.5b full immunity
      results.push(occ);
    }
  }

  if (opts.anyTarget) {
    // Allies are always legal for "any target"; nothing further to filter.
    return results;
  }
  return results;
}

/** Every unit id currently on the board, both players, both rows. */
export function occupantIds(state: GameState): Set<string> {
  const ids = new Set<string>();
  for (const player of ['p1', 'p2'] as PlayerId[]) {
    for (const o of [...state.players[player].backRow, ...state.players[player].frontRow]) if (o) ids.add(o.instanceId);
  }
  return ids;
}

/** Removes every mention of `goneId` from a tracked value: list entries naming it, record keys equal to it, fields pointing at it. */
function scrub(value: unknown, goneId: string): unknown {
  if (value === goneId) return undefined;
  if (Array.isArray(value)) {
    return value
      .filter((x) => !(x === goneId || (x && typeof x === 'object' && Object.values(x as object).includes(goneId))))
      .map((x) => scrub(x, goneId));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (key === goneId) continue;
      const kept = scrub(v, goneId);
      if (kept !== undefined) out[key] = kept;
    }
    return out;
  }
  return value;
}

/**
 * A unit left play (defeated, fizzled, returned to hand): lingering effects
 * other units track about it — scheduled burns or heals aimed at it, per-target
 * tallies, a Curse or target lock on it — are dropped, so nothing keeps
 * "happening" to a unit that's gone or credits anyone for it.
 */
export function purgeReferencesTo(state: GameState, goneIds: Iterable<string>): GameState {
  let next = state;
  for (const goneId of goneIds) {
    for (const id of occupantIds(next)) {
      next = patchOccupant(next, id, (o) => ({ ...o, extra: scrub(o.extra, goneId) as Record<string, unknown> }));
    }
  }
  return next;
}
