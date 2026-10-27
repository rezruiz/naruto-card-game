import { needsEnablingCharacter, type HandCardContext, type HandCardDef } from '../engine/cards/registry';
import type { GameState, PlayerId } from '../engine/types';
import { VARIANT } from '../variant';

/** The Prototype build plays the prototype rules: every Jutsu card needs a Leader, and its cost always comes from that Leader's Pool. */
const PROTOTYPE = VARIANT === 'prototype';

export type PendingCard = {
  kind: 'card';
  playerId: PlayerId;
  cardInstanceId: string;
  def: HandCardDef;
  enablingInstanceId: string;
  /** null = not yet chosen (only relevant when def.offersPoolDiscount). */
  payFromPool: number | null;
  targets: string[];
  /** Set once the player clicks Confirm on a partial target selection — lets a card with an optional 2nd target (e.g. Explosive Tag) move on without picking one. */
  targetsConfirmed: boolean;
  /** null = not yet chosen (only relevant when def.needsAmountChoice). */
  amount: number | null;
};

export type CardStage = 'enabler' | 'payFromPool' | 'target' | 'amount' | 'ready';

/**
 * Where a card-in-progress is in its enabler -> target(s) -> amount ->
 * pool-discount choice pipeline (payment last, since a cost can depend on
 * the targets or the amount — e.g. Water Dragon Jutsu's 1+X) — purely derived from what's been picked so
 * far and what this particular card actually needs, so each step is only
 * shown when it's actually relevant to that card (most cards skip most of
 * these stages entirely).
 */
export function cardStage(p: PendingCard): CardStage {
  // Only a Jutsu with an ability Type is played "through" a character (§5.3/§10c) — everything else skips this stage.
  if (needsEnablingCharacter(p.def, PROTOTYPE) && !p.enablingInstanceId) return 'enabler';
  const maxTargets = p.def.maxTargets ?? 1;
  if (!p.targetsConfirmed && maxTargets > 0 && p.targets.length < maxTargets) return 'target';
  const wantsAmount = typeof p.def.needsAmountChoice === 'function' ? p.def.needsAmountChoice(p.targets) : !!p.def.needsAmountChoice;
  if (wantsAmount && p.amount === null) return 'amount';
  if (p.def.offersPoolDiscount && p.payFromPool === null && !PROTOTYPE) return 'payFromPool';
  return 'ready';
}

export function toHandCardContext(state: GameState, p: PendingCard): HandCardContext {
  return { state, player: p.playerId, enablingInstanceId: p.enablingInstanceId, targetInstanceIds: p.targets, amount: p.amount ?? undefined };
}

export function newPendingCard(playerId: PlayerId, cardInstanceId: string, def: HandCardDef): PendingCard {
  return {
    kind: 'card',
    playerId,
    cardInstanceId,
    def,
    enablingInstanceId: '',
    payFromPool: def.offersPoolDiscount ? null : 0,
    targets: [],
    targetsConfirmed: false,
    amount: null,
  };
}
