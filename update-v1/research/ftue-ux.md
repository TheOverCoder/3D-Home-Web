# What makes a mobile game easy to pick up: research for 3D HOME's polish round

What this covers: a new player's first session (the first 30 s, 5 min and day) and a returning player's return. Method:
web research (2026-11-18), then the first ~9 minutes of a new farm played on a local build at 390×844, touch, dpr 1,
with no debug hooks, so the farmer's steps, locks and events were all on. Screenshots are in
`/tmp/claude-0/-home-user-3D-Home-Web/c164316d-9885-5f35-97a5-084ad876b169/scratchpad/ftue/` (named `NN-*.png` below).
**Sources:** WebFetch could not reach any page: DNS failed for `gamedevreports.substack.com` and `www.nngroup.com`.
All evidence here comes from search excerpts. Where a number comes from a secondary write-up rather than the
original, it is marked *(secondary)*.

## 1. Principles

Each principle has its evidence, why it works, what to change in 3D HOME, and a priority (P0 = fix before anything
else, P3 = later).

### 1.1 Time to fun: a reward in 30 s, the core loop within 5 min, a reason to come back by day 1 (P0)
- **Evidence.**
  - Median mobile D1 retention is about 22%, D7 about 4% and D30 under 1%. The top 10% of games reach about 40% D1
    *(secondary)*: GameAnalytics 2025, https://investgame.net/wp-content/uploads/2025/02/2025-GameAnalytics-Mobile-Gaming-Benchmarks.pdf.
  - Google Play: the worst apps lose 46% of new installs by minute 5 and 58% by minute 10. Top games lose 17% and 24%
    *(secondary)*. The link between first-day minutes and next-day return is steepest in the first ten minutes:
    https://medium.com/googleplaydev/why-the-first-ten-minutes-is-crucial-if-you-want-to-keep-players-coming-back-to-your-mobile-game-4a89031b6308,
    https://medium.com/googleplaydev/the-user-journey-onboarding-and-activation-be5ebdfc0354.
  - 57% of Android users uninstall a game on the day they install it: https://www.pocketgamer.biz/android-games-struggle-to-retain-players-states-pushwoosh-report.
  - Apple WWDC17 "Design Tips for Great Games" cites a game with only two screens before play. It also advises against
    asking for choices before players understand them: https://developer.apple.com/videos/play/wwdc2017/811.
  - The "first hour" is when players weigh their expectations against what they meet. Intrigue counts as much as
    fun: https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/First20Hour20-20CHIPlay20201420-20preprint2.pdf.
- **Why it works.** Players leave mostly before the game has shown them its loop. Each minute spent before the first
  reward costs players at the steepest part of the curve.
- **3D HOME.** The way in is already short: one big *New farm* button, then the farmer about 3 s after the tap (`10`).
  A player who taps the farmer can plant within about 15 s and harvest, sell and shear within minutes. What breaks the
  path is two dead ends (§2, steps 3 and 8) and a busy first frame (§1.5). Fix those before anything else. Do not
  add more cinematic intro.

### 1.2 Teach by doing, at the moment it is needed, and let players skip (P1)
- **Evidence.**
  - Andersen et al., CHI 2012, with over 45,000 players: tutorials added up to 29% play time only in the most complex
    of three games, and had a negligible effect in the simpler two. Help given just in time added 16% play time and
    40% progress in the complex game: https://grail.cs.washington.edu/projects/game-abtesting/chi2012/.
  - Apple: players learn better by discovering mechanics in context, and a written tutorial works best as a reference,
    not a requirement. Apple also suggests context-specific tips over one onboarding flow:
    https://developer.apple.com/design/human-interface-guidelines/designing-for-games,
    https://developer.apple.com/design/human-interface-guidelines/onboarding.
  - Nielsen Norman Group (NN/g), 70 users: people who skipped a deck-of-cards tutorial did slightly better than
    people who read it (94% vs 91% task success): https://www.nngroup.com/articles/mobile-tutorials/.
  - Roblox lists three techniques: visual elements in the world (a trail to follow), just-in-time contextual
    tutorials, and timed hints: https://create.roblox.com/docs/production/game-design/onboarding-techniques.
  - Teaching everything at once overloads working memory (Hodent):
    https://ixdf.org/literature/article/design-for-working-memory-players-will-remember-what-matters.
- **Why it works.** An action done once is remembered better than one read about. A hint given at the moment of need
  has nothing competing with it in working memory.
- **3D HOME.** The farmer's eight steps are already teaching by doing, and they can be skipped (✕ asks, then *Skip*).
  Keep that. Two parts tell instead of show:
  - The controls line (`src/ui/Hud.tsx` `FirstHint`: "Walk with the stick · drag anywhere to look · the round button
    does what is near you") is 13 px, lasts 7 s, and appears over the farmer's first bubble (`04`). Replace it with
    hints given in context: a pulse on the stick until the player first moves, and a small "drag to look" hand until
    the player first drags. Each disappears once done, and the record is saved (`hintShown` lives in memory today, so
    the line comes back on every visit, `51`).
  - *How to play* on the start menu is a good reference. Keep it, and do not make it a step.

### 1.3 One clear next action, signified in the world (P0)
- **Evidence.**
  - Norman: designers should provide signifiers, the perceivable cues to an action. On screens it is the signifiers
    that matter: https://jnd.org/signifiers-not-affordances/.
  - Hodent's "signs and feedback" pillar: signs invite the action, and feedback confirms it:
    https://www.creativebloq.com/features/how-neuroscience-and-ux-impacts-video-game-design.
  - Apple prefers animation to heavy-handed devices for drawing attention: https://developer.apple.com/videos/play/wwdc2017/811.
  - Roblox's directional trail: https://create.roblox.com/docs/production/game-design/onboarding-techniques.
  - A tutorial funnel loses players at single steps, so track each step and fix the worst one first:
    https://www.devtodev.com/resources/articles/how-to-optimize-your-game-tutorial,
    https://gameanalytics.com/blog/tips-for-a-great-first-time-user-experience-ftue-in-f2p-games.
- **Why it works.** A "what do I do now?" moment with no answer is where players leave. A hint that points nowhere is
  worse than no hint: it teaches the player not to trust the hints.
- **3D HOME.**
  - **(a) No dead ends.** A step whose target does not exist must show a line the player can act on. Today it shows a
    sigh (§2, steps 3 and 8).
  - **(b) Show the target in the world.** Put the step's target in the world from the first second: the walk marker
    that appears over the thing during a walk, shown while the step is on.
  - **(c) Make the bubble look tappable.** The bubble works as a "take me there" button, but nothing says so until it
    is tapped. Show the walker glyph (`PersonSimpleWalk`) on it from the start.
  - **(d) Face the first task.** A new farm opens facing south at two staked-out "NEW BED" plots, which are for sale.
    The beds you can plant are cut off at the bottom corners (`05`). Turn `FARM_START` (`src/data/maps.ts`) towards an
    empty built bed.

### 1.4 Feedback for every action, and status always visible (P1)
- **Evidence.**
  - Nielsen's response-time limits: within 0.1 s an action feels instant, at 1 s the player keeps their flow, and past
    10 s they need progress:
    https://www.nngroup.com/videos/3-response-time-limits-interaction-design/,
    https://nngroup.com/articles/progress-indicators.
  - The "juice" talk (Jonasson and Purho, 2012) layered flash, shake, particles and sound onto the same rules, and the
    game felt far better *(secondary)*: https://roblog.co.uk/2024/03/juicy-games/.
- **Why it works.** Feedback confirms the action and teaches it. When a confirmation cannot be read, it fails at both.
- **3D HOME.** Feedback is rich: toasts, coins flying, crystals, the step's tick, haptics (`15`, `20`, `28`).
  Three collisions spoil it:
  - The "+5 eggs" and "+4 lettuces" toasts land on the farmer's bubble for about 1 s (`20`, `28`).
  - The sale toast's words are hidden under the flying coins and the brick ("+ 9 coi… 1 b… Surprise: 1 brick", `33`).
  - A step marked done shows its line half typed ("Ripe! Harvest your cr", `28`).

  Keep the toast and steps slots apart in `TopStack`, launch flying goods from beside the toast's text rather than
  over it, and stamp a done step on its full line.

### 1.5 Cognitive load: show only what this minute needs, and open the rest with levels (P1)
- **Evidence.**
  - Working memory holds about 4 chunks: Cowan,
    https://www.cambridge.org/core/services/aop-cambridge-core/content/view/44023F1147D4A1D44BDC0AD226838496/S0140525X01003922a.pdf/magical_number_4_in_shortterm_memory_a_reconsideration_of_mental_storage_capacity.pdf,
    and Nielsen, https://jakobnielsenphd.substack.com/p/cognitive-load.
  - Progressive disclosure means deferring secondary options so that primary ones stand out:
    https://www.nngroup.com/videos/progressive-disclosure/.
  - Google Play recommends "telegraphing" other features rather than teaching them up front:
    https://medium.com/googleplaydev/the-user-journey-onboarding-and-activation-be5ebdfc0354.
- **Why it works.** Each badge or glow is a claim on attention. When five things glow, none of them is "the next
  thing".
- **3D HOME.**
  - The first frame has about 15 things on it, 10 of them buttons: coins, the level road, silo, barn, goals, menu,
    compass with a mark, clock, the farmer's bubble and its ✕, three stick tools, the stick and jump (`10`).
  - The menu carries a "1" from the first second: the farm news, because today is Wednesday's festival.
  - By about 3 min there are also the level chip's gift glow (2 gifts), the goals badge, the line chip and three or
    four compass marks, all beside the farmer (`27`, `53`).
  - The daily gift already waits for the first steps (`state.ts`). Make the news badge, the level gifts' glow, the
    goals badge and the beds' gear wait the same way, or have the farmer introduce each one when it first appears.
  - While a step is on, ring the compass mark of its target and dim the others. On step 2 the only mark in view was
    "4 fleeces" while the farmer asked for eggs (`17`).
  - The *Plant seeds* panel shows 2 open crops and 6 locked ones (`14`). Fold the locked crops into one short row
    ("More at levels 2–10"), so the choice is between two.

### 1.6 Touch in 3D: little camera work, one thumb where possible, and tap-to-go (P2)
- **Evidence.**
  - Apple: a thumbstick should appear where the thumb lands, the camera should pan by direct touch, and a control can
    stay hidden until needed: https://developer.apple.com/design/human-interface-guidelines/game-controls.
  - Apple, WWDC26: keep controls always visible and inside the safe areas: https://developer.apple.com/videos/play/wwdc2026/358.
  - Hoober: 49% of people hold a phone in one hand, and thumbs do about 75% of interactions *(secondary)*:
    https://alistapart.com/article/how-we-hold-our-gadgets,
    https://smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users.
  - Stardew Valley on mobile defaults to tap-to-move. The joystick was added later for players who disliked tapping:
    https://wiki.stardewvalley.net/Mobile_Controls,
    https://toucharcade.com/2018/11/01/stardew-valley-mobile-controls-update/.
  - Sky: reviews single out fighting the camera as the main complaint: https://www.destructoid.com/review-sky-children-of-the-light/.
- **Why it works.** Steering a 3D camera with two thumbs is the most expensive skill a casual player has to learn.
  Tap-to-go removes it from the core loop.
- **3D HOME.**
  - Already strong: the stick comes to the thumb, walk-to arrived in 3–10 s every time (`13`, `19`, `31`, `37`),
    the view turns to the target on arrival, and the action button sits under the right thumb.
  - Make tap-to-go the taught path. The farmer's first line should be "Tap me, I'll take you", so that one thumb plays
    the whole first loop; the stick and drag-to-look are learnt later, on demand (§1.2).
  - Consider letting a tap on a world object (a bed, the nest) walk there, as the compass marks do.

### 1.7 Returning players: where am I, what changed, what next (P1)
- **Evidence.**
  - Returning players need to re-orient fast; a generic home screen loses them *(vendor guides)*:
    https://bugnet.io/blog/how-to-design-a-games-onboarding-for-returning-players,
    https://gamerefinery.com/four-ways-how-mobile-games-re-engage-lapsed-players.
  - A forgiving daily gift: Unity's model keeps a missed day's reward for the next day:
    https://docs.unity.com/en-us/services/solutions/daily-rewards.
  - A counterpoint: daily logins can teach players that the game is something to check rather than play:
    https://rowatcher.com/news/reward-schedules-in-roblox-why-daily-login-bonuses-backfire.
- **Why it works.** A summary answers "what changed". The next goal answers "why stay". Without the second, players
  check in and leave.
- **3D HOME.**
  - The start menu already shows the farm with "3 min away" and pictures of what waits (`50`). The welcome-back card
    lists the changes in pictures (`52`). Both are good.
  - Missing: the next goal. *Go there* walks to the nearest thing that is ready, not to the farmer's step or the goal
    nearest done. Add one line, "Next: send an order" (the step, else the goal nearest done), and point *Go there* at it.
  - The player comes back at `FARM_START`, not where they left (`52`): consistent, so the card must carry the orientation.
  - Do not show the controls line again (§1.2). The daily gift's rules (one day forgiven, a week of seven) match the evidence: keep them.

### 1.8 Readability at phone size: text of 15 px or more, icons with a word, one word for one thing (P2)
- **Evidence.**
  - Text size is the most common complaint about game accessibility (Game Accessibility Guidelines):
    https://gameaccessibilityguidelines.com/?p=21. Xbox's guidelines set minimum text sizes by screen density:
    https://devdocs.xbox.com/gaming/accessibility/xbox-accessibility-guidelines/101.
  - NN/g: nearly all icons are ambiguous without a visible label: https://www.nngroup.com/articles/icon-usability/.
  - Consistency is one of Nielsen's heuristics and one of Hodent's pillars (same Creative Bloq source as §1.3).
- **Why it works.** At arm's length a 13 px line read over a moving 3D scene is skipped. The same thing called by two
  names makes players think there are two things.
- **3D HOME.** The interface follows these rules almost everywhere: the button carries its verb, chips have counts,
  and text is 15 px or more. The exceptions:
  - The controls line is 13 px and white on a 50% wash.
  - Settings closes with *Back to the house* on a farm that owns no house yet (`SettingsPanel.tsx:261`).
  - The start menu shows a developer line to players: "Phone · graphics auto · placeholders: house, character" (`02`).
  - Two buyers in one line had the same name, Yoni, and *Sell to all · 9* served one of the two (`32`).
  - A new farm starts at 08:10 on a 20-minute day, so night falls about 12 minutes into the first session. At phone
    size the yard becomes dark and hazy (`52`, `59`), the opposite of "clear at every moment".

### 1.9 Prevent errors, make recovery cheap, and confirm only where it costs (P2)
- **Evidence.**
  - NN/g: confirmations work only when they are rare ("cry wolf" too often and they stop being read); undo is better
    for reversible actions: https://www.nngroup.com/articles/confirmation-dialog/.
  - Touch targets: at least 1 cm (NN/g, https://www.nngroup.com/articles/touch-target-size/), 44 pt on iOS, 48 dp on
    Android (https://support.google.com/accessibility/android/answer/7101858).
- **Why it works.** Confirmations that are rare get read. Undo keeps play fast without making mistakes final.
- **3D HOME.** The rules already fit the evidence: spending asks first through a price tag and an armed *Build*;
  the button never spends; a second press closes a machine's card; decorating has undo. Keep it so.
  - The ✕ on the farmer's bubble asks before skipping, which is right. Also let players bring the tips back from
    settings, as Apple advises for a skipped tutorial.
  - Small targets are 44 px, which meets Apple's 44 pt but not Android's 48 dp. Give the stick tools and the step's ✕
    hit areas of 48 px, keeping their 44 px look.

## 2. Walk-through: a new farm's first minutes at 390×844, with no debug hooks

Times are the game's clock (one hour = 50 s); my pauses between taps inflate them. Each walk itself took 3–10 s.

| # | Moment | What happened | Friction |
|---|---|---|---|
| 0 | Start menu (`02`, `03`) | One big *New farm*, five tiles, *How to play* in 5 rows | Developer footer line; otherwise clean |
| 1 | In the game, 2.8 s after the tap (`04`, `05`) | Confetti, the farmer's "Let's plant some seeds! +10", the controls line over it, menu badge "1" | About 15 things on screen; the view faces the NEW BED plots that are for sale; the plantable beds are cut off at the bottom corners; nothing marks the target in the world |
| 2 | Bubble tapped (`13`) | Walked to the bed in 6.5 s; *Plant* button, the "Plant seeds" prompt, a gear on the bed | Nothing on the bubble said it walks you; the gear competes with *Plant* |
| 3 | Seed panel (`14`) | 2 crops open, 6 locked with level ribbons | Two thirds of the panel is locked |
| 4 | Lettuce planted (`15`–`17`) | Tick, +10 coins, next line "Ooh, eggs!", the line chip appears | The compass's only mark is fleeces while the farmer asks for eggs |
| 5 | Eggs (`19`–`21`) | Walk 7.5 s, collect ×5; toast, crystals, +5 | The toast covers the bubble for about 1 s |
| 6 | **"Now water your seedlings"** (`24`, `25`) | Tap → no walk, the farmer sighs, again and again | **Dead end.** Today is Wednesday's harvest festival: `grow()` (`src/farm/state.ts:2238`) speeds growth ×2 but drains water in real time. Seeds get 55% of the grow time in water (`WATER_SHARE`), so the lettuce ripens without ever going dry. The step's target `{bed: ['thirsty','growing']}` is empty, and its line stays until a harvest. I found the ripe bed only through the compass's "+3" (`27`) |
| 7 | Harvest (`28`) | Water and harvest steps pass together; +4 lettuces; next line "Psst… sell at the gate" | The done stamp shows a line never read ("Ripe! Harvest your cr") |
| 8 | By about 3–5 min (`27`, `53`) | Level chip "2 gifts", goals "1", news "1", line "2–5", 3–4 compass marks | Five things glow beside the farmer, none of them explained |
| 9 | Sell (`32`, `33`) | The buyers' panel opened from the button; *Sell to all · 9* | Two buyers both named Yoni; "all" served 1 of 2; the toast text is hidden under the coins |
| 10 | Shear, weave (`37`–`44`) | Walks 4–10 s; the loom panel says "Drag a recipe up here, or tap it"; the job takes 6 s | "Weave cloth at the loom?" stays after weaving until *Take*; the line should change to "Take your cloth" |
| 11 | **"Last one: send an order!"** (`46`, `47`) | Walked to the office; all three orders "None in store yet" (they ask for milk and lemons) | **Stall.** Milk and lemons were never steps; *Show me* is hidden behind a tap on a good's picture; the farmer says nothing more |
| 12 | Return after 167 s (`50`–`53`) | Start menu: "3 min away" with what waits; the welcome-back card (Fleeces 1, In line 1); then the farmer's step | Back at `FARM_START`; the controls line shown again; the card names no next goal; at 20:50 the yard is dark |
| 13 | Settings by Esc (`57` text) | Settings close with *Back to the house* | A wrong word on the farm |

Keep: the one-button start, tap-to-walk, pictures on the button and prompt, rewards flying to their chip, the level card's look ahead (`54`), confirmations only on spending.

## 3. Top 10 for 3D HOME, ranked

1. **A step can never be a dead end (P0).** In `firstSteps.ts`/`FirstSteps.tsx`: when `stepTarget()` is null and the
   step's `done` is implied by the next step, show the next line ("Ripe already! Harvest it"). Give *water* a fallback
   to `ripe` beds. Add a unit test with `eventSpeed('crops') = 2` that passes the steps from plant to harvest. Also
   check the water drain against the festival speed in `grow()`, so the festival does not skip watering by accident.
2. **Make the last step doable from what the steps produced (P0).** The farm's first order asks for what steps 1–7
   leave in store (eggs, lettuce, cloth). Or split the step: "Collect milk" (target `{good:'milk'}`), then "Put it in
   and send". Show *Show me* on each missing good without a tap on its picture.
3. **Show the step's target in the world, and make the bubble look tappable (P1).** Keep the walk marker over the
   target while the step is on. Put the walker glyph on the bubble from the start. Turn `FARM_START` towards an empty
   built bed, not the plots for sale.
4. **Quiet the first minutes (P1).** Like the daily gift, hold the news badge, the level gifts' glow, the goals badge
   and the beds' gear until the steps are over, or introduce each with a farmer beat. Ring the current step's compass
   mark and dim the others.
5. **Lines that follow the state (P1).** Steps whose action has two parts change their line midway (weave → "Take
   your cloth"; order → "Put in, then Send"). The done stamp shows the full line.
6. **Welcome back with a next goal (P1).** The card adds one "Next" row (the farmer's step, else the goal nearest done)
   and *Go there* walks to it. Show the controls line only until the stick and a drag-to-look have been used once, and
   save that record (`hintShown` lives in memory today).
7. **Feedback that can be read (P2).** Keep the toast and steps slots apart in `TopStack`. Launch flying coins and
   goods off the toast's text. Check at 0.6 s and 0.9 s after a harvest, a sale and a surprise.
8. **Fewer choices in the first panels (P2).** Fold the seed panel's 6 locked crops into one row of "coming at level
   N" chips, and mark the 45 s lettuce as the quick one.
9. **Copy and consistency (P2).** Settings' *Back to the house* → *Done*. Hide the developer footer from players.
   Never give two buyers in one line the same name. Label *Sell to all* by what it does ("Sell to 1 · 9"). Raise the
   controls line to the 15 px minimum (or replace it, §1.2). Make 48 px hit areas on Android.
10. **Daylight for the first session (P3).** Keep a new farm's first 15–20 minutes in day (a longer first morning, or
    a floor on the night's ambient light) so the yard reads at phone size. Judge it by a screenshot at 390×844, as
    `CLAUDE.md` asks.
