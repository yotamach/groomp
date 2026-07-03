"use strict";
// GROOMP — procedural textures & sprites. No image files: everything is
// drawn onto offscreen canvases at load time and read back as Uint32Array
// pixel buffers (little-endian 0xAABBGGRR, same layout the renderer writes).

// Texture/sprite resolution. 64px crisp pixel art, Doom-style: textures are
// drawn with integer rects and per-pixel dithering, never smooth gradients.
const TEXN = 64;

let _seed = 0x6700A7;
function rnd() {
  _seed = (_seed * 1664525 + 1013904223) >>> 0;
  return _seed / 4294967296;
}

function makePixels(draw) {
  const c = document.createElement("canvas");
  c.width = TEXN;
  c.height = TEXN;
  const g = c.getContext("2d");
  g.scale(TEXN / 64, TEXN / 64);
  draw(g);
  return new Uint32Array(g.getImageData(0, 0, TEXN, TEXN).data.buffer);
}

function addNoise(g, amt) {
  const id = g.getImageData(0, 0, TEXN, TEXN);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const n = (rnd() - 0.5) * amt;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(id, 0, 0);
}

// bevelled block with baked top-light: the core of the "gritty" look
function block(g, x, y, w, h, fill) {
  g.fillStyle = fill;
  g.fillRect(x, y, w, h);
  g.fillStyle = "rgba(255,235,215,0.16)";
  g.fillRect(x, y, w, 1.5);
  g.fillRect(x, y, 1.5, h);
  g.fillStyle = "rgba(0,0,0,0.38)";
  g.fillRect(x, y + h - 1.5, w, 1.5);
  g.fillRect(x + w - 1.5, y, 1.5, h);
}

function pits(g, x, y, w, h, n, a) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(0,0,0,${a + rnd() * 0.2})`;
    g.fillRect(x + 1 + rnd() * (w - 3), y + 1 + rnd() * (h - 3), 1 + rnd() * 1.6, 1 + rnd() * 1.6);
  }
}

function grime(g, n) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * 64;
    g.fillStyle = `rgba(8,5,4,${0.05 + rnd() * 0.13})`;
    g.fillRect(x, 0, 1.5 + rnd() * 3, 16 + rnd() * 48);
  }
}

// ---------------------------------------------------------------- walls
// Crisp Doom-style pixel art: integer rects + per-pixel dithering only.

function dither(g, x, y, w, h, color, density) {
  g.fillStyle = color;
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (rnd() < density) g.fillRect(xx, yy, 1, 1);
    }
  }
}

// STARTAN-style grey-green panelling with support beams and rivets
function drawPanel(g, variant) {
  g.fillStyle = "#8e9a88";
  g.fillRect(0, 0, 64, 64);
  dither(g, 0, 0, 64, 64, "#7e8a7a", 0.35);
  dither(g, 0, 0, 64, 64, "#9aa694", 0.2);
  g.fillStyle = "#5a645a";
  g.fillRect(0, 0, 64, 1);
  g.fillStyle = "#aab6a2";
  g.fillRect(0, 1, 64, 1);
  g.fillStyle = "#49524a";
  g.fillRect(0, 62, 64, 2);
  for (const sx of [0, 58]) {
    g.fillStyle = "#54584c";
    g.fillRect(sx, 0, 6, 64);
    g.fillStyle = "#6e7464";
    g.fillRect(sx + 1, 0, 1, 64);
    g.fillStyle = "#3a3e34";
    g.fillRect(sx + 5, 0, 1, 64);
    for (const ry of [5, 21, 37, 53]) {
      g.fillStyle = "#848a76";
      g.fillRect(sx + 2, ry, 2, 2);
      g.fillStyle = "#2e3228";
      g.fillRect(sx + 2, ry + 2, 2, 1);
    }
  }
  const inset = (x, y, w, h, grate) => {
    g.fillStyle = "#49524a";
    g.fillRect(x, y, w, h);
    g.fillStyle = "#343b35";
    g.fillRect(x, y, w, 1);
    g.fillRect(x, y, 1, h);
    g.fillStyle = "#9aa694";
    g.fillRect(x, y + h - 1, w, 1);
    g.fillRect(x + w - 1, y, 1, h);
    if (grate) {
      g.fillStyle = "#21261f";
      for (let yy = y + 2; yy < y + h - 2; yy += 3) g.fillRect(x + 2, yy, w - 4, 1);
    } else {
      dither(g, x + 1, y + 1, w - 2, h - 2, "#39413a", 0.3);
      dither(g, x + 1, y + 1, w - 2, h - 2, "#545e54", 0.2);
    }
  };
  if (variant) {
    inset(12, 6, 40, 14, true);
    inset(12, 26, 18, 28, false);
    inset(34, 26, 18, 28, false);
  } else {
    inset(10, 8, 20, 44, false);
    inset(34, 8, 20, 44, true);
  }
  dither(g, 6, 50, 52, 13, "#39413a", 0.22);
  dither(g, 6, 57, 52, 6, "#262b24", 0.2);
}

// chunky 16x8 pixel bricks
function drawBrickPix(g, variant) {
  g.fillStyle = "#241710";
  g.fillRect(0, 0, 64, 64);
  const shades = ["#8c3d28", "#94432c", "#7c3522", "#86402a", "#70301e"];
  for (let row = 0; row < 8; row++) {
    const off = (row % 2) * 8;
    for (let col = -1; col < 4; col++) {
      const x = col * 16 + off, y = row * 8;
      g.fillStyle = shades[(rnd() * shades.length) | 0];
      g.fillRect(x + 1, y + 1, 14, 6);
      g.fillStyle = "rgba(255,225,200,0.22)";
      g.fillRect(x + 1, y + 1, 14, 1);
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.fillRect(x + 1, y + 6, 14, 1);
      if (rnd() < 0.45) {
        g.fillStyle = "#561f10";
        g.fillRect(x + 2 + (rnd() * 11 | 0), y + 2 + (rnd() * 4 | 0), 2, 1);
      }
    }
  }
  if (variant) dither(g, 0, 28, 64, 36, "#170c06", 0.25);
  dither(g, 0, 0, 64, 64, "#000000", 0.06);
}

// computer bank: little screens with scanline text, vents, hazard base
function drawCompute(g) {
  g.fillStyle = "#252b30";
  g.fillRect(0, 0, 64, 64);
  dither(g, 0, 0, 64, 64, "#1b2024", 0.3);
  g.fillStyle = "#14181c";
  g.fillRect(0, 0, 64, 2);
  g.fillRect(0, 0, 2, 64);
  g.fillRect(62, 0, 2, 64);
  g.fillStyle = "#3a424a";
  g.fillRect(0, 2, 64, 1);
  const colors = ["#3fe06a", "#e0b03f", "#3f9ae0", "#c93a2a"];
  for (let sy = 0; sy < 2; sy++) {
    for (let sx = 0; sx < 3; sx++) {
      const x = 5 + sx * 19, y = 6 + sy * 16;
      g.fillStyle = "#070a0d";
      g.fillRect(x, y, 16, 12);
      g.fillStyle = "#3a424a";
      g.fillRect(x - 1, y - 1, 18, 1);
      g.fillRect(x - 1, y - 1, 1, 14);
      if (rnd() < 0.85) {
        g.fillStyle = colors[(rnd() * colors.length) | 0];
        for (let r = 0; r < 4; r++) {
          if (rnd() < 0.75) g.fillRect(x + 2, y + 2 + r * 2, 3 + (rnd() * 10 | 0), 1);
        }
      }
    }
  }
  // blinky status row
  for (let i = 0; i < 5; i++) {
    g.fillStyle = rnd() < 0.5 ? "#3fe06a" : "#1a3a22";
    g.fillRect(6 + i * 8, 38, 3, 2);
  }
  g.fillStyle = "#10141a";
  for (let i = 0; i < 2; i++) g.fillRect(40, 36 + i * 4, 18, 2);
  // hazard stripes
  for (let y = 50; y < 62; y++) {
    for (let x = 2; x < 62; x++) {
      g.fillStyle = (((x + y) >> 2) & 1) ? "#9c8420" : "#15151a";
      g.fillRect(x, y, 1, 1);
    }
  }
  g.fillStyle = "#0c0f12";
  g.fillRect(0, 62, 64, 2);
}

function drawSlimePix(g) {
  g.fillStyle = "#1c3014";
  g.fillRect(0, 0, 64, 64);
  dither(g, 0, 0, 64, 64, "#142408", 0.4);
  dither(g, 0, 0, 64, 64, "#2c4a1c", 0.3);
  for (let i = 0; i < 6; i++) {
    let x = (rnd() * 64) | 0;
    g.fillStyle = "#0e1c06";
    for (let y = 0; y < 64; y += 2) {
      x += (rnd() * 5 | 0) - 2;
      g.fillRect(((x % 64) + 64) % 64, y, 2, 3);
    }
  }
  for (let i = 0; i < 26; i++) {
    const x = (rnd() * 60) | 0, y = (rnd() * 60) | 0;
    g.fillStyle = "#4a7a28";
    g.fillRect(x, y, 3, 3);
    g.fillStyle = "#7ab83c";
    g.fillRect(x, y, 2, 2);
    g.fillStyle = "#b8e87a";
    g.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 7; i++) {
    const x = 2 + (rnd() * 58) | 0, l = 10 + (rnd() * 40) | 0;
    g.fillStyle = "#3c641e";
    g.fillRect(x, 0, 2, l);
    g.fillStyle = "#8cc848";
    g.fillRect(x, 0, 1, l);
    g.fillRect(x, l, 2, 2);
  }
}

const texPanel = makePixels(g => drawPanel(g, false));
const texPanelB = makePixels(g => drawPanel(g, true));
const texBrick = makePixels(g => drawBrickPix(g, false));
const texBrickB = makePixels(g => drawBrickPix(g, true));
const texTech = makePixels(drawCompute);
const texSlime = makePixels(drawSlimePix);

// chamfered grey tiles, like the classic hexagonal Doom floors
const texFloor = makePixels(g => {
  g.fillStyle = "#2e342e";
  g.fillRect(0, 0, 64, 64);
  const wRow = [6, 10, 12, 14, 14, 14, 14, 14, 14, 14, 14, 12, 10, 6];
  for (let ty = 0; ty < 4; ty++) {
    for (let tx = 0; tx < 4; tx++) {
      const base = 108 + (rnd() * 26 | 0);
      for (let r = 0; r < 14; r++) {
        const w = wRow[r];
        const v = base - r;
        g.fillStyle = `rgb(${v - 8},${v},${v - 10})`;
        g.fillRect(tx * 16 + 8 - w / 2, ty * 16 + 1 + r, w, 1);
      }
      g.fillStyle = "rgba(255,255,255,0.16)";
      g.fillRect(tx * 16 + 5, ty * 16 + 1, 6, 1);
    }
  }
  dither(g, 0, 0, 64, 64, "#1e231e", 0.1);
  dither(g, 0, 0, 64, 64, "#4d564d", 0.08);
});

// light panel grid overhead
const texCeil = makePixels(g => {
  g.fillStyle = "#6a726a";
  g.fillRect(0, 0, 64, 64);
  dither(g, 0, 0, 64, 64, "#5e665e", 0.35);
  dither(g, 0, 0, 64, 64, "#788078", 0.2);
  g.fillStyle = "#454c45";
  for (let i = 0; i < 64; i += 16) {
    g.fillRect(i, 0, 1, 64);
    g.fillRect(0, i, 64, 1);
  }
  g.fillStyle = "#383e38";
  for (let ty = 0; ty < 4; ty++) {
    for (let tx = 0; tx < 4; tx++) {
      g.fillRect(tx * 16 + 3, ty * 16 + 3, 2, 2);
      g.fillRect(tx * 16 + 11, ty * 16 + 11, 2, 2);
    }
  }
});

const texExitFloor = makePixels(g => {
  g.fillStyle = "#0a2410";
  g.fillRect(0, 0, 64, 64);
  const gr = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  gr.addColorStop(0, "rgba(55,224,101,0.4)");
  gr.addColorStop(1, "rgba(55,224,101,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = "#37e065";
  g.lineWidth = 3;
  g.strokeRect(5.5, 5.5, 53, 53);
  g.fillStyle = "#37e065";
  g.beginPath();
  g.moveTo(32, 14);
  g.lineTo(50, 36);
  g.lineTo(38, 36);
  g.lineTo(38, 50);
  g.lineTo(26, 50);
  g.lineTo(26, 36);
  g.lineTo(14, 36);
  g.closePath();
  g.fill();
  addNoise(g, 10);
});

// animated liquid floors: two frames each, the highlight bands shift between
// frames so the surface appears to roll
function drawLiquid(g, phase, deep, mid, lite, glint, bubbles) {
  g.fillStyle = deep;
  g.fillRect(0, 0, 64, 64);
  dither(g, 0, 0, 64, 64, mid, 0.3);
  for (let y = 0; y < 64; y += 4) {
    for (let x = 0; x < 64; x++) {
      const v = Math.sin((x / 64) * Math.PI * 4 + y * 0.6 + phase);
      if (v > 0.55) { g.fillStyle = mid; g.fillRect(x, y + ((v * 3) | 0) % 4, 1, 1); }
      if (v > 0.86) { g.fillStyle = lite; g.fillRect(x, y + ((v * 3) | 0) % 4, 1, 1); }
    }
  }
  for (let i = 0; i < 22; i++) {
    const x = (rnd() * 62) | 0, y = (rnd() * 62) | 0;
    g.fillStyle = rnd() < 0.3 ? glint : lite;
    g.fillRect(x, y, 1 + (rnd() * 2 | 0), 1);
  }
  if (bubbles) {
    for (let i = 0; i < 12; i++) {
      const x = (rnd() * 60) | 0, y = (rnd() * 60) | 0;
      g.fillStyle = lite;
      g.fillRect(x, y, 2, 2);
      g.fillStyle = glint;
      g.fillRect(x, y, 1, 1);
    }
  }
}
const texWater = makePixels(g => drawLiquid(g, 0, "#0b2136", "#164a66", "#2f7fa6", "#8ed2ea", false));
const texWater2 = makePixels(g => drawLiquid(g, 2.4, "#0b2136", "#164a66", "#2f7fa6", "#8ed2ea", false));
const texToxic = makePixels(g => drawLiquid(g, 0, "#12300a", "#2c5a10", "#55a018", "#c8f060", true));
const texToxic2 = makePixels(g => drawLiquid(g, 2.4, "#12300a", "#2c5a10", "#55a018", "#c8f060", true));

// stone steps descending toward the far edge, worn down the middle
const texStairs = makePixels(g => {
  for (let s = 0; s < 8; s++) {
    const v = 122 - s * 11;
    g.fillStyle = `rgb(${v - 6},${v},${v - 8})`;
    g.fillRect(0, s * 8, 64, 8);
    g.fillStyle = "rgba(255,255,255,0.25)";
    g.fillRect(0, s * 8, 64, 1);
    g.fillStyle = "rgba(0,0,0,0.45)";
    g.fillRect(0, s * 8 + 7, 64, 1);
  }
  dither(g, 0, 0, 64, 64, "#000000", 0.07);
  dither(g, 22, 0, 20, 64, "#5c5c52", 0.1);
});

// elevator platform: treadplate, hazard border, glowing down-chevrons
const texElevator = makePixels(g => {
  g.fillStyle = "#2a2e36";
  g.fillRect(0, 0, 64, 64);
  dither(g, 0, 0, 64, 64, "#232730", 0.3);
  g.fillStyle = "#3c424e";
  for (let y = 8; y < 58; y += 8) {
    for (let x = 8 + ((y >> 3) & 1) * 4; x < 58; x += 8) {
      g.fillRect(x, y, 3, 1);
      g.fillRect(x + 1, y - 1, 1, 3);
    }
  }
  for (let i = 0; i < 64; i++) {
    g.fillStyle = ((i >> 2) & 1) ? "#c8a018" : "#15151a";
    g.fillRect(i, 0, 1, 4);
    g.fillRect(i, 60, 1, 4);
    g.fillRect(0, i, 4, 1);
    g.fillRect(60, i, 4, 1);
  }
  g.fillStyle = "#e8c840";
  for (let k = 0; k < 2; k++) {
    const y = 20 + k * 14;
    g.beginPath();
    g.moveTo(20, y);
    g.lineTo(32, y + 10);
    g.lineTo(44, y);
    g.lineTo(44, y + 4);
    g.lineTo(32, y + 14);
    g.lineTo(20, y + 4);
    g.closePath();
    g.fill();
  }
  addNoise(g, 8);
});

const WALL_TEX = [null, texPanel, texBrick, texTech, texSlime];
const WALL_TEX_B = [null, texPanelB, texBrickB, null, null];

// ---------------------------------------------------------------- enemies
// The bestiary. Each creature is a parametric draw function taking
// (g, pal, pose) with pose = { step, attack, pain }. The style aims for
// grim rather than cute: flat banded shading instead of balloon
// gradients, sunken eye sockets with pinpoint glows, ragged asymmetric
// teeth, old wounds — plus a hash-mottle grit pass in buildSheet that
// roughs up every surface and darkens silhouette edges.

// deterministic per-pixel hash: stable across frames so surface grain
// doesn't shimmer while a monster animates
function hash2(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) ^ 0x5f356495;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// grit pass: mottles every opaque pixel and darkens hard silhouette
// edges so flesh reads as weathered hide instead of smooth plastic
function grit(g) {
  const id = g.getImageData(0, 0, TEXN, TEXN);
  const d = id.data;
  const A = (x, y) => (x < 0 || y < 0 || x > 63 || y > 63) ? 0 : d[(y * 64 + x) * 4 + 3];
  const edge = new Uint8Array(64 * 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      if (A(x, y) > 210 && (A(x - 1, y) < 128 || A(x + 1, y) < 128 || A(x, y - 1) < 128 || A(x, y + 1) < 128)) {
        edge[y * 64 + x] = 1;
      }
    }
  }
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4;
      if (d[i + 3] < 16) continue;
      const h = hash2(x, y);
      let m = 1;
      if (h < 0.14) m = 0.8;
      else if (h < 0.28) m = 0.9;
      else if (h > 0.94) m = 1.13;
      if (edge[y * 64 + x]) m *= 0.52;
      d[i] *= m;
      d[i + 1] *= m;
      d[i + 2] *= m;
    }
  }
  g.putImageData(id, 0, 0);
}

// hot pinpoint pupil
function glowEye(g, x, y, r, color) {
  const gr = g.createRadialGradient(x, y, 0.2, x, y, r * 2.6);
  gr.addColorStop(0, "#ffffff");
  gr.addColorStop(0.35, color);
  gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r * 2.6, 0, 7);
  g.fill();
}

// pair of eyes sunk in black sockets under a heavy angry brow
function socketEyes(g, cx, y, dx, color, r = 1.2, tilt = 0.3) {
  for (const s of [-1, 1]) {
    const x = cx + s * dx;
    g.fillStyle = "#070308";
    g.beginPath();
    g.ellipse(x, y, r + 1.9, r + 1.4, s * tilt, 0, 7);
    g.fill();
    glowEye(g, x + s * 0.4, y + 0.3, r, color);
    g.strokeStyle = "#070308";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(x + s * 3.2, y - 2.9);
    g.lineTo(x - s * 2.2, y - 1.2);
    g.stroke();
  }
}

// ragged uneven teeth: every fang gets its own height, lean and stain
function teeth(g, x, y, w, n, h, down = true) {
  const step = w / n;
  for (let i = 0; i < n; i++) {
    const fx = x + i * step;
    const hh = h * (0.55 + hash2(i * 17 + (x | 0), (y * 3) | 0) * 0.8);
    const lean = (hash2(i * 29, (x + y) | 0) - 0.5) * step * 0.9;
    g.fillStyle = hash2(i * 11, (y | 0) + i) < 0.3 ? "#b3a583" : "#e2d9c2";
    g.beginPath();
    g.moveTo(fx, y);
    g.lineTo(fx + step, y);
    g.lineTo(fx + step / 2 + lean, y + (down ? hh : -hh));
    g.closePath();
    g.fill();
  }
}

// strands of saliva hanging off a jaw
function drool(g, cx, y, w) {
  for (let i = 0; i < 3; i++) {
    const x = cx - w * 0.5 + hash2(i * 7, w | 0) * w;
    const len = 2.5 + hash2(i * 13, y | 0) * 5;
    g.strokeStyle = "rgba(196,206,178,0.8)";
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(x, y - 1);
    g.lineTo(x + 0.5, y + len);
    g.stroke();
    g.fillStyle = "rgba(208,216,188,0.85)";
    g.fillRect(x, y + len, 1.2, 1.2);
  }
}

// gaping mouth: black gullet, wet red throat, two rows of ragged fangs
function gapingMaw(g, cx, cy, rx, open, drooling) {
  g.fillStyle = "#0c0203";
  g.beginPath();
  g.ellipse(cx, cy, rx, open, 0, 0, 7);
  g.fill();
  g.fillStyle = "#560a10";
  g.beginPath();
  g.ellipse(cx, cy + open * 0.3, rx * 0.6, open * 0.55, 0, 0, 7);
  g.fill();
  g.fillStyle = "#8e1418";
  g.beginPath();
  g.ellipse(cx - rx * 0.15, cy + open * 0.4, rx * 0.32, open * 0.3, 0, 0, 7);
  g.fill();
  teeth(g, cx - rx + 0.5, cy - open + 1, rx * 2 - 1, Math.max(4, (rx * 0.6) | 0), Math.min(open * 0.85, rx * 0.9), true);
  teeth(g, cx - rx + 1.5, cy + open - 1, rx * 2 - 3, Math.max(3, (rx * 0.5) | 0), Math.min(open * 0.7, rx * 0.75), false);
  if (drooling) drool(g, cx, cy + open, rx);
}

// fan of curved talons out of a point
function claws(g, x, y, dir, n, len) {
  g.fillStyle = "#cfc4a6";
  for (let i = 0; i < n; i++) {
    const a = dir + (i - (n - 1) / 2) * 0.42;
    const tx = x + Math.cos(a) * len, ty = y + Math.sin(a) * len;
    const px = Math.cos(a + Math.PI / 2), py = Math.sin(a + Math.PI / 2);
    g.beginPath();
    g.moveTo(x - px * 1.3, y - py * 1.3);
    g.lineTo(x + px * 1.3, y + py * 1.3);
    g.quadraticCurveTo(x + Math.cos(a) * len * 0.6 + px * 2.2, y + Math.sin(a) * len * 0.6 + py * 2.2, tx, ty);
    g.closePath();
    g.fill();
  }
}

// raked claw scars: dark gashes with wet red centres
function gashes(g, x, y, len, ang, n = 3) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  for (let i = 0; i < n; i++) {
    const oy = i * 3.2 - (n - 1) * 1.6;
    g.strokeStyle = "#30060a";
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(-len / 2, oy);
    g.lineTo(len / 2, oy + 1);
    g.stroke();
    g.strokeStyle = "#a01818";
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(-len / 2 + 1, oy);
    g.lineTo(len / 2 - 1, oy + 0.8);
    g.stroke();
  }
  g.restore();
}

function bloodRun(g, x, y, len) {
  g.strokeStyle = "#6e0d10";
  g.lineWidth = 1.1;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + 0.6, y + len);
  g.stroke();
  g.fillStyle = "#8e1216";
  g.fillRect(x - 0.4, y + len - 1, 1.6, 2);
}

// one limb segment: dark under-layer, muscle fill, top highlight
function limb(g, pal, x0, y0, x1, y1, w) {
  g.lineCap = "round";
  g.strokeStyle = pal.dark;
  g.lineWidth = w + 2;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
  g.strokeStyle = pal.body;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
  g.strokeStyle = pal.lite;
  g.lineWidth = Math.max(0.9, w * 0.32);
  g.beginPath();
  g.moveTo(x0 - 0.8, y0 - 0.8);
  g.lineTo(x1 - 0.8, y1 - 0.8);
  g.stroke();
}

// curved keratin horn: a filled wedge tapering to a sharp pale tip
function horn(g, x0, y0, mx, my, tx, ty, w) {
  const nx = -(my - y0), ny = mx - x0;
  const nl = Math.hypot(nx, ny) || 1;
  const ox = (nx / nl) * w * 0.55, oy = (ny / nl) * w * 0.55;
  g.fillStyle = "#42311c";
  g.beginPath();
  g.moveTo(x0 - ox, y0 - oy);
  g.quadraticCurveTo(mx - ox, my - oy, tx, ty);
  g.quadraticCurveTo(mx + ox, my + oy, x0 + ox, y0 + oy);
  g.closePath();
  g.fill();
  g.fillStyle = "#8a7448";
  g.beginPath();
  g.moveTo(x0 - ox * 0.45, y0 - oy * 0.45);
  g.quadraticCurveTo(mx - ox * 0.45, my - oy * 0.45, tx, ty);
  g.quadraticCurveTo(mx + ox * 0.25, my + oy * 0.25, x0 + ox * 0.25, y0 + oy * 0.25);
  g.closePath();
  g.fill();
  g.fillStyle = "#d9cba4";
  g.beginPath();
  g.arc(tx, ty, Math.max(0.8, w * 0.22), 0, 7);
  g.fill();
}

// Groomp — hunched spined stalker with overlong clawed arms
function drawImp(g, pal, pose) {
  const cx = 32, step = pose.step ? 2.5 : -2.5;
  // digitigrade legs
  for (const s of [-1, 1]) {
    const k = s * step * 0.5;
    limb(g, pal, cx + s * 6, 40, cx + s * 11 + k, 48, 5);
    limb(g, pal, cx + s * 11 + k, 48, cx + s * 8 + k, 56, 3.6);
    limb(g, pal, cx + s * 8 + k, 56, cx + s * 12 + k, 60, 3);
    claws(g, cx + s * 12 + k, 60, Math.PI / 2 - s * 0.55, 2, 3.6);
  }
  // hunched torso
  g.fillStyle = pal.dark;
  g.beginPath(); g.ellipse(cx, 31, 12.5, 12, -0.12, 0, 7); g.fill();
  g.fillStyle = pal.body;
  g.beginPath(); g.ellipse(cx - 1, 30, 11, 10.5, -0.12, 0, 7); g.fill();
  g.fillStyle = pal.lite;
  g.beginPath(); g.ellipse(cx - 4, 26, 6, 4.6, -0.3, 0, 7); g.fill();
  // starved rib shadows
  g.strokeStyle = pal.dark;
  g.lineWidth = 1.1;
  for (let i = 0; i < 3; i++) {
    g.beginPath(); g.arc(cx - 1, 27 + i * 4, 7 - i, 0.5, Math.PI - 0.7); g.stroke();
  }
  // dorsal spine ridge cresting over the shoulders
  for (let i = 0; i < 5; i++) {
    const sx = cx - 10.8 + i * 5.4, sy = 22 - Math.sin((i / 4) * Math.PI) * 3.5;
    g.fillStyle = i % 2 ? "#b4a480" : "#cbbb94";
    g.beginPath();
    g.moveTo(sx - 1.7, sy + 3);
    g.lineTo(sx + 1.7, sy + 3);
    g.lineTo(sx + (i - 2) * 0.6, sy - 4);
    g.closePath();
    g.fill();
  }
  // arms — right one rears back with a fireball when attacking
  for (const s of [-1, 1]) {
    const raise = pose.attack && s > 0 ? -14 : 0;
    const ex = cx + s * 17, ey = 37 + raise * 0.55;
    const hx = cx + s * 21, hy = 33 + raise;
    limb(g, pal, cx + s * 9, 25, ex, ey, 4.4);
    limb(g, pal, ex, ey, hx, hy, 3.4);
    claws(g, hx, hy, (pose.attack && s > 0) ? -1.2 : Math.PI / 2 - s * 0.37, 3, 4.6);
    if (pose.attack && s > 0) {
      const fb = g.createRadialGradient(hx + 1, hy - 4, 0.5, hx + 1, hy - 4, 8);
      fb.addColorStop(0, "#fff8c0");
      fb.addColorStop(0.5, "#ff9020");
      fb.addColorStop(1, "rgba(255,60,0,0)");
      g.fillStyle = fb;
      g.beginPath(); g.arc(hx + 1, hy - 4, 8, 0, 7); g.fill();
    }
  }
  // head slung low between the shoulders
  const hy0 = 15;
  g.fillStyle = pal.dark;
  g.beginPath(); g.ellipse(cx, hy0, 9.5, 8.6, 0, 0, 7); g.fill();
  g.fillStyle = pal.body;
  g.beginPath(); g.ellipse(cx - 0.5, hy0 - 0.5, 8.4, 7.6, 0, 0, 7); g.fill();
  horn(g, cx - 5.5, hy0 - 5, cx - 9.5, hy0 - 10, cx - 11, hy0 - 15, 3);
  horn(g, cx + 5.5, hy0 - 5, cx + 9.5, hy0 - 10, cx + 11, hy0 - 15, 3);
  g.fillStyle = pal.dark;
  g.beginPath(); g.ellipse(cx, hy0 - 4, 6.8, 2, 0, 0, 7); g.fill();
  if (!pose.pain) socketEyes(g, cx, hy0 - 1.5, 3.9, "#ff7a10", 1.1);
  gapingMaw(g, cx, hy0 + 4.6, 5.5, pose.attack ? 3.8 : 2.7, true);
  // an old raking wound
  gashes(g, cx + 4.5, 30, 8, 0.5, 2);
  bloodRun(g, cx + 5.5, 33, 5);
}

// Spitter — bloated floating horror, one bloodshot eye, crown of spikes
function drawCacodemon(g, pal, pose) {
  const cy = 29, cx = 32 + (pose.step ? 2 : -2);
  g.fillStyle = pal.dark;
  g.beginPath(); g.arc(cx, cy, 22, 0, 7); g.fill();
  g.fillStyle = pal.body;
  g.beginPath(); g.arc(cx - 1, cy - 1.5, 20.4, 0, 7); g.fill();
  g.fillStyle = pal.lite;
  g.beginPath(); g.ellipse(cx - 7, cy - 11, 9, 5.6, -0.5, 0, 7); g.fill();
  // pocked, cratered hide
  for (let i = 0; i < 9; i++) {
    const a = hash2(i * 31, 5) * 6.28, r = 8 + hash2(i * 17, 9) * 11;
    g.fillStyle = "rgba(20,4,6,0.55)";
    g.beginPath();
    g.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8 - 2, 1.6 + hash2(i, 3) * 1.6, 1.1 + hash2(i, 7), 0, 0, 7);
    g.fill();
  }
  // keratin spikes across the crown
  for (let i = 0; i < 5; i++) {
    const a = -2.42 + i * 0.44;
    const bx = cx + Math.cos(a) * 19, by = cy + Math.sin(a) * 19;
    const tx = cx + Math.cos(a) * 27.5, ty = cy + Math.sin(a) * 27.5;
    g.fillStyle = i % 2 ? "#8d7f60" : "#a99a75";
    g.beginPath();
    g.moveTo(bx + Math.sin(a) * 2.2, by - Math.cos(a) * 2.2);
    g.lineTo(bx - Math.sin(a) * 2.2, by + Math.cos(a) * 2.2);
    g.lineTo(tx, ty);
    g.closePath();
    g.fill();
  }
  // vast maw
  const open = pose.attack ? 12 : 7;
  gapingMaw(g, cx, cy + 10, 15, open, true);
  if (pose.attack) {
    const fb = g.createRadialGradient(cx, cy + 12, 0.5, cx, cy + 12, 7);
    fb.addColorStop(0, "#ffe9c0");
    fb.addColorStop(0.5, "#ff5a10");
    fb.addColorStop(1, "rgba(200,30,0,0)");
    g.fillStyle = fb;
    g.beginPath(); g.arc(cx, cy + 12, 7, 0, 7); g.fill();
  }
  // the eye
  if (!pose.pain) {
    g.fillStyle = "#0d0406";
    g.beginPath(); g.ellipse(cx, cy - 5, 9.6, 8, 0, 0, 7); g.fill();
    g.fillStyle = "#d8cebc";
    g.beginPath(); g.ellipse(cx, cy - 5, 8, 6.4, 0, 0, 7); g.fill();
    g.strokeStyle = "#a02018";
    g.lineWidth = 0.8;
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + 0.25;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * 7.6, cy - 5 + Math.sin(a) * 6);
      g.lineTo(cx + Math.cos(a) * 3.4 + hash2(i, 2) - 0.5, cy - 5 + Math.sin(a) * 2.8);
      g.stroke();
    }
    g.fillStyle = "#c8a018";
    g.beginPath(); g.ellipse(cx, cy - 5, 3.9, 4.8, 0, 0, 7); g.fill();
    g.fillStyle = "#070204";
    g.beginPath(); g.ellipse(cx, cy - 5, 1.3, 4.4, 0, 0, 7); g.fill();
    // hooded lid
    g.fillStyle = pal.body;
    g.beginPath(); g.ellipse(cx, cy - 10.8, 8.4, 3, 0, 0, 7); g.fill();
    g.strokeStyle = "#1a0406";
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(cx - 8, cy - 8.4);
    g.quadraticCurveTo(cx, cy - 11.2, cx + 8, cy - 8.4);
    g.stroke();
  } else {
    g.strokeStyle = "#14040a";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx - 7, cy - 5.5);
    g.quadraticCurveTo(cx, cy - 3, cx + 7, cy - 5.5);
    g.stroke();
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(cx + i * 3, cy - 4.4 + Math.abs(i) * 0.4);
      g.lineTo(cx + i * 3.4, cy - 1);
      g.stroke();
    }
  }
  gashes(g, cx + 10, cy - 13, 9, -0.7, 2);
}

// Groompfather — hulking half-mechanical demon lord with a rocket arm
function drawCyberdemon(g, pal, pose) {
  const cx = 32, lean = pose.step ? 1.5 : -1.5;
  // flesh leg (left) ending in a cloven hoof
  limb(g, pal, cx - 8 + lean, 38, cx - 12 + lean, 50, 7);
  limb(g, pal, cx - 12 + lean, 50, cx - 9 + lean * 0.5, 59, 5);
  g.fillStyle = "#241a12";
  g.beginPath();
  g.moveTo(cx - 14 + lean * 0.5, 64);
  g.lineTo(cx - 9 + lean * 0.5, 56);
  g.lineTo(cx - 4 + lean * 0.5, 64);
  g.closePath();
  g.fill();
  g.strokeStyle = "#0c0806";
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(cx - 9 + lean * 0.5, 59); g.lineTo(cx - 9 + lean * 0.5, 64); g.stroke();
  // hydraulic metal leg (right), hip buried in the flesh
  g.fillStyle = "#38404c";
  g.fillRect(cx + 6 + lean, 42, 8, 8);
  g.fillStyle = "#5a6474";
  g.fillRect(cx + 6 + lean, 42, 8, 1.6);
  g.fillStyle = "#9aa4b4";
  g.fillRect(cx + 8.5 + lean, 49, 2, 6);
  g.fillStyle = "#2c323c";
  g.fillRect(cx + 5 + lean * 0.5, 54, 9, 7);
  g.fillStyle = "#454e5c";
  g.fillRect(cx + 5 + lean * 0.5, 54, 9, 1.4);
  g.fillStyle = "#181c24";
  g.fillRect(cx + 3 + lean * 0.5, 61, 13, 3);
  g.fillStyle = "#78828e";
  g.fillRect(cx + 7 + lean, 44.5, 1.4, 1.4);
  g.fillRect(cx + 11 + lean, 46.5, 1.4, 1.4);
  // torso
  g.fillStyle = pal.dark;
  g.beginPath(); g.ellipse(cx + lean, 30, 20, 16, 0, 0, 7); g.fill();
  g.fillStyle = pal.body;
  g.beginPath(); g.ellipse(cx + lean - 1, 29, 18, 14.4, 0, 0, 7); g.fill();
  g.fillStyle = pal.lite;
  g.beginPath(); g.ellipse(cx + lean - 7, 22.5, 8, 5, -0.4, 0, 7); g.fill();
  // musculature
  g.strokeStyle = pal.dark;
  g.lineWidth = 1.4;
  g.beginPath(); g.arc(cx + lean - 6, 25, 6, 0.3, Math.PI - 0.5); g.stroke();
  g.beginPath(); g.arc(cx + lean + 6, 25, 6, 0.45, Math.PI - 0.3); g.stroke();
  g.beginPath(); g.moveTo(cx + lean, 30); g.lineTo(cx + lean, 42); g.stroke();
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.moveTo(cx + lean - 5, 33 + i * 3.4);
    g.lineTo(cx + lean + 5, 33 + i * 3.4);
    g.stroke();
  }
  // metal graft bolted into the flank, flesh inflamed at the seam
  g.fillStyle = "#38404c";
  g.fillRect(cx + lean + 9, 30, 9, 8);
  g.fillStyle = "#5a6474";
  g.fillRect(cx + lean + 9, 30, 9, 1.4);
  g.fillStyle = "#78828e";
  g.fillRect(cx + lean + 10.5, 32.5, 1.4, 1.4);
  g.fillRect(cx + lean + 15.5, 35, 1.4, 1.4);
  g.strokeStyle = "#6e1014";
  g.lineWidth = 1;
  g.strokeRect(cx + lean + 8.5, 29.5, 10, 9);
  bloodRun(g, cx + lean + 11, 38, 4);
  // cabling out of the graft
  g.strokeStyle = "#20242c";
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(cx + lean + 13, 38);
  g.quadraticCurveTo(cx + lean + 18, 42, cx + lean + 14, 45);
  g.stroke();
  // left arm — huge, clawed
  {
    const ex = cx - 19 + lean, ey = 34;
    limb(g, pal, cx - 15 + lean, 24, ex, ey, 6.5);
    limb(g, pal, ex, ey, ex - 1, 42, 5);
    claws(g, ex - 1, 42, Math.PI / 2 + 0.3, 3, 5.5);
  }
  // rocket arm (right)
  g.fillStyle = "#2a303a";
  g.beginPath(); g.ellipse(cx + 16 + lean, 24, 6.5, 5.4, 0.15, 0, 7); g.fill();
  g.fillStyle = "#414a58";
  g.fillRect(cx + 13 + lean, 22, 16, 7);
  g.fillStyle = "#5c6678";
  g.fillRect(cx + 13 + lean, 22, 16, 1.6);
  g.fillStyle = "rgba(12,10,10,0.65)";
  g.beginPath(); g.arc(cx + 29 + lean, 25.5, 4.4, 0, 7); g.fill();
  g.fillStyle = "#161a22";
  g.fillRect(cx + 26 + lean, 21, 5, 9.4);
  g.fillStyle = "#05060a";
  g.beginPath(); g.arc(cx + 28.8 + lean, 25.5, 2.6, 0, 7); g.fill();
  if (pose.attack) {
    const mf = g.createRadialGradient(cx + 32 + lean, 25.5, 0.5, cx + 32 + lean, 25.5, 8);
    mf.addColorStop(0, "#fff8c0");
    mf.addColorStop(0.6, "#ff8020");
    mf.addColorStop(1, "rgba(255,60,0,0)");
    g.fillStyle = mf;
    g.beginPath(); g.arc(cx + 32 + lean, 25.5, 8, 0, 7); g.fill();
  }
  // head — small on the vast frame, crowned with bull horns
  g.fillStyle = pal.dark;
  g.beginPath(); g.ellipse(cx + lean, 12.5, 8.6, 8, 0, 0, 7); g.fill();
  g.fillStyle = pal.body;
  g.beginPath(); g.ellipse(cx + lean - 0.5, 12, 7.6, 7.2, 0, 0, 7); g.fill();
  horn(g, cx + lean - 6, 8.5, cx + lean - 14, 6, cx + lean - 16.5, 0.5, 3.8);
  horn(g, cx + lean + 6, 8.5, cx + lean + 14, 6, cx + lean + 16.5, 0.5, 3.8);
  g.fillStyle = pal.dark;
  g.beginPath(); g.ellipse(cx + lean, 9.5, 7, 2.6, 0, 0, 7); g.fill();
  if (!pose.pain) socketEyes(g, cx + lean, 12, 3.4, "#ff3010", 1.3);
  gapingMaw(g, cx + lean, 17.5, 4.8, pose.attack ? 3.2 : 2.4, false);
}

// Wraith — screaming skull wrapped in fire
function drawLostSoul(g, pal, pose) {
  const cx = 32 + (pose.step ? 2.5 : -2.5), cy = 28;
  // fire shroud
  const tongues = [
    [cx - 5, cy - 16, 7], [cx + 5, cy - 14, 6], [cx, cy - 18, 8],
    [cx - 11, cy - 4, 5.5], [cx + 11, cy - 4, 5.5], [cx - 7, cy + 12, 5], [cx + 6, cy + 13, 5.5],
  ];
  if (pose.attack) tongues.push([cx - 14, cy - 10, 6], [cx + 14, cy - 10, 6], [cx, cy - 24, 7]);
  for (const [fx, fy, fr] of tongues) {
    const fl = g.createRadialGradient(fx, fy, 0.5, fx, fy, fr * 1.7);
    fl.addColorStop(0, "#fff8a0");
    fl.addColorStop(0.4, "#ff7010");
    fl.addColorStop(1, "rgba(180,40,0,0)");
    g.fillStyle = fl;
    g.beginPath();
    g.ellipse(fx, fy, fr * 0.6, fr, (fx - cx) * 0.03, 0, 7);
    g.fill();
  }
  // skull
  const P = [
    [-12, -3], [-11.5, -9], [-6, -13.5], [0, -14.5], [6, -13.5], [11.5, -9], [12, -3],
    [11, 2], [8, 3.5], [8.5, 7.5], [5, 10.5], [-5, 10.5], [-8.5, 7.5], [-8, 3.5], [-11, 2],
  ];
  g.fillStyle = pal.dark;
  g.beginPath();
  for (let i = 0; i < P.length; i++) {
    const [px, py] = P[i];
    i ? g.lineTo(cx + px * 1.08, cy - 1 + py * 1.08) : g.moveTo(cx + px * 1.08, cy - 1 + py * 1.08);
  }
  g.closePath();
  g.fill();
  g.fillStyle = pal.body;
  g.beginPath();
  for (let i = 0; i < P.length; i++) {
    const [px, py] = P[i];
    i ? g.lineTo(cx + px, cy - 1 + py) : g.moveTo(cx + px, cy - 1 + py);
  }
  g.closePath();
  g.fill();
  g.fillStyle = pal.lite;
  g.beginPath(); g.ellipse(cx - 4, cy - 9, 6, 4, -0.4, 0, 7); g.fill();
  // temple hollows and cheekbones
  g.fillStyle = "rgba(40,30,14,0.5)";
  g.beginPath(); g.ellipse(cx - 9, cy + 3, 2.6, 3.4, 0.3, 0, 7); g.fill();
  g.beginPath(); g.ellipse(cx + 9, cy + 3, 2.6, 3.4, -0.3, 0, 7); g.fill();
  // cracked cranium
  g.strokeStyle = "#4e442e";
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(cx + 3, cy - 14);
  g.lineTo(cx + 5, cy - 10);
  g.lineTo(cx + 3, cy - 7);
  g.lineTo(cx + 6.5, cy - 5);
  g.stroke();
  // sockets
  g.fillStyle = "#060304";
  g.beginPath(); g.ellipse(cx - 5, cy - 2.5, 3.8, 4.4, 0.15, 0, 7); g.fill();
  g.beginPath(); g.ellipse(cx + 5, cy - 2.5, 3.8, 4.4, -0.15, 0, 7); g.fill();
  if (!pose.pain) {
    glowEye(g, cx - 4.6, cy - 2, 1.2, "#ff5010");
    glowEye(g, cx + 5.4, cy - 2, 1.2, "#ff5010");
  }
  // nasal cavity
  g.fillStyle = "#0a0605";
  g.beginPath();
  g.moveTo(cx - 1.8, cy + 5.5);
  g.lineTo(cx, cy + 1.5);
  g.lineTo(cx + 1.8, cy + 5.5);
  g.closePath();
  g.fill();
  // upper teeth in the maxilla
  g.fillStyle = "#e2d9c2";
  g.fillRect(cx - 5.5, cy + 8, 11, 3.6);
  g.strokeStyle = "#6a5c40";
  g.lineWidth = 0.8;
  for (let i = -2; i <= 2; i++) {
    g.beginPath(); g.moveTo(cx + i * 2.2, cy + 8); g.lineTo(cx + i * 2.2, cy + 11.6); g.stroke();
  }
  // unhinged jaw, hanging crooked
  const drop = pose.attack ? 7 : 4;
  g.fillStyle = pal.body;
  g.beginPath();
  g.moveTo(cx - 5.5, cy + 10 + drop);
  g.lineTo(cx + 6, cy + 10.5 + drop);
  g.lineTo(cx + 4.5, cy + 14 + drop);
  g.lineTo(cx - 4, cy + 13.5 + drop);
  g.closePath();
  g.fill();
  teeth(g, cx - 4.5, cy + 10.5 + drop, 9.5, 4, 2.4, false);
}

// Skitter — pulsing exposed brain riding jointed chitin legs
function drawArachnotron(g, pal, pose) {
  const cx = 32, cy = 42;
  // legs: two joints each, spiked at the knee
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) {
      const ph = ((i + (pose.step ? 1 : 0)) % 2) ? 3 : -2;
      const kx = cx + s * (12 + i * 3.4), ky = cy - 8 + ph;
      const fx = cx + s * (16 + i * 4.2), fy = 62;
      g.strokeStyle = "#10160e";
      g.lineWidth = 3.4;
      g.lineCap = "round";
      g.beginPath(); g.moveTo(cx + s * 7, cy); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
      g.strokeStyle = "#31402a";
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(cx + s * 7, cy); g.lineTo(kx, ky); g.stroke();
      g.strokeStyle = "#25301e";
      g.beginPath(); g.moveTo(kx, ky); g.lineTo(fx, fy); g.stroke();
      g.strokeStyle = "#5a7048";
      g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(cx + s * 7, cy - 1); g.lineTo(kx, ky - 1.2); g.stroke();
      // knee spike
      g.fillStyle = "#0e130c";
      g.beginPath();
      g.moveTo(kx - 1.6, ky);
      g.lineTo(kx + 1.6, ky);
      g.lineTo(kx, ky - 4);
      g.closePath();
      g.fill();
    }
  }
  // armored chassis
  g.fillStyle = pal.dark;
  g.beginPath(); g.ellipse(cx, cy, 14, 8, 0, 0, 7); g.fill();
  g.fillStyle = pal.body;
  g.beginPath(); g.ellipse(cx, cy - 1, 12.6, 6.6, 0, 0, 7); g.fill();
  g.strokeStyle = pal.lite;
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(cx - 10, cy - 3.5); g.lineTo(cx + 10, cy - 3.5); g.stroke();
  // vents
  g.fillStyle = "#0c100a";
  for (let i = -1; i <= 1; i++) g.fillRect(cx + i * 6 - 2, cy + 1, 4, 1.4);
  // plasma cannon slung under the chassis
  g.fillStyle = "#181c18";
  g.fillRect(cx - 2.6, cy + 5, 5.2, 10);
  g.fillStyle = "#2c342c";
  g.fillRect(cx - 2.6, cy + 5, 1.5, 10);
  g.fillStyle = "#080a08";
  g.beginPath(); g.ellipse(cx, cy + 15, 3, 2, 0, 0, 7); g.fill();
  if (pose.attack) {
    const pf = g.createRadialGradient(cx, cy + 18, 0.5, cx, cy + 18, 7.5);
    pf.addColorStop(0, "#e8ffd8");
    pf.addColorStop(0.5, "#30d830");
    pf.addColorStop(1, "rgba(0,160,0,0)");
    g.fillStyle = pf;
    g.beginPath(); g.arc(cx, cy + 18, 7.5, 0, 7); g.fill();
  }
  // the brain, naked and wet
  g.fillStyle = "#43201e";
  g.beginPath(); g.ellipse(cx, cy - 10, 11.6, 8.6, 0, Math.PI, 0); g.fill();
  g.fillStyle = "#8e5c56";
  g.beginPath(); g.ellipse(cx - 0.5, cy - 10.5, 10.4, 7.6, 0, Math.PI, 0); g.fill();
  g.fillStyle = "#b58078";
  g.beginPath(); g.ellipse(cx - 3.5, cy - 13, 5, 3.4, -0.3, 0, 7); g.fill();
  // sulci wrinkles
  g.strokeStyle = "#4e2a26";
  g.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const wx = cx - 8 + hash2(i * 7, 3) * 16, wy = cy - 16 + hash2(i * 3, 11) * 6;
    const a0 = hash2(i, 5) * 3;
    g.beginPath(); g.arc(wx, wy, 1.8 + hash2(i, 9) * 2, a0, a0 + 2.4); g.stroke();
  }
  // throbbing veins
  g.strokeStyle = "#c03028";
  g.lineWidth = 0.9;
  g.beginPath();
  g.moveTo(cx - 9, cy - 10);
  g.quadraticCurveTo(cx - 6, cy - 15, cx - 2, cy - 13);
  g.stroke();
  g.beginPath();
  g.moveTo(cx + 8, cy - 11);
  g.quadraticCurveTo(cx + 5, cy - 16, cx + 1, cy - 15);
  g.stroke();
  // ichor weeping where brain meets metal
  bloodRun(g, cx - 7, cy - 9, 3);
  bloodRun(g, cx + 6, cy - 9, 4);
  // eye cluster
  if (!pose.pain) {
    g.fillStyle = "#070308";
    for (const [ex, ey, er] of [[-5, -8, 1.8], [5, -8, 1.8], [-2, -5.5, 1.2], [2, -5.5, 1.2]]) {
      g.beginPath(); g.ellipse(cx + ex, cy + ey, er + 0.8, er + 0.6, 0, 0, 7); g.fill();
    }
    glowEye(g, cx - 5, cy - 8, 0.9, "#60e880");
    glowEye(g, cx + 5, cy - 8, 0.9, "#60e880");
    glowEye(g, cx - 2, cy - 5.5, 0.6, "#60e880");
    glowEye(g, cx + 2, cy - 5.5, 0.6, "#60e880");
  }
}

// Brute — towering goat-legged muscle demon
function drawBaron(g, pal, pose) {
  const cx = 32, lean = pose.step ? 1.5 : -1.5;
  // goat legs
  for (const s of [-1, 1]) {
    limb(g, pal, cx + s * 7, 40, cx + s * 11 + lean, 50, 6);
    limb(g, pal, cx + s * 11 + lean, 50, cx + s * 8 + lean * 0.5, 58, 4);
    // fur shag on the thigh
    g.strokeStyle = pal.dark;
    g.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(cx + s * (8 + i * 1.6), 44 + i * 2);
      g.lineTo(cx + s * (9 + i * 1.6), 48 + i * 2);
      g.stroke();
    }
    // cloven hoof
    g.fillStyle = "#171310";
    g.beginPath();
    g.moveTo(cx + s * 12 + lean * 0.5, 64);
    g.lineTo(cx + s * 8 + lean * 0.5, 56);
    g.lineTo(cx + s * 4 + lean * 0.5, 64);
    g.closePath();
    g.fill();
    g.strokeStyle = "#060404";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(cx + s * 8 + lean * 0.5, 59);
    g.lineTo(cx + s * 8 + lean * 0.5, 64);
    g.stroke();
  }
  // torso — pecs, abs, traps
  g.fillStyle = pal.dark;
  g.beginPath(); g.ellipse(cx + lean, 28, 17, 15, 0, 0, 7); g.fill();
  g.fillStyle = pal.body;
  g.beginPath(); g.ellipse(cx + lean - 1, 27, 15.4, 13.6, 0, 0, 7); g.fill();
  g.fillStyle = pal.lite;
  g.beginPath(); g.ellipse(cx + lean - 6, 21, 7, 4.6, -0.4, 0, 7); g.fill();
  g.strokeStyle = pal.dark;
  g.lineWidth = 1.4;
  g.beginPath(); g.arc(cx + lean - 5.5, 23, 5.5, 0.3, Math.PI - 0.5); g.stroke();
  g.beginPath(); g.arc(cx + lean + 5.5, 23, 5.5, 0.45, Math.PI - 0.3); g.stroke();
  g.beginPath(); g.moveTo(cx + lean, 28); g.lineTo(cx + lean, 39); g.stroke();
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.moveTo(cx + lean - 4.5, 31 + i * 3.2);
    g.lineTo(cx + lean + 4.5, 31 + i * 3.2);
    g.stroke();
  }
  // arms with bunched biceps and talons
  for (const s of [-1, 1]) {
    const rz = pose.attack ? -11 : 0;
    limb(g, pal, cx + s * 13 + lean, 20, cx + s * 20 + lean, 30 + rz * 0.5, 6);
    g.fillStyle = pal.body;
    g.beginPath(); g.ellipse(cx + s * 16 + lean, 23 + rz * 0.2, 4, 3.2, s * 0.5, 0, 7); g.fill();
    limb(g, pal, cx + s * 20 + lean, 30 + rz * 0.5, cx + s * 22 + lean, 37 + rz, 4.4);
    claws(g, cx + s * 22 + lean, 38 + rz, pose.attack ? -1.3 : Math.PI / 2 - s * 0.37, 3, 5);
    if (pose.attack) {
      const pg = g.createRadialGradient(cx + s * 22 + lean, 33 + rz, 1, cx + s * 22 + lean, 33 + rz, 9);
      pg.addColorStop(0, "#d8ffc8");
      pg.addColorStop(0.5, "#38d030");
      pg.addColorStop(1, "rgba(0,160,0,0)");
      g.fillStyle = pg;
      g.beginPath(); g.arc(cx + s * 22 + lean, 33 + rz, 9, 0, 7); g.fill();
    }
  }
  // head: heavy muzzle, ram horns
  g.fillStyle = pal.dark;
  g.beginPath(); g.ellipse(cx + lean, 11.5, 9.4, 8.8, 0, 0, 7); g.fill();
  g.fillStyle = pal.body;
  g.beginPath(); g.ellipse(cx + lean - 0.5, 11, 8.4, 8, 0, 0, 7); g.fill();
  horn(g, cx + lean - 7, 7, cx + lean - 12.5, 3.5, cx + lean - 15, 0.5, 3.4);
  horn(g, cx + lean + 7, 7, cx + lean + 12.5, 3.5, cx + lean + 15, 0.5, 3.4);
  g.fillStyle = pal.dark;
  g.beginPath(); g.ellipse(cx + lean, 8.8, 6, 1.7, 0, 0, 7); g.fill();
  if (!pose.pain) socketEyes(g, cx + lean, 11, 4, "#e8d838", 1.2);
  // snout ridge and nostrils
  g.fillStyle = pal.body;
  g.beginPath(); g.ellipse(cx + lean, 15.5, 5, 3.4, 0, 0, 7); g.fill();
  g.fillStyle = "#140a08";
  g.beginPath(); g.ellipse(cx + lean - 2, 14.5, 1, 1.4, 0.3, 0, 7); g.fill();
  g.beginPath(); g.ellipse(cx + lean + 2, 14.5, 1, 1.4, -0.3, 0, 7); g.fill();
  gapingMaw(g, cx + lean, 18.5, 5.2, pose.attack ? 3.4 : 2.5, true);
}

// Watcher — floating head that is mostly mouth, trailing tentacles
function drawPainElemental(g, pal, pose) {
  const cy = 26, cx = 32 + (pose.step ? 2.5 : -2.5);
  // tentacles first, dangling and drifting
  for (let i = 0; i < 4; i++) {
    const tx = cx - 9 + i * 6;
    const ph = (pose.step ? 1 : -1) * (i % 2 ? 2.5 : -2.5);
    g.strokeStyle = pal.dark;
    g.lineWidth = 2.8 - i * 0.15;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(tx, cy + 13);
    g.quadraticCurveTo(tx + ph, cy + 21, tx - ph, cy + 28);
    g.stroke();
  }
  // the head
  g.fillStyle = pal.dark;
  g.beginPath(); g.arc(cx, cy, 17.5, 0, 7); g.fill();
  g.fillStyle = pal.body;
  g.beginPath(); g.arc(cx - 0.5, cy - 1, 16, 0, 7); g.fill();
  g.fillStyle = pal.lite;
  g.beginPath(); g.ellipse(cx - 6, cy - 9, 6.6, 4.2, -0.5, 0, 7); g.fill();
  // cluster of crooked horns
  for (const [hx, hy, tx2, ty2, w] of [
    [cx - 9, cy - 12, cx - 14, cy - 20, 2.6],
    [cx + 9, cy - 12, cx + 15, cy - 19, 2.6],
    [cx + 2, cy - 15, cx + 5, cy - 23, 2],
  ]) {
    horn(g, hx, hy, (hx + tx2) / 2 + 2, (hy + ty2) / 2 - 2, tx2, ty2, w);
  }
  // pocks
  for (let i = 0; i < 6; i++) {
    const a = hash2(i * 13, 4) * 6.28, r = 7 + hash2(i * 7, 6) * 8;
    g.fillStyle = "rgba(18,6,3,0.5)";
    g.beginPath();
    g.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7 - 3, 1.4 + hash2(i, 8), 1, 0, 0, 7);
    g.fill();
  }
  // vertical maw splitting most of the face
  const open = pose.attack ? 12 : 8;
  gapingMaw(g, cx, cy + 5, 9, open, true);
  if (pose.attack) {
    // a skull crowning out of the gullet
    g.fillStyle = "#dfd6bc";
    g.beginPath(); g.arc(cx, cy + 7, 5, 0, 7); g.fill();
    g.fillStyle = "#0a0606";
    g.beginPath(); g.ellipse(cx - 2, cy + 6.5, 1.3, 1.6, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(cx + 2, cy + 6.5, 1.3, 1.6, 0, 0, 7); g.fill();
    glowEye(g, cx - 2, cy + 6.5, 0.7, "#ff5010");
    glowEye(g, cx + 2, cy + 6.5, 0.7, "#ff5010");
    g.fillStyle = "#0a0606";
    g.fillRect(cx - 2.4, cy + 10, 4.8, 1.2);
  }
  // three mismatched eyes above the maw
  if (!pose.pain) {
    socketEyes(g, cx, cy - 6.5, 5.5, "#ff3820", 1.3, 0.35);
    g.fillStyle = "#070308";
    g.beginPath(); g.ellipse(cx + 1.5, cy - 10.5, 2, 1.6, 0, 0, 7); g.fill();
    glowEye(g, cx + 1.5, cy - 10.5, 0.8, "#ff3820");
  }
}

// Hollow — creaking skeleton with scavenged missile pods
function drawRevenant(g, pal, pose) {
  const cx = 32, step = pose.step ? 2 : -2;
  const bone = pal.body, boneLite = pal.lite, boneDark = pal.dark;
  // legs: femur, knee knob, shin, toes
  g.lineCap = "round";
  for (const s of [-1, 1]) {
    const kx = cx + s * (6 + (s > 0 ? step : -step)), fx = cx + s * (8 + (s > 0 ? step : -step) * 0.5);
    g.strokeStyle = boneDark;
    g.lineWidth = 3.8;
    g.beginPath(); g.moveTo(cx + s * 4, 42); g.lineTo(kx, 52); g.lineTo(fx, 61); g.stroke();
    g.strokeStyle = bone;
    g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(cx + s * 4, 42); g.lineTo(kx, 52); g.lineTo(fx, 61); g.stroke();
    g.fillStyle = boneLite;
    g.beginPath(); g.arc(kx, 52, 2, 0, 7); g.fill();
    g.strokeStyle = bone;
    g.lineWidth = 1.6;
    for (let t = 0; t < 3; t++) {
      g.beginPath(); g.moveTo(fx, 61); g.lineTo(fx + s * (2 + t * 2), 63.5); g.stroke();
    }
  }
  // pelvis
  g.fillStyle = bone;
  g.beginPath(); g.ellipse(cx - 4, 41.5, 4, 3, 0.3, 0, 7); g.fill();
  g.beginPath(); g.ellipse(cx + 4, 41.5, 4, 3, -0.3, 0, 7); g.fill();
  g.fillStyle = boneDark;
  g.beginPath(); g.ellipse(cx, 42.5, 2, 2.4, 0, 0, 7); g.fill();
  // spine of separate vertebrae
  g.fillStyle = bone;
  for (let i = 0; i < 6; i++) g.fillRect(cx - 1.6, 20 + i * 3.4, 3.2, 2.2);
  // ribcage over a black cavity
  g.fillStyle = "rgba(8,6,8,0.85)";
  g.beginPath(); g.ellipse(cx, 28, 9, 9.5, 0, 0, 7); g.fill();
  for (let i = 0; i < 4; i++) {
    const ry = 22 + i * 4;
    g.strokeStyle = i % 2 ? bone : boneLite;
    g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(cx, ry); g.quadraticCurveTo(cx - 10, ry + 1, cx - 8.5, ry + 3.4); g.stroke();
    g.beginPath(); g.moveTo(cx, ry); g.quadraticCurveTo(cx + 10, ry + 1, cx + 8.5, ry + 3.4); g.stroke();
  }
  // one rib snapped off short
  g.strokeStyle = "#6e6248";
  g.lineWidth = 1.8;
  g.beginPath(); g.moveTo(cx, 34); g.quadraticCurveTo(cx - 5, 34.5, cx - 4, 35.5); g.stroke();
  // harness strap across the chest
  g.strokeStyle = "#2c2620";
  g.lineWidth = 2.6;
  g.beginPath(); g.moveTo(cx - 9, 20); g.lineTo(cx + 9, 36); g.stroke();
  // shoulder-mounted missile pods, scorched
  for (const s of [-1, 1]) {
    const podY = pose.attack ? 13 : 20;
    g.fillStyle = "#262b33";
    g.beginPath(); g.ellipse(cx + s * 15.5, podY, 6, 7.5, s * 0.2, 0, 7); g.fill();
    g.fillStyle = "#454e5c";
    g.fillRect(cx + s * 15.5 - 4, podY - 7.5, 8, 2.6);
    g.fillStyle = "rgba(8,6,6,0.7)";
    g.beginPath(); g.ellipse(cx + s * 15.5, podY - 5.5, 4, 2.2, 0, 0, 7); g.fill();
    for (let i = 0; i < 2; i++) {
      g.fillStyle = "#0c0f16";
      g.beginPath(); g.arc(cx + s * 14 + i * s * 3, podY - 5.6, 1.4, 0, 7); g.fill();
    }
    if (pose.attack) {
      const mf = g.createRadialGradient(cx + s * 15.5, podY - 10, 0.5, cx + s * 15.5, podY - 10, 8);
      mf.addColorStop(0, "#fff8c0");
      mf.addColorStop(0.5, "#ff8020");
      mf.addColorStop(1, "rgba(255,40,0,0)");
      g.fillStyle = mf;
      g.beginPath(); g.arc(cx + s * 15.5, podY - 10, 8, 0, 7); g.fill();
    }
  }
  // arms of bare bone, reaching
  for (const s of [-1, 1]) {
    const rz = pose.attack ? -6 : 0;
    g.strokeStyle = boneDark;
    g.lineWidth = 3.4;
    g.beginPath(); g.moveTo(cx + s * 8, 22); g.lineTo(cx + s * 16, 32 + rz); g.lineTo(cx + s * 15, 40 + rz); g.stroke();
    g.strokeStyle = bone;
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx + s * 8, 22); g.lineTo(cx + s * 16, 32 + rz); g.lineTo(cx + s * 15, 40 + rz); g.stroke();
    g.fillStyle = boneLite;
    g.beginPath(); g.arc(cx + s * 16, 32 + rz, 1.8, 0, 7); g.fill();
    g.strokeStyle = bone;
    g.lineWidth = 1.3;
    for (let i = -1; i <= 1; i++) {
      g.beginPath();
      g.moveTo(cx + s * 15, 40 + rz);
      g.lineTo(cx + s * (17.5 + i * 1.2), 44.5 + rz + Math.abs(i));
      g.stroke();
    }
  }
  // skull
  g.fillStyle = boneDark;
  g.beginPath(); g.arc(cx, 12, 8.2, 0, 7); g.fill();
  g.fillStyle = bone;
  g.beginPath(); g.arc(cx - 0.3, 11.7, 7.3, 0, 7); g.fill();
  g.fillStyle = boneLite;
  g.beginPath(); g.ellipse(cx - 2.5, 8.5, 3.6, 2.4, -0.3, 0, 7); g.fill();
  g.fillStyle = "rgba(40,30,14,0.45)";
  g.beginPath(); g.ellipse(cx - 5.5, 14, 1.6, 2, 0.3, 0, 7); g.fill();
  g.beginPath(); g.ellipse(cx + 5.5, 14, 1.6, 2, -0.3, 0, 7); g.fill();
  g.fillStyle = "#060304";
  g.beginPath(); g.ellipse(cx - 3, 11, 2.4, 3, 0.1, 0, 7); g.fill();
  g.beginPath(); g.ellipse(cx + 3, 11, 2.4, 3, -0.1, 0, 7); g.fill();
  if (!pose.pain) {
    glowEye(g, cx - 3, 11.3, 1, "#ff3820");
    glowEye(g, cx + 3, 11.3, 1, "#ff3820");
  }
  g.fillStyle = "#0a0605";
  g.beginPath();
  g.moveTo(cx - 1.2, 15.5); g.lineTo(cx, 13.2); g.lineTo(cx + 1.2, 15.5);
  g.closePath();
  g.fill();
  g.fillStyle = "#e2d9c2";
  g.fillRect(cx - 3.6, 16.5, 7.2, 2.4);
  g.strokeStyle = "#6a5c40";
  g.lineWidth = 0.7;
  for (let i = -1; i <= 1; i++) {
    g.beginPath(); g.moveTo(cx + i * 1.8, 16.5); g.lineTo(cx + i * 1.8, 18.9); g.stroke();
  }
}

// Maw — charging beast that is one huge blood-slick jaw
function drawPinky(g, pal, pose) {
  const cx = 32, step = pose.step ? 3 : -3;
  // hindquarters, lower than the shoulder hump
  g.fillStyle = pal.dark;
  g.beginPath(); g.ellipse(cx - 10, 42, 9, 8, 0.2, 0, 7); g.fill();
  g.fillStyle = pal.body;
  g.beginPath(); g.ellipse(cx - 10, 41, 7.6, 6.6, 0.2, 0, 7); g.fill();
  // legs
  for (const s of [-1, 1]) {
    const k = step * s * 0.4;
    limb(g, pal, cx + s * 10 + k, 42, cx + s * 12 + k, 52, 5.5);
    limb(g, pal, cx + s * 12 + k, 52, cx + s * 11 + k, 59, 4.4);
    claws(g, cx + s * 11 + k, 59.5, Math.PI / 2 - s * 0.4, 3, 4);
  }
  // shoulder hump with a ridge of spines
  g.fillStyle = pal.dark;
  g.beginPath(); g.ellipse(cx + 2, 36, 15, 11, -0.1, 0, 7); g.fill();
  g.fillStyle = pal.body;
  g.beginPath(); g.ellipse(cx + 1, 35, 13.6, 9.6, -0.1, 0, 7); g.fill();
  g.fillStyle = pal.lite;
  g.beginPath(); g.ellipse(cx - 3, 31, 7, 4, -0.3, 0, 7); g.fill();
  for (let i = 0; i < 4; i++) {
    const sx = cx - 8 + i * 5, sy = 27.5 - Math.sin((i / 3) * Math.PI) * 2;
    g.fillStyle = i % 2 ? "#8d7f60" : "#a99a75";
    g.beginPath();
    g.moveTo(sx - 1.6, sy + 3);
    g.lineTo(sx + 1.6, sy + 3);
    g.lineTo(sx + 0.4, sy - 3.4);
    g.closePath();
    g.fill();
  }
  gashes(g, cx - 8, 36, 7, 0.6, 2);
  // the head is nearly all jaw
  const headY = pose.attack ? 24 : 26;
  g.fillStyle = pal.dark;
  g.beginPath(); g.ellipse(cx + 2, headY, 14.5, 12, 0, 0, 7); g.fill();
  g.fillStyle = pal.body;
  g.beginPath(); g.ellipse(cx + 1.5, headY - 1, 13.2, 10.6, 0, 0, 7); g.fill();
  g.fillStyle = pal.lite;
  g.beginPath(); g.ellipse(cx - 2, headY - 6, 6.6, 3.6, -0.2, 0, 7); g.fill();
  // tiny eyes set wide and deep
  if (!pose.pain) socketEyes(g, cx + 2, headY - 6, 6.5, "#ff8020", 1, 0.45);
  // nostril slits
  g.fillStyle = "#160a08";
  g.beginPath(); g.ellipse(cx, headY - 2, 0.9, 1.3, 0.2, 0, 7); g.fill();
  g.beginPath(); g.ellipse(cx + 4, headY - 2, 0.9, 1.3, -0.2, 0, 7); g.fill();
  // gaping jaw with oversized fangs
  const open = pose.attack ? 9.5 : 6;
  gapingMaw(g, cx + 2, headY + 6.5, 11.5, open, true);
  // blood crusted around the lips
  g.fillStyle = "rgba(110,10,14,0.55)";
  g.beginPath(); g.ellipse(cx - 7, headY + 9, 2.6, 1.6, 0.4, 0, 7); g.fill();
  g.beginPath(); g.ellipse(cx + 11, headY + 8, 2.2, 1.4, -0.4, 0, 7); g.fill();
  bloodRun(g, cx + 11, headY + 9, 4);
}

// Husk — cadaverous pyromancer, all ribs and too-long fingers
function drawArchvile(g, pal, pose) {
  const cx = 32, step = pose.step ? 1.5 : -1.5;
  if (pose.attack) {
    for (const [fx, fy] of [[cx - 10, 12], [cx + 10, 10], [cx - 3, 5], [cx + 4, 7]]) {
      const fl = g.createRadialGradient(fx, fy, 0.5, fx, fy, 9);
      fl.addColorStop(0, "#ffffff");
      fl.addColorStop(0.4, "#80c8ff");
      fl.addColorStop(1, "rgba(40,80,255,0)");
      g.fillStyle = fl;
      g.beginPath(); g.ellipse(fx, fy, 5, 9, 0, 0, 7); g.fill();
    }
  }
  // stick legs with knee knobs, long bony feet
  for (const s of [-1, 1]) {
    const k = s > 0 ? -step : step;
    limb(g, pal, cx + s * 4, 42, cx + s * 5 + k, 52, 3.4);
    limb(g, pal, cx + s * 5 + k, 52, cx + s * 6 + k * 0.5, 60, 2.8);
    g.fillStyle = pal.body;
    g.beginPath(); g.arc(cx + s * 5 + k, 52, 1.8, 0, 7); g.fill();
    g.strokeStyle = pal.body;
    g.lineWidth = 1.4;
    for (let t = 0; t < 3; t++) {
      g.beginPath();
      g.moveTo(cx + s * 6 + k * 0.5, 60);
      g.lineTo(cx + s * (8 + t * 2) + k * 0.5, 63);
      g.stroke();
    }
  }
  // starved torso: every rib visible, hips jutting
  g.fillStyle = pal.dark;
  g.beginPath();
  g.moveTo(cx - 9, 16); g.lineTo(cx + 9, 16); g.lineTo(cx + 5.5, 43); g.lineTo(cx - 5.5, 43);
  g.closePath();
  g.fill();
  g.fillStyle = pal.body;
  g.beginPath();
  g.moveTo(cx - 8, 17); g.lineTo(cx + 8, 17); g.lineTo(cx + 4.8, 42); g.lineTo(cx - 4.8, 42);
  g.closePath();
  g.fill();
  g.fillStyle = pal.lite;
  g.beginPath(); g.ellipse(cx - 3, 20, 4, 2.6, -0.2, 0, 7); g.fill();
  g.strokeStyle = pal.dark;
  g.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) {
    const ry = 21 + i * 3.6;
    g.beginPath(); g.moveTo(cx, ry); g.quadraticCurveTo(cx - 7, ry + 0.6, cx - 6.5 + i * 0.5, ry + 2.4); g.stroke();
    g.beginPath(); g.moveTo(cx, ry); g.quadraticCurveTo(cx + 7, ry + 0.6, cx + 6.5 - i * 0.5, ry + 2.4); g.stroke();
  }
  // sunken gut shadow
  g.fillStyle = "rgba(20,14,8,0.5)";
  g.beginPath(); g.ellipse(cx, 38.5, 3.4, 2.6, 0, 0, 7); g.fill();
  // hip points
  g.fillStyle = pal.lite;
  g.beginPath(); g.ellipse(cx - 4.5, 42, 1.8, 1.2, 0.4, 0, 7); g.fill();
  g.beginPath(); g.ellipse(cx + 4.5, 42, 1.8, 1.2, -0.4, 0, 7); g.fill();
  // arms: raised to conjure, or hanging past the knees
  for (const s of [-1, 1]) {
    let ex, ey, hx, hy, fdir;
    if (pose.attack) {
      ex = cx + s * 15; ey = 12; hx = cx + s * 18; hy = 4; fdir = -Math.PI / 2 + s * 0.3;
    } else {
      ex = cx + s * 12; ey = 30; hx = cx + s * 13; hy = 42; fdir = Math.PI / 2 + s * 0.2;
    }
    limb(g, pal, cx + s * 7, 19, ex, ey, 3.2);
    limb(g, pal, ex, ey, hx, hy, 2.6);
    // fingers, far too long
    g.strokeStyle = pal.body;
    g.lineWidth = 1.1;
    for (let i = -1; i <= 1; i++) {
      const fa = fdir + i * 0.35;
      g.beginPath();
      g.moveTo(hx, hy);
      g.lineTo(hx + Math.cos(fa) * 6.5, hy + Math.sin(fa) * 6.5);
      g.stroke();
    }
  }
  // head: skin shrink-wrapped to the skull
  g.fillStyle = pal.dark;
  g.beginPath(); g.ellipse(cx, 9.5, 7.2, 8.2, 0, 0, 7); g.fill();
  g.fillStyle = pal.body;
  g.beginPath(); g.ellipse(cx - 0.3, 9, 6.3, 7.4, 0, 0, 7); g.fill();
  g.fillStyle = pal.lite;
  g.beginPath(); g.ellipse(cx - 2, 5.5, 3.4, 2.4, -0.3, 0, 7); g.fill();
  // hollow cheeks
  g.fillStyle = "rgba(24,18,10,0.55)";
  g.beginPath(); g.ellipse(cx - 4.2, 11.5, 1.8, 2.6, 0.25, 0, 7); g.fill();
  g.beginPath(); g.ellipse(cx + 4.2, 11.5, 1.8, 2.6, -0.25, 0, 7); g.fill();
  if (!pose.pain) socketEyes(g, cx, 7.5, 3.4, pose.attack ? "#e8f4ff" : "#5090d8", 0.8, 0.2);
  // nose slits
  g.fillStyle = "#181008";
  g.fillRect(cx - 1.2, 10.5, 0.9, 1.6);
  g.fillRect(cx + 0.4, 10.5, 0.9, 1.6);
  // lipless grimace, teeth bared
  g.fillStyle = "#e2d9c2";
  g.fillRect(cx - 3.4, 13.5, 6.8, 2.2);
  g.strokeStyle = "#3a2c1a";
  g.lineWidth = 0.7;
  g.beginPath(); g.moveTo(cx - 3.4, 14.6); g.lineTo(cx + 3.4, 14.6); g.stroke();
  for (let i = -2; i <= 2; i++) {
    g.beginPath(); g.moveTo(cx + i * 1.4, 13.5); g.lineTo(cx + i * 1.4, 15.7); g.stroke();
  }
}

// Shrieker — battle-torn hell knight, one horn snapped, always screaming
function drawHellKnight(g, pal, pose) {
  const cx = 32, lean = pose.step ? 1.5 : -1.5;
  for (const s of [-1, 1]) {
    limb(g, pal, cx + s * 7, 39, cx + s * 11 + lean, 49, 5.6);
    limb(g, pal, cx + s * 11 + lean, 49, cx + s * 8 + lean * 0.5, 57, 3.8);
    g.fillStyle = "#171310";
    g.beginPath();
    g.moveTo(cx + s * 12 + lean * 0.5, 64);
    g.lineTo(cx + s * 8 + lean * 0.5, 55);
    g.lineTo(cx + s * 4 + lean * 0.5, 64);
    g.closePath();
    g.fill();
  }
  // torso, raked with deep old wounds
  g.fillStyle = pal.dark;
  g.beginPath(); g.ellipse(cx + lean, 27, 16, 14.5, 0, 0, 7); g.fill();
  g.fillStyle = pal.body;
  g.beginPath(); g.ellipse(cx + lean - 1, 26, 14.4, 13, 0, 0, 7); g.fill();
  g.fillStyle = pal.lite;
  g.beginPath(); g.ellipse(cx + lean - 6, 20.5, 6.6, 4.2, -0.4, 0, 7); g.fill();
  g.strokeStyle = pal.dark;
  g.lineWidth = 1.3;
  g.beginPath(); g.arc(cx + lean - 5, 22.5, 5, 0.3, Math.PI - 0.5); g.stroke();
  g.beginPath(); g.arc(cx + lean + 5, 22.5, 5, 0.45, Math.PI - 0.3); g.stroke();
  gashes(g, cx + lean + 2, 28, 11, 0.55, 3);
  bloodRun(g, cx + lean + 4, 33, 6);
  // shackle and snapped chain on the left wrist
  for (const s of [-1, 1]) {
    const rz = pose.attack ? -10 : 0;
    limb(g, pal, cx + s * 12 + lean, 19, cx + s * 19 + lean, 29 + rz * 0.5, 5.4);
    limb(g, pal, cx + s * 19 + lean, 29 + rz * 0.5, cx + s * 21 + lean, 36 + rz, 4);
    claws(g, cx + s * 21 + lean, 37 + rz, pose.attack ? -1.3 : Math.PI / 2 - s * 0.37, 3, 4.6);
    if (s < 0) {
      g.strokeStyle = "#4a525c";
      g.lineWidth = 1.8;
      g.beginPath(); g.arc(cx + s * 20 + lean, 32.5 + rz, 2.4, 0, 7); g.stroke();
      g.strokeStyle = "#343a42";
      g.lineWidth = 1.3;
      for (let l = 0; l < 3; l++) {
        g.beginPath();
        g.arc(cx + s * 21.5 + lean, 36 + rz + l * 2.6, 1.2, 0, 7);
        g.stroke();
      }
    }
    if (pose.attack) {
      const pg = g.createRadialGradient(cx + s * 21 + lean, 32 + rz, 1, cx + s * 21 + lean, 32 + rz, 8.5);
      pg.addColorStop(0, "#ffd8a0");
      pg.addColorStop(0.5, "#c06018");
      pg.addColorStop(1, "rgba(120,50,0,0)");
      g.fillStyle = pg;
      g.beginPath(); g.arc(cx + s * 21 + lean, 32 + rz, 8.5, 0, 7); g.fill();
    }
  }
  // head thrown slightly back, shrieking
  g.fillStyle = pal.dark;
  g.beginPath(); g.ellipse(cx + lean, 11, 9, 8.4, 0, 0, 7); g.fill();
  g.fillStyle = pal.body;
  g.beginPath(); g.ellipse(cx + lean - 0.5, 10.5, 8, 7.6, 0, 0, 7); g.fill();
  // right horn snapped to a jagged stump
  horn(g, cx + lean - 7, 6.5, cx + lean - 12, 3, cx + lean - 14.5, 0.5, 3.2);
  g.fillStyle = "#a08d66";
  g.beginPath();
  g.moveTo(cx + lean + 5, 7);
  g.lineTo(cx + lean + 9, 4);
  g.lineTo(cx + lean + 10, 6.5);
  g.lineTo(cx + lean + 7, 8.5);
  g.closePath();
  g.fill();
  g.strokeStyle = "#3a2c18";
  g.lineWidth = 0.9;
  g.beginPath(); g.moveTo(cx + lean + 9, 4); g.lineTo(cx + lean + 10, 6.5); g.stroke();
  g.fillStyle = pal.dark;
  g.beginPath(); g.ellipse(cx + lean, 8.3, 5.8, 1.6, 0, 0, 7); g.fill();
  if (!pose.pain) socketEyes(g, cx + lean, 10.5, 3.8, "#ffa020", 1.2);
  // the shriek: jaw wrenched wide even at rest
  gapingMaw(g, cx + lean, 16.5, 5, pose.attack ? 4.6 : 3.6, true);
}

// Demon — mountain of rancid flesh with grafted flame cannons
function drawMancubus(g, pal, pose) {
  const cx = 32, lean = pose.step ? 1 : -1;
  // stub legs buried under the bulk
  for (const s of [-1, 1]) {
    limb(g, pal, cx + s * 10 + lean, 48, cx + s * 11 + lean, 57, 6.5);
    g.fillStyle = "#2a2620";
    g.fillRect(cx + s * 11 + lean - 5, 58, 10, 4);
    g.fillStyle = "#453e34";
    g.fillRect(cx + s * 11 + lean - 5, 58, 10, 1.2);
  }
  // the mass
  g.fillStyle = pal.dark;
  g.beginPath(); g.ellipse(cx + lean, 35, 20, 17.5, 0, 0, 7); g.fill();
  g.fillStyle = pal.body;
  g.beginPath(); g.ellipse(cx + lean - 1, 34, 18.4, 16, 0, 0, 7); g.fill();
  g.fillStyle = pal.lite;
  g.beginPath(); g.ellipse(cx + lean - 8, 26, 8, 5, -0.4, 0, 7); g.fill();
  // side rolls
  g.fillStyle = pal.body;
  g.beginPath(); g.ellipse(cx + lean - 16, 36, 5, 7, 0.3, 0, 7); g.fill();
  g.beginPath(); g.ellipse(cx + lean + 16, 36, 5, 7, -0.3, 0, 7); g.fill();
  // belly folds, each with a crease shadow and a sweaty highlight
  for (let i = 0; i < 3; i++) {
    const fy = 33 + i * 6, fr = 15 - i * 2.4;
    g.strokeStyle = pal.dark;
    g.lineWidth = 2;
    g.beginPath(); g.arc(cx + lean, fy, fr, 0.25, Math.PI - 0.25); g.stroke();
    g.strokeStyle = pal.lite;
    g.lineWidth = 0.9;
    g.beginPath(); g.arc(cx + lean, fy - 1.4, fr, 0.4, Math.PI - 0.4); g.stroke();
  }
  // crude stitched seam holding the gut together, weeping at the base
  g.strokeStyle = "#3a0c0e";
  g.lineWidth = 1.8;
  g.beginPath(); g.moveTo(cx + lean + 6, 26); g.lineTo(cx + lean + 8, 44); g.stroke();
  g.strokeStyle = "#1c1410";
  g.lineWidth = 1.1;
  for (let i = 0; i < 4; i++) {
    const sy = 28 + i * 4.4;
    g.beginPath();
    g.moveTo(cx + lean + 4, sy);
    g.lineTo(cx + lean + 10.5, sy + 2);
    g.stroke();
  }
  bloodRun(g, cx + lean + 8, 44, 5);
  // arm cannons bolted straight into the shoulders
  for (const s of [-1, 1]) {
    const rz = pose.attack ? -4 : 0;
    g.fillStyle = pal.dark;
    g.beginPath(); g.ellipse(cx + s * 18 + lean, 27 + rz, 6, 4.6, s * 0.3, 0, 7); g.fill();
    g.strokeStyle = "#7c1418";
    g.lineWidth = 1.6;
    g.beginPath(); g.ellipse(cx + s * 21 + lean, 26 + rz, 4.4, 4.2, 0, 0, 7); g.stroke();
    g.fillStyle = "#2c333d";
    g.fillRect(cx + s * 21 + lean - 4, 22 + rz, 8, 8.4);
    g.fillStyle = "#485261";
    g.fillRect(cx + s * 21 + lean - 4, 22 + rz, 8, 1.6);
    g.fillStyle = "#11141b";
    g.fillRect(cx + s * 26 + lean - (s < 0 ? 4 : 0), 21.5 + rz, 4, 9.4);
    g.fillStyle = "rgba(8,6,6,0.7)";
    g.beginPath(); g.arc(cx + s * 28 + lean, 26 + rz, 3.6, 0, 7); g.fill();
    g.fillStyle = "#04050a";
    g.beginPath(); g.arc(cx + s * 28 + lean, 26 + rz, 2.2, 0, 7); g.fill();
    // heat vents
    g.fillStyle = "#0c0f14";
    for (let i = 0; i < 2; i++) g.fillRect(cx + s * 21 + lean - 3, 24.5 + rz + i * 2.6, 6, 1);
    if (pose.attack) {
      const fb = g.createRadialGradient(cx + s * 33 + lean, 26 + rz, 0.5, cx + s * 33 + lean, 26 + rz, 10);
      fb.addColorStop(0, "#ffffff");
      fb.addColorStop(0.3, "#fff4a0");
      fb.addColorStop(0.6, "#ff8020");
      fb.addColorStop(1, "rgba(200,40,0,0)");
      g.fillStyle = fb;
      g.beginPath(); g.arc(cx + s * 33 + lean, 26 + rz, 10, 0, 7); g.fill();
    }
  }
  // tiny head swallowed by the shoulders
  g.fillStyle = pal.dark;
  g.beginPath(); g.ellipse(cx + lean, 15, 7.6, 6.8, 0, 0, 7); g.fill();
  g.fillStyle = pal.body;
  g.beginPath(); g.ellipse(cx + lean - 0.3, 14.5, 6.8, 6, 0, 0, 7); g.fill();
  // jowls
  g.fillStyle = pal.body;
  g.beginPath(); g.ellipse(cx + lean - 5, 18, 2.6, 2, 0.3, 0, 7); g.fill();
  g.beginPath(); g.ellipse(cx + lean + 5, 18, 2.6, 2, -0.3, 0, 7); g.fill();
  if (!pose.pain) socketEyes(g, cx + lean, 13.5, 3.2, "#e04020", 1, 0.4);
  // slack mouth with tusks jutting up from the lower jaw
  g.fillStyle = "#160808";
  g.beginPath(); g.ellipse(cx + lean, 18.5, 3.8, 1.8, 0, 0, 7); g.fill();
  g.fillStyle = "#d8cfb8";
  g.beginPath();
  g.moveTo(cx + lean - 4.4, 19.5); g.lineTo(cx + lean - 2.4, 19.5); g.lineTo(cx + lean - 3.6, 15.5);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(cx + lean + 2.4, 19.5); g.lineTo(cx + lean + 4.4, 19.5); g.lineTo(cx + lean + 3.6, 15.5);
  g.closePath();
  g.fill();
  drool(g, cx + lean, 20, 3.5);
}



// ----------------------------------------------------- corpses & sheets
// A death leaves a spreading pool of blood and picked-over remains,
// derived per-palette so the gore matches the creature that fell.

function drawPuddle(g, pal, s) {
  const cx = 32, bottom = 61;
  // spreading pool
  const pr = 14 + s * 12;
  g.fillStyle = "#38050a";
  g.beginPath(); g.ellipse(cx, bottom, pr, 3.2 + s * 2, 0, 0, 7); g.fill();
  g.fillStyle = "#5c0a0e";
  g.beginPath(); g.ellipse(cx - 3, bottom - 0.5, pr * 0.7, 2.2 + s * 1.4, 0, 0, 7); g.fill();
  g.fillStyle = "#8e1216";
  for (let i = 0; i < 5; i++) {
    g.fillRect(cx - pr * 0.6 + hash2(i * 7, 3) * pr * 1.2, bottom - 1 + hash2(i, 9) * 2, 2, 1);
  }
  if (s < 0.5) {
    // fresh kill: the carcass slumped and split open
    const h = 20 * (1 - s);
    g.fillStyle = pal.dark;
    g.beginPath(); g.ellipse(cx, bottom - h / 2 - 1, 15, h / 2 + 2, 0.08, 0, 7); g.fill();
    g.fillStyle = pal.body;
    g.beginPath(); g.ellipse(cx - 2, bottom - h / 2 - 2, 12, h / 2, 0.08, 0, 7); g.fill();
    g.fillStyle = "#4a080c";
    g.beginPath(); g.ellipse(cx + 2, bottom - h / 2 - 2, 6, h * 0.22 + 1, 0.3, 0, 7); g.fill();
    g.fillStyle = "#8e1216";
    g.beginPath(); g.ellipse(cx + 2, bottom - h / 2 - 2, 3.4, h * 0.13 + 0.8, 0.3, 0, 7); g.fill();
    // a limb flung out
    g.strokeStyle = pal.body;
    g.lineWidth = 3;
    g.lineCap = "round";
    g.beginPath(); g.moveTo(cx - 12, bottom - h / 2); g.lineTo(cx - 19, bottom - 2); g.stroke();
  } else {
    // remains: a cage of ribs, a rolled skull, scattered gibs
    g.fillStyle = pal.dark;
    g.beginPath(); g.ellipse(cx - 2, bottom - 3, 14, 4, 0, 0, 7); g.fill();
    g.fillStyle = pal.body;
    g.beginPath(); g.ellipse(cx - 4, bottom - 4, 9, 2.8, 0, 0, 7); g.fill();
    g.strokeStyle = "#cfc2a0";
    g.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.arc(cx - 7 + i * 4, bottom - 4, 5 - i * 0.6, Math.PI * 1.05, Math.PI * 1.95);
      g.stroke();
    }
    g.fillStyle = "#d5c9ac";
    g.beginPath(); g.arc(cx + 12, bottom - 5, 4.2, 0, 7); g.fill();
    g.fillRect(cx + 9.6, bottom - 3.5, 5.2, 3.2);
    g.fillStyle = "#100a08";
    g.fillRect(cx + 10, bottom - 6, 1.7, 2.1);
    g.fillRect(cx + 13, bottom - 6, 1.7, 2.1);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 ? "#7c1014" : pal.body;
      g.fillRect(cx - 16 + hash2(i * 5, 1) * 26, bottom - 3 + hash2(i, 4) * 3, 2.4, 1.6);
    }
    if (s >= 1) {
      g.strokeStyle = "#26030a";
      g.lineWidth = 1;
      g.beginPath(); g.ellipse(cx, bottom, pr, 3.2 + s * 2, 0, 0, 7); g.stroke();
    }
  }
}

function buildSheet(drawFn, pal) {
  const f = pose => makePixels(g => {
    drawFn(g, pal, pose);
    grit(g);
  });
  const pain = makePixels(g => {
    g.translate(34, 33);
    g.rotate(0.09);
    g.translate(-32, -32);
    drawFn(g, pal, { step: 0, pain: 1 });
    grit(g);
  });
  const flash = makePixels(g => {
    drawFn(g, pal, { step: 0, pain: 1 });
    grit(g);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.fillRect(0, 0, 64, 64);
  });
  return {
    walk: [f({ step: 0 }), f({ step: 1 })],
    attack: f({ step: 1, attack: 1 }),
    pain,
    flash,
    dead: [0.35, 0.7, 1].map(s => makePixels(g => {
      drawPuddle(g, pal, s);
      grit(g);
    })),
  };
}

const SPRITES = {
  groomp:   buildSheet(drawImp,           { body: "#63431f", lite: "#8f6a38", dark: "#241203" }),
  spitter:  buildSheet(drawCacodemon,     { body: "#8e1a14", lite: "#c04434", dark: "#42080a" }),
  boss:     buildSheet(drawCyberdemon,    { body: "#4a3020", lite: "#785640", dark: "#180c06" }),
  wraith:   buildSheet(drawLostSoul,      { body: "#cfc3a2", lite: "#efe6cc", dark: "#6e6248" }),
  skitter:  buildSheet(drawArachnotron,   { body: "#26301f", lite: "#4a5c3c", dark: "#0c120a" }),
  brute:    buildSheet(drawBaron,         { body: "#8a5644", lite: "#b57f62", dark: "#361410" }),
  watcher:  buildSheet(drawPainElemental, { body: "#6e3018", lite: "#a05a2c", dark: "#2a0e04" }),
  hollow:   buildSheet(drawRevenant,      { body: "#c4b892", lite: "#e6dcba", dark: "#6a5f42" }),
  maw:      buildSheet(drawPinky,         { body: "#a34043", lite: "#cd6f62", dark: "#4a1416" }),
  husk:     buildSheet(drawArchvile,      { body: "#9e9478", lite: "#c8bfa4", dark: "#463e2c" }),
  shrieker: buildSheet(drawHellKnight,    { body: "#54382a", lite: "#7e5c40", dark: "#1c0e06" }),
  demon:    buildSheet(drawMancubus,      { body: "#7e7254", lite: "#a89a72", dark: "#322c1c" }),
};

// ---------------------------------------------------------------- items

const SPR_HEALTH = makePixels(g => {
  block(g, 14, 30, 36, 22, "#cfcfd8");
  g.fillStyle = "#8a8a96";
  g.fillRect(14, 48, 36, 4);
  g.fillStyle = "#b8222a";
  g.fillRect(28, 33, 8, 16);
  g.fillRect(23, 37, 18, 8);
  g.fillStyle = "rgba(255,255,255,0.45)";
  g.fillRect(16, 31, 32, 2);
  g.fillStyle = "#55555f";
  g.fillRect(18, 30, 3, 22);
  g.fillRect(43, 30, 3, 22);
});

const SPR_AMMO = makePixels(g => {
  block(g, 14, 36, 36, 18, "#6e5e20");
  g.fillStyle = "#463c12";
  g.fillRect(14, 50, 36, 4);
  for (let i = 0; i < 4; i++) {
    const x = 18 + i * 8;
    g.fillStyle = "#c9a227";
    g.fillRect(x, 29, 7, 9);
    g.fillStyle = "rgba(255,255,210,0.5)";
    g.fillRect(x, 29, 2, 9);
    g.fillStyle = "#d8d8da";
    g.beginPath();
    g.moveTo(x, 29); g.lineTo(x + 7, 29); g.lineTo(x + 3.5, 25);
    g.closePath();
    g.fill();
  }
});

function orbSprite(c0, c1, c2) {
  return makePixels(g => {
    const r = g.createRadialGradient(32, 32, 2, 32, 32, 18);
    r.addColorStop(0, c0);
    r.addColorStop(0.35, c1);
    r.addColorStop(0.8, c2);
    r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r;
    g.beginPath();
    g.arc(32, 32, 18, 0, 7);
    g.fill();
  });
}
const SPR_ARMOR = makePixels(g => {
  // green combat vest
  g.fillStyle = "#16381e";
  g.fillRect(14, 26, 6, 13);
  g.fillRect(44, 26, 6, 13);
  g.fillRect(18, 24, 28, 6);
  g.fillStyle = "#1d4a26";
  g.fillRect(20, 28, 24, 24);
  g.fillStyle = "#2e6a3c";
  g.fillRect(22, 30, 9, 20);
  g.fillStyle = "#9adb86";
  g.fillRect(22, 30, 9, 2);
  g.fillStyle = "#0e2a14";
  g.fillRect(30, 28, 4, 24);
  g.fillRect(20, 48, 24, 4);
});

const SPR_SPIT = orbSprite("#ffffff", "#ff66ff", "#a316a3");
const SPR_FIRE = orbSprite("#fff3c0", "#ff9a20", "#b03000");
const SPR_PLASMA = orbSprite("#ffffff", "#7aff7a", "#0e8a2e");
const SPR_GBFG = makePixels(g => {
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 26);
  r.addColorStop(0, "#ffffff");
  r.addColorStop(0.3, "#b8ffb0");
  r.addColorStop(0.7, "#2ec24e");
  r.addColorStop(1, "rgba(10,80,20,0)");
  g.fillStyle = r;
  g.beginPath();
  g.arc(32, 32, 26, 0, 7);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.8)";
  g.lineWidth = 1.4;
  for (let i = 0; i < 5; i++) {
    const a = rnd() * 6.28;
    g.beginPath();
    g.moveTo(32 + Math.cos(a) * 6, 32 + Math.sin(a) * 6);
    g.lineTo(32 + Math.cos(a + 0.5) * 14, 32 + Math.sin(a + 0.5) * 14);
    g.lineTo(32 + Math.cos(a + 0.3) * 21, 32 + Math.sin(a + 0.3) * 21);
    g.stroke();
  }
});
const SPR_ROCKETP = makePixels(g => {
  // small rocket: gray body, flame tail
  const fl = g.createRadialGradient(32, 44, 1, 32, 44, 12);
  fl.addColorStop(0, "#ffe9a0");
  fl.addColorStop(0.5, "#ff8a20");
  fl.addColorStop(1, "rgba(200,60,0,0)");
  g.fillStyle = fl;
  g.beginPath();
  g.arc(32, 44, 12, 0, 7);
  g.fill();
  g.fillStyle = "#9aa2b2";
  g.fillRect(27, 22, 10, 20);
  g.fillStyle = "#c0392b";
  g.beginPath();
  g.moveTo(27, 22); g.lineTo(37, 22); g.lineTo(32, 12);
  g.closePath();
  g.fill();
});

// floor pickup icons for the arsenal (side views on a glow pad)
function weaponPickupSprite(draw) {
  return makePixels(g => {
    const glow = g.createRadialGradient(32, 50, 2, 32, 50, 20);
    glow.addColorStop(0, "rgba(63,224,106,0.5)");
    glow.addColorStop(1, "rgba(63,224,106,0)");
    g.fillStyle = glow;
    g.beginPath();
    g.ellipse(32, 50, 20, 7, 0, 0, 7);
    g.fill();
    draw(g);
  });
}
const SPR_WPICK = {
  3: weaponPickupSprite(g => { // shotgun
    g.fillStyle = "#23262e";
    g.fillRect(12, 38, 34, 5);
    g.fillStyle = "#5c4326";
    g.fillRect(42, 36, 12, 9);
    g.fillStyle = "#3a3f4c";
    g.fillRect(20, 43, 10, 5);
  }),
  4: weaponPickupSprite(g => { // chaingun
    g.fillStyle = "#23262e";
    for (let i = 0; i < 3; i++) g.fillRect(10, 34 + i * 4, 30, 2.6);
    g.fillStyle = "#3a3f4c";
    g.fillRect(38, 32, 14, 13);
    g.fillStyle = "#c9a227";
    g.fillRect(44, 45, 4, 6);
  }),
  5: weaponPickupSprite(g => { // rocket launcher
    g.fillStyle = "#2c3038";
    g.fillRect(10, 36, 42, 8);
    g.fillStyle = "#15171d";
    g.beginPath();
    g.ellipse(10, 40, 3, 5, 0, 0, 7);
    g.fill();
    g.fillStyle = "#c0392b";
    g.fillRect(46, 33, 6, 3);
  }),
  6: weaponPickupSprite(g => { // plasma rifle
    g.fillStyle = "#23262e";
    g.fillRect(12, 37, 36, 7);
    g.fillStyle = "#3fe06a";
    for (let i = 0; i < 3; i++) g.fillRect(16 + i * 8, 35, 4, 11);
    g.fillStyle = "#3a3f4c";
    g.fillRect(44, 35, 10, 11);
  }),
  7: weaponPickupSprite(g => { // the GBFG
    g.fillStyle = "#2c3038";
    g.fillRect(10, 33, 40, 13);
    g.fillStyle = "#1a4a22";
    g.fillRect(8, 35, 6, 9);
    for (let i = 0; i < 3; i++) {
      const og = g.createRadialGradient(20 + i * 10, 39, 0.5, 20 + i * 10, 39, 4);
      og.addColorStop(0, "#b8ffb0");
      og.addColorStop(1, "#1a7a2e");
      g.fillStyle = og;
      g.beginPath();
      g.arc(20 + i * 10, 39, 4, 0, 7);
      g.fill();
    }
  }),
};

// ------------------------------------------------------------ decorations

const SPR_LAMP = makePixels(g => {
  // glow halo
  const halo = g.createRadialGradient(32, 30, 3, 32, 30, 26);
  halo.addColorStop(0, "rgba(255,235,170,0.55)");
  halo.addColorStop(1, "rgba(255,210,120,0)");
  g.fillStyle = halo;
  g.fillRect(0, 0, 64, 64);
  // mount + chain
  g.fillStyle = "#1a1d24";
  g.fillRect(28, 0, 8, 4);
  g.strokeStyle = "#2c313e";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(32, 4);
  g.lineTo(32, 14);
  g.stroke();
  // shade
  const sh = g.createLinearGradient(14, 0, 50, 0);
  sh.addColorStop(0, "#171a21");
  sh.addColorStop(0.5, "#3a414f");
  sh.addColorStop(1, "#12141a");
  g.fillStyle = sh;
  g.beginPath();
  g.moveTo(22, 14);
  g.lineTo(42, 14);
  g.lineTo(50, 30);
  g.lineTo(14, 30);
  g.closePath();
  g.fill();
  // bulb
  const bulb = g.createRadialGradient(32, 33, 1, 32, 33, 8);
  bulb.addColorStop(0, "#fffbe8");
  bulb.addColorStop(0.6, "#ffd978");
  bulb.addColorStop(1, "rgba(255,200,90,0)");
  g.fillStyle = bulb;
  g.beginPath();
  g.arc(32, 33, 8, 0, 7);
  g.fill();
});

const SPR_BARREL = makePixels(g => {
  // body cylinder
  const body = g.createLinearGradient(16, 0, 48, 0);
  body.addColorStop(0, "#23301f");
  body.addColorStop(0.45, "#55704a");
  body.addColorStop(1, "#1a2418");
  g.fillStyle = body;
  g.fillRect(17, 18, 30, 40);
  g.beginPath();
  g.ellipse(32, 58, 15, 4, 0, 0, 7);
  g.fill();
  // ribs
  g.fillStyle = "rgba(0,0,0,0.4)";
  g.fillRect(17, 28, 30, 2.5);
  g.fillRect(17, 44, 30, 2.5);
  g.fillStyle = "rgba(255,255,255,0.12)";
  g.fillRect(17, 26.5, 30, 1.5);
  g.fillRect(17, 42.5, 30, 1.5);
  // toxic goo top
  g.fillStyle = "#1c2618";
  g.beginPath();
  g.ellipse(32, 18, 15, 4.5, 0, 0, 7);
  g.fill();
  const goo = g.createRadialGradient(30, 17, 1, 32, 18, 13);
  goo.addColorStop(0, "#b8ff7a");
  goo.addColorStop(0.6, "#4f9c2e");
  goo.addColorStop(1, "#27511a");
  g.fillStyle = goo;
  g.beginPath();
  g.ellipse(32, 18, 12, 3.4, 0, 0, 7);
  g.fill();
  // drips
  g.fillStyle = "rgba(110,200,70,0.8)";
  g.fillRect(22, 19, 2.4, 9);
  g.fillRect(40, 19, 2, 6);
  // hazard mark
  g.fillStyle = "#c9a227";
  g.beginPath();
  g.moveTo(32, 33);
  g.lineTo(38, 42);
  g.lineTo(26, 42);
  g.closePath();
  g.fill();
  g.fillStyle = "#15151a";
  g.font = "bold 8px monospace";
  g.textAlign = "center";
  g.fillText("!", 32, 41);
});

const SPR_SKULLS = makePixels(g => {
  const skull = (x, y, r) => {
    g.fillStyle = "#d3c9b4";
    g.beginPath();
    g.arc(x, y, r, 0, 7);
    g.fill();
    g.fillRect(x - r * 0.6, y, r * 1.2, r * 1.1);
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.beginPath();
    g.arc(x - r * 0.3, y - r * 0.35, r * 0.35, 0, 7);
    g.fill();
    g.fillStyle = "#1c160e";
    g.beginPath();
    g.arc(x - r * 0.38, y - r * 0.05, r * 0.26, 0, 7);
    g.arc(x + r * 0.38, y - r * 0.05, r * 0.26, 0, 7);
    g.fill();
    g.fillRect(x - r * 0.5, y + r * 0.62, r, r * 0.28);
  };
  // bone scatter
  g.strokeStyle = "#b8ad96";
  g.lineWidth = 2.5;
  for (const [x0, y0, x1, y1] of [[14, 56, 26, 52], [38, 58, 50, 54], [22, 60, 34, 60]]) {
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  }
  skull(24, 48, 7);
  skull(40, 50, 5.5);
  skull(32, 56, 6);
});

// explosion frames
function makeExplosion(t) {
  return makePixels(g => {
    const r = 10 + t * 22;
    const core = g.createRadialGradient(32, 36, 1, 32, 36, r);
    core.addColorStop(0, t < 0.5 ? "#fffbe0" : "#ffd070");
    core.addColorStop(0.45, "#ff9a2a");
    core.addColorStop(0.8, `rgba(200,60,10,${0.9 - t * 0.5})`);
    core.addColorStop(1, "rgba(80,20,5,0)");
    g.fillStyle = core;
    g.beginPath();
    g.arc(32, 36, r, 0, 7);
    g.fill();
    for (let i = 0; i < 10; i++) {
      const a = rnd() * 6.283, d = r * (0.5 + rnd() * 0.7);
      g.fillStyle = rnd() < 0.5 ? "#ffb13a" : "#3a2c20";
      g.fillRect(32 + Math.cos(a) * d, 36 + Math.sin(a) * d - t * 8, 2.5, 2.5);
    }
  });
}
const SPR_EXPLOSION = [makeExplosion(0.15), makeExplosion(0.5), makeExplosion(0.9)];

// particles
const PART_BLOOD = makePixels(g => {
  g.fillStyle = "#9c1408";
  g.beginPath();
  g.arc(32, 32, 22, 0, 7);
  g.fill();
  g.fillStyle = "#c92a14";
  g.beginPath();
  g.arc(28, 28, 12, 0, 7);
  g.fill();
});
const PART_SPARK = makePixels(g => {
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 24);
  r.addColorStop(0, "#fff4c0");
  r.addColorStop(0.5, "#ffa630");
  r.addColorStop(1, "rgba(255,120,20,0)");
  g.fillStyle = r;
  g.beginPath();
  g.arc(32, 32, 24, 0, 7);
  g.fill();
});
const PART_GOO = makePixels(g => {
  g.fillStyle = "#3aa32a";
  g.beginPath();
  g.arc(32, 32, 20, 0, 7);
  g.fill();
  g.fillStyle = "#7ed64f";
  g.beginPath();
  g.arc(27, 27, 9, 0, 7);
  g.fill();
});

// ---------------------------------------------------------------- weapons
// First-person guns pre-rendered at high resolution (3x logical, 512-720px)
// with layered cylindrical shading, specular detail, wear and real hands.

function gunCanvas(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w * 3;
  c.height = h * 3;
  const g = c.getContext("2d");
  g.scale(3, 3);
  draw(g);
  return c;
}

// multi-stop horizontal gradient for cylindrical metal
function cyl(g, x0, x1, tones) {
  const gr = g.createLinearGradient(x0, 0, x1, 0);
  for (let i = 0; i < tones.length; i++) gr.addColorStop(i / (tones.length - 1), tones[i]);
  return gr;
}

const STEEL_T = ["#0b0d11", "#2e3540", "#5d6878", "#8f9cae", "#aebccf", "#717e90", "#2a303a", "#090b0e"];
const BLUED_T = ["#080a0e", "#1d2330", "#3a465c", "#5d6c88", "#74849e", "#46536b", "#161b26", "#06080c"];
const OLIVE_T = ["#15180c", "#39411f", "#59652f", "#6e7c3c", "#7d8c46", "#525e2b", "#252a13", "#101307"];
const GUNMETAL_T = ["#0a0f0c", "#1e2a22", "#39493c", "#586b5c", "#6a7e6e", "#3c4c40", "#16201a", "#080c0a"];

function wear(g, x, y, w, h, n) {
  for (let i = 0; i < n; i++) {
    g.strokeStyle = rnd() < 0.5
      ? `rgba(225,235,245,${0.05 + rnd() * 0.09})`
      : `rgba(0,0,0,${0.08 + rnd() * 0.12})`;
    g.lineWidth = 0.5 + rnd() * 0.7;
    const sx = x + rnd() * w, sy = y + rnd() * h;
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(sx + (rnd() - 0.5) * 14, sy + (rnd() - 0.5) * 5);
    g.stroke();
  }
}

function screwHead(g, x, y, r) {
  const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
  gr.addColorStop(0, "#aab4c2");
  gr.addColorStop(0.6, "#566070");
  gr.addColorStop(1, "#181c24");
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, 7);
  g.fill();
  g.strokeStyle = "#0c0e12";
  g.lineWidth = r * 0.35;
  const a = rnd() * 3;
  g.beginPath();
  g.moveTo(x - Math.cos(a) * r * 0.65, y - Math.sin(a) * r * 0.65);
  g.lineTo(x + Math.cos(a) * r * 0.65, y + Math.sin(a) * r * 0.65);
  g.stroke();
}

// realistic tactical glove gripping toward the viewer
function tacticalHand(g, x, y, s, rot) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s, s);
  // cuff
  const cg = g.createLinearGradient(-6, 8, 18, 24);
  cg.addColorStop(0, "#2c2823");
  cg.addColorStop(1, "#181512");
  g.fillStyle = cg;
  g.beginPath();
  g.ellipse(8, 17, 17, 12, 0.2, 0, 7);
  g.fill();
  // palm
  const pg = g.createRadialGradient(-4, -4, 2, 0, 0, 22);
  pg.addColorStop(0, "#5d554c");
  pg.addColorStop(0.65, "#3d362f");
  pg.addColorStop(1, "#221d19");
  g.fillStyle = pg;
  g.beginPath();
  g.ellipse(0, 1, 16, 13, -0.3, 0, 7);
  g.fill();
  // fingers with knuckle creases
  for (let i = 0; i < 4; i++) {
    const fx = -13 + i * 7.6, fy = -7 - i * 1.1;
    const fg = g.createLinearGradient(fx, fy - 9, fx, fy + 9);
    fg.addColorStop(0, "#615950");
    fg.addColorStop(0.55, "#443d35");
    fg.addColorStop(1, "#262220");
    g.fillStyle = fg;
    g.beginPath();
    g.roundRect(fx, fy - 9, 6.6, 18, 3.3);
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.45)";
    g.lineWidth = 0.8;
    for (const cy2 of [fy - 3.5, fy + 1]) {
      g.beginPath();
      g.moveTo(fx + 0.8, cy2);
      g.lineTo(fx + 5.8, cy2);
      g.stroke();
    }
    g.fillStyle = "rgba(255,240,220,0.13)";
    g.fillRect(fx + 1, fy - 8, 1.7, 14);
  }
  // stitching
  g.strokeStyle = "rgba(195,185,165,0.3)";
  g.lineWidth = 0.6;
  g.setLineDash([1.6, 1.6]);
  g.beginPath();
  g.ellipse(0, 3, 12.5, 9, -0.3, 0, 7);
  g.stroke();
  g.setLineDash([]);
  g.restore();
}

const WEAPON_W = 190, WEAPON_H = 170;

const GUN_BLASTER = (() => {
  const c = gunCanvas(WEAPON_W, WEAPON_H, g => {
    const cx = 95;
    tacticalHand(g, cx - 42, 122, 1.15, -0.5);
    // tapered slide, polished steel
    g.fillStyle = cyl(g, cx - 30, cx + 30, STEEL_T);
    g.beginPath();
    g.moveTo(cx - 20, 18);
    g.lineTo(cx + 20, 18);
    g.lineTo(cx + 29, 118);
    g.lineTo(cx - 29, 118);
    g.closePath();
    g.fill();
    // top sight rib
    g.fillStyle = "rgba(0,0,0,0.28)";
    g.fillRect(cx - 4, 18, 8, 100);
    g.fillStyle = "rgba(255,255,255,0.1)";
    g.fillRect(cx - 5, 18, 1.5, 100);
    // ejection port
    g.fillStyle = "#0c0f14";
    g.beginPath();
    g.roundRect(cx + 8, 42, 15, 20, 3);
    g.fill();
    g.strokeStyle = "rgba(180,195,210,0.4)";
    g.lineWidth = 1;
    g.stroke();
    // slide serrations near the viewer
    for (let i = -4; i <= 4; i++) {
      g.fillStyle = "rgba(0,0,0,0.5)";
      g.fillRect(cx + i * 6 - 1, 96, 2.4, 18);
      g.fillStyle = "rgba(210,220,235,0.18)";
      g.fillRect(cx + i * 6 + 1.4, 96, 1, 18);
    }
    // muzzle: rim, bore, energy ring
    g.fillStyle = cyl(g, cx - 16, cx + 16, STEEL_T);
    g.beginPath();
    g.ellipse(cx, 17, 15, 5.5, 0, 0, 7);
    g.fill();
    g.fillStyle = "#04060a";
    g.beginPath();
    g.ellipse(cx, 16.5, 9.5, 3.4, 0, 0, 7);
    g.fill();
    g.strokeStyle = "rgba(63,224,106,0.9)";
    g.lineWidth = 1.4;
    g.beginPath();
    g.ellipse(cx, 16.5, 6.5, 2.2, 0, 0, 7);
    g.stroke();
    // front sight
    g.fillStyle = "#1a1e26";
    g.fillRect(cx - 2.4, 6, 4.8, 11);
    g.fillStyle = "#e8f4e8";
    g.beginPath();
    g.arc(cx, 9, 1.3, 0, 7);
    g.fill();
    // rear sight
    g.fillStyle = "#14181f";
    g.fillRect(cx - 15, 108, 30, 9);
    g.fillStyle = "#04060a";
    g.fillRect(cx - 4, 108, 8, 5);
    g.fillStyle = "#e8f4e8";
    g.beginPath();
    g.arc(cx - 9, 112, 1.2, 0, 7);
    g.arc(cx + 9, 112, 1.2, 0, 7);
    g.fill();
    screwHead(g, cx - 24, 72, 2.2);
    screwHead(g, cx + 24, 72, 2.2);
    // frame
    g.fillStyle = cyl(g, cx - 42, cx + 42, ["#0a0c10", "#252b35", "#444e60", "#5c687c", "#39414f", "#11141a"]);
    g.beginPath();
    g.moveTo(cx - 32, 118);
    g.lineTo(cx + 32, 118);
    g.lineTo(cx + 42, 170);
    g.lineTo(cx - 42, 170);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.12)";
    g.fillRect(cx - 32, 118, 64, 2);
    // energy cell window (live glow drawn by the game)
    g.fillStyle = "#05080a";
    g.beginPath();
    g.roundRect(cx - 31, 130, 24, 17, 3);
    g.fill();
    g.strokeStyle = "#5c687c";
    g.lineWidth = 1.6;
    g.stroke();
    // frame vents
    g.fillStyle = "#0a0d12";
    for (let i = 0; i < 3; i++) g.fillRect(cx + 12, 128 + i * 8, 22 + i * 2, 3.4);
    wear(g, cx - 28, 20, 56, 96, 26);
    tacticalHand(g, cx + 46, 152, 1.35, 0.45);
  });
  return { c, w: WEAPON_W, h: WEAPON_H, mx: 95, my: 14, cell: { x: 95 - 31, y: 130, w: 24, h: 17 } };
})();

const GUN_MALLET = (() => {
  const w = 150, h = 175;
  const c = gunCanvas(w, h, g => {
    const cx = 75;
    // forged steel head
    g.fillStyle = cyl(g, cx - 44, cx + 44, ["#16191f", "#3c4452", "#6a7688", "#959fb1", "#5d6878", "#23282f", "#0d0f13"]);
    g.beginPath();
    g.roundRect(cx - 44, 14, 88, 46, 4);
    g.fill();
    // bevels
    g.fillStyle = "rgba(235,242,250,0.25)";
    g.fillRect(cx - 42, 15, 84, 4);
    g.fillStyle = "rgba(0,0,0,0.4)";
    g.fillRect(cx - 42, 55, 84, 4);
    // forge mottling
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(${rnd() < 0.5 ? "0,0,0" : "200,210,225"},${0.05 + rnd() * 0.08})`;
      g.fillRect(cx - 42 + rnd() * 84, 18 + rnd() * 38, 1 + rnd() * 3, 1 + rnd() * 2);
    }
    // spikes, two-tone faces with glints
    for (const sx of [-30, 0, 30]) {
      g.fillStyle = "#7d8a9c";
      g.beginPath();
      g.moveTo(cx + sx - 8, 15);
      g.lineTo(cx + sx, -2);
      g.lineTo(cx + sx, 15);
      g.closePath();
      g.fill();
      g.fillStyle = "#39414e";
      g.beginPath();
      g.moveTo(cx + sx + 8, 15);
      g.lineTo(cx + sx, -2);
      g.lineTo(cx + sx, 15);
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.85)";
      g.fillRect(cx + sx - 0.8, 0, 1.6, 3);
    }
    // dried blood
    for (const [bx, by, br] of [[cx + 18, 38, 11], [cx - 24, 46, 7], [cx + 30, 52, 5]]) {
      const bg = g.createRadialGradient(bx, by, 1, bx, by, br);
      bg.addColorStop(0, "rgba(122,16,10,0.7)");
      bg.addColorStop(1, "rgba(60,8,5,0)");
      g.fillStyle = bg;
      g.beginPath();
      g.arc(bx, by, br, 0, 7);
      g.fill();
    }
    g.fillStyle = "rgba(100,12,8,0.65)";
    g.fillRect(cx + 24, 56, 3, 16);
    g.fillRect(cx + 14, 58, 2, 10);
    // steel collar
    g.fillStyle = cyl(g, cx - 11, cx + 11, STEEL_T);
    g.fillRect(cx - 11, 60, 22, 10);
    screwHead(g, cx - 5, 65, 2);
    screwHead(g, cx + 5, 65, 2);
    // hardwood handle with grain
    g.fillStyle = cyl(g, cx - 8, cx + 8, ["#2e1a0c", "#5a3517", "#7d4f24", "#8f5e2c", "#6e4119", "#33200e"]);
    g.fillRect(cx - 8, 70, 16, 105);
    g.strokeStyle = "rgba(46,22,8,0.5)";
    g.lineWidth = 0.8;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(cx - 6 + i * 3, 70);
      g.bezierCurveTo(cx - 7 + i * 3, 100, cx - 5 + i * 3, 130, cx - 6 + i * 3, 175);
      g.stroke();
    }
    // leather grip wrap
    for (let i = 0; i < 6; i++) {
      const y = 118 + i * 9;
      g.fillStyle = i % 2 ? "#241710" : "#2e1e14";
      g.beginPath();
      g.roundRect(cx - 10, y, 20, 9.6, 3);
      g.fill();
      g.fillStyle = "rgba(255,235,210,0.1)";
      g.fillRect(cx - 9, y + 1, 18, 1.4);
    }
    tacticalHand(g, cx + 4, 158, 1.3, 0.1);
  });
  return { c, w, h, mx: 75, my: 8 };
})();

const GUN_SHOTGUN = (() => {
  const w = 200, h = 170;
  const c = gunCanvas(w, h, g => {
    const cx = 100;
    // twin blued barrels
    for (const off of [-13, 13]) {
      g.fillStyle = cyl(g, cx + off - 13, cx + off + 13, BLUED_T);
      g.beginPath();
      g.moveTo(cx + off - 9, 22);
      g.lineTo(cx + off + 9, 22);
      g.lineTo(cx + off + 13, 94);
      g.lineTo(cx + off - 13, 94);
      g.closePath();
      g.fill();
    }
    // centre rib with vents
    g.fillStyle = "#11151d";
    g.fillRect(cx - 3, 24, 6, 70);
    g.fillStyle = "#04060a";
    for (let i = 0; i < 6; i++) g.fillRect(cx - 1.6, 30 + i * 10, 3.2, 5);
    // muzzles: rims, bores, inner reflection
    for (const off of [-13, 13]) {
      g.fillStyle = cyl(g, cx + off - 11, cx + off + 11, STEEL_T);
      g.beginPath();
      g.ellipse(cx + off, 21, 10.5, 4.6, 0, 0, 7);
      g.fill();
      g.fillStyle = "#03050a";
      g.beginPath();
      g.ellipse(cx + off, 21, 7, 3, 0, 0, 7);
      g.fill();
      g.strokeStyle = "rgba(160,180,205,0.5)";
      g.lineWidth = 0.9;
      g.beginPath();
      g.ellipse(cx + off - 1.4, 20.3, 4.4, 1.7, 0, Math.PI * 0.9, Math.PI * 1.8);
      g.stroke();
    }
    wear(g, cx - 24, 26, 48, 64, 18);
    // walnut fore-end with checkering
    g.fillStyle = cyl(g, cx - 30, cx + 30, ["#2a1709", "#5a3517", "#7d4f24", "#94622e", "#6e4119", "#301d0c"]);
    g.beginPath();
    g.roundRect(cx - 28, 94, 56, 30, 6);
    g.fill();
    g.strokeStyle = "rgba(42,20,8,0.55)";
    g.lineWidth = 0.8;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(cx - 26, 98 + i * 4.5);
      g.bezierCurveTo(cx - 8, 96 + i * 4.5, cx + 10, 100 + i * 4.5, cx + 26, 97 + i * 4.5);
      g.stroke();
    }
    // checkering panel
    g.save();
    g.beginPath();
    g.roundRect(cx - 18, 99, 36, 20, 4);
    g.clip();
    g.strokeStyle = "rgba(30,15,6,0.6)";
    g.lineWidth = 0.7;
    for (let i = -10; i < 10; i++) {
      g.beginPath();
      g.moveTo(cx - 20 + i * 4, 98);
      g.lineTo(cx - 8 + i * 4, 122);
      g.stroke();
      g.beginPath();
      g.moveTo(cx + 20 - i * 4, 98);
      g.lineTo(cx + 8 - i * 4, 122);
      g.stroke();
    }
    g.restore();
    // receiver, engraved
    g.fillStyle = cyl(g, cx - 40, cx + 40, BLUED_T);
    g.beginPath();
    g.moveTo(cx - 31, 124);
    g.lineTo(cx + 31, 124);
    g.lineTo(cx + 41, 170);
    g.lineTo(cx - 41, 170);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.14)";
    g.fillRect(cx - 31, 124, 62, 2);
    g.strokeStyle = "rgba(170,185,205,0.3)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(cx - 24, 136);
    g.bezierCurveTo(cx - 10, 130, cx + 10, 142, cx + 24, 134);
    g.stroke();
    // top lever + pins
    g.fillStyle = "#1a202a";
    g.fillRect(cx - 3, 126, 6, 16);
    screwHead(g, cx - 22, 152, 2.4);
    screwHead(g, cx + 22, 152, 2.4);
    tacticalHand(g, cx - 40, 108, 1.25, -0.4);
    tacticalHand(g, cx + 46, 154, 1.35, 0.45);
  });
  return { c, w, h, mx: 100, my: 20 };
})();

const GUN_CHAINGUN = (() => {
  const w = 210, h = 170;
  const c = gunCanvas(w, h, g => {
    const cx = 105;
    // outer shroud ring with cooling holes
    const ring = g.createRadialGradient(cx - 8, 28, 4, cx, 36, 42);
    ring.addColorStop(0, "#5d6878");
    ring.addColorStop(0.6, "#2e3540");
    ring.addColorStop(1, "#0b0d11");
    g.fillStyle = ring;
    g.beginPath();
    g.ellipse(cx, 38, 40, 30, 0, 0, 7);
    g.fill();
    g.strokeStyle = "rgba(200,212,228,0.25)";
    g.lineWidth = 1.4;
    g.beginPath();
    g.ellipse(cx, 38, 38, 28, 0, Math.PI * 0.95, Math.PI * 1.7);
    g.stroke();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + 0.4;
      g.fillStyle = "#05070a";
      g.beginPath();
      g.ellipse(cx + Math.cos(a) * 33, 38 + Math.sin(a) * 24, 2.6, 2, 0, 0, 7);
      g.fill();
    }
    // six barrels
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + 0.26;
      const bx = cx + Math.cos(a) * 20, by = 37 + Math.sin(a) * 14;
      const bg = g.createRadialGradient(bx - 3, by - 3, 1, bx, by, 10);
      bg.addColorStop(0, "#9aa6ba");
      bg.addColorStop(0.5, "#4c5666");
      bg.addColorStop(1, "#14181f");
      g.fillStyle = bg;
      g.beginPath();
      g.ellipse(bx, by, 9, 6.6, 0, 0, 7);
      g.fill();
      g.fillStyle = "#04060a";
      g.beginPath();
      g.ellipse(bx, by, 5.2, 3.6, 0, 0, 7);
      g.fill();
      g.strokeStyle = "rgba(170,185,205,0.4)";
      g.lineWidth = 0.8;
      g.beginPath();
      g.ellipse(bx - 1, by - 1, 3, 2, 0, Math.PI, Math.PI * 1.7);
      g.stroke();
    }
    // hub with hex bolt
    const hub = g.createRadialGradient(cx - 2, 35, 1, cx, 37, 9);
    hub.addColorStop(0, "#c2ccda");
    hub.addColorStop(0.6, "#5d6878");
    hub.addColorStop(1, "#1a1f27");
    g.fillStyle = hub;
    g.beginPath();
    g.ellipse(cx, 37, 8.5, 6, 0, 0, 7);
    g.fill();
    g.strokeStyle = "#0b0d11";
    g.lineWidth = 1.2;
    g.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = i * Math.PI / 3;
      const px = cx + Math.cos(a) * 4.6, py = 37 + Math.sin(a) * 3.3;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.stroke();
    // barrel cluster body sweeping down
    g.fillStyle = cyl(g, cx - 40, cx + 40, STEEL_T);
    g.beginPath();
    g.moveTo(cx - 36, 60);
    g.lineTo(cx + 36, 60);
    g.lineTo(cx + 42, 112);
    g.lineTo(cx - 42, 112);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(0,0,0,0.35)";
    for (let i = 0; i < 3; i++) g.fillRect(cx - 38, 68 + i * 14, 78, 4);
    wear(g, cx - 36, 62, 72, 48, 20);
    // housing
    g.fillStyle = cyl(g, cx - 50, cx + 50, ["#0a0c10", "#272d38", "#454f61", "#5d6878", "#39414f", "#10131a"]);
    g.fillRect(cx - 46, 112, 92, 58);
    g.fillStyle = "rgba(255,255,255,0.12)";
    g.fillRect(cx - 46, 112, 92, 2);
    screwHead(g, cx - 38, 122, 2.4);
    screwHead(g, cx + 38, 122, 2.4);
    screwHead(g, cx - 38, 160, 2.4);
    screwHead(g, cx + 38, 160, 2.4);
    // ammo feed chute with linked brass
    g.fillStyle = "#171b22";
    g.beginPath();
    g.roundRect(cx - 74, 120, 30, 46, 5);
    g.fill();
    for (let i = 0; i < 5; i++) {
      const y = 125 + i * 8.4;
      const bg = g.createLinearGradient(cx - 70, y, cx - 48, y);
      bg.addColorStop(0, "#6e5418");
      bg.addColorStop(0.4, "#caa53a");
      bg.addColorStop(0.7, "#e8cc6a");
      bg.addColorStop(1, "#8a6c20");
      g.fillStyle = bg;
      g.beginPath();
      g.roundRect(cx - 70, y, 22, 6, 3);
      g.fill();
      g.fillStyle = "#b46a32";
      g.beginPath();
      g.roundRect(cx - 70, y, 5, 6, 2.5);
      g.fill();
      g.fillStyle = "rgba(20,16,8,0.6)";
      g.fillRect(cx - 52, y + 1, 2, 4);
    }
    tacticalHand(g, cx + 50, 150, 1.35, 0.45);
  });
  return { c, w, h, mx: 105, my: 30 };
})();

const GUN_ROCKET = (() => {
  const w = 210, h = 170;
  const c = gunCanvas(w, h, g => {
    const cx = 105;
    // olive launch tube
    g.fillStyle = cyl(g, cx - 42, cx + 42, OLIVE_T);
    g.beginPath();
    g.moveTo(cx - 31, 32);
    g.lineTo(cx + 31, 32);
    g.lineTo(cx + 43, 124);
    g.lineTo(cx - 43, 124);
    g.closePath();
    g.fill();
    // weld seams
    for (const y of [56, 92]) {
      g.fillStyle = "rgba(220,228,200,0.18)";
      g.fillRect(cx - 38, y, 76, 1.6);
      g.fillStyle = "rgba(0,0,0,0.4)";
      g.fillRect(cx - 38, y + 1.6, 76, 1.6);
    }
    // stencil
    g.save();
    g.translate(cx - 14, 78);
    g.rotate(0.04);
    g.font = "bold 9px monospace";
    g.fillStyle = "rgba(228,232,214,0.55)";
    g.fillText("GRMP-5", 0, 0);
    g.font = "6px monospace";
    g.fillText("HE ROCKET", 0, 8);
    g.restore();
    // hazard decal
    g.fillStyle = "#b89a22";
    g.beginPath();
    g.moveTo(cx - 26, 106);
    g.lineTo(cx - 14, 106);
    g.lineTo(cx - 20, 95);
    g.closePath();
    g.fill();
    g.fillStyle = "#14130a";
    g.font = "bold 8px monospace";
    g.textAlign = "center";
    g.fillText("!", cx - 20, 104.5);
    g.textAlign = "left";
    wear(g, cx - 38, 36, 76, 84, 26);
    // muzzle: steel rim, loaded rocket
    g.fillStyle = cyl(g, cx - 34, cx + 34, STEEL_T);
    g.beginPath();
    g.ellipse(cx, 31, 32, 12.5, 0, 0, 7);
    g.fill();
    g.fillStyle = "#04050a";
    g.beginPath();
    g.ellipse(cx, 31, 26, 9.6, 0, 0, 7);
    g.fill();
    const nose = g.createRadialGradient(cx - 4, 27, 1, cx, 31, 14);
    nose.addColorStop(0, "#f0a08a");
    nose.addColorStop(0.4, "#c0392b");
    nose.addColorStop(1, "#5a1009");
    g.fillStyle = nose;
    g.beginPath();
    g.ellipse(cx, 31, 12, 5.6, 0, 0, 7);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.8)";
    g.beginPath();
    g.arc(cx - 4, 28.5, 1.4, 0, 7);
    g.fill();
    g.strokeStyle = "rgba(190,205,220,0.5)";
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(cx - 4, 28, 18, 6.5, 0, Math.PI * 0.95, Math.PI * 1.6);
    g.stroke();
    // optic with lens glint
    g.fillStyle = "#171b14";
    g.beginPath();
    g.roundRect(cx + 30, 46, 13, 34, 4);
    g.fill();
    const lens = g.createRadialGradient(cx + 35, 52, 0.5, cx + 36.5, 54, 5.5);
    lens.addColorStop(0, "#cdf6ff");
    lens.addColorStop(0.5, "#2e8aa0");
    lens.addColorStop(1, "#0a2a34");
    g.fillStyle = lens;
    g.beginPath();
    g.arc(cx + 36.5, 54, 5, 0, 7);
    g.fill();
    screwHead(g, cx + 36.5, 72, 2);
    // rivet rows
    for (let i = 0; i < 4; i++) {
      screwHead(g, cx - 34 + i * 2.4, 40 + i * 24, 1.6);
      screwHead(g, cx + 34 - i * 2.4, 40 + i * 24, 1.6);
    }
    // rear housing
    g.fillStyle = cyl(g, cx - 50, cx + 50, ["#101207", "#33391b", "#4d5827", "#5d6a30", "#3a4220", "#181b0d"]);
    g.fillRect(cx - 48, 124, 96, 46);
    g.fillStyle = "rgba(235,240,220,0.14)";
    g.fillRect(cx - 48, 124, 96, 2);
    tacticalHand(g, cx - 46, 140, 1.25, -0.4);
    tacticalHand(g, cx + 48, 154, 1.35, 0.45);
  });
  return { c, w, h, mx: 105, my: 26 };
})();

const GUN_PLASMA = (() => {
  const w = 200, h = 170;
  const c = gunCanvas(w, h, g => {
    const cx = 100;
    // gunmetal snout
    g.fillStyle = cyl(g, cx - 34, cx + 34, GUNMETAL_T);
    g.beginPath();
    g.moveTo(cx - 23, 28);
    g.lineTo(cx + 23, 28);
    g.lineTo(cx + 34, 104);
    g.lineTo(cx - 34, 104);
    g.closePath();
    g.fill();
    // emitter
    g.fillStyle = "#04080a";
    g.beginPath();
    g.ellipse(cx, 27, 21, 8.4, 0, 0, 7);
    g.fill();
    const em = g.createRadialGradient(cx, 27, 1, cx, 27, 16);
    em.addColorStop(0, "#eaffe4");
    em.addColorStop(0.4, "#54e07e");
    em.addColorStop(1, "rgba(18,110,44,0)");
    g.fillStyle = em;
    g.beginPath();
    g.ellipse(cx, 27, 15, 6, 0, 0, 7);
    g.fill();
    g.strokeStyle = "rgba(230,255,230,0.7)";
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(cx, 27, 18.5, 7.2, 0, 0, 7);
    g.stroke();
    // glowing coils with heat fins between
    for (let i = 0; i < 3; i++) {
      const y = 46 + i * 19;
      const wHalf = 25 + (y - 28) * 0.14;
      g.fillStyle = "#06090a";
      g.fillRect(cx - wHalf, y, wHalf * 2, 9);
      g.fillStyle = "rgba(40,200,90,0.3)";
      g.fillRect(cx - wHalf + 1, y + 1, wHalf * 2 - 2, 7);
      g.fillStyle = "rgba(98,240,140,0.75)";
      g.fillRect(cx - wHalf + 2, y + 2.6, wHalf * 2 - 4, 3.8);
      g.fillStyle = "#dcffd6";
      g.fillRect(cx - wHalf + 2, y + 4, wHalf * 2 - 4, 1.3);
      if (i < 2) {
        for (let f = 0; f < 16; f++) {
          const fx = cx - wHalf + 3 + f * (wHalf * 2 - 6) / 15;
          g.fillStyle = f % 2 ? "#131c16" : "#2c3a30";
          g.fillRect(fx, y + 9, 2, 10);
        }
      }
    }
    wear(g, cx - 28, 30, 56, 70, 16);
    // housing
    g.fillStyle = cyl(g, cx - 44, cx + 44, GUNMETAL_T);
    g.beginPath();
    g.moveTo(cx - 36, 104);
    g.lineTo(cx + 36, 104);
    g.lineTo(cx + 44, 170);
    g.lineTo(cx - 44, 170);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(230,245,230,0.12)";
    g.fillRect(cx - 36, 104, 72, 2);
    // status screen
    g.fillStyle = "#020604";
    g.beginPath();
    g.roundRect(cx - 32, 112, 26, 18, 3);
    g.fill();
    g.strokeStyle = "#39493c";
    g.lineWidth = 1.4;
    g.stroke();
    g.fillStyle = "#54e07e";
    for (let i = 0; i < 3; i++) g.fillRect(cx - 29, 116 + i * 4, 8 + (i * 7) % 14, 1.6);
    // cable run
    g.strokeStyle = "#0c120e";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(cx + 26, 110);
    g.bezierCurveTo(cx + 44, 120, cx + 30, 142, cx + 42, 156);
    g.stroke();
    g.strokeStyle = "#2c3a30";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(cx + 26, 110);
    g.bezierCurveTo(cx + 44, 120, cx + 30, 142, cx + 42, 156);
    g.stroke();
    screwHead(g, cx - 36, 140, 2.2);
    screwHead(g, cx + 10, 140, 2.2);
    tacticalHand(g, cx - 42, 120, 1.25, -0.4);
    tacticalHand(g, cx + 46, 156, 1.35, 0.45);
  });
  return { c, w, h, mx: 100, my: 22 };
})();

const GUN_GBFG = (() => {
  const w = 240, h = 170;
  const c = gunCanvas(w, h, g => {
    const cx = 120;
    // armored housing
    g.fillStyle = cyl(g, cx - 74, cx + 74, ["#05070a", "#142a1e", "#234433", "#2e5a42", "#1d3c2b", "#0a160e"]);
    g.beginPath();
    g.moveTo(cx - 52, 34);
    g.lineTo(cx + 52, 34);
    g.lineTo(cx + 72, 130);
    g.lineTo(cx - 72, 130);
    g.closePath();
    g.fill();
    // panel seams + screws
    for (const y of [62, 96]) {
      g.fillStyle = "rgba(0,0,0,0.45)";
      g.fillRect(cx - 60, y, 120, 2.4);
      g.fillStyle = "rgba(190,235,200,0.1)";
      g.fillRect(cx - 60, y + 2.4, 120, 1.2);
      screwHead(g, cx - 56, y + 8, 2.2);
      screwHead(g, cx + 56, y + 8, 2.2);
    }
    // glowing intake vents
    for (let i = 0; i < 4; i++) {
      const x = cx - 26 + i * 14;
      g.fillStyle = "#03130a";
      g.fillRect(x, 104, 9, 18);
      g.fillStyle = "rgba(82,224,122,0.6)";
      g.fillRect(x + 2, 106, 5, 14);
      g.fillStyle = "rgba(220,255,225,0.7)";
      g.fillRect(x + 3.4, 106, 2, 14);
    }
    wear(g, cx - 56, 38, 112, 80, 28);
    // triple emitter orbs with fresnel rims and under-glow
    for (const [ox, oy, r] of [[-32, 44, 14], [32, 44, 14], [0, 28, 18]]) {
      const glow = g.createRadialGradient(cx + ox, oy + r, r * 0.4, cx + ox, oy + r, r * 2.4);
      glow.addColorStop(0, "rgba(70,220,115,0.35)");
      glow.addColorStop(1, "rgba(20,120,50,0)");
      g.fillStyle = glow;
      g.beginPath();
      g.arc(cx + ox, oy + r, r * 2.4, 0, 7);
      g.fill();
      g.fillStyle = "#03150a";
      g.beginPath();
      g.arc(cx + ox, oy, r + 3.4, 0, 7);
      g.fill();
      const orb = g.createRadialGradient(cx + ox - r * 0.35, oy - r * 0.4, r * 0.1, cx + ox, oy, r);
      orb.addColorStop(0, "#ffffff");
      orb.addColorStop(0.25, "#bdffc8");
      orb.addColorStop(0.55, "#39d465");
      orb.addColorStop(0.85, "#0d4a22");
      orb.addColorStop(1, "#06140c");
      g.fillStyle = orb;
      g.beginPath();
      g.arc(cx + ox, oy, r, 0, 7);
      g.fill();
      g.strokeStyle = "rgba(235,255,240,0.5)";
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(cx + ox, oy, r - 1.2, Math.PI * 1.05, Math.PI * 1.6);
      g.stroke();
      g.fillStyle = "rgba(255,255,255,0.95)";
      g.beginPath();
      g.arc(cx + ox - r * 0.3, oy - r * 0.35, r * 0.14, 0, 7);
      g.fill();
    }
    // heavy cables with clamps
    for (const s of [-1, 1]) {
      g.strokeStyle = "#0a120c";
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(cx + s * 46, 64);
      g.bezierCurveTo(cx + s * 74, 86, cx + s * 56, 112, cx + s * 66, 136);
      g.stroke();
      g.strokeStyle = "#2c4a34";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx + s * 46, 64);
      g.bezierCurveTo(cx + s * 74, 86, cx + s * 56, 112, cx + s * 66, 136);
      g.stroke();
      g.fillStyle = "#39414e";
      g.fillRect(cx + s * 62 - 4, 88, 8, 6);
      g.fillRect(cx + s * 58 - 4, 116, 8, 6);
    }
    // base block
    g.fillStyle = cyl(g, cx - 80, cx + 80, ["#04060a", "#101e16", "#1d3424", "#16281c", "#070d09"]);
    g.fillRect(cx - 78, 130, 156, 40);
    g.fillStyle = "rgba(190,235,200,0.1)";
    g.fillRect(cx - 78, 130, 156, 2);
    tacticalHand(g, cx - 64, 148, 1.3, -0.35);
    tacticalHand(g, cx + 66, 152, 1.4, 0.4);
  });
  return { c, w, h, mx: 120, my: 14 };
})();

const GUNS = {
  1: GUN_MALLET,
  2: GUN_BLASTER,
  3: GUN_SHOTGUN,
  4: GUN_CHAINGUN,
  5: GUN_ROCKET,
  6: GUN_PLASMA,
  7: GUN_GBFG,
};

// -------------------------------------------------------------- HUD bar
// Pre-rendered Doom-style status bar plate (640x64 logical, drawn at 2x):
// brushed metal, bevelled edges, recessed instrument panels, screws and
// hazard-stripe end caps. Live numbers/face are drawn over it by the game.

// Classic Doom layout: AMMO | HEALTH | ARMS | face | ARMOR | ammo table
const HUD_PANELS = {
  ammo:   { x: 8,   y: 8, w: 90,  h: 48, cx: 53 },
  health: { x: 102, y: 8, w: 90,  h: 48, cx: 147 },
  arms:   { x: 196, y: 8, w: 91,  h: 48, cx: 241 },
  face:   { x: 291, y: 5, w: 58,  h: 54, cx: 320 },
  armor:  { x: 353, y: 8, w: 90,  h: 48, cx: 398 },
  table:  { x: 447, y: 8, w: 185, h: 48, cx: 539 },
};

const HUD_CANVAS = (() => {
  const c = document.createElement("canvas");
  c.width = 640 * 2;
  c.height = 64 * 2;
  const g = c.getContext("2d");
  g.scale(2, 2);

  // base metal plate
  const base = g.createLinearGradient(0, 0, 0, 64);
  base.addColorStop(0, "#383c45");
  base.addColorStop(0.14, "#2b2e36");
  base.addColorStop(1, "#15171c");
  g.fillStyle = base;
  g.fillRect(0, 0, 640, 64);

  // brushed-metal scratches
  for (let i = 0; i < 260; i++) {
    const y = 3 + rnd() * 58;
    g.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.06)";
    g.fillRect(rnd() * 640, y, 10 + rnd() * 50, 1);
  }
  // dents
  for (let i = 0; i < 14; i++) {
    g.fillStyle = "rgba(0,0,0,0.12)";
    g.beginPath();
    g.arc(rnd() * 640, 6 + rnd() * 52, 1 + rnd() * 2, 0, 7);
    g.fill();
  }

  // top ridge + bottom shadow
  g.fillStyle = "rgba(255,255,255,0.2)";
  g.fillRect(0, 0, 640, 2);
  g.fillStyle = "rgba(0,0,0,0.55)";
  g.fillRect(0, 2, 640, 1.5);
  g.fillRect(0, 61, 640, 3);

  // recessed instrument panels
  const inset = (x, y, w, h) => {
    g.fillStyle = "rgba(0,0,0,0.5)";
    g.fillRect(x - 2, y - 2, w + 4, h + 4);
    const f = g.createLinearGradient(0, y, 0, y + h);
    f.addColorStop(0, "#08090c");
    f.addColorStop(1, "#13151b");
    g.fillStyle = f;
    g.fillRect(x, y, w, h);
    g.fillStyle = "rgba(0,0,0,0.65)";
    g.fillRect(x, y, w, 2);
    g.fillRect(x, y, 1.5, h);
    g.fillStyle = "rgba(255,255,255,0.1)";
    g.fillRect(x, y + h - 1.2, w, 1.2);
  };
  for (const p of Object.values(HUD_PANELS)) inset(p.x, p.y, p.w, p.h);

  // screws between panels
  const screw = (x, y) => {
    g.fillStyle = "#4a505e";
    g.beginPath();
    g.arc(x, y, 2.4, 0, 7);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.3)";
    g.beginPath();
    g.arc(x - 0.7, y - 0.7, 1, 0, 7);
    g.fill();
    g.strokeStyle = "#15171c";
    g.lineWidth = 0.9;
    const a = rnd() * 3;
    g.beginPath();
    g.moveTo(x - Math.cos(a) * 1.8, y - Math.sin(a) * 1.8);
    g.lineTo(x + Math.cos(a) * 1.8, y + Math.sin(a) * 1.8);
    g.stroke();
  };
  for (const x of [99, 194, 289, 351, 445]) {
    screw(x, 10);
    screw(x, 54);
  }
  screw(3.5, 32);
  screw(636.5, 32);

  return c;
})();
