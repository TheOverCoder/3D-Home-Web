# Mission 03: neighbours, their requests and a light story (`03-characters-story`)

**Goal:** five named neighbours the player comes to know, who ask for the farm's goods, write letters and tell a
light story in chapters, built on one engine where people, lines, requests, letters and chapters are rows.

**How a player will feel it:** the same face walks up the lane on Tuesday mornings, says your name and asks for
"the usual". A request on the board has a person behind it, a letter thanks you, and the next chapter is a small,
kind reason to plant one more bed before bed. The farm stops selling to strangers and starts having neighbours.

## Principles applied

- Relatedness can come from characters in a single-player game (`psychology.md §1.1`; Top 10 #7, "neighbours, not
  NPCs"): regulars who remember you, greet you, say thanks.
- Named neighbours with a friendship that only grows, lines opened by friendship so they do not repeat
  (`farm-games.md P8`); villagers who repeat themselves drove players away (`P8`, `P14`).
- A story meta matters: Homescapes 68 % D1 against Wildscapes 38 % without it, *(secondary)* (`farm-games.md`,
  Benchmarks). Kept light: no choices, no fail state.
- Chapters are natural stopping points (`psychology.md §1.11`, Alter) and honest open loops that never nag (`§1.5`).
- The next neighbour and chapter are shown as a silhouette with its level (`psychology.md §1.9`).
- Letters wait as a gift, never a threat (`farm-games.md P4`; `psychology.md §1.12`). No "waiting for you", no sad
  faces at leaving, no fake social pressure (`psychology.md §2`, items 2 and 9).
- Modest rewards, praise as information; no XP for friendship; nothing falls (`psychology.md §1.13`, `§1.7`).
- A request is an order with a face: a channel that pays what coins cannot buy (`farm-games.md P5`).
- Attention budget: one card at a time in the existing queue, nothing new on top of the screen, the signal in the
  world (`farm-games.md P14`; `ftue-ux.md §1.3`, `§1.5`).
- Muted play first: the story is text, the voice a bonus (`feel-sound.md §1.9`: up to half play muted).
- One word for one thing: never two people of one name in sight (`ftue-ux.md §1.8`: two buyers named Yoni).

## Foundation first

**Exists:** the people engine (`rollLook`, overrides, `sanitizeLook` in `src/models/look.ts`); `steadyLook`, written
twice (`src/farm/state.ts:2966`, `src/film/cast.ts`); fixed looks in two places (`MANAGER_LOOK`, `ESTATE_LOOK`,
`CONTRACTOR_LOOK` in `look.ts`, `DRIVER` in `src/models/tractor.ts`); voices in two places (`VOICES` in
`src/film/voice.ts`, the `AGENT`/`DRIVER` Talkers in `src/talk/speech.ts`); `TALK` rows and `mayTalk`/`nextLine`
(`src/talk`); the orders engine (`src/farm/orders.ts`) and the board's design layer (`orderBoard/view.ts`,
`OrdersBoard.tsx`); `FarmerFace` with `MOOD_MOVES`; films as data (`src/film/format.ts`, `Look`); `Prize`
and `give()` (02's F1 moves them to `src/farm/prize.ts` and adds a decoration kind); `UNLOCKS` with `unlockPic`;
`HOURS`; the card queue (`useGameFree`, `DailyWatcher`); `dayNumber` (02's F4: `src/farm/calendar.ts`).

**Add** (each needed by two or more uses now):

- **A. `PEOPLE`** (`src/data/people.ts`): one row per named character: name, look (seed and overrides), voice,
  picture. Neighbours add `likes` (two goods), `birthday` (month and day), a `HOURS` row, a trait for their lines.
  Read by `state.ts` (the dresses), `film/cast.ts` (`lookOf`, `voicesOf`), `talk/speech.ts` (`talkerOf(id)`) and
  `tractor.ts` with the gallery and checks. `steadyLook` lives once, in `look.ts`.
- **B. `Portrait`** (`src/ui/Portrait.tsx`): `FarmerFace` made general for any person and mood. The farmer keeps his
  Fluent faces; the others show a picture drawn from their own model, moved by `MOOD_MOVES`. Used by letters, request
  planks, the buyers' panel, the neighbours' sheet and the first steps.
- **C. One line type** for whatever a character says, on screen or aloud: `{ who, say, mood: FarmerMood, hearts? }`,
  with `voiceMood()` mapping to the film's `Mood` for the speech voice. Used by `TALK` rows and letters.
- **D. Orders with a sender:** `Order.from?: PersonId` and `Order.chapter?: ChapterId`, saved (old saves have none).
  Used by neighbours' everyday orders and chapter requests.

**Not added:** dialogue trees, choices, a new currency, timers, a server.

## Changes

1. **One table of people.** *Sees:* nothing. *Files:* new `src/data/people.ts`; `look.ts` (`steadyLook` exported);
   `state.ts` (`MANAGER_DRESS`, `CONTRACTOR_DRESS`, `AGENT_DRESS` from rows); `film/cast.ts` (`Look` gains
   `{ person: PersonId }`); `film/voice.ts` (`VOICES` from rows); `talk/speech.ts`; `models/tractor.ts`. *Rows:*
   farmer, manager, contractor, agent, driver. *Tests:* `people.test.ts` (each look passes `sanitizeLook`; the four
   fixed looks are exactly today's, against values captured first; names unique; voices in range); film and drive
   tests stay green. **S, low.**
2. **Portraits.** *Sees:* nothing new yet. *Files:* `Portrait.tsx` (`FarmerFace` re-exports it); a `people` mode of
   `scripts/render-item-art.mjs` saving `src/assets/people/<id>.webp`; `art.ts` entries mailbox, love-letter,
   envelope, red-heart, birthday-cake (Fluent, credited in `src/data/credits.ts`). *Tests:* every person row has a
   picture (as `unlockArt.test.ts`); `37-first-steps` green. **S, low.**
3. **Friendship.** *Sees:* nothing until 4. *Files:* new `src/farm/people/friends.ts` (pure: `heartsOf`,
   `befriend`); `state.ts`: `farm.people` in `FarmData`, `fresh()`, `load()` (`sanitizePeople`), `befriend` called in
   `sell()` and `sendOrder()` only. *Rows:* `FRIENDS = { sale: 1, liked: 2, order: 3, chapter: 5, hearts: [3, 8, 15,
   25, 40] }`, set by `npm run sim`. Hearts never fall and give no XP. *Tests:* `friends.test.ts`; `save.test.ts`
   (an old save loads with no one met; nonsense is clamped). **S, low.**
4. **Neighbours at the gate.** *Sees:* now and then a regular takes a stranger's turn in the line (the line comes no
   faster): the same face and clothes every time, their name, a small heart on their bubble, one of their two liked
   goods asked, a fair or generous price, never a low one. In the buyers' panel, their portrait and hearts replace the
   shirt-coloured disc. No stranger shares a name with a neighbour or with anyone else in line. *Files:* new
   `people/visits.ts` (pure `whoComes(f, phase, rand)`: met, in their `HOURS`, not already in line); `state.ts`
   (`newVisitor`/`spawnVisitor` take `who`; `SavedBuyer.who`; `load()`); `data.ts` (`NAMES` without the neighbours,
   `PEOPLE_ODDS.visit`); `Visitors.tsx` (heart on the bubble); `FarmUI.tsx` `QueuePanel`. Off under Vitest and on
   `?debug` unless `&neighbours=on` (`people=` is the stress parameter), `__home.farm.people.quiet(false)`; `ready()`
   and `bootApp` quiet them. *Tests:* `visits.test.ts` (`setRandom`, hours, no duplicates, liked goods); a saved line
   with a neighbour loads as that neighbour. **M, medium** (prices: sim).
5. **Their lines.** *Hears:* a neighbour greets you by name and thanks you, with new lines as hearts grow, rare as
   now. *Files:* `talk/lines.ts` (`Speaker` widened to `PersonId`; moments `<id>-arrive`, `<id>-thanks`; `hearts` per
   line); `rules.ts` `nextLine` (only lines at or under their hearts); `FarmTalk.tsx`. The strangers' guilt lines go
   (`buyer-wait` "Still waiting", `buyer-no` "Oh well"). *Tests:* `rules.test.ts`; a kind-words test over every
   line in `TALK`, letters and chapters ("waiting for you", "miss you", "hurry", "last chance", "lonely"…).
   **S, low.**
6. **Requests on the board.** *Sees:* some orders come from a neighbour, with their portrait and name at the plank's
   head, asking for what they like. A chapter's request is pinned above the board's places, with no clock and no ×.
   *Files:* `orders.ts` (`from`, `chapter`, `makeRequest`); `state.ts` (`growOrders`/`sendOrder` pick a neighbour at
   `PEOPLE_ODDS.order`; `farm.requests` pinned; `fillOrder`/`sendOrder` take a request; save and `load()`);
   `orderBoard/view.ts` (`OrdersView.requests`, each order's person); `OrdersBoard.tsx`; `OrdersPanel.tsx`;
   `src/sim/policy.ts` fills requests as orders. *Tests:* `orders.test.ts`, state and save tests; `17-stores-orders`
   green; the new e2e spec (the plank upright and sideways). **M, medium** (01 changes order sizing here).
7. **Letters and the mailbox.** *Sees:* a mailbox by the garden gate whose flag goes up when a letter waits; it is on
   the compass (`ready()`) and the button says *Read*. The letter card shows the writer's portrait and one line at a
   time, typed in, read aloud in their voice when sound is on (a line can be another speaker's: the farmer introduces
   a neighbour). Tap for the next line; the gift on the last page, *Claim* (through `give()`: it flies home, into its
   store past full, as surprises do; no XP). The corner menu gains *Neighbours*: everyone met (portrait, hearts, liked
   goods, birthday), letters to read again, the story's road. The welcome-back card counts new letters. Only the very
   first letter opens by itself, after the first steps and the daily gift. *Files:* `people/mail.ts` (pure: `deliver`,
   `open`, `sanitizeMail`, the last 30 read kept); `state.ts` (`farm.mail`, `readLetter`); `people/LetterCard.tsx`
   from `letterView`, `NeighboursCard.tsx` from `neighboursView` (on `PanelSheet`, the shared base); `store.ts` panels
   `letter`, `neighbours`; `HudMode.tsx`; mailbox model (sculpt kit, flag as its own part) in
   `src/models/structures.ts`, `gallery.ts`, `checks.ts`; `src/farm/Mailbox.tsx` (interactable, collider, drawn
   outdoors); `AwayPanel.tsx` row. *Tests:* `mail.test.ts`, save test; new e2e spec; `25-button` presses the mailbox
   by itself; `12-models` checks; `05` measured; `16-view` equal. **L, medium.**
8. **Chapters.** *Sees:* the story in acts. A chapter is a letter (two to four lines) and a pinned request; once it is
   sent, a thank-you letter and a gift (a decoration piece into the farm's store, or materials and coins), then the
   next neighbour or chapter as a silhouette with its level, on the story's road and the level card. The first
   neighbour moves in as the first steps end. *Files:* `people/chapters.ts` (`CHAPTERS` rows: id, act, who, level,
   intro lines, ask `{ good, n }[]`, thanks lines, reward a `Prize` (02's decoration kind included), `film?`);
   `people/story.ts` (pure `nextBeat`, `sanitizeStory`); `state.ts` (`farm.story: { done, on, sent }`, passed a frame
   later as the steps are; the reward through `give()`); `unlocks.ts` (`person:<id>` rows: the level each neighbour
   moves in; `unlockArt.ts` picture and name); `levelView.ts`. *Rows:* act 1, five chapters, levels 5 to about 15, one
   per level that 01's unlock rows leave free. *Tests:* `chapters.test.ts` (ids unique; the writer exists; every good
   asked is open by the chapter's level, as the recipes' test; at most three kinds; levels rising); `story.test.ts`
   (one chapter at a time; waits for the first steps; a level-30 save gets chapter 1, then the rest in turn); save;
   `PACE.story` and the sim; new e2e spec. **L, medium.**
9. **Hearts and birthdays.** *Sees:* each heart brings a letter with a small gift and opens new lines. On a
   neighbour's birthday (the device's calendar, `dayNumber` in 02's `calendar.ts`) they send a slice of their cake:
   they give, never ask; a missed one costs nothing and comes back next year. *Files:* letter rows in
   `people/mail.ts`; `state.ts` delivers on a heart and on the day's first look. *Tests:* unit, with a set clock.
   **S, low.**
10. **Act 1's finale film** (only if the user asks for the film director): a `FILMS` row casting `{ person }` looks,
    opened by chapter 5's thanks (`askFilm`). **L, separate request.**

## Order of commits (each green)

1 → 2 → 3 → 5 (all invisible but the softer strangers' lines) → 4 (neighbours appear) → 6 → 7 →
8 (needs 7's letters and 02's F1; the story starts here) → 9 → 10. Each: `npm run check`, then the spec it
touches (`17`, `25`, `37`, the new one; `05` only for 7's mailbox, its group).

## Overlaps

- **01 (loop and economy):** `orders.ts` and the orders part of `state.ts`, `UNLOCKS` levels, `PACE`, `sim/policy.ts`,
  prices. 01 owns how an order is sized; 03 only adds `from`, `chapter` and the pinned place, in functions of its
  own. Neighbours' levels go into the same `UNLOCKS` pass as 01's rows.
- **02 (meta):** 03 builds on its F1 (`prize.ts`, `give()`, the decoration prize) and F4 (`calendar.ts`) and does
  not write its own. The corner menu (`HudMode.tsx`): 02 puts *Album* after the news, 03 *Neighbours* after it.
  The mailbox takes any letter row, so 02's charm column can move into a letter. Cards come in one order: welcome
  back → daily gift → level and unlock → letter.
- **04 (first session):** `firstSteps.ts`, `FirstSteps.tsx`, `FarmerFace.tsx` (turned into `Portrait` here, so
  agree its props first), `AwayPanel.tsx`, and the doubled buyer names (03 fixes them in item 4; 04 leaves them).
- **05 (world feel):** letter gifts and chapter rewards use its reward-tier function once it lands.
- **06 (sound):** the letter's, heart's and mailbox's sounds; the voices' volume.
- **07 (interface):** `QueuePanel` in `FarmUI.tsx`; the new sheets are built on the base from the start.
- **08 (engines):** a split of `state.ts`. 03 keeps its logic in `src/farm/people/` with thin hooks into `state.ts`,
  and rebases onto the split. The new e2e spec's number is given at plan time (38 is the last today; 02 plans
  39 and 40).

## What is missing

**Decisions only the user can make:**

1. *Names:* the game's own style (Hebrew names, as `NAMES` and the herd have) or English names? **Recommend:** the
   game's own, easy to read in English, taken out of `NAMES`.
2. *Who the five are:* a baker (flour, eggs), a teacher (lemons, strawberries), a knitter (wool, cloth), a beekeeper
   (sugar, cakes), a child who loves the animals (milk, eggs)? **Recommend** these, each tied to goods the farm makes.
3. *Tone:* warm and gently funny like the films, or quiet and sincere? **Recommend:** warm and gently funny, in the
   films' plain English (`lab/FILM.md`; "one idea a line, no idioms").
4. *How much story:* none (neighbours only), one act of five chapters to about level 15 with later acts as rows, or a
   long story from the start? **Recommend:** one act now.
5. *Does the farmer get a name and introduce each neighbour?* **Recommend:** yes; no body in the world yet.
6. *A mailbox in the world, or letters only in the corner menu?* **Recommend:** the mailbox.
7. *Birthdays?* **Recommend:** yes, as a gift from them.
8. *Portraits:* drawn from each neighbour's own model, or Fluent emoji people like the farmer? **Recommend:** their
   own model, so the face in the letter is the face at the gate.
9. *Chapter rewards:* existing decoration and materials, or a new unique piece each (new models)? **Recommend:**
   existing for act 1.
10. *A film for act 1's end?* **Recommend:** yes, later, as its own request to the film director.

**Libraries:** none. Speech, motion, models and saves already exist.

**Skills, knowledge, docs:** `lab/FILM.md` (words); `src/talk/speech.ts` (voices, priming on a phone); CLAUDE.md
"Making models" (the mailbox) and "What is drawn" (`cell: 'outside'`); `scripts/render-item-art.mjs`; the card queue
(`useGameFree`, `DailyWatcher`); writing about 150 short lines in one voice per neighbour.

**Assets:** Fluent Emoji 3D (MIT): "Closed mailbox with raised flag", "Love letter", "Envelope", "Red heart",
"Birthday cake", all fetched with HTTP 200 from `raw.githubusercontent.com/microsoft/fluentui-emoji`, credited in
`credits.ts`. Portraits drawn from the game's own models; the mailbox modelled in code; sounds synthesised (06).

**Access:** nothing blocked; GitHub raw was reachable.

## Done when

- `npm run check` is green with the new unit tests: people, friends, visits, mail, chapters, story, kind words, and
  each save conversion (a save from today loads unchanged; a neighbour in a saved line comes back as themselves).
- `npm run sim`: every `PACE.levels` band still holds; the first neighbour is met by level 5; each act-1 chapter is
  sent within its `PACE.story` band of its level; the first heart comes within 20 minutes of meeting; no chapter
  waits on a good that is not open.
- The new e2e spec passes at 390×844 and 844×390. Screenshots at phone size, judged by eye: the letter card, the
  pinned request with a portrait, the neighbours' sheet, a neighbour in line with a heart, and the mailbox flag.
- `05-budget` passes with no new debt; `16-view` compares equal; `25-button` presses the mailbox and a request;
  `22-xp` finds nothing new on top of the screen.
