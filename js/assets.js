"use strict";
// GROOMP — procedural textures & sprites. No image files: everything is
// drawn onto offscreen canvases at load time and read back as Uint32Array
// pixel buffers (little-endian 0xAABBGGRR, same layout the renderer writes).

// Texture/sprite resolution. Art below is authored in 64px logical
// coordinates; makePixels scales the context so TEXN can be any multiple.
const TEXN = 128;

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

function drawBrick(g, variant) {
  g.fillStyle = "#1d100c";
  g.fillRect(0, 0, 64, 64);
  for (let row = 0; row < 4; row++) {
    const off = (row % 2) * 8 - 8;
    for (let col = 0; col < 5; col++) {
      const x = col * 16 + off + 1, y = row * 16 + 1;
      const r = 92 + rnd() * 40 | 0;
      block(g, x, y, 14, 14, `rgb(${r},${34 + rnd() * 16 | 0},${26 + rnd() * 12 | 0})`);
      pits(g, x, y, 14, 14, 5, 0.12);
      if (rnd() < 0.3) {
        g.strokeStyle = "rgba(15,4,4,0.65)";
        g.lineWidth = 1;
        g.beginPath();
        let cx = x + 3 + rnd() * 8, cy = y;
        g.moveTo(cx, cy);
        for (let s = 0; s < 3; s++) {
          cx += (rnd() - 0.5) * 7;
          cy += 4.5;
          g.lineTo(cx, cy);
        }
        g.stroke();
      }
    }
  }
  grime(g, 8);
  if (variant) {
    g.fillStyle = "rgba(12,6,4,0.3)";
    g.beginPath();
    g.ellipse(18 + rnd() * 28, 28 + rnd() * 22, 13 + rnd() * 8, 19 + rnd() * 9, 0, 0, 7);
    g.fill();
  }
  addNoise(g, 20);
}

function drawStone(g, variant) {
  g.fillStyle = "#101214";
  g.fillRect(0, 0, 64, 64);
  for (let r = 0; r < 4; r++) {
    let x = (r % 2) * -7;
    while (x < 64) {
      const w = 13 + rnd() * 13;
      const v = 54 + rnd() * 30 | 0;
      block(g, x + 1, r * 16 + 1, w - 2, 14, `rgb(${v - 5},${v},${v + 7})`);
      pits(g, x + 1, r * 16 + 1, w - 2, 14, 7, 0.1);
      x += w;
    }
  }
  const moss = variant ? 15 : 8;
  for (let i = 0; i < moss; i++) {
    g.fillStyle = `rgba(${28 + rnd() * 22 | 0},${66 + rnd() * 44 | 0},28,${0.16 + rnd() * 0.26})`;
    g.beginPath();
    g.ellipse(rnd() * 64, 52 - rnd() * 34, 3 + rnd() * 5, 2 + rnd() * 3.5, 0, 0, 7);
    g.fill();
  }
  grime(g, 6);
  addNoise(g, 17);
}

function drawTech(g) {
  g.fillStyle = "#0e1015";
  g.fillRect(0, 0, 64, 64);
  const panel = (x, y, w, h) => {
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, "#232936");
    gr.addColorStop(1, "#161a23");
    g.fillStyle = gr;
    g.fillRect(x, y, w, h);
    g.strokeStyle = "#080a0f";
    g.lineWidth = 1;
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    // rivets
    g.fillStyle = "#3c4456";
    for (const [rx, ry] of [[x + 3, y + 3], [x + w - 3, y + 3], [x + 3, y + h - 3], [x + w - 3, y + h - 3]]) {
      g.beginPath();
      g.arc(rx, ry, 1.4, 0, 7);
      g.fill();
    }
  };
  panel(2, 2, 60, 22);
  panel(2, 26, 37, 20);
  panel(41, 26, 21, 20);
  // vents
  g.fillStyle = "#05070a";
  for (let i = 0; i < 4; i++) g.fillRect(8, 8 + i * 4, 24, 2);
  // status lights
  for (let i = 0; i < 3; i++) {
    g.fillStyle = i === 1 ? "#1a5a2c" : "#3fe06a";
    g.fillRect(40 + i * 7, 10, 4, 4);
    if (i !== 1) {
      g.fillStyle = "rgba(63,224,106,0.25)";
      g.fillRect(39 + i * 7, 9, 6, 6);
    }
  }
  // cabling
  g.strokeStyle = "#2a2f3e";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(44, 30);
  g.bezierCurveTo(50, 36, 46, 40, 52, 44);
  g.stroke();
  // hazard stripe base
  g.save();
  g.beginPath();
  g.rect(0, 50, 64, 12);
  g.clip();
  g.fillStyle = "#8f7a1e";
  g.fillRect(0, 50, 64, 12);
  g.fillStyle = "#15151a";
  for (let x = -12; x < 70; x += 12) {
    g.beginPath();
    g.moveTo(x, 62);
    g.lineTo(x + 6, 50);
    g.lineTo(x + 12, 50);
    g.lineTo(x + 6, 62);
    g.closePath();
    g.fill();
  }
  g.restore();
  g.fillStyle = "rgba(0,0,0,0.3)";
  g.fillRect(0, 50, 64, 2);
  grime(g, 7);
  addNoise(g, 11);
}

function drawSlime(g) {
  g.fillStyle = "#0c1d08";
  g.fillRect(0, 0, 64, 64);
  // veins
  g.strokeStyle = "rgba(16,46,10,0.9)";
  g.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    let x = rnd() * 64, y = 0;
    g.moveTo(x, y);
    while (y < 64) {
      x += (rnd() - 0.5) * 14;
      y += 8 + rnd() * 8;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // glossy pustules
  for (let i = 0; i < 24; i++) {
    const x = rnd() * 64, y = rnd() * 64, r = 3 + rnd() * 7;
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    gr.addColorStop(0, "rgba(170,255,110,0.85)");
    gr.addColorStop(0.45, `rgba(${36 + rnd() * 30 | 0},${105 + rnd() * 60 | 0},26,0.6)`);
    gr.addColorStop(1, "rgba(8,32,6,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, 7);
    g.fill();
  }
  // shiny drips
  for (let i = 0; i < 7; i++) {
    const x = 2 + rnd() * 58, l = 12 + rnd() * 42;
    g.fillStyle = "rgba(66,175,42,0.55)";
    g.fillRect(x, 0, 3, l);
    g.fillStyle = "rgba(165,255,115,0.55)";
    g.fillRect(x, 0, 1.2, l);
    g.fillStyle = "rgba(66,175,42,0.65)";
    g.beginPath();
    g.arc(x + 1.5, l, 2.2, 0, 7);
    g.fill();
  }
  addNoise(g, 13);
}

const texBrick = makePixels(g => drawBrick(g, false));
const texBrickB = makePixels(g => drawBrick(g, true));
const texStone = makePixels(g => drawStone(g, false));
const texStoneB = makePixels(g => drawStone(g, true));
const texTech = makePixels(drawTech);
const texSlime = makePixels(drawSlime);

const texFloor = makePixels(g => {
  g.fillStyle = "#161412";
  g.fillRect(0, 0, 64, 64);
  for (let ty = 0; ty < 4; ty++) {
    for (let tx = 0; tx < 4; tx++) {
      const v = 38 + rnd() * 14 | 0;
      block(g, tx * 16 + 1, ty * 16 + 1, 14, 14, `rgb(${v},${v - 3},${v - 6})`);
      pits(g, tx * 16 + 1, ty * 16 + 1, 14, 14, 4, 0.1);
    }
  }
  g.fillStyle = "rgba(6,5,4,0.18)";
  g.beginPath();
  g.ellipse(rnd() * 64, rnd() * 64, 13, 8, 0, 0, 7);
  g.fill();
  addNoise(g, 13);
});

const texCeil = makePixels(g => {
  g.fillStyle = "#08090c";
  g.fillRect(0, 0, 64, 64);
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 2; tx++) {
      const x = tx * 32 + 1, y = ty * 32 + 1;
      g.fillStyle = "#101218";
      g.fillRect(x, y, 30, 30);
      g.fillStyle = "rgba(255,255,255,0.05)";
      g.fillRect(x, y, 30, 1.5);
      g.fillStyle = "#1c2030";
      for (const [rx, ry] of [[x + 3, y + 3], [x + 27, y + 3], [x + 3, y + 27], [x + 27, y + 27]]) {
        g.beginPath();
        g.arc(rx, ry, 1.3, 0, 7);
        g.fill();
      }
    }
  }
  g.fillStyle = "rgba(4,3,3,0.4)";
  g.beginPath();
  g.ellipse(rnd() * 64, rnd() * 64, 16, 10, 0, 0, 7);
  g.fill();
  addNoise(g, 8);
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

const WALL_TEX = [null, texBrick, texStone, texTech, texSlime];
const WALL_TEX_B = [null, texBrickB, texStoneB, null, null];

// ---------------------------------------------------------------- enemies
// A "groomp" is a one-eyed hopping blob. Frames are drawn parametrically so
// every enemy type is the same creature in a different palette/size.

function drawGroompFrame(g, pal, opt) {
  const { body, lite, dark } = pal;
  const frame = opt.frame || 0;
  const mouth = opt.mouth || 0;
  const eye = opt.eye || "normal";
  const squish = opt.squish || 0;
  const horns = pal.horns;

  const cx = 32;
  const bottom = 60;
  const bounce = frame === 1 ? 3 : 0;
  const h = 42 * (1 - squish * 0.78);
  const w = 38 * (1 + squish * 0.55);
  const bodyY = bottom - 4 - h / 2 + bounce;

  if (squish > 0.8) {
    // final death frame: a glossy puddle with bone bits
    g.fillStyle = dark;
    g.beginPath();
    g.ellipse(cx, bottom - 3, 25, 5.5, 0, 0, 7);
    g.fill();
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(cx - 4, bottom - 4, 17, 4, 0, 0, 7);
    g.fill();
    g.fillStyle = lite;
    g.beginPath();
    g.ellipse(cx - 8, bottom - 5, 6, 1.6, 0, 0, 7);
    g.fill();
    g.fillStyle = "#ddd";
    g.fillRect(cx + 6, bottom - 7, 5, 2);
    g.fillRect(cx - 1, bottom - 6, 3, 2);
    return;
  }

  // feet
  if (squish < 0.6) {
    g.fillStyle = dark;
    g.beginPath();
    g.ellipse(cx - 11 + (frame === 1 ? 3 : 0), bottom - 2, 7, 4, 0, 0, 7);
    g.fill();
    g.beginPath();
    g.ellipse(cx + 11 - (frame === 1 ? 3 : 0), bottom - 2, 7, 4, 0, 0, 7);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.beginPath();
    g.ellipse(cx - 12 + (frame === 1 ? 3 : 0), bottom - 3.5, 3, 1.3, 0, 0, 7);
    g.fill();
  }

  if (horns && squish < 0.4) {
    g.fillStyle = "#d8cfc0";
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + s * w * 0.28, bodyY - h * 0.34);
      g.quadraticCurveTo(cx + s * w * 0.55, bodyY - h * 0.75, cx + s * w * 0.32, bodyY - h * 0.95);
      g.quadraticCurveTo(cx + s * w * 0.42, bodyY - h * 0.62, cx + s * w * 0.13, bodyY - h * 0.42);
      g.closePath();
      g.fill();
    }
  }

  // body with volume shading + outline
  const bg = g.createRadialGradient(cx - w * 0.22, bodyY - h * 0.28, 2, cx, bodyY, w * 0.62);
  bg.addColorStop(0, lite);
  bg.addColorStop(0.55, body);
  bg.addColorStop(1, dark);
  g.fillStyle = bg;
  g.beginPath();
  g.ellipse(cx, bodyY, w / 2, h / 2, 0, 0, 7);
  g.fill();
  g.strokeStyle = "rgba(8,12,6,0.7)";
  g.lineWidth = 1.5;
  g.stroke();

  // warts with shaded rings
  for (const [wx, wy, wr] of [[-0.32, -0.18, 2.2], [0.3, -0.04, 2.6], [0.16, -0.36, 1.9], [-0.18, 0.22, 2.1]]) {
    const px = cx + w * wx, py = bodyY + h * wy;
    g.fillStyle = dark;
    g.beginPath();
    g.arc(px, py, wr, 0, 7);
    g.fill();
    g.fillStyle = lite;
    g.beginPath();
    g.arc(px - wr * 0.3, py - wr * 0.3, wr * 0.4, 0, 7);
    g.fill();
  }

  const eyeY = bodyY - h * 0.16;
  if (eye === "dead" || squish > 0.4) {
    g.strokeStyle = "#101010";
    g.lineWidth = 2.5;
    const ex = cx, ey = squish > 0.4 ? bodyY : eyeY, r = 5;
    g.beginPath();
    g.moveTo(ex - r, ey - r); g.lineTo(ex + r, ey + r);
    g.moveTo(ex + r, ey - r); g.lineTo(ex - r, ey + r);
    g.stroke();
  } else if (eye === "pain") {
    g.fillStyle = "#f5f0e8";
    g.beginPath(); g.ellipse(cx, eyeY, 9, 7, 0, 0, 7); g.fill();
    g.strokeStyle = "#101010";
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(cx - 5, eyeY - 4); g.lineTo(cx + 5, eyeY + 4);
    g.moveTo(cx + 5, eyeY - 4); g.lineTo(cx - 5, eyeY + 4);
    g.stroke();
  } else {
    // bloodshot eye with glossy pupil
    g.fillStyle = "#f5f0e8";
    g.beginPath(); g.ellipse(cx, eyeY, 10, 8, 0, 0, 7); g.fill();
    g.strokeStyle = "rgba(20,20,20,0.6)";
    g.lineWidth = 1;
    g.stroke();
    g.strokeStyle = "rgba(190,40,30,0.6)";
    g.lineWidth = 0.8;
    for (let i = 0; i < 5; i++) {
      const a = -0.6 + i * 0.55;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * 9.5, eyeY + Math.sin(a) * 7.5);
      g.lineTo(cx + Math.cos(a) * 5.5, eyeY + Math.sin(a) * 4.2);
      g.stroke();
    }
    g.fillStyle = "#a81808";
    g.beginPath(); g.arc(cx, eyeY + 1, 4.6, 0, 7); g.fill();
    g.fillStyle = "#0c0c0c";
    g.beginPath(); g.arc(cx, eyeY + 1, 2.4, 0, 7); g.fill();
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.beginPath(); g.arc(cx - 1.6, eyeY - 0.8, 1.1, 0, 7); g.fill();
  }

  const mouthY = bodyY + h * 0.18;
  if (mouth) {
    // roaring maw
    g.fillStyle = "#33060a";
    g.beginPath();
    g.ellipse(cx, mouthY + 3, w * 0.32, h * 0.22, 0, 0, 7);
    g.fill();
    g.fillStyle = "#5a0d12";
    g.beginPath();
    g.ellipse(cx, mouthY + 6, w * 0.2, h * 0.1, 0, 0, 7);
    g.fill();
    g.fillStyle = "#e8e0d0";
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(cx + i * 6 - 2.5, mouthY - h * 0.16 + 4);
      g.lineTo(cx + i * 6 + 2.5, mouthY - h * 0.16 + 4);
      g.lineTo(cx + i * 6, mouthY - h * 0.16 + 12);
      g.closePath();
      g.fill();
    }
    for (let i = -1; i <= 1; i++) {
      g.beginPath();
      g.moveTo(cx + i * 8 - 2, mouthY + h * 0.2 + 2);
      g.lineTo(cx + i * 8 + 2, mouthY + h * 0.2 + 2);
      g.lineTo(cx + i * 8, mouthY + h * 0.2 - 5);
      g.closePath();
      g.fill();
    }
    // drool
    g.strokeStyle = "rgba(190,255,160,0.7)";
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(cx + w * 0.2, mouthY + h * 0.18);
    g.lineTo(cx + w * 0.22, mouthY + h * 0.34);
    g.stroke();
  } else if (squish < 0.4 && eye !== "dead") {
    g.strokeStyle = "#101010";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx - 8, mouthY);
    g.quadraticCurveTo(cx, mouthY + 5, cx + 8, mouthY);
    g.stroke();
    g.fillStyle = "#e8e0d0";
    g.beginPath();
    g.moveTo(cx - 6, mouthY + 1); g.lineTo(cx - 2, mouthY + 1); g.lineTo(cx - 4, mouthY + 6);
    g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(cx + 2, mouthY + 1); g.lineTo(cx + 6, mouthY + 1); g.lineTo(cx + 4, mouthY + 6);
    g.closePath(); g.fill();
  }
}

function buildEnemySheet(pal) {
  const f = opt => makePixels(g => drawGroompFrame(g, pal, opt));
  const flash = makePixels(g => {
    drawGroompFrame(g, pal, { frame: 0, eye: "pain" });
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.fillRect(0, 0, 64, 64);
  });
  return {
    walk: [f({ frame: 0 }), f({ frame: 1 })],
    attack: f({ frame: 1, mouth: 1 }),
    pain: f({ frame: 0, eye: "pain" }),
    flash,
    dead: [f({ squish: 0.3, eye: "dead" }), f({ squish: 0.65 }), f({ squish: 1 })],
  };
}

const SPRITES = {
  groomp: buildEnemySheet({ body: "#3aa32a", lite: "#7ed64f", dark: "#16500f" }),
  spitter: buildEnemySheet({ body: "#a836a8", lite: "#e07ae0", dark: "#561256" }),
  boss: buildEnemySheet({ body: "#b03426", lite: "#e8784f", dark: "#5a1009", horns: true }),
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

const SPR_SPIT = makePixels(g => {
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 18);
  r.addColorStop(0, "#ffffff");
  r.addColorStop(0.35, "#ff66ff");
  r.addColorStop(0.8, "#a316a3");
  r.addColorStop(1, "rgba(120,10,120,0)");
  g.fillStyle = r;
  g.beginPath();
  g.arc(32, 32, 18, 0, 7);
  g.fill();
});

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

// ---------------------------------------------------------------- weapon
// Pre-rendered first-person blaster (drawn once at 2x for crispness).
// Logical size 190x170; muzzle sits at (95, 14) in logical coords.

const WEAPON_W = 190, WEAPON_H = 170;
const WEAPON_CANVAS = (() => {
  const c = document.createElement("canvas");
  c.width = WEAPON_W * 2;
  c.height = WEAPON_H * 2;
  const g = c.getContext("2d");
  g.scale(2, 2);
  const cx = 95;

  // --- left glove gripping the fore-end (behind barrel)
  g.fillStyle = "#4a3526";
  g.beginPath();
  g.ellipse(cx - 34, 96, 17, 13, -0.5, 0, 7);
  g.fill();
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.ellipse(cx - 26 + i * 7, 86 - i * 2, 5.5, 8, -0.35, 0, 7);
    g.fill();
  }
  g.fillStyle = "rgba(255,220,180,0.14)";
  g.beginPath();
  g.ellipse(cx - 38, 92, 8, 5, -0.5, 0, 7);
  g.fill();

  // --- barrel shroud (cylinder shading)
  const barrel = g.createLinearGradient(cx - 26, 0, cx + 26, 0);
  barrel.addColorStop(0, "#14171d");
  barrel.addColorStop(0.32, "#535c6c");
  barrel.addColorStop(0.5, "#6a7588");
  barrel.addColorStop(0.68, "#444c5a");
  barrel.addColorStop(1, "#0f1116");
  g.fillStyle = barrel;
  g.beginPath();
  g.moveTo(cx - 17, 18);
  g.lineTo(cx + 17, 18);
  g.lineTo(cx + 27, 108);
  g.lineTo(cx - 27, 108);
  g.closePath();
  g.fill();

  // cooling ribs
  for (let i = 0; i < 5; i++) {
    const y = 32 + i * 14;
    const wHalf = 18 + (y - 18) * 0.11;
    g.fillStyle = "rgba(0,0,0,0.45)";
    g.fillRect(cx - wHalf, y, wHalf * 2, 3.5);
    g.fillStyle = "rgba(255,255,255,0.10)";
    g.fillRect(cx - wHalf, y + 3.5, wHalf * 2, 1.4);
  }

  // muzzle ring
  g.fillStyle = "#586070";
  g.beginPath();
  g.ellipse(cx, 18, 17, 7, 0, 0, 7);
  g.fill();
  g.fillStyle = "#07090c";
  g.beginPath();
  g.ellipse(cx, 18, 13, 5, 0, 0, 7);
  g.fill();
  g.strokeStyle = "#3fe06a";
  g.lineWidth = 1.6;
  g.beginPath();
  g.ellipse(cx, 18, 9.5, 3.4, 0, 0, 7);
  g.stroke();

  // collar with rivets
  const collar = g.createLinearGradient(cx - 30, 0, cx + 30, 0);
  collar.addColorStop(0, "#181b22");
  collar.addColorStop(0.5, "#5c6678");
  collar.addColorStop(1, "#13151b");
  g.fillStyle = collar;
  g.fillRect(cx - 30, 104, 60, 13);
  g.fillStyle = "#7d8aa0";
  for (let i = -2; i <= 2; i++) {
    g.beginPath();
    g.arc(cx + i * 13, 110.5, 1.8, 0, 7);
    g.fill();
  }

  // receiver
  const recv = g.createLinearGradient(cx - 40, 0, cx + 40, 0);
  recv.addColorStop(0, "#171a20");
  recv.addColorStop(0.45, "#3d4452");
  recv.addColorStop(1, "#121419");
  g.fillStyle = recv;
  g.beginPath();
  g.moveTo(cx - 32, 117);
  g.lineTo(cx + 32, 117);
  g.lineTo(cx + 42, 170);
  g.lineTo(cx - 42, 170);
  g.closePath();
  g.fill();

  // vents on receiver
  g.fillStyle = "#06070a";
  for (let i = 0; i < 3; i++) g.fillRect(cx + 14, 124 + i * 7, 18 + i * 2, 3);

  // energy cell window (glow refreshed live by the game)
  g.fillStyle = "#0a0c10";
  g.fillRect(cx - 26, 126, 30, 16);
  g.strokeStyle = "#5c6678";
  g.lineWidth = 2;
  g.strokeRect(cx - 26, 126, 30, 16);

  // --- right glove on the side
  g.fillStyle = "#43301f";
  g.beginPath();
  g.ellipse(cx + 44, 156, 20, 16, 0.5, 0, 7);
  g.fill();
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.ellipse(cx + 32 + i * 8, 146 + i * 3, 6, 9, 0.6, 0, 7);
    g.fill();
  }
  g.fillStyle = "rgba(255,220,180,0.12)";
  g.beginPath();
  g.ellipse(cx + 50, 150, 9, 6, 0.5, 0, 7);
  g.fill();

  return c;
})();
// energy cell rect in weapon-local logical coords (for the live glow)
const WEAPON_CELL = { x: 95 - 26, y: 126, w: 30, h: 16 };
