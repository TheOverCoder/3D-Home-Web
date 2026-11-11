# Working on 3D HOME

A walkable 3D house and farm in the browser (Vite, React 19, TypeScript, three.js, R3F, rapier). Phones first:
whatever is added must work with the touch controls and stay inside the per-device budget (`src/lib/profile.ts`).
The README has the overview; `tests/README.md` what each test guards.

## Before pushing

- `npm run check` (types, oxlint, the Vitest unit tests, the format check: ~15 s), then the e2e spec files the change
  reaches: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test --trace off <files>` (software WebGL; the
  whole suite ~45 min, `npm run test:e2e:quick` ~20 min: all but the ten `@boot` tests that start a page of their
  own; `05`'s walks alone take 10–20 min, its ten times the farm, at one size, some minutes more). It builds and serves
  on :4185. A rule or a save change gets a unit test beside its code (`src/**/*.test.ts`, `tests/README.md`).
- A push runs the whole suite on GitHub (`ci.yml`, four shards side by side, ~25 min), and the site is published only
  from a commit it passed on (`deploy.yml` waits for CI): a red push never reaches players, the site stays on the last
  green commit. A red CI is the next thing to fix.
- Code style: Prettier (`.prettierrc.json`: width 200, no semicolons, single quotes; `npm run format`; the CSS keeps
  its compact one-line rules by hand). Comments say
  what and why, in plain words.
- Budget (`05-budget`): measured over a walk (the rooms, each doorway with the door shut and open, the garden door, the
  gate, the yard, third person, decorating) with the farm at its fullest, at 640×360 and at a phone's drawing buffers
  (487×1055 upright, 1055×487 sideways). The camera pass stays under 250,000 triangles and 700 draws, and the sun's
  shadow pass, counted on its own, under 150,000 and 250. A view over it today is a debt listed in 05 (and
  `tests/README.md`) with what it measured as its ceiling: debts only go down, and a paid one leaves the list. Check
  it when adding geometry (`BUDGET_MEASURE=1` prints the table without the checks; `?debug&stress=10` is ten times
  the farm, reported there).
- Speed never costs the game anything. A fix for speed or the budget may not lower quality or what the game holds: not
  plainer models, fewer buyers, animals or pieces, smaller rooms or lower caps. It changes how things are drawn
  (what cannot be seen is not drawn; detail the screen cannot show is not drawn), and the player must not be able to
  see the difference. A limit that exists only for speed is a debt to remove, not a rule to keep.
- Tests must not read a value that runs on in real time across separate `page.evaluate` calls (the farm ticks
  every frame): advance and read in the same call.

## What is drawn (src/lib/visibility)

- A drawing pass leaves out of each frame what cannot be seen, and never changes the picture. First person: the four
  rooms and the outside are cells seen only through the doorways, windows and garden door of `src/data/layout.ts`
  (the kitchen's door shut closes its doorway); every `Parts` crowd draws only its models in view; the sun's shadow
  map leaves out the casters under the ceilings that no window lets sunlight reach, and is kept between frames while
  everything that moved is out of it (`src/scene/Lighting.tsx`). Third person, decorating, the edit mode and first
  person outdoors: the crowds' view test, and the house's walls hide what lies wholly behind one opaque piece of them
  (`walls.ts`; a wall fading hides nothing; a thing drawn without the depth test is never hidden).
- The house's shell (walls, floors, ceilings, doors) is drawn always: it is under `userData.cell = 'always'`
  (`House.tsx`), as is your own body for the camera (the sun judges it like anything in a room: `userData.sun =
  'room'`). What is outdoors is under `cell: 'outside'` (the farm, the garden round the
  house). Anything else stands in a room and is judged each frame by where it is now: a new thing in the house needs
  nothing. A new opening is a row in `layout.ts`; a new door that shuts must close its portal.
- A crowd's model is everything put after one `at`: each animal, person or plant gets its own. Parts that cast a
  shadow are drawn whole.
- A big thing is built from pieces a few metres across, never one mesh round the farm: one mesh is always partly in
  view, so it is always drawn whole (the hedge and the woods' crowns, `src/farm/Land.tsx`). Each piece is made from
  the same data the one mesh had, with a material of its own made in the one mesh's drawing order (three draws a
  material's meshes nearest first, materials in the order they were made), so not a pixel changes: `16-view`
  compares them (`window.__home.land.whole`). A light thing (the fence, the trunks: a few hundred triangles) stays
  one mesh, a draw costs more than it saves.
- `16-view` draws the same frames with the pass on and off and requires every pixel, depth and shadow-map texel to
  match: anything new (a room, an opening, a kind of view) gets a pose there. `window.__home.view` (?debug) turns the
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

## Animals and machines (src/farm/data.ts)

- What fills up and is collected (the lemon tree, the nest, the cows, the sheep) is a row in `PRODUCERS`, a machine (the
  mill, the loom, the oven) a row in `MACHINES`: its numbers, goods, words, sounds and place. `state.ts` runs every row
  the same way and keeps it in the save (`producers`, `machines`; `load()` converts older saves): no new state.
- A new animal: its row (and an `UPGRADES` row with `herd` to buy more), its model, and a thin `<Herd>` (`Herd.tsx`) with
  its wander numbers (`wander.ts`), body and pose. A new machine: its row, its model, and its moving parts driven by
  the work level `useMachine(id)` gives back.

## The silo and the barn (src/farm/storage.ts, STORES in src/farm/data.ts)

- `farm.inv` is the one record of goods; each good is kept in the silo (what grows: every crop, the lemons) or the barn
  (what the animals and the machines give, and the building materials) by `storeOf`. A new good gets its building
  there; a building material is a `PRODUCE` row with `material: true` (never sold, never asked for).
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
  anything new up there must hide in the views it does not belong to (see `src/ui/Compass.css`).
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
