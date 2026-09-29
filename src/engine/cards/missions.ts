import { findOccupant, isCharacter, patchCharacter, patchOccupant } from '../board';
import { healOccupant } from '../combat';
import { appendLog } from '../phases/phaseMachine';
import { drawCard, revealCharacters } from '../deck';
import { getHandCardDef, registerHandCard, registerMission } from './registry';
import { enqueueChoice, registerChoiceResolver } from '../choices';
import type { HandCardDef, HandCardContext, MissionDef } from './registry';
import type { GameState, MissionInstance, PlayerId } from '../types';

let missionCounter = 0;

function missionName(defId: string): string {
  return getHandCardDef(defId)?.name ?? defId;
}

/** Discards one of this player's Missions in play (by instance id) to the discard pile. */
function discardMission(state: GameState, owner: PlayerId, missionInstanceId: string): GameState {
  const p = state.players[owner];
  const mission = p.missionsInPlay.find((m) => m.instanceId === missionInstanceId);
  if (!mission) return state;
  const next = {
    ...state,
    players: {
      ...state.players,
      [owner]: {
        ...p,
        missionsInPlay: p.missionsInPlay.filter((m) => m.instanceId !== missionInstanceId),
        discardPile: [...p.discardPile, { instanceId: mission.instanceId, defId: mission.defId }],
      },
    },
  };
  return appendLog(next, `${owner} replaces ${mission.extra.faceDown ? 'a face-down Mission' : missionName(mission.defId)}.`);
}

registerChoiceResolver('mission-replace', (state, choice, optionIds) => discardMission(state, choice.player, optionIds[0]));

/**
 * SPEC.md §10b: enters play. At the controlled-character-count cap, the
 * controller chooses which existing Mission it replaces ("one of your
 * choice") — asked, never picked for them. With only one candidate there's
 * nothing to choose.
 */
function enterPlayAsMission(ctx: HandCardContext, defId: string, extra: Record<string, unknown> = {}): GameState {
  const p = ctx.state.players[ctx.player];
  const controlledCount = p.backRow.filter((c) => c !== null).length;
  const atCap = p.missionsInPlay.length >= Math.max(1, controlledCount);
  const candidates = p.missionsInPlay;
  missionCounter += 1;
  const played: MissionInstance = { instanceId: `mission-${ctx.player}-${missionCounter}`, defId, owner: ctx.player, extra };
  let next: GameState = {
    ...ctx.state,
    players: { ...ctx.state.players, [ctx.player]: { ...p, missionsInPlay: [...p.missionsInPlay, played] } },
  };
  next = appendLog(next, `${ctx.player} plays ${extra.faceDown ? 'a face-down Mission' : missionName(defId)} as a Mission.`);
  if (!atCap || candidates.length === 0) return next;
  if (candidates.length === 1) return discardMission(next, ctx.player, candidates[0].instanceId);
  return enqueueChoice(next, {
    player: ctx.player,
    prompt: 'Mission limit reached — choose which Mission in play to replace.',
    options: candidates.map((m) => ({ id: m.instanceId, label: missionName(m.defId) + (m.extra.faceDown ? ' (face-down)' : '') })),
    min: 1,
    max: 1,
    resolverId: 'mission-replace',
    data: {},
  });
}

/**
 * A Mission reward that goes to "a character you control" — the controller
 * picks which one. `reward` names the effect so the follow-up can be looked
 * up again from plain data (see choices.ts).
 */
function rewardCharacterChoice(state: GameState, owner: PlayerId, reward: 'unshakable-resolve' | 'bingo-book-b', prompt: string): GameState {
  const characters = state.players[owner].backRow.filter((c): c is NonNullable<typeof c> => c !== null);
  if (characters.length === 0) return state;
  if (characters.length === 1) return applyCharacterReward(state, reward, characters[0].instanceId);
  return enqueueChoice(state, {
    player: owner,
    prompt,
    options: characters.map((c) => ({ id: c.instanceId, label: c.name })),
    min: 1,
    max: 1,
    resolverId: 'mission-reward',
    data: { reward },
  });
}

function applyCharacterReward(state: GameState, reward: string, target: string): GameState {
  if (reward === 'unshakable-resolve') {
    let next = patchCharacter(state, target, (c) => ({ ...c, chakraPool: { ...c.chakraPool, current: c.chakraPool.current + 5 } }));
    next = healOccupant(next, target, 5);
    return appendLog(next, `Unshakable Resolve's reward goes to ${findOccupant(next, target)?.occupant.name ?? 'a character'}.`);
  }
  const next = patchCharacter(state, target, (c) => ({
    ...c,
    chakraPool: { ...c.chakraPool, current: Math.min(c.chakraPool.capacity, c.chakraPool.current + 3) },
  }));
  return appendLog(next, `Bingo Book: Threat Level B's +3 Chakra goes to ${findOccupant(next, target)?.occupant.name ?? 'a character'}.`);
}

registerChoiceResolver('mission-reward', (state, choice, optionIds) => applyCharacterReward(state, choice.data.reward as string, optionIds[0]));

function missionCard(id: string, name: string, cost: number, faceDown: boolean, initialExtra: Record<string, unknown> = {}): HandCardDef {
  return {
    id,
    name,
    cardType: 'mission',
    cost,
    speed: 'Normal',
    style: 'None',
    type: 'None',
    maxTargets: 0,
    resolve: (ctx) => enterPlayAsMission(ctx, id, faceDown ? { ...initialExtra, faceDown: true } : initialExtra),
  };
}

// --- Unshakable Resolve ----------------------------------------------------

// The health baseline and Untap count are captured the moment it enters
// play (its own resolve, not the generic missionCard() factory, since that
// needs to read the controller's CURRENT Health at play time) — not lazily
// on the first tick. SPEC.md's "reach your 6th Untap Phase after this
// Mission was played" counts 6 Untaps from the moment it was played; capturing
// the baseline on the first tick instead of at play time was an off-by-one
// bug that made it silently take 7 Untaps to fire.
const unshakableResolve: HandCardDef = {
  id: 'unshakable-resolve',
  name: 'Unshakable Resolve',
  cardType: 'mission',
  cost: 1,
  speed: 'Normal',
  style: 'None',
  type: 'None',
  maxTargets: 0,
  resolve: (ctx) => enterPlayAsMission(ctx, 'unshakable-resolve', { healthAtPlay: ctx.state.players[ctx.player].health, untaps: 0 }),
};
registerMission({
  id: 'unshakable-resolve',
  tick: (state, owner, missionInstanceId, trigger) => {
    if (trigger.kind !== 'untap') return { state, discard: false };
    const mission = state.players[owner].missionsInPlay.find((m) => m.instanceId === missionInstanceId);
    if (!mission) return { state, discard: false };

    const healthAtPlay = mission.extra.healthAtPlay as number;
    if (state.players[owner].health <= healthAtPlay - 10) {
      return { state: appendLog(state, 'Unshakable Resolve fails — too much Health lost.'), discard: true };
    }
    const untaps = (mission.extra.untaps as number) + 1;
    if (untaps < 6) {
      return { state: patchMission(state, owner, missionInstanceId, { untaps }), discard: false };
    }

    const next = appendLog(state, 'Unshakable Resolve succeeds!');
    return { state: rewardCharacterChoice(next, owner, 'unshakable-resolve', 'Unshakable Resolve: choose a character you control to gain +5 Chakra and heal 5.'), discard: true };
  },
});

/** A short, human-readable progress readout for a Mission currently in play — so its Condition's progress (an Untap count, whether Squad Formation has locked in its group, ...) is actually visible somewhere, not just tracked invisibly in `extra`. `undefined` for a Mission with nothing meaningful to show yet (or a face-down one, which the UI should call this with only once revealed). */
export function missionProgressText(defId: string, extra: Record<string, unknown>): string | undefined {
  if (defId === 'unshakable-resolve') {
    const untaps = extra.untaps as number | undefined;
    return untaps === undefined ? undefined : `${untaps}/6 Untaps`;
  }
  if (defId === 'squad-formation') {
    if (!extra.active) return 'Waiting for 3 characters in play';
    return extra.redirectTo ? 'Active — redirecting hits' : 'Active — redirect off';
  }
  return undefined;
}

function patchMission(state: GameState, owner: PlayerId, missionInstanceId: string, patch: Record<string, unknown>): GameState {
  const p = state.players[owner];
  const missionsInPlay = p.missionsInPlay.map((m) => (m.instanceId === missionInstanceId ? { ...m, extra: { ...m.extra, ...patch } } : m));
  return { ...state, players: { ...state.players, [owner]: { ...p, missionsInPlay } } };
}

// --- Bingo Book family -------------------------------------------------------

function bingoBookReward(rank: 'S' | 'A' | 'B' | 'C'): MissionDef['tick'] {
  return (state, owner, _missionInstanceId, trigger) => {
    if (trigger.kind !== 'defeat' || trigger.rank !== rank) return { state, discard: false };
    let next = state;

    if (rank === 'S') {
      // NOTE (simplified for this pass): "look at top 4 instead of top 2"
      // is delivered as an immediate reveal-4-keep-1 Character Deck draw
      // (the real 2-keep-1 Reinforcement shape, just bigger) rather than
      // modifying a *future* draw's size — no such deferred-parameter
      // channel exists yet.
      next = revealCharacters(next, owner, 4, 'reinforcement');
      next = { ...next, players: { ...next.players, [owner]: { ...next.players[owner], nextCharacterFullyStunned: true } } };
      next = drawCard(next, owner);
    } else if (rank === 'A') {
      next = {
        ...next,
        players: {
          ...next.players,
          [owner]: { ...next.players[owner], nextReinforcementDiscount: next.players[owner].nextReinforcementDiscount + 2, retaliationPending: true },
        },
      };
    } else if (rank === 'B') {
      next = rewardCharacterChoice(next, owner, 'bingo-book-b', 'Bingo Book: Threat Level B — choose a character you control to gain +3 Chakra.');
      next = drawCard(next, owner);
      next = {
        ...next,
        players: { ...next.players, [owner]: { ...next.players[owner], bonusChakraSourcePlacements: next.players[owner].bonusChakraSourcePlacements + 1 } },
      };
    } else {
      // NOTE (simplified for this pass): "the cost of the next ability used
      // by the character that defeated it is reduced by 2" is dropped —
      // combat.ts's dealDamage doesn't attribute damage to its source, so
      // there's no "which character defeated it" to apply a discount to
      // (the same gap noted for Itachi's Tsukuyomi condition).
      next = drawCard(next, owner);
    }

    return { state: appendLog(next, `Bingo Book: Threat Level ${rank}'s reward resolves.`), discard: true };
  };
}

const bingoBookS = missionCard('bingo-book-s', 'Bingo Book: Threat Level S', 0, true);
const bingoBookA = missionCard('bingo-book-a', 'Bingo Book: Threat Level A', 0, true);
const bingoBookB = missionCard('bingo-book-b', 'Bingo Book: Threat Level B', 0, true);
const bingoBookC = missionCard('bingo-book-c', 'Bingo Book: Threat Level C', 0, true);
registerMission({ id: 'bingo-book-s', tick: bingoBookReward('S') });
registerMission({ id: 'bingo-book-a', tick: bingoBookReward('A') });
registerMission({ id: 'bingo-book-b', tick: bingoBookReward('B') });
registerMission({ id: 'bingo-book-c', tick: bingoBookReward('C') });

// --- Squad Formation ---------------------------------------------------------

const squadFormation = missionCard('squad-formation', 'Squad Formation', 0, false, { active: false });
registerMission({
  id: 'squad-formation',
  tick: (state, owner, missionInstanceId, trigger) => {
    if (trigger.kind !== 'untap') return { state, discard: false };
    const mission = state.players[owner].missionsInPlay.find((m) => m.instanceId === missionInstanceId);
    if (!mission) return { state, discard: false };

    if (!mission.extra.active) {
      const controlled = state.players[owner].backRow.filter((c) => c !== null);
      if (controlled.length < 3) return { state, discard: false };
      const group = controlled.slice(0, 3).map((c) => c!.instanceId);
      let next = state;
      for (const id of group) {
        next = patchOccupant(next, id, (o) => ({ ...o, extra: { ...o.extra, squadFormationGroup: group } }));
      }
      next = patchMission(next, owner, missionInstanceId, { active: true, group });
      return { state: appendLog(next, 'Squad Formation selects its 3 characters.'), discard: false };
    }

    const group = (mission.extra.group as string[]) ?? [];
    const stillIntact = group.every((id) => {
      const found = findOccupant(state, id);
      return found && isCharacter(found.occupant) && !found.occupant.status.retreated;
    });
    if (!stillIntact) {
      return { state: appendLog(state, 'Squad Formation ends — one of its three is defeated or Retreated.'), discard: true };
    }
    return { state, discard: false };
  },
});

for (const def of [unshakableResolve, bingoBookS, bingoBookA, bingoBookB, bingoBookC, squadFormation]) {
  registerHandCard(def);
}
