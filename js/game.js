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

// Offscreen canvas so putImageData can be shifted for screen shake
const offCanvas = document.createElement("canvas");
offCanvas.width = W; offCanvas.height = H;
const offCtx = offCanvas.getContext("2d");
offCtx.imageSmoothingEnabled = false;

// ------------------------------------------------------------------ map
// Floors are generated, not authored: three worlds of twenty floors each,
// built from seeded room-and-corridor maps, so every floor is fixed forever
// without storing any of them. Cell types:
// 0 floor · 1 panel · 2 brick · 3 tech · 4 slime (walls)
// 5 water · 6 toxic sludge · 7 stairs down · 8 elevator · 9 exit pad
// Map characters: walls '#' '%' '=' '&' · '~' water · '!' toxic sludge
// '>' stairs · 'E' elevator · 'X' exit pad · 'P' player · enemy letters per
// ENEMY_CHARS · 'h' medkit · 'a' ammo · 'A' armor · '3'-'7' weapon pickups
// 'b' exploding barrel · 'l' hanging lamp · 'k' bone pile

const WATER_CELL = 5, TOXIC_CELL = 6, STAIR_CELL = 7, ELEV_CELL = 8, EXIT_CELL = 9;
const WALL_CHARS = { "#": 1, "%": 2, "=": 3, "&": 4 };
const FLOOR_CHARS = { "~": WATER_CELL, "!": TOXIC_CELL, ">": STAIR_CELL, "E": ELEV_CELL, "X": EXIT_CELL };
const ENEMY_CHARS = {
  g: "groomp", s: "spitter", B: "boss", w: "wraith", c: "skitter",
  u: "brute", e: "watcher", o: "hollow", m: "maw", f: "husk", q: "shrieker",
  d: "demon",
};

// ------------------------------------------------------------ difficulty

const DIFFICULTIES = [
  { name: "EASY",   desc: "Softer groomps, fatter supply caches.",       hp: 0.7,  dmg: 0.55, speed: 0.9,  density: 0.65, toxic: 4,  cool: 1.35, supply: 1.35 },
  { name: "NORMAL", desc: "The extermination as contracted.",            hp: 1.0,  dmg: 1.0,  speed: 1.0,  density: 1.0,  toxic: 7,  cool: 1.0,  supply: 1.0 },
  { name: "HARD",   desc: "They hit harder and think faster.",           hp: 1.15, dmg: 1.4,  speed: 1.12, density: 1.35, toxic: 10, cool: 0.75, supply: 0.85 },
  { name: "BRUTAL", desc: "Everything is faster than you and knows it.", hp: 1.3,  dmg: 1.9,  speed: 1.25, density: 1.7,  toxic: 14, cool: 0.55, supply: 0.7 },
];
let diffIndex = 1, diffSel = 1;
let DIFF = DIFFICULTIES[diffIndex];

// ---------------------------------------------------------------- worlds
// The campaign: sixty floors straight down. Each world entry drives both
// the generator (wall palette, liquid frequency, enemy pool) and the plot
// screens. Pool entries are [enemy char, weight, first floor it appears].

const LEVELS_PER_WORLD = 20;
const WORLDS = [
  {
    name: "THE GROOMPLEX",
    tint: "#e03f2a",
    bossName: "THE OVERGROOMP",
    wall: "#", accents: ["=", "%"], accentCh: 0.3,
    water: 0.14, toxic: 0.06,
    pool: [["g", 10, 0], ["c", 6, 1], ["s", 7, 1], ["d", 4, 6], ["f", 4, 9], ["q", 2, 11], ["u", 2, 13], ["o", 3, 15]],
    heavies: "uu",
    intro: [
      "The Groomplex: a sixty-storey extermination facility,",
      "built to keep the groomps down where they belong.",
      "Three days ago, every floor went silent at once.",
      "Command sent you: one exterminator, two guns on your belt,",
      "five more lost somewhere below, and a simple contract —",
      "descend, splatter, repeat. Sixty floors. No backup.",
    ],
    outro: [
      "The Overgroomp bursts like a struck cyst.",
      "Behind its throne, the freight shaft yawns downward —",
      "and far below, black water glimmers.",
      "The infestation didn't start on these floors. It seeped up.",
    ],
    levels: [
      "Reception. The welcome mat is mostly teeth now.",
      "The armoury. Looted by something with no thumbs.",
      "Open-plan offices. The partitions didn't help them.",
      "The cafeteria. Do not read the specials board.",
      "Laboratory wing. Every sample jar is empty.",
      "Server floor. The machines still count the dead.",
      "Storage. Every crate has been chewed from the inside.",
      "The barracks. Nobody made it to their gun.",
      "Waste processing. The smell arrives before the floor does.",
      "Security hub. The Warden's pets have grown attached.",
      "The atrium. Sixty metres of scream, straight down.",
      "Hydroponics. The plants are the healthiest thing left.",
      "Medbay. The quarantine sign was apparently a suggestion.",
      "The power plant. Half the lights died with the crew.",
      "The foundry. Something nests in the cold crucibles.",
      "Archives. The incident reports predate the building.",
      "Loading docks. All shipments were outbound. Were.",
      "Cold storage. Things keep down here. Things kept.",
      "Executive floor. The board locked the door and it held.",
      "The Overgroomp holds the freight elevator. Take it from him.",
    ],
  },
  {
    name: "THE SUMP",
    tint: "#3f9ae0",
    bossName: "THE SLUDGE KING",
    wall: "%", accents: ["&", "#"], accentCh: 0.35,
    water: 0.6, toxic: 0.24,
    pool: [["g", 7, 0], ["s", 7, 0], ["w", 6, 1], ["o", 6, 3], ["e", 5, 5], ["q", 2, 7], ["m", 4, 9], ["d", 3, 12], ["u", 3, 14]],
    heavies: "mm",
    intro: [
      "The maintenance decks drowned years ago.",
      "Coolant and groomp-slime stew waist-deep in the dark,",
      "and something big has been swimming laps down here.",
      "The pumps still work. Somebody just turned them off.",
      "Mind the green pools — the sludge eats boots,",
      "then feet, then whatever you were before the feet.",
    ],
    outro: [
      "The Sludge King deflates like a bad lung.",
      "In the drained pump-well, a stairwell corkscrews",
      "down into warm, breathing dark.",
      "You can hear the whole hive exhale.",
    ],
    levels: [
      "The waterline. Your boots will not be dry again.",
      "Pump gallery one. The machines drowned mid-scream.",
      "Filtration. The filters only ever worked one way.",
      "The cisterns. Something laid eggs in the drinking water.",
      "Pipeworks. Follow the current. It knows the way down.",
      "The sluice gates. Opened from the inside.",
      "Coolant lake. Wade fast, shoot faster.",
      "The barnacle deck. The walls have opinions now.",
      "Sump crew quarters. Their boots are still by the bunks.",
      "The dredging bay. The dredger found something. It's still here.",
      "Runoff channels. The green water is not water.",
      "The turbine hall. The blades stopped. The teeth didn't.",
      "Chemical stores. Everything leaked into everything.",
      "The undertow. The current has learned to pull.",
      "Silt beds. Soft floor. Softer things beneath it.",
      "The drowning stair. Half stairwell, half throat.",
      "Overflow caverns. The concrete gave up pretending.",
      "The nursery pools. You know what nurseries mean.",
      "Pressure lock. The Sump holds its breath here.",
      "The Sludge King floats in the pump-well. Drain it.",
    ],
  },
  {
    name: "THE SPAWNING DARK",
    tint: "#8a3fe0",
    bossName: "THE GROOMPFATHER",
    wall: "%", accents: ["&"], accentCh: 0.55,
    water: 0.08, toxic: 0.5,
    pool: [["c", 8, 0], ["o", 7, 0], ["f", 6, 0], ["s", 4, 0], ["d", 6, 2], ["q", 3, 3], ["m", 5, 5], ["w", 4, 7], ["u", 5, 9], ["e", 4, 10]],
    heavies: "ddu",
    intro: [
      "No floors down here. No light you didn't bring.",
      "The walls are wet, and they flinch when you touch them.",
      "Every groomp ever hatched crawled out of this dark,",
      "and the sludge runs in veins toward the bottom of it,",
      "where the Groompfather waits — fat, ancient, and fond",
      "of every single thing you've splattered on the way down.",
    ],
    outro: [
      "The Groompfather comes apart in one long, grateful sigh.",
      "The Groomplex above you falls silent — truly silent.",
      "You take the elevator up. Sixty floors.",
      "You've earned the ride.",
    ],
    levels: [
      "The first dark. Your lamp is the only sun this place has known.",
      "Rootways. The Groomplex's foundations, gnawed hollow.",
      "The chittering span. Cross quietly. They won't.",
      "Egg galleries. Step where the shells are already broken.",
      "The warm vents. The whole hive exhales through here.",
      "Bonefields. Not all of these were groomps.",
      "The old expedition. Their flares still burn. Green.",
      "Whoever carried the GBFG this far deep, carried it no further.",
      "The humming dark. It isn't machinery.",
      "The brood knot. Cut it out.",
      "Vein tunnels. The walls pulse in time with something below.",
      "The shriek gallery. You'll hear why.",
      "The acid throat. Move quick, breathe shallow.",
      "The gnawed cathedral. They dug this on purpose.",
      "The sleeper pits. Some of the pits are still sleeping.",
      "Skitterling nurseries. Numbers beyond counting.",
      "The father's larder. Do not take inventory.",
      "The last stair. Carved for something far wider than you.",
      "The antechamber. The dark here is thick with waiting.",
      "The Groompfather. End the bloodline.",
    ],
  },
];

// where the lost guns are found (world:floor, zero-indexed)
const WEAPON_LEVELS = { "0:1": "3", "0:5": "4", "1:2": "5", "1:11": "6", "2:7": "7" };

// mulberry32 — deterministic per-floor RNG, so every floor is fixed forever
function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Room-and-corridor generator. Layout depends only on (world, floor);
// enemy and supply counts also read the chosen difficulty.
function generateLevel(wi, li) {
  const world = WORLDS[wi];
  const rng = mulberry(0x9E3779B9 ^ (wi * 7919 + li * 104729 + 17));
  const isBoss = li === LEVELS_PER_WORLD - 1;
  const isMini = li === 9;
  const gw = Math.min(52, 32 + li + wi * 3);
  const gh = Math.min(34, 24 + (li >> 1) + wi);
  const cells = [];
  for (let y = 0; y < gh; y++) cells.push(Array(gw).fill(world.wall));

  const rooms = [];
  const carve = (x0, y0, w, h) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        if (x > 0 && y > 0 && x < gw - 1 && y < gh - 1) cells[y][x] = ".";
      }
    }
  };
  const dig = (x, y) => {
    if (x > 0 && y > 0 && x < gw - 1 && y < gh - 1 && WALL_CHARS[cells[y][x]]) cells[y][x] = ".";
  };
  const corridor = (x0, y0, x1, y1) => {
    const wide = rng() < 0.35 ? 1 : 0;
    const hline = (xa, xb, y) => {
      for (let x = Math.min(xa, xb); x <= Math.max(xa, xb); x++) { dig(x, y); if (wide) dig(x, y + 1); }
    };
    const vline = (ya, yb, x) => {
      for (let y = Math.min(ya, yb); y <= Math.max(ya, yb); y++) { dig(x, y); if (wide) dig(x + 1, y); }
    };
    if (rng() < 0.5) { hline(x0, x1, y0); vline(y0, y1, x1); }
    else { vline(y0, y1, x0); hline(x0, x1, y1); }
  };
  const fits = (x, y, w, h) => {
    if (x < 1 || y < 1 || x + w > gw - 1 || y + h > gh - 1) return false;
    for (const r of rooms) {
      if (x < r.x + r.w + 1 && r.x < x + w + 1 && y < r.y + r.h + 1 && r.y < y + h + 1) return false;
    }
    return true;
  };
  const addRoom = (x, y, w, h) => {
    carve(x, y, w, h);
    const room = { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) };
    if (rooms.length) {
      let best = rooms[0], bd = 1e9;
      for (const r of rooms) {
        const d = Math.abs(r.cx - room.cx) + Math.abs(r.cy - room.cy);
        if (d < bd) { bd = d; best = r; }
      }
      corridor(room.cx, room.cy, best.cx, best.cy);
    }
    rooms.push(room);
    return room;
  };

  // start room hugs the west side; the boss arena (if any) the east
  const sw = 5 + (rng() * 3 | 0), sh = 4 + (rng() * 3 | 0);
  addRoom(1 + (rng() * 4 | 0), 1 + (rng() * (gh - sh - 2) | 0), sw, sh);
  if (isBoss) {
    const aw = Math.min(14, gw - 18), ah = Math.min(11, gh - 4);
    addRoom(gw - aw - 2, Math.max(1, Math.min(gh - ah - 1, 2 + (rng() * (gh - ah - 3) | 0))), aw, ah);
  }
  const wantRooms = 7 + (li >> 2) + (rng() * 3 | 0);
  for (let t = 0; t < 300 && rooms.length < wantRooms; t++) {
    const w = 4 + (rng() * 6 | 0), h = 4 + (rng() * 5 | 0);
    const x = 1 + (rng() * (gw - w - 2) | 0), y = 1 + (rng() * (gh - h - 2) | 0);
    if (fits(x, y, w, h)) addRoom(x, y, w, h);
  }
  // a couple of loop connections so floors aren't pure trees
  for (let k = 0; k < 2 && rooms.length > 3; k++) {
    const a = rooms[(rng() * rooms.length) | 0], b = rooms[(rng() * rooms.length) | 0];
    if (a !== b) corridor(a.cx, a.cy, b.cx, b.cy);
  }

  // accent wall materials around some rooms
  for (const room of rooms) {
    if (rng() >= world.accentCh) continue;
    const ac = world.accents[(rng() * world.accents.length) | 0];
    for (let y = room.y - 1; y <= room.y + room.h; y++) {
      for (let x = room.x - 1; x <= room.x + room.w; x++) {
        if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
        if (cells[y][x] !== world.wall) continue;
        if (y === room.y - 1 || y === room.y + room.h || x === room.x - 1 || x === room.x + room.w) cells[y][x] = ac;
      }
    }
  }

  // liquid pools (walkable): water slows, toxic sludge burns
  const blob = (room, ch) => {
    let x = room.x + 1 + (rng() * Math.max(1, room.w - 2) | 0);
    let y = room.y + 1 + (rng() * Math.max(1, room.h - 2) | 0);
    let n = 5 + (rng() * 14 | 0);
    for (let i = 0; i < n * 4 && n > 0; i++) {
      if (cells[y][x] === ".") { cells[y][x] = ch; n--; }
      if (rng() < 0.5) x += rng() < 0.5 ? 1 : -1;
      else y += rng() < 0.5 ? 1 : -1;
      x = Math.max(room.x + 1, Math.min(room.x + room.w - 2, x));
      y = Math.max(room.y + 1, Math.min(room.y + room.h - 2, y));
    }
  };
  for (let i = 1; i < rooms.length; i++) {
    if (rooms[i].w > 3 && rooms[i].h > 3) {
      if (rng() < world.water) blob(rooms[i], "~");
      if (rng() < world.toxic) blob(rooms[i], "!");
    }
  }

  const put = (room, ch) => {
    for (let t = 0; t < 30; t++) {
      const x = room.x + (rng() * room.w | 0), y = room.y + (rng() * room.h | 0);
      if (cells[y][x] === ".") { cells[y][x] = ch; return true; }
    }
    return false;
  };
  const pool = world.pool.filter(p => p[2] <= li);
  let poolW = 0;
  for (const p of pool) poolW += p[1];
  const pick = () => {
    let r = rng() * poolW;
    for (const p of pool) { r -= p[1]; if (r <= 0) return p[0]; }
    return pool[0][0];
  };

  // player, exit, bosses, weapons — placed before the general decoration
  const start = rooms[0];
  cells[start.cy][start.cx] = "P";
  put(start, "l");

  const exitRoom = isBoss ? rooms[1] : rooms.reduce((best, r) => {
    const d = Math.abs(r.cx - start.cx) + Math.abs(r.cy - start.cy);
    return d > best.d ? { r, d } : best;
  }, { r: rooms[rooms.length - 1], d: -1 }).r;
  const exitCh = isBoss ? "X" : ["X", ">", "E"][li % 3];
  if (isBoss) {
    cells[exitRoom.y + 1][exitRoom.x + exitRoom.w - 2] = exitCh;
    cells[exitRoom.cy][exitRoom.cx] = "B";
    for (let k = 0; k < 4 + wi * 2; k++) put(exitRoom, pick());
    put(exitRoom, "h");
    put(exitRoom, "a");
    put(exitRoom, "a");
  } else {
    cells[exitRoom.cy][exitRoom.cx] = exitCh;
  }
  if (isMini) for (const ch of world.heavies) put(exitRoom, ch);

  const wch = WEAPON_LEVELS[wi + ":" + li];
  if (wch) put(rooms[1 + (rng() * (rooms.length - 1) | 0)], wch);
  if (li === 0 && wi > 0) {
    // returning gear for anyone continuing a saved descent mid-campaign
    const back = wi === 1 ? ["3", "4"] : ["3", "4", "5", "6"];
    for (const ch of back) put(rooms[1 + (rng() * (rooms.length - 1) | 0)], ch);
  }

  // enemies, supplies, dressing
  let meds = 0;
  for (let i = 1; i < rooms.length; i++) {
    const room = rooms[i];
    const dd = Math.abs(room.cx - start.cx) + Math.abs(room.cy - start.cy);
    let n = Math.round((room.w * room.h) / 15 * (0.75 + li * 0.05 + wi * 0.3) * DIFF.density);
    if (dd < 9) n = Math.min(n, 1);
    n = Math.min(n, 7 + wi);
    if (isBoss && room === exitRoom) n = 0;
    for (let k = 0; k < n; k++) put(room, pick());
    if (rng() < 0.5 && put(room, "h")) meds++;
    if (rng() < 0.6) put(room, "a");
    if (rng() < 0.12 + li * 0.005) put(room, "A");
    if (rng() < 0.5) put(room, "b");
    if (rng() < 0.4) put(room, "k");
    const lamps = 1 + (rng() * 2 | 0);
    for (let k = 0; k < lamps; k++) put(room, "l");
  }
  for (let t = 0; meds < 2 && t < 10 && rooms.length > 1; t++) {
    if (put(rooms[1 + (rng() * (rooms.length - 1) | 0)], "h")) meds++;
  }

  return cells.map(r => r.join(""));
}

// -------------------------------------------------- map state (per floor)

let MW = 0, MH = 0;
let grid = new Uint8Array(0);
let startSpawns = {
  player: { x: 2.5, y: 2.5 },
  enemies: [], pickups: [], barrels: [], lamps: [], skulls: [], weapons: [],
};

function parseMap(rows) {
  MH = rows.length;
  MW = 0;
  for (const r of rows) MW = Math.max(MW, r.length);
  grid = new Uint8Array(MW * MH);
  startSpawns = {
    player: { x: 2.5, y: 2.5 },
    enemies: [], pickups: [], barrels: [], lamps: [], skulls: [], weapons: [],
  };
  for (let y = 0; y < MH; y++) {
    const row = rows[y];
    for (let x = 0; x < MW; x++) {
      const ch = x < row.length ? row[x] : "#";
      if (WALL_CHARS[ch]) { grid[y * MW + x] = WALL_CHARS[ch]; continue; }
      if (FLOOR_CHARS[ch]) { grid[y * MW + x] = FLOOR_CHARS[ch]; continue; }
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
}

// ------------------------------------------------------------- lighting
// Static per-cell light (sector feel): random variance, bright pools under
// lamps and around the exits, a faint glow off toxic sludge. A few cells
// flicker; lightNow is the per-frame effective value. Rebuilt per floor.

let lightGrid = new Float32Array(0);
let flickerGrid = new Uint8Array(0);
let lightNow = new Float32Array(0);

function buildLights(seed) {
  lightGrid = new Float32Array(MW * MH);
  flickerGrid = new Uint8Array(MW * MH);
  lightNow = new Float32Array(MW * MH);
  let s = seed >>> 0 || 0xBADA55;
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
    const c = grid[i];
    if (c === EXIT_CELL || c === STAIR_CELL || c === ELEV_CELL) boost(i % MW, (i / MW) | 0, 0.45);
    else if (c === TOXIC_CELL) {
      lightGrid[i] = Math.min(1.4, lightGrid[i] + 0.18);
      if (rr() < 0.3) flickerGrid[i] = 1 + (rr() * 6 | 0);
    }
  }
}
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
function isLiquid(c) { return c === WATER_CELL || c === TOXIC_CELL; }
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
  demon:    { hp: 150, speed: 3.0, scale: 1.15, r: 0.36, melee: 22, spit: 0,  ranged: false },
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

let state = "title"; // title | worldintro | playing | elevator | intermission | dead | won
let enemies = [], pickups = [], projectiles = [], wpickups = [];
let barrels = [], explosions = [], particles = [];
let totalEnemies = 0, kills = 0;
let startTime = 0, winTime = 0, now = 0;
let shootCool = 0, muzzle = 0, recoil = 0, bobPhase = 0, bobAmt = 0;
let damageFlash = 0, pickupFlash = 0;
let msg = "", msgT = 0;
let showMap = false;

// campaign position + per-floor snapshot (restored when you die and retry)
let world = 0, level = 0;
let campKills = 0, campTime = 0;
let exitKind = "pad";
let elevT = 0, toxT = 0, splashT = 0;
let levelSnap = null;

// Polish effects
let screenShake = 0, shakeX = 0, shakeY = 0;
let hitMarkers = []; // {t, kill}
let crosshairBloat = 0;
let weaponSlide = 0;
let multiKillT = 0, multiKillCount = 0;
let killFlash = 0;

function flash(text) { msg = text; msgT = 2.4; }

// ------------------------------------------------------- campaign control

function freshLoadout() {
  player.hp = 100;
  player.armor = 0;
  ammoPool = { bullets: 60, shells: 0, rockets: 0, cells: 0 };
  owned = { 1: true, 2: true };
  curGun = 2;
}

function snapLoadout() {
  levelSnap = { hp: player.hp, armor: player.armor, ammo: { ...ammoPool }, owned: { ...owned }, gun: curGun };
}

function restoreLoadout() {
  if (!levelSnap) return;
  player.hp = levelSnap.hp;
  player.armor = levelSnap.armor;
  ammoPool = { ...levelSnap.ammo };
  owned = { ...levelSnap.owned };
  curGun = levelSnap.gun;
}

function spawnLevel() {
  player.x = startSpawns.player.x;
  player.y = startSpawns.player.y;
  player.ang = 0;
  swingT = 0;
  enemies = startSpawns.enemies.map(s => {
    const st = ENEMY_STATS[s.type];
    const bossMul = s.type === "boss" ? 1 + world * 0.7 : 1;
    return {
      type: s.type, x: s.x, y: s.y,
      hp: Math.round(st.hp * DIFF.hp * bossMul),
      speed: st.speed * DIFF.speed, scale: st.scale,
      r: st.r,
      melee: Math.round(st.melee * DIFF.dmg),
      spit: Math.round(st.spit * DIFF.dmg),
      ranged: st.ranged,
      proj: st.proj, hover: st.hover, scream: st.scream,
      state: "idle", animT: Math.random() * 9, cool: 0, atkT: 0, painT: 0,
      deadT: 0, rangedAttack: false, target: null,
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
  screenShake = shakeX = shakeY = crosshairBloat = weaponSlide = 0;
  hitMarkers = [];
  multiKillT = multiKillCount = killFlash = 0;
  elevT = 0;
  toxT = 1.0;
  splashT = 0;
  startTime = now;
  flash(WORLDS[world].levels[level]);
}

function loadLevel(wi, li) {
  parseMap(generateLevel(wi, li));
  buildLights(0xBADA55 ^ (wi * 131071 + li * 8191));
  spawnLevel();
}

function saveProgress() {
  try {
    localStorage.setItem("groomp.save", JSON.stringify({ w: world, l: level, d: diffIndex }));
  } catch (e) { /* private mode etc. */ }
}

function loadProgress() {
  try {
    const s = JSON.parse(localStorage.getItem("groomp.save"));
    if (s && s.w >= 0 && s.w < WORLDS.length && s.l >= 0 && s.l < LEVELS_PER_WORLD) return s;
  } catch (e) { /* ignore */ }
  return null;
}

function startCampaign() {
  diffIndex = diffSel;
  DIFF = DIFFICULTIES[diffIndex];
  world = 0;
  level = 0;
  campKills = campTime = 0;
  freshLoadout();
  state = "worldintro";
}

function continueCampaign() {
  const s = loadProgress();
  if (!s) return;
  diffIndex = diffSel = s.d >= 0 && s.d < DIFFICULTIES.length ? s.d : 1;
  DIFF = DIFFICULTIES[diffIndex];
  world = s.w;
  level = s.l;
  campKills = campTime = 0;
  freshLoadout();
  state = "worldintro";
}

function enterLevel() {
  loadLevel(world, level);
  snapLoadout();
  saveProgress();
  state = "playing";
}

function retryLevel() {
  restoreLoadout();
  loadLevel(world, level);
  state = "playing";
}

function completeLevel(kind) {
  exitKind = kind;
  winTime = now - startTime;
  campKills += kills;
  campTime += winTime;
  document.exitPointerLock && document.exitPointerLock();
  if (world === WORLDS.length - 1 && level === LEVELS_PER_WORLD - 1) {
    state = "won";
    try { localStorage.removeItem("groomp.save"); } catch (e) { /* ignore */ }
    Sfx.win();
  } else {
    state = "intermission";
    if (kind === "elevator") Sfx.ding();
    else if (kind === "stairs") Sfx.stairs();
    else Sfx.win();
  }
}

// ---------------------------------------------------------------- input

const keys = {};
let mouseDown = false;

addEventListener("keydown", e => {
  if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.code === "KeyM") showMap = !showMap;
  if (e.code === "KeyN" && typeof Sfx !== "undefined") flash(Sfx.toggleMusic() ? "Music on." : "Music off.");
  if (e.code === "KeyR" && (state === "playing" || state === "dead")) retryLevel();
  if (state === "title") {
    if (e.code === "ArrowUp" || e.code === "KeyW") diffSel = (diffSel + DIFFICULTIES.length - 1) % DIFFICULTIES.length;
    if (e.code === "ArrowDown" || e.code === "KeyS") diffSel = (diffSel + 1) % DIFFICULTIES.length;
    if (e.code.startsWith("Digit")) {
      const d = +e.code.slice(5);
      if (d >= 1 && d <= DIFFICULTIES.length) diffSel = d - 1;
    }
    if (e.code === "Enter" || e.code === "Space") { Sfx.init(); startCampaign(); }
    if (e.code === "KeyC") { Sfx.init(); continueCampaign(); }
    return;
  }
  if (e.code.startsWith("Digit")) {
    const slot = +e.code.slice(5);
    if (slot >= 1 && slot <= 7 && owned[slot] && slot !== curGun && state === "playing") {
      curGun = slot;
      muzzle = 0;
      weaponSlide = 1;
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
    if (owned[slot]) { curGun = slot; weaponSlide = 1; shootCool = Math.max(shootCool, 0.18); break; }
  }
});
addEventListener("keyup", e => { keys[e.code] = false; });

function grabPointer() {
  if (document.pointerLockElement !== canvas && canvas.requestPointerLock) canvas.requestPointerLock();
}

canvas.addEventListener("mousedown", e => {
  if (e.button !== 0) return;
  Sfx.init();
  if (state === "title") { startCampaign(); return; }
  if (state === "worldintro") { enterLevel(); grabPointer(); return; }
  if (state === "intermission") {
    if (level === LEVELS_PER_WORLD - 1) {
      world++;
      level = 0;
      state = "worldintro";
    } else {
      level++;
      enterLevel();
      grabPointer();
    }
    return;
  }
  if (state === "dead") { retryLevel(); grabPointer(); return; }
  if (state === "won") { state = "title"; return; }
  if (state === "elevator") return;
  grabPointer();
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
  screenShake = Math.min(1, screenShake + 0.35);
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
  screenShake = Math.min(1, screenShake + 0.45 + r * 0.12);
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

// `attacker` set to another enemy means friendly fire — the victim turns on
// whoever hit it, Doom-style infighting.
function damageEnemy(e, dmg, attacker) {
  e.hp -= dmg;
  spawnParticles(e.x, e.y, 0.35, "blood", 7, 1.6);
  const infight = attacker && attacker !== e && attacker.state !== "dead";
  if (infight) {
    e.target = attacker;
    if (e.hp > 0 && Math.random() < 0.1) flash("The groomps turn on each other!");
  }
  if (e.state === "idle") { e.state = "chase"; Sfx.growl(); }
  const isKill = e.hp <= 0;
  if (!infight) {
    hitMarkers.push({ t: isKill ? 0.5 : 0.28, kill: isKill });
    if (hitMarkers.length > 4) hitMarkers.shift();
  }
  if (e.hp <= 0) {
    e.state = "dead";
    e.deadT = 0;
    kills++;
    if (!infight) {
      killFlash = 0.12;
      if (multiKillT > 0) {
        multiKillCount++;
        const mkMsgs = ["DOUBLE KILL!", "TRIPLE KILL!", "RAMPAGE!", "MASSACRE!", "UNSTOPPABLE!"];
        flash(mkMsgs[Math.min(4, multiKillCount - 1)]);
      } else {
        multiKillCount = 1;
      }
      multiKillT = 2.8;
    }
    Sfx.enemyDie();
    if (e.type === "boss") flash(`${WORLDS[world].bossName} HAS FALLEN!`);
    else if (kills === totalEnemies) flash("All groomps splattered! Find the way down.");
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
  crosshairBloat = Math.min(1, crosshairBloat + 0.38);
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

function spawnSpit(e, T) {
  const dx = T.x - e.x, dy = T.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const speed = e.proj === "fire" ? 4.6 : 5.2;
  projectiles.push({
    x: e.x + (dx / d) * 0.5, y: e.y + (dy / d) * 0.5,
    dx: (dx / d) * speed, dy: (dy / d) * speed,
    dmg: e.spit, kind: e.proj || "spit", hostile: true, src: e,
  });
  Sfx.spit();
}

// --------------------------------------------------------------- update

function updateEnemy(e, dt) {
  if (e.state === "dead") { e.deadT += dt; return; }
  // infight target if one is set and still breathing, the player otherwise
  if (e.target && e.target.state === "dead") e.target = null;
  const T = e.target || player;
  const dx = T.x - e.x, dy = T.y - e.y;
  const dist = Math.hypot(dx, dy);
  const seen = dist < 14 && los(e.x, e.y, T.x, T.y);
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
        if (seen) spawnSpit(e, T);
      } else if (dist < 1.8) {
        if (e.target) damageEnemy(e.target, e.melee + (Math.random() * 5 | 0), e);
        else damagePlayer(e.melee + (Math.random() * 5 | 0));
      }
      e.cool = (e.type === "boss" ? 0.8 : 1.1 + Math.random() * 0.5) * DIFF.cool;
      e.state = "chase";
    }
    return;
  }

  // chase
  e.animT += dt;
  const canMelee = e.melee > 0 && dist < 1.25 + (e.target ? e.target.r : 0);
  const canSpit = e.ranged && seen && dist > 2 && dist < 9;
  if (e.cool <= 0 && (canMelee || canSpit)) {
    e.state = "attack";
    e.atkT = 0.45;
    e.rangedAttack = !canMelee;
    return;
  }
  const holdRange = e.type === "spitter" && seen && dist < 4.5;
  if (!holdRange && dist > 0.8) {
    let step = e.speed * dt;
    if (isLiquid(cellAt(Math.floor(e.x), Math.floor(e.y)))) step *= 0.6;
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
  screenShake = Math.max(0, screenShake - dt * 5.5);
  shakeX = screenShake > 0.01 ? (Math.random() - 0.5) * screenShake * 10 : 0;
  shakeY = screenShake > 0.01 ? (Math.random() - 0.5) * screenShake * 7 : 0;
  crosshairBloat = Math.max(0, crosshairBloat - dt * 4.5);
  weaponSlide = Math.max(0, weaponSlide - dt * 10);
  killFlash = Math.max(0, killFlash - dt * 7);
  multiKillT = Math.max(0, multiKillT - dt);
  for (let i = hitMarkers.length - 1; i >= 0; i--) {
    hitMarkers[i].t -= dt;
    if (hitMarkers[i].t <= 0) hitMarkers.splice(i, 1);
  }

  if (state === "elevator") {
    // ride down: rumble, fade, then the next floor
    elevT += dt;
    screenShake = Math.min(0.3, screenShake + dt * 0.5);
    if (elevT >= 1.5) completeLevel("elevator");
    return;
  }
  if (state !== "playing") return;

  // turning (keyboard)
  const turn = 2.6 * dt;
  if (keys.ArrowLeft) player.ang -= turn;
  if (keys.ArrowRight) player.ang += turn;
  dirX = Math.cos(player.ang);
  dirY = Math.sin(player.ang);
  planeX = -dirY * FOV;
  planeY = dirX * FOV;

  // movement — wading through liquid is slow and loud
  const pcell = cellAt(Math.floor(player.x), Math.floor(player.y));
  const inLiquid = isLiquid(pcell);
  const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const str = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const run = keys.ShiftLeft || keys.ShiftRight;
  let speed = (run ? 5.0 : 3.2) * dt;
  if (inLiquid) speed *= 0.55;
  if (fwd && str) speed *= 0.7071;
  if (fwd || str) {
    tryMove(player,
      (dirX * fwd - dirY * str) * speed,
      (dirY * fwd + dirX * str) * speed,
      player.r);
    bobPhase += speed * 2.6;
    bobAmt = Math.min(1, bobAmt + dt * 6);
    crosshairBloat = Math.min(1, crosshairBloat + bobAmt * dt * 2.2);
    if (inLiquid) {
      splashT -= dt * (run ? 1.6 : 1);
      if (splashT <= 0) { Sfx.splash(); splashT = 0.55; }
    }
  } else {
    bobAmt = Math.max(0, bobAmt - dt * 4);
  }

  // toxic sludge burns on a tick; the rate comes from the difficulty
  if (pcell === TOXIC_CELL) {
    toxT -= dt;
    if (toxT <= 0) {
      toxT = 0.65;
      Sfx.sizzle();
      damagePlayer(DIFF.toxic);
      if (state !== "playing") return; // the sludge got you
      if (Math.random() < 0.3) flash("The sludge burns!");
    }
  } else {
    toxT = Math.min(toxT, 0.35);
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
        } else {
          // stray monster fire hits other monsters — and starts infights
          for (const e of enemies) {
            if (e === p.src || e.state === "dead") continue;
            if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + 0.2) {
              damageEnemy(e, p.dmg, p.src);
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
      player.hp = Math.min(100, player.hp + Math.round(25 * DIFF.supply));
      flash("Picked up a medkit.");
    } else if (p.kind === "armor") {
      if (player.armor >= 100) continue;
      player.armor = Math.min(100, player.armor + 50);
      flash("Picked up groomp-plate armor.");
    } else {
      ammoPool.bullets = Math.min(AMMO_MAX.bullets, ammoPool.bullets + Math.round(20 * DIFF.supply));
      ammoPool.shells = Math.min(AMMO_MAX.shells, ammoPool.shells + Math.round(4 * DIFF.supply));
      ammoPool.rockets = Math.min(AMMO_MAX.rockets, ammoPool.rockets + 1);
      ammoPool.cells = Math.min(AMMO_MAX.cells, ammoPool.cells + Math.round(20 * DIFF.supply));
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

  // three ways down: the exit pad, the stairs, or the elevator ride
  const onCell = cellAt(Math.floor(player.x), Math.floor(player.y));
  if (onCell === EXIT_CELL) {
    completeLevel("pad");
  } else if (onCell === STAIR_CELL) {
    Sfx.stairs();
    completeLevel("stairs");
  } else if (onCell === ELEV_CELL) {
    state = "elevator";
    elevT = 0;
    mouseDown = false;
    Sfx.elevator();
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
const LIT_WATER = [buildLit(texWater), buildLit(texWater2)];
const LIT_TOXIC = [buildLit(texToxic), buildLit(texToxic2)];
const LIT_STAIRS = buildLit(texStairs);
const LIT_ELEV = buildLit(texElevator);
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
  const liqFrame = ((now * 2.6) | 0) % 2; // two-frame liquid animation
  for (let y = halfH + 1; y < H; y++) {
    const rowDist = halfH / (y - halfH);
    const stepX = rowDist * (rx1 - rx0) / W;
    const stepY = rowDist * (ry1 - ry0) / W;
    let fx = px + rowDist * rx0;
    let fy = py + rowDist * ry0;
    const f = fog(rowDist) * 0.95;
    let floorTex = LIT_FLOOR[litIndex(f)];
    let ceilTex = LIT_CEIL[litIndex(f * 0.85)];
    const rowF = y * W;
    const rowC = (H - y - 1) * W;
    let lcx = -1e9, lcy = -1e9;
    // sample every other column and write pixel pairs: at this resolution
    // the difference is invisible and it halves the cost of the hot loop
    const stepX2 = stepX * 2, stepY2 = stepY * 2;
    for (let x = 0; x < W; x += 2) {
      const cx = fx | 0, cy = fy | 0;
      if (cx !== lcx || cy !== lcy) {
        lcx = cx;
        lcy = cy;
        const c = cellAt(cx, cy);
        const lv = lightAt(cx, cy);
        ceilTex = LIT_CEIL[litIndex(f * 0.85 * lv)];
        if (c === EXIT_CELL) floorTex = LIT_EXIT[litIndex(Math.min(1, f + 0.5) * exitPulse)];
        else if (c === WATER_CELL) floorTex = LIT_WATER[liqFrame][litIndex(f * lv)];
        else if (c === TOXIC_CELL) floorTex = LIT_TOXIC[liqFrame][litIndex(Math.min(1, f * lv + 0.18))];
        else if (c === STAIR_CELL) floorTex = LIT_STAIRS[litIndex(Math.min(1, f * lv + 0.15))];
        else if (c === ELEV_CELL) floorTex = LIT_ELEV[litIndex(Math.min(1, (f * lv + 0.3) * exitPulse))];
        else floorTex = LIT_FLOOR[litIndex(f * lv)];
      }
      const ti = (((fy - cy) * TEXN) | 0) * TEXN + (((fx - cx) * TEXN) | 0);
      const pf = floorTex[ti];
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
    let u = e.hover && e.state !== "dead" ? 0.08 + 0.05 * Math.sin(now * 2.6 + e.animT * 4) : 0;
    // waders sit low in the liquid; corpses sink further
    if (!e.hover && isLiquid(cellAt(Math.floor(e.x), Math.floor(e.y)))) u = e.state === "dead" ? -0.16 : -0.09;
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
  const by = Math.abs(Math.cos(bobPhase)) * 8 * bobAmt + recoil * 26 + weaponSlide * 110;
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

  ctx.imageSmoothingEnabled = true;
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
  ctx.imageSmoothingEnabled = false;

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
  const colors = {
    1: "#7a3328", 2: "#5c6166", 3: "#3c4258", 4: "#3a7a26",
    5: "#1e5c8a", 6: "#4a9a1e", 7: "#b0a890", 8: "#c8a018", 9: "#37e065",
  };
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
  ctx.font = `bold ${lines.titleSize || 76}px monospace`;
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
  offCtx.putImageData(img, 0, 0);
  ctx.save();
  ctx.translate(shakeX, shakeY);
  ctx.drawImage(offCanvas, 0, 0);
  ctx.drawImage(VIGNETTE, 0, 0);
  ctx.restore();

  // The 2D overlay is authored in 640x400 logical coordinates.
  ctx.save();
  ctx.scale(W / LW, H / LH);

  drawWeapon();

  if (damageFlash > 0) {
    const viewH = LH - HUD_H;
    const dv = ctx.createRadialGradient(LW / 2, viewH / 2, viewH * 0.18, LW / 2, viewH / 2, viewH * 0.78);
    dv.addColorStop(0, "rgba(200,10,10,0)");
    dv.addColorStop(0.5, `rgba(200,10,10,${Math.min(0.22, damageFlash * 0.2)})`);
    dv.addColorStop(1, `rgba(200,10,10,${Math.min(0.92, damageFlash * 0.95)})`);
    ctx.fillStyle = dv;
    ctx.fillRect(0, 0, LW, viewH);
  }
  if (state === "playing" && player.hp > 0 && player.hp < 30) {
    const viewH = LH - HUD_H;
    const pulse = 0.4 + 0.4 * Math.sin(now * (4.5 + (30 - player.hp) * 0.18));
    const lhv = ctx.createRadialGradient(LW / 2, viewH / 2, viewH * 0.22, LW / 2, viewH / 2, viewH * 0.88);
    lhv.addColorStop(0, "rgba(180,0,0,0)");
    lhv.addColorStop(1, `rgba(180,0,0,${pulse * 0.55 * (1 - player.hp / 30)})`);
    ctx.fillStyle = lhv;
    ctx.fillRect(0, 0, LW, viewH);
  }
  if (killFlash > 0) {
    ctx.fillStyle = `rgba(255,255,190,${killFlash * 0.28})`;
    ctx.fillRect(0, 0, LW, LH - HUD_H);
  }
  if (state === "playing" || state === "elevator") {
    // wading tint
    const pc = cellAt(Math.floor(player.x), Math.floor(player.y));
    if (pc === WATER_CELL) {
      ctx.fillStyle = "rgba(30,90,140,0.10)";
      ctx.fillRect(0, 0, LW, LH - HUD_H);
    } else if (pc === TOXIC_CELL) {
      ctx.fillStyle = `rgba(90,160,20,${0.1 + 0.05 * Math.sin(now * 6)})`;
      ctx.fillRect(0, 0, LW, LH - HUD_H);
    }
  }
  if (state === "elevator") {
    const a = Math.min(1, elevT / 1.4);
    ctx.fillStyle = `rgba(0,0,0,${a * a * 0.96})`;
    ctx.fillRect(0, 0, LW, LH);
    ctx.textAlign = "center";
    ctx.font = "bold 18px monospace";
    ctx.fillStyle = `rgba(232,200,64,${0.55 + 0.45 * Math.sin(now * 9)})`;
    ctx.fillText("DESCENDING...", LW / 2, LH / 2 - 20);
  }
  if (pickupFlash > 0) {
    ctx.fillStyle = `rgba(220,200,60,${Math.min(0.25, pickupFlash)})`;
    ctx.fillRect(0, 0, LW, LH - HUD_H);
  }

  if (state === "playing") {
    const cx = LW / 2, cy = LH / 2 - 32;
    const bloom = 4 + crosshairBloat * 13;
    const clen = 6;
    const calpha = muzzle > 0 ? 0.45 : 0.82;
    ctx.strokeStyle = `rgba(255,255,255,${calpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - bloom - clen, cy); ctx.lineTo(cx - bloom, cy);
    ctx.moveTo(cx + bloom, cy);        ctx.lineTo(cx + bloom + clen, cy);
    ctx.moveTo(cx, cy - bloom - clen); ctx.lineTo(cx, cy - bloom);
    ctx.moveTo(cx, cy + bloom);        ctx.lineTo(cx, cy + bloom + clen);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${calpha * 0.65})`;
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
    // hit markers
    for (const hm of hitMarkers) {
      const maxT = hm.kill ? 0.5 : 0.28;
      const a = Math.min(1, hm.t / maxT) * (hm.kill ? 1 : 0.8);
      const sz = hm.kill ? 9 : 5;
      ctx.strokeStyle = hm.kill ? `rgba(255,210,0,${a})` : `rgba(255,255,255,${a})`;
      ctx.lineWidth = hm.kill ? 2.2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - sz, cy - sz); ctx.lineTo(cx + sz, cy + sz);
      ctx.moveTo(cx + sz, cy - sz); ctx.lineTo(cx - sz, cy + sz);
      ctx.stroke();
    }
  }

  drawHud();
  drawMinimap();

  if (msgT > 0 && state === "playing") {
    ctx.textAlign = "center";
    ctx.font = "bold 16px monospace";
    ctx.fillStyle = `rgba(230,220,180,${Math.min(1, msgT)})`;
    ctx.fillText(msg, LW / 2, 30);
  }
  if (state === "playing" || state === "elevator") {
    ctx.font = "10px monospace";
    ctx.fillStyle = "rgba(220,200,160,0.55)";
    ctx.textAlign = "right";
    ctx.fillText(`KILLS ${kills}/${totalEnemies}`, LW - 10, 16);
    if (!showMap) {
      ctx.textAlign = "left";
      ctx.fillText(`${WORLDS[world].name} · FLOOR ${level + 1}/${LEVELS_PER_WORLD} · ${DIFF.name}`, 10, 16);
    }
    ctx.textAlign = "center";
  }

  if (state === "title") {
    drawTitle();
  } else if (state === "worldintro") {
    const w = WORLDS[world];
    drawCenteredPanel({
      title: w.name,
      titleColor: w.tint,
      titleSize: 42,
      titleY: 96,
      body: [
        ...w.intro,
        "",
        `FLOOR ${level + 1} OF ${LEVELS_PER_WORLD} · DIFFICULTY: ${DIFF.name}`,
      ],
      prompt: "CLICK TO DESCEND",
    });
  } else if (state === "intermission") {
    const w = WORLDS[world];
    const bossFloor = level === LEVELS_PER_WORLD - 1;
    const exitLine = {
      pad: "The exit pad hums you down a floor.",
      stairs: "You take the stairs, two at a time.",
      elevator: "The elevator grinds down into the dark.",
    }[exitKind];
    drawCenteredPanel({
      title: "FLOOR CLEARED",
      titleColor: "#3fe06a",
      titleSize: 50,
      titleY: 92,
      body: [
        `${w.name} — FLOOR ${level + 1}`,
        "",
        `Groomps splattered: ${kills} / ${totalEnemies}`,
        `Time: ${fmtTime(winTime)}`,
        "",
        ...(bossFloor ? w.outro : [exitLine, "", "NEXT: " + w.levels[level + 1]]),
      ],
      prompt: bossFloor ? `CLICK TO ENTER ${WORLDS[world + 1].name}` : "CLICK TO CONTINUE",
    });
  } else if (state === "dead") {
    drawCenteredPanel({
      title: "GROOMPED",
      titleColor: "#c92a14",
      body: [
        `${WORLDS[world].name} — FLOOR ${level + 1} · ${DIFF.name}`,
        "",
        `You splattered ${kills} of ${totalEnemies} groomps`,
        "before becoming one with the ooze.",
        "The floor keeps what it kills — your gear does not.",
      ],
      prompt: "CLICK TO RETRY THE FLOOR",
    });
  } else if (state === "won") {
    drawCenteredPanel({
      title: "BLOODLINE ENDED",
      titleColor: "#3fe06a",
      titleSize: 46,
      titleY: 92,
      body: [
        ...WORLDS[2].outro,
        "",
        `Difficulty: ${DIFF.name}`,
        `Groomps splattered: ${campKills}`,
        `Total time below: ${fmtTime(campTime)}`,
      ],
      prompt: "CLICK FOR TITLE",
    });
  }

  ctx.restore();
}

function drawTitle() {
  ctx.fillStyle = "rgba(8,8,12,0.82)";
  ctx.fillRect(0, 0, LW, LH);
  ctx.textAlign = "center";
  ctx.font = "bold 72px monospace";
  ctx.fillStyle = "#5a0d08";
  ctx.fillText("GROOMP", LW / 2 + 4, 88 + 4);
  ctx.fillStyle = "#e03f2a";
  ctx.fillText("GROOMP", LW / 2, 88);
  ctx.font = "bold 13px monospace";
  ctx.fillStyle = "#8a93a2";
  ctx.fillText("S I X T Y   F L O O R S   D O W N", LW / 2, 112);

  ctx.font = "13px monospace";
  ctx.fillStyle = "#c9c9d0";
  const teaser = [
    "The Groomplex extermination facility has gone silent.",
    "Sixty floors of groomps between you and whatever breeds them.",
    "Three worlds. Twenty floors each. One exterminator.",
  ];
  let y = 140;
  for (const l of teaser) { ctx.fillText(l, LW / 2, y); y += 17; }

  y = 212;
  ctx.font = "bold 13px monospace";
  ctx.fillStyle = "#8a93a2";
  ctx.fillText("— CHOOSE YOUR EXTERMINATION —", LW / 2, y);
  y += 22;
  for (let i = 0; i < DIFFICULTIES.length; i++) {
    const D = DIFFICULTIES[i];
    const sel = i === diffSel;
    if (sel) {
      ctx.fillStyle = "rgba(232,200,64,0.14)";
      ctx.fillRect(LW / 2 - 200, y - 12, 400, 18);
    }
    ctx.font = sel ? "bold 14px monospace" : "13px monospace";
    ctx.fillStyle = sel ? "#e8c840" : "#9aa0ac";
    ctx.fillText((sel ? "▶ " : "") + D.name + " — " + D.desc, LW / 2, y);
    y += 21;
  }

  const save = loadProgress();
  if (save) {
    ctx.font = "12px monospace";
    ctx.fillStyle = "#7ac8e0";
    ctx.fillText(
      `[C] CONTINUE — ${WORLDS[save.w].name}, FLOOR ${save.l + 1} (${DIFFICULTIES[save.d] ? DIFFICULTIES[save.d].name : "NORMAL"})`,
      LW / 2, y + 10);
  }

  ctx.font = "11px monospace";
  ctx.fillStyle = "#6c7280";
  ctx.fillText("WASD move · mouse turn · click shoot · 1-7 weapons · shift run · M map · N music · R retry floor", LW / 2, LH - 78);

  ctx.font = "bold 18px monospace";
  ctx.fillStyle = 0.5 + 0.5 * Math.sin(now * 4) > 0.5 ? "#e0c63f" : "#8a7a28";
  ctx.fillText("↑ ↓ DIFFICULTY · CLICK TO DESCEND", LW / 2, LH - 52);
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

// boot: load floor one so the title screen has a world behind it
freshLoadout();
loadLevel(0, 0);
requestAnimationFrame(frame);

if (location.hash === "#debug") {
  window.__groomp = {
    player,
    get enemies() { return enemies; },
    get state() { return state; },
    set state(s) { state = s; },
    get world() { return world; },
    get level() { return level; },
    get map() { return { w: MW, h: MH }; },
    cellAt,
    goto(wi, li, di) {
      if (di >= 0 && di < DIFFICULTIES.length) { diffIndex = diffSel = di; DIFF = DIFFICULTIES[diffIndex]; }
      world = Math.max(0, Math.min(WORLDS.length - 1, wi));
      level = Math.max(0, Math.min(LEVELS_PER_WORLD - 1, li));
      freshLoadout();
      enterLevel();
    },
  };
}

})();
