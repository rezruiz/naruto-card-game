export type PlayerId = 'p1' | 'p2';

export const PHASE_ORDER = [
  'Untap',
  'Upkeep',
  'Draw',
  'Main1',
  'Combat',
  'Main2',
  'End',
] as const;

export type Phase = (typeof PHASE_ORDER)[number];

export interface LogEntry {
  id: string;
  turn: number;
  phase: Phase;
  text: string;
}

export interface ChakraSource {
  tapped: boolean;
}

export interface CharacterInstance {
  instanceId: string;
  name: string;
  maxHP: number;
  currentHP: number;
  chakraPool: { current: number; capacity: number };
}

export interface PlayerState {
  id: PlayerId;
  health: number;
  genericChakraAvailable: number;
  chakraSources: ChakraSource[];
  chakraSourcePlacedThisTurn: boolean;
  hand: string[];
  board: CharacterInstance[];
}

export interface GameState {
  turn: number;
  activePlayer: PlayerId;
  phase: Phase;
  players: Record<PlayerId, PlayerState>;
  log: LogEntry[];
  winner: PlayerId | 'draw' | null;
}

export type GameAction =
  | { type: 'ADVANCE_PHASE' }
  | { type: 'PLACE_CHAKRA_SOURCE' }
  | { type: 'TAP_CHAKRA_SOURCE'; sourceIndex: number }
  | { type: 'POOL_CHAKRA'; instanceId: string; amount: number };
