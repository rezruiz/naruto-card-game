import { useCallback, useRef, useState } from 'react';
import { gameReducer } from '../engine/reducer';
import { createSetupState } from '../engine/state';
import { redactStateFor } from '../engine/redact';
import { hostGame, joinGame, type Connection, type ConnStatus } from './connection';
import { pushUndo, undoLabelFor, type UndoEntry } from '../ui/undo';
import type { GameAction, GameState, PlayerId } from '../engine/types';
import type { DeckList } from '../engine/decklist';

/** How long the host waits for the guest's deck before starting with the preset for them (e.g. a guest on an older build that never sends one). */
const GUEST_DECK_WAIT_MS = 5000;

export type NetMode = 'menu' | 'hosting' | 'joining' | 'playing';

/**
 * Ties the raw PeerJS connection (connection.ts) to the actual game: the
 * host keeps the one authoritative GameState (driven through the same pure
 * gameReducer local hotseat play already uses) and re-sends a
 * viewer-redacted copy to the guest after every change; the guest never
 * runs the reducer at all — its `state` is simply whatever the host last
 * pushed, and its `dispatch` just forwards the action over the wire.
 *
 * The host's OWN view is redacted too (hiding the guest's hand) — only the
 * authoritative copy the reducer runs on is ever unredacted. Undo history
 * and Restart also live on the host only; the guest requests them.
 */
export function useNetGame() {
  const [mode, setMode] = useState<NetMode>('menu');
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** Host: the full authoritative state. Guest: the redacted copy the host last pushed. */
  const [state, setState] = useState<GameState | null>(null);
  const [undoLabel, setUndoLabel] = useState<string | null>(null);
  const connRef = useRef<Connection | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const historyRef = useRef<UndoEntry[]>([]);
  /** Host: each seat's chosen deck — kept so Restart deals the same decks again. */
  const decksRef = useRef<Partial<Record<PlayerId, DeckList>>>({});
  const role = connRef.current?.role;
  const myPlayerId: PlayerId = role === 'guest' ? 'p2' : 'p1';

  const teardown = useCallback(() => {
    connRef.current?.close();
    connRef.current = null;
  }, []);

  /** Host only: commit a new authoritative state locally and push the guest's redacted copy. */
  const commit = useCallback((next: GameState) => {
    stateRef.current = next;
    setState(next);
    const label = historyRef.current.at(-1)?.label ?? null;
    setUndoLabel(label);
    connRef.current?.send({ kind: 'state', state: redactStateFor(next, 'p2'), undoLabel: label });
  }, []);

  const applyAction = useCallback(
    (action: GameAction) => {
      const prev = stateRef.current;
      if (!prev) return;
      const label = undoLabelFor(action);
      if (label) historyRef.current = pushUndo(historyRef.current, { state: prev, label });
      commit(gameReducer(prev, action));
    },
    [commit],
  );

  const undoOnHost = useCallback(() => {
    const entry = historyRef.current.at(-1);
    if (!entry) return;
    historyRef.current = historyRef.current.slice(0, -1);
    commit(entry.state);
  }, [commit]);

  const restartOnHost = useCallback(() => {
    historyRef.current = [];
    commit(createSetupState(undefined, 'trust', decksRef.current));
  }, [commit]);

  const host = useCallback((deck: DeckList) => {
    teardown();
    decksRef.current = { p1: deck };
    stateRef.current = null;
    setState(null);
    setMode('hosting');
    setError(null);
    const conn = hostGame();
    connRef.current = conn;
    setRoomCode(conn.roomCode);

    conn.onStatus((s, detail) => {
      setStatus(s);
      if (s === 'error') setError(detail ?? 'Connection error.');
      if (s === 'connected') {
        // Host is always seat p1 and guest always p2 (for routing/redaction purposes only) — who actually goes first is still a coin flip (createSetupState).
        // The game starts once the guest's deck arrives (they send it on connecting) — or after a short wait, with the preset for them.
        setMode('playing');
        window.setTimeout(() => {
          if (!stateRef.current && connRef.current === conn) restartOnHost();
        }, GUEST_DECK_WAIT_MS);
      }
    });
    conn.onMessage((msg) => {
      if (msg.kind === 'deck') {
        decksRef.current = { ...decksRef.current, p2: msg.deck };
        if (!stateRef.current) restartOnHost();
      } else if (msg.kind === 'action') applyAction(msg.action);
      else if (msg.kind === 'undo') undoOnHost();
      else if (msg.kind === 'restart') restartOnHost();
    });
  }, [teardown, applyAction, undoOnHost, restartOnHost]);

  const join = useCallback(
    (code: string, deck: DeckList) => {
      teardown();
      setMode('joining');
      setError(null);
      const conn = joinGame(code);
      connRef.current = conn;
      setRoomCode(conn.roomCode);

      conn.onStatus((s, detail) => {
        setStatus(s);
        if (s === 'error') setError(detail ?? 'Connection error.');
        if (s === 'connected') {
          setMode('playing');
          conn.send({ kind: 'deck', deck });
        }
        if (s === 'disconnected') setMode('menu');
      });
      conn.onMessage((msg) => {
        if (msg.kind === 'state') {
          setState(msg.state);
          setUndoLabel(msg.undoLabel ?? null);
        }
      });
    },
    [teardown],
  );

  const dispatch = useCallback(
    (action: GameAction) => {
      const conn = connRef.current;
      if (!conn) return;
      if (conn.role === 'host') applyAction(action);
      else conn.send({ kind: 'action', action });
    },
    [applyAction],
  );

  const undo = useCallback(() => {
    const conn = connRef.current;
    if (!conn) return;
    if (conn.role === 'host') undoOnHost();
    else conn.send({ kind: 'undo' });
  }, [undoOnHost]);

  const restart = useCallback(() => {
    const conn = connRef.current;
    if (!conn) return;
    if (conn.role === 'host') restartOnHost();
    else conn.send({ kind: 'restart' });
  }, [restartOnHost]);

  const leave = useCallback(() => {
    teardown();
    setMode('menu');
    setState(null);
    stateRef.current = null;
    historyRef.current = [];
    decksRef.current = {};
    setUndoLabel(null);
    setRoomCode('');
    setError(null);
  }, [teardown]);

  // The host renders from a redacted view so the guest's hand stays hidden on the host's screen too.
  const viewState = state && role === 'host' ? redactStateFor(state, 'p1') : state;

  return { mode, status, roomCode, error, state: viewState, myPlayerId, host, join, dispatch, leave, undo, undoLabel, restart };
}
