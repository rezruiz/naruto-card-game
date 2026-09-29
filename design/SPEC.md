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
- **Terrain Cards** — has minimal rules defined so far (see §10a); 1
  example card (§13c).
- **Mission Cards** — has minimal rules defined (see §10b) and 6 example
  cards (§13a).
- **Item Cards** — named as a future card type in the core design, but
  **not mechanically defined in this prototype**. None currently exist
  in the Akatsuki deck; skip it when building v1.

---

## 2. Decks & Deck Composition

Each player has **two separate decks**: a Hand Deck of **up to 80 cards**
and a Character Deck of 12-18 cards.

| Deck | Size | Contains | Drawn from |
|---|---|---|---|
| Hand Deck | **Maximum 80 cards** (minimum 40) | Jutsu cards (and, in future, Item/Mission/Terrain) | Normal turn draws |
| Character Deck | 12-18 cards | Character cards | Only via specific triggers (§8) |

The preset Akatsuki Hand Deck used in this prototype is still 40 cards.

Character cards are **never** in the Hand Deck and are never drawn
by a normal draw step — they only enter your hand through the Character
Deck triggers described in §8.

**Character Deck rank caps:** regardless of its size (12-18 cards), a
Character Deck may contain **at most 3 cards of S Rank, at most 4 of A
Rank, and at most 4 of B Rank** (each cap independent — e.g. a deck could
have 3 S, 4 A, 4 B, and however many C or D it wants up to the deck's
total size). There's no cap on C or D Rank specifically. This applies
even to the current fixed preset Akatsuki deck, not just future built
decks.

**Copy limits:** the Character Deck may **not** contain duplicates —
every character card in it must be unique. **Exception: D Rank cards
are generic (not unique named characters) and are exempt from this
restriction** — a Character Deck may contain multiple copies of the
same D-rank card. The Hand Deck has no copy restriction at all; it may
contain **up to 3 copies** of the same card.

---

## 3. Setup

1. Each player shuffles their Hand Deck and Character Deck separately.
2. Each player does the following two steps — they happen together, not
   one strictly before the other (neither player needs to finish one
   before starting the other):
   - **Starting character:** draw the top 3 cards of your Character
     Deck, choose 1 to be your starting character (played into the board
     immediately, with summoning sickness — see §6.6), and shuffle the
     other 2 back into your Character Deck.
   - **Starting hand & mulligan:** draw a starting hand of 6 cards from
     your Hand Deck. You may then mulligan: shuffle your hand back into
     your Hand Deck and draw again. Your **first mulligan is free** — you
     draw a full new 6-card hand, no penalty. Every mulligan after that
     follows a traditional −1 mulligan: each one draws exactly 1 fewer
     card than the previous draw (so your 2nd mulligan draws 5, your 3rd
     draws 4, and so on). You may mulligan as many times as you want,
     down to a hand of 0 — up until you confirm your starting character;
     confirming it finishes your Setup and keeps your current hand. Each
     player's mulligans are their own independent choice.
3. Once both players have finished step 2, determine the first player
   **(placeholder: coin flip / random choice)** — so neither player knows
   who goes first while deciding whether to mulligan.
4. The first player's first turn skips their Draw Phase (§4.3) — they do
   not draw on their very first turn.

---

## 4. Turn Structure

Turns are structured MTG-style, with **Quick Technique/Reactive
Technique-speed cards and abilities using a stack with priority** (§7).
Each turn has six phases, in order:

### 4.1 Untap Phase
Untap all of your tapped Chakra sources. Nothing else untaps.

### 4.2 Upkeep Phase
1. Your starting character (§3) gets its own Rank-scaled Upkeep Phase
   effect instead of the normal table — see §6.5.
2. Pay Chakra upkeep for every other character you control (per the
   per-rank upkeep table, §6.5). There is no automatic Chakra income
   (§5.1) — upkeep must be paid using Chakra sources you tap this turn.
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
only). The draw is taken by the player (a deliberate action, not
automatic). If your Hand Deck is empty and you're required to draw, you instead
take **3 player-Health damage (placeholder)** and draw nothing.

### 4.4 Main Phase 1
Normal-speed actions only. Play Character cards, non-Attack-type Jutsu
cards, activate non-combat effects, etc. This is also when you may:
- **Place 1 Chakra source** (once per turn total, across both Main
  Phases combined — see §5.2).
- **Pool Chakra into a character's personal Chakra Pool** (sorcery speed
  only — see §5.3).

### 4.5 Combat Phase
This is when characters do things to each other. See §9 for full detail.
Briefly:
- Activate character abilities (Normal-speed abilities can *only* be
  activated here; Quick Technique abilities can be activated here or
  anytime either player has priority; Reactive Technique abilities can be
  activated here or anytime their response condition is met).
- You may also play **Attack-type Jutsu cards** from hand here, even
  though they're Normal speed — this is the one exception to "Normal
  speed only in Main Phases." No other Normal-speed card types may be
  played during Combat.
- Each character's abilities, and each Attack-type Jutsu card by name, can
  each only be used **once per turn**, unless their text says otherwise —
  this cap applies regardless of speed.

### 4.6 Main Phase 2
Identical rules to Main Phase 1. Play anything you saved, place your
Chakra source if you haven't yet this turn, pool Chakra, etc.

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

### 5.1 No Base Chakra Income
There is no automatic Chakra income — you do not gain any Chakra simply
from reaching your Upkeep Phase. The only way to generate generic Chakra
is by tapping Chakra sources (§5.2); the only way your total
available Chakra per turn increases is by placing more of them, which
persist and stack over time.

### 5.2 Chakra Sources
Once per turn, during either of your Main Phases, you may place 1
Chakra source. This is a Normal-speed action (§7) — it can only be done
during one of your own Main Phases, same as any other Normal-speed
play. This is a **physical convenience change from earlier drafts, not a
mechanical one** — see the note below for why.

To place a Chakra source: **Consume** 1 card from your hand (put it face
down if you'd rather its identity stay private — this is purely a
physical courtesy, not a hidden-information rule) into your own
**Consumed pile** — each player has their own, separate from their
discard pile and from their opponent's Consumed pile; a Consumed card is
gone far more permanently than a discarded one, only retrievable through
some rare, specific effect, never through ordinary means. Then take one
card from your **Chakra Card Stack** — a separate physical supply of
generic, textless Chakra
cards that is not part of either deck, never shuffled in, and never
drawn — and put that in play instead as your actual Chakra source. A
Chakra source (regardless of which physical card represents it):
- Produces 1 Chakra whenever you tap it (untapped sources are available;
  tapping one to generate Chakra is how you "spend" it).
- Untaps automatically during your next Untap Phase.
- Has no text, is not a character/item/terrain/mission, and cannot be
  interacted with unless an effect explicitly references Chakra sources.

**Why:** placing a hand card face down as the source itself meant either
unsleeving/resleeving a sleeved card at the table every time, or playing
it face down and losing its art/aesthetic. Removing the hand card
entirely and swapping in a dedicated Chakra card avoids both, at zero
mechanical cost — the number of sources, when they're placed, and how
they function are all unchanged.

This does open a real design possibility, even if nothing uses it yet:
since cards spent this way now sit in a distinct Consumed pile rather
than vanishing into the source itself, a future card could reference or
retrieve them (e.g. "return a Consumed card to your hand"). No such
effect exists yet — noted here so the zone has a name to be referenced
by when one does.

Your total available generic Chakra on a turn = 1 per untapped Chakra
source you tap. With zero Chakra sources in play, you have zero generic
Chakra available that turn.

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
- **Pooling taps the character:** pooling Chakra into a character requires
  **tapping that character** — once tapped this way, it cannot activate
  any (active) ability for the rest of the turn. Its Passives are
  unaffected (they aren't "used," so tapping doesn't stop them from
  triggering). The reverse also applies: if a character has already used
  any active ability this turn (an Ability, Ultimate, or Forbidden
  Technique — not a Passive), you can no longer pool Chakra into it this
  turn. In effect, each turn a character can either **act** or **be
  pooled into**, never both.
  **Physical representation:** borrowed from Magic: The Gathering — a
  tapped character card is placed sideways (rotated 90°) to show its
  tapped state at a glance.
- **Spending pooled Chakra:** Pooled Chakra can be spent at any time the
  relevant ability/card's speed allows (so Quick Technique or Reactive
  Technique uses can spend from a Pool even on the opponent's turn). Once
  spent, it's gone from the Pool until re-pooled.
- **Restriction:** A character's pooled Chakra may only pay for that same
  character's own abilities, or Hand Deck cards specifically enabled/used
  by that character (a Style match, per the example below) — **never for
  another character's abilities, and never for a card being enabled by a
  different character.** There is no "any character can pay for a
  styleless card" exception anymore — a styleless card is still enabled
  by whichever specific character is playing it, and only that
  character's Pool can fund it.
  Example: Kakuzu (Fire/Wind/Earth/Lightning) can spend his Pool on any
  Fire, Wind, Earth, or Lightning Jutsu card he's the one enabling, but
  never on a card being enabled by a different character, styleless or
  not. Put another way: pooled Chakra can **only** pay for something done
  *through* the character it's pooled on. It cannot pay for costs that
  aren't tied to any specific in-play character at all — e.g. it cannot
  go toward the Chakra cost of bringing a new character into play (§8),
  since that isn't an action any character in play is performing.

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
Pain), Paper (special case: Konan), Yang (special case: Konan, for now
— open to reuse for future characters), Poison (special case: Sasori,
for now — open to reuse for future characters), **Ritual**. A
character's Styles field should list Ritual whenever their abilities are
Ritual-flavored (e.g. Hidan), just like any elemental Style.

Flavor descriptors like Scythe, Kenjutsu, Puppet, Curse, Summoning,
Sealing, Mangekyō, etc. are **not** Styles — they describe *how* an
ability works, not its element, and impose no restrictions by
themselves. These aren't a formal card field; they just live in an
ability's name/flavor text. The one formal classification every ability
does carry is its **Type** — Ninjutsu, Taijutsu, or Genjutsu (§6.8) —
plus Bukijutsu, a narrower category coined specifically for Explosive
Tag (§13b) and not yet retrofitted onto any other card.

**Taijutsu is a base capability every character has**, not a listed
Style — it's not tied to any specific character's identity, so it's
never written in a card's Styles field even though individual abilities
can still carry `Type: Taijutsu`.

### 6.3 Rank System
D (weakest, civilian/filler tier) → C (basic) → B (chunin/mid) → A
(elite jonin) → S (legendary) → SS (transformation tier) → SSS (ultimate
transformation tier). Rank drives upkeep cost, Chakra Pool capacity
design, and card-specific rank-comparison effects (e.g. "heals more vs.
lower rank targets"). D Rank follows all the same default tables as C
Rank (Upkeep, deck rank caps) except Health Lost on Defeat, which is
lower — see §6.5, §2, §11, and the special draw rule in §8.

### 6.4 Synergy
A tag, not a restriction — same-Synergy characters may have bonus
interactions on specific cards, but Synergy is never required to legally
play or activate anything by default. It's mostly flavor **except** for
the upkeep discount below.

### 6.5 Board Limit & Upkeep
You may have at most **5 characters in play** at once — this is your
**back row** (§9). Every character
past your first costs Chakra upkeep each turn (paid in your Upkeep Phase,
§4.2), scaled by rank. The table below is the **current default, not a
fixed rule** — it's the working setup applied to each character card for
now, and may change:

| Rank | Upkeep (Chakra/turn) |
|---|---|
| D | 0 |
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

**Synergy discount:** your total upkeep is reduced by 1 Chakra for each
character in play **past the first** that shares a Synergy tag (counted over
your largest group sharing one tag), **to a maximum of −2 in total** — the
discount is for your whole board, not per character. It is taken off your
most expensive upkeep first, never reducing any single character below 0,
and it applies to your starting character's upkeep too.
> Examples (all Akatsuki, none of them your starting character): two
> S-Rank characters normally cost 3 + 3 = 6 — with the discount, 5 (−1 for
> the one character past the first). Two S-Ranks and a C-Rank cost
> 3 + 3 + 0 = 6 — with the discount, 4 (−2, the maximum). Adding more
> Akatsuki characters never takes it past −2.

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

### 6.5b Retreat
At Normal speed, during your Main Phase, you may flip one of your
characters into the **Retreated** state. This costs Chakra scaled by
that character's Rank:

| Rank | Retreat Cost |
|---|---|
| C | 1 |
| B | 2 |
| A and above (A/S/SS/SSS) | 3 |

You cannot Retreat your only character in play — you must have at least
1 non-Retreated character remaining afterward. A character under a
stun-type effect cannot be Retreated until it's unimpeded. A character
that has already used an ability this turn cannot Retreat — if you want
to Retreat a character on a turn it also acts, it must Retreat *before*
using any ability that turn, not after.

Retreating doesn't move the character or change its zone — it stays in
its back-row slot, in normal left-to-right order (§9), and still counts
toward your 5-character board limit (§6.5).

While Retreated, a character behaves exactly like Disabled (§6.5a): it
can't take any action, active or passive — no attacks, no abilities, no
self-regen, and it can't serve as a Style-match enabler for a hand
card. Its HP and Rank stay the same as the moment it retreated, unless
there's an already-activated damaging or healing effect still ongoing —
that continues as normal for its set duration and timing (e.g. a
damage-over-time tick, or a delayed heal already queued up before it
retreated).

**A Retreated character cannot be targeted or damaged at all**, outside
of those already-ongoing effects from before it retreated. This is a
deliberate exception to the normal targeting-vs-affected distinction
(§9): full immunity to both targeted *and* untargeted/blanket effects,
not just untargetability, unless a specific card says otherwise.
- **Exception:** if a player has zero non-Retreated characters in play,
  all of that player's Retreated characters become legal targets again
  — this stops a player from Retreating their entire board into
  permanent immunity.

A character under a stun-type effect cannot be Retreated until it's
unimpeded (already stated above — repeated here for emphasis, not a
second separate rule).

**Returning** from Retreated costs 0 Chakra — just flip the status off.
A character that returns is treated exactly like it just entered play
for summoning sickness purposes (§6.6): it cannot use damage-dealing
abilities that turn, but non-damaging abilities and Passives work
immediately.

### 6.6 Summoning Sickness
A character cannot use damage-dealing abilities the turn it enters play,
but it can use non-damaging abilities (buffs, heals, Quick Technique
defenses, etc.) immediately. This applies equally to Ultimates and
Forbidden Techniques — there's no separate multi-turn lockout on them
beyond this normal entry-turn restriction.

**Exception — Retaliation:** if a player has a character defeated, the
next character that player plays is exempt from summoning sickness
entirely — it may use any of its damage-dealing abilities, including
Ultimates and Forbidden Techniques, the same turn it enters play. This
exemption is one-time, applying only to that next character played, not
to every character played afterward.

**Keyword — Ambush:** the general-purpose version of the same exemption
(Magic: The Gathering players will recognize this as a Haste
equivalent). A character with Ambush ignores summoning sickness — it may
use its damage-dealing abilities the turn it enters play. Unlike
Retaliation, Ambush isn't tied to a defeat trigger — it's granted
directly, either as a keyword printed on a character's own card (an
innate trait) or temporarily by an outside card effect (e.g. a Mission
card's reward). Whatever grants it should state its scope and duration
if those aren't obvious from context (e.g. "your next reinforcement
gains Ambush" grants it to one specific future character, once).

Like every gameplay rule in this document, all of §6.6 (summoning
sickness, Retaliation, and Ambush) is a default subject to Rule
Precedence (§0) — specific card text can override any part of it on an
"unless otherwise stated" basis.

### 6.7 Summon Cost
Your **starting character** (chosen at Setup, §3) costs no Chakra to
enter play. Every character you play from hand **after** that costs
Chakra to bring into play, on top of its ongoing per-turn Upkeep (§6.5)
once it's out — see §8 for the escalating cost.

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
  - Speed — omit entirely if Normal (the default, §7); write "Quick
    Technique" or "Reactive Technique" explicitly otherwise
  - **Style** (which of the character's Styles this ability belongs to,
    or "None" for non-elemental abilities — needed for style-conditional
    trait text like Kakuzu's Elemental Versatility)
  - **Type** (Ninjutsu, Taijutsu, or Genjutsu — the broad classic
    three-way technique category, separate from Style. Needed for
    type-conditional text like Preta Path's "only Ninjutsu abilities"
    restriction. Ninjutsu covers chakra-based techniques generally —
    elemental jutsu, summoning, sealing, ritual/curse techniques, clone/
    substitution techniques, etc. — anything that isn't a physical/
    weapon technique (Taijutsu) or an illusion (Genjutsu). Some passive,
    perception-based abilities don't cleanly fit any of the three — leave
    Type unset for those rather than forcing a bad fit. This field
    replaces an earlier, separate "Type" descriptor field — e.g. "Ritual
    Ability," "Water Ability," "Gravity Ability" — which was dropped as
    redundant with Style; that descriptor's role is now folded into this
    Ninjutsu/Taijutsu/Genjutsu field.
    - **Exception — Bukijutsu:** a narrower, ranged/thrown-weapon-attack
      Type (kunai, shuriken, senbon, exploding tags), coined specifically
      for Explosive Tag (§13b). Not a general 4th category retrofitted
      onto other cards — every other ability in the game keeps its
      existing Ninjutsu/Taijutsu/Genjutsu classification unchanged.
    - **Physical (umbrella category):** Taijutsu and Bukijutsu are both
      "Physical" Types. Any rule or card text that blocks, redirects, or
      otherwise cares about "a Taijutsu attack" generically (e.g. §9's
      physical-blocking-vs-Genjutsu rule, Asura Path's Mechanized Guard,
      Preta Path's Absorb Impact, Hiruko's Puppet Shell Guard) is phrased
      as caring about **a Physical attack** instead — this covers both
      Taijutsu and Bukijutsu (and any future Physical sub-type) without
      needing to list them out individually every time. "Physical" isn't
      itself a Type a card is ever printed with; it's a grouping term
      used only in other cards'/rules' text when referring to Taijutsu
      and Bukijutsu together.)
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

### 6.8a Ability Text Notation
Two punctuation conventions used across ability text:
- **Colon (`:`)** — separates the cost (everything before it) from the
  effect text (everything after it). The cost must be paid **before the
  ability can even be activated** — payment is a precondition for
  activating the ability at all, not the first step of its resolution.
- **Comma (`,`)** — separates distinct effects within the same ability.
  Comma-separated effects are all part of the same ability and **resolve
  simultaneously**, together — they are just independent of each other,
  meaning none of them is conditional on another one unless the text
  says so.

Example: *"Samehada Strike — 0 Chakra: Deal 1 Damage, Absorb 1"* — the 0
Chakra cost must be paid to activate at all. The two comma-separated
effects then both resolve together: dealing damage, and (per the Absorb
keyword, §6.8b) gaining 1 Chakra while draining 1 from the enemy's pool
if it has any stored. Gaining the Chakra is not gated by whether the
enemy actually had any Chakra stored to lose — that condition belongs
only to the drain half of Absorb's own definition.

These are highly nuanced rule subtleties, called out for future-proofing
and robustness rather than because they'll matter often.

*(When the rules doc next gets a full regeneration, this kind of
notation/nuance rule should move into its own dedicated section, separate
from the direct gameplay rules.)*

### 6.8b Keyword Glossary
Reusable shorthand terms that stand in for a fixed, standard chunk of
effect text, so cards don't have to spell the whole thing out every
time. Currently just one:

- **Absorb X** — gain X Chakra (to the acting unit's own Chakra Pool,
  or a shared Pool it draws from, if applicable), and separately reduce
  X Chakra from whatever unit the ability is absorbing from, but only if
  that unit actually has Chakra pooled — if it has none stored, that
  half simply does nothing further; the acting unit still gains its X
  regardless (per the comma-independence rule, §6.8a, these are two
  independent clauses bundled under one keyword, not one conditional on
  the other). "Absorb 1" is shorthand for "gain 1 Chakra, reduce 1
  Chakra from the unit absorbed from (if any is pooled)."

New keywords get added here as they come up across multiple cards.

### 6.9 Effect Duration
Unless a card's text says otherwise, any lingering effect an ability
creates (a damage-prevention shield, a buff, a debuff, anything that
isn't resolved instantly and fully the moment the ability resolves) lasts
only until the end of the turn it was activated on — gone by the next
Untap Phase. For example, an ability that reads "Prevent the next 2
damage dealt" is only active for the remainder of the turn it was cast;
it does not carry over to a later turn. Cards that need a longer-lasting
effect say so explicitly (e.g. "for the next turn cycle," as on Kakuzu's
Iron Skin) — that's an override of this default, not the norm.

---

## 7. Card Speed & the Stack

Three speeds:
- **Normal** — the default. **Implied on every ability/card unless its
  text says otherwise** — you never need to write the word "Normal" on a
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
- Normal-speed cards and abilities can only be *put on the stack* when
  the active player has priority, their own Main Phase (or Combat, for
  Attack-type Jutsu) is active, and the stack is empty.

---

## 8. Character Deck & Reinforcements

Your Character Deck starts with (deck size − 1) cards after setup: you
draw the top 3, keep 1 as your starting character, and shuffle the other
2 back in — so a 10-card Character Deck has 9 remaining after setup, a
15-card one has 14, and so on.

**A Character Deck draw** means: **look at the top 2 cards of your
Character Deck, choose 1 to add to your hand, and place the other on the
bottom of your Character Deck** (plus the D Rank special rule below).
Drawing from the Character Deck is a **state-based action**: it never
goes on the stack, can't be responded to, and resolves immediately. Its
timing is set by whatever causes it:

1. **Manual draw.** On your own turn, during a Main Phase (Normal-speed
   timing), you may pay the **Character Deck Tax** (below) to make a
   Character Deck draw. This is the only thing that raises the tax.
2. **Reinforcement (one of your characters is defeated).** Resolves
   immediately when the defeat does, on either player's turn:
   - A **D-rank** character being defeated triggers **no** Reinforcement.
   - A **C-rank or higher** character is defeated while you still have
     another C-rank-or-higher character in play: you **may** pay your
     **current** Character Deck Tax to make a Character Deck draw. This
     does **not** raise the tax.
   - Your **last C-rank-or-higher character in play** is defeated
     (D-rank characters in play are ignored for this — e.g. with a B and a
     D in play, the B being defeated counts as your last): if you have a
     C-rank-or-higher Character card in hand, you **must** play at least
     one of them immediately (free, ignoring normal timing). If you don't
     (D-rank cards in hand are ignored), you **may** make a Character Deck
     draw **for free**. Neither raises the tax.
3. **A card effect explicitly grants a character draw** (e.g. a
   "Reinforcements"-type Jutsu card) — as that card says.

**D Rank special rule:** whenever you draw multiple Character cards as
part of a Character Deck draw (the Setup starting-character draw, §3,
or a Reinforcement trigger above) and at least one of the cards you see
is D Rank, you may add that D-rank card to your hand **in addition to**
your normal choice of one other card from that same draw — instead of
choosing only 1 card and returning/shuffling back the rest, you keep
the D-rank card plus your usual pick, and only whatever's left over
still goes back. This reflects D-rank characters being common,
disposable fodder you're meant to pick up easily, rather than cards
worth shuffling back just because you drew something else you wanted
more.

- **All-D-rank reveal:** if every card revealed by the draw is D Rank
  (no unique/non-D-rank character among them), keep revealing one more
  card at a time from the top of your Character Deck until a
  non-D-rank card is revealed. This guarantees the draw always
  produces at least one unique character to make your normal choice
  from, rather than resolving on nothing but generic filler.
- **Cap:** you may add **at most 2** D-rank cards to your hand from a
  single Character Deck draw, on top of your one normal choice — even
  if the all-D-rank reveal above turns up more than 2 along the way.
  Any D-rank or non-chosen cards beyond what you take are placed on the
  bottom of your Character Deck as normal, in the order you choose.

**Playing a Character card from hand is always free** (subject to the
5-character board limit and summoning sickness). The cost of a new
character is paid when it is *drawn*, not when it is played.

**Character Deck Tax — the cost of a Character Deck draw:** paid from
your generic Chakra pool (tapped Chakra sources) — no character's
personal Chakra Pool can fund it (§5.3). It scales with how many **manual**
Character Deck draws you have paid for **this game** (this count only
ever goes up), capped at 8:

| Paid manual draws so far | Tax |
|---|---|
| 0 | 3 Chakra |
| 1 | 5 Chakra |
| 2 | 7 Chakra |
| 3 or more | 8 Chakra (cap) |

Only a paid **manual** draw advances the count. A paid Reinforcement
draw costs your *current* tax without advancing it, and the free
last-C-rank-or-higher Reinforcement draw costs nothing and doesn't
advance it either. Keeping extra D-rank cards from a draw (D Rank special
rule) costs nothing extra and doesn't advance it. (A character entering
play this way still pays its full ongoing Upkeep per §6.5's normal
Rank-based table — only your original starting character gets the
starting-character treatment.)

---

## 9. Combat & Targeting

**Board order — two rows per player:** each player's board has a **back
row** (Characters, up to 5, §6.5) and a **front row** (Tokens, up to 10 —
a flat cap that exists on top of any card-specific token cap, e.g. Clay
Spider's own 5-token limit, §13). Within each row, occupants are ordered
left to right in the order they entered play (a newly played/created
character or token joins at the right end of its own row, unless a card
says otherwise) — this part is unchanged from the old single-row rule.

**Columns:** the front row is divided into 5 column-pairs (2 token slots
each), and each pair aligns with one back-row column — so front-row
slots 1-2 pair with back-row column 1, slots 3-4 with column 2, and so
on. This is what lets front/back adjacency work despite the rows holding
different numbers of slots.

**Adjacency comes in two shapes**, both referenced by "left/right of,"
"adjacent to," or a **cross pattern**:
- **Same-row (left/right)** — the occupant immediately before/after a
  given card within its own row. Unchanged from before.
- **Cross-row (front/back)** — whatever occupant(s) sit in the other row
  at that card's aligned column. A back-row Character's front neighbor is
  the Token(s) in its paired front-row slots (up to 2); a front-row
  Token's back neighbor is the 1 Character in its paired back-row column,
  if any.

A **cross pattern** effect (e.g. Shinra Tensei, C3 Shi-Suri, §13) hits
the epicenter/main target plus whatever's immediately left, right, in
front of, and behind it — up to 4 additional occupants. Any arm with
nothing there (edge of a row, empty paired slot, no card in the aligned
column) simply doesn't hit anything, the same way being at the end of a
row already means no left or right neighbor.

None of this crosses between the two players' sides — adjacency and
cross-pattern effects only ever look within the *target's own
controller's* rows, never reaching into the opponent's board.

- Damage-dealing abilities and Attack-type Jutsu use **free targeting** —
  the acting player may target any single enemy character currently in
  play, with no forced-target ("taunt") restrictions. **Unless a card's
  text explicitly says otherwise (§0), an attack can only target enemy
  units** — it cannot target your own or an ally's characters.
  **Keyword: "any target"** — when a card's text says "any target"
  instead of just "target" or "target enemy character," that's the
  standard phrasing for overriding the enemy-only default: it means the
  ability may target friendly units (including itself) as well as
  enemies. Kakuzu's Earth Grudge Fear ("Deal 1 damage to any target") is
  the current example of this.
- There is no separate "declare attackers/blockers" step — a damaging
  ability or Attack-type Jutsu simply resolves against its chosen target
  when it resolves off the stack.
- Each character ability and each named Attack-type Jutsu card is limited
  to **once per turn**, regardless of speed, unless its text overrides
  this.
- A character with summoning sickness (§6.6) cannot be the source of a
  damage-dealing ability the turn it enters, but can still be targeted by
  the opponent, and can still use non-damaging abilities.

**Targeting vs. being affected:** "targeting" only refers to a character
actually being *selected* as the object of an ability (the "1 target" you
choose when an ability says "deal X damage to target enemy character").
An ability can also affect characters it never targets — a blanket
effect like "deal X damage to all enemies" or "all allies" targets no
one at all, and a splash effect like "deal X damage to the target, plus Y
damage to each character adjacent to it" only targets the primary
character; the neighbors are affected as a consequence of the ability's
text, not targeted. This distinction matters for any "cannot be
targeted" restriction (e.g. Hidan's Curse Technique, §13): it blocks
effects that would target that character, but does **not** protect them
from an untargeted blanket or splash effect that happens to reach them.
**Exception:** the Retreated status (§6.5b) explicitly grants full
immunity to both targeted *and* untargeted/blanket effects — it's called
out there specifically because it breaks from this general rule.
> Example: while Hidan's Curse Technique makes him un-targetable by
> friendly attacks, a friendly Deidara using his Forbidden Technique
> ("deal X damage to all allies") would still damage Hidan — that effect
> never targets anyone, so the restriction doesn't apply to it.

**Default targeting inference:** an ability with a single-target effect
is presumed to be *targeting* that character by default, even if its
text doesn't literally use the word "target" — the only thing that
makes an effect untargeted is blanket/collective wording like "all,"
"each," or similar. So "deal 2 damage to an enemy character" targets
that character just as much as "deal 2 damage to target enemy
character" does; only phrasing like "deal 2 damage to all enemies"
doesn't.

**Negating a target vs. negating damage:** these are two different
interactions, and card text needs to be read carefully to tell which one
an effect is doing:
- **Negating damage** — the ability still successfully targets, and
  still resolves as normal; only the damage number itself gets
  prevented/reduced afterward (as covered by ordinary "prevent X damage"
  effects).
- **Negating the target** — the response strips that character's status
  as a valid target *before the target locks in*, causing whichever part
  of the ability's effect depended on that target to fizzle, as if that
  part of the ability was never triggered.

Negating a target is **not** a replacement effect that stops the
ability from being activated in the first place. The normal activation
sequence always still happens in full: the cost is paid, the ability is
triggered, and a target is identified at the moment of activation — all
of that is locked in as having occurred regardless. What a
target-negation effect intervenes on is the later moment where an
identified target would otherwise be *confirmed* as still legal going
into resolution; stepping in before that confirmation is what causes the
target-dependent part of the effect to fizzle, rather than preventing
the ability's use at all.

**Only the parts of the effect that needed that target fizzle** — per
the comma rule (§6.8a), an ability's comma-separated effects are
independent of each other, so any clause that doesn't require the
negated target still resolves normally. Example: an ability reading
"Deal 2 damage, Prevent the next 2 damage dealt to you" — if the target
of the "Deal 2 damage" clause gets its targeting negated, only that
clause fizzles; the self-directed "Prevent the next 2 damage dealt to
you" clause doesn't depend on that target at all, so it still resolves.

**Physical blocking vs. Genjutsu:** an ability that blocks, redirects,
or reduces incoming damage by physically intercepting an attack (e.g.
Hiruko's Puppet Shell Guard, Third Kazekage's Iron Sand Wall, Asura
Path's Mechanized Guard) only works against Ninjutsu-Type and
Physical-Type (Taijutsu or Bukijutsu, §6.8) attacks — it has no effect
against a Genjutsu-Type attack, since Genjutsu is an illusion/mental
technique with nothing physical to intercept. This applies
retroactively to every card of this kind, even where the printed text
doesn't spell out the Type restriction itself.

---

## 10. Tokens

Tokens (e.g. Deidara's Clay Spider) have:
- HP
- One ability
- No Chakra pool, no upkeep cost, no traits, no rank, no Synergy

Tokens occupy their own **front row**, separate from your 5-character
**back row** (§6.5, §9) — they never compete with characters for board
slots. The front row holds up to **10 Tokens** at once, a flat cap on
top of any card-specific token cap (e.g. Deidara's Clay Spider tokens
have their own separate 5-token cap, §13).

### 10a. Terrain Cards
Terrain rules are still early — only these two are defined so far, the
rest is deferred (§12):
- **One at a time:** you may only have 1 Terrain card active on your
  side at once. Playing another Terrain card **replaces** your existing
  one (the old one is discarded).
- **One-way by default:** unless a Terrain card's text says otherwise
  (§0), its effect only applies to **one** side — it helps its
  controller or hinders the opponent, not both. A Terrain card that's
  meant to affect both players symmetrically has to say so explicitly.

### 10b. Mission Cards
Mission rules are still early — only what's needed for the current
example cards (§13a) is defined here, the rest is deferred (§12):
- Mission cards live in the Hand Deck (§2) and are drawn
  normally, same as Jutsu cards.
- **Copy limits:** a Mission follows the Hand Deck's normal copy limit
  (up to 3 copies, §2) unless it's marked **Unique**, in which case it's
  capped at 1 copy per deck instead.
- Play a Mission card from hand by paying its Chakra cost (a
  Normal-speed action, same as any other card play). It stays in play
  as a standing objective.
- Each Mission states a **Condition** and a **Reward**. Once its
  Condition becomes true, resolve its Reward, then discard the Mission —
  its job is done.
- **Missions in play limit:** you may have at most 1 Mission in play per
  character you currently control. Playing a new Mission while already
  at that limit **replaces** an existing one of your choice — the
  replaced Mission is discarded incomplete (no Reward). This limit only
  gates *playing* a new Mission; if your character count later drops,
  Missions you already have in play are **not** retroactively discarded
  just for exceeding the new, lower limit.
- Missions don't count toward the 5-character board limit (§6.5) — that
  limit is Character cards only, same as Tokens (§10).
- Mission cards can be Consumed as Chakra (§5.2) like any other Hand
  Deck card, unless a specific Mission's text says otherwise.
- By default, a Mission is played face up, with its Condition and
  Reward public information. A specific card can override this (§0) —
  e.g. the Bingo Book series (§13a) can be played face down and revealed
  only once its Condition is met.

### 10c. Jutsu Cards
Jutsu cards live in the Hand Deck (§2) and are drawn normally.
Unlike a character's own printed Abilities, a Jutsu card isn't tied to
one specific character — it's a standalone effect any eligible
character can enable. Each Jutsu card states:
- **Style** (or "None") — per §5.3's Style-affinity rule, playing a
  Jutsu card requires an in-play character able to enable it: either
  the card is Style: None (any character can enable it — Taijutsu-type
  effects fall under this, §6.2), or you control a character whose own
  Styles include the card's Style.
- **Speed** — Sorcery (the default, omitted on the card, §7), Quick
  Technique, or Reactive Technique, exactly like character abilities.
- **Cost** — paid the same way a character ability's cost is (§5.3):
  from the generic pool, or from the enabling character's own Chakra
  Pool. A Jutsu card can specify a **cheaper cost specifically when paid
  from the enabling character's Pool** (e.g. "2 Chakra, 1 if paid from
  the enabling character's Pool") — this is a new, card-specific
  discount pattern, distinct from every character ability so far (which
  never varies in cost by funding source, only in *which* pool it's
  legal to draw from). Where a Jutsu card doesn't state such a
  discount, its cost is the same regardless of funding source, as usual.
- **Type** (Ninjutsu, Taijutsu, or Genjutsu, §6.8) and **effect text**,
  using the same colon/comma notation as abilities (§6.8a).

Playing/activating a Jutsu card that is a technique — one with an ability
**Type** (Ninjutsu, Taijutsu, Bukijutsu, or Genjutsu) — still requires an
eligible enabling character to be in play, un-Disabled, and un-Retreated
(§6.5a, §6.5b) at the moment it's played — same restrictions as using
that character's own abilities. A **Type: None** Jutsu card (a tactical
card rather than a technique, e.g. Field Intelligence, Incoming Mission
Assignment, Battlefield Selection) isn't played through any character and
needs no enabling character; its cost is paid from generic Chakra.
Terrain (§10a), Mission (§10b) and Assist cards (below) never need one
either. Unless a specific card says otherwise, a named Jutsu
card is limited to once per turn, same as a character ability (§9).

**Ongoing-effect Jutsu cards stay in play, not the discard pile, until
their effect ends.** A Jutsu card whose effect isn't fully resolved the
instant it's activated (it has a stated duration, or triggers multiple
times over future Phases/turns — e.g. Deploy Medic Corps, §13b) remains
face up in a visible "in play" area, purely for tracking purposes, the
same way a Mission card stays in play until its Condition triggers
(§10b). It moves to the discard pile only once its effect is either
fully completed (all of its triggers have happened) or explicitly
cancelled by its own text or another effect. This also has a
mechanical reason, not just bookkeeping: a card sitting in the discard
pile is normally free to be affected by anything that interacts with
that pile, and a still-active delayed effect shouldn't be reachable or
disruptable that way while it's still pending.

**Assist cards** are a sub-category of Jutsu cards, not a separate card
type or zone — mechanically, an Assist card is a Jutsu card in every
respect (same Hand Deck, same Speed/Cost/Type rules above), just
written like a stripped-down "character card lite": built around a
specific (often guest/cameo) character briefly lending a single
signature technique, rather than presented as an impersonal spell.
Its header line follows a fixed format instead of a plain card name:
**[Assist Type]: [Character assisting], [Synergy]** — e.g. "Impact
Assist: Sasuke, Akatsuki." The two named Assist Types so far are
**Impact Assist** (offense-flavored payoff) and **Guard Assist**
(protective/mitigating payoff) — see §13b for more on how a card's
payoff, not its trigger shape, decides which one it is. The named
character doesn't need to be a canon member of the deck's own faction
(e.g. Sasuke Uchiha guest-starring in an Akatsuki deck) — the Synergy
named alongside them is set independently, based on what the card
should mechanically plug into, the same way Juzo Biwa's Akatsuki
Synergy was assigned despite his own uncertain canon affiliation
(§13).

**Assist cards ignore the normal Style-enabling requirement**
(§5.3/§10c) — unlike every other Jutsu card, playing one doesn't need
an in-play character whose own Styles match. The flavor character is
understood to briefly step into play themselves to perform the one
technique, then exit immediately once it resolves — so a listed Style
on an Assist card is flavor/informational only (still relevant for any
Style-conditional text elsewhere that checks it), not an enabling
requirement. An Assist card can be played even with zero characters in
play, or none matching its Style.

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
| D | 1 |
| C | 3 |
| B | 4 |
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
- Item cards (no rules or examples yet). Terrain cards have minimal
  rules now (§10a) but no example cards yet. Mission cards have minimal
  rules (§10b) and 5 example cards (§13a).
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

Traits: *(full nuance: design/CHARACTER_LOG.md)*
- Five Hearts — Whenever Kakuzu would be defeated with more than 1 Heart
  remaining, he instead loses 1 Heart, a Style, and revives; losing his
  last Heart defeats him for good. Chakra Pool Capacity = (current
  Hearts − 1) × 2.
- Elemental Versatility — First elemental jutsu each turn costs −1

Abilities:
- Earth Grudge Fear — 1 Chakra, Style: None, Type: Taijutsu: Deal 1 damage to any target.
- Iron Skin — 5 Chakra, Style: Earth, Type: Ninjutsu: Kakuzu takes −2 damage from physical attacks and −1 from elemental attacks for the next turn cycle, and strikes for 2 physical damage.
- Pressure Damage — 3 Chakra, Style: Wind, Type: Ninjutsu: Deal 2 damage to up to 2 enemy characters.
- Searing Migraine — 4 Chakra, Style: Fire, Type: Ninjutsu: Deal 4 damage.
- False Darkness — 3 Chakra, Quick Technique, Style: Lightning, Type: Ninjutsu: Deal 2 damage.

Ultimate — Earth Grudge Fear: Patchwork Threads (Style: None, Type:
Ninjutsu): Trigger: whenever Kakuzu defeats any shinobi. Cost: his
entire Chakra Pool (≥2 pooled required). Effect: regenerate 1 Heart,
heal +5 HP, end with exactly 2 Chakra pooled, and gain 1 elemental Style
from the defeated character that he doesn't already have (your choice if
multiple).

### Hidan (B Rank)
**HP: 9** · Pool Capacity: 1
Specialization: Vanguard / Assault · Styles: Ritual · Synergy: Akatsuki, Kakuzu

Traits: *(full nuance: design/CHARACTER_LOG.md)*
- Jashin's Blessing — First defeat: survives at 1 HP instead.
  Regenerates 1 HP each End Phase (2 while his Ultimate is active),
  capped at max HP. If Kakuzu is in play when Hidan would instead be
  truly defeated, Kakuzu may spend his full Chakra Pool (must be at
  capacity) and stun himself through his controller's next turn to
  revive Hidan at 3 HP instead.

Abilities:
- Triple Scythe Sweep — 2 Chakra, Style: None, Type: Taijutsu: Deal 2 damage.

Ultimate — Curse Technique: Death Controlling Possessed Blood (6 Chakra,
Style: Ritual, Type: Ninjutsu): Condition: target an enemy Hidan has
already damaged; binds his blood to them (Cursed). While active: Triple
Scythe Sweep may target himself for 0 Chakra, dealing the Cursed enemy 1
extra damage; all damage Hidan takes is mirrored onto the Cursed enemy;
Hidan can't be targeted by friendly attacks; can't self-target the turn
he activates this; self-damage can't drop him below 3 HP. One Cursed
enemy at a time; ends when they're defeated.

### Pain of the Six Paths (S Rank)
Specialization: Tactician / Support · Styles: None · Synergy: Akatsuki

*Note: this card was drafted by the assistant, not yet specified by the
designer — every number and effect here is open for revision. Replaces
the scrapped Pain (Deva Path) card. No Ultimate or Forbidden Technique
proposed yet — flag if you want one added.*

Traits: *(full nuance: design/CHARACTER_LOG.md)*
- Six Paths — When Pain enters play, spawn 6 Path tokens: Deva, Asura,
  Human, Animal, Preta, Naraka. Pain has no HP or Chakra Pool of his own
  — he's represented entirely by these six tokens. Each Path token is
  individually targetable and has its own HP. Pain is defeated when all
  6 Path tokens are defeated.
- Rinnegan Reservoir — each Path token still pools Chakra individually
  into its own Pool (Capacity per the table below, exception to §10) —
  Chakra is not merged into one combined pool. However, any Path's
  ability may draw from **any other Path's individual Pool** as well as
  its own or the generic pool (§5.3); the pools stay separately tracked
  and capped, just cross-accessible.

| Path | Role | HP | Chakra Pool Capacity |
|---|---|---|---|
| Deva | Commander, strongest combatant | 8 | 3 |
| Asura | Heavy weapons | 6 | 2 |
| Animal | Summons / recon / control | 5 | 2 |
| Preta | Defensive counter to ninjutsu | 5 | 2 |
| Human | Intelligence / assassination | 4 | 2 |
| Naraka | Medic | 4 | 2 |

Abilities (each ability belongs to the named Path token, not to Pain):
- **Deva Path can only use up to 2 of its own abilities per turn** (across all of the following).
- Deva Path: Shinra Tensei — 4 Chakra, Style: Gravity, Type: Ninjutsu: Deal 3 damage to 1 target, plus 3 damage in a cross pattern from it (§9) — whatever's immediately left, right, in front of, and behind the target, up to 4 additional hits.
- Deva Path: Shinra Tensei, V2 — 4 Chakra, Reactive Technique, Style: Gravity, Type: Ninjutsu: In response to a targeted Ninjutsu or Taijutsu ability aimed at Deva Path specifically, negate its targeting — the ability fails to target, so its damage (and anything else depending on that target) fizzles (§9).
- Deva Path: Banshō Ten'in — 4 Chakra, Style: Gravity, Type: Ninjutsu: Pull an enemy character closer, Deal 1 damage. Rest of turn: damage to it +1, can't be protected by its controller's damage-reduction abilities.
- Asura Path: Mechanized Assault — 3 Chakra, Style: None, Type: Taijutsu: Deal 4 damage.
- Asura Path: Mechanized Guard — Reactive Technique, 2 Chakra, Style: None, Type: Taijutsu: In response to a targeted Physical (Taijutsu or Bukijutsu, §6.8) ability aimed at any Path, redirect it onto Asura instead, reduced by 1 (min 0). Targeted-only (§9).
- Human Path: Soul Rip — 2 Chakra, Style: None, Type: Ninjutsu: Deal 2 damage; if this defeats the target, draw 1 card.
- Animal Path: Summon — 1 Chakra, Style: None, Type: Ninjutsu: Create 1 of the 3 named Path Beast tokens below, your choice of which — but not one that's already in play or on cooldown (see below).
- Preta Path: Chakra Absorption — Reactive Technique, 2 Chakra, Style: None, Type: Ninjutsu: Redirect a targeted Ninjutsu attack onto Preta, reduce to 0, gain 1 Chakra to Preta Path's Pool. Targeted-only (§9).
- Preta Path: Absorb Impact — Reactive Technique, 1 Chakra, Style: None, Type: Taijutsu: Redirect a targeted Physical (Taijutsu or Bukijutsu, §6.8) attack onto Preta, taking it −1 (min 0). Targeted-only (§9).
- Naraka Path: King of Hell's Judgment — 4 Chakra, Style: None, Type: Ninjutsu: Choose a Path token (including Naraka). At your next Upkeep, heal it 3 HP. Cancelled if Naraka Path dies first.
- Naraka Path: Outer Path — Samsara of Heavenly Life Technique — 7 Chakra, Style: None, Type: Ninjutsu: Choose 1 defeated Path token; revives at full HP (with summoning sickness, §6.6) at your next Upkeep. Cancelled if Naraka Path dies first.

Deva Path's Ultimate — Almighty Push (6 Chakra + Deva Path's entire
Chakra Pool spent in full, Style: Gravity, Type: Ninjutsu):
*(full nuance: design/CHARACTER_LOG.md)*
Condition: Deva Path's own Pool must be full (may spend it as part of
the cost); must be the first Path ability used this turn (Deva Path
included).
Effect: locks out all other Paths until the delayed damage resolves, and
locks Deva Path itself out of all abilities for 3 turn cycles (§4.2). At
your next End Phase: deal 8 damage to all enemy units (Characters and
Tokens alike).

**Path Beast Tokens** *(full nuance: design/CHARACTER_LOG.md)* — 3
unique, named tokens, HP 4 each; only 1 copy of a given Beast in play at
once. A defeated Beast goes on cooldown for 2 of its controller's Upkeep
Phases (§4.2) before it can be resummoned. All 3 fizzle if Animal Path
is defeated (no cooldown from fizzling).

- **Ku, the Three-Headed Hound** — HP 4.
  Relentless Strike — 1 Chakra, Type: Taijutsu:
  Deal 2 damage to up to 2 different enemy characters. Usable twice per
  turn.
- **The War Rhino** — HP 4. *(full nuance: design/CHARACTER_LOG.md)*
  Rampaging Charge — 3 Chakra, Type: Taijutsu: Choose a primary target
  and a path (§9): **Straight** (2 more hits continuing left/right in
  its own row) or **Bent** (primary target must be front-row — 2nd hit
  is the Character behind it, 3rd hit is that Character's left/right
  neighbor). Deal 3/2/1 damage down the path; a path that runs off the
  board just hits fewer.
- **Giant Drill-Beaked Bird** — HP 2.
  Trait: Evasive — if targeted by a Normal-speed ability,
  the attacker flips a coin; on a loss, the attack misses (it fully
  fizzles — no damage or other effect from it).
  Drill Peck — 1 Chakra, Quick Technique, Type: Taijutsu: Deal 1 damage.

### Deidara (A Rank)
**HP: 10 (placeholder)** · Pool Capacity: 3
Specialization: Assault · Styles: Explosion, Earth · Synergy: Akatsuki

Traits:
- Art is an Explosion — Starts with 1 Clay Charge.

Abilities:
- Explosive Clay — 1 Chakra, Style: Explosion, Type: Ninjutsu: Generate 1 Clay Charge. Usable up to 3 times/turn (overrides the once-per-turn cap).
- C1, Shi-Wan: Clay Spider — 1 Chakra, Style: Explosion, Type: Ninjutsu: Create a Clay Spider token (below). Usable twice/turn (overrides the once-per-turn cap).
- Detonation Art — 3 Chakra, Style: Explosion, Type: Ninjutsu: Deal 2 damage. Spend 1 Clay Charge → deal 4 instead.

**Clay Spider Token** (HP: 1)
- Fizzles if Deidara dies. Max 5 in play at once.
- Self Detonate — 1 Chakra, Quick Technique, Style: Explosion, Type: Ninjutsu: Choose any number of your Clay Spider tokens and 1 target; they all detonate against it for 1 damage each. 1 Chakra total per activation, regardless of spider count. Usable any number of times per turn.
- Combine — Style: Explosion, Type: Ninjutsu: 4 Clay Spider tokens revert to clay and are destroyed, generating 2 Clay Charges.

Ultimate — C3, Shi-Suri (5 Chakra, Style: Explosion, Type: Ninjutsu):
Condition: Chakra Pool must be full to activate (may still be spent as
part of the cost). Spend 5 Clay Charges. Deal 5 damage to 1 target, plus
3 damage in a cross pattern from it (§9) — whatever's immediately left,
right, in front of, and behind the target, up to 4 additional hits.

Forbidden Technique — Death is an Explosion (Style: Explosion, Type:
Ninjutsu) — two versions: *(full nuance: design/CHARACTER_LOG.md)*

- **Version 1** — Cost: 5 Chakra + entire Pool (must be full) + 4 Clay
  Charges. Condition: Deidara at 3 HP or less. Deal 8 to all enemies, 3
  to all allies. Deidara dies.
- **Version 2** (Reactive Technique) — Cost: 6 Chakra + entire Pool
  (must be full) + 5 Clay Charges. Trigger: Deidara's HP would hit 0 or
  below — activate this instead. Deal 8 to all enemies, 5 to all allies.
  Deidara dies.

### Kisame, Tailless Tailed Beast (S Rank)
**HP: 10** · Pool Capacity: 12
Specialization: Assault / Tactician · Styles: Water · Synergy: Akatsuki, Itachi

Traits: *(full nuance: design/CHARACTER_LOG.md)*
- Samehada Fusion — Once Samehada absorbs 6 Chakra, Kisame may enter
  Samehada Shark Transformation: +6 Pool, +6 max HP (16 total), Water
  Style attacks +1 damage/−1 cost (Samehada Strike disabled), attackers
  targeting him pay +1 Chakra. Exits after ≥7 damage post-transformation,
  or at Upkeep with Pool ≤3.

Abilities:
- Samehada Strike — 0 Chakra, Type: Taijutsu: Deal 1, Absorb 1.
- Samehada Strike Evolved — Requires ≥3 Chakra absorbed and ≥4 pooled, 0 Chakra, Type: Taijutsu: Deal 2, Absorb 2.
- Water Style: Water Prison Jutsu — 4 Chakra, Type: Ninjutsu: Target must be a lower Rank. Through the next 3 turns (or until Kisame takes damage), it can't use abilities that target a character.
- Water Style: Super Shark Bomb Jutsu — Requires ≥4 Chakra absorbed and ≥3 pooled. 4 Chakra, Type: Ninjutsu: Deal 1 damage, +1 per Chakra pooled on the target. Target loses pooled Chakra equal to half the damage dealt (rounded down).
- Water Style: Thousand Hungry Sharks — Can be used twice per turn while in Samehada Shark Transformation, 5 Chakra, Type: Ninjutsu: Deal 4 damage.

### Itachi of the Sharingan (S Rank)
**HP: 11** · Pool Capacity: 4 (placeholder)
Specialization: Tactician / Assault · Styles: Fire · Synergy: Akatsuki

Traits:
- Uchiha Prodigy — Quick Technique Jutsu cards Itachi could use
  (styleless, or matching his Styles) cost 1 less Chakra while he's in
  play (minimum 1).
- Deterioration — Itachi can only use up to 2 abilities each turn.

Abilities: *(full nuance: design/CHARACTER_LOG.md)*
- Crow Shuriken Barrage — 2 Chakra, Style: None, Type: Taijutsu: Deal 2 damage.
- Great Fireball Technique — 3 Chakra, Style: Fire, Type: Ninjutsu: Deal 3 damage.
- Genjutsu: Mind Prison — 3 Chakra, Quick Technique, Style: None, Type: Genjutsu: Stun the target through its controller's next turn — can't pool Chakra or use abilities/Jutsu cards. Once per individual character, ever. Costs 1 Chakra if Itachi outranks the target.
- Crow Clone — 2 Chakra, Reactive Technique, Style: None, Type: Ninjutsu: Itachi phases out, negating any targeting of him. Once per character targeting him.

Passive — Sharingan Foresight (Style: None): Whenever an enemy targets
Itachi with a Quick Technique ability, prevent 1 damage from it.

Ultimate — Amaterasu (7 Chakra, Style: Fire, Type: Ninjutsu): Deal 3
damage to target enemy, plus 2 more at the start of your Upkeep for the
next 2 turns. Damage cannot be reduced.

Forbidden Technique — Mangekyō Sharingan: Tsukuyomi - Infinite Agony (7
Chakra, Style: None, Type: Genjutsu): Condition: target must already be
affected by Mind Prison, and must not have dealt more than 6 damage to
Itachi this game. Target takes 6 damage and is stunned for the next 2
turn cycles.

### Konan (A Rank)
**HP: 11** · Pool Capacity: 4 (placeholder)
Specialization: Tactician / Support · Styles: Paper, Wind, Earth, Water,
Yang · Synergy: Akatsuki

*Note: finalized. No Forbidden Technique proposed yet.*

Traits: *(full nuance: design/CHARACTER_LOG.md)*
- Paper Body — Konan takes −2 damage from Taijutsu attacks (min 0), but
  Fire Style attacks against her deal +1 damage instead.
- Origami Mastery — Starts with 1 Shikigami Charge.

Abilities:
- Paper Shuriken Storm — 2 Chakra, Style: Paper, Type: Ninjutsu: Deal 2 damage to up to 2 enemy characters.
- Fold Shikigami — 1 Chakra, Style: Paper, Type: Ninjutsu: Generate 1 Shikigami Charge. Usable up to 2 times/turn (overrides the once-per-turn cap).
- Paper Bomb Tag — 3 Chakra, Style: Paper, Type: Ninjutsu: Deal 3 damage. Spend 1 Shikigami Charge → deal 5 instead.
- Paper Clone — 2 Chakra + 2 Shikigami Charges, Reactive Technique, Style: Paper, Type: Ninjutsu: Konan disperses into paper and reforms unharmed, negating any targeting of her.

Ultimate — Paper Person of God Technique (6 Chakra, Style: Paper, Type:
Ninjutsu): *(full nuance: design/CHARACTER_LOG.md)*
Condition: Chakra Pool must be full to activate (may still be spent as
part of the cost). Spend 4 Shikigami Charges. Deal 3 damage to all enemy
units (Characters and Tokens alike) immediately upon activation. This
ability also has a delayed second effect: at the End Phase of your
opponent's next turn, deal 3 more damage to all enemy units. If Konan is
defeated before then, this delayed second hit is cancelled (the
immediate hit already happened and isn't affected).

### Sasori (A Rank)
**HP: 7 (Hiruko form)** · Pool Capacity: 2
Specialization: Tactician / Assault · Styles: Poison · Synergy:
Akatsuki, Deidara

*Note: finalized. No Forbidden Technique proposed yet.*

Traits: *(full nuance: design/CHARACTER_LOG.md)*
- Puppet Shell: Hiruko — Sasori begins play piloting Hiruko, his outer
  battle shell (stats and abilities below). Whenever Hiruko would be
  defeated, instead of Sasori being defeated, he transforms: Hollow
  Body (his true form) takes over, entering at its own full HP/Pool
  with summoning sickness (§6.6). Only once Hollow Body is also
  defeated is Sasori truly defeated.
- Chakra Strings: Third Kazekage — When Sasori enters play, also create
  the Third Kazekage token (below) — a separate Puppet under his
  control, independently targetable, existing alongside whichever form
  Sasori is currently in. Third Kazekage's own fate has no effect on
  Sasori's HP or current form.

**Hiruko Form (starting)** — HP 7 · Pool Capacity 2
- Tail Strike — 3 Chakra, Style: None, Type: Taijutsu: Deal 2 damage, apply 2 Poison counters.
- Puppet Shell Guard — 2 Chakra, Reactive Technique, Style: None, Type: Taijutsu: Redirect a targeted Ninjutsu or Physical (Taijutsu or Bukijutsu, §6.8) attack aimed at Third Kazekage onto Hiruko instead, reduced by 2 (min 0).

**Hollow Body Form (after Hiruko falls)** — HP 4 · Pool Capacity 2
- Poison Senbon — 2 Chakra, Style: Poison, Type: Taijutsu: Deal 1 damage, apply 2 Poison counters. (Poisoned: at the start of every Upkeep Phase — not just its controller's — it loses 1 Poison counter and takes 1 damage per counter removed. This damage can't be prevented or healed away.)
- Chakra Strings: Puppet Summon — 2 Chakra, Style: None, Type: Ninjutsu: Create a Puppet Soldier token (below).

Hollow Body's Ultimate — Puppet Performance: Hundred Puppets (6 Chakra,
Style: Poison, Type: Ninjutsu): Condition: Chakra Pool must be full to
activate (may still be spent as part of the cost). Deal 2 damage to all
enemy units (Characters and Tokens alike), apply 3 Poison counters to
each.

**Third Kazekage Token** (HP: 5) — separate and simultaneous, not part
of Sasori's own form chain above.
- Fizzles if Sasori is truly defeated (Hollow Body falls).
- Iron Sand Barrage — 3 Chakra, Type: Ninjutsu: Deal 3 damage.
- Gold Dust Poison — 2 Chakra, Type: Ninjutsu: Deal 1 damage to up to 2 enemies, apply 1 Poison counter to each.
- Iron Sand Wall — 3+X Chakra, Reactive Technique, Type: Ninjutsu: In response to a targeted Ninjutsu or Taijutsu ability aimed at any friendly unit, reduce its damage by 2 (min 0). You may spend X additional Chakra (up to 4) to reduce it by a further X.

**Puppet Soldier Token** (HP: 2)
- Fizzles if Hollow Body is defeated (which, since Hollow Body is
  Sasori's final form, means Sasori himself has been truly defeated).
  Max 3 in play at once.
- Puppet Strike — 0 Chakra, Type: Taijutsu: Deal 1 damage.

### Zetsu (B Rank)
**HP: 7** · Pool Capacity: Unlimited (no cap)
Specialization: Tactician / Support · Styles: None · Synergy: Akatsuki

*Note: finalized. No Forbidden Technique beyond what's below has been
proposed yet.*

Traits: *(full nuance: design/CHARACTER_LOG.md)*
- Dual Nature — Zetsu begins play in White Zetsu mode. At Sorcery
  speed, 0 Chakra, he may freely switch between White Zetsu mode and
  Black Zetsu mode at any time, any number of times per turn. Each of
  his two Abilities below only works while he's in its matching mode,
  but regardless of switching, he may use only one of the two — White
  Zetsu's or Black Zetsu's — per turn, not both.
- Photosynthetic Regeneration — At the start of your Upkeep Phase, heal
  Zetsu 1 HP.
- No Self-Pooling — Zetsu's Chakra Pool cannot be filled via the normal
  Chakra-pooling action (§5.3) — it only gains Chakra through absorption
  effects (e.g. his Golem's Chakra Spore, below).
- Shared Reservoir — Zetsu has exactly **one** Chakra Pool, shared by
  every White Zetsu Clone token and every Zetsu Golem token he
  controls, alongside Zetsu himself — all of them may pay their own
  ability costs from it, and any absorption effect (from Zetsu, a
  Clone, or a Golem's Chakra Spore) feeds this same single total. This
  is an exception to §10 (Tokens normally have no Chakra Pool), and a
  genuinely different structure from Pain's Rinnegan Reservoir (§13,
  Pain of the Six Paths) — Pain's Paths each keep their own
  separately-capped Pool and merely gained the ability to draw from
  each other's; none of Zetsu's Clones or Golems have a Pool of their
  own at all, only shared access to his one single Pool.

Abilities:
- White Zetsu: Corpse Consumption — 2 Chakra, Type: Ninjutsu: Heal 2 HP. If any character was defeated this turn (yours or the opponent's), heal 4 instead.
- Black Zetsu: Sinister Whisper — 2 Chakra, Type: Genjutsu: Deal 1 damage, Absorb 1.
- Combine: Zetsu Golem — 4 Chakra, Type: Ninjutsu: Requires at least 3 White Zetsu Clone tokens in play. Consume at least 3 Clone tokens (your choice how many, up to all in play); their current HP combines into 1 new Zetsu Golem token (below), replacing them.
- Absorbed Vitality — X Chakra, paid from the shared Reservoir only, Type: Ninjutsu: Heal X−1 HP to an ally or itself. Shared by every Zetsu-family unit (Zetsu himself, White Zetsu Clone tokens, Zetsu Golem tokens) — each can activate it independently, subject to the normal once-per-turn cap on its own copy of the ability (§9).
- Spore Technique — 4 Chakra, Type: Ninjutsu: Choose an enemy that
  Zetsu or a White Zetsu Clone token has dealt damage to this turn.
  Until the end of your next turn: it can't negate the targeting of
  damage dealt to it using an ability of its own (including a hand card
  it enables) — damage against it can still be reduced or prevented
  normally by other sources. It also can't use Taijutsu-Type abilities.
  Also, Absorb 1 from it at the End Phase of each of your next 2 turns.

Ultimate — White Zetsu Army (5 Chakra, Type: Ninjutsu): Usable only
while in White Zetsu mode. Create 3 White Zetsu Clone tokens (below).

**White Zetsu Clone Token** (HP: 2)
- Max 5 in play at once. Fizzles if Zetsu is defeated.
- Shares Zetsu's own Chakra Pool (see his Shared Reservoir trait,
  above) — not a separate pool of its own.
- Clone Strike — 1 Chakra, Type: Genjutsu: Deal 1 damage, Absorb 1.
- Absorbed Vitality (see Zetsu's own copy, above) — usable by each
  Clone independently.

**Zetsu Golem Token** (HP: the combined current HP of the 3 Clone
tokens consumed to create it)
- Fizzles if Zetsu is defeated.
- Shares Zetsu's own Chakra Pool (see his Shared Reservoir trait,
  above) — not a separate pool of its own.
- Trait: Regeneration — At the start of your Upkeep Phase, if the Golem
  took no damage last turn, heal it 1 HP.
- Golem Strike — 1 Chakra, Type: Taijutsu: Deal 3 damage, plant a
  Chakra Spore on the target. (Chakra Spore: at the start of the
  target's controller's next Upkeep Phase, it loses up to 3 Chakra from
  its Pool, if any is stored — that Chakra goes directly into Zetsu's
  own Chakra Pool.)
- Absorbed Vitality (see Zetsu's own copy, above) — usable by the
  Golem too.

---

### Juzo Biwa (B Rank)
**HP: 9** · Pool Capacity: 2
Specialization: Vanguard / Assault · Styles: Water · Synergy: Akatsuki

*Note: finalized. Juzo Biwa is an anime-only character — one of the
Seven Ninja Swordsmen of the Mist, wielding Kubikiribōchō (a blade that
regenerates using iron harvested from its victims' blood), and (in the
anime) recruited into Akatsuki for his combat prowess — so the Akatsuki
Synergy tag reflects an actual (anime-canon) affiliation, not a forced
addition. Abilities are largely original invention beyond that core
flavor, since detailed technique lists aren't well documented for this
character. No Forbidden Technique proposed yet.*

Traits: *(full nuance: design/CHARACTER_LOG.md)*
- Kubikiribōchō's Regeneration — Whenever Juzo defeats an enemy
  character, heal him 3 HP.
- Iron-Forged Body — Juzo takes 1 less damage from Taijutsu attacks
  (min 1).

Abilities:
- Cleaving Strike — 3 Chakra, Style: None, Type: Taijutsu: Deal 3
  damage. If this defeats the target, deal 1 damage to another enemy
  character too. Usable twice per turn.
- Water Style: Hiding Mist — 2 Chakra, Quick Technique, Style: Water,
  Type: Ninjutsu: Until the end of the turn, whenever an enemy targets
  Juzo, the attacker flips a coin — on a loss, it fails to target him.

Ultimate — Kubikiribōchō Unleashed (5 Chakra, Style: None, Type:
Taijutsu): Deal 5 damage to 1 target. If this defeats it, heal Juzo 6
HP.

### Yahiko (C Rank)
**HP: 8** · Pool Capacity: 2
Specialization: Tactician / Support · Styles: Water, Fire, Wind ·
Synergy: Akatsuki, Pain, Konan

*Note: finalized. Yahiko is the original founder of the group that
became Akatsuki, alongside Nagato and Konan — his kit leans
support/leadership rather than raw damage, matching his canon role as
more of an idealistic figurehead than a combat powerhouse. His Ultimate
references his canon death (he takes his own life to prevent Hanzo from
forcing Nagato to choose between him and Konan). No Forbidden Technique
proposed yet.*

Traits: *(full nuance: design/CHARACTER_LOG.md)*
- Inspiring Leader — The first ability your other Akatsuki characters
  use each turn costs 1 less Chakra (minimum 1).
- Elemental Versatility — First elemental jutsu each turn costs −1.

Abilities:
- Blade of Resolve — 2 Chakra, Style: None, Type: Taijutsu: Deal 2
  damage.
- Water Release: Water Jet Stream — 3 Chakra, Style: Water, Type:
  Ninjutsu: Deal 3 damage.
- Water Release: Water Pillar Wall — 2 Chakra, Style: Water, Type:
  Ninjutsu: Prevent the next 2 damage dealt to Yahiko this turn.
- Rallying Words — 2 Chakra, Style: None, Type: Ninjutsu: Each ally's
  next attack this turn deals 1 additional damage.

Ultimate — Yahiko Sacrifices Himself (Reactive Technique, 2 Chakra +
Yahiko's entire Chakra Pool spent in full, no Style, no Type): *(full
nuance: design/CHARACTER_LOG.md)*
Condition: your opponent must currently control at least 2 more
characters than you (Tokens count on both sides). In response to a
targeted attack aimed at one of your other characters that would defeat
it — calculated after any damage-reduction effects have already been
applied — redirect all of that damage onto Yahiko instead as a
replacement effect; the original target takes none. Only a targeted
attack can trigger this; a blanket/untargeted effect cannot.

### Amegakure Civilian Rebel (D Rank)
**HP: 3** · Pool Capacity: 1
Specialization: Vanguard · Styles: None · Synergy: Akatsuki

*Note: finalized. Deliberately weak and generic — deck filler
representing one of the Amegakure civilians who rallied to Yahiko's
original cause, not a named character. No Traits, Ultimate, or
Forbidden Technique by design. As a D Rank card, it's exempt from the
Character Deck's unique-copy restriction (§2) — **2 copies** of this
card are included in the current preset Akatsuki Character Deck.*

Abilities:
- Shinobi Strike — 1 Chakra, Style: None, Type: Taijutsu: Deal 1
  damage. If Yahiko is in play, deal 2 instead.

---

## 13a. Example Mission Cards

**Unshakable Resolve** — 1 Chakra
Condition: Reach your 6th Untap Phase after this Mission was played
without losing 10 or more Health.
Reward: Add +5 Chakra to a character's Chakra Pool (it may temporarily
exceed its Pool capacity — the excess tapers off as Chakra is spent,
returning to its normal limit once it's back under the cap), Heal 5 HP
to that character.

The following four cards form a themed family — the Bingo Book series,
scaling by the Rank of the enemy character defeated:

Bingo Book: Threat Level S — 0 Chakra
*Can be played face down; reveal it once its Condition is met.*
Condition: Defeat an S Rank character.
Reward: Draw from your Character Deck as normal, but look at the top 4
instead of the top 2, Your next character played cannot use any
abilities the turn it enters, Draw a card.

Bingo Book: Threat Level A — 0 Chakra
*Can be played face down; reveal it once its Condition is met.*
Condition: Defeat an A Rank character.
Reward: Reduce the cost of your next reinforcement by 2, Your next
reinforcement gains Ambush.

Bingo Book: Threat Level B — 0 Chakra
*Can be played face down; reveal it once its Condition is met.*
Condition: Defeat a B Rank character.
Reward: Add 3 Chakra to a character's Chakra Pool, Draw a card, The next
time you place a Chakra source, you may place 1 additional one that
turn (the additional source still requires Consuming a card, as
normal).

Bingo Book: Threat Level C — 0 Chakra
*Can be played face down; reveal it once its Condition is met.*
Condition: Defeat a C Rank character.
Reward: The cost of the next ability used by the character that
defeated it is reduced by 2, Draw a card.

Squad Formation — 0 Chakra
Condition: Control at least 3 characters.
Reward: Select 3 characters you control. Whenever a single damage
instance would be dealt to one of them, you (this Mission's controller)
may redirect all of that instance to a different character among the
three instead — a single instance's damage can't be split across
multiple of the three, but an ability that deals damage as multiple
separate instances lets each instance be redirected independently
(potentially to different characters than the attacker chose, or all to
the same one). This Mission stays in play until one of the three
selected characters is defeated or Retreated (§6.5b), then discard it.

---

## 13b. Example Jutsu Cards

**Substitution** — Style: None, Reactive Technique, Type: Ninjutsu
Cost: 4 Chakra (2 if paid from the enabling character's own Chakra
Pool). *(full nuance: design/CHARACTER_LOG.md)*
Effect: In response to a targeted damage-dealing ability or Attack-type
Jutsu aimed at the character enabling this card's play, negate its
targeting — it fails to target, so its damage (and anything else
depending on that target) fizzles (§9).

**Lightning Substitution** — Style: Lightning, Reactive Technique,
Type: Ninjutsu
Cost: 4 Chakra (2 if paid from the enabling character's own Chakra
Pool).
Effect: In response to a targeted damage-dealing ability or Attack-type
Jutsu aimed at the character enabling this card's play, negate its
targeting (§9). If the negated ability was Type: Taijutsu, deal 2
damage to its source.

**Water Substitution** — Style: Water, Reactive Technique, Type:
Ninjutsu
Cost: 3 Chakra (1 if paid from the enabling character's own Chakra
Pool). *(full nuance: design/CHARACTER_LOG.md)*
Effect: Same as Substitution: in response to a targeted damage-dealing
ability or Attack-type Jutsu aimed at the character enabling this
card's play, negate its targeting (§9).

**Incoming Mission Assignment** — Style: None, no Type
Cost: 0 Chakra. *(full nuance: design/CHARACTER_LOG.md)*
Effect: Look at the top 6 cards of your Hand Deck. You may add 1
Mission card among them to your hand. Shuffle the rest back into your
Hand Deck.

**Battlefield Selection** — Style: None, no Type
Cost: 0 Chakra. *(full nuance: design/CHARACTER_LOG.md)*
Effect: Look at the top 6 cards of your Hand Deck. You may add 1
Terrain card among them to your hand. Shuffle the rest back into your
Hand Deck.

**Chakra Transfer** — Style: None, Type: Ninjutsu
Cost: 0 Chakra. *(full nuance: design/CHARACTER_LOG.md)*
Effect: Choose two different characters you control. Remove X Chakra
(your choice, X≥1) from the first's Chakra Pool and add X−1 to the
second's Chakra Pool, minimum 1, capped by its remaining room (§5.3) —
the amount added can't exceed that room.

**Field Intelligence** — Style: None, no Type
Cost: 1 Chakra. *(full nuance: design/CHARACTER_LOG.md)*
Effect: Your opponent reveals 2 cards of their choice from their hand
to you. Draw 1 card.

**Deploy Medic Corps** — Style: None, Type: Ninjutsu
Cost: 2 Chakra. *(full nuance: design/CHARACTER_LOG.md)*
Effect: Choose 1 Retreated character you control (this card may target
a Retreated character despite §6.5b's normal targeting immunity — an
explicit exception). At the start of each of the next 4 of your own
Upkeep Phases, heal it 1 HP. If it ever stops being Retreated before
all 4 triggers occur, this effect is cancelled.

**Jutsu Disruption** — Style: None, Reactive Technique, Type: Ninjutsu
Cost: 2 Chakra. *(full nuance: design/CHARACTER_LOG.md)*
Effect: In response to a targeted Ninjutsu-Type damage-dealing ability
or Attack-type Jutsu card — other than an Ultimate or Forbidden
Technique — negate its targeting (§9).

**Explosive Tag** — Style: None, Type: Bukijutsu
Cost: 1 Chakra. *(full nuance: design/CHARACTER_LOG.md)*
Effect: Deal 1 damage to 1 target, plus 1 damage to a second character
adjacent to it in one direction of your choice (front, behind, left, or
right, §9).

**Assist Cards** (see §10c):

**Chidori Interception** — Impact Assist: Sasuke, Akatsuki
Style: Lightning (no enabling requirement — informational only, §10c),
Reactive Technique, Type: Ninjutsu. *(full nuance:
design/CHARACTER_LOG.md)*
Cost: 1 Chakra (0 if an Akatsuki-Synergy Terrain card is in play)
Effect: In response to an enemy character or token activating a
targeted damage-dealing ability or Attack-type Jutsu, deal 2 damage to
it. The original attack still resolves normally — this doesn't negate
or reduce it.

---

## 13c. Example Terrain Cards

**Akatsuki Hideout** — Synergy: Akatsuki, 2 Chakra. *(full nuance:
design/CHARACTER_LOG.md)*
Effect: Akatsuki-Synergy characters you control have their Upkeep
(§6.5) reduced by 1 (minimum 0).

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
- Character Deck composition: needs to total 12-18 unique cards (§2 —
  duplicates aren't allowed in this deck); 9 characters are currently
  designed (Kakuzu, Hidan, Deidara, Itachi, Kisame, Konan, Sasori, and
  Zetsu finalized; Pain of the Six Paths still an unconfirmed assistant
  draft) — at least 3 more unique designs needed to fill out a full
  deck at the new minimum size.
- Hand Deck contents: no standalone Jutsu cards exist yet to fill the
  Hand Deck — every ability so far lives on a Character card.

Resolved since first draft (no longer open):
- **Play/Summon Cost** — your starting character is free; every character
  played after that costs Chakra on an escalating scale (§6.7, §8).
- **Ability Type / Style tags** — every ability on all 6 example cards now
  carries explicit Style and Type tags (§6.8).
