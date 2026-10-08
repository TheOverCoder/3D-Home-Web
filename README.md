# 3D Home

A walkable 3D house for the web. Move a character through the rooms, pick things up, open doors and
switch lights — and walk up to a screen in each room to open its content. Static build, deployable on GitHub Pages.

**Stack:** Vite · React 19 · TypeScript · three.js · @react-three/fiber · drei · Rapier (physics) · ecctrl (character controller) ·
postprocessing (N8AO, depth of field, bloom, AgX) · zustand.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build → dist/
npm run preview
```

Add `?debug` to the URL to expose `window.__home` (store, player state, `teleport(x,y,z)`), and `?quality=high|low` to pin graphics.

## Controls

`WASD`/arrows walk · `Shift` run · `Space` jump · mouse to look (click the scene to capture the pointer; dragging also works) · `E` interact with what is in the view · `V` first/third person · `Esc` close a screen, or open the settings.
The screen stays clear on purpose: just a small ⚙ in the corner. It opens a drawer with the full shortcut list and the settings
(camera, field of view, look speed, invert Y, walking sway, quality, depth of field, atmosphere, film grain, cinema bars) — all remembered between visits.
Looking down in first person shows your own body and hands. On touch devices an on-screen joystick and buttons appear; drag the scene to look.

## What is in the box

| | |
|---|---|
| **Rooms** | Studio, kitchen, living room, bedroom — floor plan, doorways, lamps, pickups and spawn live in `src/data/layout.ts`. |
| **Screens** | Each room has a wall screen (live canvas texture) plus a floating 3D bar chart on a pedestal. `E` next to it opens the full content. Edit `src/data/screens.ts` — **current text is placeholder**. |
| **Interactions** | Pick up / put down items (physics bodies you can also push), toggle lamps, open the hinged kitchen↔bedroom door. Add more with `useInteractable` (`src/lib/interaction.ts`). |
| **Character** | Physics capsule (ecctrl). Placeholder mannequin until `character.glb` + `animations.glb` are added. |
| **Camera** | **First person by default**: eye height, neck pitch, walking sway, your own body, arms and hands when you look down, interaction by aim (no crosshair). `V` switches to a third-person orbit camera where walls and the roof fade out of the way. |
| **Look** | A cinematic grade rather than a bright render: low-key IBL + a warm sun, per-room moods (cooler studio, warm living room) with light that fades smoothly as you cross doorways, soft sun shafts through the south/east windows, exponential haze for depth, contact AO, a focus-following depth of field, bloom on lamps and screens, AgX tone mapping, a gentle grade, vignette and grain. |
| **Detail** | Furniture uses physically sized procedural materials (veneer, fabric, leather, brushed metal, stone, satin paint) projected in metres; the rooms are dressed with books, laptop, clock, kitchenware, pendant lights, radiators, switches and more (`src/scene/Dressing.tsx`). |
| **Quality** | Starts on High (AO + depth of field + bloom + MSAA) and drops to Low automatically if the frame rate falls; toggle in the settings. |

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
  scene/      Experience · House · Walls · Ceilings · Floors · Furnishings · Dressing · Door · Lamps · Pickups · Screens · Player · Avatar · Hand · Lighting · LightShafts · LightDirector · Effects
  lib/        interaction · look · rig · focus · lightLevels · collision · clips · gestures · playerState · proceduralTextures · boxProject · debug
  ui/         Intro · Hud · SettingsPanel · ScreenModal · TouchControls
  settings.ts persisted player preferences
  store.ts    zustand state (room, nearby, screen, lamps, doors, items, quality…)
scripts/      optimize-models.mjs · fetch-polyhaven.mjs
```

## Known limits

- Furniture and the character are simple placeholders; textures are generated in code. Poly Haven-grade realism needs the real assets (see above).
- `scripts/fetch-polyhaven.mjs` has not been run end to end (the build sandbox blocks polyhaven.com).
- Headless software rendering runs at a few fps, so frame-rate and visual quality on real GPUs are unverified.
