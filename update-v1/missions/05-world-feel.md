# 05 — World feel: the farm answers your hand

**Goal:** every result in the 3D world shows where it came from, where it went and how big it was. This uses only the DOM and instance scale: no new draws, and no change to `16-view`.

**How a player will feel it:** a harvest leaps out of the bed as its picture and lands in the silo, and the silo steps up as each picture arrives. Plants stretch and pop when picked and perk up when watered.
A cow gives a happy shiver when milked, and a fence settles into the ground. A big order looks and sounds bigger than a 5-coin sale, and small things stay small.

## Principles applied

- **Juice follows success and grows with it; too much hurts.** Kao 2020 found an inverted U. Kao et al., CHI '24, found that juice tied to success helps and plain amplification harms. So nothing celebrates a status (`wait`, full), and most rewards stay *small*: `feel-sound.md` §1.1, §1.4.
- **Close the loop.** Show where a reward goes and count it as it lands. Today the commonest action has the weakest loop: `feel-sound.md` §1.3, §2 (Harvest and Collect rows), §4 #1.
- **Squash, stretch and follow-through in the world.** There are none today, and they are free through instance scale: `feel-sound.md` §1.5, §4 #5.
- **Number pops in the world,** sized by tier: `feel-sound.md` §1.6, §4 #7.
- **Hit-stop as a 60–140 ms hold,** never a shake of the 3D camera: `feel-sound.md` §1.7.
- **Cheap on a phone.** Only `transform` and `opacity`, nothing new in the sun's pass, caps on what flies. Everything starts in the same frame as the press: `feel-sound.md` §1.11, §1.2.
- **Honest tiers.** The amount decides, never chance, and a loss or refusal never looks like a win: `feel-sound.md` §1.4; `psychology.md` §1.6 and §2 "Do NOT" #5.
- **Less motion.** Turning it on removes every flight, pop and reaction, but the counts still change. Muted play comes first: `feel-sound.md` §1.9, §1.10.
- **Feedback that can be read.** Flights start in the world and never cross the toast's text: `ftue-ux.md` §1.4, §3 #7. Small wins: `psychology.md` §1.11. Softness without clutter: `farm-games.md` P13, P14.

## Foundation first

**What exists:** the flights `flyGoods`/`flyInto` (`src/ui/fly.ts`) and `flyItem`/`flyCoins`/`holdCoins` (`src/fx/coins.ts`); `xpInFlight` (the bar grows only as each crystal lands); the `FarmFx` queue, which projects a world point onto the screen; `burst` and the motion presets.
`Parts.put` already takes a `Vector3` scale, while `Parts.at` takes only a uniform one. 06's `lessMotion()` (`src/lib/motion.ts`) lands first, and everything here reads only that.

**What I would add.** Each part has at least two uses now.

**A. Reward tiers.** This is the shape agreed with 06 (06's point 6), under the user's names; 06 never computes a tier.
- `src/lib/tier.ts`, with no imports: `TIERS = ['small', 'medium', 'big', 'huge']`.
- `src/farm/tier.ts`, pure, so it runs in Node and in the sim:
  - `worthOf(prizes)`: the coins, plus each good at its fair `PRODUCE` price (never an event's price), plus each material at `CONTRACTOR.buys`.
  - `rewardTier(prizes, level, least?)`: the worth against `levelReward(level + 1)`, the yardstick the daily gift is already sized from, so a tier means the same at level 4 and at 400. The bounds are `TIER_AT = { medium: 0.25, big: 1, huge: 3 }`, tuned with `npm run sim`.
  - `rewarded(kind, prizes, at?, least?)`: counts the reward (`rewardCounts`, for the sim and `__home.reward`), queues the world's show when the reward has a place, and returns its tier.
- `celebrate(kind, tier, at)` in `src/fx/reward.ts`: the one fan-out. It calls 06's `rewardSound(kind, tier)` and `haptic(feelOf(kind, tier))`; a stub plays today's sounds until 06 lands. The flying coins stay `coinsToFly`, and `burst` gets a gate: at most one confetti every 1.5 s.

| `SHOW` | number pop | hold | confetti (count / spread / power) |
|---|---|---|---|
| small | 1.0× | 60 ms | none |
| medium | 1.15× | 80 ms | none |
| big | 1.3× | 100 ms | 44 / 80 / 26 |
| huge | 1.5× | 140 ms | 100 / 100 / 34 |

**B. Pop into a store.**
- `popInto(x, y, { src, count, store, hold, order, landed })` in `ui/fly.ts`: a picture pops up 30–40 px with its count in the `.qty` badge, holds, then arcs into the silo's or the barn's chip. 06 plays its landing tick in `landed`.
- `holdGoods(store, n)` and `goodsHeld`, beside `holdCoins`. A hold is released on landing, on cancel, or after 2 s at most.
- Uses: surprises (`flyItem` calls it), goods collected in the world, and the machine panel's flights to the top chip.

**C. Reactions.**
- `src/fx/react.ts`, with no three.js and no DOM: `REACTIONS: Record<Reaction, { ms, keys: [t, xz, y][] }>`.
- Its calls: `react(owner, id, kind, data?)`; `reaction(owner, id)` (the scale now, or null); `reacting(owner)` (a crowd re-puts every frame while it is true); and `freeze(ms)` for tests (`__home.react`). Under less motion, `react()` does nothing.
- `Parts.at(x, y, z, heading, scale: number | Vector3)`: the box and the far and sun copies already follow the put matrices, by the largest axis.
- The rows. Each lasts at most 400 ms, stays within ±30 %, and ends at rest (or at 0 when the thing leaves):
  `pluck` (harvested, 240 ms: stretches up, then gone); `pick` (a lemon, egg or fruit taken, 200 ms: 1.25, then gone); `sprout` (planted, 280 ms: 0.6 → 1.08 → 1); `perk` (watered, 320 ms: y 1.12 → 0.97 → 1);
  `wiggle` (collected from, 380 ms: xz 1.04 / 0.98, y 0.95 / 1.03); `rustle` (a fruit plant picked, 300 ms); `settle` (put down, 260 ms: y 1.06 → 0.94 → 1).

## Changes

**1. The tier, counted everywhere.** M, low risk. The player sees nothing yet.
- **Files:** `rewarded()` in every payout of `state.ts`:
  - sales: `acceptOffer`, `sellAll` (once for the whole line), `sendOrder`, `takeTill`, `sellToManager`, `sellAllToManager`, `sellToContractor`;
  - claims: `claimGoal`, `claimDaily`, `openGifts` (once per open);
  - levels: a level's coins (`least: 'big'`) and the first steps' reward;
  - goods collected, mostly small: `harvestBeds`, `takeFrom`, `collectMachine`.

  Nothing counts for a decline, a cancel, a refund or a full store.
- **Data:** `PACE.rewards = { within: 60, small: 0.5, bigUp: 0.15 }` in `targets.ts`; `report.ts` prints the shares.
- **Tests:**
  - `tier.test.ts`: the worth of coins, goods and materials; the bounds and `least`; the same sale shrinks as the level rises.
  - `state.reward.test.ts`: each payout counts once with its tier, a decline counts none.
  - `pace.test.ts`.

**2. Payouts in the world show their tier.** M, low to medium risk.
- **The player sees** "+120" and a coin rise over the buyer, the till, the manager or the contractor, sized by tier, gone in about 700 ms. Big and huge add confetti there. The pop is `aria-hidden`; the toast keeps the words.
- **Files:**
  - `state.ts`: its own `farmSound('coins')` calls go;
  - `FarmFx.tsx`: a `reward` request;
  - `styles.css`: `.pop-num`, from the tokens and hidden in the `clear` HUD.
- **Tests:** e2e `08-garden`. One sale shows one `.pop-num`; selling to the whole line shows one, not one per buyer.

**3. Payouts in cards show their tier.** M, medium risk: a visible change.
- **The player sees** the confetti, sound and haptic come from `celebrate(kind, rewardTier(…), el)` instead of hand-picked numbers (40–110 today). This covers the daily gift, goals, gift boxes, the orders board, first steps, the level-up and a machine's level. Day 7 and big orders grow by their worth. A modest goal or box loses its confetti (decision 1).
- **Files:** `DailyCard`, `GoalsCard`, `LevelCard`, `OrdersBoard`, `FirstSteps`, `XpChip`, `MachinePanelView`. Only their `burst` and `farmSound` lines change.
- **Tests:** a unit test for the confetti gate. Specs `35`, `21`, `22` and `37` stay green.

**4. One pop-and-fly; the gauge holds.** M, medium risk: a stuck hold would mislead, hence the 2 s release.
- **The player sees** surprises and the machine panel's goods land on the store's chip, and the tank step up as each lands.
- **Files:** `ui/fly.ts`, `fx/coins.ts`, and `StoreGauge` in `TopDash.tsx`. The tank and the Full flag show `used - goodsHeld`; the `aria-label` keeps the true count.
- **Tests:** in `fx.test.ts` with fake timers, a hold never goes below 0 and is released on cancel and on timeout.

**5. Goods fly from the world to their store.** M, medium risk.
- **The player sees** each bed or animal pop one picture with its count (`+16`: the ItemPic rule, never copies). It holds, then arcs to the store's chip.
  - Six beds send six pictures, 70 ms apart, at most 8 in the air. The XP crystals leave 120 ms later, so the two results read as two.
  - Nothing flies under less motion, with the top set to the compass alone or clear, or while a panel is open (the panel flies its own). The counts then change at once.
  - From behind the camera, a flight starts low in the middle of the screen.
- **Files:** `fx.ts` (`goodsFx`), `FarmFx.tsx`, and `store(id, n, at?)` in `state.ts`. It asks for a flight wherever it knows the place: `harvestBeds`, `takeFrom` (`toolTake` passes no place) and `collectMachine`.
- **Tests:** e2e `08-garden`, with 22-xp's slowed animations:
  - two beds fly two pictures (`fx.stats.goods`);
  - the silo shows its old count until the last picture lands (read in one `evaluate`);
  - nothing flies under `reducedMotion: 'reduce'`, or with only the compass at the top.

**6. The reactions engine.** S, low risk. The player sees nothing yet.
- **Files:** `src/fx/react.ts`; `Parts.at` with a `Vector3`; an optional root scale in `putCow`, `putSheep` and `putChicken`.
- **Tests:**
  - `react.test.ts`: every row starts and ends as given, never goes below 0, and ends by its `ms`; restart and freeze.
  - `parts.test.ts`: at (1.2, 0.8, 1.2) a model's box grows to match, and at scale 1 its matrices are as before.

**7. Crops react instead of vanishing.** M, medium risk.
- **The player sees:**
  - a harvested plant stretch and pop away as its picture leaves (`pluck`);
  - a sown bed sprout, with a small puff of soil (the bed-sized `dust` burst, which carries it alone if the sprout is too small to see at phone size);
  - watered plants perk up.
- **Files:**
  - `Plants.tsx`: each plant is put at `at(x, SOIL_Y, z, 0, scale)` with its grower at (0, 0, 0), the same at rest to float rounding. The crowd re-puts every frame while plants react (every 0.2 s otherwise).
  - A plucked bed draws its crop until the pluck ends or the bed is sown again, so the crowd never holds more than a full farm.
  - `react()` goes in `harvestBeds`, `plant` and `water`, so every way in passes it.
- **Tests:** the ghost rule in `react.test.ts`. A new `16-view` pose with the reactions frozen mid-way (`freeze(120)` after a harvest, a watering and a sowing) must match every pixel and depth.

**8. Producers react.** M, low risk: herds do not cast, and their soft shadow squashes along with them.
- **The player sees** lemons, eggs (in the box and the coop's nests) and fruit pop off (`pick`), and a fruit plant rustle. A cow or sheep wiggles when collected from, by the button or a tap in its tool panel.
- **Files:**
  - `takeFrom`: `react` with `{ from, to }` slots for the ghosts, and `wiggle`;
  - `Plants.tsx`;
  - `decorScene.tsx`: `Fruit` and the plant's `at` scale;
  - `Herd.tsx`: `reaction('animal', …)` into the pose.
- **Tests:** a unit test for the slot ghosts; a cow mid-wiggle joins 16-view's frozen pose.

**9. Things put down on the farm settle.** M, medium risk: the batch exclude.
- **The player sees** decoration, a bed or a place settle with a small bounce and a puff of dust at its footprint when it is dropped, turned or bought. The house already puffs.
- **Files:**
  - `edit.ts`: `drop` and `turn`;
  - `placeDecor` and `placeStored`: `react('thing', key, 'settle')` and `farmFx('dust')`;
  - the decor crowds' `at` scale;
  - the bed group in `Garden.tsx`, and `Placed`.

  A piece in a `StaticBatch` leaves the merge (`exclude`) for its 260 ms, as the gate's leaf does while it swings. A caster redraws the sun's map meanwhile, as for any move.
- **Tests:** a fence mid-settle joins 16-view's pose. Specs `13` and `33` stay green.

**10. Furniture settles** (optional, last). M, medium risk.
- **Files:** `decorate.ts` (beside `dustUnder`), the `PieceModel` group's scale, and the house's batch exclude.
- **Tests:** specs `15` and `31` stay green.

None of this adds a mesh, a material or a draw. The culling box follows the put matrices in the same frame, so `05-budget` and `27-far-copies` hold unchanged.

## Order of commits

1. The tier counted, and the sim row: **invisible until 2**. It lands early, so 01, 02 and 06 can build on `rewardTier`.
2. World payouts, after 06's `lessMotion()`. → 3. Card payouts. → 4. `popInto` and the gauge hold. → 5. Goods fly from the world.
6. The reactions engine: **invisible until 7**. → 7. Crops. → 8. Producers and herds. → 9. The farm settles. → 10. Furniture.

Each commit passes `npm run check` and its area's spec; the `16-view` groups come with commits 7–9.

## Overlaps

- **06-sound-haptics:** 05 owns `rewardTier` and `celebrate`, under 05's names (`huge` where 06 wrote `grand`). 06 owns `rewardSound`, `feelOf`, `coinLand`, the ticks in `landed`, and `lessMotion()`. Where both touch `fx/*`, `ui/fly.ts`, the cards and the sales in `state.ts`, 05 edits the lines that show and 06 the lines for sound and touch.
- **07-interface:** in `TopDash.tsx`, `StoreGauge` only. In `styles.css`, `.pop-num` and the flights block. In the cards, one-liners; whoever lands second rebases.
- **04-first-session:** in `FirstSteps.tsx`, the reward lines become `celebrate`. 05 moves no toast and launches no flight from a toast. Flights follow `data-hud`, so a quiet first screen stays quiet.
- **01-loop-economy:** one row each in `src/sim/targets.ts`, `pace.test.ts` and `report.ts`. `worthOf` reads `PRODUCE.price` and `CONTRACTOR.buys`; no price changes.
- **02-meta-collections:** for `daily.ts`, `gifts.ts` and `goals.ts`, `rewarded()` goes in `state.ts`, never in those pure files. A season stop or an album page is a payout of its own kind (`stop`, `page`).
- **03-characters-story:** buyers at the gate (`sell`, `Visitors.tsx`). The pop stands over the buyer's head.
- **08-engines-stability:** if `state.ts` is split, 05's edits there are small and local. In `parts.ts` and `lod.ts`, with the furniture's far copies, only `at()`. In `batch.ts`, only `exclude`.

## What is missing

**Decisions only the user can make:**
1. **Should tiers take confetti away from modest rewards?** Today every goal (70), order (40), daily day (54) and gift box (46–70) throws it. **Recommend yes:** too much juice lowers enjoyment (Kao), and each card keeps its stamp and count-up.
2. **Should the yardstick be the next level's coins (the daily gift's base), with bounds 0.25, 1 and 3?** They would be tuned so that in the first hour at least 50 % of rewards are small and at most 15 % are big or huge. **Recommend yes.**
3. **Is a level reached always at least *big*, while milestone levels, the fourth gift box and day 7 are bigger only by what they hold?** 06 assumed `grand` for these by rule. **Recommend by worth:** a show never promises more than it gives, and 01 or 02 can give milestones more.
4. **One picture per bed or animal with its count badge (the ItemPic rule), or 3–5 copies as the panels fly?** **Recommend one.**
5. **Keep the "+ 16 carrots" toast while the picture says the same?** **Recommend keep for now:** screen readers, surprises and "full" need it. 04 and 07 decide what goes in `TopStack`.
6. **Do the places and the furniture settle now?** They must leave the static merge for 0.3 s. **Recommend decoration, beds and places now, and furniture last,** dropped if it grows past M.
7. **Do harvests and collections go through the tier, so 06's sounds grade with them?** **Recommend yes.**

**Libraries:** none. WAAPI, `Parts` and canvas-confetti (already in use) do all of it.

**Skills and docs:**
- three.js `InstancedMesh` normals under non-uniform scale: `defaultnormal_vertex` divides by each column's length, which is correct for a scale along the axes.
- WAAPI's `onfinish` and `oncancel`.
- R3F's `useFrame` order.
- Playwright's `reducedMotion`, and 22-xp's slowed animations.
- `fillFarm`, `onMap` and `openingViews`.
- CLAUDE.md's "What is drawn".

**Assets:** none. The pictures exist (`iconUrl`, `art('coin')`), and 06 synthesises the sounds.

**Access:** nothing was blocked for this area.

## Done when

- **`npm run check`** is green, with `tier.test.ts`, `state.reward.test.ts`, `react.test.ts`, `parts.test.ts` (`at` with a `Vector3`) and the hold and confetti-gate tests in `fx.test.ts`.
- **`npm run sim`:** the level bands in `PACE` are unchanged, and in the first hour at least 50 % of rewards are small and at most 15 % are big or huge (`pace.test.ts`).
- **e2e:**
  - `08-garden`: flights, the gauge hold, less motion, the top hidden, one `.pop-num` per line sold;
  - `16-view`: the frozen pose (pluck, perk, sprout, wiggle, settle) matches every pixel and depth;
  - `05-budget`: green, with no new draws or triangles in either pass;
  - `25-button` and `22-xp`: green.
- **Screenshots** at 390×844 and 844×390, judged at phone size, not by pixel equality:
  - 0.3 s and 0.9 s after harvesting 3 beds: three counted pictures off the beds, clear of the toast, and the silo stepping up;
  - a cow mid-wiggle;
  - a fence mid-settle, with dust;
  - a 5-coin sale beside a big order.
