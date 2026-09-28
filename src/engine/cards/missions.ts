import { findOccupant, isCharacter, patchCharacter, patchOccupant } from '../board';
import { healOccupant } from '../combat';
import { appendLog } from '../phases/phaseMachine';
import { drawCard, revealCharacters } from '../deck';
import { registerHandCard, registerMission } from './registry';
import type { HandCardDef, HandCardContext, MissionDef } from './registry';
import type { GameState, MissionInstance, PlayerId } from '../types';

let missionCounter = 0;

/** SPEC.md §10b: enters play, replacing an existing Mission at the controlled-character-count cap (auto: the oldest — documented simplification, no interactive "of your choice" channel exists yet). */
function enterPlayAsMission(ctx: HandCardContext, defId: string, extra: Record<string, unknown> = {}): GameState {
  const p = ctx.state.players[ctx.player];
  const controlledCount = p.backRow.filter((c) => c !== null).length;
  let missionsInPlay = p.missionsInPlay;
  let discardPile = p.discardPile;
  if (missionsInPlay.length >= Math.max(1, controlledCount)) {
    const [oldest, ...rest] = missionsInPlay;
    missionsInPlay = rest;
    if (oldest) discardPile = [...discardPile, { instanceId: oldest.instanceId, defId: oldest.defId }];
  }
  missionCounter += 1;
  const played: MissionInstance = { instanceId: `mission-${ctx.player}-${missionCounter}`, defId, owner: ctx.player, extra };
  const next = {
    ...ctx.state,
    players: { ...ctx.state.players, [ctx.player]: { ...p, missionsInPlay: [...missionsInPlay, played], discardPile } },
  };
  return appendLog(next, `${ctx.player} plays ${defId} as a Mission.`);
}

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

/** Auto-targets "a character you control" for a reward that needs one — the mission owner's first character in play (documented simplification, no player-choice channel exists yet). */
function firstOwnedCharacter(state: GameState, owner: PlayerId): string | undefined {
  return state.players[owner].backRow.find((c) => c !== null)?.instanceId;
}

// --- Unshakable Resolve ----------------------------------------------------

const unshakableResolve = missionCard('unshakable-resolve', 'Unshakable Resolve', 1, false);
registerMission({
  id: 'unshakable-resolve',
  tick: (state, owner, missionInstanceId, trigger) => {
    if (trigger.kind !== 'untap') return { state, discard: false };
    const mission = state.players[owner].missionsInPlay.find((m) => m.instanceId === missionInstanceId);
    if (!mission) return { state, discard: false };

    if (mission.extra.healthAtPlay === undefined) {
      // First Untap seen since being played — record the baseline.
      const withBaseline = patchMission(state, owner, missionInstanceId, { healthAtPlay: state.players[owner].health, untaps: 0 });
      return { state: withBaseline, discard: false };
    }

    const healthAtPlay = mission.extra.healthAtPlay as number;
    if (state.players[owner].health <= healthAtPlay - 10) {
      return { state: appendLog(state, 'Unshakable Resolve fails — too much Health lost.'), discard: true };
    }
    const untaps = (mission.extra.untaps as number) + 1;
    if (untaps < 6) {
      return { state: patchMission(state, owner, missionInstanceId, { untaps }), discard: false };
    }

    const target = firstOwnedCharacter(state, owner);
    let next = state;
    if (target) {
      next = patchCharacter(next, target, (c) => ({ ...c, chakraPool: { ...c.chakraPool, current: c.chakraPool.current + 5 } }));
      next = healOccupant(next, target, 5);
    }
    return { state: appendLog(next, 'Unshakable Resolve succeeds!'), discard: true };
  },
});

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
      const target = firstOwnedCharacter(next, owner);
      if (target) {
        next = patchCharacter(next, target, (c) => ({
          ...c,
          chakraPool: { ...c.chakraPool, current: Math.min(c.chakraPool.capacity, c.chakraPool.current + 3) },
        }));
      }
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
