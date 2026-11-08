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

Add `?debug` to the URL to expose `window.__home` (store, player state, `teleport(x,y,z)`, `farm` with `tick(seconds)` to fast-forward the garden, the `loader`, `music` and save `slots`), `?quality=high|medium|low` to pin graphics, `?light` for light graphics, and `?nosw` to run without the service worker.

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
| **Models** | The farm's animals, people and crops are modelled in code with a small kit of our own (`src/lib/sculpt`), not downloaded: cows in three coats (black-and-white, a Jersey, white-and-brown) with hocks, udders, horns and a tail switch; sheep whose fleece grows back after shearing over a lean, shorn body, four face colours; hens in four colours and a rooster with comb, wattles, golden hackles and a sickle tail; buyers with faces (eyes, brows, nose, mouth, ears), three hair styles, straw hats and wicker baskets; and every crop at every stage — frilly lettuces round a heart, carrot fronds over orange shoulders, strawberries with seeds under a ruff of sepals, tomatoes with their calyx, corn cobs in the husk, wheat ears, jointed cane, ribbed pumpkins, lemons and eggs. All of it is about 17 KB of code (compressed), one instanced draw per part for the whole herd, flock, crowd or garden. Open the site with **`?gallery`** to see every model in the game's light, moving as it does in the game. |
| **Interactions** | Pick up / put down items (physics bodies you can also push), toggle lamps, open the hinged kitchen↔bedroom door. Add more with `useInteractable` (`src/lib/interaction.ts`). |
| **Sound** | Procedural WebAudio, no files: footsteps by floor (wood, tile, carpet), jumps and landings, lamp switch, door, pickups and knocks, screen chime, UI clicks and a quiet room tone (`src/audio/`). Starts on the first click; mute/volume in the settings. |
| **Character** | Physics capsule (ecctrl) with a frame-rate independent float and acceleration, so walking feels the same at 30 or 144 fps. Placeholder mannequin until `character.glb` + `animations.glb` are added. |
| **Camera** | **First person by default**: eye height, neck pitch, walking sway, your own body, arms and hands when you look down, interaction by aim (no crosshair). `V` switches to a third-person orbit camera where walls and the roof fade out of the way. |
| **Look** | A cinematic grade rather than a bright render: low-key IBL + a warm sun, per-room moods (cooler studio, warm living room) with light that fades smoothly as you cross doorways, soft sun shafts through the south/east windows, exponential haze for depth, contact AO, a focus-following depth of field, bloom on lamps and screens, AgX tone mapping, a gentle grade, vignette and grain. |
| **Detail** | Real PBR props (velvet sofa, slipper chair, damask accent chair, silk pouf, plant, teacup, water bottle — Khronos glTF Sample Assets) and a photographed fabric weave (Poly Haven); the rest uses physically sized procedural materials (veneer, fabric, leather, brushed metal, stone, satin paint) projected in metres, and the rooms are dressed with books, laptop, clock, kitchenware, pendant lights, radiators, switches and more (`src/scene/Dressing.tsx`). Outside the windows: lawn, hedges, a timber fence, shrubs and trees. |
| **Start & loading** | The page shell (the intro) is about 120 KB compressed and shows at once; the 3D engine, physics, models and sky light download behind it. The loading card names each step — downloading (MB of MB, speed, time left), building the house, preparing the graphics — with the list of files on request, then how long it took and how much came from the device. The build writes the list (`assets-manifest.json`, from `vite.config.ts`) and a service worker (`sw.js`) that keeps every file on the device: content-hashed files are served from there straight away, the page itself is fetched fresh when online (so a new version shows up at once) and from the device when offline, and an update carries the unchanged files over. Shaders compile in parallel where the browser can, and textures go up to the GPU a few per frame (`src/scene/Warmup.tsx`) instead of one long burst. |
| **Phones vs computers** | One file decides what each kind of device gets (`src/lib/profile.ts`): pixel ratio, multisampling, AO, shadow-map size, bloom, lens effects, generated-surface size (512² on a computer, 256² on a phone), a cap for downloaded and model textures (scaled down on the phone before upload, `src/lib/textureBudget.ts`), the HDR sky, and the GPU power hint. Phones start on Medium (Low with ≤ 4 GB of memory); computers keep the full chain. **Light graphics** (Settings, or `?light`) is the lightest start that still looks like the house. |
| **Recovery** | A browser short of graphics memory drops the WebGL context — on a phone with many tabs it can happen before the first frame. The scene then starts again by itself on a fresh context: in light graphics if it never got going (and says so on the intro), or as it was, where you stood, mid-game. Only if that fails does the intro explain why (download, graphics, WebAssembly or other), with *Try again*, *Try light graphics* and *Copy details* (`src/lib/startup.ts`). A body thrown out of the world comes back to the start. |
| **Saves & music** | Three farms kept in the browser, no account: pick one to play, save one as a file on the device (a backup, or to move it to another device), load one from a file (checked and made safe like any save), or clear one — on the intro under *Saves*. The intro also has quick settings (graphics, light graphics, sound, music, storage: how much is kept on the device, *Keep it* to protect it from clean-ups, *Free up space*) and a music player: four tracks composed in the browser as they play (no downloads), with play/pause, previous/next and volume — also in the in-game settings. |
| **Quality** | Auto / High / Medium / Low. Auto guesses from the GPU (integrated and mobile chips start on Medium, software rendering on Low) and moves one step at a time with the frame rate. High = pixel ratio 1.5, MSAA 4, AO, depth of field; Medium = 1.25, MSAA 2, cheaper AO; Low = 1, no AO. The sun shadow map is only re-rendered when something that casts a shadow moves, and static geometry is merged into a few draws. Every tier guards against bad pixels: materials clamp what they write and a cheap pass cleans the frame before anything blurs it, because a single NaN/overflowing pixel (some phone GPUs produce them) used to be smeared by the bloom into a large black rectangle or a black screen (`src/lib/hdrGuard.ts`). |

## Assets

The scene runs entirely on placeholders and picks up real assets as they are dropped into `src/assets/`.
See [`src/assets/README.md`](src/assets/README.md) for file names, the recommended sources, and the compression pipeline
(`npm run assets:optimize`). Verified with synthetic GLBs: character fitting/grounding, clip mapping
(Idle/Walk/Jog), meshopt-compressed models, and a trimesh-collider house.

Real assets come from anything reachable from the build machine: `npm run assets:fetch` downloads the rows of `scripts/assets.manifest.json` (public GitHub repositories work everywhere; Poly Haven needs network access to polyhaven.com).

Credits: [`CREDITS.md`](CREDITS.md) — update it (and `src/data/credits.ts`) whenever an asset is added; CC-BY needs attribution.

## Making models (the sculpt kit)

Models are built in code from a few shapes, painted per vertex and drawn instanced (`src/lib/sculpt`, examples in `src/models`):

1. **Shapes** — `loft` (elliptical rings along a spine: bodies, heads, limbs, fruit; `round` closes an end with a smooth dome, `shape` changes the cross-section, `squircle` squares it), `lathe` (round about the vertical: fruit, pots, hats, eggs), `tube` (stems, tails, horns), `blade` (leaves: outline, fold, bend, frilled or toothed edges), `blob` (lumps: wool, a lettuce heart), `ellipsoid` (eyes, beads). `place` moves, turns and scales; `merge` joins; `keep` cuts away (a hair line).
2. **Colour** — `paint` sets the colour, `pattern` adds a second colour with a crisp edge (a cow's patches, a strawberry's seeds, a hem), `blend` washes a colour over both (a pink muzzle, white socks), `shade` darkens by position. The **tint mask** (0–1 per vertex) says where each instance's own colour applies: a hen's feathers take her colour, her comb stays red; a tomato ripens from green to red, its calyx stays green.
3. **Material** — `sculptMaterial` (one shader for everything): `detail` adds bumps finer than any vertex, worked out per pixel and faded with distance (wool, cloth, feathers, hair); `leaf` lights both sides of a thin leaf.
4. **Drawing** — build each moving part round its joint and hand the geometries to `Parts`: one instanced draw per part, then per frame `at(x, y, z, heading)` and `put(part, joint…, rotation, scale, colour)` for every model. A whole herd costs what one animal does.
5. **Look at it** — add the model to `src/models/gallery.ts` and open `?gallery` (`&focus=cow`, `&t=1.5` freezes time, `&az=…&el=…&dist=…&x=…&y=…` sets the camera).

## Deploy (GitHub Pages)

1. Repo → **Settings → Pages → Source: GitHub Actions**.
2. Merge to `main`; `.github/workflows/deploy.yml` builds with `BASE_PATH=/<repo>/` and publishes `dist/`.

## Layout

```
src/
  data/       layout.ts · screens.ts · credits.ts        ← the content you edit
  farm/       data (crops, recipes, prices, where things stand) · state (simulation, save) · Garden · Plants · Chickens · Cows · Sheep · Workshop (mill, oven, loom) · Visitors (the line at the gate) · FarmUI · icons
  models/     cow · sheep · chicken · person · crops (garden parts) · plants (how each crop grows) · gallery + Gallery (?gallery)
  assets/     registry.ts + models/ hdri/                 ← drop real assets here
  scene/      Experience · Warmup · House · Walls · GardenDoor · Ceilings · Floors · Furnishings · Dressing · Door · Lamps · Pickups · Screens · Player · Avatar · Hand · Lighting · LightShafts · LightDirector · Effects
  lib/        sculpt (the modelling kit: core · shapes · material · parts) · profile (per-device budget) · loader (downloads with progress) · sw (service worker) · startup (recovery) · textureBudget · interaction · look · rig · focus · lightLevels · collision · clips · gestures · playerState · proceduralTextures · boxProject · debug
  audio/      sound (procedural effects) · music (generated tracks) · SoundDirector
  ui/         Intro · LoadStatus · SavesPanel · MusicPlayer · Hud · SettingsPanel · ScreenModal · TouchControls (stick, action buttons) · ActionGlyph
  settings.ts persisted player preferences
  store.ts    zustand state (room, outdoors, nearby, screen, panel, lamps, doors, items, quality…)
scripts/      optimize-models.mjs · fetch-polyhaven.mjs
```

## Known limits

- Furniture and the character are simple placeholders; textures are generated in code. Poly Haven-grade realism needs the real assets (see above).
- `scripts/fetch-polyhaven.mjs` has not been run end to end (the build sandbox blocks polyhaven.com).
- Headless software rendering runs at a few fps, so frame-rate and visual quality on real GPUs are unverified.
