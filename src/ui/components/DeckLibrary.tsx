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
import type { HandCardDef } from '../../engine/cards/registry';
import { getCharacterCardText, getHandCardText } from '../cardInfo';
import { newDeckId } from '../deckStorage';
import { DetailsModal } from './DetailsModal';
import { CHARACTER_STYLE_CLASS, styleClass, RANK_ORDER, TYPE_LABEL, byCost, byRank, characterInfo, handCardCost, handCardSubtitle, handCardSummary } from '../cardDisplay';
import { FilterMenu, SortMenu, type Option } from './LibraryControls';
import { getCharacterDef, type CharacterDeckEntry } from '../../engine/characters';
import type { ReactNode } from 'react';
import './DeckLibrary.css';

// ---- Collection: sorting, sectioning, filtering ---------------------------------

type HandSort = 'type' | 'style' | 'cost' | 'name';
type CharSort = 'rank' | 'name' | 'hp';
const HAND_SORTS: Option<HandSort>[] = [
  { id: 'type', label: 'Type › Style › Cost' },
  { id: 'style', label: 'Style › Cost' },
  { id: 'cost', label: 'Cost' },
  { id: 'name', label: 'Name (A–Z)' },
];
const CHAR_SORTS: Option<CharSort>[] = [
  { id: 'rank', label: 'Rank' },
  { id: 'name', label: 'Name (A–Z)' },
  { id: 'hp', label: 'HP (high to low)' },
];
const TYPE_ORDER: HandCardDef['cardType'][] = ['jutsu', 'assist', 'mission', 'terrain'];
const TYPE_SECTION: Record<HandCardDef['cardType'], string> = { jutsu: 'Jutsu', assist: 'Assists', mission: 'Missions', terrain: 'Terrain' };
const COST_BUCKETS: Option[] = [
  { id: '0-1', label: '0–1' },
  { id: '2-3', label: '2–3' },
  { id: '4-5', label: '4–5' },
  { id: '6+', label: '6+' },
];

function costBucket(d: HandCardDef): string {
  const n = Number(handCardCost(d));
  if (Number.isNaN(n)) return '6+';
  return n <= 1 ? '0-1' : n <= 3 ? '2-3' : n <= 5 ? '4-5' : '6+';
}
const styleLabel = (st: string) => (st === 'None' ? 'No Style' : st);
/** Style order inside a section: No Style first, then A–Z. */
const byStyleName = (a: string, b: string) => (a === 'None' ? -1 : b === 'None' ? 1 : a.localeCompare(b));
function charStylesOf(c: CharacterDeckEntry): string[] {
  const st = (getCharacterDef(c.id)?.styles ?? []).filter((x) => x !== 'None');
  return st.length ? st : ['None'];
}

interface Group<T> {
  key: string;
  title?: string;
  items: T[];
}
interface Section<T> {
  key: string;
  title?: string;
  groups: Group<T>[];
}

function sectionHand(cards: HandCardDef[], sort: HandSort): Section<HandCardDef>[] {
  const sorted = [...cards].sort(sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : byCost);
  const byStyle = (list: HandCardDef[]): Group<HandCardDef>[] => {
    const keys = [...new Set(list.map((d) => d.style))].sort(byStyleName);
    return keys.map((k) => ({ key: k, title: keys.length > 1 ? styleLabel(k) : undefined, items: list.filter((d) => d.style === k) }));
  };
  if (sort === 'type') {
    return TYPE_ORDER.map((t) => ({ key: t, title: TYPE_SECTION[t], groups: byStyle(sorted.filter((d) => d.cardType === t)) })).filter((sec) => sec.groups.length > 0);
  }
  if (sort === 'style') {
    return byStyle(sorted).map((g) => ({ key: g.key, title: styleLabel(g.key), groups: [{ key: g.key, items: g.items }] }));
  }
  return sorted.length ? [{ key: 'all', groups: [{ key: 'all', items: sorted }] }] : [];
}

function sectionCharacters(chars: CharacterDeckEntry[], sort: CharSort): Section<CharacterDeckEntry>[] {
  if (sort === 'rank') {
    const sorted = [...chars].sort(byRank);
    return RANK_ORDER.filter((r) => sorted.some((c) => c.rank === r)).map((r) => ({ key: r, title: `${r} Rank`, groups: [{ key: r, items: sorted.filter((c) => c.rank === r) }] }));
  }
  const hp = (c: CharacterDeckEntry) => getCharacterDef(c.id)?.baseMaxHP ?? 0;
  const sorted = [...chars].sort(sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => hp(b) - hp(a) || a.name.localeCompare(b.name));
  return sorted.length ? [{ key: 'all', groups: [{ key: 'all', items: sorted }] }] : [];
}

function renderSections<T>(sections: Section<T>[], tile: (item: T) => ReactNode) {
  return sections.map((sec) => (
    <section key={sec.key} className="lib-section">
      {sec.title && (
        <h3 className="lib-section__title">
          {sec.title} <span>({sec.groups.reduce((n, g) => n + g.items.length, 0)})</span>
        </h3>
      )}
      {sec.groups.map((g) => (
        <div key={g.key} className="lib-section__group">
          {g.title && (
            <h4 className="lib-section__sub">
              {g.title} <span>({g.items.length})</span>
            </h4>
          )}
          <div className="collection__grid">{g.items.map(tile)}</div>
        </div>
      ))}
    </section>
  ));
}

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
  const [handSort, setHandSort] = useState<HandSort>('type');
  const [charSort, setCharSort] = useState<CharSort>('rank');
  const [handFilters, setHandFilters] = useState<Record<string, string[]>>({});
  const [charFilters, setCharFilters] = useState<Record<string, string[]>>({});
  const [handInDeck, setHandInDeck] = useState(false);
  const [charInDeck, setCharInDeck] = useState(false);
  const [details, setDetails] = useState<{ title: string; subtitle: string; text?: string } | null>(null);
  const readOnly = !!deck.preset;

  const hand = useMemo(() => handCardPool().sort(byCost), []);
  const characters = useMemo(() => characterPool().sort(byRank), []);
  const styles = useMemo(() => [...new Set(hand.map((d) => d.style).filter((s) => s !== 'None'))].sort(), [hand]);
  const charStyleList = useMemo(() => [...new Set(characters.flatMap((c) => charStylesOf(c)).filter((s) => s !== 'None'))].sort(), [characters]);
  const errors = validateDeck(deck);
  const query = search.trim().toLowerCase();

  const pass = (filters: Record<string, string[]>, group: string, value: string | string[]) => {
    const want = filters[group] ?? [];
    return want.length === 0 || (Array.isArray(value) ? value.some((v) => want.includes(v)) : want.includes(value));
  };
  const shownHand = hand.filter(
    (d) =>
      pass(handFilters, 'type', d.cardType) &&
      pass(handFilters, 'style', d.style) &&
      pass(handFilters, 'speed', d.speed) &&
      pass(handFilters, 'cost', costBucket(d)) &&
      (!handInDeck || (deck.handDeck[d.id] ?? 0) > 0) &&
      (!query || `${d.name} ${handCardSummary(d)}`.toLowerCase().includes(query)),
  );
  const shownCharacters = characters.filter(
    (c) =>
      pass(charFilters, 'rank', c.rank) &&
      pass(charFilters, 'style', charStylesOf(c)) &&
      (!charInDeck || (deck.characterDeck[c.id] ?? 0) > 0) &&
      (!query || c.name.toLowerCase().includes(query)),
  );
  const handSections = sectionHand(shownHand, handSort);
  const charSections = sectionCharacters(shownCharacters, charSort);

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
              <SortMenu options={HAND_SORTS} value={handSort} onChange={setHandSort} />
              <FilterMenu
                groups={[
                  { id: 'type', label: 'Type', options: TYPE_ORDER.map((t) => ({ id: t, label: TYPE_LABEL[t] })) },
                  { id: 'style', label: 'Style', options: [{ id: 'None', label: 'No Style' }, ...styles.map((st) => ({ id: st, label: st }))] },
                  { id: 'speed', label: 'Speed', options: ['Normal', 'Quick', 'Reactive'].map((sp) => ({ id: sp, label: sp })) },
                  { id: 'cost', label: 'Cost', options: COST_BUCKETS },
                ]}
                value={handFilters}
                onChange={setHandFilters}
                inDeckOnly={handInDeck}
                onInDeckOnly={setHandInDeck}
              />
            </>
          ) : (
            <>
              <SortMenu options={CHAR_SORTS} value={charSort} onChange={setCharSort} />
              <FilterMenu
                groups={[
                  { id: 'rank', label: 'Rank', options: RANK_ORDER.filter((r) => characters.some((c) => c.rank === r)).map((r) => ({ id: r, label: `${r} Rank` })) },
                  { id: 'style', label: 'Style', options: [{ id: 'None', label: 'No Style' }, ...charStyleList.map((st) => ({ id: st, label: st }))] },
                ]}
                value={charFilters}
                onChange={setCharFilters}
                inDeckOnly={charInDeck}
                onInDeckOnly={setCharInDeck}
              />
            </>
          )}
        </div>
        <p className="collection__hint">{readOnly ? 'Built-in deck — copy it to make changes.' : 'Click a card to add it · right-click to remove it · ⓘ for the full text.'}</p>

        {tab === 'characters'
          ? renderSections(charSections, (c) => {
                const inDeck = deck.characterDeck[c.id] ?? 0;
                const limit = copyLimit('character', c.id);
                const { hp, styles: charStyles } = characterInfo(c);
                const full = inDeck >= limit;
                return (
                  <div key={c.id} className={`lib-card lib-card--character ${CHARACTER_STYLE_CLASS}${full ? ' lib-card--maxed' : ''}${readOnly ? ' lib-card--readonly' : ''}`} {...tileHandlers('characters', c.id)}>
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
          : renderSections(handSections, (d) => {
                const inDeck = deck.handDeck[d.id] ?? 0;
                const limit = copyLimit('hand', d.id);
                return (
                  <div key={d.id} className={`lib-card lib-card--${d.cardType} ${styleClass(d.style)}${inDeck >= limit ? ' lib-card--maxed' : ''}${readOnly ? ' lib-card--readonly' : ''}`} {...tileHandlers('hand', d.id)}>
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
          {sectionHand(deckHand, 'type').map((sec) => (
            <div key={sec.key} className="deck-panel__type">
              <h4 className="deck-panel__type-title">
                {sec.title} <span>({sec.groups.reduce((n, g) => n + g.items.reduce((m, d) => m + (deck.handDeck[d.id] ?? 0), 0), 0)})</span>
              </h4>
              {sec.groups.flatMap((g) => g.items).map((d) => (
                <button type="button" key={d.id} className={`deck-row deck-row--${d.cardType}`} disabled={readOnly} title={readOnly ? undefined : 'Remove one'} onClick={() => setCount('hand', d.id, -1)}>
                  <span className="deck-row__cost">{handCardCost(d)}</span>
                  <span className="deck-row__name">{d.name}</span>
                  <span className="deck-row__count">×{deck.handDeck[d.id]}</span>
                </button>
              ))}
            </div>
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
