# The first hour: pace, unlocks, first steps

> **בעברית, בקצרה:** שלושה חלקים, לפי הסדר הזה.
> 1. **איזון הקצב (חלק A):** סימולציה שמשחקת לבד ובודקת שתמיד יש מה לעשות.
> 2. **מפת "מה נפתח" (חלק B):** טבלה אחת של מה כל רמה פותחת (גידולים, שדרוגים, מתכונים, קישוטים, שטחים). מה שעוד
>    סגור מופיע דהוי עם מנעול ו"רמה N"; בעלייה ברמה מופיע כרטיס "נפתח!". מה שכבר שלך נשאר שלך.
> 3. **עשר הדקות הראשונות (חלק C):** 8 צעדים: לשתול, לאסוף ביצים, להשקות, לקצור, למכור בשער, לגזוז כבשה, לארוג
>    בנול, לשלוח הזמנה. רמז קטן מתחת למצפן; נגיעה בו מובילה למקום; פרס קטן על כל צעד; אפשר לדלג.
>
> הטבלאות של B ו-C והבדיקות שלהן כבר כתובות בקוד (`src/farm/unlocks.ts`, `src/farm/firstSteps.ts`) ועוד לא מחוברות
> למשחק. כך דבר חדש בעתיד הוא שורה בטבלה, לא קוד חדש.
>
> המעצב מכין את שני הלוחות (הרמז, וכרטיס "נפתח!") יחד, כדי שתאשר את שניהם בסבב אחד.
>
> בדיקות: רק מה שמגן על החלק עצמו. כל השאר רץ ב-GitHub.

This file is the plan the agents work from. A refining agent sharpens parts B and C (file paths, signatures, what to
reuse); part A is built first. Each part ends when its "done" list is true. Keep this file short and current: when a
part is built, replace its plan with two lines on what was built and where.

## Rules for all three parts

- **Data first.** Each part is one table of rows plus one small engine that reads it, like `PRODUCERS`, `GOALS`,
  `EVENTS`. A future crop, animal, step or unlock is a row, never new engine code.
- **Reuse what is there.** The top-of-screen hint slot (`<TopSlot name="hint">`, `src/ui/Hud.tsx`), the compass and
  walk-to (`src/lib/route`), goals' counting (`stats`, `got`), the level-up show (`XpChip.tsx` `LevelUp`), the gift and
  daily records' pattern (`src/farm/gifts.ts`, `daily.ts`), Motion presets (`src/ui/motion.tsx`), haptics
  (`haptic(kind)`).
- **Lean testing.** Each part gets the unit tests of its rules and one e2e spec only if it has UI. Locally run only
  those plus `npm run check` (vitest `--maxWorkers=2` when the machine is busy). Everything else is CI's job. No
  screenshots sweeps beyond one upright and one sideways look at the new UI.
- **Interface.** The two new pieces of UI (the step hint, the "Unlocked!" card) get one quick lab board each for the
  user's ✓ before they are built (CLAUDE.md "Interface"); the logic is built meanwhile.

## Part A: pace — built

- **Built:** `src/sim/`: `policy.ts` (a good player's list of priorities, each move a function the button or a panel
  calls), `play.ts` (`tick` at 0.25 s, a walk and a press per move, seeded dice, events off, the daily gift and the
  level's boxes taken as they come), `report.ts`; `npm run sim` prints three hours; `pace.test.ts` holds `PACE`
  (`targets.ts`) on seeds 1–3 in about a second.
- **Tuned:** `LEVELS.step` 15 → 30, nothing else (no wait over 2 min before or after; the longest 7 s). It leaves room
  for Part B, whose locks slow the first hour. Saves mark their curve (`xp.curve`); one without it is moved onto the new
  curve as it loads (`savedOnToday`, src/farm/xp.ts): the same level and share, nothing paid or given twice.

| Level (minutes of play, seeds 1–3) | 2 | 3 | 5 | 8 | 10 | 12 | 15 | 20 | 30 |
|---|---|---|---|---|---|---|---|---|---|
| `PACE` band | ≤ 3 | 1–6 | 5–15 | 14–32 | 22–48 | 32–67 | 50–105 | | |
| before (step 15) | 0:56 | 1:52 | 4:21–4:59 | 8:35–10:22 | 13:01–14:53 | 20:17–22:01 | 32:16–35:02 | 61–64 | 136–142 |
| after (step 30) | 1:24–1:32 | 2:39–3:11 | 6:25–7:51 | 16:38–19:14 | 27:18–29:38 | 39:47–42:17 | 70:24–70:48 | 123–127 | after 3 h |

## Part B: unlocks — built

- **Built:** `UNLOCKS` and its helpers (`src/farm/unlocks.ts`), a gate on every buy, planting and job in `state.ts`
  (`isUnlocked`; on for players, all open on a ?debug page), the locked face as the lab's C ribbon (`src/ui/LockTag.tsx`
  on the seed packets, shops, decoration, tags, prompt, meadows and cards), and "Unlocked!" as C made bigger
  (`src/farm/Unlocked.tsx`: cards dealt out of the level's star and home again; the level card's "At level N" row).
- **Guarded:** `unlocks.test.ts`, `state.unlocks.test.ts`, `unlockArt.test.ts`, `Unlocked.test.ts`; the sim meets
  `PACE` with the locks on; `36-unlocks`, and `25-button`'s locked farm.

## Part C: the first ten minutes

**In already** (not wired): `src/farm/firstSteps.ts` — the steps, their record, the pure engine — and
`src/farm/firstSteps.test.ts`.

### Decided

| # | `say` | Done when (the farm's numbers) | A tap walks to | Reward |
|---|---|---|---|---|
| 1 | Plant some seeds | `planted.length > 0` | the nearest empty bed | 10 coins |
| 2 | Collect the eggs | goal `eggs` ≥ 1 | `placeFor('egg')`: the nest | 5 |
| 3 | Water your seedlings | `stats.watered` > 0, or sprinklers, or a crop harvested | the nearest thirsty bed, else growing | 5 |
| 4 | Harvest your crop | goal `harvest` ≥ 1 | the nearest ripe bed, else thirsty, else growing | 10 |
| 5 | Sell at the gate | goal `sell` ≥ 1 | `farm-queue` | 10 |
| 6 | Shear a sheep | goal `wool` ≥ 1 | `placeFor('wool')`: the nearest sheep | 5 |
| 7 | Weave cloth at the loom | goal `cloth` ≥ 1 | `placeFor('cloth')`: the loom | 10 |
| 8 | Send an order | goal `orders` ≥ 1 | `farm-office` | 25, and the finale |

- **Changed from the draft.** *Bake* → *shear + weave*: a cake needs flour and sugar (wheat and sugar cane, not open
  at level 1, grown and milled), eggs, and carrots or a fruit — minutes of chain; the fleeces are on the sheep from the start and a cloth takes 6 s — the
  same lesson (a machine's queue) in half a minute. *Place a decoration* is left to the level that opens decoration:
  the edit mode is no place to walk to, its "Unlocked!" card is its tip, and a new farm's coins are for seeds. The
  order last: the tractor driving off ends the steps.
- **One evaluator:** a condition is the goals board's measure (`reached(goal)` → `goalById(goal).measure(f) >= 1`), or
  a farm field that only grows. The one new number is `stats.watered`.
- **In order, from absolute numbers:** each step passes when its condition holds, in turn; one done already as it
  comes passes with it (and pays). The record is only where you are (`advance(rec, f)` → `{ rec, passed }`).
- **They end** after the last, skipped (✕ on the hint, then a confirm), or on a farm at level 5
  (`STEPS_UNTIL_LEVEL`): the daily gift waits for them, never for ever.
- **What they need is open at level 1** (each row's `needs`; the test holds Part B's table to it).
- **Targets need no new compass mark:** the hint, right under the compass, is the mark; a tap runs the compass's
  own walk (`walkTo`, src/lib/route/walking.ts L60: the arrow over the thing, the stick taking over, again to stop).

### Save

- `FarmData.firstSteps: StepsRecord` (`{ step, over }`); `fresh()` L305: `stepsFresh()`; `load()` beside the daily
  gift L608: `data.firstSteps = sanitizeSteps(raw.firstSteps)` — missing is over (an older farm never sees them), the
  step clamped 0…8, `over` only from `true`. Nothing else depends on it (no coupling rule in save.property).
- `stats.watered`: FarmData L227, `fresh()` L321, `water()` L862 `farm.stats.watered++`; `load()` reads it as the
  other stats (0 on an older farm). `firstSteps.ts`'s `watered()` then reads `f.stats.watered` directly.
- `save.property.test.ts`: `STATS` L78 + `'watered'` ("the seven"), and
  `bad('firstSteps', sameKeys(farm.firstSteps, ['step', 'over']) && isCount(farm.firstSteps.step, FIRST_STEPS.length) && typeof farm.firstSteps.over === 'boolean')`.

### The engine (state.ts)

```ts
import { advance, currentStep, sanitizeSteps, skipped, stepsFresh, type StepDef, type StepsRecord } from './firstSteps'

/** The first steps run on a new farm's own pages; under Vitest and on a ?debug page (unless &steps=on) they are quiet
 *  until a test turns them on: nothing shown, passed or paid. (Until C3: quiet everywhere.) */
let stepsQuiet = stepsQuietByDefault() // the same rule as allOpenByDefault, with 'steps'
export function quietSteps(on: boolean) {
  stepsQuiet = on
  bump()
}
/** The step to show now (null: over, or quiet). */
export const stepNow = () => (stepsQuiet ? null : currentStep(farm.firstSteps))
/** They are running: the daily gift waits. */
export const stepsBusy = () => !stepsQuiet && !farm.firstSteps.over
/** The steps passed and not shown yet (the hint's ✓ takes them). */
let passedNow: StepDef[] = []
export const takePassed = () => passedNow.splice(0)
export function skipSteps() {
  farm.firstSteps = skipped(farm.firstSteps)
  bump()
  save()
}
/** Passes the steps the farm has done, paying each one's reward (`give`, L2228: coins, or goods past full; no XP).
 *  In `tick` L2138, after `neverStuck()`: whatever function changed the numbers, they are read a frame later. */
function stepsOn() {
  if (stepsQuiet || farm.firstSteps.over) return
  const { rec, passed } = advance(farm.firstSteps, farm)
  if (rec === farm.firstSteps) return
  for (const s of passed) give(s.reward)
  farm.firstSteps = rec
  passedNow.push(...passed)
  bump()
  save()
}
// dailyWaiting L2290: … && !stepsBusy()
// __home.farm.steps = { now: stepNow, quiet: quietSteps, skip: skipSteps, record: () => farm.firstSteps }
```

### The hint

- **Where:** `TopStack.tsx` `ORDER` L12 gets `steps: 5`, after `hint` (today the `hint` slot holds `FirstHint`,
  Hud.tsx L46–73: seven seconds of the controls, a touch screen's first entry only; the step stacks under it). Hidden
  in the clear view: `:root[data-hud='clean'] .step-hint { display: none }` (as `.level-up`, Xp.css L63).
- **`src/farm/FirstSteps.tsx`** (new): `StepHint`, mounted in FarmUI beside `<DailyWatcher />` L478. Shown while
  playing on the farm map (`useHome.map === 'farm'`), nothing over the game, and `stepNow()` not null. "Nothing over
  the game" is the daily gift's guard (DailyPanel.tsx L31–39: a panel, a screen, settings, edit, decorate, a film, a
  story film, the drive's curtain, the welcome-back card): it moves into one hook `src/ui/useGameFree.ts`,
  `useGameFree({ toast })`, used by both (the daily also waits for a toast; the hint does not).
- **What it is:** one button (≥ 44 px, words ≥ 15 px, aria-label `${say} — walk there`): the step's picture, its
  words, its reward chip; a small ✕ beside it (→ "Skip the tips?" Keep / Skip in place → `skipSteps()`).
- **A tap:** `walkTo(stepTarget(step.target))`; nothing to walk to: `NOPE` shake.
  `src/farm/walkTargets.ts` (new) holds `placeFor(good)`, moved unchanged from OrdersPanel.tsx L69 (OrdersPanel
  imports it), and:

  ```ts
  export function stepTarget(t: StepTarget): string | null {
    if ('id' in t) return interactable(t.id) ? t.id : null
    if ('good' in t) return placeFor(t.good)
    const from = playerState.position
    for (const stage of t.bed) {
      let best: { id: string; d: number } | null = null
      for (let i = 0; i < farm.beds.length; i++) {
        if (bedStage(i) !== stage) continue
        const d = groundDistance(from.x, from.z, bedSpot(i), bedBox(i))
        if (!best || d < best.d) best = { id: `farm-bed-${i}`, d }
      }
      if (best) return best.id
    }
    return null
  }
  ```
- **A step passed:** as the hint shows, it plays what `takePassed()` gives: a ✓ pops (`POP`), the reward flies to
  the coin chip (`flyCoins` from the hint's rect, src/fx/coins.ts), the next step comes in (`ITEM` in
  `AnimatePresence`). One passed under a panel plays when the panel closes. The last: `Reveal` (B4) "All set!" with
  its coins. Motion only from `src/ui/motion.tsx` (`POP`, `ITEM`, `SINK`, `NOPE`): no new tokens.
- **Not:** no new compass mark kind, no arrows or hands drawn over the scene, no dimming, no list of steps, no talk or
  film per step, no "show the tips again" setting.

### Tests

- **Unit, in:** `firstSteps.test.ts` — each step not done on a new farm and done after its action (`DOING`: a new
  step needs a line there); passed in order, one done early passing with the one before; over at level 5 and when
  skipped, nothing more paid; `sanitizeSteps`; `needs` open at level 1; every reward > 0.
- **Unit, C1:** `src/farm/state.steps.test.ts` (`quietSteps(false)`, `setRandom`):
  - "a new farm is walked through every step by playing it" — plant, collect the nest, water a thirsty bed, harvest, a
    buyer served, shear, a cloth woven and collected, an order filled and sent (each with `tick`): each reward paid
    once, over after the order;
  - "a step done early passes with the one before it, paying both";
  - "skipped: over, nothing more paid; the daily gift waits while they run (`dailyWaiting`), comes once over or
    skipped";
  - "a farm saved mid-way loads on its step; a save without them loads over".
- **E2E:** `tests/e2e/37-first-steps.spec.ts`, shared page (`steps.quiet(false)`, `unlocks.all(false)`):
  1. a new farm: the hint says "Plant some seeds"; a tap walks to an empty bed (`useWalk` ends `arrived`); each next
     step done through `__home.farm` (quick), the words follow, the coins rise by each reward; after the order no
     `.step-hint`, and the daily gift waits (`daily.quiet(false)`, `daily.waiting()`);
  2. skipped from the hint: gone, and stays gone;
  3. hidden under a panel and in the house; stacked with a toast and the level-up; one screenshot upright, one
     sideways.
- **Existing specs:** `ready()` gets `h.farm?.steps?.quiet?.(true)`. Nothing else (a ?debug page has them quiet).

### Lab board `first-steps` (kind `ui`, spot `compass`)

States, over a still of a new farm with the dashboard and compass: step 1 shown; tapped (walking, the hint ringed
as the compass's mark is); a step done (✓, "+10" flying to the coins, the next coming in); the skip confirm; the
finale ("All set!"); the column full (compass, a toast, the level-up, the first hint, the step). Variants: **A** a
chip under the compass (picture, words, reward, ✕); **B** a card with "Show me" and the steps as dots (3 of 8);
**C** a word bubble from a farmer's face. Phone upright and sideways, a computer. `adds`: a guided first ten minutes.

### Commits

1. **C1** the save and the engine, quiet everywhere until C3 (`stats.watered`, `farm.firstSteps`, `stepsOn` in
   `tick`, `dailyWaiting`), `state.steps.test.ts`, the save.property lines, `__home.farm.steps`, the `ready()` line.
2. **C2** the hint, after the lab ✓: `walkTargets.ts`, `FirstSteps.tsx`, the `steps` slot and CSS, `useGameFree`.
3. **C3** `37-first-steps`; steps on by default on the game's pages; `tests/README.md`; CLAUDE.md, beside the daily
   gift: "A new farm's first steps are rows of `FIRST_STEPS`; specs not about them keep them quiet (`ready()`)";
   Part C here → two lines.

### Risks

- The daily gift held back for good: the steps end at level 5, and skip is one tap and a confirm.
- Rewards paid twice: `advance` is pure and passes a step once; the record is saved as it pays (unit test).
- The top column crowded on a phone sideways: the steps' slot stacks; 37 looks at it full, upright and sideways.
- A step's target gone (every bed growing, nobody at the gate): `stepTarget` falls back along its stages, else the
  tap shakes; the step still passes by the numbers.
- Shipped before the hint: quiet everywhere until C3, so the daily gift never waits on steps nobody sees.

**Done:** C1–C3 in; a new farm is walked through every step to its first order sent, then the steps' slot is free
and the daily gift comes.

## Order and agents

1. Part A now (one agent, `src/sim/`). This round refined B and C here and put their tables and pure engines in
   (`src/farm/unlocks.ts`, `src/farm/firstSteps.ts`, with their tests; nothing wired).
2. At B's start the ui-designer makes **both** lab boards (`unlocks`, `first-steps`) in one round, so the user
   answers both at once. Logic commits never wait for a ✓; only B3, B4 and C2 do.
3. Part B (one agent) after A: B1; B2 with A's sim (`unlockAll(false)`; only `UNLOCKS` numbers move); B3–B5.
4. Part C (one agent) after B: C1–C3.
5. For A's agent, once B1 and C1 land: the sim calls the state functions, so it meets the locks — it asks
   `isUnlocked` before a buy and plays with `unlockAll(false)`; with `quietSteps(false)` it is paid the steps' coins
   as a new player is.
