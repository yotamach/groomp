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
| `1`–`7` / wheel | Switch weapon |
| `Shift` | Run |
| `M` | Toggle map |
| `N` | Toggle music |
| `R` | Restart |

## The arsenal

You start with the mallet and the blaster; the other five are lost somewhere
in the Groomplex.

1. **Mallet** — spiked, silent, always loaded
2. **Blaster** — infinite energy sidearm
3. **Shotgun** — seven pellets of opinion (shells)
4. **Chaingun** — hold the trigger and pray (bullets)
5. **Rocket launcher** — splash damage works both ways (rockets)
6. **Plasma rifle** — rapid green bolts (cells)
7. **GBFG** — deletes rooms, drinks 40 cells per shot

## The bestiary

Groomps and spitters are the least of your problems now: wraiths drift
through the dark, skitterlings hunt in packs, brutes soak whole clips,
watchers spit from the air, hollows lunge with bone claws, maws are mostly
teeth, husks throw fire, and if a shrieker sees you first, everything else
will hear about it. The Groompfather waits at the end.

Take down what you can, step onto the glowing green exit pad. Medkits heal
25; ammo caches top up every pool. Toxic barrels explode — for both sides.

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
