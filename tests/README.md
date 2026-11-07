# End-to-end tests

Playwright (Chromium, software WebGL) drives the production build through the `?debug` hooks
(`window.__home`: the zustand store, `playerState`, `teleport`, `look`, `camera`, `scene`, `gl`, `physics`).
Tests assert behaviour via the store and the player state, never exact copy, and pixels only once: the bad-pixel test in `06` measures the share of pure-black pixels, because that bug was purely visual.

## Run

```bash
npm ci
npx playwright install chromium          # once (CI does this with --with-deps)
npm run test:e2e                         # builds, serves on :4185, runs everything sequentially
```

Offline / sandbox with a preinstalled browser:

```bash
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e
```

If something is already serving the build on port 4185 it is reused (outside CI). Software rendering is slow
(1-5 fps), so timeouts are generous; the whole run takes roughly 7-9 minutes. One worker, one browser: don't parallelise.

One browser page is shared by the whole run (`helpers.ts`, the worker-scoped `game` fixture) because booting
the scene takes a minute or more. `game.ready()` resets the world before each test (spawn, nothing open or carried,
lamps on, door shut), so tests are independent in effect. The files run in order: `01-boot` boots the page.

## What each test guards

| Spec | Guards |
|---|---|
| `01-boot` | Boots without console errors / page errors (two known library warnings are ignored); intro -> playing; first person by default with the camera 1.5-1.8 m above the floor (median of samples); holding W moves the player. |
| `02-interactions` | Aim-based interaction in first person: the living-room screen is offered, E opens it, Esc closes it; the notebook can be picked up and dropped; the floor lamp toggles; the kitchen <-> bedroom door opens and closes. |
| `03-settings` | Esc opens the settings drawer; a toggle is written to localStorage and survives a reload. |
| `04-physics` | Jumping repeatedly on the kitchen island (looking up too) never puts the camera above 3.0 m; a grid of reachable standing spots (physics capsule fits) has no eye point inside a solid mesh (ray parity test with a self-check; ShaderMaterial / transparent meshes ignored); a body put below the ground or far over the hedge comes back to the start. |
| `05-budget-and-fallback` | Scene pass (one extra `gl.render`, shadow maps excluded) under 700 draw calls and 250k triangles in three rooms; a page without WebGL shows the failure message and a disabled intro button; the shared session had no console errors at the end. |
| `06-quality-and-resilience` | Fresh boots on `quality=high` and `quality=medium` (full post chain: AO, depth of field, MSAA, bloom) walk without console errors; the depth-of-field switch is only enabled on High; *Copy diagnostics* yields a JSON report with GPU, app state and camera; a lost WebGL context shows the reset notice, and restoring it offers *Continue*; an open content panel stops the 3D rendering (0 frames), closing it resumes rendering and walking; a NaN- and an Inf-emitting 3 cm speck in view stays a speck (under 2 % pure-black pixels — without the guard in `src/lib/hdrGuard.ts` the bloom turned it into a black screen, ~99 %). |
| `07-phone` | Its own page as a phone (390×720, touch, coarse pointer): joystick and jump button shown, no action button while there is nothing to do; the scene's container has `touch-action: none` and the page no horizontal overflow; pushing the stick walks; a touch drag turns the view and a second finger landing elsewhere does not move it; in front of the living-room screen the round action button (a screen glyph) and the label are offered clear of the stick and the jump button, and tapping the label opens the screen; turned to landscape (800×360) the stick, jump button and label stay on screen without overlapping. In the garden, a ripe bed behind you puts a hand with a lettuce and a turn-round arrow on the action button, the smaller buttons offer more things within reach, every button is on screen and clear of the others, and one tap harvests and turns the view to the bed. |
| `08-garden` | Walking out: from a few steps inside, the glass door opens and holding `W` takes the player (and the camera) out into the garden. A bed from seed to harvest with real keys: aimed at, `E` opens the seed panel, `1` plants lettuce (coins down by the seed price), after a fast-forward the bed asks for water and `E` waters it, then `E` harvests 4 lettuces. Two buyers queue at the gate: one action for the line shows the first request, `E` opens the line, `Enter` sells to the first you can (coins and stock change, they leave, the panel stays open for the rest); `N` sends the next one away (nothing changes hands) and a new buyer is due within seconds. A staked-out bed is built for 30 coins with `E`, and the farm is saved to localStorage. No console errors. |
| `09-farm-kitchen` | Milking: a cow held beside the pasture fence offers "Milk Bella · 1 bottle of milk" and `E` puts it in the basket. The mill: `E` opens it, *Mill 3* takes the wheat, after a fast-forward `E` collects 3 bags of flour. The oven: with flour, sugar, two eggs, milk and two lemons, *Bake* on the lemon cake uses them up and after a fast-forward `E` takes the cake out. Land: the west field's plot offers "Expand the farm: West field · 120 coins"; `E` builds all four beds, and key `8` plants sugar cane there. A buyer asking for one lemon cake is paid with `Enter` from the line's panel. No console errors. |
| `10-smart-farm` | Within reach: a ripe bed behind you (looking away, at the sky) is offered with a hand-and-lettuce icon and a turn-round hint; `E` harvests and turns the view to it. Sheep: a sheep held still offers "Shear Dolly · 1 fleece", `E` shears it and the fleece grows back; at the loom `E` puts the fleece on and, after a fast-forward, takes the roll of cloth off. The line at the gate: one buyer every two minutes until the five places are taken and nobody more while it is full; ten steps of *A longer queue* and six of *A busier lane* (no more than that) make fifteen places and one every thirty seconds, which fill up; the line is in the save; *Sell to everyone* serves all fifteen for the sum of their offers. No console errors. |

## When the layout changes

Coordinates of the TV, notebook, lamp, door and island come from `src/data/layout.ts` / `screens.ts`; if furniture
moves, adjust the teleport positions in `02-interactions` and `04-physics`. Failures keep a trace and screenshot in
`test-results/` (`npx playwright show-trace <trace.zip>`); CI uploads them as an artifact.
