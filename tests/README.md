# End-to-end tests

Playwright (Chromium, software WebGL) drives the production build through the `?debug` hooks
(`window.__home`: the zustand store, `playerState`, `teleport`, `look`, `camera`, `scene`, `gl`, `physics`).
Tests assert behaviour via the store and the player state, never pixels or exact copy.

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
(1-5 fps), so timeouts are generous; the whole run takes roughly 4-5 minutes. One worker, one browser: don't parallelise.

One browser page is shared by the whole run (`helpers.ts`, the worker-scoped `game` fixture) because booting
the scene takes a minute or more. `game.ready()` resets the world before each test (spawn, nothing open or carried,
lamps on, door shut), so tests are independent in effect. The files run in order: `01-boot` boots the page.

## What each test guards

| Spec | Guards |
|---|---|
| `01-boot` | Boots without console errors / page errors (two known library warnings are ignored); intro -> playing; first person by default with the camera 1.5-1.8 m above the floor (median of samples); holding W moves the player. |
| `02-interactions` | Aim-based interaction in first person: the living-room screen is offered, E opens it, Esc closes it; the notebook can be picked up and dropped; the floor lamp toggles; the kitchen <-> bedroom door opens and closes. |
| `03-settings` | Esc opens the settings drawer; a toggle is written to localStorage and survives a reload. |
| `04-physics` | Jumping repeatedly on the kitchen island (looking up too) never puts the camera above 3.0 m; a grid of reachable standing spots (physics capsule fits) has no eye point inside a solid mesh (ray parity test with a self-check; ShaderMaterial / transparent meshes ignored). |
| `05-budget-and-fallback` | Scene pass (one extra `gl.render`, shadow maps excluded) under 700 draw calls and 250k triangles in three rooms; a page without WebGL shows the failure message and a disabled intro button; the shared session had no console errors at the end. |
| `06-quality-and-resilience` | Fresh boots on `quality=high` and `quality=medium` (full post chain: AO, depth of field, MSAA, bloom) walk without console errors; the depth-of-field switch is only enabled on High; *Copy diagnostics* yields a JSON report with GPU, app state and camera; a lost WebGL context shows the reset notice, and restoring it offers *Continue*; an open content panel stops the 3D rendering (0 frames), closing it resumes rendering and walking. |

## When the layout changes

Coordinates of the TV, notebook, lamp, door and island come from `src/data/layout.ts` / `screens.ts`; if furniture
moves, adjust the teleport positions in `02-interactions` and `04-physics`. Failures keep a trace and screenshot in
`test-results/` (`npx playwright show-trace <trace.zip>`); CI uploads them as an artifact.
