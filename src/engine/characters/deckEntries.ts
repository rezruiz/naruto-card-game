import { placeCharacter, placeToken } from '../board';
import { createCharacterInstance, getCharacterDef } from './registry';
import { createSixPaths } from './pain';
import type { CharacterInstance, GameState, PlayerId } from '../types';

/**
 * The Character Deck's own card identity, distinct from the engine's
 * CharacterDef registry: almost always a 1:1 wrapper around a single
 * CharacterDef, but Pain of the Six Paths is the one card that spawns 6
 * Path tokens instead of a single CharacterInstance (he has no HP/Pool of
 * his own — SPEC.md's Six Paths trait), so "1 Character Deck card = 1
 * CharacterInstance" can't be assumed everywhere the deck system touches it.
 */
export interface CharacterDeckEntry {
  id: string;
  name: string;
  rank: CharacterInstance['rank'];
  /** Is there room to play this entry right now? (A normal character needs 1 open back-row slot; Pain needs 6 open front-row slots for his Path tokens.) */
  hasRoom: (state: GameState, player: PlayerId) => boolean;
  /** Places this entry's unit(s) onto the board for `player`, having already confirmed room/legality. */
  spawn: (state: GameState, player: PlayerId, turn: number, hasAmbush: boolean) => GameState;
}

let reinforcementCounter = 0;

function hasOpenBackRowSlot(state: GameState, player: PlayerId): boolean {
  return state.players[player].backRow.some((c) => c === null);
}

function spawnCharacter(defId: string): CharacterDeckEntry['spawn'] {
  return (state, player, turn, hasAmbush) => {
    reinforcementCounter += 1;
    const instance = createCharacterInstance(defId, player, `${player}-${defId}-r${reinforcementCounter}`, turn);
    return placeCharacter(state, player, hasAmbush ? { ...instance, status: { ...instance.status, hasAmbush: true } } : instance);
  };
}

const registry: Record<string, CharacterDeckEntry> = {};

function register(id: string, spawn: CharacterDeckEntry['spawn']): void {
  const def = getCharacterDef(id);
  if (!def) throw new Error(`Unknown Character Deck entry: ${id}`);
  registry[id] = { id, name: def.name, rank: def.rank, hasRoom: hasOpenBackRowSlot, spawn };
}

// One entry per CharacterDef, spawning a single instance the normal way —
// covers every character except Pain (special-cased below).
for (const defId of [
  'kakuzu',
  'hidan',
  'deidara',
  'kisame',
  'itachi',
  'konan',
  'sasori-hiruko',
  'zetsu',
  'juzo',
  'yahiko',
  'amegakure-civilian-rebel',
]) {
  register(defId, spawnCharacter(defId));
}

// Pain has no CharacterDef of his own — his "card" spawns all 6 Path tokens
// directly into the front row (SPEC.md's Six Paths trait), so his room check
// is against the front row's 6 open slots, not a back-row slot.
registry['pain'] = {
  id: 'pain',
  name: 'Pain of the Six Paths',
  rank: 'S',
  hasRoom: (state, player) => state.players[player].frontRow.filter((t) => t === null).length >= 6,
  spawn: (state, player, _turn, hasAmbush) => {
    let next = state;
    for (const token of createSixPaths(player)) {
      next = placeToken(next, player, hasAmbush ? { ...token, status: { ...token.status, hasAmbush: true } } : token);
    }
    return next;
  },
};

export function getCharacterDeckEntry(id: string): CharacterDeckEntry | undefined {
  return registry[id];
}

/**
 * The 13-card Akatsuki Character Deck (SPEC.md §2): 1 copy each of the 11
 * uniquely-named characters, plus 2 copies of Amegakure Civilian Rebel
 * (D-rank, exempt from the no-duplicates rule). Rank tally: S=3 (Kisame,
 * Itachi, Pain), A=4 (Kakuzu, Deidara, Konan, Sasori), B=3 (Hidan, Zetsu,
 * Juzo Biwa), C=1 (Yahiko), D=2 — every rank cap in §2 (max 3 S, 4 A, 4 B)
 * is met exactly, none exceeded.
 */
export const CHARACTER_DECK_MANIFEST: string[] = [
  'kakuzu',
  'hidan',
  'deidara',
  'kisame',
  'itachi',
  'konan',
  'sasori-hiruko',
  'zetsu',
  'juzo',
  'yahiko',
  'pain',
  'amegakure-civilian-rebel',
  'amegakure-civilian-rebel',
];
