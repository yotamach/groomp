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

// ----------------------------------------------------- the scary bestiary
// Shared helpers: glowing eyes, fang rows, a generic collapse-into-puddle
// death, and a sheet builder that derives pain/flash/death frames from a
// single parametric draw function per creature.

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

function fangRow(g, x, y, w, n, h, down = true, color = "#ded5c2") {
  g.fillStyle = color;
  const step = w / n;
  for (let i = 0; i < n; i++) {
    const fx = x + i * step;
    g.beginPath();
    g.moveTo(fx, y);
    g.lineTo(fx + step, y);
    g.lineTo(fx + step / 2, y + (down ? h : -h));
    g.closePath();
    g.fill();
  }
}

function drawPuddle(g, pal, s) {
  const cx = 32, bottom = 60;
  if (s < 0.5) {
    const h = 26 * (1 - s);
    const bg = g.createRadialGradient(cx - 5, bottom - h, 2, cx, bottom - h / 2, 20);
    bg.addColorStop(0, pal.lite);
    bg.addColorStop(1, pal.dark);
    g.fillStyle = bg;
    g.beginPath();
    g.ellipse(cx, bottom - h / 2, 17, h / 2, 0, 0, 7);
    g.fill();
    g.strokeStyle = "rgba(8,8,10,0.7)";
    g.lineWidth = 1.5;
    g.stroke();
    g.strokeStyle = "#0c0c0c";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx - 6, bottom - h + 3); g.lineTo(cx - 1, bottom - h + 8);
    g.moveTo(cx - 1, bottom - h + 3); g.lineTo(cx - 6, bottom - h + 8);
    g.stroke();
  } else {
    g.fillStyle = pal.dark;
    g.beginPath();
    g.ellipse(cx, bottom - 3, 25, 5.5, 0, 0, 7);
    g.fill();
    g.fillStyle = pal.body;
    g.beginPath();
    g.ellipse(cx - 4, bottom - 4, 17, 4, 0, 0, 7);
    g.fill();
    g.fillStyle = "#d3c9b4";
    g.fillRect(cx + 5, bottom - 7, 6, 2);
    g.fillRect(cx - 2, bottom - 6, 3, 2);
    if (s >= 1) {
      g.fillStyle = pal.lite;
      g.beginPath();
      g.ellipse(cx - 8, bottom - 5, 6, 1.6, 0, 0, 7);
      g.fill();
    }
  }
}

function buildSheet(drawFn, pal) {
  const f = pose => makePixels(g => drawFn(g, pal, pose));
  const pain = makePixels(g => {
    g.translate(34, 33);
    g.rotate(0.09);
    g.translate(-32, -32);
    drawFn(g, pal, { step: 0, pain: 1 });
  });
  const flash = makePixels(g => {
    drawFn(g, pal, { step: 0, pain: 1 });
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.fillRect(0, 0, 64, 64);
  });
  return {
    walk: [f({ step: 0 }), f({ step: 1 })],
    attack: f({ step: 1, attack: 1 }),
    pain,
    flash,
    dead: [0.35, 0.7, 1].map(s => makePixels(g => drawPuddle(g, pal, s))),
  };
}

// Wraith — tattered floating shroud, hood full of darkness, ice-blue eyes
function drawWraith(g, pal, pose) {
  const sway = pose.step ? 2.5 : -2.5;
  const cx = 32 + sway * 0.4, top = 8;
  const grad = g.createLinearGradient(0, top, 0, 58);
  grad.addColorStop(0, pal.lite);
  grad.addColorStop(0.5, pal.body);
  grad.addColorStop(1, pal.dark);
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(cx, top);
  g.quadraticCurveTo(cx + 13 + sway, top + 12, cx + 15 + sway, 36);
  // ragged hem
  let x = cx + 15 + sway;
  for (let i = 0; i < 6; i++) {
    g.lineTo(x - i * 5 - 2, i % 2 ? 46 : 56);
  }
  g.lineTo(cx - 15 + sway, 36);
  g.quadraticCurveTo(cx - 13 + sway, top + 12, cx, top);
  g.closePath();
  g.fill();
  g.strokeStyle = "rgba(5,6,10,0.8)";
  g.lineWidth = 1.5;
  g.stroke();
  // skeletal claw hands
  if (pose.attack) {
    g.strokeStyle = "#cfd4de";
    g.lineWidth = 2;
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(cx + s * (16 + sway * 0.3), 30);
        g.lineTo(cx + s * (22 + i * 2), 24 + i * 5);
        g.stroke();
      }
    }
  }
  // hood void
  g.fillStyle = "#040508";
  g.beginPath();
  g.ellipse(cx, top + 13, 8.5, 10, 0, 0, 7);
  g.fill();
  if (!pose.pain) {
    glowEye(g, cx - 3.6, top + 12, 1.5, "#7fb8ff");
    glowEye(g, cx + 3.6, top + 12, 1.5, "#7fb8ff");
  }
  if (pose.attack) {
    g.fillStyle = "#0a0c14";
    g.beginPath();
    g.ellipse(cx, top + 19, 3.5, 4.5, 0, 0, 7);
    g.fill();
  }
}

// Skitterling — low chittering spider-thing with too many legs
function drawSkitter(g, pal, pose) {
  const cx = 32, cy = 47;
  const lift = pose.attack ? -7 : 0;
  // legs
  g.strokeStyle = pal.dark;
  g.lineWidth = 2.2;
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) {
      const ph = (i + (pose.step ? 1 : 0)) % 2 ? 3 : -2;
      g.beginPath();
      g.moveTo(cx + s * 6, cy + lift);
      g.lineTo(cx + s * (13 + i * 3), cy - 7 + ph + lift * 0.5);
      g.lineTo(cx + s * (16 + i * 3.4), 59);
      g.stroke();
    }
  }
  // carapace
  const bg = g.createRadialGradient(cx - 4, cy - 6 + lift, 1, cx, cy + lift, 15);
  bg.addColorStop(0, pal.lite);
  bg.addColorStop(0.6, pal.body);
  bg.addColorStop(1, pal.dark);
  g.fillStyle = bg;
  g.beginPath();
  g.ellipse(cx, cy + lift, 13, 8.5, 0, 0, 7);
  g.fill();
  g.strokeStyle = "rgba(5,5,8,0.8)";
  g.lineWidth = 1.4;
  g.stroke();
  // plate seams
  g.strokeStyle = "rgba(0,0,0,0.5)";
  g.beginPath();
  g.moveTo(cx - 9, cy - 4 + lift);
  g.quadraticCurveTo(cx, cy - 9 + lift, cx + 9, cy - 4 + lift);
  g.stroke();
  // eye cluster
  if (!pose.pain) {
    glowEye(g, cx - 4, cy - 2 + lift, 1.3, "#ff4030");
    glowEye(g, cx + 4, cy - 2 + lift, 1.3, "#ff4030");
    glowEye(g, cx, cy - 5 + lift, 1, "#ff4030");
  }
  // mandibles
  g.strokeStyle = "#ded5c2";
  g.lineWidth = 2;
  const open = pose.attack ? 5 : 2;
  g.beginPath();
  g.moveTo(cx - 4, cy + 5 + lift); g.lineTo(cx - 4 - open, cy + 11 + lift);
  g.moveTo(cx + 4, cy + 5 + lift); g.lineTo(cx + 4 + open, cy + 11 + lift);
  g.stroke();
}

// Brute — hulking mass of flesh, exposed ribs, knuckles on the ground
function drawBrute(g, pal, pose) {
  const cx = 32, sway = pose.step ? 1.5 : -1.5;
  const armUp = pose.attack ? -16 : 0;
  // arms behind body
  g.fillStyle = pal.dark;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + s * 24, 44 + armUp * (s === 1 ? 1 : 0.9), 7.5, 14, s * 0.25, 0, 7);
    g.fill();
    g.beginPath();
    g.ellipse(cx + s * 26, 56 + armUp, 6.5, 4.5, 0, 0, 7);
    g.fill();
  }
  // legs
  g.fillStyle = pal.dark;
  g.fillRect(cx - 14 + sway, 50, 9, 10);
  g.fillRect(cx + 5 + sway, 50, 9, 10);
  // torso
  const bg = g.createRadialGradient(cx - 8 + sway, 26, 2, cx + sway, 34, 26);
  bg.addColorStop(0, pal.lite);
  bg.addColorStop(0.55, pal.body);
  bg.addColorStop(1, pal.dark);
  g.fillStyle = bg;
  g.beginPath();
  g.ellipse(cx + sway, 34, 21, 19, 0, 0, 7);
  g.fill();
  g.strokeStyle = "rgba(10,6,6,0.8)";
  g.lineWidth = 1.6;
  g.stroke();
  // exposed ribcage
  g.strokeStyle = "#d8cdb6";
  g.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.arc(cx + sway, 30 + i * 6, 12 - i * 1.5, 0.35, Math.PI - 0.35);
    g.stroke();
  }
  // sternum gash
  g.fillStyle = "#42090c";
  g.fillRect(cx - 1.5 + sway, 24, 3, 18);
  // tiny sunken head
  g.fillStyle = pal.body;
  g.beginPath();
  g.arc(cx + sway, 16, 6.5, 0, 7);
  g.fill();
  g.strokeStyle = "rgba(10,6,6,0.7)";
  g.stroke();
  if (!pose.pain) {
    glowEye(g, cx - 2.5 + sway, 15, 1.1, "#ffc24a");
    glowEye(g, cx + 2.5 + sway, 15, 1.1, "#ffc24a");
  }
  fangRow(g, cx - 4 + sway, 19.5, 8, 4, 2.5);
}

// Watcher — a floating bloodshot eye trailing tentacles
function drawWatcher(g, pal, pose) {
  const cx = 32, cy = 26, sway = pose.step ? 2 : -2;
  // tentacles
  g.strokeStyle = pal.dark;
  g.lineWidth = 2.4;
  for (let i = -2; i <= 2; i++) {
    const flare = pose.attack ? i * 4 : 0;
    g.beginPath();
    g.moveTo(cx + i * 5, cy + 12);
    g.quadraticCurveTo(cx + i * 7 + sway, 42, cx + i * 8 + sway * 1.5 + flare, 54 + (i % 2 ? 3 : 0));
    g.stroke();
  }
  // eyeball
  const bg = g.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, 16);
  bg.addColorStop(0, "#fdf8ee");
  bg.addColorStop(0.75, "#e8ddc8");
  bg.addColorStop(1, "#9c8f76");
  g.fillStyle = bg;
  g.beginPath();
  g.arc(cx, cy, 14.5, 0, 7);
  g.fill();
  g.strokeStyle = "rgba(20,16,12,0.8)";
  g.lineWidth = 1.5;
  g.stroke();
  // veins
  g.strokeStyle = "rgba(180,30,22,0.7)";
  g.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9 + 0.3;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14);
    g.quadraticCurveTo(
      cx + Math.cos(a + 0.25) * 10, cy + Math.sin(a + 0.25) * 10,
      cx + Math.cos(a) * 7, cy + Math.sin(a) * 7);
    g.stroke();
  }
  // iris: slit pupil when attacking
  const ir = g.createRadialGradient(cx, cy + 1, 0.5, cx, cy + 1, 6.5);
  ir.addColorStop(0, pal.lite);
  ir.addColorStop(1, pal.body);
  g.fillStyle = ir;
  g.beginPath();
  g.arc(cx, cy + 1, 6.5, 0, 7);
  g.fill();
  g.fillStyle = "#0a0a0c";
  if (pose.attack) {
    g.beginPath();
    g.ellipse(cx, cy + 1, 1.4, 5.2, 0, 0, 7);
    g.fill();
  } else if (!pose.pain) {
    g.beginPath();
    g.arc(cx, cy + 1, 3, 0, 7);
    g.fill();
  } else {
    g.strokeStyle = "#0a0a0c";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx - 4, cy - 3); g.lineTo(cx + 4, cy + 5);
    g.moveTo(cx + 4, cy - 3); g.lineTo(cx - 4, cy + 5);
    g.stroke();
  }
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.beginPath();
  g.arc(cx - 3, cy - 3, 1.6, 0, 7);
  g.fill();
}

// Hollow — a gaunt skeletal husk with a void where its chest should be
function drawHollow(g, pal, pose) {
  const cx = 32, lean = pose.attack ? 4 : 0, step = pose.step ? 2.5 : -2.5;
  g.strokeStyle = pal.body;
  g.lineWidth = 3;
  // legs
  g.beginPath();
  g.moveTo(cx - 3, 40); g.lineTo(cx - 6 - step, 50); g.lineTo(cx - 7 - step, 60);
  g.moveTo(cx + 3, 40); g.lineTo(cx + 6 + step, 50); g.lineTo(cx + 7 + step, 60);
  g.stroke();
  // torso slab
  const bg = g.createLinearGradient(0, 14, 0, 42);
  bg.addColorStop(0, pal.lite);
  bg.addColorStop(1, pal.dark);
  g.fillStyle = bg;
  g.beginPath();
  g.moveTo(cx - 11 + lean, 16);
  g.lineTo(cx + 11 + lean, 16);
  g.lineTo(cx + 8, 42);
  g.lineTo(cx - 8, 42);
  g.closePath();
  g.fill();
  g.strokeStyle = "rgba(8,8,10,0.8)";
  g.lineWidth = 1.4;
  g.stroke();
  // the hollow: black void in the chest with glow rim
  g.fillStyle = "#020203";
  g.beginPath();
  g.ellipse(cx + lean * 0.5, 27, 6.5, 8.5, 0, 0, 7);
  g.fill();
  g.strokeStyle = pal.glow || "#9fe24a";
  g.lineWidth = 1.2;
  g.globalAlpha = 0.8;
  g.stroke();
  g.globalAlpha = 1;
  // arms with claws
  g.strokeStyle = pal.body;
  g.lineWidth = 2.6;
  for (const s of [-1, 1]) {
    const reach = pose.attack ? 10 : 0;
    g.beginPath();
    g.moveTo(cx + s * 10 + lean, 19);
    g.lineTo(cx + s * (17 - reach * 0.3), 30 - reach * 0.8);
    g.lineTo(cx + s * (19 - reach * 0.5), 40 - reach * 1.6);
    g.stroke();
    g.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(cx + s * (19 - reach * 0.5), 40 - reach * 1.6);
      g.lineTo(cx + s * (21 - reach * 0.5) + i * 2 - 2, 45 - reach * 1.7);
      g.stroke();
    }
    g.lineWidth = 2.6;
  }
  // skull
  g.fillStyle = "#d8cfbc";
  g.beginPath();
  g.arc(cx + lean, 10, 6.5, 0, 7);
  g.fill();
  g.fillRect(cx - 4 + lean, 12, 8, 6);
  g.fillStyle = "#16120c";
  g.beginPath();
  g.arc(cx - 2.6 + lean, 9.5, 1.8, 0, 7);
  g.arc(cx + 2.6 + lean, 9.5, 1.8, 0, 7);
  g.fill();
  if (!pose.pain) {
    glowEye(g, cx - 2.6 + lean, 9.5, 0.9, pal.glow || "#9fe24a");
    glowEye(g, cx + 2.6 + lean, 9.5, 0.9, pal.glow || "#9fe24a");
  }
  fangRow(g, cx - 4 + lean, 16.5, 8, 4, 2);
}

// Maw — a charging mouth on legs; mostly teeth
function drawMaw(g, pal, pose) {
  const cx = 32, cy = 36, open = pose.attack ? 13 : 7;
  // stubby legs
  g.fillStyle = pal.dark;
  const step = pose.step ? 3 : -3;
  g.fillRect(cx - 13 + step, 52, 8, 8);
  g.fillRect(cx + 5 - step, 52, 8, 8);
  // body sphere
  const bg = g.createRadialGradient(cx - 7, cy - 8, 2, cx, cy, 22);
  bg.addColorStop(0, pal.lite);
  bg.addColorStop(0.6, pal.body);
  bg.addColorStop(1, pal.dark);
  g.fillStyle = bg;
  g.beginPath();
  g.arc(cx, cy, 19, 0, 7);
  g.fill();
  g.strokeStyle = "rgba(10,5,5,0.8)";
  g.lineWidth = 1.6;
  g.stroke();
  // gaping maw
  g.fillStyle = "#1d0306";
  g.beginPath();
  g.ellipse(cx, cy + 3, 15, open, 0, 0, 7);
  g.fill();
  g.fillStyle = "#4a0a10";
  g.beginPath();
  g.ellipse(cx, cy + 5, 9, open * 0.5, 0, 0, 7);
  g.fill();
  // tongue when lunging
  if (pose.attack) {
    g.fillStyle = "#8f2030";
    g.beginPath();
    g.ellipse(cx, cy + 8, 4, 7, 0, 0, 7);
    g.fill();
  }
  fangRow(g, cx - 14, cy + 3 - open, 28, 7, 5, true);
  fangRow(g, cx - 13, cy + 2 + open, 26, 6, 4.5, false);
  // beady eyes high on the body
  if (!pose.pain) {
    glowEye(g, cx - 7, cy - 13, 1.2, "#ffd24a");
    glowEye(g, cx + 7, cy - 13, 1.2, "#ffd24a");
  }
  // drool
  g.strokeStyle = "rgba(200,230,170,0.6)";
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(cx - 9, cy + 3 + open);
  g.lineTo(cx - 10, cy + 9 + open);
  g.stroke();
}

// Husk — a charred corpse held together by burning cracks
function drawHusk(g, pal, pose) {
  const cx = 32, step = pose.step ? 2.5 : -2.5;
  // flame wisps
  for (const [fx, fy] of [[cx - 9, 12], [cx + 10, 14], [cx + (pose.attack ? 16 : 6), pose.attack ? 26 : 10]]) {
    const fl = g.createRadialGradient(fx, fy, 0.5, fx, fy, 5);
    fl.addColorStop(0, "#ffe9a0");
    fl.addColorStop(0.5, "#ff8a20");
    fl.addColorStop(1, "rgba(200,60,0,0)");
    g.fillStyle = fl;
    g.beginPath();
    g.ellipse(fx, fy - 2, 3.5, 6, 0, 0, 7);
    g.fill();
  }
  // legs
  g.fillStyle = pal.dark;
  g.fillRect(cx - 8 + step, 44, 6, 16);
  g.fillRect(cx + 2 - step, 44, 6, 16);
  // torso
  const bg = g.createLinearGradient(0, 14, 0, 46);
  bg.addColorStop(0, pal.body);
  bg.addColorStop(1, pal.dark);
  g.fillStyle = bg;
  g.beginPath();
  g.moveTo(cx - 12, 18);
  g.lineTo(cx + 12, 18);
  g.lineTo(cx + 9, 46);
  g.lineTo(cx - 9, 46);
  g.closePath();
  g.fill();
  // ember cracks
  g.strokeStyle = "#ff9a2a";
  g.lineWidth = 1.3;
  g.shadowColor = "#ff7a00";
  g.shadowBlur = 3;
  for (const pts of [[[cx - 8, 22], [cx - 4, 28], [cx - 7, 35]], [[cx + 3, 20], [cx + 6, 27], [cx + 3, 33], [cx + 6, 40]], [[cx - 2, 36], [cx + 1, 42]]]) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (const [px, py] of pts.slice(1)) g.lineTo(px, py);
    g.stroke();
  }
  g.shadowBlur = 0;
  // arms; attack pose hurls fire
  g.strokeStyle = pal.body;
  g.lineWidth = 3;
  g.beginPath();
  if (pose.attack) {
    g.moveTo(cx + 10, 22); g.lineTo(cx + 16, 24); g.lineTo(cx + 17, 27);
    g.moveTo(cx - 10, 22); g.lineTo(cx - 15, 30);
  } else {
    g.moveTo(cx + 10, 22); g.lineTo(cx + 14, 32); g.lineTo(cx + 12, 40);
    g.moveTo(cx - 10, 22); g.lineTo(cx - 14, 32); g.lineTo(cx - 12, 40);
  }
  g.stroke();
  if (pose.attack) {
    const fb = g.createRadialGradient(cx + 18, 26, 0.5, cx + 18, 26, 6);
    fb.addColorStop(0, "#fff3c0");
    fb.addColorStop(0.5, "#ff9a20");
    fb.addColorStop(1, "rgba(255,90,0,0)");
    g.fillStyle = fb;
    g.beginPath();
    g.arc(cx + 18, 26, 6, 0, 7);
    g.fill();
  }
  // head
  g.fillStyle = pal.body;
  g.beginPath();
  g.arc(cx, 12, 6.5, 0, 7);
  g.fill();
  if (!pose.pain) {
    glowEye(g, cx - 2.6, 11, 1.1, "#ff9a2a");
    glowEye(g, cx + 2.6, 11, 1.1, "#ff9a2a");
  }
  g.fillStyle = "#1d0a04";
  g.fillRect(cx - 3, 15, 6, 1.6);
}

// Shrieker — a pale banshee, all mouth and stringy hair
function drawShrieker(g, pal, pose) {
  const cx = 32, sway = pose.step ? 2 : -2;
  // robes
  const grad = g.createLinearGradient(0, 16, 0, 58);
  grad.addColorStop(0, pal.lite);
  grad.addColorStop(1, pal.dark);
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(cx + sway, 16);
  g.quadraticCurveTo(cx + 14 + sway, 30, cx + 12, 58);
  let x = cx + 12;
  for (let i = 0; i < 5; i++) g.lineTo(x - i * 5 - 3, i % 2 ? 52 : 58);
  g.quadraticCurveTo(cx - 14 + sway, 30, cx + sway, 16);
  g.closePath();
  g.fill();
  // hands clutching head when screaming
  if (pose.attack) {
    g.strokeStyle = pal.lite;
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(cx - 12, 28); g.lineTo(cx - 11, 16);
    g.moveTo(cx + 12, 28); g.lineTo(cx + 11, 16);
    g.stroke();
  }
  // head
  g.fillStyle = "#cfc4bb";
  g.beginPath();
  g.ellipse(cx + sway * 0.5, 13, 8, 9.5, 0, 0, 7);
  g.fill();
  // stringy hair
  g.strokeStyle = "#1c1a20";
  g.lineWidth = 1.4;
  for (let i = -3; i <= 3; i++) {
    g.beginPath();
    g.moveTo(cx + i * 2.4 + sway * 0.5, 5);
    g.quadraticCurveTo(cx + i * 4 + sway, 16, cx + i * 4.6 + sway, 26 + Math.abs(i) * 2);
    g.stroke();
  }
  // sunken eyes
  g.fillStyle = "#0c0c10";
  g.beginPath();
  g.ellipse(cx - 3.2 + sway * 0.5, 11, 1.9, 2.6, 0, 0, 7);
  g.ellipse(cx + 3.2 + sway * 0.5, 11, 1.9, 2.6, 0, 0, 7);
  g.fill();
  if (!pose.pain) {
    glowEye(g, cx - 3.2 + sway * 0.5, 11, 0.8, "#cfd8ff");
    glowEye(g, cx + 3.2 + sway * 0.5, 11, 0.8, "#cfd8ff");
  }
  // the scream
  const open = pose.attack ? 7.5 : 3;
  g.fillStyle = "#0a0508";
  g.beginPath();
  g.ellipse(cx + sway * 0.5, 18, 3.6, open, 0, 0, 7);
  g.fill();
  if (pose.attack) {
    // sound rings
    g.strokeStyle = "rgba(207,216,255,0.5)";
    g.lineWidth = 1.2;
    for (let i = 1; i <= 2; i++) {
      g.beginPath();
      g.arc(cx + sway * 0.5, 18, 6 + i * 5, -0.7, 0.7);
      g.stroke();
      g.beginPath();
      g.arc(cx + sway * 0.5, 18, 6 + i * 5, Math.PI - 0.7, Math.PI + 0.7);
      g.stroke();
    }
  }
}

const SPRITES = {
  groomp: buildEnemySheet({ body: "#3aa32a", lite: "#7ed64f", dark: "#16500f" }),
  spitter: buildEnemySheet({ body: "#a836a8", lite: "#e07ae0", dark: "#561256" }),
  boss: buildEnemySheet({ body: "#b03426", lite: "#e8784f", dark: "#5a1009", horns: true }),
  wraith: buildSheet(drawWraith, { body: "#2e3440", lite: "#4a5468", dark: "#14171f" }),
  skitter: buildSheet(drawSkitter, { body: "#3a2c22", lite: "#6b5239", dark: "#1a120c" }),
  brute: buildSheet(drawBrute, { body: "#7a3a2e", lite: "#b06a4a", dark: "#3a1410" }),
  watcher: buildSheet(drawWatcher, { body: "#7a1a66", lite: "#c34aa8", dark: "#380a30" }),
  hollow: buildSheet(drawHollow, { body: "#5a6258", lite: "#8a948c", dark: "#23282a", glow: "#9fe24a" }),
  maw: buildSheet(drawMaw, { body: "#6e1f24", lite: "#a8453a", dark: "#330a10" }),
  husk: buildSheet(drawHusk, { body: "#241d18", lite: "#46362a", dark: "#0e0b08" }),
  shrieker: buildSheet(drawShrieker, { body: "#5e5a6e", lite: "#928da6", dark: "#28253a" }),
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
// Pre-rendered first-person guns (drawn once at 2x for crispness).
// Each entry: {c, w, h, mx, my} with the muzzle point in local coords.

function gunCanvas(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w * 2;
  c.height = h * 2;
  const g = c.getContext("2d");
  g.scale(2, 2);
  draw(g);
  return c;
}

function glove(g, x, y, rx, ry, rot, dark) {
  g.fillStyle = dark ? "#43301f" : "#4a3526";
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, 7);
  g.fill();
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.ellipse(x - rx * 0.5 + i * rx * 0.45, y - ry * 0.55 + i * 2, rx * 0.32, ry * 0.6, rot, 0, 7);
    g.fill();
  }
  g.fillStyle = "rgba(255,220,180,0.13)";
  g.beginPath();
  g.ellipse(x - rx * 0.3, y - ry * 0.2, rx * 0.45, ry * 0.35, rot, 0, 7);
  g.fill();
}

// cylinder-shaded vertical barrel, narrowing toward the muzzle
function barrelShape(g, cx, topY, botY, topHalf, botHalf, hues) {
  const grad = g.createLinearGradient(cx - botHalf, 0, cx + botHalf, 0);
  grad.addColorStop(0, hues[0]);
  grad.addColorStop(0.32, hues[1]);
  grad.addColorStop(0.5, hues[2]);
  grad.addColorStop(0.68, hues[1]);
  grad.addColorStop(1, hues[0]);
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(cx - topHalf, topY);
  g.lineTo(cx + topHalf, topY);
  g.lineTo(cx + botHalf, botY);
  g.lineTo(cx - botHalf, botY);
  g.closePath();
  g.fill();
}

const STEEL = ["#0f1116", "#444c5a", "#6a7588"];
const WEAPON_W = 190, WEAPON_H = 170;

const GUN_BLASTER = (() => {
  const c = gunCanvas(WEAPON_W, WEAPON_H, g => {
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
  glove(g, cx + 44, 156, 20, 16, 0.5, true);
  });
  return { c, w: WEAPON_W, h: WEAPON_H, mx: 95, my: 14, cell: { x: 95 - 26, y: 126, w: 30, h: 16 } };
})();

const GUN_MALLET = (() => {
  const w = 150, h = 175;
  const c = gunCanvas(w, h, g => {
    const cx = 75;
    // handle
    const hg = g.createLinearGradient(cx - 7, 0, cx + 7, 0);
    hg.addColorStop(0, "#3a2812");
    hg.addColorStop(0.5, "#7a5526");
    hg.addColorStop(1, "#2c1e0e");
    g.fillStyle = hg;
    g.fillRect(cx - 7, 52, 14, 123);
    // grip wraps
    g.fillStyle = "rgba(0,0,0,0.35)";
    for (let i = 0; i < 5; i++) g.fillRect(cx - 7, 120 + i * 9, 14, 4);
    // head
    const mg = g.createLinearGradient(cx - 42, 0, cx + 42, 0);
    mg.addColorStop(0, "#1c1f26");
    mg.addColorStop(0.5, "#5a6374");
    mg.addColorStop(1, "#14161c");
    g.fillStyle = mg;
    g.fillRect(cx - 42, 14, 84, 44);
    g.fillStyle = "rgba(255,255,255,0.14)";
    g.fillRect(cx - 42, 14, 84, 4);
    g.fillStyle = "rgba(0,0,0,0.4)";
    g.fillRect(cx - 42, 52, 84, 6);
    // spikes
    g.fillStyle = "#9aa2b2";
    for (const sx of [-30, 0, 30]) {
      g.beginPath();
      g.moveTo(cx + sx - 7, 14);
      g.lineTo(cx + sx + 7, 14);
      g.lineTo(cx + sx, 0);
      g.closePath();
      g.fill();
    }
    // old blood
    g.fillStyle = "rgba(140,20,12,0.5)";
    g.beginPath();
    g.ellipse(cx + 20, 40, 12, 8, 0.4, 0, 7);
    g.fill();
    g.fillRect(cx + 26, 48, 4, 14);
    glove(g, cx + 2, 158, 19, 14, 0.1, true);
  });
  return { c, w, h, mx: 75, my: 8 };
})();

const GUN_SHOTGUN = (() => {
  const w = 200, h = 170;
  const c = gunCanvas(w, h, g => {
    const cx = 100;
    // twin barrels
    barrelShape(g, cx - 12, 22, 92, 9, 13, STEEL);
    barrelShape(g, cx + 12, 22, 92, 9, 13, STEEL);
    for (const bx of [-12, 12]) {
      g.fillStyle = "#586070";
      g.beginPath();
      g.ellipse(cx + bx, 22, 9, 4.5, 0, 0, 7);
      g.fill();
      g.fillStyle = "#07090c";
      g.beginPath();
      g.ellipse(cx + bx, 22, 6, 3, 0, 0, 7);
      g.fill();
    }
    // wooden fore-end / pump
    const wd = g.createLinearGradient(cx - 30, 0, cx + 30, 0);
    wd.addColorStop(0, "#2e1d0c");
    wd.addColorStop(0.5, "#7a5526");
    wd.addColorStop(1, "#241608");
    g.fillStyle = wd;
    g.fillRect(cx - 28, 92, 56, 26);
    g.fillStyle = "rgba(0,0,0,0.3)";
    for (let i = 0; i < 3; i++) g.fillRect(cx - 28, 98 + i * 7, 56, 2.5);
    // receiver
    const recv = g.createLinearGradient(cx - 36, 0, cx + 36, 0);
    recv.addColorStop(0, "#15171d");
    recv.addColorStop(0.5, "#3d4452");
    recv.addColorStop(1, "#101218");
    g.fillStyle = recv;
    g.beginPath();
    g.moveTo(cx - 30, 118);
    g.lineTo(cx + 30, 118);
    g.lineTo(cx + 40, 170);
    g.lineTo(cx - 40, 170);
    g.closePath();
    g.fill();
    g.fillStyle = "#0a0b0e";
    g.fillRect(cx - 18, 126, 36, 5);
    glove(g, cx - 38, 104, 17, 13, -0.4);
    glove(g, cx + 42, 152, 19, 15, 0.5, true);
  });
  return { c, w, h, mx: 100, my: 20 };
})();

const GUN_CHAINGUN = (() => {
  const w = 210, h = 170;
  const c = gunCanvas(w, h, g => {
    const cx = 105;
    // six-barrel drum
    g.fillStyle = "#15171d";
    g.beginPath();
    g.ellipse(cx, 34, 34, 22, 0, 0, 7);
    g.fill();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + 0.26;
      const bx = cx + Math.cos(a) * 19, by = 34 + Math.sin(a) * 12;
      g.fillStyle = "#3c4452";
      g.beginPath();
      g.ellipse(bx, by, 8, 5.5, 0, 0, 7);
      g.fill();
      g.fillStyle = "#06070a";
      g.beginPath();
      g.ellipse(bx, by, 5, 3.4, 0, 0, 7);
      g.fill();
    }
    g.fillStyle = "#586070";
    g.beginPath();
    g.arc(cx, 34, 6, 0, 7);
    g.fill();
    // shroud down to housing
    barrelShape(g, cx, 50, 110, 32, 40, ["#101218", "#3a414e", "#566074"]);
    g.fillStyle = "rgba(0,0,0,0.4)";
    for (let i = 0; i < 3; i++) g.fillRect(cx - 34, 62 + i * 16, 68, 4);
    // housing
    const recv = g.createLinearGradient(cx - 48, 0, cx + 48, 0);
    recv.addColorStop(0, "#14161c");
    recv.addColorStop(0.5, "#3d4452");
    recv.addColorStop(1, "#0f1116");
    g.fillStyle = recv;
    g.fillRect(cx - 46, 110, 92, 60);
    // ammo belt
    g.fillStyle = "#1c1f26";
    g.fillRect(cx - 64, 122, 22, 40);
    for (let i = 0; i < 5; i++) {
      g.fillStyle = "#c9a227";
      g.fillRect(cx - 60, 126 + i * 8, 14, 4.5);
    }
    g.fillStyle = "#0a0b0e";
    g.fillRect(cx - 30, 120, 60, 6);
    glove(g, cx + 48, 150, 19, 15, 0.5, true);
  });
  return { c, w, h, mx: 105, my: 30 };
})();

const GUN_ROCKET = (() => {
  const w = 210, h = 170;
  const c = gunCanvas(w, h, g => {
    const cx = 105;
    // fat tube
    barrelShape(g, cx, 30, 122, 30, 42, ["#14161c", "#3c4452", "#5a6476"]);
    // muzzle opening with loaded rocket visible
    g.fillStyle = "#586070";
    g.beginPath();
    g.ellipse(cx, 30, 30, 12, 0, 0, 7);
    g.fill();
    g.fillStyle = "#060709";
    g.beginPath();
    g.ellipse(cx, 30, 24, 9, 0, 0, 7);
    g.fill();
    const rg = g.createRadialGradient(cx - 3, 28, 1, cx, 30, 12);
    rg.addColorStop(0, "#e8a08a");
    rg.addColorStop(0.6, "#b03426");
    rg.addColorStop(1, "#5a1009");
    g.fillStyle = rg;
    g.beginPath();
    g.ellipse(cx, 30, 11, 5.5, 0, 0, 7);
    g.fill();
    // bands
    g.fillStyle = "rgba(0,0,0,0.42)";
    g.fillRect(cx - 33, 52, 66, 5);
    g.fillRect(cx - 38, 92, 76, 5);
    // hazard ring
    g.save();
    g.beginPath();
    g.rect(cx - 36, 70, 72, 9);
    g.clip();
    g.fillStyle = "#8f7a1e";
    g.fillRect(cx - 36, 70, 72, 9);
    g.fillStyle = "#15151a";
    for (let x = -40; x < 44; x += 12) {
      g.beginPath();
      g.moveTo(cx + x, 79);
      g.lineTo(cx + x + 5, 70);
      g.lineTo(cx + x + 10, 70);
      g.lineTo(cx + x + 5, 79);
      g.closePath();
      g.fill();
    }
    g.restore();
    // sight
    g.fillStyle = "#1c1f26";
    g.fillRect(cx + 26, 40, 8, 30);
    g.fillStyle = "#3fe06a";
    g.fillRect(cx + 28, 44, 4, 4);
    // base housing
    g.fillStyle = "#181b22";
    g.fillRect(cx - 46, 122, 92, 48);
    glove(g, cx - 44, 138, 18, 14, -0.4);
    glove(g, cx + 46, 152, 19, 15, 0.5, true);
  });
  return { c, w, h, mx: 105, my: 26 };
})();

const GUN_PLASMA = (() => {
  const w = 200, h = 170;
  const c = gunCanvas(w, h, g => {
    const cx = 100;
    // snout
    barrelShape(g, cx, 26, 100, 22, 32, ["#101820", "#2c4438", "#3e6450"]);
    // emitter
    g.fillStyle = "#0a0f0c";
    g.beginPath();
    g.ellipse(cx, 26, 20, 8, 0, 0, 7);
    g.fill();
    const em = g.createRadialGradient(cx, 26, 1, cx, 26, 14);
    em.addColorStop(0, "#d8ffd0");
    em.addColorStop(0.5, "#3fe06a");
    em.addColorStop(1, "rgba(20,120,40,0)");
    g.fillStyle = em;
    g.beginPath();
    g.ellipse(cx, 26, 14, 6, 0, 0, 7);
    g.fill();
    // glowing coils
    for (let i = 0; i < 3; i++) {
      const y = 44 + i * 20;
      g.fillStyle = "#0c1410";
      g.fillRect(cx - 26 - i * 2, y, 52 + i * 4, 9);
      g.fillStyle = "rgba(63,224,106,0.85)";
      g.fillRect(cx - 24 - i * 2, y + 2.5, 48 + i * 4, 4);
      g.fillStyle = "rgba(200,255,210,0.8)";
      g.fillRect(cx - 24 - i * 2, y + 3.6, 48 + i * 4, 1.4);
    }
    // housing
    const recv = g.createLinearGradient(cx - 40, 0, cx + 40, 0);
    recv.addColorStop(0, "#121a16");
    recv.addColorStop(0.5, "#2c4438");
    recv.addColorStop(1, "#0e1410");
    g.fillStyle = recv;
    g.beginPath();
    g.moveTo(cx - 34, 100);
    g.lineTo(cx + 34, 100);
    g.lineTo(cx + 42, 170);
    g.lineTo(cx - 42, 170);
    g.closePath();
    g.fill();
    g.fillStyle = "#06090a";
    for (let i = 0; i < 3; i++) g.fillRect(cx + 12, 110 + i * 9, 24, 4);
    glove(g, cx - 40, 116, 17, 13, -0.4);
    glove(g, cx + 44, 154, 19, 15, 0.5, true);
  });
  return { c, w, h, mx: 100, my: 22 };
})();

const GUN_GBFG = (() => {
  const w = 240, h = 170;
  const c = gunCanvas(w, h, g => {
    const cx = 120;
    // wide monster housing
    barrelShape(g, cx, 36, 130, 52, 70, ["#101a12", "#23402a", "#356044"]);
    // triple emitter orbs
    for (const [ox, oy, r] of [[-26, 38, 12], [26, 38, 12], [0, 26, 15]]) {
      g.fillStyle = "#06120a";
      g.beginPath();
      g.arc(cx + ox, oy, r + 3, 0, 7);
      g.fill();
      const og = g.createRadialGradient(cx + ox - r * 0.3, oy - r * 0.3, 1, cx + ox, oy, r);
      og.addColorStop(0, "#e8ffe0");
      og.addColorStop(0.5, "#52e07a");
      og.addColorStop(1, "#0e5a26");
      g.fillStyle = og;
      g.beginPath();
      g.arc(cx + ox, oy, r, 0, 7);
      g.fill();
    }
    // cables
    g.strokeStyle = "#1a2a1e";
    g.lineWidth = 5;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + s * 40, 60);
      g.bezierCurveTo(cx + s * 66, 80, cx + s * 50, 110, cx + s * 58, 134);
      g.stroke();
    }
    g.strokeStyle = "#2c4a34";
    g.lineWidth = 2;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + s * 40, 60);
      g.bezierCurveTo(cx + s * 66, 80, cx + s * 50, 110, cx + s * 58, 134);
      g.stroke();
    }
    // vents and plate lines
    g.fillStyle = "rgba(0,0,0,0.45)";
    g.fillRect(cx - 56, 78, 112, 6);
    g.fillRect(cx - 62, 110, 124, 6);
    g.fillStyle = "#0a140c";
    for (let i = 0; i < 4; i++) g.fillRect(cx - 20 + i * 12, 90, 7, 14);
    // base
    g.fillStyle = "#142018";
    g.fillRect(cx - 70, 130, 140, 40);
    glove(g, cx - 62, 144, 19, 15, -0.4);
    glove(g, cx + 62, 150, 20, 16, 0.5, true);
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

const HUD_PANELS = {
  health: { x: 20, y: 8, w: 120, h: 48, cx: 80 },
  ammo:   { x: 150, y: 8, w: 120, h: 48, cx: 210 },
  face:   { x: 291, y: 5, w: 58, h: 54, cx: 320 },
  kills:  { x: 370, y: 8, w: 120, h: 48, cx: 430 },
  hints:  { x: 500, y: 8, w: 126, h: 48, cx: 563 },
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

  // hazard-stripe end caps
  for (const x0 of [0, 630]) {
    g.save();
    g.beginPath();
    g.rect(x0, 3, 10, 58);
    g.clip();
    g.fillStyle = "#8f7a1e";
    g.fillRect(x0, 3, 10, 58);
    g.fillStyle = "#16161a";
    for (let y = -10; y < 70; y += 10) {
      g.beginPath();
      g.moveTo(x0, y + 10);
      g.lineTo(x0 + 10, y);
      g.lineTo(x0 + 10, y + 5);
      g.lineTo(x0, y + 15);
      g.closePath();
      g.fill();
    }
    g.restore();
    g.fillStyle = "rgba(0,0,0,0.4)";
    g.fillRect(x0 + (x0 ? -1.5 : 10), 3, 1.5, 58);
  }

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
  for (const x of [145, 280, 360, 494]) {
    screw(x, 10);
    screw(x, 54);
  }
  screw(16, 32);
  screw(624, 32);

  return c;
})();
