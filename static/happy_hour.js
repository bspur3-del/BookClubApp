"use strict";
// ── Princess Donut's Dungeon Defense ─────────────────────────────────────────

const CW = 560, CH = 680, HUD_H = 48;
const GROUND_Y = CH - 60;

// ── Enemy definitions ─────────────────────────────────────────────────────────
const ENEMY_DEFS = [
  { id:'kobold',    name:'Kobold',            emoji:'🐉', hp:2,  pts:10, spd:1.0, shoots:false },
  { id:'goblin',    name:'Goblin Bomb Bard',  emoji:'💣', hp:3,  pts:15, spd:1.1, shoots:true  },
  { id:'dire_rat',  name:'Dire Rat',          emoji:'🐀', hp:2,  pts:12, spd:1.8, shoots:false },
  { id:'hob',       name:'Hob',               emoji:'👺', hp:4,  pts:20, spd:0.9, shoots:true  },
  { id:'dingo',     name:'Danger Dingo',      emoji:'🐕', hp:3,  pts:18, spd:1.5, shoots:false },
  { id:'tuskling',  name:'Tuskling',          emoji:'🐗', hp:6,  pts:35, spd:0.7, shoots:true  },
  { id:'skeleton',  name:'Skeleton Warrior',  emoji:'💀', hp:5,  pts:30, spd:0.8, shoots:true  },
  { id:'box_troll', name:'Box Troll',         emoji:'📦', hp:8,  pts:50, spd:0.5, shoots:false, dropPU:true },
  { id:'crawler',   name:'Crawlersworn',      emoji:'🤖', hp:10, pts:75, spd:1.0, shoots:true  },
];

const BOSS_DEFS = [
  { id:'formidable', name:'The Formidable', emoji:'👾', hp:80,  pts:400, spd:0.6, shoots:true, isBoss:true },
  { id:'empress',    name:'Skull Empress',  emoji:'💀', hp:120, pts:600, spd:0.5, shoots:true, isBoss:true },
];

// ── Power-up definitions (all from DCC books) ─────────────────────────────────
const POWERUP_DEFS = [
  {
    id:'tome', name:'Tome of Magic Missile', emoji:'✨',
    achievement:'TOME OF MAGIC MISSILE',
    desc:"Donut's missiles deal double damage!",
    apply(gs){ gs.player.bulletDmg = Math.min(gs.player.bulletDmg + 1, 4); }
  },
  {
    id:'shell', name:'Protective Shell', emoji:'🛡️',
    achievement:'PROTECTIVE SHELL',
    desc:'Magical barrier absorbs one hit!',
    apply(gs){ gs.player.shield = true; }
  },
  {
    id:'haste', name:'Haste Potion', emoji:'💨',
    achievement:'HASTE POTION',
    desc:'Donut moves at ludicrous speed for 8 seconds!',
    apply(gs){ gs.player.hasteEnd = gs.elapsed + 8000; }
  },
  {
    id:'tiara', name:"Princess's Tiara Power", emoji:'👑',
    achievement:"PRINCESS'S TIARA POWER",
    desc:'Triple Magic Missile shot!',
    apply(gs){ gs.player.tripleShot = true; }
  },
  {
    id:'satchel', name:'Satchel of Holding', emoji:'💼',
    achievement:'SATCHEL OF HOLDING',
    desc:'Extra life stored in an extra-dimensional pocket!',
    apply(gs){ gs.player.lives = Math.min(gs.player.lives + 1, 5); }
  },
  {
    id:'blink', name:'Blink Dog Charm', emoji:'🐕',
    achievement:'BLINK DOG CHARM',
    desc:'Press SPACE to blink to the opposite side!',
    apply(gs){ gs.player.blinks++; }
  },
  {
    id:'biscuit', name:'Enhanced Pet Biscuit', emoji:'🍪',
    achievement:'ENHANCED PET BISCUIT',
    desc:'5 seconds of full invincibility — Donut is UNSTOPPABLE!',
    apply(gs){ gs.player.invEnd = Math.max(gs.player.invEnd, gs.elapsed + 5000); }
  },
  {
    id:'mana_toast', name:'Mana Toast', emoji:'🍞',
    achievement:'MANA TOAST',
    desc:'Rapid-fire mode! Fire rate tripled for 10 seconds!',
    apply(gs){ gs.player.rapidEnd = gs.elapsed + 10000; }
  },
];

// ── Quips ─────────────────────────────────────────────────────────────────────
const SYSTEM_QUIPS = {
  kill: [
    "The System: Mob eliminated. Gold deposited. The dungeon remains indifferent to your survival.",
    "The System: Kill confirmed. For context, this unit previously exploded a tourist in a gift shop.",
    "The System: 4.7 billion viewers are watching. Statistically, most are rooting against you.",
    "The System: That mob had aspirations. Past tense now.",
    "The System: Your patron has taken notice. They are 'mildly not disgusted.' High praise.",
  ],
  wave: [
    "The System: Wave cleared. Survival odds revised upward by 0.3%. Try not to celebrate.",
    "The System: All mobs eliminated. The next wave will be worse. This is not a threat. It is a fact.",
    "The System: Wave complete. The dungeon offers its grudging acknowledgment. Just kidding.",
    "The System: Congratulations on surviving. The System did not have you in the betting pool.",
  ],
  hit: [
    "The System: Damage taken. The audience response is overwhelmingly 'lol'.",
    "The System: HP reduced. Noted. Moving on.",
    "The System: You've been hit. It's fine. Probably.",
  ],
  powerup: [
    "The System: Item acquired. Please don't die immediately after. For the ratings.",
    "The System: Power-up collected. Odds improved by a statistically irrelevant margin.",
    "The System: Oh. You found something. The System is cautiously optimistic. Briefly.",
  ],
  lowHP: [
    "The System: CRITICAL HEALTH WARNING. Betting pools updated. Not in your favor.",
    "The System: You are nearly dead. The audience is standing. This is the most exciting part.",
    "The System: One hit remaining. The System has flagged this as 'your problem.'",
  ],
  boss: [
    "The System: Boss entity detected. Survival probability has been redacted for your comfort.",
    "The System: A floor boss has appeared. It was specifically designed to end you.",
    "The System: Boss wave initiated. The System formally distances itself from whatever happens next.",
  ],
};

const DONUT_QUIPS = {
  kill: [
    "Donut: 'Darling, you don't stand a CHANCE against me.'",
    "Donut: 'Carl would have died in wave one. That's just facts.'",
    "Donut: 'Another one? I've barely warmed up my eye-lasers.'",
    "Donut: 'Do you know how expensive this tiara is? BACK. OFF.'",
    "Donut: 'Every kill is a highlight reel moment. The cameras love me.'",
  ],
  hit: [
    "Donut: 'HOW DARE YOU touch the princess!'",
    "Donut: 'That was my GOOD side, you absolute trash mob!'",
    "Donut: 'I will REMEMBER this insult. In detail.'",
    "Donut: 'This is going in my formal complaint to the Borant Corporation.'",
  ],
  powerup: [
    "Donut: 'Ooh! A new accessory! It's MINE now, obviously.'",
    "Donut: 'Everything in this dungeon belongs to me. Including that.'",
    "Donut: 'Finally, something worthy of my stature.'",
  ],
  wave: [
    "Donut: 'Is that ALL you've got? I'm getting BORED.'",
    "Donut: 'Next wave better be more of a challenge. This is embarrassing.'",
    "Donut: 'Wave cleared! Make sure the cameras got my good angle.'",
  ],
  death: [
    "This is obviously Carl's fault somehow. I'm filing a formal complaint.",
    "I'm not dead. I'm dramatically incapacitated. There is a difference.",
    "My fanbase will NOT be pleased. Someone is getting a very withering look.",
    "Tell Carl I died beautifully. With my tiara on. This is important.",
    "I demand a recount. Also a resurrection. Also a snack.",
  ],
};

const DEATH_SYSTEM_QUIPS = [
  "The System: Crawler eliminated. The dungeon thanks you for your contribution.",
  "The System: Survival odds were 12%. You underperformed expectations.",
  "The System: Cause of death logged. It will air on Dungeon Crawler World: Earth next Tuesday.",
  "The System: The princess has fallen. Viewing audience gave it 4.7 stars.",
  "The System: Game over. The System has seen worse. The System has also caused worse.",
];

// ── Utility ───────────────────────────────────────────────────────────────────
function pick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

// ── Game object ───────────────────────────────────────────────────────────────
const Game = {
  canvas: null, ctx: null, animId: null, lastTs: 0,
  gs: null,

  // ── Init ──────────────────────────────────────────────────────────────────
  init() {
    this.canvas = document.getElementById('game-canvas');
    this.canvas.width  = CW;
    this.canvas.height = CH;
    this.ctx = this.canvas.getContext('2d');
    this._bindInput();
    this._bindMobile();
  },

  // ── Screens ───────────────────────────────────────────────────────────────
  showScreen(id) {
    document.querySelectorAll('.pd-screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + id).classList.add('active');
  },

  // ── New game state ────────────────────────────────────────────────────────
  newGs() {
    return {
      player: {
        x: CW / 2, y: GROUND_Y,
        w: 44, h: 44,
        lives: 3,
        shield: false, tripleShot: false, blinks: 0,
        bulletDmg: 1,
        hasteEnd: 0, rapidEnd: 0, invEnd: 0,
        lastFired: 0, invFrames: 0,
        speed: 5,
      },
      bullets: [],       // {x,y,dmg}
      eBullets: [],      // {x,y}
      enemies: [],       // see spawnWave
      powerups: [],      // {x,y,def,vy}
      particles: [],     // {x,y,vx,vy,life,maxLife,txt,col}
      formation: { x:0, dx:1 },
      wave: 0,
      waveState: 'between', // 'between'|'active'|'boss_entry'
      waveDelay: 0,
      score: 0,
      elapsed: 0,        // ms total played
      keys: {},
      quip: { text:'', end:0 },
      achiev: { text:'', desc:'', end:0 },
      killStreak: 0,
      lowHpQuipped: false,
    };
  },

  // ── Start / restart ───────────────────────────────────────────────────────
  start() {
    if (this.animId) cancelAnimationFrame(this.animId);
    this.gs = this.newGs();
    this.showScreen('game');
    this.lastTs = 0;
    this._hideQuip(); this._hideAchiev();
    this.loop(0);
  },

  // ── Main loop ─────────────────────────────────────────────────────────────
  loop(ts) {
    const dt = Math.min(ts - (this.lastTs || ts), 50);
    this.lastTs = ts;
    this.gs.elapsed += dt;
    this.update(dt);
    this.render();
    this.animId = requestAnimationFrame(t => this.loop(t));
  },

  // ── Input ─────────────────────────────────────────────────────────────────
  _bindInput() {
    document.addEventListener('keydown', e => {
      if (!this.gs) return;
      this.gs.keys[e.key] = true;
      if (e.key === ' ') { e.preventDefault(); this._doBlink(); }
    });
    document.addEventListener('keyup', e => {
      if (this.gs) this.gs.keys[e.key] = false;
    });
  },
  _bindMobile() {
    const hold = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('pointerdown', e => { e.preventDefault(); if (this.gs) this.gs.keys[key] = true; });
      el.addEventListener('pointerup',   () => { if (this.gs) this.gs.keys[key] = false; });
      el.addEventListener('pointerleave',() => { if (this.gs) this.gs.keys[key] = false; });
    };
    hold('mb-left',  'ArrowLeft');
    hold('mb-right', 'ArrowRight');
    document.getElementById('mb-blink').addEventListener('pointerdown', e => {
      e.preventDefault(); this._doBlink();
    });
  },
  _doBlink() {
    const gs = this.gs;
    if (!gs || gs.waveState !== 'active') return;
    if (gs.player.blinks > 0) {
      gs.player.blinks--;
      gs.player.x = (gs.player.x < CW / 2) ? CW - 50 : 50;
    }
  },

  // ── Update ────────────────────────────────────────────────────────────────
  update(dt) {
    const gs = this.gs;

    // Wave state machine
    if (gs.waveState === 'between') {
      gs.waveDelay -= dt;
      if (gs.waveDelay <= 0) this._spawnWave();
      return;
    }
    if (gs.waveState === 'active' && gs.enemies.length === 0) {
      this._showQuip(pick(SYSTEM_QUIPS.wave), 3500);
      setTimeout(() => this._showQuip(pick(DONUT_QUIPS.wave), 3000), 1800);
      gs.waveState = 'between';
      gs.waveDelay = 3200;
      return;
    }

    this._updatePlayer(dt);
    this._updateFormation(dt);
    this._updateEnemies(dt);
    this._updateBullets(dt);
    this._updateEBullets(dt);
    this._updatePowerups(dt);
    this._updateParticles(dt);

    // Low-HP warning once
    if (!gs.lowHpQuipped && gs.player.lives === 1) {
      gs.lowHpQuipped = true;
      this._showQuip(pick(SYSTEM_QUIPS.lowHP), 3500);
    }
  },

  // ── Player ────────────────────────────────────────────────────────────────
  _updatePlayer(dt) {
    const gs = this.gs, p = gs.player;
    const spd = (gs.elapsed < p.hasteEnd) ? p.speed * 1.9 : p.speed;
    if (gs.keys['ArrowLeft'] || gs.keys['a'] || gs.keys['A'])
      p.x = Math.max(p.w/2, p.x - spd);
    if (gs.keys['ArrowRight'] || gs.keys['d'] || gs.keys['D'])
      p.x = Math.min(CW - p.w/2, p.x + spd);

    // Invincibility frames (flicker after hit)
    if (p.invFrames > 0) p.invFrames -= dt;

    // Auto-fire
    const rate = (gs.elapsed < p.rapidEnd) ? 120 : 280;
    if (gs.elapsed - p.lastFired > rate) {
      p.lastFired = gs.elapsed;
      if (p.tripleShot) {
        gs.bullets.push({x: p.x - 14, y: p.y - p.h/2, dmg: p.bulletDmg});
        gs.bullets.push({x: p.x,      y: p.y - p.h/2, dmg: p.bulletDmg});
        gs.bullets.push({x: p.x + 14, y: p.y - p.h/2, dmg: p.bulletDmg});
      } else {
        gs.bullets.push({x: p.x, y: p.y - p.h/2, dmg: p.bulletDmg});
      }
    }
  },

  // ── Formation movement ────────────────────────────────────────────────────
  _updateFormation(dt) {
    const gs = this.gs;
    if (!gs.enemies.length) return;
    const spd = this._formationSpeed();
    gs.formation.x += gs.formation.dx * spd;
    // Check edges via any enemy position
    let minX = Infinity, maxX = -Infinity;
    gs.enemies.forEach(e => { if (!e.diving){ minX = Math.min(minX,e.x); maxX = Math.max(maxX,e.x); }});
    if (maxX + 26 > CW - 8 || minX - 26 < 8) {
      gs.formation.dx *= -1;
      // Drop formation down
      gs.enemies.forEach(e => { if (!e.diving) e.formY = Math.min(e.formY + 18, CH - 180); });
    }
    // Apply formation dx to all non-diving enemies
    gs.enemies.forEach(e => {
      if (!e.diving) {
        e.x += gs.formation.dx * spd;
        // Lerp toward formation Y
        e.y += (e.formY - e.y) * 0.04;
      }
    });
  },

  _formationSpeed() {
    const gs = this.gs;
    const alive = gs.enemies.filter(e => !e.diving).length;
    const base = 0.8 + gs.wave * 0.15;
    return base * (1 + (20 - Math.min(alive, 20)) * 0.05);
  },

  // ── Enemy AI ──────────────────────────────────────────────────────────────
  _updateEnemies(dt) {
    const gs = this.gs;
    gs.enemies.forEach(e => {
      e.hitFlash = Math.max(0, (e.hitFlash || 0) - dt);

      if (e.diving) {
        // Dive toward player
        const dx = gs.player.x - e.x, dy = gs.player.y - e.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        e.x += (dx/dist) * e.diveSpd;
        e.y += (dy/dist) * e.diveSpd;
        e.diveShootTimer -= dt;
        if (e.diveShootTimer <= 0 && e.def.shoots) {
          e.diveShootTimer = 1000 + Math.random() * 600;
          gs.eBullets.push({x: e.x, y: e.y + 20});
        }
        // Return to formation if reached player area or off screen
        if (e.y > CH - 80 || e.y < -60) {
          e.diving = false;
          e.x = Math.max(26, Math.min(CW-26, e.x));
          e.formY = HUD_H + 60 + Math.floor(Math.random() * 3) * 55;
        }
      } else {
        // Formation: occasional shoot
        if (e.def.shoots && e.y > HUD_H + 30) {
          e.shootTimer = (e.shootTimer || 3000) - dt;
          if (e.shootTimer <= 0) {
            e.shootTimer = 3500 + Math.random() * 3000 - Math.min(gs.wave, 8) * 80;
            gs.eBullets.push({x: e.x, y: e.y + 20});
          }
        }
        // Occasionally dive
        if (!e.def.isBoss) {
          e.diveTimer = (e.diveTimer || (5000 + Math.random()*8000)) - dt;
          if (e.diveTimer <= 0) {
            e.diving = true;
            e.diveSpd = 3.5 + gs.wave * 0.2;
            e.diveShootTimer = 900 + Math.random() * 400;
            e.diveTimer = 6000 + Math.random() * 8000;
          }
        }
      }

      // Boss side-to-side + shoot
      if (e.def.isBoss) {
        e.bossDir = e.bossDir || 1;
        e.x += e.bossDir * (1.5 + gs.wave * 0.1);
        if (e.x > CW - 40) e.bossDir = -1;
        if (e.x < 40)      e.bossDir = 1;
        e.shootTimer = (e.shootTimer || 800) - dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = 500 + Math.random() * 500;
          // Spread shot
          [-12, 0, 12].forEach(ox => gs.eBullets.push({x: e.x + ox, y: e.y + 30}));
        }
      }
    });
  },

  // ── Bullets ───────────────────────────────────────────────────────────────
  _updateBullets(dt) {
    const gs = this.gs;
    gs.bullets = gs.bullets.filter(b => {
      b.y -= 12;
      if (b.y < HUD_H) return false;
      // Hit enemy
      for (let i = gs.enemies.length - 1; i >= 0; i--) {
        const e = gs.enemies[i];
        if (Math.abs(b.x - e.x) < 22 && Math.abs(b.y - e.y) < 22) {
          e.hp -= b.dmg;
          e.hitFlash = 180;
          if (e.hp <= 0) this._killEnemy(i);
          return false;
        }
      }
      return true;
    });
  },

  _updateEBullets(dt) {
    const gs = this.gs, p = gs.player;
    gs.eBullets = gs.eBullets.filter(b => {
      b.y += 5 + gs.wave * 0.2;
      if (b.y > CH) return false;
      // Hit player
      if (Math.abs(b.x - p.x) < 20 && Math.abs(b.y - p.y) < 20) {
        this._hitPlayer();
        return false;
      }
      return true;
    });
  },

  // ── Power-ups ─────────────────────────────────────────────────────────────
  _updatePowerups(dt) {
    const gs = this.gs, p = gs.player;
    gs.powerups = gs.powerups.filter(pu => {
      pu.y += pu.vy;
      if (pu.y > CH) return false;
      if (Math.abs(pu.x - p.x) < 42 && Math.abs(pu.y - p.y) < 42) {
        this._collectPowerup(pu.def);
        return false;
      }
      return true;
    });
  },

  // ── Particles ─────────────────────────────────────────────────────────────
  _updateParticles(dt) {
    const gs = this.gs;
    gs.particles = gs.particles.filter(pt => {
      pt.x += pt.vx; pt.y += pt.vy;
      pt.vy += 0.08;
      pt.life -= dt;
      return pt.life > 0;
    });
  },

  // ── Kill enemy ────────────────────────────────────────────────────────────
  _killEnemy(idx) {
    const gs = this.gs;
    const e = gs.enemies.splice(idx, 1)[0];
    gs.score += e.def.pts * gs.wave;
    gs.killStreak++;

    // Particles
    for (let i = 0; i < 6; i++) {
      gs.particles.push({
        x: e.x, y: e.y,
        vx: (Math.random()-0.5)*4, vy: (Math.random()-2.5)*3,
        life: 600, maxLife: 600, col: '#c8a0ff',
      });
    }

    // Power-up drop
    const dropChance = e.def.dropPU ? 1.0 : 0.18;
    if (Math.random() < dropChance) {
      gs.powerups.push({ x: e.x, y: e.y, vy: 0.85, def: pick(POWERUP_DEFS) });
    }

    // Quip every 3 kills
    if (gs.killStreak % 3 === 0) {
      const useDonut = Math.random() < 0.5;
      this._showQuip(useDonut ? pick(DONUT_QUIPS.kill) : pick(SYSTEM_QUIPS.kill), 3000);
    }
  },

  // ── Hit player ────────────────────────────────────────────────────────────
  _hitPlayer() {
    const gs = this.gs, p = gs.player;
    if (gs.elapsed < p.invEnd || p.invFrames > 0) return;
    if (p.shield) {
      p.shield = false;
      this._showQuip("The System: Shield absorbed a hit. You're welcome.", 2500);
      return;
    }
    p.lives--;
    p.invFrames = 1800;
    this._showQuip(pick(SYSTEM_QUIPS.hit), 2500);
    setTimeout(() => {
      if (this.gs === gs) this._showQuip(pick(DONUT_QUIPS.hit), 2500);
    }, 1400);
    // Screen shake via canvas offset
    gs.shakeEnd = gs.elapsed + 300;
    if (p.lives <= 0) {
      cancelAnimationFrame(this.animId);
      setTimeout(() => this._die(), 400);
    }
  },

  // ── Collect power-up ──────────────────────────────────────────────────────
  _collectPowerup(def) {
    const gs = this.gs;
    def.apply(gs);
    this._showQuip(pick(SYSTEM_QUIPS.powerup), 3000);
    setTimeout(() => { if (this.gs===gs) this._showQuip(pick(DONUT_QUIPS.powerup), 2500); }, 1600);
    this._showAchiev(def.achievement, def.name + ' — ' + def.desc);
  },

  // ── Spawn wave ────────────────────────────────────────────────────────────
  _spawnWave() {
    const gs = this.gs;
    gs.wave++;
    gs.formation.x = 0;
    gs.formation.dx = 1;
    gs.lowHpQuipped = false;
    gs.killStreak = 0;

    const isBoss = gs.wave % 5 === 0;
    if (isBoss) {
      this._showQuip(pick(SYSTEM_QUIPS.boss), 3500);
      const boss = Object.assign({}, gs.wave >= 10 ? BOSS_DEFS[1] : BOSS_DEFS[0]);
      boss.hp = Math.round(boss.hp * (1 + (gs.wave - 5) * 0.2));
      gs.enemies.push({
        x: CW/2, y: HUD_H + 55, formY: HUD_H + 55,
        hp: boss.hp, maxHp: boss.hp,
        def: boss, hitFlash: 0, diving: false, bossDir: 1,
      });
      // Add escort Crawlersworn
      const escort = ENEMY_DEFS[8];
      [-120, 120].forEach((ox, i) => gs.enemies.push({
        x: CW/2 + ox, y: HUD_H + 90, formY: HUD_H + 90,
        hp: escort.hp, maxHp: escort.hp, def: escort,
        hitFlash: 0, diving: false, shootTimer: 2000 + i*500,
      }));
    } else {
      // Choose enemy types that scale with wave
      const pool = gs.wave <= 2 ? ENEMY_DEFS.slice(0,3)
                 : gs.wave <= 4 ? ENEMY_DEFS.slice(0,5)
                 : gs.wave <= 6 ? ENEMY_DEFS.slice(0,7)
                 : ENEMY_DEFS;
      const cols = Math.min(6 + Math.floor(gs.wave / 2), 10);
      const rows = Math.min(2 + Math.floor(gs.wave / 3), 5);
      const spacingX = Math.min(52, (CW - 80) / cols);
      const spacingY = 54;
      const startX = (CW - (cols - 1) * spacingX) / 2;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const def = pick(pool);
          const hpMult = 1 + (gs.wave - 1) * 0.12;
          const hp = Math.ceil(def.hp * hpMult);
          gs.enemies.push({
            x: startX + c * spacingX,
            y: HUD_H + 20 + r * spacingY,
            formY: HUD_H + 20 + r * spacingY,
            hp, maxHp: hp, def,
            hitFlash: 0, diving: false,
            shootTimer: 3000 + Math.random() * 3000,
            diveTimer: 6000 + Math.random() * 8000,
          });
        }
      }
    }
    gs.waveState = 'active';
  },

  // ── Render ────────────────────────────────────────────────────────────────
  render() {
    const gs = this.gs, ctx = this.ctx;
    ctx.save();
    if (gs.shakeEnd && gs.elapsed < gs.shakeEnd) {
      ctx.translate((Math.random()-0.5)*6, (Math.random()-0.5)*4);
    }
    this._drawBg();
    this._drawPowerups();
    this._drawEBullets();
    this._drawBullets();
    this._drawEnemies();
    this._drawPlayer();
    this._drawParticles();
    this._drawHUD();
    ctx.restore();
  },

  // ── Background ────────────────────────────────────────────────────────────
  _drawBg() {
    const ctx = this.ctx;
    // Sky/ceiling
    const skyGrad = ctx.createLinearGradient(0,0,0,CH);
    skyGrad.addColorStop(0,   '#04010a');
    skyGrad.addColorStop(0.5, '#0a0318');
    skyGrad.addColorStop(1,   '#120522');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CW, CH);

    // Stone brick rows
    ctx.globalAlpha = 0.18;
    for (let ry = HUD_H + 12; ry < CH; ry += 28) {
      for (let rx = 0; rx < CW; rx += 60) {
        const offset = ((ry / 28) % 2 === 0) ? 0 : 30;
        ctx.fillStyle = (Math.floor(rx/60 + ry/28) % 2 === 0) ? '#2a1840' : '#1e1030';
        ctx.fillRect(rx + offset, ry, 58, 26);
      }
    }
    ctx.globalAlpha = 1;

    // Left/right wall columns
    const wallGrad = ctx.createLinearGradient(0,0,40,0);
    wallGrad.addColorStop(0, 'rgba(30,10,50,0.85)');
    wallGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, HUD_H, 42, CH);
    const wallGrad2 = ctx.createLinearGradient(CW,0,CW-40,0);
    wallGrad2.addColorStop(0, 'rgba(30,10,50,0.85)');
    wallGrad2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = wallGrad2;
    ctx.fillRect(CW-42, HUD_H, 42, CH);

    // Torches
    const gs = this.gs;
    const flicker = 0.7 + Math.sin(gs.elapsed * 0.008) * 0.3;
    [[18, 160],[18, 400],[CW-22, 160],[CW-22, 400]].forEach(([tx,ty]) => {
      ctx.save();
      ctx.globalAlpha = 0.7 * flicker;
      const tg = ctx.createRadialGradient(tx,ty,0,tx,ty,55);
      tg.addColorStop(0, 'rgba(255,160,30,0.8)');
      tg.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = tg;
      ctx.fillRect(tx-55, ty-55, 110, 110);
      ctx.globalAlpha = 1;
      ctx.font = '16px serif'; ctx.textAlign = 'center';
      ctx.fillText('🔥', tx, ty + 6);
      ctx.restore();
    });

    // Floor line
    ctx.strokeStyle = '#3a1a60'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y + 22); ctx.lineTo(CW, GROUND_Y + 22); ctx.stroke();

    // Rune row at top of play area
    ctx.globalAlpha = 0.25;
    ctx.font = '11px serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#c8a0ff';
    ['✦','⬡','✦','⬡','✦','⬡','✦','⬡','✦','⬡'].forEach((r,i) => {
      ctx.fillText(r, 28 + i * 56, HUD_H + 14);
    });
    ctx.globalAlpha = 1;
  },

  // ── Player ────────────────────────────────────────────────────────────────
  _drawPlayer() {
    const gs = this.gs, ctx = this.ctx, p = gs.player;
    if (p.invFrames > 0 && Math.floor(gs.elapsed / 80) % 2 === 0) return;

    // Shield ring
    if (p.shield) {
      ctx.save();
      ctx.strokeStyle = '#aaffee'; ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6 + Math.sin(gs.elapsed*0.01)*0.4;
      ctx.beginPath(); ctx.arc(p.x, p.y, 28, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }
    // Haste glow
    if (gs.elapsed < p.hasteEnd) {
      ctx.save(); ctx.globalAlpha = 0.4;
      const hg = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,32);
      hg.addColorStop(0,'rgba(180,255,200,0.8)'); hg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = hg; ctx.fillRect(p.x-34,p.y-34,68,68);
      ctx.restore();
    }
    // Magic aura
    ctx.save();
    ctx.globalAlpha = 0.3;
    const ag = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,24);
    ag.addColorStop(0,'rgba(160,80,255,0.9)'); ag.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = ag; ctx.fillRect(p.x-26,p.y-26,52,52);
    ctx.restore();

    // Cat + crown
    ctx.font = '32px serif'; ctx.textAlign = 'center';
    ctx.fillText('🐱', p.x, p.y + 10);
    ctx.font = '18px serif';
    ctx.fillText('👑', p.x + 1, p.y - 14);

    // Blink indicator
    if (p.blinks > 0) {
      ctx.font = '10px sans-serif'; ctx.fillStyle = '#c8a0ff';
      ctx.fillText('✨×'+p.blinks, p.x, p.y + 32);
    }
  },

  // ── Enemies ───────────────────────────────────────────────────────────────
  _drawEnemies() {
    const gs = this.gs, ctx = this.ctx;
    gs.enemies.forEach(e => {
      const flash = e.hitFlash > 0;
      ctx.save();
      if (flash) ctx.globalAlpha = 0.55;
      const sz = e.def.isBoss ? 44 : 26;
      ctx.font = sz + 'px serif'; ctx.textAlign = 'center';
      ctx.fillText(e.def.emoji, e.x, e.y + sz/2 - 2);
      if (flash) { ctx.globalAlpha=1; ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.fillText(e.def.emoji, e.x, e.y + sz/2 - 2); }
      // HP bar for bosses
      if (e.def.isBoss) {
        const bw = 80, bh = 6;
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#333'; ctx.fillRect(e.x - bw/2, e.y - 32, bw, bh);
        const pct = e.hp / e.maxHp;
        ctx.fillStyle = pct > 0.5 ? '#60c060' : pct > 0.25 ? '#d0a020' : '#c03030';
        ctx.fillRect(e.x - bw/2, e.y - 32, bw * pct, bh);
        ctx.strokeStyle='#666'; ctx.lineWidth=1; ctx.strokeRect(e.x - bw/2, e.y - 32, bw, bh);
        ctx.font='10px sans-serif'; ctx.fillStyle='#eee'; ctx.textAlign='center';
        ctx.fillText(e.def.name + '  ' + e.hp + '/' + e.maxHp, e.x, e.y - 35);
      }
      ctx.restore();
    });
  },

  // ── Bullets ───────────────────────────────────────────────────────────────
  _drawBullets() {
    const ctx = this.ctx;
    ctx.save();
    this.gs.bullets.forEach(b => {
      ctx.font = '14px serif'; ctx.textAlign = 'center';
      ctx.fillText('✨', b.x, b.y + 6);
    });
    ctx.restore();
  },
  _drawEBullets() {
    const ctx = this.ctx;
    ctx.save(); ctx.fillStyle = '#ff4444';
    this.gs.eBullets.forEach(b => {
      ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI*2); ctx.fill();
    });
    ctx.restore();
  },
  _drawPowerups() {
    const ctx = this.ctx;
    ctx.save();
    this.gs.powerups.forEach(pu => {
      ctx.font = '20px serif'; ctx.textAlign='center';
      ctx.fillText(pu.def.emoji, pu.x, pu.y + 8);
    });
    ctx.restore();
  },

  // ── Particles ─────────────────────────────────────────────────────────────
  _drawParticles() {
    const ctx = this.ctx;
    this.gs.particles.forEach(pt => {
      ctx.save();
      ctx.globalAlpha = pt.life / pt.maxLife;
      ctx.fillStyle = pt.col || '#c8a0ff';
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 3, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    });
  },

  // ── HUD ───────────────────────────────────────────────────────────────────
  _drawHUD() {
    const gs = this.gs, ctx = this.ctx, p = gs.player;
    // Background bar
    ctx.fillStyle = 'rgba(7,4,15,0.92)';
    ctx.fillRect(0, 0, CW, HUD_H - 4);
    ctx.strokeStyle = '#3a1a60'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, HUD_H-4); ctx.lineTo(CW, HUD_H-4); ctx.stroke();

    // Floor banner
    ctx.font = 'bold 11px Oswald, sans-serif'; ctx.fillStyle = '#6040a0'; ctx.textAlign='left';
    ctx.fillText('FLOOR 23', 10, 16);

    // Wave
    ctx.fillStyle = '#c8a0ff'; ctx.textAlign='center';
    ctx.font = 'bold 13px Oswald, sans-serif';
    ctx.fillText('WAVE  ' + gs.wave, CW/2, 16);

    // Score
    ctx.textAlign='right';
    ctx.fillText('SCORE  ' + gs.score, CW - 10, 16);

    // Lives
    ctx.textAlign='left'; ctx.font='16px serif';
    let lx = 10;
    for (let i = 0; i < p.lives; i++) { ctx.fillText('💜', lx, 36); lx += 22; }

    // Active power-up icons
    const icons = [];
    if (p.shield)      icons.push('🛡️');
    if (p.tripleShot)  icons.push('👑');
    if (p.blinks > 0)  icons.push('🐕×'+p.blinks);
    if (gs.elapsed < p.hasteEnd)  icons.push('💨');
    if (gs.elapsed < p.rapidEnd)  icons.push('🍞');
    ctx.textAlign='right'; ctx.font='13px serif'; ctx.fillStyle='rgba(200,160,255,0.85)';
    icons.reverse().forEach((ic,i) => ctx.fillText(ic, CW-10 - i*28, 36));

    // Time
    const secs = Math.floor(gs.elapsed / 1000);
    ctx.textAlign='center'; ctx.font='11px monospace'; ctx.fillStyle='#6040a0';
    ctx.fillText('⏱ ' + secs + 's', CW/2, 36);

    // "Between waves" countdown
    if (gs.waveState === 'between') {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.font = 'bold 15px Oswald, sans-serif'; ctx.textAlign='center'; ctx.fillStyle='#c8a0ff';
      const delay = Math.ceil(gs.waveDelay / 1000);
      ctx.fillText('Next wave in ' + delay + '…', CW/2, CH/2 - 10);
      ctx.restore();
    }
  },

  // ── Quip bar ──────────────────────────────────────────────────────────────
  _showQuip(text, dur) {
    const el = document.getElementById('quip-bar');
    if (!el) return;
    el.textContent = text;
    el.className = 'quip-on';
    clearTimeout(this._quipTimer);
    this._quipTimer = setTimeout(() => { el.className = 'quip-off'; }, dur);
  },
  _hideQuip() {
    const el = document.getElementById('quip-bar');
    if (el) el.className = 'quip-off';
  },

  // ── Achievement popup ─────────────────────────────────────────────────────
  _showAchiev(name, desc) {
    document.getElementById('ach-name').textContent = name;
    document.getElementById('ach-desc').textContent = desc;
    const el = document.getElementById('achievement-popup');
    el.className = 'achievement-on';
    clearTimeout(this._achievTimer);
    this._achievTimer = setTimeout(() => { el.className = 'achievement-off'; }, 3500);
  },
  _hideAchiev() {
    const el = document.getElementById('achievement-popup');
    if (el) el.className = 'achievement-off';
  },

  // ── Death ─────────────────────────────────────────────────────────────────
  _die() {
    const gs = this.gs;
    const secs = Math.floor(gs.elapsed / 1000);
    document.getElementById('d-score').textContent = gs.score;
    document.getElementById('d-wave').textContent  = gs.wave;
    document.getElementById('d-time').textContent  = secs + 's';
    document.getElementById('death-system-quip').textContent = pick(DEATH_SYSTEM_QUIPS);
    document.getElementById('death-donut-quip').textContent  = '"' + pick(DONUT_QUIPS.death) + '"';
    document.getElementById('player-name').value = '';
    this.showScreen('death');
  },

  submitScore() {
    const gs = this.gs;
    const name = (document.getElementById('player-name').value.trim() || 'Anonymous').slice(0,24);
    const secs = Math.floor(gs.elapsed / 1000);
    fetch('/happy-hour/scores', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ name, score: gs.score, wave: gs.wave, time: secs }),
    }).then(() => this.showLeaderboard()).catch(() => this.showLeaderboard());
  },

  // ── Leaderboard ───────────────────────────────────────────────────────────
  showLeaderboard() {
    this.showScreen('leaderboard');
    const tbody = document.getElementById('lb-body');
    tbody.innerHTML = '<tr><td colspan="5" class="lb-loading">Loading…</td></tr>';
    fetch('/happy-hour/scores')
      .then(r => r.json())
      .then(scores => {
        if (!scores.length) {
          tbody.innerHTML = '<tr><td colspan="5" class="lb-loading">No scores yet. Be the first to die heroically.</td></tr>';
          return;
        }
        tbody.innerHTML = scores.slice(0,15).map((s,i) =>
          `<tr><td>${i+1}</td><td>${s.name}</td><td>${s.score}</td><td>${s.wave}</td><td>${s.time}s</td></tr>`
        ).join('');
      })
      .catch(() => {
        tbody.innerHTML = '<tr><td colspan="5" class="lb-loading">The System cannot retrieve records. Typical.</td></tr>';
      });
  },
};

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => Game.init());

