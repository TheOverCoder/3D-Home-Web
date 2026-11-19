# Update v1: the decisions, taken

The user handed these choices to the orchestrator (2026-11-18): "choices you make for the game's goal, run to the
end". Each choice serves the goal: intuitive from the first minute, a game players want to come back to every day
for good reasons, never under pressure, on strong engines with no needless upkeep. Every choice that may change
later sits in one constant (CONTRACTS.md, "If the user decides otherwise").

## PLAN.md "Your decisions"

| # | Decision | Taken |
|---|---|---|
| 1 | Long crops in the first hour | **Yes.** JOURNEY's fix also applies: cotton opens at level 7, so the first night grows something long. |
| 2 | How long time away counts | **24 h** |
| 3 | What a morning's return is worth | **About 30 minutes** of play's income |
| 4 | New buildings | **All three:** the dairy, the beehive, the jam kettle |
| 5 | More animals and beds | **Yes,** while `05-budget` holds with no new debt |
| 6 | The busy card ("Busy till …", 01's former "All set") | **Yes,** opening by itself once, inside the card queue's cap |
| 7 | Notifications | **No** in v1 |
| 8 | The daily week | **Counts gifts claimed and waits.** A fixed welcome-back gift, and "days played" never falls. |
| 9 | Album tiles | **Earned by deeds only.** A finished page gives a garment. |
| 10 | The long road | **JOURNEY's fix:** a 10-stop season road on days played that waits, instead of a monthly road |
| 11 | Neighbours | **Five:** a baker, a teacher, a knitter, a beekeeper and a child. Names in the game's style, a warm and gently funny tone. One act, spread over levels 5–23 (JOURNEY's fix); act 2 written as rows now. |
| 12 | Mailbox, birthdays, portraits | **Yes.** Mailbox in the world; on birthdays they give; portraits from their own models. |
| 13 | Water at the festival's speed | **Yes** |
| 14 | First screen | **Hold back what does not matter yet; start facing the east beds** |
| 15 | Confetti | **Only for real rewards** |
| 16 | Settings | **"Less motion" and separate volumes; music that follows the time of day** |
| 17 | Readability | **Chips at 13–14 px, words at 15 px or more, 48 px touch targets** |
| 18 | The shell target | **160 KB** |
| 19 | Phase 0 first | **Yes** |
| 20 | Outside analytics | **No in v1.** Players' data stays on the device. The sim and `src/sim/journey.ts` measure the game instead. Adding it later needs the user's own yes and a key. |

## Missions 09–11 and the review

- **09, the house computer:**
  - It costs 500 coins and is sold in the furniture shop, with a price tag on the studio desk.
  - It has all three apps: Market, Planner and Sales book.
  - A gentle "market mood" of ±10 % a day, the same on every farm, shown a day ahead.
  - The names as proposed.
- **10, seasons and weather:**
  - A season lasts 7 days played and waits for you.
  - In-season crops give a quarter more.
  - Rain waters the beds for free; everything else is only looks.
  - Seasons start once the first steps end.
  - Rain and snow come through three.quarks and the existing fx pipeline, with the shader only as a fallback.
  - Winter trees keep their crowns, and there is no lightning.
- **11, the buildings:**
  - The farm's sun box grows at today's sharpness.
  - The supermarket and the estate office are made bigger as proposed.
  - The car park grows from upgrades already bought.
  - The car dealer is a new building that sells paints for your car, looks only.
- **JOURNEY:**
  - Every fix it ranks is taken.
  - At most two cards open by themselves on each visit.
  - The end of the first steps is spread over three visits.
  - A "Make room" press is added to 01.
  - Long crops pay in price.
  - One long clock, days played.
- **CONTRACTS:** each "[review]" choice as written.
- **Smaller choices inside a mission:** the mission's own recommendation.

## How the run goes

The orchestrator runs the plan to the end without asking:
- **Phase 0 starts now.** It needs none of the open plans.
- **Phases 1 to 3** start as `RUN.md` and `CHECKS.md` land, and each phase starts only when the gate before it is
  green.
- **A builder may fold in an improvement it finds** when it serves the goal and stays inside its files. It names
  the improvement in its report.
- **At the end:** an orderly review of the whole update, then a short report to the user.

## RUN.md's N1–N4 (taken 2026-11-18)

- **N1, the early lane: yes.** 07a, 06a and 11a start beside phase 0. 07b starts as soon as the things it waits for
  are in.
- **N2, the daily week: the season's week,** on days played. 8's welcome-back gift stays, and so does days played.
  An unclaimed day's prize joins the next claim.
- **N3, a lab board for 09: no.** It is built in the game's own look (CLAUDE.md: designers only when the user asks).
- **N4, the busy card:** as CONTRACTS has it, a top slot. It shows only when no card is up, and it never counts
  toward `VISIT_MOST`.
- **The heavy lock** (RUN.md §0) lives in the session's scratchpad:
  `/tmp/claude-0/-home-user-3D-Home-Web/c164316d-9885-5f35-97a5-084ad876b169/scratchpad/locks/heavy-<slot % 2>.lock`.

## Taken during the run

- **The shell's step 1 limit is 280 KB, not 250 KB** (`SHELL_BYTES`, `vite.config.ts`). 08b measured the shell at
  247 KB with the game's interface out of it, leaving 2.6 KB: every phase-2 merge that adds state code would fail the
  build. The farm's state leaves the shell in 08c's step 2, which brings the limit to 160 KB (decision 18).
- **32-machine-queue failed twice on one CI run and passed on the next with the same code.** It is a flake to make
  robust (07b, which moves the machine panel), not a reason to revert.
- **01a starts before phase 1's last three agents (07b, 06b, 11b) finish.** Its waits (04a's drain and
  `ORDERS.first`, 05a) are merged and CI is green; it is the root most of phase 2 waits on (its PACE, its orders, its
  crops), and it touches none of 07b's, 06b's or 11b's files.
- **11a's payer accepted:** `src/lib/batch.ts` (`sunAsOne`), its test and one line of `src/scene/House.tsx`'s
  `StaticBatch`, outside 11a's row and owned by no agent, pay for the bigger farm sun box (the phone sizes reached 250
  sun draws without them). The farm's sun map is byte for byte the same with them; 16 and 27 stay equal.
- **Phase 2 agents start as their waits merge** (RUN.md §1's rule within a phase), not all at phase 1's end: 10b and
  08c (waits 10a/11a and 08b/11a, all in) start beside phase 1's last three, with CI green on the tip.
- **01a's seven files outside its row accepted:** each was forced by a type or a test on the new crops (`Plants.tsx`'s
  layout rows, `season.ts`'s season per crop, the goods' weights, two computer view tests, the 24 h away test) or asked
  for (`setCalendarStep` in `core.ts`, 09a's request).
- **The long game runs fast after 01a:** the daily player reaches level 43–45 by day 14 (JOURNEY expected about 29).
  01b tunes the waves' numbers toward JOURNEY's day-14 level, with fruit trees in the sim's `forSale`; P3-play holds it.
- **08c's six files outside its row accepted:** `pass.ts` (2 lines: the far eye the furniture copies share with the
  crowds), `IntroPages.tsx` (the lazy tab), `GameLayer.tsx` (`SavesList` back to its panel, 08b's ask), `measure.ts`
  (11a's ask), `Loading.tsx` and `burst.ts` (what reaches 160 KB). The shell is 160 KB (decision 18), measured 156.7 KB.
- **Decision 11's fallback taken (10b, measured):** three.quarks' rain took 4.3 ms a frame at a 4× CPU throttle (bound:
  1 ms) at Medium's 2,000 drops, so rain and snow are fixed seeds moved by their own shader (`weatherFx` in
  `src/fx/quarks.ts`, about 0 ms a frame). Drops per tier: `profile.weather`.
- **11b's five files outside its row accepted:** `sunBox.ts`, `lotPlan.ts` and three tests, for the
  `FARM_SUN_BOX_PLANNED` alias 11a asked it to drop and the planned office now being the built row.
- **The run's pace changed (the user, 2026-11-19):** too many agents at once only waited for the two test slots. The
  eight running finish; the next stage runs at most four at once, in dependency order.
- **07b's two files outside its row accepted:** `PanelSheet.tsx` (`onLeave`, an optional `pic`, `.farm-backdrop` out of
  `above()`) and `ConfirmCard.tsx` (its time through `span()`, P0-split's ask). The 32 flake is fixed in `drag.ts`.
- **02b's six files outside its row accepted:** the daily and news cards' own CSS (their bodies), the garment line in
  `state/rewards.ts` (02a's ask), and three tests updated for gift garments, boxes at levels 3 and 7 and the *Album*
  line. `ONE_AT = 3` (one box a level from level 3) because PACE.income and JOURNEY.full failed below it.
- **01b's 21 files outside its row accepted:** each forced by a type or test on the new machines, herds and fields, or
  asked for (06b's collect sound, 01a's pace hooks, the hive in the album). The farm's sun pass is 223 draws (claim +3,
  measured +7: three Meadow beds' frames in the box); the sideways yard view is 249.4k of 250k.
- **Open for the next stage: the long game's pace.** The sim's daily player reaches level 32 on day 7, 50 on day 14 and
  85 on day 30 (JOURNEY expects 20, 29, 44). Content cannot slow it; the level curve past 30 (`LEVELS`, `xp.ts`) or
  JOURNEY's table must change. `quietDays` stays a debt until then.
- **04b's one line in `src/scene/Player.tsx` accepted:** the intro hard-coded the living room's heading, so
  `FARM_START`'s heading and pitch could not reach the first frame otherwise. `PACE.first` and the journey's `pull`
  stay debts: the real-pace player's steps end at level 5, before the new last step, and a sunflower is exactly an hour.
- **01b broke five core e2e specs; CI on 692123f was red** (it was merged on a green `npm run check` and its own
  specs only). Fixed in the tests where 01b's new things changed what they stand on (the busy farm fills the dairy and
  the kettle; the shop sells 25 kinds; 13's pasture and 33's bed clear of the staked North beds and the dairy) and in
  the game where the check was right: the crock and the bubble trimmed to their families' loudness, the manager's goods
  are `GoodPic`s (39's goodpic debt for the manager paid, not raised). The dashboard's chips (`.farm-chip-item`) are
  chips to 39's words check: "Only 11 XP!" is the user-chosen top (D) and a chip's count.
- **The welcome back is told once it has been on the screen, however it goes** (`AwayWatcher`): closed by the store or
  replaced by another panel (its *Go there* to the goals), it no longer comes back for the same time away.
- **The sales book keeps only the two weeks up to the device's today** after every sale (03b found a save from long
  ago keeping a day outside them through the shop's sales while away).
- **03b merged by hand** onto 04b's ranked welcome back: the letters are a row (`letters:n`, worth an order each).
