# Working on 3D HOME

A walkable 3D house and farm in the browser (Vite, React 19, TypeScript, three.js, R3F, rapier). Phones first:
whatever is added must work with the touch controls and stay inside the per-device budget (`src/lib/profile.ts`).
The README has the overview; `tests/README.md` what each test guards.

## Before pushing

- `npm run check` (types, oxlint, the Vitest unit tests, the format check: ~15 s) always. Then, locally, only the e2e
  spec of the area the change touches, without the nightly tests:
  `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test --trace off --grep-invert @full <file>` (software
  WebGL, a few minutes a file; it builds and serves on :4185). `05` and `16` only when the change is to geometry,
  models, materials, lighting or `src/lib/visibility`, and only the group it touches (`-g`). A small request is one
  agent, no team. A rule or a save change gets a unit test beside its code (`src/**/*.test.ts`, `tests/README.md`).
- A push runs the core suite on GitHub (`ci.yml`: everything but the `@full` tests, six shards side by side), and the
  site is published only from a commit it passed on (`deploy.yml` waits for CI): a red push never reaches players.
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
  every frame): advance and read in the same call.

## What is drawn (src/lib/visibility)

- A drawing pass leaves out of each frame what cannot be seen, and never changes the picture. First person: the four
  rooms and the outside are cells seen only through the doorways, windows and garden door of `src/data/layout.ts`
  (the kitchen's door shut closes its doorway); every `Parts` crowd draws only its models in view; the sun's shadow
  map leaves out the casters under the ceilings that no window lets sunlight reach, and is kept between frames while
  everything that moved is out of it (`src/scene/Lighting.tsx`). Third person, decorating, the edit mode and first
  person outdoors: the crowds' view test, and the house's walls hide what lies wholly behind one opaque piece of them
  (`walls.ts`; a wall fading hides nothing; a thing drawn without the depth test is never hidden). In first person in
  the house the walls still judge what is outdoors (what the portals let in through a window). A walk-in building adds
  its walls as another source, and while its doors are shut it hides everything wholly inside its rooms from an eye
  outside (its `enclosure`).
- The house's shell (walls, floors, ceilings, doors) is drawn always: it is under `userData.cell = 'always'`
  (`House.tsx`), as is your own body for the camera (the sun judges it like anything in a room: `userData.sun =
  'room'`). What is outdoors is under `cell: 'outside'` (the farm, the garden round the
  house). Anything else stands in a room and is judged each frame by where it is now: a new thing in the house needs
  nothing. A new opening is a row in `layout.ts`; a new door that shuts must close its portal.
- A crowd's model is everything put after one `at`: each animal, person or plant gets its own. Parts that cast a
  shadow are drawn whole.
- Far parts of a crowd are drawn as lighter copies (`src/lib/sculpt/lod.ts`, meshoptimizer's simplifier): each part of
  400 triangles or more that casts no shadow gets copies whose surfaces (and light and colour) move at most a known
  error, and a copy is drawn only where that error is under half a pixel for the game's camera (`farEnough`). Not the
  pass's: the same with it on or off, so `16-view` still compares equal; `27-far-copies` bounds what they change on
  screen (`__home.view.lod` switches them). A new crowd part needs nothing.
- Each good's model has a weight, the triangles it may draw (`src/models/weights.test.ts`): one grown past it fails in
  the unit tests, in seconds; the heaviest good is the one the budget fills the market's shelves with.
- A big thing is built from pieces a few metres across, never one mesh round the farm: one mesh is always partly in
  view, so it is always drawn whole (the hedge and the woods' crowns, `src/farm/Land.tsx`). Each piece is made from
  the same data the one mesh had, with a material of its own made in the one mesh's drawing order (three draws a
  material's meshes nearest first, materials in the order they were made), so not a pixel changes: `16-view`
  compares them (`window.__home.land.whole`). A light thing (the fence, the trunks: a few hundred triangles) stays
  one mesh, a draw costs more than it saves.
- `16-view` draws the same frames with the pass on and off and requires every pixel, depth and shadow-map texel to
  match (a difference there is a culling bug): a new room, opening or kind of view gets a pose there; a walk-in gets
  its poses from its row. `window.__home.view` (?debug) turns the
  pass and its parts off and counts what it left out.

## Farm actions (src/lib/interaction.ts)

- One context button (E / the round touch button) offers only what one press does here: what only tells you how
  long, or what is missing, is a status (`verb: 'wait'`, `needs` for pictures); nothing far away (what is ready
  to take out of reach goes on the compass at the top: give its interactable a `ready()`, null until full). It
  never spends coins (building and buying are a price tag, below); a machine's ingredients ask first, with a
  `setConfirm` card over the button (the button again only closes it). One press does every like thing in reach
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

- What fills up and is collected (the lemon tree, the nest, the cows, the sheep) is a row in `PRODUCERS`, a machine (the
  mill, the loom, the oven) a row in `MACHINES`: its numbers, goods, words, sounds and place. `state.ts` runs every row
  the same way and keeps it in the save (`producers`, `machines`; `load()` converts older saves): no new state.
- A new animal: its row (and an `UPGRADES` row with `herd` to buy more), its model, and a thin `<Herd>` (`Herd.tsx`) with
  its wander numbers (`wander.ts`), body and pose. A new machine: its row, its model, and its moving parts driven by
  the work level `useMachine(id)` gives back.

## Levels, the market, the contractor, the day (src/farm/xp.ts, market.ts, contractor.ts, day.ts, src/data/buildings.ts)

- A thing the player does gives XP: `gainXp(action, n, at)` once, in the lowest function every way to it goes through
  (`XP_FOR` in `data.ts`; a sale is worth its coins); never in `tick`, `goOn` or `cameBack`, and nothing that can be
  undone for free gives any. The crystals fly up from `at` (a panel's sale: from low in the middle).
- An upgrade bought a step at a time is a row in `LADDERS` (one buy, `buyLadder`; one card, `LadderCard`; its level in
  `farm.ladders`), with `say(k)` for what step k gives.
- A building you walk into is a row in `WALK_INS`: its walls, rooms, doors (an `autoDoor` slides open as anyone comes
  near) and lights. The model, the colliders, the hiding pieces, the camera's limits, the action button's spaces
  (`spaceAt`), the walk-to, the footsteps and the woods' clearing all follow from the row; every floor and every inner
  face that looks at the sun must be inside the sun's shadow box (`buildings.test.ts` fails otherwise), and `16-view`
  makes its poses from the row.
- A new character is a roll of the people engine (`rollLook`, `src/models/look.ts`; one who always looks the same:
  overrides) and a movement script (`src/farm/script.ts`). A look is saved as its traits, never as the roll.
- What keeps hours is a row in `HOURS`; the day's phases and their light are `DAY`. The light changes only the colour
  and strength of the lights there are. Tests stand at noon with the clock stopped (`helpers.ts`, `ready()`).

## The wardrobe and the levels' rewards (src/farm/outfit.ts, src/home/Wardrobe.tsx, src/farm/LevelPanel.tsx)

- 500 levels (`LEVELS.max`), each taking longer than the one before. Each brings coins, claimed in the level's card
  (the level chip opens it: the XP to the next level and what it brings); every fifth one a garment.
- The player's clothes are the people engine's (its shirt, trousers, straw hat, cap, beanie) in a table of garments,
  each with the level it comes with (`GARMENTS`: two of each at level 1, then one every `GARMENT_EVERY` levels); what
  is worn is `farm.outfit` in the save. A new garment is a row there, and its picture is drawn from its model by
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
- Time away (the page closed or hidden: `cameBack` in `state.ts`) runs the farm on in steps for up to three hours and
  tells what happened (`AwayPanel.tsx`, from what was ready before and after): a new producer or machine is in it by
  being a row. A goal is a row in `GOALS` (`src/farm/goals.ts`) counting the farm's numbers (`stats`, `got`); a new
  good the farm makes is counted in `got` where it comes in, as the others are.
- Surprises (a building material) have their odds in `ITEM_ODDS` and roll on the farm's own dice (`setRandom` in
  tests); orders are rows of the board (`farm.orders`), the tractor's trip a timeline (`tractorRoute.ts`), both in the
  save like the line at the gate.

## Interface (src/styles.css tokens, src/ui/art.ts, src/ui/glyphs.ts)

- How everything that wraps the game looks, moves and flows is the interface designer's
  (`.claude/agents/ui-designer.md`), and it is chosen before it is built into the game: a board in the design lab
  (`lab/`, `lab/README.md`) shows "today" beside variants A, B, C, moving and working under a finger, on touch-screen
  frames (phones upright and sideways, with their safe areas) over a still of the game, published as a link of its own
  (`npm run lab:build`, then the Artifact tool: seconds, no CI). Only the variant the user chose goes into the game. A
  panel's look is a component of its own fed with data (`LevelCard` from `levelView`; `LevelPanel` reads the farm), so
  the lab shows it as it is. Motion is Motion for React through `src/ui/motion.tsx` (`m.*`, the game's springs,
  reduced motion respected), a celebration `burst` (`src/ui/burst.ts`), form controls Radix primitives.
- Use the tokens and classes, not new colours or fonts: `.paper` sheets, `.btn` (`.soft`, `.leaf`, `.berry`,
  `.small`, `.round`) or `.primary`, `.tag` chips, `.art` pictures. Fredoka for titles/buttons, Nunito for text
  and numbers. Glyphs from `glyphs.ts` (Phosphor, bold/fill), pictures from `art.ts` (Fluent 3D) — add a file
  there rather than drawing one; credit anything new in `src/data/credits.ts`. A good of the farm is pictured by
  its model (`src/models/goods.ts`, `iconUrl` in `src/farm/icons.ts`): a new good gets a model there, and after
  changing one, save the pictures again with `node scripts/render-item-art.mjs` (dev server up).
- A panel: picture, a few-word title, chips, at most one line of text, at most two buttons (Cancel first, the
  action last with its price). 44 px targets, text ≥ 15 px (never < 13). A good's picture where goods change hands
  or go into a machine is an `ItemPic` with its count (the round badge, 1 included), never the picture repeated.
- The top of the screen has three views (`HudMode`: everything / only the compass / clear, `<html data-hud>`):
  anything new up there must hide in the views it does not belong to (see `src/ui/Compass.css`). Its middle is one
  column under the chips (`src/ui/TopStack.tsx`): the compass, a toast, the level-up and the first hint each in its
  slot (`<TopSlot name>`), one under another; something new there is a slot in its place in the order, never an
  offset from another element. `22-xp` checks every box up there, with a toast and the hint, upright and sideways.
- Touch controls (`src/ui/TouchControls.tsx`, `src/lib/stick.ts`): the stick comes to the thumb in the bottom-left
  area, with three buttons over it (look where you walk, walk on, turn round); the action buttons and jump are
  bottom right. Anything new there is placed by `measure`/`place`/`leftSide` in both orientations, clear of the
  others, and whatever floats over the scene keeps clear of them (`touchLayout`).

## The house's furniture (src/home)

- Where each piece stands is data in the farm's save (`layout.ts`: the rules for where a piece may go, `catalogue.ts`:
  each kind's size, layer, price and weight). A new kind gets a catalogue entry, a model in `PieceModel`
  (`src/scene/Furnishings.tsx`) and its picture: `node scripts/render-furniture-art.mjs` (dev server up).
- A room holds pieces up to `ROOM_WEIGHT` (60k triangles, `layout.ts`; *This room is full*), measured so that full
  rooms keep every first-person view in the house inside `05-budget` (the views over it are its listed debts). A
  kind's `weight` is its model's triangle count and `05-budget` fails when a model draws more: keep a piece under its
  weight — slim a heavy model (`simplify` in `scripts/assets.manifest.json`, then `npm run assets:optimize`) rather
  than raise the weight; if a weight or the limit must change, measure again.
- Things that stand on a piece follow it: `OnPiece` for the small ones, `HOSTED` for lamps and pickups.

## Making models (src/lib/sculpt, examples in src/models)

- Build from the kit's shapes; close every end that is not buried in another piece (radius 0 at tips, `round`,
  or `caps`). Leaves and other two-sided parts are open by design.
- Surfaces (stone, brick, boards, shingle, bark, clay) come from the material's `surface`, not from extra rings.
- Openings and joins: `subtract` / `union` / `intersect` (manifold-3d) on closed shapes; a model that uses them is
  built after `loadSolids()`.
- Add every model to `src/models/gallery.ts` (`?gallery`) and `src/models/checks.ts`. The checks (loose pieces,
  holes that show, floating or sunk) must find nothing; the e2e suite fails otherwise.
