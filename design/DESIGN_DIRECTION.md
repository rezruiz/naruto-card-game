# Planned Design Direction — Characters vs. Hand Cards

**Status:** recorded 2026-10-05. **Implemented 2026-10-21:** the
Itachi, Deidara, Kakuzu, Hidan, Yahiko and Kisame drafts below (plus the
Genjutsu: Mind Prison and Genjutsu: Crow Clone cards) are now in SPEC.md,
RULES.md and the build. The rest of the direction is still future work.

---

## The shift in one line

Move the game's power and decision-making out of characters' built-in
abilities and into the **hand**: characters get fewer, deliberately weak
base abilities plus their signature Ultimate/Forbidden Technique, while
Jutsu cards become stronger, more conditional, and tied to **Style**.

---

## Characters

- **At most 4 abilities per character.** Their identity lives in the
  **Ultimate / Forbidden Technique**, plus **2–3 base abilities**.
- **Base abilities are intentionally a bad rate.** They're effectively a
  free card every turn that a player can choose instead of a card from
  hand, so they should be clearly weaker than playing a real card.
- **Strength still scales with Rank**, and **lower Ranks may have fewer
  abilities**.
- **Nerf current base abilities across the board** as part of the
  redesign.
- **Some current abilities become hand cards.** Example: Itachi's Genjutsu
  stun (Mind Prison) becomes a Jutsu card rather than a built-in ability.

### Pain (idea)

Possibly rework Pain to enter as **Deva Path only**, with a **one-time
summon ability** that brings in the other Paths.

---

## Jutsu cards

- **More powerful and more conditional** — redesigned to be impactful,
  with better conditions and more relevance to the board.
- **Style matters much more.** A Jutsu's Style decides how well it works
  in the hands of the character using it:
  - **Any Jutsu can always be used** — even without a matching
    character, as if a low-level filler shinobi performs it in support.
  - **A character whose Style matches** uses it **better**: cheaper,
    and/or with a stronger effect. Each card can tune this — cost, effect,
    or both.
  - **Some cards strictly require** a matching character (100% synergy
    needed) — those can't be played without one.
  - This gives a lot of room for balancing card by card.

---

## Finding cards

- **More cards that find cards**, especially Style-aware ones. Example:
  *"Search the top X cards of your deck for Jutsu cards and add up to 2
  Jutsu cards of a Style matching a character you have in play to your
  hand."*
- **Possible base rule — scout on entry:** when a character enters play,
  look at the top X cards of your deck (around 5–6, possibly set per
  character) for a Jutsu of its Style.
- **Starting hand likely becomes 7** (currently 6), since hand cards
  carry more of the game.

---

## Redesign drafts

Working drafts of redesigned cards — **not in the game yet.**

### Itachi Uchiha — S *(draft 4)*

**HP 11 · Pool 4 · Tactician / Assault · Styles: Fire · Synergy: Akatsuki**

- **Trait — Sharingan Foresight:** whenever an enemy targets Itachi with a
  Quick ability or Quick Jutsu, prevent 1 damage from it.
- **Trait — Genjutsu Master:** Genjutsu cards Itachi enables cost 1 less
  (minimum 1).
- **Trait — Failing Health:** Itachi can use at most 2 abilities each
  turn, and can't use his Ultimate and his Forbidden Technique in the same
  turn.
- **Crow Shuriken Barrage** — 2, Style: None, Taijutsu: deal 1 damage.
- **Fire Release: Great Fireball** — 4, Fire, Ninjutsu: deal 2 damage.
- **Ultimate — Amaterasu** — 8, Fire, Ninjutsu: deal 3 damage to target
  enemy, plus 1 more at the start of each of your next 3 Upkeeps. Damage
  can't be reduced.
- **Forbidden — Mangekyō Sharingan: Tsukuyomi - Infinite Agony** — 8,
  Style: None, Genjutsu: the target must not have dealt more than 6 damage
  to Itachi this game. It takes 5 damage and is stunned for the next turn
  cycle.

**Moved to the Jutsu Deck as Jutsu cards:**

- **Genjutsu: Mind Prison** — Quick, Style: None, Type: Genjutsu,
  5 Chakra (**3** if a Genjutsu user — a character with a Genjutsu
  ability — enables it). Stun target enemy character for its controller's
  turn (through their next turn, or the rest of the current one if cast
  during their turn): no abilities, no pooling, no Jutsu cards.
- **Genjutsu: Crow Clone** — Quick, Style: None, Type: Genjutsu,
  2 Chakra. **Itachi only** — can only be played with Itachi enabling it.
  Negate all targeting of Itachi and all new damage to him for the rest of
  this turn.

*Nuance log (reference only — not card text):*
- **Crow Clone and lingering damage:** lingering damage already attached
  to Itachi (burns, Poison, scheduled ticks) still lands — it isn't new
  damage and doesn't retarget (SPEC §9).

### Deidara — A *(draft 4)*

**HP 10 · Pool 3 · Assault · Styles: Explosion, Earth · Synergy: Akatsuki**

- **C1, Shi-Wan: Clay Spider** — 1, Explosion, Ninjutsu: create a Clay
  Spider token and gain 1 Clay Charge. Usable up to 2 times per turn.
- **Detonation Art** — 4, Explosion, Ninjutsu: deal 1 damage. Spend 1 Clay
  Charge → deal 3 instead.
- **Ultimate — C3, Shi-Suri** — 7, Explosion, Ninjutsu: needs a full Pool
  (may be spent as part of the cost) and 5 Clay Charges, spent. Deal 4
  damage to 1 target, plus 3 in a cross pattern from it.
- **Forbidden — Death is an Explosion** — Explosion, Ninjutsu, two
  versions (one Forbidden Technique):
  - **Version 1** — 5 Chakra + entire Pool (must be full) + 4 Clay
    Charges. Deidara at 3 HP or less. Deal 7 to all enemies, 3 to all
    allies. Deidara dies.
  - **Version 2** (Reactive) — 6 Chakra + entire Pool (must be full) +
    4 Clay Charges. When Deidara would be defeated, activate this
    instead. Deal 7 to all enemies, 5 to all allies. Deidara dies.

**Clay Spider Token** (HP 1) — fizzles if Deidara dies; max 5 in play;
Ambush (no Field Orientation).
- **Self Detonate** — 3, Quick, Explosion, Ninjutsu: any number of your
  Clay Spiders detonate against 1 target for 1 damage each; they're
  destroyed. Usable any number of times per turn.
- **Combine** — Explosion, Ninjutsu: 4 Clay Spiders revert to clay and are
  destroyed, generating 2 Clay Charges.

### Kakuzu — A *(draft 3)*

**HP 4 · Pool (Hearts − 1) × 2, starts at 8 · Assault / Vanguard · Styles:
Earth, Wind, Lightning, Fire · Synergy: Akatsuki**

- **Trait — Five Hearts:** whenever Kakuzu would be defeated with more than
  1 Heart remaining, he instead loses 1 Heart, a Style, and revives;
  losing his last Heart defeats him for good. Chakra Pool Capacity =
  (current Hearts − 1) × 2.
- **Trait — Elemental Versatility:** the first elemental jutsu each turn
  costs 1 less.
- **Trait — Heart Masks:** when Kakuzu enters play, search your Jutsu Deck
  for Pressure Damage, Searing Migraine and False Darkness and add them to
  your hand.
- **Earth Grudge Fear** — 2, Style: None, Taijutsu: deal 1 damage to any
  target.
- **Iron Skin** — 5, Earth, Ninjutsu: for the next turn cycle, Kakuzu
  takes −2 damage from physical attacks and −2 from elemental attacks,
  and Earth Grudge Fear deals +2 damage.
- **Ultimate — Earth Grudge Fear: Patchwork Threads** — 2 Chakra from
  Pool, Style: None, Ninjutsu. Trigger: whenever Kakuzu defeats any
  shinobi. Regenerate 1 Heart, heal 3 HP, gain 2 Chakra to his Pool, and
  gain 1 elemental Style from the defeated character (your choice if
  several), even one he already has.

**Jutsu Deck cards:**

- **Pressure Damage** — Normal, Wind, Ninjutsu, 3 Chakra. Deal 2 damage
  to up to 2 enemy characters.
- **Searing Migraine** — Normal, Fire, Ninjutsu, 3 Chakra.
  Deal 4 damage.
- **False Darkness** — Quick, Lightning, Ninjutsu,
  2 Chakra. Deal 2 damage.

*Nuance log (reference only — not card text):*
- **Heart Masks search:** finds 1 copy of each card still in the Jutsu Deck
  (any already drawn are skipped), then the Jutsu Deck is shuffled. It
  triggers whenever Kakuzu enters play, including as the starting
  character.
- **Elemental Versatility** applies to elemental Jutsu cards Kakuzu
  enables, as well as his own elemental abilities.
- **Duplicate Styles:** a second copy of a Style (from Patchwork Threads)
  means losing a Heart can take that copy instead of his only one.

### Hidan — B *(draft 4)*

**HP 9 · Pool 1 · Vanguard / Assault · Styles: Ritual · Synergy: Akatsuki,
Kakuzu**

- **Trait — Jashin's Blessing:** first defeat: survives at 1 HP instead.
  Regenerates 1 HP each End Phase (2 while his Ultimate is active), capped
  at max HP. If Kakuzu is in play when Hidan would instead be truly
  defeated, Kakuzu may spend his full Chakra Pool (must be at capacity)
  and stun himself through his controller's next turn to revive Hidan at
  3 HP instead.
- **Triple Scythe Sweep** — 3, Style: None, Taijutsu: deal 1 damage.
- **Ultimate — Curse Technique: Death Controlling Possessed Blood** — 6,
  Ritual, Ninjutsu. Target an enemy Hidan has already damaged; it becomes
  Cursed until Hidan or the Cursed enemy is defeated. While active: Triple
  Scythe Sweep costs 1 and may target Hidan himself, dealing the Cursed
  enemy 1 extra damage; all damage Hidan takes is mirrored onto the Cursed
  enemy; Hidan can't be targeted by friendly attacks; damage he deals
  himself can't drop him below 3 HP.
  One Cursed enemy at a time.

### Yahiko — C *(draft 1)*

**HP 8 · Pool 2 · Tactician / Support · Styles: Water, Fire, Wind ·
Synergy: Akatsuki, Pain, Konan**

- **Trait — Inspiring Leader:** the first ability your other Akatsuki
  characters use each turn costs 1 less Chakra (minimum 1).
- **Trait — Elemental Versatility:** the first elemental jutsu each turn
  costs 1 less.
- **Blade of Resolve** — 4, Style: None, Taijutsu: deal 2 damage.
- **Water Release: Water Pillar Wall** — 3, Water, Ninjutsu: prevent the
  next 2 damage dealt to Yahiko this turn.
- **Rallying Words** — 2, Style: None, Ninjutsu: each ally's next attack
  this turn deals 1 additional damage.
- **Ultimate — Yahiko Sacrifices Himself** — Reactive, 2 Chakra + Yahiko's
  entire Pool, no Style, no Type. Your opponent must control at least 2
  more characters than you (tokens count on both sides). In response to a
  targeted attack on one of your other characters that would defeat it
  (after damage reductions), all of that damage goes to Yahiko instead;
  the original target takes none. Blanket or untargeted effects can't
  trigger this.

### Kisame, Tailless Tailed Beast — S *(draft 1)*

**HP 10 · Pool 12 · Assault / Tactician · Styles: Water · Synergy:
Akatsuki, Itachi**

- **Trait — Samehada:** absorbed Chakra is stored in Kisame's Chakra Pool;
  Chakra absorbed past his Pool's capacity becomes generic Chakra instead.
- **Trait — Samehada Fusion:** once Samehada absorbs 6 Chakra, Kisame may
  enter Samehada Shark Transformation: +6 Pool, +6 max HP (16 total),
  Water Style attacks +1 damage and −1 cost (Samehada Strike disabled),
  attackers targeting him pay +1 Chakra. Exits after taking 7+ damage
  while transformed, or at Upkeep with 3 or less in his Pool.
- **Samehada Strike** — 2 Chakra from Pool, Taijutsu: deal 1, Absorb 3.
- **Samehada Strike Evolved** — 2 Chakra from Pool, Taijutsu. Requires 9+
  Chakra absorbed and 6+ pooled. Deal 2, Absorb 4.
- **Water Style: Water Prison Jutsu** — 4, Ninjutsu. The target must be a
  lower Rank. Through the next 3 turns (or until Kisame takes damage), it
  can't use abilities that target a character.
- **Water Style: Super Shark Bomb Jutsu** — 4, Ninjutsu. Requires 4+
  Chakra absorbed and 3+ pooled. Deal 1 damage, +1 per Chakra pooled on
  the target. The target loses pooled Chakra equal to half the damage
  dealt (rounded down).
- **Water Style: Thousand Hungry Sharks** — 5, Ninjutsu. Can be used
  twice per turn while in Samehada Shark Transformation. Deal 4 damage.

---

## Open questions for when this starts

1. The exact discount and/or effect boost for a Style match — a standard
   amount, or always set per card?
2. Scout on entry: fixed X, or per character (and per Rank)? Take one
   Jutsu or up to N? Does it apply to the starting character and to
   tokens?
3. How the current "enabling character" rule (Style-matching character
   needed to play a technique Jutsu) changes now that any Jutsu can be
   used without one.
4. Which current character abilities move into the Jutsu Deck as Jutsu
   cards, and which are cut.
5. The 7-card starting hand and the mulligan counts (7 / 6 / 5 …).
6. How the preset decks (50-card Jutsu Deck, 13-card Character Deck) are
   rebuilt around the new card pool.
