# Mission 08: engines and stability

## 1. Goal

**Goal:** a beta that never loses a farm, never goes blank and opens fast on a phone, with green, quick CI and numbers
that show whether the game works.

**How a player will feel it:** the start screen shows sooner on a slow phone. A bug in one panel closes that panel and
the game plays on. A broken save, a full storage or a second tab never wipes a farm. Every timer reads the same way,
with no "1:60". Nothing else changes: this mission is mostly invisible.

**What was measured (2026-11-18):**
- **The page shell** (what `index.html` loads before the intro): **401 KB gzip** (JS 354, CSS 46), but the README says
  120. Most of it is the game's interface, which `App.tsx` imports statically: every panel, Radix, Phosphor and their
  CSS. A trial in a scratch copy that loads them lazily as `src/ui/GameLayer.tsx` measured **245 KB**. What is left:
  React 69, `state.ts` and its imports about 60, Motion 23, the intro's Radix settings 15, confetti 7, CSS 18.
- **Big files:** `src/farm/state.ts` has **3,636 lines (162 KB)**, 228 exports and 25 sections, and every mission
  edits it. The other big files each hold one thing (`scarecrows.ts` 1,232, `Player.tsx` 1,014, `Garden.tsx` 944):
  leave them. `FarmUI.tsx` has only 434 lines.
- **CI** (run 44187378914): five shards take 8–10 min, **shard 2 takes 19.2** (16.8 of them in `16-view`). A push waits
  about 20 min; on 11-12 it was 11. **Red runs:** (a) `12-models` keeps a hand-written copy of the gallery's ids. It
  failed CI and the night of 11-17 when `tools` was added. (b) Clicks on targets the farm re-renders: "detached / not
  stable" in `17-stores-orders` and `19-walk-to`. (c) A real-time read across calls ("10:00" read as it ran to 9:29),
  which CLAUDE.md forbids. GitHub also warns that the `@v4` actions run on Node 20, which is deprecated.
- **Crash safety:** only the 3D scene has an `ErrorBoundary`. In React 19, an error in any panel's render unmounts the
  whole root, canvas included. `load()` (`state.ts:548`) turns a save it cannot read into a **new farm**, and the next
  save writes it **over the slot**. `exportSlot` throws on such a slot, and `saveNow` hides a full storage. Two tabs on
  one slot overwrite each other. A lost WebGL context recovers, but any other mid-game error ends on the failure screen.
- **Duplicated logic:** **8 countdown formatters** (`state.ts`, `Market`, `Estate`, `Garden`, `machine/queue`,
  `tool/ToolPanelView`, `orderBoard/view`, `sim/report`) round differently, and `ToolPanelView`'s `ceil(s % 60)` shows
  "1:60". Durations in words are written 4 times (`workTime`, `awayText`, `ago`, `FarmUI`). The save readers
  (`num/int/whole/field/isObject`) are rewritten in 10 sanitizers.
- **Furniture:** the 7 models loaded from files (up to 9,984 triangles each) cast into the sun's map from copies, one
  shadow mesh per mesh. They have **no far copies for the camera**. The only debts left in `05` are both shadow-pass
  ones: third person and decorating the living room, at 189k triangles and 328 draws against 150k and 250.
- **The simulation** (`npm run sim`, 1.5 s) plays three hours in one sitting: no sessions, no time away, no events.

## 2. Principles applied

- **Time to fun** (`ftue-ux.md §1.1`): players drop off fastest in the first minutes. 156 KB less before the start
  screen is about 0.8 s on slow 4G and 3 s on a weak link.
- **Nothing is ever lost** (`farm-games.md` P3, P13, P14; `psychology.md §2` #3): a wiped farm is the worst decay.
- **Need frustration harms on its own** (`psychology.md §1.1`) and **recovery should be cheap** (`ftue-ux.md §1.9`): a
  crash closes one panel, never the game.
- **Respond within 100 ms** (`feel-sound.md §1` #2): far copies and the budget keep a phone's frames short.
- **Measure the pull, not only the pace:** sessions of 3–10 minutes that set the next appointment (`farm-games.md` P2),
  a reward every few minutes at levels 50 and 200 (`psychology.md §1.3`), and the D1/D7/D28 benchmarks (`farm-games.md`).
- **Track no one** (`psychology.md §1.8`, the manipulation matrix, and §2): outside numbers only anonymous, opt-in counts.

## 3. Foundation first (each piece has two or more users today)

- **Exists already:** the `lightShell` build guard, the loader manifest and service worker, the save sanitizers and
  `save.property.test.ts`, `ErrorBoundary` with startup restarts and `diagnostics.ts`, `lod.ts`, `parts.ts` and
  `sun.ts`, the simulation with `PACE`, `05` and its debts, and the core and nightly CI.
- **Add `src/lib/time.ts`**, with `clock(seconds)` (0:35, 4:05, 1:02:10, rounded up, never 0:00 while time is left) and
  `span(seconds)` (45 s, 6 min, 2 h 14 min, 3 days). It replaces 12 copies, and mission 01's long timers need hours.
- **Add `src/lib/saved.ts`**: the save readers (`num`, `int`, `amount`, `whole`, `field`, `isObject`, `list`), used by
  10 sanitizers today and by every save field 01, 02 and 03 will add.
- **Split `state.ts` into `src/farm/state/*.ts`, with `state.ts` kept as the one import** (a barrel). There is a core
  (`farm`, save, `bump`, toast, dice, clocks) and one module per section, so every mission adds to a small module.
- **Add a session runner to the simulation** (`src/sim/sessions.ts`): play a schedule of sessions with time away
  between them through the game's own `cameBack`, on any weekday and hour (`setEventClock`). It feeds 01's long timers
  and 24-hour time away, 02's reward cadence, and 04's first steps on event days.
- **Add a shell budget** (one number in `vite.config.ts`, checked by `lightShell` at every build) and **`PanelGuard`**
  (one error boundary that every panel slot and HUD layer uses).

## 4. Changes

1. **One clock for every timer.** *Player:* every countdown reads the same, and no "1:60". *Files:* `src/lib/time.ts`,
   the 8 countdown and 4 word-duration sites listed in §1. *Data:* none. *Tests:* `src/lib/time.test.ts` as a table
   (59.5 → 1:00, 3725 → 1:02:05, NaN or negative → 0:00, the word forms). `17-stores-orders` reads the board's text
   through `clock()`. *Size* S, *risk* low (rounding changes by one second in places).
2. **Save readers in one module.** *Files:* `src/lib/saved.ts` and the 10 sanitizers. *Tests:* the existing save tests
   and the property test, unchanged and green. *Size* S, *risk* low. Invisible.
3. **Split `state.ts`.** *Files:* `src/farm/state/` with core, save (`fresh`, `load`, `saveNow`, slots, export,
   import), beds, producers (animals and tools), machines, shop and land, decor and home, buyers, orders, levels and
   gifts, daily, market and people, contractor and estate, day and events, away. `state.ts` re-exports them and ends with
   one explicit `start()` (load, then the catch-up), so module order is no longer implicit. No import changes outside.
   *Tests:* no test changes. `npm run check` plus one full CI run, since behaviour must not change. *Size* L
   (mechanical), *risk* medium (start-up order and import cycles: functions only, nothing read at the top level).
4. **CI that is quick and green.** *Files:* `16-view.spec.ts` is split by its groups into `16-view-house`, `-farm` and
   `-buildings` (the `@full` tags kept), so each shard takes about 10–11 min. `12-models` reads its ids from the
   gallery, and a unit test in `checks.test.ts` requires the gallery's ids and `MODEL_CHECKS` to match, so a missing
   model fails in seconds, not overnight. A `press(locator)` helper in `helpers.ts` clicks targets that re-render or move.
   The board's buttons and the compass marks keep stable keys, which also keeps taps from being lost on a slow phone.
   Real-time reads move into one `evaluate`. The three workflows move to the action majors that run on Node 24 (check
   each one's current major). *Tests:* the suite itself, and `tests/README.md` updated. *Size* M, *risk* low.
5. **The shell, step 1: the game's interface loads with the game.** *Player:* the start screen shows sooner. *Files:*
   `src/ui/GameLayer.tsx` (`SoundDirector`, `Hud`, `FarmUI`, `ScreenModal`, `Curtain`, `FilmLayer`, `SettingsPanel`,
   `HudMode`, `PhotoButton`), `App.tsx` (`lazy`, kept in the same DOM order), and `vite.config.ts` (`SHELL_BYTES =
   250_000` gzip, checked in `lightShell`). The loader's manifest picks up the new chunk by itself, so it downloads during
   the intro and the service worker keeps it. *Tests:* the build guard, `11-startup` (index.html), and `01`, `14` and
   `22` on the HUD. *Size* M, *risk* low–medium (a card that opens from the intro must find the layer loaded: wait on it
   as the scene waits on `preload()`).
6. **A panel that throws closes; the game plays on.** *Player:* the panel closes, a toast says "That didn't open
   properly", the farm keeps running, and the error goes into *Copy diagnostics*. *Files:* `src/ui/PanelGuard.tsx`
   around each panel in `FarmUI.tsx` and around `Hud` and `HudMode`, plus `createRoot`'s `onUncaughtError` in `main.tsx`
   writing to `diagnostics.ts`. *Tests:* a new `39-safety.spec.ts` uses a `?debug` hook to open a panel that throws,
   then checks the canvas is still drawing, the toast shows, and the next panel opens. *Size* S–M, *risk* low.
7. **No farm is ever wiped by its own save.** *Player:* an unreadable slot shows "This farm could not be read", with
   *Save as file* (the text as stored) and *Load the copy from <date>*. A storage that is full says so once, with
   *Free up space*. *Files:* `state/save.ts`: on a failed load, keep the raw text under `<key>:broken` and never write
   over the slot until the player chooses. After each good load, keep the save as the visit began under `<key>:prev`.
   `exportSlot` exports raw text when it cannot parse it. `saveNow` reports a failure once. The saves list
   (`SavesPanel.tsx`) shows the broken state. *Data:* two keys per slot (a save is tens of KB; quota is about 5 MB).
   *Tests:* unit (`state.save.test.ts`): "{", truncated JSON and a throwing sanitizer are each kept and never
   overwritten; `:prev` restores; a `setItem` that throws is reported once. An e2e step in `39`. *Size* M, *risk* low.
8. **One farm, one tab.** *Player:* opening the farm in a second tab is fine. The tab left behind stops saving, and when
   it is looked at again it shows the newest farm. *Files:* `state/save.ts` (a small stamp key per slot: writer id and
   time; a tab never writes over a newer stamp it did not write; a `storage` event loads the newer save as
   `switchSlot` does). *Tests:* a unit test of the stamp rule, and two pages in one context in `39`. *Size* M,
   *risk* medium (the clock moved back: compare the save count, not only the time).
9. **One restart where you stood for any error mid-game.** *Files:* `startup.ts` `handleSceneError`: a mid-game
   `other` error gets one restart on a fresh scene (the farm lives outside it), with the existing restart limit.
   *Tests:* a unit test of the decision table (extract `retryPlan(kind, warm, restarts)`). *Size* S, *risk* low.
10. **Far copies for the furniture, and one sun caster per piece.** *Player:* nothing changes on screen. More may fit
    in a room. *Files:* `src/lib/sculpt/sun.ts` and a new `farFromCopies(root)` beside `castFromCopies`. Each loaded
    model gets camera copies chosen per frame by `farEnough`, the same rule as the crowds. All of a piece's sun copies
    merge into one shadow mesh (as the tools did: 245 → 233 sun draws). `Furnishings.tsx` `GlbProp`. *Tests:* `27`
    (what copies change), `16-view` (equal), `05` with `BUDGET_MEASURE=1`. Paid debts leave `DEBTS` and
    `tests/README.md`. `ROOM_WEIGHT` is a limit only for speed, so it rises to what the views now allow
    (`15-decorate`). *Size* M–L, *risk* medium (the kept map: casters are still chosen by the sun alone).
11. **The simulation measures return, not only pace.** *Files:* `src/sim/sessions.ts` (a schedule of sessions with time
    away through `cameBack`; a weekday and hour per run) and `src/sim/health.ts` with its table in `npm run sim`:
    sessions and days to levels 5, 10 and 20 and to the house (4,000 coins); rewards per session (level, unlock,
    garment, gift box, goal); the longest stretch without a reward at levels 10, 20 and 50; the value waiting on return
    after 30 min, 4 h and a night, and how much of the time away was counted (`AWAY_MOST`); and the share of sessions
    that end with everything busy (`psychology.md §1.5`). *Data:* `SESSIONS` rows in `src/sim/targets.ts` (morning
    8 min, noon 5, evening 12, a 10 h night); the bounds are 01's (`PACE`). *Tests:* `health.test.ts` holds the runner's
    own rules (time away goes through `cameBack`; a seed repeats a run). The check that the first steps finish on every
    event day is 04's, run on this runner; it should fail today on the harvest festival (`ftue-ux.md §2` step 6).
    *Size* M, *risk* low.
12. **The shell, step 2** (after decision 1). `state.ts` leaves the shell. A light reader shows the saves list from a
    few fields, and the farm loads right after the first paint, so the intro's farm card fills in a moment later. The
    intro's settings tab (Radix) and confetti become lazy. `SHELL_BYTES` drops to the chosen target. *Size* M,
    *risk* medium.
13. **Anonymous day counts** (only if decision 3 is yes). `src/lib/counts.ts`, about 40 lines with no library, sends
    `fetch(..., { keepalive })` to PostHog's capture endpoint. Off under tests and on `?debug`. *Tests:* unit
    (the payload holds only the fields listed in §7, and nothing is sent while the switch is off). *Size* S–M.

## 5. Order of commits (each green on its own)

1 time → 2 save readers (invisible) → 3 split (invisible) → 4 CI → 5 shell step 1 → 6 panel guard → 7a broken and
`:prev` copies kept (invisible until 7b) → 7b the saves list shows them → 8 tabs → 9 restart → 11 simulation
(invisible: a report) → 10 far copies (invisible by design) → 12 and 13 after their decisions. Commits 1–4 land
**before the other missions branch** (decision 2).

## 6. Overlaps

- **01:** `state.ts` (`AWAY_MOST`, `goOn`, crops), `src/sim/*`, long timers' text. 08 lands `time.ts`, the split and
  the session runner first. 01 owns `PACE` and every bound; 08 adds only `SESSIONS` and the report.
- **02, 03:** new save fields and sections. After the split each adds its own `state/<area>.ts`, reads saves with
  `saved.ts`, and adds its part to `save.property.test.ts`.
- **04:** `Intro.tsx` (the shell: step 2 moves its settings tab), `AwayPanel.tsx` (`awayText` → `span`), and the first
  steps on event days (04's check on 08's runner). **05:** `lod.ts` and `parts.ts`, because squash changes the `scale`
  that `farEnough` reads. 08 touches only `sun.ts`, `farFromCopies` and `Furnishings.tsx`. **06:** `sound.ts` (a shell
  chunk), `settings.ts`, `SettingsPanel.tsx` (lazy after step 1).
- **07:** every panel, `FarmUI.tsx`, `App.tsx`, `styles.css`. 08 touches only the clock lines, the `PanelGuard`
  wrappers and `App.tsx` once. 07 keeps `PanelGuard` when it moves panels onto `PanelSheet`.
- **Not taken:** a queue for the cards that open by themselves (welcome back → gift → level → mail), which 02 and 04
  both need. If the plan gives it to 08, it is `src/ui/cardQueue.ts`.

## 7. What is missing

**Decisions only the user can make**
1. **The shell's target:** 120 KB (the intro without Motion, and the farm loaded after it paints; L) or **160 KB**
   (step 2 as above; M)? *Recommend 160 KB.* Step 1 (245 KB) needs no decision.
2. **Split `state.ts` and land commits 1–4 before the other seven missions start?** *Recommend yes.* Done in parallel,
   the split conflicts with all of them. If not first, it goes last.
3. **Anonymous day counts to PostHog: yes or no?** *Recommend yes, opt-in only:* asked once in plain words after the
   first session, with a switch in settings, off until turned on.
   - **Sent:** at most one `day_played` a calendar day (`{ day: days since this farm began, level, daysPlayed }`),
     `step` when a first step is done or skipped (`{ index, skipped }`), and `crash` (`{ kind }`). Each event also
     carries the build's version and the device class (phone, tablet or computer).
   - **Never sent:** any id (each event gets a random one, with `$process_person_profile: false`), cookies, the user
     agent, the screen, a place, the save, coins or names. **Where:** the EU host, with *Discard client IP data* on.
   - **It gives:** D1, D7 and D28 as ratios of counts (`day: 1` against `day: 0`), where first steps are dropped, and
     crash rates. With **no**, nothing leaves the device: the simulation and *Copy diagnostics* remain.
4. **Two tabs:** the tab left behind steps aside and shows the newest farm (recommended), or keep today's "last save
   wins"?

**Libraries:** none. meshoptimizer 1.1.1 and fast-check 4.10.2 are already in the project. Counts would use `fetch`,
not `posthog-js`.

**Knowledge an agent needs:** Vite 8 and Rolldown chunks (CSS follows a lazy chunk; `lightShell` walks static imports);
React 19 error boundaries and `createRoot({ onUncaughtError })`; the `storage` event, which fires only in *other*
tabs; Safari's 7-day cap on storage written by scripts for sites not on the home screen (persistence is already asked
quietly); Playwright sharding by file when `fullyParallel` is off; PostHog's capture API (only if decision 3 is yes).

**Assets:** none.

**Access:** CI was read through the GitHub MCP tools without trouble. The PostHog connector was not used: no player
data was read. `eu.i.posthog.com` was not tried from here.

## 8. Done when

- `npm run build` fails above `SHELL_BYTES`. The shell is **≤ 250 KB gzip** after step 1 (245 KB in the trial) and at
  or under the chosen target after step 2. The README gives the measured number.
- The **longest CI shard is ≤ 12 min** (today 19.2), and 10 core runs in a row are green with no retry used (none
  "flaky" in the report). The `12-models` id list exists only in code.
- `state.ts` is **≤ 600 lines**, no module in `src/farm/state/` is over 800, and nothing outside imports differently.
- Unit tests pass: the time table, the save readers, the broken slot kept and exported, `:prev` restored, a full storage
  reported once, the two-tab stamp rule, and `retryPlan`.
- `39-safety`: a panel that throws leaves the game playing at 390×844, and two pages on one slot keep the newest farm.
- `05`: the two shadow debts are paid or lower, with the new ceilings recorded. `16-view` is equal and `27` passes with
  the furniture's copies on. `ROOM_WEIGHT` is measured again.
- `npm run sim` prints the health table (sessions to levels 10 and 20, rewards per session, value on return), and the
  first steps run on all seven weekdays (04's check).
