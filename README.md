# Naruto Custom Card Game

A two-player strategy card game set in the Naruto world, built as a playable browser prototype for playtesting.

### ▶ [Play the playtest build](https://rezruiz.github.io/naruto-card-game/)

No install or account needed — it runs entirely in your browser. The site updates automatically whenever `main` changes.

## Synopsis

Two players each lead a squad of shinobi into battle. You summon characters like Itachi, Kisame and Deidara onto your board, build up Chakra turn by turn, and spend it on their signature techniques and on Jutsu cards from your hand — from a quick Substitution that dodges an attack to forbidden techniques that can turn the whole fight. Every character has their own mechanic straight from the series: Kakuzu's five hearts, Deidara's clay charges, Pain's Six Paths, Hidan's curse.

It's a war of attrition: you don't attack the other player directly. Every shinobi you lose costs **you** Health, and the stronger they are, the more it hurts — so the game is about protecting your best fighters, picking off your opponent's, and deciding when a powerful character is worth the risk of putting on the field. Bring a player to 0 Health and you win.

---

## The game in a nutshell

- **Two decks per player** — a **Jutsu Deck** (50–80 Jutsu, Assist, Mission and Terrain cards) you draw from every turn, and a **Character Deck** (12–18 characters) you draw from by paying the Character Deck Tax or when a character falls.
- **Chakra** — no free income. Each turn you may discard a card to place a Chakra source, then tap sources for Chakra. Characters also keep their own Chakra Pool between turns.
- **The board** — up to 5 characters in your back row and up to 10 tokens in your front row, lined up one-to-one so splash and cross-pattern attacks hit what's directly beside, in front of or behind the target.
- **Winning** — each player starts with 20 Health and loses Health when **their own** characters are defeated (more for higher ranks). Reach 0 and you lose.
- **The Akatsuki deck** is fully playable: Kakuzu, Hidan, Pain of the Six Paths, Deidara, Kisame, Itachi, Konan, Sasori, Zetsu, Juzo Biwa, Yahiko and more. A Konoha deck is in design.

The full rulebook is in [`design/RULES.md`](design/RULES.md) — and in the game itself (**📖 Read the rules** on the start screen).

## How to play the prototype

1. Open the [playtest site](https://rezruiz.github.io/naruto-card-game/).
2. **Pick a deck** — use the built-in Akatsuki Starter, or open the **📚 Deck Library** to build your own (Hearthstone-style: click cards to add them, right-click to remove).
3. Choose a mode:
   - **Single-Player Testing** — play both sides on one screen.
   - **Host a game** — share the 5-letter room code with a friend.
   - **Join a game** — enter your friend's room code.
4. Pick your starting character, mulligan if you like, and play. Drag cards from your hand onto the board to play them, or use the buttons on each card.

**Trust mode** (on by default) works like a real table: you declare actions, your opponent gets a chance to respond, and everything resolves together. The game warns about anything the strict rules wouldn't allow, but lets you force it through if you both agree.

**Online play notes:** games are peer-to-peer (no game server) — the host's browser runs the game, so if the host closes or refreshes the tab, the game ends. Some strict networks (school/work Wi-Fi, some VPNs) block direct connections. Decks are saved in your own browser.

## Development

Requires [Node.js](https://nodejs.org/) 24+.

```bash
npm install
npm run dev      # local dev server at http://localhost:5173/naruto-card-game/
npm test         # run the engine and UI tests
npm run build    # production build into dist/
npm run lint
```

Built with React + TypeScript + Vite, tested with Vitest, and networked with PeerJS (WebRTC).

### Project layout

| Path | What's there |
|---|---|
| [`src/engine/`](src/engine) | The rules engine — pure TypeScript, no UI. Characters in `characters/`, Jutsu/Mission/Terrain cards in `cards/`. |
| [`src/ui/`](src/ui), [`src/App.tsx`](src/App.tsx) | The game screens, board, hand and deck library. |
| [`src/net/`](src/net) | Online play (host/join over PeerJS). |
| [`tests/`](tests) | Engine and UI tests. |
| [`design/`](design) | Rules and card design docs (see below). |

### Design docs

| Doc | Purpose |
|---|---|
| [`RULES.md`](design/RULES.md) | The complete, current rulebook — wins over everything else except card text. |
| [`SPEC.md`](design/SPEC.md) | The original spec and the card texts. The in-game card popups are generated from it, so card text changes go here. |
| [`CHARACTER_LOG.md`](design/CHARACTER_LOG.md) | The nuance and rulings behind each card. |
| [`DESIGN_DIRECTION.md`](design/DESIGN_DIRECTION.md) | Planned redesigns and drafts. |
| [`KONOHA_DRAFT.md`](design/KONOHA_DRAFT.md) | The Konoha deck, in design. |

### Deploying

Every push to `main` runs the tests and, if they pass, publishes the site to GitHub Pages (see [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)). A failing test blocks the deploy, so the live site always stays on the last good version.

## Credits

Created by [rezruiz](https://github.com/rezruiz) and [DavidHDSC](https://github.com/DavidHDSC). Naruto and its characters belong to Masashi Kishimoto, Shueisha and Studio Pierrot — this is a non-commercial fan project.
