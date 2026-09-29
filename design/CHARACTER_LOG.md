# Character Log — Nuanced Ability Context

**Purpose:** the character cards in `design/SPEC.md` §13 (and, as of the
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
