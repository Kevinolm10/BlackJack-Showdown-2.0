// ===== DOM references =====
const dCardContainer = document.querySelector(".dealer-card-container");
const pCardContainer = document.querySelector(".player-card-container");
const scoreContainer = document.querySelector(".score-container");
const dScore = document.querySelector(".dealer-score");
const pScore = document.querySelector(".player-score");
const gameContainer = document.querySelector(".game-container");
const welcomeText = document.querySelector(".welcome-text");

const cashContainer = document.getElementById("cash-container");
const cashEl = document.getElementById("cash");
const cashActions = document.getElementById("cash-actions");
const currentBetTxt = document.getElementById("current-bet");
const placeBetBtn = document.getElementById("place-bet-button");
const allInBtn = document.getElementById("all-in");

const hitBtn = document.getElementById("hit-button");
const standBtn = document.getElementById("stand-button");
const betBtn = document.getElementById("bet-button");
const doubleBtn = document.getElementById("double");
const splitBtn = document.getElementById("split");
const surrenderBtn = document.getElementById("surrender");

const playBtn = document.getElementById("play-button");
const rulesBtn = document.getElementById("rules-button");
const statsBtn = document.getElementById("statistics-button");
const backToMenuBtn = document.getElementById("backToMenu-button");

const playButtons = document.getElementById("play-buttons");
const mainMenuButtons = document.getElementById("main-menu-buttons");

let statsEl = null;
let betErrorEl = null;
let clearBetBtn = null;

// ===== Settings =====
const STARTING_CASH = 1000;
const NUM_DECKS = 1;
const RESHUFFLE_AT = 0.25;
const DEALER_DRAW_DELAY = 800;
const RESULT_DELAY = 2500;

const betAmounts = [100, 250, 500, 1000];
const chipButtons = betAmounts.map(amount => ({
    btn: document.getElementById(String(amount)),
    amount,
}));

// ===== Game state =====
// phase: "menu" | "betting" | "playing" | "dealer" | "result"
let phase = "menu";
let showMenuStats = false;
let actionsOpen = false;

let allCards = [];
let deck = [];
let backImage = "";

let dealerCards = [];
let playerCards = [];
let dealerRevealed = false;

let pendingBet = 0;
let currentBet = 0;

const stats = {
    cash: STARTING_CASH,
    wins: 0,
    losses: 0,
    ties: 0,
    winStreak: 0,
    totalGames: 0,
};

// ===== Rendering =====
function render() {
    const betting = phase === "betting";
    const inRound = phase === "playing" || phase === "dealer" || phase === "result";

    mainMenuButtons.hidden = phase !== "menu";
    cashContainer.hidden = phase === "menu";

    // Betting controls
    backToMenuBtn.hidden = !betting;

    for (const { btn, amount } of chipButtons) {
        btn.hidden = !betting;
        btn.disabled = pendingBet + amount > stats.cash;
    }
    allInBtn.hidden = !betting;
    allInBtn.disabled = stats.cash <= 0 || pendingBet === stats.cash;

    placeBetBtn.hidden = !betting;
    placeBetBtn.disabled = pendingBet <= 0;
    clearBetBtn.hidden = !betting;
    clearBetBtn.disabled = pendingBet <= 0;

    // Round controls
    playButtons.hidden = !inRound;
    scoreContainer.hidden = !inRound;
    currentBetTxt.hidden = !(betting || inRound);

    hitBtn.disabled = phase !== "playing";
    standBtn.disabled = phase !== "playing";
    betBtn.disabled = phase !== "playing";

    cashActions.hidden = !(phase === "playing" && actionsOpen);
    updateActionButtons();

    updateBetText();

    statsEl.hidden = !(betting || (phase === "menu" && showMenuStats));
    renderStats();
}

function updateCash() {
    cashEl.textContent = stats.cash;
}

function updateBetText() {
    currentBetTxt.textContent = phase === "betting"
        ? `Your bet: ${pendingBet}`
        : `Current player bet: ${currentBet}`;
}

function renderStats() {
    const items = [
        ["Wins", stats.wins],
        ["Losses", stats.losses],
        ["Ties", stats.ties],
        ["Streak", stats.winStreak],
        ["Games", stats.totalGames],
        ["Cash", `$${stats.cash}`],
    ];
    statsEl.innerHTML = items
        .map(([label, value]) =>
            `<div class="stat"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div>`)
        .join("");
}

function updateScores() {
    const playerTotal = handTotal(playerCards);
    pScore.textContent = `Player Card Value: ${playerTotal}`;

    const dealerShown = dealerRevealed ? dealerCards : dealerCards.slice(0, 1);
    dScore.textContent = `Dealer Card Value: ${handTotal(dealerShown)}`;
}

function updateActionButtons() {
    const firstDecision = phase === "playing" && playerCards.length === 2;
    doubleBtn.disabled = !(firstDecision && stats.cash >= currentBet);
    surrenderBtn.disabled = !firstDecision;
    splitBtn.disabled = true;
}

function showBetError(message) {
    betErrorEl.textContent = message;
    betErrorEl.hidden = !message;
}

// ===== Persistence =====
function loadStats() {
    for (const key of Object.keys(stats)) {
        const raw = localStorage.getItem(`bj_${key}`);
        const saved = Number(raw);
        if (raw !== null && Number.isFinite(saved)) {
            stats[key] = saved;
        }
    }
    if (stats.cash <= 0) stats.cash = STARTING_CASH;
}

function saveStats() {
    for (const [key, value] of Object.entries(stats)) {
        localStorage.setItem(`bj_${key}`, value);
    }
}

function recordResult(result) {
    stats.totalGames++;
    if (result === "win") {
        stats.wins++;
        stats.winStreak++;
    } else if (result === "loss") {
        stats.losses++;
        stats.winStreak = 0;
    } else {
        stats.ties++;
    }
}

// ===== Deck / shoe =====
async function loadCards() {
    if (allCards.length) return;
    const res = await fetch("cards.json");
    const data = await res.json();
    allCards = data.cards;
    backImage = data.back.dark;
}

function buildShoe() {
    deck = [];
    for (let i = 0; i < NUM_DECKS; i++) deck.push(...allCards);
    shuffleDeck(deck);
}

function shuffleDeck(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

function drawCard() {
    if (deck.length === 0) buildShoe();
    return deck.pop();
}

function displayCard(card, container, hidden = false) {
    const img = document.createElement("img");
    img.src = hidden ? backImage : card.image;
    img.alt = hidden ? "Hidden card" : `${card.rank} of ${card.suit}`;
    img.classList.add("card");
    container.appendChild(img);
}

// ===== Hand logic =====
function isAce(card) {
    const rank = String(card.rank).toLowerCase();
    return rank === "a" || rank === "ace" || card.value === 11 || card.value === 1;
}

function handTotal(cards) {
    let total = 0;
    let aces = 0;

    for (const card of cards) {
        if (isAce(card)) {
            aces++;
            total += 11;
        } else {
            total += card.value;
        }
    }

    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }

    return total;
}

function isBlackjack(cards) {
    return cards.length === 2 && handTotal(cards) === 21;
}

// Pure function: decides the outcome, does not change any state.
function evaluateHand() {
    const playerTotal = handTotal(playerCards);
    const dealerTotal = handTotal(dealerCards);
    const playerBJ = isBlackjack(playerCards);
    const dealerBJ = isBlackjack(dealerCards);

    if (playerTotal > 21) return { result: "loss", payout: 0, message: "You busted! Dealer wins." };
    if (playerBJ && dealerBJ) return { result: "tie", payout: currentBet, message: "Both have blackjack. Push." };
    if (playerBJ) return { result: "win", payout: Math.floor(currentBet * 2.5), message: "Blackjack! You win 3:2." };
    if (dealerBJ) return { result: "loss", payout: 0, message: "Dealer has blackjack. Dealer wins." };
    if (dealerTotal > 21) return { result: "win", payout: currentBet * 2, message: "Dealer busted! You win." };
    if (playerTotal > dealerTotal) return { result: "win", payout: currentBet * 2, message: "You win!" };
    if (dealerTotal > playerTotal) return { result: "loss", payout: 0, message: "Dealer wins!" };
    return { result: "tie", payout: currentBet, message: "It's a tie! Bet returned." };
}

// ===== Betting =====
function addChip(amount) {
    if (phase !== "betting") return;
    if (pendingBet + amount > stats.cash) {
        showBetError("You don't have enough cash for that chip.");
        return;
    }
    pendingBet += amount;
    showBetError("");
    render();
}

function allIn() {
    if (phase !== "betting" || stats.cash <= 0) return;
    pendingBet = stats.cash;
    showBetError("");
    render();
}

function clearBet() {
    if (phase !== "betting") return;
    pendingBet = 0;
    showBetError("");
    render();
}

async function placeBet() {
    if (phase !== "betting") return;

    if (pendingBet <= 0) {
        showBetError("Add some chips first.");
        return;
    }
    if (pendingBet > stats.cash) {
        showBetError("You don't have enough cash for that bet.");
        return;
    }

    showBetError("");
    currentBet = pendingBet;
    pendingBet = 0;
    stats.cash -= currentBet;
    updateCash();

    await startRound();
}

// ===== Game flow =====
function resetTable() {
    dCardContainer.innerHTML = "";
    pCardContainer.innerHTML = "";

    dealerCards = [];
    playerCards = [];
    dealerRevealed = false;
    actionsOpen = false;
    currentBet = 0;
    pendingBet = 0;

    pScore.textContent = "Player Score: 0";
    dScore.textContent = "Dealer Score: 0";

    showBetError("");
}

function startBetting() {
    resetTable();

    if (stats.cash <= 0) {
        stats.cash = STARTING_CASH;
        saveStats();
    }
    updateCash();

    phase = "betting";
    welcomeText.textContent = "Place your bet";
    render();
}

function play() {
    startBetting();
}

async function startRound() {
    phase = "playing";
    welcomeText.textContent = "Game in Progress";

    await loadCards();
    if (deck.length < allCards.length * NUM_DECKS * RESHUFFLE_AT) {
        buildShoe();
    }

    const p1 = drawCard();
    const d1 = drawCard();
    const p2 = drawCard();
    const d2 = drawCard();

    playerCards.push(p1, p2);
    dealerCards.push(d1, d2);

    displayCard(p1, pCardContainer);
    displayCard(p2, pCardContainer);
    displayCard(d1, dCardContainer);
    displayCard(d2, dCardContainer, true);

    updateScores();
    render();

    if (isBlackjack(playerCards)) stand();
}

function hit() {
    if (phase !== "playing") return;

    const card = drawCard();
    playerCards.push(card);
    displayCard(card, pCardContainer);
    updateScores();
    updateActionButtons();

    const total = handTotal(playerCards);
    if (total > 21) {
        revealDealerCard();
        finishRound(evaluateHand());
    } else if (total === 21) {
        stand();
    }
}

function revealDealerCard() {
    if (dealerRevealed) return;
    const hiddenImg = dCardContainer.querySelectorAll("img")[1];
    const hiddenCard = dealerCards[1];
    hiddenImg.src = hiddenCard.image;
    hiddenImg.alt = `${hiddenCard.rank} of ${hiddenCard.suit}`;
    dealerRevealed = true;
    updateScores();
}

async function stand() {
    if (phase !== "playing") return;
    phase = "dealer";
    render();

    revealDealerCard();
    await sleep(DEALER_DRAW_DELAY);

    // With a natural blackjack the dealer only reveals; no drawing.
    if (!isBlackjack(playerCards)) {
        while (handTotal(dealerCards) < 17) {
            const card = drawCard();
            dealerCards.push(card);
            displayCard(card, dCardContainer);
            updateScores();
            await sleep(DEALER_DRAW_DELAY);
        }
    }

    await finishRound(evaluateHand());
}

async function doubleDown() {
    if (phase !== "playing" || playerCards.length !== 2 || stats.cash < currentBet) return;

    stats.cash -= currentBet;
    currentBet *= 2;
    updateCash();
    updateBetText();

    const card = drawCard();
    playerCards.push(card);
    displayCard(card, pCardContainer);
    updateScores();

    if (handTotal(playerCards) > 21) {
        revealDealerCard();
        await finishRound(evaluateHand());
    } else {
        await stand();
    }
}

async function surrender() {
    if (phase !== "playing" || playerCards.length !== 2) return;

    revealDealerCard();
    await finishRound({
        result: "loss",
        payout: Math.floor(currentBet / 2),
        message: "You surrendered. Half your bet returned.",
    });
}

async function finishRound({ result, payout, message }) {
    phase = "result";

    stats.cash += payout;
    recordResult(result);
    saveStats();
    updateCash();

    welcomeText.textContent = message;
    render();

    await sleep(RESULT_DELAY);
    if (phase === "result") startBetting();
}

function backToMainMenu() {
    saveStats();
    resetTable();

    phase = "menu";
    showMenuStats = false;
    welcomeText.textContent = "Welcome to BlackJack";
    render();
}

function toggleActions() {
    if (phase !== "playing") return;
    actionsOpen = !actionsOpen;
    render();
}

function toggleStats() {
    if (phase !== "menu") return;
    showMenuStats = !showMenuStats;
    render();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== Init =====
function init() {
    for (const btn of document.querySelectorAll("button")) {
        btn.type = "button";
    }

    statsEl = document.getElementById("stats-text");
    if (!statsEl) {
        statsEl = document.createElement("p");
        statsEl.id = "stats-text";
        statsEl.style.whiteSpace = "pre-line";
        gameContainer.prepend(statsEl);
    }

    // Clear button: use one from the HTML if it exists, otherwise create it
    clearBetBtn = document.getElementById("clear-bet-button");
    if (!clearBetBtn) {
        clearBetBtn = document.createElement("button");
        clearBetBtn.type = "button";
        clearBetBtn.id = "clear-bet-button";
        clearBetBtn.textContent = "Clear";
        placeBetBtn.after(clearBetBtn);
    }
    clearBetBtn.addEventListener("click", clearBet);

    betErrorEl = document.createElement("p");
    betErrorEl.id = "bet-error";
    betErrorEl.style.color = "var(--red)";
    betErrorEl.hidden = true;
    clearBetBtn.after(betErrorEl);

    loadStats();
    updateCash();
    render();

    loadCards();
}

playBtn.addEventListener("click", play);
hitBtn.addEventListener("click", hit);
standBtn.addEventListener("click", stand);
betBtn.addEventListener("click", toggleActions);
doubleBtn.addEventListener("click", doubleDown);
surrenderBtn.addEventListener("click", surrender);

for (const { btn, amount } of chipButtons) {
    btn.addEventListener("click", () => addChip(amount));
}
allInBtn.addEventListener("click", allIn);
placeBetBtn.addEventListener("click", placeBet);
backToMenuBtn.addEventListener("click", backToMainMenu);
statsBtn.addEventListener("click", toggleStats);

init();