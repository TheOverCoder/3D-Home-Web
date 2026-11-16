23:53 start: reading role, craft, feedback, audit
23:54 done 1: 'The feeling of progress' added to lab/CRAFT.md (12 principles, sources)
23:54 start 2: level card, reworking B and C
00:07 done 2: level card — B and C rebuilt on the progress principles, A removed, 2 new states (almost, fresh); audit clean
00:07 start 3: opening screen (intro)
00:14 done 3: opening screen — A rebuilt as a title screen, all three with Farms/Music/Settings/Credits (credits sheet new), names/notes/states rewritten; audit clean
00:15 start 4: loading screen — 6 options with layered motion graphics
00:36 done 4: loading — 6 options (A 3D island, B parallax journey, C film opening, D seed to flower, E emblem builds, F 3D planet sunrise), shared bar/tip chrome
00:36 start 5: top of the screen — refine C, fix audit
00:40 done 5: top — C kept (chosen), A/B dropped, gauges 44 px, level road with quarters and a warm last quarter, new 'near' state; audit clean
00:40 start 6: new boards — goals first (the feeling of progress fits it best), then orders, saves, action
00:47 done 6a: goals board — A spotlight, B sticker book, C ladders; claims move goals on with endowed progress; audit clean
00:54 done 6b: orders board — A delivery slips (+Office tab), B crates to pack, C one order at a time (swipe); only the 5-order state scrolls in A/B
00:54 start 6c: saves board
01:02 done 6c: saves board — A card per farm with ⋯, B postcards to slide, C one farm in full; clearing a farm is a hold, never a tap
01:29 done: npm run check passes; lab check 51/51; audit clean but for scrolling lists (orders with 5 places, the postcards row in saves B). Not reached this round: action, edit, tag, touch, shop, market, seeds, store

## Round 5 (the second round of answers, f707317)
02:56 start: reading the answers, craft, boards; the lab served
02:57 done: top — one variant, D (chosen: C+pinned goal; C merged into it), round line says so; saves — one variant, D (chosen), C merged
02:57 start: orders
03:07 done: orders — one reference E (D removed: the duplicate), scroll fixed (LevelSheet scrolls), sideways 3 in a row, goods fly on Put in, ghost pegs, READY tag, Office buys after a card
03:07 start: goals
03:13 done: goals — one reference E (D removed), a sticker grows into the spotlight (container transform), its words crisp; scroll fixed
03:14 start: level — one reference F: quarter boxes, gift button, level-up gift by itself
03:26 done: level — one reference F (D, E removed): four boxes on the bar, a clear opening in the card's middle, a gift button for all that wait, the next level's prize comes by itself; fits upright and sideways
03:36 done: intro — one reference E (A, D removed): a real menu (New farm, Load farm, Settings, Music, How to play, Credits), pages slide inside the card; Load farm is the saves board's D; settings only the game's own
03:36 start: loading — one shared stage for all six
03:48 done: loading — all six on one shared stage (sky, name, disc and rays, card, ready moment); G folded into a 'back' state (away report, ✦)
04:22 checks: npm run check passes; audit clean on all seven boards but for lists that scroll (orders upright with 3–5 orders, sideways with 5; the settings page sideways); the shared sheet now closes only on a touch that began outside it (the Office tab had closed it)
04:23 done: lab-check 63 of 63; round 5 handed back

## Round 6 (the third round of answers, 323e07f)
09:09 start: reading the answers (orders E into the game, goals round 4, the 3D boards' marks), the lab served on :5232
09:13 done 3: the 3D boards' marks — cause: their added (09:00) was hours ahead of the user's clock (08:56), and an answer counted only if given after added; now an answer names its round (round === added), the clock no longer decides; lab-check marks a 3D board with the clock 5 h before its added (fails on the old code, passes now)
09:40 done 1: orders E in the game — src/farm/orderBoard/ (OrdersBoard.tsx draws an OrdersView, calls OrdersActions; view.ts, sources.ts), src/farm/OrdersPanel.tsx feeds the farm; no tractor tag; Office tab with its card over the board (office-upgrade is the same board with the card open); a long order scrolls inside its plank sideways; layoutScroll on the board (planks slid over each other as the board scrolled: 17 failed on it); lab board 'orders' is live (today = the game's component on sample data, a 'long' state); 17 passes, 25 passes
09:47 start 2: goals round 4 — E: every reward inside its own card (the coin stickers hung over the card above), the spotlight's at the end of its bar, the pin in a cell of its own sideways, a sticker swaps places with the spotlight (only two move), "% there already" only after a claim, whole names on reached stickers, a fade at the foot, Claim all (✦); F new: the medal case (metals by step, a shelf swiped under the finger, the medal spins into its next metal on a claim)
10:04 done 2: goals round 4 committed (E exact + Claim all ✦; F the medal case); audit clean on goals and orders; films: E swap sideways, E claim all (the film's stopped clocks froze it; real time correct), F claim spin, F swipe
11:08 checks: npm run check passes (511 tests; one earlier run timed out a far-copies test under the machine's load, alone it passes); 17 and 25 pass (11 of 11); lab check 66 of 66 (the 3D marking step on all three screens); audit clean on every board (a scrolled-away button no longer counts as under the bar); the game's orders board shot upright and sideways (lab/map/orders-*.jpg)
