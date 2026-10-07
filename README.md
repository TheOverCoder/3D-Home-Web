# 3D Home

A walkable 3D house for the web. Move a character through the rooms, pick things up, open doors and
switch lights — and walk up to a screen in each room to open its content. Static build, deployable on GitHub Pages.

**Stack:** Vite · React 19 · TypeScript · three.js · @react-three/fiber · drei · Rapier (physics) · ecctrl (character controller) ·
postprocessing (N8AO, bloom, AgX) · zustand.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build → dist/
npm run preview
```

Add `?debug` to the URL to expose `window.__home` (store, player state, `teleport(x,y,z)`), and `?quality=high|low` to pin graphics.

## Controls

`WASD`/arrows walk · `Shift` run · `Space` jump · drag to look · wheel to zoom · `E` interact · `Esc` close a screen.
On touch devices an on-screen joystick and buttons appear.

## What is in the box

| | |
|---|---|
| **Rooms** | Studio, kitchen, living room, bedroom — floor plan, doorways, lamps, pickups and spawn live in `src/data/layout.ts`. |
| **Screens** | Each room has a wall screen (live canvas texture) plus a floating 3D bar chart on a pedestal. `E` next to it opens the full content. Edit `src/data/screens.ts` — **current text is placeholder**. |
| **Interactions** | Pick up / put down items (physics bodies you can also push), toggle lamps, open the hinged kitchen↔bedroom door. Add more with `useInteractable` (`src/lib/interaction.ts`). |
| **Character** | Physics capsule (ecctrl). Placeholder mannequin until `character.glb` + `animations.glb` are added. |
| **Camera** | Third person, orbit/zoom, and walls between the camera and the player fade out. |
| **Quality** | Starts on High (AO + bloom + MSAA) and drops to Low automatically if the frame rate falls; toggle in the HUD. |

## Assets

The scene runs entirely on placeholders and picks up real assets as they are dropped into `src/assets/`.
See [`src/assets/README.md`](src/assets/README.md) for file names, the recommended sources, and the compression pipeline
(`npm run assets:optimize`). Verified with synthetic GLBs: character fitting/grounding, clip mapping
(Idle/Walk/Jog), meshopt-compressed models, and a trimesh-collider house.

Credits: [`CREDITS.md`](CREDITS.md) — update it (and `src/data/credits.ts`) whenever an asset is added; CC-BY needs attribution.

## Deploy (GitHub Pages)

1. Repo → **Settings → Pages → Source: GitHub Actions**.
2. Merge to `main`; `.github/workflows/deploy.yml` builds with `BASE_PATH=/<repo>/` and publishes `dist/`.

## Layout

```
src/
  data/       layout.ts · screens.ts · credits.ts        ← the content you edit
  assets/     registry.ts + models/ hdri/                 ← drop real assets here
  scene/      Experience · House · Walls · Floors · Furnishings · Door · Lamps · Pickups · Screens · Player · Avatar · Lighting · Effects
  lib/        interaction · collision · clips · gestures · playerState · proceduralTextures · debug
  ui/         Intro · Hud · ScreenModal · TouchControls
  store.ts    zustand state (room, nearby, screen, lamps, doors, items, quality…)
scripts/      optimize-models.mjs · fetch-polyhaven.mjs
```

## Known limits

- No ceilings (dollhouse view); the stand-in HDRI is 512×256 — fine for light, not for sharp reflections.
- `scripts/fetch-polyhaven.mjs` has not been run end to end (the build sandbox blocks polyhaven.com).
- Headless software rendering runs at a few fps, so frame-rate and visual quality on real GPUs are unverified.
