import { getCharacterDeckEntry } from './characters';
import { applyHealthLoss } from './combat';
import { appendLog } from './phases/phaseMachine';
import { getHandCardDef } from './cards/registry';
import { currentTax, reinforcementTax } from './playCharacter';
import type { GameState, HandCardInstance, PlayerId } from './types';

const MAIN_PHASES = new Set(['Main1', 'Main2']);

/** Fisher-Yates — pure, returns a new array. */
export function shuffle<T>(items: T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

let handCardCounter = 0;
export function makeHandCardInstance(defId: string): HandCardInstance {
  handCardCounter += 1;
  return { instanceId: `hand-${defId}-${handCardCounter}`, defId };
}

/**
 * The 40-card Akatsuki Hand Deck manifest (design/IMPLEMENTATION_PLAN.md):
 * 2 copies each of the 6 Missions (12) + 3 copies each of the Substitution
 * family (9) + 2 copies each of the other 7 Jutsu cards (14) + 3 copies of
 * the 1 Terrain card (3) + 2 copies of the 1 Assist card (2) = 40 real
 * cards, no Chakra Fodder filler needed.
 */
export const HAND_DECK_MANIFEST: { defId: string; copies: number }[] = [
  { defId: 'unshakable-resolve', copies: 2 },
  { defId: 'bingo-book-s', copies: 2 },
  { defId: 'bingo-book-a', copies: 2 },
  { defId: 'bingo-book-b', copies: 2 },
  { defId: 'bingo-book-c', copies: 2 },
  { defId: 'squad-formation', copies: 2 },
  { defId: 'substitution', copies: 3 },
  { defId: 'lightning-substitution', copies: 3 },
  { defId: 'water-substitution', copies: 3 },
  { defId: 'incoming-mission-assignment', copies: 2 },
  { defId: 'chakra-transfer', copies: 2 },
  { defId: 'field-intelligence', copies: 2 },
  { defId: 'deploy-medic-corps', copies: 2 },
  { defId: 'jutsu-disruption', copies: 2 },
  { defId: 'explosive-tag', copies: 2 },
  { defId: 'battlefield-selection', copies: 2 },
  { defId: 'akatsuki-hideout', copies: 3 },
  { defId: 'chidori-interception', copies: 2 },
];

export function buildHandDeck(manifest: { defId: string; copies: number }[] = HAND_DECK_MANIFEST): HandCardInstance[] {
  const cards: HandCardInstance[] = [];
  for (const { defId, copies } of manifest) {
    for (let i = 0; i < copies; i++) cards.push(makeHandCardInstance(defId));
  }
  return shuffle(cards);
}

/**
 * "Look at the top N cards of your Hand Deck; you may add 1 [cardType]
 * card among them to your hand; shuffle the rest back" (Incoming Mission
 * Assignment, Battlefield Selection, §13b). NOTE (simplified for this pass,
 * same as every other "controller's optional choice" card this session):
 * automatically takes the first matching card found rather than presenting
 * a real choice — no such UI channel exists yet.
 */
export function lookAndTakeCardType(state: GameState, player: PlayerId, count: number, cardType: string): GameState {
  const p = state.players[player];
  const seen = p.handDeck.slice(0, count);
  const rest = p.handDeck.slice(count);
  const takeIndex = seen.findIndex((c) => getHandCardDef(c.defId)?.cardType === cardType);

  if (takeIndex === -1) {
    const next = { ...state, players: { ...state.players, [player]: { ...p, handDeck: shuffle([...rest, ...seen]) } } };
    return appendLog(next, `${player} finds no ${cardType} card among the top ${count} and shuffles them back.`);
  }
  const taken = seen[takeIndex];
  const shuffledBack = shuffle([...rest, ...seen.filter((_, i) => i !== takeIndex)]);
  const next = {
    ...state,
    players: {
      ...state.players,
      [player]: { ...p, handDeck: shuffledBack, hand: [...p.hand, { kind: 'card' as const, instanceId: taken.instanceId, defId: taken.defId }] },
    },
  };
  return appendLog(next, `${player} adds a ${cardType} card to hand.`);
}

let characterHandEntryCounter = 0;

/**
 * SPEC.md §4.3: the Draw Phase draw — a manual click, once per turn, by the
 * active player during their Draw Phase. The very first player's very
 * first turn skips it. Out-of-timing draws are refused under the strict
 * rules and allowed with an advisory in trust mode.
 */
export function drawForDrawPhase(state: GameState): GameState {
  const relaxed = state.rules === 'trust';
  const player = state.activePlayer;
  const p = state.players[player];
  let working = state;
  if (state.phase !== 'Draw') {
    if (!relaxed) return appendLog(state, `${player} can only take their Draw Phase draw during the Draw Phase.`);
    working = appendLog(working, `${player} takes their Draw Phase draw outside the Draw Phase — not legal under the strict rules, allowed anyway (trust mode).`);
  }
  if (p.drawnThisDrawPhase) return appendLog(working, `${player} has already drawn this turn.`);
  if (state.turn === 1 && player === state.firstPlayer) {
    return appendLog(working, `${player} goes first, so their very first turn skips the Draw Phase draw.`);
  }
  let next = drawCard(working, player);
  next = { ...next, players: { ...next.players, [player]: { ...next.players[player], drawnThisDrawPhase: true } } };
  return appendLog(next, `${player} draws for the turn.`);
}

/**
 * SPEC.md §8: a Character Deck draw — look at the top 2, pick 1 (plus the
 * D-rank bonus rule). A state-based action: never goes on the stack and
 * resolves immediately. Its cost and timing come from what triggered it:
 * - 'manual': the player's own choice — Normal-speed timing (their own
 *   Main Phase), pays the current tax, and is the ONLY thing that raises
 *   the tax counter.
 * - 'reinforcement-paid': accepted after one of their C+ characters fell —
 *   any time, pays the current tax, counter unchanged.
 * - 'reinforcement-free': their last C+ character fell with no C+ character
 *   in hand — free, counter unchanged.
 */
export function drawFromCharacterDeck(state: GameState, player: PlayerId, mode: 'manual' | 'reinforcement-paid' | 'reinforcement-free'): GameState {
  const relaxed = state.rules === 'trust';
  const p = state.players[player];
  let working = state;
  if (p.pendingCharacterReveal) return appendLog(state, `${player} already has a Character Deck reveal to resolve first.`);
  if (p.characterDeck.length === 0) return appendLog(state, `${player}'s Character Deck is empty.`);
  if (mode === 'manual' && !(MAIN_PHASES.has(state.phase) && state.activePlayer === player)) {
    if (!relaxed) return appendLog(state, `${player} can only draw from the Character Deck during their own Main Phase.`);
    working = appendLog(working, `${player} draws from the Character Deck outside their own Main Phase — not legal under the strict rules, allowed anyway (trust mode).`);
  }

  const wp = working.players[player];
  const fullCost = mode === 'reinforcement-free' ? 0 : currentTax(working, player);
  const discountUsed = mode === 'reinforcement-free' ? 0 : Math.min(reinforcementTax(wp.reinforcementsPlayed), wp.nextReinforcementDiscount);
  if (fullCost > wp.genericChakraAvailable) {
    if (!relaxed) return appendLog(working, `${player} doesn't have ${fullCost} Chakra available for the Character Deck draw.`);
    working = appendLog(working, `${player} is short ${fullCost - wp.genericChakraAvailable} Chakra for the Character Deck draw (trust mode — allowed).`);
  }
  const paid = Math.min(fullCost, wp.genericChakraAvailable);
  let next: GameState = {
    ...working,
    players: {
      ...working.players,
      [player]: {
        ...wp,
        genericChakraAvailable: wp.genericChakraAvailable - paid,
        reinforcementsPlayed: mode === 'manual' ? wp.reinforcementsPlayed + 1 : wp.reinforcementsPlayed,
        nextReinforcementDiscount: wp.nextReinforcementDiscount - discountUsed,
      },
    },
  };
  next = appendLog(
    next,
    mode === 'reinforcement-free'
      ? `${player} takes a free Reinforcement draw (their last C+ character fell).`
      : mode === 'reinforcement-paid'
        ? `${player} pays ${paid} Chakra for a Reinforcement draw (the tax doesn't go up).`
        : `${player} pays the Character Deck tax (${paid} Chakra) to draw — next draw costs ${reinforcementTax(next.players[player].reinforcementsPlayed)}.`,
  );
  return revealCharacters(next, player, 2, 'reinforcement');
}

/**
 * SPEC.md §4.3/§10b's "whenever you're required to draw" deck-out rule: draw
 * 1 card from the Hand Deck, or take 3 Health damage instead if it's empty.
 * Used by the automatic Draw Phase draw and by any card effect that draws.
 */
export function drawCard(state: GameState, player: PlayerId): GameState {
  const p = state.players[player];
  if (p.handDeck.length === 0) {
    let next = appendLog(state, `${player}'s Hand Deck is empty — takes 3 Health damage instead of drawing.`);
    return applyHealthLoss(next, player, 3);
  }
  const [card, ...rest] = p.handDeck;
  return {
    ...state,
    players: {
      ...state.players,
      [player]: { ...p, handDeck: rest, hand: [...p.hand, { kind: 'card', instanceId: card.instanceId, defId: card.defId }] },
    },
  };
}

/**
 * SPEC.md §8: reveal `count` Character Deck cards (the Setup draw uses 3,
 * a Reinforcement draw uses 2) — extended per the all-D-rank rule: if every
 * card revealed so far is D Rank, keep revealing one at a time until a
 * non-D-rank card turns up. Populates pendingCharacterReveal; the caller
 * must follow up with chooseCharacter.
 */
export function revealCharacters(
  state: GameState,
  player: PlayerId,
  count: number,
  reason: 'setup' | 'reinforcement',
): GameState {
  const p = state.players[player];
  const deck = p.characterDeck.slice();
  const revealed: string[] = [];
  for (let i = 0; i < count && deck.length > 0; i++) {
    revealed.push(deck.shift()!);
  }
  while (revealed.length > 0 && deck.length > 0 && revealed.every((id) => getCharacterDeckEntry(id)?.rank === 'D')) {
    revealed.push(deck.shift()!);
  }
  const next = {
    ...state,
    players: { ...state.players, [player]: { ...p, characterDeck: deck, pendingCharacterReveal: { revealed, reason } } },
  };
  return appendLog(next, `${player} reveals ${revealed.length} Character Deck card(s).`);
}

/**
 * SPEC.md §8: resolves a pending reveal (from revealCharacters). `mainPickId`
 * is the player's one normal choice; up to 2 D-rank cards among the rest of
 * the same reveal are kept automatically alongside it (the D-rank bonus, §8);
 * everything else returns to the bottom of the Character Deck.
 */
export function chooseCharacter(state: GameState, player: PlayerId, mainPickId: string): GameState {
  const p = state.players[player];
  const pending = p.pendingCharacterReveal;
  if (!pending || !pending.revealed.includes(mainPickId)) {
    return appendLog(state, `${player} has no such Character Deck card to choose.`);
  }
  const mainEntry = getCharacterDeckEntry(mainPickId);
  if (!mainEntry) return appendLog(state, `Unknown Character Deck card: ${mainPickId}.`);

  const dRankBonus: string[] = [];
  for (const id of pending.revealed) {
    if (id === mainPickId) continue;
    if (dRankBonus.length >= 2) break;
    if (getCharacterDeckEntry(id)?.rank === 'D') dRankBonus.push(id);
  }
  const kept = [mainPickId, ...dRankBonus];
  const bottomed = pending.revealed.filter((id) => !kept.includes(id));

  // D-rank bonus cards always just go to hand, regardless of reason — only
  // the Setup draw's own single main pick gets played onto the board
  // immediately, for free (§3).
  const bonusEntries = dRankBonus.map((entryId) => {
    characterHandEntryCounter += 1;
    return { kind: 'character' as const, instanceId: `${player}-char-hand-${characterHandEntryCounter}`, entryId };
  });

  // §3 shuffles the unchosen cards back into the deck at Setup; a Reinforcement draw (§8) puts them on the bottom instead.
  const returned = [...p.characterDeck, ...bottomed];
  let next: GameState = {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...p,
        hand: [...p.hand, ...bonusEntries],
        characterDeck: pending.reason === 'setup' ? shuffle(returned) : returned,
        pendingCharacterReveal: null,
      },
    },
  };

  if (pending.reason === 'setup') {
    // §3: the starting character has summoning sickness — on its controller's first turn, which is turn 2 for whoever goes second.
    next = mainEntry.spawn(next, player, player === next.firstPlayer ? 1 : 2, false);
    next = {
      ...next,
      players: { ...next.players, [player]: { ...next.players[player], startingCharacterInstanceId: findLatestSpawnedId(next, player) } },
    };
    next = appendLog(next, `${player} chooses ${mainEntry.name} as their starting character.`);
  } else {
    characterHandEntryCounter += 1;
    const mainEntryHandItem = { kind: 'character' as const, instanceId: `${player}-char-hand-${characterHandEntryCounter}`, entryId: mainPickId };
    next = {
      ...next,
      players: { ...next.players, [player]: { ...next.players[player], hand: [...next.players[player].hand, mainEntryHandItem] } },
    };
    next = appendLog(next, `${player} adds ${mainEntry.name} to hand.`);
  }

  return dRankBonus.length > 0 ? appendLog(next, `${player} also keeps ${dRankBonus.length} D-rank card(s) from the same reveal.`) : next;
}

/** The instanceId of whichever character/token this player's spawn() call just placed — used to capture it as the Setup starting character. Assumes spawn() only ever adds new occupants, never removes any. */
function findLatestSpawnedId(state: GameState, player: PlayerId): string {
  const p = state.players[player];
  const lastCharacter = [...p.backRow].reverse().find((c) => c !== null);
  return lastCharacter ? lastCharacter.instanceId : '';
}

/**
 * SPEC.md §3: mulligan — shuffle your hand's Hand Deck cards back in and
 * redraw. The first mulligan is free (a full new 6-card hand); every
 * mulligan after that draws exactly 1 fewer card than the previous draw.
 * Only affects Hand Deck ('card') entries — any Character cards already in
 * hand from the Setup draw are left untouched.
 */
export function mulligan(state: GameState, player: PlayerId): GameState {
  const p = state.players[player];
  // Confirming your starting character finalizes your Setup — your hand is kept from then on.
  if (p.startingCharacterInstanceId !== null) return appendLog(state, `${player} has already finished Setup — their hand is kept.`);
  const cardEntries = p.hand.filter((h) => h.kind === 'card');
  const otherEntries = p.hand.filter((h) => h.kind !== 'card');
  const shuffledBack = shuffle([...p.handDeck, ...cardEntries.map((c) => ({ instanceId: c.instanceId, defId: c.defId }))]);

  const drawCount = Math.max(0, 6 - p.mulligansSoFar);
  const drawn = shuffledBack.slice(0, drawCount);
  const remaining = shuffledBack.slice(drawCount);

  const next = {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...p,
        handDeck: remaining,
        hand: [...otherEntries, ...drawn.map((c) => ({ kind: 'card' as const, instanceId: c.instanceId, defId: c.defId }))],
        mulligansSoFar: p.mulligansSoFar + 1,
      },
    },
  };
  return appendLog(next, `${player} mulligans to ${drawCount} card(s).`);
}
