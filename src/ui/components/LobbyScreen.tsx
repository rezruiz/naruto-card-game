import { useState } from 'react';
import type { NetMode } from '../../net/useNetGame';
import type { ConnStatus } from '../../net/connection';

export function LobbyScreen({
  mode,
  status,
  roomCode,
  error,
  onHost,
  onJoin,
  onPlayLocal,
  onCancel,
}: {
  mode: NetMode;
  status: ConnStatus;
  roomCode: string;
  error: string | null;
  onHost: () => void;
  onJoin: (code: string) => void;
  onPlayLocal: () => void;
  onCancel: () => void;
}) {
  const [joinCode, setJoinCode] = useState('');

  if (mode === 'hosting') {
    return (
      <div className="lobby-screen">
        <h2>Hosting a game</h2>
        {roomCode && (
          <div className="lobby-screen__code">
            Room code: <strong>{roomCode}</strong>
          </div>
        )}
        <div>Status: {status === 'waiting' ? 'Waiting for your friend to join…' : status}</div>
        {error && <div className="lobby-screen__error">{error}</div>}
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  }

  if (mode === 'joining') {
    return (
      <div className="lobby-screen">
        <h2>Joining {roomCode}</h2>
        <div>Status: {status}</div>
        {error && <div className="lobby-screen__error">{error}</div>}
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="lobby-screen">
      <h1>Naruto Custom Card Game</h1>
      <div className="lobby-screen__menu">
        <button type="button" onClick={onPlayLocal}>
          Single-Player Testing
        </button>
        <button type="button" onClick={onHost}>
          Host a game (invite a friend)
        </button>
        <div className="lobby-screen__join">
          <input
            type="text"
            placeholder="Room code"
            value={joinCode}
            maxLength={5}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          />
          <button type="button" disabled={joinCode.trim().length === 0} onClick={() => onJoin(joinCode)}>
            Join a game
          </button>
        </div>
      </div>
      {error && <div className="lobby-screen__error">{error}</div>}
    </div>
  );
}
