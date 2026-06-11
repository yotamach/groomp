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

const MAP_STR = [
  "########################################",
  "#.........#.................#..........#",
  "#....a....#.........a.......#........h.#",
  "#..P......#....%.......%....#..........#",
  "#...........................#..........#",
  "#..................g.....g.......s.....#",
  "#.........#............................#",
  "#.........#....%.......%....#..........#",
  "###########.h............g..#..........#",
  "###########.................#.......s..#",
  "##################..#########..a.......#",
  "##################..#########..........#",
  "##################..#########&&&&&&&&&&&",
  "##################..####################",
  "#......=.........................#######",
  "#..a...=.h......................a#######",
  "#......=....g...............g....#######",
  "#......=.........................#######",
  "#X..................a............#######",
  "#X..B............................#######",
  "#X.....=.........................#######",
  "#......=.........................#######",
  "#......=..s.........g.........s..#######",
  "#..h...=.........................#######",
  "#......=.......................h.#######",
  "########################################",
];

const WALL_CHARS = { "#": 1, "%": 2, "=": 3, "&": 4 };
const EXIT_CELL = 9;

let MW = 0, MH = MAP_STR.length;
for (const r of MAP_STR) MW = Math.max(MW, r.length);
const grid = new Uint8Array(MW * MH);
const startSpawns = { player: { x: 2.5, y: 2.5 }, enemies: [], pickups: [] };

for (let y = 0; y < MH; y++) {
  const row = MAP_STR[y];
  for (let x = 0; x < MW; x++) {
    const ch = x < row.length ? row[x] : "#";
    if (WALL_CHARS[ch]) { grid[y * MW + x] = WALL_CHARS[ch]; continue; }
    if (ch === "X") { grid[y * MW + x] = EXIT_CELL; continue; }
    grid[y * MW + x] = 0;
    const sx = x + 0.5, sy = y + 0.5;
    if (ch === "P") startSpawns.player = { x: sx, y: sy };
    else if (ch === "g") startSpawns.enemies.push({ x: sx, y: sy, type: "groomp" });
    else if (ch === "s") startSpawns.enemies.push({ x: sx, y: sy, type: "spitter" });
    else if (ch === "B") startSpawns.enemies.push({ x: sx, y: sy, type: "boss" });
    else if (ch === "h") startSpawns.pickups.push({ x: sx, y: sy, kind: "health" });
    else if (ch === "a") startSpawns.pickups.push({ x: sx, y: sy, kind: "ammo" });
  }
}

function cellAt(cx, cy) {
  if (cx < 0 || cy < 0 || cx >= MW || cy >= MH) return 1;
  return grid[cy * MW + cx];
}
function isWall(c) { return c >= 1 && c <= 4; }
function blockedAt(x, y, r) {
  return isWall(cellAt(Math.floor(x - r), Math.floor(y - r)))
      || isWall(cellAt(Math.floor(x + r), Math.floor(y - r)))
      || isWall(cellAt(Math.floor(x - r), Math.floor(y + r)))
      || isWall(cellAt(Math.floor(x + r), Math.floor(y + r)));
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
  groomp:  { hp: 60,  speed: 2.3, scale: 1.0,  r: 0.32, melee: 12, spit: 0,  ranged: false },
  spitter: { hp: 42,  speed: 1.7, scale: 0.92, r: 0.30, melee: 0,  spit: 9,  ranged: true },
  boss:    { hp: 320, speed: 1.5, scale: 1.55, r: 0.45, melee: 22, spit: 14, ranged: true },
};

const player = { x: 2.5, y: 2.5, ang: 0, hp: 100, ammo: 24, r: 0.25 };
let dirX = 1, dirY = 0, planeX = 0, planeY = FOV;

let state = "title"; // title | playing | dead | won
let enemies = [], pickups = [], projectiles = [];
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
  player.ammo = 24;
  enemies = startSpawns.enemies.map(s => {
    const st = ENEMY_STATS[s.type];
    return {
      type: s.type, x: s.x, y: s.y, hp: st.hp, speed: st.speed, scale: st.scale,
      r: st.r, melee: st.melee, spit: st.spit, ranged: st.ranged,
      state: "idle", animT: Math.random() * 9, cool: 0, atkT: 0, painT: 0,
      deadT: 0, rangedAttack: false,
    };
  });
  pickups = startSpawns.pickups.map(p => ({ ...p }));
  projectiles = [];
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

function damageEnemy(e, dmg) {
  e.hp -= dmg;
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

function tryShoot() {
  if (shootCool > 0) return;
  if (player.ammo <= 0) { Sfx.empty(); shootCool = 0.3; return; }
  player.ammo--;
  shootCool = 0.32;
  muzzle = 0.08;
  recoil = 1;
  Sfx.shoot();
  // gunfire wakes anything close enough to hear it
  for (const e of enemies) {
    if (e.state === "idle" && Math.hypot(e.x - player.x, e.y - player.y) < 8) e.state = "chase";
  }
  // hitscan: nearest live enemy whose billboard covers screen centre
  let best = null, bestT = Infinity;
  for (const e of enemies) {
    if (e.state === "dead") continue;
    const relX = e.x - player.x, relY = e.y - player.y;
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    const tx = invDet * (dirY * relX - dirX * relY);
    const ty = invDet * (-planeY * relX + planeX * relY);
    if (ty < 0.15 || ty >= bestT) continue;
    const screenX = (W / 2) * (1 + tx / ty);
    const halfW = (H / ty) * e.scale * 0.3;
    if (Math.abs(screenX - W / 2) > halfW) continue;
    if (!los(player.x, player.y, e.x, e.y)) continue;
    best = e;
    bestT = ty;
  }
  if (best) damageEnemy(best, 30 + (Math.random() * 12 | 0));
}

function spawnSpit(e) {
  const dx = player.x - e.x, dy = player.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  projectiles.push({
    x: e.x + (dx / d) * 0.5, y: e.y + (dy / d) * 0.5,
    dx: (dx / d) * 5.2, dy: (dy / d) * 5.2, dmg: e.spit,
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
    if (seen && dist < 10) { e.state = "chase"; Sfx.growl(); }
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

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.dx * dt;
    p.y += p.dy * dt;
    if (isWall(cellAt(Math.floor(p.x), Math.floor(p.y)))) {
      projectiles.splice(i, 1);
      continue;
    }
    if (Math.hypot(p.x - player.x, p.y - player.y) < 0.4) {
      damagePlayer(p.dmg);
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
    } else {
      if (player.ammo >= 99) continue;
      player.ammo = Math.min(99, player.ammo + 10);
      flash("Picked up a clip of groomp-stoppers.");
    }
    pickups.splice(i, 1);
    pickupFlash = 0.5;
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
  const f = 1.3 / (0.3 + d * 0.18);
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
    for (let j = 0; j < t.length; j++) t[j] = shadePx(tex[j], f);
    out.push(t);
  }
  return out;
}
const LIT_WALLS = WALL_TEX.map(t => (t ? buildLit(t) : null));
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
    const floorTex = LIT_FLOOR[litIndex(f)];
    const ceilTex = LIT_CEIL[litIndex(f * 0.8)];
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

    const t = LIT_WALLS[tex][litIndex(fog(perp) * (side === 1 ? 0.72 : 1))];
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
  if (e.state === "pain") return S.pain;
  if (e.state === "attack") return S.attack;
  if (e.state === "chase") return S.walk[((e.animT * 6) | 0) % 2];
  return S.walk[0];
}

function renderSprites() {
  const px = player.x, py = player.y;
  const list = [];
  for (const e of enemies) list.push({ x: e.x, y: e.y, tex: enemyTexture(e), scale: e.scale, u: 0 });
  for (const p of pickups) list.push({ x: p.x, y: p.y, tex: p.kind === "health" ? SPR_HEALTH : SPR_AMMO, scale: 0.55, u: 0 });
  for (const p of projectiles) list.push({ x: p.x, y: p.y, tex: SPR_SPIT, scale: 0.3, u: 0.3 });

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
    const f = fog(ty);
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
  const bx = Math.sin(bobPhase) * 9 * bobAmt;
  const by = Math.abs(Math.cos(bobPhase)) * 7 * bobAmt + recoil * 22;
  const cx = LW / 2 + bx;
  const baseY = LH - HUD_H + 14 + by;
  ctx.save();
  ctx.translate(cx, baseY);
  ctx.scale(1.45, 1.45);

  if (muzzle > 0) {
    const r = 24 + Math.random() * 10;
    const grad = ctx.createRadialGradient(0, -86, 2, 0, -86, r);
    grad.addColorStop(0, "rgba(255,255,210,0.95)");
    grad.addColorStop(0.4, "rgba(255,200,60,0.8)");
    grad.addColorStop(1, "rgba(255,120,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, -86, r, 0, 7);
    ctx.fill();
  }

  // barrel
  ctx.fillStyle = "#191c22";
  ctx.fillRect(-9, -88, 18, 26);
  ctx.fillStyle = "#3a4150";
  ctx.fillRect(-6, -88, 5, 26);
  // body
  ctx.fillStyle = "#3c424e";
  ctx.beginPath();
  ctx.moveTo(-30, 4);
  ctx.lineTo(-22, -62);
  ctx.lineTo(22, -62);
  ctx.lineTo(30, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#525a6a";
  ctx.fillRect(-22, -62, 18, 66);
  ctx.strokeStyle = "#14161c";
  ctx.lineWidth = 2;
  ctx.strokeRect(-9, -88, 18, 26);
  // energy cell
  const pulse = 0.6 + 0.4 * Math.sin(now * 7);
  ctx.fillStyle = `rgba(60,224,106,${pulse})`;
  ctx.fillRect(-13, -46, 26, 9);
  ctx.strokeStyle = "#11131a";
  ctx.lineWidth = 2;
  ctx.strokeRect(-13, -46, 26, 9);
  // grip ridges
  ctx.fillStyle = "#262b34";
  for (let i = 0; i < 3; i++) ctx.fillRect(-26 + i * 2, -28 + i * 10, 52 - i * 4, 4);
  ctx.restore();
}

function drawFace(x, y, hpRatio) {
  const t = now;
  ctx.save();
  ctx.translate(x, y);
  // helmet + skin
  ctx.fillStyle = "#3c4a32";
  ctx.fillRect(-17, -26, 34, 14);
  ctx.fillStyle = hpRatio > 0 ? "#d8a070" : "#9a8a78";
  ctx.fillRect(-15, -16, 30, 36);
  // damage grime
  if (hpRatio < 0.7) {
    ctx.fillStyle = "rgba(150,30,20,0.5)";
    ctx.fillRect(-15, 6, 12, 14);
  }
  if (hpRatio < 0.4) {
    ctx.fillStyle = "rgba(150,30,20,0.65)";
    ctx.fillRect(4, -10, 11, 18);
  }
  // eyes (dart around like the Doom marine)
  const look = hpRatio <= 0 ? 0 : Math.sin(t * 0.9) * 3;
  ctx.fillStyle = "#fff";
  ctx.fillRect(-11, -8, 9, 6);
  ctx.fillRect(2, -8, 9, 6);
  ctx.fillStyle = "#222";
  if (hpRatio <= 0) {
    ctx.fillRect(-11, -6, 9, 2);
    ctx.fillRect(2, -6, 9, 2);
  } else {
    ctx.fillRect(-9 + look, -7, 4, 5);
    ctx.fillRect(4 + look, -7, 4, 5);
  }
  // mouth by health tier
  ctx.fillStyle = "#5a2a1a";
  if (hpRatio <= 0) ctx.fillRect(-6, 10, 12, 3);
  else if (hpRatio > 0.7) ctx.fillRect(-7, 10, 14, 3);
  else if (hpRatio > 0.4) ctx.fillRect(-5, 11, 10, 3);
  else {
    ctx.beginPath();
    ctx.arc(0, 13, 5, Math.PI, 0);
    ctx.fill();
  }
  ctx.restore();
}

function drawHud() {
  ctx.fillStyle = "#16161a";
  ctx.fillRect(0, LH - HUD_H, LW, HUD_H);
  ctx.fillStyle = "#34343c";
  ctx.fillRect(0, LH - HUD_H, LW, 3);

  const baseY = LH - HUD_H / 2;
  ctx.textAlign = "center";

  const hpCol = player.hp > 60 ? "#3fe06a" : player.hp > 25 ? "#e0b03f" : "#e03f3f";
  ctx.fillStyle = hpCol;
  ctx.font = "bold 28px monospace";
  ctx.fillText(`${player.hp}%`, 80, baseY + 8);
  ctx.fillStyle = "#88888f";
  ctx.font = "11px monospace";
  ctx.fillText("HEALTH", 80, baseY + 24);

  ctx.fillStyle = "#e0c63f";
  ctx.font = "bold 28px monospace";
  ctx.fillText(`${player.ammo}`, 210, baseY + 8);
  ctx.fillStyle = "#88888f";
  ctx.font = "11px monospace";
  ctx.fillText("AMMO", 210, baseY + 24);

  drawFace(LW / 2, baseY, player.hp / 100);

  ctx.fillStyle = "#e08f3f";
  ctx.font = "bold 28px monospace";
  ctx.fillText(`${kills}/${totalEnemies}`, 430, baseY + 8);
  ctx.fillStyle = "#88888f";
  ctx.font = "11px monospace";
  ctx.fillText("GROOMPS", 430, baseY + 24);

  ctx.fillStyle = "#55555f";
  ctx.font = "11px monospace";
  ctx.fillText("M map", 560, baseY - 6);
  ctx.fillText("N music", 560, baseY + 8);
  ctx.fillText("R restart", 560, baseY + 22);
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

function render() {
  renderFloors();
  renderWalls();
  renderSprites();
  ctx.putImageData(img, 0, 0);

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

  if (state === "title") {
    drawCenteredPanel({
      title: "GROOMP",
      titleColor: "#e03f2a",
      body: [
        "The Groomplex is overrun. One-eyed blobs ooze in the dark.",
        "You have a blaster, bad intentions, and no backup.",
        "",
        "WASD move · mouse / arrows turn · click / space shoot",
        "shift run · M map · N music · R restart",
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
