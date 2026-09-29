import { useReducer, useState } from 'react';
import { gameReducer, setupPending } from './engine/reducer';
import { createSetupState } from './engine/state';
import { findOccupant, isCharacter } from './engine/board';
import { findAbility } from './engine/abilities';
import { getCharacterDeckEntry } from './engine/characters';
import { reinforcementCost } from './engine/playCharacter';
import { getHandCardDef } from './engine/cards/registry';
import { missionProgressText } from './engine/cards/missions';
import type { GameState, HandEntry, PlayerId } from './engine/types';
import { cardStage, newPendingCard, toHandCardContext, type PendingCard } from './ui/cardFlow';
import { getHandCardText } from './ui/cardInfo';
import { ActionLog } from './ui/components/ActionLog';
import { DeckToolsModal, type DeckTool } from './ui/components/DeckToolsModal';
import { UpkeepPanel } from './ui/components/UpkeepPanel';
import { previewUpkeep } from './engine/upkeep';
import { StagedPanel } from './ui/components/StagedPanel';
import { CharacterDetailsModal } from './ui/components/CharacterDetailsModal';
import { DetailsModal } from './ui/components/DetailsModal';
import { ChakraSourceRow } from './ui/components/ChakraSourceRow';
import { CharacterCard } from './ui/components/CharacterCard';
import { CharacterRevealPanel } from './ui/components/CharacterRevealPanel';
import { LobbyScreen } from './ui/components/LobbyScreen';
import { TokenCard } from './ui/components/TokenCard';
import { HandView } from './ui/components/HandView';
import { PhaseIndicator } from './ui/components/PhaseIndicator';
import { PlayerHealthBar } from './ui/components/PlayerHealthBar';
import { TurnControls } from './ui/components/TurnControls';
import { useNetGame } from './net/useNetGame';
import './App.css';

const MAIN_PHASES = new Set(['Main1', 'Main2']);

type PendingAbility = {
  kind: 'ability';
  playerId: PlayerId;
  instanceId: string;
  abilityId: string;
  maxTargets: number;
  targets: string[];
  /** Set when re-aiming an already-declared (staged) action instead of declaring a new one. */
  stagedId?: string;
};

type Pending = PendingAbility | PendingCard | null;

type Details = { kind: 'occupant'; instanceId: string } | { kind: 'card'; name: string; subtitle: string; text?: string } | null;

/** A Terrain/Mission in play: its name and, for a Mission, a live progress readout (e.g. "2/6 Untaps"). Clicking opens the full card text. Face-down (hidden) Missions show no name and can't be opened. */
function InPlayChip({ label, name, progress, onOpen }: { label: string; name: string | undefined; progress?: string; onOpen: (name: string) => void }) {
  if (!name) return <span className="in-play-chip in-play-chip--hidden">Face-down {label}</span>;
  return (
    <button type="button" className="in-play-chip" title="Click for card text" onClick={() => onOpen(name)}>
      {label}: {name}
      {progress && <span className="in-play-chip__progress"> · {progress}</span>}
    </button>
  );
}

/** A local, uncommitted +/- stepper — its own useState so clicking +/- only adjusts the on-screen draft, and nothing is dispatched until Confirm. */
function AmountStepper({
  label,
  max,
  onConfirm,
  onCancel,
}: {
  label: string;
  max: number;
  onConfirm: (n: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(Math.min(1, max));
  return (
    <>
      <span>
        {label}: <strong>{value}</strong> (max {max})
      </span>
      <span>
        <button type="button" disabled={value <= 0} onClick={() => setValue((v) => Math.max(0, v - 1))}>
          −
        </button>
        <button type="button" disabled={value >= max} onClick={() => setValue((v) => Math.min(max, v + 1))}>
          +
        </button>
        <button type="button" onClick={() => onConfirm(value)}>
          Confirm
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </span>
    </>
  );
}

/** Renders the right control for wherever a card-in-progress currently is in its enabler -> pool-discount -> target(s) -> amount pipeline. */
function PendingCardBanner({
  pending,
  state,
  onChoosePayFromPool,
  onConfirmTargets,
  onChooseAmount,
  onCancel,
}: {
  pending: PendingCard;
  state: GameState;
  onChoosePayFromPool: (n: number) => void;
  onConfirmTargets: () => void;
  onChooseAmount: (n: number) => void;
  onCancel: () => void;
}) {
  const stage = cardStage(pending);
  const ctx = toHandCardContext(state, pending);

  if (stage === 'enabler') {
    return (
      <>
        <span>Choose a character to enable {pending.def.name}</span>
        <span>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </span>
      </>
    );
  }

  if (stage === 'payFromPool') {
    const found = findOccupant(state, pending.enablingInstanceId);
    const poolAvailable = found && isCharacter(found.occupant) ? found.occupant.chakraPool.current : 0;
    const fullCost = typeof pending.def.cost === 'function' ? pending.def.cost(ctx, 0) : pending.def.cost;
    const discountedCost = typeof pending.def.cost === 'function' ? pending.def.cost(ctx, 1) : pending.def.cost;
    const poolPay = Math.min(discountedCost, poolAvailable);
    return (
      <>
        <span>{pending.def.name}: choose how to pay</span>
        <span>
          <button type="button" onClick={() => onChoosePayFromPool(0)}>
            Pay {fullCost} Chakra (generic)
          </button>
          <button type="button" disabled={poolAvailable === 0} onClick={() => onChoosePayFromPool(poolPay)}>
            Pay {discountedCost} Chakra (from Pool)
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </span>
      </>
    );
  }

  if (stage === 'target') {
    const maxTargets = pending.def.maxTargets ?? 1;
    return (
      <>
        <span>
          Choose {maxTargets > 1 ? `up to ${maxTargets} targets` : 'a target'} ({pending.targets.length}/{maxTargets} selected)
        </span>
        <span>
          {pending.targets.length > 0 && (
            <button type="button" onClick={onConfirmTargets}>
              Confirm
            </button>
          )}
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </span>
      </>
    );
  }

  if (stage === 'amount') {
    const max = pending.def.maxAmount?.(ctx) ?? 0;
    return <AmountStepper label={pending.def.amountLabel ?? 'Amount'} max={max} onConfirm={onChooseAmount} onCancel={onCancel} />;
  }

  return null; // 'ready' — advanceCard dispatches immediately, this never actually renders.
}

function ViewGame({
  state,
  dispatch,
  myPlayerId,
  onLeave,
}: {
  state: GameState;
  dispatch: (action: Parameters<typeof gameReducer>[1]) => void;
  /** null = local hotseat (both boards are "yours"); 'p1'/'p2' = networked (only that board is interactive). */
  myPlayerId: PlayerId | null;
  onLeave?: () => void;
}) {
  const [pending, setPending] = useState<Pending>(null);
  const [details, setDetails] = useState<Details>(null);
  // Seated across the table: you're always the bottom board, your opponent the top. (Local hotseat has no single 'you', so P1 sits at the bottom.)
  const bottomId: PlayerId = myPlayerId ?? 'p1';
  const topId: PlayerId = bottomId === 'p1' ? 'p2' : 'p1';
  const [deckTool, setDeckTool] = useState<{ player: PlayerId; tool: DeckTool } | null>(null);
  // Trust mode (playtesting): players agree on timing out loud, so nothing is phase-gated in the UI.
  const trust = state.rules === 'trust';
  const canAct = trust || MAIN_PHASES.has(state.phase);
  const isMyBoard = (playerId: PlayerId) => myPlayerId === null || myPlayerId === playerId;

  /** Trust mode declares (stages) the action for later resolution; strict mode activates it right away. */
  function submitAbility(instanceId: string, abilityId: string, targets: string[]) {
    dispatch(
      trust
        ? { type: 'STAGE_ABILITY', instanceId, abilityId, targetInstanceIds: targets, payFromPool: 0 }
        : { type: 'ACTIVATE_ABILITY', instanceId, abilityId, targetInstanceIds: targets, payFromPool: 0 },
    );
  }

  function finishAbility(p: PendingAbility, targets: string[]) {
    if (p.stagedId) dispatch({ type: 'RETARGET_STAGED', stagedId: p.stagedId, targetInstanceIds: targets });
    else submitAbility(p.instanceId, p.abilityId, targets);
    setPending(null);
  }

  /** How many targets a declared action takes (0 = nothing to re-aim). */
  function retargetMax(stagedId: string): number {
    const a = state.staged.find((s) => s.id === stagedId);
    if (!a) return 0;
    if (a.kind === 'ability') {
      const found = findOccupant(state, a.sourceInstanceId);
      return found ? (findAbility(found.occupant.defId, a.abilityId!)?.maxTargets ?? 1) : 0;
    }
    const entry = state.players[a.owner].hand.find((h) => h.instanceId === a.cardInstanceId);
    return entry && entry.kind === 'card' ? (getHandCardDef(entry.defId)?.maxTargets ?? 1) : 0;
  }

  function startRetarget(stagedId: string) {
    const a = state.staged.find((s) => s.id === stagedId);
    const max = retargetMax(stagedId);
    if (!a || max === 0) return;
    setPending({ kind: 'ability', playerId: a.owner, instanceId: a.sourceInstanceId, abilityId: a.abilityId ?? '', maxTargets: max, targets: [], stagedId });
  }

  function startActivation(playerId: PlayerId, instanceId: string, abilityId: string, maxTargets: number) {
    if (maxTargets === 0) {
      submitAbility(instanceId, abilityId, []);
      return;
    }
    setPending({ kind: 'ability', playerId, instanceId, abilityId, maxTargets, targets: [] });
  }

  /** Dispatches once a card's pipeline is complete, otherwise just stores the (further-along) pending state — the single funnel every card-flow step passes through. */
  function advanceCard(next: PendingCard) {
    if (cardStage(next) === 'ready') {
      dispatch({
        type: trust ? 'STAGE_CARD' : 'PLAY_HAND_CARD',
        instanceId: next.cardInstanceId,
        enablingInstanceId: next.enablingInstanceId,
        targetInstanceIds: next.targets,
        payFromPool: next.payFromPool ?? 0,
        amount: next.amount ?? undefined,
      });
      setPending(null);
    } else {
      setPending(next);
    }
  }

  function startPlayCard(playerId: PlayerId, entry: Extract<HandEntry, { kind: 'card' }>) {
    const def = getHandCardDef(entry.defId);
    if (!def) return;
    advanceCard(newPendingCard(playerId, entry.instanceId, def));
  }

  function clickEnabler(instanceId: string) {
    if (!pending || pending.kind !== 'card' || cardStage(pending) !== 'enabler') return;
    advanceCard({ ...pending, enablingInstanceId: instanceId });
  }

  function choosePayFromPool(n: number) {
    if (!pending || pending.kind !== 'card' || cardStage(pending) !== 'payFromPool') return;
    advanceCard({ ...pending, payFromPool: n });
  }

  function chooseAmount(n: number) {
    if (!pending || pending.kind !== 'card' || cardStage(pending) !== 'amount') return;
    advanceCard({ ...pending, amount: n });
  }

  function clickTarget(targetInstanceId: string) {
    if (!pending) return;
    if (pending.kind === 'ability') {
      const targets = [...pending.targets, targetInstanceId];
      if (targets.length >= pending.maxTargets) {
        finishAbility(pending, targets);
      } else {
        setPending({ ...pending, targets });
      }
      return;
    }
    if (cardStage(pending) !== 'target') return;
    advanceCard({ ...pending, targets: [...pending.targets, targetInstanceId] });
  }

  function confirmPartialTargets() {
    if (!pending) return;
    if (pending.kind === 'ability') {
      finishAbility(pending, pending.targets);
      return;
    }
    if (cardStage(pending) !== 'target') return;
    advanceCard({ ...pending, targetsConfirmed: true });
  }

  const setupBlocked = setupPending(state);

  const detailsOwner = details?.kind === 'occupant' ? findOccupant(state, details.instanceId)?.player : undefined;
  const detailsCanAct = !!detailsOwner && isMyBoard(detailsOwner) && (trust || state.activePlayer === detailsOwner) && canAct && !setupBlocked;

  function renderPlayerBoard(playerId: PlayerId, position: 'top' | 'bottom') {
    const player = state.players[playerId];
    const isActive = state.activePlayer === playerId;
    const mine = isMyBoard(playerId);
    const canActNow = mine && (trust || isActive) && canAct && !setupBlocked;
    const canPlayCards = mine && !setupBlocked;
    const isTargetable = !!pending && (pending.kind === 'ability' || cardStage(pending) === 'target');
    const isEnablable = pending?.kind === 'card' && cardStage(pending) === 'enabler' && pending.playerId === playerId && mine;
    const pendingCardInstanceId = pending?.kind === 'card' ? pending.cardInstanceId : null;

    const info = (
      <div className="board-section" key="info">
        <PlayerHealthBar
          player={player}
          isActive={isActive}
          isYou={myPlayerId !== null && myPlayerId === playerId}
          onAdjust={trust && mine ? (delta) => dispatch({ type: 'ADJUST_PLAYER_HEALTH', player: playerId, delta }) : undefined}
        />
        <UpkeepPanel entries={previewUpkeep(state, playerId)} />
        {player.pendingCharacterReveal && (
          <CharacterRevealPanel
            player={playerId}
            revealed={player.pendingCharacterReveal.revealed}
            reason={player.pendingCharacterReveal.reason}
            taxNote={
              player.pendingCharacterReveal.reason === 'reinforcement'
                ? (() => {
                    const { cost, waived } = reinforcementCost(state, playerId);
                    return waived ? 'Playing it from your hand is free (Empty-Board Waiver).' : `Playing it from your hand will cost the Reinforcement Tax: ${cost} Chakra.`;
                  })()
                : undefined
            }
            interactive={mine}
            onChoose={(entryId) => dispatch({ type: 'CHOOSE_CHARACTER', player: playerId, entryId })}
          />
        )}
        {setupBlocked && !player.pendingCharacterReveal && (
          <button type="button" disabled={!mine} onClick={() => dispatch({ type: 'MULLIGAN', player: playerId })}>
            Mulligan
          </button>
        )}
        {trust && mine && !setupBlocked && (
          <div className="deck-bar">
            <span className="deck-bar__count">Deck: {player.handDeck.length}</span>
            <button type="button" onClick={() => dispatch({ type: 'DRAW_CARDS', player: playerId, count: 1 })}>
              Draw
            </button>
            <button type="button" onClick={() => dispatch({ type: 'SHUFFLE_DECK', player: playerId })}>
              Shuffle
            </button>
            <button type="button" onClick={() => setDeckTool({ player: playerId, tool: 'search' })}>
              Search…
            </button>
            <button type="button" onClick={() => setDeckTool({ player: playerId, tool: 'top' })}>
              Look at top…
            </button>
            <button type="button" onClick={() => setDeckTool({ player: playerId, tool: 'discard' })}>
              Discard pile ({player.discardPile.length})
            </button>
            <button
              type="button"
              title="Retrieve a card wrongly Consumed for a Chakra source (fixes an accidental or wrong placement)"
              onClick={() => setDeckTool({ player: playerId, tool: 'consumed' })}
            >
              Consumed pile ({player.consumedPile.length})
            </button>
          </div>
        )}
      </div>
    );
    const chakra = (
      <ChakraSourceRow
        key="chakra"
        sources={player.chakraSources}
        genericChakraAvailable={player.genericChakraAvailable}
        canTap={canActNow}
        onTap={(sourceIndex) => dispatch({ type: 'TAP_CHAKRA_SOURCE', sourceIndex, player: playerId })}
        onUntap={trust ? (sourceIndex) => dispatch({ type: 'UNTAP_CHAKRA_SOURCE', player: playerId, sourceIndex }) : undefined}
        onAdjustGeneric={trust && mine ? (delta) => dispatch({ type: 'ADJUST_GENERIC_CHAKRA', player: playerId, delta }) : undefined}
      />
    );
    const hand = (
      <HandView
        key="hand"
        hand={player.hand}
        canPlace={trust ? canPlayCards : canActNow}
        canAct={canPlayCards}
        alreadyPlacedThisTurn={trust ? false : player.chakraSourcePlacedThisTurn}
        onMoveCard={trust && mine ? (instanceId, to) => dispatch({ type: 'MOVE_HAND_CARD', player: playerId, instanceId, to }) : undefined}
        pendingCardInstanceId={pendingCardInstanceId}
        onPlaceChakraSource={(instanceId) => dispatch({ type: 'PLACE_CHAKRA_SOURCE', instanceId })}
        onStartPlayCard={(instanceId) => {
          const entry = player.hand.find((h): h is Extract<HandEntry, { kind: 'card' }> => h.kind === 'card' && h.instanceId === instanceId);
          if (entry) startPlayCard(playerId, entry);
        }}
        onPlayCharacter={(instanceId) => dispatch({ type: 'PLAY_CHARACTER', instanceId })}
        characterPlay={(entryId) => {
          const entry = getCharacterDeckEntry(entryId);
          const { cost, waived } = reinforcementCost(state, playerId);
          const room = entry ? entry.hasRoom(state, playerId) : false;
          return {
            label: waived ? 'Play (free)' : `Play (${cost} Chakra)`,
            hint: waived
              ? 'Empty-Board Waiver: you control no characters, so the Reinforcement Tax is waived.'
              : `Reinforcement Tax: ${cost} Chakra from your available (generic) Chakra — a character's Pool can't pay it. It goes up by 2 each time you pay it.`,
            disabled: !room,
            reason: room ? undefined : entryId === 'pain' ? 'Needs 6 open front-row slots for the Path tokens.' : 'Your back row is full (5 characters).',
          };
        }}
        onOpenDetails={(name, subtitle, text) => setDetails({ kind: 'card', name, subtitle, text })}
      />
    );
    const back = (
      <div className="board-row" key="back">
        {player.backRow.map(
          (character) =>
            character && (
              <CharacterCard
                key={character.instanceId}
                character={character}
                state={state}
                isTargetable={isTargetable}
                isEnablable={isEnablable}
                onClickAsTarget={clickTarget}
                onClickAsEnabler={clickEnabler}
                onOpenDetails={(id) => setDetails({ kind: 'occupant', instanceId: id })}
              />
            ),
        )}
      </div>
    );
    const front = (
      <div className="front-row" key="front">
        {player.frontRow.map(
          (token) =>
            token && (
              <TokenCard
                key={token.instanceId}
                token={token}
                isTargetable={isTargetable}
                onClickAsTarget={clickTarget}
                onOpenDetails={(id) => setDetails({ kind: 'occupant', instanceId: id })}
              />
            ),
        )}
      </div>
    );
    const inPlay = (player.terrainInPlay || player.missionsInPlay.length > 0) && (
      <div className="in-play-cards" key="inplay">
        {player.terrainInPlay && (
          <InPlayChip
            label="Terrain"
            name={getHandCardDef(player.terrainInPlay.defId)?.name}
            onOpen={(name) => setDetails({ kind: 'card', name, subtitle: 'Terrain in play', text: getHandCardText(name) })}
          />
        )}
        {player.missionsInPlay.map((m) => (
          <InPlayChip
            key={m.instanceId}
            label="Mission"
            name={m.defId === '__hidden__' ? undefined : getHandCardDef(m.defId)?.name}
            progress={m.defId === '__hidden__' ? undefined : missionProgressText(m.defId, m.extra)}
            onOpen={(name) => setDetails({ kind: 'card', name, subtitle: 'Mission in play', text: getHandCardText(name) })}
          />
        ))}
      </div>
    );

    // The battlefield is ONE shared, wide, neutral-toned space (assembled in
    // the main return below from both players' halves) rather than living
    // inside each player's own colored HUD — each player still has their own
    // board limits (5 characters, 10 tokens), but their deployed units render
    // together, facing each other across the middle seam. Seated across the
    // table: my back row is nearest me and my front row faces the middle —
    // the opponent's side is the exact mirror.
    const battlefieldRows = position === 'bottom' ? [front, back, inPlay] : [inPlay, back, front];
    const battlefield = (
      <div className={`battlefield-half battlefield-half--${playerId}`} key={playerId}>
        {battlefieldRows}
      </div>
    );

    // The HUD (name/health, Chakra, hand, deck tools) is each player's own
    // colored strip, `info` first so it's the first thing seen entering that
    // player's zone — from the top of the page for the top board, or right
    // after the shared battlefield for the bottom board.
    const hud = (
      <div className={`player-board player-board--${position} player-board--${playerId}`} key={playerId}>
        {[info, chakra, hand]}
      </div>
    );

    return { hud, battlefield };
  }

  const top = renderPlayerBoard(topId, 'top');
  const bottom = renderPlayerBoard(bottomId, 'bottom');

  return (
    <div className="app">
      <div className="app__header">
        <h1>Naruto Custom Card Game — Prototype</h1>
        {onLeave && (
          <button type="button" onClick={onLeave}>
            Leave game
          </button>
        )}
      </div>
      <div className="game-layout">
        <div className="game-main">
          {top.hud}
          <div className="shared-battlefield">
            {top.battlefield}
            <div className="battlefield-seam" />
            {bottom.battlefield}
          </div>
          {bottom.hud}
        </div>
        <aside className="game-sidebar">
          <PhaseIndicator state={state} />
          {pending && (
            <div className="pending-banner">
              {pending.kind === 'ability' ? (
                <>
                  <span>
                    Choose {pending.maxTargets > 1 ? `up to ${pending.maxTargets} targets` : 'a target'} ({pending.targets.length}/
                    {pending.maxTargets} selected)
                  </span>
                  <span>
                    {pending.targets.length > 0 && (
                      <button type="button" onClick={confirmPartialTargets}>
                        Confirm
                      </button>
                    )}
                    <button type="button" onClick={() => setPending(null)}>
                      Cancel
                    </button>
                  </span>
                </>
              ) : (
                <PendingCardBanner
                  pending={pending}
                  state={state}
                  onChoosePayFromPool={choosePayFromPool}
                  onConfirmTargets={confirmPartialTargets}
                  onChooseAmount={chooseAmount}
                  onCancel={() => setPending(null)}
                />
              )}
            </div>
          )}
          {state.stack.length > 0 && (
            <div className="stack-panel">
              Stack ({state.stack.length}):{' '}
              {state.stack
                .slice()
                .reverse()
                .map((item) => `${item.sourceName}: ${item.abilityName}`)
                .join(' | ')}
            </div>
          )}
          {trust && !setupBlocked && (
            <StagedPanel
              state={state}
              myPlayerId={myPlayerId}
              dispatch={dispatch}
              onRetarget={startRetarget}
              canRetarget={(id) => retargetMax(id) > 0}
            />
          )}
          {!trust && (myPlayerId === null || myPlayerId === state.activePlayer) && !setupBlocked && (
            <TurnControls onAdvancePhase={() => dispatch({ type: 'ADVANCE_PHASE' })} />
          )}
          {!trust && state.stack.length > 0 && (myPlayerId === null || myPlayerId === state.priorityPlayer) && (
            <div className="turn-controls">
              <button type="button" onClick={() => dispatch({ type: 'PASS_PRIORITY' })}>
                Pass Priority ({state.priorityPlayer})
              </button>
            </div>
          )}
        </aside>
      </div>
      <ActionLog log={state.log} />
      {details?.kind === 'occupant' && (
        <CharacterDetailsModal
          state={state}
          instanceId={details.instanceId}
          canAct={detailsCanAct}
          onClose={() => setDetails(null)}
          onPool={(instanceId, amount) => dispatch({ type: 'POOL_CHAKRA', instanceId, amount })}
          onActivate={(instanceId, abilityId, maxTargets) => startActivation(detailsOwner ?? state.activePlayer, instanceId, abilityId, maxTargets)}
          onRetreat={(instanceId) => dispatch({ type: 'RETREAT', instanceId })}
          onReturnFromRetreat={(instanceId) => dispatch({ type: 'RETURN_FROM_RETREAT', instanceId })}
          manual={
            trust
              ? {
                  onAdjustHp: (instanceId, delta) => dispatch({ type: 'ADJUST_HP', instanceId, delta }),
                  onDamage: (instanceId, amount) => dispatch({ type: 'DEAL_DAMAGE', instanceId, amount }),
                  onAdjustPool: (instanceId, delta) => dispatch({ type: 'ADJUST_POOL', instanceId, delta }),
                  onToggleStatus: (instanceId, status) => dispatch({ type: 'TOGGLE_STATUS', instanceId, status }),
                }
              : undefined
          }
        />
      )}
      {deckTool && <DeckToolsModal state={state} player={deckTool.player} tool={deckTool.tool} dispatch={dispatch} onClose={() => setDeckTool(null)} />}
      {details?.kind === 'card' && (
        <DetailsModal title={details.name} subtitle={details.subtitle} text={details.text} onClose={() => setDetails(null)} />
      )}
    </div>
  );
}

function App() {
  const [viewMode, setViewMode] = useState<'lobby' | 'local'>('lobby');
  const [localState, localDispatch] = useReducer(gameReducer, undefined, () => createSetupState(undefined, 'trust'));
  const net = useNetGame();

  if (viewMode === 'local') {
    return <ViewGame state={localState} dispatch={localDispatch} myPlayerId={null} onLeave={() => setViewMode('lobby')} />;
  }

  if (net.mode === 'playing' && net.state) {
    return <ViewGame state={net.state} dispatch={net.dispatch} myPlayerId={net.myPlayerId} onLeave={net.leave} />;
  }

  return (
    <LobbyScreen
      mode={net.mode}
      status={net.status}
      roomCode={net.roomCode}
      error={net.error}
      onHost={net.host}
      onJoin={net.join}
      onPlayLocal={() => setViewMode('local')}
      onCancel={net.leave}
    />
  );
}

export default App;
