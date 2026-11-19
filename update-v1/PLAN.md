# Update v1: the beta

**Where it stands (2026-11-19):** 23 of 27 agents merged. What is left, in order, with who takes each open item and
what the user decides first: `RUN.md`, *Now: what is left*.

> **בעברית, בקצרה: איך המשחק ירגיש אחרי, ומה יהיה אחרת**
>
> **מהשנייה הראשונה.** נכנסים ועומדים מול ערוגה, וכבר כתוב "לשתול" על הכפתור. המסך רגוע: 10 דברים במקום 15, והשאר
> מופיע כשהוא מתחיל להיות חשוב. החקלאי מוביל אותך, וכל צעד באמת אפשר לעשות, גם ביום חג וגם בהזמנה הראשונה.
>
> **כל פעולה מרגישה טוב.** מה שקוצרים קופץ ועף לממגורה או לאסם. צמחים נמתחים כשקוטפים, נובטים כשזורעים ומזדקפים
> כשמשקים. פרה מתנועעת וביצה קופצת. הצלילים מתאימים זה לזה, עולים בטון כשעושים כמה פעולות ברצף, וגדלים לפי גודל
> הפרס. פרס קטן נשאר קטן, וגדול מרגיש גדול באמת. ויברציה עדינה, במשמעות קבועה לכל סוג.
>
> **יש סיבה לחזור מחר.** יש גידולים ארוכים: מלון 4 שעות, כותנה 8 שעות. שותלים בערב, ובבוקר החווה מלאה. זמן היעדרות
> נספר עד 24 שעות, לא 3. כרטיס "הכל מוכן" אומר מתי הכל יהיה מוכן. המתנה היומית מחכה לך ולא מענישה על יום שפספסת. יש
> אלבום חווה שמתמלא ממה שעושים, ומסלול חודשי חינמי עם 30 תחנות ובגד בסוף.
>
> **יש אנשים.** 5 שכנים עם שמות ופרצופים. הם מגיעים לשער, מבקשים את מה שהם אוהבים, ומדברים אחרת ככל שהחברות גדלה.
> מכתבים מגיעים לתיבת דואר ליד השער, ויש סיפור קצר ב-5 פרקים עד רמה 15.
>
> **תמיד יש עוד לגלות.** דבר חדש נפתח כל 1–3 רמות עד רמה 45: מחלבה, כוורת, סיר ריבה, עוד ערוגות, פרות וכבשים.
>
> **חזק ויציב.** חלון שקורס נסגר, והמשחק כולו לא נעלם. שמירה פגומה לא מוחקת חווה, ושני טאבים לא דורסים זה את זה.
> הטעינה קלה יותר, והבדיקות מהירות יותר. תוכן חדש בעתיד הוא שורה בטבלה, לא קוד חדש.
>
> **מה לא יהיה:** לחץ, עונשים, מחסור מזויף או הגרלות בתשלום. המשחק מושך כי טוב בו, לא כי מפחידים.

The goal: a full **beta**. It is intuitive from the first minute, and players want to come back every day because it
is good to come back, never because they are pressed to. It stands on strong engines, so new content is rows of data,
and it needs no upkeep beyond what it must have.

## What this folder holds

- `research/`: four studies, each with its sources.
  - `psychology.md`: why players come back, and the line not to cross.
  - `farm-games.md`: what Hay Day, Township, Stardew and Animal Crossing do, and what we lack.
  - `ftue-ux.md`: the first minutes, played on a phone.
  - `feel-sound.md`: juice, sound and haptics, with a table of every action's feedback.
- `missions/`: eight missions. Each was written by an agent that read the research and its area's code, to
  `missions/BRIEF.md`. Each holds its goal, the principles it applies, its foundation, its changes (files, tests,
  size, risk), the order of its commits, its overlaps, and what is missing.

| # | Mission | In one line |
|---|---|---|
| 01 | `01-loop-economy` | Long crops, 24 h of time away, orders sized by level, unlocks every 1–3 levels to 45, `PACE` to level 30 |
| 02 | `02-meta-collections` | A daily week that waits, a farm album earned by deeds, a free monthly road, goals as rows |
| 03 | `03-characters-story` | Five named neighbours on one people engine, letters, one act of five chapters |
| 04 | `04-first-session` | Every first step doable, a calm first screen, Show me where it is needed, a next goal on return |
| 05 | `05-world-feel` | One reward tier, goods that fly from the world, reactions through instance scale only |
| 06 | `06-sound-haptics` | One table of sounds in one key, pitch variation, climbing streaks, a haptics map, volumes, less motion |
| 07 | `07-interface` | Every panel on one `PanelSheet`, `GoodPic` everywhere, an attention budget, `39-panels` for readability |
| 08 | `08-engines-stability` | One clock, `state.ts` split, a crash guard, safe saves, a faster CI, a lighter shell, a session runner |

## What was missing, and what was done about it

- **Libraries:** none. All eight missions agree: the game's own code, Motion, Radix, canvas-confetti, meshoptimizer
  and fast-check already cover every need. `zzfx` is at most an outside sketching tool, and nothing gets installed.
  `@axe-core/playwright` is not needed either, because `39-panels` measures contrast itself.
- **Assets:**
  - Pictures: Fluent Emoji 3D (MIT), fetched from `raw.githubusercontent.com`, which the session can reach, and
    credited in `src/data/credits.ts`.
  - Models: built in code with the sculpt kit.
  - Sounds: synthesised by the game's own engine, so no files.
- **Skills and docs:** the ones each mission names are in the repository already: `CLAUDE.md`, `lab/FILM.md`, the
  sculpt kit's examples and MDN's Web Audio pages. No skill needs installing.
- **Access:** some research sites were blocked, so those claims rest on search summaries and the research files mark
  them. Nothing the build needs is blocked.
- **Your decisions:** listed below. They are the one real gap; everything else is ready.

## Order of work

Each phase's agents run side by side. Each owns its files (the overlaps are in each mission's §6). Every commit is
green: `npm run check`, plus that area's specs only, and CI is the gate.

**Phase 0: the foundation (one agent, 08 commits 1–4, before anyone else branches).**
- `src/lib/time.ts`: one clock for every countdown. One of them shows "1:60" today.
- `src/farm/state.ts` (3,636 lines) split into `state/<area>.ts` behind the same import.
- Shared save readers (`saved.ts`).
- A `PanelGuard`, so a crashing panel closes and the game stays.
- `16-view` split across shards, so a push waits about 11 minutes instead of 17.
- Added here because no mission took it, while 02 and 04 both need it: `src/ui/cardQueue.ts`, the queue for the
  cards that open by themselves (welcome back → daily → level → mail).

  Landing this first stops the eight missions from conflicting in `state.ts`.

**Phase 1: the shared engines (five agents).** Each is a function or table the content of phase 2 goes through.
- **05:** `rewardTier` (`src/farm/tier.ts`) and `REACTIONS` (`src/fx/react.ts`), with `Parts.at` taking a scale per
  axis.
- **06:** the table of sounds and the separate gains; it reads 07's one `lessMotion()` (`src/ui/still.ts`).
- **07:** every panel on `PanelSheet`, the attention budget (`src/ui/calls.ts`), and `39-panels` with today's gaps
  listed as debts.
- **02:** one `Prize` and `give()`, the farm's counts as data, the road of stops, and the calendar.
- **03:** one table of people (the manager, contractor, agent and driver move into it), any person's portrait, and
  friendship.

**Phase 2: the content (eight agents, one per mission, on the engines).** In each mission, everything after its
foundation:
- 01: the long crops, a day away, buildings and unlocks to 45, `PACE` to 30.
- 02: the album, the season road, the kind daily week.
- 03: the neighbours, letters and act 1.
- 04: the first session.
- 05: goods flying, and the reactions.
- 06: the palette, streaks and haptics.
- 07: the readability debts paid.
- 08: the furniture's copies, safe saves, the shell and the session runner.

**Phase 3: the beta check (two agents and me).**
- A full playthrough on a phone, upright and sideways, from a new farm to level 15 through the sim, plus the real
  first 30 minutes in the browser.
- `05-budget` and `16-view` whole.
- The nightly run green.
- What is found gets fixed, then the version is tagged `v1-beta`.

## Your decisions

Each one has a recommendation. Answering "**all as recommended**" is enough, or change any number.

**The game's pace (01)**
1. Long crops from the first hour (sunflower, potato, melon, cotton)? **Yes.**
2. Time away counts for **24 h** (12 h? no limit?).
3. A morning's return worth about **30 minutes** of play's income (20? 40?).
4. Three new buildings: a dairy, a beehive and a jam kettle? **All three.**
5. More animals (cows to 5, sheep to 6) and more beds (to 25), as long as the budget holds? **Yes.**
6. "All set" opens by itself once each time? **Yes.**
7. Notifications? **No** in v1: a static site cannot schedule them, and they nag.

**Coming back (02)**

8. The daily week counts gifts claimed, not days in a row, so it waits through any absence. Also a fixed
   welcome-back gift, and a "days played" count that never falls? **Yes.**
9. Album tiles earned only by deeds (no random stickers)? **Yes.** A finished page gives a garment? **Yes.**
10. A free monthly road of 30 stops fed by XP; a month missed comes back next year? **Yes.**

**People and story (03)**

11. Five neighbours: a baker, a teacher, a knitter, a beekeeper and a child who loves the animals? Names in the game's
    own style, a warm and gently funny tone, one act of five chapters now? **Yes.**
12. A mailbox in the world, birthdays where they give you a gift, portraits drawn from their own models? **Yes.**

**The first session (04)**

13. Water dries at the festival's speed, so the water step can always be done? **Yes.**
14. Silo, barn, goals, gifts and news hidden until they matter. The start facing the east beds. **Yes.**

**Feel, sound and interface (05, 06, 07)**

15. Confetti only for real rewards. A small goal keeps its stamp and its count-up, without confetti. **Yes.**
16. "Less motion" and separate volumes in settings; music that follows the time of day. **Yes.**
17. Chips may stay at 13–14 px, with every line of words at 15 px or more; touch targets of 48 px. **Yes.**

**Engines (08)**

18. The loading target is **160 KB** (120 is harder: the opening screen without Motion).
19. Phase 0 lands before everything else? **Yes.**
20. Anonymous usage counts (one ping a day: level and days played; each first step done or skipped; the kind of
    any crash), opt-in only, with no identifying details? **Your call.** A "no" keeps everything on the device.

Smaller decisions within each mission take the mission's own recommendation unless you say otherwise.

## Done when

- The sim holds `PACE` to level 30: no wait over 2 minutes in the first hour, a morning's return of about 30
  minutes of play, and income that grows past level 15.
- A new farm plays through all eight first steps on a phone, on any day of the week, including festival days.
- `05-budget`, `16-view` and the new `39-panels` pass, with no debt beyond the ones listed.
- CI is green on push, and a push waits about 15 minutes at most. The nightly run is green.
- A save that cannot be read is never written over, and no panel can blank the game.
- Every reward goes through `rewardTier`, every sound through the table, and every panel through `PanelSheet`.
- New content is rows: a crop, a neighbour, an album page, a month's road, a sound, an unlock.
