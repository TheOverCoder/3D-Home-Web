# Mission 09: the house's computer

**Goal:** a computer in the house that shows, for every good, what it is worth now at each place it can be sold, why,
and where it is heading, so the house becomes the place you go to plan.

**How a player will feel it:** in the evening you drive home, sit at the computer and read the day. Tomatoes are up
8 % and still rising. Strawberries are on the lucky draw. Cloth pays most at the orders, and pumpkin is the best thing
to plant before an hour away. You drive back knowing what to plant and where to sell. If you never open it you lose
nothing: it only makes you better at the game you already play.

## Principles applied

- `psychology.md` §1.1: the numbers make the player capable (competence), and every choice stays theirs (autonomy).
  §1.2: optimising is opt-in, and the default game stays easy. §1.8: a steady visit (the morning paper) is a habit
  cue, not a nag. §1.9: tomorrow's price is a small gap that closes soon.
- `psychology.md` §1.6, Top 10 #5 and §2 #4, #5: a buyer's offer odds are shown on screen. Prices move by the date
  alone, never by chance, and tomorrow is shown, so watching them is planning, not a gamble. No "sell now or lose it",
  and nothing new is time-limited (the Saturday draw stays the only one-day price). §1.13: the computer gives no XP and
  no check-in reward.
- `farm-games.md` P5: several channels, each with its own reward; the computer makes their differences readable. P1:
  the market's mood is two numbers. P6: the 4,000-coin house gets a use. P7: holding goods for a better day is a choice
  that never blocks. P14: nothing new on the farm's HUD.
- `ftue-ux.md` §1.5: depth lives in the house, away from the first screen, for players who look for it. §1.8: text of
  15 px or more, every icon with a word.
- `feel-sound.md` §9: muted first, so every chart has its numbers in words. §11: inline SVG; animate only transform
  and opacity.

## Foundation first

**What the game computes today** (`priceOf` in `src/farm/prices.ts` = fair price × (1 + the maker's level boost,
0–100 %, `machineView.ts`) × the draw's ×2):

| Place | Pays a unit | Also | Code |
|---|---|---|---|
| Buyer at the gate | `priceOf` × 0.6 / 0.85 / 1 / 1.25 / 1.6 (odds 15 / 23 / 28 / 20 / 14 %, mean **1.04**), drawn on arrival | a gift 1 in 2 (×2 on Thursday); buyers ×2 on market days; XP = coins ÷ 5 | `priceFor`, `state.ts` (on `Math.random`, not the farm's dice) |
| Order | `priceOf` × 1.25, fixed when the order comes (the draw raises it) | a gift 1 in 2; +5 XP | `orderPay` |
| Manager (the shop not yours) | `priceOf` × 20–40 % | instant, any amount | `managerPay` |
| Your shelves | `priceOf` × 90–300 %, as you set; a shopper takes a unit with a 90 % → 4 % chance | a visit every 150 → 30 s, 1–4 shoppers | `unitPrice`, `buyChance` |
| Contractor (materials) | buys at 10; sells at 100 → 50 | — | `CONTRACTOR`, `piecePrice` |

Nothing moves day to day except the Saturday draw, and machine levels over weeks. An index today would be a flat line,
which is why decision 1 exists. Some numbers the computer would show from today's tables (my sums):
- **Beds, coins a minute (and a harvest):** lettuce 13.3 (10), tomato 9.5 (19), carrot 8.6 (10), strawberry 8.0 (12),
  corn 7.6 (19), pumpkin 7.2 (24), wheat 6.0 (8), sugar cane 3.4 (8).
- **Machines, value added a minute (and a job):** cloth 100 (+10), sugar 45 (+3), lemon cake 42 (+21), strawberry
  cake 39 (+23), carrot cake 36 (+21), flour 30 (+2), pumpkin pie 28.5 (+19).
- **A carrot cake (40), one shopper a visit:** gate about 42 (24–64), order 50, manager at 30 % 12. On your shelf at
  150 % it sells for 60, about 7 min a unit; at 300 % for 120, about an hour a unit.

**What to add** (each has two uses or more now):
- **F1. `priceAt(good, more, factor)`** in `prices.ts`: the price with its parts given. `priceOf` calls it with the
  farm's hooks, and the views call it with a farm's own numbers. So the computer can never disagree with a sale.
- **F2. `BUYER_OFFERS`** in `data.ts`: the five factors and their odds as rows. `priceFor` reads them, the gate's row
  shows them, and 03's neighbours draw from the rows ≥ 1.
- **F3. The sales book, `farm.ledger`** (`src/farm/ledger.ts`): for each of the last **14** calendar days (the device's,
  `dayNumber`), each good and each channel, the units and coins. 14 days, because 7 is too short for a trend and 30
  makes the save heavier: about 2 KB in play, 30 KB at most. It is kept on every farm from the update on, so the
  computer has a fortnight of records the day it is bought. `load()` converts it with `sanitizeLedger` (an older farm
  gets an empty book). Uses: the Sales book, and your own trend and index.
- **F4. The town's market mood** (`src/farm/mood.ts`, decision 1). Each sellable good's price × `moodOf(good, day)`:
  ±10 %, half a shared wave of about two weeks and half each good's own wave of 7–11 days, seeded by the date and the
  good. It is the same on every farm for a date, needs nothing in the save (any day, past or tomorrow, is computed), and
  never falls because you sold. It is judged at `eventTime()`, so it is off under Vitest and `?debug` like the events,
  with its own switch for specs that set a clock. It enters through the existing `priceEvents` hook in `state.ts` (one
  line). Materials are never affected. The **vegetable index** is 100 × the mean mood of `CROPS`. Uses: every sale's
  price, the computer's index, trends and forecast, and the monitor's screen.
- **F5. The views** (`src/farm/computer/`), pure like `levelView`:
  - `marketView(farm, now)` gives each good: its base, its price now, the factors (machine level, draw, mood), each
    channel's price a unit with its XP, gift odds and wait, `best` (pays most) and `soonest`, what the line and the
    open orders want of it now, its lock, a trend (the last 7 days and tomorrow), and the index;
  - `planView`: every crop and recipe by coins a minute and a press, at today's prices and speeds;
  - `bookView`: the ledger by day and channel;
  - `APPS`: the desktop's apps as rows (a new app is a row).

  `now` is `{ at: eventTime(), day: calendarDay() }`.

## Changes

| # | What the player sees | Files, functions | Rows / data | Tests | Size, risk |
|---|---|---|---|---|---|
| 1 | Nothing (prices with named parts) | `prices.ts` `priceAt`, and `priceOf` on it; `data.ts` `BUYER_OFFERS`; `state.ts` `priceFor` reads it (the same dice) | 5 rows | `prices.test.ts`: `priceOf` = `priceAt` for every good on three farms; the odds sum to 1 and the mean is 1.0395; today's state tests unchanged | S, low |
| 2 | Nothing yet: sales are written in the book | new `ledger.ts`; `state.ts`: `FarmData.ledger`, `fresh`, `load`; `noteSale` in `sell`, `sendOrder` (split by line, by each line's share), `sellManager`, `shopperBuys` (`rollShopper` returns coins per place) and the contractor's buy; a time away files each step on its own day | `LEDGER_DAYS = 14` | `ledger.test.ts`; `state.ledger.test.ts`: each of the five ways, a decline notes nothing, the shop's sales while away; `save.test.ts`: an old save gives an empty book and garbage gives an empty one; `save.property.test.ts`: the book's rules | S–M, low |
| 3 | Prices move a little each day, the same on every farm | new `mood.ts`; the `priceEvents` line in `state.ts`; `__home.events.mood(on)`; `ready()` and `bootApp` turn it off | `MOOD = { amount: 0.1, shared: 0.5, waves: [13, 7–11] }` | `mood.test.ts`: the same date gives the same mood; within ±10 %; no day-to-day step over 7 %; the mean over any 8 weeks within 1 %; off gives 1; materials never; `34-events` keeps the mood off (it compares a drawn good with the events off); `npm run sim` on 08's runner on every weekday: `PACE` holds, and 14 days' income is within ±2 % of the mood off | M, medium (every price; the sim). Only on decision 1 |
| 4 | Nothing (the views) | `computer/marketView.ts`, `planView.ts`, `bookView.ts`, `apps.ts` | `APPS` | for each sellable good on three farms, each channel equals the game's own function (`orderPay`, `managerPay`, `unitPrice`, `buyChance`, `piecePrice`); `best` is the highest a unit; oven level 2 shows +20 %; a drawn good shows ×2; the beds and machines above as a table test; compost ×1.5, the festival and the rush ×2 | M, low |
| 5 | A **Computer** in the furniture shop (Tables), and a price tag on the studio's desk while the house has none. Bought, it stands at the free spot nearest; pressed (*Use the computer*), you turn to its screen and the desktop opens | `catalogue.ts` (`computer`: price, size, weight); `Furnishings.tsx` `PieceModel` (built of `B` boxes like the desk; its screen a 256×150 canvas like `Market.tsx`'s, the index and its arrow, drawn on `rev` at most once a second and only in its room); new `src/home/Computer.tsx` (the action, like `WardrobeAction`; the desk's tag opens `BuyPiece`, then `freeSpotFor`); `Experience.tsx` mounts it on `home`; `store.ts` `Panel` `{ kind: 'computer'; piece }`; `FarmUI.tsx` | its picture (`render-furniture-art.mjs`) | `layout.test.ts` (picture, weight, a full room refuses it); `05`'s furniture check with one placed (it reads today's house, which has none); `25-button`'s farm with plenty owns one in the house | M, low–medium |
| 6 | The desktop and the **Market** app (below) | `computer/ComputerDesk.tsx` + `.css` (fed by `computerView`, so the lab shows it as it is), `Window.tsx` (Radix Tabs), `charts.tsx` (inline SVG: sparkline, line with a baseline, stacked bars), `ComputerPanel.tsx` (reads the farm) | 4 Fluent pictures (below) | e2e `41-computer` (below); `39-panels` (07) measures the `computer` kind | L, medium (a new look at phone sizes) |
| 7 | The **Planner** and the **Sales book** | the same folder | — | `41-computer` opens every tab | M, low |
| 8 | — | `CLAUDE.md` (a section "The house's computer": every sale notes the book, a new channel is a row of the views, the mood's switch), `tests/README.md` rows | — | — | S |

**The computer, screen by screen** (phones first; targets 48 px, words 15 px or more):
- **The sheet** (`PanelSheet`): the picture `desktop-computer`, the title *Computer*, and chips for the coins and the
  clock (the device's time and the farm's hour).
- **The desktop** is the sheet's body:
  - a wallpaper in the colours of the farm's day phase (`DAY`, from tokens);
  - a *Today* widget: the index with its arrow and 7 days, the draw's goods as `GoodPic`, and one line each for "Pays
    most now" and "Best bed";
  - three app icons (64 px pictures, each with its name);
  - a dock: at the bottom when upright, a rail on the left when sideways.
- **A window** is a `.paper` card. Its title bar has the app's picture and name and ← back to the desktop, then its
  tabs; its content scrolls. It fills the desktop upright and sideways, one at a time, and floats at 640 px on a
  computer. Esc closes the window, then the computer.
- **Market** has two tabs.
  - *Prices*: every good the farm knows, with locked ones last (`LockTag`) and materials apart. Sorted by store or by
    today's move. Each row: `GoodPic`, its name, a 7-day sparkline with tomorrow's dot, the price now and its move from
    fair (▲ 8 %).
  - A tap opens the good's page:
    - each channel's coins a unit, XP, gift odds and wait, with *Pays most* and *Sells soonest*;
    - *Why today* chips (Oven Lv 2 +20 %, Lucky ×2, Market −4 %);
    - your shelf price against its wait, as a small curve from 90 to 300 %;
    - its 14 days, with your own sales as dots by channel.
  - *Index*: the vegetable index over 14 days and tomorrow, with the 100 line, and today's movers in the basket.
- **Planner** has three tabs.
  - *Asked*: what the line and the open orders want now, against what you have, with the largest shortage first.
  - *Beds*: every crop by coins a minute a bed, and a harvest.
  - *Machines*: every recipe by what a job adds and what a minute adds, at the machine's level, and how many you could
    make now. Locked rows show their level.
- **Sales book** has two tabs.
  - *Days*: 14 days of coins, stacked by where you sold; the week's total per place; and your price index (what you
    got against fair).
  - *Goods*: each good sold: units, coins, your average a unit, and where.

**e2e `41-computer`** (the next free number: 39 and 40 are taken by 01, 02, 07 and 08), in the house
(`game.ready('home')`):
- the computer is bought from the shop, and once more from the desk's tag;
- `E` opens the desktop, and every app and tab opens;
- the Market's lettuce equals `priceOf('lettuce')`, read in the same `evaluate`;
- with a Saturday clock and the draw made, a drawn good shows ×2;
- Esc closes the window, then the computer;
- all of it at 390×844 and 844×390, with no console errors.

No change to `16-view` (a bought piece is not in the house's poses) or to the farm's HUD.

## Order of commits

1. Change 1, priceAt and the offers' table. *(Invisible.)*
2. Change 2, the book. *(Invisible: it fills from here on.)*
3. Change 4, the views. *(Invisible.)*
4. Change 3, the mood, once decision 1 is yes and after 01's `PACE` commit, with `npm run sim`.
5. Changes 5 and 6 together: the computer, the desktop and the Market. This is the first commit a player sees, with
   `41-computer`, `25-button`, `15-decorate` and `05`'s weight check.
6. Change 7, the Planner and the Sales book.

Change 8 lands with each rule it describes.

## Overlaps

- **08:** lands `state.ts`'s split, `saved.ts` and `time.ts` first. `noteSale` goes into the modules of the sale paths
  (buyers, orders, market, contractor), `sanitizeLedger` reads with `saved.ts`, and "about 7 min" is `span()`.
- **01:** owns `PACE` and the prices of new goods. New crops and recipes join the views by being rows. `economy.ts`
  holds the laws (targets), and `planView` the farm's numbers now. 01's `LEAVING` list may rank jobs with `planView`'s
  per press. 01's savings line can name the computer after the house. The mood's sim check runs in 01's `PACE`.
- **03:** `BUYER_OFFERS` is the table the neighbours draw from. `sell()` and `sendOrder()` get one line from each
  mission (`befriend`, `noteSale`).
- **07:** the desktop is built on `PanelSheet` after 07's F1. `PANEL_KINDS` gets `computer`, and its words pass
  `readable.ts`. `PanelSheet` must let an open window take Esc first (`above()` learns `.pc-window`): one line in 07's
  file.
- **06:** optional sound rows (a soft key and a power-on chime). **02, 04, 05:** no shared files; 02's counts may read
  the book later.

## What is missing

**Decisions only the user can make** (my recommendation in bold):

1. **Prices that move:** the town's market mood (±10 %, in waves of one to two weeks, the same on every farm for a
   date, never because you sold)? **Yes, ±10 %**, or ±20 %. If no, prices stay as today, and the index and trends come
   from your own sales (your coins against fair).
2. **Show tomorrow's prices (a forecast)?** **Yes**: it turns the mood into planning, not a gamble.
3. **The computer's price:** **500** (about 6 minutes of income at level 15), 1,000, or free with the house.
4. **Where it is bought:** **the furniture shop, plus a price tag on the studio's desk** until the house has one; or
   the shop only.
5. **The apps:** **Market, Planner and Sales book**, or the Market alone first.
6. **One `ui` board in the lab first** (the interface designer, one proposal, phones upright and sideways)? **Yes.** A
   desktop is a look the game does not have. CLAUDE.md starts a designer only when you ask in so many words, and "a
   designed way" is close but not that. If no, it is built straight in the game's look.
7. **Names:** **accept** Computer, Market, Planner, Sales book and "Vegetable index", or rename them.
8. **The four wall screens** keep their placeholder portfolio copy (`src/data/screens.ts`) for now? **Yes.** Giving
   them the farm's story is a later mission.

**Libraries:** none. Charts are inline SVG. Tabs come from `radix-ui` (already installed), and percents from
`Intl.NumberFormat`.

**Skills, knowledge and docs:**
- this session's `dataviz` skill (sparklines, a line with a baseline, stacked bars, colours in both themes);
- `lab/README.md` and `artifact-capabilities` for the board;
- Radix Tabs and the WAI-ARIA tabs pattern;
- `scripts/render-furniture-art.mjs`;
- CLAUDE.md "The house's furniture" and "Two maps".

**Assets:** Fluent Emoji 3D (MIT): *chart increasing*, *bar chart*, *ledger* and *light bulb*, as 128 px WebP from
`raw.githubusercontent.com/microsoft/fluentui-emoji`, credited in `src/data/credits.ts`. The computer is modelled in
code, and its picture rendered from it.

**Access:** nothing blocked. The four pictures answered 200 from `raw.githubusercontent.com` (checked 2026-11-18).

## Done when

- **Unit:**
  - `priceAt` equals `priceOf` for every good on three farms;
  - every channel of `marketView` equals the game's own function;
  - `planView` matches the beds and machines above;
  - the book's and the mood's tests pass;
  - `save` and `save.property` are green with the book.
- **`npm run sim`** (with the mood): `PACE` holds on every weekday, and 14 days' income is within ±2 % of the mood off.
- **e2e green:** `41-computer`, `25-button`, `15-decorate`, `05`'s furniture weights, `34-events`, and `39-panels`
  with no debt for `computer`.
- **Screenshots at 390×844 and 844×390:** the desktop, *Prices*, a good's page, the *Index*, the Planner's *Beds*, and
  the Sales book's *Days*.

## Scaffold proposal

All of it is new files, plus two pure additions to existing ones. Nothing is wired to the game, no player sees
anything, and `npm run check` stays green. About 600 lines with the tests, in one commit.

| File | What it holds |
|---|---|
| `src/farm/prices.ts` (+) | `priceAt(good, more, factor)`: fair price × (1 + more) × factor, with no rounding (each sale rounds its own). `priceOf` is left as it is until change 1 |
| `src/farm/data.ts` (+) | `BUYER_OFFERS`: `{ factor, odds }[]` with today's five rows, and `buyerMean()`. Nothing reads it until change 1 |
| `src/farm/prices.test.ts` | `priceAt` with no boost and no factor is the fair price; the parts multiply; the offers' odds sum to 1 and the factors rise; the mean is 1.0395 |
| `src/farm/ledger.ts` | `Channel` (`gate`, `order`, `manager`, `shop`, `contractor`), `LEDGER_DAYS = 14`, `Ledger`, `LedgerDay` (`day`, then per good and channel `[units, coins]`), `freshLedger()`, `noteSale(book, day, channel, good, units, coins)` (pure, returns a new book), `sanitizeLedger(raw, today)`, `bookDays(book, today)` (14 days, empty ones filled), `perUnit(book, good)` |
| `src/farm/ledger.test.ts` | a sale goes to today's day; a new day starts a new entry; the 15th day back is dropped; materials only to the contractor, and goods never to him; sanitize: garbage gives an empty book; unknown goods and channels, negative, fractional and infinite numbers, future days and duplicate days are dropped or merged |
| `src/farm/mood.ts` (decision 1 only) | `MOOD`, `moodOf(good, day)` (a hash of the good and date, two sine waves), `vegIndex(day)`, `moodDays(good, today, n)` |
| `src/farm/mood.test.ts` | the tests of change 3 except the sim's |
| `src/farm/computer/marketView.ts` | `MarketFarm` (a type-only `Pick` of `FarmData`), `MarketNow`, `GoodMarket`, `ChannelView`, `Why`, `IndexView`, `MarketView`, and `marketView(f, now)` using `priceAt`, `machineLevel`, `priceFactor`, `BUYER_OFFERS`, `orderPay`, `managerPay`, `unitPrice`, `buyChance`, `shopperEvery`, `shoppersAtOnce`, `piecePrice`, `xpForSale` and `lockedAt` |
| `src/farm/computer/marketView.test.ts` | the channel, factor, best and lock tests of change 4, on a fresh farm, a played save (`testSaves.ts`) and one with plenty |
| `src/farm/computer/planView.ts`, `planView.test.ts` | `PlanRow` (`perMinute`, `perPress`, `seconds`, `can`, `locked`), `planView(f, now)`, and the table test of the numbers above |
| `src/farm/computer/bookView.ts`, `bookView.test.ts` | `BookView` (days × channels, the week's totals, the price index, goods), `bookView(book, today)` |

Left to the build, because each is visible or wired: `APPS` and its pictures, the catalogue row, the panel kind,
`noteSale`'s calls, the mood's hook, and every component.
