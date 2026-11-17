# Animal tools, "where is it made", two premium remotes

> **בעברית, בקצרה:**
> 1. **כלים לבעלי החיים.** בחנות יהיה אזור נפרד לחיות. כשקונים את כל השדרוגים של סוג חיה (6 תרנגולות, 3 פרות, 4 כבשים),
>    נפתח לו כלי: **לול** עם קן לכל תרנגולת, **דלי חלב** לפרות, **מספריים וסל צמר** לכבשים. עומדים ליד הגדר, לוחצים על
>    הכפתור, ונפתח חלון שבו אוספים בהקשות, במקום לרדוף אחרי כל פרה.
> 2. לכל כלי שני שדרוגים, כל שלב יקר יותר: **כמה כל מקום מחזיק** (3, עד 10) ו**כמה כל הקשה לוקחת** (1, עד 10).
>    **כל החיות זהות במספרים**: אותו מחיר, אותם שדרוגים. משנים מספר אחד, וזה משתנה לכולן.
> 3. בקניית כלי: **סרטון קצר** שבו מביאים ובונים אותו. **שלושה סרטונים**, אחד לכל חיה.
> 4. **"איפה זה מיוצר"**: הקשה על מוצר בכל חלון (הזמנה, מחסן, קונים, מכונה) מראה את שמו ומאיפה הוא בא, ו"הראה לי"
>    מוליך לשם.
> 5. **שני שלטי פרימיום, 10,000 מטבעות כל אחד**, במראה מיוחד: **שלט המכונות** פותח את המכונה עצמה מהקשה על מוצר בחלון;
>    **שלט החיות** (רק אחרי שיש כלי אחד לפחות) פותח את חלון הכלי של החיה, לאיסוף מרחוק. רק מהקשה על מוצר בתוך חלון.
>
> הכל שורות בטבלאות, בלי שום שדה חדש בשמירה, וחלון אחד לשלושת הכלים.
> **הוחלט (17.11.2026):** הקשה לוקחת אחד מכל חיה, משדרגים עד 10 · שני שלטים נפרדים, 10,000 כל אחד · כל החיות זהות
> במספרים ובלוגיקה, ושונות רק במראה הכלי, במקומו ליד הגדר ובסרטון.
> **קודם אתה בוחר:** שבעה לוחות במעבדה בסבב אחד (חלון הכלים, החנות, מראה הפרימיום, שלושת הסרטונים, דגמי הכלים).

This file is the plan the agents build from. It comes after `plans/first-hour.md` (built: Part A's sim and `PACE`,
Part B's `UNLOCKS` and gates, `LEVELS.step` 30). Keep it short and current: when a step is built, replace its plan with
two lines on what was built and where.

## Rules for the whole update

- **One shared row, one engine.** Every animal has the same numbers and logic: one `TOOL` constant (the price, the
  "holds" ladder, the "per tap" ladder). `TOOLS` rows hold only what each looks like and where it stands. The tool's
  purchase and its two upgrades are `LADDERS` rows generated from them (as `FRUIT_PRODUCERS` makes producers); the two
  remotes are two more `LADDERS` rows.
- **No new save state.** What is owned is `farm.ladders` (saved, sanitized by `clampLevels`); the hens' nests are the
  producer's `stock`/`timer` arrays the save already keeps.
- **A tool changes how you take and how much waits, never what you get.** The same goods, XP and surprises per good as
  collecting one by one; nothing comes faster. Pace and goals stay; the sim checks the prices.
- **Interface first.** Seven lab boards in one round (§3); the logic is built and tested meanwhile, the panels after ✓.

## 1. Data (`src/farm/data.ts`)

```ts
export type ToolKind = 'hens' | 'cows' | 'sheep'          // the producers with a herd the shop sells
export type ToolPart = 'tool' | 'hold' | 'tap'

/** What every animal's tool shares: one change here changes them all. Step k of a ladder costs price[0] + price[1]·k. */
export const TOOL = {
  price: 100,                                              // 400 in the first draft; the sim's (below)
  hold: { from: 3, to: 10, price: [150, 75] },             // the most each animal's place holds (a nest, a cow, a sheep)
  tap: { from: 1, to: 10, price: [100, 50] },              // how many one tap takes
} as const

/** What differs between the tools: only how each looks and where it stands. */
export interface ToolDef {
  name: string                       // 'Coop', 'Milk bucket', 'Shears'
  blurb: string
  art: ArtId                         // its picture in the shop and on its card
  word: string                       // the one word under the action button
  look: 'nests' | 'pail' | 'shears'  // what its panel draws where the goods wait
  /** its place at the fence, in its pen's frame (it moves with the pen): where you stand, what you look at, reach */
  stand: [number, number, number]
  aim: [number, number, number]
  reach: number
}
export const TOOLS: Record<ToolKind, ToolDef>
```

The coop stands at the nest box (the hens' `stand`/`aim` today), the bucket on the pasture's gate post outside the gate
(`PASTURE.minX`, `gateZ`), the shears and basket on the fold's gate post (`FOLD.gateX`, `maxZ`); the 3D designer places
each model and its numbers follow.

`Ladder` gets four optional fields; today's rows are unchanged:

```ts
at?: 'shop'                                             // bought in the farm shop (crystals from the shed; its card goes back there)
needs?: { herd?: ProducerId; ladder?: LadderId; anyOf?: readonly LadderId[] } // a herd full / a ladder at its top / any one of these
tool?: { kind: ToolKind; part: ToolPart }               // a tool's row
premium?: true                                          // the premium look
```

`LADDERS = { …today's six, ...TOOL_LADDERS(), 'machine-remote', 'animal-remote' }`:

- `${k}-tool` (1 step, `TOOL.price`, `needs: { herd: k }`), `${k}-hold` (7 steps, 3 → 10, "3 a nest" / "3 a cow"),
  `${k}-tap` (9 steps, 1 → 10, "1 a tap"), both `needs: { ladder: `${k}-tool` }`. Each kind: 100 (the sim's price,
  below) + 2,625 + 2,700 = 5,425 coins; the three, 16,275.
- `machine-remote`: 1 step, 10,000, `premium`, no needs. `animal-remote`: 1 step, 10,000, `premium`,
  `needs: { anyOf: ['hens-tool', 'cows-tool', 'sheep-tool'] }`.

**`src/store.ts` `Panel`:** `{ kind: 'tool'; tool: ToolKind; from?: Panel }`; `machine` gets `from?: Panel`; `ladder`
takes any `LadderId`, its `from` a `Panel` (one rule: opened from another panel, its ✕ goes back there). **Pictures:**
`nest-with-eggs`, `bucket`, `scissors`, a crown (Fluent 3D, `src/ui/art.ts`, credited); Phosphor `Crown`.

**Unlocks and the sim.** No `UNLOCKS` rows: by the table's own rule, what something else holds back is not in it. A tool
is held back by its herd requirement alone (the herds' upgrades are locked at levels 2, 6 and 7: `upgrade:hen`,
`upgrade:cow`, `upgrade:sheep`), its ladders by the tool, the machines' remote by its price, the animals' remote by its
price and a tool. The sim (`src/sim/policy.ts`): `forSale()` adds every `at: 'shop'` ladder that `ladderOpen` allows
at `SHOP` (the tools at `TOOL.price`, their steps from 150 and 100, the two remotes at 10,000 each); `worthCollecting` reads
`maxOf`; with a tool owned, its collect move goes to the tool and calls `toolTake` once a tap, each tap costing
`WALK.tap` (0.3 s, a new number in `play.ts`), so the "per tap" ladder shows. `PACE` gets one row: each tool is bought
within 20 minutes of play after its herd is full. `npm run sim` prints when each tool and remote was bought; tune only
`TOOL`'s numbers (the remotes' price is the user's), and put the before/after here.

**Set by the sim (step 4).** The good player buys the cheapest thing for sale; at 400 a tool came an hour or more after
its herd (the coop 59–70 minutes after the six hens), far outside the `PACE` row. Only `TOOL.price` moved: 400 → 100
(the steps stay 150 + 75·k and 100 + 50·k). At 120 the coop still came 20–25 minutes after the hens; at 100 it comes
15–19 minutes after them on seeds 1–11 (the bucket and the shears 4–12 minutes after their herds). Minutes of play,
seeds 1–3 (`SIM_TOOLS=off npm run sim` plays without them):

| | level 5 | level 10 | level 15 | coop (after six hens) | bucket (after three cows) | shears (after four sheep) |
|---|---|---|---|---|---|---|
| no tools for sale (before) | 6:27–7:10 | 26:31–29:29 | 66:01–72:48 | — | — | — |
| tools at 400 (the plan's) | 6:27–7:10 | 26:31–29:29 | 65:19–72:48 | 61:59–72:55 (+59–70) | 84:59–91:21 (+68–76) | 99:16–114:48 (+85–100) |
| tools at 100 (after) | 6:27–7:10 | 25:55–28:25 | 58:26–65:12 | 17:40–21:31 (+15–19) | 19:40–22:09 (+4–8) | 22:26–23:30 (+8–9) |

Levels to 8 are the same to the second (a tool comes after level 8); from there the tools' `build` steps (51 of them, 5
XP each) and the goods that no longer spill from a full nest bring level 15 four to nine minutes sooner, well inside
its band. The herds are full at about 3 (hens), 12–17 (cows) and 14–15 (sheep) minutes; every tool's "a tap" ladder is
at its top by 127–138 minutes and its "holds" ladder by 147–162; neither remote is bought within three hours (seeds
1–3: 10,000 is far past what the good player keeps).

## 2. Rules (`src/farm/state.ts`, pure parts in `src/farm/tools.ts`)

**Built (round 1).** `maxOf`, `toolOwned`, `perTap`, `takeFrom`/`collect`, `toolTake`, `toolBought` (`spreadNest`) and
`toolView` in `state.ts`; `goFor`, `sourceOf`, `placesOf` in `src/farm/goods/`; `load()` reads the ladders first.

## 3. Interface

**Built (round 2: A, C with the upgrades in the tool, B).** The shop in `src/farm/shop/` (a card per animal, the remotes'
velvet tiles); the tool panel `src/farm/tool/ToolPanelView.tsx` + `ToolPanel.tsx` (its upgrades as chips with
`LadderCard`, Skins), `useTool.ts`; `src/ui/GoodPic.tsx` and the remote's tag (`src/farm/goods/ways.ts`), on the base of
CLAUDE.md "Interface".

## 4. The films

**Built.** `src/film/coop.ts`, `bucket.ts`, `shears.ts` on the `'pen'` stage (the film director's); `buyWithFilm` in
`src/film/films.ts` plays each once when its card buys the tool (style `'a'`), never `buyLadder`.

## 5. What not to build

- No per-animal numbers or rules (one `TOOL`), no `farm.tools` or other save field, no `load()` conversion, no three
  panels (one `ToolPanelView`, one `toolTake`, one `useTool`).
- No faster production, new XP action or goal; no "take all" button, no taking by itself.
- No tool for the lemon tree or fruit plants now (each would be a row); no price tag at the fence (the shop sells it).
- Per-animal offers and the tool never side by side.
- The remotes: no new machine or tool rules; the bubble: no new data (`sourceOf`, `placesOf` are the tables').
- No `UNLOCKS` rows (held back by the herd, the tool and the prices).

## 6. Tests (lean)

| File | Guards |
|---|---|
| `src/farm/tools.test.ts` (new) | the rows from `TOOL`/`TOOLS` (three a kind, two remotes; every kind's numbers the same; holds 3 → 10, taps 1 → 10; each step dearer); `spreadNest` keeps every egg and the next eggs' moments; the fullest (ties: the first) |
| `src/farm/state.tools.test.ts` (new) | a tool opens only with its herd full; the animals' remote only with a tool; bought: coins, `build` XP once, no film from `buyLadder`; the hens' nests split; a tap takes `min(per tap, has, room)`; XP, surprises (`setRandom`), `got` and goals per good as one by one; barn full: nothing taken or lost; an empty spot: 0, no XP; the hold ladder fills to the new most (`tick`, `cameBack`); the save keeps tools and nests; a save from before loads as today; a saved coop past the row's most keeps it |
| `src/farm/goods/go.test.ts` (new) | `goFor`: a machine's good opens it with the machines' remote (both maps); an animal's good opens its tool with the animals' remote only if that tool is owned; otherwise a walk on the farm, nothing in the house; a material walks to the contractor while he is in |
| `src/film/films.test.ts` | each tool film lints clean, asked once by its card's buy, never by `buyLadder` |
| `src/models/weights.test.ts`, `checks.ts`, `gallery.ts` | the three tool models |
| `src/sim/pace.test.ts` | `PACE` (and its tools row) still holds with the tools for sale |

**Built.** `38-animal-tools` (the shop's coop and its film, E at the nest, a tap, an upgrade from its chip, the bucket's
place, where is it made, both remotes, a phone `@boot`); `25-button`'s `plenty()` owns the three tools.

**Still to do with step 8:** `helpers.ts` `fillFarm` owns every tool at its top (run `05`'s and `16`'s farm groups once).

## 7. Order of work (small commits, each `npm run check` green)

**Round 1, side by side.** The seven boards (interface designer, film director, 3D designer), one link; and the logic
(main agent), invisible on a farm without a tool:

1. **Built.** `TOOL`, `TOOLS` (with `spot`: "nest", "cow", "sheep"), `TOOL_LADDERS()`, `REMOTE_PRICE` and the four
   `Ladder` fields in `src/farm/data.ts`; `needsMet` in `src/farm/tools.ts`, asked by `ladderOpen`; `clampLevels` reads a
   tool's upgrades back as 0 without the tool; the `Panel` types; the four pictures; `tools.test.ts`.
2. **Built.** `maxOf`, `toolOwned`, `perTap`, `takeFrom`/`collect`, `toolTake`, `toolBought` (`spreadNest`), `eggsShown`,
   `toolView` in `src/farm/state.ts` (pure parts in `tools.ts`, the view's types in `toolView.ts`); `load()` reads the
   ladders first; `useProducer`'s `ready` asks `maxOf`; `state.tools.test.ts`, and the save's property test knows them.
3. **Built.** `src/farm/goods/sources.ts` (moved; a material "A surprise · the contractor sells them"),
   `src/farm/goods/go.ts` (`goFor`, `machineOf`, `animalsOf`); `placesOf` gives `farm-contractor` while he is in
   (`placeFor` asks `contractorHere`); `go.test.ts`, `orderPlace.test.ts`.
4. **Built.** The sim buys the farm shop's ladders (`sellTools`, `SIM_TOOLS=off`), collects with a tool a tap at a time
   (`WALK.tap` 0.3 s), reports each herd full and each step bought; `PACE.tools` (20 minutes) in `pace.test.ts`;
   `TOOL.price` 400 → 100 (§1, "Set by the sim").

**Round 2, after the ✓** (only the chosen variants):

5. **Built.** The shop out of `FarmUI.tsx` into `src/farm/shop/` (`upgradesView`, `ShopCard`, `ShopPanel`): a card per
   animal (C), the tool's upgrades in its own panel (the user's note), the remotes as velvet tiles; `LadderCard` premium.
6. **Built.** The tool panel (A, built further: the place itself, taps flying into the barn, times at a glance, full and
   empty states, its upgrades as chips, Skins), `useTool` taking the herds' offers' place; `25-button`'s `plenty`.
7. **Built.** `GoodPic` in the orders board, the silo and the barn, the line at the gate, a machine's short recipe and
   the tool panel; the premium look (B, night velvet) and both remotes' panels with their tag and way back; `38`.
8. The tool models at their fences (3D designer), gallery, checks, weights; `fillFarm`; `05`/`16` farm groups.
9. **Built.** The films (film director) and their hook, `buyWithFilm` on the card; `films.test.ts`.
10. **Built.** `tests/README.md`; the base in CLAUDE.md "Interface" and `lab/README.md`; this file's summaries.

## Decided (2026-11-17)

1. **One a tap, for every animal**: one egg from a nest, one milk, one fleece; the "per tap" ladder 1 → 10, each step
   dearer.
2. **Two premium remotes, 10,000 each**: the machines' (as planned) and the animals' (only after a tool is owned; opens
   the tool panel of an animal's good, only tools owned). Without it, "where is it made" shows and walks.
3. **Every animal the same** in numbers and logic (one `TOOL`: price, holds 3 → 10, per tap 1 → 10, the herd full to
   open); only the tool's look, its place at the fence and its film differ: three films.

## Done when

The three tools are bought in the shop's animal section once their herds are full, each with its own film once; E at
the fence opens one panel that collects one a tap (more with its ladder) under the barn's rule; every panel's good says
where it is made; the two remotes, 10,000 each with the premium look, open a machine or an owned tool from that bubble
and come back; `pace.test.ts`, the unit tests and `38` pass, and `05`/`16` hold.
