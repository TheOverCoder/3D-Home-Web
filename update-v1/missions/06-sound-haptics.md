# 06 · Sound and haptics

**Goal:** one sound palette and one set of touches: rewards honest in size and in one key with the music, varied, and
a game complete without them (muted, on silent, or with less motion).

**How a player will feel it:** every press has a voice of its own that never sounds quite the same twice, and quick
presses climb like a little tune. A big reward sounds big and is always in tune with the music, which follows the hour
and the place. With the sound off, the phone on silent or less motion on, nothing is lost.

## Principles applied

- Feedback follows the result at its true size, and never makes a non-result sound like a win: `feel-sound.md §1.1,
  §1.4`; `psychology.md §1.6`, `§2 #5` (no slot-machine shapes: the lucky draw's reels get no ticking).
- Answer in the same frame as the press (`feel-sound.md §1.2`); close the loop where the reward lands (`§1.3`).
- The palette: families, one key, variation, streaks, tiers, anticipation, layers, phone mix, controls (`§1.9`, `§3`
  items 1–9, `§4` #3 #4 #6 #8 #9 #10, the `§2` table).
- Touches few, short, tied to their cause, optional, never for an error (`§1.8`). Less motion, separate volumes, nothing
  told by sound alone (`§1.10`; `ftue-ux.md §1.4`). Cheap: synthesised, nothing downloaded or drawn (`§1.11`).
- Cosy: a "no" is soft and low (`farm-games.md P13`; `ftue-ux.md §1.9`). Decorating stays reward-free: a thud, never a
  sting (`psychology.md §1.13`).

## Foundation first

Exists: one synth engine (`src/audio/sound.ts`, 822 lines: `tone`, `burst`, `voice`, buses `sfx` and `amb`, a
limiter), the music's bus (`music.ts`), one buzz function (`haptic`, `HAPTICS` in `src/lib/device.ts`, `FEEL` in
`sound.ts`), the `XP_STEPS` climb, `placeSound`, and an offline renderer in `src/film/score.ts` (`render`). Missing: one
table, one key, one mixer, one motion switch. Each item below has two uses or more now.

1. **`SOUNDS` rows** (`src/audio/sounds.ts`), one per `FarmSound`: `family` (work, coins, reward, no, world, cue, ui),
   `feel` (a `Haptic` or null; replaces `FEEL`), `vary` (semitones of random pitch, 0 for a cue), `climb` (its streak),
   `twin` (the visual that carries the same news: toast, compass, chip, motion; `none` only for ambience). A new sound
   is a row and a synth function.
2. **`src/audio/palette.ts`** (no imports): the reward key, C major pentatonic (C D E G A), `note(step, octave)`,
   `vary(row)`, and `climb(name, gapMs)` (`XP_STEPS` made general: climbs within the gap, holds at step 8, resets after
   a pause). C D E G A lies in all four tracks' scales (C pentatonic, A minor, G major, F major): no sting ever clashes.
3. **A mixer** (`src/audio/mix.ts`): each bus (`sfx`, `amb`, `music`) gets a `user` gain (settings) and a `duck` gain
   (state); `duck(bus | 'all', dB, holdMs)` is the one way to step a bus back (screens, panels, films, big stings).
   Today `duckAmbient` and `applyVolume` each fight over a single node.
4. **`play(engine, kind, …)`**: the synths take the engine instead of reading a global, so one code writes into the
   live context, an `OfflineAudioContext` (measuring, as `score.ts` does) or a recording fake (`fakeAudio.ts`, tests).
5. **One reader for less motion: 07's F3, driven by 06's setting.** `src/ui/still.ts` (`useStill()`, `stillNow()`,
   `<html data-motion="less">`; the 46 CSS blocks read only `:root[data-motion='less']`) replaces 14 `matchMedia` reads
   and 20 `useReducedMotion` calls (Motion's hook ignores `MotionConfig`, so it could never see a switch in the game).
   06 adds what drives it: `motion: 'device' | 'less' | 'full'` over `(prefers-reduced-motion)`, and `onStill(f)` for
   the 3D side. 05's `reducedMotion()` re-exports `stillNow()`. Whoever lands first builds it (07's plan agrees).
6. **The reward tier: 05 owns it; 06 takes its names.** `type Tier = 'small' | 'medium' | 'big' | 'huge'` and
   `tierOf(prizes, level, least?)` in `src/farm/reward.ts`: pure, from worth only (never dice, a near miss or a streak);
   day 7, the fourth box and milestone levels pass a floor (`least`). 05's `celebrate(tier, from)` (`src/fx/reward.ts`)
   is the one place a tier becomes confetti, sound and touch; 06 fills in `rewardSound(tier, kind = 'coins')` and
   `rewardFeel(tier, kind)` (`kind`: coins, gift, level, garment, keys, and 02's `stop` and `page`), and hands
   `coinLand` to 05's coin flight; `sound.ts` takes `Tier` by `import type` (no farm code loaded). **To settle with
   05:** its `SHOW` table gives big `gift` and huge `level`; 06 asks for `rewardFeel` there, so each pattern keeps one
   meaning (`feel-sound.md §1.8`): big and huge coins get `sale+` (change 9).

## Changes

**1. One motion switch.** *Sees:* "Less motion" in Settings → View ("Follows your device" while it does). On, it stops
all that the device setting stops today (flights, confetti, particles, Motion's moves, CSS animations, the markers' bob,
films as stills, 05's squash) and walking sway ("Off with less motion"). *Files:* `settings.ts` (`motion`; `headBob`'s
default follows it); `src/ui/still.ts` (07's F3, or 06's if first: the setting over the device's answer, `onStill`);
`src/ui/motion.tsx` (`MotionConfig reducedMotion` from it); the 3D readers that read once at load and must follow live
(`GuideMarker`, `AimMarker`, `Player`, `DriveFilm`, `StoryFilm`, `FarmFx`); `SettingsPanel.tsx`. *Tests:*
`src/ui/still.test.ts` (device, less and full against the device's answer; listeners; a guard reading the sources: no
`prefers-reduced-motion` in `.ts/.tsx/.css` outside `still.ts`, no `useReducedMotion` import outside it);
`src/settings.test.ts` (default; an old stored object loads); e2e `03-settings` (on: `effectsOn()` false and
`.compass-strip` unanimated; off: back; persists). **S** on top of F3 (**L** if 06 builds F3: 81 readers, a line each),
risk medium: a missed reader keeps moving, and the guard catches it.

**2. Three volumes.** *Sees:* "Effects" and "Ambience" under Volume, in Settings and the intro's Sound tab (Music keeps
its own), and "On iPhone, the ring switch silences the game". *Files:* `mix.ts` (new); `sound.ts` (`create` builds the
nodes; `duckAmbient` → `duck`); `music.ts`; `SoundDirector.tsx`; `StoryFilm.tsx`; `settings.ts` (`effectsVolume`,
`ambienceVolume`, default 1: no change for anyone); `SettingsPanel.tsx`; `Intro.tsx`. Films, the drive and the talk
voices stay on the main volume. *Tests:* `mix.test.ts` on the fake (user × duck on the perceptual curve; a duck restores
after its hold; overlapping ducks take the deeper); `settings.test` (clamped 0..1); e2e 03 (persist; `__home.audio()`
reports the buses). **M**, low.

**3. The table, variation, muted play first.** *Hears:* work, coins and build vary ±1 semitone and ±10 % gain; cues stay
exact (level, keys, ding, bell, chime, the "no"s). Every piece of news has its visual twin: bell → the line's count, ding
→ the compass mark, chime → the toast, `nope` → `NOPE`, a rattle → the shake, a streak → 05's growing number pop.
*Files:* `sounds.ts`, `sound.ts` (`play`; `tone` and `burst` take a pitch factor), `device.ts`, `fakeAudio.ts`; split
`sound.ts` into `engine.ts`, `farmSounds.ts`, `house.ts`. *Tests:* `sounds.test.ts` (every kind has a row; a cue plays
the same frequencies twice; a varied kind changes within its range; every cue and "no" has a twin). **M**, low.

**4. One key for rewards.** *Hears:* `surprise` (G major today), `keys` (G), `xp` (A pentatonic), `garment` (E minor) and
`till` (B, F) move into C major pentatonic; `coins`, `level`, `ding`, `chime` already fit. *Files:* `palette.ts`,
`sound.ts`. *Tests:* `palette.test.ts` (every note of every reward and cue sting, as the fake records it, within 1 cent
of the key; bell partials ×2.76 under a quarter of their note). **S**, low.

**5. A sound of its own for each action that shares one today.**

| Action | Today | New |
|---|---|---|
| Collect a machine's jobs | `harvest` | per machine `sounds.collect`: mill `sack`, loom `bolt`, oven `tray` |
| A machine's job done | one `ding` for all | `ding` at its own note (`sounds.done`): oven G6, mill E6, loom A6 |
| Put goods in an order / fill a market shelf | `plant` | `crate` (hollow knock, straw) / `shelf` (two taps, a slide) |
| Pick fruit (lemon, fruit trees, bushes) | `harvest` (the crops') | `pick` (a twig springs back, a soft plop) |
| Pay (the shop, the contractor's offer) | `coins` and `sale`: coins *in* | `pay` (two falling clinks) and `buy` |
| Cannot (a full store in a panel, a piece that went back) | `uiClick(false)` or a toast | `nope` (decline's timbre, shorter, higher), `NOPE`, no touch |
| Decorate: lift / put down | `uiClick` | `pickupSound` / a thud by size; `lift` / `drop` (`drop` only when it fits) |

*Files:* the synths; `data.ts` (`sound: 'pick'` on fruit `PRODUCERS`, `MACHINES[].sounds.done/collect`); call sites in
`MachinePanel`, `useMachine`, `OrdersPanel`, `MarketPanel`, `Market`, `ToolPanel`, `EditMode`, `DecorateMode`,
`state.ts` (`buyMarket`, `buyFromContractor`). *Tests:* `sounds.test` (no two kinds render alike; a `MACHINES` row
without `done`/`collect` fails); `device.test` (`pay` → `buy`, `nope` none). **M**, low.

**6. Streaks climb.** *Hears:* quick presses climb the key a step each and hold at the top: tool taps, jobs added, goods
put in, shelves filled, and work in the world within 2.5 s. One press over many beds snaps once a bed (6 at most, 60 ms
apart), climbing. The XP crystals climb in the key (their 450 ms gap kept). Each work sound carries a soft in-key "pip"
that climbs while its noise varies. *Files:* `palette.ts`, `sound.ts`, `Garden.tsx` (the beds' count to the sound).
*Tests:* `palette.test` (within the gap it climbs and holds at 8; a gap resets; two streaks climb apart). **S**, low.

**7. Reward stings by tier, coin landings, anticipation.** *Hears:* the press keeps its sting (the answer in the same
frame); each coin landing on the chip adds a quiet tink a step higher, in time with the count. The boxes' shakes (daily
card 680 ms, gift boxes 820 ms) get a rattle that speeds up. Big and huge step the music and ambience back 6 dB; for a
reveal, from the rattle on.

| Tier | Sting | Notes | Length | Step back |
|---|---|---|---|---|
| small | 2 notes | G6–C7 | 0.35 s | none |
| medium | 3 rising, a clink | E6–C7 | 0.7 s | none |
| big | 4 rising, a chord | C6–C7 | 1.2 s | −6 dB, 0.8 s |
| huge | 5 rising, a chord, an octave shimmer | C5 body, C6–E7 | 1.8 s | −6 dB, from 300 ms before a shake |

*Files:* `sound.ts` (`rewardSound`, `coinLand`, `rattle`); `mix.ts`; `fx/coins.ts` (`flyCoins` gets a `landed(i)`, as
`flyInto` has); `DailyCard.tsx`, `LevelCard.tsx` (an `onShake` prop beside `onReveal`: the lab still shows them as they
are); `DailyPanel.tsx`, `LevelPanel.tsx`; reward call sites through 05's `celebrate`. *Tests:* `palette.test` (each tier
longer, with more notes and range than the one below, all in key; every kind × tier exists); `mix.test` (big and huge
step back, small and medium do not). **M**, risk medium: it needs 05's tier.

**8. The phone mix, measured.** *Hears:* the hammer of a build, a landing, the tractor and the oven on a phone speaker
(a 0.5–2 kHz layer on each low thump). *Files:* `sound.ts`; `__home.audio.render(kind)` (?debug, offline);
`SOUND_MEASURE=1` prints each sound's peak, RMS and share in 0.5–4 kHz (as `BUDGET_MEASURE` does). *Tests:* one e2e test
in `03` (Node has no Web Audio; the page is up, rendering takes seconds): every sound the player causes has ≥ 35 % of
its energy in 0.5–4 kHz, peaks under −1 dBFS, each family's RMS within ±3 dB of its target. **M**, low.

**9. The haptics map** (`device.ts`, the rows, `rewardFeel(tier, kind)`):

| What happened | Touch | Pattern (ms) |
|---|---|---|
| Work done (plant, water, pick, collect, tap, job added, put in, shelf); declined; a claim pressed | `tick` | 12, once a press |
| Coins in, small or medium (sale, line, order, goal, till, a level's coins) | `sale` | 10·60·14 |
| Coins in, big or huge | `sale+` (new) | 10·60·14·70·22 |
| Coins out (build, buy, pay, a queue's place) | `buy` | 26 |
| A gift opened (daily, box, surprise, the draw, a season stop) | `gift` | 8·40·8·40·22 |
| A level; the keys | `level` | 30·70·50 |
| Lift / put down (a queue's job, decoration, furniture; down only when it fits) | `lift` / `drop` | 8 / 16 |
| Cannot; the farm's own sounds; crystals; clicks; films; the drive | none | — |

*Tests:* `device.test` (each row; none over 200 ms; all distinct; a tier changes strength, never kind). **S**, low.

**10. Music and ambience follow the farm.** *Hears:* at night the shaker and bells drop out and the pad softens; indoors
(the house, the market) only pad and pluck, a little darker; a panel open, −4 dB; more birds in the morning, fewer in
the evening, crickets at night. *Files:* `music.ts` (each voice group on its own gain; `MUSIC_LAYERS`, 4 rows;
`setMusicMood`); `SoundDirector.tsx` (night from `hearNight`, indoors from `map` and the walk-ins, `panel`); `sound.ts`
(`BIRDS`, a row a day phase). *Tests:* `music.test.ts` on the fake (each mood's groups; changes ramp, never cut; music
off stays silent). **M**, low.

**11. (If chosen) The track follows the day.** *Hears:* "Auto" (default): *Morning on the farm* in the morning, *Slow
afternoon* at noon, *Evening lights* evening and night, *Market day* on market days (`EVENTS`) and in the market; a
crossfade on a two-bar boundary; a track picked pins it. *Files:* `music.ts`, `MusicPlayer.tsx`, `Intro.tsx`,
`settings.ts` (`musicTrack: number | 'auto'`). *Tests:* `music.test` (phase → track; pinned stays; no gap). **S**, low.

No change touches the economy (`PACE`, `npm run sim` unchanged), adds a buyable (no `UNLOCKS` row) or draws anything
(`05`, `16` unchanged). Settings are their own store (`3d-home:settings:v1`, merged with the defaults), not the farm
save: `load()` is untouched, and `settings.test.ts` guards the new keys.

## Order of commits

Each green on `npm run check` and `03-settings`. 1 · F3 if 07 has not landed it, with the guard (*invisible*). 2 · the
setting, the switch, the e2e. 3 · `play(engine)`, the fake, `SOUNDS`, variation. 4 · the mixer and sliders. 5 · one
key. 6 · own sounds (`data.ts` rows, call sites). 7 · streaks, the batch cascade. 8 · phone mix, `render`, the
measurement. 9 · the haptics map, decorating's lift and drop. 10 · tier stings, rattle, landings, step back: after 05's
commit 2 (the tier); *invisible* until 05's commits 3–4 route payouts through `celebrate`. 11 · music layers, birds by
phase. 12 · Auto, if chosen.

## Overlaps

- **05:** `fx/fx.ts`, `fx/coins.ts`, `ui/fly.ts`, `DailyCard`, `LevelCard`, `XpChip`, `Unlocked`, `Garden.tsx`,
  `useProducer.ts`, `EditMode`, `DecorateMode`, the payouts in `state.ts`. 05 owns the tier and `celebrate` and wires
  every payout; 06 fills in `rewardSound`/`rewardFeel`, adds `onShake` and edits only sound and touch lines. To settle:
  the touch column of `SHOW` (Foundation 6).
- **07:** `SettingsPanel.tsx`, `Intro.tsx`, `MusicPlayer.tsx`, `src/ui/motion.tsx`, `still.ts` (F3), the panels'
  `uiClick` lines, all CSS. One reader for less motion, built by whoever lands first; 06 adds only the setting that
  drives it. 06's `nope` sound goes inside 07's `nope(el)`. 06 adds its rows to Settings after 07's change 6 (the
  drawer on `PanelSheet`) and changes no CSS beyond F3.
- **02:** `daily.ts`, `DailyCard` (day 7 at least big, via `least`), the lucky draw (no ticking); 06 makes `stop`, `page`.
- **04:** `FirstSteps.tsx`'s reward (`haptic('sale')` and `coins`) becomes 05's `celebrate`.
- **08:** `src/audio/**` is 06's to split; the new e2e checks add seconds. **01:** row fields only (`sound`, `sounds`).
  **03:** voices stay on the main volume; a new sound of theirs is a `SOUNDS` row.

## What is missing

**Decisions only the user can make** (recommendation in italics):
1. May "Less motion" also turn motion back on when the device asks for less (the default follows the device)? *Yes.*
2. Should the music follow the time of day by default ("Auto"), a pinned track still possible? *Yes.*
3. Keep Volume as master with Effects and Ambience under it, rather than replace it? *Keep it.*
4. Coin landings: quiet rising tinks at the chip *on top of* the sting at the press (the research moves the whole sound
   to the landing)? *On top.*
5. Respect the iPhone ring switch (silent on silent; `audioSession` left on `auto`)? *Yes, and say so in Settings.*
6. Try iPhone touches through `ios-haptics` on the action button only? *No: a trusted tap on a label only, reported
   closed in iOS 26.5.*
7. Each machine's "done": the same ding at its own pitch, or one ding for all? *Its own pitch.*
8. Streaks for work in the world (within 2.5 s) too, or only in panels? *Both.*

**Libraries:** none; I agree with the research. The engine already does more than `howler` 2.2.4 or `tone` 15.1.22 (5.4
MB, duplicating `music.ts`). `zzfx` 1.4.0 (MIT, 2026-10-01) only to sketch, through its web designer; nothing installed,
sketches ported by hand to `tone`/`burst`. `ios-haptics` 3.3.0 (MIT) only if decision 6 is yes. Tests: a hand-written
fake `AudioContext` (about 80 lines); measuring: Chromium's `OfflineAudioContext`.

**Skills, knowledge, docs:** the Web Audio API (MDN: `OfflineAudioContext`, `AudioParam` automation,
`DynamicsCompressorNode`); RMS and band energy from an FFT (a proxy for LUFS, which needs a K-weighting filter);
Motion's `useReducedMotionConfig` and `MotionConfig`; the lab's `?motion=reduce` (`lab/env.ts`) must set `data-motion`
too; Android's haptics principles and Apple's HIG on haptics (`feel-sound.md §1.8`); an ear and a phone.

**Assets:** none; all synthesised. For reference listening only, not shipped: Kenney's *Interface Sounds*, *UI Audio*,
*Casino Audio* (CC0, kenney.nl).

**Access:** none needed; `npm view` answered.

## Done when

- `npm run check` green with `still.test`, `settings.test`, `mix.test`, `sounds.test`, `palette.test`, `music.test` and
  the updated `device.test` as above.
- `03-settings` green: Less motion turns flights, particles and CSS animations off and back on, and persists; the three
  volumes persist and set the buses; every sound the player causes has ≥ 35 % of its energy in 0.5–4 kHz, peaks under
  −1 dBFS, and its family's loudness within ±3 dB.
- Screenshots at 390×844, upright and sideways: Settings' Sound section (with the iPhone line) and View (Less motion).
- `SOUND_MEASURE=1` prints the table; the user listens on a phone to `__home.audio.demo()` (each family, each tier, a
  streak) and says yes. `05-budget`, `16-view` and `npm run sim` unchanged.
