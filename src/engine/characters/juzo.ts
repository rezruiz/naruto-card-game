import { findOccupant, isCharacter, patchCharacter } from '../board';
import { dealDamage, healOccupant } from '../combat';
import { appendLog } from '../phases/phaseMachine';
import type { AbilityDef } from '../abilities';
import { registerCharacter } from './registry';

const DEF_ID = 'juzo';

// NOTE (simplified for this pass): Iron-Forged Body's -1 Taijutsu damage
// reduction isn't wired into combat.dealDamage yet (same known gap as
// Kakuzu's Iron Skin and Konan's Paper Body).

const cleavingStrike: AbilityDef = {
  id: 'cleaving-strike',
  name: 'Cleaving Strike',
  cost: 3,
  speed: 'Normal',
  style: 'None',
  type: 'Taijutsu',
  isDamaging: true,
  usesPerTurn: 2,
  maxTargets: 2, // primary + an optional 2nd target, used only if the primary is defeated
  resolve: (ctx) => {
    const primary = ctx.targetInstanceIds[0];
    if (!primary) return ctx.state;
    const primaryFound = findOccupant(ctx.state, primary);
    const primaryWasCharacter = !!primaryFound && isCharacter(primaryFound.occupant);
    const result = dealDamage(ctx.state, primary, 3);
    let state = result.state;

    if (result.defeated) {
      if (primaryWasCharacter) state = healOccupant(state, ctx.sourceInstanceId, 3);
      const secondary = ctx.targetInstanceIds[1];
      if (secondary) state = dealDamage(state, secondary, 1).state;
    }
    return state;
  },
};

const hidingMist: AbilityDef = {
  id: 'hiding-mist',
  name: 'Water Style: Hiding Mist',
  cost: 2,
  speed: 'Quick',
  style: 'Water',
  type: 'Ninjutsu',
  maxTargets: 0,
  resolve: (ctx) => {
    const state = patchCharacter(ctx.state, ctx.sourceInstanceId, (k) => ({
      ...k,
      extra: { ...k.extra, evasiveActive: true },
    }));
    return appendLog(state, "Juzo vanishes into Hiding Mist — attackers targeting him must flip a coin, through end of turn.");
  },
};

const kubikiribouchouUnleashed: AbilityDef = {
  id: 'kubikiribouchou-unleashed',
  name: 'Kubikiribōchō Unleashed',
  cost: 5,
  speed: 'Normal',
  style: 'None',
  type: 'Taijutsu',
  isDamaging: true,
  isUltimate: true,
  resolve: (ctx) => {
    const target = ctx.targetInstanceIds[0];
    if (!target) return ctx.state;
    const targetFound = findOccupant(ctx.state, target);
    const wasCharacter = !!targetFound && isCharacter(targetFound.occupant);
    const result = dealDamage(ctx.state, target, 5);
    let state = result.state;
    if (result.defeated) {
      // Both Kubikiribōchō's Regeneration (3) and this Ultimate's own clause
      // (6) fire together on a killing blow (design/CHARACTER_LOG.md) — 9 total.
      if (wasCharacter) state = healOccupant(state, ctx.sourceInstanceId, 3);
      state = healOccupant(state, ctx.sourceInstanceId, 6);
    }
    return state;
  },
};

registerCharacter({
  id: DEF_ID,
  name: 'Juzo Biwa',
  rank: 'B',
  baseMaxHP: 9,
  basePoolCapacity: 2,
  styles: ['Water'],
  abilities: [cleavingStrike, hidingMist],
  ultimate: kubikiribouchouUnleashed,
  synergy: ['Akatsuki'],
  runsHooksWhenInert: ['endPhase'], // just clears a temporary effect
  onEndPhase: (state, instanceId) =>
    patchCharacter(state, instanceId, (k) => ({ ...k, extra: { ...k.extra, evasiveActive: false } })),
});
