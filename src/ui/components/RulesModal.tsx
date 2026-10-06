import { useEffect, useRef, useState, type MouseEvent } from 'react';

interface TocEntry {
  id: string;
  depth: number;
  text: string;
  children: TocEntry[];
}

interface Rulebook {
  html: string;
  /** Top-level groups (the Parts and Appendices, `#` headings) with their sections nested inside. */
  toc: TocEntry[];
}

/** Heading text as plain words for the contents list: drops Markdown markers and the [Updated]/[Playtest] tags. */
function plainHeading(text: string): string {
  return text
    .replace(/\*\*\[[^\]]+\]\*\*/g, '')
    .replace(/[*`]/g, '')
    .trim();
}

function slugify(text: string, used: Set<string>): string {
  const base =
    plainHeading(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'section';
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  used.add(id);
  return `rules-${id}`;
}

/**
 * Renders design/RULES.md into HTML (headings get ids) and builds a
 * linked, nested contents list from its headings. Everything before the
 * document's own "Table of Contents" — and that hand-written list itself —
 * is left out; the generated contents replace it.
 */
async function loadRulebook(): Promise<Rulebook> {
  const [{ Marked }, rules] = await Promise.all([import('marked'), import('../../../design/RULES.md?raw')]);
  const marked = new Marked();
  const all = marked.lexer(rules.default);
  let tokens = [...all];

  const tocStart = tokens.findIndex((t) => t.type === 'heading' && /table of contents/i.test(t.text));
  if (tocStart >= 0) {
    const firstSection = tokens.findIndex((t, i) => i > tocStart && t.type === 'heading');
    tokens = tokens.slice(firstSection >= 0 ? firstSection : tocStart + 1);
  }
  // Keep marked's link-reference table, which slice() drops.
  const content = Object.assign(tokens, { links: all.links });

  const used = new Set<string>();
  const ids: string[] = [];
  const toc: TocEntry[] = [];
  for (const t of content) {
    if (t.type !== 'heading' || t.depth > 3) continue;
    const entry: TocEntry = { id: slugify(t.text, used), depth: t.depth, text: plainHeading(t.text), children: [] };
    ids.push(entry.id);
    const group = toc[toc.length - 1];
    const section = group?.children[group.children.length - 1];
    if (t.depth === 1 || !group) toc.push(entry);
    else if (t.depth === 2 || !section) group.children.push(entry);
    else section.children.push(entry);
  }

  let headingIndex = 0;
  marked.use({
    renderer: {
      heading({ tokens: inline, depth }) {
        const id = depth <= 3 ? ids[headingIndex++] : undefined;
        return `<h${depth}${id ? ` id="${id}"` : ''}>${this.parser.parseInline(inline)}</h${depth}>\n`;
      },
    },
  });
  return { html: marked.parser(content), toc };
}

/**
 * The full rulebook (design/RULES.md) in a scrollable popup with a linked
 * contents list, so players can review the rules before hosting or joining a
 * game. The Markdown and its parser load on first open to keep them out of
 * the main bundle.
 */
export function RulesModal({ onClose }: { onClose: () => void }) {
  const [book, setBook] = useState<Rulebook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    loadRulebook()
      .then((loaded) => {
        if (!cancelled) setBook(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Scroll inside the popup instead of changing the page's URL hash.
  const jumpTo = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    bodyRef.current?.querySelector(`#${id}`)?.scrollIntoView({ block: 'start' });
  };

  const link = (entry: TocEntry) => (
    <a href={`#${entry.id}`} onClick={jumpTo(entry.id)}>
      {entry.text}
    </a>
  );

  return (
    <div className="details-overlay" onClick={onClose}>
      <div className="details-modal rules-modal" role="dialog" aria-label="Rules" onClick={(e) => e.stopPropagation()}>
        <div className="details-modal__header">
          <h2>Rules</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {error ? (
          <div className="lobby-screen__error">Couldn't load the rules: {error}</div>
        ) : book === null ? (
          <div className="rules-modal__body">Loading…</div>
        ) : (
          <div className="rules-modal__body" ref={bodyRef}>
            <nav className="rules-toc" id="rules-contents" aria-label="Contents">
              <h2>Contents</h2>
              {book.toc.map((group) => (
                <div key={group.id} className="rules-toc__group">
                  <div className="rules-toc__part">{link(group)}</div>
                  <ul>
                    {group.children.map((section) => (
                      <li key={section.id}>
                        {section.children.length > 0 ? (
                          <details>
                            <summary>{link(section)}</summary>
                            <ul>
                              {section.children.map((sub) => (
                                <li key={sub.id}>{link(sub)}</li>
                              ))}
                            </ul>
                          </details>
                        ) : (
                          <span className="rules-toc__leaf">{link(section)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
            {/* RULES.md is our own repo file, not user input, so rendering its HTML is safe. */}
            <div dangerouslySetInnerHTML={{ __html: book.html }} />
            <a className="rules-modal__top" href="#rules-contents" onClick={jumpTo('rules-contents')}>
              ↑ Contents
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
