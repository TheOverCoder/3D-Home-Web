# Mission 11: the buildings on the lane

**Goal:** the supermarket and the estate office grow, each with more to do inside. A car dealer joins them (the user
decides, since none exists today). A car park beside them grows as the farm gets busier.

**How a player will feel it:** across the lane the market is a real supermarket: aisles, two tills, and a café corner
where shoppers sit with a cup. Each step bought for the line or the shop shows on the lot as a new row of bays and more
cars in them. The estate office has the house as a model on a table and the farm's map on its wall. Next door, the
dealer paints your car, and you drive the new colour in the film.

## Measured today (`BUDGET_MEASURE=1` on `05`, the walk at three sizes; the sun's box by its own formula)

- **No room to grow.** The sun's shadow box (`SUN_SHADOW`, ±12 m, the same box on both maps) holds 65 m² of the lot
  south of the lane. The hall (26.3 m²), the manager's room (6.8 m²) and the office (4.3 m²) already touch its edges,
  and `buildings.test.ts` fails a floor outside it. Inside today's box the market can grow by a quarter at most, and the
  office and a dealer not at all.
- **The farm's sun pass is 233 draws and 126.8k triangles at every size** (limits 250 and 150k). Every mission shares
  those 17 draws. The camera pass has room: the market's shelves draw 35–56 draws and 49.8k–125.3k triangles (125.3k
  sideways, corn), the lane with its shoppers 45–46 and 62.6k–77.5k, the lane west to the parking lot 37–169 and
  22.2k–109.1k, the office 32–34 and 8.1k–8.3k.
- **The weights.** Corn, the heaviest good, is 7,240 triangles a unit, with 30 units on today's shelves. The car is
  3,976 triangles. The farm has 3 point lights (the walk-ins'), and every lit pixel of the farm pays for each one.
- **No car seller exists.** The only car is yours (`src/farm/car`). The lot sells through the manager, the shop's
  computer, the contractor's window and the estate agent.

## Principles applied

- `farm-games.md` P6: coins with a goal you can see. The house is a model in the office, the meadows hang on its map,
  and the dealer's paints are a sink past the house (01 found none past 4,000).
- `psychology.md` §1.11 and §1.1: visible progress and competence. The car park grows in the world from steps the
  player bought, never from a panel.
- `farm-games.md` P10: self-expression. Paints change looks only, as `skins.ts` does for the tools. P13: cosy
  abundance, through the café, a busy lot and nothing pressing.
- `ftue-ux.md` §1.5: nothing new on the HUD, and the car park grows without a card. §1.3: what can be bought shows in
  the world.
- `psychology.md` §2: no #4 (no paint for a limited time), no #8 (no pop-up when the car park grows), no #10 (wearing
  a paint gives nothing; buying one gives `build` XP, as a tool's skin does).

## Foundation first

**Exists:** the walk-in row and everything that follows from it (colliders, hiding pieces, camera limits, spaces,
walk-to, the woods' clearing, `16-view`'s poses), `marketFill`, `carParts(max)` (a crowd with a soft shadow under each
car), instance tints (the kit's `tint` mask), `skins.ts`, `inSunShadow`, and the sun-only meshes of `sun.ts`.

**Add:**
- **A. A sun box per map** (`src/data/sunBox.ts`: `SUN_BOXES: Record<Place, SunBox>` with left, right, bottom and top
  in the light's view, plus `inBox(x, y, z, box, margin)`; `inSunShadow` asks the map's box). The house keeps ±12. The
  farm's box reaches 16 m to the south-west and south-east (left and bottom) and stays at 12 m on the other sides, 28 m
  a side. Its map gets 7/6 the texels (2048 → 2400, 1024 → 1200), so a texel stays 11.7 mm and no shadow gets softer.
  The lot inside it grows from 65 m² to 267 m², and the garden inside from 86 % to 92 %. Uses: the three rooms below,
  the car park (wholly outside the box) and decoration's soft shadows.
- **B. The lot as named rows** (`src/data/lot.ts`): the lane strip, the forecourts, the car park's area and the
  contractor's corner. `reachRects`, `lotEdges`, `spaceAt` and the woods' clearing read them. Uses: the market, the car
  park and the dealer.
- **C. The lot's shells cast as one sun-only mesh** (`sun.ts`, as 08 merged the tools' shadows, 245 → 233). The
  market with its cabin, the office and the dealer cast with 1 draw, against 2 today. Uses: the three rows.
- **D. One `walkInPoses`**, moved from `16-view` to `tests/e2e/helpers.ts`, so 05's walk-in views come from the rows
  too. Uses: 05 and 16.
- **E. `src/farm/park.ts`** (pure): `PARK_STAGES`, `trafficSteps(farm)`, `parkStage(farm)`, `byCar(id)` and
  `MOST_CARS`. Uses: the car park's drawing and the people's scripts (shoppers and the line's buyers).
- **F. The box test checks each room's walls up to its own roof**, not a fixed 3 m, because the new hall rises to 4 m.

**The plan on the ground.** Each row below was checked against the farm's new box with the `buildings.test.ts` rule:
floor corners and the insides of the west and north walls at least 0.1 m in. The player's car, `ARRIVE`, the market's
`FRONT_DOOR` and `MARKET_PATH` and the office's door stay where they are.

| Row | x, z (m) | Floor | What fills it |
|---|---|---|---|
| Estate office | 0.2–5.75, 16.45–19.9 | 19.1 m², ×4.4 | the agent's desk, a bench, the house as a 1:25 model on a table (from the save's shell), the farm's map with the meadows for sale |
| Market hall | 6.05–16.45, 17.15–22.9 | 59.8 m², ×2.3 | 16 places on the south wall's run and two gondolas running north–south, each with an opaque middle panel (a hider); two checkouts by the door; a café corner in the north-east (a coffee counter, two tables, four seats) |
| Manager's room | 8.5–14.0, 23.05–25.6 | 14.0 m², ×2.1 | his desk and the computer, and stock shelving |
| Contractor's cabin | 16.75–17.85, 17.35–18.5 | as today | against the hall's new east wall, its window still facing east |
| Car dealer | 19.4–24.0, 16.45–20.5 | 18.6 m² | a desk, a wall of paints and a car on a turntable; two cars on its forecourt facing the lane |
| Car park | −26 to −7.2, 16.6–30.5 | 261 m² | 14 bays in two rows across an aisle, wholly outside the box: its cars keep their soft shadows and cast nothing |

There are 4 point lights (hall, manager's room, office, dealer), 1 more than today. The car park's lamps glow from the
evening (`setSculptGlow`) and add no light.

## Changes

| # | What the player sees | Files, functions | Rows / data | Tests | Size, risk |
|---|---|---|---|---|---|
| 1 | Shadows as today. Decoration that A's box now takes in casts a real shadow instead of a soft one | new `sunBox.ts`; `layout.ts` `inSunShadow`; `Lighting.tsx` (the box, and a size scaled by side ÷ 24, by map) | `SUN_BOXES` | `sunBox.test.ts`; `buildings.test.ts` on the farm's box; 05; `16-view`; `27`'s sun bounds | M. Risk: the farm's sun map takes +37 % memory (+1.6 MB at 1200²), and one tree crown and 0–2 hedge pieces come into the box |
| 2 | Nothing | B, C, D: `lot.ts`, `market.ts`, `estate.ts`, `farm/layout.ts`, `buildings.ts`, `landGeometry.ts`, `scene/WalkIn.tsx`, `models/market.ts`, `helpers.ts`, 05, 16 | the lot's rows | `layout.test.ts` (`lotEdges`), `landGeometry.test.ts`, `world.test.ts`; 16's sun texels | M, low. The sun pass draws 1 fewer |
| 3 | A bigger estate office with the house model and the farm's map | `estate.ts`, `models/estate.ts`, `Estate.tsx`, `script.ts` (the agent's way in), `gallery.ts`, `checks.ts` | the room, desk, sign, window and model | `buildings.test.ts`, `state.estate.test.ts`; e2e `30`; 16 from the row | M, low |
| 3b | The map's meadows carry price tags that open the edit mode's card (`buyLand`) | `Estate.tsx` (`tag()` per meadow) | `PARCELS` as they are | `25-button` presses them | S, low |
| 4 | A supermarket: aisles, two checkouts (the second open at `group` ≥ 2), the café corner and the cabin moved | `market.ts`, `models/market.ts`, `Market.tsx`, `marketGoods.ts`, `script.ts` (ways along the aisles, two pay lines), `state.ts` (`standShoppers`, `MOST_INSIDE` measured again) | 16 `BAYS` (today's 10 first, in their order), 8 `BROWSE_SPOTS`, `CHECKOUTS`, `CAFE_SEATS`, the gondolas | `state.market.test.ts` (hours of play: `MOST_INSIDE`; no way crosses a fitting's box); e2e `23`; 05's market views; 16's shelf and aisle poses from rows | L. Risk: the shelves' views, below |
| 5 | 16 places to stock | `data.ts` `LADDERS.places.levels` 7 → 13 (same price rule: 360–560 a step); `MAX_PLACES` follows | — | `market.test.ts`: a save with 10 shelves loads with 16, the six new ones empty; `pace.test.ts` and `npm run sim` | S. Risk: `PACE` in the late game (01 puts the market in `forSale()`) |
| 6 | One shopper in three who paid sits in the café a while | `script.ts` (`shopperSit`), `state.ts` (`moveShoppers`), `data.ts` (`SHOP.cafe` seconds) | `CAFE_SEATS` | `script.test.ts`; `state.market.test.ts` (a seat is never shared; the till's sum is the same with the café and without, away too) | S–M, low |
| 7 | The car park, growing in stages | `park.ts`; new `farm/Park.tsx` (asphalt, lines, kerbs, a P sign, lamps, planters); `models/park.ts`; the farm's map; the shop ladders' `say` names the bays a step brings | `PARK_STAGES` (below); the area is walkable from the start, grass where nothing is built yet | `park.test.ts`; 05 "the car park at its fullest"; 16 from the area's row | M, low |
| 8 | Cars come with people: one car per visit for half the visits, and one for every second buyer in the line | `park.ts`; `Park.tsx` (one crowd `carParts(MOST_CARS)` painted by instance tint, cast off; a fixed collider per bay in use); `state.ts` (a person's first and last steps start or end at their bay); `models/car.ts` (a tint mask on the paint) | `byCar` share; a car comes or goes only while its bay is out of the camera's view, and otherwise the person walks from the lane's end as today | `park.test.ts` (steady share; no bay twice; nothing comes in view); `state.market.test.ts` (`MOST_CARS` measured by playing for hours); `marketFill({ shoppers })` parks `MOST_CARS`; 05, 16, 27 | M. Risk: pop-in (the view rule) and the budget (12 cars ≈ 48k triangles whole) |
| 9 | The car dealer (if chosen) | row `DEALER_WALKIN`; `models/dealer.ts`; `farm/Dealer.tsx`; an `HOURS` row (9–17); the salesperson a `PEOPLE` row (03) | the forecourt's cars join the player's car crowd (`carParts(3)`: casting, inside the box, no new sun draw) | `buildings.test.ts`; 16 from the row; `25-button` (the salesperson offered as an action) | M, low |
| 10 | Paints for your car, on both maps and in the drive's film | new `carPaints.ts` (`CAR_PAINTS`, `sanitizeCar`); `state.ts` `buyPaint` and `wearPaint` (`build` XP, like `buySkin`); `farm.car` in the save; `unlocks.ts`; `DealerPanel.tsx` on `PanelSheet`; `Car.tsx`; `src/film` (the rolling car takes the tint) | red, free; five more at 300–1,200; `paint:<id>` unlocks at 16, 22, 28, 34 and 40 (01's cadence) | `carPaints.test.ts`; `save.test.ts` (a save without `car` loads red, owned and worn); `unlocks.test.ts`; e2e in `30` (buy, wear, drive) | M. Risk: the film's car rig |

**`PARK_STAGES`.** `trafficSteps` counts the steps bought on the line's `queue` (10) and `pace` (6) and the shop's
`places` (13), `group` (3) and `pace` (4); owning the shop counts 4. The most is 40.

| Stage | When | Adds |
|---|---|---|
| 0 | from the start | today's two bays by the gate (your car in the east one) |
| 1 | 6 steps | the first row of 7 bays along the lane: asphalt, kerbs, the P sign |
| 2 | the shop is yours | the second row of 7 across the aisle, two lamps |
| 3 | 24 steps | planters with small trees, a trolley shelter, a crossing to the market's door |

**The budget.** Every new view stays under the limits with no new debt.
- **The shelves.** The views from inside the door could reach 150k–200k with 48 corn (today 105k–125k). Three things
  keep them down: aisles that run away from the door, a gondola's opaque panel hiding every other aisle's faces, and
  the far copies. They are measured before the commit. A layout over 250k is changed, never listed as a debt.
- **The car park.** At its fullest, 12 cars add about 25k–48k triangles and 3–6 draws to the lane's views (today
  22k–109k).
- **The sun.** The pass ends at 233–235 draws (−1 from C, +1 crown, +0–2 hedge) and about 132k triangles. Nothing
  inside a building casts, and the car park lies outside the box.
- **Saves.** Positions on the lot are not saved: a load starts at the map's start or at `ARRIVE`. A save with 10
  shelves loads with 16, and the ladders clamp to their new tops. `farm.car` is the only new field, read in `load()`.
  The car park's stage is worked out from the save, so nothing about it is saved.

## Order of commits

1. Change 1, the farm's sun box. Players see nothing but decoration that now casts a real shadow.
2. Change 2 (B, C, D): invisible.
3. Change 3 (and 3b if chosen), the estate office.
4. Change 4, the market's room and fittings. Only 10 places open until step 5.
5. Change 5, 16 places, tuned with `npm run sim`. Then change 6, the café's life.
6. Change 7, the car park's stages, with no cars yet. Then change 8, the cars.
7. Changes 9 and 10, the dealer and then the paints, once chosen.

Every commit runs `npm run check`, 05's walk (`-g "the walk at"`), `16-view`'s walk-in and market groups, and `23` or
`30`.

## Overlaps

- **01:** `LADDERS.places` (this mission adds six steps, and 01 owns `PACE` and the market in `forSale()`); `UNLOCKS`
  (`paint:` rows fill 01's levels 16–40); and the farm's sun pass. 01's dairy, hive and kettle need draws from the same
  17. This mission takes none: C pays for the dealer's shell.
- **03:** `PEOPLE` (the dealer's salesperson, the manager, the agent). Neighbours can come by car through `byCar`.
- **04:** a new farm starts facing the beds with the market behind, so the bigger front is in 04's first screen.
- **06:** rows for a car door, an engine and cups. The new rooms are indoors for `SoundDirector` by their rows.
- **07:** `DealerPanel` is built on `PanelSheet`. `MarketPanel`'s 16-place grid at 390×844 is agreed with 07, which
  moves that panel.
- **08:** the `state.ts` split (this mission lands after phase 0, in `state/market.ts`), the shards of `16-view`
  (moving `walkInPoses` to `helpers.ts`, agreed with 08), and `sun.ts`.

## What is missing

**Decisions only the user can make** (my recommendation in bold):

1. **There is no car seller today.** Who did you mean? **A new car dealer east of the market that sells paints for
   your car, looks only (models later)**, or the contractor's cabin, the estate office, or the parking lot.
2. **Making room.** Grow the farm's sun box towards the lot **with shadows as sharp as today's (+37 % sun-map memory on
   the farm, about +1.6 MB on a phone)**, or grow it with today's texels (the farm's shadows 1/7 softer), or change no
   engine (the market a quarter bigger at most, the office and a dealer not at all).
3. **Sizes:** market ×2.2, office ×4.4, dealer about 4.6 × 4 m, car park 14 bays with at most 12 cars at once.
   **Accept**, or change.
4. **The market:** **16 places, two checkouts, and a café where shoppers sit** (life, no new rule)? A café that buys
   your cakes as a new channel: **not now**.
5. **What grows the car park:** **the steps bought on the line's and the shop's ladders**, a ladder of its own sold at
   the shop's computer, or the level.
6. **The cars:** **parked cars that come and go while you are not looking (S)**, or cars that drive in along the lane
   and stop for you (L, later).
7. **The estate office:** the house model **yes**; the meadows for sale on its wall map **yes**.
8. **Paints:** five at 300–1,200, unlocking at levels 16–40? **Yes.** Names: "Lane Motors" and the paints' names,
   **accept** or rename.

**Libraries:** none. three's `OrthographicCamera` takes asymmetric bounds, and the kit, the tints and `sun.ts` do the
rest.

**Skills, knowledge and docs:** CLAUDE.md's "Making models" and "What is drawn" sections; `src/models/market.ts`,
`estate.ts` and `car.ts` as examples; three's `DirectionalLightShadow` (Context7); `BUDGET_MEASURE=1`; the 3D designer
only if the user asks.

**Assets:** every model is built in code. Pictures from Fluent Emoji 3D (MIT), credited in `credits.ts`:
`artist-palette`, `hot-beverage`, `p-button`. Paint pictures are rendered from the car with
`scripts/render-item-art.mjs`. Sounds are synthesised (06's table).

**Access:** nothing was blocked. The budget was measured in this session.

## Done when

- **Unit tests:** every room of the three rows lies inside the farm's box, up to its roof, and the car park lies wholly
  outside it. The stages only add. A 10-shelf save loads with 16. `MOST_INSIDE` and `MOST_CARS` are measured by
  playing. No café seat is shared. A save without `car` loads red.
- **`npm run sim`, seeds 1–3:** `PACE` holds with 13 steps of `places`.
- **e2e:** in `05`, every view is under 250k triangles and 700 draws, and the farm's sun pass is under 150k and at most
  235 draws, with no new debt. The new views are the café, the car park at its fullest and the dealer from its row.
  `16-view` is equal in every walk-in pose, the car park pose and the café pose. `23`, `25-button`, `27` and `30` are
  green.
- **Screenshots at 390×844 and 844×390:** the lane with the three fronts and the car park at stage 3; the hall from its
  door; the dealer's panel; and the gate's shadows matching today's.

## Scaffold proposal (invisible and unwired; written once you approve)

- `src/data/sunBox.ts` (new): `SunBox`, `SUN_BOXES` (the house's ±12, and the farm's planned box as
  `FARM_SUN_BOX_PLANNED`), `inBox` and `texelsFor`. `Lighting.tsx` is not touched. `src/data/sunBox.test.ts`: with
  today's box, `inBox` equals `inSunShadow` at 400 points; the planned box holds all of today's; its side is 28 m and
  its texels ×7/6.
- `src/data/sunCheck.ts` (new): `roomMargins(room, roof, box)`, the rule `buildings.test.ts` applies today (floor
  corners, and the west and north walls up to the roof). `buildings.test.ts` is moved onto it with no change in
  outcome.
- `src/data/lotPlan.ts` (new, imported by no game file): the planned rows as `WalkIn` values (`ESTATE_PLANNED`,
  `MARKET_PLANNED`, `DEALER_PLANNED`), with `CABIN_PLANNED`, `PARK_AREA` and `LOT_PLANNED`.
  `src/data/lotPlan.test.ts`: every room inside the planned box (`roomMargins` ≥ 0.1); the cabin inside; the car park
  outside; no two buildings overlap, and none crosses the lane (z < 16.3); `FRONT_DOOR`, `MARKET_PATH`, the office's
  door, `CAR_SPOT.farm` and `ARRIVE.farm` unchanged; at most 4 point lights.
- `src/farm/park.ts` (new, pure, unwired): `PARK_STAGES`, `PARK_BAYS`, `trafficSteps`, `parkStage`, `byCar` and
  `MOST_CARS`. `src/farm/park.test.ts`: stages ascend and only add; stage 0 is `estate.ts`'s two `BAYS`, with the car in
  the east one; a new farm is at stage 0, a farm with the shop is at stage 2 or more, and every ladder at its top gives
  the last stage; `byCar` gives the same answer for an id every time and is near its share over 10,000 ids; bays do not
  overlap; each holds `CAR_SHAPE` with 0.3 m spare and lies outside the planned box and inside `PARK_AREA`.
- Not yet: `carPaints.ts` (it waits for decision 1) and the move of `walkInPoses` (commit 2: it changes 16).
