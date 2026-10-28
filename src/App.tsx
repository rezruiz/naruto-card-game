import { useCallback, useRef, useState, type ReactNode } from 'react';
import { gameReducer, setupPending } from './engine/reducer';
import { createSetupState } from './engine/state';
import { findOccupant, isCharacter, legalCharacterSlots, maxCharacters } from './engine/board';
import { canPlaceChakraSource } from './engine/chakra';
import { abilityDeclarationWarnings, cardDeclarationWarnings } from './engine/trust/staging';
import { findAbility, poolAvailableFor, resolveCost, type ChoiceSpec } from './engine/abilities';
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
import { CharacterCard, IN_PLAY_CARD_DRAG_TYPE } from './ui/components/CharacterCard';
import { CharacterRevealPanel } from './ui/components/CharacterRevealPanel';
import { LobbyScreen } from './ui/components/LobbyScreen';
import { DeckLibrary } from './ui/components/DeckLibrary';
import { loadDecks, loadSelectedDeckId, saveDecks, saveSelectedDeckId } from './ui/deckStorage';
import type { DeckList } from './engine/decklist';
import { TokenCard } from './ui/components/TokenCard';
import { RulesReference } from './ui/components/RulesReference';
import { RuleWarnings } from './ui/components/RuleWarnings';
import { HandView, type HandDrag } from './ui/components/HandView';
import { PhaseIndicator } from './ui/components/PhaseIndicator';
import { HealthPlate } from './ui/components/HealthPlate';
import { TurnControls } from './ui/components/TurnControls';
import { useNetGame } from './net/useNetGame';
import './App.css';
import './ui/BoardMat.css';
import { CHARACTER_DECK_NAME, GRAVEYARD_NAME, LEADER_GRAVEYARD_NAME, MAIN_DECK_NAME, RULESET_OPTS, VARIANT, VARIANT_LABEL } from './variant';
import { isPrototype, suppliesAvailable, suppliesMax } from './engine/prototype';
import { ShinobiCombatPanel } from './ui/components/ShinobiCombatPanel';

const MAIN_PHASES = new Set(['Main1', 'Main2']);

/** The synthetic last step of an ability's choice queue: how much of the cost to pay from the Pool. */
const POOL_PAYMENT_CHOICE = '__payFromPool';

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

type Details =
  | { kind: 'occupant'; instanceId: string }
  /** returnInstanceId: a Mission/Terrain in play the viewer can take back to hand (trust mode). */
  | { kind: 'card'; name: string; subtitle: string; text?: string; returnInstanceId?: string }
  | null;

/** A deck or pile on the board: a card-back (or face-up) stack whose thickness shows roughly how many cards are left, with its count and name. */
function Pile({
  label,
  count,
  kind,
  sub,
  faceUp,
  title,
  onClick,
  disabledReason,
  small,
}: {
  label: string;
  count: number;
  kind: 'jutsu' | 'character' | 'graveyard' | 'consumed';
  /** A second line under the name, e.g. the Character Deck's draw tax. */
  sub?: string;
  /** Discard-style piles are drawn face up (a plain card face) rather than as a card back. */
  faceUp?: boolean;
  title: string;
  onClick?: () => void;
  /** Why it can't be used right now — greys it out (the title explains). */
  disabledReason?: string;
  /** A smaller stack, for tight spots like the Chakra row. */
  small?: boolean;
}) {
  const layers = Math.min(6, Math.ceil(count / 8));
  const depth = Array.from({ length: layers }, (_, i) => `${i + 1}px ${i + 1}px 0 -1px var(--pile-edge)`).join(', ');
  const clickable = !!onClick && !disabledReason;
  return (
    <button
      type="button"
      className={`pile pile--${kind}${small ? ' pile--small' : ''}${faceUp ? ' pile--face-up' : ''}${count === 0 ? ' pile--empty' : ''}${clickable ? ' pile--clickable' : ''}${disabledReason ? ' pile--blocked' : ''}`}
      title={title}
      aria-label={`${label}: ${count} card${count === 1 ? '' : 's'}${sub ? `, ${sub}` : ''}`}
      onClick={clickable ? onClick : undefined}
      aria-disabled={!clickable}
    >
      <span className="pile__card" style={depth ? { boxShadow: depth } : undefined}>
        <span className="pile__count">{count}</span>
      </span>
      <span className="pile__label">{label}</span>
      {sub && <span className="pile__sub">{sub}</span>}
    </button>
  );
}

/** A Terrain/Mission in play: its name and, for a Mission, a live progress readout (e.g. "2/6 Untaps"). Clicking opens the full card text. Face-down (hidden) Missions show no name and can't be opened. */
function InPlayChip({
  label,
  name,
  progress,
  onOpen,
  dragInstanceId,
  plain,
}: {
  label: string;
  name: string | undefined;
  progress?: string;
  onOpen: (name: string) => void;
  /** Inside a board zone: just the card name as text — the zone's own title already says what it is. */
  plain?: boolean;
  /** Trust mode, own card: can be dragged onto its owner's hand to take back an accidental play. */
  dragInstanceId?: string;
}) {
  const drag = dragInstanceId
    ? {
        draggable: true,
        onDragStart: (e: React.DragEvent) => {
          e.dataTransfer.setData(IN_PLAY_CARD_DRAG_TYPE, dragInstanceId);
          e.dataTransfer.effectAllowed = 'move';
        },
      }
    : {};
  if (!name) {
    return (
      <span className={`in-play-chip in-play-chip--hidden${plain ? ' in-play-chip--plain' : ''}`} {...drag} title={dragInstanceId ? 'Drag onto your hand to return it to hand' : undefined}>
        Face-down {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`in-play-chip${plain ? ' in-play-chip--plain' : ''}`}
      title={dragInstanceId ? 'Click for card text · drag onto your hand to return it' : 'Click for card text'}
      onClick={() => onOpen(name)}
      {...drag}
    >
      {plain ? name : `${label}: ${name}`}
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
  /** A character card from hand waiting for the player to pick its back-row slot (§9 positioning). */
  const [placing, setPlacing] = useState<{ player: PlayerId; instanceId: string; name: string } | null>(null);
  /** A card being dragged out of a hand toward the board (Hearthstone-style play), and the slot it's hovering. */
  const [handDrag, setHandDrag] = useState<(HandDrag & { player: PlayerId }) | null>(null);
  const [dropSlot, setDropSlot] = useState<number | null>(null);
  /** A declaration that breaks a strict rule, waiting on the player's "force it through?" answer. */
  const [forcePrompt, setForcePrompt] = useState<{ warnings: string[]; declare: (force: boolean) => void } | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);
  /** Which deck's menu is open (Jutsu: Draw / Shuffle / Search / Look at top; Character: Draw / Shuffle / Search). */
  const [deckMenuFor, setDeckMenuFor] = useState<{ player: PlayerId; deck: 'jutsu' | 'character' } | null>(null);
  /** A Character Deck draw waiting on the player to confirm paying the tax. */
  const [confirmCharacterDraw, setConfirmCharacterDraw] = useState<PlayerId | null>(null);
  const endHandDrag = () => {
    setHandDrag(null);
    setDropSlot(null);
  };
  // Seated across the table: you're always the bottom board, your opponent the top. (Local hotseat has no single 'you', so P1 sits at the bottom.)
  const bottomId: PlayerId = myPlayerId ?? 'p1';
  const topId: PlayerId = bottomId === 'p1' ? 'p2' : 'p1';
  const [deckTool, setDeckTool] = useState<{ player: PlayerId; tool: DeckTool } | null>(null);
  // Trust mode (playtesting): players agree on timing out loud, so nothing is phase-gated in the UI.
  const trust = state.rules === 'trust';
  const canAct = trust || MAIN_PHASES.has(state.phase);
  const isMyBoard = (playerId: PlayerId) => myPlayerId === null || myPlayerId === playerId;

  /** Trust mode declares (stages) the action for later resolution; strict mode activates it right away. */
  function submitAbility(instanceId: string, abilityId: string, targets: string[], choices?: AbilityChoices, payFromPool = 0) {
    if (!trust) {
      dispatch({ type: 'ACTIVATE_ABILITY', instanceId, abilityId, targetInstanceIds: targets, payFromPool, choices });
      return;
    }
    askToForce(abilityDeclarationWarnings(state, instanceId, abilityId, targets, payFromPool, choices), (force) =>
      dispatch({ type: 'STAGE_ABILITY', instanceId, abilityId, targetInstanceIds: targets, payFromPool, choices, force }),
    );
  }

  /**
   * Trust mode: an illegal declaration is only made if the player confirms forcing it through. A legal one goes
   * straight ahead; otherwise an in-page prompt lists why (browser confirm() pop-ups can be silently blocked).
   */
  function askToForce(warnings: string[], declare: (force: boolean) => void) {
    if (warnings.length === 0) declare(false);
    else setForcePrompt({ warnings, declare });
  }

  /**
   * How to split an ability's cost between the unit's Pool(s) and generic
   * Chakra. Returns a fixed amount when there's only one sensible split
   * (nothing pooled, Pool-only costs, "entire Pool" costs — the engine takes
   * the Pool itself), or the range to ask the player about.
   */
  function poolPayment(p: PendingAbility, targets: string[], choices: AbilityChoices): { fixed: number } | { min: number; max: number } {
    const found = findOccupant(state, p.instanceId);
    const ability = found ? findAbility(found.occupant.defId, p.abilityId) : undefined;
    if (!found || !ability || ability.spendsEntirePool) return { fixed: 0 };
    const cost = resolveCost(ability, { state, sourceInstanceId: p.instanceId, targetInstanceIds: targets, choices });
    const pooled = poolAvailableFor(state, p.instanceId);
    if (ability.requiresFullPoolPayment) return { fixed: cost };
    const generic = state.players[found.player].genericChakraAvailable;
    const max = Math.min(pooled, cost);
    const min = Math.min(max, Math.max(0, cost - generic));
    return min === max ? { fixed: max } : { min, max };
  }

  /** All choices answered — settle payment (asking if there's a real Pool/generic split to make), then submit. */
  function payAndSubmit(p: PendingAbility, targets: string[], choices: AbilityChoices) {
    const payment = poolPayment(p, targets, choices);
    // Trust mode pays at resolution, where the Pool is offered only if the tapped Chakra falls short.
    if (trust && !('fixed' in payment)) {
      submitAbility(p.instanceId, p.abilityId, targets, Object.keys(choices).length ? choices : undefined, 0);
      setPending(null);
      return;
    }
    if ('fixed' in payment) {
      submitAbility(p.instanceId, p.abilityId, targets, Object.keys(choices).length ? choices : undefined, payment.fixed);
      setPending(null);
      return;
    }
    setPending({
      ...p,
      targets,
      choices,
      choiceQueue: [{ id: POOL_PAYMENT_CHOICE, kind: 'number', prompt: 'Pay how much from the Pool (the rest from available Chakra)?', min: payment.min, max: payment.max, initial: payment.min }],
    });
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
    payAndSubmit(p, targets, {});
  }

  function answerAbilityChoice(value: boolean | number | string) {
    if (!pending || pending.kind !== 'ability' || !pending.choiceQueue?.length) return;
    const [spec, ...rest] = pending.choiceQueue;
    if (spec.id === POOL_PAYMENT_CHOICE) {
      const choices = pending.choices ?? {};
      submitAbility(pending.instanceId, pending.abilityId, pending.targets, Object.keys(choices).length ? choices : undefined, value as number);
      setPending(null);
      return;
    }
    const choices = { ...pending.choices, [spec.id]: value };
    if (rest.length > 0) {
      setPending({ ...pending, choiceQueue: rest, choices });
      return;
    }
    payAndSubmit(pending, pending.targets, choices);
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
      const play = {
        instanceId: next.cardInstanceId,
        enablingInstanceId: next.enablingInstanceId,
        targetInstanceIds: next.targets,
        payFromPool: next.payFromPool ?? 0,
        amount: next.amount ?? undefined,
      };
      if (trust) {
        askToForce(cardDeclarationWarnings(state, play.instanceId, play.enablingInstanceId, play.targetInstanceIds, play.payFromPool, play.amount), (force) =>
          dispatch({ type: 'STAGE_CARD', ...play, force }),
        );
      } else {
        dispatch({ type: 'PLAY_HAND_CARD', ...play });
      }
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

  /** A non-character card being dragged from this player's hand (it can be dropped on their Chakra row as a Chakra source). */
  function myDragCard(playerId: PlayerId) {
    return handDrag && handDrag.player === playerId && handDrag.kind === 'card' ? handDrag : null;
  }

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
        <UpkeepPanel entries={previewUpkeep(state, playerId)} />
        {player.pendingCharacterReveal && (
          <CharacterRevealPanel
            key={player.pendingCharacterReveal.revealed.join('|')}
            player={playerId}
            revealed={player.pendingCharacterReveal.revealed}
            reason={player.pendingCharacterReveal.reason}
            searchAll={isPrototype(state)}
            noUpkeep={isPrototype(state)}
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
      </div>
    );
    const chakraDrop = myDragCard(playerId);
    const chakra = (
      <div
        key="chakra"
        className={chakraDrop ? 'chakra-drop chakra-drop--active' : 'chakra-drop'}
        title={chakraDrop ? 'Drop here to discard this card and place a Chakra source' : undefined}
        onDragOver={
          chakraDrop
            ? (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }
            : undefined
        }
        onDrop={
          chakraDrop
            ? (e) => {
                e.preventDefault();
                endHandDrag();
                dispatch({ type: 'PLACE_CHAKRA_SOURCE', instanceId: chakraDrop.instanceId });
              }
            : undefined
        }
      >
      <ChakraSourceRow
        key="chakra"
        sources={player.chakraSources}
        genericChakraAvailable={player.genericChakraAvailable}
        fadingChakra={player.fadingGenericChakra}
        canTap={canActNow}
        onTap={(sourceIndex) => dispatch({ type: 'TAP_CHAKRA_SOURCE', sourceIndex, player: playerId })}
        onUntap={trust ? (sourceIndex) => dispatch({ type: 'UNTAP_CHAKRA_SOURCE', player: playerId, sourceIndex }) : undefined}
        onAdjustGeneric={trust && mine ? (delta) => dispatch({ type: 'ADJUST_GENERIC_CHAKRA', player: playerId, delta }) : undefined}
        supplies={isPrototype(state) ? { available: suppliesAvailable(state, playerId), max: suppliesMax(state, playerId) } : undefined}
        onAdjustSupplies={isPrototype(state) && trust && mine ? (delta) => dispatch({ type: 'ADJUST_SUPPLIES', player: playerId, delta }) : undefined}
        endSlot={
          <Pile
            label="Consumed"
            count={player.consumedPile.length}
            kind="consumed"
            faceUp
            small
            title="Cards Consumed to place Chakra sources — click to retrieve one placed by mistake"
            onClick={mine && !setupBlocked && trust ? () => setDeckTool({ player: playerId, tool: 'consumed' }) : undefined}
          />
        }
      />
      </div>
    );
    const hand = (
      <HandView
        key="hand"
        hand={player.hand}
        canPlace={trust ? canPlayCards : canActNow}
        canAct={canPlayCards}
        alreadyPlacedThisTurn={trust ? false : !canPlaceChakraSource(state, playerId)}
        onMoveCard={trust && mine ? (instanceId, to) => dispatch({ type: 'MOVE_HAND_CARD', player: playerId, instanceId, to }) : undefined}
        pendingCardInstanceId={pendingCardInstanceId}
        onPlaceChakraSource={(instanceId) => dispatch({ type: 'PLACE_CHAKRA_SOURCE', instanceId })}
        onStartPlayCard={(instanceId) => {
          const entry = player.hand.find((h): h is Extract<HandEntry, { kind: 'card' }> => h.kind === 'card' && h.instanceId === instanceId);
          if (entry) startPlayCard(playerId, entry);
        }}
        onPlayCharacter={(instanceId) => {
          const entryId = player.hand.find((h) => h.instanceId === instanceId && h.kind === 'character');
          const deckEntry = entryId && entryId.kind === 'character' ? getCharacterDeckEntry(entryId.entryId) : undefined;
          const slots = legalCharacterSlots(state, playerId);
          if (!deckEntry || deckEntry.id === 'pain' || slots.length <= 1) {
            dispatch({ type: 'PLAY_CHARACTER', instanceId });
            return;
          }
          setPlacing({ player: playerId, instanceId, name: deckEntry.name });
        }}
        characterPlay={(entryId) => {
          const entry = getCharacterDeckEntry(entryId);
          const room = entry ? entry.hasRoom(state, playerId) : false;
          return {
            label: 'Play (free)',
            hint: `Playing a character from hand is always free — the cost is paid when you draw it from the ${CHARACTER_DECK_NAME}.`,
            disabled: !room,
            reason: room ? undefined : entryId === 'pain'
                  ? 'Needs 6 open front-row slots for the Path tokens.'
                  : `You already have ${maxCharacters(state)} ${isPrototype(state) ? 'Leaders' : 'characters'} in play.`,
          };
        }}
        mustPlayCPlus={mine && player.mustPlayCharacter}
        onDropCharacter={trust && mine ? (instanceId) => dispatch({ type: 'RETURN_CHARACTER_TO_HAND', instanceId }) : undefined}
        onDropInPlayCard={
          trust && mine
            ? (instanceId) => {
                // Only this player's own Mission/Terrain.
                if (player.terrainInPlay?.instanceId === instanceId || player.missionsInPlay.some((m) => m.instanceId === instanceId)) {
                  dispatch({ type: 'RETURN_IN_PLAY_CARD_TO_HAND', instanceId });
                }
              }
            : undefined
        }
        onOpenDetails={(name, subtitle, text) => setDetails({ kind: 'card', name, subtitle, text })}
        onHandDragStart={canPlayCards && !pending ? (drag) => setHandDrag({ ...drag, player: playerId }) : undefined}
        onHandDragEnd={endHandDrag}
        ownerLabel={`${playerId.toUpperCase()}${myPlayerId !== null && myPlayerId === playerId ? ' (You)' : ''}`}
      />
    );
    const placingHere = placing && placing.player === playerId ? placing : null;
    const placeSlots = placingHere ? legalCharacterSlots(state, playerId) : [];
    const myDrag = handDrag && handDrag.player === playerId ? handDrag : null;
    // Pain has no back-row slot (he enters as 6 tokens), so he drops onto the board as a whole, like a Jutsu.
    const dragSlots = myDrag?.kind === 'character' && myDrag.entryId !== 'pain' ? legalCharacterSlots(state, playerId) : [];
    const dropOnBoard = !!myDrag && (myDrag.kind === 'card' || myDrag.entryId === 'pain');
    const placeAt = (slot: number) => {
      if (!placingHere) return;
      dispatch({ type: 'PLAY_CHARACTER', instanceId: placingHere.instanceId, slot });
      setPlacing(null);
    };
    // ---- The battlefield mat: every slot is always drawn, Yu-Gi-Oh-style ----
    // One row of 10 character positions (at most 5 characters, §6.5) and one
    // row of 10 token slots, lined up one-to-one: token slot N is directly in
    // front of character slot N (§9). Both rows scroll sideways together.
    // Side zones: Terrain (left) and Missions (right).
    const characterCell = (slot: number) => {
      const character = player.backRow[slot];
      const legal = placeSlots.includes(slot);
      // Dragging a character from this player's hand: its legal slots light up, and dropping on one plays it there.
      const dropHere = dragSlots.includes(slot);
      const dropProps = dropHere
        ? {
            onDragOver: (e: React.DragEvent) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dropSlot !== slot) setDropSlot(slot);
            },
            onDragLeave: () => setDropSlot((cur) => (cur === slot ? null : cur)),
            onDrop: (e: React.DragEvent) => {
              e.preventDefault();
              e.stopPropagation();
              dispatch({ type: 'PLAY_CHARACTER', instanceId: handDrag!.instanceId, slot });
              endHandDrag();
            },
          }
        : {};
      const dropClass = dropHere ? ` board-cell--drop${dropSlot === slot ? ' board-cell--drop-over' : ''}` : '';
      if (!character) {
        if (dropHere) {
          return (
            <div key={`slot-${slot}`} className={`board-cell board-cell--character board-cell--empty${dropClass}`} aria-label={`Drop to play in slot ${slot + 1}`} {...dropProps}>
              <span className="board-cell__label">Play here</span>
            </div>
          );
        }
        return legal ? (
          <button type="button" key={`slot-${slot}`} className="board-cell board-cell--character board-cell--legal" onClick={() => placeAt(slot)} title={`Play ${placingHere!.name} here`}>
            Place here
          </button>
        ) : (
          <div key={`slot-${slot}`} className="board-cell board-cell--character board-cell--empty" aria-label={`Empty character slot ${slot + 1}`}>
            <span className="board-cell__label">Character</span>
          </div>
        );
      }
      return (
        <div key={character.instanceId} className={`board-cell board-cell--character board-cell--filled${legal ? ' board-cell--push' : ''}${dropClass}`} {...dropProps}>
          {legal && (
            <button type="button" className="board-slot__push" onClick={() => placeAt(slot)} title={`Play ${placingHere!.name} here — ${character.name} shifts aside`}>
              Place here ⇄
            </button>
          )}
          <CharacterCard
            character={character}
            state={state}
            isTargetable={isTargetable}
            isEnablable={isEnablable}
            onClickAsTarget={clickTarget}
            onClickAsEnabler={clickEnabler}
            onOpenDetails={(id) => setDetails({ kind: 'occupant', instanceId: id })}
            draggable={trust && mine && !pending}
          />
        </div>
      );
    };
    const tokenChoice = mine ? state.pendingChoices.find((c) => c.player === playerId && c.resolverId === 'token-slot') : undefined;
    const tokenSlots = tokenChoice ? tokenChoice.options.map((o) => Number(o.id)) : [];
    const tokenCell = (slot: number) => {
      const token = player.frontRow[slot];
      if (token) {
        return (
          <div key={token.instanceId} className="board-cell board-cell--token board-cell--filled">
            <TokenCard
              token={token}
              state={state}
              isTargetable={isTargetable}
              onClickAsTarget={clickTarget}
              onOpenDetails={(id) => setDetails({ kind: 'occupant', instanceId: id })}
            />
          </div>
        );
      }
      if (tokenSlots.includes(slot)) {
        return (
          <button
            type="button"
            key={`fslot-${slot}`}
            className="board-cell board-cell--token board-cell--legal"
            onClick={() => dispatch({ type: 'RESOLVE_CHOICE', choiceId: tokenChoice!.id, optionIds: [String(slot)] })}
          >
            Here
          </button>
        );
      }
      return (
        <div key={`fslot-${slot}`} className="board-cell board-cell--token board-cell--empty" aria-label={`Empty token slot ${slot + 1}`}>
          <span className="board-cell__label">Token</span>
        </div>
      );
    };
    const characterRow = (
      <div className="mat__row mat__row--characters" key="back">
        {player.backRow.map((_, slot) => characterCell(slot))}
      </div>
    );
    const tokenRow = (
      <div className="mat__row mat__row--tokens" key="front">
        {player.frontRow.map((_, slot) => tokenCell(slot))}
      </div>
    );
    // ---- Prototype: no board shape ----
    // Two open lanes that wrap instead of fixed slots: Leaders, and Shinobi and
    // tokens together. A new unit just joins the end of its lane, so there are no
    // empty slots to draw — only a "Play here" spot while a Leader is being dragged.
    const proto = isPrototype(state);
    const filledSlots = (row: readonly unknown[]) => row.flatMap((o, slot) => (o ? [slot] : []));
    const leaderSlots = filledSlots(player.backRow);
    const unitSlots = filledSlots(player.frontRow);
    const lane = (key: string, title: string, count: string, cards: ReactNode[], empty: string) => (
      <div className={`lane lane--${key}`} key={key === 'leaders' ? 'back' : 'front'}>
        <div className="lane__head">
          <span className="lane__title">{title}</span>
          <span className="lane__count">{count}</span>
        </div>
        <div className="lane__cards">{cards.length > 0 ? cards : <span className="lane__empty">{empty}</span>}</div>
      </div>
    );
    const leaderLane = proto
      ? lane(
          'leaders',
          'Leaders',
          String(leaderSlots.length),
          [...leaderSlots, ...dragSlots.filter((slot) => !player.backRow[slot])].map((slot) => characterCell(slot)),
          'No Leaders in play',
        )
      : null;
    const unitLane = proto
      ? lane('units', 'Shinobi & Tokens', String(unitSlots.length), unitSlots.map((slot) => tokenCell(slot)), 'No Shinobi or tokens in play')
      : null;
    const terrainZone = (
      <div className={`mat__zone mat__zone--terrain${player.terrainInPlay ? ' mat__zone--filled' : ''}`} key="terrain">
        <span className="mat__zone-title">Terrain</span>
        {player.terrainInPlay ? (
          <InPlayChip
            plain
            label="Terrain"
            name={getHandCardDef(player.terrainInPlay.defId)?.name}
            dragInstanceId={trust && mine ? player.terrainInPlay.instanceId : undefined}
            onOpen={(name) =>
              setDetails({ kind: 'card', name, subtitle: 'Terrain in play', text: getHandCardText(name), returnInstanceId: trust && mine ? player.terrainInPlay!.instanceId : undefined })
            }
          />
        ) : (
          <span className="mat__zone-empty">None</span>
        )}
      </div>
    );
    const healthPlate = (
      <HealthPlate
        key="health"
        player={player}
        isActive={isActive}
        isYou={myPlayerId !== null && myPlayerId === playerId}
        onAdjust={trust && mine ? (delta) => dispatch({ type: 'ADJUST_PLAYER_HEALTH', player: playerId, delta }) : undefined}
      />
    );
    const missionZone = (
      <div className={`mat__zone mat__zone--missions${player.missionsInPlay.length > 0 ? ' mat__zone--filled' : ''}`} key="missions">
        <span className="mat__zone-title">Missions</span>
        {player.missionsInPlay.length === 0 && <span className="mat__zone-empty">None</span>}
        {player.missionsInPlay.map((m) => (
          <span className="in-play-cards__mission" key={m.instanceId}>
            <InPlayChip
              plain
              label="Mission"
              name={m.defId === '__hidden__' ? undefined : getHandCardDef(m.defId)?.name}
              progress={m.defId === '__hidden__' ? undefined : missionProgressText(m.defId, m.extra)}
              dragInstanceId={trust && mine ? m.instanceId : undefined}
              onOpen={(name) =>
                setDetails({ kind: 'card', name, subtitle: 'Mission in play', text: getHandCardText(name), returnInstanceId: trust && mine ? m.instanceId : undefined })
              }
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

    // ---- Right column (Yu-Gi-Oh style): each deck with its own graveyard above it ----
    // Jutsu graveyard over the Jutsu Deck, Character graveyard over the Character Deck.
    const tax = currentTax(state, playerId);
    // Prototype: a new Leader costs a flat 10 Supplies, and you pick any one from the whole deck.
    const drawUnit = proto ? 'Supplies' : 'Chakra';
    const drawFunds = proto ? suppliesAvailable(state, playerId) : player.genericChakraAvailable;
    const onTime = isActive && MAIN_PHASES.has(state.phase);
    const characterDrawBlocker =
      player.characterDeck.length === 0
        ? `Your ${CHARACTER_DECK_NAME} is empty.`
        : player.pendingCharacterReveal
          ? `Pick from your current ${CHARACTER_DECK_NAME} reveal first.`
          : !onTime && !trust
            ? 'Only during your own Main Phase.'
            : !trust && drawFunds < tax
              ? proto
                ? `Needs ${tax} Supplies (you have ${drawFunds}).`
                : `Needs ${tax} available Chakra — tap Chakra sources first (you have ${drawFunds}).`
              : undefined;
    const canUseDecks = mine && !setupBlocked;
    const piles = (
      <div className="deck-col__row" key="piles">
        <Pile
          label={GRAVEYARD_NAME}
          count={player.discardPile.length}
          kind="graveyard"
          faceUp
          title={`Discarded ${MAIN_DECK_NAME} cards — click to look through them`}
          onClick={canUseDecks && trust ? () => setDeckTool({ player: playerId, tool: 'discard' }) : undefined}
        />
        <Pile
          label={LEADER_GRAVEYARD_NAME}
          count={player.characterGraveyard.length}
          kind="graveyard"
          faceUp
          title="Defeated characters — click to look through them"
          onClick={canUseDecks && trust ? () => setDeckTool({ player: playerId, tool: 'char-graveyard' }) : undefined}
        />
      </div>
    );
    type MenuItem = { label: string; hint: string; act: () => void; disabled?: boolean };
    const jutsuMenu: MenuItem[] = [
      { label: 'Draw 1', hint: 'Manual correction: draw 1 extra card (your normal once-per-turn draw is the Draw button in the sidebar during your Draw Phase)', act: () => dispatch({ type: 'DRAW_CARDS', player: playerId, count: 1 }) },
      { label: 'Shuffle', hint: `Shuffle your ${MAIN_DECK_NAME}`, act: () => dispatch({ type: 'SHUFFLE_DECK', player: playerId }) },
      { label: 'Search…', hint: `Search your ${MAIN_DECK_NAME} for a card`, act: () => setDeckTool({ player: playerId, tool: 'search' }) },
      { label: 'Look at top…', hint: `Look at the top cards of your ${MAIN_DECK_NAME}`, act: () => setDeckTool({ player: playerId, tool: 'top' }) },
    ];
    const characterMenu: MenuItem[] = [
      {
        label: `Draw — pay ${tax} ${drawUnit}…`,
        hint: characterDrawBlocker ?? (proto ? `Search your ${CHARACTER_DECK_NAME} and pick any Leader — you confirm the cost first` : 'Look at the top 2 of your Character Deck and keep 1 — you confirm the cost first'),
        act: () => setConfirmCharacterDraw(playerId),
        disabled: !!characterDrawBlocker,
      },
      ...(trust
        ? [
            { label: 'Shuffle', hint: `Shuffle your ${CHARACTER_DECK_NAME}`, act: () => dispatch({ type: 'SHUFFLE_CHARACTER_DECK', player: playerId }) },
            { label: 'Search…', hint: `Search your ${CHARACTER_DECK_NAME} for a card (no cost paid — a manual tool)`, act: () => setDeckTool({ player: playerId, tool: 'char-search' }) },
          ]
        : []),
    ];
    const deckWithMenu = (deck: 'jutsu' | 'character', pile: ReactNode, items: MenuItem[]) => {
      const open = deckMenuFor?.player === playerId && deckMenuFor.deck === deck;
      return (
        <div className="deck-col__menu-anchor">
          {pile}
          {open && (
            <div className={`deck-menu deck-menu--${position}`} role="menu">
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  title={item.hint}
                  disabled={item.disabled}
                  onClick={() => {
                    setDeckMenuFor(null);
                    item.act();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    };
    const toggleMenu = (deck: 'jutsu' | 'character') => () =>
      setDeckMenuFor((cur) => (cur?.player === playerId && cur.deck === deck ? null : { player: playerId, deck }));
    const decks = (
      <div className="deck-col__row" key="decks">
        {deckWithMenu(
          'jutsu',
          <Pile
            label={MAIN_DECK_NAME}
            count={player.handDeck.length}
            kind="jutsu"
            title={canUseDecks && trust ? `${MAIN_DECK_NAME} — click for Draw, Shuffle, Search, Look at top` : MAIN_DECK_NAME}
            onClick={canUseDecks && trust ? toggleMenu('jutsu') : undefined}
          />,
          jutsuMenu,
        )}
        {deckWithMenu(
          'character',
          <Pile
            label={CHARACTER_DECK_NAME}
            count={player.characterDeck.length}
            kind="character"
            sub={proto ? `Leader ${tax}` : `Tax ${tax}`}
            title={
              canUseDecks
                ? `${CHARACTER_DECK_NAME} — click to draw (${tax} ${drawUnit})${trust ? ', shuffle or search' : ''}${tax < 8 ? `. Next paid draw: ${Math.min(8, tax + 2)}` : ''}${characterDrawBlocker ? `. Can't draw now: ${characterDrawBlocker}` : ''}`
                : `${CHARACTER_DECK_NAME} — draws cost ${tax} ${drawUnit}`
            }
            onClick={canUseDecks ? toggleMenu('character') : undefined}
          />,
          characterMenu,
        )}
      </div>
    );
    const deckColumn = (
      <div className="mat__side mat__side--decks" key="decks-col">
        {/* Mirrored like the rest of the board: graveyard toward the middle seam, decks nearest the player. */}
        {proto ? [decks, piles] : position === 'bottom' ? [piles, decks] : [decks, piles]}
      </div>
    );

    // The battlefield is ONE shared space (assembled in the main return below
    // from both players' halves). Seated across the table: my character row is
    // nearest me and my token row faces the middle — the opponent's side is
    // the exact mirror, so the two token rows meet at the seam.
    const battlefield = (
      <div
        className={`battlefield-half battlefield-half--${playerId} mat mat--${position}${proto ? ' mat--lanes' : ''}${dropOnBoard || dragSlots.length > 0 ? ' mat--drop-target' : ''}`}
        key={playerId}
        onDragOver={
          dropOnBoard
            ? (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }
            : undefined
        }
        onDrop={
          dropOnBoard
            ? (e) => {
                e.preventDefault();
                const drag = myDrag!;
                endHandDrag();
                if (drag.kind === 'character') {
                  dispatch({ type: 'PLAY_CHARACTER', instanceId: drag.instanceId });
                  return;
                }
                const entry = player.hand.find((h): h is Extract<HandEntry, { kind: 'card' }> => h.kind === 'card' && h.instanceId === drag.instanceId);
                if (entry) startPlayCard(playerId, entry);
              }
            : undefined
        }
      >
        {/* Left column: Missions over Terrain, with Health in each player's own bottom-left corner (Yu-Gi-Oh LP-style) — mirrored for the opponent. */}
        {proto ? (
          <>
            <div className="mat__side mat__side--field">{[missionZone, terrainZone]}</div>
            <div className="mat__side mat__side--health">{healthPlate}</div>
          </>
        ) : (
          <div className="mat__side mat__side--field">{position === 'bottom' ? [missionZone, terrainZone, healthPlate] : [healthPlate, terrainZone, missionZone]}</div>
        )}
        {proto ? (
          <div className="mat__rows mat__rows--lanes">{position === 'bottom' ? [unitLane, leaderLane] : [leaderLane, unitLane]}</div>
        ) : (
          <div className="mat__rows">{position === 'bottom' ? [tokenRow, characterRow] : [characterRow, tokenRow]}</div>
        )}
        {deckColumn}
      </div>
    );

    // The HUD (name/health, Chakra, hand, deck tools) is each player's own
    // colored strip, `info` first so it's the first thing seen entering that
    // player's zone — from the top of the page for the top board, or right
    // after the shared battlefield for the bottom board.
    const hud = (
      <div className={`player-board player-board--${position} player-board--${playerId}`} key={playerId}>
        {/* Chakra sits right against the board, then the hand: board → Chakra → hand for the bottom player, mirrored for the top one. */}
        {position === 'bottom' ? [chakra, hand, info] : [info, hand, chakra]}
      </div>
    );

    return { hud, battlefield };
  }

  const top = renderPlayerBoard(topId, 'top');
  const bottom = renderPlayerBoard(bottomId, 'bottom');

  return (
    <div className="app">
      <div className="app__header">
        <h1>
          Naruto Custom Card Game <span className={`variant-badge variant-badge--${VARIANT}`}>{VARIANT_LABEL}</span>
        </h1>
        <span className="app__header-actions">
          {onRestart && (
            <button
              type="button"
              title="Start a brand-new game with the same players (keeps the connection)"
              onClick={() => setConfirmRestart(true)}
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
        {/* The log sits on the far left, always in view, so both players can follow what happened. */}
        <aside className="game-log">
          <ActionLog log={state.log} />
        </aside>
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
            {trust && (
              <>
                <label title="Take the Draw Phase draw automatically. The manual Draw buttons still work.">
                  <input
                    type="checkbox"
                    checked={state.options?.autoDraw !== false}
                    onChange={(e) => dispatch({ type: 'SET_OPTION', option: 'autoDraw', value: e.target.checked })}
                  />{' '}
                  Auto-draw
                </label>
                <label title="Every declared round waits for both players to confirm, even when one of them has nothing they could respond with. Either player can turn this on.">
                  <input
                    type="checkbox"
                    checked={!!state.options?.alwaysConfirm}
                    onChange={(e) => dispatch({ type: 'SET_OPTION', option: 'alwaysConfirm', value: e.target.checked })}
                  />{' '}
                  Always confirm
                </label>
              </>
            )}
          </div>
          <PhaseIndicator
            state={state}
            onGoToPhase={(phase) => dispatch({ type: 'GO_TO_PHASE', phase })}
            onPassTurn={!setupBlocked && isMyBoard(state.activePlayer) ? () => dispatch({ type: 'PASS_TURN' }) : undefined}
          />
          {trust && <RuleWarnings log={state.log} />}
          {onUndo && (
            <button type="button" className="sidebar-undo" disabled={!undoLabel} onClick={onUndo} title="Undo the last draw/reveal-type action (things you can't fix by hand)">
              ↶ Undo{undoLabel ? `: ${undoLabel}` : ''}
            </button>
          )}
          {placing && (
            <div className="pending-banner">
              <span>Choose a back-row slot for {placing.name} — beside one of your characters, or onto one to push it aside.</span>
              <button type="button" onClick={() => setPlacing(null)}>
                Cancel
              </button>
            </div>
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
                        ? `your last C+ ${isPrototype(state) ? 'Leader' : 'character'} fell — take a free ${CHARACTER_DECK_NAME} draw (${isPrototype(state) ? 'pick any Leader' : 'look at 2, keep 1'})?`
                        : isPrototype(state)
                          ? `a C+ Leader fell — pay ${currentTax(state, pid)} Supplies to draw a new Leader (pick any from your ${CHARACTER_DECK_NAME})?`
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
                  {`Draw (${MAIN_DECK_NAME}: ${state.players[state.activePlayer].handDeck.length})`}
                </button>
              )}
            </div>
          )}
          {isPrototype(state) && !setupBlocked && <ShinobiCombatPanel state={state} isMyBoard={isMyBoard} dispatch={dispatch} />}
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
          <RulesReference />
        </aside>
      </div>
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
      {forcePrompt && (
        <DetailsModal title="Not legal under the strict rules" subtitle="Trust mode — you can still force it through" hideText onClose={() => setForcePrompt(null)}>
          <ul className="force-prompt__list">
            {forcePrompt.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <div className="force-prompt__actions">
            <button type="button" onClick={() => setForcePrompt(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="force-prompt__force"
              onClick={() => {
                forcePrompt.declare(true);
                setForcePrompt(null);
              }}
            >
              Force it through
            </button>
          </div>
        </DetailsModal>
      )}
      {confirmCharacterDraw && (
        <DetailsModal
          title={
            isPrototype(state)
              ? `Draw a new Leader for ${currentTax(state, confirmCharacterDraw)} Supplies?`
              : `Draw from your ${CHARACTER_DECK_NAME} for ${currentTax(state, confirmCharacterDraw)} Chakra?`
          }
          subtitle={
            isPrototype(state)
              ? `Search your whole ${CHARACTER_DECK_NAME} and pick exactly the Leader you want. It resolves right away and can't be responded to.`
              : "Look at the top 2 and keep 1; the other goes to the bottom. It resolves right away and can't be responded to."
          }
          hideText
          onClose={() => setConfirmCharacterDraw(null)}
        >
          <p className="details-modal__note">
            {isPrototype(state)
              ? `You have ${suppliesAvailable(state, confirmCharacterDraw)} Supplies available.`
              : `You have ${state.players[confirmCharacterDraw].genericChakraAvailable} Chakra available.`}
            {currentTax(state, confirmCharacterDraw) < 8 && ` Your next paid draw will cost ${Math.min(8, currentTax(state, confirmCharacterDraw) + 2)}.`}
          </p>
          <div className="force-prompt__actions">
            <button type="button" onClick={() => setConfirmCharacterDraw(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="force-prompt__confirm"
              onClick={() => {
                dispatch({ type: 'DRAW_CHARACTER_DECK', player: confirmCharacterDraw });
                setConfirmCharacterDraw(null);
              }}
            >
              Pay &amp; draw
            </button>
          </div>
        </DetailsModal>
      )}
      {confirmRestart && onRestart && (
        <DetailsModal title="Restart the game?" subtitle="The current game will be lost." hideText onClose={() => setConfirmRestart(false)}>
          <div className="force-prompt__actions">
            <button type="button" onClick={() => setConfirmRestart(false)}>
              Keep playing
            </button>
            <button
              type="button"
              className="force-prompt__force"
              onClick={() => {
                setConfirmRestart(false);
                onRestart();
              }}
            >
              Restart
            </button>
          </div>
        </DetailsModal>
      )}
      {details?.kind === 'card' && (
        <DetailsModal title={details.name} subtitle={details.subtitle} text={details.text} onClose={() => setDetails(null)}>
          {details.returnInstanceId && (
            <button
              type="button"
              title="Undo putting this into play: back to your hand (you can also drag its chip onto your hand)"
              onClick={() => {
                dispatch({ type: 'RETURN_IN_PLAY_CARD_TO_HAND', instanceId: details.returnInstanceId! });
                setDetails(null);
              }}
            >
              Return to hand
            </button>
          )}
        </DetailsModal>
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
  const [state, setState] = useState<GameState>(() => createSetupState(undefined, 'trust', {}, RULESET_OPTS));
  /** Both seats' decks from the lobby — kept so Restart deals the same decks again. */
  const decksRef = useRef<Partial<Record<PlayerId, DeckList>>>({});
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
    const fresh = createSetupState(undefined, 'trust', decksRef.current, RULESET_OPTS);
    stateRef.current = fresh;
    setState(fresh);
    setHistory([]);
  }, []);

  /** A fresh game with these decks (from the lobby's deck pickers). */
  const start = useCallback(
    (decks: Partial<Record<PlayerId, DeckList>>) => {
      decksRef.current = decks;
      restart();
    },
    [restart],
  );

  return { state, dispatch, undo, undoLabel: history.at(-1)?.label ?? null, restart, start };
}

function App() {
  const [viewMode, setViewMode] = useState<'lobby' | 'local' | 'library'>('lobby');
  const local = useLocalGame();
  const net = useNetGame();
  const [decks, setDecks] = useState<DeckList[]>(loadDecks);
  const [deckId, setDeckId] = useState(() => loadSelectedDeckId('p1'));
  const [p2DeckId, setP2DeckId] = useState(() => loadSelectedDeckId('local-p2'));
  const deckFor = (id: string) => decks.find((d) => d.id === id) ?? decks[0];

  const updateDecks = (update: (decks: DeckList[]) => DeckList[]) => {
    setDecks((prev) => {
      const next = update(prev);
      saveDecks(next);
      return next;
    });
  };
  const selectDeck = (id: string) => {
    setDeckId(id);
    saveSelectedDeckId(id, 'p1');
  };
  const selectP2Deck = (id: string) => {
    setP2DeckId(id);
    saveSelectedDeckId(id, 'local-p2');
  };

  if (viewMode === 'library') {
    return <DeckLibrary decks={decks} selectedId={deckFor(deckId).id} onDecksChange={updateDecks} onSelect={selectDeck} onBack={() => setViewMode('lobby')} />;
  }

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
      onHost={() => net.host(deckFor(deckId))}
      onJoin={(code) => net.join(code, deckFor(deckId))}
      onPlayLocal={() => {
        local.start({ p1: deckFor(deckId), p2: deckFor(p2DeckId) });
        setViewMode('local');
      }}
      onCancel={net.leave}
      decks={decks}
      deckId={deckFor(deckId).id}
      onSelectDeck={selectDeck}
      p2DeckId={deckFor(p2DeckId).id}
      onSelectP2Deck={selectP2Deck}
      onOpenLibrary={() => setViewMode('library')}
    />
  );
}

export default App;
