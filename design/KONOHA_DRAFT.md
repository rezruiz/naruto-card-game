# Konoha Starter Deck — Design Draft

**Status:** working draft for editing. Design planning only — nothing here is implemented, and none of it is in `SPEC.md` or `RULES.md` yet. Numbers are first-pass and meant to be tuned.

**Format:** each card follows the SPEC.md card template (Rank, HP, Pool Capacity, Roles, Styles, Synergy, Traits, Abilities, Ultimate). Costs are Chakra. Speed is Normal unless marked. Under the current timing rules, **damaging Normal-speed abilities are Combat-only**; non-damaging (support) abilities are Main Phase. Quick and Reactive abilities follow their own timing.

---

## Decisions log

**Confirmed**
1. **Evolution rules.** An evolved form uses its **evolved Rank for everything** — upkeep, Retreat cost, Health lost on defeat, rank-comparison effects. **Deck caps use the printed Rank.** (So Naruto going C → A raises the Health he costs you when defeated from 3 to 5; that risk pays for his power.)
2. **Shadow is a new Style, marked as a *kekkei genkai*** (like Explosion) for flavor.
3. **Every character has an Ultimate.** C-Rank Ultimates don't need to be strong.
4. **A Konoha Terrain and Missions are drafted** (Part 3).

**On hold — do not resolve yet**
- **Choji's Calorie Reserve** bypasses "pooling taps the character." Keep as written, or limit it?
- **Sasuke / Naruto / Choji evolution numbers** (the HP drain and stat boosts) vs. Akatsuki power level.
- **Kamui (Kakashi)** — a free Retreat on an ally, leaning on the Retreat immunity rule.

**Proposed defaults awaiting a look (not yet confirmed)**
- Evolving is not "entering play," so it does **not** reset Field Orientation.
- Evolving takes effect immediately; the new Rank's upkeep applies at your next Upkeep.

---

## Part 1 — Deck shape

| Rank | Count | Cap (SPEC §2) |
|---|---|---|
| S | 3 — Jiraiya, Tsunade, Hiruzen | ≤ 3 ✓ |
| A | 3 — Kakashi, Guy, Asuma | ≤ 4 ✓ |
| B | 4 — Neji, Shikamaru, Lee, Sasuke | ≤ 4 ✓ (at the cap) |
| C | 5 — Sakura, Naruto, Hinata, Choji, Ino | no cap |
| **Total** | **15** | 12–18 ✓ |

Evolving characters (Jiraiya S→SS, Sasuke B→A, Naruto C→A, Choji C→B) count at their **printed** Rank for the caps above.

**Synergy tags:** everyone carries **Konoha** (drives the upkeep discount). Extra tags are for card-specific bonuses: **Sannin**, **Sarutobi**, **Team 7**, **Team Guy**, **Team 10**, **Hyuga**, plus family tags **Uchiha**, **Nara**, **Akimichi**, **Yamanaka**.

**Signature mechanics:** Jiraiya — toad summons, Sage Mode · Tsunade — Byakugō Seal · Hiruzen — Five-Element Mastery · Kakashi — Copy Counters · Guy/Lee — Gates · Asuma — Team 10 Leader · Neji/Hinata — Gentle Fist (drain Pool) · Shikamaru — Shadow bind · Sasuke/Naruto/Choji — Evolutions · Choji — Calories · Ino — Mind Transfer.

**Keyword: Evolution.** A printed, one-way Form change triggered by a listed condition (and any listed cost). The card keeps its identity, damage, Pool contents and status; it gains the Form's stat changes and abilities, and its Rank becomes the Form's Rank (see Decisions #1).

---

## Part 2 — Characters

### S Rank

#### Pervy Sage Jiraiya — S
**HP 11 · Pool 5 · Tactician / Assault · Styles: Fire · Synergy: Konoha, Sannin**
*Revised: a lean base kit — hair technique, fire, Rasengan and toad summons — with Sage Mode as his Evolution. No traits, no Oil, no anti-Retreat effects.*
- **Wild Lion's Mane** — two versions; choose one each time you use it:
  - **V1 (offensive)** — 2, Style: None, Ninjutsu: deal 2 damage to a target and 1 to one character adjacent to it.
  - **V2 (defensive)** — 2, Reactive, Style: None, Ninjutsu: in response to a Ninjutsu or Physical attack on Jiraiya, prevent 2 of its damage; a Taijutsu attacker takes 1. Doesn't work vs Genjutsu (§9 physical-blocking rule).
- **Fire Release: Flame Bullet** — 2, Quick, Fire, Ninjutsu: deal 2 damage.
- **Rasengan** — 3, Style: None, Ninjutsu: deal 4 damage.
- **Summoning: Toads** — Main, Ninjutsu: create one Toad token of your choice, cost by toad (below). Only 1 of each Toad in play, and only 1 of the three boss toads (Gamabunta, Gamaken, Gamahiro) at a time. All Toads fizzle if Jiraiya is defeated.
  - **Gamabunta, Toad Boss** — 5 Chakra · HP 7. *Sword Slash* — 2, Taijutsu: deal 3 damage.
  - **Gamaken** — 4 Chakra · HP 7. *Shield Guard* — 1, Reactive, Taijutsu: redirect a targeted Ninjutsu or Physical attack aimed at Jiraiya onto Gamaken, reduced by 1 (min 0). *Jitte Strike* — 1, Taijutsu: deal 1 damage.
  - **Gamahiro** — 4 Chakra · HP 5. *Twin Blades* — 2, Taijutsu: deal 2 damage to up to 2 different enemy characters.
- **Ultimate — Toad Oil Flame Bullet (Combination)** — 6, Fire: needs Gamabunta in play. Deal 5 damage to a target and 2 to each character adjacent to it (cross pattern).
- **Evolution — Sage Mode (SS Rank)** — 0, Main: needs a full Pool, and spends all of it (he sits still to gather natural energy). **Once per game** — after he exits Sage Mode, he can't enter it again. See the Sage Mode form below.
- *Note:* no Forbidden Technique proposed.

#### Jiraiya, Sage Mode — Evolution form (SS)
**+4 max HP (heals 4) · +3 Pool capacity (Pool 8) · Rank SS** — lasts until Fukasaku & Shima are defeated (an exception to Evolution being one way). Everything on the base card stays; this adds the following. As an SS character he costs SS upkeep and loses you 9 Health if defeated (Decisions #1); the deck cap still counts him as S.
- **On evolving — the Two Great Sage Toads:** create the **Fukasaku & Shima** token (HP 6, front row, max 1). They ride on his shoulders and power his Sage techniques. They fizzle if Jiraiya is defeated.
- **Trait — Sage Art: Amphibian Technique:** Fukasaku & Shima sustain Sage Mode. If they're defeated, Jiraiya **exits Sage Mode**: he returns to his base form (S Rank, max HP 11, Pool capacity 5, Toad Oil Flame Bullet as his Ultimate). His current HP and Pool are cut down to the base limits if they're over.
- **Trait — Sage Shield:** whenever damage would be dealt to Fukasaku & Shima — including splash or other indirect damage where they aren't the primary target — you may redirect that damage to Jiraiya instead. Redirected damage is subject to Jiraiya's own damage reduction (e.g. Sage Body).
- **Trait — Sage Body:** Jiraiya takes 1 less damage from all sources (min 1).
- **Trait — Sage Power:** his Ninjutsu deal +1 damage, and his Toads get +2 max HP and +1 damage while he's in Sage Mode.
- **Sage Art: Ultra-Big Ball Rasengan** — 5, Style: None, Ninjutsu: deal 5 damage to a target and 2 to each character adjacent to it (cross pattern). (Sage Power's +1 applies to each hit.)
- **Demonic Illusion: Toad Confrontation Chant** — 6, Style: None, Genjutsu: needs Fukasaku & Shima in play. Stun up to 3 enemy characters through their controller's next turn (no pooling, no abilities or Jutsu cards). Physical blockers can't stop it. Afterwards the chant can't be used again for 3 turn cycles.
- **Ultimate — Sage Art: Goemon (Frying Pan World)** — 6, Fire, Ninjutsu: needs Fukasaku & Shima in play (Jiraiya's oil, Fukasaku's wind, Shima's fire). Deal 4 damage to every enemy character (5 with Sage Power). Replaces Toad Oil Flame Bullet as his Ultimate.
- *Note:* no Forbidden Technique proposed.

#### Lady Tsunade, Fifth Hokage — S
**HP 10 · Pool 8 · Support / Vanguard · Styles: None · Synergy: Konoha, Sannin**
- **Trait — Byakugō Seal:** at your Upkeep, if her Pool is full, she heals 2. Her stored Chakra powers her big heals.
- **Trait — Medical Ninjutsu:** her healing abilities cost 1 less (min 1).
- **Mitotic Healing** — 2, Ninjutsu (Main): heal an ally 3.
- **Chakra Scalpel** — 2, Taijutsu: deal 2 damage, and reduce the target's Pool by 1.
- **Heavenly Kick of Pain** — 4, Taijutsu: deal 4 damage and 2 to one adjacent character.
- **Katsuyu Split** — 3, Reactive, Ninjutsu: in response to damage aimed at an ally, prevent 2 of it and heal that ally 1.
- **Ultimate — Creation Rebirth** — 6: needs a full Pool, and spends it. Heal every ally 4 and cure Disabled.
- *Open:* a Forbidden version (heal everyone to full at a Health cost) is left out; add if wanted.

#### Lord Third Hiruzen Sarutobi — S
**HP 9 · Pool 6 · Tactician / Support · Styles: Fire, Earth, Water, Wind, Lightning · Synergy: Konoha, Sarutobi**
- **Trait — Professor:** the first ability of each different Style he uses each turn costs 1 less (min 1). A bigger Elemental Versatility; makes him the flexible all-rounder.
- **Fire: Dragon Flame Bullet** — 3, Fire: deal 3.
- **Earth: Earth Wall** — 2, Reactive, Earth: prevent the next 3 damage to an ally.
- **Water: Water Dragon** — 3, Water: deal 2 damage, and the target's abilities cost +1 this turn.
- **Wind: Great Breakthrough** — 2, Wind: deal 2 damage.
- **Summoning: Enma** — 4 (Main): create an Enma token (HP 4; ability Adamantine Staff, 2, deal 3).
- **Ultimate — Five Elements Mastery** — 5: use one ability of each of 3 different Styles this turn for 0 Chakra.
- **Forbidden — Reaper Death Seal** — 7: needs Hiruzen at 4 HP or less. Deal 5 to a target, drain its whole Pool, and it can't use Ultimates or Forbidden Techniques for 3 turn cycles. Hiruzen is defeated.

### A Rank

#### Kakashi, the Copy Cat Ninja — A
**HP 8 · Pool 4 · Assault / Tactician · Styles: Lightning · Synergy: Konoha, Team 7**
- **Trait — Sharingan Copy:** whenever an enemy ability (not an Ultimate or Forbidden Technique) targets one of your characters, Kakashi gains 1 **Copy Counter** (max 3).
- **Trait — Copy Ninja:** spend a Copy Counter to add 1 damage to his next damaging ability this turn.
- **Lightning Blade (Chidori)** — 3, Lightning: deal 3 damage.
- **Kamui** — 3, Reactive, Ninjutsu: in response to an attack on an ally, that ally becomes Retreated for free until your next Untap, so the attack fails to target. It returns without Field Orientation. It can't be used on your last non-Retreated character. *(On hold — see Decisions.)*
- **Earth: Mud Wall** — 2, Reactive, Earth: prevent the next 2 damage to Kakashi.
- **Ultimate — Kamui Raikiri** — 6: needs 2 Copy Counters. Deal 5 damage that can't be reduced.

#### Leaf's Noble Green Beast, Might Guy — A
**HP 10 · Pool 2 · Assault / Vanguard · Styles: None · Synergy: Konoha, Team Guy**
- **Trait — Eight Inner Gates:** Guy has **Gate** counters (0–5 under normal rules).
- **Open a Gate** — 0, Main: gain 1 Gate and take 1 damage. Once per turn.
- **Trait — Youth:** each Gate gives his Taijutsu +1 damage.
- **Leaf Hurricane** — 2, Taijutsu: deal 2 damage.
- **Dynamic Entry** — 1, Taijutsu: deal 1 damage, and the target can't Retreat this turn.
- **Morning Peacock** — 4, Taijutsu: needs 3 Gates. Deal 4 damage to a target and to the character left or right of it.
- **Ultimate — Evening Elephant** — 5: needs 4 Gates. Deal 6 damage; Guy takes 2.
- **Forbidden — Night Guy (Eighth Gate)** — 7: needs 5 Gates. Deal 9 damage that can't be reduced. Guy is defeated.

#### Captain Asuma Sarutobi — A
**HP 9 · Pool 3 · Vanguard / Support · Styles: Wind, Fire · Synergy: Konoha, Team 10, Sarutobi**
- **Trait — Team 10 Leader:** each Team 10 ally's first ability each turn costs 1 less (min 1). Like Yahiko's Inspiring Leader, limited to the team.
- **Trait — Chakra Blades:** his Taijutsu abilities count as Wind for any Style-conditional text.
- **Chakra Blade Slash** — 2, Taijutsu: deal 3 damage.
- **Wind: Air Bullet** — 2, Wind: deal 2 damage.
- **Ash Pile Burning** — 4, Fire: needs a Wind ability used earlier this turn. Deal 4 damage and 2 to each adjacent character.
- **Sensei's Guard** — 2, Reactive: in response to an attack on a Team 10 ally, prevent 2 damage to it.
- **Ultimate — Burning Ash: Final Blaze** — 5: deal 3 damage to every enemy character.

### B Rank

#### Neji Hyuga (Kid) — B
**HP 8 · Pool 3 · Assault / Tactician · Styles: None · Synergy: Konoha, Team Guy, Hyuga**
- **Trait — Byakugan:** coin-flip evasion effects (Juzo's Hiding Mist and similar) don't work against Neji's abilities.
- **Trait — Gentle Fist:** his damaging abilities also reduce the target's Pool by 1.
- **Gentle Fist Strike** — 2, Taijutsu: deal 2 damage.
- **Eight Trigrams Palm Rotation** — 3, Reactive, Ninjutsu: in response to a Ninjutsu or Physical attack on Neji, prevent all of its damage.
- **Ultimate — Eight Trigrams: Sixty-Four Palms** — 5: deal 4 damage and drain the target's entire Pool.

#### Shikamaru Nara (Kid) — B
**HP 7 · Pool 4 · Tactician · Styles: Shadow (kekkei genkai) · Synergy: Konoha, Team 10, Nara**
- **Trait — Strategist:** his Reactive and Quick abilities cost 1 less (min 1).
- **Shadow Possession** — 2, Quick, Shadow: target enemy can't activate Normal-speed abilities until end of turn.
- **Shadow Stitching** — 3, Shadow: deal 2 damage, and the target can't Retreat.
- **Shadow Neck Bind** — 3, Shadow: deal 2 damage to a target that Shadow Possession is holding.
- **Ultimate — Shadow Imitation Strangle** — 5: the target is stunned through its controller's next turn and takes 3 damage.

#### Rock Lee (Kid) — B
**HP 9 · Pool 1 · Vanguard / Assault · Styles: None · Synergy: Konoha, Team Guy**
- **Trait — Taijutsu Prodigy:** his Taijutsu abilities cost 1 less (min 1).
- **Trait — No Ninjutsu:** he can't use Ninjutsu or Genjutsu abilities, and his Pool can't exceed 1.
- **Leaf Whirlwind** — 1, Taijutsu: deal 2 damage.
- **Loosen the Weights** — 0, Main: Lee takes 2 damage, and his Taijutsu deals +2 this turn.
- **Primary Lotus** — 4, Taijutsu: deal 5 damage; Lee takes 2.
- **Ultimate — Hidden Lotus (Fifth Gate)** — 5: deal 7 damage; Lee is left at 1 HP.

#### Sasuke Uchiha (Kid) — B, Curse Mark Evolution → A
**HP 8 · Pool 3 · Assault · Styles: Fire, Lightning · Synergy: Konoha, Team 7, Uchiha**
- **Trait — Sharingan:** his first Fire or Lightning ability each turn costs 1 less.
- **Fireball Jutsu** — 2, Fire: deal 3 damage.
- **Chidori** — 3, Lightning: deal 3 damage; if the target used an ability this turn, deal 4.
- **Lion's Barrage** — 2, Taijutsu: deal 2 damage.
- **Ultimate — Chidori Sharp Spear** — 6: deal 5 damage to a target and 2 to one adjacent character. *(Evolved: 7 and 3.)*
- **Evolution — Curse Mark (A Rank)** — 0, Main: needs Sasuke at half HP or less. He becomes an A-Rank character with +3 max HP and +2 Pool capacity, and his damage is +1. At your End Phase he loses 1 HP. One way. *(Numbers on hold — see Decisions.)*

### C Rank
*(C-Rank Ultimates are intentionally modest.)*

#### Sakura Haruno (Kid) — C
**HP 7 · Pool 2 · Support / Vanguard · Styles: None · Synergy: Konoha, Team 7**
- **Trait — Chakra Control:** her healing abilities cost 1 less (min 1), and heal +1 if Tsunade is in play.
- **Palm Healing** — 1, Ninjutsu (Main): heal an ally 2.
- **Cha! Punch** — 2, Taijutsu: deal 2 damage.
- **Chakra-Enhanced Strike** — 3, Taijutsu: deal 3 damage, and the target can't be healed this turn.
- **Ultimate — Inner Sakura: Shannaro!** — 4: deal 3 damage and heal an ally 1.
- *Note:* as a C-Rank starting character she'd get +2 Chakra pooled into her each Upkeep.

#### Naruto Uzumaki (Kid) — C, Nine-Tails Chakra Evolution → A
**HP 7 · Pool 3 · Assault · Styles: None · Synergy: Konoha, Team 7**
- **Trait — Shadow Clone Jutsu:** he can create Shadow Clone tokens (HP 1, max 3, front row). They fizzle if Naruto is defeated.
- **Shadow Clone Jutsu** — 2, Ninjutsu (Main): create 2 clones.
- **Naruto Barrage** — 2, Taijutsu: deal 1 damage per clone in play (min 1, max 4).
- **Rasengan** — 3, Ninjutsu: deal 3 damage, or 4 if you sacrifice a clone.
- **Ultimate — Uzumaki Barrage** — 4: needs 2 clones; sacrifice both. Deal 4 damage. *(Evolved — Nine-Tails Chakra Claw: deal 6 damage and heal 2.)*
- **Evolution — Nine-Tails Chakra Cloak (A Rank)** — 0, Main: needs Naruto at 3 HP or less, or an ally defeated this turn. He becomes an A-Rank character with +4 max HP and +3 Pool capacity, regains 1 Chakra each Upkeep, and loses 1 HP at your End Phase. *(Numbers on hold.)*

#### Hinata Hyuga (Kid) — C
**HP 6 · Pool 3 · Support / Assault · Styles: None · Synergy: Konoha, Hyuga**
- **Trait — Byakugan and Gentle Fist:** same as Neji.
- **Trait — Devotion:** while Naruto is in play, her abilities cost 1 less (min 1).
- **Twin Lion Fists** — 2, Taijutsu: deal 2 damage and reduce the target's Pool by 1.
- **Protective Eight Trigrams Palm** — 2, Reactive: prevent 2 damage to an ally (3 if the ally is Naruto).
- **Ultimate — Lion Barrage** — 4: deal 3 damage and reduce the target's Pool by 2.

#### Choji Akimichi (Kid) — C, Butterfly Choji Evolution → B
**HP 9 · Pool 3 · Vanguard · Styles: None · Synergy: Konoha, Team 10, Akimichi**
- **Trait — Calorie Reserve:** whenever you place a Chakra source (Consuming a card), Choji gains 1 Pool Chakra. *(Bypasses pooling's tap rule — on hold.)*
- **Human Boulder** — 2, Taijutsu: deal 2 damage, or 3 if Choji's Pool is 3 or more.
- **Partial Expansion** — 2, Reactive: prevent the next 2 damage to Choji.
- **Meat Tank** — 3, Taijutsu: deal 3 damage, and Choji heals 1.
- **Ultimate — Human Boulder Roll** — 4: deal 3 damage to a target and 1 to each adjacent character. *(Evolved — Butterfly Bombardment: 5 and 2.)*
- **Evolution — Butterfly Choji (B Rank)** — 0, Main: costs a red pill (Choji takes 3 damage) and needs at least 4 HP. He becomes a B-Rank character with +3 max HP and +2 Pool capacity, and his Taijutsu deals +1. He loses 1 HP at your End Phase. *(Numbers on hold.)*

#### Ino Yamanaka (Kid) — C
**HP 6 · Pool 3 · Support / Tactician · Styles: None · Synergy: Konoha, Team 10, Yamanaka**
- **Trait — Ino-Shika-Cho:** while Shikamaru and Choji are both in play, Ino's abilities cost 1 less (min 1).
- **Mind Transfer Jutsu** — 3, Quick, Ninjutsu: choose an enemy character; until end of turn, you choose the target of its next ability instead of its controller.
- **Mind Destruction** — 2, Genjutsu: deal 2 damage. Physical blockers can't stop it.
- **Sensory Relay** — 1, Main: look at your opponent's hand (you don't reveal yours).
- **Ultimate — Mind Transfer: Full Control** — 4: choose an enemy character; its next ability this turn, if it costs 3 or less and isn't an Ultimate or Forbidden Technique, is used by you and you choose its target.

---

## Part 3 — Konoha Hand Deck (Terrain, Missions, Assist)

The Akatsuki Hand Deck is 12 Missions + 9 Substitution-family + 14 other Jutsu + 3 Terrain + 2 Assist = 40. Konoha mirrors that shape with its own Terrain, Missions and Assist, and reuses the neutral (non-faction) Jutsu.

### Terrain

**Hidden Leaf Village** — Synergy: Konoha, 0 Chakra. Konoha-Synergy characters you control have their Upkeep reduced by 1 (minimum 0). *(Mirror of Akatsuki Hideout; flavor: home ground.)*

*Alternative for later, if you want the two factions' Terrain to feel different:* **Training Ground 44** — Synergy: Konoha, 0 Chakra. Once each turn, the first ability of a Konoha character costs 1 less (minimum 1). This would stack with Sasuke/Hiruzen-style first-ability discounts, so it needs a look before use.

### Missions (six)

Konoha's Missions lean on **teams** and **the Will of Fire** rather than defeating ranked enemies (that's the Akatsuki Bingo Book identity).

1. **Team 7 Mission** — 0 Chakra. *Condition:* control at least 3 characters with the **Team 7** Synergy at the start of your Upkeep. *Reward:* heal each Team 7 character you control 2, and the next ability each of them uses this turn deals +1 damage if it deals damage.
2. **Team Guy Mission** — 0 Chakra. *Condition:* control at least 2 **Team Guy** characters at the start of your Upkeep. *Reward:* Guy gains 1 Gate (if in play), and heal each other Team Guy character 2.
3. **Ino-Shika-Cho Formation** — 0 Chakra. *Condition:* control Ino, Shikamaru and Choji at the same time. *Reward:* draw 2 cards, and each of those three characters' next ability this turn costs 1 less (minimum 1).
4. **Chunin Exams** — 1 Chakra. *Condition:* reach your 4th Untap Phase after this was played without any character you control being defeated. *Reward:* heal a character of your choice 4 and add 3 Chakra to its Pool (it may temporarily exceed capacity, as with Unshakable Resolve).
5. **Regroup** — 0 Chakra. *(Can be played face down; reveal when its Condition is met.)* *Condition:* a character you control returns from Retreat. *Reward:* heal that character 3 and draw a card.
6. **Will of Fire** — 0 Chakra. *(Can be played face down; reveal when its Condition is met.)* *Condition:* a Konoha character you control is defeated. *Reward:* your next reinforcement costs 3 less, and you heal a character of your choice 2.

*Design note:* Regroup and Will of Fire are the face-down cards, matching the Bingo Book's secret-objective feel. The "Auto-choices" the engine uses for the Akatsuki Missions (first character in play, oldest Mission replaced) would apply here too.

### Assist card

**Guard Assist: Iruka Umino, Konoha** — Style: None (informational only; Assist cards ignore enabling requirements), Reactive Technique, Type: Ninjutsu.
*Cost:* 1 Chakra (0 if a Konoha-Synergy Terrain is in play).
*Effect:* in response to a targeted attack on a **C or D Rank** character you control, prevent 3 of that attack's damage to it. The attack otherwise resolves normally.
*(Mirror of Chidori Interception's Terrain discount; protective payoff makes it a Guard Assist.)*

### Suggested Hand Deck manifest (40)

| Group | Cards | Copies | Total |
|---|---|---|---|
| Missions | the six above | 2 each | 12 |
| Substitution family (neutral) | Substitution, Lightning Substitution, Water Substitution | 3 each | 9 |
| Other neutral Jutsu | Incoming Mission Assignment, Chakra Transfer, Field Intelligence, Deploy Medic Corps, Jutsu Disruption, Explosive Tag, Battlefield Selection | 2 each | 14 |
| Terrain | Hidden Leaf Village | 3 | 3 |
| Assist | Guard Assist: Iruka Umino | 2 | 2 |
| **Total** | | | **40** |

*Assumption to confirm:* the neutral Jutsu are shared between factions rather than copied per deck. If each faction should have exclusive Jutsu, this list needs a faction-specific rework.

---

## Part 4 — Open items to revisit

- The three **on-hold** decisions above (Calorie Reserve, evolution numbers, Kamui).
- Confirm the **proposed evolution defaults** (no Field Orientation reset; new upkeep applies next Upkeep).
- Whether a **Forbidden Technique** should exist for Tsunade, Jiraiya, or the others (currently only Hiruzen and Guy have one).
- Whether the **neutral Jutsu are shared** between the two factions' decks.
- Balance pass against the Akatsuki deck once both are playable side by side.
