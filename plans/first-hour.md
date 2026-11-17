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

## Part C: the first ten minutes — built

- **Built:** `FIRST_STEPS` and their engine (`src/farm/firstSteps.ts`; the record, the pay and the daily gift's wait in
  `state.ts`, on for players, quiet on a ?debug page), and the hint as the lab's C (`src/farm/FirstSteps.tsx`: the
  farmer's word bubble in the top column's `steps` slot, a tap walks there via `walkTargets.ts`, ✕ to skip with a
  confirm, "All set!" at the end; `useGameFree` holds "nothing over the game" for it and the daily gift).
- **Guarded:** `firstSteps.test.ts`, `state.steps.test.ts`, `walkTargets.test.ts`, the save's property test;
  `37-first-steps`.

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
