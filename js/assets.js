"use strict";
// GROOMP — procedural textures & sprites. No image files: everything is
// drawn onto offscreen canvases at load time and read back as Uint32Array
// pixel buffers (little-endian 0xAABBGGRR, same layout the renderer writes).

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

// ---------------------------------------------------------------- walls

const texBrick = makePixels(g => {
  g.fillStyle = "#3a1813";
  g.fillRect(0, 0, 64, 64);
  for (let row = 0; row < 4; row++) {
    const off = (row % 2) * 8 - 8;
    for (let col = 0; col < 5; col++) {
      const r = 105 + rnd() * 35 | 0;
      g.fillStyle = `rgb(${r},${42 + rnd() * 14 | 0},${34 + rnd() * 10 | 0})`;
      g.fillRect(col * 16 + off + 1, row * 16 + 1, 14, 14);
    }
  }
  addNoise(g, 22);
});

const texStone = makePixels(g => {
  g.fillStyle = "#26292c";
  g.fillRect(0, 0, 64, 64);
  const rows = [0, 14, 30, 46, 64];
  for (let r = 0; r < 4; r++) {
    let x = 0;
    while (x < 64) {
      const w = 10 + rnd() * 14 | 0;
      const v = 62 + rnd() * 32 | 0;
      g.fillStyle = `rgb(${v},${v + 5},${v + 9})`;
      g.fillRect(x + 1, rows[r] + 1, w - 2, rows[r + 1] - rows[r] - 2);
      x += w;
    }
  }
  addNoise(g, 24);
});

const texTech = makePixels(g => {
  g.fillStyle = "#15171f";
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = "#262b38";
  g.fillRect(2, 2, 60, 28);
  g.fillRect(2, 34, 60, 28);
  g.strokeStyle = "#0b0d13";
  g.strokeRect(2.5, 2.5, 59, 27);
  g.strokeRect(2.5, 34.5, 59, 27);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? "#3fe06a" : "#18602c";
    g.fillRect(8 + i * 14, 12, 6, 3);
  }
  g.fillStyle = "#3c4258";
  g.fillRect(8, 40, 48, 4);
  g.fillRect(8, 50, 48, 4);
  addNoise(g, 12);
});

const texSlime = makePixels(g => {
  g.fillStyle = "#16300f";
  g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = `rgba(${36 + rnd() * 40 | 0},${110 + rnd() * 90 | 0},${24 + rnd() * 30 | 0},0.35)`;
    g.beginPath();
    g.arc(rnd() * 64, rnd() * 64, 2 + rnd() * 6, 0, 7);
    g.fill();
  }
  g.fillStyle = "rgba(95,220,60,0.45)";
  for (let i = 0; i < 6; i++) {
    g.fillRect(2 + rnd() * 58, 0, 3, 10 + rnd() * 42);
  }
  addNoise(g, 16);
});

const texFloor = makePixels(g => {
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const v = ((x + y) % 2 ? 46 : 38) + rnd() * 8 | 0;
      g.fillStyle = `rgb(${v},${v - 2},${v - 4})`;
      g.fillRect(x * 8, y * 8, 8, 8);
    }
  }
  addNoise(g, 14);
});

const texCeil = makePixels(g => {
  g.fillStyle = "#14151a";
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = "#1c1e26";
  for (let i = 0; i < 24; i++) {
    g.fillRect(rnd() * 60, rnd() * 60, 3 + rnd() * 5, 3 + rnd() * 5);
  }
  addNoise(g, 8);
});

const texExitFloor = makePixels(g => {
  g.fillStyle = "#0d2a12";
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

// ---------------------------------------------------------------- enemies
// A "groomp" is a one-eyed hopping blob. Frames are drawn parametrically so
// every enemy type is the same creature in a different palette/size.

function drawGroompFrame(g, body, dark, opt) {
  const frame = opt.frame || 0;
  const mouth = opt.mouth || 0;
  const eye = opt.eye || "normal";
  const squish = opt.squish || 0;

  const cx = 32;
  const bottom = 60;
  const bounce = frame === 1 ? 3 : 0;
  const h = 42 * (1 - squish * 0.78);
  const w = 38 * (1 + squish * 0.55);

  if (squish < 0.6) {
    g.fillStyle = dark;
    g.beginPath();
    g.ellipse(cx - 11 + (frame === 1 ? 3 : 0), bottom - 2, 7, 4, 0, 0, 7);
    g.fill();
    g.beginPath();
    g.ellipse(cx + 11 - (frame === 1 ? 3 : 0), bottom - 2, 7, 4, 0, 0, 7);
    g.fill();
  }

  const bodyY = bottom - 4 - h / 2 + bounce;
  g.fillStyle = body;
  g.beginPath();
  g.ellipse(cx, bodyY, w / 2, h / 2, 0, 0, 7);
  g.fill();
  g.fillStyle = "rgba(0,0,0,0.20)";
  g.beginPath();
  g.ellipse(cx, bodyY + h * 0.28, w / 2.4, h / 4.2, 0, 0, 7);
  g.fill();
  // warts
  g.fillStyle = dark;
  g.beginPath(); g.arc(cx - w * 0.32, bodyY - h * 0.2, 2, 0, 7); g.fill();
  g.beginPath(); g.arc(cx + w * 0.3, bodyY - h * 0.05, 2.4, 0, 7); g.fill();
  g.beginPath(); g.arc(cx + w * 0.18, bodyY - h * 0.34, 1.8, 0, 7); g.fill();

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
    g.fillStyle = "#fff";
    g.beginPath(); g.ellipse(cx, eyeY, 9, 7, 0, 0, 7); g.fill();
    g.strokeStyle = "#101010";
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(cx - 5, eyeY - 4); g.lineTo(cx + 5, eyeY + 4);
    g.moveTo(cx + 5, eyeY - 4); g.lineTo(cx - 5, eyeY + 4);
    g.stroke();
  } else {
    g.fillStyle = "#fff";
    g.beginPath(); g.ellipse(cx, eyeY, 10, 8, 0, 0, 7); g.fill();
    g.fillStyle = "#c92a14";
    g.beginPath(); g.arc(cx, eyeY + 1, 4.5, 0, 7); g.fill();
    g.fillStyle = "#101010";
    g.beginPath(); g.arc(cx, eyeY + 1, 2.2, 0, 7); g.fill();
  }

  const mouthY = bodyY + h * 0.18;
  if (mouth) {
    g.fillStyle = "#400a0a";
    g.beginPath();
    g.ellipse(cx, mouthY + 3, w * 0.3, h * 0.2, 0, 0, 7);
    g.fill();
    g.fillStyle = "#fff";
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(cx + i * 6 - 2.5, mouthY - h * 0.14 + 4);
      g.lineTo(cx + i * 6 + 2.5, mouthY - h * 0.14 + 4);
      g.lineTo(cx + i * 6, mouthY - h * 0.14 + 11);
      g.closePath();
      g.fill();
    }
  } else if (squish < 0.4 && eye !== "dead") {
    g.strokeStyle = "#101010";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx - 8, mouthY);
    g.quadraticCurveTo(cx, mouthY + 5, cx + 8, mouthY);
    g.stroke();
    g.fillStyle = "#fff";
    g.beginPath();
    g.moveTo(cx - 6, mouthY + 1); g.lineTo(cx - 2, mouthY + 1); g.lineTo(cx - 4, mouthY + 6);
    g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(cx + 2, mouthY + 1); g.lineTo(cx + 6, mouthY + 1); g.lineTo(cx + 4, mouthY + 6);
    g.closePath(); g.fill();
  }

  if (squish > 0.8) {
    // final frame: a puddle
    g.clearRect(0, 0, 64, 64);
    g.fillStyle = dark;
    g.beginPath();
    g.ellipse(cx, bottom - 3, 24, 5, 0, 0, 7);
    g.fill();
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(cx - 4, bottom - 4, 16, 3.5, 0, 0, 7);
    g.fill();
  }
}

function buildEnemySheet(body, dark) {
  const f = opt => makePixels(g => drawGroompFrame(g, body, dark, opt));
  return {
    walk: [f({ frame: 0 }), f({ frame: 1 })],
    attack: f({ frame: 1, mouth: 1 }),
    pain: f({ frame: 0, eye: "pain" }),
    dead: [f({ squish: 0.3, eye: "dead" }), f({ squish: 0.65 }), f({ squish: 1 })],
  };
}

const SPRITES = {
  groomp: buildEnemySheet("#3aa32a", "#1d6414"),
  spitter: buildEnemySheet("#b03ab0", "#681d68"),
  boss: buildEnemySheet("#c0392b", "#6e1610"),
};

// ---------------------------------------------------------------- items

const SPR_HEALTH = makePixels(g => {
  g.fillStyle = "#d8d8e0";
  g.fillRect(14, 30, 36, 24);
  g.fillStyle = "#9a9aa6";
  g.fillRect(14, 50, 36, 4);
  g.fillStyle = "#c92a14";
  g.fillRect(28, 33, 8, 18);
  g.fillRect(23, 38, 18, 8);
});

const SPR_AMMO = makePixels(g => {
  g.fillStyle = "#6e5e20";
  g.fillRect(14, 36, 36, 18);
  g.fillStyle = "#4e4216";
  g.fillRect(14, 50, 36, 4);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = "#c9a227";
    g.fillRect(19 + i * 8, 26, 5, 12);
    g.fillStyle = "#e0e0e0";
    g.fillRect(19 + i * 8, 22, 5, 5);
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
