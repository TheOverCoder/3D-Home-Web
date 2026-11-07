# 3D Home

A walkable 3D house for the web. Move a character through the rooms, pick things up, open doors and
switch lights — and walk up to a screen in each room to open its content. Step out through the glass door onto
a small farm: plant, water and harvest, milk the cows, shear the sheep, collect eggs and lemons, mill sugar and flour,
weave cloth, bake cakes, buy more land, and sell to the line of buyers at the gate.
Static build, deployable on GitHub Pages.

**Stack:** Vite · React 19 · TypeScript · three.js · @react-three/fiber · drei · Rapier (physics) · ecctrl (character controller) ·
postprocessing (N8AO, depth of field, bloom, AgX) · zustand.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build → dist/
npm run preview
npm run test:e2e   # Playwright end-to-end suite (see tests/README.md); CI runs it on every push
```

Add `?debug` to the URL to expose `window.__home` (store, player state, `teleport(x,y,z)`, and `farm` with `tick(seconds)` to fast-forward the garden), and `?quality=high|medium|low` to pin graphics.

## Controls

`WASD`/arrows walk · `Shift` run · `Space` jump · mouse to look (click the scene to capture the pointer; dragging also works) · `E` interact with what is in the view — or, looking at nothing, with the nearest thing within reach (the view turns to it) · `V` first/third person · `Esc` close a screen, or open the settings.
The screen stays clear on purpose: just a small ⚙ in the corner. It opens a drawer with the full shortcut list and the settings
(camera, field of view, look speed, invert Y, walking sway, sound and volume, quality, depth of field, atmosphere, film grain, cinema bars) — all remembered between visits.
A faint ring marks whatever `E` would act on, and the prompt shows what it does as a picture — a hand with a lettuce, a watering can with a tomato, scissors with wool — with an arrow when it is beside or behind you; opening a screen eases the view onto it and hands control back when it closes.
Looking down in first person shows your own body and hands. If something looks wrong, ⚙ → *Copy diagnostics* puts a report (GPU, browser, position, recent errors) on the clipboard. On phones and tablets a joystick (bottom left), a round action button under the right thumb and a jump button appear, sized to the screen and kept clear of notches; drag anywhere on the scene to look. The action button shows what it will do (the verb, with a small picture of the crop or the thing) and works on what you look at or, if you look at nothing, on the best thing within reach — ready to pick first, then what needs water — turning you towards it as it does; up to two smaller buttons beside it offer the next things within reach. The layout follows how the phone is held: upright, the smaller buttons stack above and the action label sits over all the controls; on its side, they fan out to the left, the jump button goes above, the label sits between the stick and the buttons, and farm panels slide in as a sheet from the right so the yard stays in view. The scene takes every drag itself (no browser zoom, scroll or pull-to-refresh), and a second finger never makes the view jump.

## What is in the box

| | |
|---|---|
| **Rooms** | Studio, kitchen, living room, bedroom — floor plan, doorways, lamps, pickups and spawn live in `src/data/layout.ts`. |
| **Screens** | Each room has a dashboard-style wall screen that powers on as you enter, and a pedestal hologram of its own kind (orbit rings, fanned project cards, progress rings, a connection globe) revealed as you approach. `E` opens a glass two-column panel with tabs, stats, cards, timelines and a contact call to action (keyboard, swipe and mobile bottom-sheet friendly). While a panel is open the house stops rendering behind it (its last frame stays under the blur), so the panel gets the whole machine. Everything is edited in one file, `src/data/screens.ts` (guide at its top) — **current copy is placeholder**. |
| **Farm** | The living room's south window is a sliding glass door that opens as you walk up to it; outside is a small farm (`src/farm/`). **Beds:** six raised beds along a gravel path (two staked out, built for 30 coins), eight crops from 45-second lettuces to 3-minute pumpkins — lettuce, carrots, strawberries, tomatoes, corn, pumpkins, wheat and sugar cane — each grown as its own procedural plant that fills out and ripens in colour. Plant from a seed panel (buy as you sow, keys 1–8), water when a bed shows the droplet (growth stops on dry soil), harvest when it sparkles. **Animals:** cows in a pasture along the east side (seen from the kitchen window) that graze and moo and give milk you collect by walking up to them; hens and a rooster in a run, the hens laying eggs in a nest box; sheep in a fold behind the house (seen from the office and kitchen windows) whose fleece shows how much wool they carry — shear them for fleeces, and the loom beside the fold weaves the fleeces into rolls of cloth (its shuttle flies while it works). **Kitchen corner:** a mill that presses sugar cane into sugar and grinds wheat into flour (its wheel and rollers turn while it works), and a brick oven that bakes a lemon cake, strawberry cake, carrot cake or pumpkin pie from the farm's own flour, sugar, eggs, milk and fruit — its mouth glows and its chimney smokes, and the cake waits on the table. Cakes sell for the most. **Growing the farm:** staked-out plots east of the beds and a field in the west yard are bought at the plot (or in the shed's farm shop), along with more cows, sheep and hens, sprinklers, a compost bin for bigger harvests, and the line at the gate. **Buyers** walk up the lane and queue along the fence outside the gate, each with a speech bubble — what they want, what they offer — and wait there until you serve them (the line is kept in the save). Five places and a new buyer every two minutes to begin with; the shop adds places one at a time up to fifteen and brings buyers sooner, down to one every thirty seconds. At the gate a panel lists the whole line, says whether each price is generous, fair or low, and sells to one buyer, to everyone you have enough for at once, or sends someone away — and somebody new soon takes their place. A lemon tree keeps fruiting. Coins and the basket show at the top while you are outside; everything runs in real time, keeps going while you are away (up to three hours) and is saved in the browser. Tap the coin chip for the whole basket. Birds, wind, moos, bleats, clucks and a crowing rooster, shears, the loom's clack, the mill's creak, the oven's roar and timer, a gate bell and coins are synthesised like the rest of the sound. |
| **Interactions** | Pick up / put down items (physics bodies you can also push), toggle lamps, open the hinged kitchen↔bedroom door. Add more with `useInteractable` (`src/lib/interaction.ts`). |
| **Sound** | Procedural WebAudio, no files: footsteps by floor (wood, tile, carpet), jumps and landings, lamp switch, door, pickups and knocks, screen chime, UI clicks and a quiet room tone (`src/audio/`). Starts on the first click; mute/volume in the settings. |
| **Character** | Physics capsule (ecctrl) with a frame-rate independent float and acceleration, so walking feels the same at 30 or 144 fps. Placeholder mannequin until `character.glb` + `animations.glb` are added. |
| **Camera** | **First person by default**: eye height, neck pitch, walking sway, your own body, arms and hands when you look down, interaction by aim (no crosshair). `V` switches to a third-person orbit camera where walls and the roof fade out of the way. |
| **Look** | A cinematic grade rather than a bright render: low-key IBL + a warm sun, per-room moods (cooler studio, warm living room) with light that fades smoothly as you cross doorways, soft sun shafts through the south/east windows, exponential haze for depth, contact AO, a focus-following depth of field, bloom on lamps and screens, AgX tone mapping, a gentle grade, vignette and grain. |
| **Detail** | Real PBR props (velvet sofa, slipper chair, damask accent chair, silk pouf, plant, teacup, water bottle — Khronos glTF Sample Assets) and a photographed fabric weave (Poly Haven); the rest uses physically sized procedural materials (veneer, fabric, leather, brushed metal, stone, satin paint) projected in metres, and the rooms are dressed with books, laptop, clock, kitchenware, pendant lights, radiators, switches and more (`src/scene/Dressing.tsx`). Outside the windows: lawn, hedges, a timber fence, shrubs and trees. |
| **Quality** | Auto / High / Medium / Low. Auto guesses from the GPU (integrated and mobile chips start on Medium, software rendering on Low) and moves one step at a time with the frame rate. High = pixel ratio 1.5, MSAA 4, AO, depth of field; Medium = 1.25, MSAA 2, cheaper AO; Low = 1, no AO. The sun shadow map is only re-rendered when something that casts a shadow moves, and static geometry is merged into a few draws. Every tier guards against bad pixels: materials clamp what they write and a cheap pass cleans the frame before anything blurs it, because a single NaN/overflowing pixel (some phone GPUs produce them) used to be smeared by the bloom into a large black rectangle or a black screen (`src/lib/hdrGuard.ts`). |

## Assets

The scene runs entirely on placeholders and picks up real assets as they are dropped into `src/assets/`.
See [`src/assets/README.md`](src/assets/README.md) for file names, the recommended sources, and the compression pipeline
(`npm run assets:optimize`). Verified with synthetic GLBs: character fitting/grounding, clip mapping
(Idle/Walk/Jog), meshopt-compressed models, and a trimesh-collider house.

Real assets come from anything reachable from the build machine: `npm run assets:fetch` downloads the rows of `scripts/assets.manifest.json` (public GitHub repositories work everywhere; Poly Haven needs network access to polyhaven.com).

Credits: [`CREDITS.md`](CREDITS.md) — update it (and `src/data/credits.ts`) whenever an asset is added; CC-BY needs attribution.

## Deploy (GitHub Pages)

1. Repo → **Settings → Pages → Source: GitHub Actions**.
2. Merge to `main`; `.github/workflows/deploy.yml` builds with `BASE_PATH=/<repo>/` and publishes `dist/`.

## Layout

```
src/
  data/       layout.ts · screens.ts · credits.ts        ← the content you edit
  farm/       data (crops, recipes, prices, where things stand) · state (simulation, save) · Garden · Plants · Chickens · Cows · Sheep · Workshop (mill, oven, loom) · Visitors (the line at the gate) · FarmUI · icons
  assets/     registry.ts + models/ hdri/                 ← drop real assets here
  scene/      Experience · House · Walls · GardenDoor · Ceilings · Floors · Furnishings · Dressing · Door · Lamps · Pickups · Screens · Player · Avatar · Hand · Lighting · LightShafts · LightDirector · Effects
  lib/        interaction · look · rig · focus · lightLevels · collision · clips · gestures · playerState · proceduralTextures · boxProject · debug
  ui/         Intro · Hud · SettingsPanel · ScreenModal · TouchControls (stick, action buttons) · ActionGlyph
  settings.ts persisted player preferences
  store.ts    zustand state (room, outdoors, nearby, screen, panel, lamps, doors, items, quality…)
scripts/      optimize-models.mjs · fetch-polyhaven.mjs
```

## Known limits

- Furniture and the character are simple placeholders; textures are generated in code. Poly Haven-grade realism needs the real assets (see above).
- `scripts/fetch-polyhaven.mjs` has not been run end to end (the build sandbox blocks polyhaven.com).
- Headless software rendering runs at a few fps, so frame-rate and visual quality on real GPUs are unverified.
