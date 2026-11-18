# Why players come back: the psychology, and what it means for 3D HOME

Research for the polish round (November 2026). Goal: a game people *want* to come back to, never one that makes them
feel they *have* to. There is no real money in 3D HOME, so the risk to watch is not spending but time and pressure.

**Evidence strength** used below: **Strong** = meta-analyses or several large experiments; **Moderate** = peer-reviewed
experiments, field studies or large correlational surveys; **Weak** = one small study, company data, designer essays.

**Already right in 3D HOME (keep it):** one missed day is forgiven and a claimed gift is never taken back
(`src/farm/daily.ts`); nothing withers or is thrown away (dry beds pause, full stores leave goods where they are); time
away runs on and the welcome-back card tells what waits; decorating is free, undoable and gives no XP; characters talk
rarely (`src/talk/rules.ts`); random gifts are always wins; no real money anywhere.

---

## 1. Principles

### 1.1 Self-determination: autonomy, competence, relatedness
- **Principle:** players return to games that make them feel free, capable and connected; enjoyment follows need satisfaction, not hours.
- **Evidence (Moderate–Strong, mostly correlational):** Ryan, Rigby & Przybylski 2006, four studies: in-game autonomy and competence predicted enjoyment, preference and well-being change; all three needs predicted future play ([doi:10.1007/s11031-006-9051-8](https://doi.org/10.1007/s11031-006-9051-8)); this became the PENS measure ([SDT site](https://selfdeterminationtheory.org/player-experience-of-needs-satisfaction-pens/)). Przybylski, Rigby & Ryan 2010 model of engagement ([doi:10.1037/a0019440](https://doi.org/10.1037/a0019440)). Przybylski et al. 2009 (n = 1,324): low need satisfaction went with *obsessive* passion, more hours, tension after play; high satisfaction with *harmonious* passion and energy after play ([doi:10.1089/cpb.2009.0083](https://doi.org/10.1089/cpb.2009.0083)). Johannes, Vuorre & Przybylski 2021 (Animal Crossing telemetry): need satisfaction related to well-being independently of time played ([doi:10.1098/rsos.202049](https://doi.org/10.1098/rsos.202049)). Ballou et al. 2024 (BANGS, 5 studies, n = 1,246): need *frustration* is its own harm, not just low satisfaction ([doi:10.1016/j.ijhcs.2024.103289](https://doi.org/10.1016/j.ijhcs.2024.103289)). Relatedness in single-player games can come from characters (Tyack & Wyeth 2017, OzCHI; [dblp](https://dblp.uni-trier.de/rec/conf/ozchi/TyackW17.html); Weak).
- **Why it works:** need-satisfying play is chosen for itself, so it lasts and leaves people better off; pressure produces play that is compulsive and joyless.
- **3D HOME:** *Autonomy* is strong (what to grow, where things stand, outfits, skins, skippable first steps): keep every goal optional. *Competence*: one press does every like thing, clear counts, machine levels; keep failure-free. *Relatedness* is the gap (no multiplayer): make the people of the farm feel like neighbours (see 1.12 and Top 10 #7).
- **Priority:** High.

### 1.2 Flow and the challenge curve
- **Principle:** enjoyment peaks when the task asks a little of you and you can see how you are doing; in casual games, choice and novelty matter more than difficulty.
- **Evidence (Moderate):** Csikszentmihalyi, *Flow* (1990). GameFlow, eight elements incl. clear goals and feedback (Sweetser & Wyeth 2005, [doi:10.1145/1077246.1077253](https://doi.org/10.1145/1077246.1077253)). Meta-analysis of 28 studies: challenge–skill balance relates moderately to flow (r ≈ .48), less when measured separately (Fong, Zaleski & Leach 2015, [doi:10.1080/17439760.2014.967799](https://doi.org/10.1080/17439760.2014.967799)). Close chess games are enjoyed most (Abuhamdeh & Csikszentmihalyi 2012, [doi:10.1177/0146167211427147](https://doi.org/10.1177/0146167211427147)). Counterpoint, >20,000 sessions of a casual game: assigned *easy* levels kept people playing longest; moderate difficulty won only when players chose it; moderate novelty beat too little or too much (Lomas et al. 2017, CHI, [doi:10.1145/3025453.3025638](https://doi.org/10.1145/3025453.3025638)).
- **Why it works:** a goal within reach plus fast feedback absorbs attention; boredom and anxiety both break it.
- **3D HOME:** the challenge here is juggling (queues, storage, orders), not reflexes. Keep the default easy; let the player *opt in* to stretch (a "big order" beside normal ones, Top 10 #10). Keep novelty moderate and steady through `UNLOCKS`, checked against `npm run sim` (`PACE`).
- **Priority:** Medium.

### 1.3 Goal-gradient effect
- **Principle:** effort speeds up as a reward gets close.
- **Evidence (Moderate–Strong, field data):** coffee-card buyers bought ~20 % more often as the free coffee neared; song raters visited more and rated more near their reward; faster accelerators were retained better (Kivetz, Urminsky & Zheng 2006, [doi:10.1509/jmkr.43.1.39](https://doi.org/10.1509/jmkr.43.1.39); [full text](https://business.columbia.edu/sites/default/files-efs/pubfiles/1200/goalgradient.pdf)).
- **Why it works:** each step is a bigger share of what is left, so it feels worth more.
- **3D HOME:** the level bar's four gift boxes are already good sub-goals. Always show the *nearest* reward and how little is left in its own unit ("2 more cakes", "40 XP to a gift"), with an "almost there" look in the last 10–20 % (bar, medal ring, daily road, an order nearly full). 500 levels each longer than the last: check in the sim that some reward (box, medal, unlock) still comes every few minutes of play at level 50 and 200, not only early.
- **Priority:** High.

### 1.4 Endowed progress
- **Principle:** a goal that starts partly done is finished more often, even when the work left is the same.
- **Evidence (Moderate):** car wash, 8 washes needed either way: a 10-stamp card with 2 stamps given was completed by 34 % vs 19 % for a blank 8-stamp card, and faster (Nunes & Drèze 2006, [doi:10.1086/500480](https://doi.org/10.1086/500480); figures via secondary summaries).
- **Why it works:** people see themselves as already on the way, and the goal-gradient starts sooner.
- **3D HOME:** the goals board already counts cumulative totals, so the next medal (30 → 60) starts half full: keep showing it that way (`goalsView.ts`, `part`). In the first steps, credit one real action at once (stepping out onto the farm) so the row starts at 1 of N. Never fake it: only credit what the player really did.
- **Priority:** Medium.

### 1.5 Open loops (Zeigarnik / Ovsiankina)
- **Principle:** an interrupted task pulls people back to finish it; better *memory* for unfinished tasks is not reliable.
- **Evidence (Moderate for resuming, Weak for memory):** 2025 meta-analysis: recall of interrupted vs completed tasks about equal (ratio ≈ 0.99), but people resumed interrupted tasks about two times in three (Ghibellini & Meier 2025, [doi:10.1057/s41599-025-05000-w](https://doi.org/10.1057/s41599-025-05000-w)).
- **Why it works:** an unfinished goal stays active until closed.
- **3D HOME:** machine queues, growing beds, half-filled orders and the tractor's trip are honest open loops. Make them visible *as you leave*: a short "All set" glance (what finishes when, Top 10 #2). Do not invent loops that nag (red badges that never clear).
- **Priority:** High.

### 1.6 Variable rewards
- **Principle:** uncertain rewards raise effort and delight; the same mechanism drives gambling, so use it only as a free bonus on top of a dependable core.
- **Evidence:** *Mechanism (Strong in animals):* dopamine neurons code reward probability and ramp most at maximal uncertainty (Fiorillo, Tobler & Schultz 2003, [doi:10.1126/science.1077349](https://doi.org/10.1126/science.1077349)); variable-ratio schedules give steady, extinction-resistant responding (Ferster & Skinner 1957; for games Hopson 2001, [Game Developer](https://www.gamedeveloper.com/design/behavioral-game-design)). *Humans (Moderate):* people work harder for a 50/50 reward than a sure, larger one (Shen, Fishbach & Hsee 2015, [doi:10.1086/679418](https://doi.org/10.1086/679418)); uncertainty prolongs a good mood (Wilson et al. 2005, [doi:10.1037/0022-3514.88.1.5](https://doi.org/10.1037/0022-3514.88.1.5)).
- **Limits:** curiosity about an uncertain outcome draws people even to outcomes they know are bad (Hsee & Ruan 2016, [doi:10.1177/0956797616631733](https://doi.org/10.1177/0956797616631733)); near-misses feel worse yet raise the urge to play (Clark et al. 2009, [doi:10.1016/j.neuron.2008.12.031](https://doi.org/10.1016/j.neuron.2008.12.031)); Skinner-schedule claims rest on pigeons and say nothing about well-being. *Loot boxes (Moderate, correlational, paid boxes):* spending on loot boxes is linked to problem gambling (n = 7,422; η² = .054 vs .004 for other purchases; Zendle & Cairns 2018, [doi:10.1371/journal.pone.0206767](https://doi.org/10.1371/journal.pone.0206767)); 12 of 13 studies found the link, mean r ≈ .27, direction unclear (Spicer et al. 2022, [doi:10.1177/14614448211027175](https://doi.org/10.1177/14614448211027175)); near-miss displays and in-game currency may weakly strengthen it (Zendle et al. 2020, [White Rose](https://eprints.whiterose.ac.uk/148267)); "predatory monetization" (King & Delfabbro 2018, [doi:10.1111/add.14286](https://doi.org/10.1111/add.14286)); 20+ consumer groups call for limits (Norwegian Consumer Council 2022, [Insert Coin](https://www.forbrukerradet.no/siste-nytt/loot-boxes-how-the-gaming-industry-manipulates-and-exploits-consumers/)). Critics add that time can be overspent like money.
- **Why it works:** a surprise is a prediction error; the brain values the not-knowing itself.
- **3D HOME:** surprises (5 % per collection, one buyer in two), gift boxes and the lucky draw are free bonuses over deterministic income: keep it so. Every reveal is a win (no blanks). Show the odds in the game (they are written in the README, not on screen). The lucky draw's reels (`src/farm/news/LuckyReels.tsx`) must never stage a near-miss or offer a re-spin.
- **The line:** never sell a random reward for coins or anything earned by effort; no near-miss animation; no "spin again"; no hidden odds; randomness never decides the core income.
- **Priority:** High (as a guardrail; little to add).

### 1.7 Loss aversion and streaks
- **Principle:** an intact streak motivates; a broken one demotivates, so streaks must bend, not break.
- **Evidence:** *Loss aversion* (Kahneman & Tversky 1979, [doi:10.2307/1914185](https://doi.org/10.2307/1914185)) is real but more conditional than assumed (Gal & Rucker 2018, [doi:10.1002/jcpy.1047](https://doi.org/10.1002/jcpy.1047)). *Streaks (Moderate):* seven studies: a log showing an intact streak raised later engagement, a broken one lowered it, regardless of actual past behaviour; the drop was smaller when the streak could be repaired and larger when people blamed themselves (Silverman & Barasch 2023, [doi:10.1093/jcr/ucac029](https://doi.org/10.1093/jcr/ucac029)). *Forgiveness (Moderate–Strong):* in a 61,293-person megastudy of 54 interventions, the best one paid a small bonus for coming back after a missed workout (Milkman et al. 2021, [doi:10.1038/s41586-021-04128-4](https://doi.org/10.1038/s41586-021-04128-4)); missing one day did not harm habit formation (Lally et al. 2010, [doi:10.1002/ejsp.674](https://doi.org/10.1002/ejsp.674)). *Industry (Weak):* Duolingo reports +3.3 % day-14 retention from separating the daily goal from the streak, and that learners on a 7-day streak are 2.4× as likely to return the next day (correlational) ([blog](https://blog.duolingo.com/improving-the-streak/), via search; site blocked here); its team credits the Streak Freeze with retention gains ([Lenny's Newsletter](https://www.lennysnewsletter.com/p/behind-the-product-duolingo-streaks)). *Harm (Weak):* young people describe Snapstreaks as pressure; 42 % of 300 surveyed would remove them ([Bits of Freedom 2026](https://www.bitsoffreedom.nl/en/2026/03/10/the-influence-of-snapchats-gamification-features-on-young-people/)).
- **Why it works:** a streak becomes a goal of its own; losing it feels like failure, and failure feels like "why bother".
- **3D HOME:** `daily.ts` already forgives one day (`GRACE`). Two missed days still restart the week at day 1 and reset the flame ("A new week begins."): that is the broken-streak moment the evidence warns about. Let the week's road *wait* (count claims, not consecutive days), welcome the player back with a small bonus, and keep a number that never falls (days played). No coin-priced streak repair.
- **Priority:** High.

### 1.8 Habit formation: context cues, Fogg, the Hook
- **Principle:** habits are actions repeated in a stable context until the context alone starts them; make the action tiny and the context steady.
- **Evidence:** *Strong:* habits form by repeating a response in a stable context, after which the context cues it without a goal (Wood & Neal 2007, [doi:10.1037/0033-295X.114.4.843](https://doi.org/10.1037/0033-295X.114.4.843); Wood & Rünger 2016, [doi:10.1146/annurev-psych-122414-033417](https://doi.org/10.1146/annurev-psych-122414-033417)); automaticity took a median ~66 days, range 18–254 (Lally et al. 2010). Frequent social-media users keep posting even when the likes change (Anderson & Wood 2021, [doi:10.1002/arcp.1063](https://doi.org/10.1002/arcp.1063)). *Weak–Moderate:* Fogg's B = MAP (behaviour when motivation, ability and a prompt meet; make it easier before trying to motivate) is a design model with little direct testing ([doi:10.1145/1541948.1541999](https://doi.org/10.1145/1541948.1541999); [Stanford](https://behaviordesign.stanford.edu/resources/fogg-behavior-model)). *Weak:* Eyal's Hook (trigger → action → variable reward → investment, *Hooked*, 2014) is a practitioner framework without peer-reviewed tests; critics call it a manipulation recipe and note big products that skip variable rewards ([UXmatters review](https://www.uxmatters.com/mt/archives/2021/06/book-review-hooked-how-to-build-habit-forming-products.php)); Eyal's own test, the "manipulation matrix": would you use it yourself, and does it materially improve users' lives ([Nir and Far](https://www.nirandfar.com/tag/matrix)).
- **Why it works:** a cued routine costs no decision; reward matters while it forms, much less once formed.
- **3D HOME:** make the first 30 seconds of every visit the same small, satisfying round: welcome-back card → *Go there* → collect what is ready → refill queues → claim the gift. Ability is already high (batch presses, take-me-there). The prompt should be the player's own context (the home-screen icon, a coffee, a commute), not nagging. Investment (layout, decoration, machine levels, the house) is stored value: show it off.
- **Priority:** Medium–High.

### 1.9 Curiosity and the information gap
- **Principle:** a small, visible gap in what you know creates a pull to close it; it is strongest when you half-know.
- **Evidence (Moderate):** curiosity as a felt gap in knowledge (Loewenstein 1994, [doi:10.1037/0033-2909.116.1.75](https://doi.org/10.1037/0033-2909.116.1.75)); curiosity peaks at intermediate confidence, activates reward areas, and people spend scarce tokens and time to learn answers (Kang et al. 2009, [doi:10.1111/j.1467-9280.2009.02402.x](https://doi.org/10.1111/j.1467-9280.2009.02402.x)). Limit: the same pull works on harmful outcomes (Hsee & Ruan 2016).
- **Why it works:** an answer just out of reach is anticipated as a reward.
- **3D HOME:** good already: the daily road's peeking days, locked things with their level (`LockTag`), the next garment shown big. Add silhouettes of the next two levels' unlocks on the level card and in an album (1.10). Keep each gap small and soon closed.
- **Priority:** Medium.

### 1.10 Collection and completion
- **Principle:** people want to complete sets, and value what they built themselves.
- **Evidence:** people choose an item that completes a set even over a better one (Evers, Inbar & Zeelenberg 2014, [doi:10.1037/a0033343](https://doi.org/10.1037/a0033343); Moderate). "Completion" is a distinct player motivation in Yee's factor-analytic Gamer Motivation Model (>1 M surveys, not peer-reviewed; [Quantic Foundry](https://quanticfoundry.com/wp-content/uploads/2019/04/Gamer-Motivation-Model-Reference.pdf); Weak–Moderate). The IKEA effect: more value for what you assembled, only if finished (Norton, Mochon & Ariely 2012, [doi:10.1016/j.jcps.2011.08.002](https://doi.org/10.1016/j.jcps.2011.08.002); Moderate).
- **Why it works:** an incomplete set is a visible open loop; a finished one is a trophy of effort.
- **3D HOME:** a farm album: every good made, garment, scarecrow and decoration, tool skin and medal, as tiles that fill in, with silhouettes saying where each comes from. Show sets that exist already as sets ("2 of 3" scarecrow styles, skins a/b/c). Nothing in it may be time-limited, so completion is always possible.
- **Priority:** Medium.

### 1.11 Mastery, visible progress and "just one more"
- **Principle:** visible, early, frequent progress keeps people going; a session should end on a high at a natural stop.
- **Evidence (Moderate):** progress that looks slow early raises abandonment; fast early progress improves experience (Conrad et al. 2010, [doi:10.1016/j.intcom.2010.03.001](https://doi.org/10.1016/j.intcom.2010.03.001)). Small wins are the strongest day-to-day motivator in a 12,000-entry diary study (Amabile & Kramer 2011, [HBR](https://hbr.org/2011/05/the-power-of-small-wins)). Ends of play sessions shape how a casual game is remembered; effects on wanting to replay were mixed (Gutwin et al. 2016, [doi:10.1145/2858036.2858419](https://doi.org/10.1145/2858036.2858419)). Rich audiovisual feedback ("juice") is widely credited with engagement, though its measured effects are still thin (Hicks et al. 2019, [doi:10.1145/3311350.3347171](https://doi.org/10.1145/3311350.3347171); Weak). The unhealthy "one more" works by removing stopping cues; Alter recommends natural break points, like chapters (*Irresistible*, 2017; [review](https://paw.princeton.edu/article/adam-alter-09s-irresistible-exposes-addictive-nature-technology)).
- **Why it works:** progress feeds competence; a good ending is what memory keeps.
- **3D HOME:** XP crystals, coins flying and counts are good juice. Add the healthy version of "one more": a clean end state. When beds are planted and queues full, a short "All set" moment with a little celebration and what will be ready when (Top 10 #2). Never auto-chain prompts that remove the stopping point.
- **Priority:** High.

### 1.12 Appointments and return triggers: things waiting for you
- **Principle:** give a reason to return that is a gift, never a threat.
- **Evidence (Weak–Moderate):** "playing by appointment" and grinding are named dark patterns (Zagal, Björk & Lewis 2013, FDG, [Chalmers](https://research.chalmers.se/en/publication/177148); nuance in Deterding, Stenros & Montola 2020, [White Rose](https://eprints.whiterose.ac.uk/156460)). Withering is "the strongest appointment" because it punishes; Hay Day does without it (Pollock 2013, [Game Developer](https://www.gamedeveloper.com/design/beyond-wither-supercompensation-in-games)). Players leave games whose demands of time and commitment grow (Wiik 2023, *American Journal of Play* 15(1), [PDF](https://www.museumofplay.org/app/uploads/2023/05/AJP-15-1-Article-4-Commit.pdf)); ex-MMO players cite repetition and playing out of obligation ([Yee](https://nickyee.com/daedalus/archives/print/000342.php)). Temporal landmarks (a new week) start new efforts (Dai, Milkman & Riis 2014, [doi:10.1287/mnsc.2014.1901](https://doi.org/10.1287/mnsc.2014.1901); Moderate). Cosy games: safety, abundance, softness (Project Horseshoe 2017 group report, designers; Weak).
- **Why it works:** an appointment you can miss without loss is anticipation; one with a penalty is a chore.
- **3D HOME:** the farm already *accumulates* instead of decaying, and the contractor's and agent's hours are farm hours (minutes), not real ones. Keep events (`EVENTS`) as boosts that are an invitation, never exclusive loot, and say "this week" rather than "don't miss". Time away beyond the three-hour catch-up should read as the farm resting, never "you missed". If notifications are ever added: opt-in, informational ("3 cakes are ready"), at most one a day, never guilt.
- **Priority:** Medium (mostly guardrails).

### 1.13 Autonomy versus pressure; overjustification
- **Principle:** expected rewards for something already enjoyable, and controlling pressure, erode wanting to do it.
- **Evidence (Strong for the effect, Moderate in games):** 128 experiments: expected tangible rewards reduced free-choice intrinsic motivation (engagement-contingent d = −0.40, completion-contingent −0.36); informational praise raised it (Deci, Koestner & Ryan 1999, [doi:10.1037/0033-2909.125.6.627](https://doi.org/10.1037/0033-2909.125.6.627); disputed in size by Cameron & Pierce). Points, levels and leaderboards raised quantity of work, not intrinsic motivation (Mekler et al. 2017, [doi:10.1016/j.chb.2015.08.048](https://doi.org/10.1016/j.chb.2015.08.048)); a badge-and-leaderboard course lost motivation over 16 weeks (Hanus & Fox 2015, [doi:10.1016/j.compedu.2014.08.019](https://doi.org/10.1016/j.compedu.2014.08.019)). Obsessive "have to" play goes with lower well-being (Przybylski et al. 2009).
- **Why it works:** a reward or a demand reframes play as work done for someone else.
- **3D HOME:** keep decorating, dressing and walking the house reward-free (as now). Praise as information ("Your first cake!"), not control. No daily chore lists or expiring quests; the goals board never expires. The daily gift opens by itself once a day: keep it once, after everything else, one tap to close.
- **Priority:** High.

---

## 2. Do NOT do: the ethical line

Sources: Zagal et al. 2013 (above); Karlsen (*Transgression in Games and Play*, MIT Press 2018) on FarmVille 2 and others built to take more time than players meant to give ([PhilArchive](https://dc2.philarchive.org/rec/KAREOE-4)); the Dark Pattern Games database ([darkpattern.games](https://www.darkpattern.games/); temporal, monetary, social and psychological patterns, e.g. *Playing by Appointment*, *Daily Rewards* that penalise absence, *Infinite Treadmill*, *Fear of Missing Out*; read through a 2024 study of 1,496 games rated there, [arXiv 2412.05039](https://arxiv.org/abs/2412.05039), as the site was blocked here); Gray et al. 2018, *nagging* ([doi:10.1145/3173574.3174108](https://doi.org/10.1145/3173574.3174108)); Mathur et al. 2019, fake urgency and scarcity, confirmshaming ([doi:10.1145/3359183](https://doi.org/10.1145/3359183)); attention-capture patterns ([Monge Roffarello et al., CHI 2023](https://elite.polito.it/news/2023/05/04/chi-attention-capture)); Apple's rule 4.5.4: marketing pushes only with explicit opt-in ([guidelines](https://developer.apple.com/app-store/review/guidelines/)).

1. **Punishing a broken streak** (reset to zero, a broken flame, "you lost your 12-day streak", paying to restore it). Broken streaks lower later engagement, worst when people blame themselves (Silverman & Barasch 2023).
2. **Guilt and confirmshaming**: sad or pleading characters when the player skips or leaves, "Your cows miss you!", "Are you sure you want to give up?". Today the farmer pleads at "Skip the tips?" (`MOMENT_MOODS.ask = 'pleading'`, `src/farm/firstSteps.ts`): make it a friendly nod. Guilt is need frustration (Ballou et al. 2024).
3. **Decay while away**: withering crops, sick or sad animals, goods spoiling, a store that empties. It turns the game into an obligation (Pollock 2013; Wiik 2023).
4. **Fake scarcity and false urgency**: countdowns that restart, "only today" items that come back, "2 left", exclusive limited-time rewards that make missing a week a loss (Mathur et al. 2019; NCC 2022).
5. **Gambling shapes**: random boxes sold for coins, near-miss reels, re-spins, sounds and lights that celebrate a loss, hidden odds (Clark et al. 2009; Zendle et al. 2020; King & Delfabbro 2018). The player may be a child; do not teach the slot machine.
6. **No stopping point**: endless auto-chained prompts, "one more" with no clean end, a treadmill with nothing ever finished (Alter 2017). Time is the currency this game could overspend.
7. **Chores and grind walls**: daily quest lists, energy that must be waited out or spent, content gated by daily repetition (Zagal et al. 2013; Przybylski et al. 2009, obsessive play).
8. **Pop-up cascades and interruptions**: several modals on launch, offers that open by themselves (attention capture). One card at a time, in the order the game already keeps.
9. **Fake social pressure**: invented counts ("1,284 farmers claimed today"), neighbours who "are waiting for you".
10. **Paying for what is already fun**: XP or coins for decorating or dressing (overjustification, Deci et al. 1999).
11. **Nagging notifications**: any push that is not opt-in, not informational, or more than about one a day.

---

## 3. Top 10 for 3D HOME (ranked by value for effort)

1. **The daily week waits instead of resetting** (`src/farm/daily.ts`, `DailyCard.tsx`): after two missed days keep the road where it was (claims, not consecutive days, reach the big seventh gift), replace "A new week begins." with a welcome back and a small return bonus, and show days played (never falls) beside the flame. Evidence: Silverman & Barasch 2023; Milkman et al. 2021. **High.**
2. **An "All set" moment as a stopping point**: when every bed is planted and every queue full (or the corner menu opens), a short celebration and what will be ready when ("3 cakes at 14:20, carrots in 6 min"). A healthy end, a peak at the end, and an honest reason to return. Evidence: Ovsiankina (Ghibellini & Meier 2025), peak-end (Gutwin et al. 2016), Alter 2017. **High.**
3. **Always show the nearest reward and how little is left**: next gift box on the level bar, next medal, the order nearly full, with an "almost there" look in the last stretch; check in `npm run sim` that rewards keep coming every few minutes at high levels too. Evidence: Kivetz et al. 2006; Conrad et al. 2010. **High.**
4. **Pressure and guilt audit of every line and face**: the pleading farmer at the skip question, status words ("missing", "lost"), the news's wording for events. Evidence: Gray et al. 2018; Mathur et al. 2019; Ballou et al. 2024. **High, tiny.**
5. **Randomness guardrails, written down**: the odds on screen (a "?" on surprises, gift boxes, the draw), no near-miss or re-spin in `LuckyReels`, never a random box for coins, core income deterministic. Evidence: Clark et al. 2009; Zendle & Cairns 2018; Spicer et al. 2022. **High (prevents harm).**
6. **A short, stable "morning round"**: the first 30 s of each visit always the same satisfying loop (welcome back → *Go there* through what is ready → refill → gift), as quick as possible on a phone. Evidence: Wood & Neal 2007; Lally et al. 2010; Fogg 2009. **Medium–High.**
7. **Neighbours, not NPCs**: a few regular buyers whose looks are saved (`rollLook` traits) and who greet you, remember what you sold them and say thanks; the farmer marks real milestones (first cake, the house bought). Keep lines rare (`src/talk/rules.ts`). Evidence: Ryan et al. 2006; Tyack & Wyeth 2017. **Medium–High.**
8. **A farm album**: goods, garments, decorations, skins and medals as tiles with silhouettes and where each comes from; sets shown as sets; nothing time-limited. Evidence: Evers et al. 2014; Loewenstein 1994; Kang et al. 2009. **Medium.**
9. **Honest head starts**: the first steps begin with one real action already ticked; goal medals keep showing their cumulative fill (30/60, not 0/30); next unlocks shown as silhouettes on the level card. Evidence: Nunes & Drèze 2006; Kivetz et al. 2006. **Medium.**
10. **Challenge by choice**: beside the normal orders, an optional "big order" (more kinds, better pay, no timer) the player may take or leave; the default stays easy. Evidence: Lomas et al. 2017; Abuhamdeh & Csikszentmihalyi 2012. **Medium.**

---

*Not reachable from this session (DNS blocked): darkpattern.games, deceptive.design, arxiv.org, blog.duolingo.com,
making.duolingo.com, coglode.com. Their content above comes from search-result summaries and secondary sources; the
Nunes & Drèze percentages and the Duolingo figures were checked only that way.*
