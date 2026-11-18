# Update v1: the player's journey, and its holes

The eleven missions, checked against the goal: a game that is easy from the first minute, and that people come back
to every day because coming back is good, never because they are pressed. The journey below is what the missions
would make. The holes are where it breaks, and the fixes are changes to the missions, ranked.

**How it was measured.** The session runner mission 08 proposes, written for this as `src/sim/sessions.ts`, played
the sim's good player (`src/sim/policy.ts`) through visits and nights, using the game's own `tick` and `cameBack`.
It is the only session runner: 08's health table builds on it, and does not add a second one. Every figure here
comes from `SIM_JOURNEY=daily npm run sim` or `SIM_JOURNEY=light npm run sim` (seed 1).
- **The real player** walks at 1.5 m/s and takes 4 s a press: about 0.6× the good player's XP a minute (level 5 at
  15 minutes, against the good player's level 7).
- **Daily:** three visits a day (08's `SESSIONS`: morning 8 min, noon 5, evening 12). Day 1 has a 15-min first
  sitting, a 6-min visit back within the hour and a 10-min first evening.
- **Light:** one 10-min visit a day, with two days off a week.

Today's game was played as it is, and each mission's rows were laid over the levels and days reached. `npm run sim`
(seed 1) still holds every `PACE` band.

| Day | 1 | 2 | 3 | 7 | 10 | 14 | 21 | 30 |
|---|---|---|---|---|---|---|---|---|
| Level, daily player (play so far) | 8 (31 min) | 11 | 13 | 20 | 25 | 29 (6 h) | 36 | 44 (12.8 h) |
| Level, light player | 8 | 9 | 10 | 12 | 14 | 16 | 19 | 23 |
| Season (10: 7 days played), daily / light | spring | spring | spring | spring | summer / summer | summer / summer | autumn / autumn | spring again / winter |

**What the runner found in today's game:**
- **A dense first sitting:** in 15 minutes, 4 levels, 17 unlock rows, 19 of the level's gift boxes, 12 goals, the
  daily gift and a garment.
- **Short timers:** after every visit the whole farm is ripe within 2 minutes.
- **Full stores:** 65 of 89 returns (73 %) find the silo or the barn full, and so do 20 of 29 mornings. The light
  player finds them full on 11 of 23 returns (48 %).
- **The unlock wall:** nothing unlocks after level 13, which is day 3 for the daily player and day 8 for the light one.

## 1. The journey, as the missions would make it

Each moment lists what the player sees and does, what is new, the pull back (the open loop), and the principles it
serves (`psychology.md` §, `farm-games.md` P, `ftue-ux.md` F).

**Day 1, the first 10 minutes** (level 1 → 4)
- **Sees and does:** the game opens facing the east beds, with *Plant* already on the button and at most 10 things on
  the first frame (04 §5–6). The farmer's eight steps have turns, so none is a dead end (04 §1–3). The harvest pops
  and flies to the silo, whose tank appears with the first goods (05 §5, 04 §5); the sounds are in one key (06).
- **New:** a step about every minute; a level every 2–3 minutes, each with its *Unlocked!* card (flour at 2,
  strawberries and a longer line at 3, sugar, sprinklers and sunflowers at 4).
- **Pull:** the next step, which can always be done; the next level's pictures on the level card.
- **Serves:** F1.1 time to fun, F1.2–1.3 one next action in the world, F1.5 four things at a time, §1.11 small wins.

**The first hour** (the steps end at about 12 min, at level 4–5; a visit back at about 55 min, at level 6)
- **Sees and does:**
  - The steps end on "All set!", and the parts held back arrive: the goals' trophy, the gifts' glow, the news badge,
    the beds' gear (04 §5).
  - The daily gift opens (02); the first neighbour moves in and their first letter opens (03). Level 5 brings the
    oven, the east beds and the first garment.
  - Back at 55 min: the welcome-back card with a **Next** row and *Go there* (04 §9). Level 6 brings tomatoes, a
    second cow and the north meadow.
- **New:** everything the steps held back, all at once (hole 2).
- **Pull:** something ripening at the visit back; chapter 1's pinned request (03); the nearest goal. 01 proposed a last
  step, "Plant sunflowers before you go (1 h)", but mission 04 did not take it.
- **Serves:** P2 sessions that end by setting the next appointment, §1.5 open loops, §1.12 an appointment as a gift.

**The first evening** (about 21:30, level 6 → 8)
- **Sees and does:** the yard in lamplight. The player harvests, sells and refills, then sets the night; 01's card says
  what will be ready, and when.
- **New:** strawberry cake, a second sheep and potatoes (01, 20 min) at level 7; corn, two meadows and the first
  scarecrow at level 8.
- **Pull:** tomorrow's gift, day 2 of 7, and the chapter's request. The night's crop is the weak one: at level 8 the
  longest crop open is the 1-h sunflower (melon opens at 9, cotton at 12), so the night pays for one hour of ten (hole
  1).
- **Serves:** P2, P3, §1.11 a clean end state.

**Day 2, the morning return** (07:30, 10 h away, level 8 → 9)
- **Sees and does:** the start menu says "10 h away" with what waits, and the farm opens facing ripe beds. The
  welcome-back card (about 70 goods and 9 buyers, *Next*, *Go there*), then the day-2 gift, then the first letter if it
  did not open yesterday. The harvest ends on a full silo or barn on 20 mornings of 29 (hole 3).
- **New:** "Day 2 on the farm", days played, a count that never falls (02); melon (4 h, 01) and the west field at
  level 9.
- **Pull:** melon ready by noon, chapter 2, an album page (02), a neighbour at the gate.
- **Serves:** §1.8 a stable morning round, F1.7 what changed and what next, §1.7 a count that never falls.

**Days 3 to 7** (daily player level 11 → 20; light player 10 → 12)
- **Sees and does:** a routine of three visits: the morning's harvest and gift, a top-up at noon, the night set in the
  evening.
- **New:**
  - Today's last rows at levels 10–13 (pumpkin and pie, fruit trees, scarecrows, meadows), then 01's first wave, a row
    a level: apple pie 14, North beds 15, muffins 16, a 4th cow 17, cherry tart 18, quilt 19, a 5th sheep 20.
  - Garments at 15 and 20, and a weekday event each day.
  - Act 1 (03, levels 5–15) runs through these days and **ends on day 4** (hole 5).
  - Day 7: the seventh gift, the big one, on spring's last day.
- **Pull:** a level a day, each opening something; the next garment; the week's big gift; "Next: summer" (10).
- **Serves:** P6, §1.2 moderate steady novelty, §1.3 the goal gradient, §1.12 temporal landmarks, P8.

**Week 2** (days 8–14, level 20 → 29; light player 12 → 16)
- **Sees and does:** summer (its look, its crops in season, the parasol, 10). The dairy (21), bread (22), cheese (23),
  the beehive (24) and the jam kettle (25): three buildings in four days. Then a recipe or an animal at each level to
  30. The car's paints at 16, 22 and 28 (11). The market at 1,500, chosen through 01's savings line, with the car park
  growing beside it (11).
- **Pull:** the next building's picture on the level card; the savings line to the house (a daily player has 4,000
  coins by about day 17).
- **Serves:** P1 a chain that grows, P6 coins with a goal, §1.11 progress you can see.

**Weeks 3 and 4** (days 15–30, a level a day from 30 to 44; light player 16 → 23)
- **Sees and does:** autumn on day 15, winter on day 22, spring again on day 29. The house is bought (about day 17),
  then its computer (09). The album's pages fill, and the neighbours' hearts bring letters.
- **New:** a row every 3 levels (ice cream 33, marmalade 36, Far beds 39, a 6th sheep 42; raspberry jam at 45 comes
  just after day 30), garments at 35 and 40, paints at 34 and 40.
- **Pull:** the house; the season about to turn; album pages nearly done; the next unlock, now 2–3 days away. Days 16,
  17, 23, 26, 28 and 30 bring no level row, season, garment or paint (hole 7).
- **Serves:** P9 collections, P10 decoration with an audience, P12 a rhythm above the week, §1.10 completion.

## 2. The holes, ranked

1. **The first night has no night crop.** At bedtime on day 1 a real player is at level 8, and so is the light one;
   the good player reaches only 10. With 01's cotton at 12 and melon at 9, the first night grows a 1-hour sunflower
   and stands idle for the other 9 h. That night decides day 2. 01's own `night` rule (20–40 min of income on day 2)
   cannot pass, and 01 calls cotton "the first night" all the same.
2. **Overload where the first steps end** (minute 10–12). Within about a minute: the steps' own "All set!"; four parts
   held back until now; about 15 gift boxes and 10 goals that were held; the daily gift, the first neighbour and their
   letter; level 5's show; and possibly 10's spring card. That is about four times the four chunks F1.5 allows.
3. **The morning return starts on a full store**, nearly three returns in four today. 01's long crops add a night's
   harvest on top: 10 beds of cotton make 60 units, against a silo of 50–100. No mission adds the "make room" press
   that P7 and `farm-games.md` top 10 #9 ask for. The first thing a player does on day 2 can be a refusal.
4. **Five clocks run the long game:** claims (02's week), days played (10's seasons, 02's days), the calendar month
   (02's road), the weekday (events) and the farm's 20-minute day (light, weather, people's hours). "Day 3 of 7" can
   mean two things. The month's road misses at both ends:
   - A daily player finishes it by day 6–10, then waits for the 1st with nothing on it.
   - A light player who starts after mid-month cannot reach its garment, which comes back "next year": a time-limited
     reward that makes missing a loss (`psychology.md` §2 #4).
5. **The story ends in the first week.** Act 1 runs over levels 5–15, so a daily player finishes it on day 4, and there
   is no act 2. 03 puts chapters "on levels 01 leaves free", but 01 leaves no level free from 2 to 30.
6. **No cap on cards that open by themselves.** The plan's queue has an order (welcome back, daily, level, mail) but no
   limit. Day 8's morning, as planned, opens up to five before the first tap: welcome back, a new week's gift,
   "Summer on the farm", a letter and the dairy's unlock (§2 #8).
7. **Weeks 3–4 thin out, and the year repeats.** Past 30, 01 opens a row only every 3 levels: for the daily player, days
   16, 17, 23, 26, 28 and 30 bring nothing new. Day 29 is a second spring with nothing new in it. A good player at the
   same 25 minutes a day passes level 45 in under three weeks.
8. **Moments without a next goal.**
   - 04's `nextUp` knows only the steps and the goals, and goals slow to 0–1 claims a visit after day 10, because each
     rung doubles.
   - After the house, 01's savings line has nothing to name. After act 1, there is no silhouette of what comes next.
     After the road, it says "opens on the 1st".
9. **"All set" names two things:** the steps' last card (`FirstSteps.tsx`) and 01's busy-farm card (F1.8: one word for
   one thing). 01's card can also fire several times in one visit, each time the farm becomes all set again.
10. **Always almost there.** Four XP tracks run at once: the level's boxes every 25 %, 30 road stops, the goals' last
    15 % and the album. Some reward is always under about 2 minutes away and glowing "almost", so a visit has no
    stopping cue (§2 #6, §1.11). At level 1 a box comes every 20–30 s.
11. **The welcome-back card swells.** 01, 03, 04 and 10 each add a row (goods, buyers, orders, rain, letters, shop,
    Next), past 07's rule of one line of text. 10's "It rained: the beds were watered" means nothing once sprinklers
    are bought, at level 4, in the first sitting.
12. **Small calendar losses.** 03's birthday gift comes only on the date itself. 10 renames each event by season (the
    harvest festival becomes "Blossom festival", then "Harvest fair"). 09's tomorrow's prices invite a check-in
    (mild).

**A returning player's first 30 seconds:**

| | As the missions make it | With the fixes below |
|---|---|---|
| Day 2, 07:30, level 8 | "10 h away" → welcome back → day-2 gift → first letter → Go there → harvest → *silo full* | welcome back with the night's cotton → gift → Go there → harvest fits (or one *Make room*) → the letter waits on the mailbox's flag |
| Day 7, level 20 (light: 12) | welcome back → the big seventh gift → events badge; nothing says tomorrow is summer; the month's road half done | welcome back → "Spring, day 7: the big gift" (one card) → "Next: summer tomorrow" on the season road's last stop |
| Day 30, level 44 (light: 23) | welcome back → week 5's gift → a second spring like the first; act 1 long over; the road waits for the 1st; the next unlock 3 levels away | welcome back → gift → Next: act 2's chapter or the nearest of road, album and unlock; year 2's spring garment on its road |

## 3. The fixes, ranked by value for effort

1. **Mission 01: change the first night.** Open cotton (8 h) at level 7 and potato at 12, swapping their rows. Mission
   04 takes 01's proposed last step, "Plant something long before you go", which offers the longest crop open. Hold
   `PACE.first` and `night` on the runner's real-pace player, whose day 1 ends at level 8, not on the good player.
2. **The plan's `cardQueue` (phase 0): at most two cards open by themselves a visit**, the welcome back counted. A
   visit is a return of `AWAY_TELLS` (2 min) or more. Each of the rest waits where it lives: a letter on the mailbox's
   flag, the gift in the corner menu, an unlock on the level chip. Mission 10's season card goes into 02's daily card
   ("Summer, day 1 of 7").
3. **Mission 04: the end of the steps lands over three visits, not one.**
   - **Now:** the steps' card; the boxes reached during the steps open as one starter gift at 05's tier, with one tap;
     the goals' trophy comes with one *Claim all*.
   - **Next visit:** the daily gift's first day, the first neighbour and their letter.
   - **Day 2:** the news. Mission 10 shows no card for the first spring.
4. **Missions 02 and 10: one long clock, days played.**
   - The daily week is the season's week: day N of 7 means one thing, and day 7's big gift is the season's end.
   - 02's month road becomes the season's road of 10 stops, fed by XP and sized so a 10-min-a-day player reaches the
     last stop by day 6. It never resets by the calendar: stops not reached carry on. "This month" becomes "This
     season".
   - Each season gets a new garment row for year 2, so day 29 is not a repeat.
5. **Mission 01: never start a morning full.**
   - Add P7's *Make room*: one press on a full row of the store panel or the welcome-back card sells the surplus no
     buyer or order wants, at fair price, until what waits fits.
   - Long crops pay in price, not count: cotton 3 at 50, sunflower 2 at 34, potato 3 at 14. That is the same net a bed
     with half the room; the quilt takes 2 cotton.
   - Hold `full` at 1 return in 4 or fewer on the runner from day 2. It is 73 % today.
6. **Mission 03: a story for the month.** Act 1 moves to levels 5, 8, 12, 17 and 23: days 1, 1, 3, 5 and 9 for a daily
   player, days 1, 1, 7, 15 and 29 for a light one. At most one chapter a visit. Write act 2 (five rows, levels 27–45)
   in v1, and always show the next chapter's silhouette. A birthday letter waits in the mailbox for the first visit
   within 7 days of the date.
7. **Mission 04: `nextUp` is never empty.** It names the step; else a request that can be filled now; else a goal to
   claim; else the nearest, in minutes of play left (01's `incomeAt`), of a goal, a road stop, an album page and the
   next unlock. 01's `nextGoal` goes on past the house: the computer, the next paint, the next meadow.
8. **Mission 01: a row every 2 levels from 31 to 45**, not every 3. Move 02's decoration sets and 03's neighbours'
   recipes down from 46–60 into levels 31, 32, 34, 35, 37, 38, 40, 41, 43 and 44. Past 45, every 3.
9. **Mission 01: rename its card "Busy till 07:40"**, never "All set". It shows once a visit, only with no card up, and
   with no confetti. While it shows, the "almost there" looks rest: it is the stopping cue.
10. **Missions 02, 05 and 07: one "almost there" at a time.** Only the nearest reward glows (07's `useCalling`). The
    level's boxes are 1 a level for levels 1–4, and 4 a level from 5 on.
11. **Missions 04 and 07: the welcome-back card holds at most 4 rows of pictures**, ranked by worth, plus Next. Mission
    10 shows its rain line only on a farm without sprinklers.
12. **Mission 10: keep the events' names** and add the season's picture beside them.

## Scaffold (written)

Approved and written. It is pure and invisible: nothing in the game imports it, it uses no three.js and no DOM
beyond the sim's happy-dom, and it touches no save.

| File | What it holds |
|---|---|
| `src/sim/sessions.ts` (new) | the session runner, mission 08's, and the only one |
| `src/sim/journey.ts` (new) | each visit's news and pulls, one row a system |
| `src/sim/targets.ts` (+) | `SESSIONS` (where 08 puts them) and `JOURNEY`, the bounds |
| `src/sim/journey.test.ts` (new) | the runner's rules, and the bounds on days 1–7 |
| `src/sim/run.sim.ts` (+) | `SIM_JOURNEY=daily` or `light` prints the journey |

- **`src/sim/sessions.ts`** is mission 08's session runner (its change 11), written first for the journey. There is
  only one: 08's `health.ts` and every later measure of visits watch it through its observer and never play visits of
  their own.
  - `PACES`: `good` is the sim's `WALK`; `real` is 1.5 m/s, a 4-s press and 0.5-s taps.
  - `visitsOf(profile, days)` turns `SESSIONS` into visits.
  - `playVisits({ profile, days, pace, seed }, { begin, moved, end })` plays the policy's moves within each visit and
    the game's own `cameBack` between visits, with the daily calendar moving with them. It puts every clock and switch
    back as the tests have them.
- **`src/sim/journey.ts`**:
  - `SOURCES` rows, one a system (`{ id, look, news, pull }`): the first steps, levels with what they open and their
    garment, gift boxes, goals, the daily gift, and the work on its way. A mission's system joins as a row in its own
    commit.
  - `AUTO_CARDS`: the cards that open by themselves as a visit begins, in their order, for the plan's `cardQueue` to
    share.
  - `journey()` returns each visit's `VisitNews`; `holes()` names each bound broken, in words (null where a run cannot
    judge it); `journeyReport()` prints both.
- **`JOURNEY`** (in `src/sim/targets.ts`, beside `PACE`; 01 owns the numbers):
  - `quiet`: at most 1 visit in a row with nothing new, on days 1–7;
  - `quietDays`: at most 1 day in a row with nothing new, from day 8;
  - `burst`: no more than 3 things within 60 s of a visit;
  - `auto`: at most 2 cards that open by themselves before a visit's first tap;
  - `pull`: something on its way through half of each time away (4 h at most);
  - `full`: at most 1 return in 4 that finds a store full.
- **`src/sim/journey.test.ts`** plays the daily player's first week, about 2 s in all. What holds today is held now:
  the runner's rules and `auto`. Each bound broken today is a listed debt, an expected failure that names the mission
  paying it, so it can neither pass in silence nor stay once paid:
  - `quiet` (01's rows from level 14);
  - `burst` (04 and 02, fixes 3 and 10);
  - `pull` (01, fix 1);
  - `full` (01, fix 5).

  `quietDays` is skipped and named as 01's debt (fix 8), since a week cannot judge it; the 30-day report shows it
  broken.
