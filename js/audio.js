"use strict";
// GROOMP — all sound is synthesized with WebAudio; no audio files.

const Sfx = (() => {
  let ac = null;
  let musicOn = true;
  let musicStep = 0;
  let musicNext = 0;

  function init() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      setInterval(musicTick, 120);
    }
    if (ac.state === "suspended") ac.resume();
  }

  function blip(type, f0, f1, dur, vol, when = 0) {
    if (!ac) return;
    const t = ac.currentTime + when;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(f0, 1), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noiseBurst(dur, vol, cutoff) {
    if (!ac) return;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const f = ac.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = cutoff;
    const g = ac.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(ac.destination);
    src.start();
  }

  // Slow two-bar dread pulse in A. Zeroes are rests.
  const PAT = [55, 0, 0, 55, 0, 0, 65.4, 0, 55, 0, 0, 55, 0, 0, 49, 0];

  function musicTick() {
    if (!ac || !musicOn || ac.state !== "running") return;
    while (musicNext < ac.currentTime + 0.4) {
      const when = Math.max(0, musicNext - ac.currentTime);
      const f = PAT[musicStep % PAT.length];
      if (f) {
        blip("triangle", f, f, 0.5, 0.16, when);
        blip("sine", f * 2, f * 2, 0.3, 0.05, when);
      }
      if (musicStep % 8 === 4) noiseBurst(0.05, 0.05, 900);
      musicNext += 0.27;
      musicStep++;
    }
  }

  return {
    init,
    toggleMusic() { musicOn = !musicOn; return musicOn; },
    shoot() {
      noiseBurst(0.16, 0.5, 1700);
      blip("square", 170, 38, 0.13, 0.4);
    },
    fire(slot) {
      if (slot === 3) {        // shotgun
        noiseBurst(0.32, 0.7, 1100);
        blip("square", 110, 28, 0.26, 0.5);
      } else if (slot === 4) { // chaingun
        noiseBurst(0.07, 0.4, 2400);
        blip("square", 220, 70, 0.05, 0.28);
      } else if (slot === 5) { // rocket launch
        noiseBurst(0.45, 0.5, 750);
        blip("sawtooth", 85, 26, 0.5, 0.45);
      } else if (slot === 6) { // plasma
        blip("square", 880, 220, 0.12, 0.28);
        blip("sine", 1320, 330, 0.1, 0.18);
      } else if (slot === 7) { // the GBFG
        blip("sawtooth", 55, 220, 0.5, 0.5);
        blip("square", 28, 90, 0.65, 0.4);
        noiseBurst(0.5, 0.4, 520);
      } else {
        this.shoot();
      }
    },
    swing() { noiseBurst(0.12, 0.22, 650); },
    thunk() {
      blip("square", 95, 38, 0.13, 0.5);
      noiseBurst(0.09, 0.3, 420);
    },
    scream() {
      blip("sawtooth", 950, 210, 0.85, 0.35);
      blip("sawtooth", 1180, 320, 0.7, 0.25, 0.06);
      noiseBurst(0.4, 0.15, 3200);
    },
    empty() { blip("square", 1300, 900, 0.04, 0.12); },
    enemyHit() { blip("square", 520, 180, 0.09, 0.3); },
    enemyDie() {
      blip("square", 320, 32, 0.45, 0.4);
      noiseBurst(0.3, 0.3, 700);
    },
    growl() { blip("sawtooth", 95, 55, 0.35, 0.3); },
    boom() {
      noiseBurst(0.5, 0.6, 900);
      blip("sawtooth", 90, 24, 0.6, 0.55);
      blip("square", 50, 18, 0.8, 0.4, 0.05);
    },
    spit() { blip("sine", 750, 180, 0.22, 0.25); },
    hurt() {
      blip("sawtooth", 120, 50, 0.28, 0.5);
      noiseBurst(0.12, 0.25, 500);
    },
    die() {
      blip("sawtooth", 200, 30, 1.1, 0.5);
      noiseBurst(0.6, 0.35, 400);
    },
    pickup() {
      blip("square", 660, 660, 0.07, 0.22);
      blip("square", 990, 990, 0.09, 0.22, 0.07);
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => blip("square", f, f, 0.22, 0.25, i * 0.13));
    },
  };
})();
