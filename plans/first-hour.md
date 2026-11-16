# The first hour: pace, unlocks, first steps

> **בעברית, בקצרה:** שלושה חלקים, לפי הסדר הזה.
> 1. **איזון הקצב (חלק A):** סימולציה שמשחקת לבד ובודקת שתמיד יש מה לעשות.
> 2. **מפת "מה נפתח" (חלק B):** טבלה אחת של מה כל רמה פותחת.
> 3. **עשר הדקות הראשונות (חלק C):** כ-8 צעדים מודרכים.
>
> כל חלק בנוי מטבלת נתונים ומבדיקה אחת שמגינה עליו. כך דבר חדש בעתיד הוא שורה בטבלה, לא קוד חדש.
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

## Part A: pace — a simulation that plays the game

- **What:** `src/sim/`: a headless run of a fresh farm with the game's own functions (the same ones the action button
  and the panels call), a "good player" policy (each step: do the most useful action available — harvest/collect what
  is ready, sell to the line, refill beds and machines, send an order, buy the next upgrade it can afford), on a fixed
  seed (`setRandom`), simulated time at a fixed step, no rendering.
- **Output:** `npm run sim` prints minutes to each level (1–30), coins over time, and every gap where the player had
  nothing useful to do (with what they were waiting for). Hours of play in seconds.
- **Guard:** `src/sim/pace.test.ts`: level 2 within 3 min of play; each of levels 2–15 within its target band; in
  the first hour no gap with nothing to do over 5 min. Bounds sit in one table (`PACE` in `src/sim/targets.ts`).
- **Tuning:** only numbers in the existing rows (prices, grow and job times, `XP_FOR`, upgrade prices), never new
  rules. A tuned number that an e2e spec asserts literally is updated there; those specs alone are run.
- **Done:** `npm run sim` works; `pace.test.ts` passes in `npm run check`; the report (before/after numbers) is in this
  file, Part A replaced by its summary.

## Part B: unlocks — "what opens next"

- **What:** one table, `UNLOCKS` (level → the things it opens: a crop, an animal, a machine, a building or a parcel, a
  decoration kind, a feature), and one function `unlockedAt(id)` / `isUnlocked(id)` that every shop, price tag and
  offer asks. Locked: shown with a lock and "Level N", offering nothing (25-button holds this).
- **Save:** none new: unlocked is computed from the level. Whatever an older farm already owns stays, locked or not.
- **Player sees:** the level-up show adds an "Unlocked!" card for what the level opened; the level card shows what
  the next level opens.
- **Guard:** a unit test: every buyable thing appears in `UNLOCKS` once; nothing opens before what it needs (sheep
  before the loom, wheat before the mill, …); the sim (Part A) still meets `PACE` with unlocks on.
- **Done:** table and function in, every shop asking it, the reveal card built after its lab ✓, the guard passing.

## Part C: the first ten minutes

- **What:** one table, `FIRST_STEPS` (about 8 rows: plant, water, harvest, sell to a buyer, collect eggs, bake, send
  an order, place a decoration), each with: its words, the target to mark (an interactable id), the condition read
  from the farm's numbers (`stats`, `got`, like `GOALS`), and a small reward. One watcher shows the current step in the
  hint slot, marks the target on the compass (tap walks there), pays the reward on completion and moves on.
- **Save:** `farm.firstSteps` (the step index, skipped or not), `load()` treating an older farm as done.
- **Rules:** skippable; the daily gift waits until the steps are done or skipped (`dailyWaiting()`); never over a
  panel, film or the drive.
- **Guard:** unit tests for each condition and the save; one e2e spec plays a new farm through all steps.
- **Done:** a new farm is walked through every step to its first order sent, then the hint slot is free.

## Order and agents

1. Part A now (one agent). In parallel, the refining agent sharpens B and C in this file.
2. Part B after A (it uses the sim to set each unlock's level).
3. Part C after B (its steps follow what is open at level 1).
