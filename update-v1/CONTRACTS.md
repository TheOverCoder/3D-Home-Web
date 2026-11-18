# Update v1: the contracts

Every engine that two or more missions share, defined once, before the eight agents of phases 1 and 2 build on them in
parallel. Each engine has one owner, one file, one signature and its callers. The conflicts the eleven missions left
between them are settled in §2, the save fields are checked against each other in §3, what opens by itself and what
sits at the top is put in one order in §4, and the new modules are given their places in `state.ts`'s split in §5.

**Read with:** `PLAN.md`, `REUSE.md`, `JOURNEY.md` (branch `worktree-agent-a732f0f4c9494f593`), the eleven missions,
CLAUDE.md, and the scaffolds already in (`src/farm/ledger.ts`, `src/farm/computer/*`, `src/farm/season.ts`,
`src/farm/weather.ts`, `src/scene/weatherLook.ts`, `src/data/sunBox.ts`, `src/data/sunCheck.ts`, `src/data/lotPlan.ts`,
`src/farm/park.ts`, `src/deps.test.ts`).

**How it changes.** A contract changes only by a commit to this file first, in the same branch as the code that needs
it, and the owner of the engine agrees. A mission that needs something an engine does not give asks the owner. It
never writes a second copy.

**Written for the journey review's recommendations** (`JOURNEY.md` §3), as the coordinator asked. Each place they
decide is marked **[review]**. They are not yet the user's decisions.

## If the user decides otherwise

Each **[review]** choice lives in one constant or one function, so a different answer is a one-line change there.
"Written" is in the scaffold now. "To come" is where the owner puts it when building, as one constant or function, and
nowhere else.

| The choice (`JOURNEY.md` fix) | Where it lives | A different answer |
|---|---|---|
| Days played is the long game's one clock (4) | `LONG_CLOCK` and `longDay()`, `src/farm/calendar.ts` (written) | `'calendar'`: the daily week, the seasons and the season road count calendar days |
| The daily week is the season's week (4) | `dailyDay()`, `src/farm/daily.ts` (02, to come), reading `longDay()` and `seasonAt` | the gifts claimed count the week again (02's own plan) |
| The season road: 10 stops a season, fed by XP, never reset by the calendar (4) | `SEASON_ROAD` and `sanitizeSeasonRoad()`, `src/farm/seasonRoad.ts` (02, to come) | the calendar month's road: `MONTHS`, `src/farm/month.ts`, `farm.month` (A5) |
| At most two cards open by themselves a visit (2) | `VISIT_MOST`, `src/ui/cardQueue.ts` (written) | another number; `Infinity` for no cap |
| A season has no card: its arrival is the daily card's line (2) | `CARD_ORDER`, `src/ui/cardQueue.ts` (written) | `'season'` after `'daily'` in the list |
| The end of the first steps lands over three visits (3) | `AFTER_STEPS`, `src/ui/cardQueue.ts` (written) | every card: `[...CARD_ORDER]` |
| The busy card is the stopping cue: nothing calls while it shows (9) | `BUSY_RESTS`, `src/ui/calls.ts` (written) | `false` |
| 01's card says "Busy till 07:40", never "All set" (9) | `busyWords()`, `src/farm/appointments.ts` (01, to come) | its words |
| Only the nearest "almost there" glows (10) | the `almost` row of `CALLS`, `src/ui/calls.ts` (written) | delete the row: each glows on its own |
| `nextUp` is never empty (7) | `NEXT_SOURCES`, `src/farm/nextUp.ts` (04, to come) | only the `step` and `goal` rows |
| The welcome-back card holds at most 4 rows of pictures (11) | `AWAY_ROWS`, `src/farm/AwayPanel.tsx` (04, to come) | another number |
| The events keep their names; a season adds only its picture (12) | `SEASONS[].events`, `src/farm/season.ts` (10's). Written the other way today: its rows rename events, and 10 drops the names when it wires them | keep the rows as they are |

## Which file is which

**One name, one file, one idea.** Where two files are named alike, each holds a different half, and nothing is defined
in both.

| Files | Which is which |
|---|---|
| `src/lib/tier.ts` · `src/farm/worth.ts` | The words of a reward (`Tier`, `RewardKind`, families, floors; no imports) · the measure (`worthOf`, `rewardTier`). The contract's first draft put the measure in `src/farm/tier.ts`; it is `worth.ts`, so `tier.ts` is one file |
| `src/farm/season.ts` · `src/farm/weather.ts` · `src/scene/weatherLook.ts` | 10's: the year's rows and the season at a day played · the weather at a farm moment · the numbers a renderer reads |
| `src/farm/calendar.ts` | 02's: the calendar and days played, the clock the seasons count in; no seasons |
| `src/farm/seasonRoad.ts` (to come) | 02's: the season road's stops and record; the road engine is `src/farm/road.ts` |
| `src/farm/<x>.ts` · `src/farm/state/<x>.ts` (08's split) | The pure rules, rows and sanitizer · the live farm's side, which calls them. The pairs: `ledger`, `daily`, `market`, `contractor`, `decor`, `orders`, `day`, `season` |
| `src/film/cast.ts` `lookOf` · `src/data/people.ts` `personLook` | A film's cast member's look (the player, a roll, a herd animal) · a person of the table's. Named apart; `lookOf` will call `personLook` for `{ person }` |
| `src/ui/motion.tsx` · `src/ui/still.ts` | Motion's presets and `MotionConfig` · whether anything should move at all. There is no `src/lib/motion.ts` |
| `src/audio/sound.ts` · `src/audio/sounds.ts` | The synths and the buses · the table of rows the synths are looked up by |

**Two homes for a while.** The scaffold is each idea's home; until its owner moves the callers, today's copy stays, and
a test holds the two equal.

| Home now | Today's copy | Removed by | Held equal by |
|---|---|---|---|
| `calendar.ts`: `dayNumber`, `dayStart`, `dateKey` | `daily.ts`, `events.ts` | 02 (F4) | `calendar.test.ts` |
| `prize.ts`: `Prize`, `savedPrize`, `prizeWords`; `sized` | `gifts.ts`; the bases of `dayCoins` and `boxCoins` | 02 (F1) | `prize.test.ts` |
| `saved.ts` | the readers of ten sanitizers | 08 (commit 2) | `saved.test.ts` |
| `quiet.ts` | three functions in `state.ts` | 08 (the split) | `quiet.test.ts` |
| `still.ts` | 14 `matchMedia` reads, `fx.ts`'s `reducedMotion` | 07 | 07's guard test |
| `sounds.ts`: each row's `feel` | `sound.ts`'s `FEEL` | 06 | `sounds.test.ts` |
| `people.ts`: `steadyLook`, the looks and voices | `state.ts`, `film/cast.ts`, `film/voice.ts`, `talk/speech.ts`, `models/tractor.ts` | 03 (change 1) | `people.test.ts` |

## 0. The engines at a glance

| # | Engine | Owner | File | Phase | Called by |
|---|---|---|---|---|---|
| 1.1 | The clock: `clock`, `span`, `readyAt` | 08 | `src/lib/time.ts` | 0 | 01, 04, 08, 09, 11 |
| 1.2 | Save readers | 08 | `src/lib/saved.ts` | 0 | every sanitizer: 01, 02, 03, 08, 09, 10, 11 |
| 1.3 | Quiet in tests: `onInPlay` | 08 | `src/lib/quiet.ts` | 0 | 02, 03, 04, 09, 10, events, unlocks |
| 1.4 | The state split's core: the farm, the two device clocks | 08 | `src/farm/state/core.ts` | 0 | everyone |
| 1.5 | `PanelGuard` | 08 | `src/ui/PanelGuard.tsx` | 0 | every panel slot; 07 keeps it |
| 1.6 | The card queue | 08 | `src/ui/cardQueue.ts` | 0 | 01, 02, 03, 04, 08, the sim's journey |
| 1.7 | Less motion | 07 | `src/ui/still.ts` | 1, first | 04, 05, 06, 07, 10 |
| 1.8 | The sheet and the attention budget | 07 | `src/ui/PanelSheet.tsx`, `src/ui/calls.ts` | 1 | 01, 02, 03, 04, 05, 09, 10, 11 |
| 1.9 | `Prize` and `give()` | 02 | `src/farm/prize.ts`, `src/farm/state/rewards.ts` | 1 | 02, 03, 04, 05, 10 |
| 1.10 | The calendar, days played (the long clock) and the road of stops | 02 | `src/farm/calendar.ts`, `src/farm/road.ts` | 1 | 02, 03, 04, 08, 09, 10 |
| 1.11 | The reward tier, `celebrate`, `rewarded`, reactions | 05 | `src/lib/tier.ts`, `src/farm/worth.ts`, `src/fx/reward.ts`, `src/fx/react.ts` | 1 | every payout: 01, 02, 03, 04, 06, 09 |
| 1.12 | The sound table and the haptics map | 06 | `src/audio/sounds.ts`, `src/lib/device.ts` | 1 | 01, 02, 03, 05, 09, 10, 11 |
| 1.13 | The people table, lines, friendship, orders with a sender | 03 | `src/data/people.ts` and `src/farm/people/` | 1 | 04, 06, 08 (film), 10, 11 |
| 1.14 | The ledger, `priceAt`, `BUYER_OFFERS`, the mood | 09 | `src/farm/ledger.ts`, `src/farm/prices.ts`, `src/farm/mood.ts` | 1 | 01, 03, 09 |
| 1.15 | Season and weather | 10 | `src/farm/season.ts`, `src/farm/weather.ts`, `src/scene/weatherLook.ts` | 1 | 01, 02, 03, 04, 06 |
| 1.16 | The sun box and the car park | 11 | `src/data/sunBox.ts`, `src/data/sunCheck.ts`, `src/farm/park.ts` | 1 | 01, 02, 03, 10, 11 |
| 1.17 | Smaller shared points: `Target`, `nextUp`, `REVEAL`, the busy card, `UNLOCKS` keys, `DECOR` fields, the session runner, `PACE` | 04, 01, 08 | various | 1–2 | as listed |

## 1. The shared engines

### 1.1 The clock: `src/lib/time.ts` (owner 08, phase 0)

```ts
// Pure, no imports. Every time the game writes goes through one of these three.
/** A countdown on a clock: m:ss under an hour, h:mm:ss from an hour; rounded up, so never 0:00 while time is left;
 *  NaN, negative or 0 → '0:00'. 59.5 → '1:00', 3725 → '1:02:05'. */
export function clock(seconds: number): string
/** A length of time in words, rounded up to the unit shown: '45 s', '6 min', '2 h 14 min', '2 h', '1 day 4 h',
 *  '3 days'. */
export function span(seconds: number): string
/** When something `seconds` from `now` will be ready, on the device's own clock (12 or 24 h as the device writes it,
 *  Intl.DateTimeFormat): '21:40', 'tomorrow 07:10', past tomorrow 'Fri 07:10'. Never farm hours. */
export function readyAt(seconds: number, now?: number, locale?: string): string
```
- **Rules:**
  - `clock` is for a live countdown under an hour.
  - `span` is for a wait of an hour or more, and for a length ("away for 9 h 12 min").
  - `readyAt` is where a time of day helps: the seed packets and the busy card.
  - No other style. 01's "1 h 05" becomes `span`'s "1 h 5 min".
  - 08 writes all three in its commit 1, `readyAt` included, so 01 does not edit the file again.
- **Called by:**
  - 08: the 8 countdown and 4 duration sites;
  - 01: prompts, seed packets, the busy card;
  - 04: the welcome-back card;
  - 09: the planner's and the shop's waits;
  - 11: the dealer's panel, if it shows a wait.

### 1.2 Save readers: `src/lib/saved.ts` (owner 08, phase 0)

```ts
// Pure, no imports. Each name has one meaning; `whole` is not exported (today it means four different things).
export const MOST = Number.MAX_SAFE_INTEGER
export const isObject: (v: unknown) => v is Record<string, unknown>   // an object, lists too (read by index)
export const isRecord: (v: unknown) => v is Record<string, unknown>   // an object that is not a list
export const field: (v: unknown, k: string | number) => unknown      // a part of an object, else undefined
export const list: (v: unknown) => unknown[]                          // a list, else []
export const num: (v: unknown, d: number) => number                   // a finite number, else d
export const int: (v: unknown, d: number, lo: number, hi: number) => number  // rounded and clamped (not a number: d)
export const amount: (v: unknown, d: number) => number                // int from 0 to MOST (state.ts's)
export const floorCount: (v: unknown) => number                       // its whole part from 1 up to MOST, else 0 (the ledger's)
export const intIn: (v: unknown, lo: number, hi: number) => v is number  // already a whole number in range, unchanged (gifts', daily's)
export const seconds: (v: unknown, most: number) => number            // 0 to most (state.ts's old `span`)
export const cycle: (v: unknown, every: number) => number             // 0 to under `every`, else 0 (state.ts's old `clock`)
export const oneOf: <T extends string>(v: unknown, names: readonly T[]) => T | null
export const namesOf: <T extends string>(v: unknown, names: readonly T[]) => T[]   // each once, in the saved order
```
- **Rules:**
  - The ten sanitizers of today move onto these with no change in outcome: the property test and the save tests stay
    unchanged and green.
  - Every new save field of §3 is read with them.
  - `state.ts`'s readers `span` and `clock` are renamed `seconds` and `cycle`, because the clock's `span` and `clock`
    are imported beside them.
- **Called by:** every sanitizer: today's ten, `ledger.ts`, `season.ts`, and every one §3 adds.

### 1.3 Quiet in tests: `src/lib/quiet.ts` (owner 08, phase 0)

```ts
/** Whether something that runs by itself in play is on by default: on in play; off under Vitest and on a ?debug page
 *  unless the page says `&<param>=on`. Pure: the environment is given. */
export function onInPlay(param: string, env: { test: boolean; search: string | null }): boolean
/** The same for this page (import.meta.env.MODE, location.search). */
export function onHere(param: string): boolean
```
- **Rules:**
  - Each system keeps its own switch for tests (`setEventClock`, `quietSteps`, …).
  - `ready()` and `bootApp` in `tests/e2e/helpers.ts` turn each new one off.
  - The parameters:
    - `events`, `steps`, `unlocks` (meaning locked), as today;
    - `road` (02), `neighbours` (03; `people=` is the stress parameter), `mood` (09), `season` and `weather` (10).
- **Called by:** the three systems that write this function today, and the five new ones.

### 1.4 The state split's core: `src/farm/state/core.ts` (owner 08, phase 0; re-exported by `src/farm/state.ts`)

```ts
export const farm: FarmData
export const useFarm: UseBoundStore<StoreApi<{ rev: number }>>
export function bump(): void
export function save(): void                            // debounced, as today
export function toast(text: string, item?: string): void
export function random(): number                        // the farm's dice
export function setRandom(f: (() => number) | null): void
export type At = { x: number; y: number; z: number }    // where something happened in the world
// the two device clocks
export function calendarDay(): number                   // today by the calendar clock; during a time away, the step's day
export function setDailyClock(f: (() => number) | null): void   // the calendar clock (its name kept: the tests use it)
export function eventTime(): number | null              // the event clock, null while off; during a time away, the step's moment
export function setEventClock(at: number | 'device' | null): void
```
- **Rules: one clock per kind of question.**
  - **Whole days** read `calendarDay()`: one day played counted once, the daily gift's one claim a day, the ledger's
    14 days, birthdays and the lucky draw's date.
  - **The hour and the weekday** read `eventTime()`, which is off in tests: the events and the mood.
  - **The farm's 20-minute day** reads `farm.day.t`: the light, the weather and people's hours.
  - **The long game** (the daily week, the seasons and the season road) reads days played (§1.10). **[review]**
  - During `goOn`, both device clocks give the step's moment. Today `calendarDay()` does not; 08 adds it, so that a
    shop sale made while away goes into the ledger on its own day.
  - No module reads `farm` at its top level, and `state.ts` ends with one explicit `start()`.

### 1.5 `PanelGuard`: `src/ui/PanelGuard.tsx` (owner 08, phase 0)

```tsx
/** An error in rendering what is inside closes the panel: closePanel(), toast "That didn't open properly", and the
 *  error goes into diagnostics (Copy diagnostics). It renders nothing then. Keyed by the panel's kind, so the next panel
 *  mounts fresh. */
export function PanelGuard(props: { name: string; children: ReactNode }): ReactNode
```
- **Rules:**
  - It wraps every panel slot in `FarmUI.tsx`, and `Hud` and `HudMode`.
  - It goes outside `PanelSheet`, never inside it.
  - 07 keeps it when it moves the panels onto the sheet.
  - A new panel needs nothing.
- **Called by:** `FarmUI.tsx`, `App.tsx`. It is tested by `40-safety` (§2, B12).

### 1.6 The card queue: `src/ui/cardQueue.ts` (owner 08, phase 0; its budget **[review]**)

```ts
// Pure core: no React, no DOM, so the sim's journey (src/sim/journey.ts) imports the same order and budget.
/** The order the cards that open by themselves come in; the ids are this list's. [review: no 'season' card] */
export const CARD_ORDER = ['away', 'daily', 'unlocked', 'letter', 'counts'] as const
export type CardId = (typeof CARD_ORDER)[number]
/** [review] At most this many open by themselves in one visit, the welcome back counted. Each of the rest waits where it
 *  lives (the gift in the corner menu, an unlock on the level chip, a letter on the mailbox's flag, the counts' question
 *  in Settings). */
export const VISIT_MOST = 2
/** [review] The cards that may open by themselves in the visit the first steps end in. */
export const AFTER_STEPS: readonly CardId[] = ['away']
export interface QueueNow {
  due: readonly CardId[]          // the cards that want to open now
  opened: readonly CardId[]       // the ones opened by themselves this visit
  free: boolean                   // nothing is over the game (gameFree with a toast counted)
  showing: CardId | null
  stepsEndedThisVisit: boolean    // the first steps ended in this visit: only their own card this time
}
/** The card to open now, or null: none while one shows or the game is not free; none past VISIT_MOST; only those
 *  AFTER_STEPS in the visit the first steps ended in; none twice a visit; else the first due in CARD_ORDER. */
export function nextCard(q: QueueNow): CardId | null

// The runtime, wired by 08 in phase 0:
export interface CardDef { due(): boolean; open(): void; showing(): boolean }
export function registerCard(id: CardId, def: CardDef): () => void
export function CardWatcher(): null          // a beat (900 ms) of the game free, then nextCard → open; replaces DailyWatcher's own timer
export function cardShowing(): CardId | null // gameFree() counts a card showing as busy
```
- **Rules:**
  - **A visit** is a load, or a return after `AWAY_TELLS` (2 min) or more.
  - **The daily gift** carries the season's line ("Summer, day 1 of 7"), so a season has no card of its own. The first
    spring has no card at all. **[review]**
  - **The first steps' end** lands over three visits **[review]**:
    1. **Now:** the steps' own card. The boxes reached during the steps open as one starter gift, and the goals'
       trophy comes with *Claim all*.
    2. **The next visit:** the daily gift's first day, the first neighbour, and their letter.
    3. **Day 2:** the news.
  - **The first letter** is the only letter that opens by itself.
  - **The counts' question** (08, decision 20) is asked once, from the second visit on, and only if the decision is
    yes.
  - The welcome back is the existing `{ kind: 'away' }` panel. `unlocked` is `Unlocked.tsx`: a level's reveal waits
    for the queue, as it waits for `useGameFree()` today.
- **Called by:**
  - 02: the daily gift;
  - 03: the first letter;
  - 04: the steps' end, and the welcome back's *Next*;
  - 08: the counts;
  - `XpChip`: unlocked;
  - the journey's `AUTO_CARDS`, which becomes an import of `CARD_ORDER` and `VISIT_MOST`, not a copy (§2, B16).

### 1.7 Less motion: `src/ui/still.ts` (owner 07, the first commit of phase 1)

```ts
export type MotionPref = 'device' | 'less' | 'full'
/** Still: asked for in the game, or left to the device and the device asks. */
export const isStill = (pref: MotionPref, deviceAsks: boolean): boolean => pref === 'less' || (pref === 'device' && deviceAsks)
export function lessMotion(): boolean                                   // now, for code outside React (fx, 3D, burst, fly)
export function useLessMotion(): boolean                                // React
export function onLessMotion(f: (still: boolean) => void): () => void   // the 3D readers that read it once at load
export function setMotionPref(pref: MotionPref): void                   // 06's setting drives it, at load and on change
// While still: <html data-motion="less">; the CSS reads only :root[data-motion='less']; MotionConfig reducedMotion follows.
```
- **Rules:**
  - This is the only `matchMedia('(prefers-reduced-motion…)')` read in `src`, and the only `useReducedMotion` import.
    A guard test reading the sources holds it.
  - Today's `fx.ts` `reducedMotion()`, `fly.ts` `still` and the films' `reduced` become this.
  - **Under less motion nothing moves:** no flights, number pops, reactions, confetti or particles (10's rain and
    snow among them), no CSS loops, no marker bob, and walking sway is off.
  - Counts still change, and the grey sky and the fog stay.
  - **07's `nope(el)` and `did(el)`** (`src/ui/motion.tsx`) read it. 06's "cannot" sound goes inside `nope`.
- **Called by:**
  - 05: flights, pops, `react()`, `celebrate`;
  - 06: the setting, the guard, and the 3D readers that follow it live;
  - 04: the stick's still ring;
  - 10: what falls;
  - 07: motion presets.

### 1.8 The sheet and the attention budget (owner 07, phase 1)

```ts
// src/ui/PanelSheet.tsx: the only sheet. Shell keeps its signature and renders a `card` through it.
export interface FootButton { label: string; onPress: () => void; price?: number; kind?: 'primary' | 'soft' | 'leaf' | 'berry'; disabled?: boolean }
export function PanelSheet(props: {
  label: string; title: string
  pic: string | ReactNode            // a URL, or a node (the level's star with its number)
  sub?: ReactNode                    // the chips, or tabs (the orders board)
  back?: () => void                  // a panel with pages (the machine)
  size?: 'panel' | 'card'            // a card is a question, as tall as its content
  foot?: { cancel?: FootButton; action: FootButton }   // at most two buttons, Cancel first: the type holds it
  className?: string; near?: ReactNode; closing?: boolean
  onClose: () => void; children: ReactNode
}): ReactNode
// Esc: whatever is open over the sheet takes it first: the sheet asks `[data-over-sheet]`, never a list of class names
// (09's window adds the attribute; nobody edits PanelSheet for it).

// src/ui/calls.ts
export const CALLS = [/* daily 1, boxes 2, goal 3, almost 4 [review], news 5, compass 6, tag 7 */] as const   // { id, rank } rows
export type CallId = (typeof CALLS)[number]['id']        // 'daily' | 'boxes' | 'goal' | 'almost' | 'news' | 'compass' | 'tag'
/** [review] While the busy card shows, nothing calls: it is the stopping cue. */
export const BUSY_RESTS: boolean = true
/** The one call that moves now: the highest that applies; none while the busy card shows (`busy`, with BUSY_RESTS). */
export function calling(applies: ReadonlySet<CallId>, busy?: boolean): CallId | null
export function useCalling(id: CallId): boolean           // 07, with the hook
```
- **Rules:**
  - **At rest, at most one loop runs at the top.**
  - **`almost` is one call for every "almost there"** **[review]**: a goal's last 15 %, an album page, a road stop and
    a level box. Only the nearest of them glows, by minutes of play left (`incomeAt`, §1.17).
  - **A call applies only where 04's `shows(part)` is true.** There is no `held` field in `CALLS`: REVEAL decides
    whether a part shows at all, and CALLS decides which part that shows may move.
  - **A new panel kind** goes on `PANEL_KINDS` in `store.ts`, so `39-panels` measures it.
- **Called by:**
  - new panels: 02 album, 03 letter and neighbours, 09 computer, 10 none (folded into daily), 11 dealer;
  - the calls: `XpChip`, `TopDash`, `HudMode`, `Compass`, `ThingTag`, and 02's album and road.

### 1.9 `Prize` and `give()` (owner 02, phase 1)

```ts
// src/farm/prize.ts. Prize, savedPrize and prizeWords move here; gifts.ts re-exports them, so no caller breaks.
export type Prize =
  | { coins: number }
  | { item: ProduceId; n: number }        // a good or a building material: into its store, past full (as surprises)
  | { decor: ShopKind; look?: string }    // one piece into the farm's store (layout.stored), free to put down
  | { garment: string }                   // a garment into the wardrobe (outfit.owned)
export type PrizeKind = 'coins' | 'item' | 'decor' | 'garment'
export const prizeKind: (p: Prize) => PrizeKind
/** A prize as saved, or null: coins from 1 to 1e9; a sellable good or a material, 1 to 99; a shop kind (and a look its
 *  row has); a garment that does not come with a level. */
export function savedPrize(raw: unknown): Prize | null
export function looksOf(kind: ShopKind): readonly string[]   // the looks a kind may wear (02's `tints`; none today)
export function isGiftGarment(id: unknown): id is string     // a garment that does not come with a level (02's `Garment.from`; none today)
export function prizeWords(p: Prize): string           // '12 coins', '2 planks', 'a season banner', 'a green cap'
/** Coins sized from the next level's own (levelReward(level + 1)): the one yardstick of every prize's coins and of the
 *  tier (§1.11). At least `least`. */
export function sized(share: number, level: number, least?: number): number

// src/farm/state/rewards.ts (02 owns give; 05 owns rewarded beside it)
/** Every prize goes in here and nowhere else: coins; goods past full; a piece into the store with its look; a garment
 *  into the wardrobe. It counts the reward once (rewarded, §1.11) and returns its tier. No XP. */
export function give(prizes: readonly Prize[], kind: RewardKind, at?: At): Tier
```
- **Rules:**
  - **What goes through `give`:** every claim and gift, and nothing else.
    - 02: the daily gift, the welcome-back gift, the level's boxes and its arrival gift, the season road's stops, the
      album's pages, the goals (coins and their good);
    - 04: the first steps' rewards;
    - 03: letters, chapters and birthdays.
  - **Sales do not** go through `give`: they pay coins with XP, and call `rewarded()` themselves.
  - `dayCoins`, `boxCoins` and every new coin prize are `sized(...)`.
- **Called by:** 02, 03, 04, 05 (counts), 10 (none: its decoration is sold).

### 1.10 The calendar, days played (the long clock) and the road of stops (owner 02, phase 1)

```ts
// src/farm/calendar.ts. Pure. dayNumber and dayStart move here from daily.ts, dateKey from events.ts, each as it is;
// the old files re-export them.
export function dayNumber(ms: number): number    // the device's calendar day (safe across summer time)
export function dayStart(day: number): number    // its local midnight
export function dateKey(ms: number): string      // '2026-11-21', from local fields
export function dateOf(day: number): { year: number; month: number; date: number; weekday: number }  // month 1–12, weekday 0 = Sunday

/** Days played: the days the farm was opened, by the calendar. Never falls. THE LONG CLOCK. [review] */
export interface Played { days: number; last: number }   // `last`: the calendar day last played (-1: none)
export const freshPlayed: () => Played                   // { days: 0, last: -1 }
/** Today played: counted once a calendar day (a clock moved back counts nothing). `away`: the whole days since the
 *  last day played (0 on the same day, and the first time). */
export function markPlayed(p: Played, today: number): { played: Played; away: number }
/** As saved, against today: `last` no later than today, `days` a count. A farm from before it: from `before` (its old
 *  daily streak and last claim). */
export function sanitizePlayed(raw: unknown, today: number, before?: Played): Played
/** [review] The one switch for the long clock: 'played', or 'calendar' to run the long game on the calendar instead. */
export const LONG_CLOCK: 'played' | 'calendar' = 'played'
/** The long clock's day now: what the daily week, the seasons and the season road count in. */
export const longDay: (played: Played, today: number) => number

// src/farm/road.ts. Pure: a road of stops counted in anything (claims, XP, tiles, levels).
export type Road = readonly number[]                     // the count each stop is reached at, rising
export function stops(n: number, at: (k: number) => number): Road   // k from 1 to n; each stop at least one past the last
export function reached(road: Road, have: number): number          // the stops reached, 0 to n
export const ALMOST = 0.85
export interface Nearest { stop: number; at: number; left: number; share: number; almost: boolean }
export function nearest(road: Road, have: number): Nearest | null  // the next stop (share: from the last one); null past the end
```
- **Rules: one long clock, days played.** **[review, `JOURNEY.md` fix 4]**
  - `markPlayed()` runs on the first view of each calendar day (`state/daily.ts`). The seasons, the daily week and the
    season road read `longDay(played, today)`, which is `played.days`, and the calendar month runs nothing.
  - **The daily week is the season's week.** Day N of 7 is the season's day N, from
    `seasonAt(played.days, season.from).day` (§1.15), and day 7's big gift is the season's last day. The week waits
    through any absence, because days played do.
  - A day played whose gift was not claimed by midnight: 02 decides. The recommendation is one extra prize with the
    next claim, so nothing is skipped.
  - **The season road replaces 02's monthly road.**
    - It is fed by XP and has 10 stops a season.
    - It is sized so that a 10-minute-a-day player reaches the last stop by the season's day 6.
    - It never resets by the calendar: stops not reached carry on into the next season's road.
    - Each season has a garment row, and year 2 has new rows, so day 29 is not a repeat.
    - The player reads "This season", not "This month".
  - **The road engine is one:** the daily week (`stops(7, k => k)`, in season days), the season road (in XP), a goal's
    rungs, an album page (in tiles) and 03's story road (in levels).
- **Called by:**
  - 02: the daily gift, the season road, goals, album;
  - 03: birthdays (`dateOf`), the story road;
  - 04: `nextUp` through `nearest`;
  - 08: the counts' `daysPlayed`;
  - 09: the ledger's days (`dayNumber`);
  - 10: seasons (`played.days`);
  - events: `dateKey`.

### 1.11 The reward tier, `celebrate`, `rewarded`, reactions (owner 05, phase 1)

```ts
// src/lib/tier.ts. No imports: sound.ts, fx and the farm all read it (06's sound.ts loads no farm code).
export const TIERS = ['small', 'medium', 'big', 'huge'] as const
export type Tier = (typeof TIERS)[number]
/** How a reward feels and sounds: what its touch and its sting are (§1.12). */
export type Family = 'coins' | 'gift' | 'level' | 'garment' | 'keys' | 'work'
export type RewardKind =
  | 'sale' | 'order' | 'till' | 'goal' | 'step'                  // coins in
  | 'level'                                                     // a level's coins
  | 'daily' | 'back' | 'box' | 'surprise' | 'stop' | 'letter' | 'chapter'   // a gift opened
  | 'page' | 'garment'                                          // a garment given (an album page, a level's)
  | 'keys'                                                      // the house's keys
  | 'harvest' | 'collect' | 'made'                              // goods collected (beds, animals, machines)
export const REWARD_KINDS: Readonly<Record<RewardKind, { family: Family; least?: Tier }>>   // RewardKind is its keys
//   level: least 'big'; page, garment: least 'big'; keys: least 'huge'; every other kind by worth alone
export const REWARD_KIND_IDS: RewardKind[]
export const rewardKind: (kind: RewardKind) => { family: Family; least?: Tier }
export const tierRank: (t: Tier) => number
export const atLeast: (t: Tier, least?: Tier) => Tier

// src/farm/worth.ts (the contract's first draft called it src/farm/tier.ts: renamed, so one name is one file). Pure.
export const TIER_AT = { medium: 0.25, big: 1, huge: 3 } as const      // shares of levelReward(level + 1), tuned with the sim
/** What prizes are worth in coins: coins; a good at its fair PRODUCE price (never an event's, a machine level's or the
 *  mood's); a material at CONTRACTOR.buys; a piece at its shop row's first price (0 for one not sold); a garment 0
 *  (its kind's `least` carries it). */
export function worthOf(prizes: readonly Prize[]): number
export function rewardTier(prizes: readonly Prize[], level: number, least?: Tier): Tier

// src/farm/state/rewards.ts (05)
/** Counts a reward once, queues the world's show where `at` is a world point, and returns its tier. */
export function rewarded(kind: RewardKind, prizes: readonly Prize[], at?: At): Tier
export function rewardCounts(): Readonly<Record<RewardKind, Readonly<Record<Tier, number>>>>   // the sim, __home.reward (a copy)
export function resetRewardCounts(): void                                                      // a sim's new farm, a test
export const foundPrizes: (items: readonly ItemId[]) => Prize[]   // the surprises found with a payout, as its prizes

// src/fx/reward.ts (05)
/** Decision 15, confetti only for real rewards: the least tier that throws it, the one floor. */
export const CONFETTI_FROM: Tier = 'big'
export const SHOW: Readonly<Record<Tier, { pop: number; holdMs: number; confetti: { count: number; spread: number; power: number } | null }>>
/** The world's shows `rewarded` queues (none under lessMotion; the latest MOST_SHOWS kept), taken once a frame by the
 *  effects (05b's `reward` request in FarmFx.tsx). */
export function showReward(kind: RewardKind, tier: Tier, at: { x: number; y: number; z: number }): void
export function takeRewardShows(): { kind: RewardKind; tier: Tier; x: number; y: number; z: number; at: number }[]
/** The one fan-out: rewardSound(kind, tier) and haptic(rewardFeel(kind, tier)) (§1.12), the number pop and the
 *  confetti by SHOW[tier] (none under lessMotion; at most one confetti every 1.5 s). */
export function celebrate(kind: RewardKind, tier: Tier, at: Element | { x: number; y: number } | null): void

// src/fx/react.ts (05). No three.js, no DOM.
export type Reaction = 'pluck' | 'pick' | 'sprout' | 'perk' | 'wiggle' | 'rustle' | 'settle'
export type ReactOwner = 'plant' | 'fruit' | 'animal' | 'thing'
export const REACTIONS: Readonly<Record<Reaction, { ms: number; keys: readonly (readonly [t: number, xz: number, y: number])[] }>>
export function react(owner: ReactOwner, id: string | number, kind: Reaction, data?: unknown): void   // nothing under lessMotion
export function reaction(owner: ReactOwner, id: string | number): { xz: number; y: number; kind: Reaction; data: unknown } | null
export function reacting(owner: ReactOwner): boolean
export function freeze(ms: number | null): void
export function scaleAt(kind: Reaction, share: number): { xz: number; y: number }   // eased between the row's moments
export function stopReactions(): void                                                // another farm, a test
// src/lib/sculpt/parts.ts: at(x, y, z, heading = 0, scale: number | Vector3 = 1)
```
- **Rules:**
  - **The amount decides, never dice, a streak or a near miss.**
  - **What counts nothing:** a decline, a cancel, a refund, a purchase, or a full store.
  - **Each payout counts once:** selling to the whole line is one; so is everything sold to the manager at once, and
    one open of gift boxes. A level reached is one however many levels at once; the garment a level comes with is
    a `garment` reward of its own. The surprises found with a payout are among its prizes (`foundPrizes`), never a
    reward apart. Each first step passed is one.
  - **`least` comes only from `REWARD_KINDS`.** The seventh day, the fourth box and the milestone levels are bigger
    only by what they hold, and 02 can give them more.
  - **The prizes are rolled at the press**, as today. The card then shakes and reveals, so the tier is known before
    the shake, and 06's huge duck can start 300 ms before it.
  - **A card payout's UI calls `celebrate`** with the tier the action returns.
  - **A world payout's show** is queued by `rewarded()` in `fx/reward.ts` (`showReward`), as `coinsFx` is in
    `fx/fx.ts`; the effects take it with `takeRewardShows()`.
  - **`.pop-num` is 15 px or more at the small tier**, so it passes `readable.ts`.
- **Called by:**
  - every payout: the sales in 01's, 03's and 09's modules;
  - 02's claims, 03's letters and chapters, 04's steps;
  - 06 (it fills in `rewardSound` and `rewardFeel`);
  - the crowds' `at` scale: 01's new crops, animals and buildings, 02's banner, 10's decoration, in their own crowds.

### 1.12 The sound table and the haptics map (owner 06, phase 1)

```ts
// src/audio/sounds.ts
export type SoundFamily = 'work' | 'coins' | 'reward' | 'no' | 'world' | 'cue' | 'ui'
/** What tells the same news without sound ('none' only for ambience). */
export type Twin = 'toast' | 'compass' | 'chip' | 'count' | 'motion' | 'none'
/** A touch: today's Haptic, and 06's stronger "coins in" ('sale+'), which joins Haptic with 06's commit 9. */
export type Feel = Haptic | 'sale+'
export interface SoundRow {
  family: SoundFamily
  feel: Feel | null       // the touch with it (replaces sound.ts's FEEL)
  vary: number            // semitones of random pitch: 1 for work, coins and build; 0 for a cue
  climb?: 'work' | 'xp'   // the streak it climbs in (palette.ts, climb)
  twin: Twin
}
export const SOUNDS: Readonly<Record<FarmSound, SoundRow>>
/** A reward's touch: its family picks the pattern, its tier only the strength. */
export function rewardFeel(kind: RewardKind, tier: Tier): Feel
// src/audio/sound.ts
export function rewardSound(kind: RewardKind, tier: Tier): void   // the sting, in C major pentatonic, longer and richer by tier
export function coinLand(i: number): void                          // a quiet tink a step higher for each coin landing
// src/audio/mix.ts
export function duck(bus: 'sfx' | 'amb' | 'music' | 'all', dB: number, holdMs: number): void
// src/lib/device.ts: Haptic gains 'sale+' (10·60·14·70·22) in 06's commit 9.
```

**The haptics map** (one pattern means one thing; a tier changes strength, never kind):

| Family / cause | Pattern |
|---|---|
| work (a press that did something; a claim pressed) | `tick` |
| coins in, small or medium | `sale` |
| coins in, big or huge | `sale+` |
| coins out (build, buy, pay, a queue's place, a paint) | `buy` |
| gift, garment (a gift opened, a stop, a page) | `gift` |
| level, keys | `level` |
| lift / put down | `lift` / `drop` |
| cannot; the farm's own sounds; crystals; clicks; films; the drive | none |

- **Rules:**
  - **A new sound** is a `FarmSound` name, a row and a synth function.
  - **Every `MACHINES` row has `sounds: { done, collect }`.** 06's test fails a row without them, so 01's dairy and
    kettle carry them in their own commits.
  - **A fruit producer has `sound: 'pick'`**, and so does 01's beehive.
  - **Ambience** (10's rain and wind, the birds by phase) are rows of `sound.ts`'s ambience, not `FarmSound`s.
- **Called by:**
  - 05: `celebrate`;
  - new rows: 01 (churn, kettle, bees), 02 (`stop`, `page`), 03 (letter, heart, mailbox), 09 (key, power-on),
    10 (rain, wind: ambience), 11 (car door, engine, cups).

### 1.13 The people table, lines, friendship, orders with a sender (owner 03, phase 1)

```ts
// src/data/people.ts
export interface PersonDef {
  name: string
  role: 'farmer' | 'staff' | 'neighbour' | 'seller'
  /** a roll on dice of their own over overrides (steadyLook), or a whole look (the driver's); none: no body (the farmer) */
  look?: { seed: number; over: Partial<PersonLook> } | { whole: PersonLook }
  voice?: Voice                 // src/film/voice.ts's; none: read, never heard (the farmer)
  pic: string                   // src/assets/people/<id>.webp; the farmer: his Fluent faces
  hours?: Keeper                // a HOURS row (src/farm/data.ts) they keep
  likes?: readonly [ProduceId, ProduceId]
  birthday?: { month: number; date: number }
  trait?: string
}
/** Ids by role, so names can change: the five staff of today, the five neighbours (03), the dealer's seller (11). */
export const PEOPLE = { farmer, manager, contractor, agent, driver /* baker, teacher, knitter, beekeeper, child (03); dealer (11) */ } as const satisfies Record<string, PersonDef>
export type PersonId = keyof typeof PEOPLE
export const PERSON_IDS: PersonId[]
export type NeighbourId = 'baker' | 'teacher' | 'knitter' | 'beekeeper' | 'child'
export const personById: (id: PersonId) => PersonDef
export function steadyLook(seed: number, over: Partial<PersonLook>): PersonLook   // the one copy (state.ts and film/cast.ts drop theirs)
/** Not `lookOf`: src/film/cast.ts's lookOf takes a film's Look, and will call this one for `{ person }`. */
export function personLook(id: PersonId): PersonLook | null                       // null: no body (the farmer)
export function talkerOf(id: PersonId): Talker | null                             // src/talk/speech.ts; null: never heard

// src/talk/lines.ts: one line type for whatever anyone says, on screen or aloud
export interface Line { who: PersonId | 'buyer'; say: string; mood: FarmerMood; hearts?: number }
// src/ui/Portrait.tsx (FarmerFace re-exports it)
export function Portrait(props: { who: PersonId; mood?: FarmerMood; size?: number; move?: boolean }): ReactNode

// src/farm/people/friends.ts
export const FRIENDS = { sale: 1, liked: 2, order: 3, chapter: 5, hearts: [3, 8, 15, 25, 40] } as const
export type Friends = Partial<Record<NeighbourId, { points: number; told: number }>>   // told: the hearts whose letter came
export const heartsOf: (points: number) => number
export function befriend(f: Friends, who: NeighbourId, why: 'sale' | 'liked' | 'order' | 'chapter'): Friends
export function sanitizeFriends(raw: unknown, met: readonly NeighbourId[]): Friends

// src/farm/orders.ts: an order with a sender
export interface Order { id: number; lines: OrderLine[]; coins: number; surprise: boolean; from?: PersonId; chapter?: ChapterId }
```
- **Rules:**
  - The four fixed looks and the four voices of today stay exactly as they are, held by a test against captured
    values.
  - Names are unique, and no stranger in line shares one.
  - `befriend` is called only in the sale and send paths. Hearts never fall and give no XP.
  - **`FarmerMood` loses `'pleading'`** in 04's commit 1, and `Portrait` never names it.
- **Called by:**
  - 04: the farmer's hint through `Portrait`;
  - 06: voices, on the main volume;
  - 08: the film's `Look` gains `{ person: PersonId }`;
  - 10: weather lines, as rows;
  - 11: the dealer's seller row and its `HOURS` row; neighbours come by car through `byCar` (§1.16).

### 1.14 The ledger, `priceAt`, `BUYER_OFFERS`, the mood (owner 09, phase 1; already written, unwired)

```ts
// src/farm/prices.ts
export function priceAt(good: ProduceId, more?: number, factor?: number): number  // priceOf becomes priceAt(good, boost(maker), event(good))
export function priceEvents(f: (good: ProduceId) => number): void                 // one setter: state/day.ts sets it to draw × mood
// src/farm/data.ts
export const BUYER_OFFERS: readonly { factor: number; odds: number }[]            // priceFor reads it; 03's neighbours draw from rows ≥ 1
// src/farm/ledger.ts (as written)
export type Channel = 'gate' | 'order' | 'manager' | 'shop' | 'contractor'
export function noteSale(book: Ledger, day: number, channel: Channel, good: ProduceId, units: number, coins: number): Ledger
export function sanitizeLedger(raw: unknown, today: number): Ledger
// src/farm/state/ledger.ts (09)
export function sold(channel: Channel, good: ProduceId, units: number, coins: number): void   // farm.ledger = noteSale(…, calendarDay(), …)
// src/farm/mood.ts (only on 09's decision 1)
export function moodOf(good: ProduceId, day: number): number                       // 1 ± 0.1; a material: 1
```
- **Rules:**
  - **Every sale notes the book once, in the module that pays it:**
    - buyers: `gate`;
    - orders: `order`, split by each line's share;
    - the market: `manager` and `shop`;
    - the contractor: `contractor`.
  - A decline notes nothing.
  - A sale while away is noted on its step's day (§1.4).
  - **The mood** enters through the one `priceEvents` line beside the lucky draw. It is never a second hook, and it is
    quiet in tests (`onInPlay('mood')`).
  - **The views** (`src/farm/computer`) read a farm and a `MarketNow`, and never call state.
- **Called by:** 01 (prices of new goods: rows), 03 (`BUYER_OFFERS`, and `sold` beside `befriend`), 09.

### 1.15 Season and weather (owner 10, phase 1; already written, unwired)

```ts
// src/farm/season.ts (as written): SeasonId, SEASONS, SEASON_DAYS = 7, seasonAt(played, from) → { id, day, ordinal, left, next },
// inSeason, seasonOf, seasonExtra, SeasonRecord { from, told }, freshSeason, sanitizeSeason(raw, played)
// src/farm/weather.ts (as written): Weather, CLEAR, weatherAt(t, season), wets(w)
// src/scene/weatherLook.ts (as written): Look, IDENTITY, lookOf(season, weather), moodWith(mood, look)
// src/farm/state/season.ts (10)
export function seasonNow(): SeasonId          // the season's look and effects: spring while the steps run or the seasons are quiet
export function seasonDay(): { id: SeasonId; day: number; ordinal: number }   // the clock itself: never quiet (the daily week reads it)
export function weatherNow(): Weather          // CLEAR while the steps run or the weather is quiet
export function setSeason(id: SeasonId | null): void
export function setWeather(w: Weather | null): void
// src/farm/state/beds.ts
export function yieldOf(crop: CropId, bed?: BedState): number   // compost, then the season (a bed sown in season keeps it)
```
- **Rules:**
  - **The season's clock** (`seasonDay`) is days played, and is never quiet: the daily week runs on it in tests too.
  - **What is quiet** in tests and on `?debug` is the season's effects: the look, the in-season yield, the weather, and
    the news's season line.
  - **Keep the events' names** **[review, fix 12]**. A season shows its own picture beside an event's name.
    `SEASONS[].events` keeps pictures only, and `eventLook` returns the event's own name.
  - **The season has no card.** Its arrival is the daily card's line, and the first spring has none.
  - **Rain waters the beds** only on a farm without sprinklers. The welcome back says so only there.
- **Called by:**
  - 01: `yieldOf`, the sim from each season;
  - 02: the daily week (`seasonDay`), the season road (`ordinal`), the album's year page;
  - 03: lines;
  - 04: the welcome back;
  - 06: ambience (rain, wind, fewer birds in winter).

### 1.16 The sun box and the car park (owner 11, phase 1; already written, unwired)

```ts
// src/data/sunBox.ts (as written): SunBox, SUN_BOXES: Record<Place, SunBox>, FARM_SUN_BOX_PLANNED, lightView, boxMargin, inBox, texelsFor
// src/data/sunCheck.ts (as written): SUN_MARGIN, roomMargins(room, roof, box), cornerMargins, worst
// src/data/layout.ts, once the farm's box is planned (11's commit 1):
export function inSunShadow(x: number, y: number, z: number, margin?: number, place?: Place): boolean   // asks SUN_BOXES[place]
// src/lib/sculpt/sun.ts, 11's C made general:
export function castAsOne(root: Object3D): Mesh   // every caster under root drawn into the sun's map by one sun-only mesh
// src/farm/park.ts (as written): PARK_STAGES, PARK_BAYS, MOST_CARS, BY_CAR, Traffic, trafficSteps, TRAFFIC_MOST, parkStage, baysAt, byCar(id, share)
```
- **Rules:**
  - **Every walk-in room, and every floor and inside face that looks at the sun**, lies inside its map's box
    (`buildings.test.ts` on `roomMargins`).
  - **A caster outside the box** casts nothing and gets a soft shadow (`inSunShadow`).
  - **Each new building and decoration kind casts through one sun-only mesh** (`castAsOne`, or one merged instanced
    sun mesh for a crowd kind), against the sun pass's 17 free draws (§2, D1).
  - **The car park's stage** is worked out from the save and never saved.
- **Called by:**
  - 01: the dairy, the kettle and the hive inside the box;
  - 02: the banner;
  - 03: the mailbox; neighbours by car;
  - 10: seasonal decoration, and `shelters()` from the walk-in rows;
  - 11.

### 1.17 Smaller shared points

```ts
// src/farm/walkTargets.ts (04): one "where a tap walks you"
export type Target = { id: string } | { good: ProduceId } | { bed: readonly BedStage[] }   // was StepTarget
export function walkTarget(t: Target): string | null                                      // was stepTarget

// src/farm/nextUp.ts (04): never empty [review, fix 7]. Each mission adds a source row; nextUp picks the step, else a
// request that can be filled now, else a goal to claim, else the nearest in minutes of play left.
export type Pic = { item: ProduceId } | { art: ArtId }   // as StepDef's and GoalDef's
export interface NextItem { pic: Pic; words: string; have?: number; of?: number; go?: Target | 'goals' | 'album' | 'road'; minutes: number }
export const NEXT_SOURCES: readonly { id: 'step' | 'request' | 'claim' | 'goal' | 'road' | 'album' | 'unlock' | 'saving'; next: (f: FarmData) => NextItem | null }[]
export function nextUp(f: FarmData): NextItem
// src/farm/goals.ts (02): nearestGoal(f): GoalNow | null.  src/farm/economy.ts (01): nextSaving(f) (was nextGoal: the
// market, the house, then the computer, the next paint, the next meadow); incomeAt(level): coins a minute of play.

// src/farm/reveal.ts (04): what the HUD holds back on a new farm. Nothing saved.
export type RevealPart = 'silo' | 'barn' | 'line' | 'goals' | 'gifts' | 'news' | 'gear' | 'stickTools'
export function shows(part: RevealPart): boolean   // in state/steps.ts: true when the steps are quiet or over, else the row

// src/farm/appointments.ts (01): the busy card, never "All set" [review, fix 9]
export function appointments(f: FarmData): { what: Pic; ready: number }[]   // seconds until each is ready, soonest first
export function farmBusy(f: FarmData): boolean      // every built bed sown, every open machine with a job (was allSet)
```
- **Unlocks:**
  - **`UnlockId` gains** `herd:${ProducerId}:${number}` (01), `person:${NeighbourId}` (03) and `paint:${PaintId}`
    (11). Seasonal decoration (10) uses the existing `decor:` keys.
  - **`RecipeKey` is derived from `MACHINES`** (01).
  - **01 owns the cadence test.** Each mission adds rows in its own commit with their pictures (`unlockArt.ts`).
- **`DECOR` rows gain optional fields only:** `set` and `tints` (02), `forSale: false` (02's banner), `season` (10),
  and a producing piece's `store` (01's hive).
- **The session runner** **[coordinator]**:
  - **One file, one owner:** `src/sim/sessions.ts` is 08's.
    - `Visit`, `SESSIONS` (`daily`, `light`) and `PACES` (`good`, `real`) live there.
    - So does `playVisits(schedule, { pace, seed, days, observe })`, which runs the game's own `cameBack` between
      visits, with the calendar clock moving.
  - **The journey scaffold** writes its first cut to this contract if approved. 08's commit 11 adds `health.ts`
    beside it.
  - **No other multi-day mode:** 02's `days()` in `play.ts` is dropped.
  - **01 owns `PACE` and `JOURNEY`** (`src/sim/targets.ts`). Each mission adds rows only:
    - 02 `road`, 03 `story`, 05 `rewards`, 09 the mood's ±2 %, 10 each season's start, 11 the 13 steps of `places`.
- **The two cards once named "All set"** **[review, fix 9]**:
  - **"The steps' end"** is the first steps' last card (`FirstSteps.tsx`, moment `final`). It keeps the words *All
    set!*.
  - **"The busy card"** is 01's card. It says *Busy till 07:40*, with the soonest and the longest ready.
    - It shows once a visit, only with no card up, and with no confetti.
    - While it shows, `calling()` rests.
    - Its top slot is `busy`, and the corner menu's line is *Next ready 0:40*.

## 2. Conflicts found, and their resolutions

### A. Two names for one thing

| # | Conflict | Missions | Resolution |
|---|---|---|---|
| A1 | The tier's function and file: `rewardTier` in `src/farm/tier.ts` against `tierOf` in `src/farm/reward.ts` | 05, 06 | 05's name, `rewardTier`, in `src/farm/worth.ts` (not `tier.ts`: `src/lib/tier.ts` already holds the names a tier can have, and one name is one file) |
| A2 | The top tier: `huge` against `grand` | 05, 06 | `huge`. 06's text already took it; any `grand` left goes |
| A3 | The fan-out's arguments: `celebrate(kind, tier, at)`, `feelOf(kind, tier)`, `rewardSound(kind, tier)` against `celebrate(tier, from)`, `rewardFeel(tier, kind)`, `rewardSound(tier, kind = 'coins')` | 05, 06 | Kind first, always a `RewardKind`: `celebrate(kind, tier, at)`, `rewardSound(kind, tier)`, `rewardFeel(kind, tier)`. `feelOf` is not made |
| A4 | Less motion: `lessMotion()` in `src/lib/motion.ts`; `stillNow()` and `useStill()` in `src/ui/still.ts`; PLAN's `lessMotion()` in `src/ui/still.ts`. The owner is 06 by 06's and 07's texts, 07 by PLAN's. And today's `reducedMotion()`, `still`, `reduced` and 14 `matchMedia` reads | 05, 06, 07 | `src/ui/still.ts`, owned by 07 as phase 1's first commit, with `lessMotion`, `useLessMotion`, `onLessMotion` and `setMotionPref`. 06 owns the setting that drives it. `src/lib/motion.ts` is not made |
| A5 | "Season": 02's monthly road was `SEASONS`, `seasons.ts`, `farm.season`, `sanitizeSeason`, `PACE.season`, `40-season`, `&season=on` and `state.season.test.ts`. 10's seasons are `SEASONS`, `season.ts`, `farm.season`, `sanitizeSeason`, `&season=` and `state.season.test.ts` | 02, 10 | **[review]** The monthly road goes. 10 keeps "season". 02's road becomes the season road: `src/farm/seasonRoad.ts`, `SEASON_ROAD` (10 stops), save `farm.seasonRoad`, `sanitizeSeasonRoad`, `PACE.road`, `&road=on`, `state.seasonRoad.test.ts`, spec `44-season-road`, and "This season" in the news. If the user keeps a calendar month, it is `MONTHS`, `month.ts` and `farm.month` instead, never "season" |
| A6 | "Next": `nextGoal` (the savings line), `nearestGoal`, `nextUp` | 01, 02, 04 | `nextSaving` (01), `nearestGoal` (02, one goal), and `nextUp` (04) over source rows, which never comes back empty |
| A7 | Two "All set" cards | 01, 04 | "The steps' end" and "the busy card" (§1.17) |
| A8 | `whole` means four things (the ledger, the season, daily and gifts, the contractor). `state.ts`'s readers `span` and `clock` share names with the clock's | 08, 09, 10 | `saved.ts`'s names (§1.2). The readers are renamed `seconds` and `cycle` |
| A9 | Long times: "1 h 05" against `span` "1 h 5 min" against `clock` "1:02:10" | 01, 08 | `clock` under an hour, `span` from an hour, `readyAt` for a time of day |
| A10 | `StepTarget` and `stepTarget` | 04, 02 | `Target` and `walkTarget`. 02's goals' `go` uses `Target` |
| A11 | `Bed.fresh` (sown in season) against `fresh()` (a new farm) | 10 | `beds[i].seasonal` |
| A12 | `farm.people` (friendship) against `PEOPLE` (who exists) and 08's "market and people" | 03 | The save field is `farm.friends`. `PEOPLE` is the cast |
| A13 | Quiet by default, written three times today and four more planned | 02, 03, 04, 09, 10 | `onInPlay(param)` (§1.3) |
| A14 | `setDailyClock` is in fact the calendar clock of every day-counted rule | 02, 03, 09 | Its name is kept (the tests use it); §1.4 says what it rules |

### B. Two missions defining the same thing

| # | Conflict | Missions | Resolution |
|---|---|---|---|
| B1 | The card queue: 08 left it "not taken", PLAN gave it to 08, and 02, 03, 04 and 10 need it | 02, 03, 04, 08, 10 | 08, in phase 0, with `VISIT_MOST` **[review]** |
| B2 | `calls.ts`: "whoever lands first" | 04, 07 | 07 owns it. 04's holds are `REVEAL` |
| B3 | Two ways to hold the HUD back: `REVEAL`'s `shows(part)` and a `held` field in `CALLS` | 04, 07 | `REVEAL` decides what shows; `CALLS` decides what that shows may move. No `held` |
| B4 | A multi-day sim: 02's `days(n, minutes)` in `play.ts`, 08's `sessions.ts`, and the journey's first cut of `sessions.ts` | 02, 08, journey | **[coordinator]** One: `src/sim/sessions.ts`, owned by 08 (§1.17) |
| B5 | The goals: 02 re-expresses `measure` as `count`, 04 adds `go`, and the first steps read `goalById().measure` | 02, 04 | `GOALS` keep `measure`, made from `count` (`measure = (f) => countOf(f, count)`). 04's `go` is a field of its own. Whoever lands second rebases |
| B6 | Three yardsticks for a reward: `sized` (the next level's coins), 05's tier (the same), and 01's `incomeAt` "for 02, 03 and 05 to size rewards" | 01, 02, 05 | One size: `levelReward(level + 1)`, through `sized()` and `rewardTier()`. `incomeAt` measures only minutes of play: `PACE`, `JOURNEY`, and `nextUp`'s ranking. It never sizes a prize |
| B7 | Two doors for a reward: `give()` and `rewarded()` | 02, 05 | `give()` calls `rewarded()` once. Sales call `rewarded()` |
| B8 | `steadyLook` written twice; fixed looks and voices in two places each | 03 | `PEOPLE` |
| B9 | `FarmerFace` becomes `Portrait` while 04 deletes `'pleading'` and changes `MOMENT_MOODS.ask` | 03, 04 | `Portrait({ who, mood, size, move })`. 04's deletion lands in 04's commit 1. `FarmerFace` re-exports `Portrait` |
| B10 | `priceEvents` is one setter, wanted by the lucky draw (today) and the mood | 09 | One line in `state/day.ts`: `priceFactor(…) * moodNow(good)` |
| B11 | Days played under `daily` (02's `days` and `seen`), read by 10 and sent by 08 | 02, 08, 10 | **[review]** Its own record, `farm.played`, in `calendar.ts`: the long clock |
| B12 | Spec numbers: 39 is claimed by 01 (appointments), 02 (album), 07 (panels) and 08 (safety); 40 by 02 (season); 41 by 09; 03 and 10 have none | all | `39-panels` (07, as PLAN names it), `40-safety` (08), `41-computer` (09), `42-busy` (01), `43-album` (02), `44-season-road` (02), `45-neighbours` (03), `46-seasons` (10). 04, 05, 06 and 11 add to existing specs. A unit test fails two specs that share a number |
| B13 | `walkInPoses` moved to `helpers.ts` (11) while 08 splits `16-view` | 08, 11 | Both in 08's CI commit (phase 0) |
| B14 | The corner menu: 01's *Next ready*, 02's *Album*, 03's *Neighbours*; 04 gates the badges | 01, 02, 03, 04, 07 | The order in §4 |
| B15 | The top column: 04 reorders it and drops `hint`; 01 adds `set` | 01, 04 | `compass`, `steps`, `toast`, `level`, `busy` (§4) |
| B16 | The card order and budget written twice: `AUTO_CARDS` in the journey, `CARD_ORDER` in the queue | 08, journey | `src/ui/cardQueue.ts`'s pure core. The journey imports it |

### C. Incompatible assumptions

| # | Conflict | Missions | Resolution |
|---|---|---|---|
| C1 | **The touch by tier.** By 06's account, 05's `SHOW` made big `gift` and huge `level`. 06 wants each pattern to mean one thing | 05, 06 | The family picks the pattern and the tier only its strength (`sale` → `sale+`). `SHOW` has no touch column. The map is in §1.12 |
| C2 | **Floors.** 05: a level is at least big, the rest by worth. 06 and 02: the seventh day, the fourth box and milestone levels have floors | 02, 05, 06 | By worth. `least` lives only in `REWARD_KINDS` (level, page and garment big; keys huge) |
| C3 | **The worth of the new prize kinds.** `worthOf` knew coins, goods and materials | 02, 05 | A piece at its shop row's price (0 if not sold); a garment 0, carried by `least` |
| C4 | **06's huge duck** starts 300 ms before a shake | 05, 06 | Roll at the press (as today), shake after; the tier is known at the press |
| C5 | **05's flights land on store chips** that 04's `REVEAL` holds back | 04, 05 | `storeChip()` gives the held slot's box (`top-gauge-slot` keeps its place). The gauge pops in as `got` turns, and the picture lands a moment later |
| C6 | **New things at the top:** 02 adds none; 01 adds a slot | 01, 02 | The busy card is allowed: transient, once a visit, counted by `22-xp`, and it rests the calls |
| C7 | **Order of dependencies:** seasons need days played; the daily week needs the season | 02, 10 | `calendar.ts` with `played` (02, phase 1) before 10's change 1. The daily week on `seasonDay()` comes in 02's change 1, after 10's change 1 |
| C8 | **10's in-season yield** against 01's `full` rule and its 25 beds | 01, 10 | 10's change 6 after 01's crops and `PACE`, and tuned with 01's *Make room* (`JOURNEY.md` fix 5) |
| C9 | **Two garment shows:** the album's and the road's garments against the level's garment show | 02 | A toast and the wardrobe's new mark. The level's show is for level garments only |
| C10 | **The mood** changes every price in `34-events`' comparisons | 09 | Off in tests (`onInPlay('mood')`). `ready()` turns it off |
| C11 | **A time away** files the shop's sales while `stepAt` is null in tests | 09, 08 | `calendarDay()` gives the step's day from the calendar clock (§1.4) |
| C12 | **11's 16 shelves** need `MarketPanel`'s grid at 390×844, which 07 moves | 07, 11 | 07's move first; 11's grid on it |
| C13 | **Cards piling up:** the welcome back, the gift, a season, a letter and an unlock in one morning | 02, 03, 08, 10 | **[review]** `VISIT_MOST = 2`. The season goes into the daily card. The rest wait where they live |
| C14 | **The save's order:** the property test's strict `sameKeys(o, ['id','lines','coins','surprise'])` against 03's optional `from` and `chapter` | 03 | The test line accepts them (§3) |
| C15 | **06's test** fails a `MACHINES` row without `sounds`; 01 adds the dairy and the kettle | 01, 06 | Whoever lands second adds the rows. 01's building commit carries `sounds` if 06's table is in |
| C16 | **`FarmFx.tsx` and `quarks.ts`:** 05's reward request and 10's weather systems | 05, 10 | 10's systems on a `BatchedRenderer` of their own, so the bursts' draw stays one |
| C17 | **The welcome-back card swells:** 01, 03, 04 and 10 each add a row | 01, 03, 04, 07, 10 | **[review, fix 11]** At most 4 picture rows, ranked by worth, plus *Next* (§4) |

### D. Shared budgets

**D1. The farm's sun pass: 233 of 250 draws today.** Every new caster is a draw. The claims, measured or estimated, with
each kind casting through one sun mesh (§1.16):

| Who | What casts | Sun draws | Triangles |
|---|---|---|---|
| today | the farm at its fullest | 233 | 126.8k |
| 11 | the lot's shells as one (−1), one crown (+1), 0–2 hedge pieces | +2 at most | to about 132k |
| 01 | the dairy, the kettle, the beehive's crowd | +3 | under 6k |
| 02 | the banner's crowd (pole and pennant as one sun mesh) | +1 | under 300 each |
| 03 | the mailbox | +1 | small |
| 10 | flower arch, parasol, hay bales, snowman | +4 | under 600 each |
| **left** | | **5** | under 150k |

Without one sun mesh a kind, the banner and the four seasonal kinds would take +2 each and pass 250. The last mission to
land measures `05` and pays any excess. A ceiling is never raised.

**D2. The camera pass.**
- **The yard view** (about 241k of 250k by 10's measure) gets 01's fullest farm (25 beds of the heaviest crop, 5 cows,
  6 sheep, 3 hives, 5 machines), 02's banner, 10's decoration and 10's weather (+4.1k, +2 draws).
- **The lane's views** get 11's car park (+25–48k).
- **`fillFarm` grows with each.** Landing order on the farm's views: 11's sun box (phase 1), then 01's waves, then 02's
  banner, 03's mailbox and 10's decoration, then 10's weather, then 11's cars. The last to land pays, with no new debt.

**D3. `PACE` and `JOURNEY`.** 01 owns them. Each other mission adds rows only, and the first hour's bands hold.

**D4. The top's attention.** At rest, one loop and one "almost" (07).

### E. The same file edited by several missions, in this order

| File, function | Order |
|---|---|
| `grow()` (`state/beds.ts`) | 04's drain at the festival's speed → 01's `water` share → 10's rain (sprinklers absent) |
| `yieldOf` | 01's crops → 10's season |
| `orders.ts`, `makeOrder`, the board | 04's `ORDERS.first` → 01's size by level → 07's board move → 03's `from`, `chapter` and `requests` |
| `Lighting.tsx` | 11's shadow box and map size (phase 1) → 10's `DayLight` look (phase 2) |
| `sun.ts` | 11's `castAsOne` (phase 1) → 08's `farFromCopies` (phase 2); separate functions |
| `sell()`, `sendOrder()`, the shop's and the contractor's sales | one line each, in any order: 05 `rewarded`, 09 `sold`, 03 `befriend`, 06's sound lines |
| `AwayPanel.tsx` | 04's *Next* → 01's rows → 10's rain → 03's letters; 07's frame; at most 4 rows |
| `news/view.ts`, `NewsCard` | 02's kind words and "This season" tab → 10's season section |
| `settings.ts`, `SettingsPanel.tsx` | 04's `learnt` → 06's `motion` and volumes → 08's `counts` → 07's drawer move last |
| `TopStack.tsx` | 04's order → 01's `busy` |
| `decor.ts` `DECOR` | 01, 02 and 10 add optional fields only |
| `unlocks.ts` | 01's cadence and `RecipeKey` first; 03, 10 and 11 add rows |
| `outfit.ts` | 02's `Garment.from` and `owned` |
| `data.ts` `LADDERS.places` | 11's 7 → 13 after 01's `PACE` commit |
| `state/save.ts` `load()` and `fresh()` | one line each, in the order of §3's table; a conflict there is two adjacent additions: keep both |

### F. The order the phases land in

- **Phase 0** (08, one agent, nothing else branches before it lands):
  - `time.ts`, `readyAt` included;
  - `saved.ts`;
  - `quiet.ts`;
  - the state split: core with the two clocks, and `state/rewards.ts` holding today's `give`;
  - CI: `16-view` in three files, `walkInPoses` in `helpers.ts`, `12-models` from the gallery;
  - `PanelGuard`;
  - the card queue with `VISIT_MOST`, onto which `DailyWatcher`, the welcome back and `Unlocked` move.
- **Phase 1** (engines, side by side; inner order):
  - **07:** `still.ts` first. Then `PanelSheet` F1/F2, `calls.ts` and `39-panels`.
  - **02:** `prize.ts`, then `calendar.ts` with `played`, then the goals on `count`, then `road.ts`.
  - **05:** the tier (after 02's `prize.ts`), then reactions, then `Parts.at`.
  - **06:** the table, the mixer and `play(engine)`, reading `still.ts` and `lib/tier.ts`.
  - **03:** `PEOPLE`, then `Portrait` (after 04's commit 1, or never naming `'pleading'`), then `farm.friends`.
  - **09:** `priceOf` on `priceAt`, `priceFor` on `BUYER_OFFERS`, the ledger saved and `sold()` called.
  - **10:** change 1, the season and weather records (after 02's `played`).
  - **11:** the sun box and `castAsOne`, then the lot's rows.
- **Phase 2** (content), with the orders of table E, plus these:
  - **01's `PACE` commit first.** 02's road, 03's story, 05's rewards row, 09's mood, 10's crops in season and 11's
    16 places come after it.
  - **01's long crops** come before 10's crops in season.
  - **03's `PEOPLE`** comes before 11's dealer.
  - **05's `celebrate` wiring** comes before 06's tier stings become audible.
  - **02's news tab** comes before 10's season section.
  - **07's board move** comes before 03's requests.
  - **06's rows** come before 07's settings drawer.
  - **On the farm's views,** the budget order of D2.
- **Phase 3:** the beta check.

## 3. Save fields

Every new or changed field of the farm's save (`FarmData`, `3d-home:farm:v1…`). Each new field:
- is read in `load()` through `saved.ts`, in its own `sanitize…` beside its rules;
- gets its rule in `save.property.test.ts`'s `farmProblems()` (or `placeProblems()`);
- gets its coupling in `alsoChanges()` where it follows another part.

| Field | Owner | Shape | `load()` conversion | `save.property.test.ts` line |
|---|---|---|---|---|
| `played` **[review]** | 02 | `{ days: number; last: number }` | `sanitizePlayed(raw.played, calendarDay(), { days: amount(daily.streak), last: daily.last })`: a farm from before takes its old streak and last claim | `bad('played', sameKeys(p, ['days','last']) && isCount(p.days) && Number.isInteger(p.last) && p.last >= -1 && p.last <= TODAY)`; coupling: `daily.*` → `played` on a save without `played` |
| `daily` (changed) | 02 | `{ last, offered, week, back }`: `streak` goes; `week` is the season's 7 days; `back` is a welcome-back gift waiting | `week` kept only for this season's days (a farm from before: `[]`, its first season begins the day it updates); `back` false when missing | `bad('daily', sameKeys(dl, ['last','offered','week','back']) && day(dl.last) && day(dl.offered) && typeof dl.back === 'boolean')`; `bad('daily.week', dl.week.length <= 7 && dl.week.every(d => d.length <= 3 && d.every(isPrize)))` |
| `seasonRoad` **[review]** | 02 | `{ on: number; xp: number; paid: number }`: the road being filled (a season's ordinal), the XP into it, the stops given on it | missing: `{ on: season ordinal now, xp: 0, paid: 0 }`; `on` never past the season now; `paid` ≤ the stops `xp` reaches; never reset by the calendar | `bad('seasonRoad', sameKeys(r, ['on','xp','paid']) && isCount(r.on) && r.on <= seasonDay().ordinal && isCount(r.xp) && isCount(r.paid, SEASON_ROAD.length) && r.paid <= reached(roadOf(r.on), r.xp))`; coupling: `played`, `season` → `seasonRoad` |
| `album` | 02 | `{ seen: string[]; done: string[] }`: tiles shown as earned, pages whose garment was given | known ids, each once; missing: `{ seen: [], done: [] }` | `bad('album', sameKeys(a, ['seen','done']) && unique(a.seen) && a.seen.every(isTile) && unique(a.done) && a.done.every(isPage))`; coupling: `album` → `outfit` (a page done owns its garment) |
| `charm` | 02 | `{ told: number }`: the highest rank already toasted | missing: the rank the farm has now (no toast for a rank reached before the update) | `bad('charm', sameKeys(c, ['told']) && Number.isInteger(c.told) && c.told >= -1 && c.told < RANKS.length)`; coupling: `layout`, `home` → `charm` on a save without it |
| `outfit.owned` | 02 | `string[]`: garments not from a level, in the order they came | known garments with a `from` other than a level, each once; missing: `[]`. A garment may be worn if its level is reached **or** it is owned | `outfit` gains `'owned'` in `sameKeys`; `wears()` accepts `owned`; `bad('outfit.owned', unique(o.owned) && o.owned.every(isGiftGarment))` |
| `layout.decor[].look`, `layout.storedLooks` | 02 | `look?: string`; `storedLooks: Partial<Record<ShopKind, string[]>>` | a look kept only on a kind whose row has `tints` (or the banner's seasons); each list no longer than `stored[kind]` | `placeProblems`: decor's `sameKeys` allows `look`; `bad('layout.storedLooks', each list ≤ stored[kind] && each look of its row)` |
| `goals.fruit` | 02 | a step, as every goal | a missing id on a save that has goals starts at `startStep` (no past deeds paid again) | unchanged (`sameKeys(goals, GOAL_IDS)`); coupling: `got` → `goals.fruit` on a save without it |
| `friends` | 03 | `Partial<Record<NeighbourId, { points: number; told: number }>>` | only neighbours met (`story`); counts; `told` ≤ `heartsOf(points)`; missing: `{}` | `bad('friends', Object.entries(fr).every(([id, x]) => isNeighbour(id) && met(id) && sameKeys(x, ['points','told']) && isCount(x.points) && isCount(x.told, heartsOf(x.points))))`; coupling: `story` → `friends` |
| `mail` | 03 | `{ waiting: Letter[]; read: Letter[] }`, `Letter = { id: string; from: PersonId; prize?: Prize }` | known letter ids, each once across both; `read` the last 30; prizes through `savedPrize`; missing: empty | `bad('mail', unique(ids) && ids.every(isLetter) && m.read.length <= 30 && every prize isPrize)` |
| `story` | 03 | `{ done: ChapterId[]; on: ChapterId \| null; sent: boolean }` | `done` a prefix of `CHAPTERS`; `on` the next or null; missing: fresh (a level-30 farm gets chapter 1, then the rest in turn) | `bad('story', isPrefix(s.done) && (s.on === null \|\| s.on === nextAfter(s.done)) && typeof s.sent === 'boolean' && (s.on !== null \|\| !s.sent))` |
| `requests` | 03 | `Order[]`, at most one, its `chapter` the chapter on | only for `story.on`; lines as the chapter asks, with `have` ≤ `want`; missing: `[]` | `bad('requests', r.length <= 1 && r.every(o => o.chapter === farm.story.on && lines ok))`; coupling: `story` → `requests` |
| `orders[k].order.from`, `.chapter` | 03 | optional `PersonId`, `ChapterId` | `from` kept only for a neighbour met; `chapter` never on the board (requests hold chapters) | `orders.k: an order`: `sameKeys` accepts the optional `from`; `bad('orders.k.from', o.from === undefined \|\| met(o.from))` |
| `queue[k].who` (the saved line) | 03 | optional `NeighbourId` | a neighbour met, once in the line; else a stranger | `bad('buyer who', v.who === undefined \|\| (met(v.who) && unique whos))` |
| `ledger` | 09 | `Ledger` (`src/farm/ledger.ts`) | `sanitizeLedger(raw.ledger, calendarDay())`; missing: empty | `bad('ledger', days ascending, unique, within LEDGER_DAYS of TODAY, none empty, every tally two counts, soldAt(good, channel))`; coupling: `time` → `ledger` (the shop's sales while away) |
| `season` | 10 | `SeasonRecord { from: number; told: number }` | `sanitizeSeason(raw.season, data.played.days)`; missing: its first spring begins today | `bad('season', sameKeys(s, ['from','told']) && Number.isInteger(s.from) && s.from >= 1 && s.from <= Math.max(1, farm.played.days) && Number.isInteger(s.told) && s.told >= -1 && s.told <= seasonAt(farm.played.days, s.from).ordinal)`; coupling: `played`, and `daily` on a save without `played` → `season` |
| `beds[i].seasonal` | 10 | `boolean` (sown in season) | `!!b.seasonal && crop !== null` | `beds.i: its fields` gains `'seasonal'`; `bad('beds.i.seasonal', typeof b.seasonal === 'boolean' && (!b.seasonal \|\| b.crop !== null))` |
| `car` | 11 | `{ owned: PaintId[]; worn: PaintId }` | missing: `{ owned: ['red'], worn: 'red' }`; `owned` in `CAR_PAINTS` order, red always; `worn` owned | `bad('car', sameKeys(c, ['owned','worn']) && json(c.owned) === json(CAR_PAINT_IDS.filter(p => c.owned.includes(p))) && c.owned.includes('red') && c.owned.includes(c.worn))` |
| `expansions.north`, `.meadow`, `.far` | 01 | `boolean` | `!!raw.expansions?.[k]` | `sameKeys(farm.expansions, EXPANSION_IDS)` in place of the literal `['east','west']` |
| `machines.dairy`, `.kettle` | 01 | `MachineState` | `savedMachine` (missing: fresh) | generic (`MACHINE_IDS`) |
| `producers.beehive` | 01 | `ProducerState`, one per hive standing | `fitPlants`, as the fruit plants | generic; the coupling `layout` → `producers.…(tree\|bush)` gains `beehive` |
| `inv`, `got` (new goods) | 01 | a count each | 0 for a good missing | generic (`PRODUCE`) |
| `layout.places` (dairy, kettle) | 01 | a place each | their home spots when missing | generic (`PLACE_IDS`) |
| `ladders.places`, `market.shelves` | 11 | top 13; 16 shelves | `clampLevels` (new top); `sanitizeMarket` pads to `MAX_PLACES` (the six new ones empty) | generic (`LADDERS`, `MAX_PLACES`) |

**Not in the farm's save:**
- **The device's settings** (`3d-home:settings:v1`, merged with the defaults, guarded by `src/settings.test.ts`):
  - `learnt: { stick: boolean; look: boolean }` (04);
  - `motion: MotionPref`, `effectsVolume`, `ambienceVolume` (0–1, default 1) and `musicTrack: number | 'auto'` (06);
  - `counts: boolean | null` (08, decision 20; null until asked).
  - `headBob`'s default follows `motion`.
- **08's keys beside each slot:** `<slot key>:broken`, `<slot key>:prev` and `<slot key>:stamp`; and
  `3d-home:counts:last`.
- **Worked out and never saved:**
  - 04: `REVEAL`, and the starter order (`ORDERS.first`, placed in `load()` by a condition that can apply only once);
  - 05: reactions and reward counts;
  - 10: the weather;
  - 11: the car park's stage and the cars;
  - 01: the busy card's "shown this visit".

**The clash check.** After the update, `FarmData` has 11 new top-level keys: `played`, `seasonRoad`, `album`, `charm`,
`friends`, `mail`, `story`, `requests`, `ledger`, `season` and `car`. Each appears once.
- **The two clashes in the missions** are settled above: `season` (02 against 10, A5) and `people` (03 against the cast,
  A12).
- **No new key shadows** a saved extra (`time`, `queue`, `xp.curve`).
- **Same name, different records:** `told` is in `charm`, `season` and `friends`, a different record each. `last` is in
  `played` (the last day played) and `daily` (the last day claimed). The comments must say which.

## 4. What opens by itself, and what sits at the top

**1. Before the game:**
- the start menu;
- a slot that cannot be read: "This farm could not be read", in the saves list (08);
- the drive's film and the story films.

None of them is queued; each holds the queue until it is over.

**2. Cards that open by themselves** (`cardQueue`): one at a time, each only when the game is free and a 900-ms beat
has passed, and at most `VISIT_MOST` (2) a visit, the welcome back counted. **[review]**

| # | Card | Opens | Else it waits |
|---|---|---|---|
| 1 | `away`: welcome back | a return of 2 min or more, with news | — |
| 2 | `daily`: the day's gift, with the season's line and the welcome-back gift | the first view of a day played, after the visit the steps ended in | in the corner menu |
| 3 | `unlocked`: what a level opened | after the level's show and its garment, in the top slot | on the level chip |
| 4 | `letter`: the first letter only | the visit after the steps end | on the mailbox's flag, and the compass |
| 5 | `counts`: 08's question (only if decision 20 is yes) | once, from the second visit | in Settings |

**3. The top column** (`TopStack`, in this order): `compass` 1, `steps` 2, `toast` 3, `level` 4, `busy` 5.
- 04 drops `hint` (the controls are taught in place).
- The busy card shows only with no card up.
- `22-xp` checks every box, upright and sideways.

**4. The toast slot** holds one toast at a time:
- 02: a season road's stop, an album page's garment, a charm rank;
- 03: a heart;
- 08: "That didn't open properly" and a full storage (once);
- 05: the words of a reward.

**5. The corner menu, top to bottom:**
1. the daily gift, while it waits;
2. *Next ready 0:40*, while the farm is busy (01: a line, not a button);
3. the farm news, with "This week" and "This season" (02) tabs and 10's season section;
4. *Album* (02);
5. *Neighbours* (03), once one is met;
6. edit or decorate;
7. the top's view;
8. settings, with 04's *Show the tips again*, 06's *Less motion* and volumes, and 08's counts.

The badges are as CLAUDE.md says, gated by `shows('news')` and `shows('gifts')`.

**6. The attention budget** (`CALLS`, one moves at a time): daily gift → the level's boxes → a goal to claim → the one
nearest "almost" → news → the compass's walk (a letter waiting is the mailbox's mark) → the thing's tag. All rest while
the busy card shows.

**7. Inside the welcome-back card:**
- at most 4 rows of pictures, ranked by worth: goods, buyers and orders, the shop's till, letters (03);
- the rain line (10), only on a farm without sprinklers;
- then *Next* (04's `nextUp`) with *Go there*;
- one line of text, two buttons. **[review]**

**8. Inside the news card:** 10's season section at the top of "Now" ("Spring · day 3 of 7", then "Next: summer"),
then the events now in 02's kind words, then coming soon, then the lucky draw's reels. The "This season" tab is the
season road.

## 5. The new modules in `state.ts`'s split

08's split: `src/farm/state/<module>.ts`, with `src/farm/state.ts` as the one import, ending with `start()`. The import
rules:
- **`core.ts`** is imported by everything.
- **`rewards.ts`** imports only `core.ts`.
- **`ledger.ts` and `neighbours.ts`'s `befriend`** are called by the sale modules, never the other way.
- **No module reads `farm` at its top level.**
- **`tick.ts`** calls each module's `grow`.

| Module | Holds today (08's plan) | The update adds (mission: what) |
|---|---|---|
| `core.ts` | the farm, `bump`, `save`, toast, dice, the two device clocks, the locks | 08: the step's day during a time away; `onInPlay` switches |
| `save.ts` | `fresh`, `load`, `saveNow`, slots, export, import | 08: `:broken`, `:prev`, the tab's stamp; every mission: one line in `fresh` and one in `load` for each §3 field |
| `rewards.ts` (new) | today's `give` | 02: `give(prizes, kind, at)` for every prize kind; 05: `rewarded`, `rewardCounts` |
| `stores.ts` | the silo and the barn, `putBack` | 05: `store(id, n, at?)` asks for a flight; 01: *Make room* (`JOURNEY.md` fix 5) |
| `beds.ts` | beds, their part of `grow`, `yieldOf` | 04: the drain; 01: `water`, long crops; 10: rain, `seasonal` at sowing, the yield; 05: `react` in harvest, plant, water |
| `producers.ts` | the tree, hens, cows, sheep, tools, skins | 01: herd steps, the beehive; 05: pick and wiggle |
| `machines.ts` | the mill, the loom, the oven, their queues | 01: the dairy, the kettle, recipes |
| `shop.ts` | the farm shop, land, layout | 01: the new expansions |
| `decor.ts` | decoration, fruit plants, the house's furniture | 02: looks, paint, charm's toast; 10: seasonal decoration on sale; 05: settle |
| `buyers.ts` | the line at the gate | 03: `who`, neighbours at the gate through `whoComes`; 09: `BUYER_OFFERS`, `sold('gate')` |
| `orders.ts` | the board, the office, the tractor | 04: `ORDERS.first`; 01: size by level, the quick slot; 03: `from`, `requests`; 09: `sold('order')` |
| `levels.ts` | XP, levels, the level's gifts, goals, the wardrobe | 02: the season road fed in `gainXp`, `goals.fruit`, `outfit.owned`; 04: the starter gift and *Claim all* |
| `seasonRoad.ts` (new) **[review]** | — | 02: the season road's stops, through `give` |
| `album.ts` (new) | — | 02: pages done, a frame later from `tick` |
| `daily.ts` | the daily gift | 02: `markPlayed` (days played), the week on `seasonDay()`, the welcome-back gift |
| `neighbours.ts` (new) | — | 03: `befriend`, visits, mail (`deliver`, `readLetter`), the story a frame later, requests, birthdays |
| `market.ts` | the supermarket and its people | 11: 16 places, two tills, the café, `MOST_INSIDE`, cars at bays; 09: `sold('manager' \| 'shop')` |
| `contractor.ts` | the contractor, the estate agent | 09: `sold('contractor')`; 11: the office's map tags (`buyLand`) |
| `car.ts` (new) | — | 11: `buyPaint`, `wearPaint` |
| `ledger.ts` (new) | — | 09: `sold`, `ledgerNow` |
| `day.ts` | the day, the week's events and their clock, the lucky draw, the news | 09: the mood in the `priceEvents` line |
| `season.ts` (new) | — | 10: `seasonNow`, `seasonDay`, `weatherNow`, `setSeason`, `setWeather`, the season told |
| `steps.ts` | the first steps | 04: the turns, `shows(part)`, `resumeSteps`, the steps' end over three visits |
| `tick.ts` | `tick`, and `grow` calling each module's | — |
| `away.ts` | `goOn`, `cameBack`, `AwayReport` | 01: `AWAY_MOST` 24 h; 10: `rained`; 03: `letters` |

## Scaffold (approved and written)

The contracts as code: types, tables and pure functions, each with its unit test (687 lines, and 770 of tests).
- **Invisible and imported by no game file.** Nothing that exists changed. The old copies stay until each owner's
  commit moves its callers (above, "Two homes for a while").
- **No three.js, no DOM, no React, no save, and no new package.** `src/deps.test.ts` is untouched; the tests read the
  game's modules only to hold the copies equal.
- **`npm run check` is green.**

| File | What it holds | Its test |
|---|---|---|
| `src/lib/time.ts` | `clock`, `span`, `readyAt` (§1.1) | `time.test.ts`, as a table: 59.5 → 1:00; 3725 → 1:02:05; NaN, negative → 0:00; never :60; each `span` form; `readyAt` past midnight, a weekday, 12 and 24 h |
| `src/lib/saved.ts` | the readers (§1.2) | `saved.test.ts` (fast-check, 1,000 runs): each reader equals the copy it replaces (`state.ts`'s, the ledger's `whole`, the gifts' `whole`) and keeps its range on anything |
| `src/lib/quiet.ts` | `onInPlay`, `onHere` (§1.3) | `quiet.test.ts`: on in play, off in test, off on `?debug` unless `&x=on`; equal to today's three functions on 11 pages, in a test and out |
| `src/lib/tier.ts` | `TIERS`, `Tier`, `Family`, `REWARD_KINDS`, `RewardKind`, `REWARD_KIND_IDS`, `rewardKind`, `tierRank`, `atLeast` | `tier.test.ts`: every kind has a family; floors only on level, page, garment and keys; `atLeast` |
| `src/farm/worth.ts` | `TIER_AT`, `worthOf`, `rewardTier` | `worth.test.ts`: the worth of coins, goods (fair, never an event's), materials, pieces and garments; the bounds; floors; the same sale smaller as the level rises |
| `src/farm/prize.ts` | `Prize` (four kinds), `PrizeKind`, `prizeKind`, `savedPrize`, `looksOf`, `isGiftGarment`, `prizeWords`, `sized` | `prize.test.ts`: `savedPrize` equals `gifts.ts`'s on coins and goods (fast-check, 2,000 runs); pieces and garments read; `sized` gives `dayCoins`' and `boxCoins`' numbers at every level |
| `src/farm/calendar.ts` | `dayNumber`, `dayStart`, `dateKey`, `dateOf`, `Played`, `freshPlayed`, `markPlayed`, `sanitizePlayed`, `LONG_CLOCK`, `longDay` | `calendar.test.ts`: equal to `daily.ts`' and `events.ts`' copies every hour across two years; days played once a day, never back, the gap; sanitize, and the old streak's conversion |
| `src/farm/road.ts` | `Road`, `stops`, `reached`, `nearest`, `ALMOST` | `road.test.ts`: rising stops; reached at, before and after each; the next stop and "almost"; the daily week as a road of 7 |
| `src/ui/still.ts` | `MotionPref`, `isStill`, `lessMotion`, `setMotionPref`, `onLessMotion` (no hook and no `data-motion` yet: 07's) | `still.test.ts`: the choice × the device; listeners told once a change, from the setting or the device, and not after they stop |
| `src/ui/cardQueue.ts` | `CARD_ORDER`, `CardId`, `VISIT_MOST`, `AFTER_STEPS`, `QueueNow`, `nextCard` (the pure core) | `cardQueue.test.ts`: the order; none while one shows or the game is busy; two a visit, the welcome back counted; none twice; only `away` the visit the steps end |
| `src/ui/calls.ts` | `CALLS`, `CallId`, `BUSY_RESTS`, `calling` (the pure core) | `calls.test.ts`: ranks unique; the highest that applies wins; none, or the busy card, → null |
| `src/audio/sounds.ts` | `SoundFamily`, `Twin`, `Feel`, `SoundRow`, `SOUNDS` (today's 26 sounds), `rewardFeel` | `sounds.test.ts`: a row for each sound; each row's touch is today's `FEEL`; cues and "no"s never vary; only ambience has no twin; a reward's touch changes with its tier only from `sale` to `sale+` |
| `src/data/people.ts` | `PersonDef`, `PEOPLE` (the five of today), `PersonId`, `PERSON_IDS`, `NeighbourId`, `personById`, `steadyLook`, `personLook`, `talkerOf` | `people.test.ts`: the looks equal `film/cast.ts`'s, `tractor.ts`'s and the agent's captured from `state.ts`; the voices equal `VOICES`, `AGENT` and `DRIVER`; names unique |
| `src/specs.test.ts` | — | no two e2e specs share a number (B12) |

**Left out, on purpose:**
- **Wired, or drawn:** the state split, `PanelGuard`, `CardWatcher`, `useCalling`, `useLessMotion`, `PanelSheet`'s
  new props, `give`, `rewarded`, `celebrate`, `Portrait`, `seasonNow`.
- **Each owner's first commit:** reactions, `measure.ts`, `seasonRoad.ts`, `friends.ts`, `mood.ts`, `palette.ts`.
- **Already written by its mission:** the ledger, `priceAt`, season, weather, the sun box, park.
- **The journey scaffold's to write, if approved:** `src/sim/sessions.ts`, to §1.17's contract.
