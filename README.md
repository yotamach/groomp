# GROOMP

A Doom-like first-person shooter that runs entirely in the browser. The
Groomplex is overrun with one-eyed hopping blobs — groomps — and you are the
exterminator.

No build step, no dependencies, no asset files: the renderer is a software
raycaster drawing pixel-by-pixel into a 1280×800 canvas, and every texture,
sprite, and sound is generated procedurally at load time.

## Play

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

Click the screen to start (this also grabs the mouse pointer).

## Controls

| Input | Action |
|---|---|
| `W` `A` `S` `D` | Move / strafe |
| Mouse / `←` `→` | Turn |
| Click / `Space` | Shoot |
| `Shift` | Run |
| `M` | Toggle map |
| `N` | Toggle music |
| `R` | Restart |

## Goal

Blast your way through the brick halls, the stone gallery, and the slime den,
take down the Groompfather, and step onto the glowing green exit pad. Medkits
heal 25, ammo clips hold 10. Watch out for the purple spitters — they shoot
back.

## How it works

- **Walls** — classic grid raycasting (DDA), one textured column per screen
  column, with distance fog and a z-buffer.
- **Floors & ceilings** — per-scanline floor casting.
- **Enemies, pickups, projectiles** — z-buffered billboard sprites with a
  small state machine per enemy (idle → chase → attack / pain → dead).
- **Lighting** — per-cell sector-style light levels with flickering cells,
  bright pools under hanging lamps and around the exit pad.
- **Set dressing** — hanging lamps, bone piles, blood particles, and
  exploding toxic barrels that chain-react and hurt everything nearby.
- **Art** — all textures and sprite frames are drawn onto offscreen canvases
  with the 2D API at load time (`js/assets.js`).
- **Sound** — synthesized with WebAudio oscillators and noise buffers
  (`js/audio.js`), including the dread-pulse soundtrack.
- **The level** — an ASCII map at the top of `js/game.js`. Edit it to make
  your own Groomplex.
