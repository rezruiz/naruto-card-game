# Naruto Custom Card Game — Complete Rules & Interaction Reference

**What this is:** one consolidated rulebook for the Akatsuki prototype — every rule in `design/SPEC.md`, every nuance in `design/CHARACTER_LOG.md`, and every ruling made during playtest-build design sessions, organized by topic. Where a later ruling **changed** something in SPEC.md, this document states the *current* rule and marks the change with **[Updated]** (all of them are collected in Part 14).

**Authority order:** (1) a card's own printed text, (2) this document, (3) `SPEC.md` / `CHARACTER_LOG.md` where this document is silent. Card text always overrides general rules on an "unless otherwise stated" basis (§0.2).

**Conventions:** *Normal* speed is what SPEC.md sometimes calls "Sorcery" (the default; never printed on a card). "Controller" = the player who controls a card. "Enabling character" = the in-play character a Jutsu card is played through. **[Playtest]** marks rules specific to the digital playtest build (trust mode, hidden information, networking).

---

## Table of Contents

**Part I — Foundations:** §0 Rule precedence & scope · §1 Card types & zones · §2 Decks & deck construction · §3 Setup
**Part II — Turn structure:** §4 The turn: phases in order · §5 Speed, timing & the resolution queue
**Part III — Resources:** §6 Chakra: sources, the generic pool, personal Pools
**Part IV — Characters:** §7 Character basics · §8 Board limit, Upkeep & Disabled · §9 Retreat · §10 Summoning sickness, Ambush & Retaliation · §11 Character Deck draws, reinforcements & the Character Deck Tax · §12 Passives, abilities & effect notation
**Part V — Combat:** §13 Combat, targeting & board geometry
**Part VI — Non-character cards:** §14 Tokens · §15 Terrain, Mission, Jutsu & Assist cards (with the timing table)
**Part VII — Winning:** §16 Health, defeat & victory
**Part VIII — Playtest build:** §17 Trust mode: declaring, resolving & the response handshake · §18 Manual adjustments & deck tools · §19 Hidden information & remote play
**Part IX — Reference:** §20 Design defaults, engine simplifications & known gaps · §21 Ruling log · §22 Open questions
**Appendix A** — Full card texts (characters, Missions, Jutsu, Assist, Terrain)
**Appendix B** — Character Log: the nuance behind each card
**Appendix C** — What the engine actually implements: card tables and per-card status

---

# PART I — FOUNDATIONS

## 0. Rule precedence & scope

### 0.1 What this prototype is
A two-player mirror match: both players use the same preset **Akatsuki** deck. Cards are text in boxes (no art). Only Akatsuki is built. Numbers marked *(placeholder)* are tunable defaults.

### 0.2 Card text beats general rules
Everything here is a **default**. If a card's printed text contradicts a general rule, **the card wins** for whatever it explicitly covers ("unless otherwise stated"). Cards may rewrite normally-fixed numbers (board limit, upkeep, hand size, targeting) for as long as they are relevant. Example: a card reading *"You may only have 2 characters on your board while this is in play"* overrides the 5-character board limit for its controller. New cards should use a plain, self-contained override ("ignore the normal X; instead Y") rather than inventing a new subsystem.

**Cards only see what happens while they're in play.** **[Updated]** A card's Conditions, counters and triggers count only events from the moment it enters play, unless its text explicitly looks back at earlier ones. Example: a Mission needing "you have lost 2 of your own characters this game" counts only losses after it was played.

### 0.3 Design philosophy
Every card is mechanically tight, flavor-accurate, easy to parse standalone, and unique in identity. Each Akatsuki member has a signature mechanic (Kakuzu → Hearts, Hidan → Ritual/curse, Pain → the Six Paths, Deidara → Clay Charges, Kisame → Fusion Counters, and so on). Abilities do not list "requires X clan" restrictions; bonuses are baked into numbers.

---

## 1. Card types & zones

### 1.1 Card types
| Type | Notes |
|---|---|
| **Character** | The units you play and fight with. Live in the Character Deck; enter your hand only via Character Deck draws (§11). |
| **Jutsu** | Standalone spell-like cards from the Hand Deck. **Assist** cards are a sub-category of Jutsu (§15.5). |
| **Token** | Small, disposable summoned units created by abilities (§14). |
| **Terrain** | One active per side; one-way by default (§15.1). |
| **Mission** | Standing objectives with a Condition and a Reward (§15.2). |
| **Item** | Named for the future, **not defined** in this prototype. None exist. |

### 1.2 Zones
| Zone | What it is |
|---|---|
| **Hand Deck** | **50–80** shuffled cards (the preset is 50): Jutsu, Assist, Terrain, Mission. Drawn one per turn. |
| **Character Deck** | 12–18 shuffled Character cards (13 in the preset). Drawn only by triggers (§11). |
| **Hand** | Holds both Hand Deck cards and drawn Character cards. **No maximum hand size** *(placeholder)*. |
| **Back row** | Up to **5 Characters**, ordered left→right by entry order (§13.1). |
| **Front row** | Up to **10 Tokens**, in 5 column-pairs of 2 slots aligned to the back-row columns (§13.1). |
| **Chakra sources** | Your placed Chakra cards; tapped for Chakra (§6.2). |
| **Consumed pile** | Cards you Consume to place a Chakra source. Separate from the discard pile, and per-player. Far more permanent than the discard pile — retrievable only by some rare, specific effect (none exist yet). |
| **Discard pile** | Discarded/replaced cards. |
| **Terrain slot** | At most 1 Terrain in play per side. |
| **Missions in play** | Capped at your controlled-character count (§15.2). |

---

## 2. Decks & deck construction

### 2.1 Sizes
| Deck | Size | Drawn from |
|---|---|---|
| Hand Deck | **maximum 80** (minimum 50) **[Updated]** | normal turn draws |
| Character Deck | **12–18** | only Character Deck triggers (§11) |

### 2.2 Character Deck caps
Regardless of size, a Character Deck holds at most **3 S-Rank, 4 A-Rank, 4 B-Rank** (each cap independent); no cap on C or D. This applies to the fixed preset deck too.

### 2.3 Copy limits
- **Character Deck: no duplicates** — every card unique. **Exception:** **D-Rank** cards are generic and exempt (multiple copies allowed).
- **Hand Deck: up to 3 copies** of any card. A Mission follows this limit unless marked **Unique** (then 1 copy).

### 2.4 The preset Akatsuki decks
**Hand Deck (the preset is 50 cards):** 2× each of Unshakable Resolve, Bingo Book S / A / B / C and Squad Formation (12); 3× Emergency Relief (3); 3× each of Substitution, Lightning Substitution, Water Substitution (9); 2× each of Incoming Mission Assignment, Chakra Transfer, Field Intelligence, Deploy Medic Corps, Jutsu Disruption, Explosive Tag, Battlefield Selection (14); 3× each of Medical Chakra Infusion and Chakra Suppression (6); 1× Fire Style: Fireball Jutsu (1); 3× Akatsuki Hideout (3); 2× Chidori Interception (2). = **50**, no filler — exactly the minimum.

**Character Deck (13):** Kakuzu, Hidan, Deidara, Kisame, Itachi, Konan, Sasori, Zetsu, Juzo Biwa, Yahiko, Pain of the Six Paths, and **2× Amegakure Civilian Rebel**. Rank tally: S×3 (Kisame, Itachi, Pain), A×4 (Kakuzu, Deidara, Konan, Sasori), B×3 (Hidan, Zetsu, Juzo), C×1 (Yahiko), D×2 — all caps satisfied.

---

## 3. Setup

1. Each player shuffles their Hand Deck and Character Deck separately.
2. Each player does both of the following (independently, in either order):
   - **Starting character:** reveal the top **3** cards of your Character Deck; choose **1** to be your starting character. It enters play immediately, **free**, and **with summoning sickness** (§10). The unchosen cards are **shuffled back** into the Character Deck. **[Updated]** — the engine previously put them on the bottom; Setup now shuffles them back as written.
     - The **D-Rank rule** (§11.3) applies to this draw too.
   - **Starting hand & mulligan:** draw **6** cards from the Hand Deck. You may **mulligan** any number of times: shuffle your hand back and redraw. **The first mulligan is free** (a full new 6). Each later mulligan draws **1 fewer** than the previous draw (5, then 4, …), down to 0. **[Updated]** Mulligan is available until you **confirm** your starting character (confirming keeps your hand); each player decides independently.
   - **[Updated]** The first-player coin flip (step 3) happens **after** both players confirm.
3. Determine the first player *(placeholder: coin flip)*.
4. **The first player skips the Draw Phase of their very first turn only.**

**Starting character's first turn [Updated]:** the starting character is summoning-sick on **its controller's first turn**. For the player going second, that is **turn 2** (not turn 1).

---

# PART II — TURN STRUCTURE

## 4. The turn: phases in order

Each turn has seven steps: **Untap → Upkeep → Draw → Main 1 → Combat → Main 2 → End.** (SPEC.md's prose says "six phases" but lists these seven.) The turn counter increments each time the End Phase passes, so **each player's turn is its own numbered turn** (turn 1 = first player, turn 2 = second player, …).

### 4.1 Untap Phase
Untap all of **your** tapped Chakra sources. Nothing else untaps. **[Updated]** — at the start of *every* turn (yours or your opponent's), every unit on the board also resets its per-turn tracking: abilities used this turn, "pooled into this turn," and the Attack-type Jutsu names played this turn. So a Quick ability used on your opponent's turn is available again on yours, and vice versa (§12.5).

### 4.2 Upkeep Phase
1. Your **starting character** gets its own Rank-scaled Upkeep effect instead of the normal table (§8.2).
2. Pay Chakra **upkeep** for every other character you control (§8.1). There is no automatic Chakra income — upkeep is paid by **tapping Chakra sources**.
   - Payment is **mandatory whenever you can afford it**; you can't withhold it to save Chakra.
   - If you can't pay for all, pay in **descending order of cost** — highest first. Ties for the highest remaining cost: you choose. **[Updated]** The build asks you which of the tied characters to pay.
   - Chakra left over after upkeep isn't wasted: **untapped sources stay untapped and usable** for the rest of the turn.
   - A character whose upkeep goes unpaid becomes **Disabled** (not defeated) — §8.3.
3. Start-of-Upkeep delayed effects fire here (poison ticks at *every* Upkeep of either player; scheduled heals; Spore drains, etc.).

### 4.3 Draw Phase
Draw **1** card from the Hand Deck (skipped on the first player's first turn only). **[Updated]** The draw is a manual click (sidebar **Draw** button), not automatic; **[Playtest]** it can be undone. If your Hand Deck is empty and you must draw, take **3 Health damage** *(placeholder)* and draw nothing.

### 4.4 Main Phase 1
Normal-speed actions. You may:
- **Place 1 Chakra source** (once per turn, across both Main Phases combined — §6.2).
- **Pool Chakra** into a character's personal Pool (§6.3).
- **Play Character cards** from hand (free — the tax is paid when drawing them, §11.4).
- **Draw from your Character Deck** by paying the Character Deck Tax (§11.2).
- Play **non-combat Normal-speed cards**: Terrain, Missions, deck searches, Field Intelligence, Chakra Transfer, Deploy Medic Corps, etc. (§15.6).
- Activate **non-damaging (support) Normal-speed abilities** **[Updated]** (§5.4).
- **Retreat** or **return** characters (§9).

### 4.5 Combat Phase
This is when characters do things to each other (§13). In the Combat Phase:
- **Normal-speed damage-dealing abilities can only be activated here.** **[Updated]** (Non-damaging Normal-speed abilities work in a Main Phase; the build also accepts them in Combat.)
- **Attack-type Jutsu cards** (Normal speed) can only be played here, each named card **once per turn**. **[Updated]**
- Normal-speed cards with a **combat-implicating effect that resolves immediately** (none in the current deck) may also be played here. Non-combat Normal cards (Terrain, Missions, deck searches, Deploy Medic Corps…) **cannot**. **[Updated]** (§15.6)
- Quick and Reactive abilities/cards can be used here or any time their timing allows.
- Each character ability, and each named Attack-type Jutsu, can be used **once per turn** unless its text says otherwise.
- **Second Combat:** a combat step that clears a player's active characters can earn the attacker another Combat (§13.9). **[Updated]**

### 4.6 Main Phase 2
Identical to Main Phase 1. Play what you saved, place your Chakra source if you haven't yet this turn, pool Chakra, etc.

### 4.7 End Phase
- Any **generic Chakra** you generated this turn and didn't spend or pool **is lost.** **[Updated]** — this applies to **both players' generic Chakra** at the end of each turn (including Chakra your opponent tapped to respond during your turn). Chakra **pooled** into a character persists indefinitely (§6.3).
- Passives keyed to your End Phase fire (e.g., Hidan's regen).
- The turn passes; the next player begins at their Untap Phase.

---

## 5. Speed, timing & the resolution queue

### 5.1 The three speeds
- **Normal** — the default (never printed). Playable only on your own turn, when you have priority and nothing is pending: Main Phases for non-combat plays, the Combat Phase for damage-dealing abilities and Attack-type Jutsu (§4.4, §4.5, §15.6). Used for attacks, summons, rituals, transformations.
- **Quick Technique** — playable any time you could respond, including on your opponent's turn. Used for reactions, counters, defenses.
- **Reactive Technique** — like Quick, but with a narrower window: **only in direct response** to an opponent's action (a card played, an ability activated…). It has a stated condition (e.g., "in response to a targeted attack aimed at…").

### 5.2 How actions resolve — the rule as designed **[Updated]**
During a combat step it is as if each player's characters are **activated**, and their abilities happen **in a queue, resolving in the order they were activated: first activated, first resolved.**

When priority passes, the **responding player may insert their responses into the active queue at any point they choose.** So if three attacks are locked in, the responder can decide exactly where among them a response goes: a Substitution placed *before* an attack negates that attack; the same Substitution placed *after* it comes too late and finds nothing to negate.

> **Note:** this replaces SPEC.md §7's MTG-style "top of the stack resolves first (last in, first out)." The **[Playtest]** build implements the first-in-first-out queue with response insertion (§17). The original strict-mode engine (used only for the engine's own unit tests) still uses the older stack/priority model; it is not what playtests run.

### 5.3 Original strict priority model (reference)
In the strict engine: every activation goes on a stack; the active player has priority first; after an action or a pass, priority goes to the other player; when both pass in a row the top item resolves and the active player gets priority again. Normal-speed items can only be *put on* the stack when the active player has priority, it's their own appropriate phase, and the stack is empty.

### 5.4 Ability timing by kind **[Updated]**
| Ability | When (Normal speed) |
|---|---|
| Damage-dealing | Combat Phase only |
| Non-damaging / support (buffs, heals, utility) | Main Phase (also accepted in Combat) |
| Quick / Reactive | any time their timing/condition allows |

### 5.5 Negating a target vs. negating damage
Two different interactions (§13.6). A negation that "negates the target" strips the target's legality **before it locks in**, so target-dependent effect parts fizzle; the ability is still activated, its cost is paid, and independent (comma-separated) parts still resolve.

---

# PART III — RESOURCES

## 6. Chakra

There are two layers: the shared **generic pool** you produce each turn, and each character's **personal Chakra Pool** that persists.

### 6.1 No base Chakra income
You gain **no Chakra** simply by reaching a phase or turn. The only way to make generic Chakra is to **tap Chakra sources**; the only way your total per turn grows is by placing more sources, which persist. With zero sources you have zero generic Chakra.

### 6.2 Chakra sources
- **Placing:** once per turn, in either of your Main Phases, you may place **1** Chakra source. To do it, **Consume 1 card from your hand** (a Hand Deck card; a Character card can't be Consumed) into your Consumed pile, and put a textless Chakra card from your Chakra Card Stack into play as the source. **[Playtest]** In the build this is the **"🌀 Discard for Chakra"** button on a hand card; the placed source is shown as a small card with a spiral symbol.
- **Tapping:** tapping an untapped source gives **+1 generic Chakra** (like tapping a land in Magic). Tapped sources are shown rotated. Untapped sources are available. **[Playtest]** In trust mode you can also **untap** a mis-tapped source (undoes the +1).
- **Untapping:** all your sources untap automatically in your **Untap Phase**.
- A source has no text, isn't a character/item/terrain/mission, and can't be interacted with unless an effect explicitly references Chakra sources.
- Your total generic Chakra on a turn = **1 per untapped source you tap**.
- **Bingo Book: Threat Level B** can grant one extra placement (which still Consumes a card).

### 6.3 Personal Chakra Pooling
Each character has a **Chakra Pool** with a maximum **capacity set per card** (no rank formula).

- **Pooling in:** at **sorcery speed** (your own Main Phase), you may move any amount of your **available generic Chakra** into **one** character's Pool, up to its remaining capacity. Chakra moved this way leaves the generic pool immediately — this is how it survives past End Phase. There's no per-turn cap on how much you pool in one action beyond remaining capacity.
- **Pooling taps the character:** a character pooled into this turn **cannot activate any active ability for the rest of the turn** (passives are unaffected). The reverse also holds: a character that has **already used an active ability this turn cannot be pooled into**. Each turn a character either **acts** or **is pooled into**, never both. (Physically: a tapped character is turned sideways.)
- **Spending pooled Chakra:** it can be spent whenever the ability/card's speed allows — so Quick/Reactive uses can spend from a Pool on your opponent's turn. Spent Chakra is gone until re-pooled.
- **Restriction — a Pool only pays for its own character:** pooled Chakra can pay only for **that same character's own abilities**, or **Hand Deck cards enabled/used by that character**. It can **never** pay for another character's abilities, nor for a card being enabled by a different character. There is **no** "styleless card can be paid by anyone" exception — a styleless card is still enabled by one specific character, and only that character's Pool can fund it. Put simply: pooled Chakra can only pay for something done *through* the character it's pooled on. It **cannot** pay for costs tied to no in-play character — e.g., the **Character Deck Tax** (§11.4).
- **Shared Pools:** a few effects let units share a Pool (Zetsu's Shared Reservoir; Pain's Path tokens each pool individually — Rinnegan Reservoir). Those are card-specific (see Appendix B).
- **Capacity drops:** if a character's capacity later falls below what's pooled (e.g., Kakuzu losing a Heart), the excess is lost *(default; see §20)*.

### 6.4 Paying costs: generic, Pool, or a split
An ability or card's cost is paid **from the generic pool, from the acting/enabling character's own Pool, or a split of both.** The player chooses the split **[Updated]**. Some Jutsu cards have a **cheaper cost when paid from the enabling character's Pool** (Substitution: 4, or 2 from Pool; Water Substitution: 3, or 1). Paying any amount from the Pool counts as "paid from Pool" for that discount. Some abilities require payment **entirely from the Pool** (e.g., Zetsu's Absorbed Vitality) — those reject any generic contribution.

**[Playtest]** The build lets the player pick "Pay N (generic)" or "Pay M (from Pool)" for discount cards, and choose Chakra Transfer's amount X (bounded by the source's Pool).

### 6.5 Cost discounts
"First elemental jutsu each turn costs 1 less" (Kakuzu, Yahiko) and "each other ally's first ability each turn costs 1 less" (Yahiko's Inspiring Leader) never stack past **one −1 per activation** even if several sources qualify; every eligible source is still marked used. Minimum cost after discounts is 1 for these.

---

# PART IV — CHARACTERS

## 7. Character basics

### 7.1 Role types (max 2 per character)
**Vanguard** — tanking, prevention, durability. **Assault** — damage, aggression. **Support** — healing, buffs, utility. **Tactician** — battlefield control, tempo manipulation, denial. A character has at most two.

### 7.2 Styles
Fire, Water, Wind, Earth, Lightning, Explosion (kekkei genkai), Ice / Lava / Boil (optional), Gravity (special: Pain), Paper (special: Konan), Yang (special: Konan, open for reuse), Poison (special: Sasori, open for reuse), and **Ritual** (listed whenever a character's abilities are Ritual-flavored, e.g., Hidan).
- Flavor descriptors (Scythe, Kenjutsu, Puppet, Curse, Summoning, Sealing, Mangekyō…) are **not** Styles; they describe *how* an ability works and impose no restrictions.
- **Taijutsu is a base capability** every character has, not a listed Style.
- A Style limits what a character may **enable**: an ability of Style X requires the acting character to have Style X; a Jutsu card of Style X requires an enabling character with Style X (Style **None** accepts any enabling character).

### 7.3 Types (Ninjutsu / Taijutsu / Genjutsu / Bukijutsu / Sealing)
Every ability carries a **Type**: **Ninjutsu** (chakra-based techniques generally — elemental jutsu, summoning, sealing, ritual/curse, clone/substitution), **Taijutsu** (physical/weapon), **Genjutsu** (illusion), **Bukijutsu** (ranged/thrown weapons — coined for Explosive Tag, not retrofitted onto other cards), or **Sealing** (sealing/suppressing a target's chakra — coined for Chakra Suppression, not retrofitted; sealing-flavored abilities already on cards stay Ninjutsu, and Sealing is neither Ninjutsu nor Physical). Passive, perception-based abilities that fit none may leave Type unset.
- **Physical** is an umbrella grouping (Taijutsu + Bukijutsu) used only in other cards' text ("a Physical attack"); it is never a printed Type.
- **Physical blocking vs. Genjutsu:** any ability that blocks, redirects or reduces damage by *physically intercepting* an attack (Hiruko's Puppet Shell Guard, Third Kazekage's Iron Sand Wall, Asura Path's Mechanized Guard…) works only against **Ninjutsu and Physical** attacks — never against **Genjutsu**. Applies retroactively to every card of this kind.

### 7.4 Rank
D (weakest, civilian/filler) → C → B → A → S → SS → SSS. Rank drives **upkeep** (§8.1), **Health lost on defeat** (§16), Pool-capacity design, deck caps (§2.2), and rank-comparison effects (Kisame's Water Prison, Deva Path's drain, Kisame heals more vs lower ranks…). **D Rank follows C's tables** for upkeep and deck caps but loses less Health on defeat, and has the special draw rule (§11.3).

### 7.5 Synergy
A **tag, not a restriction.** Same-Synergy characters may have bonus interactions on specific cards; Synergy is never required to play or activate anything. It matters mechanically for **upkeep discounts** (§8.1) and for Synergy-conditional card text (Chidori Interception's Terrain condition).

### 7.6 Required card fields
Name & Rank · Specialization (≤2 roles) · Styles · Synergy · **HP** · **Chakra Pool Capacity** (per card) · Traits (passive text) · Abilities (cost; Speed omitted if Normal; Style; Type; effect). Upkeep cost and Health-lost-on-defeat are **derived from Rank** unless a card overrides them.

---

## 8. Board limit, Upkeep & Disabled characters

### 8.1 Board limit & the upkeep table
- At most **5 characters** in play (your back row). Missions and Tokens don't count.
- Every character past your first pays Chakra **upkeep** each turn:

| Rank | D | C | B | A | S | SS | SSS |
|---|---|---|---|---|---|---|---|
| Upkeep | 0 | 0 | 1 | 2 | 3 | 4 | 5 |

- **Synergy discount [Updated]:** board-wide, not per character — your total upkeep is reduced by **1 for each character past the first** sharing a Synergy tag (your largest same-tag group), **capped at −2 total**. It comes off your most expensive upkeep first (no character below 0) and applies to the starting character's upkeep too. *Examples (all Akatsuki, none starting):* two S-Ranks 6 → **5**; two S-Ranks + a C-Rank 6 → **4** (the cap). **[Playtest]** The Next Upkeep panel shows the math (e.g. "3 − 1 Synergy = 2").
- **Terrain discount:** a Terrain whose Synergy matches the character (Akatsuki Hideout vs Akatsuki characters) reduces that character's upkeep by **1** (min 0), on top of the Synergy discount.
- The table is a **default**, not a fixed rule.

### 8.2 The starting character's special treatment
Only the character you chose as your starting character at Setup (§3) uses this table instead of §8.1:

| Starting rank | Upkeep-Phase effect |
|---|---|
| C | No cost. **Gain +2 Chakra pooled directly** into this character's Pool (capped at capacity; excess lost). |
| B | No cost. **Gain +1 Chakra pooled directly** into its Pool (capped; excess lost). |
| A | Upkeep = **0** (free). |
| S | Upkeep = **2** (reduced from 3, not free). |

It is tied to that specific character. If it is later defeated, the treatment **does not transfer** — any replacement pays the normal table. (An S-Rank starter therefore is normally **Disabled on the first upkeep** when you have no Chakra sources yet — this is **intentional for balance**. **[Confirmed ruling]**) Ranks not covered (D, SS, SSS) fall back to the normal table.

### 8.3 Disabled (unpaid upkeep)
Falling short of upkeep is **legal** — it **Disables** the character instead of defeating it. While Disabled:
- It **cannot take any action** — no abilities (active). **[Updated]** Its **triggered passives also do not trigger** (Hidan's End-Phase regen, damage-taken reactions, Yahiko's Inspiring Leader, start-of-turn self-heals) **— with one exception:** **replacement-effect passives** (defeat replacements such as Kakuzu's Five Hearts, Hidan's Jashin's Blessing, Hiruko's Hollow Body) **still apply.** Already-activated ongoing effects it created keep running.
- It **cannot enable** another card's play. A Jutsu card that needs an enabling character can't use a Disabled one, even if it's your only character with the matching Style.
- Its **static attributes** (HP, Rank…) can still be read by another character's condition.
- It remains a **fully valid target** — it can be targeted and damaged normally; Disabled grants no protection.
- It is **enabled again** as soon as its upkeep is paid in a later Upkeep Phase.
- A character with 0 upkeep (C/D, discounted-to-0) is never Disabled by upkeep.

### 8.4 Upkeep payment mechanics (as implemented)
Upkeep is taken directly from **untapped sources** (it never passes through the spendable generic pool). Characters are processed in **descending cost** (after discounts); if a character is unaffordable it is Disabled and processing continues with cheaper ones, so a lower-cost character can still be paid when a higher-cost one can't. **[Updated]** When the sources cover only some of several characters **tied** at the same cost, **you choose** which of them to pay. Cost-0 characters are cleared of Disabled automatically.

---

## 9. Retreat

### 9.1 Retreating
At **Normal speed**, during **your Main Phase**, you may flip one of your characters to **Retreated**, paying generic Chakra by Rank:

| Rank | C | B | A / S / SS / SSS |
|---|---|---|---|
| Retreat cost | 1 | 2 | 3 |

You **cannot Retreat**: your **only** character (you must keep ≥1 non-Retreated afterward); a character **under a stun-type effect**; a character that **has already used an ability this turn** (Retreat first, then act — but a Retreated character can't act). Retreating doesn't move the character; it keeps its slot and counts toward the 5-character limit.

### 9.2 While Retreated
- It behaves like Disabled: **no actions, no passives** (no attacks, no abilities, no self-regen) **[Updated]** — replacement-effect passives excepted — and it **can't be an enabler**. HP and Rank are frozen except for **already-running** damage/heal effects (poison, Amaterasu, a queued heal, Spore/Paper Person), which continue.
- **Full immunity:** a Retreated character **cannot be targeted or damaged at all** — including by **untargeted/blanket/splash** effects (a deliberate exception to the targeting-vs-affected rule, §13.5).
- **Exception:** if a player has **zero non-Retreated characters**, their Retreated characters become legal targets again (so a player can't Retreat their whole board into immunity). See §9.4 — in play this is now enforced by *forcing them out*.
- It pays upkeep like any character.

### 9.3 Returning
Returning costs **0**; flip the status off (Main Phase). A returning character is treated **exactly like it just entered play** for summoning sickness: **no damage-dealing abilities that turn**, but non-damaging abilities and passives work immediately. **Deploy Medic Corps** keeps healing only while its target stays Retreated (§15.4).

### 9.4 Retreat collapse and the second Combat **[Updated]**
If a player has retreated characters but **no non-Retreated character left**, all their Retreated characters are **immediately forced out of Retreat** (treated as re-entering play, like a voluntary return).
- **Immunity holds for the whole combat step.** A retreated character can't be hit by anything queued in the same step, even after the controller's last active character falls part-way through it. They are forced out only once the step is over.
- **Second Combat:** if the forced-out happens **during the Combat Phase to the non-active player** — i.e., the attacker's combat step cleared their opponent's active characters — the attacker gets a **second combat opportunity** instead of moving on to Main 2. In it they may use any attack actions **not already used this turn** (once-per-turn limits still apply). It repeats only if a new clear-out occurs.
- Forced out any **other** way (e.g., defeated in Main Phase), the character simply leaves Retreat — **no extra Combat**. That's why forcing a character out of Retreat is "not as punishing" outside of combat.
- "Characters" here means **back-row characters**; Tokens (Pain's Paths, Clay Spiders…) don't count.

---

## 10. Summoning sickness, Ambush & Retaliation

- **Summoning sickness:** a character can't use **damage-dealing abilities** the turn it enters play (including Ultimates and Forbidden Techniques — there is no separate multi-turn lockout beyond this). It **can** use non-damaging abilities (buffs, heals, Quick defenses) at once, and it can be targeted. Playing a *hand card* isn't "using an ability," so an enabling character's sickness doesn't block a damaging Jutsu card.
- **"The turn it enters":** a character is sick during the turn number it entered. The starting character's entry turn is its controller's first turn (turn 1 for the first player, turn 2 for the second). A character returning from (or forced out of) Retreat is treated as entering on the current turn.
- **Retaliation:** when one of your characters is defeated, the **next character you play** is exempt from summoning sickness entirely (it may use any damage-dealing ability, Ultimates and Forbidden Techniques included). One-time only; consumed when that character enters.
- **Ambush** (keyword): the general form — a character with Ambush ignores summoning sickness. It's either printed on a card or granted by an effect (e.g., Bingo Book: Threat Level A's "the next character you play from hand gains Ambush," one specific future character, once).
- All of this is a default subject to §0.2.

---

## 11. Character Deck draws, reinforcements & the Character Deck Tax

### 11.1 The draw — a state-based action **[Updated]**
A **Character Deck draw**: reveal **2** cards from your Character Deck, choose **1** to add to your hand, put the other on the **bottom**. It's a **state-based action** — never on the stack, can't be responded to, resolves immediately; its timing comes from whatever caused it. **Playing a Character card from hand is always free** (5-character limit and summoning sickness still apply). **[Playtest]** Reveals are private (§19); pick a card, check **Details**, then **Confirm**.

### 11.2 When you draw **[Updated]**
1. **Manual draw** — your own Main Phase: pay the **Character Deck Tax** (§11.4) and draw. The **only** thing that raises the tax. **[Playtest]** Sidebar button "Character Deck (N) — draw for X Chakra".
2. **Reinforcement** — when one of your characters is defeated, right away, on either player's turn:
   - **D-Rank** defeated → no Reinforcement.
   - **C+** defeated, another **C+** still in play → you **may** pay your **current** tax to draw; the tax does **not** go up.
   - Your **last C+** in play defeated (D-Ranks in play ignored — a B and a D in play, the B dies → counts as last): holding a **C+** Character card → you **must** play one now (free, ignoring timing). Holding none (D-Ranks in hand ignored) → you **may** draw **for free**. Neither raises the tax.
3. **A card effect** grants a character draw — as that card says.
(The old "every 3rd turn" trigger was **removed**.)

### 11.3 D-Rank rule
On any multi-card Character Deck draw (Setup or Reinforcement) that shows a D-Rank card, you may keep **that D-Rank card in addition to** your normal pick (leftovers still go back). **All-D reveal:** if every card revealed is D-Rank, keep revealing one at a time until a non-D-Rank card appears. **Cap:** at most **2** D-Rank bonus cards per draw, on top of your one pick; the rest go to the bottom.

### 11.4 Character Deck Tax **[Updated]**
Paid when you **draw** from the Character Deck (not when you play the card). Scales with how many **manual** draws you've paid for this game (never decreases), **capped at 8**:

| Paid manual draws so far | 0 | 1 | 2 | 3+ |
|---|---|---|---|---|
| Tax | 3 | 5 | 7 | 8 |

- Paid from **generic Chakra only** (tapped sources) — no character's Pool can pay it.
- A paid **Reinforcement** draw costs your *current* tax but doesn't advance the count; the free last-C+ Reinforcement costs nothing and doesn't advance it. Extra D-Rank cards kept from a draw are free and don't advance it.
- The old **Empty-Board Waiver** is replaced by the last-C+ Reinforcement rule (§11.2).
- **Bingo Book: Threat Level A** discounts your next *paid* Character Deck draw by 2 (one-time).
- **[Playtest]** Hand Character cards show "Play (free)", disabled with a reason if there's no room (back row full; Pain needs **6 open front-row slots**).

### 11.5 Pain and other special entries
Pain of the Six Paths has **no HP or Pool of his own**; playing him spawns his **6 Path tokens** (Deva, Asura, Human, Animal, Preta, Naraka) into the front row. Sasori's card enters as **Hiruko**.

---

## 12. Passives, abilities, and effect notation

### 12.1 What counts as an "ability"
"Ability" means a character's own printed text being used (Traits, Abilities, Ultimates, Forbidden Techniques, Passives, Fusion Forms). **Playing a card from hand is not "using an ability"** — triggers like Deidara's "whenever he uses an ability" don't fire from hand cards.

### 12.2 Notation
- **Colon (`:`)** separates cost from effect. The cost must be paid **before the ability can be activated** — payment is a precondition, not a first step of resolution.
- **Comma (`,`)** separates distinct effects in one ability; they **resolve simultaneously** and are **independent** — none is conditional on another unless the text says so ("Deal 1 Damage, Absorb 1": the Chakra gain isn't gated on the drain).

### 12.3 Keyword: Absorb X
Gain X Chakra (to the acting unit's Pool, or a shared Pool it draws from), and **separately** reduce X Chakra from the unit absorbed from **only if it has Chakra pooled**. The gain always happens.

### 12.4 Effect duration
Unless stated otherwise, a lingering effect lasts **only until the end of the turn it was activated on** (gone by the next Untap). Longer durations say so explicitly ("for the next turn cycle"). **"Turn cycle"** *(default)*: ends at the start of the affected character's controller's own next turn.

### 12.5 Once-per-turn limits **[Updated]**
Each character ability, and each **named Attack-type Jutsu card**, may be used **once per turn** unless its text says otherwise — regardless of speed. "Per turn" means **each numbered turn, for either player**: the tracking resets for **every** unit at the start of **every** turn (§4.1), so a Quick ability used on your opponent's turn does not use up your next turn's use. Some characters cap total activations per turn (Itachi: 2). Some abilities share a use group (Zetsu's Dual Nature: one White/Black ability per turn).

### 12.6 Abilities that target vs. affect
See §13.5.

---

# PART V — COMBAT

## 13. Combat, targeting & board geometry

### 13.1 Board layout
Each player has a **back row** (Characters, ≤5) and a **front row** (Tokens, ≤10, a flat cap on top of card-specific token caps). Occupants sit left→right in the order they entered play (a new one joins at the right end unless a card says otherwise). The front row is **5 column-pairs of 2 slots**, each pair aligned with one back-row column (front slots 1–2 ↔ column 1, …).

### 13.2 Adjacency and cross patterns
- **Same-row:** the occupant immediately left/right within its own row.
- **Cross-row:** a back-row Character's front neighbors are the Token(s) in its paired slots (up to 2); a front-row Token's back neighbor is the 1 Character in its paired column.
- A **cross pattern** hits the epicenter plus left, right, front and behind (up to 4 extra). Empty arms hit nothing. Adjacency **never crosses** between the two players' sides.

### 13.3 Targeting
- **Free targeting:** an attack may target **any single enemy** in play; no forced-target ("taunt") rules.
- **Enemy-only by default.** A card must say **"any target"** to be able to hit allies or itself (Kakuzu's Earth Grudge Fear is the example).
- Legal targets must **exist**, be on the correct side (**enemy** default; **ally** and **any** are per-ability), and **not be Retreated** (§9.2 — except when their controller has no non-Retreated character).
- A summoning-sick character can be targeted (only its own damaging abilities are blocked).
- There is **no declare-attackers/blockers step**: a damaging ability simply resolves against its chosen target when it resolves.

### 13.4 Default targeting inference
A single-target effect is presumed to **target** that character even without the word "target." Only blanket wording ("all," "each") makes an effect untargeted.

### 13.5 Targeting vs. being affected
"Targeting" means being *selected*. Blanket ("all enemies") and splash ("plus Y to adjacent") effects affect characters they never target. A "**cannot be targeted**" restriction (Hidan's Curse) blocks targeting only — it does **not** protect from blanket/splash effects. **Exception:** **Retreated** grants full immunity to both.

### 13.6 Negating a target vs. negating damage
- **Negating damage:** the ability still targets and resolves; only the damage number is prevented/reduced.
- **Negating the target:** strips the target's legality **before it locks in**; **target-dependent parts fizzle** as if never triggered. The ability is still **activated** — cost paid, triggered, target identified — the negation intervenes only at the later moment the target would be *confirmed*. **Only the parts that needed that target fizzle**; comma-independent parts (e.g., "Prevent the next 2 damage dealt to you") still resolve.
- In the build, target-negation abilities remove the negated action from the queue (a documented simplification: some cards that "redirect" in the printed text are implemented as full negation — Appendix C).

### 13.7 Damage pipeline (as implemented)
When damage is dealt to a unit, in order: (1) **Retreat immunity** check (§9.2; ongoing effects exempt); (2) **Squad Formation** redirect if the target is in a Squad group (once per instance); (3) **damage-prevention pool** ("prevent the next N damage this turn," consumed 1-for-1) unless the source says it *cannot be reduced*; (4) HP reduced (floor 0); (5) the target's **damage-taken reaction** fires (skipped while Disabled/Retreated); (6) if HP reached 0, the target's **defeat-replacement** passive gets a chance to intercept; otherwise the unit is **defeated** (§16).

### 13.8 Defeat effects
A defeated character leaves the board; its controller **loses Health by Rank** (§16), **owes a Character Deck draw** (§11), and gets **Retaliation** (§10). Tokens it created **fizzle** (default rule; Pain's Path Beasts fizzle when Animal Path falls, not Pain). The opponent's **Bingo Book Missions** are checked against the defeated character's Rank.

### 13.9 Once per turn, and the second Combat
See §12.5 and §9.4.

---

# PART VI — NON-CHARACTER CARDS

## 14. Tokens
Tokens (Clay Spider, Puppet Soldier, Path tokens, Zetsu Clones, …) have **HP** and **one ability**; **no Chakra Pool, no upkeep, no traits, no rank, no Synergy.** They live in the **front row** (≤10 total, plus any card-specific cap such as Deidara's 5 Spiders). Exceptions (card-defined): **Pain's Path tokens** each have their own Pool (Rinnegan Reservoir); **Zetsu's Clones/Golem** draw from a shared Reservoir. A Token **fizzles** when its creator is defeated unless a card says otherwise. Tokens can activate their own abilities (Third Kazekage, Puppet Soldier, Path abilities) and count as targets/occupants for adjacency.

## 15. Terrain, Mission, Jutsu & Assist cards

### 15.1 Terrain
- **One at a time:** playing a Terrain **replaces** your existing one (the old is discarded).
- **One-way by default:** unless text says otherwise, a Terrain's effect applies to one side only.
- Terrain is a **Main-Phase** play (§15.6). *Akatsuki Hideout* (Synergy: Akatsuki, **2 Chakra** **[Updated]**): Akatsuki-Synergy characters you control have upkeep −1 (min 0).

### 15.2 Missions
- Live in the Hand Deck; drawn normally; copy limit 3 (Unique: 1).
- **Playing:** pay the Chakra cost (Normal speed; a **Main-Phase** play). It stays in play as a standing objective.
- Each has a **Condition** and a **Reward**. When the Condition becomes true, resolve the Reward and **discard** the Mission.
- **Limit:** at most **1 Mission in play per character you control.** Playing past the limit **replaces** one of your choice (discarded incomplete, no Reward); the limit gates *playing*, not staying — Missions aren't discarded retroactively if your character count drops. *(Build: replaces the oldest automatically.)*
- Missions don't count toward the 5-character board limit; they can be **Consumed as Chakra** (§6.2) like any Hand Deck card.
- **[Updated]** Default **face down**: the opponent sees only "Face-down Mission," not its Condition or Reward. It's **revealed when its Condition is met**; a Mission that stays in play after that (Squad Formation) stays face up. A card overrides this only by saying it's played face up.
- The seven Missions: Unshakable Resolve; Bingo Book S / A / B / C; Squad Formation; Emergency Relief (full text: Appendix A).

### 15.3 Jutsu cards
Jutsu cards are standalone effects any **eligible enabling character** can play. Each states **Style** (or None), **Speed**, **Cost**, **Type**, and effect text (colon/comma notation).
- **Enabling:** playing a technique Jutsu — one with an ability **Type** (Ninjutsu, Taijutsu, Bukijutsu, Genjutsu, Sealing) — requires an **in-play, un-Disabled, un-Retreated** character whose Styles include the card's Style (any character for Style: None), at the moment it's played. **[Updated]** **Type: None** tactical cards (Field Intelligence, Incoming Mission Assignment, Battlefield Selection), Assist, Terrain and Mission cards need **no** enabling character; they're paid from generic Chakra.
- **Cost:** paid from the generic pool and/or the **enabling character's own Pool**; some cards are **cheaper when paid from that Pool** (§6.4).
- **Once per turn** by name unless stated (§12.5).
- **Ongoing-effect Jutsu** (a stated duration or multiple future triggers — e.g., Deploy Medic Corps) stay **face up in play** until finished or cancelled, then go to the discard pile. *(Build: the effect is tracked on the target; the card isn't shown in a separate in-play area yet — Part 20.)*

### 15.4 Card-by-card timing and implemented effects
Full text is in Appendix A. Timing and implementation:

| Card | Speed / timing | Notes as implemented |
|---|---|---|
| **Substitution** (None) | Reactive | In response to a targeted damaging ability/Attack Jutsu aimed at the **enabling character**, negate its targeting. 4, or **2 if paid from the enabler's Pool.** |
| **Lightning Substitution** (Lightning) | Reactive | As Substitution, and if the negated ability was **Taijutsu**, deal 2 to its source. 4 / 2 from Pool. |
| **Water Substitution** (Water) | Reactive | As Substitution. **3 / 1 from Pool.** |
| **Jutsu Disruption** | Reactive, 2 | Negate a targeted **Ninjutsu** damaging ability/Attack Jutsu — **not** an Ultimate or Forbidden Technique. Not scoped to the enabler. |
| **Chidori Interception** (Assist) | Reactive, 1 (0 with an Akatsuki Terrain) | In response to an enemy activating a targeted damaging ability/Attack Jutsu, deal **2 to it**; the original still resolves. **Ignores enabling requirements** — playable with zero characters. |
| **Explosive Tag** (Bukijutsu) | **Normal, Attack-type — Combat only**, 1 | 1 damage to a target, 1 to a second character adjacent to it (front/behind/left/right). **Once per turn.** |
| **Incoming Mission Assignment** | Normal, **Main only**, 0 | Look at the top 6 of your Hand Deck; add 1 Mission to hand; shuffle the rest back. |
| **Battlefield Selection** | Normal, **Main only**, 0 | As above for a Terrain. |
| **Chakra Transfer** | Normal, **Main only**, 0 | Choose two of your characters; remove X (≥1, **your choice, ≤ the first's Pool**) from the first's Pool and add X−1 (min 1) to the second's, capped by its room. |
| **Field Intelligence** | Normal, **Main only**, 1 | Opponent reveals 2 cards of their choice; you draw 1. |
| **Deploy Medic Corps** | Normal, **Main only**, 2 | Target one of **your Retreated** characters (explicit exception to Retreat immunity). At the start of each of your next **4** Upkeeps, heal it 1 HP; **cancelled** if it stops being Retreated. |
| **Medical Chakra Infusion** | Normal, **Main only**, 1 | Heal 2 HP to one of your characters (not above max HP; not a token, not a Retreated character). |
| **Fire Style: Fireball Jutsu** (Fire) | **Normal, Attack-type — Combat only**, 4 / 3 from Pool | 3 damage to a target, 1 to each of up to 2 characters adjacent to it (your choice). **Once per turn.** |
| **Chakra Suppression** (Sealing) | **Quick**, 2 | Target enemy character can't be pooled into **through** its controller's next turn. Characters only, not tokens. |
| **Akatsuki Hideout** (Terrain) | Normal, **Main only**, **2** | Upkeep −1 for Akatsuki-Synergy characters (min 0). |
| **Missions (7)** | Normal, **Main only** | See Appendix A. **Emergency Relief** counts your own characters defeated (any rank, tokens don't count) after it's played; at 2, you immediately take a free Character Deck draw (look at 2, keep 1) that doesn't raise the tax. |

### 15.5 Assist cards
An **Assist** card is a Jutsu card in every respect (same deck, Speed/Cost/Type rules) written as a stripped-down "character lite": header **[Assist Type]: [Character], [Synergy]** (e.g., *Impact Assist: Sasuke, Akatsuki*). Types: **Impact Assist** (offense-flavored payoff) and **Guard Assist** (protective). The named character needn't be canon to the faction; the Synergy is set by what the card should plug into. **Assist cards ignore the normal Style-enabling requirement** — the character briefly steps in, performs one technique, and leaves; a listed Style is informational (still checked by Style-conditional text elsewhere). Playable with zero characters in play.

### 15.6 Normal-speed card timing **[Updated]**
| Kind of Normal-speed card | When playable |
|---|---|
| **Attack-type Jutsu** (Explosive Tag, Fireball Jutsu) | **Combat Phase only**; each named card **once per turn** |
| **Non-combat cards** — Terrain, Missions, deck searches, Field Intelligence, Chakra Transfer, Deploy Medic Corps, Medical Chakra Infusion, etc. | **Main Phase only** — *not* in Combat |
| A Normal-speed card whose effect **implicates combat and triggers immediately** (it must somehow alter the immediate combat step) | Main Phase **or** Combat *(no card in the current deck qualifies; a card opts in with a timing setting)* |
| **Quick / Reactive** cards | per their own speed, any time their condition is met |

In every case the card still needs its enabling character (except Assist), a legal target, and payable Chakra.

---

# PART VII — WINNING

## 16. Health, defeat & victory

This is an **attrition / war-of-losses** model: losing your own shinobi hurts **you**. There is **no direct damage to a player's face** by default; Health is lost only from your characters being defeated (or failing to draw, §4.3).

- **Starting Health: 20.**
- When **your** character is defeated (HP 0 or any defeat effect — **not** unpaid upkeep, which only Disables), **you lose Health by its Rank:**

| Rank | D | C | B | A | S | SS | SSS |
|---|---|---|---|---|---|---|---|
| Health lost | 1 | 3 | 4 | 5 | 7 | 9 | 12 |

- A player at **0 Health or below loses.** If both hit 0 simultaneously, the game is a **draw.**
- **Deck-out:** required to draw from an empty Hand Deck → **3 Health damage** *(placeholder)* instead.
- Tokens being defeated cost no Health.

---

# PART VIII — THE PLAYTEST BUILD

## 17. Trust mode: declaring, resolving & the response handshake **[Playtest]**

The playtest build runs in **trust mode**. Players talk to each other (voice), agree on legality themselves, and hold each other accountable; the engine's job is to **calculate effects** (damage, healing, Chakra, draws, shuffles), not to police timing. The engine only needs to be told **what is being pointed at what.**

### 17.1 Declaring actions
Activating an ability or playing a card does **not** resolve it. It adds a **declared action** to the shared **Declared actions** list, visible to both players immediately. A declared card is revealed to the opponent (it's being played). Nothing is calculated, and no Chakra is spent, until the round is resolved.

Before the round is resolved, the **owner** of a declared action may:
- **Change target** — re-aim it (the ability's or card's target count applies);
- **Move earlier / later** in the queue (§17.6);
- **Remove** it.
A player can also change which ability or card they use simply by removing one and declaring another. Either player may declare **at any time** — the engine doesn't gate timing — but the strict rules still apply *between the players*: see §17.3.

### 17.2 Resolve Actions vs. Finalize Phase
Only the **active player** starts a resolution:
- **Resolve Actions** — resolve everything declared so far and **stay in the current phase** (so results can be used before continuing: draw a card, then play it; kill something, then continue attacking).
- **Finalize Phase** — resolve everything declared, then **advance to the next phase.** This is "lock in my decisions for this phase."

If **nothing is declared**, Finalize Phase simply advances. Either button opens the approval handshake below when something is declared.

### 17.3 Advisory warnings
When an action is declared or re-aimed, the engine checks it against the strict rules and, if it would have been illegal (wrong timing, not enough Chakra, wrong Style, disabled/retreated source, bad target, summoning sickness…), shows a **⚠ "Not legal under the strict rules: …"** warning on that action. The warning is **advisory only** — the action can still be resolved. It exists so the opponent can call it out.

### 17.4 The approval handshake
1. The active player clicks Resolve Actions or Finalize Phase → **their** approval is recorded.
2. The engine checks the **other** player: if they have a **meaningful legal response** (§17.5) they are **prompted** — *"OK — no response"* — and may instead **declare a response**. If they have none, they are **auto-approved with no click.**
3. **Any change to the declared list** (a new declaration, a re-aim, a move, a removal) **resets approvals**; the author of the change counts as having approved it. The other player is then checked/prompted again — so responses can be answered in turn, like passing priority back and forth.
4. When **both players have approved**, the round resolves.
5. The active player may **reopen** the round (cancel the handshake) to make more changes before the opponent approves.

Prompts therefore appear **only when the engine determines a player could actually respond** — never on every action.

### 17.5 What counts as a "meaningful legal response"
A player has one if they hold an **ability or hand card at Quick or Reactive speed** (Normal speed can't respond) that they **can afford** — counting Chakra in the acting/enabling character's **Pool**, their **available generic Chakra**, and **untapped sources they could still tap** — and that can **target at least one thing**.
- For effects that take **several targets**, **one valid target is enough**; the multi-target condition itself is ignored (this is a "worth asking?" check, not a full legality check, so it errs toward asking).
- Conditions that define a card's only possible target still apply: Substitution, for instance, only counts if an attack aimed at its enabler is in the queue.
- Evasion coin flips are **not** rolled during this check.

### 17.6 Order of resolution — first in, first out
Declared actions resolve **first-declared, first-resolved.** A responding player **chooses where** in the queue their response goes:
- **Default placement:** a response goes **immediately ahead of the first opposing action that targets what it protects or targets** (a Substitution lands right before the attack aimed at its enabler); anything else goes at the end.
- **Move earlier / later** repositions one of your own actions a step at a time.
- Consequence: a negation placed **before** an attack negates it; the same negation placed **after** finds nothing left to negate.

### 17.7 What happens when a round resolves
1. Each retreated character whose controller still has a non-Retreated character is **shielded** for the whole round (§9.4).
2. Every declared action is **committed in queue order**: legality is **not** checked; costs are **paid softly** (the engine takes what's available — from the Pool and/or generic Chakra — and logs any **shortfall** as *"short N Chakra (trust mode — allowed)"* instead of blocking); once-per-turn bookkeeping is recorded; the action goes onto the engine's resolution stack.
3. The committed stack is flipped so the **first** queued action is on top, and they resolve **one by one, first to last.**
4. **Retreat collapse** is checked (§9.4); if it earns the attacker a second Combat and this was a Finalize Combat, the phase holds for a second Combat instead of advancing.
5. Queued Character Deck draws, defeat-triggered Mission checks, etc. are settled.
6. If this was **Finalize Phase**, the next phase begins. **Untap and Upkeep run automatically**, so a new turn lands on the **Draw Phase**; clicking **Draw** takes the card and moves on to **Main Phase 1** (the first player's skipped first draw passes straight through). Upkeep payments, poison/heal ticks and Untap-triggered Missions happen in that run.

### 17.8 What trust mode does not enforce
Not gated (advisory warnings only, where a strict rule would have applied): **which phase** you act in; **speed/priority**; **once-per-turn** limits; **pooled-vs-acted** exclusivity; **Style, Disabled, Retreated, summoning-sickness, target-side and Retreat-immunity-at-declaration** checks; **sufficient Chakra** at the moment of declaring; **Chakra-source placement** limits (one per turn, Main Phase) and the **Main-Phase-only** rule for pooling, Retreat, Return and playing Characters; Retreat's "not your only character", "not stunned" and "not already acted" conditions.
Still **enforced** even in trust mode (physical/state consistency): the card or unit **must exist**; Pool **capacity**; you can't pool more than you have **available**; you can't Consume a Character card for Chakra; a played Character needs **room on the board**; actions belong to the **owner** of the card or unit.

### 17.9 Strict mode
The engine can also run **strict mode** (full phase/priority/legality enforcement, MTG-style stack). It is the mode the engine's unit tests exercise and is not used in playtests. Its stack is last-in-first-out; the design rule in §5.2 (first in, first out with response insertion) is what trust mode implements.

---

## 18. Manual adjustments & deck tools **[Playtest]**

The build blends **Arena-style automation** with **Cockatrice-style hands-on play**.

### 18.1 Automated by the engine
Shuffling; the Draw Phase draw; deck-out damage; drawing (Draw button); **searching the deck** (choose a card → to hand → deck shuffles); **looking at the top X** (take a card to hand, or send it to the bottom); mulligans; Character Deck reveals and the D-Rank rule; **damage, healing and Pool calculation**; upkeep payment and Disabling; untapping; per-turn resets; defeat, Health loss, Reinforcement draws, Retaliation and Mission triggers; forced retreat collapse.

### 18.2 Hands-on (the players decide)
Which cards and abilities to use and against what; **which Chakra sources to tap** (and tap/untap by clicking); **discarding a card to place a Chakra source**; how to **split a cost** between Pool and generic Chakra; how much Chakra to move with Chakra Transfer; when to Retreat, Return, pool, and play Characters; when to resolve or finalize.

### 18.3 Manual corrections (every one is logged "(manual)")
On any character or token (either side): **HP −1/+1** (kept between 1 and max), **Deal 1 damage** (runs the *full* damage pipeline — prevention, defeat effects, Health loss), **Pool −1/+1**, **Toggle Disabled**, **Toggle Retreated.** Per player: **Health −1/+1**, **available Chakra −1/+1**, **untap a tapped source** (takes back the Chakra it made). Hand cards can be moved **to the discard pile, top of deck, or bottom of deck**; cards can be **returned from the discard pile to hand.** Corrections are meant to fix honest mistakes without stalling the game; the opponent sees each in the log.

---

## 19. Hidden information & remote play **[Playtest]**

- **Hosting:** one player **hosts** (seat **P1**), the other **joins** with a 5-letter room code (seat **P2**). Who goes first is a random coin flip independent of seat. The host's browser holds the authoritative game; the game ends if the host closes or refreshes. Connection is peer-to-peer (PeerJS/WebRTC via its free public broker) — strict networks may block it.
- **Perspective:** you always see **your board at the bottom** and your opponent's at the top, as if sitting across a table: your back row (Characters) nearest you, your front row (Tokens) facing the middle, mirrored for the opponent.
- **Hidden from your opponent:** the **contents of your hand** (both Hand Deck cards and drawn **Character cards**), **your Character Deck draws and reveals** (the choose-1-of-N screens), the **order/contents of both decks**, and your **face-down Missions.** They see only that you *have* N cards.
- **Public:** all boards, HP, Pools, Chakra sources (tapped/untapped) and available Chakra, Health, Terrain, face-up Missions, the discard and Consumed piles' sizes (discard contents are visible), declared actions (a card is revealed the moment it's declared), and the log.
- This is the **one deliberate departure** from SPEC.md's earlier "fully open" hotseat stance; local hotseat play (both boards on one screen) shows everything.

---

# PART IX — REFERENCE

## 20. Design defaults, engine simplifications & known gaps

### 20.1 Defaults chosen where the design was silent
- **First player:** coin flip *(placeholder)*.
- **Hand size:** unlimited *(placeholder)*.
- **Deck-out:** 3 Health damage *(placeholder)*.
- **Kakuzu:** revive HP is 1 (like Hidan's "stays at 1 HP"); the Style he loses per revive follows a fixed order — **Fire, Lightning, Wind, Earth** — rather than a player choice; if a lost Heart drops his Pool capacity below what's pooled, the excess is **lost**.
- **Deidara's Combine:** the player chooses which spiders to sacrifice when more than needed exist.
- **"Turn cycle":** a cycle ends at the start of the affected character's controller's own next turn.
- **Damage-modifier order** (as built): redirect adjustment → attacker bonuses (Rallying Words) → Banshō Ten'in's +1 → Fire vs Paper Body +1 → the target's reductions (Iron Skin, Paper Body, Iron-Forged Body, Sharingan Foresight; skipped by "cannot be reduced", and Iron Skin by Banshō) → the damage-prevention pool (skipped by "cannot be reduced" and Banshō). Floor 0 (Iron-Forged Body: floor 1).
- **Synergy discount allocation:** the board-wide discount (max −2) comes off the most expensive upkeep first.
- **Self Detonate:** the detonating Clay Spiders are destroyed (implied by "detonate"); the activating spider is always one of them.
- **Deidara's Combine / Self Detonate:** which spiders go is automatic — they're identical.
- **Yahiko Sacrifices Himself "would defeat it":** checked by simulating the waiting attack against the current board (after every reduction).

### 20.2 Automatic choices (no player prompt)
The rule is that the player makes every choice the rules give them (**[Updated]** — see §21 rulings 31–33). What's still automatic:
- **Kakuzu's Five Hearts:** the Style lost on each revive follows a fixed order (Fire, Lightning, Wind, Earth).
- **Squad Formation:** selects the first 3 characters (the redirect itself is a standing player choice).
- **Death is an Explosion (Version 2) / Kakuzu reviving Hidan:** the engine holds the dying character at 0 HP and **asks** the controller — a live prompt, not automatic — because damage can't pause mid-resolution for a Reactive activation.

### 20.3 Rules in SPEC.md the build does not yet model
- **Item cards** (not defined).
- **Played Jutsu/Assist cards and completed or failed Missions don't yet move to the discard pile** after they resolve (only a *replaced* Terrain or Mission does), and ongoing-effect Jutsu (Deploy Medic Corps) aren't shown in a separate "in play" area (§15.3).
- **Banshō Ten'in's "pull an enemy closer"** has no defined meaning on the 2-row board (§22).
- **Hidden info in the strict (local) engine** is not applied — local hotseat shows both hands by design; the networked build hides the opponent's hand from **both** host and guest.
- **Strict-mode stack is last-in-first-out**, not the designed first-in-first-out (§5.2).
- **The "Combat ability" timing for support abilities** is permissive: non-damaging Normal-speed abilities are accepted in Main **and** Combat.

---

## 21. Ruling log — everything that changed vs. SPEC.md

Rulings marked ✔ were made explicitly by the designer during the playtest-build sessions; the rest are engine corrections found while auditing the build against SPEC.md.

**Designer rulings**
1. ✔ **S-Rank starting character upkeep = 2**, so it is normally **Disabled turn 1** with no sources — **intentional for balance.**
2. ✔ **Chakra presentation:** a Chakra source is its own card symbol, placed like a land in Magic: discard a card → place the Chakra card → tapped/untapped to show use.
3. ✔ **Alternative costs are the player's choice** (pay from Pool vs. generic); no silent defaults; variable amounts (Chakra Transfer's X) are chosen by the player.
4. ✔ **Trust mode:** players handle timing and legality verbally; the engine only needs targets/effects; stack handled by players; a **Resolve Actions** button and a **Finalize Phase** button; declared actions editable until finalized (retarget, change ability); the opponent is prompted **only** if they have a meaningful legal response; manual adjustments and automated deck operations (search, look at top X, shuffle, bottom, draw, damage calculation).
5. ✔ **Resolution order:** first activated, first resolved; the responding player inserts responses at chosen points in the queue (replaces the MTG-style last-in-first-out stack).
6. ✔ **"Could they respond" check:** the opponent can target *anything at all* with an affordable activated ability or hand card (Pool or generic Chakra); multi-target needs only one valid target.
7. ✔ **Timing (abilities):** Normal-speed **damage-dealing** abilities → **Combat only**; **non-damaging** (support) Normal abilities → outside combat (Main).
8. ✔ **Passives:** a **Disabled** or **Retreated** character's triggered passives **do not trigger**, **except replacement-effect passives** (Five Hearts, Jashin's Blessing, Hollow Body).
9. ✔ **Timing (cards):** non-combat Normal-speed cards (Terrain, Missions, deck searches, Deploy Medic Corps…) **cannot** be played in Combat; **Attack-type** Normal Jutsu are **Combat-only**; a Normal card may be played in Combat only if its effect **alters the immediate combat step** and triggers immediately.
10. ✔ **Retreat collapse:** clearing a player's active characters in one combat step **forces their retreated characters out immediately** and grants the attacker a **second Combat** (unused attack actions only); forced out otherwise = no extra Combat.

**Designer rulings — playtest feedback session (Setup, economy, choices, visibility)**
21. ✔ **Setup:** pick a starting character with a **Details** view and an explicit **Confirm**; **Mulligan** is each player's independent choice, available until **they** confirm (confirming keeps the hand); the **first-player coin flip happens after both confirm** (SPEC §3's order).
22. ✔ **Draw Phase draw is a manual click**, not automatic (SPEC §4.3); it can be undone.
23. ✔ **Playing a character from hand is always free.** The tax is paid when **drawing** from the Character Deck, not when playing (SPEC §8).
24. ✔ **Character Deck Tax: 3 / 5 / 7 / 8, capped at 8.** Only a **paid manual draw** (your own Main Phase) raises it.
25. ✔ **Drawing from the Character Deck is a state-based action** — never on the stack, can't be responded to; its timing comes from its trigger (manual draw: your Main Phase; Reinforcement: the moment of the defeat, either player's turn).
26. ✔ **Reinforcement:** a **C-rank or higher** defeat offers an **optional** draw at your **current** tax (the tax doesn't rise). A **D-rank** defeat triggers nothing.
27. ✔ **Last C+ character defeated** (D-ranks on the board and in hand are ignored): if you hold a C+ character card you **must play one immediately** (free, any timing); otherwise you may take a **free** draw. Neither raises the tax. Replaces the Empty-Board Waiver.
28. ✔ **Field Intelligence:** the **opponent chooses** which 2 cards to reveal; the caster sees them.
29. ✔ **Hidden information:** in a 2-player game **neither** player sees the other's hand (the host used to).
30. ✔ **Only technique Jutsu need an enabling character** — Jutsu with an ability Type (Ninjutsu, Taijutsu, Bukijutsu, Genjutsu, Sealing). **Type: None** tactical cards (Field Intelligence, Incoming Mission Assignment, Battlefield Selection), Assist, Terrain and Mission cards don't.
31. ✔ **Player choice:** a card is the player's choice whenever it has an **alternative cost**, or an **additional or alternative effect that depends on spending a resource or meeting a condition** (Deidara's / Konan's charge spends, Iron Sand Wall's +X, Absorbed Vitality's X, Rampaging Charge's Straight/Bent and side). The engine always asks; it never spends or picks for you. **Set effects** (e.g. "look at the top 6") resolve as written.
32. ✔ **Look at the top X:** X is **fixed** when the card states a value with no indication of choice; **which** matching card you take **is** your choice.
33. ✔ **Selections the rules give you are yours:** which Mission a new one replaces at the limit, which character gets a Mission reward, which of several **tied** characters you pay Upkeep for, Squad Formation's redirect (a standing choice, Off by default).
34. ✔ **Every tracked resource is visible** — Clay Charges, Hearts, Shikigami Charges, absorbed Chakra, Curse target, cooldowns, pending effects… on the card (key ones) and in its details.
35. ✔ **Synergy discount is board-wide:** −1 upkeep for each character **past the first** sharing a Synergy tag, **capped at −2 total** (applies to the starting character's upkeep too). Two Akatsuki S-Ranks: 6 → 5; two S-Ranks + a C: 6 → 4. (SPEC §6.5.)
36. ✔ **Undo** exists for actions a player can't fix by hand (draws, mulligans, Character Deck picks, reveals, choices); **Restart** keeps the network connection; **trust mode** can be toggled from the sidebar. **[Playtest]** In trust mode a character, **Mission or Terrain** put into play by mistake can be dragged back to hand (or use its **Return to hand** button); it returns as a fresh card — its progress, damage and tracked resources reset.
45. ✔ **Akatsuki Hideout costs 2 Chakra** (was 0). (SPEC §13c.)

**Engine completions — every "simplified" card effect now works as printed**
37. **Damage knows its source** (the attacking unit and the ability's Type/Style/speed), which makes these apply: **Iron Skin** (−2 physical / −1 elemental through the next turn), **Paper Body** (−2 Taijutsu, +1 Fire), **Iron-Forged Body** (−1 Taijutsu, min 1), **Sharingan Foresight** (−1 vs Quick), **Rallying Words** (+1 on each ally's next attack), **Banshō Ten'in** (+1 for the rest of the turn, can't be protected).
38. **Cost modifiers:** +1 Chakra to target a **transformed Kisame**; **Uchiha Prodigy** −1 on Quick Jutsu cards; **Bingo Book C** −2 on the killer's next ability.
39. **Kills and damage are tracked:** Hidan's Curse needs an enemy he has damaged, and his own side can't target him while Cursing; **Patchwork Threads** needs a kill that turn and takes an elemental Style (your choice); **Tsukuyomi**'s ≤6-damage limit; **Water Prison** ends when Kisame is hit.
40. **Redirects move the attack** (every part of it) instead of cancelling it: Puppet Shell Guard (onto Hiruko, −2), Mechanized Guard (onto Asura, −1), Chakra Absorption (onto Preta, to 0, +1 Chakra), Absorb Impact (onto Preta, −1), Yahiko Sacrifices Himself (onto Yahiko, only vs a hit that would defeat the ally).
41. **Pain:** Almighty Push must be the first Path ability that turn, locks the other Paths until it lands and Deva for 3 turn cycles; Path Beasts go on a 2-Upkeep cooldown when defeated; **Rinnegan Reservoir** lets any Path spend any Path's Pool; Soul Rip draws on a kill; Rampaging Charge's **Bent** path.
42. **Deidara:** **Death is an Explosion** (both versions) and the **Clay Spider** token's **Self Detonate** / **Combine**. **Sasori** enters with his **Third Kazekage**. **Kakuzu can revive Hidan** at 3 HP (you're asked). **Zetsu Golem Regeneration**; **Spore Technique** blocks the target's own negations (Crow Clone, Paper Clone, Shinra Tensei V2, Substitution cards).
43. **Paying from a Pool:** abilities can be paid from the character's Pool (you choose the split when there's a real choice); "entire Pool" costs spend the whole Pool; Pool-only costs are handled automatically.
44. **Bingo Book S**'s full stun also covers Pain's Path tokens and Sasori's Kazekage.

**Deck-size ruling**
20. ✔ **Hand Deck maximum is 80 cards** (previously fixed at 40). (The build doesn't enforce any deck-size limit today; it only uses the fixed preset decks.)
46. ✔ **Hand Deck minimum is 50 cards** (was 40), so a legal Hand Deck is 50–80 cards. The preset Akatsuki Hand Deck is 43 cards (40 + 3× Medical Chakra Infusion), still below the new minimum. (SPEC §2.)
47. ✔ **New card: Medical Chakra Infusion** (Style: None, Type: Ninjutsu, 1 Chakra): heal 2 HP to one of your characters, capped at max HP. **3 copies** added to the preset Hand Deck. (SPEC §13b.)
48. ✔ **New card: Chakra Suppression** (Style: None, Quick Technique, **Type: Sealing**, 2 Chakra): target enemy character can't be pooled into through its controller's next turn. **3 copies** added; the preset Hand Deck is now **46** cards. **Sealing** is a new narrow Type coined for this card (like Bukijutsu), not retrofitted onto existing cards. (SPEC §6.2, §6.8, §13b.)
49. ✔ **New card: Fire Style: Fireball Jutsu** (Style: Fire, Type: Ninjutsu, 4 Chakra / 3 from the enabler's Pool): 3 damage to a target and 1 to each of up to 2 characters adjacent to it, your choice. **1 copy** added; the preset Hand Deck is now **47** cards. (SPEC §13b.)
50. ✔ **Cards only see events once they're in play:** Conditions, counters and triggers start counting when the card enters play, unless its text says it looks back. (SPEC §0.)
51. ✔ **New Mission: Emergency Relief** (0 Chakra). Condition: lose 2 of your own characters (any rank, any cause) after it's played. Reward: an **immediate free Character Deck draw** (look at 2, keep 1) — its own trigger, not a Reinforcement — that doesn't raise the tax. **3 copies** added; the preset Hand Deck is now **50** cards, exactly the minimum. (SPEC §13a.)
52. ✔ **Pain's full defeat is a character defeat:** when his last Path token falls, Pain of the Six Paths is defeated as an **S-Rank character** — his controller loses 7 Health, it triggers Reinforcement and Retaliation, counts for Missions (Emergency Relief, the opponent's Bingo Book S), and the last Path's attacker gets kill credit. Individual Path tokens are token losses only. While any Path stands, Pain counts as a C+ character in play for the "last C+" Reinforcement rule. *(Previously none of this happened — the build treated his Paths as unrelated tokens.)* (SPEC §13, §8, §11.)
53. ✔ **Bingo Book: Threat Level A reworded** for the draw-time tax: "Your next Character Deck draw you pay for costs 2 less. The next character you play from hand gains Ambush." The −2 goes to the next **paid** draw (manual or an accepted paid Reinforcement; a free draw doesn't use it up); Ambush goes to the next character **played**, which may be a different character. Behaviour unchanged — this confirms how the build already worked. (SPEC §13a.)
54. ✔ **Missions are played face down by default** (was face up, with the Bingo Books as the exception), revealed when their Condition is met; one that stays in play afterwards (Squad Formation) stays face up. A card can say it's played face up. The Bingo Books' "Can be played face down; reveal it once its Condition is met" line was removed as redundant. All 7 current Missions now enter face down. (SPEC §10b.)

**Engine corrections against the spec**
11. **Once-per-turn tracking resets every turn for both players** (previously it never reset, then reset only for the owner).
12. **Generic Chakra is lost at end of turn for both players.**
13. **Retreated characters are immune to blanket/untargeted damage** (previously only targeting was blocked), except already-ongoing effects.
14. **Upkeep, Retreat, pooling, Reinforcement Tax, Empty-Board Waiver, once-per-turn, pool-XOR-act, target legality, Style enabling, and Disabled/Retreated enabling** are now enforced in strict mode and covered by tests.
15. **Starting character sickness** for the second player lasts through **turn 2**.
16. **Setup's two unchosen Character Deck cards are shuffled back**, not bottomed.
17. **Amegakure Civilian Rebel's Shinobi Strike** (1 damage, 2 if Yahiko is in play) implemented.
18. **Deploy Medic Corps** can now target a Retreated character (explicit exception).
19. **Yahiko's Inspiring Leader** doesn't apply while its source is Disabled/Retreated.

**Earlier rule revisions recorded in the design docs** (already reflected above): no automatic base Chakra income (Chakra only from tapped sources); Chakra sources are separate Chakra cards with a per-player **Consumed pile**; "Instant" renamed **Quick Technique**, and **Reactive Technique** added; the every-3rd-turn Character Deck draw was removed; escalating **Reinforcement Tax** and the **Empty-Board Waiver** (both since replaced — rulings 23–27); unpaid upkeep **Disables** instead of defeating; **Retreat** added; **Pool restriction** tightened (a Pool only pays through its own character — no "styleless" exception); **Assist** cards added; **D Rank** added with its draw rule.

---

## 22. Open questions

1. **§4.5 vs §4.4:** are non-damaging Normal-speed abilities allowed *during* Combat as well as Main? (The build allows both.)
2. **Banshō Ten'in's "pull an enemy closer":** what does it mean on the 2-row board? (Its +1 damage / can't-be-protected parts work; the pull does nothing yet.)
3. **Damage-modifier order** (§20.1) — designer sign-off on the stacking order as built.
4. **Whether Jutsu cards should sit in an "in play" area** while an ongoing effect runs (SPEC §10c says yes; not built).
5. **Per-card open questions** flagged in the character log are collected in Appendix B under each card.

*Resolved this session:* Bingo Book A's wording (ruling 53), upkeep ties (you choose — ruling 33), the Hidan ⇄ Kakuzu revival and Hidan's Curse condition, damage attribution, the damage-modifier system, and true redirects (rulings 37–42).

---

# APPENDIX A — FULL CARD TEXTS

Verbatim from `design/SPEC.md` §13–§13c (section numbers in these texts refer to SPEC.md; the equivalent rules are in Parts I–VII above). Where card text and a general rule disagree, the card wins (§0.2).

## A.1 Character cards (Akatsuki deck)

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
  6 Path tokens are defeated — that's a full S-Rank character defeat
  (Health loss, Reinforcement, Missions). A single Path being defeated
  is a token loss, not a character loss. While any Path stands, Pain is
  a C-Rank-or-higher character in play (§8).
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

## A.2 Mission cards

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
Condition: Defeat an S Rank character.
Reward: Draw from your Character Deck as normal, but look at the top 4
instead of the top 2, Your next character played cannot use any
abilities the turn it enters, Draw a card.

Bingo Book: Threat Level A — 0 Chakra
Condition: Defeat an A Rank character.
Reward: Your next Character Deck draw you pay for costs 2 less. The
next character you play from hand gains Ambush.

Bingo Book: Threat Level B — 0 Chakra
Condition: Defeat a B Rank character.
Reward: Add 3 Chakra to a character's Chakra Pool, Draw a card, The next
time you place a Chakra source, you may place 1 additional one that
turn (the additional source still requires Consuming a card, as
normal).

Bingo Book: Threat Level C — 0 Chakra
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

Emergency Relief — 0 Chakra
Condition: You have lost 2 of your own characters (any Rank, any cause)
since this Mission was played.
Reward: Immediately draw from your Character Deck for free (look at 2,
keep 1, §8). This doesn't increase the Character Deck tax.

---

## A.3 Jutsu & Assist cards

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

**Medical Chakra Infusion** — Style: None, Type: Ninjutsu
Cost: 1 Chakra. *(full nuance: design/CHARACTER_LOG.md)*
Effect: Heal 2 HP to one of your characters (cannot exceed max HP).

**Chakra Suppression** — Style: None, Quick Technique, Type: Sealing
Cost: 2 Chakra. *(full nuance: design/CHARACTER_LOG.md)*
Effect: Target enemy character cannot pool Chakra into itself until its
controller's next turn.

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

**Fire Style: Fireball Jutsu** — Style: Fire, Type: Ninjutsu
Cost: 4 Chakra (3 if paid from the enabling character's own Chakra
Pool). *(full nuance: design/CHARACTER_LOG.md)*
Effect: Deal 3 damage to a character and 1 damage to each character
adjacent to it, up to 2 other characters (your choice which 2 adjacent
to the target, §9).

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

## A.4 Terrain cards

**Akatsuki Hideout** — Synergy: Akatsuki, 2 Chakra. *(full nuance:
design/CHARACTER_LOG.md)*
Effect: Akatsuki-Synergy characters you control have their Upkeep
(§6.5) reduced by 1 (minimum 0).

---

---

# APPENDIX B — CHARACTER LOG: THE NUANCE BEHIND EACH CARD

**Purpose:** the character cards in `design/SPEC.md` §13 (Appendix A here) (and, as of the
Jutsu card section below, the Jutsu cards in §13b) are kept as concise
as possible while remaining fully rules-legal on their own. This
document is their companion — full explanatory context, worked examples,
edge cases, and flagged open questions for every card/ability that has
real nuance. Simple effects with no meaningful ambiguity (a plain "deal
X damage" with no conditions) aren't listed here at all — the card text
is the whole story for those.

This is a living document — when an ability with an entry here gets
edited, update the entry too, the same way SPEC.md itself is kept current
(unlike the one-off Word/Markdown snapshot docs).

---

## Kakuzu

### Five Hearts
Starting at 5 Hearts, Kakuzu has 4 "extra lives": each time he'd
otherwise be defeated with more than 1 Heart left, he loses a Heart and a
Style instead of dying, and Chakra Pool Capacity drops by 2 (from the
(Hearts−1)×2 formula — 8→6→4→2→0 as Hearts go 5→4→3→2→1). Losing his
last Heart (reaching 0) is the only way to truly defeat him. Style loss
has no specified order — assume the controller chooses which of his
remaining Styles to drop each time.
**Open question:** the card doesn't say whether "revives" means
re-entering with full HP (like a character freshly entering play) or
something else — treat it as a fresh entry (full HP, new summoning
sickness) until stated otherwise.

### Iron Skin
"Physical" and "elemental" aren't formally defined terms elsewhere in
SPEC.md — read them as shorthand for Type: Taijutsu (physical) and Type:
Ninjutsu-with-an-elemental-Style (elemental); a styleless Ninjutsu
ability isn't clearly covered by either half of this line as currently
worded. Genjutsu, at least, is now settled by §9's "physical blocking
vs. Genjutsu" rule (added for Sasori's Iron Sand Wall/Puppet Shell
Guard) — Iron Skin doesn't reduce Genjutsu damage, consistent with that
rule even though Iron Skin predates it. "Next turn cycle" likewise isn't
a formally defined duration (§6.9's default is "until end of turn,"
which this ability explicitly overrides) — treat it as lasting through
the end of the opponent's very next turn.

### Ultimate — Patchwork Threads
The cost/effect math simplifies to one operative rule: **Kakuzu ends the
activation with exactly 2 Chakra pooled**, regardless of how much was in
his Pool when he activated it (spend it all, then the effect refunds 2).
The card states only that final-state rule now, having dropped the
"spend all → gain +2" arithmetic that produces it. The Style gained must
be one the defeated character actually has and Kakuzu doesn't — if the
defeated character's Styles are a subset of Kakuzu's already, this
clause simply does nothing.

---

## Hidan

### Jashin's Blessing
There are two independent survival mechanisms here, and they don't
stack: the first-defeat safety net (stays at 1 HP) is a one-time,
always-available effect; Kakuzu's revival (to 3 HP) only helps on a
defeat *after* the free one has already been used, and only if Kakuzu is
in play, un-Disabled, un-Retreated, and at full Chakra Pool when it
matters. If neither is available on a given lethal hit, Hidan is
defeated normally. The HP regen (1, or 2 while his Ultimate is active)
is a separate, recurring End Phase trigger, unrelated to either survival
clause.

### Ultimate — Curse Technique: Death Controlling Possessed Blood
The mirrored-damage clause ("all damage Hidan takes is also dealt to his
Cursed target") applies to damage from *any* source while the Curse is
active, not just Hidan's own attacks — this is what makes self-inflicted
Triple Scythe Sweep a real combo piece: Hidan hits himself, the mirror
clause deals that same damage to the Cursed enemy too, on top of the
ability's own +1 bonus on self-inflicted hits. The 3 HP self-damage floor
means Hidan can never trigger his own first-defeat safety net (Jashin's
Blessing) through self-damage under this Ultimate — that path is
deliberately closed off. Blocking self-targeting on the activation turn
specifically prevents an immediate lethal-mirror opening play. "Ends when
that enemy is defeated" just clears the Curse — Hidan may immediately
activate it again on a new target if he still has Chakra, since nothing
here is once-per-turn beyond the ability's own normal cap (§9).

---

## Pain of the Six Paths

### Six Paths (trait)
Two things worth calling out that aren't obvious from the card text
alone:
- The "Tokens have no Chakra Pool" default (§10) is explicitly broken
  here — this is currently the *only* card in the game where each of
  several individual Tokens has its own separately-tracked Pool (Zetsu's
  Clones, by contrast, share one single pool with Zetsu himself rather
  than each banking their own — a genuinely different structure, see
  §Zetsu above).
- Despite functioning exactly like characters (their own HP, abilities,
  Ultimate), the Path tokens are still Tokens by card type, which means
  under the 2-row board system (§9) **they occupy the front row**, not
  the back row — this is what lets all 6 exist simultaneously without
  ever threatening the 5-character back-row limit (§6.5).

### Rinnegan Reservoir (trait)
**Not** a merged/combined pool — each Path still pools Chakra
individually, into its own separately-capped Pool, exactly as before
this trait was added. What changed is purely *access*: any Path's
ability may now spend Chakra sitting in any other Path's Pool, not just
its own. So Deva could, for instance, activate an ability using Chakra
that was pooled into Naraka specifically — but Naraka's Pool Capacity
(2) is still its own hard cap, unaffected by how much is banked
elsewhere. This preserves each Path's own bookkeeping and Deva's
Ultimate's original cost/condition (both still reference "Deva Path's
own Pool" specifically, unaffected by this trait) while removing the
old restriction that a Path could only use its own banked Chakra or the
generic pool — cross-Path access is the entire scope of the change.

### Deva Path — Shinra Tensei, V2
Deliberately narrower than its Asura/Preta sibling Reactive abilities
(Mechanized Guard, Chakra Absorption, Absorb Impact), which all protect
"any Path" — this one only fires for attacks aimed at Deva Path
specifically. Deva has no way to intercept an attack aimed at one of his
other five Paths.

### Deva Path — Banshō Ten'in
**Open question:** "pull an enemy character closer" was written before
the 2-row board rework (§9) and has never been revisited since. Under
the old single-row model this just meant sliding the target down the
row; under the current front-row/back-row grid it's unclear what
"closer" even means spatially (does it change the target's row? its
column? does it only make sense against a front-row Token?). Treat this
ability's movement clause as unresolved until it's explicitly redesigned
for the 2-row board — the damage and rest-of-turn clauses are unaffected
and still fully functional on their own.

### Deva Path — Ultimate: Almighty Push
Full sequence, since this has the most moving parts of any ability in
the game:
1. **Activation turn:** condition-checked (Deva's Pool must be full;
   must be the very first Path ability used by *any* Path that turn,
   Deva included). Cost paid (6 Chakra + Deva's entire current Pool).
   From this moment: no Path other than Deva may use any ability, and
   this lockout persists into and through the controller's next turn,
   ending only once the delayed damage actually resolves. Separately,
   Deva Path itself is locked out of *all* of its own abilities for 3
   turn cycles (counted in the controller's own Upkeep Phases, §4.2) —
   this clock runs independently of the other-Paths lockout and doesn't
   end early just because the delayed damage has resolved.
2. **Next turn, End Phase:** the delayed effect fires — 8 damage to all
   enemy units (Characters and Tokens both). This is a blanket effect
   that targets no one (§9's targeting-vs-affected distinction) — it
   cannot be stopped by any target-negation effect (including, notably,
   the opponent's own equivalent Deva-Path-style protections, if they're
   playing Pain in the mirror match) since there's no target to strip.
   Ordinary damage prevention/reduction (e.g. Iron Skin) still works
   normally against it, since that's a different kind of interaction
   than target-negation.

### Asura Path — Mechanized Guard
Redirect-and-reduce, not redirect-and-negate: Asura still takes the
damage, just 1 less (min 0) — contrast with Deva's Shinra Tensei V2,
which fully negates targeting rather than redirecting.

### Preta Path — Chakra Absorption & Absorb Impact
These are the Ninjutsu/Taijutsu-split pair: Chakra Absorption only
intercepts Ninjutsu attacks and reduces them to 0 (full negation of the
damage number, not the targeting itself — the attack still "hits," it
just deals 0), while Absorb Impact only intercepts Taijutsu attacks and
merely reduces by 1 (same partial-reduction pattern as Asura's
Mechanized Guard). Both are targeted-only (§9) — an untargeted/blanket
attack can't be redirected by either.

### Naraka Path — King of Hell's Judgment / Outer Path: Samsara of Heavenly Life Technique
Both are delayed-and-cancellable in the same pattern: the effect is
scheduled for the controller's next Upkeep Phase, and is cancelled
outright if Naraka Path itself dies before that Upkeep arrives. Nothing
else (Naraka being Disabled, Retreated, etc. — n/a for a Token anyway)
cancels either one; only Naraka's defeat does.

### Path Beast Tokens
Two different ways a Beast can leave play, with different consequences:
- **Defeated in combat** → goes on a 2-cycle cooldown (2 of its
  controller's own Upkeep Phases) before Animal Path can resummon it.
- **Fizzled because Animal Path died** → no cooldown at all. If Animal
  Path comes back (e.g. via Naraka Path's Outer Path: Samsara of
  Heavenly Life Technique), Summon can
  immediately recreate any Beast that fizzled this way, even the same
  turn Animal Path returns (subject to its own summoning sickness for
  non-damaging use, §6.6).
Keeping HP at a flat 4 across all three is a deliberate design choice —
they're meant to be cheap, disposable, and worth losing, not investments
worth protecting.

### War Rhino — Rampaging Charge
Worked examples of the two path shapes:
- **Straight, starting in the front row:** primary target is a front-row
  Token; hits 2 more Tokens continuing left or right in that same front
  row. (Equivalent to the ability's original pre-2-row design.)
- **Straight, starting in the back row:** primary target is a back-row
  Character; hits 2 more Characters continuing left or right in the back
  row.
- **Bent:** primary target must be a front-row Token; the 2nd hit is
  whatever Character is aligned behind it in the back row (via the
  column-pairing rule, §9); the 3rd hit is that Character's left or
  right neighbor in the back row (attacker's choice of side).
In all cases, damage is 3 / 2 / 1 down the path in order, and the path
simply stops early (dealing less total damage) if it runs off the edge
of a row or hits an empty/unpaired slot before all 3 hits are assigned.

### Giant Drill-Beaked Bird — Evasive
Only checks against Normal-speed (Sorcery-equivalent) abilities — Quick
Technique and Reactive Technique attacks always connect. This keeps the
Bird from being a hard answer to instant-speed removal while still
giving it real staying power against telegraphed, Main-Phase/Combat-
Phase attacks.

---

## Deidara

### Clay Spider Token — Self Detonate
"Choose any number of your Clay Spider tokens and 1 target" already
implies all chosen spiders must share that one target within a single
activation — there's no way to split one activation across multiple
targets. If you want to hit two different targets, that's two separate
activations (each its own 1-Chakra cost), not one activation with a
split effect.

### Ultimate — C3, Shi-Suri / general "Pool must be full" pattern
This card (and Deva Path's Ultimate, and both Forbidden Technique
versions below) use the same recurring pattern: **"Chakra Pool must be
full to activate" is a condition checked at activation, separate from
whatever Chakra cost is then paid** — the ability can still spend some
or all of that same Pool as part of its cost immediately after the
full-Pool check passes. It's a gate on *when* you're allowed to use the
ability, not a claim that the Pool stays full through resolution.

### Forbidden Technique — Death is an Explosion
Both versions require the Pool to be full to activate (same pattern as
above) and then spend the entire Pool as part of the cost — so the true
total cost is the printed Chakra number *plus* whatever Deidara's Pool
Capacity currently is (e.g. at Pool Capacity 3: Version 1 costs 5+3=8
total Chakra-equivalent, Version 2 costs 6+3=9). Version 2's trigger
("if Deidara's HP would be reduced to 0 or lower, activate this
instead") is a replacement effect on the game's default lethal-damage
rule — it doesn't save Deidara from dying (he still dies either way,
per the last line of both versions), it just lets him convert what would
otherwise be a quiet defeat into one final Forbidden-Technique alpha
strike on the way out.

---

## Kisame

### Samehada Fusion
The "6 Chakra absorbed" threshold is tracked via the **Absorb** effects
on Samehada Strike and Samehada Strike Evolved below — using either
ability's Absorb clause is what accumulates toward this trait's
transformation trigger; there's no separate, standalone way to "absorb"
Chakra. Exit is checked two different ways (whichever comes first): a
combat-damage threshold (≥7 damage taken while transformed) or a
resource-based check at Upkeep (Pool ≤3) — these aren't mutually
exclusive triggers, just two independent conditions that both end the
same state.

### Samehada Strike / Samehada Strike Evolved
Both now use the formal **Absorb X** keyword (§6.8b) — this is the card
pair whose repeated pattern the keyword was formalized from, after
Zetsu's Sinister Whisper/Clone Strike converged on the exact same
wording independently. "Absorb" on both of these is the mechanic that
feeds Samehada Fusion's 6-Chakra transformation threshold (see above) —
it's a running, tracked total across activations of either ability, not
a one-time flag.

### Water Style: Water Prison Jutsu
"Cannot use abilities that target a character" specifically means
*targeted* abilities are blocked — per §9's targeting-vs-affected
distinction, the imprisoned character could still be the source of a
blanket/untargeted effect if one of its abilities happened to have that
shape (none currently in the Akatsuki deck do, but the restriction as
worded wouldn't stop one).

### Water Style: Super Shark Bomb Jutsu
Worked example: target has 6 Chakra pooled → this deals 1 (base) + 6
(bonus, 1 per pooled Chakra on the target) = 7 damage, then the target
loses 7÷2 = 3 (rounded down) of its pooled Chakra. The damage-scaling
clause and the Chakra-drain clause both key off the target's pooled
Chakra, but at two different moments — the bonus damage uses the pool
*before* this ability resolves; the drain amount is calculated from the
*total damage dealt* (base + bonus combined), not from the pool amount
directly.

---

## Itachi

### Passive — Sharingan Foresight
Carries no Type (Ninjutsu/Taijutsu/Genjutsu) field — it's a perception-
based reaction, not a cast technique, so it doesn't cleanly fit any of
the three (§6.8's guidance to leave Type unset rather than force a bad
fit).

### Genjutsu: Mind Prison
This stun is broader than the generic Disabled state (§6.5a) — Disabled
only blocks *acting*, but a Disabled character's stats can still be read
by other effects and it can still be targeted/pooled into normally by
its own controller in some contexts. Mind Prison's stun additionally and
explicitly blocks Chakra pooling and any Jutsu card plays that the
stunned character would otherwise enable, on top of blocking its own
abilities. "Once per individual character, ever" is a permanent,
whole-game tracked restriction on the *target* (not on Itachi, and not
reset each turn like the normal once-per-turn ability cap, §9) — once
Itachi has used Mind Prison on a given enemy character, he can never use
it on that same character again for the rest of the game, even if that
character leaves and re-enters play.

### Crow Clone
Ties directly into §9's negating-a-target timing model — this is a
self-directed target-negation Reactive Technique, triggered after an
opponent's targeted ability has already fully activated (cost paid,
target identified) but before it resolves. "Any targeting" means it
works against *any* targeted ability aimed at Itachi, not just
damage-dealing ones. Like Mind Prison, the "one time per character
targeting him" restriction is permanent and per-attacking-character,
tracked for the whole game, not per-turn.

### Ultimate — Amaterasu
"Damage cannot be reduced" is a flat immunity to *any* reduction or
prevention effect against this specific ability's damage — stronger
than the target-negation protections most other cards rely on (Deva
Path's V2, Preta's redirects, etc. all work by intercepting or
redirecting a target, not by reducing an already-locked-in damage
number; none of them would stop Amaterasu even if they otherwise could,
since this ability explicitly overrides that entire category of
response). Total damage across the full sequence is 3 (immediate) + 2 +
2 (at your next two Upkeeps) = 7. **Open question:** the card doesn't
say what happens to the remaining scheduled ticks if the target is
already defeated before a later Upkeep trigger — treat unresolved ticks
against a dead target as simply not happening (nothing to deal damage
to) rather than redirecting anywhere.

### Forbidden Technique — Mangekyō Sharingan: Tsukuyomi - Infinite Agony
Two stacked conditions on the target, both of which must hold at
activation: (1) it must currently be affected by Mind Prison — meaning
Itachi must have already spent a Mind Prison activation on this exact
character (and, per Mind Prison's own "once ever" restriction, can never
do so again on them after this), and (2) it must not have dealt more
than 6 damage to Itachi across the whole game so far — a permanent,
cumulative, whole-game damage tracker on that specific enemy character,
not a per-turn or per-encounter check.

---

## Konan

*This whole card is a fresh assistant draft — treat every number and
interaction below as provisional until it's been reviewed.*

### Paper Body
A single trait carries both a resistance and a weakness, and they can
both apply to the same hit if an attack is somehow both Taijutsu and
Fire-Style at once (not currently possible with any existing ability in
the game, but the trait doesn't explicitly forbid it) — as written,
they'd stack: −2 then +2 nets to the same original damage. The Fire
weakness has no "instead" qualifier tying it to Taijutsu, so it applies
to *any* Fire Style attack regardless of Type (Ninjutsu or Taijutsu).

### Fold Shikigami / Paper Bomb Tag / Paper Clone
Fold Shikigami generates the Shikigami Charge resource (with its own
per-turn cap, separate from and not shared with any other ability's
cap); Paper Bomb Tag optionally spends one for a bigger hit — both
mirror Deidara's Clay Charge pattern directly. Paper Clone is different
from both: its cost is **2 Chakra plus 2 Shikigami Charges together**,
not a substitution — both parts of the cost must be paid to activate it
at all (§6.8a's colon rule: the full cost, both parts, must be payable
before the ability can even be activated).

**Balance note:** requiring the Charges *in addition to* Chakra (rather
than as an alternate payment) is the current lever holding Paper Clone
to A-rank power — it can only be used on turns Konan has actually banked
2 Shikigami Charges in advance, on top of the Chakra. No once-per-turn
cap was added on top of that, since the general once-per-turn ability
limit (§9) already applies to it by default — unlike Crow Clone, it
carries no *override* text restricting it further (e.g. "once per
character, ever"), so it can still be used again on a later turn against
the same or a different attacker.

### The Wind/Earth/Water/Yang Styles tags
Konan currently has **no abilities of her own** in Wind, Earth, Water,
or Yang — these Styles are listed purely so she can serve as the
enabling character for matching Jutsu cards played from hand (§5.3's
Style-affinity rule). This mirrors the canon idea of her rare
multi-nature affinity without yet committing to specific new character
abilities in those Styles — a natural place to expand her kit later if
the designer wants dedicated Wind/Earth/Water/Yang abilities rather than
just hand-card enablement.

### Ultimate — Paper Person of God Technique
Same "Pool must be full to activate, then may spend it" pattern used by
Deidara's Ultimate (see above) — the full-Pool check happens at
activation, not through resolution. Two separate hits, on two different
clocks:
- **Immediate:** 3 damage to all enemy units, resolves right away as
  part of activation — this part is locked in the moment it resolves and
  can't later be cancelled by anything happening to Konan.
- **Delayed:** a second, independent 3 damage to all enemy units,
  scheduled for the End Phase of the *opponent's* next turn — sooner
  than "your own next turn" would be, since the opponent's turn comes
  first. This half is cancelled if Konan is defeated any time before it
  resolves (mirroring Naraka Path's King of Hell's Judgment/Outer Path:
  Samsara of Heavenly Life Technique pattern) — representing canon's
  "requires significant
  preparation time," and giving the opponent a real counterplay window
  (kill Konan to stop the second hit) that didn't exist before.
Both hits are blanket effects (target no one) — neither can be stopped
by target-negation (§9), though ordinary damage prevention/reduction
still applies normally to each independently.

---

## Sasori

*This whole card is a fresh assistant draft — treat every number and
interaction below as provisional until it's been reviewed. History:
originally a single character with a Shell/Core HP split, then reworked
into a 3-token Pain-style structure, then reworked again into the
current form: a single transforming unit (Hiruko → Hollow Body) plus one
separate, simultaneous companion token (Third Kazekage).*

### Puppet Shell: Hiruko (trait — the transformation)
This is a defeat-instead-of-defeat mechanic in the same family as
Kakuzu's Five Hearts (§Kakuzu above): reaching 0 HP as Hiruko doesn't
defeat Sasori, it transforms him. Like a Heart loss, **this transform
trigger is not treated as a "defeat" event** — it won't trigger an
opponent's on-defeat effects (e.g. Kakuzu's own Ultimate, "whenever
Kakuzu defeats any shinobi") the way actually killing a character would,
because Sasori isn't being defeated at that moment, just changing form.
Hollow Body enters at its own full HP/Pool (not a continuation of
whatever damage Hiruko had taken) and with summoning sickness (§6.6) —
an explicit ruling, since the alternative (letting Hollow Body act
immediately, treating this as pure narrative continuation rather than a
fresh entry) was also defensible; summoning sickness was chosen as the
safer default, consistent with how every other "enters/re-enters play"
moment in the game works (Retreat's return, Naraka Path's Outer Path:
Samsara of Heavenly Life Technique, a fresh character played from the
Character Deck).

Only Hollow Body's defeat is a true defeat of Sasori — there's no third
stage beyond it in this draft.

**Balance note:** the previous 3-Puppet draft required 15 total HP
spread across 3 independently-targetable pieces to fully defeat Sasori.
This version only requires 6 (Hiruko) + 4 (Hollow Body) = 10 total HP,
and it's strictly sequential (no way to split damage across both stages
at once, since Hollow Body doesn't exist until Hiruko falls) — a
meaningfully easier kill than either the 3-Puppet draft or a flat
single-HP-pool A-rank character. Worth a balance look; HP wasn't
adjusted when this rework happened since the user didn't ask for a
rebalance pass yet.

### Chakra Strings: Third Kazekage (trait)
Third Kazekage is a **normal Token** (§10) — not a Pain-style exception
— so unlike Hiruko/Hollow Body (which are Sasori's own Character
stats) or Pain's Path tokens, it has no personal Chakra Pool of its own;
its abilities are paid straight from the generic pool (§5.3), the same
as Deidara's Clay Spiders or Pain's Path Beast tokens. It occupies the
front row (§9) like any Token, independent of whichever row/state
Sasori's own Hiruko/Hollow Body form is in. Its own defeat has **no
effect** on Sasori's HP, current form, or survival — it's a companion,
not a life total contributor. Conversely, it fizzles when Sasori is
truly defeated (Hollow Body falls) — the puppeteer's death silences the
strings.

### Hiruko — Puppet Shell Guard
Redirect-and-reduce, the same pattern as Asura Path's Mechanized Guard
and Preta Path's Absorb Impact (§Pain of the Six Paths above) — Hiruko
takes the redirected damage, just 2 less (min 0). Only protects Third
Kazekage specifically (not a broader "any Puppet" scope, since Hiruko
*is* Sasori right now, not a separate ally needing its own protection)
— and only while Sasori is still in Hiruko form; once he's transformed
into Hollow Body, this ability is gone (Hollow Body has its own,
different ability list) and Third Kazekage loses this protection.
Targeted-only (§9), and explicitly Ninjutsu/Taijutsu-only per §9's
"physical blocking vs. Genjutsu" rule — a Genjutsu attack aimed at Third
Kazekage can't be redirected onto Hiruko this way.

### Third Kazekage — Iron Sand Wall
Unlike Preta Path's split pair (Chakra Absorption for Ninjutsu only,
Absorb Impact for Taijutsu only, §Pain of the Six Paths above), this is
a single ability covering **both** Types at once — a deliberate
broadening, not an oversight. It now protects **any friendly unit**, not
just Third Kazekage itself.

Mechanically, this is a straight damage-reduction, not a redirect — the
originally targeted friendly unit still takes the (reduced) hit; the
attack doesn't get rerouted onto Third Kazekage the way Hiruko's Puppet
Shell Guard, Asura Path's Mechanized Guard, or the Pain-deck's Absorb
abilities all work. That makes it meaningfully different in kind from
every other defensive ability on this card or Pain's — those all move
the damage onto the defender; this one shrinks the damage where it
already is. Since it's not a redirect, it doesn't require Third Kazekage
to survive taking anything — it only requires Third Kazekage to still be
in play and able to act (not Disabled, Retreated, etc.) to activate it
at all.

**Scaling cost (3+X Chakra):** the base 3 Chakra buys a flat -2
reduction; X is chosen at activation as additional Chakra spent on top
of the base 3, 1-for-1 boosting the reduction by that same amount, capped
at X=4 (so the extra portion alone can range 0-4). Worked range: 3
Chakra total → -2 damage; 7 Chakra total (3+4) → -6 damage, the maximum.
Since this is paid as part of the ability's single cost (§6.8a's colon
rule — the whole cost, base plus however much of X you're committing to,
must be payable before the ability activates at all), X has to be
decided and the full total paid upfront, not scaled up after the fact
once damage is known. This also means Sasori's controller has to commit
to a reduction amount before necessarily knowing anything further about
the attack beyond that it's a targeted Ninjutsu or Taijutsu ability.

### Hollow Body — Poison Senbon
The Poisoned status/counter mechanic is defined once, parenthetically,
here, and every other ability on the card that applies Poison counters
(Hiruko's Tail Strike, Third Kazekage's Gold Dust Poison, Hollow Body's
own Ultimate) shares this same definition without restating it. Poison
ticks at **every** Upkeep Phase in the game, not just the poisoned
character's own controller's — since each turn has exactly one Upkeep
Phase (§4.2) and turns alternate between players, this means a poisoned
character loses 1 counter and takes 1 damage twice per full round-trip
(once on each player's turn) rather than once, fading roughly twice as
fast as it would under a "your own Upkeep only" reading. Counters from
multiple applications are assumed to **stack additively** — this isn't
explicitly stated on the card, so flag it as the assumed default rather
than a confirmed ruling. "Can't be prevented or healed away" makes this
damage as unstoppable as Itachi's Amaterasu (§Itachi above) once the
counters are already on a character.

### Puppet Soldier Token
Its Summon ability only exists on Hollow Body, so in practice these
tokens can only ever be created after Sasori has already transformed.
It fizzles if Hollow Body is defeated — which, since Hollow Body is
Sasori's final form, is the same moment Sasori himself is truly
defeated.

### Hollow Body's Ultimate — Puppet Performance: Hundred Puppets
Same full-Pool-to-activate pattern as Deidara's and Konan's Ultimates
(see their entries above). Also a blanket effect (targets no one) for
the same reason those are — can't be stopped by target-negation (§9).
Only available once Sasori has transformed into Hollow Body — there's no
way to use it while still in Hiruko form. The Poison counters it applies
follow the same shared Poisoned-status definition as the rest of the
card.

---

## Zetsu

*This whole card is a fresh assistant draft — treat every number and
interaction below as provisional until it's been reviewed.*

### Dual Nature
Switching itself is now free and unlimited (0 Chakra, any number of
times per turn) — the real restriction moved from the switch to the
*abilities*: no matter how many times Zetsu flips between modes in a
turn, he can activate only one of White Zetsu's or Black Zetsu's
ability that turn, not both. This is a restriction *on top of* the
normal once-per-turn cap each individual ability already has (§9) — it's
not that each ability is capped at once/turn independently (which,
combined with free switching, would let him use both once each per
turn); it's that the *pair* of them shares a single use between them per
turn. Switching still costs nothing outside a Main Phase-only
restriction — as a Sorcery-speed action, it can only happen during one
of Zetsu's controller's own Main Phases (§4.4/§4.6), same as any other
Sorcery-speed action.

### Photosynthetic Regeneration / Golem's Regeneration
The two Regeneration effects were swapped between Zetsu and his Golem:
Zetsu's Photosynthetic Regeneration is now **unconditional** (+1 HP
every Upkeep, no requirement), while the Golem's own Regeneration trait
is now the **conditional** one — only heals if it took no damage last
turn. Only the effect swapped; each trait kept its own name in place
(Zetsu's stays "Photosynthetic Regeneration," the Golem's stays plain
"Regeneration").

For the Golem's now-conditional version: "took no damage last turn" is
checked at the start of Upkeep looking *backward* at the previous turn
cycle, not the upcoming one — so it can trigger even on a turn where the
Golem is about to take damage later, as long as it was unharmed since
its last Upkeep. It doesn't specify "any damage" vs. "combat damage" —
read it as any damage from any source resetting the streak.

### No Self-Pooling / Unlimited Pool Capacity / Absorbed Vitality
Three pieces that only make sense together:
- Zetsu's Pool Capacity is **unlimited** — no cap, no "room left" check
  when Chakra is added to it (contrast every other character, whose
  Pool has a fixed capacity that caps how much can be pooled at once,
  §5.3).
- But he's cut off from the *normal* way Chakra gets into a Pool — the
  voluntary tap-and-pool action any player can normally take with any
  of their characters (§5.3) simply doesn't work on him. This is a
  card-text override of that general rule (§0). The only thing that
  fills his Pool is the Chakra Spore's absorption effect (or any future
  card that explicitly says it feeds Chakra into Zetsu's Pool the same
  way) — "absorption," not "pooling," is the operative distinction.
- Absorbed Vitality then spends however much of that absorbed Chakra
  the controller chooses (X, freely chosen at activation, capped only by
  how much is actually banked) to heal X−1 to any ally or the activating
  unit itself — a 1-Chakra "tax" built into the conversion rate (spend
  4, heal 3; spend 10, heal 9), with no upper bound other than how much
  has been absorbed so far. Since the Reservoir has no cap, there's no
  ceiling on how large a single activation of this could eventually
  become if enough Chakra Spores land — this is a genuine, uncapped
  scaling potential worth a balance look, especially paired with Zetsu
  Golem being freely re-creatable (more Golems → more Golem Strikes →
  more Spores → bigger eventual heals).

**Now shared by every Zetsu-family unit**, not just Zetsu himself:
Zetsu, every White Zetsu Clone, and every Zetsu Golem each carry their
own independent copy of Absorbed Vitality, all spending from the same
single Reservoir. This means the once-per-turn cap (§9) applies
separately to *each unit's own copy* — with, say, 3 Clones and a Golem
in play alongside Zetsu, that's up to 5 separate activations of
Absorbed Vitality in a single turn (each still needing X Chakra
available in the shared pool at the moment it resolves), not one
activation shared across the whole family. Combined with the uncapped
Reservoir noted above, this meaningfully raises the ceiling on
same-turn burst healing — worth weighing alongside the scaling concern
already flagged.

### Shared Reservoir
Unifies Zetsu, all his White Zetsu Clones, *and* his Zetsu Golem tokens
onto one single pool — a third variant beyond the two the game already
has: normal Tokens have no Pool at all (§10 default), and Pain's Path
tokens each bank an individual Pool of their own (§Pain of the Six Paths
above). This is the first true **shared/merged** pool across multiple
game objects (contrast Pain's Rinnegan Reservoir, which keeps each
Path's Pool separate and only adds cross-access). Golem Strike's 1
Chakra cost now draws from this same reservoir, and the Chakra Spore's
drain already fed it directly — so every Chakra-related effect
anywhere on this card, whether it belongs to Zetsu, a Clone, or a Golem,
touches the same single total. (Earlier drafts of this card left the
Golem out of the reservoir as an open question — this update resolves
that in favor of full inclusion.) Since Clone Strike itself still costs
0 Chakra, Clones remain net contributors more than spenders in practice,
while Golem Strike is the first ability that actually draws down the
reservoir from a Token's side.

### Combine: Zetsu Golem / Zetsu Golem Token
Interpretive calls made drafting this, flagged for review:
- **"Spores that absorb 3 Chakra"** was read as a delayed drain, mirroring
  the structure of Sasori's Poisoned status and Naraka Path's delayed
  effects (§Sasori, §Pain of the Six Paths above) — not an instant
  effect bundled into the strike itself. The Chakra Spore sits on the
  target until its controller's *next* Upkeep Phase, then drains up to
  3 (capped by however much is actually stored, same "if stored"
  convention as Sinister Whisper/Clone Strike) into Zetsu's controller's
  hands. An instant-drain reading was also defensible ("leave spores
  behind" could just be flavor text for an immediate effect) — this
  was chosen because "leave behind" most naturally describes something
  that persists rather than something that resolves on the spot.
- **Golem HP = the consumed Clones' *current* HP, not their max** — if
  any consumed Clone had already taken damage, that damage carries over
  into the Golem's starting HP (a Clone at 1/2 HP contributes only 1,
  not 2). This directly follows the card's own "current combined clones
  hp combined" wording.
- **Consumes at least 3, controller's choice how many** (updated from an
  original fixed "exactly 3") — activating with more than 3 in play
  means choosing whether to fold all of them into one bigger, tankier
  Golem or hold some back as independent Clone Strike attackers. Since
  the Golem is a single token with a single HP pool, consuming more
  Clones trades their individual, separately-targetable bodies for one
  consolidated (and thus easier to fully remove, since it's only one
  target instead of several) larger HP total.
- **Not mode-gated.** Unlike White Zetsu Army (which explicitly requires
  White Zetsu mode), this ability has no stated mode restriction even
  though it consumes White Zetsu Clone tokens specifically — flagged as
  worth a second look, since gating it to White Zetsu mode (matching the
  Ultimate) would be a reasonable and thematically consistent option if
  the designer wants tighter symmetry.
- The Golem is a **new token type**, not itself a "Clone" — it doesn't
  count toward the Clone tokens' own 5-in-play cap, and nothing currently
  caps how many Golems can exist (each one still costs 3 Clones + 4
  Chakra to make, which is a fairly steep natural soft-cap on its own
  given the Clone cap and Chakra economy).
- Golem's own Regeneration trait is now the **conditional** one (only
  heals if it took no damage last turn) — see "Photosynthetic
  Regeneration / Golem's Regeneration" above for the swap with Zetsu's
  own trait.

### Black Zetsu: Sinister Whisper / Clone Strike — now the Absorb keyword
Both abilities use the formal **Absorb X** keyword (§6.8b) — their
shared "gain unconditionally, drain from the target only if stored"
pattern is exactly what the keyword was written to standardize, once it
became clear Kisame's Samehada Strike (§Kisame above), Sinister Whisper,
and Clone Strike had all independently converged on the same underlying
effect. The Chakra gain never depends on the target having anything
banked; only whether it's *taken from* the target rather than generated
outright is conditional — that's now fully spelled out once, centrally,
in §6.8b rather than repeated per-card. This is a deliberate divergence
from Preta Path's Chakra Absorption (§Pain of the Six Paths above),
which is a genuinely different mechanic (redirect-and-zero-out, not an
Absorb) and was not reworded to use this keyword. Each Clone still acts
independent of whatever mode Zetsu himself is currently in (Clones
aren't gated by Dual Nature's mode restriction, since that trait only
governs Zetsu's own two Abilities, not token abilities).

**Cost note:** Clone Strike now costs 1 Chakra (from the shared
Reservoir) while also Absorbing 1 — since both draw from and feed the
exact same pool, this makes Clone Strike net Chakra-neutral against a
target with nothing stored (spend 1, immediately regain 1), and net
Chakra-*positive* for the Reservoir against a target that has Chakra
banked (spend 1, regain 1, plus drain 1 more from the target) — worth
noting since it means Clone Strike is never really a draw-down on the
Reservoir in practice, just a pass-through with a bonus drain when
available.

### Spore Technique
Several interpretive calls made drafting this, flagged for review:
- **Targeting requirement:** the target must already have taken damage
  from Zetsu himself or a White Zetsu Clone *this turn* before Spore
  Technique can be used on it — it can't be used proactively on an
  undamaged enemy. This is a precondition on activation (§6.8a's colon
  rule), not something checked again later.
- **Narrowed to self-negation only:** the restriction is scoped to the
  affected enemy negating the *targeting* of damage against itself using
  its own kit — an ability it activates itself, or a hand card it
  enables per §5.3's Style-affinity rule (e.g. Itachi's Crow Clone,
  Preta Path's redirects if it were a Path, Deva Path's Shinra Tensei V2
  if it were Deva). Ordinary damage reduction/prevention — from its own
  passives, an ally's protection, or anything that isn't the target
  itself invoking a negation effect — still works completely normally.
  This replaced an earlier, broader draft that blocked all
  reduction/prevention/negation from any source; that version was
  scaled back specifically to this self-negation scope.
- **"Cannot use taijutsu attacks"** blocks Type: Taijutsu abilities
  specifically — narrower than a full stun (Mind Prison, §Itachi above)
  — the target can still use Ninjutsu, Genjutsu, or non-damaging
  abilities freely.
- **Two different durations layered on one ability, not resolved into
  one:** the damage-immunity-removal and Taijutsu-lock last only
  "until the end of your next turn" (one turn cycle), but the Absorb 1
  trigger is scheduled independently for "your next 2 turns'" End
  Phases — a longer window. This means the *second* Absorb trigger
  fires after the debuff half has already expired. This wasn't
  smoothed into a single duration since the user's phrasing explicitly
  gave the Absorb clause its own, separately-stated schedule — treat
  this as intentional layering, not an error, unless told otherwise.
- **Not mode-gated** — consistent with Combine: Zetsu Golem and
  Absorbed Vitality, only the two abilities explicitly prefixed "White
  Zetsu:" / "Black Zetsu:" are restricted by Dual Nature; this one (like
  those two) works regardless of Zetsu's current mode.

### White Zetsu: Corpse Consumption
"Any character was defeated this turn" is a blanket check across the
whole board, not scoped to Zetsu's own kills — it triggers off an
opponent's character dying to *anything* (another character's attack,
an Upkeep-tax Disable-into-eventual-loss chain, another Poison tick,
etc.), not just something Zetsu personally did. This is intentionally
generous compared to Kakuzu's Ultimate, which requires Kakuzu himself to
land the killing blow (§Kakuzu above) — flag if the designer wants
Corpse Consumption narrowed to "Zetsu defeats" specifically instead.

### Ultimate — White Zetsu Army
Mode-gated the same way the two Abilities are, but as an Ultimate it
isn't one of "his two Abilities below" that Dual Nature's trait text
refers to — so this restriction is stated separately, directly on the
Ultimate itself, rather than inherited from the trait. Like Deidara's
and Konan's Ultimates, it has no "Pool must be full" condition — that
pattern wasn't applied here, since White Zetsu Army's cost (5 Chakra) is
already a meaningful chunk of a B-rank Pool without an extra activation
gate.

---

## Juzo Biwa

*Almost entirely original invention — Juzo Biwa is an anime-only
character (one of the Seven Ninja Swordsmen of the Mist, wielding
Kubikiribōchō) with no detailed technique list documented, so beyond
that core flavor (the self-repairing blood-iron blade, Water Release,
mist/clones, and — per the anime — recruitment into Akatsuki), this kit
is a from-scratch draft, not a translation of established abilities.
An earlier draft of this card incorrectly named his weapon "Kabutowari"
(a different, unrelated weapon) — corrected to Kubikiribōchō.*

### Kubikiribōchō's Regeneration / Ultimate — Kubikiribōchō Unleashed
Both his trait and his Ultimate key off "defeats the target" — two
independent kill-triggered payoffs, not one shared effect: Regeneration
fires off *any* kill Juzo lands (Cleaving Strike, the Ultimate, even a
future Jutsu card he might enable), healing a flat 3, while the
Ultimate's own clause (now a flat 6, changed from "heal to full")
fires separately whenever that specific Ultimate activation finishes
the target off. If the Ultimate's hit is what defeats the target,
**both** triggers fire together (independent effects, §6.8a) — 3 from
the trait plus 6 from the Ultimate's own clause, 9 total. That happens
to exactly equal his max HP (9) — a coincidence worth flagging, not
something deliberately tuned to that number; if his max HP ever
changes, this combined total won't automatically follow it the way the
old "heal to full" wording would have.

### Iron-Forged Body
Now a single passive clause: a flat, always-on Taijutsu damage
reduction (-1, min 1, so it can never fully block a Taijutsu hit down
to 0). An earlier draft also included a once-per-game survive-lethal
clause (modeled on Hidan's Jashin's Blessing, §Hidan above) meant to
translate "survived Might Guy's Eight Gates Released Formation" — that
clause was removed by request; the trait's name and remaining -1
Taijutsu reduction are what's left of that "hard to put down" flavor.

### Cleaving Strike
The bonus 1 damage to "another enemy character" only fires if the
primary 3 damage actually defeats the first target — this is a
condition on the second clause, not two independent effects (contrast
the usual comma-independence rule, §6.8a; the "if this defeats the
target" qualifier makes the second hit dependent). If there's no second
enemy character in play, this clause simply doesn't happen — no damage
is redirected or wasted elsewhere. This is the "dye battlefields red"
mass-slaughter flavor from his summary, kept modest (only 1 bonus
target) to stay within B-rank budget.

### Water Style: Hiding Mist
Reworked from a flat damage-prevention shield into a coin-flip evasion
effect, matching the pattern already established by the Giant
Drill-Beaked Bird's Evasive trait (§Pain of the Six Paths above) —
except this is a temporary, activated effect (granted for the rest of
the turn by casting Hiding Mist) rather than an always-on passive like
the Bird's. It also has no speed restriction the way the Bird's Evasive
does (Evasive only checks against Normal-speed attacks, §9's "physical
blocking vs. Genjutsu" section not withstanding) — Hiding Mist's coin
flip applies to *any* targeted attack regardless of speed, since the
card text doesn't say otherwise. Each targeting attempt gets its own
independent coin flip — a determined attacker isn't blocked outright,
just faces good odds of whiffing on any single attempt.

### Synergy: Akatsuki
Originally added purely by user request despite no known canon
affiliation; the user's follow-up summary clarifies that (in the anime)
Juzo Biwa's combat ability specifically earned him recruitment into
Akatsuki — so this tag now reflects an actual (anime-canon, if not
manga-canon) affiliation rather than being a forced addition. He fully
participates in the Synergy discount math (§6.5) like any other
Akatsuki-tagged character, in both directions.

---

## Yahiko

*This whole card is a fresh assistant draft — treat every number and
interaction below as provisional until it's been reviewed.*

### Inspiring Leader
"The first ability your other Akatsuki characters use each turn" is
tracked **per character**, not once globally for the team — each of
your other Akatsuki-Synergy characters gets its own first-ability
discount once per turn, not just whichever one happens to act first.
This follows the same shape as Kakuzu's Elemental Versatility and
Itachi's Uchiha Prodigy (both "first X each turn costs less," tracked
on the character having the trait) — the difference here is the
discount applies to *other* characters' first abilities, not Yahiko's
own. If a character has already gotten a discount from some other
"first ability" source this turn (none currently exist, but flagging
for future cards), these wouldn't stack automatically — that would need
explicit resolution if it ever comes up.

### Elemental Versatility, and the Fire/Wind Styles tags
Directly reuses Kakuzu's own trait name and wording (§Kakuzu above) —
deliberate reuse of an established pattern rather than a new one, since
the underlying mechanic (multi-Style character, discount on the first
elemental jutsu each turn) is identical. Yahiko has an actual Water
ability using the Water tag (Water Jet Stream/Water Pillar Wall below),
but his Fire and Wind tags currently have **no abilities of his own**
using them — same situation as Konan's Wind/Earth/Water/Yang tags
(§Konan above): they exist purely so he can serve as the enabling
character for matching Fire/Wind Jutsu cards played from hand (§5.3),
and so this trait's discount has something to apply to beyond just
Water. A natural place to expand his kit later if dedicated Fire/Wind
abilities are wanted.

### Blade of Resolve
Renamed/reflavored from the earlier "Kunai Barrage" — same cost and
effect, just reframed around his canon kenjutsu implication (seen
carrying a large sword in flashbacks) rather than thrown tools. No
mechanical change from the rename.

### Water Release: Water Jet Stream / Water Pillar Wall
A matched offense/defense pair pulled directly from his summary (a
water-stream attack, and defensive water pillars) — Water Pillar Wall
follows the same "Prevent the next N damage" shield pattern already
used elsewhere (Juzo Biwa's original Hiding Mist draft, Mission card
rewards): a fixed-capacity prevention pool, not a percentage, expiring
at end of turn per §6.9's default regardless of how much went unused.
Both are Normal-speed (no listed Speed override), unlike Juzo's
Quick-Technique Hiding Mist — so Water Pillar Wall can only be cast
during one of Yahiko's controller's own Main Phases, not reactively in
response to an incoming attack. Flag if a Quick Technique version was
intended instead, given its defensive framing.

### Rallying Words
Reworked from a single-target heal+cleanse into a blanket team buff —
"each ally's next attack this turn deals 1 additional damage" targets
no one (§9's targeting-vs-affected distinction), so it can't be stopped
by target-negation, only by ordinary damage/effect prevention. Per
§6.9's default duration (no override stated on the card), the buff
lasts only until end of turn — an ally that doesn't attack this turn
simply loses the bonus, it doesn't carry over to a later turn. "Next
attack" means the first damage-dealing ability or Attack-type Jutsu each
individual ally uses this turn — it's tracked per ally (each gets their
own one-time +1), not a single bonus claimed by whichever ally attacks
first. A Retreated or Disabled ally (§6.5a, §6.5b) still counts as
affected by the blanket buff even though it can't currently use it —
there's no exclusion clause narrowing this to "eligible" allies only.

### Ultimate — Yahiko Sacrifices Himself
Replaced an earlier version ("Sacrificial Resolve") that used
text-based self-defeat and a heal/discount payoff — this version is
built entirely differently, around a conditional damage-redirect. Key
interpretive points, flagged for review:
- **Cost:** "2 Chakra + Yahiko's entire Chakra Pool spent in full" uses
  the same pattern as Deidara's and Deva Path's Ultimates (§Deidara,
  §Pain of the Six Paths above) — spend whatever is currently banked,
  on top of the printed 2. Unlike those two, there's no "Pool must be
  full to activate" condition stated here — it can be activated with
  any amount (including 0) currently pooled, for as little as 2 Chakra
  total.
- **No Style, no Type:** left both unset, matching §6.8's guidance for
  abilities that don't cleanly fit Ninjutsu/Taijutsu/Genjutsu (this is
  a conditional redirect/sacrifice mechanic, not a cast technique) — the
  same reasoning as Itachi's Sharingan Foresight passive (§Itachi
  above).
- **Board-count condition counts Tokens on both sides** — a deliberate
  departure from how Tokens are normally excluded from character counts
  (e.g. the 5-character back-row limit, §6.5, §10). This is checked at
  the moment of activation (i.e., the moment you respond to the
  qualifying attack) — since this is a Reactive Technique triggered
  directly by that specific attack, not a primed effect sitting around
  waiting, there's no window where the condition could later stop being
  true mid-effect the way a longer-lived buff might.
- **"Another character" was read as "one of your other characters"**
  (an ally), not literally any character on the board — this fits the
  protective/sacrifice flavor and the setup condition (Yahiko's side
  being outnumbered), but the card text just says "another character,"
  so flag if enemy-character-triggering was actually intended.
- **Reactive Technique, not a primed/lingering effect.** This activates
  directly in response to one specific targeted attack already
  declared against an ally — the same interception pattern as Preta
  Path's Chakra Absorption, Asura Path's Mechanized Guard, and Hiruko's
  Puppet Shell Guard (§Pain of the Six Paths, §Sasori above), not a
  Sorcery-speed buff that sits primed for the rest of the turn. This
  resolves the earlier draft's open duration question — there's no
  "does it expire unused by end of turn" concern, since each activation
  is tied to one specific attack in the moment.
- **"Would defeat it" is calculated after any damage-reduction effects
  have already applied** — e.g. if the target's own damage reduction
  (or a shield like Water Pillar Wall) cuts the incoming attack down
  below lethal first, this Ultimate simply isn't triggerable for that
  attack at all, since the final post-reduction number no longer
  qualifies as "would defeat it." Only a hit that's still lethal after
  every other applicable reduction has been factored in qualifies.
- **Explicit replacement effect.** The original target never takes the
  damage at all — it's replaced outright by "Yahiko takes it instead,"
  not a redirect-after-the-fact. This is the same framing already used
  informally for Deidara's Forbidden Technique Version 2 (§Deidara
  above), now made explicit in the card text itself.
- **Does not guarantee Yahiko's own death.** The redirected damage is
  the *same number* that would have defeated the original target — it
  is not automatically lethal for Yahiko specifically. If Yahiko's
  current HP happens to exceed that redirected amount, he survives the
  hit despite the "sacrifices himself" framing. This wasn't forced into
  a guaranteed-defeat rule since the card text doesn't say "and this
  defeats Yahiko" — flag if that guarantee was actually intended.

---

## Amegakure Civilian Rebel

### D Rank (new rank tier) and its special draw rule
D Rank was added as a new bottom tier, below C — it follows every C
Rank default (0 Upkeep, §6.5; uncapped in Character Deck construction,
§2) except Health Lost on Defeat, which is lower (1 instead of C's 3,
§11). The one rule unique to D Rank is the draw bonus in §8: normally,
a Character Deck draw event (Setup's starting-character draw, or a
Reinforcement trigger) shows you multiple cards and makes you pick just
1, returning the rest — if a D-rank card is among what you see, you
instead keep it *and* your normal pick, so only whatever's left over
(after both) goes back. This applies to **both** draw types (the
Setup's draw-3-keep-1 and a Reinforcement's draw-2-keep-1) since the
rule as given wasn't scoped to just one — flag if it was meant to apply
only to Reinforcement draws specifically, not the initial Setup draw.
If multiple D-rank cards appear in the same draw batch, up to **2** of
them get the bonus inclusion (raised from an original cap of 1) — any
beyond that go back to the bottom of the deck alongside whatever
non-chosen, non-D-rank cards were also seen.

**All-D-rank reveal extension:** if every card a draw event reveals
turns out to be D Rank, the draw doesn't just resolve on generic filler
with nothing else to choose from — you keep revealing one more card at
a time from the top of the Character Deck until a non-D-rank card
finally shows up, guaranteeing every draw produces at least one unique
character for your normal pick. This can reveal (and thus make
eligible for the 2-card D-rank cap) more D-rank cards than the original
draw size would have — e.g. a Reinforcement's normal 2-card draw could
extend to reveal 4 or 5 cards total if a long run of D-ranks comes up,
all of which count toward what you're choosing from and returning
afterward. There's no stated limit on how many extra cards this
extension could reveal in an unlucky (or lucky) worst case — it keeps
going strictly until a non-D-rank card appears, however long that
takes, bounded only by how many non-D-rank cards remain in the deck.

### D Rank copy-limit exception
§2's "no duplicates in the Character Deck" rule now carves out D Rank
specifically — since D-rank cards represent generic, unnamed characters
rather than unique named individuals (unlike every other card in the
deck), multiple copies of the same D-rank card are legal. The current
preset Akatsuki deck includes 2 copies of Amegakure Civilian Rebel as a
result — this is the first card in the deck with more than 1 physical
copy in the Character Deck.

### Amegakure Civilian Rebel (the card)
Deliberately minimal by request — no Traits, no Ultimate, a single
1-Chakra ability. "If Yahiko is in play, deal 2 instead" is a
board-state check performed at the moment the ability resolves (not
locked in at activation) — if Yahiko enters or leaves play *after* this
ability activates but *before* it resolves (e.g. in response, on the
stack), the damage dealt reflects Yahiko's presence at resolution, not
at activation. This card has no Yahiko-specific Synergy tag of its own
(Synergy is just Akatsuki, matching the rest of the deck) — the bonus is
a card-text callback to Yahiko specifically, not a general
Synergy-based mechanic, so it doesn't interact with §6.4's Synergy
upkeep-discount math at all.

---

## Jutsu Cards (§13b)

### Substitution / Lightning Substitution — who gets protected
The card protects specifically **the character enabling its play** —
the same character satisfying §10c's Style/eligibility requirement must
also be the one currently targeted by the attack being negated. You
can't use a Lightning-Style character elsewhere on your board to enable
Lightning Substitution and then protect a *different* character with
it; the attack has to be aimed at that same enabling character. This
means playing either card requires the threatened character itself to
be the eligible one — if your only Lightning-Style character isn't the
one under attack, Lightning Substitution can't be played at all for
that attack (Substitution, Style: None, doesn't have this problem,
since any character can enable it).

### The Pool-funding discount (both cards)
"2 Chakra, 1 if paid from the enabling character's own Chakra Pool" is
a new cost pattern — no character ability anywhere in the game varies
its printed cost by funding source; they only ever vary in *which*
pools are legal to draw from (generic vs. a character's own banked
Chakra, §5.3). This makes personal Chakra Pooling meaningfully more
valuable for these two cards specifically: banking Chakra ahead of time
into the eventual enabling character effectively pre-pays half the
cost. Since Pooling itself is a Sorcery-speed action restricted to your
own Main Phases (§5.3), and both these cards are Reactive Techniques
usable any time, this rewards planning ahead — pooling into a
Lightning-Style character during your Main Phase so the 1-Chakra
discount is available if you need to flash in a Substitution later,
including on your opponent's turn.

### Incoming Mission Assignment
Several interpretive calls made drafting this, flagged for review:
- **"Look at" is private** — only its controller sees the 6 cards; the
  opponent doesn't get to see them, matching the standard convention
  for a "look at the top N cards of your deck" effect (no card so far
  has needed this distinction explicitly, since this is the first
  deck-search effect in the game).
- **Finding a Mission card is optional, and capped at 1** — "you may
  add 1 Mission card among them" means you can decline even if one
  turns up, and if more than one Mission card appears among the 6, you
  still only take one.
- **The other 5 (or 6, if none/none-taken) go back via shuffle**, not a
  chosen order back on top or to the bottom — this wasn't specified on
  the card, so shuffling was chosen as the simplest, least
  information-leaking default (an ordered return would let the
  controller stack their own next few draws, which felt like more than
  this card was meant to grant). Flag if a different return method was
  intended.
- **No Type set** — this reads as an administrative/logistics action
  (issuing a mission order) rather than a cast technique, so it doesn't
  cleanly fit Ninjutsu/Taijutsu/Genjutsu, the same reasoning already
  used for Itachi's Sharingan Foresight passive (§Itachi above).
- **Speed defaults to Sorcery** (no Speed stated) — playable only during
  one of its controller's own Main Phases, same as any other
  unmarked-speed card (§7).

### Battlefield Selection
A direct structural twin of Incoming Mission Assignment, just fetching
a Terrain card instead of a Mission card — every interpretive ruling
above applies identically here: the look is private, finding a Terrain
card is optional and capped at 1 even if more than one appears among
the 6, the rest shuffle back rather than returning in a chosen order,
no Type is set (same administrative-action reasoning), and Speed
defaults to Sorcery. One Terrain-specific wrinkle worth noting: §10a
caps a player at 1 Terrain card *in play* at a time, but that limit is
about play, not hand size — this card can still add a Terrain card to
hand freely regardless of how many Terrain cards (if any) are currently
in play, including a second copy of Akatsuki Hideout (§13c) while one is
already active; playing that copy later would simply replace the
existing one per §10a, not stack.

### Chakra Transfer
Several interpretive calls made drafting this, flagged for review:
- **The 1-Chakra "tax" mirrors Zetsu's Absorbed Vitality** (§Zetsu
  above) — spend X, the recipient gets X−1, same conversion rate
  pattern, just moving Chakra between Pools instead of converting it to
  healing.
- **Bounded by the standard Pooling behavior, not a "waste the excess"
  model.** §5.3's normal Chakra-pooling action refuses outright if the
  amount would exceed a Pool's remaining room, rather than partially
  applying and discarding the overflow — this card follows that same
  convention: X must be chosen such that X−1 fits in the destination's
  remaining room, or the transfer simply isn't legal for that X. It
  doesn't cap X down automatically and waste the difference.
- **X=1 now transfers a full 1, tax-free** — the amount added has a
  floor of 1 (updated from an earlier draft with no floor, where X=1
  would net 0 and be a pointless choice). This means the "X−1 tax"
  effectively only bites at X≥2; the base case (moving exactly 1
  Chakra) is a plain untaxed 1-for-1 transfer, and 2+ always costs
  exactly 1 more than what the destination receives.
- **Both characters must be yours** — this only moves Chakra within
  your own board; there's no reading where it could pull from or push
  to an opponent's character's Pool.
- **Not itself a "pooling" action** for rules purposes — it doesn't tap
  either character (the tap-on-pool rule from §5.3/the engine's
  `status.tapped` mechanic is specifically tied to the *voluntary
  tap-and-pool* action, not to every possible way a Pool can change),
  so using this card doesn't tap the source or destination character.
  Flag if tapping either character was actually intended, since the
  card text doesn't currently say so.

### Field Intelligence
Interpretive calls made drafting this, flagged for review:
- **The opponent chooses which 2 cards to reveal**, not you — "your
  opponent reveals 2 cards from their hand" is read the standard way
  such phrasing works: the named player picks what gets shown, rather
  than the activating player getting to select freely from their hand.
  A more aggressive "look at 2 cards of your choice from their hand"
  version was also possible, but that's a materially stronger
  information-denial effect (guaranteed to see their best/worst cards
  rather than whatever they're willing to show) — flag if that stronger
  version was actually intended.
- **This is the first "reveal" effect in the game** — distinct from
  Incoming Mission Assignment's "look at" (which is private, seen only
  by the looking player). A reveal is shown to both players and is a
  one-time disclosure with no lasting effect — the revealed cards stay
  in the opponent's hand, playable normally; nothing is discarded,
  and there's no ongoing "these cards are known" tracking after the
  reveal resolves.
- **If the opponent has fewer than 2 cards in hand**, they simply reveal
  as many as they have (down to 0) — there's no minimum-hand-size
  requirement to legally play this card.

### Deploy Medic Corps
This card only makes sense as an **explicit exception to Retreat's
full targeting immunity** (§6.5b) — without that override, a Retreated
character can't legally be chosen as a target at all (the immunity
blocks beneficial effects too, not just harmful ones), which would make
this card impossible to ever use. The card text calls this out directly
per §0's rule precedence (card text overrides defaults). A few further
interpretive calls, flagged for review:
- **The heal is cancelled if the target ever stops being Retreated**
  before all 4 triggers complete — updated from an earlier draft that
  had it continue regardless. This mirrors Naraka Path's Outer Path:
  Samsara of Heavenly Life Technique/King of Hell's Judgment
  cancellation pattern (§Pain of the Six Paths above): the effect is
  conditioned on the target *remaining*
  Retreated for the whole duration, not just attached to the character
  once and forgotten. Returning from Retreated (even voluntarily, by its
  own controller) cancels the remaining heals — there's no way to bank
  the effect and then bring the character back early without losing it.
- **"4 cycles" was read as "4 of your own Upkeep Phases"** specifically
  (not both players' Upkeeps, and not 4 full turn-cycles in some other
  counting), matching the established convention used by Deva Path's
  3-turn-cycle lockout and the Path Beast cooldown (§Pain of the Six
  Paths, §Sasori above) — total healing over the full duration is 4 HP.
- **This is the first Jutsu card to trigger §10c's "ongoing-effect
  cards stay in play" rule** — Deploy Medic Corps sits face up in play
  (not the discard pile) for the whole 4-Upkeep duration, moving to
  discard only once it either completes all 4 heals or gets cancelled
  by the target leaving Retreated early. Every other Jutsu card so far
  (Substitution, Lightning Substitution, Incoming Mission Assignment,
  Chakra Transfer, Field Intelligence) resolves instantly and goes
  straight to discard as normal — none of them have a stated duration
  or multiple triggers.

### Medical Chakra Infusion
**[New]** Added with 3 copies in the preset Hand Deck. Interpretive
calls, flagged for review:
- **"One of your characters" means a character, not a token** — the same
  reading as the Mission rewards that say "a character you control". So
  Pain's Path tokens, Clay Spiders, Zetsu Clones, Path Beasts and the
  Third Kazekage can't be healed by it.
- **No Retreat exception** — unlike Deploy Medic Corps, the card text
  doesn't override Retreat's targeting immunity (§6.5b), so a Retreated
  character can't be targeted.
- **Timing:** a non-combat Normal-speed card — Main Phase only (§15.6).
- **Enabler:** it has a Type (Ninjutsu), so like every technique Jutsu
  it needs an enabling character in play; Style: None means any of your
  characters can enable it.
- **Targeting a character already at full HP is legal** — the heal just
  does nothing past max HP.

### Chakra Suppression
**[New]** Added with 3 copies in the preset Hand Deck. Interpretive
calls, flagged for review:
- **"Until its controller's next turn" is read as *through* that turn**
  (the same duration as Mind Prison and Kakuzu's revival stun). Enemies
  only pool on their own turn, so a lock that ended as their turn began
  would do nothing when this is cast on your own turn. Cast on your
  turn, it covers their next turn; cast on their turn (it's Quick), it
  covers the rest of that turn and their following turn.
- **Type: Sealing is a new Type** coined for this card (§6.8), the way
  Bukijutsu was for Explosive Tag. It isn't Ninjutsu, so Jutsu
  Disruption can't negate it, and it isn't damaging, so the
  Substitution family can't either. Existing sealing-flavored abilities
  keep their current Types.
- **It stops the pooling action only** (§5.3). Chakra that reaches the
  Pool another way — Chakra Transfer, absorption (Zetsu, Kisame), Preta
  Path's Chakra Absorption — still lands. Chakra already in the Pool
  stays and can still be spent.
- **"Enemy character" means a character, not a token**, so Pain's Path
  tokens (which pool individually) can't be targeted.
- **Enabler:** it has a Type, so it needs an enabling character; Style:
  None means any of your characters can enable it.
- **Retreated characters** can't be targeted (Retreat immunity, §6.5b).
- The lock shows on the target as **"Can't be pooled into — through
  turn N"**.

### Fire Style: Fireball Jutsu
**[New]** Added with 1 copy in the preset Hand Deck. Interpretive
calls, flagged for review:
- **Attack-type Jutsu:** it deals damage, so it's **Combat Phase only**
  and **once per turn by name** (§15.6), like Explosive Tag.
- **Enabler:** needs a **Fire**-Style character in play (Kakuzu in the
  preset deck).
- **Pool discount:** follows the Substitution convention — paying any of
  it from the enabling character's own Pool makes the cost 3; the rest
  comes from generic Chakra.
- **Adjacency** is the §9 sense Explosive Tag uses: front, behind, left
  or right of the target. You pick 0, 1 or 2 of those to take 1 damage
  each; with fewer than 2 adjacent units, fewer are hit.
- **"Character" follows Explosive Tag, not Medical Chakra Infusion:**
  tokens (Pain's Paths, clones, Beasts) can be the target or a splash
  target, as with every other attack in the game.
- Each hit is a separate damage instance, so damage reductions and
  redirects apply to each one individually.
- **Kakuzu's Elemental Versatility** (first elemental jutsu each turn
  −1) currently applies only to his own abilities, not to a Jutsu card
  he enables — the same as Lightning/Water Substitution today.

### Emergency Relief
**[New]** Added with 3 copies in the preset Hand Deck. Interpretive
calls, flagged for review:
- **Only losses after it's played count** (SPEC §0: cards only see what
  happens while they're in play), even though the Condition says "this
  game".
- **"Characters" means characters, not tokens** — a Clay Spider, Zetsu
  Clone, Path Beast, the Third Kazekage or a single Pain Path being
  defeated doesn't count. A D-rank character does count ("any Rank").
- **Pain of the Six Paths counts** once he's fully defeated (his last
  Path falls) — one character loss. **[Designer ruling]**
- **Not a loss:** a character returned to hand with trust mode's manual
  "Return to hand" correction — it wasn't defeated.
- **The reward is an immediate free draw** (look at 2, keep 1, with the
  usual D-rank bonus) — its own trigger, separate from Reinforcement, and
  like every Character Deck draw a state-based action (§8). It's revised
  from an earlier version that made your *next* paid draw free instead.
- **The tax counter doesn't go up**, and a pending Bingo Book: Threat
  Level A discount is untouched.
- **If you're already picking from a Character Deck reveal** when it
  completes, the free draw waits as a free offer you take right after.
  With an empty Character Deck there's nothing to draw.
- The Mission chip shows "x/2 of your characters lost" while it's in
  play.

### Assist Cards (new sub-category) and Chidori Interception
Assist cards are a presentation/flavor layer over the existing Jutsu
card rules (§10c), not a new zone or card type — the only genuinely new
*mechanic* they introduce is bypassing the Style-enabling requirement
entirely (§5.3), justified by the flavor that the named character
briefly enters and exits play to perform their one technique
themselves, rather than needing one of your own characters to "channel"
it. This is a deliberate, narrow exception — every other Jutsu card
still needs a matching enabling character in play.

The header format is **[Assist Type]: [Character], [Synergy]** in
place of a plain card name line (e.g. "Impact Assist: Sasuke,
Akatsuki") — this replaces an earlier draft that used a separate
"Flavor: [Character]" line plus a normal Synergy field; the user's
correction folded both into one structured header instead. Also note:
the user's own phrasing for this once read "Impact Assault" — read as a
typo for "Impact Assist" (matching every other use of "Assist" in this
whole sub-category, including the card type's own name), not a rename
of the category itself. Flag if "Assault" was actually intended as the
umbrella term.

**Chidori Interception**, the first example, is an **Impact Assist**
(offense-flavored) rather than a Guard Assist, since its payoff is
dealing damage — even though it's structurally a reactive interception.
This sets the working precedent that Assist Type is judged by the
*payoff*, not the *trigger shape*: a reactive ability that punishes with
damage is Impact, not Guard, even though "Guard" might sound like the
more literal fit for something that responds to an incoming attack.
Guard Assist, by implication, is reserved for cards whose payoff is
protective/mitigating (redirecting, reducing, preventing) rather than
punishing.

A few further notes on Chidori Interception specifically:
- **Does not negate or reduce the original attack** — both the
  triggering attack and Chidori Interception's own 2 damage happen;
  this is a pure punish, unlike Substitution/Lightning Substitution's
  negation-based design or Lightning Substitution's negate-then-punish
  combo. The enemy's attack still fully resolves against whatever it
  was aimed at.
- **Triggers off any enemy attacker, Character or Token** — "an enemy
  character or token activating a targeted damage-dealing ability or
  Attack-type Jutsu" isn't restricted to attacks aimed at any particular
  target of yours; it just needs to be the opponent's own attack being
  activated at all.
- **Header reads "Impact Assist: Sasuke, Akatsuki"** — same
  guest-character pattern already established by Juzo Biwa (§Juzo Biwa
  above): the named Synergy reflects what the card mechanically plugs
  into (this deck), not an in-universe affiliation claim (Sasuke was
  never Akatsuki in any continuity).
- **Style: Lightning is flavor/informational only** here, per the new
  Assist Style-bypass rule above — no in-play Lightning-Style character
  is needed to play it.
- **Cost reduction checks the controller's own Terrain, not either
  player's** — "if an Akatsuki-Synergy Terrain card is in play" is read
  as scoped to the activating player's own Terrain (matching how
  Akatsuki Hideout's own Upkeep reduction only benefits its own
  controller, §10a's one-way default) — the opponent having an
  Akatsuki-Synergy Terrain in play doesn't discount your Chidori
  Interception. This required retroactively adding a formal Synergy
  field to Akatsuki Hideout itself (previously it had none, since no
  other card had ever needed to check a Terrain's Synergy before) —
  Terrain cards can now carry a Synergy tag the same way Characters and
  Assist cards do.

### Akatsuki Hideout (Terrain)
The deck's first Terrain card. Interpretive calls, flagged for review:
- **One-way by default (§10a)** — since the card text just says
  "Akatsuki-Synergy characters you control," this only benefits its
  controller's own Akatsuki characters, not the opponent's, even though
  this is currently a mirror match where both players run the same
  Akatsuki deck. §10a's default requires a Terrain's text to say
  otherwise for it to affect both sides symmetrically, and this text
  doesn't — so playing it is a genuine one-sided advantage even in the
  mirror, not a wash.
- **Cost: 2 Chakra [Updated]** (previously 0) — paid from generic
  Chakra when played (a Terrain needs no enabling character, §10c).
  With the Synergy discount now capped at −2 for the whole board (§6.5),
  the Hideout's −1 per Akatsuki character is the bigger saving on a full
  board, so it's no longer free to put down.
- **Stacks with the Synergy upkeep discount (§6.5)** — the Hideout's −1
  applies to each Akatsuki-Synergy character you control (not capped),
  and the board-wide Synergy discount (max −2) then comes off your
  most expensive remaining upkeep; no character goes below 0.
- **Doesn't touch starting-character Upkeep Phase effects (§6.5)** — a
  starting character follows its own bespoke Rank-scaled table (free
  upkeep, a Chakra gain, etc.), not the standard per-rank Upkeep table
  this Terrain reduces. Only non-starting Akatsuki-Synergy characters'
  ordinary Upkeep costs are affected.
- **3 copies added to the Hand Deck manifest** (IMPLEMENTATION_PLAN.md)
  — the starter deck's real-card count rises from 33 to 36, so Chakra
  Fodder filler drops from 7 to 4 to keep the Hand Deck at 40 (§2).

### Jutsu Disruption
Interpretive calls and clarifications, flagged for review:
- **Not tied to protecting the enabling character** — unlike Substitution
  and Lightning Substitution (which only protect the character enabling
  their own play, per the earlier correction above), Jutsu Disruption
  has no such restriction: it can negate a qualifying Ninjutsu attack
  aimed at *any* target, friend or otherwise relevant to you, as long as
  you have any eligible character in play to enable the card at all
  (Style: None, so any character qualifies). This is the actual
  differentiator from Substitution, which is why both cards can coexist
  without one making the other redundant.
- **The Ultimate/Forbidden Technique carve-out only ever matters against
  character abilities** — Jutsu (hand) cards never carry an "Ultimate"
  or "Forbidden Technique" designation (those are character-card-only
  categories, §6.8), so this exclusion has no effect when negating an
  Attack-type Jutsu card; it only ever blocks this card from being used
  against a character's Ninjutsu-Type Ultimate or Forbidden Technique
  specifically. This is a deliberate balance safeguard — those are
  already large investments (often "X Chakra + entire Pool," §Deidara,
  §Pain of the Six Paths, §Konan, §Sasori above), and letting a cheap
  2-Chakra card blank one outright would undercut that cost.
- **Covers both damage-dealing abilities and Attack-type Jutsu**, same
  phrasing convention as Substitution — "attack" isn't restricted to
  only character abilities.

### Water Substitution
Third card in the Substitution family, and the cheapest — 3 Chakra base
(1 if paid from the enabling character's own Pool). It originally had
no Pool-funding discount at all (a flat 1 Chakra, full stop) while
Substitution/Lightning Substitution used a 2/1-if-from-Pool structure;
after the family-wide cost pass, all three now share the same
discount-for-Pool-funding shape, just at different absolute numbers —
Substitution/Lightning Substitution: 4/2, Water Substitution: 3/1. Same
protection scope as base Substitution (protects only the character
enabling its play, per the earlier correction above) and no bonus
counter-damage clause like Lightning Substitution's Taijutsu punish —
the tradeoff across the three cards is purely: Substitution (Style:
None, flexible, 4/2) is the baseline; Lightning Substitution (Style:
Lightning, same cost, extra Taijutsu punish) is a strict upgrade *if*
you have Lightning available; Water Substitution (Style: Water,
cheaper on both the base and Pool-funded cost, no bonus) is a discount
version *if* you have Water available instead. This gives the two
elemental variants different value propositions rather than one simply
being better than the other.

### Explosive Tag
The deck's first direct-damage Jutsu card. One important distinction
flagged for clarity: this is **not** a cross-pattern effect (§9) — a
true cross pattern hits *all* available cardinal directions from the
epicenter simultaneously (like Shinra Tensei or C3 Shi-Suri, §Pain of
the Six Paths, §Deidara above). Explosive Tag instead lets the attacker
choose **one** of the up to four adjacent positions (front, behind,
left, or right) to also hit — closer in spirit to the pre-cross-pattern
version of Shinra Tensei ("your choice of side") than to how cross
pattern effects work today. If there's no occupant in the chosen
direction (edge of a row, empty paired slot), that second hit simply
doesn't land — same graceful-fizzle handling as every other
adjacency-based effect in the game.

**Type — Bukijutsu, and the new Physical umbrella (§6.8):** this card
is what introduced Bukijutsu, a narrower Type for ranged/thrown weapon
attacks specifically (kunai, shuriken, senbon, exploding tags),
alongside a "Physical" umbrella term covering both Taijutsu and
Bukijutsu together. Two things worth being clear on, since an earlier
pass at this over-corrected before being walked back:
- **Bukijutsu was not retrofitted onto any other card.** Every
  previously-Taijutsu ability that involves a weapon of any kind
  (Hidan's scythe, Kisame's Samehada, Itachi's shuriken, Sasori's tail/
  senbon/puppet blades, Juzo Biwa's and Yahiko's swords, etc.) **stays
  Taijutsu** — Bukijutsu exists solely for this one card so far. Whether
  any of those deserve reclassification later is an open question, not
  something resolved by this change.
- **The "Physical" umbrella exists so blocking/redirect effects don't
  need updating every time a new Physical sub-type appears.** Anywhere
  a rule or card used to say "a Taijutsu attack" generically as a stand-
  in for "a physical attack" (§9's physical-blocking-vs-Genjutsu rule,
  Asura Path's Mechanized Guard, Preta Path's Absorb Impact, Hiruko's
  Puppet Shell Guard), that wording is now "a Physical attack" instead —
  so those abilities correctly work against Explosive Tag's Bukijutsu
  damage too, without each having needed an individual edit. "Physical"
  is purely a grouping term for other text to reference; no card is
  ever printed with `Type: Physical` itself.

### Lightning Substitution's Taijutsu bonus
The bonus "deal 2 damage to its source" clause is conditioned on the
Type of the ability that just got negated — it checks the *negated
ability's* printed Type (Taijutsu), not the Style or identity of
whichever character or Jutsu card originated it. Per the comma/colon
rules (§6.8a), this bonus clause only exists at all if the main
negation succeeds — there's no scenario where the 2 damage happens
without the targeting having already been negated first, since the
card's own text frames it as "if the negated ability was Type:
Taijutsu." This is a different bonus-structure than Sasori's Iron Sand
Wall or the Pain-deck's redirect abilities (which reduce/redirect
damage rather than negate targeting) — this is a pure negation with an
attached punish, closer in spirit to Deva Path's Shinra Tensei V2 but
with an added counter-attack Shinra Tensei V2 doesn't have.

---

# APPENDIX C — WHAT THE ENGINE ACTUALLY IMPLEMENTS

Generated from the engine's own card registry (so the numbers below are what the build uses), followed by a status list of the printed effects that are simplified or not yet modeled.

## C.1 Registered characters and Hand Deck cards

### Kakuzu — A Rank

HP 6 · Pool capacity 8 · Styles: Earth, Wind, Lightning, Fire · Synergy: Akatsuki

Engine flags: Elemental Versatility (first elemental jutsu each turn −1)

| Ability | Cost | Speed | Style | Type | Damaging | Targets | Target side | Notes |
|---|---|---|---|---|---|---|---|---|
| Earth Grudge Fear | 1 | Normal | None | Taijutsu | yes | 1 | any | — |
| Iron Skin | 5 | Normal | Earth | Ninjutsu | yes | 1 | enemy | — |
| Pressure Damage | 3 | Normal | Wind | Ninjutsu | yes | 2 | enemy | — |
| Searing Migraine | 4 | Normal | Fire | Ninjutsu | yes | 1 | enemy | — |
| False Darkness | 3 | Quick | Lightning | Ninjutsu | yes | 1 | enemy | — |
| Earth Grudge Fear: Patchwork Threads | 0 | Normal | None | Ninjutsu | no | none/auto | — | Ultimate |

### Hidan — B Rank

HP 9 · Pool capacity 1 · Styles: Ritual · Synergy: Akatsuki, Kakuzu

Engine flags: has an End-Phase passive

| Ability | Cost | Speed | Style | Type | Damaging | Targets | Target side | Notes |
|---|---|---|---|---|---|---|---|---|
| Triple Scythe Sweep | variable | Normal | None | Taijutsu | yes | 1 | any | — |
| Curse Technique: Death Controlling Possessed Blood | 6 | Normal | Ritual | Ninjutsu | no | 1 | enemy | Ultimate |

### Deidara — A Rank

HP 10 · Pool capacity 3 · Styles: Explosion, Earth · Synergy: Akatsuki

| Ability | Cost | Speed | Style | Type | Damaging | Targets | Target side | Notes |
|---|---|---|---|---|---|---|---|---|
| Explosive Clay | 1 | Normal | Explosion | Ninjutsu | no | none/auto | — | 3/turn |
| C1, Shi-Wan: Clay Spider | 1 | Normal | Explosion | Ninjutsu | no | none/auto | — | 2/turn |
| Detonation Art | 3 | Normal | Explosion | Ninjutsu | yes | 1 | enemy | — |
| C3, Shi-Suri | 5 | Normal | Explosion | Ninjutsu | yes | 1 | enemy | Ultimate |

### Kisame — S Rank

HP 10 · Pool capacity 12 · Styles: Water · Synergy: Akatsuki, Itachi

Engine flags: has an Upkeep passive

| Ability | Cost | Speed | Style | Type | Damaging | Targets | Target side | Notes |
|---|---|---|---|---|---|---|---|---|
| Samehada Strike | 0 | Normal | Water | Taijutsu | yes | 1 | enemy | — |
| Samehada Strike Evolved | 0 | Normal | Water | Taijutsu | yes | 1 | enemy | — |
| Water Style: Water Prison Jutsu | variable | Normal | Water | Ninjutsu | no | 1 | enemy | — |
| Water Style: Super Shark Bomb Jutsu | variable | Normal | Water | Ninjutsu | yes | 1 | enemy | — |
| Water Style: Thousand Hungry Sharks | variable | Normal | Water | Ninjutsu | yes | 1 | enemy | 2/turn |
| Samehada Shark Transformation | 0 | Normal | None | None | no | none/auto | — | — |

### Itachi — S Rank

HP 11 · Pool capacity 4 · Styles: Fire · Synergy: Akatsuki

Engine flags: max 2 abilities per turn; has an Upkeep passive

| Ability | Cost | Speed | Style | Type | Damaging | Targets | Target side | Notes |
|---|---|---|---|---|---|---|---|---|
| Crow Shuriken Barrage | 2 | Normal | None | Taijutsu | yes | 1 | enemy | — |
| Great Fireball Technique | 3 | Normal | Fire | Ninjutsu | yes | 1 | enemy | — |
| Genjutsu: Mind Prison | variable | Quick | None | Genjutsu | no | 1 | enemy | — |
| Crow Clone | 2 | Reactive | None | Ninjutsu | no | none/auto | — | — |
| Mangekyō Sharingan: Tsukuyomi - Infinite Agony | 7 | Normal | None | Genjutsu | yes | 1 | enemy | Forbidden |
| Amaterasu | 7 | Normal | Fire | Ninjutsu | yes | 1 | enemy | Ultimate |

### Konan — A Rank

HP 11 · Pool capacity 4 · Styles: Paper, Wind, Earth, Water, Yang · Synergy: Akatsuki

Engine flags: has an every-End-Phase effect

| Ability | Cost | Speed | Style | Type | Damaging | Targets | Target side | Notes |
|---|---|---|---|---|---|---|---|---|
| Paper Shuriken Storm | 2 | Normal | Paper | Ninjutsu | yes | 2 | enemy | — |
| Fold Shikigami | 1 | Normal | Paper | Ninjutsu | no | none/auto | — | 2/turn |
| Paper Bomb Tag | 3 | Normal | Paper | Ninjutsu | yes | 1 | enemy | — |
| Paper Clone | 2 | Reactive | Paper | Ninjutsu | no | none/auto | — | — |
| Paper Person of God Technique | 6 | Normal | Paper | Ninjutsu | yes | none/auto | — | Ultimate |

### Sasori (Hiruko) — A Rank

HP 7 · Pool capacity 2 · Styles: Poison · Synergy: Akatsuki, Deidara

| Ability | Cost | Speed | Style | Type | Damaging | Targets | Target side | Notes |
|---|---|---|---|---|---|---|---|---|
| Tail Strike | 3 | Normal | None | Taijutsu | yes | 1 | enemy | — |
| Puppet Shell Guard | 2 | Reactive | None | Taijutsu | no | none/auto | — | — |

### Zetsu — B Rank

HP 7 · Pool capacity unlimited · Styles: None · Synergy: Akatsuki

Engine flags: cannot be pooled into (absorption only); has an Upkeep passive; has an End-Phase passive

| Ability | Cost | Speed | Style | Type | Damaging | Targets | Target side | Notes |
|---|---|---|---|---|---|---|---|---|
| Dual Nature: Switch Mode | 0 | Normal | None | None | no | none/auto | — | 999/turn |
| White Zetsu: Corpse Consumption | 2 | Normal | None | Ninjutsu | no | none/auto | — | shares use w/ "dual-nature-ability" |
| Black Zetsu: Sinister Whisper | 2 | Normal | None | Genjutsu | yes | 1 | enemy | shares use w/ "dual-nature-ability" |
| Combine: Zetsu Golem | 4 | Normal | None | Ninjutsu | no | 5 | ally | — |
| Absorbed Vitality | variable | Normal | None | Ninjutsu | no | 1 | ally | Pool only |
| Spore Technique | 4 | Normal | None | Ninjutsu | no | 1 | enemy | — |
| White Zetsu Army | 5 | Normal | None | Ninjutsu | no | none/auto | — | Ultimate |

### Juzo Biwa — B Rank

HP 9 · Pool capacity 2 · Styles: Water · Synergy: Akatsuki

Engine flags: has an End-Phase passive

| Ability | Cost | Speed | Style | Type | Damaging | Targets | Target side | Notes |
|---|---|---|---|---|---|---|---|---|
| Cleaving Strike | 3 | Normal | None | Taijutsu | yes | 2 | enemy | 2/turn |
| Water Style: Hiding Mist | 2 | Quick | Water | Ninjutsu | no | none/auto | — | — |
| Kubikiribōchō Unleashed | 5 | Normal | None | Taijutsu | yes | 1 | enemy | Ultimate |

### Yahiko — C Rank

HP 8 · Pool capacity 2 · Styles: Water, Fire, Wind · Synergy: Akatsuki, Pain, Konan

Engine flags: Elemental Versatility (first elemental jutsu each turn −1); Inspiring Leader (allies' first ability each turn −1)

| Ability | Cost | Speed | Style | Type | Damaging | Targets | Target side | Notes |
|---|---|---|---|---|---|---|---|---|
| Blade of Resolve | 2 | Normal | None | Taijutsu | yes | 1 | enemy | — |
| Water Release: Water Jet Stream | 3 | Normal | Water | Ninjutsu | yes | 1 | enemy | — |
| Water Release: Water Pillar Wall | 2 | Normal | Water | Ninjutsu | no | none/auto | — | — |
| Rallying Words | 2 | Normal | None | Ninjutsu | no | none/auto | — | — |
| Yahiko Sacrifices Himself | variable | Reactive | None | None | no | 1 | ally | Ultimate |

### pain

*Entered in the deck as a set of tokens (Pain of the Six Paths) — see the Path token abilities in Appendix A.*

### Amegakure Civilian Rebel — D Rank

HP 3 · Pool capacity 1 · Styles: None · Synergy: Akatsuki

| Ability | Cost | Speed | Style | Type | Damaging | Targets | Target side | Notes |
|---|---|---|---|---|---|---|---|---|
| Shinobi Strike | 1 | Normal | None | Taijutsu | yes | 1 | enemy | — |

### Hand Deck cards (50)

| Card | Copies | Kind | Cost | Speed | Style | Type | Normal-speed timing | Targets | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Unshakable Resolve | 2 | mission | 1 | Normal | None | None | Main only | none/auto | — |
| Bingo Book: Threat Level S | 2 | mission | 0 | Normal | None | None | Main only | none/auto | — |
| Bingo Book: Threat Level A | 2 | mission | 0 | Normal | None | None | Main only | none/auto | — |
| Bingo Book: Threat Level B | 2 | mission | 0 | Normal | None | None | Main only | none/auto | — |
| Bingo Book: Threat Level C | 2 | mission | 0 | Normal | None | None | Main only | none/auto | — |
| Squad Formation | 2 | mission | 0 | Normal | None | None | Main only | none/auto | — |
| Emergency Relief | 3 | mission | 0 | Normal | None | None | Main only | none/auto | — |
| Substitution | 3 | jutsu | variable | Reactive | None | Ninjutsu | — | none/auto | cheaper if paid from enabler's Pool |
| Lightning Substitution | 3 | jutsu | variable | Reactive | Lightning | Ninjutsu | — | none/auto | cheaper if paid from enabler's Pool |
| Water Substitution | 3 | jutsu | variable | Reactive | Water | Ninjutsu | — | none/auto | cheaper if paid from enabler's Pool |
| Incoming Mission Assignment | 2 | jutsu | 0 | Normal | None | None | Main only | none/auto | — |
| Chakra Transfer | 2 | jutsu | 0 | Normal | None | Ninjutsu | Main only | 2 (ally) | player chooses amount |
| Field Intelligence | 2 | jutsu | 1 | Normal | None | None | Main only | none/auto | — |
| Deploy Medic Corps | 2 | jutsu | 2 | Normal | None | Ninjutsu | Main only | 1 (ally) | may target a Retreated ally |
| Medical Chakra Infusion | 3 | jutsu | 1 | Normal | None | Ninjutsu | Main only | 1 (ally) | characters only, not tokens |
| Chakra Suppression | 3 | jutsu | 2 | Quick | None | Sealing | — | 1 (enemy) | characters only, not tokens |
| Fire Style: Fireball Jutsu | 1 | jutsu | variable | Normal | Fire | Ninjutsu | Combat only | 3 (any) | Attack-type (once/turn by name); cheaper if paid from enabler's Pool |
| Jutsu Disruption | 2 | jutsu | 2 | Reactive | None | Ninjutsu | — | 1 (any) | — |
| Explosive Tag | 2 | jutsu | 1 | Normal | None | Bukijutsu | Combat only | 2 (enemy) | Attack-type (once/turn by name) |
| Battlefield Selection | 2 | jutsu | 0 | Normal | None | None | Main only | none/auto | — |
| Akatsuki Hideout | 3 | terrain | 2 | Normal | None | None | Main only | none/auto | Synergy: Akatsuki |
| Chidori Interception | 2 | assist | variable | Reactive | Lightning | Ninjutsu | — | none/auto | — |

## C.2 Implementation status by card

**[Updated]** Every character, token and hand card is implemented as printed, with these exceptions only (details and defaults: §20):

**Pain of the Six Paths** — *Banshō Ten'in:* the "pull an enemy closer" movement has no defined meaning on the 2-row board yet (open question, §22); its damage, +1-for-the-turn and can't-be-protected parts work.

**Kakuzu** — *Five Hearts:* the Style lost on each revive follows a fixed order (Fire, Lightning, Wind, Earth) rather than a choice.

**Missions** — *Squad Formation:* selects the first 3 characters; the redirect is a standing choice on the Mission (which member absorbs hits, or Off), since damage can't pause for a live prompt. *Bingo Book A:* its discount applies to the next paid Character Deck draw (§22).

How the rest works in the build, where it isn't obvious from the card:
- **Player choices are asked, never auto-picked:** Detonation Art / Paper Bomb Tag charge spends, Iron Sand Wall's +X, Absorbed Vitality's X, Rampaging Charge's Straight/Bent and side, Patchwork Threads' Style, Self Detonate's spider count, Mission replacement and reward targets, tied Upkeep, look-at-top-X picks.
- **"When it would be defeated" choices** (Death is an Explosion V2, Kakuzu reviving Hidan): the character is held at 0 HP and its controller is asked.
- **Redirects** rewrite the waiting attack's target, and the reduction applies to the new target.
- **Pain's Paths** can be pooled into individually and can spend each other's Pools.

**Jutsu / Assist / Terrain** — see §15.4 and §20.2.

