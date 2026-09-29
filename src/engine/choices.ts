import { appendLog } from './phases/phaseMachine';
import type { GameState, PendingChoice, PlayerId } from './types';

/**
 * Resolution-time decisions (the rules text says the player chooses — "one
 * of your choice", "a character you control", which characters to keep up
 * when Upkeep can't cover everyone). The engine never picks for them: it
 * queues a PendingChoice and stops; the named player answers with
 * RESOLVE_CHOICE. Follow-ups are looked up by `resolverId` rather than
 * stored as closures, so the queue stays plain data (network + undo safe).
 */
export type ChoiceResolver = (state: GameState, choice: PendingChoice, optionIds: string[]) => GameState;

const resolvers: Record<string, ChoiceResolver> = {};

export function registerChoiceResolver(id: string, resolver: ChoiceResolver): void {
  resolvers[id] = resolver;
}

let choiceCounter = 0;

export function enqueueChoice(state: GameState, choice: Omit<PendingChoice, 'id'>): GameState {
  choiceCounter += 1;
  const withId: PendingChoice = { ...choice, id: `choice-${choiceCounter}` };
  return appendLog({ ...state, pendingChoices: [...state.pendingChoices, withId] }, `${choice.player} must choose: ${choice.prompt}`);
}

export function choicesFor(state: GameState, player: PlayerId): PendingChoice[] {
  return state.pendingChoices.filter((c) => c.player === player);
}

export function resolveChoice(state: GameState, choiceId: string, optionIds: string[]): GameState {
  const choice = state.pendingChoices.find((c) => c.id === choiceId);
  if (!choice) return appendLog(state, 'That choice is no longer pending.');
  const valid = [...new Set(optionIds)].filter((id) => choice.options.some((o) => o.id === id));
  if (valid.length < choice.min || valid.length > choice.max) {
    return appendLog(state, `${choice.player} must pick ${choice.min === choice.max ? choice.min : `${choice.min}–${choice.max}`} option(s).`);
  }
  const resolver = resolvers[choice.resolverId];
  const cleared: GameState = { ...state, pendingChoices: state.pendingChoices.filter((c) => c.id !== choiceId) };
  return resolver ? resolver(cleared, choice, valid) : cleared;
}
