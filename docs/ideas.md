# Ideas kept for later

Worth building, not built yet. Each: what the player gets, why, and how it would fit what is there.

## First steps for a new farm

**What.** Six or seven short steps the first time you play — plant a bed, harvest it, sell to a buyer at the gate,
buy an animal, make the barn bigger, send an order — one at a time, each with a small reward and its mark on the
compass, gone once done.

**Why.** A new farm starts in the house with nothing to say what to do: the first minutes decide whether a player
stays.

**How.** The same rows and panel as the goals board (`GOALS` in `src/farm/data.ts`), as a first track that runs once
and in order; the compass already marks a thing and guides you to it (`guideTo`), and the walk there by itself
(take me there) does the rest. Nothing new in the save but which step you are on.

## The pace of the first twenty minutes

**What.** No dead time and no long wait for the first upgrade: measured, then tuned (starting coins, seed prices,
growing times, the first buyers' offers, the first upgrades' prices).

**Why.** Numbers set by hand drift as the farm grows; a slow start loses players, a fast one leaves nothing to want.

**How.** A unit test that plays the farm's own rules (`src/farm/state.ts`, its `tick` and actions) as a simple player
would — plant what pays best, sell to every buyer, buy the next animal or upgrade when it can — and reports when each
first thing happens (the first animal, the barn full, the first order sent) and every stretch with nothing to do. Then
change only numbers in `src/farm/data.ts`, and keep the report as a test so the pace cannot drift unnoticed.
