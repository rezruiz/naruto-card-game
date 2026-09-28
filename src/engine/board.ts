import { otherPlayer } from './phases/phaseMachine';
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
export function placeToken(state: GameState, player: PlayerId, token: TokenInstance): GameState {
  const p = state.players[player];
  const openIndex = p.frontRow.findIndex((t) => t === null);
  if (openIndex === -1) return state;
  const frontRow = p.frontRow.slice();
  frontRow[openIndex] = token;
  return { ...state, players: { ...state.players, [player]: { ...p, frontRow } } };
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
export function placeCharacter(state: GameState, player: PlayerId, character: CharacterInstance): GameState {
  const p = state.players[player];
  const openIndex = p.backRow.findIndex((c) => c === null);
  if (openIndex === -1) return state;
  const backRow = p.backRow.slice();
  backRow[openIndex] = character;
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

export function isSummoningSick(state: GameState, occ: BoardOccupant): boolean {
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
