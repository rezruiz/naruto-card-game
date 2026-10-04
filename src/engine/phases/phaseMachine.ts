import { PHASE_ORDER, type CharacterStatus, type GameState, type Phase, type PlayerId } from '../types';
import { getCharacterDef, getTokenDef } from '../characters/registry';

export function nextPhase(phase: Phase): Phase {
  const index = PHASE_ORDER.indexOf(phase);
  return PHASE_ORDER[(index + 1) % PHASE_ORDER.length];
}

export function otherPlayer(player: PlayerId): PlayerId {
  return player === 'p1' ? 'p2' : 'p1';
}

/**
 * Advances the game by one phase, switching the active player and
 * incrementing the turn counter whenever End Phase is passed. There is
 * no automatic Chakra income (SPEC.md §5.1) — the only source of generic
 * Chakra is tapping Chakra sources (§5.2).
 */
export function advancePhase(state: GameState): GameState {
  const wrapping = state.phase === 'End';
  const phase = nextPhase(state.phase);
  const activePlayer = wrapping ? otherPlayer(state.activePlayer) : state.activePlayer;
  const turn = wrapping ? state.turn + 1 : state.turn;

  let next: GameState = {
    ...state,
    phase,
    activePlayer,
    turn,
    priorityPlayer: activePlayer,
    passesInARow: 0,
  };

  if (phase === 'End') {
    // §4.7's own effects run on the *next* advance (see the `wrapping` branch
    // below) — this is where each of the active player's characters gets a
    // chance to react to their own End Phase (e.g. Hidan's regen).
    next = runEndPhaseHooks(next, activePlayer);
    next = runAnyEndPhaseHooks(next, activePlayer);
  }
  if (phase === 'Upkeep') {
    next = runUpkeepHooks(next, activePlayer);
  }
  if (wrapping) {
    // §4.7: unspent generic Chakra never carries past End Phase — including Chakra the non-active player tapped to respond during this turn.
    next = clearGenericChakra(clearGenericChakra(next, state.activePlayer), otherPlayer(state.activePlayer));
  }
  if (phase === 'Untap') {
    next = untapPlayer(next, activePlayer);
    // A new turn begins for BOTH players: "once per turn" limits (and pool-XOR-act) apply per turn, so a Quick ability used on the opponent's turn is available again on this one.
    next = resetTurnUsage(next, otherPlayer(activePlayer));
  }

  return appendLog(next, `${activePlayer} enters ${phase} Phase (turn ${turn}).`);
}

/** A Disabled or Retreated character's triggered passives don't fire (§6.5a/§6.5b) — unless the hook only processes an already-activated ongoing effect. (Defeat-replacement passives are handled in combat.ts and always apply.) */
function hookMayRun(character: { status: CharacterStatus }, def: { runsHooksWhenInert?: string[] } | undefined, kind: string): boolean {
  if (!character.status.disabled && !character.status.retreated) return true;
  return !!def?.runsHooksWhenInert?.includes(kind);
}

function runEndPhaseHooks(state: GameState, player: PlayerId): GameState {
  let next = state;
  for (const character of state.players[player].backRow) {
    if (!character) continue;
    const def = getCharacterDef(character.defId);
    if (def?.onEndPhase && hookMayRun(character, def, 'endPhase')) {
      next = def.onEndPhase(next, character.instanceId);
    }
  }
  for (const token of next.players[player].frontRow) {
    if (!token) continue;
    const def = getTokenDef(token.defId);
    if (def?.onEndPhase) {
      next = def.onEndPhase(next, token.instanceId);
    }
  }
  return next;
}

function runAnyEndPhaseHooks(state: GameState, endingPlayer: PlayerId): GameState {
  let next = state;
  for (const owner of ['p1', 'p2'] as PlayerId[]) {
    for (const character of next.players[owner].backRow) {
      if (!character) continue;
      const def = getCharacterDef(character.defId);
      if (def?.onAnyEndPhase && hookMayRun(character, def, 'anyEndPhase')) {
        next = def.onAnyEndPhase(next, character.instanceId, endingPlayer);
      }
    }
  }
  return next;
}

function runUpkeepHooks(state: GameState, player: PlayerId): GameState {
  let next = state;
  for (const character of state.players[player].backRow) {
    if (!character) continue;
    const def = getCharacterDef(character.defId);
    if (def?.onUpkeep && hookMayRun(character, def, 'upkeep')) {
      next = def.onUpkeep(next, character.instanceId);
    }
  }
  // Almost always empty — Tokens don't usually have upkeep-triggered effects
  // of their own, but Pain's Naraka Path (delayed heal/revive) does.
  for (const token of next.players[player].frontRow) {
    if (!token) continue;
    const def = getTokenDef(token.defId);
    if (def?.onUpkeep) {
      next = def.onUpkeep(next, token.instanceId);
    }
  }
  return next;
}

function clearGenericChakra(state: GameState, player: PlayerId): GameState {
  return {
    ...state,
    players: {
      ...state.players,
      [player]: { ...state.players[player], genericChakraAvailable: 0 },
    },
  };
}

/**
 * Untap Phase: untaps Chakra sources (§4.1), and also resets every one of
 * this player's units' per-turn usage tracking — usedAbilitiesThisTurn and
 * pooledThisTurn (§5.3's pool-XOR-act rule) — since nothing else in the
 * engine ever clears them. Without this, any once-per-turn-capped ability
 * would become permanently unusable after its first activation.
 */
function untapPlayer(state: GameState, player: PlayerId): GameState {
  const p = state.players[player];
  return resetTurnUsage(
    {
      ...state,
      players: {
        ...state.players,
        [player]: { ...p, chakraSources: p.chakraSources.map(() => ({ tapped: false })), chakraSourcePlacedThisTurn: false },
      },
    },
    player,
  );
}

/** Per-turn bookkeeping that resets every turn for every unit: which abilities it used, whether it was pooled into, and which Attack-type Jutsu cards were played. */
function resetTurnUsage(state: GameState, player: PlayerId): GameState {
  const p = state.players[player];
  const resetStatus = <T extends { status: CharacterStatus }>(u: T | null): T | null =>
    u ? { ...u, status: { ...u.status, usedAbilitiesThisTurn: [], pooledThisTurn: false } } : null;
  return {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...p,
        attackJutsuUsedThisTurn: [],
        drawnThisDrawPhase: false,
        revealedHandCards: [],
        backRow: p.backRow.map(resetStatus),
        frontRow: p.frontRow.map(resetStatus),
      },
    },
  };
}

export function appendLog(state: GameState, text: string): GameState {
  return {
    ...state,
    log: [...state.log, { id: `log-${state.log.length + 1}`, turn: state.turn, phase: state.phase, text }],
  };
}

/** A log line only `player` gets to see (their declarations before the round is finalized). */
export function appendPrivateLog(state: GameState, player: PlayerId, text: string, warning = false): GameState {
  return {
    ...state,
    log: [...state.log, { id: `log-${state.log.length + 1}`, turn: state.turn, phase: state.phase, text, visibleTo: player, ...(warning ? { warning: true } : {}) }],
  };
}

/** Trust mode: logs an action the strict rules would refuse but trust mode let through — flagged so the UI shows it as a warning. */
export function appendWarning(state: GameState, text: string): GameState {
  return {
    ...state,
    log: [...state.log, { id: `log-${state.log.length + 1}`, turn: state.turn, phase: state.phase, text, warning: true }],
  };
}
