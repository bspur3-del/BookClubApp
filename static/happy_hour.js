"use strict";

// ── Game Data ────────────────────────────────────────────────────────────────

const ROOMS_DATA = [
  { name: "The Watering Hole",  desc: "Stale beer, broken dreams.",     emoji: "🍺" },
  { name: "The Dark Corridor",  desc: "Something drips in the dark.",    emoji: "🌑" },
  { name: "The Trophy Room",    desc: "Dusty heads on dusty walls.",      emoji: "🏆" },
  { name: "The Wine Cellar",    desc: "Fine vintage, foul company.",      emoji: "🍷" },
  { name: "The Kitchen",        desc: "Grease and danger.",               emoji: "🍳" },
  { name: "The Lounge",         desc: "Someone left the TV on.",          emoji: "📺" },
];

const ENEMIES_DATA = [
  { name: "Sloshed Goblin",    emoji: "👺", maxHp: 32, atk: [7,12],  gold: [3,8]  },
  { name: "Drunk Skeleton",    emoji: "💀", maxHp: 38, atk: [9,14],  gold: [4,9]  },
  { name: "Barfly Imp",        emoji: "😈", maxHp: 28, atk: [11,17], gold: [5,10] },
  { name: "Stumbling Ogre",    emoji: "👹", maxHp: 55, atk: [10,16], gold: [6,12] },
  { name: "Hammered Witch",    emoji: "🧙‍♀️", maxHp: 30, atk: [13,19], gold: [5,11] },
  { name: "Wobbly Troll",      emoji: "🧌", maxHp: 48, atk: [11,15], gold: [5,10] },
];

const BOSS_DATA = {
  name: "The Dungeon Bartender",
  emoji: "🍸",
  maxHp: 110,
  atk: [16,24],
  gold: [25,35],
  special: { name: "Last Call", atk: [28,38], chance: 0.28 },
};

const SHOP_DATA = [
  { id: "hpotion", name: "Health Potion",  emoji: "🧪", desc: "+40 HP (Carl)",    cost: 8  },
  { id: "dpotion", name: "Donut Treat",    emoji: "🍩", desc: "+25 HP (Donut)",   cost: 6  },
  { id: "sword",   name: "Shiv Upgrade",   emoji: "⚔️",  desc: "Carl +4 ATK",     cost: 10 },
  { id: "catnip",  name: "Catnip",         emoji: "🌿", desc: "Donut ATK ×2",     cost: 7  },
  { id: "shield",  name: "Bottle Shield",  emoji: "🛡️",  desc: "Block 1 hit",     cost: 8  },
];

// ── State ────────────────────────────────────────────────────────────────────

let GS = {};

function newState() {
  const rooms   = shuffle([...ROOMS_DATA]).slice(0, 3);
  const enemies = shuffle([...ENEMIES_DATA]).slice(0, 3).map(e => ({ ...e, hp: e.maxHp }));
  return {
    roomIdx:    0,
    rooms,
    enemies,
    gold:       5,
    carl: {
      hp: 80, maxHp: 80,
      atkBase: [12, 18], atkBonus: 0,
      defending: false, shielded: false,
    },
    donut: {
      hp: 45, maxHp: 45,
      cooldown: 0, buffed: false,
    },
    enemy:       null,
    inventory:   [],
    combatOver:  false,
    playerTurn:  true,
    busy:        false,
  };
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Screen management ─────────────────────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll(".game-screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function setAnnouncer(text) {
  document.getElementById("announcer").textContent = text;
}

function addLog(text, cls = "") {
  const log  = document.getElementById("combat-log");
  const line = document.createElement("div");
  if (cls) line.className = cls;
  line.textContent = text;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function clearLog() {
  document.getElementById("combat-log").innerHTML = "";
}

function flashCard(id) {
  const card = document.getElementById(id);
  if (!card) return;
  card.classList.remove("hit");
  void card.offsetWidth;
  card.classList.add("hit");
  setTimeout(() => card.classList.remove("hit"), 400);
}

function hpFillClass(who, pct) {
  if (pct <= 0.2) return `hp-fill ${who} crit`;
  if (pct <= 0.4) return `hp-fill ${who} low`;
  return `hp-fill ${who}`;
}

function updateCharCard(who) {
  const ch  = GS[who];
  const pct = clamp(ch.hp / ch.maxHp, 0, 1);

  const bar = document.getElementById(`${who}-hp-bar`);
  const txt = document.getElementById(`${who}-hp-text`);
  if (bar) { bar.style.width = `${(pct * 100).toFixed(1)}%`; bar.className = hpFillClass(who, pct); }
  if (txt) txt.textContent = `${Math.max(0, ch.hp)}/${ch.maxHp}`;

  const card = document.getElementById(`${who}-card`);
  if (card) card.classList.toggle("dead", ch.hp <= 0);

  if (who === "carl") {
    const sub   = document.getElementById("carl-sub");
    const buffs = document.getElementById("carl-buffs");
    if (sub)   { sub.textContent = ch.defending ? "Defending…" : ""; sub.className = "char-sub" + (ch.defending ? " ready" : ""); }
    if (buffs) buffs.textContent = [(ch.atkBonus > 0 ? `+${ch.atkBonus} ATK` : ""), (ch.shielded ? "🛡️" : "")].filter(Boolean).join(" ");
  }
  if (who === "donut") {
    const sub   = document.getElementById("donut-sub");
    const buffs = document.getElementById("donut-buffs");
    if (sub)   { sub.textContent = ch.cooldown > 0 ? `Cooldown: ${ch.cooldown}` : "Ready"; sub.className = "char-sub" + (ch.cooldown === 0 ? " ready" : ""); }
    if (buffs) buffs.textContent = ch.buffed ? "🌿 Buffed!" : "";
  }
}

function updateEnemy() {
  if (!GS.enemy) return;
  const e   = GS.enemy;
  const pct = clamp(e.hp / e.maxHp, 0, 1);
  const bar = document.getElementById("enemy-hp-bar");
  const txt = document.getElementById("enemy-hp-text");
  if (bar) { bar.style.width = `${(pct * 100).toFixed(1)}%`; bar.className = hpFillClass("enemy", pct); }
  if (txt) txt.textContent = `${Math.max(0, e.hp)}/${e.maxHp}`;
  const card = document.getElementById("enemy-card");
  if (card) card.classList.toggle("dead", e.hp <= 0);
}

function updateHUD() {
  document.getElementById("hud-room").textContent     = `Room ${GS.roomIdx + 1} of 4`;
  document.getElementById("hud-carl-hp").textContent  = `Carl: ${Math.max(0, GS.carl.hp)}/${GS.carl.maxHp}`;
  document.getElementById("hud-donut-hp").textContent = `Donut: ${Math.max(0, GS.donut.hp)}/${GS.donut.maxHp}`;
  document.getElementById("hud-gold").textContent     = GS.gold;
}

function updateInventoryStrip() {
  for (let i = 0; i < 3; i++) {
    const slot = document.getElementById(`inv-${i}`);
    if (!slot) continue;
    const id   = GS.inventory[i];
    const item = id ? SHOP_DATA.find(s => s.id === id) : null;
    if (item) {
      slot.textContent = item.emoji;
      slot.className   = "inv-slot";
      slot.title       = item.name;
    } else {
      slot.textContent = "";
      slot.className   = "inv-slot empty";
      slot.title       = "";
    }
  }
}

// ── Action panel ──────────────────────────────────────────────────────────────

function resetActionPanel() {
  document.getElementById("action-panel").innerHTML = `
    <button class="btn-act btn-attack" id="btn-attack" onclick="doAction('attack')">⚔️ Attack</button>
    <button class="btn-act btn-defend" id="btn-defend" onclick="doAction('defend')">🛡️ Defend</button>
    <button class="btn-act btn-item"   id="btn-item"   onclick="openItemPicker()">🎒 Item</button>
    <button class="btn-act btn-donut"  id="btn-donut"  onclick="doAction('donut')">🐱 Cat Strike</button>
    <button class="btn-act btn-go"     id="btn-go"     onclick="nextRoom()" style="display:none">➡️ Next Room</button>`;
  syncActionPanel();
}

function syncActionPanel() {
  const over  = GS.combatOver;
  const busy  = GS.busy;
  const noAct = over || busy || !GS.playerTurn;
  const atk   = document.getElementById("btn-attack");
  const def   = document.getElementById("btn-defend");
  const itm   = document.getElementById("btn-item");
  const dnt   = document.getElementById("btn-donut");
  const go    = document.getElementById("btn-go");
  if (atk) atk.disabled = noAct;
  if (def) def.disabled = noAct;
  if (itm) itm.disabled = noAct || GS.inventory.length === 0;
  if (dnt) {
    dnt.disabled     = noAct || GS.donut.cooldown > 0 || GS.donut.hp <= 0;
    dnt.textContent  = GS.donut.cooldown > 0 ? `🐱 Cat Strike (${GS.donut.cooldown})` : "🐱 Cat Strike";
  }
  if (go) go.style.display = over ? "" : "none";
}

function disableAllButtons() {
  ["btn-attack","btn-defend","btn-item","btn-donut","btn-go"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });
}

// ── Item picker ───────────────────────────────────────────────────────────────

function openItemPicker() {
  if (GS.busy || !GS.playerTurn || GS.inventory.length === 0) return;
  const btns = GS.inventory.map((id, i) => {
    const item = SHOP_DATA.find(s => s.id === id);
    return `<button class="btn-pick" onclick="useItem(${i})">${item ? item.emoji : "?"} ${item ? item.name : id}</button>`;
  }).join("");
  document.getElementById("action-panel").innerHTML = `
    <div class="item-picker">
      ${btns}
      <button class="btn-cancel" onclick="resetActionPanel()">Cancel</button>
    </div>`;
}

function useItem(idx) {
  const id = GS.inventory[idx];
  if (!id) return;
  GS.inventory.splice(idx, 1);
  resetActionPanel();
  GS.busy = true;
  disableAllButtons();

  const itemName = (SHOP_DATA.find(s => s.id === id) || {}).name || id;

  switch (id) {
    case "hpotion":
      GS.carl.hp = Math.min(GS.carl.maxHp, GS.carl.hp + 40);
      addLog(`Carl drinks Health Potion! +40 HP`, "log-carl");
      updateCharCard("carl");
      break;
    case "dpotion":
      GS.donut.hp = Math.min(GS.donut.maxHp, GS.donut.hp + 25);
      addLog(`Donut eats a treat! +25 HP`, "log-donut");
      updateCharCard("donut");
      break;
    case "sword":
      GS.carl.atkBonus = (GS.carl.atkBonus || 0) + 4;
      addLog(`Carl sharpens his blade! +4 ATK (total bonus: +${GS.carl.atkBonus})`, "log-carl");
      updateCharCard("carl");
      break;
    case "catnip":
      GS.donut.buffed = true;
      addLog(`Donut sniffs catnip! Next Cat Strike deals double damage!`, "log-donut");
      updateCharCard("donut");
      break;
    case "shield":
      GS.carl.shielded = true;
      addLog(`Carl raises a bottle shield! Next hit will be blocked!`, "log-carl");
      updateCharCard("carl");
      break;
  }

  updateHUD();
  updateInventoryStrip();
  setTimeout(() => enemyTurn(), 500);
}

// ── Core combat ───────────────────────────────────────────────────────────────

async function doAction(type) {
  if (GS.busy || !GS.playerTurn || GS.combatOver) return;
  GS.busy       = true;
  GS.playerTurn = false;
  disableAllButtons();

  if (type === "attack") {
    const dmg = rand(...GS.carl.atkBase) + (GS.carl.atkBonus || 0);
    GS.enemy.hp -= dmg;
    addLog(`Carl attacks ${GS.enemy.name} for ${dmg} damage!`, "log-carl");
    flashCard("enemy-card");
    updateEnemy();

  } else if (type === "defend") {
    GS.carl.defending = true;
    addLog(`Carl takes a defensive stance!`, "log-carl");
    updateCharCard("carl");

  } else if (type === "donut") {
    let dmg = rand(14, 22);
    if (GS.donut.buffed) {
      dmg            *= 2;
      GS.donut.buffed = false;
      addLog(`🌿 Catnip power doubles the strike!`, "log-system");
    }
    GS.enemy.hp    -= dmg;
    GS.donut.cooldown = 3;
    addLog(`Donut pounces on ${GS.enemy.name} for ${dmg} damage! (cooldown 3)`, "log-donut");
    flashCard("enemy-card");
    updateEnemy();
    updateCharCard("donut");
  }

  updateHUD();
  await delay(350);

  if (GS.enemy.hp <= 0) {
    await onEnemyDefeated();
    return;
  }

  await enemyTurn();
}

async function enemyTurn() {
  await delay(300);
  const e = GS.enemy;
  let dmg       = 0;
  let isSpecial = false;

  if (e.special && Math.random() < e.special.chance) {
    isSpecial = true;
    dmg       = rand(...e.special.atk);
    addLog(`${e.name} uses "${e.special.name}"!`, "log-enemy");
    setAnnouncer(`💥 ${e.special.name}!`);
    await delay(450);
  } else {
    dmg = rand(...e.atk);
  }

  if (GS.carl.shielded) {
    GS.carl.shielded = false;
    addLog(`🛡️ Carl's bottle shield absorbs the blow! No damage.`, "log-carl");
    dmg = 0;
  } else if (GS.carl.defending) {
    dmg = Math.floor(dmg * 0.4);
    addLog(`${e.name} hits Carl for ${dmg} (deflected by defense)!`, "log-enemy");
  } else {
    addLog(`${e.name} hits Carl for ${dmg}!`, "log-enemy");
  }

  if (dmg > 0) { GS.carl.hp -= dmg; flashCard("carl-card"); }
  GS.carl.defending = false;

  if (GS.donut.cooldown > 0) { GS.donut.cooldown--; }

  updateCharCard("carl");
  updateCharCard("donut");
  updateHUD();
  await delay(200);

  if (GS.carl.hp <= 0) {
    GS.combatOver = true;
    setAnnouncer("💀 Carl has fallen...");
    addLog("Carl collapses. The dungeon claims another soul.", "log-system");
    await delay(1600);
    document.getElementById("death-msg").textContent =
      `Carl fell in Room ${GS.roomIdx + 1}. Donut escaped through a ventilation shaft. Better luck next time.`;
    showScreen("screen-death");
    return;
  }

  GS.playerTurn = true;
  GS.busy       = false;
  setAnnouncer("Your turn — choose an action.");
  resetActionPanel();
}

async function onEnemyDefeated() {
  const e          = GS.enemy;
  const goldEarned = rand(...e.gold);
  GS.gold         += goldEarned;
  GS.combatOver    = true;

  document.getElementById("enemy-card").classList.add("dead");
  addLog(`${e.name} is defeated! +${goldEarned} gold 💰`, "log-loot");
  setAnnouncer(`✅ ${e.name} defeated! +${goldEarned} gold`);
  updateHUD();
  await delay(600);

  if (GS.roomIdx === 3) {
    document.getElementById("win-msg").textContent =
      `Carl and Donut defeated the Dungeon Bartender and earned the legendary Last Call! Total gold: 💰 ${GS.gold}`;
    await delay(800);
    showScreen("screen-win");
    return;
  }

  GS.busy = false;
  resetActionPanel();
  setAnnouncer("✅ Victory! Head to the shop, then move on.");
}

// ── Room navigation ───────────────────────────────────────────────────────────

function nextRoom() {
  openShop();
}

function openShop() {
  document.getElementById("shop-gold").textContent     = GS.gold;
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
  const nextIdx = GS.roomIdx + 1;
  showScreen("screen-game");
  loadRoom(nextIdx);
}

// ── Load room ─────────────────────────────────────────────────────────────────

function loadRoom(idx) {
  GS.roomIdx     = idx;
  GS.combatOver  = false;
  GS.playerTurn  = true;
  GS.busy        = false;
  GS.carl.defending = false;

  let enemy, roomName, roomDesc;

  if (idx < 3) {
    const base = GS.enemies[idx];
    enemy    = { ...base, hp: base.maxHp };
    roomName = GS.rooms[idx].name;
    roomDesc = GS.rooms[idx].desc;
    setAnnouncer(`⚠️ A ${enemy.name} appears!`);
  } else {
    enemy    = { ...BOSS_DATA, hp: BOSS_DATA.maxHp };
    roomName = "The Last Call";
    roomDesc = "Final boss. No refunds.";
    setAnnouncer("👑 THE DUNGEON BARTENDER RISES!");
    addLog("═══ BOSS FIGHT ═══", "log-system");
  }

  GS.enemy = enemy;

  document.getElementById("enemy-name").textContent   = enemy.name;
  document.getElementById("enemy-avatar").textContent = enemy.emoji;
  document.getElementById("room-label").textContent   = roomName;
  document.getElementById("room-desc").textContent    = roomDesc;

  updateHUD();
  updateCharCard("carl");
  updateCharCard("donut");
  updateEnemy();
  updateInventoryStrip();
  resetActionPanel();

  addLog(`─── Room ${idx + 1} of 4: ${roomName} ───`, "log-system");
  addLog(`${enemy.name} (${enemy.hp} HP) enters the arena!`, "log-enemy");
}

// ── Entry point ───────────────────────────────────────────────────────────────

function startGame() {
  GS = newState();
  clearLog();
  showScreen("screen-game");
  loadRoom(0);
}
