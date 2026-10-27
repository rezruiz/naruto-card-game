import { useState } from 'react';
import type { NetMode } from '../../net/useNetGame';
import type { ConnStatus } from '../../net/connection';
import { characterDeckSize, handDeckSize, validateDeck, type DeckList } from '../../engine/decklist';
import { RulesModal } from './RulesModal';
import { OTHER_VARIANT_LABEL, VARIANT, VARIANT_LABEL, otherVariantUrl } from '../../variant';

/** A deck dropdown, with a note when the chosen deck breaks the deck-building rules (it can still be played — this is a playtest build). */
function DeckPicker({ label, decks, value, onChange }: { label: string; decks: DeckList[]; value: string; onChange: (id: string) => void }) {
  const deck = decks.find((d) => d.id === value);
  const issues = deck ? validateDeck(deck).length : 0;
  return (
    <label className="lobby-deck">
      <span className="lobby-deck__label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {decks.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
            {validateDeck(d).length ? ' ⚠' : ''}
          </option>
        ))}
      </select>
      {deck && (
        <span className={issues ? 'lobby-deck__note lobby-deck__note--warn' : 'lobby-deck__note'}>
          {handDeckSize(deck)} hand cards · {characterDeckSize(deck)} characters
          {issues ? ` · ⚠ breaks ${issues} deck-building ${issues === 1 ? 'rule' : 'rules'} (still playable for testing)` : ' · ✓ legal'}
        </span>
      )}
    </label>
  );
}

export function LobbyScreen({
  mode,
  status,
  roomCode,
  error,
  onHost,
  onJoin,
  onPlayLocal,
  onCancel,
  decks,
  deckId,
  onSelectDeck,
  p2DeckId,
  onSelectP2Deck,
  onOpenLibrary,
}: {
  mode: NetMode;
  status: ConnStatus;
  roomCode: string;
  error: string | null;
  onHost: () => void;
  onJoin: (code: string) => void;
  onPlayLocal: () => void;
  onCancel: () => void;
  decks: DeckList[];
  deckId: string;
  onSelectDeck: (id: string) => void;
  /** Single-Player Testing plays both seats — this is the second seat's deck. */
  p2DeckId: string;
  onSelectP2Deck: (id: string) => void;
  onOpenLibrary: () => void;
}) {
  const [joinCode, setJoinCode] = useState('');
  const [showRules, setShowRules] = useState(false);

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

  if (mode === 'joining' || mode === 'playing') {
    return (
      <div className="lobby-screen">
        <h2>{mode === 'playing' ? 'Connected' : `Joining ${roomCode}`}</h2>
        <div>{mode === 'playing' ? 'Shuffling both decks and dealing…' : `Status: ${status}`}</div>
        {error && <div className="lobby-screen__error">{error}</div>}
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="lobby-screen">
      <h1>
        Naruto Custom Card Game <span className={`variant-badge variant-badge--${VARIANT}`}>{VARIANT_LABEL}</span>
      </h1>
      <p className="lobby-screen__variant">
        {VARIANT === 'prototype' ? 'Testing new rules — the base game is unaffected.' : 'The current game.'}{' '}
        <a href={otherVariantUrl()}>Switch to the {OTHER_VARIANT_LABEL} →</a>
      </p>
      <div className="lobby-screen__decks">
        <DeckPicker label="Your deck" decks={decks} value={deckId} onChange={onSelectDeck} />
        <button type="button" onClick={onOpenLibrary}>
          📚 Deck Library — build &amp; edit decks
        </button>
      </div>
      <div className="lobby-screen__menu">
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
        <div className="lobby-screen__local">
          <DeckPicker label="Player 2's deck (single-player testing)" decks={decks} value={p2DeckId} onChange={onSelectP2Deck} />
          <button type="button" onClick={onPlayLocal}>
            Single-Player Testing
          </button>
        </div>
        <button type="button" onClick={() => setShowRules(true)}>
          📖 Read the rules
        </button>
      </div>
      {error && <div className="lobby-screen__error">{error}</div>}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}
