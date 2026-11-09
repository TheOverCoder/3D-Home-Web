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

- One context button (E / the round touch button). It never stalls: what only tells you how long is a status
  (`verb: 'wait'`), and with nothing to do here it offers the next job elsewhere. It never spends: anything that
  costs coins on the farm opens a confirmation card (`verb: 'build'`). One press does every like thing in reach.

## Making models (src/lib/sculpt, examples in src/models)

- Build from the kit's shapes; close every end that is not buried in another piece (radius 0 at tips, `round`,
  or `caps`). Leaves and other two-sided parts are open by design.
- Surfaces (stone, brick, boards, shingle, bark, clay) come from the material's `surface`, not from extra rings.
- Openings and joins: `subtract` / `union` / `intersect` (manifold-3d) on closed shapes; a model that uses them is
  built after `loadSolids()`.
- Add every model to `src/models/gallery.ts` (`?gallery`) and `src/models/checks.ts`. The checks (loose pieces,
  holes that show, floating or sunk) must find nothing; the e2e suite fails otherwise.
