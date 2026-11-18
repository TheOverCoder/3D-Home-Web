# What keeps players for months in farm and casual management games

Research for the 3D HOME polish round (November 2026), read through search excerpts only: deconstructoroffun.com,
pocketgamer.biz and mobilegamer.biz could not be fetched here, and the GDC videos were not watched. *(secondary)* marks
a third party's summary or a fan wiki, not the studio.

## Benchmarks

| Measure | Figure | Source |
|---|---|---|
| D1 / D7 / D28, median mobile game (Q1 2024) | 22.9 % / 4.2 % / 0.85 % | [GameAnalytics Q1 2024](https://gameanalytics.com/reports/mobile-games-benchmarks-q1-2024), [summary](https://gamedevreports.substack.com/p/gameanalytics-benchmarks-in-mobile) |
| D1, top 25 % of games (2024) | 26.5–27.7 % (28–29 % in 2023); 75 % of games under 3 % at D28 | [GameAnalytics 2025](https://www.gameanalytics.com/reports/2025-mobile-gaming-benchmarks), [summary](https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks) |
| Minimum D1-D7-D30 for a free game to succeed | 30-15-8 (Eric Seufert) | [PocketGamer.biz](https://www.pocketgamer.biz/feature/46723/grey-areas-eric-seufert-explains-the-three-pillars-of-free-to-play-economics/) |
| First session | mean 9 min; longer than 9 min → 31 % D1, shorter → 20 % (deltaDNA, 275 games) | [Game Developer](https://www.gamedeveloper.com/business/how-first-session-length-impacts-game-performance) |
| Narrative and decoration meta | Homescapes D1 68 %; Wildscapes, which dropped the story meta, 38 % *(secondary)* | [Game World Observer](https://gameworldobserver.com/2019/08/19/new-playrix-game) |
| Casual session | 5–10 min, 2–4+ sessions a day *(secondary, definitions vary)* | [AppFollow](https://appfollow.io/blog/mobile-game-kpis), [Playio](https://blog.playio.co/dau-by-game-genre-mobile-games-2026) |
| Push opt-in | month-1 retention 55 % (opted in) against 29 % (not), all apps; a correlation, games weaker | [Airship](https://www.airship.com/?p=2600), [Flaregames](https://medium.com/flaregames-blog/encouraging-mobile-gamers-to-opt-in-for-push-notifications-3dde706bc8c7) |
| Scale | FarmVille peak 83.8 M MAU / 34.5 M DAU (2010); Township 600 M installs, 5 M DAU, > $2 B; Stardew 41 M copies (Dec 2024); ACNH ~48 M | [Wikipedia](https://en.wikipedia.org/wiki/FarmVille), [PG.biz](https://www.pocketgamer.biz/playrix-celebrates-10-years-of-township-and-major-2-billion-revenue/), [PG.biz](https://www.pocketgamer.biz/stardew-valley-sells-over-41-million-copies), [Statista](https://statista.com/statistics/1112631/animal-crossing-new-horizons-sales) |

A game that keeps 3 % at day 28 is in the top quarter. The first session moves D1; D7 to D30 need a reason to come
back tomorrow that is not a chore.

## 1. Patterns

### P1. A short, logical production chain as the core loop (Keep and deepen: Medium)
- **What:** grow, feed and collect, process in machines, sell. Every good feeds a next step, so a harvest is never
  the end of anything.
- **Who:** Hay Day. Supercell wanted it "extremely logical" and gave it no missions or quests; its product lead credits
  retention to "the fact that we don't teach our players to play Hay Day" ([Wikipedia](https://en.wikipedia.org/wiki/Hay_Day),
  [DoF 2013](https://www.deconstructoroffun.com/blog//2013/01/behind-success-of-hay-day.html)). Its economy came from a
  few parameters, such as how many coins each atom of the economy produces, not handmade rules (Tahkokallio,
  [GDC 2018](https://www.gdcvault.com/play/1024934/Design-in-Depth-at-Supercell),
  [podcast](https://podscripts.co/podcasts/think-like-a-game-designer/touko-tahkokallio-curiosity-physics-and-the-power-of-mental-playtesting-94)).
  Township grows into many factories that feed each other *(fan guides)* ([LootBar](https://lootbar.gg/blog/en/township-factory-guide.html)).
- **Evidence:** Hay Day's engagement "was crazy from day one" ([Supercell](https://supercell.com/en/about-us/)). In 2025
  it showed its monthly players turning back up after a long decline ([PG.biz](https://www.pocketgamer.biz/supercell-reveals-rise-in-hay-day-active-users-with-growth-virality-12-years-on/)).
- **3D HOME:** the chain is there (crops → mill → oven, wool → loom). After level 10 it stops growing. Add one or two
  `MACHINES` rows with recipes that draw on goods already made: a dairy (milk → butter, cheese) and a jam kettle (fruit
  from the bushes and trees). Make animal feed a `RECIPES` row that doubles a `PRODUCERS` row's output for a while. It
  must never gate output: Hay Day's feed is a gate, and a gate here would bring back the chore.

### P2. Sessions of 3–10 minutes that end by setting the next appointment (High)
- **What:** a session collects what is ready, starts long jobs, and stops. The game asks the player back at a time
  that fits a day: after lunch, in the evening, the next morning.
- **Who:** Hay Day's timers run from wheat's 2 minutes to hours (pumpkin: 3 h at level 15 *(secondary, old guide)*,
  [GameSkinny](https://www.gameskinny.com/?p=12798)). In casual games the appointments refresh within 24 hours
  ([GameRefinery](https://www.gamerefinery.com/keep-your-players-in-game-with-appointment-mechanics/)).
- **Evidence:** casual sessions last 5–10 minutes, several times a day (table above). The first session, by contrast,
  does best at 10–20 minutes (deltaDNA).
- **3D HOME:** every timer is short. Crops take 45–200 s (`CROPS`), machine jobs 4–40 s, and producers fill in 30–60 s
  (`PRODUCERS.every`). Time away counts for at most 3 h (`AWAY_MOST`, `state.ts`). So something is always ready within a
  minute: good for the first session, but a session never comes to an end, and a night away is mostly lost. Change:
  (a) add a long tier to `CROPS` and to the recipes (20 min, 1 h, 4 h, 8 h), paying more per press but less per minute,
  so that the last thing done before leaving is to start one; (b) raise `AWAY_MOST` to 24 h; (c) let `PRODUCERS.max`
  grow with the herd ladders, so a cow holds more than 3 milk overnight. Tune it with `npm run sim` and extend `PACE`
  (`src/sim/targets.ts`) with "the first session ends having set up a timer of 1 h or more".

### P3. Appointments that reward a return and never punish an absence (Keep; one fix: High)
- **What:** nothing rots, dies or leaves while you are away. Coming back is a pleasure, not a repair.
- **Who:** FarmVille's crops withered; designers on GDC panels called the mechanic "not fun", one that makes people play
  out of shame, and FrontierVille added wither protection ([Adrian Crook](https://adriancrook.com/should-farmvilles-famous-wither-mechanic-be-left-to-rot/)).
  Hay Day dropped it: "the crops never die" ([Supercell](https://supercell.com/en/games/hayday)). One analysis calls
  punishment poor as "your primary return driver" ([Gamerboom/Newstead](https://gamerboom.com/?p=69848)). Kevin Oke
  argues for bonuses on returning over threats, and says daily login bonuses buy a few sessions but are no real
  retention ([PG.biz](https://www.pocketgamer.biz/how-f2p-designers-should-balance-wither-and-daily-rewards)).
- **3D HOME:** right already. Nothing is lost, buyers wait, orders have no time limit, and storage keeps what does not
  fit. One leak: water lasts 55 % of a crop's growth (`WATER_SHARE`), so before sprinklers (level 4) a bed planted on the
  way out stops halfway. With the long crops of P2, a long crop needs one watering only, or `WATER_SHARE` 1 above 10 min.

### P4. What waits on return: mail, news and something new (Medium)
- **What:** a return opens with a short, warm digest. Letters and gifts from characters make it feel like the world
  went on without you.
- **Who:** Animal Crossing runs on the real clock, so "each visit can feel like a new step forward"; Nogami: "players
  can play little by little each day … you start to invest emotionally" ([Nintendo Everything](https://nintendoeverything.com/animal-crossing-new-horizons-devs-on-the-decision-to-start-on-an-island-new-features-multiplayer-more/),
  [GamesRadar](https://www.gamesradar.com/animal-crossing-new-horizons-developers-think-playing-without-time-travels-best-in-the-long-run/)).
  Stardew's villagers send gifts in the mail ([wiki](https://stardewvalleywiki.com/Friendship)). GameRefinery finds
  that tasks for a returning player hold attention longer than a one-time gift ([GameRefinery](https://gamerefinery.com/four-ways-how-mobile-games-re-engage-lapsed-players)).
- **3D HOME:** the welcome-back card (`AwayPanel.tsx`) and the daily gift are good. Add a mailbox by the gate, with
  letters from the neighbours of P8, the weekly rating of P10 and gifts. After 3 or more days away, add a comeback
  gift with 3 short tasks. True scheduled push needs a server, which a static Pages site lacks. Show instead, as the
  page hides, "next ready: cakes 18:40, pumpkins tomorrow 08:10", with the app badge for an installed PWA. (Low.)

### P5. Order boards and buyers: several channels, each with its own reward (High)
- **What:** fast small requests for coins, a board of medium orders for XP and materials, and a big periodic shipment
  that pays something coins cannot buy.
- **Who:** Hay Day: the truck board goes from 1 order to 9 at level 32, and a discarded order is replaced after
  6–30 min *(secondary)* ([SuperCheats](https://www.supercheats.com/hay-day/walkthrough/delivery-truck)). The boat is
  big, timed and helped by neighbours; town visitors are characters. Township's train brings barn-expansion tools, the
  plane premium currency, and the helicopter only coins, so players rank the channels by what they pay *(fan
  consensus)* ([LootBar](https://lootbar.gg/blog/en/township-helicopter-orders-guide-how-to-fulfill-orders-quickly.html)).
- **Evidence:** a board with choice and a fillable order at all times is the "something to do" on every return. A
  channel that pays only coins becomes optional.
- **3D HOME:** the gate's line (5 → 15) and the office's board (3 → 9, `ORDERS` in `data.ts`) mirror Hay Day's sizes.
  Each order asks 1–9 kinds of good and pays only 25 % over the fair price. Change: (a) size orders by level, and always
  keep one quick order of 1–2 kinds that the stock can fill now; (b) a weekly big shipment (a train or a lorry: 4–6
  crates, filled over days, no penalty if late), whose prize is from its own table (a decoration kind, a garment,
  materials). That makes it the mid-term goal between the daily gift and the levels.

### P6. Economy and pacing: something new at every level, and coins with a goal (High)
- **What:** a steady drip of unlocks well past the first hour, prices that rise with income, and big sinks in view
  early that make saving feel purposeful.
- **Who:** Hay Day keeps opening things late: the roadside shop at 7, the event board at 9, fishing at 27, the ninth
  order at 32 *(secondary)* ([GameSkinny](https://www.gameskinny.com/tips/hay-day-guide-the-levelling-system/),
  [PocketGamer](https://www.pocketgamer.com/hay-day/hay-day-all-the-ways-to-get-free-diamonds)). Animal Crossing's
  home loan has no interest and no deadline, and paying it opens the next expansion ([Nookipedia](https://nookipedia.com/wiki/Loan)):
  a sink with a picture of the goal. Sudden rises in difficulty are among the reasons players leave
  ([GameAnalytics](https://www.gameanalytics.com/blog/16-reasons-players-leaving-game)).
- **3D HOME:** `UNLOCKS` opens something at every level from 2 to 13, then stops. Levels 14–500 bring coins, gift
  boxes and a garment every fifth level. That is a grind wall waiting in the second week. Change: rows to level 40 or
  more (new crops, the dairy and jam of P1, more `PRODUCERS` kinds, land, house rooms, decoration sets), one every 1–2
  levels and then every 3; extend `PACE` to level 30 in the sim. Make the house (4000) and the market (1500) visible
  goals from the start: a savings line on the level card and a "for sale" sign seen from the farm.

### P7. Storage tension that never blocks (Medium)
- **What:** storage limits make choices, but a full barn must never stall play.
- **Who:** Hay Day's most repeated complaint is the full barn and silo blocking production and orders
  ([Sikayetvar](https://www.sikayetvar.com/en/hay-day-us/hay-day-storage-problem-makes-progress-impossible),
  [Kimola review report](https://kimola.com/reports/discover-hay-days-player-insights-a-comprehensive-feedback-report-google-play-en-155415)).
- **3D HOME:** better than Hay Day: nothing is lost, and full is a status. Add a "make room" action in `StorePanel`:
  sell the largest surplus to the manager, or put it into an open order. In the sim, check that materials (from
  `ITEM_ODDS` and the contractor) keep pace with silo and barn levels past level 20.

### P8. Named neighbours as non-player characters (High)
- **What:** a handful of recurring characters with names, tastes, a friendship that grows, birthdays and letters. It
  is the social layer that works with no other players.
- **Who:** Eguchi built Animal Crossing around communication with the villagers ([Shmuplations](https://shmuplations.com/animalcrossing/)).
  Stardew: 250 points a heart and 10 hearts, a loved gift +80, a birthday gift ×8; hearts bring cut-scenes and mail
  ([wiki](https://stardewvalleywiki.com/Friendship)). Hay Day has its town visitors and Greg; its 2025 Gordon Ramsay
  collaboration stood in for Greg for ten days ([Supercell](https://supercell.com/en/news/hayday-gordonramsay/)).
- **Evidence:** Playrix's Wildscapes dropped the story and characters, with 38 % D1 against Homescapes' 68 %
  *(secondary)*. Animal Crossing New Horizons was widely criticised for villagers that repeat themselves, and players
  drifted away ([TechRadar](https://techradar.com/features/as-much-as-i-love-it-animal-crossing-new-horizons-is-a-dead-end-now)).
- **3D HOME:** buyers are rolled strangers (`rollLook`). The manager, contractor and agent have jobs but no
  relationship. Add a `NEIGHBOURS` table of 5–6 regulars, each with a fixed look (`rollLook` overrides), two liked
  goods, a birthday on the device's calendar, and a friendship level that rises with each sale and gift. They join the
  gate's line (`Visitors.tsx`) and speak through `src/talk`, with lines unlocked by friendship so they do not repeat.
  A level sends a letter (P4) with a gift or a recipe.

### P9. Collections and albums (High)
- **What:** sets to complete, found in play, with a reward per page. It is a long goal that ordinary play feeds.
- **Who:** FarmVille's collectibles rolled on each harvest (12 common, 8 uncommon, 4 rare), were traded in for coins,
  XP and a prize, and levelled up *(fan wiki)* ([SuperCheats](https://www.supercheats.com/guides/farmville/collections)).
  Stardew's Community Center asks for 30 bundles in 6 rooms, each room restoring a part of the town
  ([wiki](https://www.stardewvalleywiki.com/bundles)). Animal Crossing has its museum.
- **Evidence:** collection mechanics appear in 72 % of the top-100 US grossing games, up from 21 % in 2017; GameRefinery
  ties them to retention ([GameRefinery](https://www.gamerefinery.com/attracting-and-retaining-players-with-collection-systems/)).
- **3D HOME:** the goals board (`GOALS`) counts; nothing is collected. Add `src/farm/album.ts` with pages: crops at
  their best (a rare "prize" crop, Stardew's quality stars), the cows' three coats, the hens' four colours, the sheep's
  four faces, every cake, every scarecrow and tree. Stickers roll on the farm's dice where surprises already roll
  (`ITEM_ODDS`), and duplicates trade for materials. A finished page gives something only the album gives (a garment,
  a decoration kind). A Stardew-style restoration (a ruined greenhouse rebuilt by donating goods) can come later.

### P10. Decoration as self-expression, with an audience (Medium)
- **What:** freedom to arrange and paint, plus someone who notices.
- **Who:** Animal Crossing sits in Quantic Foundry's "Design" motivation ([reference](https://quanticfoundry.com/wp-content/uploads/2019/03/Gamer-Motivation-Model-Reference-Updated.pdf)).
  Homescapes players' top motivations are escapism, expression and mastery *(GameRefinery via
  [Udonis](https://www.blog.udonis.co/mobile-marketing/mobile-games/homescapes-analysis))*. Animal Crossing's Happy
  Home Academy sends a weekly letter with the home's rank and one design hint ([Screen Rant](https://screenrant.com/animal-crossing-new-horizons-happy-home-academy-ranking/)).
- **3D HOME:** strong. It has the decoration shop, the house's shell, paint, floors, scarecrows and the wardrobe. It
  lacks feedback. Add a weekly letter (P4) rating the house and the farm, with one kind hint and a small prize at each
  new rank. Have the neighbours of P8 remark on a new piece near the gate. Score variety and sets, never count alone, so
  that no layout is "correct".

### P11. Social play without real-time multiplayer: visits and gifts (Low–Medium)
- **What:** see other people's places, and give.
- **Who:** FarmVille let a visit to a neighbour's farm do 5 actions a day, and gifts went back and forth
  ([Wikipedia](https://en.wikipedia.org/wiki/FarmVille)). Animal Crossing's Dream Suite visits an uploaded snapshot of
  an island while its owner is offline; nothing can change ([Nintendo](https://en-americas-support.nintendo.com/app/answers/detail/a_id/50094/)).
  Hay Day's neighbourhoods were "a place to talk and perhaps do some trading" until the Derby (2015) gave them shared
  weekly tasks ([GamesBeat](https://gamesbeat.com/after-a-decade-supercells-1st-hit-hay-day-keeps-humming-along/)).
  Player trading lifts engagement ([PG.biz](https://www.pocketgamer.biz/player-to-player-economies-why-mobile-needs-to-do-it-and-how-hay-day-did-it-badly)),
  but Supercell left it out of Everdale because it broke Hay Day's economy ([DoF](https://deconstructoroffun.com/blog/2021/8/29/everdale-by-supercell)).
- **3D HOME:** with no server, a Dream-Suite visit is still possible: load a friend's save file (`SavesPanel` already
  exports and checks them) into a view-only slot and walk their farm and house. A postcard (the photo button plus the
  farm's numbers) shares it. No trading between players.

### P12. Live operations without money: events, seasons, a free pass (Medium–High)
- **What:** a rhythm on top of the daily one. Each week has its event days, each month a theme and a free reward
  road, and the year has its seasons.
- **Who:** about 66 % of the casual games in GameRefinery's tracker have a pass, usually monthly
  ([GameRefinery](https://www.gamerefinery.com/battle-pass-trend-mobile-games/)); Hay Day sells a Farm Pass
  ([App Store](https://apps.apple.com/gb/app/hay-day/id506627515)), in monthly seasons *(secondary)*. Township's events work because they are "always
  novel" and "not constantly ongoing" ([DoF](https://www.deconstructoroffun.com/blog/2020/10/13/how-playrix-township-became-a-billion-dollar-game)).
  Animal Crossing ties events to the real calendar's holidays ([Wikipedia](https://en.wikipedia.org/wiki/Animal_Crossing)),
  and its events drew criticism once they were mostly repeats.
- **Evidence (the risk):** "burnout is essentially design failure": daily chores, endless events and FOMO are the
  warning signs, and liveops should not be a content treadmill ([Mobile Mavens](https://www.pocketgamer.biz/burnout-is-essentially-design-failure-the-mobile-mavens-weigh-in-on-player-burnout/)).
- **3D HOME:** the weekly `EVENTS`, the lucky draw and the daily gift are the right base. Add a `SEASONS` row per month:
  a theme, a free road of about 30 steps fed by the XP already earned (no new chores), and a themed decoration set and
  a garment. What is missed comes back next year or later in the shop. Add real-calendar festivals: the pumpkin in
  autumn, lights in winter, blossom in spring. They change decoration and light only (`DAY`, `setSculptGlow`), never the
  numbers.

### P13. Cozy: safety, abundance, softness, routine (Keep)
- **What:** no threat, nothing scarce or pressing, gentle looks and sound, and a routine the player owns.
- **Who:** Project Horseshoe's report on coziness: safety (no threats, time pressure or harsh penalties), abundance
  ("nothing is lacking, pressing or imminent") and softness ([report](https://pixelpoppers.com/link/d64e95/group-report-coziness-in-games-an-exploration-of-safety-softness-and-satisfied-needs),
  [Kitfox](https://medium.com/kitfox-games/designing-for-coziness-d33d2519a59e)). Stardew's relaxed pace: players feel
  "invigorated … rather than burnt out", though Barone accepts the "chore simulator" criticism
  ([NPR](https://www.npr.org/2025/01/24/g-s1-44510/the-legacy-and-future-of-the-farming-game-stardew-valley)). Hay
  Day's 2025 campaign sells it as a calm place.
- **3D HOME:** right. Keep the daily must-do under 5 minutes, and never add a second daily streak.

### P14. Why players quit: grind walls, punishing timers, clutter (Keep as a rule: High)
- **Evidence:** a disappointing first session loses 60–80 % of players for good ([Game Developer](https://gamedeveloper.com/business/why-do-players-leave-your-game-top-5-reasons-revealed)).
  Frustration and boredom lead the list ([GameAnalytics](https://www.gameanalytics.com/blog/16-reasons-players-leaving-game)).
  Withering shamed players. Storage walls blocked them (P7). Villagers repeated themselves (P8). Over years of updates,
  interfaces swell with buttons, pop-ups and badges ([Donut Lab](https://medium.com/donut-lab/on-the-razors-edge-how-to-make-a-mobile-game-interface-6f2e4c60e9d2)).
- **3D HOME:** keep an attention budget. A return shows one card at a time in a fixed queue (welcome back, then the
  daily gift, then level and unlock cards, then mail). Everything new goes into the corner menu, not onto the top of
  the screen. Badges stay on the two menu corners only. The sim's `PACE` is held at every level band added in P6.

## 2. What 3D HOME already does well, and the gaps

**Already well done** (often better than the genre):
- No punishment: nothing withers or is lost, a full store keeps what does not fit, and buyers and orders wait.
- A first hour held to measured pace bands (`PACE`, `npm run sim`): an unlock at every level from 2 to 13, first steps
  with a farmer guide.
- A welcome-back card that walks you to what is ready; a forgiving daily gift; weekly events and a lucky draw on the
  real calendar.
- Little friction: one button does every like thing in reach, and the compass walks you there.
- Deep self-expression: farm decoration, the house's shell, paint, floors, furniture, and a garment every fifth level.
- Hay Day-sized channels (5–15 buyers, 3–9 orders); XP only for what cannot be undone for free.
- A strict interface (three top views, one corner menu, panel rules) and a soft presentation (films, voices, music).

**Gaps compared with these games:** (1) no long timers, and time away counts for at most 3 h (P2); (2) unlocks end at
level 13 of 500 (P6); (3) no named characters, since buyers are strangers (P8); (4) no collection, since goals only
count (P9); (5) no mid-term goal between a day and a level, neither a big shipment (P5) nor a monthly road (P12);
(6) no mail (P4); (7) decoration has no audience (P10); (8) the chain stops at the oven (P1); (9) no seasons of the
year (P12); (10) no way to see another farm (P11); (11) without sprinklers, a bed planted before leaving stops halfway
(P3).

## 3. Top 10 changes for 3D HOME, ranked

1. **Long timers and real time away.** A long tier in `CROPS` and the recipes (20 min – 8 h), `PRODUCERS.max` growing
   with the herd, `AWAY_MOST` 3 h → 24 h, and one watering for long crops. Add a `PACE` rule that the first session
   ends by setting a timer of 1 h or more.
2. **Unlocks to level 40 and beyond.** `UNLOCKS` rows every 1–3 levels (crops, machines, animals, land, house rooms,
   decoration sets); extend `PACE` to level 30; show the house and market prices as savings goals on the level card.
3. **Named neighbours.** A `NEIGHBOURS` table of 5–6 regulars with liked goods, birthdays, friendship levels and
   `src/talk` lines unlocked by friendship; they join the gate's line and send letters.
4. **A farm album.** `album.ts` pages (coats, colours, prize crops, cakes, scarecrows, trees). Stickers roll where
   surprises roll; a finished page gives a reward only the album gives.
5. **A weekly big shipment.** A new orders channel of 4–6 crates filled over days with no deadline, paying from its
   own prize table (decoration, garments, materials).
6. **A free monthly season road and real-calendar festivals.** `SEASONS` rows fed by XP already earned, a themed set
   and garment, nothing lost for good; seasonal looks only.
7. **A mailbox.** Letters on return from neighbours, the weekly rating and the comeback gift. On leaving, a "next
   ready" line and the PWA badge.
8. **Feedback on decoration.** A weekly letter rating the house and the farm (variety and sets) with one hint and a
   small prize per rank; neighbours remark on new pieces.
9. **Orders that always fit.** Order size by level, one quick order always fillable from stock, and "make room" in
   the store panel (sell the largest surplus or put it into an order).
10. **Visit a friend's farm.** A view-only slot loaded from a friend's save file (Dream-Suite style), and a postcard
    from the photo button.

**Not to do:** withering or any loss while away; trading between players (it broke Hay Day's economy); energy limits;
limited-time items gone for good; event icons on the top of the screen; a second daily streak.
