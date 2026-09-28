import { useState } from 'react';
import { getHandCardDef } from '../../engine/cards/registry';
import type { GameAction, GameState, PlayerId } from '../../engine/types';
import { DetailsModal } from './DetailsModal';

export type DeckTool = 'search' | 'top' | 'discard';

const cardName = (defId: string) => getHandCardDef(defId)?.name ?? 'Unknown card';

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

  if (tool === 'search') {
    const sorted = p.handDeck.slice().sort((a, b) => cardName(a.defId).localeCompare(cardName(b.defId)));
    return (
      <DetailsModal hideText title="Search deck" subtitle={`${p.handDeck.length} cards — taking one shuffles the deck afterward`} onClose={onClose}>
        <div className="deck-list">
          {sorted.length === 0 && <span className="details-modal__note">The deck is empty.</span>}
          {sorted.map((c) => (
            <div key={c.instanceId} className="deck-list__row">
              <span>{cardName(c.defId)}</span>
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: 'DECK_TAKE', player, instanceId: c.instanceId, shuffle: true });
                  onClose();
                }}
              >
                Take to hand
              </button>
            </div>
          ))}
        </div>
      </DetailsModal>
    );
  }

  if (tool === 'top') {
    const top = p.handDeck.slice(0, topCount);
    return (
      <DetailsModal hideText title={`Top ${topCount} of deck`} subtitle="Take a card, or send it to the bottom — the rest stay in order on top" onClose={onClose}>
        <div className="deck-list">
          <label className="deck-list__count">
            Look at top{' '}
            <input type="number" min={1} max={Math.max(1, p.handDeck.length)} value={topCount} onChange={(e) => setTopCount(Math.max(1, Number(e.target.value) || 1))} /> cards
          </label>
          {top.length === 0 && <span className="details-modal__note">The deck is empty.</span>}
          {top.map((c, i) => (
            <div key={c.instanceId} className="deck-list__row">
              <span>
                {i + 1}. {cardName(c.defId)}
              </span>
              <span>
                <button type="button" onClick={() => dispatch({ type: 'DECK_TAKE', player, instanceId: c.instanceId, shuffle: false })}>
                  Take to hand
                </button>
                <button type="button" onClick={() => dispatch({ type: 'DECK_TO_BOTTOM', player, instanceId: c.instanceId })}>
                  To bottom
                </button>
              </span>
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
          <div key={c.instanceId} className="deck-list__row">
            <span>{cardName(c.defId)}</span>
            <button type="button" onClick={() => dispatch({ type: 'RETURN_FROM_DISCARD', player, instanceId: c.instanceId })}>
              Return to hand
            </button>
          </div>
        ))}
      </div>
    </DetailsModal>
  );
}
