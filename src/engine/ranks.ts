import type { CharacterInstance } from './types';

/** SPEC.md §11 — Health Lost on Defeat, by Rank. */
export const HEALTH_LOST_ON_DEFEAT: Record<CharacterInstance['rank'], number> = {
  D: 1,
  C: 3,
  B: 4,
  A: 5,
  S: 7,
  SS: 9,
  SSS: 12,
};

/** SPEC.md §6.5 — standard per-rank Upkeep cost (Chakra/turn). Starting characters use their own table instead. */
export const UPKEEP_BY_RANK: Record<CharacterInstance['rank'], number> = {
  D: 0,
  C: 0,
  B: 1,
  A: 2,
  S: 3,
  SS: 4,
  SSS: 5,
};

/** Weakest to strongest — used by rank-comparison conditions (e.g. Kisame's Water Prison Jutsu). */
export const RANK_ORDER: CharacterInstance['rank'][] = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];

export function isLowerRank(a: CharacterInstance['rank'], b: CharacterInstance['rank']): boolean {
  return RANK_ORDER.indexOf(a) < RANK_ORDER.indexOf(b);
}
