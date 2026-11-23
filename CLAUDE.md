# Working on 3D HOME

A walkable 3D house and farm in the browser (Vite, React 19, TypeScript, three.js, R3F, rapier). Phones first:
whatever is added must work with the touch controls and stay inside the per-device budget (`src/lib/profile.ts`).
The README has the overview; `tests/README.md` what each test guards.

## Before pushing

- `npm run check` (types — the specs' too —, oxlint, the Vitest unit tests, the format check: ~15 s) always. Then, locally, only the e2e
  spec of the area the change touches (`node scripts/affected-specs.mjs` names them from the change, by
  `tests/e2e/areas.json`; `--run` runs them), without the nightly tests:
  `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test --trace off --grep-invert @full <file>` (software
  WebGL, a few minutes a file; it builds and serves on :4185; `PW_GPU=1` on a computer with a graphics card draws on it
  instead, several times faster, and stops if it would draw in software — CI stays on software WebGL). `05` and `16` only when the change is to geometry,
  models, materials, lighting or `src/lib/visibility`, and only the group it touches (`-g`). A small request is one
  agent, no team. A rule or a save change gets a unit test beside its code (`src/**/*.test.ts`, `tests/README.md`).
- A new package goes on `src/deps.allowed.json` (held by `src/deps.test.ts`) only after the vetting in
  `update-v1/REUSE.md`, with its row there; `.npmrc` pins it exactly and runs none of its install scripts.
- A push runs the core suite on GitHub (`ci.yml`: everything but the `@full` tests, eight shards side by side,
  balanced by `scripts/ci-shards.mjs` from `tests/e2e/times.json`), and the site is published only from a commit it
  passed on (`deploy.yml` waits for CI): a red push never reaches players.
  The `@full` tests — stable ones that boot a page of their own, the budget walk at ten times the farm, the counting
  check (26), two of 16's groups — run every night and by hand (`full.yml`, Run workflow). A red CI, or a red night,
  is the next thing to fix.
- Code style: Prettier (`.prettierrc.json`: width 200, no semicolons, single quotes; `npm run format`; the CSS keeps
  its compact one-line rules by hand). Comments say
  what and why, in plain words.
- Budget (`05-budget`): measured over a walk (the rooms, each doorway with the door shut and open, the garden door, the
  gate, the yard, third person, decorating) with the farm at its fullest, at 640×360 and at a phone's drawing buffers
  (487×1055 upright, 1055×487 sideways), on the drawing-free WebGL context (`tests/e2e/nullgl.js`: three.js counts on
  the CPU, the same as on a real one — `26-counting` holds them side by side — at full speed: the whole walk in about a
  minute, so locally after any drawing change too). The camera pass stays under 250,000
  triangles and 700 draws, and the sun's shadow pass, counted on its own, under 150,000 and 250. A view over it is a
  debt listed in 05 (and `tests/README.md`) with its reason and what it measured as its ceiling: a ceiling is never
  raised silently, a new feature may add a debt when paying it now would cost more than it is worth, and a paid one
  leaves the list. `BUDGET_MEASURE=1` prints the table without the checks; `?debug&stress=10` is ten times the farm,
  reported there. The market is measured at its fullest that play can reach in its own views (`marketFill`: shelves
  full of the heaviest good, its most shoppers inside); elsewhere it stands quiet, so no view depends on when a
  shopper walks through its door.
- Quality first. A fix for speed or the budget may not make the game hold less (fewer buyers, animals or pieces,
  smaller rooms, lower caps) or change anything a player notices in play. The way to it is how things are drawn: what
  cannot be seen is not drawn, and detail the screen cannot show is not drawn (a simpler model where its difference is
  under half a pixel at phone size). Judge "not noticed" by a screenshot at phone size, not by pixel equality. A limit
  that exists only for speed is a debt to remove, not a rule to keep.
- Tests must not read a value that runs on in real time across separate `page.evaluate` calls (the farm ticks
  every frame): advance and read in the same call. Nor may one pass on a single random draw: it sets the farm's dice
  (`setRandom`), fixed seeds (the phone mix's `DRAWS`), or makes what it needs (17's second order wants two).

## Two maps (src/scene/Maps.tsx, maps.ts, travel.ts, src/lib/world.ts, src/data/maps.ts)

- The farm and the house are two maps, each a world of its own round the origin; only the one you are on is in the
  scene (`useHome.map`, following `farm.place` in the save). The farm runs on while you are in the house (`FarmClock`
  is mounted on both). A new farm starts on the farm at `FARM_START`; the house is bought from the estate agent by the
  market (`buyApartment`, 4000 coins) and a farm from before the two maps owns it and starts in it.
- The car drives between them: `travel(to)` drops a curtain, plays the drive's film (`src/film`: a few seconds in the
  game's own canvas, its light and the dashboard's clock from the farm's hour, a tap skips it; `setDriveFilm`),
  moves the save, mounts the other map, compiles it, and puts you out at `ARRIVE`. A loaded or switched slot follows
  its own place.
- Every rule that differs by map asks `src/lib/world.ts` (rooms and outdoors, the action button's spaces, what is
  underfoot, the camera's limits, the route's area, the drawing pass's sources, the edit and decorate modes). Something
  new on one map is mounted in that map only; its interactables are then offered only there. Tests choose their map:
  `game.ready('farm' | 'home')` (`tests/e2e/helpers.ts`, `onMap`).

## What is drawn (src/lib/visibility)

- A drawing pass leaves out of each frame what cannot be seen, and never changes the picture. First person: the four
  rooms and the outside are cells seen only through the doorways, windows and garden door where the house's shell has
  them (`src/home/shell.ts`, the save's; as built: `src/data/layout.ts`)
  (the kitchen's door shut closes its doorway); every `Parts` crowd draws only its models in view; the sun's shadow
  map leaves out the casters under the ceilings that no window lets sunlight reach, and is kept between frames while
  everything that moved is out of it (`src/scene/Lighting.tsx`). Third person, decorating, the edit mode and first
  person outdoors: the crowds' view test, and the house's walls hide what lies wholly behind one opaque piece of them
  (`walls.ts`; a wall fading hides nothing). A thing drawn without the depth test (the aim marker) shows through
  walls, so neither the walls nor the rooms' portals ever hide it: only the camera's own view test. In first person in
  the house the walls still judge what is outdoors (what the portals let in through a window). The rooms, portals and
  the sun's culling are the house's map's; on the farm only the walk-ins' walls hide things. A walk-in building adds
  its walls as another source, and while its doors are shut it hides everything wholly inside its rooms from an eye
  outside (its `enclosure`). The walk-ins' shells cast into the sun's map through one mesh (`castAsOne`, `LotShells` in
  `src/scene/WalkIn.tsx`): a new walk-in joins it by being a row.
- The frames a second are the player's (Settings → Picture → Frame rate: 60 by default, or a steady 30 that saves the
  battery: `src/scene/frameRate.tsx`, the loop on demand and a pacer). Whatever holds the frames still (a change of map,
  the warm-up, a film) lets them go with `runFrames`, never `setFrameloop('always')`. `?fps` (any page) shows the
  frames drawn.
- The house's shell (walls, floors, ceilings, doors) is drawn always: it is under `userData.cell = 'always'`
  (`House.tsx`), as is your own body for the camera (the sun judges it like anything in a room: `userData.sun =
  'room'`). What is outdoors is under `cell: 'outside'` (the farm on its map; the house's own garden and
  countryside on the house's). Anything else stands in a room and is judged each frame by where it is now: a new thing in the house needs
  nothing. A new opening is a row in `layout.ts` (where it is built; where it is now is the save's, `shell.ts`); a new
  door that shuts must close its portal.
- A crowd's model is everything put after one `at`: each animal, person or plant gets its own. A part that casts is
  left out like the rest: its shadow is drawn by meshes of its own (below), every model put.
- Far parts of a crowd are drawn as lighter copies (`src/lib/sculpt/lod.ts`, meshoptimizer's simplifier): every part
  gets copies from nearly whole to a few triangles (steps a share of its own size), each moving its surfaces at most a
  known error in which light and colour weigh (every attribute but the position: where a copy is drawn, a change Δ
  across n pixels only where Δ·n < ½). A copy is drawn only where its error is under half a pixel for the game's camera
  (`farEnough`), and only where it saves a draw's worth (`A_DRAW`) across the crowd's instances in view
  (`worthDrawing`). Each copy is measured against the whole part (the simplifier's estimate can run short), and they
  are made a step at a time in idle time once a map has loaded (until then a part is drawn whole), once per model:
  what was found is kept by the content it was made from, so a crowd built again (a map gone to again, the market's
  goods) has the same copies at once. Tests make what is pending now (`copiesMade`: a page drawn in software has
  little idle time). Not the pass's: the
  same with it on or off, so `16-view` still compares equal; `27-far-copies` bounds what they change on screen
  (`__home.view.lod` switches them). A new crowd part needs nothing.
- Shadow copies: what casts is drawn into the sun's map by a mesh no camera draws (`src/lib/sculpt/sun.ts`), from a
  copy of its shape measured within half a texel of the sun's sharpest map (`sunLodsOf`, `sunEnough`: well inside the
  shadow's bias), chosen by the sun alone, so the map kept between frames holds. A crowd part that casts needs nothing;
  a model loaded from a file (the furniture, `GlbProp`) casts as one mesh a piece (`castAsOne`), and is drawn by the
  game's camera from its far copies by the crowds' rule (`farFromCopies`, the crowds' eye `farEye`, switched with
  `__home.view.lod`). `27` bounds what they change (`__home.view.sunLod`). Something new that stands still casts through one such mesh for all its parts and looks
  (`castAsOne`: the same triangles from the same sides, one draw), as the farm's merged static meshes do (`batchStatic`'s
  `sunAsOne`: one a quarter and side; the house keeps its looks apart, as its sun leaves them out room by room).
- The sun's shadow box is the map's (`src/data/sunBox.ts`): the house's ±12 m, the farm's 16⅛ m to the south-west and
  south-east over the lot, its map's texels as many more (`texelsFor`), so a texel is the same size on both. Outside it
  nothing casts there (`inSunShadow`: a soft shadow instead).
- Each good's model has a weight, the triangles it may draw (`src/models/weights.test.ts`): one grown past it fails in
  the unit tests, in seconds; the heaviest good is the one the budget fills the market's shelves with.
- A big thing is built from pieces a few metres across, never one mesh round the farm: one mesh is always partly in
  view, so it is always drawn whole (the hedge and the woods' crowns, `src/farm/Land.tsx`). Each piece is made from
  the same data the one mesh had, with a material of its own made in the one mesh's drawing order (three draws a
  material's meshes nearest first, materials in the order they were made), so not a pixel changes: `16-view`
  compares them (`window.__home.land.whole`). A light thing (the fence, the trunks: a few hundred triangles) stays
  one mesh, a draw costs more than it saves (the trunks one per bark: the birches' is white).
- `16-view` draws the same frames with the pass on and off and requires every pixel, depth and shadow-map texel to
  match (a difference there is a culling bug): a new room or kind of view gets a pose there; the house's doorways,
  windows and garden door are posed from its openings as the save has them (`openingViews`), a changed house too
  (`changeHouse`, also measured in `05`); a walk-in gets
  its poses from its row. `window.__home.view` (?debug) turns the
  pass and its parts off and counts what it left out.

## Farm actions (src/lib/interaction.ts)

- One context button (E / the round touch button) offers only what one press does here: what only tells you how
  long, or what is missing, is a status (`verb: 'wait'`, `needs` for pictures); nothing far away (what is ready
  to take out of reach goes on the compass at the top: give its interactable a `ready()`, null until full). It
  never spends coins (building and buying are a price tag, below); at a machine it collects what is done, else opens
  the machine's panel, where jobs are queued (their ingredients go in then). One press does every like thing in reach
  (things whose press does the same share a `same()` key, and only one of them is offered).
- Reach is measured on the ground, from the edge of a thing's footprint (`box`, half its size each way) or from its
  `position`, within its `radius` (`groundDistance`): a bed is in reach 1.5 m from its frame (`BED_REACH`), and the
  "every like bed" batch uses the same measure. Offered, a thing you look at wins over one only within reach.
- A compass mark tapped walks you there (`src/lib/route`): the stick pushed along a way found on cells asked of the
  physics world (the player's capsule against fixed colliders), until the thing is within reach by that same measure.
  Something new with a fixed collider needs nothing (any change to one makes the cells again); something that blocks
  the way but moves only when you work it (a door that shuts, like the kitchen's) is put into the cells as it stands
  (`physics.ts`).
- The prompt over the button is pictures, not a sentence (`src/ui/Hud.tsx`): an action about a good gives its icon
  `count` (how many one press takes, makes or sells), `coins` where coins change hands, a status `seconds`; one about
  no good its `art` (the gate: the line's picture, `count` of `of` — the 4 of 7 waiting you can serve). The `label`
  stays the words: tests and screen readers read it.
- What can be set about a thing (what a bed always grows) is a gear on the thing you look at, and what it costs to
  build or buy (a staked-out bed, a field) a price tag on it — a coin and the price (`tag()` on its interactable,
  kind `gear` or `price`; `src/ui/ThingTag.tsx`, `G`) — never the button. A price tag opens a confirmation card
  (picture, price, an armed *Build*); a thing for sale offers nothing else (`enabled` false; its tag still shows).
  A bed set to one crop is the one place the button buys without a card: its seeds, with the price on the prompt.
  Nothing plants or spends by itself.
- `tests/e2e/25-button` holds every interactable to this on farms of every kind (today's, plenty, nothing, at
  random): offered as an action, a press changes something, spends no coin without its price on the prompt, and what
  it opens has a button to press (a sale's panel a Sell; a panel that only shows what is inside is listed there). A
  new interactable needs nothing: it is pressed there by being registered.

## Animals and machines (src/farm/data.ts)

- What fills up and is collected (the lemon tree, the nest, the cows, the sheep, the beehives) is a row in `PRODUCERS`, a
  machine (the mill, the loom, the oven, the dairy, the jam kettle) a row in `MACHINES`: its numbers, goods, words, sounds
  (`load`, `done`, `collect`: a row and a synth in `src/audio` each) and place (`PLACES`). `state.ts` runs every row
  the same way and keeps it in the save (`producers`, `machines`; `load()` converts older saves): no new state.
- A new animal: its row (and an `UPGRADES` row with `herd` to buy more), its model, and a thin `<Herd>` (`Herd.tsx`) with
  its wander numbers (`wander.ts`), body and pose. A herd's `full` is what its tool waits for; each animal past it opens
  with a level (`herd:cows:4` in `UNLOCKS`). A new machine: its row, its model (`src/models/buildings.ts`, cast into the
  sun's map as one mesh, `castAsOne`; what moves drawn on its own, casting nothing), and its moving parts driven by the
  work level `useMachine(id)` gives back. A field of beds is a row of `EXPANSIONS` (its `land`: the meadow bought
  first) and its `BEDS` rows.
- A machine works a queue of jobs, one good each, of any of its recipes (`src/farm/machines.ts`; `farm.machines[id]`:
  the jobs, how many are done, the working one's progress, its places, the seconds it has worked): 3 places, bought up
  to 12 (`QUEUE_PRICES`); done jobs keep their place until collected. Its level comes from the time it has worked
  (`MACHINE_LEVELS`, `src/farm/machineView.ts`): more XP for each job collected, its goods dearer wherever they are
  sold (`priceOf` in `src/farm/prices.ts`: every sale prices a good through it), faster jobs. Its panel
  (`src/farm/machine/`) only draws `machineView(id)` and calls `machineActions(id)`.

## Levels, the market, the contractor, the day (src/farm/xp.ts, market.ts, contractor.ts, day.ts, src/data/buildings.ts)

- A thing the player does gives XP: `gainXp(action, n, at)` once, in the lowest function every way to it goes through
  (`XP_FOR` in `data.ts`; a sale is worth its coins); never in `tick`, `goOn` or `cameBack`, and nothing that can be
  undone for free gives any. The crystals fly up from `at` (a panel's sale: from low in the middle).
- The pace is guarded: `src/sim` plays a new farm with no screen (a good player's list of priorities, the game's own
  functions) and `PACE` (`src/sim/targets.ts`, held by `pace.test.ts`) bounds the minutes to each level and the waits
  of the first hour; a new feature's numbers (prices, times, XP) are tuned against `npm run sim`.
- What each level opens is `UNLOCKS` (`src/farm/unlocks.ts`): a crop, an upgrade, a recipe, a kind of decoration, a
  field, building a bed — a new buyable is a row there (its test fails until it has one). Every buy, planting and job
  asks `isUnlocked` in `state.ts` (only buying is locked: what the farm has stays and works); the interface draws the
  same answer: a locked thing faded with the level it opens at on the berry ribbon where its price was (`LockTag`,
  `src/ui/LockTag.tsx`), and a level reached deals its "Unlocked!" cards (`src/farm/Unlocked.tsx`). A ?debug page has
  everything open (`&unlocks=on`, or `__home.farm.unlocks.all(false)`, locks it; `ready()` opens it again); `36-unlocks`
  tests it, and `25-button` presses a locked farm.
- An upgrade bought a step at a time is a row in `LADDERS` (one buy, `buyLadder`; one card, `LadderCard`; its level in
  `farm.ladders`), with `say(k)` for what step k gives.
- The daily gift (`src/farm/daily.ts`, `farm.daily`; its card `DailyCard.tsx`, its watcher `DailyPanel.tsx`): once a
  day played, the season's week of seven gifts that grow (`dailyDay`: day N is the season's day N in days played, so it
  waits through any absence; the seventh the big one), rolled on the farm's dice as it is claimed, goods past full, no
  XP. A day played whose gift was not claimed joins the next claim (`OWED_MOST`), a return after two whole days away
  brings a fixed welcome-back gift with it (`BACK_GIFT`), its "?" shows the odds, its words never say lost or missed,
  and the clock moved back gives nothing twice. It opens by itself once a day on a farm that has begun, after whatever is over the game (the
  intro, a film, the drive, the welcome-back card, a panel), and waits in the corner menu until claimed. Specs not about
  it put it out of the way (`quietDaily`: `ready()` and `bootApp` in `helpers.ts`); `35-daily` tests it.
- The farm album (`src/farm/album.ts`, `farm.album`; `AlbumCard.tsx`, `AlbumPanel.tsx`; the corner menu's *Album*):
  pages of tiles, each earned by a deed and nothing else (`ALBUM` rows counting what `measure.ts` counts, or the seasons
  lived: never random, never by the calendar); one not earned is a silhouette that says how. A page done gives its own
  garment by itself, once, a frame later (`albumOn`, `outfit.owned`), with a toast: no badge, no claim, no coins, no
  XP. A new good, kind or animal is a row; `43-album` tests it.
- The season road (`src/farm/seasonRoad.ts`, `farm.seasonRoad`; the farm news's *This season* tab): `SEASON_ROAD`'s
  ten stops a season, fed by the XP gained (`feedRoad`, one line in `gainXp`) once the farm's year has begun, each
  coming in by itself through `give` with a toast, the last the season's garment. It runs on days played and is never
  reset by the calendar: a road not finished carries on into the next season. `ROAD_XP` is held by `PACE.road` (the
  ten-minute player done by the season's day 6). Quiet where the game is tested (`&road=on`; `__home.road.quiet`,
  turned off in `ready()` and `bootApp`); `44-season-road` tests it.
- Days played (`farm.played`, `src/farm/calendar.ts`): the days the farm has been opened, each counted once, the first
  frame it runs on a calendar day (`markPlayed`, asked from `tick`). They never fall, and they are the long game's clock
  (`longDay`). A claim's or a gift's prizes (`src/farm/prize.ts`: coins, goods, a piece of decoration, a garment) go in
  through one door, `give(prizes, kind, at)` (`src/farm/state/rewards.ts`), which counts the reward once (`rewarded`)
  and returns its tier; their coins are `sized` from the next level's. A road of stops (`src/farm/road.ts`: the daily week, a goal's counts) is drawn by
  `src/ui/Road.tsx`.
- A new farm's first steps are rows of `FIRST_STEPS` (`src/farm/firstSteps.ts`: the words, the farmer's mood (his face
  and move, `FarmerFace.tsx`), the picture, when it is
  done by the farm's own numbers, where a tap walks you (a `Target`, `walkTargets.ts`), the reward, and its turns: what
  he says instead while the farm is elsewhere, so no step is a dead end on any day (`lineFor`; `steps.walk.test.ts`
  follows only the hint on every weekday's events); `state.ts` passes and pays them a frame after the
  farm does them, and the farmer's hint under the compass says them (`src/farm/FirstSteps.tsx`, its own top slot,
  `steps`). The last sows the longest crop open, so the first sitting ends with something on its way. They end after
  the last, skipped, or at level 5, and the daily gift waits for them. While they run, the top holds back what does not
  matter yet (`REVEAL`, `src/farm/reveal.ts`: the tanks till their first good, the line till the first planting, the
  rest till their end): something new up there that should wait is a row, asked through `shows(part)`. A ?debug page
  keeps them quiet (`&steps=on`, or `__home.farm.steps.quiet(false)`, runs them), and with them everything shows;
  specs not about them keep them quiet (`ready()`); `37-first-steps` tests them. What is next for a farm (the welcome
  back's *Next*) is `nextUp` (`src/farm/nextUp.ts`): a new kind of next thing is a row of `NEXT_SOURCES`.
- A building you walk into is a row in `WALK_INS`: its walls, rooms, doors (an `autoDoor` slides open as anyone comes
  near) and lights. The model, the colliders, the hiding pieces, the camera's limits, the action button's spaces
  (`spaceAt`), the walk-to, the footsteps and the woods' clearing all follow from the row; every floor and every inner
  face that looks at the sun must be inside the sun's shadow box (`buildings.test.ts` fails otherwise), and `16-view`
  makes its poses from the row (05's walk too). The ground outside the garden you can walk on is the lot's rows
  (`src/data/lot.ts`: the lane, the market's forecourt, the contractor's corner): the action button's lane, the reach,
  the invisible walls round it and the woods' clearing read them; new ground there is a row. The estate office shows the
  house as a model on a table (1:25, from the save's shell) and the farm's map, each meadow for sale on it a price tag
  that opens the edit mode's card for it.
- Past the lane (`src/data/lot.ts`'s rows): the car park grows in stages with the farm's traffic (`src/farm/park.ts`,
  `PARK_STAGES`; `Park.tsx`), and the cars of people about who came by car stand in its bays (`parkCars`: one crowd,
  coming and going only while their bay is out of view; `marketFill` with shoppers parks the most). The car dealer is
  a walk-in row (`src/data/dealer.ts`, HOURS.dealer) whose seller sells your car's paints (`carPaints.ts`,
  `farm.car`; `paint:` unlocks), worn on both maps and in the drive's film (an instance colour over the car's red,
  `paintTint`; the car's material tints only its base: `tintBase`).
- A new character is a row of `PEOPLE` (`src/data/people.ts`: a name, a look — a roll of the people engine,
  `rollLook` in `src/models/look.ts`, over overrides on dice of their own —, a voice, a portrait drawn from their own
  model by `node scripts/render-item-art.mjs --people`) and a movement script (`src/farm/script.ts`); whatever draws
  or voices them reads the row. A look is saved as its traits, never as the roll. Anyone's face in the interface is a
  `Portrait` (`src/ui/Portrait.tsx`; the farmer's are his moods' faces). Characters speak with the device's own
  voices (`src/talk`: their lines as data, each a `Line` — who, the words, the face, the hearts it opens at —,
  `rules.ts` for when — never muted, near, rare, never over a film or the drive — and never a word of guilt or hurry,
  `kind.ts`). A neighbour's friendship only grows (`src/farm/people/friends.ts`, `farm.friends`): `befriend` is one
  line in each sale and send path, and gives no XP. A big moment may open a film (`src/film/films.ts`: the shop's
  purchase plays its film once, a tap skips it to its end card; the lab's film boards play the same code).
- The neighbours (`src/farm/people`, the farm's side `src/farm/state/neighbours.ts`): a chapter is a row of `CHAPTERS`
  (`chapters.ts`: its writer, level, letter, what it asks, thanks and gift), begun a frame after its level, one a visit,
  never while the first steps run (`story.ts`, `farm.story`); its letter waits in the mailbox by the gate
  (`src/farm/Mailbox.tsx`, its flag up; `mail.ts`, `farm.mail`: a letter is its id, its words the rows) and its request
  is pinned above the order board (`farm.requests`), paid as an order; sent, a thank-you letter brings its gift through
  `give`. A heart reached and a birthday (a week to come) bring a letter too. Who is met is the story's: only they come
  to the gate (`visits.ts`, in their `HOURS` row, now and then: `PEOPLE_ODDS`) and send an order. Only the very first
  letter opens by itself (the card queue's `letter`). Quiet under Vitest and on a ?debug page unless `&neighbours=on`
  (`quietNeighbours`, `__home.neighbours.quiet`); specs keep them quiet (`ready()`, `bootApp`); `45-neighbours` tests
  them.
- What keeps hours is a row in `HOURS` (day phases, or hours from and to: the estate office's 8–16); the day's phases and their light are `DAY`. The light changes only the colour
  and strength of the lights there are. Tests stand at noon with the clock stopped (`helpers.ts`, `ready()`).

## The wardrobe and the levels' rewards (src/farm/outfit.ts, src/home/Wardrobe.tsx, src/farm/LevelPanel.tsx)

- 500 levels (`LEVELS.max`), each taking longer than the one before. Each brings coins and a small gift (a building
  material), both coming in by themselves as it is reached (`arrive()`, paid exactly once: `xp.paid`); every fifth
  one a garment. Each level from `BOXES_FROM` (5) has four gift boxes, one at every 25% of its bar, and each before it
  one, on its full bar (`src/farm/gifts.ts`, `farm.gifts`; JOURNEY.md fix 10): opened with a tap in the level's card (the level chip opens it), rolled on the farm's dice, never
  given twice, never XP; one not opened waits (the chip glows with how many), and "Open N gifts" opens them all.
- The player's clothes are the people engine's (its shirt, trousers, straw hat, cap, beanie) in a table of garments,
  each with the level it comes with (`GARMENTS`: two of each at level 1, then one every `GARMENT_EVERY` levels); what
  is worn is `farm.outfit` in the save. Garments not of a level (`from`: an album page, a season road) are owned once
  given (`outfit.owned`, through `give`), with a toast, never the level's show. A new garment is a row there, and its picture is drawn from its model by
  `node scripts/render-item-art.mjs` (`src/assets/garments`). A level reached by play shows its garment after the
  level's show, and the wardrobe marks it new until it has been open.
- Every wardrobe in the house opens with the action button: you turn round and the camera films you from in front,
  framed in the part of the screen its sheet leaves free (`dressView`). It is a first-person view (opened from third
  person, third again as it closes), in `05`'s walk and `16`'s poses.

## The silo and the barn (src/farm/storage.ts, STORES in src/farm/data.ts)

- `farm.inv` is the one record of goods; each good is kept in the silo (what grows: every crop, the lemons) or the barn
  (what the animals and the machines give, and the building materials) by `storeOf`. A new good gets its building
  there; a building material is a `PRODUCE` row with `material: true` (buyers and orders never ask for it; only the
  contractor buys it).
- What is collected goes in only while there is room (`store` in `state.ts`), and nothing is lost: what does not fit
  stays where it was (on the animal, in the bed, in the machine) and its offer turns into a status (`full` on the icon);
  goods coming back from an order and surprises always go in, past full. A new source of goods follows the same rule.
  A full building never stands in the way: *Make room* (`makeRoom`, `src/farm/state/stores.ts`; on the welcome back's
  full row) sells at fair price, in one press, the surplus no buyer or order wants, just enough for what waits.
- Time away (the page closed or hidden: `cameBack` in `state.ts`) runs the farm on in steps for up to a day (`AWAY_MOST`) and
  tells what happened (`AwayPanel.tsx`, from what was ready before and after): a new producer or machine is in it by
  being a row. A goal is a row in `GOALS` (`src/farm/goals.ts`) whose `count` says what it counts as data
  (`src/farm/measure.ts`: goods got, a stat, what a machine made…); a new good the farm makes is counted in `got` where
  it comes in, as the others are.
- Surprises (a building material) have their odds in `ITEM_ODDS` and roll on the farm's own dice (`setRandom` in
  tests); orders are rows of the board (`farm.orders`), the tractor's trip a timeline (`tractorRoute.ts`), both in the
  save like the line at the gate.

## The week's events and the farm news (src/farm/events.ts, src/farm/news)

- An event is a row of `EVENTS` (like `HOURS`): its weekdays and whole hours by the device's own date and clock (local
  time), what it changes (`boost`) and by how much: Monday's and Sunday's market (buyers at the gate twice as often),
  Wednesday's harvest festival (crops grow twice as fast), Thursday's gift day (a buyer's or an order's gift comes
  twice), Friday evening's machine rush (jobs twice as fast), Saturday's lucky draw. The farm judges them at
  `eventTime()` (`src/farm/state.ts`) and each rule asks `eventSpeed(boost)` where it already runs: no new state but the
  record. A time away (`goOn`) judges each 5 s step at its own time: an event counts only for the part it was on.
  Times shown (a bed's, a machine's) are real seconds: divided by the speed.
- The lucky draw: once on its day (`drawLucky`, on the farm's dice), two goods a buyer could ask for; they sell for
  double that day wherever they are sold (`priceEvents` in `src/farm/prices.ts`: every sale prices through `priceOf`),
  and what already waited for them is raised at once (a buyer's offer, an order's pay by their share; kept after the
  day: a deal made is kept). Events give no XP of their own (a sale is still worth its coins).
- The save keeps `farm.events` (`sanitizeEvents`): the draw (its date and goods) and the events the news has shown (its
  badge on the corner menu: an event on and not shown, or the draw not made). A new kind is a row; its effect a
  `boost` asked where the rule runs.
- The news is the corner menu's "Farm news" (`src/ui/HudMode.tsx`): `NewsCard` draws `newsView` (now, coming soon, the
  draw's reels), `NewsPanel` reads the farm. Events are off under Vitest and on a `?debug` page (unless `&events=on`)
  until a test sets a clock (`setEventClock`, `__home.events.set`); `ready()` and `bootApp` in `tests/e2e/helpers.ts`
  turn them off again, so no spec's prices, gifts or speeds depend on the day it runs.
- The corner menu reads, top to bottom: the daily gift (while it waits), the farm news, edit, the top's view,
  settings. Its button shows both on its right-hand corners in that order: the waiting gift on the top one, the news's
  sun badge on the top one alone and on the bottom one beside the gift (the left side is the dashboard's).

## Seasons and weather (src/farm/season.ts, weather.ts, src/farm/state/season.ts)

- The farm's year is four seasons of `SEASON_DAYS` (7) days played each (`farm.played`: it waits through any absence),
  counted from the day played its first spring began (`farm.season`); every farm starts in spring, the farm as it
  always looked. They start once the first steps end (`SEASONS_AFTER_STEPS`): while the steps run the first spring
  waits. The season moves only on a new day played, so a time away runs in the season it was left in. The weather is
  a function of the farm's clock (`weatherAt`), never saved.
- What a season or the weather changes in play asks `seasonPlaying()` (null while quiet or while the first steps run)
  and only ever helps: rain waters the beds still growing (`wets`, in play and away; the welcome back says it rained),
  a crop sown in its season gives more (`bedYield`, its bed keeps `inSeason` when the season turns), and a season's
  piece of decoration (`season` on its `DECOR` row) is sold only in its season and stands all year (the album's
  *The year*). The sounds follow the sky (`hearSky`: rain, softer under a roof; wind; fewer birds in winter and rain),
  and a buyer's greeting is now and then about it.
- Whatever a season or the weather changes asks `seasonNow()` and `weatherNow()`: spring and clear while the steps run,
  and where the game is tested (under Vitest; on a ?debug page unless `&season=on` or a season's name, `&weather=on`
  or a weather's name). The clock itself, `seasonDay()`, is never quiet: the daily week counts on it. Specs stand in
  spring and clear (`ready()`, `bootApp`); one turns them on or sets its own with `__home.season` (`set`,
  `weather.set`, `quiet(false)`), a unit test with `setSeason`, `setWeather`, `quietSeasons`.
- What they look like is numbers (`lookOf`, `src/scene/weatherLook.ts`; spring and clear is `IDENTITY`), read each
  frame by `DayLight` (`src/scene/Lighting.tsx`: the lights' colour and strength, the sky's haze, the fog — no light
  added) and by the materials' season chunk (`setSculptSeason`, `src/lib/sculpt/material.ts`: uniforms only, no draw or
  compile). Snow lies on what faces the sky in a kit material with a `surface` (what is built) or `foliage` (leaves:
  `CROWN_MATERIAL`, turned tree by tree by its place; crowns made where they stand carry it in `leafAt`), and on a plain
  material given `seasonal()` (the lawns, the hedge, the bushes, the fences, the fields; its copies keep it, so a static
  batch keeps it too) — never under a roof (`shelters()` in `src/lib/world.ts`: the house, the walk-ins' rooms). What
  lives and moves and what is swept (beds' soil, paths, lanes) has none. Rain, snow and the rainbow are `weatherFx`
  (`src/fx/quarks.ts`, fed by `FarmFx.tsx` on both maps; with less motion none): the mission's fallback, since quarks'
  script cost a phone too much — fixed seeds moved by their own shader from the weather's clock (rain as streaks, snow
  as points, as many as `profile.weather` gives the tier), a frame's script a few uniforms; the outside for the drawing
  pass, ending at every roof (the materials' `shelterUniforms`). `__home.weatherFx` runs its clock on by hand (`settle`)
  and sets the drops (`most`); `__home.fx.time` stops it.
  `05` walks in winter's rain at a phone's most and times its script at a 4× CPU throttle; `16` and `26` stand in it.

## The farm's decoration (src/farm/decor.ts, layout.ts, decorScene.tsx, DecorShop.tsx)

- The edit mode's shop (the bag on its card) sells decoration and, on a tab of its own, fruit trees and bushes: a row
  each in `decor.ts` (name, first price; `nextPrice`: each one dearer than the last, counted from what the farm owns,
  standing and in its store). Its card asks before anything is spent; bought, it stands at the nearest free spot in
  view, picked, to be dragged, turned or put away into the farm's store (`layout.stored`, put down again for nothing).
- What stands is `layout.decor` (kind, middle, quarter turn, id); each kind's ground is `DECOR_FEET` (fence and hedge
  sections whose ends meet, path tiles that join edge to edge). Places, beds and pieces share one set of rules
  (`canPlaceThing`). A new kind: its row, its model (`src/models/decor.ts`, taken through `src/farm/decorModels.ts`),
  its ground, its body (`SOLID` in `decorScene.tsx`) and its picture (`node scripts/render-item-art.mjs`).
- Each kind is one crowd and casts into the sun's map (all but the flat ones), from its copies for the sun; a piece
  the sun's map does not reach (`inSunShadow`) has a soft shadow on the ground instead. The lamps' glass glows from the evening (`setSculptGlow`) over a pool of light on the
  ground (an additive disc): no light is added.
- A fruit tree or bush is a `PRODUCERS` row whose plants are its kind's pieces standing, in the layout's order; its fruit
  a good of the silo. A piece that gives and is no plant (the beehive) is a `DECOR` row with `bears` (its good, the
  building that keeps it, the most the farm may own) and a `PRODUCERS` row the same way (`BEARER_KINDS`).
- Each kind is in one set of the shop (`set` on its row, `SETS`: the shop groups and counts them). A piece may wear a
  look (`DecorPiece.look`, one of its row's `tints`; kept in the store when put away: `layout.storedLooks`), drawn as
  its parts' instance colour (`lookTints`: no new draw): a painted kind (`paint`, the part a paint covers, tint 1 in its
  model) has a *Paint* chip on its edit card (`paintDecor`: free, no XP, Undo); the season banner (`given`: never sold)
  comes from the season road in its season's two colours. The farm's charm (`src/farm/charm.ts`, `CHARM` rows capped,
  `RANKS`) is words and stars in the news, a rank first reached told once (`farm.charm.told`): never a prize.
- The mill, the loom and the oven are places of the layout, and a built bed moves (`layout.beds`): where one stands now
  is `machinePoint` and `bedSpot`, never the `x`/`z` of `MACHINES` or `BEDS` (where they start).

## Interface (src/styles.css tokens, src/ui/art.ts, src/ui/glyphs.ts)

- The designers (the interface designer, `.claude/agents/ui-designer.md`; the film director; the 3D designer,
  `.claude/agents/3d-designer.md`) work only when the user asks for one in so many words, never on their own or by
  default. Otherwise what the user asks for is built straight into the game in its own look (the tokens and classes
  below), with no lab round. A designer's round is **one proposal a board**: "today" beside one design, never A, B, C,
  with only the few states needed to judge it, moving and working under a finger on touch-screen frames (phones upright
  and sideways, with their safe areas) over a still of the game, published in the design lab (`lab/`,
  `lab/README.md`; `npm run lab:build`, then the Artifact tool with `capabilities: {db: {}}`: seconds, no CI). It
  opens on a sandbox, the game's screen where what has a design is ringed where it opens from: the user marks it ✓ or
  ✗ with a note (pinned to a point or not), kept in the lab's database (`lab/feedback`). A ✗ brings the next single
  proposal only if the user asks for it; a ✓ is built into the game in the very next round. Every board has its kind,
  its icon there: `ui`, `film`, `3d`. A proposal may add a feature the game does not have (its `adds` line, ✦ in the
  sandbox, on sample data); its logic is written only once the user chose it. A
  panel's look is a component of its own fed with data (`LevelCard` from `levelView`; `LevelPanel` reads the farm), so
  the lab shows it as it is. Motion is Motion for React through `src/ui/motion.tsx` (`m.*`, the game's springs,
  reduced motion respected), a celebration `burst` (`src/ui/burst.ts`), form controls Radix primitives.
- Less motion is one answer, `src/ui/still.ts` (the player's setting over the device's): `lessMotion()`,
  `useLessMotion()`, `onLessMotion(f)`, `nope(el)` and `did(el)` in `motion.tsx`; in CSS what stops sits under
  `:where(:root[data-motion='less'])` and what moves only when it may under `:where(:root:not([data-motion='less']))`.
  Nothing else asks the device or uses Motion's `useReducedMotion` (`still.test.ts` reads the sources).
- Use the tokens and classes, not new colours or fonts: `.paper` sheets, `.btn` (`.soft`, `.leaf`, `.berry`,
  `.small`, `.round`) or `.primary`, `.tag` chips, `.art` pictures. Fredoka for titles/buttons, Nunito for text
  and numbers. Glyphs from `glyphs.ts` (Phosphor, bold/fill), pictures from `art.ts` (Fluent 3D) — add a file
  there rather than drawing one; credit anything new in `src/data/credits.ts`. A good of the farm is pictured by
  its model (`src/models/goods.ts`, `iconUrl` in `src/farm/icons.ts`): a new good gets a model there, and after
  changing one, save the pictures again with `node scripts/render-item-art.mjs` (dev server up).
- Build a panel on the base: motion presets in `src/ui/motion.tsx` (`PRESS`, `SINK`, `SQUISH`, `TIP`, `POP`, `DID`,
  `NOPE`, `ARRIVE`, `REVEAL`, `DEAL`, `FLIP`, `SHIMMER`, `SHEET`), surfaces and tokens in `src/styles.css` ("the base":
  `.wood`, `.velvet` and its premium tokens, `.ribbon`, `.chip`, `.count`, `.stars`, `.shine`, `.sheet-heading`), and the
  shared pieces: `PanelSheet` (the one sheet every panel is drawn on, from the edge; `size: 'card'` for a question,
  `foot` its two buttons, `back` for pages, `onLeave` as it starts out; what opens over it carries `data-over-sheet`;
  a panel's CSS is only what is on it), `GoodPic` (a good's picture that says where it is made: use it where a good's
  picture stands outside a button), `flyGoods` (`src/ui/fly.ts`), `Shell` (a card of that sheet, its own flow inside;
  `closePanel()` in `tests/e2e/helpers.ts` closes one as a player does and waits for it to go). A
  new panel's kind is one line in `PANEL_KINDS` (`src/store.ts`): `39-panels` opens it on a phone and measures what
  can be read and pressed (`tests/e2e/readable.ts`). What may move at the top to call asks `useCalling(id)`
  (`src/ui/calls.ts`): one at a time.
- A panel: picture, a few-word title, chips, at most one line of text, at most two buttons (*Cancel* first — one
  word, on every card that asks —, the action last with its price). 44 px targets (48 px hit areas on touch, grown
  round them), text ≥ 15 px (never < 13); words in amber use `--amber-ink`, a thing not open yet fades only its
  picture (`.locked`, `.off`). At the top, what loops asks `useCalling` (`src/ui/calls.ts`): one moves at a time. A good's picture where goods change hands
  or go into a machine is an `ItemPic` with its count (the round badge, 1 included), never the picture repeated.
- The top of the screen has three views (`HudMode`: everything / only the compass / clear, `<html data-hud>`):
  anything new up there must hide in the views it does not belong to (see `src/ui/Compass.css`). The dashboard
  (`src/farm/TopDash.tsx`: coins, the level's road, the silo and barn tanks, the line and the goals) keeps a gap
  between its wings where the compass's slot sits; its middle is one column (`src/ui/TopStack.tsx`): the compass, a
  toast, the level-up, the first hint and a new farm's next step each in its slot (`<TopSlot name>`), one under another; something new there
  is a slot in its place in the order, never an offset from another element. The corner has one menu (`HudMode.tsx`:
  edit or decorate, the top's view, settings) in every view, and the photo button only in the clear one. `22-xp`
  checks every box up there, with a toast and the hint, upright and sideways.
- Touch controls (`src/ui/TouchControls.tsx`, `src/lib/stick.ts`): the stick comes to the thumb in the bottom-left
  area, with three buttons over it (look where you walk, walk on, turn round); the action buttons and jump are
  bottom right. Anything new there is placed by `measure`/`place`/`leftSide` in both orientations, clear of the
  others, and whatever floats over the scene keeps clear of them (`touchLayout`). The controls are taught where they
  are, once a device (`learnt` in `src/settings.ts`): a ring round the stick until it has walked, then a hand until a
  drag has turned the view; the three buttons come in once the stick has walked. `ready()` marks them learnt.

## The house's furniture (src/home)

- Where each piece stands is data in the farm's save (`layout.ts`: the rules for where a piece may go, `catalogue.ts`:
  each kind's size, layer, price and weight). A new kind gets a catalogue entry, a model in `PieceModel`
  (`src/scene/Furnishings.tsx`) and its picture: `node scripts/render-furniture-art.mjs` (dev server up).
- A room holds pieces up to `ROOM_WEIGHT` (60k triangles, `layout.ts`; *This room is full*), measured so that full
  rooms keep every first-person view in the house inside `05-budget` (the views over it are its listed debts). A
  kind's `weight` is its model's triangle count and `05-budget` fails when a model draws more: keep a piece under its
  weight — slim a heavy model (`simplify` in `scripts/assets.manifest.json`, then `npm run assets:optimize`) rather
  than raise the weight; if a weight or the limit must change, measure again.
- A new farm starts on the farm and does not download the furniture's models before it plays: they come down in idle
  time a few seconds into play (`downloadLater`, `src/lib/loader.ts`; `startsOnFarm`, `src/lib/saveKeys.ts`); a farm
  that opens in the house fetches them first (`saveKeys.test.ts`; `11-startup`: a new farm's first download has none).
- Things that stand on a piece follow it: `OnPiece` for the small ones, `HOSTED` for lamps and pickups (the standing
  lamp is a piece of its own, its light `HOSTED` by it: the house keeps as many lights as it always had).
- What hangs on the walls is a piece on the `wall` layer (pictures, the mirror, the clock, the radiator, the switches,
  the sockets, the screens: its x and z the point of the wall's face, its turn the way it faces, its height the kind's
  `hang`); it slides along the walls of a room, clear of corners and openings, and a tall piece keeps from under it.
- The house's shell is the save's too (`src/home/shell.ts`, `farm.home.shell`): where each doorway, window and the
  garden door is along the walls it may be in (a window round its room's corner, a doorway only between its two rooms),
  which are closed (wall), each room's paint (its own side of each wall) and floor. Decorating slides, closes and opens
  them, paints and lays floors (free, with undo); the number of openings never changes, so `05`'s worst case holds.
  Everything built from the openings follows the save's: the walls (built and merged again by colour), their
  colliders, the doors, the light shafts, the portals and the sun's windows, the camera's limits, the route, the rules.
- Blocking the way is the player's choice: a piece that leaves a doorway, a room, a screen or a lamp out of reach fits
  with a word (`warn`, amber), never a refusal; what stands or hangs must still not go through a wall or another piece,
  nor where the kitchen's door shuts and swings. Decorating ends with `keepPlayerClear` (never inside a wall or a piece).

## The house's computer (src/home/Computer.tsx, src/farm/computer, mood.ts, ledger.ts, prices.ts)

- A piece of furniture (`computer` in `catalogue.ts`: 500 coins, Tables; its model `ComputerDesk` in `Furnishings.tsx`,
  its screen the vegetable index, drawn as the farm changes, at most once a second, only in its room), used with the
  action button (*Use the computer*): its desktop opens (`ComputerPanel` reads the farm, `ComputerDesk` draws its
  `DeskView`), the Today widget and the apps, a row each of `APPS` (`apps.ts`: Market, Planner, Sales book; a new app
  is a row). While the house has none, the studio's desk carries its price tag: a card, then it stands at the free spot
  nearest the desk (`place.ts`). An app's window is over the sheet (`data-over-sheet`): Esc closes its page, the window,
  then the computer. It gives no XP and asks nothing: everything it shows is the game's own numbers.
- Every sale pays whole coins: a price may carry a share more (a machine's level, the day's factor), so each path that
  pays rounds what it pays (Make room: each good's line), and the save reads coins and stats back whole.
- Every price is one sum with named parts: `priceOf` is `priceAt` with the farm's parts (its machine's level, the
  day's factor), and the views call `priceAt` with a farm's own (`marketView`, `planView`, at `computerNow()`), so the
  computer never disagrees with a sale. `BUYER_OFFERS` (`data.ts`) is the gate's table of offers and their odds: a
  buyer's offer is drawn from it, and the Market shows it.
- The day's factor is the one `priceEvents` setter, `dayFactor` (`state/day.ts`): the lucky draw's ×2 times the town's
  market mood (`mood.ts`: ±10 %, half a shared wave of 13 days and half each good's own of 7 to 11, by the date alone,
  the same on every farm, never because you sold; never a building material), judged on the events' day (a time away's
  step on its own). Quiet where the game is tested (under Vitest; on a ?debug page unless `&mood=on`; `ready()` and
  `bootApp` quiet it): a test turns it on with `setMood`, a page with `__home.mood.on(true)`. The vegetable index is
  100 × the crops' mean mood. A change to its numbers is checked against `npm run sim` with it on.
- Every sale calls `sold(channel, good, units, coins)` once, where it pays (`state/ledger.ts`: the gate, an order split
  by each line's share, the manager, your shop, the contractor); a decline writes nothing. `ledgerNow()` gives the book
  (`farm.ledger`: `LEDGER_DAYS` of the device's calendar), `bookView` draws it. A new place to sell is a `Channel`
  (`ledger.ts`) and a row of the views (`marketView`'s channels, `CHANNEL_WORDS`). `MarketFarm` needs `ledger` (pass
  `farm`). `41-computer` buys it both ways and opens every app and tab upright and sideways.

## Making models (src/lib/sculpt, examples in src/models)

- Build from the kit's shapes; close every end that is not buried in another piece (radius 0 at tips, `round`,
  or `caps`). Leaves and other two-sided parts are open by design.
- Surfaces (stone, brick, boards, shingle, bark, clay) come from the material's `surface`, not from extra rings.
- Openings and joins: `subtract` / `union` / `intersect` (manifold-3d) on closed shapes; a model that uses them is
  built after `loadSolids()`.
- Add every model to `src/models/gallery.ts` (`?gallery`) and `src/models/checks.ts`. The checks (loose pieces,
  holes that show, floating or sunk) must find nothing; the e2e suite fails otherwise.
