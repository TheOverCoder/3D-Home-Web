# Animal tools, "where is it made", the premium remote

> **בעברית, בקצרה:**
> 1. **כלים לבעלי החיים.** בחנות יהיה אזור נפרד לחיות. כשקונים את כל השדרוגים של סוג חיה (6 תרנגולות, 3 פרות, 4 כבשים),
>    נפתח לו כלי: **לול** עם קן לכל תרנגולת, **דלי חלב** לפרות, **מספריים וסל צמר** לכבשים. עומדים ליד הגדר, לוחצים על
>    הכפתור, ונפתח חלון שבו אוספים בהקשות. במקום לרדוף אחרי כל פרה.
> 2. לכל כלי שני שדרוגים, כל שלב יקר יותר: **כמה כל מקום מחזיק** (קן: 3 ביצים, עד 10) ו**כמה כל הקשה לוקחת** (1, עד 10).
> 3. בקניית כלי: **סרטון קצר** שבו הקבלן מביא ובונה אותו. סרטון אחד לשלושת הכלים.
> 4. **"איפה זה מיוצר"**: הקשה על מוצר בכל חלון (הזמנה, מחסן, קונים, מכונה) מראה את שמו ומאיפה הוא בא, ו"הראה לי"
>    מוליך לשם.
> 5. **שלט פרימיום ב-10,000 מטבעות**, במראה מיוחד. אחריו "איפה זה מיוצר" פותח את המכונה עצמה, במקום, ואפשר לייצר מרחוק.
>    רק מהקשה על מוצר בתוך חלון.
>
> הכל שורות בטבלאות: הכלים הם שורות, השדרוגים הם "סולמות" כמו בשוק, ואין שום שדה חדש בשמירה. חלון אחד לשלושת הכלים.
> **קודם אתה בוחר:** חמישה לוחות במעבדה בסבב אחד (חלון הכלים, החנות, מראה הפרימיום, הסרטון, דגמי הכלים ליד הגדר).
> שלוש שאלות קצרות אליך בסוף הקובץ.

This file is the plan the agents build from. It comes after `plans/first-hour.md` Part B (it adds rows to `UNLOCKS` and
one row to `PACE`, and the sim buys and uses the tools). Keep it short and current: when a step is built, replace its
plan with two lines on what was built and where.

## Rules for the whole update

- **Rows, one engine.** A tool is a row of `TOOLS`; its purchase and its two upgrades are rows of `LADDERS`, generated
  from it (as `FRUIT_PRODUCERS` generates producers). The remote is one more `LADDERS` row. Every tool is run by the same
  functions; a fourth tool (the lemon tree's ladder, say) would be a row, never code.
- **No new save state.** What is owned is `farm.ladders` (already saved and sanitized by `clampLevels`); the hens' nests
  are the producer's `stock` and `timer` arrays the save already keeps.
- **A tool changes how you take and how much waits, never what you get.** The same goods, XP and surprises per good as
  collecting one by one; nothing comes faster. So pace and goals stay as they are, and the sim only checks the prices.
- **Interface first.** Five lab boards in one round (below); the logic is built and tested meanwhile, the panels only
  after the user's ✓.

## 1. Data (`src/farm/data.ts`)

```ts
export type ToolKind = 'hens' | 'cows' | 'sheep' // the producers with a herd that the shop sells
export type ToolPart = 'tool' | 'hold' | 'tap'
export type ToolLadderId = `${ToolKind}-${ToolPart}`

/** A tool for a herd: bought in the farm shop once the herd is full, it stands at the pen's fence, and the action
 *  button there opens its panel, where the goods are taken with taps. Everything that differs between tools is here. */
export interface ToolDef {
  name: string                    // 'Coop', 'Milk bucket', 'Shears'
  blurb: string
  art: ArtId                      // its picture in the shop and on its card
  word: string                    // the one word under the action button
  look: 'nests' | 'pail' | 'shears' // what its panel draws where the goods wait
  /** what a tap takes from: the nest tapped, or the fullest animal (ties: the first) */
  pick: 'spot' | 'fullest'
  price: number
  /** the most each animal's place holds once the tool is there, `from` → `to`; step k costs price[0] + price[1]·k */
  hold: { from: number; to: number; price: readonly [number, number]; each: string } // each: 'a nest', 'a cow'
  /** how many one tap takes, 1 → `to` */
  tap: { to: number; price: readonly [number, number] }
  /** in its place's frame (it moves with the pen): where you stand, what you look at (where its model stands), reach */
  stand: [number, number, number]
  aim: [number, number, number]
  reach: number
}
export const TOOLS: Record<ToolKind, ToolDef> = { … }  // the rows below
```

`Ladder` gets four optional fields, so today's rows are unchanged:

```ts
at?: 'shop'                                    // bought in the farm shop (crystals fly from the shed; its card goes back there)
needs?: { herd?: ProducerId; ladder?: LadderId } // open only once this herd is full / this ladder is at its top
tool?: { kind: ToolKind; part: ToolPart }      // a tool's row
premium?: true                                 // the premium look (the remote)
```

`LADDERS = { …today's six, ...TOOL_LADDERS(), remote }`. `TOOL_LADDERS()` makes three rows a kind:
`${k}-tool` (1 step, `needs: { herd: k }`), `${k}-hold` and `${k}-tap` (`needs: { ladder: `${k}-tool` }`), each with its
`say(k)`: "Coop" · "3 eggs a nest" → "4 eggs a nest" · "1 a tap" → "2 a tap". The first numbers (the sim tunes them,
only these):

| Kind | Tool | Price | Holds (steps) | Hold price `[a, b]` | Per tap (steps) | Tap price `[a, b]` | All of it |
|---|---|---|---|---|---|---|---|
| hens | Coop (a nest for each hen) | 300 | 3 → 10 a nest (7) | [120, 60] | 1 → 10 (9) | [80, 40] | 4,560 |
| cows | Milk bucket | 500 | 3 → 10 a cow (7) | [180, 90] | 1 → 10 (9) | [120, 60] | 6,890 |
| sheep | Shears and basket | 450 | 2 → 10 a sheep (8) | [160, 80] | 1 → 10 (9) | [100, 50] | 6,670 |

`remote: { name: 'Remote', blurb: 'Tap a good in a panel: its machine opens right there.', levels: 1,
price: [10_000, 0], at: 'shop', premium: true }`.

Where each tool stands (the 3D designer places its model there; `stand`/`aim` follow it): the coop at the nest box
(the hens' `stand`/`aim` today); the bucket on the pasture's gate post, outside the gate (`PASTURE.minX`, `gateZ`); the
shears and basket on the fold's gate post (`FOLD.gateX`, `maxZ`).

**`src/store.ts` `Panel`:** `{ kind: 'tool'; tool: ToolKind }`; `machine` gets `from?: Panel`; `ladder` takes any
`LadderId` and its `from` becomes `from?: Panel` (one rule: a card or panel opened from another goes back to it, its ✕
too). **Pictures:** `nest-with-eggs`, `bucket`, `scissors` and a crown for the premium in `src/ui/art.ts` (Fluent 3D,
credited in `src/data/credits.ts`); Phosphor `Crown` in `glyphs.ts`.

**First hour (`plans/first-hour.md`).** `UNLOCKS` rows: `hens-tool`, `cows-tool`, `sheep-tool`, `remote` (first
guesses 6, 9, 11, 18; the sim sets them where its player has the herd full and the coins near). The `-hold` and `-tap`
ladders open with their tool (`needs`), so Part B's guard counts them as part of the tool's row. `ladderOpen` asks
`needs` and `isUnlocked`. The sim's player buys what `ladderOpen` allows and it can afford (the tools too, through
`buyLadder`), and once a tool is owned collects through `toolTake` (one call a tap, if it charges time for actions).
`PACE` gets one row: each tool is bought by the sim's player within 20 minutes of play after its herd is full (a price
past that is too dear for its place). `npm run sim` prints when each tool and the remote were bought; the before/after
numbers go into this file.

## 2. Rules (`src/farm/state.ts`, pure parts in `src/farm/tools.ts`)

**Owning a tool.** `ladderOpen(id)` for an `at: 'shop'` row: its `needs` met (`animals(herd) >= mostAnimals(herd)`, or
the needed ladder maxed) and `isUnlocked(id)`. `buyLadder` is unchanged but for one line: a `-tool` row calls
`toolBought(kind)`. XP: `build`, from the shed (as every ladder step). The film is asked by the card's own buy
(`buyWithFilm(id)` in `src/film/films.ts`, as `buyShop` wraps `buyMarket`), never by `buyLadder`, so tests and the sim
buy with no film. `toolOwned(kind) = farm.ladders[`${kind}-tool`] > 0`.

**What a tool changes in the producer.** One function, `maxOf(id)`: with its tool, `TOOLS[k].hold.from +
ladders[k-hold]`; without, `PRODUCERS[id].max` as today. `growProducer`, `collectable`, the offers' `ready`, `load` and
time away all read it. The hens: today they share one nest (`herd.shared`: one count, its clock running as many times
as fast as there are hens). With the coop each hen has her own nest: `ownEach(id)` becomes `!shared || toolOwned(id)`,
so the stock and clock arrays are one a hen (and `growProducer` runs a clock ×hens only for a shared nest, each
hen's at 1× once she has her own). `toolBought('hens')` splits the shared nest once (`spreadNest` in
`tools.ts`): every egg kept, dealt round the nests; hen i's clock set to `every − (every − T + i·every) / hens` (T the
shared clock), so the next eggs come exactly when they would have and the coop lays as often as the nest did. Looks
keep the row's numbers: a sheep looks full from 2 fleeces (`woolliness` stays on `PRODUCERS.sheep.max`), and the nest
box in the yard shows up to its six eggs, summed over the nests (`Plants.tsx`).

**Taking with a tool.** `collect` is split: `takeFrom(id, i, most, at?)` is today's rule (as much as the store has room
for, up to `most`; stats, `got`, a surprise roll for each good, `gainXp('collect', n)`; the clock starts again when an
animal is emptied, but the hens lay on); `collect` is `takeFrom` + its toast, as today. `toolTake(kind, spot?)`: the
spot tapped (`pick: 'spot'`) or the fullest (`'fullest'`), up to the tool's per tap; no toast but a surprise's (the
flight and the counts say it); `bump`, `save` (already throttled). What does not fit stays on the animal or in the
nest; nothing is taken twice (the stock goes down as the XP is given, in the same call). XP crystals fly from low in the
middle, as a panel's do.

**The button, the compass, "Show me".** With a tool, the herd's own offers go: `Herd.tsx` registers one per animal only
while `!toolOwned(kind)`, and `useProducer('hens')` only before the coop. `useTool(kind)` registers the tool's offer at
its `stand`, under the producer's own `action` id (`farm-nest`, `farm-cow`, `farm-sheep`), so the compass, the route,
the orders' "Show me" (`placesOf` already matches `farm-cow` with no index) and First steps' "collect eggs" need nothing.
The offer:

- goods waiting and room: an action, `{ verb: PRODUCERS[k].verb, item: good, word: TOOLS[k].word }`, label "Coop · 14
  eggs"; **E opens the tool's panel** (the machine's way: one press opens something with buttons to press);
- goods waiting, no room: a status, `{ verb: 'wait', item, count, full: 'barn' }`, as a full animal is today;
- nothing waiting: a status with the seconds to the next good;
- `ready()`: an animal (or nest) full and room for it: on the compass with all that fits (today each full animal was);
- a gear tag opens the panel whenever you look at it (its two upgrades).

**Time away, saves, `load()`.** Time away needs nothing: `goOn` grows to `maxOf`, the report sums the arrays. `load()`
reads `data.ladders` **before** the producers (moved up), and `savedProducer` takes the farm being loaded: a farm with
the coop gets a nest a hen, clamped to its `maxOf`; a farm from before has no tool ladders (`clampLevels` gives 0) and
loads as today. No conversion, no new field.

**Where is it made.** `sourceOf` moves from `src/farm/orderBoard/sources.ts` to `src/farm/goods/sources.ts` (the board
imports it from there); one more row: a building material is "A surprise · the contractor sells them", and `placesOf`
gives the contractor while he is in. One pure function decides the button under the words, `goFor(good, ctx)` in
`src/farm/goods/go.ts`:

1. the remote owned and the good made at a machine → `{ kind: 'remote', machine, label: 'Open the mill' }`, on either
   map;
2. else on the farm with a place for it (`placeFor`) → `{ kind: 'walk', label: 'Show me' }` (today's "Show me");
3. else nothing: the words alone.

It is offered wherever a good's picture stands in a panel and is not itself inside another button: the silo and the
barn (goods, a level's materials), the line at the gate (what each buyer wants), the orders board (its bubble today),
the machine panel (a short recipe's missing ingredient, where its tap already shows what is short), the market's
panels, the contractor's, the welcome-back card, the daily and level gifts. Never on the action button, the compass, the
top's chips or a seed packet (those presses do other things).

**The remote.** `remote` opens only from that bubble: `openPanel({ kind: 'machine', id, from: <the panel it was in> })`.
The machine panel is unchanged (its actions already work from anywhere); its ✕ and swipe go back to `from`; its sounds
are the interface's, not the machine's place, when opened remotely. It opens machines only (open question 2). It
never adds a job by itself, never opens from a menu or the top, and never walks.

## 3. Interface (built after the ✓; the designer's choices, these are the constraints)

- **One tool panel for all three.** `src/farm/toolView.ts` (types, like `machineView.ts`), `src/farm/tool/ToolPanelView.tsx`
  (the design, fed only these, with `sample.ts` for the lab) and `src/farm/ToolPanel.tsx` (the farm's view, sounds:
  the producer's own `sound` on each tap, `haptic('tick')`):

  ```ts
  export interface ToolView {
    kind: ToolKind; name: string; good: ProduceId; look: 'nests' | 'pail' | 'shears'; pick: 'spot' | 'fullest'
    /** each hen's nest, each cow, each sheep: her name (cows, sheep), what waits, the most it holds, 0..1 to the next */
    spots: { name: string; has: number; most: number; next: number }[]
    perTap: number
    room: number; store: StoreId
    /** its two upgrades as chips: now → next, the price (a tap opens the ladder's card, coming back here) */
    ladders: { id: LadderId; now: string; next: string | null; price: number }[]
  }
  export interface ToolActions { tap(spot?: number): number; upgrade(id: LadderId): void }
  ```

  A tap: the target squishes (`PRESS`), the goods taken fly on an arc into the barn's chip (`flyInto`/`storeChip` from
  `src/farm/machine/fly.ts`), the counts tick down; with no room the targets are off and the barn chip is red. Targets
  ≥ 44 px; Enter or Space taps the first with goods (a computer). Coop: a nest for each hen with her eggs (10 in a nest
  reads as a heap with its number) and a ring to her next egg. Bucket: one pail that fills with the herd's milk, the cows
  as small chips with their bottles. Shears: the shears over a wool basket, the sheep as chips with their fleeces.
- **The shop.** `ShopPanel` leaves `FarmUI.tsx` for `src/farm/shop/`: `upgradesView()` (pure: the farm's rows; the
  animal section — for each kind its herd row, then its tool, locked with what is missing, "6/6 hens" or "Level 9", then
  its two ladders; the premium card) and `ShopCard.tsx` (the design). Herd rows buy as today; tool and ladder rows open
  `LadderCard` (`from` the shop); the remote's card wears the premium look.
- **The bubble.** `src/ui/GoodPic.tsx`: an `ItemPic` that opens the orders board's bubble (its look is the chosen one:
  the board's E) with the good's name, its source and the `goFor` button; the board keeps its own lines (in, in store)
  above them through a slot. `OrdersActions.show/canShow` become the same `go`/`onGo` every panel passes.
- **The premium look:** one class, `.premium`, from the tokens (the coin's gold, `--sun`, `--sun-lip`) and a slow
  Motion shimmer (still with less motion), on the remote's shop card, its ladder card, the "Open the mill" button and a
  small "Remote" chip on a machine panel opened from afar.

**Lab boards to make first, one round, one link** (`npm run lab:build`, the Artifact tool with `capabilities: {db: {}}`):

| Board | Kind (who) | Today | Variants and states | `adds` |
|---|---|---|---|---|
| `animal-tools` | ui (designer) | the per-animal prompt ("Milk Bella · 1 bottle") | A the place itself (a coop front, a pail, shears snipping), B a card per animal with one big target, C the goods as a pile with the animals as portraits. States: coop half full at 1 a tap; 10 a nest at 5 a tap; bucket; shears; barn full; nothing waiting | ✦ the tools |
| `shop-animals` | ui (designer) | today's shop list | A tabs (Farm · Animals · ★), B one list with a band per animal (herd → tool → upgrades as a short path), C a card per animal opening its page. States: 2 hens (tool locked), herd full (tool for sale), tool owned (its ladders), all at the top | ✦ the tools in the shop |
| `premium-remote` | ui (designer) | the orders bubble with "Show me" | the premium look A, B, C on: its shop card, its card that asks, the bubble's "Open the mill" in the silo, the line and the machine panel, the machine panel opened from afar with its back. States: no remote, remote, in the house, a material | ✦ the remote |
| `film-tools` | film (film director) | — | one film made from the kind, played for the coop, the bucket and the shears, upright and sideways | ✦ |
| `tools-3d` | 3d (3D designer) | the fences as they are | the three tools at their fences, A, B, C; at the game's distance, close, and with the herd; triangles against a weight of 800 each | ✦ |

## 4. The film (`src/film/tools.ts`; the film director's)

One function, `toolFilm(kind): Film`, from the `TOOLS` row and a small table of what differs (the animals, the prop, two
lines); `FILMS` gets `tool-hens`, `tool-cows`, `tool-sheep` from it; `FilmId` grows by those three. Asked once by the
card's buy (`buyWithFilm`), skippable to its end card, nothing of it in the save (as the shop's).

- **Shape** (the director writes the turn and logline first, `lab/FILM.md`): 15–20 s, 6–8 shots, cosy four beats.
  Start: the farmer runs from animal to animal, one walks off mid-way; the contractor (he sells the materials: a
  callback) doubts: "All of them? By hand?". Twist: his crate, three hammer stings, the third a comic break, the tool
  stands at the fence. Settle: one tap, the goods fly, the animals line up; the button. End card: the tool's picture,
  its XP (`XP_FOR.build`), owns the tool, next its first two steps ("3 eggs a nest → 4", "1 a tap → 2").
- **What the stage gets:** one place, `'pen'` (`Scene.place: 'market' | 'pen'`, the film's `herd: ToolKind`): a pen
  built from the game's own pieces (the farm decor's fence sections, the kind's animals from their crowd parts standing
  with their own idle and one walk to a mark, the tool's model from the 3D board), on the stage's lawn with its woods
  and sky. The same for every player: never the player's farm (`looksAtFarm`). Props: `crate`, `tool` (`open` 0..1:
  its pieces rise into place). No new rig, no new music engine.

## 5. What not to build (where maintenance is cut)

- No `farm.tools` or other save field; no `load()` conversion; no per-kind engine code or panel (one `ToolPanelView`,
  one `toolTake`, one `useTool`).
- No faster production, new XP action or new goal: a tool is how you take, the ladders how much waits and how many a
  tap takes.
- No "take all" button and no taking by itself: the per-tap ladder is the way to fewer taps.
- No tool for the lemon tree or the fruit plants now (each would be a row); no price tag for the tool at the fence (the
  shop sells it, as asked).
- Per-animal offers and the tool never side by side: one way to collect a herd.
- The remote: no new machine rules, no list of machines to open, no remote for crops; the bubble: no new data
  (`sourceOf`, `placesOf` are the tables' already).
- The film: one function for three films, one new place in the stage.

## 6. Tests (lean)

Unit, beside the code:

| File | Guards |
|---|---|
| `src/farm/tools.test.ts` (new) | the rows made from `TOOLS` (three a kind, the remote; holds end at 10, taps at 10; each step dearer); `spreadNest` keeps every egg and the moments of the next eggs; `fullest` (ties: the first) |
| `src/farm/state.tools.test.ts` (new) | the tool opens only with the herd full (and its level); bought: coins, `build` XP once, no film from `buyLadder`; the hens' nests split; a tap takes `min(per tap, has, room)`; XP, surprises (`setRandom`), `got` and goals per good as collecting one by one; barn full: nothing taken or lost; an empty spot: 0, no XP; the hold ladder: the animals fill to the new most (`tick`); time away (`cameBack`) fills to it; the save keeps tools and nests; a save from before loads as today; a saved coop with nests past the row's most keeps them (ladders read first) |
| `src/farm/goods/go.test.ts` (new) | `goFor`: a machine's good with the remote opens it (both maps); without, walks on the farm, nothing in the house; an animal's good or a crop walks even with the remote; a material walks to the contractor while he is in |
| `src/film/films.test.ts` | each tool's film lints clean (`lint`), is asked once by the card's buy and never by `buyLadder` |
| `src/models/weights.test.ts`, `checks.ts`, `gallery.ts` | the three tool models (their weights, the checks find nothing) |

The save's property test takes the new ladder ids by their being rows.

**One e2e spec**, `36-animal-tools` (the next free number after the first hour's), farm map: the shop's animal section,
the coop locked until six hens, bought through its card, its film once (`__home.story.state()`, id `tool-hens`, a tap to
its end card, as `23-market`); E at the nest opens the coop with six nests, taps take and the barn counts (the hens'
clocks set to 0 first, read in the same call), a per-tap step bought from its chip takes two; the cows' tool (bought
through the hook): `farm-cow-0` gone, `farm-cow` opens the bucket; the silo's wheat says "Grows in a bed" with "Show
me", the barn's flour "Made at the mill", the remote bought turns it into "Open the mill" (`.premium`) and its ✕ goes
back to the barn's panel; `@boot` a phone: the coop panel on screen upright and sideways, its targets clear of the
touch controls. Then `tests/README.md` gets its row and the new unit files'.

**Existing specs:** `25-button`'s `plenty()` fills the herds and owns the three tools (their offers are then pressed:
each opens its panel with something to press). `helpers.ts` `fillFarm` owns every tool at its top, so `05`'s farm walk
and `16`'s farm group draw the tool models (run those two groups once, CLAUDE.md). `17-stores-orders` keeps "Show me" by
its words (only its selector changes if the bubble's class moves). No other spec changes: no farm has a tool unless a
test buys one, so every herd is collected as today.

## 7. Order of work (small commits, each `npm run check` green)

**Round 1, side by side.** The five boards (designer, film director, 3D designer), published as one link; and the logic
(main agent), none of it visible on a farm without a tool:

1. Data: `TOOLS`, the generated ladders and the remote, the `Ladder` fields, `ladderOpen`, the `Panel` types;
   `tools.test.ts`.
2. Engine: `maxOf`, `ownEach`, `takeFrom`/`toolTake`, `toolBought`, `load()`'s order, `toolView`; `state.tools.test.ts`.
3. Goods: `sourceOf` moved, `goFor`, the material's source; `go.test.ts`.
4. After first-hour Part B: the `UNLOCKS` rows, the `PACE` row, the sim's policy; tune with `npm run sim`; report here.

**Round 2, after the ✓** (each only its chosen variant):

5. The shop: `ShopPanel` out of `FarmUI.tsx` first, then the animal section and the premium card.
6. The tool panel, `useTool`, the herd's offers switched; `36-animal-tools` (tools), `25-button`'s `plenty`.
7. `GoodPic` in the panels, the premium look, the remote's machine panel with its way back; `36` (goods, remote).
8. The tool models at their fences (3D designer), gallery, checks, weights; `fillFarm`; `05` and `16` farm groups.
9. The film (film director): the `'pen'` place, `toolFilm`, `buyWithFilm` on the card; `films.test.ts`.
10. `tests/README.md`; this file replaced by its summary.

5, 6, 8 and 9 can run at once (9 uses a stand-in box until 8's model lands); 7 after 5 (both touch `FarmUI.tsx`).
Locally: `npm run check` and only `36` (and `05`/`16`'s farm groups after 8); the rest is CI's.

## 8. Open questions (for the user)

1. **The coop's tap:** one egg a tap like the bucket (2, 3 … 10 with the upgrade), or a tap empties the whole nest?
   (Plan: like the bucket, one rule for all.)
2. **The remote:** only machines (as asked), or also the animals' tools (an egg in an order opens the coop from afar)?
   (Plan: machines only; the tools would be one line in `goFor`.)
3. **"The same for cows and sheep":** do cows and sheep also get the "holds more" upgrade (milk a cow, fleeces a sheep,
   up to 10), as well as more a tap? (Plan: yes.)

## Done when

The three tools are bought in the shop's animal section once their herds are full, each with its film once; E at the
fence opens one panel that collects with taps under the barn's rule; both ladders work; every panel's good says where
it is made; the remote, bought for 10,000 with its premium look, opens the machine from that bubble and comes back;
`pace.test.ts`, the unit tests and `36` pass, and `05`/`16` hold.
