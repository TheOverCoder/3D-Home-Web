# Mission 04: the first session

**Goal.** A new farm reaches its first harvest, sale and order with no dead end, on a calm screen, and a returning
player knows within 30 seconds what changed and what to do next.

**How a player will feel it.** The game opens facing a bed, with the round button already saying *Plant*. New things
appear one at a time, each when it first matters, and the farmer always has a line the player can act on. Coming
back, the card shows what waited and what is next, and *Go there* walks the player there.

## 1. Principles applied

- No dead ends; one clear next action, shown in the world: `ftue-ux.md §1.3`, `§2` (steps 6, 11), Top 10 #1–3.
- Time to fun: a reward in 30 s, the loop in 5 min, a first session of 9+ min: `ftue-ux.md §1.1`; `farm-games.md`.
- Progressive disclosure, four things at a time, an attention budget: `ftue-ux.md §1.5`, #4; `farm-games.md P14`.
- Teach by doing at the moment of need; tips skippable and recoverable: `ftue-ux.md §1.2`, `§1.9`, Top 10 #6.
- Feedback that can be read (the toast on the bubble, the half-typed done line): `ftue-ux.md §1.4`, Top 10 #5, #7.
- Returning players: what changed, what next, one short round: `ftue-ux.md §1.7`; `psychology.md §1.8`, Top 10 #6.
- No guilt or confirmshaming; neutral status words: `psychology.md §2` item 2, Top 10 #4 (Ballou 2024, `§1.1`).

## 2. Foundation first

**Already there:** `FIRST_STEPS` rows read from the farm's numbers (`src/farm/firstSteps.ts`); `StepTarget` and its
resolver `stepTarget()` (`src/farm/walkTargets.ts`); `stepsBusy()`, which already holds back the daily gift
(`dailyWaiting`, `src/farm/state.ts`); `boardGoals()`, which ranks goals by nearness (`goals.ts`, `goalsView.ts`);
`goFor()`, which picks a good's way there (`src/farm/goods/go.ts`).

**To add** (each has two or more uses now):
1. **Turns: a step's line follows the farm.** `StepDef.turns?: Turn[]`, where `Turn = { when(f), say: string |
   ((f) => string), mood?, pic?, target: Target | ((f) => Target) }`. One pure `lineFor(step, f)` returns the first
   turn that holds, else the step. The hint draws it; the follower test (change 1) plays it. Uses: water, weave, order.
2. **One "where a tap walks you" type.** `StepTarget` becomes `Target` in `walkTargets.ts`; `stepTarget()` becomes
   `walkTarget()`. Uses: steps and turns, the goals' `go` (change 9), the order board's walk (`placeFor`, as today).
3. **`REVEAL`, the HUD's progressive disclosure as rows** (`src/farm/reveal.ts`): each part held back on a new farm,
   with the farm number that brings it in: `silo`/`barn` at their first good (`got`); `line` at the first planting
   (today's `farm.started`); `goals`, `gifts` (the level chip's glow and count), `news` (the menu's badge), `gear` (the
   beds' tag) and `stickTools` once the steps are over. One `shows(part)` in `state.ts`: true when the steps are quiet
   or over, else the row decides. Nothing new is saved, so old farms and every test page (steps quiet) see everything.
4. **`nextUp(f)`** (`src/farm/nextUp.ts`, pure): the step's line (through `lineFor`), else a goal ready to claim, else
   the goal nearest to done, as `{ pic, words, have?, of?, go?: Target | 'goals' }`. Uses: the welcome-back row and
   its *Go there* (change 9); mission 02's "nearest reward" can read it too.
5. **A per-device `learnt` record** in `src/settings.ts` (`{ stick, look }`): what this player has done once with the
   controls. Uses: the stick hint, the look hint, the stick tools (change 8).

## 3. Changes

**1. Steps that are never a dead end** (M, risk low)
- *Sees:* on festival days the lettuce ripens before it dries (`grow()`, `state.ts:2238`), and today the water step
  only sighs. Now he says "Ripe already! Harvest it" and a tap walks to the ripe bed. At a bed still wet: "Water it
  once it's dry". At the loom: "Weaving… then take it", then "Done! Take your cloth". The `nowhere` sigh stays only as
  a guard.
- *Files:* `firstSteps.ts` (turn rows), `FirstSteps.tsx` (draws `lineFor`; a new turn types in again),
  `walkTargets.ts`. *Data:* four turn rows.
- *Tests:* `firstSteps.test.ts` (each turn holds in the state it names; each line ≤ 26 letters, in a mood with a
  face). New `src/farm/steps.walk.test.ts` (happy-dom, places registered as in `walkTargets.test.ts`): a player who
  does only what the hint's target offers passes the steps on seeds 1–20, with each weekday's events
  (`setEventClock`) and none, and no frame leaves the hint with nowhere to go. e2e `37-first-steps`: the line changes
  when the farm does.

**2. Festival watering follows the festival** (decision 1; S, risk low)
- *Sees:* each crop needs one watering on festival days, as on others. *Fix:* in `grow()` water drains at the crops'
  event speed (`b.water -= dt * crops`); today's drain lets the festival skip the water step by accident.
- *Tests:* `state.events.test.ts`: on a festival day a new bed dries at `WATER_SHARE` (55%) of its growth, as on any
  day, and the same in time away (`goOn`).

**3. The first order fits what the steps taught** (M, risk low)
- *Sees:* the board's first order asks for eggs ×3 and cloth ×1 (it pays 26). The order step turns: "Put the goods
  in", "All in! Now send it", or "Now fetch <plural>" with the missing good's picture and a walk to it.
- *Files:* `data.ts` (`ORDERS.first`); `state.ts` (slot 0 in `fresh()`; in `load()`, a farm on its steps that has sent
  nothing gets it once, in place of the first order with nothing put in); `firstSteps.ts` (the order's turns).
  *Data:* one row; `makeOrder` is unchanged.
- *Tests:* `state.steps.test.ts`: a mid-steps save gets it once; one with an order sent or its steps over keeps its
  board; nothing put in is lost. Every sellable good's fetch line ≤ 26 letters. The follower test reaches step 8.
  `npm run sim`: `PACE` holds.

**4. "Show me" in plain view on the order board** (S–M, risk low)
- *Sees:* an order the farm cannot add to shows **Show me** with the first short good's picture (through `goFor`: a
  walk, or a remote's *Open*), not a disabled *None in store yet*. Every line short in store wears the walker badge
  (`PersonSimpleWalk`, as on the step bubble).
- *Files:* `OrdersBoard.tsx` (the foot near line 453, and `Line`), `GoodPic.tsx` (a `way` badge), `OrdersBoard.css`,
  the lab's `orders` board sample.
- *Tests:* e2e `17-stores-orders`: with no milk in store, *Show me* closes the panel and walks to the cows (`arrived`).

**5. The HUD waits for the steps** (decision 3; M, risk medium)
- *Sees:* the first frame shows the coins, the level road, the menu (no badge), the compass and the farmer. The barn's
  tank pops in with the first eggs, the silo's with the first harvest. While a step runs, the compass rings its
  target's mark and dims the others. The trophy, the gifts' glow, the news badge and the beds' gear arrive one by one
  (`ARRIVE`, 120 ms apart) as *All set!* leaves, or at once on *Skip*. Gifts and news build up meanwhile; nothing lost.
- *Files:* `reveal.ts`, `state.ts` (`shows`); `TopDash.tsx` (a held gauge keeps its place with a `top-gauge-slot`, as
  the line gauge does today, so the dashboard's measure never jumps); `XpChip.tsx`, `HudMode.tsx`, `Garden.tsx` (the
  bed's `tag`), `Compass.tsx` and `.css`.
- *Tests:* `reveal.test.ts` (each row; everything shown when the steps are quiet, over, skipped or at level 5, and on
  an old save). e2e `37`: what is held on the first frame, the barn after the eggs, everything after *Skip*. `14-hud`
  and `22-xp` are unchanged (their steps are quiet).

**6. A first view that faces the first task** (decision 5; S–M, risk low–medium)
- *Sees:* the game opens facing the two east beds, which fill the view, with *Plant seeds* on the round button from
  the first frame and the market and estate agent behind: the long goals, seen from the first second. Checked at
  390×844 in `/tmp/claude-0/-home-user-3D-Home-Web/c164316d-9885-5f35-97a5-084ad876b169/scratchpad/m04/`:
  `d-diag-east.png` (west beds: `c-diag-west.png`; today, facing the plots for sale: `a-today.png`). Returning players
  spawn there too, facing beds that are usually ripe. While a step runs and nothing
  else is guided, the guide marker stands over the step's target (hidden in reach, as today). The bubble wears the
  walker glyph from the start: a tap walks you.
- *Files:* `src/data/maps.ts` (`FARM_START = { x: -1.2, z: 7.4, heading: π + 0.7, pitch: -0.38 }`; `Spot` gains an
  optional `pitch`), `src/scene/maps.ts`, `GuideMarker.tsx` (reads the step's target while `guide` is null),
  `FirstSteps.tsx`/`.css`.
- *Tests:* `helpers.ts` (`FARM_START`); `01-boot` (faces the beds, *Plant* offered); `04-physics`; `29-maps`. `05` and
  `16` do not change: the marker is an existing mesh drawn in both passes, and the steps are quiet in 05's walk.

**7. A top column that can be read** (S, risk low)
- *Sees:* the bubble never moves when a toast or the level-up comes and goes, so a toast cannot land on it; a done
  step stamps its full line. *Fix:* `TopStack` order becomes compass, steps, toast, level (the `hint` slot goes with
  change 8); `Typed` shows the whole line when done.
- *Tests:* `37`: at 0.3, 0.6 and 0.9 s after a harvest the toast's and the bubble's boxes never overlap, and the done
  line is whole. `22-xp`: the column's order.

**8. Controls taught in context, once per device** (decision 4; M, risk medium)
- *Sees:* the 13 px line goes. On touch, after the first step: the stick's rest ring breathes until the first walk
  with it; then a hand (Phosphor `HandSwipeRight`) drifts until the first drag to look; the three stick tools appear
  once the stick has walked (their place kept: `leftSide` unchanged). The keyboard line shows once per device, at
  15 px. Reduced motion: a still ring.
- *Files:* `settings.ts` (`learnt`), `Hud.tsx` (`FirstHint`), `store.ts` (`hintShown` goes), `TouchControls.tsx`,
  `src/lib/stick.ts`, `glyphs.ts`, `styles.css`.
- *Tests:* new `src/settings.test.ts` (old settings load with `learnt` false; saved once done). e2e `07-phone` (tools
  after a walk; `ready()` and `bootApp` mark the controls learnt, so other specs see today's controls); `03-settings`.

**9. Welcome back, with what comes next** (decision 6; M, risk low)
- *Sees:* what waited, as today, then one **Next** row in place of the sentence: `nextUp`'s picture, words and count
  ("Collect 30 eggs · 22/30"; while the steps run, the step's line). *Go there* walks to the step's target while the
  steps run, else the nearest thing ready (today: the morning round), else the next goal's place; a goal ready to
  claim opens the goals board. "Dry beds" in red becomes "To water" in the card's own tone (nothing is lost).
- *Files:* `AwayPanel.tsx`, `nextUp.ts`, `goals.ts`. *Data:* `GOALS` rows gain `go?: Target`: `harvest` the ripe beds;
  eggs, milk, wool, lemons, mill (flour) and cloth their good; `cakes` `farm-oven`; `sell` `farm-queue`; `orders`
  `farm-office`; `earn` and `surprises` none.
- *Tests:* `nextUp.test.ts` (step first, then a goal to claim, then the nearest to done); `goals.test.ts` (every `go`
  resolves on a new farm); e2e `20-away` (the row names the step mid-steps, a goal after them; *Go there* walks there).

**10. A kind skip, and tips that come back** (decision 7; S, risk low)
- *Sees:* at "Skip the tips?" the farmer nods (`MOMENT_MOODS.ask`: 'pleading' becomes 'encouraging'). Settings gains
  **Show the tips again** while the farm is below level 5 with steps left (`resumeSteps()`: back on its step, nothing
  paid twice). The pleading face goes from `FARMER_MOODS`, `MOOD_MOVES`, `art.ts`, its `.webp`, `credits.ts`,
  `CREDITS.md` and `render-farmer-faces.mjs`.
- *Tests:* `firstSteps.test.ts` (every face still said by something); `state.steps.test.ts` (resume); `37` (after
  *Skip*, Settings brings the step back).

**11. A two-way first choice** (S, risk low)
- *Sees:* the seed panel folds the six locked crops into one row of small faded pictures, each with its `LockTag`
  level, so the first choice is lettuce or carrot. *Files:* `SeedsPanel` in `FarmUI.tsx`. *Tests:* `36-unlocks` (each
  locked crop still shows its level).

## 4. Order of commits

Each commit green: `npm run check`, then the e2e spec named in its change.
1. Change 10. 2. Change 7. 3. Foundations 1–2, the water and weave turns, the follower test (steps 1–7). 4. Change 2
(if decision 1 is yes). 5. Change 3 (the follower test reaches step 8). 6. Change 4. 7. Foundation 3, every row true
(**invisible until 8**). 8. Change 5. 9. Change 6. 10. Foundation 5 (**invisible until 11**). 11. Change 8.
12. Foundation 4 and `GOALS.go` (**invisible until 13**). 13. Change 9. 14. Change 11.

## 5. Overlaps

- **01-loop-economy:** `grow()`, `WATER_SHARE`, `ORDERS`, `makeOrder`, `PACE`. 04 adds only the drain line and
  `ORDERS.first`; 01 owns order sizing and long crops. Agree change 2 before either lands.
- **02-meta-collections:** `goals.ts`/`goalsView.ts` (the `go` field), the daily gift's wait (`dailyWaiting` shares
  the gate `shows` uses), `DailyCard`. 04 adds one optional field; 02 may reuse `nextUp`.
- **03-characters-story:** moods, the orders board (slot 0), talk lines; 04 adds rows only to `FIRST_STEPS`.
- **05-world-feel:** goods flying to the silo and barn gauges (change 5 holds them until the first goods: the first
  flight lands as its gauge pops in; agree the landing target), the toast and coin launch, `GuideMarker`.
- **06-sound-haptics:** `settings.ts`, `SettingsPanel.tsx` (less motion, volumes). Separate keys; the second rebases.
- **07-interface:** `TopStack`, `TopDash`, `HudMode`, `Hud`, `OrdersBoard`, `GoodPic`, `SeedsPanel`, `AwayPanel`. 04
  changes behaviour and data, 07 restyles; 04's `TopStack` order lands first. 07 keeps Settings' *Back to the house*,
  the developer footer and readable sale toasts.
- **08-engines-stability:** splitting `state.ts` moves `stepsOn` and the orders: land 04's edits first, or rebase.

## 6. What is missing

**Decisions only the user can make** (my recommendation in bold):
1. Festival watering: drain water at the festival's speed, so each crop needs one watering every day? **Yes.**
2. The last step: a starter order of eggs ×3 and cloth ×1, or two more steps for milk and lemons? **Starter order.**
3. Hold back the silo and barn until their first goods, and the trophy, gifts' glow, news badge and beds' gear until
   the steps end? **Yes** (a farmer line for each instead would make the tips longer).
4. Hide the three stick tools until the stick has walked once? **Yes.**
5. `FARM_START` facing the east beds, the market behind (returning players too)? **Yes** (or the west beds).
6. Welcome back's *Go there*: the step, then what is ready, then the goal? **Yes** (rather than always the goal).
7. The face at "Skip the tips?": **a nod**, or a wink? And delete the pleading art? **Yes.**
8. Daylight: night falls about 11 minutes into a new farm (`DAY.start` 8, `DAY.length` 1200). Change it here?
   **No.** If wanted later: new farms start at 06:00, one row, judged by a screenshot at 390×844.

**Libraries:** none (`HandSwipeRight` is in the installed `@phosphor-icons/react` 2.1.10). **Skills, docs:** Motion
for React (`src/ui/motion.tsx` presets, layout animation; Context7 for `motion/react`); Playwright touch emulation; the
quiet switches in `tests/e2e/helpers.ts`; a `tests/README.md` row for each spec touched. No designer round unless the
user asks (`CLAUDE.md`).

**Assets:** none new; `src/assets/art/farmer-pleading.webp` and its credits go. **Access:** nothing blocked (the game
was checked from the local build, `vite preview` on 4391, at 390×844 with touch).

## 7. Done when

- `steps.walk.test.ts`: following only the hint, seeds 1–20 pass all eight steps on each weekday's events and with
  none; no frame leaves the hint with nowhere to go; each run within 6 min of play by the sim's walk measure (`WALK`,
  `src/sim/play.ts`).
- Unit tests green: `firstSteps.test.ts` (no 'pleading'; every turn's line ≤ 26 letters); `state.steps.test.ts` (the
  starter order on a new farm and once on a mid-steps save; resume after *Skip*; with decision 1, a festival bed dries
  at 55% of growth); `reveal.test.ts`, `nextUp.test.ts`, `settings.test.ts`. `npm run sim` keeps every `PACE` band.
- Screenshots at 390×844: a new farm's first frame has at most 10 interface things, against about 15 today (coins,
  road, menu, compass, hour, bubble, ✕, stick, jump, *Plant*), with a built bed in view; at 0.6 s after the eggs the
  toast is clear of the bubble; the welcome-back card has its Next row, one line of text and two buttons.
- e2e green: `37-first-steps` (two taps plant from the first frame, the round button then a seed packet, with no walk;
  the held parts, the turns, nothing overlapping, resume); `20-away`, `17-stores-orders`, `07-phone`, `01-boot`,
  `04-physics`, `29-maps`, `03-settings`, `36-unlocks`.
