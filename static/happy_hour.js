"use strict";

// ─── Constants ────────────────────────────────────────────────────────────────

const CANVAS_H  = 300;
const GROUND_Y  = 262;   // top of ground platform
const GRAVITY   = 0.58;
const JUMP_VY   = -12.5;
const MOVE_SPD  = 4;
const WORLD_W   = 2400;

// Ground + elevated platforms
const PLATFORMS = [
  { x: 0,    y: GROUND_Y, w: WORLD_W, h: 38 }, // continuous ground
  { x: 310,  y: 208, w: 140, h: 14 },
  { x: 640,  y: 190, w: 120, h: 14 },
  { x: 940,  y: 205, w: 130, h: 14 },
  { x: 1270, y: 183, w: 140, h: 14 },
  { x: 1590, y: 198, w: 120, h: 14 },
  { x: 1880, y: 210, w: 130, h: 14 },
];

const ENEMY_TYPES = [
  { name: "Sloshed Goblin", emoji: "👺", maxHp: 32, atk: [7,12],  gold: [3,8]  },
  { name: "Drunk Skeleton", emoji: "💀", maxHp: 38, atk: [9,14],  gold: [4,9]  },
  { name: "Barfly Imp",     emoji: "😈", maxHp: 28, atk: [11,17], gold: [5,10] },
  { name: "Stumbling Ogre", emoji: "👹", maxHp: 55, atk: [10,16], gold: [6,12] },
  { name: "Hammered Witch", emoji: "🧙", maxHp: 30, atk: [13,19], gold: [5,11] },
  { name: "Wobbly Troll",   emoji: "🧌", maxHp: 48, atk: [11,15], gold: [5,10] },
];

const DEFAULT_BOSS = {
  name: "The Dungeon Bartender", emoji: "🍸",
  book: null, flavor: null,
  maxHp: 110, atk: [16,24], gold: [25,35],
  special: { name: "Last Call", atk: [28,38], chance: 0.28 },
};

const SHOP_DATA = [
  { id: "hpotion",    name: "Health Potion",   emoji: "🧪", desc: "+40 HP (Carl)",   cost: 8  },
  { id: "dirtyshirl", name: "Dirty Shirley's", emoji: "🍹", desc: "+25 HP (Donut)",  cost: 6  },
  { id: "sword",      name: "Shiv Upgrade",    emoji: "⚔️",  desc: "Carl +4 ATK",    cost: 10 },
  { id: "catnip",     name: "Catnip",          emoji: "🌿", desc: "Donut ATK ×2",    cost: 7  },
  { id: "shield",     name: "Bottle Shield",   emoji: "🛡️",  desc: "Block 1 hit",    cost: 8  },
];

// ─── State ────────────────────────────────────────────────────────────────────

let GS = {};
let canvas, ctx, animId;
let loadedBossData = null;
let hudMsg = { text: "", ttl: 0 };
const KEYS = {};

document.addEventListener("keydown", e => {
  KEYS[e.key] = true;
  if (["ArrowUp","ArrowDown"," "].includes(e.key)) e.preventDefault();
});
document.addEventListener("keyup", e => { KEYS[e.key] = false; });

function newState() {
  const boss  = loadedBossData || DEFAULT_BOSS;
  const picks = shuffle([...ENEMY_TYPES]).slice(0, 3);
  const exs   = [450, 1020, 1580];
  return {
    gold: 5,
    inventory: [],
    carl: {
      x: 80, y: GROUND_Y - 32, vx: 0, vy: 0,
      w: 28, h: 32, onGround: false, facingRight: true,
      hp: 80, maxHp: 80, atkBase: [12,18], atkBonus: 0, shielded: false,
    },
    donut: { hp: 45, maxHp: 45, cooldown: 0, buffed: false },
    cam: { x: 0 },
    enemies: picks.map((t, i) => ({
      ...t, hp: t.maxHp,
      x: exs[i], y: GROUND_Y - 32,
      w: 32, h: 32,
      vx: (i % 2 === 0 ? 1.5 : -1.5),
      defeated: false,
    })),
    boss: {
      ...boss, hp: boss.maxHp,
      x: WORLD_W - 280, y: GROUND_Y - 58,
      w: 48, h: 58, unlocked: false, defeated: false,
    },
    battle: null,
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function rand(a, b)     { return Math.floor(Math.random() * (b - a + 1)) + a; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function delay(ms)      { return new Promise(r => setTimeout(r, ms)); }
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}
function resizeCanvas() {
  canvas.width = Math.min(canvas.parentElement.clientWidth - 4, 700);
}
function showScreen(id) {
  document.querySelectorAll(".hh-screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ─── Overworld physics ────────────────────────────────────────────────────────

function physicsStep() {
  const c = GS.carl;

  c.vx = 0;
  if (KEYS["ArrowLeft"]  || KEYS["a"]) { c.vx = -MOVE_SPD; c.facingRight = false; }
  if (KEYS["ArrowRight"] || KEYS["d"]) { c.vx =  MOVE_SPD; c.facingRight = true;  }

  if ((KEYS["ArrowUp"] || KEYS["w"] || KEYS[" "]) && c.onGround) {
    c.vy = JUMP_VY; c.onGround = false;
  }

  c.vy = Math.min(c.vy + GRAVITY, 18);
  c.x  = clamp(c.x + c.vx, 0, WORLD_W - c.w);
  c.y += c.vy;
  c.onGround = false;

  for (const p of PLATFORMS) {
    const xOverlap = c.x + c.w > p.x && c.x < p.x + p.w;
    if (xOverlap && c.vy >= 0 && c.y + c.h >= p.y && c.y + c.h <= p.y + p.h + c.vy + 2) {
      c.y = p.y - c.h; c.vy = 0; c.onGround = true;
    }
  }

  // Camera
  const vw   = canvas.width;
  GS.cam.x   = clamp(c.x - vw / 2 + c.w / 2, 0, WORLD_W - vw);

  // Enemies patrol on ground
  for (const e of GS.enemies) {
    if (e.defeated) continue;
    e.x += e.vx;
    if (e.x < 20 || e.x + e.w > WORLD_W - 20) e.vx *= -1;
  }
}

// ─── Overworld rendering ──────────────────────────────────────────────────────

function drawOverworld() {
  const { cam, carl, enemies, boss } = GS;
  const cx = cam.x;
  const W  = canvas.width;
  const H  = CANVAS_H;

  // Sky → dungeon gradient
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#08040e");
  sky.addColorStop(1, "#1a0a28");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Platforms
  for (const p of PLATFORMS) {
    const px = p.x - cx;
    if (px + p.w < 0 || px > W) continue;
    if (p.y >= GROUND_Y) {
      ctx.fillStyle = "#261a36"; ctx.fillRect(px, p.y, p.w, p.h);
      ctx.fillStyle = "#503870"; ctx.fillRect(px, p.y, p.w, 4);
    } else {
      ctx.fillStyle = "#3d2010"; ctx.fillRect(px, p.y, p.w, p.h);
      ctx.fillStyle = "#7a5020"; ctx.fillRect(px, p.y, p.w, 3);
    }
  }

  // Boss door
  if (!boss.defeated) {
    const bx = boss.x - cx;
    if (bx + boss.w > 0 && bx < W) {
      ctx.fillStyle = boss.unlocked ? "#7a5800" : "#2a2a2a";
      ctx.fillRect(bx, boss.y, boss.w, boss.h);
      ctx.font = "32px serif"; ctx.textAlign = "center";
      ctx.fillText(boss.unlocked ? "🚪" : "🔒", bx + boss.w / 2, boss.y + 44);
    }
  }

  // Enemies + mini HP bar
  ctx.font = "28px serif"; ctx.textAlign = "center";
  for (const e of enemies) {
    if (e.defeated) continue;
    const ex = e.x - cx;
    if (ex + e.w < 0 || ex > W) continue;
    ctx.fillText(e.emoji, ex + e.w / 2, e.y + e.h - 2);
    const pct = e.hp / e.maxHp;
    ctx.fillStyle = "#333"; ctx.fillRect(ex, e.y - 9, e.w, 5);
    ctx.fillStyle = pct > 0.5 ? "#4a4" : pct > 0.25 ? "#a84" : "#a33";
    ctx.fillRect(ex, e.y - 9, e.w * pct, 5);
  }

  // Carl
  const csx = carl.x - cx;
  ctx.save();
  ctx.font = "28px serif"; ctx.textAlign = "center";
  if (!carl.facingRight) {
    ctx.translate(csx + carl.w / 2, 0);
    ctx.scale(-1, 1);
    ctx.fillText("🧙", 0, carl.y + carl.h - 2);
  } else {
    ctx.fillText("🧙", csx + carl.w / 2, carl.y + carl.h - 2);
  }
  ctx.restore();

  // Donut follows Carl
  ctx.font = "20px serif"; ctx.textAlign = "center";
  const donutOffX = carl.facingRight ? -20 : carl.w + 4;
  ctx.fillText("🐱", csx + donutOffX + 10, carl.y + carl.h - 2);

  // HUD strip
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, W, 26);
  ctx.fillStyle = "#c8a030";
  ctx.font = "11px 'Courier New', monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Carl ${Math.max(0, carl.hp)}/${carl.maxHp} HP`, 6, 17);
  ctx.fillText(`Donut ${Math.max(0, GS.donut.hp)}/${GS.donut.maxHp} HP`, 160, 17);
  ctx.textAlign = "right";
  ctx.fillText(`💰 ${GS.gold}`, W - 6, 17);
  const rem = enemies.filter(e => !e.defeated).length;
  ctx.textAlign = "center";
  if (!boss.unlocked) {
    ctx.fillStyle = "#a090b0";
    ctx.fillText(`Enemies: ${rem}/3 remaining`, W / 2, 17);
  } else if (!boss.defeated) {
    ctx.fillStyle = "#ff5050";
    ctx.fillText("⚠ BOSS UNLOCKED →", W / 2, 17);
  }

  // Hud message
  if (hudMsg.ttl > 0) {
    hudMsg.ttl--;
    ctx.fillStyle = "rgba(200,50,50,0.92)";
    ctx.font = "bold 13px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText(hudMsg.text, W / 2, 54);
  }
}

// ─── Overworld tick ───────────────────────────────────────────────────────────

function overworldTick() {
  if (!GS.battle) physicsStep();
  drawOverworld();
  checkEncounters();
  animId = requestAnimationFrame(overworldTick);
}

function checkEncounters() {
  if (GS.battle) return;
  const carl = GS.carl;
  for (const e of GS.enemies) {
    if (!e.defeated && aabb(carl, e)) { triggerBattle(e, false); return; }
  }
  const b = GS.boss;
  if (!b.defeated && b.unlocked && aabb(carl, b)) { triggerBattle(b, true); return; }
  if (!b.unlocked && !b.defeated && aabb(carl, b)) {
    // Locked door — push Carl back
    GS.carl.x += GS.carl.facingRight ? -50 : 50;
    GS.carl.x  = clamp(GS.carl.x, 0, WORLD_W - GS.carl.w);
    hudMsg = { text: "Defeat all 3 enemies first!", ttl: 130 };
  }
  if (!b.unlocked && GS.enemies.every(e => e.defeated)) b.unlocked = true;
}

// ─── Battle: start ────────────────────────────────────────────────────────────

function triggerBattle(enemy, isBoss) {
  // Prevent re-triggering while transitioning
  if (GS.battle) return;
  GS.battle = { enemy, isBoss, busy: false, playerTurn: false, over: false, defending: false };

  // Push Carl away so he doesn't re-trigger on return
  GS.carl.x += GS.carl.facingRight ? -60 : 60;
  GS.carl.x  = clamp(GS.carl.x, 0, WORLD_W - GS.carl.w);

  showScreen("screen-battle");
  renderBattleField();
  setBattleText(`A wild ${enemy.name} appeared!`);
  hideBattleMoves();
  setTimeout(() => {
    setBattleText("What will Carl do?");
    showBattleMoves();
  }, 1800);
}

// ─── Battle: UI helpers ───────────────────────────────────────────────────────

function renderBattleField() {
  const { enemy, isBoss } = GS.battle;
  document.getElementById("b-ename").textContent       = enemy.name;
  document.getElementById("b-enemy-emoji").textContent = enemy.emoji;
  const bookEl = document.getElementById("b-ebook");
  bookEl.textContent = (isBoss && enemy.book) ? `from "${enemy.book}"` : "";
  bookEl.style.display = (isBoss && enemy.book) ? "" : "none";
  updateBattleHpBars();
}

function updateBattleHpBars() {
  setHpBar("b-enemy-hp", GS.battle.enemy.hp, GS.battle.enemy.maxHp, false);
  setHpBar("b-carl-hp",  GS.carl.hp,         GS.carl.maxHp,         false);
  setHpBar("b-donut-hp", GS.donut.hp,        GS.donut.maxHp,        true);
}

function setHpBar(id, hp, maxHp, isDonut) {
  const el  = document.getElementById(id);
  if (!el) return;
  const bar = el.querySelector(".bf-hp-fill");
  const num = el.querySelector(".bf-hp-num");
  const pct = clamp(hp / maxHp, 0, 1);
  if (bar) {
    bar.style.width = `${(pct * 100).toFixed(1)}%`;
    if (!isDonut) bar.style.background = pct > 0.5 ? "#50c050" : pct > 0.25 ? "#c09030" : "#c03030";
  }
  if (num) num.textContent = `${Math.max(0, hp)}/${maxHp}`;
}

function setBattleText(t) {
  const el = document.getElementById("b-text");
  if (el) el.textContent = t;
}

function showBattleMoves() {
  resetMovesHTML();
  document.getElementById("b-moves").style.display = "";
  syncMoveButtons();
}

function hideBattleMoves() {
  document.getElementById("b-moves").style.display = "none";
}

function syncMoveButtons() {
  const dnt = document.getElementById("b-btn-donut");
  if (dnt) {
    dnt.disabled    = GS.donut.cooldown > 0 || GS.donut.hp <= 0;
    dnt.textContent = GS.donut.cooldown > 0 ? `🐱 Cat Strike (${GS.donut.cooldown})` : "🐱 Cat Strike";
  }
  const itm = document.getElementById("b-btn-item");
  if (itm) itm.disabled = GS.inventory.length === 0;
}

function resetMovesHTML() {
  document.getElementById("b-moves").innerHTML = `
    <button class="b-move-btn" id="b-btn-attack" onclick="battleAction('attack')">⚔️ Attack</button>
    <button class="b-move-btn" id="b-btn-donut"  onclick="battleAction('donut')">🐱 Cat Strike</button>
    <button class="b-move-btn" id="b-btn-item"   onclick="battleAction('item')">🎒 Items</button>
    <button class="b-move-btn" id="b-btn-run"    onclick="battleAction('run')">🏃 Run</button>`;
}

function shakeEl(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("hh-shake");
  void el.offsetWidth;
  el.classList.add("hh-shake");
  setTimeout(() => el.classList.remove("hh-shake"), 400);
}

// ─── Battle: player actions ───────────────────────────────────────────────────

async function battleAction(type) {
  const bt = GS.battle;
  if (!bt || bt.busy || bt.over) return;
  bt.busy = true;
  hideBattleMoves();

  if (type === "run") {
    if (bt.isBoss) {
      setBattleText("There's no escaping the boss!");
      await delay(1500);
      setBattleText("What will Carl do?");
      showBattleMoves();
      bt.busy = false;
      return;
    }
    if (Math.random() < 0.5) {
      setBattleText("Carl got away safely!");
      await delay(1400);
      endBattle();
      return;
    }
    setBattleText("Couldn't escape!");
    await delay(1200);
    await enemyTurn();
    return;
  }

  if (type === "attack") {
    const dmgC = rand(...GS.carl.atkBase) + (GS.carl.atkBonus || 0);
    bt.enemy.hp -= dmgC;
    setBattleText(`Carl attacks for ${dmgC} damage!`);
    shakeEl("b-enemy-wrap");

  } else if (type === "donut") {
    let dmg = rand(14, 22);
    if (GS.donut.buffed) { dmg *= 2; GS.donut.buffed = false; }
    bt.enemy.hp      -= dmg;
    GS.donut.cooldown = 3;
    setBattleText(`Donut pounces for ${dmg} damage!${dmg >= 28 ? " It's super effective!" : ""}`);
    shakeEl("b-enemy-wrap");

  } else if (type === "item") {
    openItemPicker();
    bt.busy = false;
    return;
  }

  updateBattleHpBars();
  await delay(1000);

  if (bt.enemy.hp <= 0) { await onBattleWin(); return; }
  await enemyTurn();
}

// ─── Battle: enemy turn ───────────────────────────────────────────────────────

async function enemyTurn() {
  const bt = GS.battle;
  const e  = bt.enemy;
  let dmg;

  if (e.special && Math.random() < e.special.chance) {
    dmg = rand(...e.special.atk);
    setBattleText(`${e.name} uses "${e.special.name}"!`);
    await delay(900);
  } else {
    dmg = rand(...e.atk);
  }

  if (GS.carl.shielded) {
    GS.carl.shielded = false;
    setBattleText("🛡️ Carl's shield blocks the hit completely!");
    dmg = 0;
  } else if (bt.defending) {
    dmg = Math.floor(dmg * 0.4);
    setBattleText(`${e.name} attacks for ${dmg} (deflected)!`);
  } else {
    setBattleText(`${e.name} attacks Carl for ${dmg}!`);
  }

  if (dmg > 0) { GS.carl.hp -= dmg; shakeEl("b-player-wrap"); }
  bt.defending = false;
  if (GS.donut.cooldown > 0) GS.donut.cooldown--;

  updateBattleHpBars();
  await delay(1200);

  if (GS.carl.hp <= 0) {
    setBattleText("Carl fainted!");
    await delay(1600);
    document.getElementById("death-msg").textContent =
      `Carl fainted against ${e.name}. Donut escaped through a ventilation shaft.`;
    showScreen("screen-death");
    GS.battle = null;
    return;
  }

  setBattleText("What will Carl do?");
  bt.busy = false;
  showBattleMoves();
}

// ─── Battle: item picker ──────────────────────────────────────────────────────

function openItemPicker() {
  const movesEl = document.getElementById("b-moves");
  const btns = GS.inventory.map((id, i) => {
    const item = SHOP_DATA.find(s => s.id === id);
    return `<button class="b-move-btn" onclick="useBattleItem(${i})">${item ? item.emoji : "?"} ${item ? item.name : id}</button>`;
  }).join("");
  movesEl.innerHTML = `${btns}<button class="b-move-btn" onclick="closeItemPicker()">← Back</button>`;
  movesEl.style.display = "";
}

function closeItemPicker() { resetMovesHTML(); showBattleMoves(); GS.battle.busy = false; }

async function useBattleItem(idx) {
  const id = GS.inventory[idx];
  if (!id) return;
  GS.inventory.splice(idx, 1);
  hideBattleMoves();
  GS.battle.busy = true;

  switch (id) {
    case "hpotion":
      GS.carl.hp = Math.min(GS.carl.maxHp, GS.carl.hp + 40);
      setBattleText("Carl drinks a Health Potion! +40 HP");
      break;
    case "dirtyshirl":
      GS.donut.hp = Math.min(GS.donut.maxHp, GS.donut.hp + 25);
      setBattleText("Donut sips a Dirty Shirley's! +25 HP 🍹");
      break;
    case "sword":
      GS.carl.atkBonus = (GS.carl.atkBonus || 0) + 4;
      setBattleText(`Carl sharpens his blade! +4 ATK`);
      break;
    case "catnip":
      GS.donut.buffed = true;
      setBattleText("Donut sniffs catnip! Next Cat Strike ×2!");
      break;
    case "shield":
      GS.carl.shielded = true;
      setBattleText("Carl raises a bottle shield! Next hit blocked!");
      break;
  }
  updateBattleHpBars();
  await delay(1200);
  await enemyTurn();
}

// ─── Battle: win ──────────────────────────────────────────────────────────────

async function onBattleWin() {
  const bt         = GS.battle;
  const goldEarned = rand(...bt.enemy.gold);
  GS.gold         += goldEarned;
  bt.enemy.hp       = 0;
  bt.enemy.defeated = true;
  bt.over           = true;
  updateBattleHpBars();
  setBattleText(`${bt.enemy.name} fainted! +${goldEarned} 💰`);
  await delay(2000);

  if (bt.isBoss) {
    const boss = bt.enemy;
    document.getElementById("win-msg").textContent =
      `Carl and Donut defeated ${boss.name}${boss.book ? ` (from "${boss.book}")` : ""}! ` +
      `Final gold: 💰 ${GS.gold}`;
    GS.battle = null;
    showScreen("screen-win");
    return;
  }

  GS.battle = null;
  openShop();
}

function endBattle() {
  GS.battle = null;
  showScreen("screen-overworld");
}

// ─── Shop ─────────────────────────────────────────────────────────────────────

function openShop() {
  document.getElementById("shop-gold").textContent      = GS.gold;
  document.getElementById("shop-inv-count").textContent = GS.inventory.length;
  const grid = document.getElementById("shop-grid");
  grid.innerHTML = "";
  SHOP_DATA.forEach(item => {
    const canBuy = GS.gold >= item.cost && GS.inventory.length < 3;
    const card   = document.createElement("div");
    card.className = "shop-card";
    card.innerHTML = `
      <div class="shop-card-emoji">${item.emoji}</div>
      <div class="shop-card-name">${item.name}</div>
      <div class="shop-card-desc">${item.desc}</div>
      <div class="shop-card-price">💰 ${item.cost}</div>
      <button class="btn-buy" ${canBuy ? "" : "disabled"} onclick="buyItem('${item.id}')">Buy</button>`;
    grid.appendChild(card);
  });
  showScreen("screen-shop");
}

function buyItem(id) {
  if (GS.inventory.length >= 3) return;
  const item = SHOP_DATA.find(s => s.id === id);
  if (!item || GS.gold < item.cost) return;
  GS.gold -= item.cost;
  GS.inventory.push(id);
  openShop();
}

function leaveShop() {
  showScreen("screen-overworld");
}

// ─── Mobile controls ──────────────────────────────────────────────────────────

function bindMobile(id, key) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("pointerdown",  e => { KEYS[key] = true;  e.preventDefault(); }, { passive: false });
  el.addEventListener("pointerup",    e => { KEYS[key] = false; e.preventDefault(); }, { passive: false });
  el.addEventListener("pointerleave", ()  => { KEYS[key] = false; });
}

// ─── Entry point ──────────────────────────────────────────────────────────────

function startGame() {
  GS = newState();
  cancelAnimationFrame(animId);
  resizeCanvas();
  showScreen("screen-overworld");
  animId = requestAnimationFrame(overworldTick);
}

window.addEventListener("DOMContentLoaded", () => {
  canvas = document.getElementById("game-canvas");
  ctx    = canvas.getContext("2d");
  resizeCanvas();
  window.addEventListener("resize", () => { if (canvas) resizeCanvas(); });

  bindMobile("mb-left",  "ArrowLeft");
  bindMobile("mb-right", "ArrowRight");
  bindMobile("mb-jump",  " ");

  // Pre-fetch book boss character (non-blocking)
  fetch("/happy-hour/boss")
    .then(r => r.json())
    .then(data => {
      if (data && !data.default && data.character) {
        loadedBossData = {
          name:    data.character,
          emoji:   data.emoji  || "🦹",
          book:    data.book   || null,
          flavor:  data.flavor || null,
          maxHp:   data.hp     || 110,
          atk:     [data.atk_min || 16, data.atk_max || 26],
          gold:    [25, 35],
          special: { name: "Final Chapter", atk: [26, 36], chance: 0.28 },
        };
        // Update start button label to hint at the boss
        const btn = document.getElementById("start-btn");
        if (btn && loadedBossData.name !== DEFAULT_BOSS.name) {
          btn.title = `Boss: ${loadedBossData.name} (${loadedBossData.book})`;
        }
      }
    })
    .catch(() => {});
});
