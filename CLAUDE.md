# Working on 3D HOME

A walkable 3D house and farm in the browser (Vite, React 19, TypeScript, three.js, R3F, rapier). Phones first:
whatever is added must work with the touch controls and stay inside the per-device budget (`src/lib/profile.ts`).
The README has the overview; `tests/README.md` what each test guards.

## Before pushing

- `npm run check` (types, oxlint, the Vitest unit tests, the format check: ~15 s), then the e2e suite:
  `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test --trace off` (software WebGL, ~25 min; run single
  spec files while iterating). It builds and serves on :4185. A rule or a save change gets a unit test beside its
  code (`src/**/*.test.ts`, `tests/README.md`).
- Code style: Prettier (`.prettierrc.json`: width 200, no semicolons, single quotes; `npm run format`; the CSS keeps
  its compact one-line rules by hand). Comments say
  what and why, in plain words.
- Budget: under 250,000 triangles and 700 draw calls per view (`05-budget`). Check it when adding geometry.
- Tests must not read a value that runs on in real time across separate `page.evaluate` calls (the farm ticks
  every frame): advance and read in the same call.

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
  rooms keep every view inside `05-budget`. A kind's `weight` is its model's triangle count and `05-budget` fails when
  a model draws more: keep a piece under its weight — slim a heavy model (`simplify` in `scripts/assets.manifest.json`,
  then `npm run assets:optimize`) rather than raise the weight; if a weight or the limit must change, measure again.
- Things that stand on a piece follow it: `OnPiece` for the small ones, `HOSTED` for lamps and pickups.

## Making models (src/lib/sculpt, examples in src/models)

- Build from the kit's shapes; close every end that is not buried in another piece (radius 0 at tips, `round`,
  or `caps`). Leaves and other two-sided parts are open by design.
- Surfaces (stone, brick, boards, shingle, bark, clay) come from the material's `surface`, not from extra rings.
- Openings and joins: `subtract` / `union` / `intersect` (manifold-3d) on closed shapes; a model that uses them is
  built after `loadSolids()`.
- Add every model to `src/models/gallery.ts` (`?gallery`) and `src/models/checks.ts`. The checks (loose pieces,
  holes that show, floating or sunk) must find nothing; the e2e suite fails otherwise.
