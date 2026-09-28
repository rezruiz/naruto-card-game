import { useCallback, useRef, useState } from 'react';
import { gameReducer } from '../engine/reducer';
import { createSetupState } from '../engine/state';
import { redactStateFor } from '../engine/redact';
import { hostGame, joinGame, type Connection, type ConnStatus } from './connection';
import type { GameAction, GameState, PlayerId } from '../engine/types';

export type NetMode = 'menu' | 'hosting' | 'joining' | 'playing';

/**
 * Ties the raw PeerJS connection (connection.ts) to the actual game: the
 * host keeps the one authoritative GameState (driven through the same pure
 * gameReducer local hotseat play already uses) and re-sends a
 * viewer-redacted copy to the guest after every change; the guest never
 * runs the reducer at all — its `state` is simply whatever the host last
 * pushed, and its `dispatch` just forwards the action over the wire.
 */
export function useNetGame() {
  const [mode, setMode] = useState<NetMode>('menu');
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const connRef = useRef<Connection | null>(null);
  const myPlayerId: PlayerId = connRef.current?.role === 'guest' ? 'p2' : 'p1';

  const teardown = useCallback(() => {
    connRef.current?.close();
    connRef.current = null;
  }, []);

  const host = useCallback(() => {
    teardown();
    setMode('hosting');
    setError(null);
    const conn = hostGame();
    connRef.current = conn;
    setRoomCode(conn.roomCode);

    conn.onStatus((s, detail) => {
      setStatus(s);
      if (s === 'error') setError(detail ?? 'Connection error.');
      if (s === 'connected') {
        // Host is always seat p1 and guest always p2 (for routing/redaction purposes only) — SPEC.md's actual coin-flip for who goes first still applies via createSetupState()'s own default.
        const initial = createSetupState(undefined, 'trust');
        setState(initial);
        setMode('playing');
        conn.send({ kind: 'state', state: redactStateFor(initial, 'p2') });
      }
    });
    conn.onMessage((msg) => {
      if (msg.kind !== 'action') return;
      setState((prev) => {
        if (!prev) return prev;
        const next = gameReducer(prev, msg.action);
        conn.send({ kind: 'state', state: redactStateFor(next, 'p2') });
        return next;
      });
    });
  }, [teardown]);

  const join = useCallback(
    (code: string) => {
      teardown();
      setMode('joining');
      setError(null);
      const conn = joinGame(code);
      connRef.current = conn;
      setRoomCode(conn.roomCode);

      conn.onStatus((s, detail) => {
        setStatus(s);
        if (s === 'error') setError(detail ?? 'Connection error.');
        if (s === 'connected') setMode('playing');
        if (s === 'disconnected') setMode('menu');
      });
      conn.onMessage((msg) => {
        if (msg.kind === 'state') setState(msg.state);
      });
    },
    [teardown],
  );

  const dispatch = useCallback((action: GameAction) => {
    const conn = connRef.current;
    if (!conn) return;
    if (conn.role === 'host') {
      setState((prev) => {
        if (!prev) return prev;
        const next = gameReducer(prev, action);
        conn.send({ kind: 'state', state: redactStateFor(next, 'p2') });
        return next;
      });
    } else {
      conn.send({ kind: 'action', action });
    }
  }, []);

  const leave = useCallback(() => {
    teardown();
    setMode('menu');
    setState(null);
    setRoomCode('');
    setError(null);
  }, [teardown]);

  return { mode, status, roomCode, error, state, myPlayerId, host, join, dispatch, leave };
}
