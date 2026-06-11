"use strict";
// GROOMP — a Doom-like raycasting shooter.
// Software-rendered into a 640x400 ImageData buffer: textured walls via DDA,
// per-scanline floor/ceiling casting, z-buffered billboard sprites. The HUD,
// weapon and screens are drawn on top with the regular 2D API.

(() => {

const W = 1280, H = 800;   // internal 3D render resolution
const LW = 640, LH = 400;  // logical coordinate space for the 2D overlay
const HUD_H = 64;          // in logical units
const FOV = 0.66; // camera plane length (~66 degrees)

const canvas = document.getElementById("screen");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const img = ctx.createImageData(W, H);
const buf = new Uint32Array(img.data.buffer);
const zbuf = new Float32Array(W);

// ------------------------------------------------------------------ map
// '#' brick  '%' stone  '=' tech  '&' slime  '.' floor  'X' exit pad
// 'P' player  'g' groomp  's' spitter  'B' boss groomp  'h' medkit  'a' ammo
// 'l' hanging lamp  'b' exploding barrel  'k' bone pile

const MAP_STR = [
  "########################################",
  "#.....A...#.................#..........#",
  "#....a....#.........a.....b.#....c...h.#",
  "#..P......#....%.c...c.%....#........b.#",
  "#....l.......3.....l........#.....l....#",
  "#.........a........g.....g.....q.s..f..#",
  "#.......b.#.....o....h..k..............#",
  "#......k..#....%.......%....#....k.w...#",
  "###########.h.......m....g..#..A..a....#",
  "###########...e.............#.b.....s..#",
  "##################6.#########..a...4...#",
  "##################q.#########......o...#",
  "##################l.#########&&&&&&&&&&&",
  "##################..####################",
  "#.k....=................A....a...#######",
  "#..a...=.h......................a#######",
  "#...l..=....g...............g.b..#######",
  "#......=..u.5...........w.......h#######",
  "#X..h......f..k.....a..a.....e...#######",
  "#X..B........l......u.....l......#######",
  "#X.w...=.........................#######",
  "#....b.=.......c............m....#######",
  "#.7....=..s.....c...g...b.....s..#######",
  "#..h...=.b.....a...........k.....#######",
  "#......=.......................h.#######",
  "########################################",
];

const WALL_CHARS = { "#": 1, "%": 2, "=": 3, "&": 4 };
const ENEMY_CHARS = {
  g: "groomp", s: "spitter", B: "boss", w: "wraith", c: "skitter",
  u: "brute", e: "watcher", o: "hollow", m: "maw", f: "husk", q: "shrieker",
};
const EXIT_CELL = 9;

let MW = 0, MH = MAP_STR.length;
for (const r of MAP_STR) MW = Math.max(MW, r.length);
const grid = new Uint8Array(MW * MH);
const startSpawns = {
  player: { x: 2.5, y: 2.5 },
  enemies: [], pickups: [], barrels: [], lamps: [], skulls: [], weapons: [],
};

for (let y = 0; y < MH; y++) {
  const row = MAP_STR[y];
  for (let x = 0; x < MW; x++) {
    const ch = x < row.length ? row[x] : "#";
    if (WALL_CHARS[ch]) { grid[y * MW + x] = WALL_CHARS[ch]; continue; }
    if (ch === "X") { grid[y * MW + x] = EXIT_CELL; continue; }
    grid[y * MW + x] = 0;
    const sx = x + 0.5, sy = y + 0.5;
    if (ch === "P") startSpawns.player = { x: sx, y: sy };
    else if (ENEMY_CHARS[ch]) startSpawns.enemies.push({ x: sx, y: sy, type: ENEMY_CHARS[ch] });
    else if (ch >= "3" && ch <= "7") startSpawns.weapons.push({ x: sx, y: sy, slot: +ch });
    else if (ch === "h") startSpawns.pickups.push({ x: sx, y: sy, kind: "health" });
    else if (ch === "a") startSpawns.pickups.push({ x: sx, y: sy, kind: "ammo" });
    else if (ch === "A") startSpawns.pickups.push({ x: sx, y: sy, kind: "armor" });
    else if (ch === "b") startSpawns.barrels.push({ x: sx, y: sy });
    else if (ch === "l") startSpawns.lamps.push({ x: sx, y: sy });
    else if (ch === "k") startSpawns.skulls.push({ x: sx, y: sy });
  }
}

// ------------------------------------------------------------- lighting
// Static per-cell light (sector feel): random variance, bright pools under
// lamps and around the exit. A few cells flicker; lightNow is the per-frame
// effective value.

const lightGrid = new Float32Array(MW * MH);
const flickerGrid = new Uint8Array(MW * MH);
{
  let s = 0xBADA55;
  const rr = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < lightGrid.length; i++) {
    lightGrid[i] = 0.8 + rr() * 0.28;
    if (rr() < 0.05) flickerGrid[i] = 1 + (rr() * 6 | 0);
  }
  const boost = (cx, cy, amt) => {
    for (let y = cy - 1; y <= cy + 1; y++) {
      for (let x = cx - 1; x <= cx + 1; x++) {
        if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
        const i = y * MW + x;
        const a = (x === cx && y === cy) ? amt : amt * 0.55;
        lightGrid[i] = Math.min(1.4, lightGrid[i] + a);
      }
    }
  };
  for (const L of startSpawns.lamps) {
    boost(Math.floor(L.x), Math.floor(L.y), 0.5);
    if (rr() < 0.5) flickerGrid[Math.floor(L.y) * MW + Math.floor(L.x)] = 1 + (rr() * 6 | 0);
  }
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === EXIT_CELL) boost(i % MW, (i / MW) | 0, 0.45);
  }
}
const lightNow = new Float32Array(MW * MH);
function updateLights() {
  for (let i = 0; i < lightNow.length; i++) {
    const fl = flickerGrid[i];
    lightNow[i] = fl
      ? lightGrid[i] * (0.72 + 0.3 * (0.5 + 0.5 * Math.sin(now * 9 + fl * 1.7)))
      : lightGrid[i];
  }
}
function lightAt(cx, cy) {
  if (cx < 0 || cy < 0 || cx >= MW || cy >= MH) return 0.8;
  return lightNow[cy * MW + cx];
}

function cellAt(cx, cy) {
  if (cx < 0 || cy < 0 || cx >= MW || cy >= MH) return 1;
  return grid[cy * MW + cx];
}
function isWall(c) { return c >= 1 && c <= 4; }
function blockedAt(x, y, r) {
  if (isWall(cellAt(Math.floor(x - r), Math.floor(y - r)))
   || isWall(cellAt(Math.floor(x + r), Math.floor(y - r)))
   || isWall(cellAt(Math.floor(x - r), Math.floor(y + r)))
   || isWall(cellAt(Math.floor(x + r), Math.floor(y + r)))) return true;
  for (let i = 0; i < barrels.length; i++) {
    const b = barrels[i];
    if (!b.alive) continue;
    const dx = x - b.x, dy = y - b.y, rr = r + 0.3;
    if (dx * dx + dy * dy < rr * rr) return true;
  }
  return false;
}
function tryMove(ent, dx, dy, r) {
  if (!blockedAt(ent.x + dx, ent.y, r)) ent.x += dx;
  if (!blockedAt(ent.x, ent.y + dy, r)) ent.y += dy;
}
function los(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const d = Math.hypot(dx, dy);
  const steps = Math.ceil(d / 0.12) || 1;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isWall(cellAt(Math.floor(x0 + dx * t), Math.floor(y0 + dy * t)))) return false;
  }
  return true;
}

// ---------------------------------------------------------------- state

const ENEMY_STATS = {
  groomp:   { hp: 60,  speed: 2.3, scale: 1.0,  r: 0.32, melee: 12, spit: 0,  ranged: false },
  spitter:  { hp: 42,  speed: 1.7, scale: 0.92, r: 0.30, melee: 0,  spit: 9,  ranged: true, proj: "spit" },
  boss:     { hp: 550, speed: 1.6, scale: 1.55, r: 0.45, melee: 24, spit: 16, ranged: true, proj: "spit" },
  wraith:   { hp: 55,  speed: 3.1, scale: 0.95, r: 0.30, melee: 14, spit: 0,  ranged: false, hover: true },
  skitter:  { hp: 18,  speed: 4.2, scale: 0.55, r: 0.22, melee: 6,  spit: 0,  ranged: false },
  brute:    { hp: 220, speed: 1.2, scale: 1.45, r: 0.42, melee: 28, spit: 0,  ranged: false },
  watcher:  { hp: 70,  speed: 1.9, scale: 0.80, r: 0.28, melee: 0,  spit: 12, ranged: true, proj: "spit", hover: true },
  hollow:   { hp: 80,  speed: 2.6, scale: 1.05, r: 0.30, melee: 16, spit: 0,  ranged: false },
  maw:      { hp: 130, speed: 2.9, scale: 1.10, r: 0.36, melee: 24, spit: 0,  ranged: false },
  husk:     { hp: 60,  speed: 2.0, scale: 1.0,  r: 0.30, melee: 0,  spit: 13, ranged: true, proj: "fire" },
  shrieker: { hp: 45,  speed: 2.4, scale: 1.0,  r: 0.30, melee: 10, spit: 0,  ranged: false, scream: true },
};

const player = { x: 2.5, y: 2.5, ang: 0, hp: 100, armor: 0, r: 0.25 };
let dirX = 1, dirY = 0, planeX = 0, planeY = FOV;

// the arsenal: slots 1-7, switched with the number keys
const WEAPONS = {
  1: { name: "MALLET",   rate: 0.45, melee: { range: 1.5, dmg: 55 } },
  2: { name: "BLASTER",  rate: 0.32, pellets: 1, spread: 0,     dmg: 30, dmgVar: 12 },
  3: { name: "SHOTGUN",  rate: 0.95, pellets: 7, spread: 0.10,  dmg: 9,  dmgVar: 6, ammo: "shells", use: 1 },
  4: { name: "CHAINGUN", rate: 0.09, pellets: 1, spread: 0.035, dmg: 11, dmgVar: 8, ammo: "bullets", use: 1 },
  5: { name: "ROCKETS",  rate: 0.85, proj: { kind: "rocket", speed: 9,   dmg: 30,  blast: { r: 2.0, dmg: 110 } }, ammo: "rockets", use: 1 },
  6: { name: "PLASMA",   rate: 0.13, proj: { kind: "plasma", speed: 12,  dmg: 24 }, ammo: "cells", use: 1 },
  7: { name: "GBFG",     rate: 1.6,  proj: { kind: "gbfg",   speed: 6.5, dmg: 130, blast: { r: 3.4, dmg: 360 } }, ammo: "cells", use: 40 },
};
const AMMO_MAX = { bullets: 200, shells: 50, rockets: 25, cells: 150 };
let ammoPool = { bullets: 60, shells: 0, rockets: 0, cells: 0 };
let owned = {};
let curGun = 2;
let swingT = 0;

let state = "title"; // title | playing | dead | won
let enemies = [], pickups = [], projectiles = [], wpickups = [];
let barrels = [], explosions = [], particles = [];
let totalEnemies = 0, kills = 0;
let startTime = 0, winTime = 0, now = 0;
let shootCool = 0, muzzle = 0, recoil = 0, bobPhase = 0, bobAmt = 0;
let damageFlash = 0, pickupFlash = 0;
let msg = "", msgT = 0;
let showMap = false;

function flash(text) { msg = text; msgT = 2.4; }

function reset() {
  player.x = startSpawns.player.x;
  player.y = startSpawns.player.y;
  player.ang = 0;
  player.hp = 100;
  player.armor = 0;
  ammoPool = { bullets: 60, shells: 0, rockets: 0, cells: 0 };
  owned = { 1: true, 2: true };
  curGun = 2;
  swingT = 0;
  enemies = startSpawns.enemies.map(s => {
    const st = ENEMY_STATS[s.type];
    return {
      type: s.type, x: s.x, y: s.y, hp: st.hp, speed: st.speed, scale: st.scale,
      r: st.r, melee: st.melee, spit: st.spit, ranged: st.ranged,
      proj: st.proj, hover: st.hover, scream: st.scream,
      state: "idle", animT: Math.random() * 9, cool: 0, atkT: 0, painT: 0,
      deadT: 0, rangedAttack: false,
    };
  });
  pickups = startSpawns.pickups.map(p => ({ ...p }));
  wpickups = startSpawns.weapons.map(p => ({ ...p }));
  projectiles = [];
  barrels = startSpawns.barrels.map(b => ({ ...b, hp: 25, alive: true, fuse: -1 }));
  explosions = [];
  particles = [];
  totalEnemies = enemies.length;
  kills = 0;
  shootCool = muzzle = recoil = damageFlash = pickupFlash = msgT = 0;
  startTime = now;
}

// ---------------------------------------------------------------- input

const keys = {};
let mouseDown = false;

addEventListener("keydown", e => {
  if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.code === "KeyM") showMap = !showMap;
  if (e.code === "KeyN" && typeof Sfx !== "undefined") flash(Sfx.toggleMusic() ? "Music on." : "Music off.");
  if (e.code === "KeyR" && state !== "title") { reset(); state = "playing"; }
  if (e.code.startsWith("Digit")) {
    const slot = +e.code.slice(5);
    if (slot >= 1 && slot <= 7 && owned[slot] && slot !== curGun && state === "playing") {
      curGun = slot;
      muzzle = 0;
      shootCool = Math.max(shootCool, 0.18);
    }
  }
});
canvas.addEventListener("wheel", e => {
  e.preventDefault();
  if (state !== "playing") return;
  const d = e.deltaY > 0 ? 1 : -1;
  for (let i = 1; i <= 7; i++) {
    const slot = ((curGun - 1 + d * i) % 7 + 7) % 7 + 1;
    if (owned[slot]) { curGun = slot; shootCool = Math.max(shootCool, 0.18); break; }
  }
});
addEventListener("keyup", e => { keys[e.code] = false; });

canvas.addEventListener("mousedown", e => {
  if (e.button !== 0) return;
  Sfx.init();
  if (state !== "playing") {
    reset();
    state = "playing";
    canvas.requestPointerLock && canvas.requestPointerLock();
    return;
  }
  if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
    canvas.requestPointerLock();
  }
  mouseDown = true;
});
addEventListener("mouseup", () => { mouseDown = false; });

// Chrome can report a huge bogus movementX on the first event after pointer
// lock engages — drop that event and clamp outliers.
let justLocked = false;
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === canvas) justLocked = true;
});
addEventListener("mousemove", e => {
  if (state !== "playing" || document.pointerLockElement !== canvas) return;
  if (justLocked) { justLocked = false; return; }
  const mx = Math.max(-80, Math.min(80, e.movementX));
  player.ang += mx * 0.0024;
});

// --------------------------------------------------------------- combat

function damagePlayer(d) {
  if (state !== "playing") return;
  // armor soaks a third of incoming damage until it runs out
  const absorb = Math.min(player.armor, Math.ceil(d / 3));
  player.armor -= absorb;
  d -= absorb;
  player.hp -= d;
  damageFlash = Math.min(0.9, damageFlash + 0.45);
  if (player.hp <= 0) {
    player.hp = 0;
    state = "dead";
    Sfx.die();
    document.exitPointerLock && document.exitPointerLock();
  } else {
    Sfx.hurt();
  }
}

function spawnParticles(x, y, u, kind, n, spd) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, v = (0.3 + Math.random()) * spd;
    particles.push({
      x, y, u: u + Math.random() * 0.25,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v, vu: 0.4 + Math.random() * 1.4,
      t: 0.45 + Math.random() * 0.35, kind,
    });
  }
}

function explodeAt(x, y, r, dmgMax, scale = 1.25) {
  explosions.push({ x, y, t: 0, scale });
  spawnParticles(x, y, 0.3, "spark", 10 + r * 4 | 0, 1.6 + r * 0.5);
  Sfx.boom();
  const pd = Math.hypot(player.x - x, player.y - y);
  if (pd < r) damagePlayer(Math.max(1, Math.round(dmgMax * 0.4 * (1 - pd / (r + 0.4)))));
  for (const e of enemies) {
    if (e.state === "dead") continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < r + 0.4) damageEnemy(e, Math.max(1, Math.round(dmgMax * (1 - d / (r + 0.8)))));
  }
  for (const b2 of barrels) {
    if (b2.alive && b2.fuse < 0 && Math.hypot(b2.x - x, b2.y - y) < r * 0.95) {
      b2.fuse = 0.12 + Math.random() * 0.15;
    }
  }
}

function explodeBarrel(b) {
  if (!b.alive) return;
  b.alive = false;
  spawnParticles(b.x, b.y, 0.2, "goo", 8, 1.8);
  explodeAt(b.x, b.y, 2.2, 95);
}

function damageEnemy(e, dmg) {
  e.hp -= dmg;
  spawnParticles(e.x, e.y, 0.35, "blood", 7, 1.6);
  if (e.state === "idle") { e.state = "chase"; Sfx.growl(); }
  if (e.hp <= 0) {
    e.state = "dead";
    e.deadT = 0;
    kills++;
    Sfx.enemyDie();
    if (kills === totalEnemies) flash("All groomps splattered! Find the exit pad.");
    else if (e.type === "boss") flash("The Groompfather has fallen!");
  } else if (Math.random() < 0.7) {
    e.state = "pain";
    e.painT = 0.22;
    Sfx.enemyHit();
  } else {
    Sfx.enemyHit();
  }
}

function hitBarrel(b, dmg) {
  b.hp -= dmg;
  spawnParticles(b.x, b.y, 0.4, "spark", 4, 1.4);
  if (b.hp <= 0) explodeBarrel(b);
}

// one hitscan ray, rotated `off` radians from the view direction
function hitscanPellet(off, dmg) {
  const ca = Math.cos(off), sa = Math.sin(off);
  const rdx = dirX * ca - dirY * sa;
  const rdy = dirX * sa + dirY * ca;
  let best = null, bestD = Infinity, bestEnemy = false;
  const consider = (x, y, width, obj, isEnemy) => {
    const relX = x - player.x, relY = y - player.y;
    const depth = relX * rdx + relY * rdy;
    if (depth < 0.2 || depth >= bestD) return;
    if (Math.abs(relX * rdy - relY * rdx) > width) return; // perp distance to ray
    if (!los(player.x, player.y, x, y)) return;
    best = obj;
    bestD = depth;
    bestEnemy = isEnemy;
  };
  for (const e of enemies) {
    if (e.state !== "dead") consider(e.x, e.y, 0.34 * e.scale, e, true);
  }
  for (const b of barrels) {
    if (b.alive) consider(b.x, b.y, 0.3, b, false);
  }
  if (!best) return;
  if (bestEnemy) damageEnemy(best, dmg);
  else hitBarrel(best, dmg);
}

function meleeSwing(range, dmg) {
  Sfx.swing();
  swingT = 0.28;
  let best = null, bestD = Infinity, bestEnemy = false;
  const consider = (x, y, obj, isEnemy) => {
    const relX = x - player.x, relY = y - player.y;
    const depth = relX * dirX + relY * dirY;
    if (depth < 0 || depth > range || depth >= bestD) return;
    if (Math.abs(relX * dirY - relY * dirX) > 0.7) return;
    best = obj;
    bestD = depth;
    bestEnemy = isEnemy;
  };
  for (const e of enemies) {
    if (e.state !== "dead") consider(e.x, e.y, e, true);
  }
  for (const b of barrels) {
    if (b.alive) consider(b.x, b.y, b, false);
  }
  if (!best) return;
  Sfx.thunk();
  if (bestEnemy) damageEnemy(best, dmg + (Math.random() * 15 | 0));
  else hitBarrel(best, dmg);
}

function tryShoot() {
  if (shootCool > 0) return;
  const Wp = WEAPONS[curGun];
  if (Wp.ammo && ammoPool[Wp.ammo] < Wp.use) { Sfx.empty(); shootCool = 0.3; return; }
  shootCool = Wp.rate;
  recoil = 1;
  if (Wp.melee) { meleeSwing(Wp.melee.range, Wp.melee.dmg); return; }
  if (Wp.ammo) ammoPool[Wp.ammo] -= Wp.use;
  muzzle = 0.07;
  Sfx.fire(curGun);
  // gunfire wakes anything close enough to hear it
  for (const e of enemies) {
    if (e.state === "idle" && Math.hypot(e.x - player.x, e.y - player.y) < 9) e.state = "chase";
  }
  if (Wp.proj) {
    projectiles.push({
      x: player.x + dirX * 0.5, y: player.y + dirY * 0.5,
      dx: dirX * Wp.proj.speed, dy: dirY * Wp.proj.speed,
      dmg: Wp.proj.dmg, kind: Wp.proj.kind, blast: Wp.proj.blast, hostile: false,
    });
    return;
  }
  for (let i = 0; i < Wp.pellets; i++) {
    hitscanPellet((Math.random() - 0.5) * 2 * Wp.spread, Wp.dmg + (Math.random() * Wp.dmgVar | 0));
  }
}

function spawnSpit(e) {
  const dx = player.x - e.x, dy = player.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const speed = e.proj === "fire" ? 4.6 : 5.2;
  projectiles.push({
    x: e.x + (dx / d) * 0.5, y: e.y + (dy / d) * 0.5,
    dx: (dx / d) * speed, dy: (dy / d) * speed,
    dmg: e.spit, kind: e.proj || "spit", hostile: true,
  });
  Sfx.spit();
}

// --------------------------------------------------------------- update

function updateEnemy(e, dt) {
  if (e.state === "dead") { e.deadT += dt; return; }
  const dx = player.x - e.x, dy = player.y - e.y;
  const dist = Math.hypot(dx, dy);
  const seen = dist < 14 && los(e.x, e.y, player.x, player.y);
  e.cool -= dt;

  if (e.state === "idle") {
    if (seen && dist < 10) {
      e.state = "chase";
      if (e.scream) {
        // the shriek wakes everything nearby
        Sfx.scream();
        for (const o of enemies) {
          if (o.state === "idle" && Math.hypot(o.x - e.x, o.y - e.y) < 11) o.state = "chase";
        }
      } else {
        Sfx.growl();
      }
    }
    return;
  }
  if (e.state === "pain") {
    e.painT -= dt;
    if (e.painT <= 0) e.state = "chase";
    return;
  }
  if (e.state === "attack") {
    e.atkT -= dt;
    if (e.atkT <= 0) {
      if (e.rangedAttack) {
        if (seen) spawnSpit(e);
      } else if (dist < 1.6) {
        damagePlayer(e.melee + (Math.random() * 5 | 0));
      }
      e.cool = e.type === "boss" ? 0.8 : 1.1 + Math.random() * 0.5;
      e.state = "chase";
    }
    return;
  }

  // chase
  e.animT += dt;
  const canMelee = e.melee > 0 && dist < 1.25;
  const canSpit = e.ranged && seen && dist > 2 && dist < 9;
  if (e.cool <= 0 && (canMelee || canSpit)) {
    e.state = "attack";
    e.atkT = 0.45;
    e.rangedAttack = !canMelee;
    return;
  }
  const holdRange = e.type === "spitter" && seen && dist < 4.5;
  if (!holdRange && dist > 0.8) {
    const step = e.speed * dt;
    tryMove(e, (dx / dist) * step, (dy / dist) * step, e.r);
  }
}

function separateEnemies() {
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    if (a.state === "dead") continue;
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j];
      if (b.state === "dead") continue;
      let dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = a.r + b.r;
      if (d > 0.0001 && d < min) {
        const push = (min - d) * 0.5;
        dx /= d; dy /= d;
        tryMove(a, -dx * push, -dy * push, a.r);
        tryMove(b, dx * push, dy * push, b.r);
      }
    }
  }
}

function update(dt) {
  dirX = Math.cos(player.ang);
  dirY = Math.sin(player.ang);
  planeX = -dirY * FOV;
  planeY = dirX * FOV;

  shootCool = Math.max(0, shootCool - dt);
  muzzle = Math.max(0, muzzle - dt);
  swingT = Math.max(0, swingT - dt);
  recoil = Math.max(0, recoil - dt * 6);
  damageFlash = Math.max(0, damageFlash - dt * 1.6);
  pickupFlash = Math.max(0, pickupFlash - dt * 3);
  msgT = Math.max(0, msgT - dt);

  if (state !== "playing") return;

  // turning (keyboard)
  const turn = 2.6 * dt;
  if (keys.ArrowLeft) player.ang -= turn;
  if (keys.ArrowRight) player.ang += turn;
  dirX = Math.cos(player.ang);
  dirY = Math.sin(player.ang);
  planeX = -dirY * FOV;
  planeY = dirX * FOV;

  // movement
  const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const str = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const run = keys.ShiftLeft || keys.ShiftRight;
  let speed = (run ? 5.0 : 3.2) * dt;
  if (fwd && str) speed *= 0.7071;
  if (fwd || str) {
    tryMove(player,
      (dirX * fwd - dirY * str) * speed,
      (dirY * fwd + dirX * str) * speed,
      player.r);
    bobPhase += speed * 2.6;
    bobAmt = Math.min(1, bobAmt + dt * 6);
  } else {
    bobAmt = Math.max(0, bobAmt - dt * 4);
  }

  if (mouseDown || keys.Space) tryShoot();

  for (const e of enemies) updateEnemy(e, dt);
  separateEnemies();

  for (const b of barrels) {
    if (b.alive && b.fuse >= 0) {
      b.fuse -= dt;
      if (b.fuse <= 0) explodeBarrel(b);
    }
  }
  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].t += dt;
    if (explosions[i].t > 0.45) explosions.splice(i, 1);
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.t -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.u += p.vu * dt;
    p.vu -= 5 * dt;
    if (p.u < 0) { p.u = 0; p.vu *= -0.35; p.vx *= 0.5; p.vy *= 0.5; }
    if (p.t <= 0 || isWall(cellAt(Math.floor(p.x), Math.floor(p.y)))) particles.splice(i, 1);
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.dx * dt;
    p.y += p.dy * dt;
    let hit = isWall(cellAt(Math.floor(p.x), Math.floor(p.y)));
    if (!hit) {
      if (p.hostile) {
        if (Math.hypot(p.x - player.x, p.y - player.y) < 0.4) {
          damagePlayer(p.dmg);
          hit = true;
        }
      } else {
        for (const e of enemies) {
          if (e.state === "dead") continue;
          if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + 0.25) {
            damageEnemy(e, p.dmg);
            hit = true;
            break;
          }
        }
        if (!hit) {
          for (const b of barrels) {
            if (b.alive && Math.hypot(p.x - b.x, p.y - b.y) < 0.5) {
              hitBarrel(b, p.dmg);
              hit = true;
              break;
            }
          }
        }
      }
    }
    if (hit) {
      if (p.blast) explodeAt(p.x, p.y, p.blast.r, p.blast.dmg, p.kind === "gbfg" ? 2.4 : 1.25);
      projectiles.splice(i, 1);
    }
  }

  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    if (Math.hypot(p.x - player.x, p.y - player.y) > 0.6) continue;
    if (p.kind === "health") {
      if (player.hp >= 100) continue;
      player.hp = Math.min(100, player.hp + 25);
      flash("Picked up a medkit.");
    } else if (p.kind === "armor") {
      if (player.armor >= 100) continue;
      player.armor = Math.min(100, player.armor + 50);
      flash("Picked up groomp-plate armor.");
    } else {
      ammoPool.bullets = Math.min(AMMO_MAX.bullets, ammoPool.bullets + 20);
      ammoPool.shells = Math.min(AMMO_MAX.shells, ammoPool.shells + 4);
      ammoPool.rockets = Math.min(AMMO_MAX.rockets, ammoPool.rockets + 1);
      ammoPool.cells = Math.min(AMMO_MAX.cells, ammoPool.cells + 20);
      flash("Picked up an ammo cache.");
    }
    pickups.splice(i, 1);
    pickupFlash = 0.5;
    Sfx.pickup();
  }

  const WEAPON_GRANT = { 3: ["shells", 10], 4: ["bullets", 60], 5: ["rockets", 6], 6: ["cells", 50], 7: ["cells", 40] };
  for (let i = wpickups.length - 1; i >= 0; i--) {
    const p = wpickups[i];
    if (Math.hypot(p.x - player.x, p.y - player.y) > 0.7) continue;
    owned[p.slot] = true;
    const [type, amt] = WEAPON_GRANT[p.slot];
    ammoPool[type] = Math.min(AMMO_MAX[type], ammoPool[type] + amt);
    curGun = p.slot;
    flash(`You got the ${WEAPONS[p.slot].name}!`);
    wpickups.splice(i, 1);
    pickupFlash = 0.6;
    Sfx.pickup();
  }

  if (cellAt(Math.floor(player.x), Math.floor(player.y)) === EXIT_CELL) {
    state = "won";
    winTime = now - startTime;
    Sfx.win();
    document.exitPointerLock && document.exitPointerLock();
  }
}

// --------------------------------------------------------------- render

function fog(d) {
  const f = 1.5 / (0.28 + d * 0.15);
  return f > 1 ? 1 : f;
}

function shadePx(c, f) {
  if (f >= 1) return c | 0xff000000;
  const r = ((c & 255) * f) | 0;
  const g = (((c >>> 8) & 255) * f) | 0;
  const b = (((c >>> 16) & 255) * f) | 0;
  return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
}

// Pre-shaded copies of the static textures so the hot pixel loops are pure
// array lookups instead of per-pixel multiplies.
const SHADES = 16;
function buildLit(tex) {
  const out = [];
  for (let i = 0; i < SHADES; i++) {
    const f = (i + 1) / SHADES;
    const t = new Uint32Array(TEXN * TEXN);
    for (let j = 0; j < t.length; j++) t[j] = (shadePx(tex[j], f) & 0xFFF8F8F8) >>> 0;
    out.push(t);
  }
  return out;
}
const LIT_WALLS = WALL_TEX.map(t => (t ? buildLit(t) : null));
const LIT_WALLS_B = WALL_TEX_B.map(t => (t ? buildLit(t) : null));
const LIT_FLOOR = buildLit(texFloor);
const LIT_CEIL = buildLit(texCeil);
const LIT_EXIT = buildLit(texExitFloor);
function litIndex(f) {
  const i = (f * SHADES) | 0;
  return i >= SHADES ? SHADES - 1 : i < 0 ? 0 : i;
}

function renderFloors() {
  const px = player.x, py = player.y;
  const rx0 = dirX - planeX, ry0 = dirY - planeY;
  const rx1 = dirX + planeX, ry1 = dirY + planeY;
  const halfH = H / 2;
  const exitPulse = 0.75 + 0.25 * Math.sin(now * 5);
  for (let y = halfH + 1; y < H; y++) {
    const rowDist = halfH / (y - halfH);
    const stepX = rowDist * (rx1 - rx0) / W;
    const stepY = rowDist * (ry1 - ry0) / W;
    let fx = px + rowDist * rx0;
    let fy = py + rowDist * ry0;
    const f = fog(rowDist) * 0.95;
    let floorTex = LIT_FLOOR[litIndex(f)];
    let ceilTex = LIT_CEIL[litIndex(f * 0.85)];
    const exitTex = LIT_EXIT[litIndex(Math.min(1, f + 0.5) * exitPulse)];
    const rowF = y * W;
    const rowC = (H - y - 1) * W;
    let lcx = -1e9, lcy = -1e9, exit = false;
    // sample every other column and write pixel pairs: at this resolution
    // the difference is invisible and it halves the cost of the hot loop
    const stepX2 = stepX * 2, stepY2 = stepY * 2;
    for (let x = 0; x < W; x += 2) {
      const cx = fx | 0, cy = fy | 0;
      if (cx !== lcx || cy !== lcy) {
        lcx = cx;
        lcy = cy;
        exit = cellAt(cx, cy) === EXIT_CELL;
        const lv = lightAt(cx, cy);
        floorTex = LIT_FLOOR[litIndex(f * lv)];
        ceilTex = LIT_CEIL[litIndex(f * 0.85 * lv)];
      }
      const ti = (((fy - cy) * TEXN) | 0) * TEXN + (((fx - cx) * TEXN) | 0);
      const pf = (exit ? exitTex : floorTex)[ti];
      const pc = ceilTex[ti];
      buf[rowF + x] = pf;
      buf[rowF + x + 1] = pf;
      buf[rowC + x] = pc;
      buf[rowC + x + 1] = pc;
      fx += stepX2;
      fy += stepY2;
    }
  }
}

function renderWalls() {
  const px = player.x, py = player.y;
  for (let x = 0; x < W; x++) {
    const cam = 2 * x / W - 1;
    const rdx = dirX + planeX * cam;
    const rdy = dirY + planeY * cam;
    let mapX = Math.floor(px), mapY = Math.floor(py);
    const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx);
    const ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
    let stepX, stepY, sdx, sdy;
    if (rdx < 0) { stepX = -1; sdx = (px - mapX) * ddx; }
    else { stepX = 1; sdx = (mapX + 1 - px) * ddx; }
    if (rdy < 0) { stepY = -1; sdy = (py - mapY) * ddy; }
    else { stepY = 1; sdy = (mapY + 1 - py) * ddy; }

    let side = 0, tex = 1, guard = 0;
    while (guard++ < 128) {
      if (sdx < sdy) { sdx += ddx; mapX += stepX; side = 0; }
      else { sdy += ddy; mapY += stepY; side = 1; }
      const c = cellAt(mapX, mapY);
      if (isWall(c)) { tex = c; break; }
    }

    const perp = Math.max(0.02, side === 0 ? sdx - ddx : sdy - ddy);
    zbuf[x] = perp;

    const lineH = (H / perp) | 0;
    let y0 = ((H - lineH) >> 1);
    let y1 = y0 + lineH;
    const clipY0 = Math.max(0, y0);
    const clipY1 = Math.min(H, y1);

    let wallX = side === 0 ? py + perp * rdy : px + perp * rdx;
    wallX -= Math.floor(wallX);
    let texX = (wallX * TEXN) | 0;
    if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) texX = TEXN - texX - 1;

    const variants = ((mapX + mapY) & 1) && LIT_WALLS_B[tex] ? LIT_WALLS_B : LIT_WALLS;
    const t = variants[tex][litIndex(fog(perp) * lightAt(mapX, mapY) * (side === 1 ? 0.72 : 1))];
    const step = TEXN / lineH;
    let texPos = (clipY0 - y0) * step;
    for (let y = clipY0; y < clipY1; y++) {
      const texY = (texPos | 0) & (TEXN - 1);
      texPos += step;
      buf[y * W + x] = t[texY * TEXN + texX];
    }
  }
}

function enemyTexture(e) {
  const S = SPRITES[e.type];
  if (e.state === "dead") return S.dead[Math.min(2, (e.deadT * 7) | 0)];
  if (e.state === "pain") return e.painT > 0.13 ? S.flash : S.pain;
  if (e.state === "attack") return S.attack;
  if (e.state === "chase") return S.walk[((e.animT * 6) | 0) % 2];
  return S.walk[0];
}

const PART_TEX = { blood: PART_BLOOD, spark: PART_SPARK, goo: PART_GOO };
const PROJ_TEX = { spit: SPR_SPIT, fire: SPR_FIRE, plasma: SPR_PLASMA, rocket: SPR_ROCKETP, gbfg: SPR_GBFG };

function renderSprites() {
  const px = player.x, py = player.y;
  const list = [];
  for (const e of enemies) {
    const u = e.hover && e.state !== "dead" ? 0.08 + 0.05 * Math.sin(now * 2.6 + e.animT * 4) : 0;
    list.push({ x: e.x, y: e.y, tex: enemyTexture(e), scale: e.scale, u });
  }
  for (const p of pickups) list.push({ x: p.x, y: p.y, tex: p.kind === "health" ? SPR_HEALTH : p.kind === "armor" ? SPR_ARMOR : SPR_AMMO, scale: 0.55, u: 0 });
  for (const p of wpickups) list.push({ x: p.x, y: p.y, tex: SPR_WPICK[p.slot], scale: 0.6, u: 0, glow: true });
  for (const p of projectiles) {
    list.push({ x: p.x, y: p.y, tex: PROJ_TEX[p.kind] || SPR_SPIT, scale: p.kind === "gbfg" ? 0.55 : 0.3, u: 0.3, glow: true });
  }
  for (const b of barrels) {
    if (b.alive) list.push({ x: b.x, y: b.y, tex: SPR_BARREL, scale: 0.62, u: 0 });
  }
  for (const L of startSpawns.lamps) list.push({ x: L.x, y: L.y, tex: SPR_LAMP, scale: 0.42, u: 0.58, glow: true });
  for (const k of startSpawns.skulls) list.push({ x: k.x, y: k.y, tex: SPR_SKULLS, scale: 0.34, u: 0 });
  for (const ex of explosions) {
    list.push({ x: ex.x, y: ex.y, tex: SPR_EXPLOSION[Math.min(2, (ex.t * 7) | 0)], scale: ex.scale || 1.25, u: 0.05, glow: true });
  }
  for (const p of particles) list.push({ x: p.x, y: p.y, tex: PART_TEX[p.kind], scale: 0.07, u: p.u, glow: p.kind === "spark" });

  const invDet = 1 / (planeX * dirY - dirX * planeY);
  for (const s of list) {
    const relX = s.x - px, relY = s.y - py;
    s.tx = invDet * (dirY * relX - dirX * relY);
    s.ty = invDet * (-planeY * relX + planeX * relY);
    s.d2 = relX * relX + relY * relY;
  }
  list.sort((a, b) => b.d2 - a.d2);

  for (const s of list) {
    const ty = s.ty;
    if (ty <= 0.1) continue;
    const size = Math.abs((H / ty) * s.scale) | 0;
    if (size < 2) continue;
    const screenX = ((W / 2) * (1 + s.tx / ty)) | 0;
    const bottom = (H / 2 + ((0.5 - s.u) * H) / ty) | 0;
    const top = bottom - size;
    const x0 = screenX - (size >> 1);
    const cx0 = Math.max(0, x0);
    const cx1 = Math.min(W, x0 + size);
    const cy0 = Math.max(0, top);
    const cy1 = Math.min(H, bottom);
    const f = s.glow ? 1 : fog(ty) * lightAt(Math.floor(s.x), Math.floor(s.y));
    const lit = f >= 0.95; // close sprites (the big ones) skip the shade math
    const tex = s.tex;
    for (let x = cx0; x < cx1; x++) {
      if (ty >= zbuf[x]) continue;
      const texX = (((x - x0) * TEXN) / size) | 0;
      for (let y = cy0; y < cy1; y++) {
        const texY = (((y - top) * TEXN) / size) | 0;
        const c = tex[texY * TEXN + texX];
        if ((c >>> 24) < 128) continue;
        buf[y * W + x] = lit ? c : shadePx(c, f);
      }
    }
  }
}

function drawWeapon() {
  if (state === "title") return;
  const G = GUNS[curGun];
  const green = curGun === 6 || curGun === 7;
  const bx = Math.sin(bobPhase) * 10 * bobAmt;
  const by = Math.abs(Math.cos(bobPhase)) * 8 * bobAmt + recoil * 26;
  // gun sits slightly right of centre, Doom style, bottom quarter of the view
  const GS = 0.82;
  const gw = G.w * GS, gh = G.h * GS;
  const gx = LW / 2 + 18 + bx - gw / 2;
  const gy = LH - HUD_H + 34 + by - gh;
  const mx = gx + G.mx * GS, myz = gy + G.my * GS; // muzzle point

  if (muzzle > 0) {
    // outer glow behind the gun
    const r = (curGun === 5 || curGun === 7 ? 54 : 40) + Math.random() * 14;
    const glow = ctx.createRadialGradient(mx, myz, 3, mx, myz, r);
    if (green) {
      glow.addColorStop(0, "rgba(220,255,215,0.95)");
      glow.addColorStop(0.45, "rgba(90,224,130,0.75)");
      glow.addColorStop(1, "rgba(20,150,60,0)");
    } else {
      glow.addColorStop(0, "rgba(255,244,190,0.95)");
      glow.addColorStop(0.45, "rgba(255,180,50,0.75)");
      glow.addColorStop(1, "rgba(255,110,0,0)");
    }
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(mx, myz, r, 0, 7);
    ctx.fill();
  }

  if (curGun === 1) {
    // mallet swings around a pivot at its base
    const sw = swingT > 0 ? Math.sin((0.28 - swingT) / 0.28 * Math.PI) : 0;
    ctx.save();
    ctx.translate(gx + gw / 2 + 30, gy + gh + 20);
    ctx.rotate(-sw * 1.25);
    ctx.translate(-sw * 26, sw * 6);
    ctx.drawImage(G.c, -gw / 2 - 30, -gh - 20, gw, gh);
    ctx.restore();
  } else {
    ctx.drawImage(G.c, gx, gy, gw, gh);
  }

  if (G.cell) {
    // blaster's live energy cell pulse
    const pulse = 0.55 + 0.45 * Math.sin(now * 7);
    ctx.fillStyle = `rgba(60,224,106,${0.35 + pulse * 0.55})`;
    ctx.fillRect(gx + (G.cell.x + 2) * GS, gy + (G.cell.y + 2) * GS, (G.cell.w - 4) * GS, (G.cell.h - 4) * GS);
  }

  if (muzzle > 0) {
    // starburst core in front of the muzzle
    ctx.save();
    ctx.translate(mx, myz);
    ctx.rotate(Math.random() * 6.283);
    ctx.fillStyle = green ? "rgba(225,255,225,0.95)" : "rgba(255,250,210,0.95)";
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.lineTo(0, -26 - Math.random() * 8);
      ctx.lineTo(3, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawFace(x, y, hpRatio) {
  const t = now;
  const hurt = damageFlash > 0.25 && hpRatio > 0;
  ctx.save();
  ctx.translate(x, y);

  // shoulders + neck
  ctx.fillStyle = "#2c3824";
  ctx.fillRect(-21, 17, 42, 9);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(-21, 17, 42, 1.5);
  const skin = hpRatio <= 0 ? "#9a8a78" : "#d8a070";
  ctx.fillStyle = hpRatio <= 0 ? "#7e6f60" : "#b9854f";
  ctx.fillRect(-5, 12, 10, 6);

  // head
  ctx.fillStyle = skin;
  ctx.fillRect(-14, -14, 28, 30);
  // ears
  ctx.fillRect(-16, -4, 2, 7);
  ctx.fillRect(14, -4, 2, 7);
  // side + jaw shading
  ctx.fillStyle = "rgba(60,25,10,0.22)";
  ctx.fillRect(8, -14, 6, 30);
  ctx.fillRect(-14, 12, 28, 4);

  // helmet with visor band
  const hm = ctx.createLinearGradient(0, -27, 0, -10);
  hm.addColorStop(0, "#55663f");
  hm.addColorStop(1, "#2a3520");
  ctx.fillStyle = hm;
  ctx.fillRect(-17, -27, 34, 14);
  ctx.fillRect(-17, -15, 4, 7);
  ctx.fillRect(13, -15, 4, 7);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(-17, -26, 34, 2);
  ctx.fillStyle = "#1a2113";
  ctx.fillRect(-17, -14, 34, 1.5);
  // brow shadow under helmet rim
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(-14, -13, 28, 3);

  // damage: grime and blood by tier
  if (hpRatio < 0.7) {
    ctx.fillStyle = "rgba(140,28,18,0.55)";
    ctx.fillRect(-14, 4, 10, 12);
    ctx.fillRect(5, -2, 4, 8);
  }
  if (hpRatio < 0.4 && hpRatio > 0) {
    ctx.fillStyle = "rgba(165,25,12,0.8)";
    ctx.fillRect(-3, -13, 3, 14);  // forehead drip
    ctx.fillRect(-2, 1, 5, 4);
    ctx.fillRect(6, 6, 8, 10);
    ctx.fillStyle = "rgba(120,18,8,0.6)";
    ctx.fillRect(-14, -8, 6, 9);
  }

  // eyebrows angle down as health drops
  const angry = (1 - hpRatio) * 3.5;
  ctx.fillStyle = "#5a3a1c";
  ctx.save();
  ctx.translate(-7, -9);
  ctx.rotate(angry * 0.09);
  ctx.fillRect(-5, 0, 10, 2.4);
  ctx.restore();
  ctx.save();
  ctx.translate(7, -9);
  ctx.rotate(-angry * 0.09);
  ctx.fillRect(-5, 0, 10, 2.4);
  ctx.restore();

  // eyes: dart around, blink, squeeze shut when hit
  const blink = hpRatio > 0 && (t % 3.7) > 3.55;
  if (hpRatio <= 0) {
    ctx.fillStyle = "#3a3530";
    ctx.fillRect(-11, -5, 9, 2);
    ctx.fillRect(2, -5, 9, 2);
  } else if (hurt || blink) {
    ctx.strokeStyle = "#3a2410";
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (hurt) {
      ctx.moveTo(-11, -6); ctx.lineTo(-6, -3); ctx.lineTo(-11, 0);
      ctx.moveTo(11, -6); ctx.lineTo(6, -3); ctx.lineTo(11, 0);
    } else {
      ctx.moveTo(-11, -3); ctx.lineTo(-2, -3);
      ctx.moveTo(2, -3); ctx.lineTo(11, -3);
    }
    ctx.stroke();
  } else {
    const look = Math.sin(t * 0.9) * 3;
    ctx.fillStyle = "#f4efe6";
    ctx.fillRect(-11, -6, 9, 6);
    ctx.fillRect(2, -6, 9, 6);
    ctx.fillStyle = "#1c1a18";
    ctx.fillRect(-9 + look, -5.4, 4, 5);
    ctx.fillRect(4 + look, -5.4, 4, 5);
  }

  // mouth by tier; gritted teeth when hurt
  if (hpRatio <= 0) {
    ctx.fillStyle = "#5a2a1a";
    ctx.fillRect(-6, 9, 12, 2.5);
  } else if (hurt) {
    ctx.fillStyle = "#3a1408";
    ctx.fillRect(-7, 7, 14, 6);
    ctx.fillStyle = "#e8e0d0";
    ctx.fillRect(-6, 8, 12, 1.8);
    ctx.fillRect(-6, 10.6, 12, 1.6);
  } else if (hpRatio > 0.7) {
    ctx.fillStyle = "#5a2a1a";
    ctx.fillRect(-7, 9, 14, 2.5);
  } else if (hpRatio > 0.4) {
    ctx.fillStyle = "#5a2a1a";
    ctx.fillRect(-5, 10, 10, 2.5);
    ctx.fillRect(-7, 8.5, 3, 2.5);
  } else {
    ctx.fillStyle = "#3a1408";
    ctx.beginPath();
    ctx.arc(0, 12, 4.5, Math.PI, 0);
    ctx.fill();
  }
  ctx.restore();
}

// Doom-style big digit font (5x7 pixel glyphs)
const GLYPHS = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "∞": ["0000000", "0110110", "1001001", "1001001", "0110110", "0000000", "0000000"],
};

// right-aligned Doom-style number with hard pixel shadow
function drawNum(str, xRight, y, s, color, shadow = "#3a0c06") {
  let w = 0;
  for (const ch of str) w += ((GLYPHS[ch] || GLYPHS["0"])[0].length + 1) * s;
  let x = xRight - w;
  for (const ch of str) {
    const gl = GLYPHS[ch] || GLYPHS["0"];
    for (let r = 0; r < gl.length; r++) {
      for (let c = 0; c < gl[r].length; c++) {
        if (gl[r][c] !== "1") continue;
        ctx.fillStyle = shadow;
        ctx.fillRect(x + c * s + s * 0.5, y + r * s + s * 0.5, s, s);
        ctx.fillStyle = color;
        ctx.fillRect(x + c * s, y + r * s, s, s);
      }
    }
    x += (gl[0].length + 1) * s;
  }
}

function drawHud() {
  const top = LH - HUD_H;
  ctx.drawImage(HUD_CANVAS, 0, top, LW, HUD_H);
  ctx.textAlign = "center";

  // engraved label
  const label = (txt, cx) => {
    ctx.font = "9px monospace";
    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.fillText(txt, cx, top + 51);
    ctx.fillStyle = "rgba(190,200,215,0.45)";
    ctx.fillText(txt, cx, top + 52);
  };

  const P = HUD_PANELS;
  const RED = "#e8281c";
  const numY = top + 13;

  // AMMO (current weapon)
  const Wp = WEAPONS[curGun];
  if (Wp.ammo) drawNum(String(ammoPool[Wp.ammo]), P.ammo.x + P.ammo.w - 8, numY, 3, RED);
  else drawNum("∞", P.ammo.x + P.ammo.w - 8, numY, 3, RED);
  label("AMMO", P.ammo.cx);

  // HEALTH
  drawNum(player.hp + "%", P.health.x + P.health.w - 4, numY, 3, RED);
  label("HEALTH", P.health.cx);

  // ARMS: slots 2-7 in a 3x2 grid, Doom style
  for (let s = 2; s <= 7; s++) {
    const col = (s - 2) % 3, row = s >= 5 ? 1 : 0;
    const x = P.arms.x + 16 + col * 27;
    const y = top + 12 + row * 17;
    const cur = s === curGun;
    if (cur) {
      ctx.fillStyle = "rgba(232,200,64,0.18)";
      ctx.fillRect(x - 7, y - 2, 15, 13);
    }
    drawNum(String(s), x + 6, y, 1.6, owned[s] ? (cur ? "#f8ec9a" : "#e8c840") : "#3c4046", "#0c0d10");
  }
  label("ARMS", P.arms.cx);

  drawFace(P.face.cx, top + 30, player.hp / 100);

  // ARMOR
  drawNum(player.armor + "%", P.armor.x + P.armor.w - 4, numY, 3, RED);
  label("ARMOR", P.armor.cx);

  // ammo table
  const rows = [["BULL", "bullets"], ["SHEL", "shells"], ["RCKT", "rockets"], ["CELL", "cells"]];
  ctx.textAlign = "left";
  for (let i = 0; i < rows.length; i++) {
    const y = top + 11 + i * 11;
    ctx.font = "8px monospace";
    ctx.fillStyle = "#8a93a2";
    ctx.fillText(rows[i][0], P.table.x + 8, y + 7);
    drawNum(String(ammoPool[rows[i][1]]), P.table.x + 110, y, 1.1, "#e8c840", "#1a1408");
    drawNum(String(AMMO_MAX[rows[i][1]]), P.table.x + 158, y, 1.1, "#a08820", "#1a1408");
  }
  ctx.textAlign = "center";
}

function drawMinimap() {
  if (!showMap) return;
  const sc = 5;
  const ox = 10, oy = 10;
  ctx.fillStyle = "rgba(10,10,14,0.72)";
  ctx.fillRect(ox - 3, oy - 3, MW * sc + 6, MH * sc + 6);
  const colors = { 1: "#7a3328", 2: "#5c6166", 3: "#3c4258", 4: "#3a7a26", 9: "#37e065" };
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      const c = grid[y * MW + x];
      if (!c) continue;
      ctx.fillStyle = colors[c] || "#666";
      ctx.fillRect(ox + x * sc, oy + y * sc, sc, sc);
    }
  }
  for (const e of enemies) {
    if (e.state === "dead") continue;
    ctx.fillStyle = e.type === "boss" ? "#ff5533" : "#e03f3f";
    ctx.fillRect(ox + e.x * sc - 2, oy + e.y * sc - 2, 4, 4);
  }
  ctx.save();
  ctx.translate(ox + player.x * sc, oy + player.y * sc);
  ctx.rotate(player.ang);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(5, 0);
  ctx.lineTo(-4, -3.5);
  ctx.lineTo(-4, 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCenteredPanel(lines) {
  ctx.fillStyle = "rgba(8,8,12,0.78)";
  ctx.fillRect(0, 0, LW, LH);
  ctx.textAlign = "center";
  let y = lines.titleY || 130;
  ctx.font = "bold 76px monospace";
  ctx.fillStyle = "#5a0d08";
  ctx.fillText(lines.title, LW / 2 + 4, y + 4);
  ctx.fillStyle = lines.titleColor || "#e03f2a";
  ctx.fillText(lines.title, LW / 2, y);
  ctx.font = "16px monospace";
  ctx.fillStyle = "#c9c9d0";
  y += 42;
  for (const l of lines.body) {
    ctx.fillText(l, LW / 2, y);
    y += 24;
  }
  if (lines.prompt) {
    ctx.font = "bold 18px monospace";
    ctx.fillStyle = 0.5 + 0.5 * Math.sin(now * 4) > 0.5 ? "#e0c63f" : "#8a7a28";
    ctx.fillText(lines.prompt, LW / 2, LH - 56);
  }
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? "0" : ""}${sec}`;
}

// static vignette overlay, built once
const VIGNETTE = (() => {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.82);
  gr.addColorStop(0, "rgba(0,0,0,0)");
  gr.addColorStop(1, "rgba(0,0,0,0.3)");
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  return c;
})();

function render() {
  updateLights();
  renderFloors();
  renderWalls();
  renderSprites();
  ctx.putImageData(img, 0, 0);
  ctx.drawImage(VIGNETTE, 0, 0);

  // The 2D overlay is authored in 640x400 logical coordinates.
  ctx.save();
  ctx.scale(W / LW, H / LH);

  drawWeapon();

  if (damageFlash > 0) {
    ctx.fillStyle = `rgba(200,10,10,${Math.min(0.55, damageFlash)})`;
    ctx.fillRect(0, 0, LW, LH - HUD_H);
  }
  if (pickupFlash > 0) {
    ctx.fillStyle = `rgba(220,200,60,${Math.min(0.25, pickupFlash)})`;
    ctx.fillRect(0, 0, LW, LH - HUD_H);
  }

  if (state === "playing") {
    // crosshair
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(LW / 2 - 7, LH / 2 - 32); ctx.lineTo(LW / 2 - 2, LH / 2 - 32);
    ctx.moveTo(LW / 2 + 2, LH / 2 - 32); ctx.lineTo(LW / 2 + 7, LH / 2 - 32);
    ctx.moveTo(LW / 2, LH / 2 - 39); ctx.lineTo(LW / 2, LH / 2 - 34);
    ctx.moveTo(LW / 2, LH / 2 - 30); ctx.lineTo(LW / 2, LH / 2 - 25);
    ctx.stroke();
  }

  drawHud();
  drawMinimap();

  if (msgT > 0 && state === "playing") {
    ctx.textAlign = "center";
    ctx.font = "bold 16px monospace";
    ctx.fillStyle = `rgba(230,220,180,${Math.min(1, msgT)})`;
    ctx.fillText(msg, LW / 2, 30);
  }
  if (state === "playing") {
    ctx.textAlign = "right";
    ctx.font = "10px monospace";
    ctx.fillStyle = "rgba(220,200,160,0.55)";
    ctx.fillText(`KILLS ${kills}/${totalEnemies}`, LW - 10, 16);
    ctx.textAlign = "center";
  }

  if (state === "title") {
    drawCenteredPanel({
      title: "GROOMP",
      titleColor: "#e03f2a",
      body: [
        "The Groomplex is overrun. Things scuttle, float and shriek",
        "in the dark. You have a blaster, bad intentions, and no backup.",
        "Five more guns are lost somewhere inside. Find them.",
        "",
        "WASD move · mouse / arrows turn · click / space shoot",
        "1-7 / wheel switch weapon · shift run",
        "M map · N music · R restart",
      ],
      prompt: "CLICK TO ENTER THE GROOMPLEX",
    });
  } else if (state === "dead") {
    drawCenteredPanel({
      title: "GROOMPED",
      titleColor: "#c92a14",
      body: [
        `You splattered ${kills} of ${totalEnemies} groomps`,
        "before becoming one with the ooze.",
      ],
      prompt: "CLICK TO TRY AGAIN",
    });
  } else if (state === "won") {
    drawCenteredPanel({
      title: "CLEANSED",
      titleColor: "#3fe06a",
      body: [
        "You escaped the Groomplex.",
        "",
        `Groomps splattered: ${kills} / ${totalEnemies}`,
        `Time: ${fmtTime(winTime)}`,
        kills === totalEnemies ? "FLAWLESS EXTERMINATION!" : "Some groomps still squelch in the dark...",
      ],
      prompt: "CLICK TO PLAY AGAIN",
    });
  }

  ctx.restore();
}

// ----------------------------------------------------------------- loop

let last = performance.now();
let frameMs = 0;
function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  now = t / 1000;
  const t0 = performance.now();
  update(dt);
  render();
  frameMs = frameMs * 0.9 + (performance.now() - t0) * 0.1;
  window.__groompFrameMs = frameMs;
  requestAnimationFrame(frame);
}

reset();
requestAnimationFrame(frame);

if (location.hash === "#debug") {
  window.__groomp = {
    player,
    get enemies() { return enemies; },
    get state() { return state; },
    set state(s) { state = s; },
  };
}

})();
