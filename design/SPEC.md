# Naruto Custom Card Game — Same-Screen Prototype Spec

**Scope of this document:** a local, same-screen, two-player prototype. Both
players share one keyboard/device and take turns; there is no networking and
no card art — cards are represented as clear text in boxes. This spec exists
to make the prototype buildable and playable, not to finalize the full
retail game. Numbers marked **(placeholder)** are reasonable defaults picked
to unblock the build; tune them freely after playtesting.

For this prototype, **both players use the same preset deck** (the Akatsuki
synergy deck defined in this document) — a mirror match. The eventual game
will have multiple synergy-themed decks; only Akatsuki is built out so far.

---

## 0. Rule Precedence

Everything in this spec is a **default**, not a hard constraint. Individual
card text always overrides the general rules on an **"unless otherwise
stated"** basis — if a card's printed text contradicts a rule elsewhere in
this document, the card wins for anything it explicitly covers.

This is expected to matter more as card design deepens: powerful cards,
evolutions, and conditional effects may rewrite normally-fixed numbers like
the board limit, upkeep cost, hand size, or targeting rules for as long as
they're relevant. For example, a powerful evolution card might read
*"You may only have 2 characters on your board while this is in play. Can
only be played if your board has fewer than 2 characters,"* locally
overriding the standard 5-character board limit (§6.5) for that card's
controller.

When writing new cards, prefer a plainly worded, self-contained override
("ignore the normal X; instead Y") over inventing a new rules subsystem —
consistent with the original design philosophy of every card being
mechanically tight, flavor-accurate, and easy to parse standalone.

---

## 1. Card Types

- **Character Cards** — the units you play and fight with.
- **Jutsu Cards** — standalone spell-like cards played from hand.
- **Token Cards** — small, disposable summoned units (see §10).
- **Item Cards, Mission Cards, Terrain Cards** — named as future card types
  in the core design, but **not mechanically defined in this prototype**.
  None currently exist in the Akatsuki deck; skip them when building v1.

---

## 2. Decks & Deck Composition

Each player has **two separate decks**, totaling 50 cards:

| Deck | Size | Contains | Drawn from |
|---|---|---|---|
| Hand Deck | 40 cards | Jutsu cards (and, in future, Item/Mission/Terrain) | Normal turn draws |
| Character Deck | 10 cards | Character cards | Only via specific triggers (§8) |

Character cards are **never** in the 40-card Hand Deck and are never drawn
by a normal draw step — they only enter your hand through the Character
Deck triggers described in §8.

**Character Deck rank caps:** a 10-card Character Deck may contain **at
most 3 cards of S Rank, at most 3 of A Rank, and at most 3 of B Rank**
(each cap independent — e.g. a deck could have 3 S, 3 A, 3 B, and 1 C all
at once). There's no cap on C Rank specifically. This applies even to the
current fixed preset Akatsuki deck, not just future built decks.

---

## 3. Setup

1. Each player shuffles their Hand Deck and Character Deck separately.
2. Each player draws the top **3** cards of their Character Deck, chooses
   **1** to be their starting character (played into the board immediately,
   with summoning sickness — see §9.4), and shuffles the other 2 back into
   their Character Deck.
3. Each player draws a starting hand of **5** cards from their Hand Deck.
4. Determine the first player **(placeholder: coin flip / random choice)**.
5. The first player's first turn skips their Draw Phase (§4.3) — they do
   not draw on their very first turn.

---

## 4. Turn Structure

Turns are structured MTG-style, with **Quick Technique/Reactive
Technique-speed cards and abilities using a stack with priority** (§7).
Each turn has six phases, in order:

### 4.1 Untap Phase
Untap all of your tapped Chakra sources (face-down Chakra cards you
control). Nothing else untaps.

### 4.2 Upkeep Phase
1. You gain **1 base Chakra**, untapped, in addition to your Chakra sources.
2. Your starting character (§3) gets its own Rank-scaled Upkeep Phase
   effect instead of the normal table — see §6.5.
3. Pay Chakra upkeep for every other character you control (per the
   per-rank upkeep table, §6.5).
   - **Payment is mandatory whenever you can afford it** — you cannot
     choose to withhold upkeep you're able to pay in order to save Chakra
     for something else.
   - If you cannot afford upkeep for all of them, pay in **descending
     order of upkeep cost** — your highest-upkeep characters must be paid
     first. If two or more unpaid characters are tied for the highest
     remaining cost, you choose which of them to pay.
   - Chakra left over after paying everything you can afford toward
     upkeep is not wasted — it remains available to spend normally for
     the rest of the turn (abilities, pooling, etc.).
   - Any character whose upkeep goes unpaid becomes **Disabled** instead
     of being defeated — see §6.5a.

### 4.3 Draw Phase
Draw 1 card from your Hand Deck (skipped on the first player's first turn
only). If your Hand Deck is empty and you're required to draw, you instead
take **3 player-Health damage (placeholder)** and draw nothing.

### 4.4 Main Phase 1
Sorcery-speed actions only. Play Character cards, non-Attack-type Jutsu
cards, activate non-combat effects, etc. This is also when you may:
- **Place 1 card face down as Chakra** (once per turn total, across both
  Main Phases combined — see §5.2).
- **Pool Chakra into a character's personal Chakra Pool** (sorcery speed
  only — see §5.3).

### 4.5 Combat Phase
This is when characters do things to each other. See §9 for full detail.
Briefly:
- Activate character abilities (Sorcery-speed abilities can *only* be
  activated here; Quick Technique abilities can be activated here or
  anytime either player has priority; Reactive Technique abilities can be
  activated here or anytime their response condition is met).
- You may also play **Attack-type Jutsu cards** from hand here, even
  though they're Sorcery speed — this is the one exception to "Sorcery
  speed only in Main Phases." No other Sorcery-speed card types may be
  played during Combat.
- Each character's abilities, and each Attack-type Jutsu card by name, can
  each only be used **once per turn**, unless their text says otherwise —
  this cap applies regardless of speed.

### 4.6 Main Phase 2
Identical rules to Main Phase 1. Play anything you saved, place your
face-down Chakra card if you haven't yet this turn, pool Chakra, etc.

### 4.7 End Phase
- Any generic Chakra you generated this turn that went unspent and
  unpooled is lost — it does **not** carry to next turn. (Chakra you
  **pooled** into a character's personal pool persists indefinitely — see
  §5.3.)
- Pass the turn. The next player begins at their Untap Phase.

---

## 5. Chakra System

There are two layers of Chakra: the shared **generic pool** you generate
each turn, and a **personal Chakra Pool** each character can carry between
turns.

### 5.1 Base Chakra Income
At the start of your Upkeep Phase, you gain 1 Chakra automatically (no
card needed). This base amount is always exactly 1 — it never grows on
its own turn over turn. The only way your total available Chakra per
turn increases is by placing more face-down Chakra sources (§5.2), which
persist and stack over time.

### 5.2 Chakra Sources (Face-Down Cards)
Once per turn, during either of your Main Phases, you may place 1 card
from your hand face down as a Chakra source. This is a Sorcery-speed
action (§7) — it can only be done during one of your own Main Phases,
same as any other Sorcery-speed play. A face-down Chakra source:
- Produces 1 Chakra whenever you tap it (untapped sources are available;
  tapping one to generate Chakra is how you "spend" it).
- Untaps automatically during your next Untap Phase.
- Has no text, is not a character/item/terrain/mission, and cannot be
  interacted with unless an effect explicitly references Chakra sources.

Your total available generic Chakra on a turn = 1 (base) + 1 per untapped
Chakra source you tap.

### 5.3 Personal Chakra Pooling
Each character has their own **Chakra Pool**, separate from the generic
per-turn pool, with a maximum capacity that is **set individually per
character card** (a stat you assign when designing each card — see the
example cards in §13 for placeholders marked TBD).

- **Pooling in:** At sorcery speed only (i.e., during one of your own Main
  Phases), you may tap any amount of your currently available generic
  Chakra and move it into one character's Chakra Pool, up to that
  character's capacity. Tapped Chakra used to pool is spent/gone from the
  generic pool the moment it's pooled — this is how it survives past End
  Phase. There is no per-turn cap on how much you can pool in one action,
  short of the character's remaining capacity.
- **Spending pooled Chakra:** Pooled Chakra can be spent at any time the
  relevant ability/card's speed allows (so Quick Technique or Reactive
  Technique uses can spend from a Pool even on the opponent's turn). Once
  spent, it's gone from the Pool until re-pooled.
- **Restriction:** A character's pooled Chakra may only pay for (a) that
  same character's own abilities, or (b) Hand Deck cards whose Style
  matches one of that character's listed Styles. Styleless cards (no Style
  requirement printed) can always be paid for with any character's Pool.
  Example: Kakuzu (Fire/Wind/Earth/Lightning) can spend his Pool on any
  Fire, Wind, Earth, or Lightning Jutsu card, but not an Ice Style card.

---

## 6. Characters

### 6.1 Role Types (max 2 per character)
- **Vanguard** — tanking, prevention, durability
- **Assault** — damage, aggression
- **Support** — healing, buffs, utility
- **Tactician** — battlefield control, tempo manipulation, denial

### 6.2 Styles (elemental/kekkei genkai classification, plus Ritual)
Fire, Water, Wind, Earth, Lightning, Explosion (kekkei genkai), Ice
(optional), Lava (optional), Boil (optional), Gravity (special case:
Pain), **Ritual**. A character's Styles field should list Ritual whenever
their abilities are Ritual-flavored (e.g. Hidan), just like any elemental
Style.

Ability Types (Scythe, Kenjutsu, Puppet, Curse, Summoning, Sealing,
Genjutsu, Mangekyō, etc. — an open-ended list, add new ones as needed)
are **not** Styles — they describe *how* an ability works, not its
element, and impose no restrictions by themselves.

**Taijutsu is a base capability every character has**, not a listed
Style — it's not tied to any specific character's identity, so it's
never written in a card's Styles field even though individual abilities
can still be tagged `Type: Taijutsu Ability`.

### 6.3 Rank System
C (basic) → B (chunin/mid) → A (elite jonin) → S (legendary) → SS
(transformation tier) → SSS (ultimate transformation tier). Rank drives
upkeep cost, Chakra Pool capacity design, and card-specific rank-comparison
effects (e.g. "heals more vs. lower rank targets").

### 6.4 Synergy
A tag, not a restriction — same-Synergy characters may have bonus
interactions on specific cards, but Synergy is never required to legally
play or activate anything by default. It's mostly flavor **except** for
the upkeep discount below.

### 6.5 Board Limit & Upkeep
You may have at most **5 characters in play** at once. Every character
past your first costs Chakra upkeep each turn (paid in your Upkeep Phase,
§4.2), scaled by rank. The table below is the **current default, not a
fixed rule** — it's the working setup applied to each character card for
now, and may change:

| Rank | Upkeep (Chakra/turn) |
|---|---|
| C | 0 |
| B | 1 |
| A | 2 |
| S | 3 |
| SS | 4 |
| SSS | 5 |

**Starting character bonus/discount:** the specific character chosen as
your starting character during Setup (§3) doesn't follow the table above.
Instead, its Upkeep Phase effect is scaled by its Rank:

| Starting Character's Rank | Upkeep Phase Effect |
|---|---|
| C | No upkeep cost. Instead, you gain +2 Chakra, pooled directly into this character's Chakra Pool (capped at its Pool Capacity — any excess beyond capacity is lost). |
| B | No upkeep cost. Instead, you gain +1 Chakra, pooled directly into this character's Chakra Pool (capped at its Pool Capacity — any excess is lost). |
| A | Upkeep = 0 (free). |
| S | Upkeep = 2 (reduced from the normal 3, but not free). |

This is tied specifically to whichever character you chose as your
starting character in Setup, not to whichever character currently
occupies the "first" slot on your board. If your starting character is
later defeated, this treatment does **not** transfer to a replacement —
any character played afterward simply follows the normal Rank-based
upkeep table above, with no special exemption unless a card says
otherwise.

**Synergy discount:** each additional character in play sharing a Synergy
tag with a given character reduces that character's upkeep by 1 Chakra per
matching character in play (stacking), to a floor of 0.
> Example: you control 3 Akatsuki characters. The second and third each
> get -1 for the 1 Akatsuki character sharing synergy with them at minimum;
> a character sharing synergy with *both* others gets -2.

**Falling short of upkeep is legal — it Disables the character instead of
defeating it.** See §4.2 for payment rules and §6.5a for what Disabled
means.

### 6.5a Disabled Characters
A character whose upkeep goes unpaid becomes **Disabled** instead of
being defeated. While Disabled:
- It cannot take any action — active or passive. Its abilities cannot be
  activated, and its Traits/Passives do not trigger or apply.
- It cannot **enable** any action, active or passive, by another card or
  ability. For example, playing a Jutsu card from hand normally requires
  an in-play character to enable/act it out (per the Style-affinity rule,
  §5.3) — a Disabled character cannot serve as that enabling character,
  even if it's your only character with the matching Style.
- **Exception:** a Disabled character's static attributes (HP, Rank, etc.)
  can still be freely read/checked by a condition on another character's
  ability — e.g. "a friendly unit must have X HP or less to activate
  this" can still check a Disabled character's HP, since that's the
  *other*, non-Disabled character's ability doing the checking, not the
  Disabled character acting.
- It remains a fully valid target — it can still take damage and be
  targeted or manipulated by any player's effects like normal. Disabled
  grants no protection.
- It becomes enabled again as soon as its upkeep is paid in a later
  Upkeep Phase.

### 6.6 Summoning Sickness
A character cannot use damage-dealing abilities the turn it enters play,
but it can use non-damaging abilities (buffs, heals, Quick Technique
defenses, etc.) immediately.

**Ultimates and Forbidden Techniques are always locked out for a
character's first 3 turn cycles in play**, with no exceptions. This
overrides the normal "non-damaging abilities can be used immediately"
allowance — even a non-damaging Ultimate or Forbidden Technique cannot be
used during its character's first 3 turn cycles, regardless of ability
speed.

**Exception — Retaliation:** if a player has a character defeated, the
next character that player plays is exempt from summoning sickness — it
may use its damage-dealing (non-Ultimate, non-Forbidden) abilities the
same turn it enters play. This exemption is one-time, applying only to
that next character played, not to every character played afterward.
Retaliation does not lift the Ultimate/Forbidden Technique lockout above.

Like every gameplay rule in this document, all of §6.6 (base summoning
sickness, the Ultimate/Forbidden lockout, and Retaliation) is a default
subject to Rule Precedence (§0) — specific card text can override any part
of it on an "unless otherwise stated" basis.

### 6.7 No Summon Cost
Playing a Character card from hand onto your board costs **no Chakra by
default** — the only Chakra cost tied to having a character out is the
ongoing per-turn Upkeep from §6.5 (and that only applies past your first
character). A card may override this on an "unless otherwise stated"
basis (§0) if a specific design calls for an entry cost, but that's the
exception, not the rule.

### 6.8 Required Base Stats (Card Template)
Every Character card needs these fields filled in — this is the base
template to check new cards against:

- **Name & Rank** (C/B/A/S/SS/SSS)
- **Specialization** (up to 2 Role Types)
- **Styles** (elemental/kekkei genkai list, or "None")
- **Synergy** tag(s)
- **HP**
- **Chakra Pool Capacity** (the character's personal pool max, §5.3 —
  assigned per card, no rank formula)
- **Traits** (passive text)
- **Abilities**, each listing:
  - Chakra cost
  - Speed — omit entirely if Sorcery (the default, §7); write "Quick
    Technique" or "Reactive Technique" explicitly otherwise
  - **Style** (which of the character's Styles this ability belongs to,
    or "None" for non-elemental abilities — needed for style-conditional
    trait text like Kakuzu's Elemental Versatility)
  - **Type** (the Ability Type descriptor — e.g. Ritual Ability, Taijutsu
    Ability, Water Ability, Gravity Ability, Explosion Ability — needed
    for type-conditional trait text)
  - Effect text

**Terminology note:** "ability" refers specifically to a character's own
printed text (Traits, Abilities, Ultimates, Forbidden Techniques,
Passives, Fusion Forms) being used. Playing a card from hand (a Jutsu
card, another Character card, etc.) is not "using an ability" — trait
text that triggers "whenever this character uses an ability" (e.g.
Deidara's Clay Sculptor) does not fire from hand-played cards.

Two fields are deliberately **not** part of the base template because
they're derived automatically unless a card overrides them (§0):
Upkeep cost (from Rank, §6.5) and player Health lost on defeat (from
Rank, §11).

---

## 7. Card Speed & the Stack

Three speeds:
- **Sorcery** — the default. **Implied on every ability/card unless its
  text says otherwise** — you never need to write the word "Sorcery" on a
  card. Playable only during your own Main Phase 1/2 (or Combat, for
  Attack-type Jutsu only). Used for attacks, summons, rituals,
  transformations.
- **Quick Technique** — playable any time you have priority, including on
  your opponent's turn. Used for reactions, counters, defenses, quick
  techniques. (Formerly called "Instant" earlier in this doc's history —
  same mechanics, new name.)
- **Reactive Technique** — reserved for future card designs; no example
  cards use it yet. Functions like Quick Technique (goes on the stack,
  playable outside your own turn) but with a narrower window: it can
  **only** be used in direct response to an opponent's action (a card
  they played, an ability they activated, etc.), not simply any time you
  have priority.

This prototype uses an **MTG-style stack and priority system** for
Quick Technique and Reactive Technique cards/abilities:
- When a player plays a Quick Technique (or a Reactive Technique, when
  its narrower condition is met) or activates an ability at one of those
  speeds, it goes on the stack instead of resolving immediately.
- The active player gets priority first; after taking an action (or
  passing), priority passes to the other player, who may respond in kind
  (also going on the stack above the previous item) or pass.
- When both players pass in succession, the top item of the stack
  resolves, then the active player receives priority again. Repeat until
  the stack is empty.
- Sorcery-speed cards and abilities can only be *put on the stack* when
  the active player has priority, their own Main Phase (or Combat, for
  Attack-type Jutsu) is active, and the stack is empty.

---

## 8. Character Deck & Reinforcements

Your Character Deck starts with 7 cards after setup (10 minus the 3 drawn,
plus the 2 shuffled back in — i.e., 9 remain after setup, since 1 of the 3
drawn became your starting character). You only draw further characters
when one of these triggers fires:

1. **One of your characters is defeated.**
2. **A card effect explicitly grants a character draw** (e.g. a
   "Reinforcements"-type Jutsu card).
3. **Every 3rd turn you personally take** (your own turns 3, 6, 9, ...) —
   an automatic reinforcement draw.

Whenever any of these triggers a character draw, unless the triggering
effect says otherwise: **draw 2 cards from your Character Deck, choose 1
to add to your hand, and place the other on the bottom of your Character
Deck.**

A newly drawn character must still be played from hand like any other
Character card (subject to the 5-character board limit and summoning
sickness).

---

## 9. Combat & Targeting

**Board order:** each player's characters occupy an ordered row, left to
right, in the order they entered play (a newly played character joins at
the right end of your row, unless a card says otherwise). This ordering
is what "left/right of" or "adjacent to" effects reference — e.g. an
effect centered on a target character also affects the enemy characters
immediately to that target's left and right *within their own
controller's row* (adjacency doesn't cross between the two players' rows;
a target's "neighbors" are the character before and after it on the same
side of the board).

- Damage-dealing abilities and Attack-type Jutsu use **free targeting** —
  the acting player may target any single enemy character currently in
  play, with no forced-target ("taunt") restrictions.
- There is no separate "declare attackers/blockers" step — a damaging
  ability or Attack-type Jutsu simply resolves against its chosen target
  when it resolves off the stack.
- Each character ability and each named Attack-type Jutsu card is limited
  to **once per turn**, regardless of speed, unless its text overrides
  this.
- A character with summoning sickness (§6.6) cannot be the source of a
  damage-dealing ability the turn it enters, but can still be targeted by
  the opponent, and can still use non-damaging abilities.

---

## 10. Tokens

Tokens (e.g. Deidara's Clay Spider) have:
- HP
- One ability
- No Chakra pool, no upkeep cost, no traits, no rank, no Synergy

Tokens still count toward your 5-character board limit unless a card says
otherwise.

---

## 11. Win Condition & Player Health

This is an attrition/war-of-losses model: losing your own shinobi hurts
*you*, not your opponent directly. There is no direct-damage-to-player-face
mechanic by default — Health loss comes only from your own characters
being defeated (or failing to draw, §4.3).

- **Starting player Health: 20.**
- When **your own character** is defeated (HP hits 0, or any other defeat
  effect — note that failing to pay upkeep no longer counts, since it now
  Disables a character instead of defeating it, §6.5a), **you** (its
  controller) lose player Health, scaled by that character's rank:

| Rank | Health Lost on Defeat |
|---|---|
| C | 2 |
| B | 3 |
| A | 5 |
| S | 7 |
| SS | 9 |
| SSS | 12 |

- A player at **0 Health or below loses the game.**
- If both players hit 0 Health simultaneously (e.g. a mutual board wipe
  triggering losses at the same time), **the game is a draw.**

---

## 12. Deferred for Future Versions

Not part of this prototype build — noted here so they aren't forgotten:
- Item, Mission, and Terrain cards (no rules or examples yet).
- Deckbuilding rules for constructing a deck from a card pool (this
  prototype uses one fixed preset Akatsuki deck for both players).
- Non-Akatsuki synergy decks.
- Max hand size / discard rules (none enforced in this prototype —
  placeholder: unlimited hand size).

---

## 13. Example Character Cards (Akatsuki Deck)

These are the approved cards from the core design, now with prototype-only
stats added (**HP** and **Chakra Pool Capacity**) so they're playable.
Pool Capacity is intentionally left **TBD** per card — assign it during
card balancing.

### Kakuzu (A Rank)
**HP: 6** · Pool Capacity: (Hearts − 1) × 2 — starts at 8 with all 5 Hearts
Specialization: Assault / Vanguard · Styles: Earth, Wind, Lightning, Fire · Synergy: Akatsuki

Traits:
- Five Hearts — Kakuzu can revive (current Hearts − 1) times: starting
  with 5 Hearts, that's 4 revives total, losing one Style each time he
  revives. Each time he'd be defeated with more than 1 Heart remaining,
  he instead loses 1 Heart and revives. Losing his last Heart (0
  remaining) means he is truly defeated. Kakuzu's Chakra Pool capacity
  always equals (current Hearts − 1) × 2 — 8 at his starting 5 Hearts,
  dropping by 2 per Heart lost, and rising by 2 if a Heart is ever
  regenerated (e.g. via his Ultimate).
- Elemental Versatility — First elemental jutsu each turn costs −1

Abilities:
- Earth Grudge Fear — 1 Chakra, Style: None, Type: Taijutsu Ability: Deal 1 damage to any target.
- Iron Skin — 4 Chakra, Style: Earth, Type: Earth Ability: Kakuzu takes −2 damage from physical attacks and −1 damage from elemental attacks for the next turn cycle, and strikes for 2 physical damage.
- Pressure Damage — 3 Chakra, Style: Wind, Type: Wind Ability: Deal 2 damage to up to 2 enemy characters.
- Searing Migraine — 4 Chakra, Style: Fire, Type: Fire Ability: Deal 4 damage.
- False Darkness — 3 Chakra, Quick Technique, Style: Lightning, Type: Lightning Ability: Deal 2 damage.

Ultimate — Earth Grudge Fear: Patchwork Threads (Style: None, Type: Heart
Release Ability): Trigger: whenever Kakuzu defeats any shinobi (friendly
or enemy), you may activate this. Cost: spend all Chakra currently in
Kakuzu's Chakra Pool (at least 2 must be pooled to activate). Effect:
Kakuzu regenerates 1 Heart, gains +2 Chakra into his Pool, heals +5 HP,
and gains 1 elemental Style belonging to the defeated character (your
choice if it has more than one), provided Kakuzu doesn't already have
that Style. (Net result: since the cost empties the pool and the effect
refunds 2, Kakuzu ends the activation with exactly 2 Chakra pooled,
regardless of how much was spent.)

### Hidan (B Rank)
**HP: 9** · Pool Capacity: 1
Specialization: Vanguard / Assault · Styles: Ritual · Synergy: Akatsuki

Traits:
- Jashin's Blessing — First defeat → stays at 1 HP. Hidan also
  regenerates 1 HP at the End Phase of your turn (cannot exceed his max
  HP) — 2 HP instead while his Ultimate (Curse Technique: Death
  Controlling Possessed Blood) is active.

Abilities:
- Triple Scythe Sweep — 2 Chakra, Style: None, Type: Taijutsu Ability: Deal 2 damage.

Ultimate — Curse Technique: Death Controlling Possessed Blood (6 Chakra,
Style: Ritual, Type: Ritual Ability): Condition: target an enemy Hidan has
already dealt damage to; Hidan binds his blood to that target, who
becomes Cursed. While this is active: Hidan may target himself with
Triple Scythe Sweep for 0 Chakra, dealing 1 additional damage on
self-inflicted attacks; all damage Hidan takes is also dealt to his
Cursed target; Hidan cannot be attacked by friendly characters while this
is active; Hidan cannot attack himself the turn he activates this
ability; self-damage cannot reduce Hidan's HP below 3.

### Pain (Deva Path) (S Rank)
**HP: 15 (placeholder)** · Pool Capacity: TBD
Specialization: Vanguard / Tactician · Styles: Gravity · Synergy: Akatsuki

Traits:
- Path Synergy — +1 Chakra each turn if another Path is in play
- Gravitational Cooldown — Cannot use Gravity abilities twice in one turn
- Gravitational Rhythm — Next turn's Gravity ability costs −1

- Shinra Push (3 Chakra, Quick Technique, Style: Gravity, Type: Gravity Ability): Prevent 2 damage. Triggers Cooldown + Rhythm.
- Gravity Crush (4 Chakra, Style: Gravity, Type: Gravity Ability): Deal 3 damage (4 if Shinra Push was used
  earlier this game). Triggers Cooldown + Rhythm.

Ultimate — Almighty Push (6 Chakra, Style: Gravity, Type: Gravity
Ability): Deal 4 damage to all enemies (5 if another Path is in play).
Triggers Cooldown + Rhythm.

Passive — Deva Path Pressure: Gravity damage drains 1 Chakra from lower
rank enemies.

### Deidara (A Rank)
**HP: 10 (placeholder)** · Pool Capacity: 3
Specialization: Assault · Styles: Explosion, Earth · Synergy: Akatsuki

Traits:
- Art is an Explosion — Starts with 1 Clay Charge

- Explosive Clay (1 Chakra, Style: Explosion, Type: Explosion Ability): Generate 1 Clay Charge. Usable up to 3 times each turn (overrides the normal once-per-turn ability limit, §9).
- C1, Shi-Wan: Clay Spider (1 Chakra, Style: Explosion, Type: Explosion Ability): Create a Clay Spider token (see below). Can be activated twice per turn (overrides the normal once-per-turn ability limit, §9).

**Clay Spider Token**
HP: 1
- Fizzles (is destroyed) if Deidara dies.
- Max 5 Clay Spider tokens in play at once (Deidara cannot create more past this cap).
- Self Detonate (1 Chakra, Quick Technique, Style: Explosion, Type: Explosion Ability): Choose any number of Clay Spider tokens you control and a single target (per the normal free-targeting rules, §9); all chosen spiders detonate together against that one target, dealing 1 damage each (so detonating 3 spiders in one activation deals 3 damage total to that target). Targeting applies per activation — spiders detonated in the same activation must share the same target; a separate activation may choose a different target. One activation costs 1 Chakra total regardless of how many spiders you choose to detonate with it. Usable any number of times per turn.
- Combine (Style: Explosion, Type: Explosion Ability): 4 Clay Spider tokens you control revert to clay and are destroyed, generating 2 Clay Charges in their place.
- Detonation Art (3 Chakra, Style: Explosion, Type: Explosion Ability): Deal 2 damage. Spend 1 Clay Charge → deal 4 damage instead.

Ultimate — C3, Shi-Suri (5 Chakra, Style: Explosion, Type: Explosion
Ability): Condition: Deidara's Chakra Pool must be full to activate
(Chakra from his Pool may still be spent as part of the cost, as normal
under §5.3 — it just has to be at max before you activate). Spend 5 Clay
Charges to activate. Deal 5 damage to 1 target, plus 3 damage to each
enemy character positioned immediately to that target's left and right
(board order, §9).

Forbidden Technique — Death is an Explosion (Style: Explosion, Type:
Explosion Ability). Two versions, depending on which activation
condition is met:

- **Version 1** — Requires Deidara's Chakra Pool to be at max capacity to
  activate. Cost: 5 Chakra, in addition to (on top of, not instead of)
  spending his entire max Chakra Pool, plus 4 Clay Charges. Condition:
  Deidara must be at 3 HP or less. Deal 8 damage to all enemies, 3 damage
  to all allies. Deidara dies; his Clay Spiders fizzle.
- **Version 2** (Reactive Technique) — Requires Deidara's Chakra Pool to
  be at max capacity to activate. Cost: 6 Chakra, in addition to (on top
  of, not instead of) spending his entire max Chakra Pool, plus 5 Clay
  Charges. Trigger: if Deidara's HP would be reduced to 0 or lower, you
  may activate this instead. Deal 8 damage to all enemy characters, 5
  damage to all friendly characters. Deidara dies; his Clay Spiders
  fizzle.

### Kisame Hoshigaki (S Rank)
**HP: 16 (placeholder)** · Pool Capacity: TBD
Specialization: Vanguard · Styles: Water · Synergy: Akatsuki

Traits:
- Chakra Monster — Gains 1 Chakra whenever he deals damage
- Samehada Hunger — Gains 2 Chakra instead vs. lower rank targets
- Samehada Bond — Starts with 1 Fusion Counter
- Fusion Threshold — Fuse at 5 Fusion Counters

- Water Shark Bullet (2 Chakra, Style: Water, Type: Water Ability): Deal 1 damage
- Water Dome Guard (2 Chakra, Quick Technique, Style: Water, Type: Water Ability): Prevent 2 damage (3 if Kisame has ≥3 Fusion Counters)
- Shark Pack Assault (6 Chakra, Style: Water, Type: Water Ability): Deal 4 damage (5 if Kisame has ≥4 Fusion Counters)

Passive — Samehada Absorption (Style: Water, Type: Water Ability):
Whenever Kisame deals Water Style damage, heal 1 HP and gain 1 Fusion
Counter (heal 2 HP instead if the target is lower rank).

Fusion Form — Samehada Merge (SS Rank, 0 Chakra, Style: Water, Type: Water
Ability): Condition: reach 5 Fusion Counters. Effects: +2 damage on Water
Style abilities; Water Dome Guard prevents +2 more; Shark Pack Assault
deals +2 more; Absorption heals +1 more; gains +1 Chakra each turn.

Forbidden Technique — Ocean of Devouring (7 Chakra, Style: Water, Type:
Water Ability): Condition: must be in Fusion Form. Deal 5 damage to all
enemies. Heal 5 HP. Gain 3 Fusion Counters. Cannot be prevented.

### Itachi Uchiha (S Rank)
**HP: 11** · Pool Capacity: 4 (placeholder)
Specialization: Tactician / Assault · Styles: Fire · Synergy: Akatsuki

*Note: this card was drafted by the assistant, not yet specified by the
designer — every number and effect here is open for revision.*

Traits:
- Uchiha Prodigy — Quick Technique Jutsu cards that Itachi could use
  (styleless, or matching one of his Styles, per the affinity rule in
  §5.3) cost 1 less Chakra to play from hand while Itachi is in play
  (minimum 1).

Abilities:
- Crow Shuriken Barrage (2 Chakra, Style: None, Type: Kenjutsu Ability): Deal 2 damage.
- Great Fireball Jutsu (3 Chakra, Style: Fire, Type: Fire Ability): Deal 3 damage.
- Genjutsu: Mind Prison (3 Chakra, Quick Technique, Style: None, Type: Genjutsu Ability): Stun the target for 1 turn cycle — it cannot pool Chakra, and cannot use any abilities or Jutsu cards. Can only be used once against each individual character over the course of the game. Costs 1 Chakra instead if Itachi is a higher Rank than the target.
- Crow Clone (2 Chakra, Reactive Technique, Style: None, Type: Kenjutsu Ability): In response to an attack targeting Itachi, negate all damage from that attack — he disperses into a murder of crows and reforms unharmed. Usable only once against each individual character over the course of the game.

Passive — Sharingan Foresight (Style: None, Type: Genjutsu Ability):
Whenever an enemy character targets Itachi with a Quick Technique
ability, prevent 1 damage from it.

Ultimate — Amaterasu (7 Chakra, Style: Fire, Type: Mangekyō Ability): Deal
3 damage to target enemy character, plus 2 more damage at the start of
your Upkeep Phase for the next 2 turns. This damage cannot be prevented
(abilities and Jutsu cards cannot reduce it).

Forbidden Technique — Mangekyō Sharingan: Tsukuyomi - Infinite Agony (7
Chakra, Style: None, Type: Genjutsu Ability): Condition: target must have
already been affected by Mind Prison, and must not have dealt more than 6
damage to Itachi this game. The target suffers 100 years of repeated
death within Itachi's illusion: it takes 6 damage and is stunned for the
next 2 turn cycles.

---

## 14. Open Placeholders to Revisit

These were assigned reasonable defaults to unblock the build, not
finalized by design decision — adjust after playtesting:

- First player determination method (currently: coin flip/random).
- Deck-out damage amount (currently: 3 Health per failed draw).
- The death-loss-by-rank table (§11) — accepted as proposed, but still
  open to adjustment after playtesting. Starting player Health (20) is
  finalized, not a placeholder.
- Hand size cap (currently: none/unlimited).
- Per-character HP for all 5 example cards (real balance pass still
  needed; current values are placeholders).
- Per-character Chakra Pool Capacity for all 5 example cards (confirmed
  as a designer-assigned-per-card stat, not a rank formula — still fully
  TBD, no placeholder value assigned yet).
- Character Deck composition: needs to total 10 cards; only 5 unique
  characters are designed so far.
- Hand Deck contents: no standalone Jutsu cards exist yet to fill the
  40-card Hand Deck — every ability so far lives on a Character card.

Resolved since first draft (no longer open):
- **Play/Summon Cost** — confirmed characters cost 0 Chakra to play from
  hand (§6.7); only Upkeep applies.
- **Ability Type / Style tags** — every ability on all 5 example cards now
  carries explicit Style and Type tags (§6.8).
