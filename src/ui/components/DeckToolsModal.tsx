import { useState } from 'react';
import { getHandCardDef } from '../../engine/cards/registry';
import type { GameAction, GameState, PlayerId } from '../../engine/types';
import { DetailsModal } from './DetailsModal';
import { getHandCardText } from '../cardInfo';

export type DeckTool = 'search' | 'top' | 'discard' | 'consumed';

const cardName = (defId: string) => getHandCardDef(defId)?.name ?? 'Unknown card';

/** A Details toggle for a card listed by name — shows its full text inline, so a card can be read before it's taken, bottomed or returned. */
function CardDetailsToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" aria-expanded={open} onClick={onToggle}>
      {open ? 'Hide details' : 'Details'}
    </button>
  );
}

function CardDetailsText({ defId }: { defId: string }) {
  const def = getHandCardDef(defId);
  const text = def ? getHandCardText(def.name) : undefined;
  return <div className="deck-list__details">{text ?? 'No card text available.'}</div>;
}

/** Deck search, look-at-the-top-X, and the discard pile — the engine does the shuffling/moving, the player just picks. */
export function DeckToolsModal({
  state,
  player,
  tool,
  dispatch,
  onClose,
}: {
  state: GameState;
  player: PlayerId;
  tool: DeckTool;
  dispatch: (action: GameAction) => void;
  onClose: () => void;
}) {
  const p = state.players[player];
  const [topCount, setTopCount] = useState(3);
  /** Look at top: the exact cards seen (null until the player picks how many), and those already taken/bottomed. */
  const [seenIds, setSeenIds] = useState<string[] | null>(null);
  const [handledIds, setHandledIds] = useState<string[]>([]);
  /** Which listed card's full text is expanded (one at a time). */
  const [openId, setOpenId] = useState<string | null>(null);
  const details = (instanceId: string) => (
    <CardDetailsToggle open={openId === instanceId} onToggle={() => setOpenId((id) => (id === instanceId ? null : instanceId))} />
  );
  const detailsText = (instanceId: string, defId: string) => (openId === instanceId ? <CardDetailsText defId={defId} /> : null);

  if (tool === 'search') {
    const sorted = p.handDeck.slice().sort((a, b) => cardName(a.defId).localeCompare(cardName(b.defId)));
    return (
      <DetailsModal hideText title="Search deck" subtitle={`${p.handDeck.length} cards — taking one shuffles the deck afterward`} onClose={onClose}>
        <div className="deck-list">
          {sorted.length === 0 && <span className="details-modal__note">The deck is empty.</span>}
          {sorted.map((c) => (
            <div key={c.instanceId} className="deck-list__entry">
              <div className="deck-list__row">
                <span>{cardName(c.defId)}</span>
                <span>
                  {details(c.instanceId)}
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: 'DECK_TAKE', player, instanceId: c.instanceId, shuffle: true });
                      onClose();
                    }}
                  >
                    Take to hand
                  </button>
                </span>
              </div>
              {detailsText(c.instanceId, c.defId)}
            </div>
          ))}
        </div>
      </DetailsModal>
    );
  }

  if (tool === 'top') {
    // Step 1: choose how many to look at — nothing is revealed until you commit to a number.
    if (seenIds === null) {
      const max = p.handDeck.length;
      return (
        <DetailsModal hideText title="Look at the top of your deck" subtitle="Choose how many cards to look at first" onClose={onClose}>
          <div className="deck-list">
            {max === 0 ? (
              <span className="details-modal__note">The deck is empty.</span>
            ) : (
              <>
                <label className="deck-list__count">
                  Look at the top{' '}
                  <input
                    type="number"
                    min={1}
                    max={max}
                    value={Math.min(topCount, max)}
                    onChange={(e) => setTopCount(Math.max(1, Math.min(max, Number(e.target.value) || 1)))}
                  />{' '}
                  card(s)
                </label>
                <button type="button" onClick={() => setSeenIds(p.handDeck.slice(0, Math.min(topCount, max)).map((c) => c.instanceId))}>
                  Look
                </button>
              </>
            )}
          </div>
        </DetailsModal>
      );
    }

    // Step 2: only those exact cards — taking or bottoming one removes it from view; no new cards are revealed.
    const remaining = p.handDeck.filter((c, i) => seenIds.includes(c.instanceId) && !handledIds.includes(c.instanceId) && i < seenIds.length);
    const handle = (instanceId: string, action: GameAction) => {
      setHandledIds((prev) => [...prev, instanceId]);
      dispatch(action);
    };
    return (
      <DetailsModal
        hideText
        title={`Looking at ${seenIds.length} card(s)`}
        subtitle="Take a card or send it to the bottom. Whatever you leave stays on top in this order."
        onClose={onClose}
      >
        <div className="deck-list">
          {remaining.length === 0 && <span className="details-modal__note">Done — nothing left from the cards you looked at.</span>}
          {remaining.map((c, i) => (
            <div key={c.instanceId} className="deck-list__entry">
            <div className="deck-list__row">
              <span>
                {i + 1}. {cardName(c.defId)}
              </span>
              <span>
                {details(c.instanceId)}
                <button type="button" onClick={() => handle(c.instanceId, { type: 'DECK_TAKE', player, instanceId: c.instanceId, shuffle: false })}>
                  Take to hand
                </button>
                <button type="button" onClick={() => handle(c.instanceId, { type: 'DECK_TO_BOTTOM', player, instanceId: c.instanceId })}>
                  To bottom
                </button>
              </span>
            </div>
            {detailsText(c.instanceId, c.defId)}
            </div>
          ))}
          <button type="button" onClick={onClose}>
            Done
          </button>
        </div>
      </DetailsModal>
    );
  }

  if (tool === 'consumed') {
    return (
      <DetailsModal
        hideText
        title="Consumed pile"
        subtitle={`${p.consumedPile.length} cards consumed for Chakra — retrieving one also removes the Chakra source it produced`}
        onClose={onClose}
      >
        <div className="deck-list">
          {p.consumedPile.length === 0 && <span className="details-modal__note">Nothing has been Consumed for Chakra yet.</span>}
          {p.consumedPile.map((c) => (
            <div key={c.instanceId} className="deck-list__entry">
              <div className="deck-list__row">
                <span>{cardName(c.defId)}</span>
                <span>
                  {details(c.instanceId)}
                  <button
                    type="button"
                    title="Fixes an accidental or wrong Chakra placement — removes the linked source too"
                    onClick={() => dispatch({ type: 'RETURN_FROM_CONSUMED', player, instanceId: c.instanceId })}
                  >
                    Retrieve (undo placement)
                  </button>
                </span>
              </div>
              {detailsText(c.instanceId, c.defId)}
            </div>
          ))}
        </div>
      </DetailsModal>
    );
  }

  return (
    <DetailsModal hideText title="Discard pile" subtitle={`${p.discardPile.length} cards · ${p.consumedPile.length} consumed for Chakra`} onClose={onClose}>
      <div className="deck-list">
        {p.discardPile.length === 0 && <span className="details-modal__note">The discard pile is empty.</span>}
        {p.discardPile.map((c) => (
          <div key={c.instanceId} className="deck-list__entry">
            <div className="deck-list__row">
              <span>{cardName(c.defId)}</span>
              <span>
                {details(c.instanceId)}
                <button type="button" onClick={() => dispatch({ type: 'RETURN_FROM_DISCARD', player, instanceId: c.instanceId })}>
                  Return to hand
                </button>
              </span>
            </div>
            {detailsText(c.instanceId, c.defId)}
          </div>
        ))}
      </div>
    </DetailsModal>
  );
}
