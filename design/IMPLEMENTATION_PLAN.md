# Implementation Plan — Naruto Card Game Prototype

Status: **in progress — Milestone 1 complete, Milestone 2 next.** Node.js
is installed (v24.19.0). This plan implements `design/SPEC.md`
(authoritative ruleset) for **Kakuzu, Hidan, Deidara, and Itachi** only —
Pain and Kisame are deferred until their HP/Pool Capacity are finalized.

**Repo:** https://github.com/rezruiz/naruto-card-game (public)
**Live deploy:** https://rezruiz.github.io/naruto-card-game/ (auto-deploys
from `main` via `.github/workflows/deploy.yml` on every push)
**Git identity for this repo (local, not global):** user.name `rezruiz`,
user.email `262661000+rezruiz@users.noreply.github.com`

**Progress:**
- [x] Milestone 0 — Vite + React + TypeScript + Vitest scaffold, verified
      (`npm run dev` / `npm test` / `npm run build` all work). Node.js is
      installed system-wide.
- [x] Milestone 1 — Turn-phase skeleton: `src/engine/types.ts`,
      `src/engine/state.ts`, `src/engine/reducer.ts`,
      `src/engine/phases/phaseMachine.ts` implement the six-phase cycle,
      End-Phase Chakra clearing (§4.7), and an action log. Minimal UI
      wired in `src/App.tsx` + `src/ui/components/` (PhaseIndicator,
      TurnControls, PlayerHealthBar, ActionLog).
- [x] Milestone 2 — Chakra sources (`src/engine/chakra.ts`): place from
      hand once/turn, tap for Chakra, untap at Untap Phase, personal
      Chakra Pooling into a placeholder character's Chakra Pool (capped
      at capacity, persists past End Phase unlike the generic pool). 17
      passing tests across `tests/engine/phases.test.ts` and
      `tests/engine/chakra.test.ts`. UI: ChakraSourceRow, CharacterCard,
      HandView.
      **Rule change:** there is no automatic base Chakra income anymore
      (SPEC.md §5.1 was revised) — the *only* source of generic Chakra is
      tapping Chakra sources. `applyBaseChakraIncome` was removed from
      the engine; a fresh board with zero sources has zero Chakra
      available all game.
- [ ] Milestones 3-11 — see Build Order (§6 below), unchanged from the
      original plan. **Resume at Milestone 3 (board/targeting/combat
      core) next.**

Confirmed decisions from the original planning pass, still standing:
- **Hand Deck filler:** synthetic, textless "Chakra Fodder" Jutsu cards
  pad out the 40-card Hand Deck where real cards don't yet fill it.
  **Akatsuki starter Hand Deck manifest (as of 2026-09-19):** 2 copies
  each of the 6 Mission cards (SPEC.md §13a) = 12; 3 copies each of the
  Substitution family — Substitution, Lightning Substitution, Water
  Substitution (§13b) = 9; 2 copies each of the other 7 Jutsu cards —
  Incoming Mission Assignment, Chakra Transfer, Field Intelligence,
  Deploy Medic Corps, Jutsu Disruption, Explosive Tag, Battlefield
  Selection (§13b) = 14; 3 copies of the 1 Terrain card, Akatsuki
  Hideout (§13c) = 3; 2 copies of the 1 Assist card, Chidori Interception
  (§13b) = 2. Total: 12 + 9 + 14 + 3 + 2 = **40 real cards — no Chakra
  Fodder needed**. Recompute this whenever a Mission/Jutsu/Terrain/
  Assist card is added/removed, or this copy-count scheme changes —
  Chakra Fodder makes up whatever the real-card count falls short of 40
  by (0 currently).
- **Hidden information:** fully open for v1 — both players' hands, Chakra
  Pools, and Character Deck draw choices are visible to both, matching
  in-person hotseat play. A pass-and-reveal hidden-hand mode is a later
  enhancement, not part of this pass.

## 1. Stack

Vite + React + TypeScript, Vitest for engine unit tests. No Redux/Zustand
— a `useReducer` + Context wrapper around a **pure functional rules
engine** (`src/engine/`, framework-agnostic, unit-testable headlessly).
React only dispatches actions and renders derived state.

## 2. Structure

```
src/
  engine/
    types.ts            // GameState, PlayerState, CharacterInstance, AbilityDef, Effect, Cost
    state.ts             // initial state, deck construction, setup flow
    reducer.ts           // top-level GameAction dispatcher
    phases/               // phaseMachine.ts + one file per phase
    chakra.ts             // generic pool + personal Chakra Pool + Style-affinity spend check
    stack.ts               // stack + priority engine (ALL activations go on the stack, see §6.3)
    targeting.ts           // board order, adjacency, legal-target registry
    combat.ts               // damage pipeline, state-based-action (SBA) defeat check, Health loss
    characterDeck.ts         // reinforcement draw triggers
    statusEffects.ts          // Disabled, stun, temp modifiers, shared turn-cycle helper
    abilities/
      engine.ts                 // generic activation pipeline: legality -> cost -> stack -> resolve
      effects.ts                 // reusable primitives (dealDamage, healHP, preventDamage, stun, ...)
      conditions.ts               // hpAtMost, rankCompare, poolFull, oncePerTargetPerGame, ...
    cards/
      index.ts                     // card registry
      characters/ kakuzu.ts hidan.ts deidara.ts itachi.ts
      jutsu/ chakraFodder.ts         // synthetic filler cards
      tokens/ claySpider.ts
    log.ts
    selectors.ts                     // legality/derived-state helpers for the UI
  ui/
    App.tsx GameProvider.tsx
    components/ Board.tsx PlayerRow.tsx CharacterCard.tsx TokenCard.tsx
                HandView.tsx CardTile.tsx ChakraSourceRow.tsx ChakraPoolBar.tsx
                PhaseIndicator.tsx TurnControls.tsx StackPanel.tsx PriorityPrompt.tsx
                TargetPicker.tsx DecisionModal.tsx ActionLog.tsx PlayerHealthBar.tsx
                SetupScreen.tsx GameOverScreen.tsx
    hooks/useGame.ts
  main.tsx
tests/engine/ chakra.test.ts stack.test.ts combat.test.ts
              characters/ kakuzu.test.ts hidan.test.ts deidara.test.ts itachi.test.ts
```

## 3. Core data models (see full shapes discussed in-session)

- `GameState`: turn, activePlayer, phase, players, stack, priorityPlayer,
  consecutivePasses, pendingDecision, abilityUsageLog, damageDealtLog,
  delayedTriggers, log, winner.
- `PlayerState`: health, handDeck/hand/characterDeck, board (ordered
  array = board order), chakraSources, genericChakraAvailable,
  chakraSourcePlacedThisTurn, retaliationAvailable,
  firstCharacterInstanceId (free upkeep).
- `BoardUnit = CharacterInstance | TokenInstance` — both share the board
  array and board-order/adjacency, but **only CharacterInstances count
  toward the 5-unit limit** (SPEC.md §10 — tokens are exempt; a
  token-specific cap like Deidara's 5-spider limit is separate and
  tracked independently).
- `CharacterInstance`: HP, `chakraPool {current, capacity}` (capacity can
  be a computed hook, e.g. Kakuzu's `(hearts-1)*2`), mutable `styles[]`,
  `status {disabled, stunnedUntilTurn, summoningSick,
  ultimateLockedUntilTurn, tapped}`, `tempModifiers[]`,
  `usedAbilitiesThisTurn`, and an `extra` bag for per-card state (hearts,
  clayCharges, curseActive). `status.tapped` is the new mechanic from
  SPEC.md §5.3 (postdates the original plan): pooling Chakra into a
  character taps it (blocks further active-ability use that turn), and
  using an active ability taps it too (blocks further pooling); Passives
  are unaffected. Untaps at that player's next Untap Phase, same as
  Chakra sources. **UI note:** the designer wants tapped characters shown
  rotated 90° sideways, borrowed directly from Magic: The Gathering's
  tapped-permanent convention — `CharacterCard` should apply a rotation
  transform when `status.tapped` is true.
- `AbilityDef`: id/name/speed/style/abilityType, isUltimate/isForbidden,
  oncePerTargetPerGame, usesPerTurn, and `cost`/`legality`/`targeting`/
  `resolve` as functions over context — dynamic, not static, so discounts
  and conditions compose naturally.

## 4. Reusable engine primitives (used by ≥2 of the 4 characters)

1. Cost-modifier pipeline (Kakuzu's Elemental Versatility, Itachi's
   Uchiha Prodigy)
2. Non-Chakra resource costs (clay charges, hearts, spend-entire-pool)
3. SBA "would be defeated" replacement hook (Kakuzu's Five Hearts,
   Hidan's Jashin's Blessing)
4. Damage pipeline with stacked reduction/prevention/floor-clamp/
   redirect (Iron Skin, Sharingan Foresight, Hidan's mirror+floor,
   Amaterasu's unpreventable flag)
5. Once-per-target-per-game tracker (Itachi's Mind Prison, Crow Clone)
6. Delayed/recurring triggers scoped to phase+player (Hidan's regen,
   Itachi's Amaterasu DoT)
7. Token subsystem with owner-cleanup-on-death (Deidara's spiders)
8. Compound multi-step decisions (Deidara's Self Detonate, C3 Ultimate)
9. Optional-kicker pattern (Detonation Art)
10. Targeting-restriction registry (Hidan's "no friendly attacks while Cursed")
11. Damage-dealt history ledger (Itachi's Tsukuyomi condition)
12. Shared turn-cycle-duration helper (Iron Skin, stuns, the 3-turn-cycle
    Ultimate/Forbidden lockout — see §6.7 open question)

## 5. UI components

SetupScreen (draw-3-choose-1, starting hand, coin-flip first player) →
Board (two PlayerRows in literal board order) → CharacterCard/TokenCard
tiles (HP/Pool bars, status badges, ability buttons with legality-derived
enabled state) → HandView/CardTile → ChakraSourceRow/ChakraPoolBar →
PhaseIndicator/TurnControls → StackPanel/PriorityPrompt → TargetPicker →
DecisionModal (generic, switches on decision kind) → ActionLog →
PlayerHealthBar/GameOverScreen.

## 6. Build order (each milestone from #3 onward playable through the UI)

0. Scaffold (Vite+React+TS+Vitest, `npm run dev`/`npm test` verified)
1. Turn-phase skeleton (6 phases cycling, log) — note: no automatic base
   Chakra income exists (removed from SPEC.md §5.1 after this plan was
   first written); Chakra only comes from tapping sources (Milestone 2)
2. Chakra system (sources, tapping, personal pooling, Style-affinity,
   End-Phase loss) against one placeholder character
3. Board/targeting/combat core (board order, adjacency, free targeting,
   damage/heal, SBA defeat, Disabled status, Field Orientation +
   Retaliation, 5-unit limit, win condition)
4. Stack & priority (all speeds go on the stack, 2-pass resolution,
   auto-pass with zero legal responses)
5. Deck/hand/setup flow (40-card Hand Deck incl. Chakra Fodder + a
   10-15-card Character Deck per SPEC.md §2, draw-3-choose-1, 6-card
   starting hand + free-then-escalating mulligan per §3, first-player
   draw-skip, empty-deck damage, reinforcement triggers — note: the
   "every 3rd turn" auto-reinforcement trigger was **removed**; only
   on-defeat and card-granted draws remain, and playing any character
   past your starting one now costs escalating Chakra per §8/§6.7
   (3/5/7/9/... Chakra, a counter that never resets even if characters
   die) — this postdates when this plan was first written, so build it
   per the current SPEC.md, not the summary here)
6. Kakuzu (Five Hearts SBA hook, dynamic pool capacity, Elemental
   Versatility, Patchwork Threads)
7. Hidan (Jashin's Blessing, End-Phase regen, Curse Technique)
8. Deidara (tokens, Clay Charges, multi-use overrides, compound
   decisions, board-order splash, Forbidden Technique v2 as a real
   Reactive-Technique stack response)
9. Itachi (hand-card cost modifier, once-per-target tracker, stun +
   turn-cycle helper, Crow Clone as a stack response, Amaterasu DoT)
10. Full mirror-match integration playtest + cross-character bugfixing
11. UI polish (decision modal coverage, tooltips, log readability,
    layout, accessibility)

## 7. Flagged assumptions/ambiguities (review if something feels off)

1. **Hand Deck filler** — confirmed: synthetic Chakra Fodder cards (see
   top of doc).
2. Placing a Chakra source (§5.2 — as of 2026-09-14, this Consumes the
   hand card into the Consumed pile and puts a separate Chakra Card
   Stack card in play instead; a physical-table convenience change, no
   mechanical
   difference) is assumed restricted to non-Character cards from hand.
3. **All ability activations use the stack**, even Sorcery-speed —
   required for Crow Clone / Deidara's Forbidden Technique v2 (both
   Reactive Technique) to have something to respond to. UI auto-passes
   when a player has zero legal responses so this doesn't add busywork.
4. Kakuzu's revive HP isn't specified by SPEC.md — defaulted to 1 HP
   (consistent with Hidan's "stays at 1 HP" wording).
5. Which Style Kakuzu loses per revive — defaulted to controller's choice.
6. Which 4 spiders are sacrificed for Deidara's Combine when >4 exist —
   defaulted to player's choice.
7. **"Turn cycle" duration** is never crisply defined in SPEC.md and is
   load-bearing (Iron Skin, Itachi's stuns, the 3-turn-cycle Ultimate/
   Forbidden lockout). Defaulted to: a cycle ends at the start of the
   affected character's controller's own next turn, applied uniformly.
8. **Hidden information** — confirmed: fully open for v1 (see top of doc).
9. First-player determination — `Math.random()` coin flip (SPEC §14
   already marks this placeholder).
10. Upkeep pay-order ties — implemented per §4.2 exactly (descending
    cost, greedy, tie only prompts when genuinely tied and unaffordable
    to pay both).
11. Board-edge adjacency (0-2 neighbors) — no special-casing needed.
12. Reinforcement draw into unlimited hand — no special handling needed.
13. Damage-modifier stacking order (no card currently needs it, but
    future-proofed) — proposed order: flat reductions (LIFO) → clamp to
    0 → floor-clamps → "cannot be prevented" bypasses everything.
14. Character Deck must be 10-15 cards (SPEC.md §2, with rank caps: max 3
    S/A/B each) from only 4 implemented characters (Kakuzu, Hidan,
    Deidara, Itachi — Pain/Kisame deferred) — defaulted to a fixed
    multiset (e.g. a 12-card deck at 3 copies each), easily reconfigured
    later.
15. Kakuzu's Pool capacity shrinking below currently-pooled amount (losing
    a Heart) — defaulted to clamping current down (excess lost). Worth a
    designer look since SPEC.md doesn't say.

## Critical files to start with
- `src/engine/types.ts`
- `src/engine/stack.ts`
- `src/engine/abilities/effects.ts`
- `src/engine/combat.ts`
- `src/engine/cards/characters/kakuzu.ts` (+ hidan.ts, deidara.ts, itachi.ts)
