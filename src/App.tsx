import { useCallback, useRef, useState } from 'react';
import { gameReducer, setupPending } from './engine/reducer';
import { createSetupState } from './engine/state';
import { findOccupant, isCharacter } from './engine/board';
import { findAbility, type ChoiceSpec } from './engine/abilities';
import { getCharacterDeckEntry } from './engine/characters';
import { currentTax } from './engine/playCharacter';
import { getHandCardDef } from './engine/cards/registry';
import { missionProgressText } from './engine/cards/missions';
import type { AbilityChoices, GameAction, GameState, HandEntry, MissionInstance, PlayerId } from './engine/types';
import { cardStage, newPendingCard, toHandCardContext, type PendingCard } from './ui/cardFlow';
import { getCharacterCardText, getHandCardText } from './ui/cardInfo';
import { pushUndo, undoLabelFor, type UndoEntry } from './ui/undo';
import { AbilityChoiceStep } from './ui/components/AbilityChoiceStep';
import { ChoicePanel } from './ui/components/ChoicePanel';
import { HandRevealPanel } from './ui/components/HandRevealPanel';
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
  /** Once targets are in: the ability's optional choices still to be asked (alternative costs / resource-dependent extra effects), and the answers so far. */
  choiceQueue?: ChoiceSpec[];
  choices?: AbilityChoices;
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

/** Squad Formation's standing choice: which group member absorbs a redirected hit, or Off (the controller decides; never automatic). */
function SquadRedirectSelect({
  mission,
  state,
  disabled,
  onChange,
}: {
  mission: MissionInstance;
  state: GameState;
  disabled: boolean;
  onChange: (redirectTo: string | null) => void;
}) {
  const group = (mission.extra.group as string[] | undefined) ?? [];
  return (
    <label className="squad-redirect" title="When one member of the group is hit, redirect that hit to this member instead">
      Redirect hits to:{' '}
      <select disabled={disabled} value={(mission.extra.redirectTo as string | undefined) ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Off</option>
        {group.map((id) => {
          const found = findOccupant(state, id);
          return found ? (
            <option key={id} value={id}>
              {found.occupant.name}
            </option>
          ) : null;
        })}
      </select>
    </label>
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
  onRestart,
  onUndo,
  undoLabel,
}: {
  state: GameState;
  dispatch: (action: GameAction) => void;
  /** null = local hotseat (both boards are "yours"); 'p1'/'p2' = networked (only that board is interactive). */
  myPlayerId: PlayerId | null;
  onLeave?: () => void;
  /** Start a fresh game (same players, same connection). */
  onRestart?: () => void;
  /** Undo the most recent draw/reveal-type action (the kinds that can't be fixed by hand) — see ui/undo.ts. */
  onUndo?: () => void;
  undoLabel?: string | null;
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
  function submitAbility(instanceId: string, abilityId: string, targets: string[], choices?: AbilityChoices) {
    dispatch(
      trust
        ? { type: 'STAGE_ABILITY', instanceId, abilityId, targetInstanceIds: targets, payFromPool: 0, choices }
        : { type: 'ACTIVATE_ABILITY', instanceId, abilityId, targetInstanceIds: targets, payFromPool: 0, choices },
    );
  }

  /** Targets are in — ask the ability's optional choices (if it has any right now), then submit. */
  function finishAbility(p: PendingAbility, targets: string[]) {
    if (p.stagedId) {
      dispatch({ type: 'RETARGET_STAGED', stagedId: p.stagedId, targetInstanceIds: targets });
      setPending(null);
      return;
    }
    const found = findOccupant(state, p.instanceId);
    const ability = found ? findAbility(found.occupant.defId, p.abilityId) : undefined;
    const specs = ability?.choices?.({ state, sourceInstanceId: p.instanceId, targetInstanceIds: targets }) ?? [];
    if (specs.length > 0) {
      setPending({ ...p, targets, choiceQueue: specs, choices: {} });
      return;
    }
    submitAbility(p.instanceId, p.abilityId, targets);
    setPending(null);
  }

  function answerAbilityChoice(value: boolean | number | string) {
    if (!pending || pending.kind !== 'ability' || !pending.choiceQueue?.length) return;
    const [spec, ...rest] = pending.choiceQueue;
    const choices = { ...pending.choices, [spec.id]: value };
    if (rest.length > 0) {
      setPending({ ...pending, choiceQueue: rest, choices });
      return;
    }
    submitAbility(pending.instanceId, pending.abilityId, pending.targets, choices);
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
    const fresh: PendingAbility = { kind: 'ability', playerId, instanceId, abilityId, maxTargets, targets: [] };
    if (maxTargets === 0) {
      finishAbility(fresh, []);
      return;
    }
    setPending(fresh);
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
      if (pending.choiceQueue) return; // targets are locked in; answering its choices now
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
    const isTargetable = !!pending && (pending.kind === 'ability' ? !pending.choiceQueue : cardStage(pending) === 'target');
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
            key={player.pendingCharacterReveal.revealed.join('|')}
            player={playerId}
            revealed={player.pendingCharacterReveal.revealed}
            reason={player.pendingCharacterReveal.reason}
            interactive={mine}
            onChoose={(entryId) => dispatch({ type: 'CHOOSE_CHARACTER', player: playerId, entryId })}
            onOpenDetails={(entryId) => {
              const entry = getCharacterDeckEntry(entryId);
              if (entry) setDetails({ kind: 'card', name: entry.name, subtitle: `Character card · Rank ${entry.rank}`, text: getCharacterCardText(entryId) });
            }}
          />
        )}
        {setupBlocked && player.startingCharacterInstanceId === null && (
          <div className="mulligan-bar">
            <button
              type="button"
              disabled={!mine}
              title="Shuffle your hand back and redraw — the first mulligan is free (6 cards), each one after draws 1 fewer"
              onClick={() => dispatch({ type: 'MULLIGAN', player: playerId })}
            >
              Mulligan (redraw {Math.max(0, 6 - player.mulligansSoFar)})
            </button>
            <span className="mulligan-bar__note">
              {player.mulligansSoFar === 0 ? 'Available until you confirm your starting character.' : `${player.mulligansSoFar} mulligan(s) so far.`}
            </span>
          </div>
        )}
        {setupBlocked && player.startingCharacterInstanceId !== null && (
          <div className="mulligan-bar__note">Setup done — waiting for the other player.</div>
        )}
        {player.pendingHandReveal &&
          (mine ? (
            <HandRevealPanel
              hand={player.hand}
              count={player.pendingHandReveal.count}
              requestedBy={player.pendingHandReveal.requestedBy}
              onReveal={(instanceIds) => dispatch({ type: 'REVEAL_HAND_CARDS', player: playerId, instanceIds })}
            />
          ) : (
            <div className="reveal-panel__note">
              Waiting for {playerId.toUpperCase()} to reveal {player.pendingHandReveal.count} card(s) (Field Intelligence)…
            </div>
          ))}
        {trust && mine && !setupBlocked && (
          <div className="deck-bar">
            <span className="deck-bar__count">Deck: {player.handDeck.length}</span>
            <button
              type="button"
              title="Manual correction: draw 1 extra card (your normal once-per-turn draw is the Draw button in the sidebar during your Draw Phase)"
              onClick={() => dispatch({ type: 'DRAW_CARDS', player: playerId, count: 1 })}
            >
              Draw extra
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
        {mine && !setupBlocked && (() => {
          const tax = currentTax(state, playerId);
          const onTime = isActive && MAIN_PHASES.has(state.phase);
          const blocker =
            player.characterDeck.length === 0
              ? 'Your Character Deck is empty.'
              : player.pendingCharacterReveal
                ? 'Pick from your current Character Deck reveal first.'
                : !onTime && !trust
                  ? 'Only during your own Main Phase.'
                  : !trust && player.genericChakraAvailable < tax
                    ? `Needs ${tax} available Chakra — tap Chakra sources first (you have ${player.genericChakraAvailable}).`
                    : undefined;
          return (
            <div className="character-deck-bar">
              <span className="character-deck-bar__info">
                <strong>Character Deck:</strong> {player.characterDeck.length} card(s) · tax <strong>{tax}</strong> Chakra
                {tax < 8 && <span className="character-deck-bar__next"> (next paid draw: {Math.min(8, tax + 2)})</span>}
              </span>
              <button
                type="button"
                className="character-deck-bar__draw"
                disabled={!!blocker}
                title={blocker ?? `Pay ${tax} Chakra: look at the top 2 of your Character Deck and keep 1. Resolves immediately (no stack). Playing the kept card later is free.`}
                onClick={() => dispatch({ type: 'DRAW_CHARACTER_DECK', player: playerId })}
              >
                Pay {tax} Chakra &amp; draw a character
              </button>
              {blocker && <span className="character-deck-bar__reason">{blocker}</span>}
              {!blocker && trust && !onTime && <span className="character-deck-bar__reason">Not your Main Phase — allowed in trust mode (flagged).</span>}
            </div>
          );
        })()}
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
          const room = entry ? entry.hasRoom(state, playerId) : false;
          return {
            label: 'Play (free)',
            hint: 'Playing a character from hand is always free — the tax is paid when you draw it from the Character Deck.',
            disabled: !room,
            reason: room ? undefined : entryId === 'pain' ? 'Needs 6 open front-row slots for the Path tokens.' : 'Your back row is full (5 characters).',
          };
        }}
        mustPlayCPlus={mine && player.mustPlayCharacter}
        onDropCharacter={trust && mine ? (instanceId) => dispatch({ type: 'RETURN_CHARACTER_TO_HAND', instanceId }) : undefined}
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
                draggable={trust && mine && !pending}
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
                state={state}
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
          <span className="in-play-cards__mission" key={m.instanceId}>
            <InPlayChip
              label="Mission"
              name={m.defId === '__hidden__' ? undefined : getHandCardDef(m.defId)?.name}
              progress={m.defId === '__hidden__' ? undefined : missionProgressText(m.defId, m.extra)}
              onOpen={(name) => setDetails({ kind: 'card', name, subtitle: 'Mission in play', text: getHandCardText(name) })}
            />
            {m.defId === 'squad-formation' && !!m.extra.active && (
              <SquadRedirectSelect
                mission={m}
                state={state}
                disabled={!mine}
                onChange={(redirectTo) => dispatch({ type: 'SET_SQUAD_REDIRECT', missionInstanceId: m.instanceId, redirectTo })}
              />
            )}
          </span>
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
        <span className="app__header-actions">
          {onRestart && (
            <button
              type="button"
              title="Start a brand-new game with the same players (keeps the connection)"
              onClick={() => {
                if (window.confirm('Restart the game? The current game will be lost.')) onRestart();
              }}
            >
              Restart game
            </button>
          )}
          {onLeave && (
            <button type="button" onClick={onLeave}>
              Leave game
            </button>
          )}
        </span>
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
          <div className="sidebar-toggle">
            <label title="Trust mode: declare actions and resolve them together; the engine only warns about rule problems. Off: the engine enforces every rule.">
              <input
                type="checkbox"
                checked={trust}
                onChange={(e) => dispatch({ type: 'SET_RULES', rules: e.target.checked ? 'trust' : 'strict' })}
              />{' '}
              Trust mode {trust ? 'ON' : 'OFF'}
            </label>
          </div>
          <PhaseIndicator state={state} />
          {onUndo && (
            <button type="button" className="sidebar-undo" disabled={!undoLabel} onClick={onUndo} title="Undo the last draw/reveal-type action (things you can't fix by hand)">
              ↶ Undo{undoLabel ? `: ${undoLabel}` : ''}
            </button>
          )}
          {state.firstPlayerPending && <div className="sidebar-note">Setup: pick your starting character and mulligan if you like. Who goes first is flipped once both players confirm.</div>}
          {state.pendingChoices.map((choice) => (
            <ChoicePanel
              key={choice.id}
              choice={choice}
              interactive={isMyBoard(choice.player)}
              onResolve={(optionIds) => dispatch({ type: 'RESOLVE_CHOICE', choiceId: choice.id, optionIds })}
            />
          ))}
          {(['p1', 'p2'] as PlayerId[]).map((pid) => {
            const p = state.players[pid];
            const offer = p.reinforcementOffers[0];
            const controls = isMyBoard(pid);
            return (
              <div key={`decisions-${pid}`}>
                {p.mustPlayCharacter && (
                  <div className="decision-panel decision-panel--required">
                    {pid.toUpperCase()} lost their last C+ character: {controls ? 'play a C+ character from your hand now (free) — highlighted in your hand.' : 'waiting for them to play a C+ character.'}
                  </div>
                )}
                {offer && (
                  <div className="decision-panel">
                    <span>
                      {pid.toUpperCase()}:{' '}
                      {offer === 'free'
                        ? 'your last C+ character fell — take a free Character Deck draw (look at 2, keep 1)?'
                        : `a C+ character fell — pay ${currentTax(state, pid)} Chakra for a Character Deck draw (look at 2, keep 1)? Your tax won't go up.`}
                      {p.reinforcementOffers.length > 1 && ` (${p.reinforcementOffers.length - 1} more after this)`}
                    </span>
                    {controls && (
                      <span>
                        <button type="button" onClick={() => dispatch({ type: 'ACCEPT_REINFORCEMENT', player: pid })}>
                          {offer === 'free' ? 'Draw (free)' : `Pay ${currentTax(state, pid)} & draw`}
                        </button>
                        <button type="button" onClick={() => dispatch({ type: 'DECLINE_REINFORCEMENT', player: pid })}>
                          Decline
                        </button>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {!setupBlocked && isMyBoard(state.activePlayer) && (
            <div className="deck-actions">
              {state.phase === 'Draw' && !state.players[state.activePlayer].drawnThisDrawPhase && (
                <button type="button" onClick={() => dispatch({ type: 'DRAW_PHASE_CARD' })} title="Your once-per-turn Draw Phase draw">
                  {state.turn === 1 && state.activePlayer === state.firstPlayer ? 'Skip first-turn draw' : `Draw (Hand Deck: ${state.players[state.activePlayer].handDeck.length})`}
                </button>
              )}
            </div>
          )}
          {pending && (
            <div className="pending-banner">
              {pending.kind === 'ability' && pending.choiceQueue?.length ? (
                <AbilityChoiceStep key={pending.choiceQueue[0].id} spec={pending.choiceQueue[0]} onAnswer={answerAbilityChoice} onCancel={() => setPending(null)} />
              ) : pending.kind === 'ability' ? (
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
                  onReturnToHand: (instanceId) => dispatch({ type: 'RETURN_CHARACTER_TO_HAND', instanceId }),
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

/**
 * Local (single-player testing) game state, with the same undo history and
 * restart the networked host keeps: an in-memory snapshot is pushed before
 * each undoable action (draws, mulligans, reveal picks — see ui/undo.ts).
 */
function useLocalGame() {
  const [state, setState] = useState<GameState>(() => createSetupState(undefined, 'trust'));
  const [history, setHistory] = useState<UndoEntry[]>([]);
  // The latest state, readable synchronously by dispatch (every update below keeps it in step with `state`).
  const stateRef = useRef(state);

  const dispatch = useCallback((action: GameAction) => {
    const prev = stateRef.current;
    const label = undoLabelFor(action);
    if (label) setHistory((h) => pushUndo(h, { state: prev, label }));
    const next = gameReducer(prev, action);
    stateRef.current = next;
    setState(next);
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      const entry = h.at(-1);
      if (!entry) return h;
      stateRef.current = entry.state;
      setState(entry.state);
      return h.slice(0, -1);
    });
  }, []);

  const restart = useCallback(() => {
    const fresh = createSetupState(undefined, 'trust');
    stateRef.current = fresh;
    setState(fresh);
    setHistory([]);
  }, []);

  return { state, dispatch, undo, undoLabel: history.at(-1)?.label ?? null, restart };
}

function App() {
  const [viewMode, setViewMode] = useState<'lobby' | 'local'>('lobby');
  const local = useLocalGame();
  const net = useNetGame();

  if (viewMode === 'local') {
    return (
      <ViewGame
        state={local.state}
        dispatch={local.dispatch}
        myPlayerId={null}
        onLeave={() => {
          // Leaving ends this game — coming back to Single-Player Testing starts a fresh one, not the stale old state.
          local.restart();
          setViewMode('lobby');
        }}
        onRestart={local.restart}
        onUndo={local.undo}
        undoLabel={local.undoLabel}
      />
    );
  }

  if (net.mode === 'playing' && net.state) {
    return (
      <ViewGame
        state={net.state}
        dispatch={net.dispatch}
        myPlayerId={net.myPlayerId}
        onLeave={net.leave}
        onRestart={net.restart}
        onUndo={net.undo}
        undoLabel={net.undoLabel}
      />
    );
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
