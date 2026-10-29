# ♠️ Blackjack

A browser blackjack game built with **vanilla JavaScript, HTML and CSS**: no frameworks, no libraries, no build step. It plays by real casino rules (3:2 blackjack payouts, double down, surrender, dealer stands on 17), uses a persistent card shoe, and saves your cash and statistics between sessions.

This project is a rebuild of the first blackjack game I made as a student at Code Institute. I came back to the same idea to see how far I've come, and to take it further: real casino rules, betting, a persistent card shoe, saved stats and a cleaner architecture. Building something I'd already made once made it easy to see what I now do differently.

I also wanted to get better at plain JavaScript: state management, async flow and DOM work without a framework doing it for me. It went through several rewrites as I ran into the problems that frameworks normally hide.

> **Live demo:** _add link here_
> **Screenshot:** _add `screenshot.png` here_

---

## Contents

- [Then and now](#then-and-now)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [How to play](#how-to-play)
- [Architecture](#architecture)
- [Design](#design)
- [Bugs I solved](#bugs-i-solved)
- [Hurdles and design decisions](#hurdles-and-design-decisions)
- [What I learned](#what-i-learned)
- [Roadmap](#roadmap)

---

## Then and now

My first version, **[BlackJack Showdown](https://github.com/Kevinolm10/BlackJack-Showdown)** ([live demo](https://kevinolm10.github.io/BlackJack-Showdown/)), was built while I was studying at Code Institute. This version starts from the same game and pushes it further. Several items on that project's "future features" list, like betting with fake money, are built here.

| | First version: BlackJack Showdown | This version |
|---|---|---|
| Goal | Get a working game of blackjack | Play by real casino rules, with a structure that's easy to extend |
| Rules | Hit and stand | Double down, surrender, natural blackjack paying 3:2, dealer stands on 17 |
| Money | None (betting was listed as a future feature) | Betting, payouts and a bankroll that carries between rounds |
| Deck | A fresh deck for each game | A persistent shoe with a reshuffle point and a configurable number of decks |
| Stats | A score counter for wins | Wins, losses, ties, win streak, total games and cash |
| Persistence | None | Stats and cash saved in `localStorage` |
| Instructions | Shown in a JavaScript `alert()` | No blocking alerts: inline messages instead |
| Structure | Game logic and UI updates mixed together | A phase-based state machine with a single `render()` function |

---

## Features

**Gameplay**
- Standard blackjack against a dealer: hit, stand, double down and surrender
- Correct ace handling: an ace counts as 11 and drops to 1 when it would bust the hand
- The dealer draws to 17 and reveals the hole card at the end of the player's turn
- A natural blackjack pays **3:2**, beats a three-card 21, and ends the round without the dealer drawing
- Animated dealer turn, with each card drawn after a short delay so the round reads like a real deal

**Betting and economy**
- Place a bet before every round. The bet is taken from your cash up front, and payouts return the stake plus winnings, as at a real table
- Input validation with an inline error message (no blocking `alert()` popups)
- The bankroll resets to $1,000 only when you go broke

**Card shoe**
- Cards are loaded once from `cards.json` and dealt from a persistent shoe
- Dealt cards stay out of play until the shoe reaches 25% and is reshuffled, so card counting actually works
- Configurable number of decks (`NUM_DECKS`). Casinos typically use 6–8

**Persistence and stats**
- Wins, losses, ties, win streak, total games and cash are saved to `localStorage` and restored on reload
- Stats can be shown from the main menu and appear between rounds

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Logic | Vanilla JavaScript (ES2020+) | To learn the language and the DOM directly, without a framework |
| Markup | Semantic HTML | Simple, accessible structure |
| Styling | CSS with custom properties | Design tokens and theming without a preprocessor |
| Data | `cards.json` loaded with `fetch` | Keeps card data and image paths separate from game logic |
| Storage | `localStorage` | Persistence between sessions with no backend |

---

## Getting started

The game loads `cards.json` with `fetch`, so it needs to be served over HTTP. Opening `index.html` directly from disk (`file://`) will block the request.

```bash
git clone https://github.com/kevinolm10/<repo-name>.git
cd <repo-name>

# any static server works, e.g.
npx serve .
# or
python3 -m http.server 8000
```

Then open `http://localhost:8000` (or the port your server prints).

You can also use the **Live Server** extension in VS Code.

### Project structure

```
├── index.html      # layout and containers for each game area
├── style.css       # design tokens, layout, buttons and card styling
├── script.js       # all game logic
└── cards.json      # card data: rank, suit, value, image path, card backs
```

---

## How to play

1. Press **Play** to sit down at the table.
2. Enter a bet and press **Place bet** (or hit Enter).
3. You and the dealer get two cards each. One of the dealer's cards is face down.
4. Choose an action:
   - **Hit**: take another card
   - **Stand**: end your turn. The dealer reveals and draws to 17
   - **Bet → Double**: double your bet, take exactly one card, then stand
   - **Bet → Surrender**: give up the hand and get half your bet back
5. The result is paid out, and the next round starts at the betting screen.

| Result | Paid back | Net |
|---|---|---|
| Loss / bust | 0 | −bet |
| Push (tie) | bet | 0 |
| Win | 2 × bet | +bet |
| Blackjack | 2.5 × bet | +1.5 × bet |

---

## Architecture

### A state machine drives the UI

The game is modelled as a small state machine with five phases:

```
menu ──► betting ──► playing ──► dealer ──► result
  ▲         ▲                                  │
  │         └──────────────────────────────────┘
  └──────────── back to menu (from betting)
```

A single `render()` function reads the current `phase` and decides what is visible:

```javascript
function render() {
    const inRound = phase === "playing" || phase === "dealer" || phase === "result";

    mainMenuButtons.hidden = phase !== "menu";
    betAmountInput.hidden  = phase !== "betting";
    playButtons.hidden     = !inRound;
    hitBtn.disabled        = phase !== "playing";
    // ...
}
```

Game functions never toggle visibility themselves. They change state and call `render()`:

```javascript
phase = "betting";
render();
```

That gives the UI one source of truth, the same idea behind React's "UI is a function of state", written by hand.

### Separating decisions from side effects

The round result is split into two functions:

- **`evaluateHand()`** is a pure function. It looks at the cards and returns `{ result, payout, message }` without changing anything.
- **`finishRound()`** applies that result: pays out, records stats, saves, and moves to the next phase.

Every way a round can end (bust, stand, double, surrender, natural blackjack) goes through `finishRound()`, so no path can skip the payout or the stats. Surrender doesn't need `evaluateHand()` at all; it passes its own result object straight to `finishRound()`.

### Code layout in `script.js`

| Section | Responsibility |
|---|---|
| DOM references | All `getElementById` / `querySelector` calls in one place |
| Settings | Tunable constants: `STARTING_CASH`, `NUM_DECKS`, `RESHUFFLE_AT`, delays |
| Game state | `phase`, hands, shoe, current bet and the `stats` object |
| Rendering | `render()`, score, cash and stats display |
| Persistence | `loadStats()`, `saveStats()`, `recordResult()` |
| Deck / shoe | `loadCards()`, `buildShoe()`, Fisher–Yates `shuffleDeck()`, `drawCard()` |
| Hand logic | `handTotal()`, `isBlackjack()`, `evaluateHand()` |
| Game flow | `startBetting()`, `placeBet()`, `startRound()`, `hit()`, `stand()`, `doubleDown()`, `surrender()`, `finishRound()` |

### Key algorithms

**Ace handling.** Count every ace as 11, then subtract 10 for each ace while the hand is over 21:

```javascript
while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
}
```

**Shuffling.** A Fisher–Yates shuffle, which gives every ordering equal probability (unlike the common `sort(() => Math.random() - 0.5)` trick, which is biased).

**Async pacing.** The dealer's turn uses `async/await` with a small `sleep()` helper, so cards appear one at a time without nested `setTimeout` callbacks:

```javascript
while (handTotal(dealerCards) < 17) {
    dealerCards.push(drawCard());
    // ...
    await sleep(DEALER_DRAW_DELAY);
}
```

---

## Design

The look is a casino table: a dark green felt gradient, frosted-glass panels and gold accents.

**Design tokens.** All colours, borders and radii live as CSS custom properties in `:root`, so the theme can be changed in one place:

```css
:root {
  --felt-1: #0f5132;
  --felt-2: #052e1c;
  --surface: rgba(255, 255, 255, 0.08);
  --gold: #fbbf24;
  --red: #ef4444;
  --green: #22c55e;
  --radius: 20px;
}
```

**Visual details**
- A radial gradient background that reads as table felt under a light
- Glassmorphism panels using `backdrop-filter: blur()` with a soft shadow
- A gold-to-red gradient title using `background-clip: text`
- Cards lift and tilt slightly on hover
- Fluid title size with `clamp()`, so it scales between mobile and desktop without media queries

**Buttons.** All action buttons share one `.action-btn` class. Each button sets its own colour through a local `--btn` variable, and the hover glow is derived from it with `color-mix()`:

```css
.action-btn:hover {
  box-shadow: 0 8px 20px color-mix(in srgb, var(--btn) 60%, transparent);
}
#hit-button   { --btn: var(--green); }
#stand-button { --btn: var(--red); }
```

Adding a new coloured button is one line of CSS.

**Accessibility**
- Visible `:focus-visible` outlines for keyboard users
- Disabled buttons are dimmed and show `cursor: not-allowed`, so it's clear when an action isn't available
- Every card image has `alt` text ("Queen of Hearts", or "Hidden card" for the dealer's hole card)
- The bet field is a number input, and Enter places the bet

---

## Bugs I solved

These are the main bugs I tracked down while building the game, with what caused each one.

### 1. `hidden` didn't hide anything
**Symptom:** Setting `element.hidden = true` had no effect on some containers.
**Cause:** The `hidden` attribute only works through the browser's default rule `[hidden] { display: none }`. My own CSS set `display: flex` on those classes, and an author stylesheet beats the browser default.
**Fix:**
```css
[hidden] { display: none !important; }
```
**Lesson:** HTML attributes and CSS interact through specificity. A "JavaScript bug" can be a CSS bug.

### 2. Cards dealt twice after placing a bet
**Symptom:** After betting, each hand had four cards and the totals were wrong, usually an instant bust.
**Cause:** `play()` both opened the table *and* dealt cards. Placing a bet called `play()` again, which pushed two more cards onto arrays that were never cleared.
**Fix:** Split the flow. `play()` only opens the betting screen, and a separate `startRound()` deals once the bet is placed.
**Lesson:** A function should do one thing. Mixing "show the screen" with "start the game" made it impossible to call either safely.

### 3. A win paid nothing
**Symptom:** Winning a hand left the bankroll unchanged.
**Cause:** The bet is subtracted when it's placed, but a win only added `currentBet` back: the stake, with no winnings.
**Fix:** Return the stake plus winnings: `2 × bet` for a win, `2.5 × bet` for blackjack, `1 × bet` for a push.
**Lesson:** Working out the payout table on paper first would have caught this before I wrote any code.

### 4. `ReferenceError: currentBet is not defined`
**Symptom:** Every round crashed at the payout.
**Cause:** `userBet()` declared `let currentBet` locally, which shadowed the global I meant to use, and the global hadn't been declared at all.
**Fix:** Declare `currentBet` once at the top level and assign to it without `let` inside functions.
**Lesson:** Block scoping with `let`, and how a local variable can silently shadow a global one.

### 5. Cash reset to $1,000 every round
**Symptom:** Wins and losses never stuck.
**Cause:** `playerCash = 1000` was in `restart()`, which ran after *every* round once I added automatic restarts.
**Fix:** Only reset the bankroll when the player is broke (`if (stats.cash <= 0)`).
**Lesson:** When a function's role changes (here, from "new game" to "next round"), everything inside it has to be reconsidered.

### 6. Buttons and stats wouldn't reappear
**Symptom:** The "Back to menu" button and the stats panel stayed hidden even when their own `hidden` was `false`.
**Cause:** The button sat inside a container that was hidden at that point, and nothing ever set the stats panel back to visible after a round.
**Fix:** Moved the button out of that container, and later replaced all scattered `.hidden` toggles with the phase-based `render()` function.
**Lesson:** A child element can't be visible inside a hidden parent, and visibility managed in many places will drift out of sync.

### 7. `appendChild` rejected a string
**Symptom:** `TypeError: parameter 1 is not of type 'Node'` when showing stats.
**Cause:** `appendChild()` only accepts DOM nodes, not strings.
**Fix:** Create a `<p>` element, set its `textContent`, append it once, and reuse it on later updates (with `white-space: pre-line` so line breaks show).

### 8. Container lookup returned `null`
**Symptom:** The stats never appeared and the console showed `Cannot read properties of null`.
**Cause:** I used `getElementById("game-container")`, but `game-container` was a **class**, not an id.
**Lesson:** Read the console error first. It pointed straight at the problem.

### 9. Busts weren't counted in the stats
**Symptom:** The losses counter was lower than it should have been. Win streak and total games always showed 0.
**Cause:** A bust in `hit()` ended the round directly and skipped the function that updated stats, and the streak and total counters were never incremented anywhere.
**Fix:** Routed every round ending through `finishRound()` and moved all stat updates into a single `recordResult()`.

### 10. "My hand total went down when I drew a card"
**Not a bug.** With an ace, Ace + 5 is a soft 16. Drawing a 9 makes 25, so the ace drops to 1 and the total becomes 15. Investigating it confirmed the ace logic was right, and it's a good example of checking the rules before "fixing" code.

### 11. Stats were saved but never loaded
**Cause:** `localStorage.setItem` was called, but nothing read the values back on page load.
**Fix:** `loadStats()` runs at startup, reads each saved key, and validates it before using it.

---

## Hurdles and design decisions

### Managing UI state without a framework
The hardest part of the project wasn't the blackjack rules. It was keeping the screen in sync with the game. Early versions set `.hidden` in five or six different functions, and almost every bug above came from those lists disagreeing. Moving to a `phase` variable with a single `render()` removed that whole class of bugs. It also made it clear to me *why* frameworks like React are built around state and rendering.

### Random deck vs. persistent shoe
The first version reshuffled a fresh 52-card deck every round. It's correct, and it's how most computer-dealt online blackjack works, because it makes card counting impossible. I switched to a persistent shoe with a 25% reshuffle point because it's closer to a real table and makes the deck composition matter. The trade-off is documented in the settings (`NUM_DECKS`, `RESHUFFLE_AT`), so either behaviour is a one-line change.

### "The dealer always gets high cards"
During testing it felt like the dealer was unfairly lucky. I checked whether the shuffle was biased, and it wasn't. 16 of 52 cards are worth 10, plus four aces, so about 38% of all cards are a 10 or an ace. Combined with the house edge (the player busts first), the dealer reaching 17–21 quickly is expected. I tuned the pacing (dealer draw delay and result pause) so rounds feel less rushed rather than changing the odds.

### Auto-restart vs. player control
After each round the game returns to the betting screen after a short pause. A "Next hand" button would give the player more control. It's on the roadmap.

### Whole-dollar payouts
A 3:2 payout on an odd bet produces half dollars ($5 → $12.50). I chose to round down with `Math.floor()` and keep the bankroll in whole dollars, like many real tables do with their chips.

### Split
Split is the one standard move not implemented yet. Every other part of the game assumes a single player hand, so splitting means changing the player's hand into an array of hands, each with its own cards and bet, and tracking which one is active. I decided to finish and stabilise the rest first and build this as its own step.

---

## What I learned

**JavaScript**
- Block scoping (`let` / `const`) and how variable shadowing causes silent bugs
- `async` / `await` and Promises for timed sequences instead of nested callbacks
- Pure functions vs. functions with side effects, and why keeping them apart makes code easier to test and reason about
- Destructuring, template literals, and `Object.entries` / `Object.keys` for compact data handling
- `fetch` for loading local JSON, and why it needs an HTTP server

**DOM**
- The difference between DOM nodes and strings (`appendChild`, `textContent`, `createElement`)
- `prepend`, `before`, `after` and `insertBefore` for precise element placement
- `getElementById` vs. `querySelector` vs. class lookups, and why an `id` is safer for unique elements
- How the `hidden` attribute, CSS `display` and parent visibility interact

**Architecture**
- Modelling a UI as a state machine with a single render function
- Keeping one source of truth for state
- Removing duplication with shared helpers (`resetTable()`, `recordResult()`)
- Grouping tunable values as named constants instead of magic numbers

**CSS**
- Design tokens with custom properties, and per-component variables like `--btn`
- Specificity, and why `!important` is justified for a global utility rule like `[hidden]`
- `clamp()`, `color-mix()`, `backdrop-filter` and `background-clip: text`

**Process**
- Revisiting an old project shows growth more clearly than starting a new one. I could compare my decisions now with the ones I made as a student
- Reading console errors before guessing
- Checking the domain rules (here, blackjack rules) before assuming the code is wrong
- Refactoring once a pattern of bugs shows the structure is the problem, not each individual line

---

## Roadmap

- [ ] **Rules**: Rules UI and text for when pressing the rules button in the main menu.
- [ ] **Split**: support multiple player hands with separate bets
- [ ] **"Next hand" button** instead of the automatic restart
- [ ] **Soft totals in the score** ("Soft 17"), so it's clearer when an ace can drop
- [ ] **Shoe indicator** showing cards left, to make counting part of the game
- [ ] **Insurance** when the dealer shows an ace
- [ ] **Rules screen** for the existing Rules button
- [ ] **Sound effects** and dealing animations
- [ ] **Unit tests** for `handTotal()` and `evaluateHand()`. Both are pure functions, so they're straightforward to test
- [ ] **Settings menu** for deck count and starting cash
- [ ] **Themes**: alternative table and card skins. The styling is already started in CSS, built on the existing design tokens so a theme can override colours in one place. The JavaScript to switch between them and remember the chosen theme isn't wired up yet
- [ ] **Store**: an in-game shop where players spend their winnings on themes. Unlocked themes would be saved with the rest of the player's data, giving the bankroll a purpose beyond the next bet

---

## Author

**Kevin**: IT technician moving toward full-stack development. Code Institute full-stack graduate.
GitHub: [@kevinolm10](https://github.com/kevinolm10)
Original school project: [BlackJack Showdown](https://github.com/Kevinolm10/BlackJack-Showdown)