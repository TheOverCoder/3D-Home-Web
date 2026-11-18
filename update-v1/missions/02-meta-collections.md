# Mission 02: what keeps a player for weeks (`02-meta-collections`)

**Goal:** give the farm a kind long game: a week that waits, goals and an album that fill, a free monthly road, and
decoration that is noticed, each one a table of rows on one engine.

**How a player will feel it:** "I was away three days, and my week waited, with a little welcome-back gift." "The
album says I'm two scarecrows from finishing the garden page." "This month's road gives a banner at stop 10, and I'm
nearly there." Nothing is lost by being away, nothing is sold, nothing is random that matters.

## Principles applied

- A streak that bends, not breaks; a bonus for coming back; a number that never falls: `psychology.md §1.7`, `§3 #1`.
- Odds on screen, every reveal a win, no near-miss, no paid randomness: `psychology.md §1.6`, `§2.5`, `§3 #5`.
- Invitations, not pressure: no "don't miss", no ticking loss: `psychology.md §1.12`, `§2.2`, `§2.4`, `§3 #4`.
- Show the nearest reward and how little is left; honest head starts: `psychology.md §1.3`, `§1.4`, `§3 #3`, `§3 #9`.
- Sets and an album, with silhouettes, nothing time-limited: `psychology.md §1.9`, `§1.10`, `§3 #8`; `farm-games.md P9`.
- A monthly rhythm with a clean end, fed by XP already earned (no chores): `farm-games.md P12`, `P13`; `psychology.md
  §1.11` (a stopping point), `§1.12` (temporal landmarks).
- Decoration as self-expression with an audience, never paid for: `farm-games.md P10`; `psychology.md §1.13`, `§2.10`.
- Attention budget: no new badges or top-of-screen items: `farm-games.md P14`; `ftue-ux.md §1.5`.
- Keep what is right: nothing withers, a claim is never taken back, decorating is free with no XP (`psychology.md`,
  "Already right").

## Foundation first

Exists: `Prize` and `give()` (gifts, daily, first steps, `state.ts`); `GOALS` with closure `measure`s (first steps reuse
them); `EVENTS` rows; `WEEK_GIFTS`; `DECOR` rows; `GARMENTS` built from rows; per-instance tints in `src/lib/sculpt/parts.ts`;
the house's `PAINTS` palette (`src/home/shell.ts`). Add only these, each needed by two uses now:

- **F1. `src/farm/prize.ts`**: `Prize`, `savedPrize`, `prizeWords` move here from `gifts.ts` (re-exported, no caller
  breaks). Two kinds join coins and goods: `{ decor: ShopKind; look?: string }` (into the farm's store, free to put down)
  and `{ garment: string }` (into the wardrobe). `give()` in `state.ts` stays the one door every prize goes through, and
  `sized(share, level)` the one coin size from the next level's coins (today written twice, in `dayCoins` and
  `boxCoins`). Uses: the season road and the album pages (also 03's neighbours, 05's reward tier).
- **F2. `src/farm/measure.ts`**: the farm's counts as data, not closures: `Count = { got: ProduceId[] | 'crops' |
  'materials' } | { stat } | { made: MachineId } | { herd: ProducerId } | { decor: ShopKind; look? } | { piece: kind } |
  { skin: [tool, style] } | { garment: id } | { level }`, and `countOf(f, c)`. Uses: `GOALS` (re-expressed, the same
  numbers) and the album's tiles; `goalById(id).measure` keeps working for the first steps.
- **F3. `src/farm/road.ts`**: a road of stops: `stops(n, at)`, `reached(have)`, `nearest(have)` → `{ stop, left, share,
  almost }` (`almost`: the last 15 %). The daily card's road drawing becomes a shared `Road` component. Uses: the daily
  week (seven stops, counted in claims) and the season road; `nearest` also for the goals and the album pages.
- **F4. `src/farm/calendar.ts`**: the pure date helpers in one place (`dayNumber`, `dayStart`, `dateKey`, new
  `monthKey`). Uses: daily, events, news, seasons. The clocks stay as they are (`setDailyClock`, `setEventClock`).
- **F5. A decoration piece's look**: `DecorPiece.look?: string` and `layout.storedLooks` (the looks of pieces put away,
  so putting away loses nothing); a `DECOR` row may list `tints` (ids of `PAINTS`). Uses: the season banner's colours
  and painted decoration. Drawn as instance colour: no new draw.

## Changes

1. **The week waits (daily gift).** Sees: missing days never restarts the week; the seventh gift comes on the seventh
   claim. Two or more days away: "Welcome back! Your week waited", plus a small extra gift. The flame's "in a row"
   becomes "Day 23 on the farm" (days played, never falls). Files: `daily.ts` (`dailyStatus`, `claimed`, `dailyView`:
   `kept`/`broke` → `back`; `GRACE` goes), `state.ts` (`claimDaily`, a `markPlayed()` on the first view each calendar
   day), `DailyCard.tsx` (the line, `Streak` → days played). Rows: `BACK_GIFT` (day 1's coins, `sized`; once a return,
   never growing with the absence, so playing daily always pays more). Save: `daily.streak` → `claims`, plus `days`,
   `seen`; `sanitizeDaily` converts (claims = streak, days = streak). Tests: `daily.test.ts` (a gap of 1, 2 and 30 days,
   the bonus once, the clock back, days never fall), `state.daily.test.ts`, `save.property.test.ts`; e2e `35-daily`
   updated (two missed days → the next day of the week, not Day 1). **M**, risk low: rules are pure, conversion tested.
2. **Odds on screen.** Sees: a "?" on the level's gift boxes, on the daily card and on the lucky draw, which opens what
   can come and how likely ("Coins 55 % · a building material 30 % · goods 15 %"; the draw: "two of the N goods a buyer
   asks for, each alike"); a surprise's toast says how likely it was ("1 in 20" for an egg). Files: `prize.ts` `oddsView(kind)` read from `GIFT_ODDS`,
   `ITEM_ODDS`, `WEEK_GIFTS`, `LUCKY_GOODS`; `LevelCard.tsx`, `DailyCard.tsx`, `NewsCard.tsx`. Tests: `oddsView` sums to
   1; e2e `22-xp` opens the boxes' "?". **S**, risk none.
3. **Kind words.** Sees: events say "Until midnight · back next Wednesday", not a ticking "5 h 12 min left"; the daily
   line never says "lost" or "missed out"; goals say "8 to go". Files: `news/view.ts` (`NowItem.left` → `back`),
   `DailyCard.tsx`, `goalsView.ts`. Tests: `view` unit test, e2e `34-events` text updated. **S**, risk none. (The
   farmer's pleading face is mission 04's.)
4. **Goals on rows, nearer.** Sees: an "almost there" look on a goal in its last 15 %; a new ladder, *Pick fruit* (the
   apple, orange, cherry and berry plants: today no goal counts them). Files: `goals.ts` (`measure` → `count: Count`),
   `goalsView.ts` (`almost`, `left`), `GoalsCard.tsx`; `nearestGoal(f)` exported for 04's welcome-back "Next" row. Fix:
   a goal row added later reads 0 on a save that has goals, paying past deeds again; `load()` starts a missing id at
   `startStep`. Tests: `goals.test.ts` (every row's numbers equal before and after, on `testSaves.ts`), `save.test.ts`
   (the missing-row case); e2e `21-goals` unchanged and green. **S**, risk low.
5. **Sets as sets.** Sees: the edit mode's shop groups kinds into sets with a count ("Harvest scarecrows 2/3"). Rows:
   `set` on `DECOR` rows (straw, harvest, ribbons; lights; paths; garden), `SETS` (name, art). Files: `decor.ts`,
   `DecorShop.tsx`. Tests: `decor.test.ts` (every kind in one set); e2e `33-farm-decor` adds the chip. **S**, risk none.
6. **The farm album.** Sees: "Album" in the corner menu (after the news). Pages: grown (8 crops, 6 fruit), the barn's
   goods (10, plus mission 01's new ones as rows), the herd (3 coats, 4 hen colours, 4 faces: by herd size), materials,
   scarecrows, the garden, fruit plants, the tools' skins, the house's furniture (once it is yours), seasons. A tile not
   yet earned is a silhouette with how to earn it ("Bake it in the oven", "Comes on December's road"). The cover counts
   the long ladders (garments 12/106, medals, days played) instead of pages that cannot end. A finished page gives, by
   itself and once, something only the album gives (a garment) with a toast: no badge, no tap to claim. Files: new
   `album.ts` (rows `ALBUM`: page, tile id, name, pic, `count`, `need`, `how`; engine: `albumView(f)`, `pagesDone`),
   `AlbumCard.tsx` (look, fed by the view: in the lab as it is), `AlbumPanel.tsx`, `state.ts` (`albumOn()`, read a frame later
   from `tick` as the first steps are; no XP), `HudMode.tsx`, `store.ts` (panel kind `album`), `outfit.ts` (`Garment.from`: level, album
   page, season month; `outfit.owned` for those not from a level). Save: `album: { seen, done }`, `outfit.owned`.
   Tests: `album.test.ts` (no tile time-limited: every `count` reachable by play; a page's garment once), `outfit.test.ts`,
   `save.property.test.ts`; e2e new `39-album` (opens, a page finished by play gives its garment once, upright and
   sideways, 44 px). **L**, risk medium: many rows, one engine; no 3D.
7. **The season road.** Sees: the farm news gets a "This month" tab: the month's name and picture, a road of 30 stops
   fed by the XP earned this month, its nearest stop and how far ("120 XP to the banner"). Stop 10 is the month's
   banner, stop 20 its garment, stop 30 a big gift; the others coins, the material the silo or the barn is shortest of,
   or the good the farm makes most. Each comes in by itself as it is reached (as a level's coins do, inside `gainXp`),
   with a toast. Past stop 30: "Road complete. December's opens on the 1st." A new month starts a fresh road. Rows:
   `SEASONS` (12 months: name, art, banner colours, garment), `ROAD` (30 stops, one table for every month). Engine:
   `seasons.ts` on `road.ts`; `perStop(level)` tuned with the sim; no dice. Files: `seasons.ts`, `news/view.ts`,
   `NewsCard.tsx`, `NewsPanel.tsx`, `state.ts` (`gainXp`, `sanitizeSeason`), `outfit.ts` (12 garment rows). Quiet in
   specs as the events are (`?debug` off unless `&season=on`, `ready()`). Save: `season: { month, xp, start, paid }`.
   Tests: `seasons.test.ts` (each stop once, a month change, the clock back, perStop), `state.season.test.ts`; `PACE`
   gains `season`; e2e new `40-season` (the tab, a stop given, upright and sideways). **L**, risk medium (pace).
8. **The season banner.** Sees: a pennant on a pole to stand anywhere on the farm, in the month's two colours, given
   by the road. One `banner` kind tinted by `look` (F5): one crowd, two parts. Files: `src/models/decor.ts`,
   `decorModels.ts`, `layout.ts` (`DECOR_FEET`), `decorScene.tsx` (`SOLID`), `decor.ts` (a row not for sale), gallery,
   checks, item art. Tests: `layoutDecor.test.ts` (looks kept when put away), `decor.test.ts`; e2e `33-farm-decor` (placed,
   reloaded), `05` at the fullest farm (banner under 300 triangles). **M**, risk: budget, measured.
9. **Paint the decoration.** Sees: on a picked bench, planter, fence, lamp, birdbath or well, a *Paint* chip
   with the house's colours; free, undo, no XP. Files: tint masks in those models (`src/models/decor.ts`), `EditPanel.tsx`,
   `state.ts` (`paintDecor`). Rows: `tints` on six `DECOR` rows. Tests: `layoutDecor.test.ts`; e2e `33-farm-decor`; `27`
   unchanged. **M**, risk low (no new draws; picture check at phone size).
10. **The farm's charm, in the news.** Sees: a column "Charm: ★★★ Charming · a lamp along the path would add to it",
    and a toast when a new rank is first reached. Words only: no coins, no XP (overjustification). Scored on variety and
    sets, each row capped, never count alone. Rows: `CHARM` (variety of kinds, sets complete, lights, paths joined,
    trees, paints, the house's painted rooms), `RANKS` (5 names). Files: new `charm.ts`, `news/view.ts`, `NewsCard.tsx`.
    Save: `charm: { told }`. Tests: `charm.test.ts` (50 fences score as 5; every hint names a row with room left). **M**,
    risk low.

`UNLOCKS`: nothing here is a new buyable (the banner and the garments are given). If decision 6 goes "the shop", each
past month's banner becomes a `decor:` row. Every number (`BACK_GIFT`, `perStop`, the road's prizes) is tuned against
`npm run sim`, and the first-hour level bands must hold within their bands.

## Order of commits (each green)

1. F1 `prize.ts` (invisible). 2. F4 `calendar.ts` (invisible). 3. Change 1, the week waits (visible). 4. Changes 2 and
3 (visible). 5. F2 `measure.ts` with `GOALS` on it (invisible), then change 4 (visible). 6. Change 5 (visible).
7. F3 `road.ts` with the daily card on the shared `Road` (invisible). 8. `album.ts` rows and engine, `Garment.from`
(invisible until 9). 9. The album's panel and menu button (visible). 10. F5 looks (invisible). 11. The banner model in
the gallery (invisible until 12). 12. The season road (visible). 13. Change 9, paint. 14. Change 10, charm. CLAUDE.md
(the daily gift's rules, the corner menu's order, the album, the season) and `tests/README.md` move with each commit.

## Overlaps

- **01-loop-economy**: `src/sim/*`, `targets.ts`, `data.ts`, `unlocks.ts`, `state.ts` (`gainXp`, `cameBack`). 02 adds only
  `PACE.season`; a multi-day mode in `play.ts` (`days(n, minutes)`) is written by whichever mission needs it first; a new good of 01 gets its
  goal and album rows in 01's commit, a line each.
- **03-characters-story**: builds on F1 and F2 (gifts, friendship counts); neighbours may quote `charm.ts`. A mailbox,
  if 03 adds one, may carry the charm column; 02 keeps it in the news until then.
- **04-first-session**: `firstSteps.ts` (keeps `goalById().measure`), badge gating in `HudMode.tsx` and `TopDash.tsx`
  (04's), `AwayPanel.tsx` (uses 02's `nearestGoal`), the festival's watering in `grow()` (04's). 02 does not gate badges.
- **05-world-feel**: its reward tier reads `Prize` from `prize.ts` (02 owns the type, 05 the tiers and the flight).
- **06-sound-haptics**: 02 calls `farmSound('stop')` and `farmSound('page')`; 06 makes them.
- **07-interface**: restyles `DailyCard`, `GoalsCard`, `NewsCard`, `DecorShop`, `SkinShop`, `Wardrobe`. 02 changes the
  pure views first; new panels start on `PanelSheet`, tokens and presets, so 07 has nothing to move.
- **08-engines-stability**: may split `state.ts`; 02 keeps its logic in its own modules with thin wrappers there.

## What is missing

**Decisions only the user can make** (recommendation first):
1. Drop "days in a row" and its flame for "days played", which never falls? **Yes.**
2. A welcome-back gift after two or more days away, fixed (day 1's coins), never growing with the absence? **Yes.**
3. Album tiles earned only by deeds: no random stickers, no duplicates? **Yes.**
4. An album page's reward a garment only (no coins, no XP)? **Yes.**
5. The season is the calendar month: 30 stops fed by XP, each coming in by itself, a clean end? **Yes.**
6. A month's banner or garment not reached: back on the same month's road next year, or sold in the shop afterwards?
   **Next year** (no `UNLOCKS` rows, nothing to buy).
7. Month themes free of weather, since players are in both hemispheres ("Kites", "Lights", not "Snow")? **Yes.**
8. Paint for farm decoration (six models get a tint mask)? **Yes, after the season.**
9. The farm's charm: words and rank only, no prize? **Yes.**
10. Events: drop the ticking "h left" for "until … · back next …"? **Yes.**
11. "Album" as a new corner-menu button, the season as a "This month" tab of the news? **Yes.**
12. Real-calendar looks (December lights, autumn pumpkins) in v1? **No, later:** rows on the season engine once it stands.

**Libraries:** none. Tabs and controls come from `radix-ui` 1.8.1 and motion from `motion` 14.7.1, both installed.

**Skills, knowledge, docs:** the sculpt kit and its tint masks (`src/lib/sculpt/parts.ts`, `tint`/`tint2`), the model
checks and gallery, `node scripts/render-item-art.mjs`; the sim's policy (`src/sim/policy.ts`) to teach it the road;
the save's sanitize pattern and `save.property.test.ts`; `tests/e2e/helpers.ts` (`ready()`, `quietDaily`, clocks).

**Assets:** Fluent Emoji 3D (MIT, `github.com/microsoft/fluentui-emoji`, credited in `src/data/credits.ts`): *open
book* (album), *waving hand* (welcome back), *rosette* (charm), *triangular flag* (season), *artist palette* (paint).
The banner is modelled in code. No sounds or pictures from outside.

**Access:** none needed: `raw.githubusercontent.com` (the emoji) is reachable from the session.

## Done when

- `npm run check` green, with the unit tests named above: the daily week waits after a 30-day gap and the bonus comes
  once; the old save's streak becomes claims and days; goal numbers are equal before and after F2 on every `testSaves`
  farm; no album tile is time-limited; each season stop is given once.
- `npm run sim`: `PACE.season` passes (a good player at 10 minutes a day reaches stop 30 between day 15 and day 24; at
  5 minutes a day, stop 20 by day 28), and every first-hour level band of `PACE` still holds.
- e2e green: `35-daily`, `21-goals`, `33-farm-decor`, `34-events`, new `39-album` and `40-season`, `05-budget` with the
  banner at the fullest farm, `16-view` and `25-button` unchanged.
- Screenshots at 390×844 and 844×390: the daily card after three days away, the album's garden page, the "This month"
  tab, a painted bench. Each is read at phone size, with nothing clipped and no badge added to the top of the screen.
