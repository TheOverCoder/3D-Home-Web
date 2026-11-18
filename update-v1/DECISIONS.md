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
