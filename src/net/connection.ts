import { Peer, type DataConnection } from 'peerjs';
import type { GameAction, GameState } from '../engine/types';

export type NetMessage = { kind: 'action'; action: GameAction } | { kind: 'state'; state: GameState };

export type ConnStatus = 'connecting' | 'waiting' | 'connected' | 'disconnected' | 'error';

export interface Connection {
  role: 'host' | 'guest';
  roomCode: string;
  send: (msg: NetMessage) => void;
  onMessage: (cb: (msg: NetMessage) => void) => void;
  onStatus: (cb: (status: ConnStatus, detail?: string) => void) => void;
  close: () => void;
}

/** Short, easy-to-read-aloud room code — used as the PeerJS peer id directly, prefixed so it doesn't collide with someone else's unrelated PeerJS traffic on the public broker. */
function randomRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const PEER_ID_PREFIX = 'naruto-ccg-';

/**
 * One player's browser hosts the game session (SPEC.md-external, M6 of the
 * playtest plan): no server to stand up, just PeerJS's free public broker
 * for the initial WebRTC handshake — once connected, game traffic flows
 * directly peer-to-peer. Waits for exactly one guest connection.
 */
export function hostGame(): Connection {
  const roomCode = randomRoomCode();
  const peer = new Peer(PEER_ID_PREFIX + roomCode);
  let dataConn: DataConnection | null = null;
  let statusCb: ((status: ConnStatus, detail?: string) => void) | null = null;
  let messageCb: ((msg: NetMessage) => void) | null = null;

  peer.on('open', () => statusCb?.('waiting'));
  peer.on('error', (err) => statusCb?.('error', err.message));

  peer.on('connection', (conn) => {
    dataConn = conn;
    conn.on('open', () => statusCb?.('connected'));
    conn.on('data', (data) => messageCb?.(data as NetMessage));
    conn.on('close', () => statusCb?.('disconnected'));
    conn.on('error', (err) => statusCb?.('error', err.message));
  });

  return {
    role: 'host',
    roomCode,
    send: (msg) => dataConn?.send(msg),
    onMessage: (cb) => {
      messageCb = cb;
    },
    onStatus: (cb) => {
      statusCb = cb;
    },
    close: () => {
      dataConn?.close();
      peer.destroy();
    },
  };
}

/** Connects to a host's room code. */
export function joinGame(roomCode: string): Connection {
  const peer = new Peer();
  let dataConn: DataConnection | null = null;
  let statusCb: ((status: ConnStatus, detail?: string) => void) | null = null;
  let messageCb: ((msg: NetMessage) => void) | null = null;

  peer.on('open', () => {
    statusCb?.('connecting');
    const conn = peer.connect(PEER_ID_PREFIX + roomCode.trim().toUpperCase());
    dataConn = conn;
    conn.on('open', () => statusCb?.('connected'));
    conn.on('data', (data) => messageCb?.(data as NetMessage));
    conn.on('close', () => statusCb?.('disconnected'));
    conn.on('error', (err) => statusCb?.('error', err.message));
  });
  peer.on('error', (err) => statusCb?.('error', err.message));

  return {
    role: 'guest',
    roomCode: roomCode.trim().toUpperCase(),
    send: (msg) => dataConn?.send(msg),
    onMessage: (cb) => {
      messageCb = cb;
    },
    onStatus: (cb) => {
      statusCb = cb;
    },
    close: () => {
      dataConn?.close();
      peer.destroy();
    },
  };
}
