# Home design mode for 3D HOME — research, design and plan

Repository read: `/home/user/3D-Home-Web`. Nothing in it was modified; nothing was installed, cloned or run.
Date of the research: 2026-11-10.

**Verification marks used below**

- **[V]** checked against a primary source: the project's own GitHub repository (read via raw.githubusercontent.com or the
  github.com page) or its npm registry entry (registry.npmjs.org JSON: licence, latest version, release date).
- **[V-search]** an official page (Nintendo, EA, Supercell, Playrix, IKEA, Planner 5D, Kenney, Quaternius, Poly Haven) was found
  by web search and its content is taken from the search result; the page itself was not opened (this session's network only
  reaches GitHub and npm: play.nintendo.com, www.nintendo.com and pmndrs.github.io did not resolve, so no further publisher hosts
  were tried). Treat as very likely; re-check before quoting publicly.
- **[secondary]** a fan site or forum, not the publisher.
- **[UNVERIFIED]** no primary source found.

---

## TL;DR

- **Build it ourselves on top of the farm's edit mode.** About two thirds of what is needed already exists and is tested in
  `src/farm/EditMode.tsx`, `EditPanel.tsx`, `edit.ts`, `layout.ts` (flying top-down camera, press/drag/pinch/wheel input with a
  slop, half-metre snapping, quarter turns, green/red outlines with a reason in words, "back to its first spot", a save that is
  sanitised on load, an e2e test). No library on the market gives an in-game, phone-first, coin-based decorating mode for our stack;
  the planners are abandoned, on old three/React, desktop-first, or whole apps (details in §1).
- **No new runtime dependency is needed.** drei (already installed) has a shader `Grid` we can show while editing; everything else
  is our own code. Optional: `zundo` (MIT) for undo, but a 30-line snapshot stack is simpler for a layout this small.
- **Phone UX in one line:** the ✥ button (or `B`) inside the house flies the camera up into a cut-away view of the room you are in;
  tap a piece to pick it, drag the picked piece to move it (drag anywhere else pans, pinch zooms), *Turn* and *Put away* on a card,
  an *Undo* button, a shop/storage sheet; outline green or red with the reason ("Blocks the door to the kitchen").
- **Data:** the house's furniture becomes data (`home` inside the farm save: per piece id, type, room, x, z, quarter turn, host),
  starting exactly where `Furnishings.tsx` puts it today, so old saves and every test keep working.
- **Content:** model furniture in code (our boxes + the sculpt kit: ~0 download, matches the house, instanced), with CC0 low-poly
  packs as a fallback — Kenney's Furniture Kit (measured 28–602 triangles, named materials we can swap for our own) first, KayKit
  Furniture Bits (measured 60–808, one gradient atlas) second. Do **not** sell more copies of the current
  heavy Khronos props (an armchair is 39,936 triangles, the plant 68,409).
- **Plan:** P0 data + rules + save (no UI) → P0 data-driven house (no visual change) → P0 decorate mode MVP → P1 storage + shop +
  buying → P1 wall items and decor on tables → P2 content, colours, paint, comfort score. Roughly 14–20 developer-days for P0+P1
  (plus runs of the ~25-minute e2e suite), content after that.

---

## 0. Where we start (facts from the code)

| Area | What the code does today | What it means for decorating |
|---|---|---|
| Furniture | `src/scene/Furnishings.tsx` places 19 pieces with literal coordinates in JSX. `Solid` = a fixed rapier `RigidBody` + `CuboidCollider` sized to the piece, rendering placeholder meshes (`B` rounded boxes with projected procedural materials) or a dropped-in `props/<id>.glb` fitted into the same box. `Decor` = rugs and picture frames, no collider. | Pieces must become data; the collider follows the data. The `props/<id>.glb` replacement must keep working (ids `sofa`, `armchair`, `plant-living`, `pouf`, `accent-chair` are in use). |
| Merging | `House.tsx` wraps `Furnishings` + `Dressing` in `<StaticBatch>` (`src/lib/batch.ts`): meshes merged by material signature and by quarter of the house; anything under `userData.noBatch` is skipped. | A moving piece cannot stay in the house-wide merge. The farm already shows the way: `Places.tsx` puts a `StaticBatch` *inside* a moving group (the hen run's fence), and the merged meshes move with the group. |
| Small things | `src/scene/Dressing.tsx` puts magazines, remote, vases, teacup on the coffee table; laptop, pen cup, bottle on the desk; kettle, toaster, board, faucet on the counter; a clock on the nightstand — all in **world** coordinates. | They must become children of their host piece (local offsets), or they float when the host moves. |
| Lamps | `LAMPS` in `src/data/layout.ts` (floor lamp, desk lamp on the desk, counter lamp, bedside lamp on the nightstand) are switchable interactables and point lights. `Lamps.tsx` keeps the light count constant on purpose ("toggling never recompiles shaders"). | A lamp on a moved desk/nightstand must follow its host. **Buying lamps must not add point lights** (each new light recompiles every lit shader — a long stall on phones). Use a fixed pool. |
| Fixed things | Wall screens + hologram pedestals with colliders (`Screens.tsx`, `data/screens.ts`; pedestals at (-5.5, 4.9), (-1.6, -5.0), (5.7, -3.2), (6.3, 4.6)); walls, sills, window glass and **curtains are solid colliders** (`Walls.tsx`, `solid: true`); the hinged kitchen↔bedroom door (hinge (2.7, 0, 0), 1.6 m, swings into the bedroom); the sliding garden door (south wall, x −1.95…−0.45); a radiator under the bedroom's south window. | These are blockers or keep-clear zones for the placement rules. Derive them from the same data the scene uses (`buildSegments()` in `Walls.tsx`, `DOORWAYS`, `DOOR`, `WINDOWS`, `SCREENS`), not a second hand-copied list. |
| Pickups | Mug, notebook, gift are dynamic bodies; positions in `useHome().items` (not saved). | A pickup resting on a moved table should move with it (or it falls when the collider moves). |
| Farm edit mode | `useHome().editing` (boolean, part of `busy()`); `B` toggles it from anywhere; the ✥ button sits beside ⚙. `EditCamera` blends from the player camera to a view from above (tilt 0.28 rad from vertical, critically damped, ~1 s). `EditInput`: DOM pointer events on the canvas with pointer capture; 7 px slop; drag on a place moves it (grab offset kept, `snap()` to 0.5 m); drag on the ground pans; 2 fingers pinch-zoom about their midpoint; wheel zooms about the cursor; a second finger cancels the drag. Outlines are flat rectangles (`Outline`, `renderOrder` 20, no depth test). `canPlace()` returns `{ ok, reason }`; a drop where red goes back with a toast. `keepPlayerClear()` moves you out of anything put down on you. | Reuse all of it: generalise camera/input/outline into a shared module and add the house's rules. |
| Ceilings / walls | `Ceilings.tsx`: always shown in first person. `Walls.tsx`: fades segments between camera and player in third person only; walls are merged in first person (`StaticBatch firstPersonOnly`). | For a cut-away view: hide ceilings and fade the walls between the camera and the room being edited — the existing third-person fade with different sample points. |
| Shadows | `Lighting.tsx` re-renders the sun's shadow map only when a caster moved (it watches their matrices). | Dragging a piece costs shadow renders only while it moves. Nothing to add. |
| Saves | `src/farm/state.ts`: three slots in localStorage (`3d-home:farm:v1`, `…:slot2`, `…:slot3`), JSON of `FarmData` (coins, inventory, beds, animals, `layout`…), read through a defensive `load()` / `sanitizeLayout()`; files exported as `{ kind: '3d-home-farm-save', version: 1, save }`. | The house layout goes into the same save (`home` field), so slots, export/import and backups just work. |
| Economy | Start 20 coins; seeds 2–8; crops sell 2–16 each; cakes 40–50; everything the farm sells today adds up to **3,060 coins** (beds 60, east/west 180, queue steps 840, pace steps 675, cows 140, sheep 110, hens 100, sprinklers 60, compost 45, meadows 850). | The catalogue is a new coin sink of similar size (≈ 4,500 for one of everything). |
| UI rules | CLAUDE.md + `src/styles.css`: paper sheets, `.btn` / `.primary`, `.tag`, Fluent 3D art, Phosphor glyphs; a panel = picture, a few-word title, chips, ≤ 1 line of text, ≤ 2 buttons (Cancel first, action last with its price); 44 px targets, text ≥ 15 px; anything that costs coins asks first. Phosphor already has `Armchair`, `Couch`, `Bed`, `Lamp`, `PottedPlant`, `Rug`, `FrameCorners`, `Package`, `Archive`, `ShoppingBag`, `ArrowClockwise`, `ArrowCounterClockwise`, `MagnetStraight`, `GridFour`, `PaintRoller`, `Tray` (checked in `node_modules`). | Everything below uses those classes and glyphs. |
| Budget | < 250,000 triangles and < 700 draw calls per view (`05-budget`, measured in the living room, studio and kitchen). The current Khronos props alone are heavy (measured from the repo's GLBs: armchair 39,936 tris, plant-living 68,409, accent-chair 9,984, pouf 9,753, sofa 4,196, teacup 5,634, water-bottle 4,510). | The living room already spends ≈ 122k triangles on four GLB props (sofa, armchair, plant, pouf). More copies of those would break the budget; new pieces must be light. |

---

## 1. Recommendation: build on our own edit mode

### 1.1 Decision

Generalise the farm's edit mode into a small shared "placement kit" and add a **house area** to it. Do not adopt a planner
engine or a gizmo library.

Reasons:

1. **Most of it exists and is proven on phones and in CI.** Camera flight, input disambiguation (tap / drag / pan / pinch /
   wheel, second finger cancels), snapping, quarter turns, outlines with reasons, sanitised saves, keep-the-player-clear and an
   e2e test (`13-layout`) are already there. The house needs different *rules* (rooms, walls, doors, windows, screens, layers)
   and a different *camera framing* (a cut-away room), not a different engine.
2. **No library fits the goal** (table below). Room planners are whole applications (Next.js, their own scene graph, their own
   save), architecture tools (Pascal: WebGPU, three ^0.187, Next.js for the editor), or abandoned (Blueprint3D on three ^0.69 with
   jQuery; react-planner on React 16 / three 0.94; blueprint-js depends on GSAP, whose licence is not on the allowed list).
3. **Gizmos are the wrong interaction for a cosy game on a phone.** drei `TransformControls` / `PivotControls` and
   `@react-three/handle` are 3-axis editor handles: small targets, more modes than we need (we move on the floor and turn in
   quarter turns). `@react-three/handle`'s documented setup replaces R3F's event system with `@react-three/xr`'s (`noEvents` +
   `<PointerEvents />`), which would touch every pointer interaction in the game. drei `DragControls` is closer, but it binds
   `@use-gesture` handlers to R3F pointer events on its own group and drags on a camera-facing plane (the floor needs `axisLock: 'y'`)
   — checked in `node_modules/@react-three/drei/web/DragControls.js` — while our edit input deliberately owns the canvas's raw pointer
   stream (so a pinch can start on a piece and a pan can start anywhere); mixing the two gives exactly the conflicts the farm code
   avoided.
4. **Budget control.** Our own renderer can instance every copy of a catalogue type (sculpt kit `Parts`: one draw per part per
   type, however many chairs you buy) and re-merge the furniture into the house-wide batch when you leave the mode.
5. **Licences.** Our code + CC0 models stay inside MIT/BSD/Apache/ISC/CC0 with no attribution chores.

What we *take* from others: interaction patterns (§2), and specific techniques from the MIT-licensed
[Three.js Sims-like House Builder design notes](https://github.com/ch-bas/threejs-sims-house-builder/blob/main/docs/design-notes.md)
(a press on an item never moves the camera; a second finger cancels the item drag and becomes a pinch; a drag released over the
HUD cancels; one undo entry per gesture; layered collision where rugs go under furniture and wall items only collide with wall
items). If any code is copied from an MIT project, keep its copyright line in a comment and add it to `src/data/credits.ts`.

### 1.2 Library and engine survey

| Candidate | Licence | Latest release (primary source) | What it gives | Covers of our goal | Integration effort | Phones | Verdict |
|---|---|---|---|---|---|---|---|
| [drei `DragControls`](https://github.com/pmndrs/drei/blob/master/docs/gizmos/drag-controls.mdx) | MIT [V] | `@react-three/drei` 10.7.9, 2026-09-25 [V] (already a dependency) | Drag an object; `axisLock`, `dragLimits`, `onDragStart/onDrag/onDragEnd`, controlled `matrix` mode; marked "Dom only" | Moving only (~10 %): no snapping rules, no validity, no camera, no catalogue | Low to add, medium to reconcile with our canvas-level pointer handling | Works with touch, but per-mesh R3F events; no pinch/drag arbitration | Not needed |
| [drei `PivotControls`](https://github.com/pmndrs/drei/blob/master/docs/gizmos/pivot-controls.mdx) / [`TransformControls`](https://github.com/pmndrs/drei/blob/master/docs/gizmos/transform-controls.mdx) | MIT [V] | same | Editor gizmos (arrows, planes, rotation rings; `TransformControls` wraps three.js's) | Moving/rotating (~10 %) | Low | Small handles, desktop-style; poor on phones | Not for players |
| [drei `Grid`](https://github.com/pmndrs/drei/blob/master/docs/gizmos/grid.mdx) | MIT [V] | same | Shader grid (cell/section size, fade) | Shows the snap grid while editing | Trivial | Fine (one draw) | **Use** (optional nicety; warm its shader up in `Warmup`) |
| [`@react-three/handle`](https://github.com/pmndrs/xr/blob/main/docs/handles/introduction.md) | MIT text in [pmndrs/xr LICENSE](https://github.com/pmndrs/xr/blob/main/LICENSE) (npm field says "SEE LICENSE IN LICENSE") [V] | 6.6.32, 2026-10-13 [V] | `Handle`/`HandleTarget`; per-axis `translate`/`rotate`/`scale` limits; an `apply` override to route changes through our own state (snapping/veto); `multitouch`; screen handles (pan/zoom); prebuilt `TransformHandles`/`PivotHandles`; mouse, touch, XR | Moving/rotating with constraints (~15 %) | Medium–high: documented setup uses `@react-three/xr` pointer events (`<Canvas events={noEvents}>` + `<PointerEvents />`) | Designed for touch and XR | Interesting, not worth replacing our event layer |
| [`@use-gesture/react`](https://github.com/pmndrs/use-gesture) | MIT [V] | 10.3.1, 2024-03-21 [V] (already in `node_modules` as a drei dependency) | Drag/pinch/wheel recognisers, thresholds, tap filtering | Input only | Low | Good | Not needed: `EditInput` already does this; extract it instead |
| [`three-mesh-bvh`](https://github.com/gkjohnson/three-mesh-bvh) | MIT [V] | 0.9.18, 2026-11-03 [V] | Fast raycasts/shape casts against big meshes | Picking against heavy GLBs | Low | Fine | Not needed: we pick with analytic boxes and test overlaps with 2D footprints (n ≤ 60) |
| three.js [TransformControls / editor](https://github.com/mrdoob/three.js) | MIT [V] | three 0.187.0, 2026-10-30 [V] (we use 0.186.1) | Desktop editor app and gizmo | ~10 % | Editor app not embeddable | No | Not for players |
| [Blueprint3D](https://github.com/furnishup/blueprint3d) | MIT ([LICENSE.txt](https://github.com/furnishup/blueprint3d/blob/master/LICENSE.txt)); package.json says "(MIT OR Apache-2.0)" [V] | npm `blueprint3d` 0.0.1-1, 2018-09-10 (published from a fork) [V]; repo depends on three ^0.69, jQuery, Bootstrap 3 | 2D floor plan + 3D furnishing app | ~40 % of the features, none of our stack | Very high (rewrite) | Desktop-first | Reference only; README says it "requires a lot more work" |
| [blueprint-js](https://github.com/aalavandhaann/blueprint-js) | LICENSE file MIT, package.json "ISC" (mismatch) [V] | 3.0.1 in repo [V]; not on npm under `blueprint3d-js` | ES rewrite of Blueprint3D with pixi.js 2D | ~40 % | Very high | Desktop-first | **Excluded**: depends on `gsap` ("Standard 'no charge' license" [V]) and pixi.js; three ^0.148 |
| [react-planner](https://github.com/cvdlab/react-planner) | MIT [V] | 2.0.6, 2019-11-03 [V]; peers React 16.x, three 0.94.x | 2D/3D planner component with a catalogue | ~40 % | Very high (dead stack) | Desktop-first | Excluded (abandoned) |
| [Pascal Editor](https://github.com/pascalorg/editor) | MIT [V] | `@pascal-app/core`/`viewer`/`editor` 1.0.7, 2026-11-08 [V]; peers three ^0.187, R3F 9, drei 10; editor needs Next.js ≥ 15; README: "Built with React Three Fiber and WebGPU" | Full AECO building editor (walls, slabs, rooms, furniture, MCP for agents) | Much more than we need, but not a game mode | Very high; WebGPU vs our WebGL post chain; three version bump | Not phone-first [UNVERIFIED] | Excluded; maybe read its furniture code for ideas |
| [Three.js Sims-like House Builder](https://github.com/ch-bas/threejs-sims-house-builder) | MIT [V] | v1.30.0, 2026-11-07 (CHANGELOG) [V]; Next.js 15, React 18, raw three 0.186.1 | Whole app: 69 catalogue items, drag with snapping, wall cut-away, budget, undo/redo, touch dock and bottom-sheet item editor | Pattern reference for almost everything | It is an app, not a library | Yes (documented in its wiki) | **Best reference** for patterns; do not embed |
| [Casita](https://github.com/rohitguta2432/casita) | MIT [V] | v1.0.0 in repo; Next.js 15, R3F 9, drei 10, three 0.180 [V] | Tiny R3F planner: click-to-place, drag on a grid, R/D/Delete, localStorage | Small reference | App | "Works on any modern browser" (no touch specifics) | Reference |
| [openPlan3D](https://github.com/laanlabs/openPlan3D) | MIT [V] | SvelteKit + three 0.182 [V] | Floor-plan editor | Small | Different framework | [UNVERIFIED] | Not relevant |
| [Triplex](https://github.com/pmndrs/triplex) | **not shown** on the repository page [UNVERIFIED] | — | A visual editor for R3F components in VS Code (developer tool) | 0 % (not in-game) | — | — | Not relevant |
| [zundo](https://github.com/charkour/zundo) | MIT [V] | 2.3.0, 2024-11-17 [V]; peers zustand ^4.3 or ^5 | Undo/redo middleware for zustand | Undo | Low | n/a | Optional; a snapshot stack is enough |

---

## 2. UX spec (phone first, desktop too)

### 2.1 What the references do well (patterns extracted)

| Reference | Source | Patterns worth taking |
|---|---|---|
| Animal Crossing: New Horizons | Nintendo's tips, *Create* and beginner pages: a house-decorating guide "with buttons to rotate, grab, and store items"; built-in storage to stash and retrieve items, which "isn't unlimited"; Nook's Cranny stock rotates daily; Happy Home Academy rates your interior every weekend (coordinated colours, matching styles, decorations) [V-search]. Controls: D-pad down opens a cursor editor, hold A to grab and move, tap A to rotate, Y to store, + switches floor/wall [secondary: Screen Rant, Shacknews, GoSuNoob]. | A **dedicated decorating view** rather than pushing furniture around in first person; **floor and wall layers**; one button each for grab / turn / store; storage as a normal part of decorating; a gentle **design score**; a shop whose stock changes. |
| Animal Crossing: Happy Home Designer (3DS, touch screen) | Nintendo manual: touch a piece and drag it; "Simply touch a piece of furniture to rotate it"; touch an empty area and drag across furniture to move a group (rugs and wall items excluded); drag a piece to the Trash Can to get rid of it [V-search]. | Direct drag; **drag to a tray to remove**; group move is possible later (not in v1). |
| The Sims 4 | EA Help: period/comma rotate the selected object 45°; holding Alt while rotating with the mouse rotates freely, off the grid steps [V-search]. EA Answers (community): Alt while positioning places off the grid; Backspace while holding an object puts it into the household inventory; Shift keeps placing copies [secondary]. Undo/redo hotkeys: [UNVERIFIED]. | Grid by default with a **fine mode** (Alt); **send to storage** with one key; **place another** of the same; keyboard shortcuts on desktop. |
| Hay Day | Supercell Help, *Edit Mode*: saved layouts; storage by category; an **Eraser Mode** that stores items by tapping or swiping over them; an **undo button** that restores an item to its original place [V-search]. *The Shop*: hold a placed decoration and tap the cardboard icon to store it in the Shop; stored decorations must be placed before you can buy more of them [V-search]. Staff post (2015): tap & hold to move, flip, trash or store [secondary]. | **Storage lives in the shop** (a stored item is a free card there); undo back to where it stood; a quick put-away. |
| Township | Playrix Help: press and hold a building to move or rotate it; a full edit mode with a **temporary storage panel on the left** you drag things out of; a delete mode to send several to storage; changes can only be saved once everything but decorations is placed again [V-search]. | A storage strip you drag from; **essential pieces cannot be stored** (for us: the fitted kitchen). |
| Homescapes | Playrix Help: tap and hold an object to see its available designs; you can change appearance, not location [V-search]. | **Restyle in place** (colour/style variants of a piece you own). |
| Planner 5D (mobile) | Help centre: tap to select, then tap-and-drag the selected object to move it; a rotation handle (green dot); exact angle in the Edit panel; Undo/Redo near the bottom-right on mobile; drag an object toward a wall to snap it, then rotate it to face the wall; snapping toggles [V-search]. | **Select first, then drag** on touch; **wall snap**; **undo on screen** within thumb reach. |
| IKEA Kreativ | IKEA Help: tap a catalogue item to place it; tap to highlight, press and hold to move; select → Rotate icon → slider; the action panel offers swap, duplicate, delete; existing furniture can be erased from a scan [V-search]. | An **action card** for the picked piece; **duplicate** ("another"); **swap** a piece for a variant. |
| Homestyler | Forum answers: the rotation wheel snaps at set points; exact angles in the property panel [V-search, forum]. Mobile specifics: [UNVERIFIED]. | Snapped rotation by default. |
| Three.js Sims-like House Builder (open source) | Wiki and design notes [V]: a see-through copy follows the finger, cyan where it fits and red where it collides; tap to place; Shift+click places another; R turns 90°; Esc/Cancel puts it back; new items are locked until *Unlock*; a pinch that starts on furniture zooms; a drag over the controls holds the item, and a release there cancels; a bottom sheet with Rotate / Mirror / Lock / Copy / Centre / Demolish; one undo entry per drag; OBB collision with layers. | Almost all of the touch rules below. |

### 2.2 Entering and leaving

- **One entry point, context aware.** The existing ✥ button beside ⚙ (and `B`) opens the edit mode for **where you are**: inside
  the house → *Decorate* (house area); outdoors → the farm (as today). Inside the mode, a two-chip switch **House · Farm** at the top
  changes area without leaving. `useHome` keeps `editing: boolean` and gains `editArea: 'farm' | 'house'`, so `busy()` and everything
  that reads `editing` keeps working.
- Leaving: **Done** (yellow `.primary`, top right where ⚙ is, `B` on a keyboard) or `Esc`. The camera flies back to your eyes.
  Changes are already saved (see 2.9).
- The working tree now has a top-of-screen mode (`src/ui/HudMode.tsx`, `H`: everything / only the compass / clear) that hides the ✥
  button in its two lighter modes. On a phone that leaves no way in; keep ✥ visible in the *compass* mode, or add *Decorate* to the
  settings drawer.
- While decorating, the player body, the context button, the compass and the touch stick are hidden (already the case: `busy()`).
- First time only: one line on the card — "Tap a piece to pick it, then drag it. Turn and Put away are below; the bag opens the shop."

### 2.3 Camera

How the references handle it: the Sims-like builder (touch) — one finger orbits, a *Pan* toggle makes one finger pan, pinch zooms,
two fingers pan, *Fit* frames the house, a pinch that starts on furniture zooms, and the camera never drifts while an item is dragged
[V]. Planner 5D separates a 2D plan from a 3D view [V-search]. ACNH's room editor looks down on the room with a cursor [secondary].
Hay Day and Township keep a fixed isometric angle with pan and pinch [UNVERIFIED]. For a phone game a **fixed angle with pan, pinch and
90° view turns** is the simplest of these and matches our farm mode; free orbit is not needed.

- **Flight**: reuse `EditCamera`'s critically damped blend from wherever the player's camera is.
- **Framing**: a three-quarter view over **one room** (the one you stood in): pitch about 55° down (the farm's 0.28 rad tilt from
  vertical reads furniture as flat lids), yaw facing one of four headings; distance fitted so the room fills the free part of the
  screen above the card (portrait) or right of the card (landscape). Use the farm's `fovFor(aspect)` (64° upright, 50° wide).
  Eye: `target + dist · (sin(yaw)·cos(p), sin(p), cos(yaw)·cos(p))`.
- **Cut-away**: ceilings hidden (add `!decorating` to the `Ceilings.tsx` rule); walls un-merged (`StaticBatch` predicate
  `view === 'first' && phase === 'playing' && !decorating`) and faded by the **existing third-person fade** in `Walls.tsx`, with sample
  points spread over the edited room's floor (a 3×3 grid at 0.5 m height) instead of the player's feet/hips/head. Walls on the far
  sides stay up, so wall items stay visible. Doorways and windows keep their frames.
- **Gestures**: one finger on empty floor (or on an unpicked piece) **pans**, keeping the floor point under the finger
  (`EditInput` already does this); two fingers **pinch-zoom** about their midpoint and pan; mouse wheel zooms about the cursor. View
  clamped to the house.
- **Turn the view**: a round button with `ArrowClockwise` (and `,` / `.` on a keyboard) turns the camera 90° about the room — the only
  way to see the walls that the cut-away hides. No two-finger twist (it fights the pinch on small screens).
- **Room chips**: *Living · Studio · Kitchen · Bedroom* at the top; tapping one flies the camera to that room. Dragging a piece
  through a doorway does not move the camera (rooms are small; pan if needed).
- Depth of field: set the focus distance to the camera–target distance while decorating (the High tier's DOF would otherwise blur
  the room).

### 2.4 Selecting

- **Tap a piece → it is picked**: its floor outline turns the farm's *picked* orange (`#ffb454`), the card shows it (2.10).
- Hit testing: a ray from the camera through the finger against each piece's box (footprint × height, analytic ray–box test;
  n ≤ 60, no BVH). Tall pieces are picked where you see them, not where the ray meets the floor. Several hits: the nearest box; rugs
  (floor layer) only when nothing else is hit. A tap on nothing unpicks.
- Fitted pieces (counter, fridge, island in v1) and fixed things (screens, pedestals, radiator) are not pickable; tapping one shows a
  short toast "Fitted — it stays".
- Keyboard: `Tab` cycles through the pieces of the room in the view (focus ring = picked outline), `Esc` unpicks, a second `Esc` leaves.

### 2.5 Moving

- **Touch: tap first, then drag** (Planner 5D, the Sims-like builder). A drag that starts on the **picked** piece moves it; a drag
  that starts anywhere else pans — so panning across a cluttered room (where rugs cover most of the floor) never moves a sofa by
  accident.
- **Mouse: press and drag** on any piece picks and moves it in one go (precise pointer; the farm's behaviour).
- Slop 7 px (as the farm). The grab offset is kept (the point you pressed stays under the finger); the piece is drawn where the
  finger is every frame, with its outline extended a little past the piece so it shows around the finger.
- **A second finger cancels the drag** (the piece goes back) and becomes a pinch — already how `EditInput` behaves.
- **Release over the interface**: over the *Put away* tray → put away (Happy Home Designer's trash can, but into storage); over any
  other panel → cancel. Use `document.elementFromPoint` at `pointerup` (pointer capture keeps delivering the moves).
- `pointercancel` (an OS gesture, a rotation) → cancel.
- **Keyboard nudge**: arrow keys move the picked piece one grid step (Shift: 4 steps), relative to the screen (up = away from the
  camera). This is also the accessible way to move without dragging.
- **Commit on drop** where green. Where red, it goes back to where it was and the card keeps the reason ("On the sofa — it went
  back"), exactly like the farm.

### 2.6 Snapping

Applied in this order while dragging (each one is cheap arithmetic on axis-aligned rectangles):

1. **Grid**: 0.25 m for furniture, 0.05 m for small decor. **Fine** mode: hold `Alt` (desktop) or the `MagnetStraight` chip on the
   card (touch) → 0.05 m everywhere and no wall snap.
2. **Walls**: if a footprint edge comes within 0.3 m of the room's inner wall face, it snaps flush (gap 1 cm). Rooms are axis-aligned,
   so this is four distances per piece:
   ```ts
   // room = the room's bounds less half the wall thickness (0.08 m); r = the piece's footprint where the finger puts it
   const gaps = { w: r.minX - room.minX, e: room.maxX - r.maxX, n: r.minZ - room.minZ, s: room.maxZ - r.maxZ }
   if (gaps.w < 0.3 && gaps.w <= gaps.e) dx = 0.01 - gaps.w; else if (gaps.e < 0.3) dx = gaps.e - 0.01
   if (gaps.n < 0.3 && gaps.n <= gaps.s) dz = 0.01 - gaps.n; else if (gaps.s < 0.3) dz = gaps.s - 0.01
   ```
   **Wall-backed** types (sofa, bed, wardrobe, bookshelf, TV console, desk, dresser) also **turn to face out** when they snap to a wall
   (Planner 5D's "snap, then face the wall", done for you). With every model built back-at-local-−z, the quarter turn for a wall is
   `n → 0, w → 1, s → 2, e → 3` (anticlockwise quarter turns, the farm's convention). Use hysteresis (snap at 0.3 m, release at
   0.45 m) so the piece does not flicker between turns.
3. **Alignment (P2 polish)**: centre or edge within 0.08 m of a neighbour's centre or edge → snap to it (sofa centred on its rug).
4. **Wall items** (P1, §2.11) live on the wall plane: the drag ray hits the visible wall faces of the room; height snaps to two bands
   (eye level 1.5 m, high 1.9 m) unless Fine.
5. **Decor on surfaces** (P1): small decor dropped over a host's top (table, shelf, nightstand, counter) snaps onto it
   (`hosts: [{ y, rect }]` in the catalogue) and becomes its child (`host` in the save): it moves and is stored with the host.

### 2.7 Validity: what makes a spot red, and what it says

The rules, all 2D except heights (pieces are rectangles in quarter turns, round pieces circles), checked during the drag
(throttled to 10 Hz for the reachability part) and again on drop. Messages are a few words, like the farm's.

| Rule | Message (examples) | Data it uses |
|---|---|---|
| Inside one room, clear of walls, sills, glass, **curtains** | "Through the wall", "In the doorway" | room bounds less 0.08 m; the solid segments from `Walls.tsx` `buildSegments()` (move it to `src/data/walls.ts` so rules and rendering share it) |
| Not on another piece of the same layer (rugs may lie under furniture; wall items only meet wall items; decor on hosts only meets decor) | "On the sofa" | footprints, `layer` per type |
| Not on fixed things | "On the hologram stand", "On the radiator" | a 0.7 m square round each `SCREENS[].holo` (the stand is a cylinder of radius 0.34 with a 0.6 m box collider); radiator rect x 1.18…2.22, z 5.83…5.92; the fitted counter, fridge and island |
| **Doorways stay open**: 0.9 m of floor on each side of each opening | "Blocks the door to the kitchen" | `DOORWAYS` (1.6 m wide), the garden door from `WINDOWS` (`door: true`) |
| **The hinged door can swing**: its 1.6 × 1.6 m quarter in the bedroom | "In the door's swing" | `DOOR.hinge`, `DOOR.width` |
| **Screens can be used**: some reachable floor within 1.3 m of each screen's stand point (the game offers the screen from 1.5 m), and nothing taller than 1.2 m between that floor and the screen | "In front of the screen" | `SCREENS[].position`, `rotationY` (stand point = position + normal × 1.1, as `Screens.tsx` registers it). A fixed circle at the stand point would fail today's studio: the desk chair stands on it (−3.5, −4.78). |
| **Windows**: nothing taller than the sill within 0.25 m of a window | "Covers the window" | `WINDOWS[].sill`, centre, width |
| **Everything stays reachable**: after the move, a flood fill on a 0.15 m grid (standing pieces and fixed things grown by the capsule radius 0.28 m + 5 cm; rugs are floor) from the spawn must reach every doorway, the garden door, and floor within 1.3 m of each screen's stand point and within 1.2 m of each lamp's switch point (their interactables reach 1.5 m and 1.4 m) | "Blocks the way to the bedroom" | 94 × 81 cells for the whole house (≈ 7,600): well under a millisecond in a typed array |
| Fitted / essential pieces cannot be stored | "Fitted — it stays" | catalogue flag |
| Where your body waits: allowed (you stand in the room you edit), but on *Done* you are moved to the nearest free floor | — | the farm's `keepPlayerClear()` idea (module-private in `farm/edit.ts` today: export it or write the house's version on the reachability grid, which already knows the nearest free cell) |

Display: the farm's green/red floor outline (`Outline`, exported and shared), plus the piece tinted faintly red while invalid, plus the
reason as one line on the card (`fit-bad` class). Colour is never the only signal: the line of text says it.

**Test of the rules against today's house** (must hold before anything ships, as `sanitizeLayout` does for the farm): every piece of
the default layout passes every rule. Checked by hand for this document: the doorway strips are clear (the nearest pieces are the
kitchen stools, 0.46 m from the strip; the sofa 1.1 m); the door's swing square (x 2.7…4.3, z 0…1.6) is clear (the accent chair
ends at x 0.91); no piece taller than a sill stands within 0.25 m of a window (the floor lamp is 0.3 m from the west wall); the curtains
(solid) are clear (the bookshelf misses the office window's curtain by 0.18 m); the living-room screen's stand point (−3.5, 4.78) has the coffee table
0.53 m in front and the 0.5 m-tall TV console under the screen; the studio's stand point is taken by the desk chair, which is why
the screen rule asks for *reachable floor near* the stand point rather than the point itself.

### 2.8 Rotating

- **Quarter turns** (`R`, or the *Turn* button with `ArrowClockwise`). Footprints stay axis-aligned rectangles, so the farm's
  `rectToWorld` math is reused unchanged. Happy Home Designer's "touch a piece to rotate it" was considered and left out: on our touch
  rule a tap is also how you pick, so a second tap would turn things by accident.
- If the piece does not fit turned where it stands, the card says why and it does not turn (the farm's `turn()` behaviour).
- **Round pieces** (pouf, round rug, plants, round table) may turn in 45° steps — their circle footprint does not change.
- Free rotation for everything (Sims Alt-rotate): not in v1 (needs OBB/SAT tests; the Sims-like builder's notes show the approach if
  wanted later).

### 2.9 Confirm, cancel and undo

- **Moves commit on drop** (direct manipulation, like the farm) and are saved with the farm's debounced save.
- **Undo** (round `.btn.soft` with `ArrowCounterClockwise`, top left, thumb reach; `Ctrl/⌘+Z`; redo `Ctrl/⌘+Shift+Z`): a stack of
  layout snapshots for the session (≤ 30). One entry per gesture (a drag, a turn, a put-away, a placement). Leaving the mode clears the
  stack.
- **Undo of a purchase in the same session refunds it** (the piece goes back to the shop). After *Done*, purchases are final (you can
  put things away, not sell them). This is friendlier than the Sims' sell-back and never loses coins by accident. *(Owner decision.)*
- **Spending always asks first** (CLAUDE.md): buying opens a card with the price on its button (armed after 450 ms, the farm's
  `ARM_MS`), Cancel first. Placing something **from storage** is free and needs no card.

### 2.10 The card for a picked piece (bottom; bottom-left on a phone held sideways)

Within the panel rules: picture (the piece's own render), a title of a few words ("Armchair"), chips (`.tag`: its size, its room),
one line of status (what to do, or why not), **two buttons**: `Turn` and `Put away` (`Package` glyph). Desktop shows the keys
(`R`, `Del`). The Fine chip (`MagnetStraight`) and colour dots for variants (P2) are chips, not buttons.

Top bar: *Undo* (left), room chips + *House · Farm* switch (centre), *Done* (right). A round **shop** button (`ShoppingBag`) and the
**view turn** button sit bottom-right above the card, where the action button usually is.

### 2.11 Storage, removing, and the shop

- **Put away** (button, `Delete`/`Backspace`, or drop on the tray) moves the piece — with whatever stands on it — into **storage**.
  Nothing is ever destroyed; there is no selling in v1. Storage is unlimited in v1 (ACNH's limit is a possible later coin sink).
- **The shop sheet** (the farm's `.farm-panel` shell as a bottom sheet; a right-hand sheet on a phone held sideways, exactly as the farm
  panels already behave): first tab **Yours** (what is in storage, each a free card with its count), then category chips
  *Seating · Tables · Beds · Storage · Lights · Plants · Rugs · Wall · Decor*. Cards reuse `.farm-card` (picture 64 px, name, `.tag`
  chips for price and size, a lock chip "Earn 300 at the gate" when not unlocked yet).
- **Buying flows into placing** (Sims/Casita/IKEA): tap a card → the buy card (picture, name, chips, `Cancel`, `Buy · 🪙 120`) → the
  piece appears **already placed** at the nearest free spot to the middle of the view (spiral search on the grid over the four turns,
  wall-backed types tried against walls first), **picked**, so the next drag moves it. If no spot fits, it goes to storage with a toast
  "Bought — it is in Yours (no room here)".
- **Placing from storage** works the same without the buy card.
- **Crafted decor** (P2): some cards cost farm goods instead of (or with) coins — "Wool rug: 2 rolls of cloth · 10 coins". They use
  the `ItemPic` with counts, and their card asks first like the oven's (`setConfirm` style).
- Wall items: the shop places them on the nearest free wall in view. A **Floor · Wall** chip on the card (ACNH's "+") is not needed:
  picking a wall item puts the mode into wall placement automatically.

### 2.12 Keyboard and mouse summary (desktop)

| Key / input | Action |
|---|---|
| `B` / ✥ | Open the edit mode for where you are; `B` again or `Esc` leaves |
| Left click | Pick; drag to move (picked or not) |
| Drag on floor / wheel | Pan / zoom |
| `R` / `Shift+R` | Turn the picked piece a quarter turn anticlockwise / clockwise |
| `,` `.` | Turn the view 90° |
| Arrows (`Shift`: ×4) | Nudge one grid step |
| `Alt` held | Fine: 5 cm grid, no wall snap |
| `Del` / `Backspace` | Put away |
| `Ctrl/⌘+Z`, `Ctrl/⌘+Shift+Z` | Undo / redo |
| `Tab` | Next piece in the room |
| `W` `A` `S` `D` | Pan the view (walking is off while editing) |
| `C` | Open the shop sheet (catalogue) |

Keys already taken elsewhere and kept out of this map: `E` (interact), `V` (view), `H` (the new top-of-screen mode, `src/ui/HudMode.tsx`),
`1`–`9` (seeds), `Enter`/`N`/`Y` (the buyers' panel).

### 2.13 Accessibility and comfort

44 px targets everywhere; text ≥ 15 px; reasons in words; keyboard covers everything (nudge instead of drag); reduced motion shortens
the camera flight (as `Player.tsx` already does for screens); a vibration tick on snap where the phone can (the private `buzz()` in
`lib/interaction.ts` — export it; it only buzzes on coarse pointers with the *Vibration* setting on).

### 2.14 Deliberately not in v1

Free rotation, multi-select / group move, scaling or stretching pieces, building or removing walls, multiple saved layouts (Hay Day),
selling back. Each can come later without changing the save format (§3 leaves room).

---

## 3. Data model and save format

### 3.1 Catalogue (code, `src/home/catalogue.ts`)

```ts
export type Layer = 'floor' | 'stand' | 'wall' | 'surface' // rugs | furniture | on a wall | on a host's top
export type Category = 'seating' | 'tables' | 'beds' | 'storage' | 'lights' | 'plants' | 'rugs' | 'wall' | 'decor'

export interface CatalogueItem {
  id: CatalogueId // 'sofa', 'armchair', 'chair-desk', 'rug-large', 'frame-tall', …
  name: string // "Armchair"
  category: Category
  layer: Layer
  size: [number, number, number] // width (x), height, depth (z) in metres: the collider and the footprint, back at local −z
  round?: boolean // a circle footprint (pouf, round rug, plant): may turn in 45° steps
  wallBacked?: boolean // snaps its back to a wall and faces out
  fitted?: boolean // part of the house: cannot be stored (counter, fridge, island in v1)
  price: number // coins; 0 = a starter piece, not sold again
  unlock?: number // lifetime coins earned at the gate (farm.stats.earned) before it shows in the shop
  craft?: Partial<Record<ProduceId, number>> // farm goods it takes (P2)
  hosts?: { y: number; rect: Rect }[] // tops that small decor can stand on (local frame)
  lamp?: { y: number; kind: 'floor' | 'desk' | 'bedside' } // a switchable lamp: lit from the lamp-light pool
  model: { kind: 'boxes'; make: () => ReactNode } | { kind: 'sculpt'; make: () => Structure } | { kind: 'glb'; id: string; fallback: () => ReactNode }
  variants?: { name: string; tint: string }[] // colours (P2)
  rooms?: RoomId[] // where it may go (e.g. a bath only in a bathroom, later)
}
```

### 3.2 What is saved (inside the farm save, `FarmData.home`)

```ts
export interface HomePiece {
  id: string // unique; the starter pieces keep today's ids ('sofa', 'coffee-table', 'stool-a'…), so props/<id>.glb still applies
  type: CatalogueId
  room: RoomId // written on save, recomputed and checked on load (roomAt of the footprint's middle)
  x: number // the footprint's middle, metres (floor and surface layers), or the wall point for wall items
  z: number
  rot: 0 | 1 | 2 | 3 // quarter turns anticlockwise seen from above (the farm's Placement convention); round pieces may use 0..7 in 45° steps
  y?: number // wall items: height of their middle
  host?: string // surface decor: the piece it stands on (x, z, rot are then in the host's frame)
  variant?: number // colour/style (P2)
}

export interface HomeLayout {
  v: 1 // format version of this block
  seq: number // the next number for a bought piece's id ('p23')
  pieces: HomePiece[]
  stored: { type: CatalogueId; variant?: number }[] // owned, not placed (put away or bought with no room)
}
```

Example (what `localStorage['3d-home:farm:v1']` gains):

```json
"home": {
  "v": 1,
  "seq": 3,
  "pieces": [
    { "id": "sofa", "type": "sofa", "room": "living", "x": -3.5, "z": 2.5, "rot": 0 },
    { "id": "armchair", "type": "armchair", "room": "living", "x": -5.85, "z": 3.4, "rot": 1 },
    { "id": "vase-1", "type": "vase", "room": "living", "x": 0.4, "z": -0.11, "rot": 0, "host": "coffee-table" },
    { "id": "frame-1", "type": "frame-wide", "room": "living", "x": -6.88, "z": 3.4, "rot": 1, "y": 1.65 },
    { "id": "p2", "type": "chair-dining", "room": "kitchen", "x": 2.25, "z": -1.5, "rot": 2 }
  ],
  "stored": [{ "type": "pouf" }]
}
```

Size: ~60 pieces × ~90 bytes ≈ 5 KB per slot — nothing for localStorage.

### 3.3 Loading, sanitising and migrating

- `load()` in `farm/state.ts` calls `sanitizeHome(raw.home)`, written like `sanitizeLayout`:
  1. **No `home` (every save made before this feature) → `defaultHome()`**: today's furniture exactly where `Furnishings.tsx` puts it
     (rotations converted: `rotationY = π/2 → rot 1`, `π → 2`), today's dressing attached to its hosts, today's frames on their walls.
  2. `v` older than current → run `MIGRATE[v]` steps in order (a table of pure functions; v1 is the first).
  3. Each piece: unknown `type` → dropped; non-finite numbers → dropped; `rot` normalised; duplicate `id` → renamed; a `host` that is
     missing → the piece goes to storage; a piece that **no longer fits** (a rule changed) → **storage, never lost** (the farm sends places
     home; furniture has no home spot once moved).
  4. Starter pieces missing from both lists (should not happen) → back into storage.
  5. `stored`: known types only, at most 99 per type.
- Export/import already passes through `load()`, so files carry the house; bump the export file's `version` to 2 and keep accepting 1.
- Fixed default ids for starters keep the `props/<id>.glb` replacement working; bought copies look up the GLB by **type**, so
  `assets.props[piece.id] ?? assets.props[type]`.

### 3.4 Runtime state (not saved)

`src/home/edit.ts` (like `farm/edit.ts`): `picked`, `drag` (`{ id, at, fit }`), `note`, `undo: HomeLayout[]`, `redo`, `fine`,
`viewYaw`, `room`. While dragging, only the dragged piece is drawn at `drag.at`; the layout itself only ever holds placements that fit.

### 3.5 The scene, driven by the data

- `<Pieces />` replaces `<Furnishings />`: one `<Placed>` group per piece (position/rotation from the layout, or from the drag);
  inside it the model (boxes / sculpt / GLB) and, for surface decor, its children.
- Colliders: one fixed `RigidBody` per standing piece with `key={x|z|rot}` (the farm's `Body` pattern), so a commit re-creates it;
  nothing physical moves during a drag. Wall and surface items have no collider (as `Decor` today).
- Lamps: `LAMPS` entries for the floor, desk and bedside lamps become catalogue lamps; `Lamps.tsx` renders a **fixed pool** of
  point lights (today's four) assigned to the lamps of the house (switched-on first, nearest the player first) — the light count never
  changes, so no shader recompiles. Extra lamps beyond the pool glow (emissive shade + bloom) without casting light.
- Pickups standing on a moved host are carried with it (their `items[id]` gets the new position and `rev + 1`, which re-creates the body).
- Dressing that is not furniture (switches, outlets, radiator, smoke detectors, backsplash, pendants, kitchen counter items) stays in
  `Dressing.tsx`.

---

## 4. Catalogue and economy

### 4.1 What the farm earns (from `src/farm/data.ts`)

Income is limited by **buyers**, not by crops: one buyer every 120 s at first, down to every 30 s with the *busier lane* upgrades;
each pays about the fair price × quantity × 1.04 on average (offer factors 0.6/0.85/1/1.25/1.6 with weights 15/23/28/20/14 %).
Crop profit per bed is 3–13 coins/min (lettuce 13.3, tomato 9.5, pumpkin 7.2; ×1.5 harvest with compost), so beds are rarely the
limit.

| Stage | Buyers | Typical order | Coins per minute (rough) |
|---|---|---|---|
| First 30 min | 1 per 2 min | 2–4 crops ≈ 6–12 coins | **≈ 5** |
| After the first upgrades (≈ 1 h) | 1 per 75–90 s | crops, milk, eggs, wool ≈ 15–25 | **≈ 15–25** |
| Late (cakes, cloth, pace maxed) | 2 per min | cakes 40–50, cloth ≈ 30, pumpkins ≈ 33 | **≈ 50–90** |

Returning after hours away, a full line (up to 15 buyers) can pay several hundred coins at once (`resumeFrom()` fills the queue).

### 4.2 Price tiers and unlocks

Unlock by **lifetime coins earned at the gate** (`farm.stats.earned`, already saved): it rewards playing, cannot be bought around,
and needs no new counter.

| Tier | Unlock (earned) | Price range | Time to afford at that stage | Examples |
|---|---|---|---|---|
| 0 Small decor | 0 | 6–35 | 1–6 min early | potted herb 8, stack of books 6, vase of flowers 12, cushion 10, candles 8, small frame 15, basket 12, wall clock 25, table lamp 30, side table 35, stool 30 |
| 1 Everyday furniture | 250 | 40–120 | 3–8 min mid | dining chair 45, small rug 40, mirror 50, nightstand 60, big plant 60, floor lamp 70, coffee table 80, armchair 110, bookshelf 120 |
| 2 Big pieces | 800 | 90–220 | 5–12 min mid | large rug 90, desk 140, dining table 150, dresser 150, wardrobe 160, sofa 180, double bed 220 |
| 3 Statement pieces | 2,000 | 140–520 | 3–8 min late | rocking chair 140, record player 160, grandfather clock 260, wood stove 380 (glowing, no new light), piano 450, canopy bed 520 |
| Room looks (P2) | 250 | 40–80 | — | paint a room 40, new floor 80 (per room; uses the existing procedural surfaces and tints) |
| Crafted (P2) | when you have the goods | goods + 5–15 | — | wool rug (2 cloth + 10), quilt (1 cloth + 10), two cushions (1 cloth), fruit bowl (4 lemons + 4 strawberries), wheat wreath (3 sheaves), a cake on a stand (1 cake) |

One of everything ≈ 4,500 coins, about 1.5× everything the farm sells today (3,060): a real second sink without making the farm
pointless. Prices live in the catalogue file, so tuning is one edit.

### 4.3 Proposed launch catalogue (P1, ~25 pieces)

Today's pieces become the starters (price 0, not sold again unless re-modelled light): the 19 solid ones from `Furnishings.tsx`
(three of them the fitted kitchen), 3 rugs, 3 frames, the wall clock and the mirror from `Dressing.tsx`, and the floor, desk and
bedside lamps. Plus about a dozen new ones:

| Type | Category / layer | Size (w × h × d, m) | Price | Unlock | Source |
|---|---|---|---|---|---|
| sofa, coffee-table, tv-console, plant-living, armchair, pouf, desk, chair, bookshelf, plant-studio, stool, bed, nightstand, wardrobe, accent-chair, rugs ×3, frames ×3 | starters | as today | 0 | — | today's boxes / GLBs |
| counter, fridge, island | fitted | as today | — | — | stay fixed in v1 |
| potted herb | decor / surface | 0.18 × 0.25 × 0.18 | 8 | 0 | sculpt (lathe pot + blob) |
| vase of flowers | decor / surface | 0.15 × 0.4 × 0.15 | 12 | 0 | sculpt |
| stack of books | decor / surface | 0.25 × 0.15 × 0.2 | 6 | 0 | boxes |
| cushion | decor / surface | 0.4 × 0.15 × 0.4 | 10 | 0 | sculpt (`detail` cloth) |
| table lamp | lights / surface | 0.3 × 0.5 × 0.3 | 30 | 0 | sculpt (lathe) |
| side table (round) | tables / stand | 0.5 × 0.55 × 0.5 | 35 | 0 | sculpt |
| wall clock | wall | 0.4 × 0.4 × 0.05 | 25 | 0 | today's `WallClock` |
| chair-dining (farmhouse chair) | seating / stand | 0.45 × 0.9 × 0.5 | 45 | 250 | sculpt (`boards` surface) |
| floor lamp | lights / stand | 0.45 × 1.6 × 0.45 | 70 | 250 | today's fixture |
| small rug (round, woven) | rugs / floor | 1.6 × 0.01 × 1.6 | 40 | 250 | flat disc + fabric normal map |
| dining table | tables / stand | 1.6 × 0.76 × 0.9 | 150 | 800 | sculpt or boxes |
| dresser with mirror | storage / stand, wall-backed | 1.2 × 1.6 × 0.5 | 150 | 800 | boxes |
| rocking chair | seating / stand | 0.6 × 1.0 × 0.9 | 140 | 2,000 | sculpt |
| wood stove | statement / stand, wall-backed | 0.7 × 1.1 × 0.6 | 380 | 2,000 | sculpt (clay/brick surfaces exist) |

### 4.4 Optional: a cosy score (owner decision)

ACNH's Happy Home Academy, simplified: each room earns up to 5 stars for having a seat, a table, a light, a plant or flowers, a rug, wall
art, and three or more pieces of one colour set. Shown on the room chips. If wanted, it can pay back into the farm: buyers offer 1 % more
per star (at most +20 %), which makes decorating part of the economy instead of a pure sink. Without it, decorating is cosmetic.

### 4.5 No selling back in v1

Hay Day keeps stored decorations in the shop for free re-placement; the Sims sells back. Selling invites buy/sell loops and needs another
confirmation card; putting away is enough. (Owner decision; easy to add later with a 50 % refund.)

---

## 5. Asset plan

### 5.1 Options compared

| Source | Licence | Measured / stated size | Look | Fits |
|---|---|---|---|---|
| **Our boxes** (`B` in `Furnishings.tsx`) | ours | a rounded `B` is 300 triangles (three's `RoundedBoxGeometry` with 2 corner segments = 5 × 5 quads a face), a sharp one 12; the placeholder sofa is 14 boxes in 3 materials | matches the house today (procedural veneer, fabric, paint) | **Yes**: all 19 starters already exist |
| **Our sculpt kit** (`src/lib/sculpt`) | ours | triangles chosen per model (the gallery `?gallery` labels each; `12-models` expects over a thousand per animal once posed); one instanced draw per part per type | soft, rounded, per-vertex colour, `surface` boards/clay/brick, `detail` for cloth | **Yes**: cushions, plants, lamps, rounded wood, stoves; matches the farm's buildings |
| [KayKit Furniture Bits 1.0](https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0) | **CC0** [V] (LICENSE.txt: "Creative Commons Zero, CC0") | measured from the repo's glTF: 60–808 triangles per model (armchair 528, couch 636, couch with pillows 808, double bed 540, standing lamp 320, chair 308, table 168, picture frame 60, rug 68–176); one material; one 1024² gradient atlas ("can be downsampled up to 128x128") | flat, toy-like gradient colours | Good on budget; style differs from the house's PBR-ish materials; atlas means no per-part re-material |
| [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) | **CC0** [V-search] (also the LICENSE of the GitHub mirror [Hidencod/tge-assets](https://github.com/Hidencod/tge-assets), which credits Kenney) | 140 assets, v1.0 (2018) [V-search]. Measured from 20 GLBs of that third-party mirror (`packs/furniture-kit`): **28–602 triangles** (sofa 128, double bed 264, open bookcase 320, desk 198, chair 170, fridge 250, round floor lamp 76, potted plant 60, round rug 188, bathtub 602); no textures; flat colours in **named materials** (`wood`, `carpet`, `carpetWhite`, `metal`, `metalDark`, `glass`) | flat colours, simple | Very light, and the material names map straight onto our procedural sets (`wood → veneer`, `carpet → fabric`, `metal → brushed`): the best CC0 fallback for the house's look. Take the canonical files from kenney.nl, not the mirror (its conversion marks materials unlit) |
| [Quaternius Ultimate House Interior Pack](https://quaternius.com/packs/ultimatehomeinterior.html) | **CC0** [V-search] ([FAQ](https://quaternius.com/faq.html): free, no attribution) | 123 models (FBX/OBJ/Blend; glTF on the Poly Pizza mirror) [V-search]; triangle counts [UNVERIFIED] | soft low-poly | Good candidate for bathroom/kitchen items we do not have |
| [Poly Haven models](https://polyhaven.com/license) | **CC0** [V-search] | realistic, thousands to tens of thousands of triangles, 1–4k texture sets [UNVERIFIED per model] | photoreal | Too heavy for multiple copies on phones; fine for one hero piece |
| [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) | per model: CC0 or **CC BY 4.0** | the repo's props measured: 4,196–68,409 triangles | photoreal PBR | **Do not sell copies.** Note: sofa, plant-living, accent-chair and pouf are **CC BY 4.0** (see `src/data/credits.ts` and `scripts/assets.manifest.json`), outside the MIT/BSD/Apache/ISC/CC0 list in this brief — owner decision: keep (credited) or replace |

### 5.2 Recommendation

1. **Model in code first.** The 19 starters keep their boxes (or their GLB where present). New pieces use the sculpt kit's
   `Structure` (one part per material, drawn with `Parts`, all copies of a type in one draw per part) — the same way the farm's oven,
   hen house and troughs are made. Each new model goes into `src/models/furniture.ts`, `gallery.ts` and `checks.ts`
   (the checks must find nothing; `12-models` fails otherwise), closed ends, `surface: 'boards'` for planks, `detail` for fabric.
2. **CC0 packs as a fallback** for pieces that are slow to sculpt (bathroom, kitchen appliances): fetch through
   `scripts/assets.manifest.json` + `npm run assets:fetch` (raw.githubusercontent.com is reachable from the cloud sandbox, so the
   KayKit repository works; Kenney and Quaternius come from their own sites, which the default cloud network does not allow —
   `src/assets/README.md` already lists quaternius.com among the hosts to allow — so expect a manual download), convert `.gltf + .bin` to `.glb` with the
   `@gltf-transform/cli` already in devDependencies, compress with `npm run assets:optimize` (meshopt + WebP; the manifest's
   `textureSize` 512 and `simplify` options already exist), and re-material by **material name** to our procedural `material()`
   sets so they sit in the house's look — Kenney's names (`wood`, `carpet`, `metal`, `glass`…) make this a lookup table; KayKit's single
   gradient atlas cannot be re-materialled per part, so it keeps its own toy look. Credit them anyway in
   `src/data/credits.ts` (CC0 does not require it; the file is the project's record).
3. **Pictures for the shop**: render each piece from its own model, like the farm's goods (`src/models/itemArt.ts`,
   `node scripts/render-item-art.mjs`, `?items`): 256 px WebP ≈ 7 KB each. Category chips use Phosphor glyphs (`Armchair`, `Couch`,
   `Bed`, `Lamp`, `PottedPlant`, `Rug`, `FrameCorners`) — no new art files needed; Fluent 3D art only for the sheet's header
   (e.g. a `couch-and-lamp` WebP added to `src/assets/art/`, MIT, already credited as a set).

### 5.3 Triangle and draw budgets

- Per piece: big furniture ≤ 3,000 triangles, everyday furniture ≤ 1,500, decor ≤ 600, plants ≤ 2,500 (leaf cards).
- Per house (the decorate overview can show all four rooms): furniture ≤ 80,000 triangles in total, ≤ 120 colour-pass draws.
  Today's living room already spends ≈ 122k on four GLB props (Khronos samples); run the manifest's `simplify` on them
  (meshoptimizer, `simplifyError` ≈ 0.01) or keep them one-of-a-kind.
- Cap copies per type (e.g. 12 chairs, 6 rugs) through the instanced `max`; the shop greys a card out at the cap ("12 is plenty").
- Measure, do not guess: extend `05-budget` (§7) with a decorate-mode view and a "fully furnished" stress layout.

### 5.4 Keeping it fast on phones

| Concern | Approach | Why it is cheap |
|---|---|---|
| Draw calls | Sculpt-kit pieces: one `Parts` (`InstancedMesh` per part) per catalogue type, all copies in it, re-posed only when the layout changes. Box pieces: their own `StaticBatch` inside their moving group while decorating (the `Places.tsx` pattern), one house-wide `StaticBatch` re-made on *Done* (keyed by a layout revision). GLB pieces stay `noBatch` as today. | A dozen chairs cost what one does; outside the mode the house draws as few batches as now. |
| Triangles | Per-piece budgets (§5.3); caps per type; no copies of the heavy Khronos props. | The overview of four rooms stays far under 250k. |
| Colliders (rapier) | One fixed `RigidBody` + `CuboidCollider` per standing piece, created on commit (`key` = placement), none during a drag; wall and surface items have none. | A handful of fixed bodies change per edit; the physics step does not see the drag at all. |
| Overlap tests | 2D: axis-aligned rectangles (quarter turns) and circles (round pieces), per layer, O(n) per test with n ≤ 60. No BVH: there are no mesh-accurate tests to accelerate. Picking: analytic ray–box tests. | Microseconds per drag move. |
| Wall snap | Four distances per piece to its room's inner faces (§2.6). | Arithmetic. |
| Reachability | Flood fill on a 0.15 m grid (≈ 7,600 cells) in a `Uint8Array`, throttled to 10 Hz while dragging, exact on drop. | Well under 1 ms. |
| Shadows | Already re-rendered only when a caster moves (`Lighting.tsx`). | Costs only while something is dragged. |
| Lights | Fixed pool of point lights; extra lamps glow without lighting. | No shader recompiles. |
| New materials | The cut-away fade already exists; add the drei `Grid` and the red "does not fit" tint to `Warmup.tsx`'s up-front compile. | No first-use stall. |
| Textures | GLB props pass through `fitModelTextures` (phones cap at 1024, low-memory 512); CC0 atlases 512 or less. | Memory within `profile.ts`. |
| Saving | The farm's debounced save (1.2 s) plus `pagehide`/`visibilitychange`; ~5 KB more per slot. | No extra writes. |

---

## 6. Phased implementation plan (mapped to files)

Effort in developer-days for someone who knows this codebase; P0 = must, P1 = should, P2 = could.

### Phase A — Rules and data, no UI (P0, 2–3 d)

- `src/data/walls.ts` (new): move `buildSegments()` and the segment type out of `src/scene/Walls.tsx`; `Walls.tsx` imports it.
- `src/home/catalogue.ts` (new): the 19 starter types (+ fitted flags), sizes from today's `Solid` sizes, layers, hosts, lamps.
  Normalise the models so their back is at local −z (the sofa, desk, chair, wardrobe, nightstand, TV console and bookshelf already
  are; today's `Bed` has its headboard at +z: turn the model half round and store the default bed with `rot: 2`).
- `src/home/layout.ts` (new, pure like `farm/layout.ts`): `HomePiece`, `HomeLayout`, `defaultHome()` from today's coordinates,
  `footprint()` (reuse `rectToWorld`/`toWorld` from `farm/layout.ts`, moved to `src/lib/place.ts`), `canPlacePiece(layout, piece) → Fit`
  with every rule of §2.7, `snapPiece()` (grid + walls + wall-backed facing), `findFreeSpot()`, `reachable()` (flood fill),
  `sanitizeHome()` + `MIGRATE`.
- `src/farm/state.ts`: `home` in `FarmData`, `fresh()`, `load()` (sanitise), save; actions `movePiece`, `turnPiece`, `storePiece`,
  `placeStored`, `buyPiece` (coins check, `stats` untouched), all `bump()` + `save()`; export file version 2.
- `src/farm/Garden.tsx` debug hook (or a new `src/home/debug.ts`): `__home.home = { state, canPlace, movePiece, … }`.
- Done when: `defaultHome()` passes every rule; a save from today loads to the same house; nothing visible changed.

### Phase B — The house drawn from the data (P0, 2–3 d)

- `src/scene/Furnishings.tsx`: keep `B`, `GlbProp`, `GlbDecor`; export the piece components as catalogue models; replace the JSX list by
  `src/home/Pieces.tsx` (one `<Placed>` group per piece, collider keyed by placement, GLB by id then type).
- `src/scene/House.tsx`: furniture in a `StaticBatch` remounted with `key={home revision}` outside the edit mode (as few draws as today);
  while decorating, per-piece batches (the `Places.tsx` pattern).
- `src/scene/Dressing.tsx`: table-top and shelf items move into their hosts' models (local offsets); fixtures stay.
- `src/scene/Lamps.tsx`: lamp positions from the pieces; fixed light pool.
- `src/scene/Pickups.tsx`: carry pickups on a moved host.
- Done when: `02-interactions`, `04-physics`, `05-budget` pass unchanged (they teleport next to the TV, notebook, lamp, door and island).

### Phase C — Decorate mode MVP (P0, 4–6 d)

- `src/store.ts`: `editArea: 'farm' | 'house'`; `setEditing(on, area?)`.
- `src/scene/Player.tsx`: `B` opens the area you are in; `src/farm/EditPanel.tsx` `EditButton` likewise.
- `src/lib/edit/` (new, extracted from `src/farm/EditMode.tsx`): `EditCamera` (target + framing per area), `useEditInput` (press / drag /
  tap / pinch / wheel / second finger / release-over-UI), `Outline`. The farm keeps working through them (`13-layout` must still pass,
  after it teleports outdoors before pressing `B`, or uses the area switch).
- `src/scene/Ceilings.tsx`, `src/scene/Walls.tsx`, `src/scene/House.tsx`: cut-away while decorating (§2.3).
- `src/home/DecorateMode.tsx` (scene: picking by ray–box, drag, overlays, drei `Grid`), `src/home/edit.ts` (zustand: picked, drag, undo),
  `src/home/DecoratePanel.tsx` (top bar, piece card, nudge keys, undo/redo keys), `src/styles.css` (`.home-*` built on `.edit-card`,
  `.farm-panel`, `.farm-card`).
- `src/ui/glyphs.ts`: `ArrowClockwise`, `Package`, `ShoppingBag`, `MagnetStraight`, `Armchair`, `Couch`, `Bed`, `Lamp`, `PottedPlant`,
  `Rug`, `FrameCorners`.
- Tests: `tests/e2e/15-decorate.spec.ts` (§7; `14` is taken by the new `14-hud.spec.ts` in the working tree). Done when: move, turn,
  put away, undo work by mouse, touch and keyboard, with reasons.

### Phase D — Storage, shop and buying (P1, 3–4 d)

- `src/home/ShopSheet.tsx` (tabs *Yours* + categories, cards, lock chips), `src/home/BuyCard.tsx` (armed confirm), spawn via `findFreeSpot`.
- Catalogue prices and unlocks (§4); undo refunds within the session.
- `src/models/itemArt.ts`, `scripts/render-item-art.mjs`: furniture pictures; `src/assets/items/*.webp`.
- Done when: buy → placed and picked; no room → storage; storage → place; coins and the save are right; `11-startup` export/import carries it.

### Phase E — Wall items and decor on surfaces (P1, 3–4 d)

- Wall layer (frames, mirror, clock, shelves): placement on the visible wall faces; height bands; rules for windows, doors, screens.
- Surface layer: hosts' tops, children in the host's frame, moved and stored with the host.

### Phase F — Content and extras (P2, ongoing)

- New pieces: `src/models/furniture.ts` + `gallery.ts` + `checks.ts` (≈ 0.5–1 d per piece including checks and pictures).
- Colour variants (Homescapes-style restyle), room paint and floors (tints of the existing procedural surfaces), crafted decor from farm
  goods, the cosy score, daily specials in the shop, a storage cap as a sink.

Total for Phases A–E (P0 + P1): about 14–20 developer-days, plus runs of the ~25-minute e2e suite; content after that at the pace
of modelling.

---

## 7. Risks and how to test

### 7.1 Risks

| Risk | Mitigation |
|---|---|
| Existing tests depend on today's positions (`tests/README.md`: TV, notebook, lamp, door, island in `02` and `04`) | `defaultHome()` = today's coordinates; Phase B is "no visible change" and runs the full suite before any UI exists. |
| `13-layout` presses `B` from the spawn, which is indoors | Change it to teleport outdoors first (or tap the *Farm* chip); keep `editing` as the flag it waits on. |
| Draw calls rise when furniture leaves the house-wide batch | Per-piece batches only while decorating; re-merge on Done (`StaticBatch` keyed by layout revision). Rough estimate from `Furnishings.tsx`: most pieces have 3–5 distinct material looks (the bookshelf about 9, for its book colours), so ≈ 75–100 colour-pass draws for the furniture while decorating (and as many in the shadow pass), far under 700 — measure in `05`. |
| Triangles: heavy GLB props, many copies | Per-piece budgets, instancing caps, never sell the Khronos props; `05` stress layout. |
| Shader recompiles: new lights, new materials shown first in the mode (drei `Grid`, red tint) | Fixed light pool; add the new materials to `src/scene/Warmup.tsx`'s up-front compile. |
| Transparency of faded walls (sorting, overdraw on phones) | The fade already ships for third person; if needed, hide (`visible=false`) instead of fading on the Low tier. |
| Physics: a collider re-created under the player or a pickup | `keepPlayerClear()`; pickups carried; colliders only change on commit. |
| Touch conflicts (pan vs drag in a cluttered room; pinch starting on a piece) | Tap-then-drag on touch; second finger cancels the drag; release over UI cancels (§2.5). |
| Reachability false positives (a narrow but walkable gap judged closed) | Grid 0.15 m, capsule radius 0.28 m + 5 cm margin; a unit-level test that the default house and a few known layouts pass. |
| Save migration bugs | `sanitizeHome()` never throws, sends misfits to storage, never deletes owned pieces; fixtures of today's save JSON in the tests. |
| Economy tuning | Prices in one file; unlock by lifetime earnings; refund-on-undo prevents regret. |
| Licence drift | CC0/MIT only for new assets; flag the existing CC BY props (owner decision). |

### 7.2 Tests (Playwright, `tests/e2e`)

Follow the suite's rules: assert through `window.__home` (store, `farm`, new `home` hooks), never copy; advance and read in the same
`page.evaluate`; one shared page (`helpers.ts`).

- **`15-decorate.spec.ts`** (new), with helpers reused from `13-layout` (`onScreen()` to project a floor point, mouse `drag()`), plus a
  touch drag through CDP `Input.dispatchTouchEvent` as `07-phone` already does:
  1. Inside the living room, `B` → `editing && editArea === 'house'`, camera above 3 m, ceilings hidden.
  2. Tap the coffee table → picked; drag it onto the sofa → `drag.fit.ok === false`, card says "On the sofa", layout unchanged.
  3. Drag it 1 m east → stays, `canPlace` true, saved in `localStorage` `home.pieces`.
  4. Drag the armchair into the living↔studio doorway → red, "Blocks the door…"; into the screen's stand area → red.
  5. Block the only way to the bedroom with the wardrobe (a layout set through the hook, then one drag) → red "Blocks the way…".
  6. `R` turns the picked piece; a turn that would not fit does not happen.
  7. *Put away* → the piece is in `stored`, its collider is gone (a rapier ray down through its old middle hits the floor, not the piece).
  8. Shop: with 500 coins, buy a chair → card armed after the delay → coins 455, the chair placed and picked; `Ctrl+Z` → refunded.
  9. Place from storage → back in the room at a free spot.
  10. *Done* → camera back below 2 m; the dressing on the table moved with it (the vase's world position changed by 1 m).
  11. Touch (its own page as a phone, like `07`): tap-then-drag moves; a drag on an unpicked piece pans; a second finger cancels the drag.
  12. No console errors.
- **Save migration**: a fixture of today's save (no `home`) loads to `defaultHome()`; a hand-broken `home` (unknown type, NaN, missing host,
  overlapping pieces) loads without errors, misfits in storage; export → import into slot 3 keeps the house (`11-startup`).
- **Budget** (`05`): add the decorate overview (all four rooms) and a stress layout (the catalogue's caps placed) — under 700 calls and
  250k triangles.
- **Models** (`12-models`): every new piece in the gallery and the checks.
- **Physics** (`04`): the eye-inside-solid grid on the default layout and on one moved layout.
- **Rules as data tests**: `page.evaluate` over `__home.home.canPlace` for a table of known spots (doorways, swing, screens, windows,
  curtains, pedestals, radiator) — fast, no dragging.

---

## 8. Links and licences

Libraries, engines and reference projects (licence and release verified as marked in §1.2):

| Link | Licence | Notes |
|---|---|---|
| https://github.com/pmndrs/drei (docs: [DragControls](https://github.com/pmndrs/drei/blob/master/docs/gizmos/drag-controls.mdx), [PivotControls](https://github.com/pmndrs/drei/blob/master/docs/gizmos/pivot-controls.mdx), [TransformControls](https://github.com/pmndrs/drei/blob/master/docs/gizmos/transform-controls.mdx), [Grid](https://github.com/pmndrs/drei/blob/master/docs/gizmos/grid.mdx)) | MIT | npm 10.7.9 (2026-09-25); depends on `@use-gesture/react` ^10.3.1 |
| https://github.com/pmndrs/xr — `@react-three/handle` ([intro](https://github.com/pmndrs/xr/blob/main/docs/handles/introduction.md), [component](https://github.com/pmndrs/xr/blob/main/docs/handles/handle-component.md)) | MIT text (LICENSE, © 2024 Bela Bohlender) | npm 6.6.32 (2026-10-13) |
| https://github.com/pmndrs/use-gesture | MIT | npm 10.3.1 (2024-03-21) |
| https://github.com/gkjohnson/three-mesh-bvh | MIT | npm 0.9.18 (2026-11-03) |
| https://github.com/mrdoob/three.js | MIT | npm 0.187.0 (2026-10-30) |
| https://github.com/pmndrs/react-three-rapier | MIT | already used |
| https://github.com/furnishup/blueprint3d | MIT (LICENSE.txt) / "(MIT OR Apache-2.0)" (package.json) | three ^0.69; npm `blueprint3d` 0.0.1-1 (2018) |
| https://github.com/aalavandhaann/blueprint-js | MIT (LICENSE) vs ISC (package.json) | depends on GSAP (https://gsap.com/standard-license, not OSI) |
| https://github.com/cvdlab/react-planner | MIT | npm 2.0.6 (2019-11-03) |
| https://github.com/pascalorg/editor | MIT | `@pascal-app/*` 1.0.7 (2026-11-08) |
| https://github.com/ch-bas/threejs-sims-house-builder ([design notes](https://github.com/ch-bas/threejs-sims-house-builder/blob/main/docs/design-notes.md), [wiki: Furnishing](https://github.com/ch-bas/threejs-sims-house-builder/wiki/Furnishing), [wiki: Phones and tablets](https://github.com/ch-bas/threejs-sims-house-builder/wiki/Phones-and-tablets)) | MIT | v1.30.0 (2026-11-07) |
| https://github.com/rohitguta2432/casita | MIT | v1.0.0 |
| https://github.com/laanlabs/openPlan3D | MIT | SvelteKit |
| https://github.com/pmndrs/triplex | not shown [UNVERIFIED] | developer tool |
| https://github.com/charkour/zundo | MIT | npm 2.3.0 (2024-11-17) |

npm pages for the versions and dates above (data read from registry.npmjs.org): https://www.npmjs.com/package/@react-three/drei,
https://www.npmjs.com/package/@react-three/handle, https://www.npmjs.com/package/@use-gesture/react,
https://www.npmjs.com/package/three-mesh-bvh, https://www.npmjs.com/package/three, https://www.npmjs.com/package/react-planner,
https://www.npmjs.com/package/blueprint3d, https://www.npmjs.com/package/@pascal-app/core, https://www.npmjs.com/package/zundo,
https://www.npmjs.com/package/gsap (its licence field: "Standard 'no charge' license").

Assets:

| Link | Licence | Notes |
|---|---|---|
| https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0 (and https://kaylousberg.itch.io/furniture-bits) | CC0 [V] | 50+ models, triangle counts measured above |
| https://kenney.nl/assets/furniture-kit (mirrors https://opengameart.org/content/furniture-kit, https://github.com/Hidencod/tge-assets) | CC0 [V-search; mirror LICENSE read] | 140 assets, v1.0 (2018); 28–602 triangles measured on the GitHub mirror |
| https://quaternius.com/packs/ultimatehomeinterior.html, https://quaternius.com/faq.html (mirror https://poly.pizza/bundle/Ultimate-House-Interior-Pack-2SXnFbwFzm) | CC0 [V-search] | 123 models |
| https://polyhaven.com/license | CC0 [V-search] | realistic, heavy |
| https://github.com/KhronosGroup/glTF-Sample-Assets | per model (CC0 or CC BY 4.0) | current props come from here |
| https://github.com/microsoft/fluentui-emoji | MIT | already used for art |
| https://phosphoricons.com | MIT | already used for glyphs |

UX references (all [V-search] unless marked):

| Link | Publisher | Used for |
|---|---|---|
| https://play.nintendo.com/news-tips/tips-tricks/animal-crossing-new-horizons-discover-tips/ | Nintendo | ACNH decorating guide buttons; shop rotation; Happy Home Academy |
| https://animalcrossing.nintendo.com/new-horizons/create/ | Nintendo | storage in your home |
| https://www.nintendo.com/jp/ichikara/acbaa/02_en.html | Nintendo | storage is not unlimited |
| https://www.nintendo.com/eu/media/downloads/games_8/emanuals/nintendo_3ds_2/animal_crossing__happy_home_designer/ElectronicManual_Nintendo3DS_AnimalCrossingHappyHomeDesigner_EN.pdf | Nintendo | Happy Home Designer touch controls |
| https://screenrant.com/animal-crossing-new-horizons-moving-rotating-furniture/, https://www.shacknews.com/article/117923/how-to-rearrange-wall-hangings-animal-crossing-new-horizons, https://www.gosunoob.com/animal-crossing-new-horizons/how-to-move-rotate-furniture/ | fan / press [secondary] | ACNH button mapping |
| https://help.ea.com/en/articles/the-sims/the-sims-4/how-to-rotate-sims-4/ | EA | Sims 4 rotation, free placement |
| https://answers.ea.com/t5/Game-Questions/How-do-I-turn-my-furniture-in-my-Sims-4-game/m-p/7106239 | EA community [secondary] | Backspace to inventory, Shift to repeat |
| https://support.supercell.com/hay-day/en/articles/edit-mode.html, https://support.supercell.com/hay-day/en/articles/the-shop.html | Supercell | Hay Day edit mode, storage in the shop |
| https://forum.supercell.com/showthread.php/1047437-Hay-Day-Sneak-Peek-Farm-and-Town-Edit-Mode! | Supercell forum (2015) [secondary] | tap & hold menu |
| https://playrix.helpshift.com/hc/en/3-township/faq/15052-removing-or-rearranging-buildings-in-my-town/, https://playrix.helpshift.com/hc/en/3-township/faq/15058-how-do-i-rearrange-the-buildings-in-my-town/ | Playrix | Township edit mode and storage |
| https://playrix.helpshift.com/hc/en/14-homescapes/faq/5810-can-i-redesign-my-mansion/ | Playrix | Homescapes restyle |
| https://support.planner5d.com/en/articles/15859960-how-to-rotate-items, https://support.planner5d.com/en/articles/16944106-how-to-edit-an-object, https://support.planner5d.com/en/articles/5903546-undo-the-latest-action, https://support.planner5d.com/en/articles/5876772-how-to-navigate-through-planner-5d | Planner 5D | select/drag, rotate handle, undo, wall snap |
| https://www.ikea.com/us/en/customer-service/knowledge/articles/9f463cf4-63d1-4cd9-a5e5-5aa759357c78.html, https://www.ikea.com/us/en/customer-service/knowledge/articles/g5dc7429-6f50-4e9c-9fd6-g0343d0c5gcc.html | IKEA | Kreativ place, move, rotate, action panel, erase |
| https://www.homestyler.com/forum/view/1479556403648950273/, https://www.homestyler.com/forum/view/1504036106145800193 | Homestyler forum | rotation snapping, exact angles |

---

## Appendix: decisions for the owner

1. **Undo refunds a purchase made in the same session** (recommended) — or purchases are final at once.
2. **No selling back** in v1 (recommended) — or sell at 50 % from storage.
3. **Unlock by lifetime coins earned** (recommended) — or by a cosy score / house level.
4. **Cosy score pays into the farm** (+1 % per star on buyers' offers, max +20 %) — or purely cosmetic.
5. **Fitted kitchen stays fixed** in v1 (counter, fridge, island) — or movable as a block later.
6. **Existing CC BY 4.0 props** (sofa, plant-living, accent-chair, pouf): keep with credit, or replace with CC0/own models to meet the
   licence rule stated for new bundled work.
7. **Style for new pieces**: our own boxes + sculpt kit (recommended, matches the house and farm), with Kenney's CC0 kit re-materialled
   to our surfaces for speed — or a pack's own look as-is (KayKit's flat gradients), which will not match the house.
8. **Storage limit** (an ACNH-style coin sink) — none in v1 (recommended).
9. **Entry point**: one context-aware ✥ / `B` with a *House · Farm* switch inside (recommended; `13-layout` then teleports outdoors
   first) — or a second button. And with the new top-of-screen modes hiding ✥, keep it visible in the *compass* mode or add
   *Decorate* to the settings drawer.
