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
