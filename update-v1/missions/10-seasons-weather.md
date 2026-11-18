# Mission 10: seasons and weather (`10-seasons-weather`)

**Goal:** the farm has a year of its own, four seasons of a week's play each, and weather that comes and goes, each a
row on one engine, kind to play and inside the budget.

**How a player will feel it:** "It's autumn on the farm: the woods have turned orange, and my pumpkins come in a
quarter bigger." "A shower came over while I was planting, watered every bed and left a rainbow over the pasture."
"Snow on the barn's roof this week." Nothing is lost to a season or a shower, a season waits while you are away, and
spring looks exactly as the farm looks today.

## Principles applied

- A rhythm on top of the week, each new season a fresh start, novelty moderate and steady: `farm-games.md P12`;
  `psychology.md §1.12` (temporal landmarks), `§1.2` (Lomas et al.), `§1.9` (the next season named, winter a small gap).
- A bonus, never a punishment: every crop grows in every season, crops in season give more, weather only helps:
  `psychology.md §2.3`, `§1.12`; `farm-games.md P3`, `P13` (abundance).
- Nothing to miss: a season counts days played, so it waits through any absence, as 02's week does: `psychology.md
  §1.7`, `§2.1`, `§2.4`.
- Cheap on a phone: looks through uniforms and the lights there are, no new caster, a draw only for what falls; no
  lightning (flashes), weather never tells anything alone: `feel-sound.md §1.9`, `§1.10`, `§1.11`; CLAUDE.md.
- Attention budget: nothing new on top of the screen, one card a season, seasons only after the first steps:
  `farm-games.md P14`; `ftue-ux.md §1.5`.

## Foundation first

Exists: `EVENTS` and `speedAt` (`events.ts`); `DAY`'s moods and `moodAt`, which `DayLight` (`Lighting.tsx`) turns into
every light's colour and strength each frame; the sculpt kit's shared uniforms (`setSculptGlow`: no recompile); drei's
`Sky`, mounted, and a `FogExp2` always present; `yieldOf`, the one place a harvest's size comes from; `world.ts`; the
events' quiet-in-tests pattern (`setEventClock`, `?debug`). Added, each with two uses or more now:

- **F1. `src/farm/season.ts` (pure): the engine.** `SEASONS` rows (below); `seasonAt(played, from)` → `{ id, day,
  ordinal }`. **A season lasts 7 days played** (days the farm is opened, by the device's calendar: 02's `days`, which
  never falls); a year is 28.
  - *Not game days:* a farm day is 20 real minutes and time away runs it (3 h today, 24 h with 01): one night is 9 to
    72 farm days. Farm-day seasons flicker past within a session or, tuned to last a week, are real days in disguise,
    warped by how much of each absence was counted.
  - *Not plain calendar days:* the season would move on while you are away (back after two weeks: summer never seen,
    autumn's decoration gone, `psychology.md §2.4`), and a new farm could begin in snow, its first steps and `PACE`
    tuned four times.
  - *Days played:* the season waits. Every farm starts in spring, today's look, so the first session and the first
    hour's `PACE` stay as tuned. A daily player meets all four in the first month (winter on day 22, before the D28
    mark), each about 3½ hours at 30 minutes a day: about half a Stardew season (28 days of about 14 minutes, *wiki*),
    enough to grow its crops many times. Seven is the week of gifts and events, so a daily player's season holds each
    event day once. Three days would change the look before it felt yours; fourteen would keep winter from most players.
- **F2. `src/farm/weather.ts` (pure): weather as a function of the farm's clock**, no state, no save. `weatherAt(t,
  season)` → `{ kind, amount 0–1, wind, rainbow }` from a hash of the farm day's number and the season's odds: at most
  one spell a farm day, 3–8 farm hours (2½–7 real minutes), easing over 20 s; fog only in the morning; after rain by
  day, a rainbow one time in two. Time away judges each 5-s step at its own time; the sim and the tests get the same
  weather from the same clock. Uses: the light, what falls, the beds' water, the away report, 06's ambience.
- **F3. `src/scene/weatherLook.ts` (pure): the interface the renderer implements.** `lookOf(season, weather)` →
  `Look { sun, warm, sky, fog, turbidity, rain, snow, wind, rainbow, cover, foliage, grass }`. Spring in clear weather is
  `IDENTITY`, today's numbers: every spec, screenshot and `16-view` pose stays as it is.
- **F4. One season chunk in the materials:** `setSculptSeason({ cover, foliage })` beside `setSculptGlow`. Snow cover
  whitens faces as they turn to the sky (with the kit's noise), never under a roof (`shelters()` in `world.ts`: the
  house's and the walk-ins' rooms, rectangles with their roof's height); foliage tints parts marked `foliage` (crowns,
  hedges, bushes), tree by tree by a hash of its place. `seasonal(material)` gives plain materials the same chunk (the
  lawns, the hedge's pieces, the house's roof). No geometry, draw or recompile; the sun's map is depth only, so kept.

**`SEASONS` rows** (colours and odds tuned by screenshots at phone size, the bonus by `npm run sim`):

| | In season (+¼ a harvest) | Ground and trees | Light: sun · warm · sky | Weather a farm day | Week's events renamed | Decoration |
|---|---|---|---|---|---|---|
| Spring | lettuce, strawberry, potato | as today | 1 · 0 · 1 | rain .30, cloud .10, fog .10 | harvest → *Blossom festival* | flower arch |
| Summer | tomato, sunflower, melon | grass a touch golden | 1.05 · +.08 · 1 | rain .15, cloud .10 | market → *Summer fair* | garden parasol |
| Autumn | pumpkin, corn, cotton | straw-gold grass, crowns orange to red | .92 · +.15 · .95 | rain .30, fog .25, wind .25 | harvest → *Harvest fair* | hay bales and pumpkins |
| Winter | carrot, wheat, sugar cane | snow on ground, roofs, crowns; beds, paths, lane swept | .85 · −.10 · 1.05 | snow .40, cloud .15, fog .15 | market → *Winter market* | snowman |

Until 01's crops land, spring holds lettuce and strawberry, summer tomato. Day phases keep their hours (the
contractor's, the office's, the tests' noon). Events keep their rhythm and numbers; a season renames them and adds its
own effect through `yieldOf`, not `speedAt`, so Wednesday's ×2 growth and autumn's bigger pumpkins stack.

## Changes

1. **The season and the weather in the farm.** Sees: nothing yet. Files: `state.ts` (08's `state/season.ts`):
   `seasonNow()`; `weatherNow()`, clear while `stepsBusy()`; `setSeason`, `setWeather`; quiet under Vitest and on
   `?debug` unless `&season=…`/`&weather=on`; `ready()` and `bootApp` pin spring and clear. The season moves only on a
   new day played, so a time away runs in the season you left. Save: `season: { from, told }` (the day played it began;
   the last season whose arrival was shown); `sanitizeSeason` in `load()`: an older farm starts in spring on its next
   day. Tests: `state.season.test.ts`, `save.test.ts`, `save.property.test.ts`. **S**, risk low.
2. **The light.** Sees: autumn's amber, winter's cool bright light, a grey sky and weaker sun in rain, a morning fog.
   Files: `DayLight` multiplies `moodAt` by the `Look`, sets `Sky`'s turbidity and rayleigh and the fog's density (the
   player's haze wins when thicker); no light added, the sun never moves. Tests: `weatherLook.test.ts`; `16-view`
   unchanged (spring); a screenshot a season. **S**, risk low.
3. **The land's look.** Sees: orange woods, then a white winter on roofs, crowns, hedge and lawn, beds, paths and lane
   swept. Files: `src/lib/sculpt/material.ts` (F4; cache key `sculpt-v5`), `src/models/trees.ts` (`foliage` on
   `CROWN_MATERIAL`), `Land.tsx`, `Ground.tsx`, `Exterior.tsx`, `House.tsx` (the roof), `world.ts` (`shelters()`).
   Tests: `world.test.ts`; `16-view` adds the yard in winter and `__home.land.whole` in winter; `05` counts unchanged.
   **M**, risk medium: up-facing surfaces indoors (the shelter mask); the look judged by screenshot.
4. **Rain, snow and a rainbow.** Sees: rain and drifting snow round you outdoors and through the windows, never under a
   roof, slanted by the wind; a rainbow after a shower. Files: new `src/scene/Weather.tsx`: one geometry made once at
   this device's most (`setDrawRange` per tier); rain a quad a drop (a soft streak), snow a point a flake, moved by the
   vertex shader from a time uniform round the camera (no script a frame); `depthWrite` off, fog on, no shadow; under
   `userData.cell = 'outside'`, dropped in the shader inside `shelters()`. The rainbow: one additive arc of 64 segments
   opposite the sun. `profile.ts` gains `weather: PerTier<number>`; less motion keeps a third of the drops. On both maps
   (`Maps.tsx`). Tests: `16-view` poses (rain from the kitchen's east window, snow over the yard, third person in rain,
   the weather's time stopped); `05`'s walk with the heaviest weather; `26-counting` equal. **M**, risk: the budget.
5. **Rain waters the beds.** Sees: while it rains the beds' water fills; the welcome-back card says "It rained: the
   beds were watered". Files: `grow()` (after 04's drain fix), `goOn`, `AwayReport.rained`, `AwayPanel.tsx`. Tests:
   `state.season.test.ts` (a shower fills every bed, none during the first steps, a shower while away), `away.test.ts`.
   **S**, risk low.
6. **Crops in season.** Sees: an "In season" chip on the seed packet with the bigger count (lettuce ×5), the same on the
   button; a bed sown in season keeps its bonus even when the season turns overnight. Files: `yieldOf(crop, bed?)`
   (compost, then season); `Bed.fresh`, set at sowing; `FarmUI.tsx` `SeedCard` (01's grid); `src/sim/policy.ts` plans
   with it; `run.sim.ts` can start a farm in any season. Rows: `crops` per season; `seasonExtra(n)`: a quarter, at least
   one. Tests: `season.test.ts` (each crop in exactly one season, no yield below today's), `state.season.test.ts` (sown
   in autumn, picked in winter: kept); `pace.test.ts`; `npm run sim` from each season; 01's `full` rule; e2e: the
   seasons spec (the chip, both ways up). **M**, risk medium: `PACE`, storage.
7. **The season in the news, and its arrival.** Sees: the news opens on "Spring · day 3 of 7", its picture, crops and
   decoration, then "Next: summer" (no countdown); the week's events in the season's names and pictures; on a season's
   first day one card, "Autumn on the farm", in 08's queue after welcome back and the gift, one tap to close; the news
   badge counts it once. Files: `season.ts` (`seasonView`, `eventLook`), `news/view.ts`, `NewsCard.tsx`, `NewsPanel.tsx`,
   new `SeasonCard.tsx` (a look fed with data, for the lab), `cardQueue.ts`. Tests: `season.test.ts`, the news view's
   test; e2e `34-events` (a renamed event), the seasons spec (the card once, the section). **M**, risk low.
8. **Seasonal decoration.** Sees: each season's piece at the front of the edit shop with its ribbon; out of season it
   waits faded, "Back in spring"; bought, it stands all year. Files: `src/models/decor.ts`, `decorModels.ts`, `decor.ts`
   (`season` on the row), `layout.ts`, `decorScene.tsx`, `DecorShop.tsx`, `unlocks.ts` (`decor:` rows, levels 6–14),
   gallery, checks, item art. Tests: `decor.test.ts`, `unlocks.test.ts`, `layoutDecor.test.ts`; e2e `33-farm-decor`;
   `05` at the fullest farm (each kind under 600 triangles). **M**, one commit a kind; risk: the budget.
9. **Rows in the others' tables.** 06: `rain` and `wind` on the ambience bus (synthesised, softer indoors), fewer birds
   in winter. 03: a few weather lines, as rare as all lines. 02: an album page "The year". **S** each.

## Order of commits (each green)

1. F1–F3 and their tests: the scaffold (invisible). 2. Change 1 (invisible: spring, clear). 3. F4 and `shelters()`
(invisible: spring is the identity). 4. Change 2 (visible off spring). 5. Change 3. 6. Change 4, measured in `05` and
`16`. 7. Change 5. 8. Change 6, after 01's crops and `PACE`. 9. Change 7, after 08's queue and 02's news tab. 10.
Change 8, a kind a commit. 11. Change 9 inside 06's, 03's and 02's commits. CLAUDE.md (a section "Seasons and
weather") and `tests/README.md` move with each. In the plan: commit 1 fits phase 1; the rest phase 2.

## Overlaps

- **01:** `CROPS`, `yieldOf`, `PACE`, `targets.ts`, `policy.ts`, `goOn`, the seed grid. Each new crop's commit names its
  season (one word in `SEASONS`); 10 adds the start-season option and the packet's chip.
- **02:** 10 reads `calendar.ts` and days played, writes neither. "Season" is this game's season; 02's month road
  becomes `MONTHS`, `month.ts`, save `month` (players still read "This month"). The news: 02's tab, 10's section at the
  top of "Now". 02's decision 12 ("later, rows on the season engine") is this mission; its months stay weather-free.
- **03:** weather lines as rows; a neighbour's liked goods may be in season (`inSeason`). **04:** `stepsBusy()` gates
  seasons and weather; its drain fix in `grow()` lands first; one line on its welcome-back card.
- **06:** the ambience rows; `lessMotion()`. **07:** `NewsCard`, `DecorShop`, the seed packet: 10 adds on the base.
- **08:** `state.ts` split (10's rules in pure modules), `cardQueue.ts`, `16-view` shards, the runner's days, and the
  `quarks.core` pin (below). Only 10 touches `DayLight`, the season chunk, the land's materials and `Weather.tsx`.

## What is missing

**Decisions only the user can make** (recommendation first):
1. A season is 7 days played, a year 28; it waits through any absence; every farm starts in spring? **Yes** (or calendar
   weeks shared by every player, or 14 days).
2. In season, a quarter more each harvest, at least one, kept by a bed sown in season? **Yes** (or ×1.25 growth, or +25 %
   price).
3. Weather touches play only by rain watering the beds; snow, fog, wind and clouds are looks? **Yes.**
4. Seasons and weather join a farm when its first steps end (spring sunshine until then)? **Yes.**
5. A season's decoration sold in its season, back every year (4 weeks played), kept once bought? **Yes** (or all year,
   at the front in its season).
6. "Season" is the game's season; 02's monthly road is the month road in code? **Yes.**
7. Winter's trees keep their crowns, dark and snow-capped (bare branches are new models, a budget question)? **Yes.**
8. No lightning, no thunder? **None.** 9. The week's events in seasonal names and pictures, numbers unchanged? **Yes.**
10. The season only in the news, on the seed packets and in one card a season, nothing on top of the screen? **Yes.**
11. Rain and snow by our own shader rather than three.quarks, which is installed and ready-made? **Our own** (below).

**Libraries: none new.** Most of the weather is ready-made from what the game has: drei's `Sky` (its uniforms grey the
sky) and three's `FogExp2`. Only what falls is ours. Checked with `npm view`, tarballs measured in the scratchpad, and
npm's advisory database:

| Package | Version, date | Licence, deps | Size (gzip) | Verdict |
|---|---|---|---|---|
| `@react-three/drei` (installed) | 10.7.9, 2026-09-25 | MIT | `Sky`: 0 more | Keep `Sky`. `Clouds` sorts and re-uploads every puff on the CPU each frame, stacks big soft sprites (overdraw, a phone's weakest point) and fetches its texture from rawcdn.githack.com unless given one. `Sparkles` twinkle in place. |
| `three.quarks` (installed) | 0.17.1, 2026-05-21 | MIT; `quarks.core: "*"` | 43 KB, a lazy chunk already | The ready-made choice: ~80 lines of setup, 1 draw, 4,000 triangles for 2,000 drops. But it moves each drop in script: 0.09 ms a frame in Node here (measured), several times that on a phone, ~100 KB of buffers re-sent each frame; no rain under less motion or before its chunk loads; the roof mask ours anyway. Its wildcard dependency now resolves to 0.18.0 (published 2026-11-17): keep the lockfile's 0.17.1, pin it (`overrides`, 08). |
| `three-nebula` | 13.3.0, 2026-09-19 | MIT, no deps | 25.7 KB | Script-driven particles too: +26 KB for what one shader does. No fetch or XHR in its build. |
| `@takram/three-clouds` | 0.7.6, 2026-05-06 | MIT, 3 own deps, postprocessing | 4.1 MB unpacked | Ray-marched volumetric clouds: far past a phone. |
| `@adatechnology/game-weather-three` | 0.5.18, 2026-11-11 | MIT, 4 own packages, one maintainer | — | First published 2026-10-24, 20+ releases since; wants `three ^0.160` (we run 0.186); lightning. Too young. |

None runs a script on install (two have `prepare`, run only for git installs); npm's bulk advisory endpoint (GitHub's
database) lists nothing for any version above. **Ours: about 250 lines, ~4 KB gzip in the 3D chunk.** On a phone at
Medium (desktop High in brackets), with the drawing pass on:

| Weather | Camera pass: draws, triangles | Sun's pass | Script a frame |
|---|---|---|---|
| Clear, cloudy, fog, wind; any season's look | 0, 0 (about 10 more shader steps a pixel outdoors) | 0 | a few uniforms |
| Rain | 1, 4,000 (2,000 drops; low 1,000, light 600; [3,000]) | 0 | 2 uniforms |
| Snow | 1, 0 (1,600 points; low 800, light 500; [2,400]) | 0 | 2 uniforms |
| Rainbow | 1, 128 | 0 | 1 uniform |

Worst view: +2 draws and +4.1k triangles against 700 and 250k (the yard over the farm, at most ~241k today, stays under);
nothing in the sun's 150k / 250, so its kept map is kept. Indoors nothing unless a window shows the outside.

**Skills, knowledge, docs:** `onBeforeCompile` with shared uniforms, as `material.ts` does; a `ShaderMaterial` on
`Points` and on an instanced quad with three's fog chunks; the drawing pass's cells and the kept sun map (CLAUDE.md);
the Preetham sky's uniforms (three's `Sky` example); `05`'s counting (points draw no triangles: say so in its README).

**Assets:** Fluent Emoji 3D (MIT, `credits.ts`): *cherry blossom*, *snowflake*, *rainbow*, *cloud with rain*, *snowman*
(`fallen-leaf` and `sun` are in `art.ts`). Four decoration models in the sculpt kit; sounds synthesised (06).

**Access:** GitHub's advisory API refused this session (403); its database was read through registry.npmjs.org.

## Done when

- `npm run check` green: each crop in exactly one season, no yield below today's in any season; spring in clear weather
  is today's light and look, number for number; the same clock gives the same weather, within its odds over 10,000 farm
  days; a shower fills every bed, none during the first steps; a bed sown in season keeps its bonus; the season never
  goes back; old saves start in spring.
- `npm run sim`: every `PACE` band holds with seasons and weather on, and with a farm made to start in summer, autumn or
  winter; 01's `full` rule holds.
- e2e: `05-budget` with the heaviest weather at most +2 draws and +4.1k triangles a view, the sun's pass unchanged, no
  new debt; `16-view` green with its winter, rain and snow poses; `34-events`, `33-farm-decor`, `25-button` green; a new
  seasons spec (the next free number; 39 and 40 are claimed): the news section, the card once, the chip, both ways up.
- Screenshots at 390×844 and 844×390, read at phone size: the yard in each season, rain from the kitchen's window, snow
  on the barn's roof, the rainbow.

## Scaffold proposal

Pure code with its tests, imported by nothing, invisible: no three.js, no `state.ts`, no save. About 440 lines.

- `src/farm/season.ts` (~110): `SeasonId`, `SeasonDef`, `SEASONS` (crops, look, light, weather odds, event names,
  decoration names as strings until their rows exist), `SEASON_DAYS`, `seasonAt(played, from)`, `inSeason(crop, id)`,
  `seasonExtra(n)`, `eventLook(id, season)`, `freshSeason()`, `sanitizeSeason(raw)`.
- `src/farm/season.test.ts` (~80): a turn every 7 days played, never backwards; each crop of `CROPS` in exactly one
  season; `seasonExtra` ≥ 1; renames name real `EVENTS`; sanitize (missing, garbage, a `from` ahead of today).
- `src/farm/weather.ts` (~90): `WeatherKind` (clear, cloudy, rain, snow, fog, wind), `Weather`, `weatherAt(t, season)`
  on a hash of `dayOf(t)`, the spell's hours and ease, `rainbowAt`, `wets(w)` (rain at half or more).
- `src/farm/weather.test.ts` (~70): the same clock, the same weather; amounts within 0–1, easing; odds over 10,000 days
  within ±2 %; snow only in winter; fog only in the morning; a rainbow only after rain, by day.
- `src/scene/weatherLook.ts` (~60) and `weatherLook.test.ts` (~30): `Look`, `IDENTITY`, `lookOf(season, weather)`;
  spring and clear give `IDENTITY`, every factor in its bounds (the light never under `DAY.minLight`).

Not in it, until the decisions are made: `state.ts`, `Lighting.tsx`, `material.ts`, `profile.ts`, the save.
