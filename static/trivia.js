"use strict";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_REGULAR   = 10;
const BONUS_POINTS  = 3;
const MAX_SCORE     = MAX_REGULAR + BONUS_POINTS; // 13
const LS_KEY        = "book_trivia_scores";

const LOADING_MSGS = [
  "Raiding the books for secrets...",
  "Consulting the Gonder Scale archives...",
  "Bribing fictional characters for spoilers...",
  "Dusting off dog-eared pages...",
  "Cross-referencing plot twists...",
  "Decoding chapter summaries...",
  "Asking the narrator nicely...",
];

const SCORE_LABELS = [
  [13,  "🏆 Perfect Score! The Gonder Scale bows before you."],
  [11,  "📚 Literary Genius. Genuinely impressive."],
  [9,   "📖 Seasoned Reader. You've been paying attention."],
  [6,   "🐐 Solid Gonder Score. Respectable."],
  [3,   "📄 Needs More Pages. Read faster."],
  [0,   "😅 Have you actually read these books?"],
];

// ─── State ────────────────────────────────────────────────────────────────────

let playerName  = "";
let questions   = [];
let currentQ    = 0;
let score       = 0;
let answers     = [];
let answering   = false;
let loadingTimer = null;

// ─── Screen control ───────────────────────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll(".tq-screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ─── Init ─────────────────────────────────────────────────────────────────────

window.addEventListener("DOMContentLoaded", () => {
  const sel = document.getElementById("tq-member");
  const btn = document.getElementById("tq-start-btn");
  if (sel) {
    sel.addEventListener("change", () => { btn.disabled = !sel.value; });
  }
});

// ─── Game start ───────────────────────────────────────────────────────────────

function startTrivia() {
  const sel = document.getElementById("tq-member");
  if (!sel || !sel.value) return;
  playerName = sel.value;
  score      = 0;
  currentQ   = 0;
  answers    = [];
  answering  = false;
  showScreen("screen-tq-loading");
  startLoadingMessages();
  fetchQuestions();
}

function startLoadingMessages() {
  const el = document.getElementById("tq-loading-msg");
  let idx = 0;
  loadingTimer = setInterval(() => {
    idx = (idx + 1) % LOADING_MSGS.length;
    if (el) el.textContent = LOADING_MSGS[idx];
  }, 2200);
}

async function fetchQuestions() {
  try {
    const res  = await fetch("/trivia/questions");
    const data = await res.json();
    clearInterval(loadingTimer);

    if (!res.ok || data.error) {
      alert("Could not load questions: " + (data.error || "Unknown error"));
      showScreen("screen-tq-start");
      return;
    }

    questions = data;
    showQuestion(0);
  } catch (e) {
    clearInterval(loadingTimer);
    alert("Network error loading questions. Please try again.");
    showScreen("screen-tq-start");
  }
}

// ─── Question display ─────────────────────────────────────────────────────────

function showQuestion(idx) {
  const q = questions[idx];
  if (!q) { showResults(); return; }

  showScreen("screen-tq-question");

  const isBonus  = !!q.bonus;
  const qDisplay = isBonus ? "BONUS" : `${idx + 1} of ${MAX_REGULAR}`;

  // Bonus banner
  const banner = document.getElementById("tq-bonus-banner");
  banner.style.display = isBonus ? "" : "none";

  // Progress (only advances for regular questions)
  const pct = isBonus ? 100 : (idx / MAX_REGULAR) * 100;
  document.getElementById("tq-progress-fill").style.width = `${pct}%`;

  document.getElementById("tq-q-counter").textContent    = `Question ${qDisplay}`;
  document.getElementById("tq-score-display").textContent = `Score: ${score}`;
  document.getElementById("tq-book-source").textContent  = q.book ? `📖 ${q.book}` : "";
  document.getElementById("tq-question-text").textContent = q.question;

  // Reset feedback
  const feedEl = document.getElementById("tq-feedback");
  feedEl.style.display = "none";
  feedEl.textContent   = "";
  feedEl.className     = "tq-feedback";

  // Build option buttons
  const optEl = document.getElementById("tq-options");
  optEl.innerHTML = "";
  q.options.forEach((opt, i) => {
    const btn       = document.createElement("button");
    btn.className   = "tq-option";
    btn.textContent = opt;
    btn.addEventListener("click", () => selectAnswer(i, idx));
    optEl.appendChild(btn);
  });

  answering = false;
}

// ─── Answer handling ──────────────────────────────────────────────────────────

function selectAnswer(selected, qIdx) {
  if (answering) return;
  answering = true;

  const q       = questions[qIdx];
  const correct = selected === q.correct;
  const pts     = q.bonus ? BONUS_POINTS : 1;

  if (correct) score += pts;
  answers.push({ qIdx, selected, correct, bonus: !!q.bonus, pts });

  // Highlight buttons
  const optEl = document.getElementById("tq-options");
  optEl.querySelectorAll(".tq-option").forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.correct)              btn.classList.add("tq-correct");
    if (i === selected && !correct)   btn.classList.add("tq-wrong");
  });

  // Feedback line
  const feedEl = document.getElementById("tq-feedback");
  feedEl.style.display = "";
  if (correct) {
    feedEl.textContent = q.bonus
      ? `⭐ Correct! +${pts} points — you actually read that carefully.`
      : "✓ Correct! +1 point";
    feedEl.className = "tq-feedback tq-feedback-correct";
  } else {
    feedEl.textContent = `✗ Nope. The answer was: ${q.options[q.correct]}`;
    feedEl.className   = "tq-feedback tq-feedback-wrong";
  }

  // Update live score
  document.getElementById("tq-score-display").textContent = `Score: ${score}`;

  setTimeout(() => {
    const next = qIdx + 1;
    if (next >= questions.length) showResults();
    else showQuestion(next);
  }, 1900);
}

// ─── Results ──────────────────────────────────────────────────────────────────

function showResults() {
  showScreen("screen-tq-results");
  saveScore(playerName, score);

  const label = SCORE_LABELS.find(([min]) => score >= min)?.[1] ?? SCORE_LABELS.at(-1)[1];

  document.getElementById("tq-result-title").textContent = `${playerName}'s Results`;
  document.getElementById("tq-score-big").textContent    = `${score} / ${MAX_SCORE}`;
  document.getElementById("tq-score-label").textContent  = label;

  // Question-by-question review
  const reviewEl = document.getElementById("tq-review");
  reviewEl.innerHTML = `<div class="tq-review-title">Review</div>` +
    answers.map(a => {
      const q   = questions[a.qIdx];
      const cls = a.correct ? "tq-rv-correct" : "tq-rv-wrong";
      const icon = a.correct ? "✓" : "✗";
      return `<div class="tq-rv-row ${cls}">
        <span class="tq-rv-icon">${icon}</span>
        <span class="tq-rv-text">${escHtml(q.question)}</span>
        ${!a.correct ? `<span class="tq-rv-ans">${escHtml(q.options[q.correct])}</span>` : ""}
        ${a.bonus ? `<span class="tq-rv-bonus">★ BONUS</span>` : ""}
      </div>`;
    }).join("");

  // Leaderboard embedded in results
  const lbWrap = document.getElementById("tq-leaderboard-wrap");
  lbWrap.innerHTML = `<div class="tq-leaderboard-wrap"><div class="tq-review-title" style="margin-top:1rem">📋 Leaderboard</div></div>`;
  const tbl = document.createElement("div");
  renderTable(getScores(), tbl, playerName);
  lbWrap.querySelector(".tq-leaderboard-wrap").appendChild(tbl);
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

function saveScore(name, pts) {
  const scores = getScores();
  scores.push({
    name,
    score: pts,
    max:   MAX_SCORE,
    date:  new Date().toLocaleDateString(),
  });
  scores.sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
  scores.splice(20);
  try { localStorage.setItem(LS_KEY, JSON.stringify(scores)); } catch (_) {}
}

function getScores() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch (_) { return []; }
}

function renderTable(scores, container, highlightName) {
  if (!scores.length) {
    container.innerHTML = `<p style="text-align:center;color:#555;padding:1rem;font-family:'Courier New',monospace;font-size:0.82rem">No scores yet. Be the first.</p>`;
    return;
  }
  const rows = scores.slice(0, 10).map((s, i) => {
    const isMe  = highlightName && s.name === highlightName;
    const rowCls = i === 0 ? "tq-top" : isMe ? "tq-me" : "";
    return `<tr class="${rowCls}">
      <td>${i + 1}</td>
      <td>${escHtml(s.name)}</td>
      <td>${s.score} / ${s.max}</td>
      <td>${s.date}</td>
    </tr>`;
  }).join("");
  container.innerHTML = `<table class="tq-table">
    <thead><tr><th>#</th><th>Player</th><th>Score</th><th>Date</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function showLeaderboard() {
  showScreen("screen-tq-leaderboard");
  const wrap = document.getElementById("tq-lb-table-wrap");
  renderTable(getScores(), wrap, "");
}

function clearLeaderboard() {
  if (!confirm("Clear all scores? This cannot be undone.")) return;
  try { localStorage.removeItem(LS_KEY); } catch (_) {}
  showLeaderboard();
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function resetTrivia() {
  document.getElementById("tq-member").value = "";
  document.getElementById("tq-start-btn").disabled = true;
  showScreen("screen-tq-start");
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
