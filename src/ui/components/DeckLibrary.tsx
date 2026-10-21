import { useMemo, useState, type MouseEvent } from 'react';
import {
  CHARACTER_DECK_MAX,
  CHARACTER_DECK_MIN,
  HAND_DECK_MAX,
  HAND_DECK_MIN,
  RANK_CAPS,
  characterDeckSize,
  characterPool,
  copyLimit,
  handCardPool,
  handDeckSize,
  presetDeck,
  validateDeck,
  type DeckList,
} from '../../engine/decklist';
import { getCharacterDef } from '../../engine/characters';
import type { HandCardDef } from '../../engine/cards/registry';
import type { CharacterDeckEntry } from '../../engine/characters';
import { getCharacterCardText, getHandCardText } from '../cardInfo';
import { newDeckId } from '../deckStorage';
import { DetailsModal } from './DetailsModal';
import './DeckLibrary.css';

// ---- Card display helpers ---------------------------------------------------

const RANK_ORDER = ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D'];
const TYPE_LABEL: Record<HandCardDef['cardType'], string> = { jutsu: 'Jutsu', assist: 'Assist', mission: 'Mission', terrain: 'Terrain' };

/** The printed Chakra cost, read from the card text (costs can depend on how they're paid, so the def's cost may be a function). */
function handCardCost(def: HandCardDef): string {
  const text = getHandCardText(def.name) ?? '';
  const m = /Cost:\s*(\d+)/.exec(text) ?? /(\d+)\s*Chakra/.exec(text);
  if (m) return m[1];
  return typeof def.cost === 'number' ? String(def.cost) : '?';
}

/** One line of what the card does, for the tile: its Effect, or a Mission's Condition. */
function handCardSummary(def: HandCardDef): string {
  const lines = (getHandCardText(def.name) ?? '').split('\n').map((l) => l.trim());
  const pick = (prefix: string) => {
    const i = lines.findIndex((l) => l.startsWith(prefix));
    if (i === -1) return null;
    const rest: string[] = [lines[i].slice(prefix.length).trim()];
    for (let j = i + 1; j < lines.length && lines[j] && !/^[A-Z][a-z]+:/.test(lines[j]); j++) rest.push(lines[j]);
    return rest.join(' ');
  };
  return pick('Effect:') ?? pick('Condition:') ?? lines.slice(1).join(' ');
}

function handCardSubtitle(def: HandCardDef): string {
  const parts = [TYPE_LABEL[def.cardType]];
  if (def.style !== 'None') parts.push(def.style);
  if (def.type !== 'None') parts.push(def.type);
  if (def.speed !== 'Normal') parts.push(def.speed);
  return parts.join(' · ');
}

interface CharacterInfo {
  hp: string;
  styles: string;
}

function characterInfo(entry: CharacterDeckEntry): CharacterInfo {
  const def = getCharacterDef(entry.id);
  if (!def) return { hp: '', styles: entry.id === 'pain' ? 'Enters as 6 Path tokens' : '' };
  const styles = def.styles.filter((s) => s !== 'None');
  return { hp: String(def.baseMaxHP), styles: styles.length ? styles.join(', ') : 'No Style' };
}

const byRank = (a: CharacterDeckEntry, b: CharacterDeckEntry) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank) || a.name.localeCompare(b.name);
const byCost = (a: HandCardDef, b: HandCardDef) => Number(handCardCost(a)) - Number(handCardCost(b)) || a.name.localeCompare(b.name);

// ---- Deck list (all decks) --------------------------------------------------

function DeckBox({
  deck,
  selected,
  onOpen,
  onUse,
  onCopy,
  onDelete,
}: {
  deck: DeckList;
  selected: boolean;
  onOpen: () => void;
  onUse: () => void;
  onCopy: () => void;
  onDelete?: () => void;
}) {
  const errors = validateDeck(deck);
  // Two-step delete, confirmed on the page itself (browser confirm() pop-ups can be silently blocked).
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  return (
    <div className={`deck-box${selected ? ' deck-box--selected' : ''}`}>
      <button type="button" className="deck-box__main" onClick={onOpen}>
        <span className="deck-box__name">
          {deck.name}
          {deck.preset && <span className="deck-box__tag">Built-in</span>}
          {selected && <span className="deck-box__tag deck-box__tag--selected">Selected</span>}
        </span>
        <span className="deck-box__counts">
          {handDeckSize(deck)} hand cards · {characterDeckSize(deck)} characters
        </span>
        <span className={errors.length ? 'deck-box__status deck-box__status--warn' : 'deck-box__status'}>
          {errors.length ? `⚠ ${errors.length} rule ${errors.length === 1 ? 'issue' : 'issues'}` : '✓ Ready to play'}
        </span>
      </button>
      {confirmingDelete && onDelete ? (
        <div className="deck-box__actions deck-box__actions--confirm">
          <span>Delete this deck? This can't be undone.</span>
          {/* "Keep it" sits where Delete was, so a double-click can't delete by accident. */}
          <button type="button" onClick={() => setConfirmingDelete(false)}>
            Keep it
          </button>
          <button type="button" className="deck-box__danger" onClick={onDelete}>
            Yes, delete
          </button>
        </div>
      ) : (
      <div className="deck-box__actions">
        <button type="button" onClick={onUse} disabled={selected}>
          {selected ? 'In use' : 'Use this deck'}
        </button>
        <button type="button" onClick={onOpen}>
          {deck.preset ? 'View' : 'Edit'}
        </button>
        <button type="button" onClick={onCopy}>
          Copy
        </button>
        {onDelete && (
          <button type="button" onClick={() => setConfirmingDelete(true)}>
            Delete
          </button>
        )}
      </div>
      )}
    </div>
  );
}

// ---- Deck editor -------------------------------------------------------------

type Tab = 'characters' | 'hand';

function CountBar({ label, count, min, max }: { label: string; count: number; min: number; max: number }) {
  const ok = count >= min && count <= max;
  return (
    <div className="deck-count">
      <div className="deck-count__label">
        <span>{label}</span>
        <strong className={ok ? 'deck-count__ok' : 'deck-count__bad'}>
          {count} / {min}–{max}
        </strong>
      </div>
      <div className="deck-count__track">
        <div className={`deck-count__fill${ok ? ' deck-count__fill--ok' : ''}`} style={{ width: `${Math.min(100, (count / max) * 100)}%` }} />
        <div className="deck-count__min" style={{ left: `${(min / max) * 100}%` }} />
      </div>
    </div>
  );
}

/** Deck edits are updater functions, applied to the latest saved deck — so quick repeated clicks never work from a stale copy. */
type DeckUpdate = (deck: DeckList) => DeckList;

function DeckEditor({ deck, onChange, onDone, onCopy }: { deck: DeckList; onChange: (update: DeckUpdate) => void; onDone: () => void; onCopy: () => void }) {
  const [tab, setTab] = useState<Tab>('characters');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | HandCardDef['cardType']>('all');
  const [styleFilter, setStyleFilter] = useState('all');
  const [rankFilter, setRankFilter] = useState('all');
  const [details, setDetails] = useState<{ title: string; subtitle: string; text?: string } | null>(null);
  const readOnly = !!deck.preset;

  const hand = useMemo(() => handCardPool().sort(byCost), []);
  const characters = useMemo(() => characterPool().sort(byRank), []);
  const styles = useMemo(() => [...new Set(hand.map((d) => d.style).filter((s) => s !== 'None'))].sort(), [hand]);
  const errors = validateDeck(deck);
  const query = search.trim().toLowerCase();

  const shownHand = hand.filter(
    (d) =>
      (typeFilter === 'all' || d.cardType === typeFilter) &&
      (styleFilter === 'all' || (styleFilter === 'None' ? d.style === 'None' : d.style === styleFilter)) &&
      (!query || `${d.name} ${handCardSummary(d)}`.toLowerCase().includes(query)),
  );
  const shownCharacters = characters.filter((c) => (rankFilter === 'all' || c.rank === rankFilter) && (!query || c.name.toLowerCase().includes(query)));

  const setCount = (kind: Tab, id: string, delta: number) => {
    if (readOnly) return;
    const key = kind === 'hand' ? 'handDeck' : 'characterDeck';
    const limit = copyLimit(kind === 'hand' ? 'hand' : 'character', id);
    onChange((latest) => {
      const current = latest[key][id] ?? 0;
      const next = Math.max(0, Math.min(limit, current + delta));
      if (next === current) return latest;
      const counts = { ...latest[key] };
      if (next === 0) delete counts[id];
      else counts[id] = next;
      return { ...latest, [key]: counts };
    });
  };

  /** Click adds a copy; right-click removes one (the Hearthstone collection's controls). */
  const tileHandlers = (kind: Tab, id: string) => ({
    onClick: () => setCount(kind, id, 1),
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      setCount(kind, id, -1);
    },
  });

  const info = (e: MouseEvent, title: string, subtitle: string, text: string | undefined) => {
    e.stopPropagation();
    setDetails({ title, subtitle, text });
  };

  const deckCharacters = characters.filter((c) => deck.characterDeck[c.id]);
  const deckHand = hand.filter((d) => deck.handDeck[d.id]);
  const rankCounts = deckCharacters.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.rank]: (acc[c.rank] ?? 0) + deck.characterDeck[c.id] }), {});

  return (
    <div className="deck-editor">
      <section className="collection">
        <div className="collection__tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'characters'} className={tab === 'characters' ? 'active' : ''} onClick={() => setTab('characters')}>
            Characters
          </button>
          <button type="button" role="tab" aria-selected={tab === 'hand'} className={tab === 'hand' ? 'active' : ''} onClick={() => setTab('hand')}>
            Jutsu Deck cards
          </button>
        </div>
        <div className="collection__filters">
          <input type="search" placeholder="Search cards…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {tab === 'hand' ? (
            <>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} aria-label="Card type">
                <option value="all">All types</option>
                {Object.entries(TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select value={styleFilter} onChange={(e) => setStyleFilter(e.target.value)} aria-label="Style">
                <option value="all">All Styles</option>
                <option value="None">No Style</option>
                {styles.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <select value={rankFilter} onChange={(e) => setRankFilter(e.target.value)} aria-label="Rank">
              <option value="all">All Ranks</option>
              {RANK_ORDER.filter((r) => characters.some((c) => c.rank === r)).map((r) => (
                <option key={r} value={r}>
                  {r} Rank
                </option>
              ))}
            </select>
          )}
        </div>
        <p className="collection__hint">{readOnly ? 'Built-in deck — copy it to make changes.' : 'Click a card to add it · right-click to remove it · ⓘ for the full text.'}</p>

        <div className="collection__grid">
          {tab === 'characters'
            ? shownCharacters.map((c) => {
                const inDeck = deck.characterDeck[c.id] ?? 0;
                const limit = copyLimit('character', c.id);
                const { hp, styles: charStyles } = characterInfo(c);
                const full = inDeck >= limit;
                return (
                  <div key={c.id} className={`lib-card lib-card--character${full ? ' lib-card--maxed' : ''}${readOnly ? ' lib-card--readonly' : ''}`} {...tileHandlers('characters', c.id)}>
                    <span className="lib-card__gem lib-card__gem--rank">{c.rank}</span>
                    <button type="button" className="lib-card__info" aria-label={`${c.name} details`} onClick={(e) => info(e, c.name, `${c.rank} Rank character`, getCharacterCardText(c.id))}>
                      ⓘ
                    </button>
                    <div className="lib-card__name">{c.name}</div>
                    <div className="lib-card__sub">{charStyles}</div>
                    {hp && <div className="lib-card__text">HP {hp}</div>}
                    {inDeck > 0 && <div className="lib-card__count">{limit === Infinity ? `×${inDeck}` : `${inDeck}/${limit}`}</div>}
                  </div>
                );
              })
            : shownHand.map((d) => {
                const inDeck = deck.handDeck[d.id] ?? 0;
                const limit = copyLimit('hand', d.id);
                return (
                  <div key={d.id} className={`lib-card lib-card--${d.cardType}${inDeck >= limit ? ' lib-card--maxed' : ''}${readOnly ? ' lib-card--readonly' : ''}`} {...tileHandlers('hand', d.id)}>
                    <span className="lib-card__gem">{handCardCost(d)}</span>
                    <button type="button" className="lib-card__info" aria-label={`${d.name} details`} onClick={(e) => info(e, d.name, handCardSubtitle(d), getHandCardText(d.name))}>
                      ⓘ
                    </button>
                    <div className="lib-card__name">{d.name}</div>
                    <div className="lib-card__sub">{handCardSubtitle(d)}</div>
                    <div className="lib-card__text">{handCardSummary(d)}</div>
                    {inDeck > 0 && (
                      <div className="lib-card__count">
                        {inDeck}/{limit}
                      </div>
                    )}
                  </div>
                );
              })}
          {(tab === 'characters' ? shownCharacters : shownHand).length === 0 && <p className="collection__empty">No cards match these filters.</p>}
        </div>
      </section>

      <aside className="deck-panel">
        <input
          className="deck-panel__name"
          value={deck.name}
          readOnly={readOnly}
          aria-label="Deck name"
          onChange={(e) => {
            const name = e.target.value;
            onChange((latest) => ({ ...latest, name }));
          }}
        />
        <CountBar label="Character Deck" count={characterDeckSize(deck)} min={CHARACTER_DECK_MIN} max={CHARACTER_DECK_MAX} />
        <div className="deck-panel__ranks">
          {Object.entries(RANK_CAPS).map(([rank, cap]) => (
            <span key={rank} className={(rankCounts[rank] ?? 0) > cap! ? 'deck-count__bad' : ''}>
              {rank}: {rankCounts[rank] ?? 0}/{cap}
            </span>
          ))}
        </div>
        <CountBar label="Jutsu Deck" count={handDeckSize(deck)} min={HAND_DECK_MIN} max={HAND_DECK_MAX} />

        <div className="deck-panel__list">
          <h3>Characters</h3>
          {deckCharacters.length === 0 && <p className="deck-panel__empty">No characters yet.</p>}
          {deckCharacters.map((c) => (
            <button type="button" key={c.id} className="deck-row" disabled={readOnly} title={readOnly ? undefined : 'Remove one'} onClick={() => setCount('characters', c.id, -1)}>
              <span className="deck-row__cost deck-row__cost--rank">{c.rank}</span>
              <span className="deck-row__name">{c.name}</span>
              <span className="deck-row__count">×{deck.characterDeck[c.id]}</span>
            </button>
          ))}
          <h3>Jutsu Deck</h3>
          {deckHand.length === 0 && <p className="deck-panel__empty">No cards yet.</p>}
          {deckHand.map((d) => (
            <button type="button" key={d.id} className={`deck-row deck-row--${d.cardType}`} disabled={readOnly} title={readOnly ? undefined : 'Remove one'} onClick={() => setCount('hand', d.id, -1)}>
              <span className="deck-row__cost">{handCardCost(d)}</span>
              <span className="deck-row__name">{d.name}</span>
              <span className="deck-row__count">×{deck.handDeck[d.id]}</span>
            </button>
          ))}
        </div>

        {errors.length > 0 && (
          <ul className="deck-panel__errors">
            {errors.map((err) => (
              <li key={err}>⚠ {err}</li>
            ))}
          </ul>
        )}
        <div className="deck-panel__actions">
          {readOnly ? (
            <button type="button" onClick={onCopy}>
              Copy this deck
            </button>
          ) : (
            <button type="button" onClick={() => onChange((latest) => ({ ...latest, handDeck: {}, characterDeck: {} }))} disabled={handDeckSize(deck) + characterDeckSize(deck) === 0}>
              Clear
            </button>
          )}
          <button type="button" className="deck-panel__done" onClick={onDone}>
            Done
          </button>
        </div>
      </aside>

      {details && <DetailsModal title={details.title} subtitle={details.subtitle} text={details.text} onClose={() => setDetails(null)} />}
    </div>
  );
}

// ---- The library screen --------------------------------------------------------

/**
 * The deck library (modeled on Hearthstone's collection): every deck you've
 * built, and an editor with the card pool on the left and the deck being
 * built on the right. Changes save as you make them.
 */
export function DeckLibrary({
  decks,
  selectedId,
  onDecksChange,
  onSelect,
  onBack,
}: {
  decks: DeckList[];
  selectedId: string;
  /** Updater over the latest deck list (saved by the caller). */
  onDecksChange: (update: (decks: DeckList[]) => DeckList[]) => void;
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = decks.find((d) => d.id === editingId) ?? null;

  const copyDeck = (deck: DeckList) => {
    const copy: DeckList = { ...deck, id: newDeckId(), name: `${deck.name} (copy)`, preset: false, handDeck: { ...deck.handDeck }, characterDeck: { ...deck.characterDeck } };
    onDecksChange((all) => [...all, copy]);
    setEditingId(copy.id);
  };

  const newDeck = () => {
    const deck: DeckList = { id: newDeckId(), name: `New Deck ${decks.filter((d) => !d.preset).length + 1}`, handDeck: {}, characterDeck: {} };
    onDecksChange((all) => [...all, deck]);
    setEditingId(deck.id);
  };

  const deleteDeck = (deck: DeckList) => {
    onDecksChange((all) => all.filter((d) => d.id !== deck.id));
    if (selectedId === deck.id) onSelect(presetDeck().id);
  };

  return (
    <div className="library">
      <header className="library__header">
        <button type="button" onClick={editing ? () => setEditingId(null) : onBack}>
          ← {editing ? 'All decks' : 'Back to lobby'}
        </button>
        <h1>{editing ? editing.name || 'Untitled deck' : 'Deck Library'}</h1>
      </header>

      {editing ? (
        <DeckEditor
          deck={editing}
          onChange={(update) => onDecksChange((all) => all.map((d) => (d.id === editing.id ? update(d) : d)))}
          onDone={() => setEditingId(null)}
          onCopy={() => copyDeck(editing)}
        />
      ) : (
        <div className="deck-grid">
          {decks.map((deck) => (
            <DeckBox
              key={deck.id}
              deck={deck}
              selected={deck.id === selectedId}
              onOpen={() => setEditingId(deck.id)}
              onUse={() => onSelect(deck.id)}
              onCopy={() => copyDeck(deck)}
              onDelete={deck.preset ? undefined : () => deleteDeck(deck)}
            />
          ))}
          <button type="button" className="deck-box deck-box--new" onClick={newDeck}>
            <span className="deck-box__plus">+</span>
            New Deck
          </button>
        </div>
      )}
    </div>
  );
}
