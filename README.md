# GROOMP

A Doom-like first-person shooter that runs entirely in the browser. The
Groomplex is overrun with one-eyed hopping blobs — groomps — and you are the
exterminator, sixty floors from the thing that breeds them.

No build step, no dependencies, no asset files: the renderer is a software
raycaster drawing pixel-by-pixel into a 1280×800 canvas, and every texture,
sprite, sound — and every one of the sixty floors — is generated procedurally
at load time.

## Play

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

Pick a difficulty with `↑`/`↓`, then click the screen to descend (this also
grabs the mouse pointer).

## The descent

The campaign is three worlds of twenty floors each, straight down:

1. **The Groomplex** — the extermination facility itself: offices, labs,
   server rooms, and the things that emptied them. The Overgroomp holds the
   freight elevator on floor 20.
2. **The Sump** — the drowned maintenance decks. Wading through water slows
   you down; the green sludge does that *and* burns. The Sludge King floats
   in the pump-well.
3. **The Spawning Dark** — the hive under everything, veined with acid.
   The Groompfather waits at the bottom.

Every floor is carved by a seeded generator, so floor 7 is always the same
floor 7 — but nobody ever drew it. Each floor ends at a glowing exit pad, a
stairwell, or an elevator that rumbles you down to the next one. Your guns
and ammo carry between floors; dying restarts the floor with what you walked
in with. Progress saves automatically — press `C` on the title screen to
continue a descent.

Four difficulties — **Easy**, **Normal**, **Hard**, **Brutal** — scale
monster health, damage, speed, aggression, headcount, and how far a medkit
goes.

Monsters have no discipline: a stray spitball that hits the wrong groomp
starts a fight you can watch from cover.

## Desktop app

The game also runs as a native desktop app via a thin Electron shell
(`desktop/main.cjs` — the game code is identical):

```sh
npm install
npm start        # launch the desktop app
npm run dist     # build a real installer into dist/
```

`npm run dist` produces a Windows installer (NSIS), a macOS `.dmg`, or a
Linux AppImage, depending on the platform you run it on. In the app,
`F11` toggles fullscreen and `Esc` leaves it.

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
| `R` | Retry the floor |
| `↑` `↓` | Choose difficulty (title screen) |
| `C` | Continue a saved descent (title screen) |

## The arsenal

You start with the mallet and the blaster; the other five are lost somewhere
on the way down.

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
will hear about it. Deeper worlds field meaner mixes, minibosses hold floor
10 of each world, and a boss holds floor 20.

Take down what you can, then find the way down — exit pad, stairwell, or
elevator. Medkits heal, ammo caches top up every pool, toxic barrels explode
for both sides, water slows everyone wading through it, and the glowing
sludge burns whoever stands in it — you included.

## How it works

- **Walls** — classic grid raycasting (DDA), one textured column per screen
  column, with distance fog and a z-buffer.
- **Floors & ceilings** — per-scanline floor casting, with per-cell floor
  types: stone, water and toxic sludge (two-frame animated), stairs,
  elevator platforms, and the exit pad.
- **Enemies, pickups, projectiles** — z-buffered billboard sprites with a
  small state machine per enemy (idle → chase → attack / pain → dead).
  Enemies track a target — normally you, but a stray hit from another
  monster starts Doom-style infighting.
- **Lighting** — per-cell sector-style light levels with flickering cells,
  bright pools under hanging lamps and around the exits, and a faint glow
  off the sludge.
- **Set dressing** — hanging lamps, bone piles, blood particles, and
  exploding toxic barrels that chain-react and hurt everything nearby.
- **Art** — all textures and sprite frames are drawn onto offscreen canvases
  with the 2D API at load time (`js/assets.js`).
- **Sound** — synthesized with WebAudio oscillators and noise buffers
  (`js/audio.js`), including the dread-pulse soundtrack.
- **The levels** — a seeded room-and-corridor generator at the top of
  `js/game.js` builds all 60 floors from the world definitions (wall
  palette, liquid frequency, enemy pool, plot text). Same seed, same floor,
  forever — tweak the `WORLDS` table to reshape the campaign.
