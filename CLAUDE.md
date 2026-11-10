# Working on 3D HOME

A walkable 3D house and farm in the browser (Vite, React 19, TypeScript, three.js, R3F, rapier). Phones first:
whatever is added must work with the touch controls and stay inside the per-device budget (`src/lib/profile.ts`).
The README has the overview; `tests/README.md` what each test guards.

## Before pushing

- `npx tsc --noEmit`, then the e2e suite: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test --trace off`
  (software WebGL, ~25 min; run single spec files while iterating). It builds and serves on :4185.
- Code style: Prettier with `--print-width 200 --no-semi --single-quote`. Comments say what and why, in plain words.
- Budget: under 250,000 triangles and 700 draw calls per view (`05-budget`). Check it when adding geometry.
- Tests must not read a value that runs on in real time across separate `page.evaluate` calls (the farm ticks
  every frame): advance and read in the same call.

## Farm actions (src/lib/interaction.ts)

- One context button (E / the round touch button) offers only what one press does here: what only tells you how
  long, or what is missing, is a status (`verb: 'wait'`, `needs` for pictures); nothing far away (what is ready
  to take out of reach goes on the compass at the top: give its interactable a `ready()`, null until full). It
  never spends without asking: coins open a confirmation card (`verb: 'build'`), a machine's ingredients a
  `setConfirm` card over the button (the button again only closes it). One press does every like thing in reach.
- The prompt over the button is pictures, not a sentence (`src/ui/Hud.tsx`): an action about a good gives its icon
  `count` (how many one press takes, makes or sells), `coins` where coins change hands, a status `seconds`. The
  `label` stays the words: tests and screen readers read it.

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

## Making models (src/lib/sculpt, examples in src/models)

- Build from the kit's shapes; close every end that is not buried in another piece (radius 0 at tips, `round`,
  or `caps`). Leaves and other two-sided parts are open by design.
- Surfaces (stone, brick, boards, shingle, bark, clay) come from the material's `surface`, not from extra rings.
- Openings and joins: `subtract` / `union` / `intersect` (manifold-3d) on closed shapes; a model that uses them is
  built after `loadSolids()`.
- Add every model to `src/models/gallery.ts` (`?gallery`) and `src/models/checks.ts`. The checks (loose pieces,
  holes that show, floating or sunk) must find nothing; the e2e suite fails otherwise.
