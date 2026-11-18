# Mission 07: the interface

**Goal.** Every panel is drawn by one shared base, every line on the screen can be read on a phone, and the top of the
screen asks for one thing at a time.

**How a player will feel it.** Every panel opens, swipes away and closes the same way. Nothing is too small to read
or to hit with a thumb, upright or sideways. At rest the top of the screen is calm: one thing moves when it has
something to give, and the rest show their counts and hold still.

## Principles applied

- One thing calls at a time; badges stay on the menu's corners (`farm-games.md` P14; `ftue-ux.md` §1.5).
- Text of 15 px or more, one word for one thing (`ftue-ux.md` §1.8).
- Targets of 44 pt and 48 dp; a question only where something is spent (`ftue-ux.md` §1.9).
- A press answers at touch-down; springs; exits of about 195 ms (`feel-sound.md` §2, §5).
- Animate only `transform` and `opacity` (`feel-sound.md` §11).
- No pop-up cascades and no pressure words (`psychology.md` §2, items 2 and 8; §1.13).

## Foundation first

**Where the panels stand today.** There are 32 kinds of panel (`Panel` in `src/store.ts`), drawn by **five
different frames**:

| Frame | Panels | Own CSS (lines / media queries) | `GoodPic` | Moving it saves | Risk |
|---|---|---|---|---|---|
| `PanelSheet` (the base) | tool | ToolPanel.css 144 / 1 | yes | already on the base | none |
| Own copies of PanelSheet | machine, machine-slot (`MachinePanelView`), orders, office-upgrade (`OrdersBoard`) | 261 / 1, 373 / 2 | yes | about 45 lines of sheet code each, and the `ob-root` and `ob-sheet` CSS | M to H: a head with pages, tabs in the head, the wood surface, an Esc chain; `RemoteTag` reads `.mp-sheet`; specs 17, 25, 32 |
| `SwipeSheet` | level, goals, daily, news | 224 / 2, 252 / 4, 315 / 9, 195 / 7 | no | SwipeSheet (134 lines; it closes on a 450 px/s swipe, `swipedAway` on 500), and the press override each card copies | M: each card draws its own head; the lab's boards render them; specs 21, 22, 34, 35 |
| `Shell` | seeds, bed, build, queue, shop, store, store-upgrade, furniture, buy-piece, decor-shop, decor-buy, away, manager, market, market-place, market-buy, contractor, car, estate, house-buy, ladder, skins (12 files, 23 uses) | the frame in styles.css (about 45 lines, 2 media blocks), Shop, MarketPanel and SkinShop CSS | only queue and store | one frame for 22 kinds | M: one commit moves 22 kinds; specs wait for the panel to close |
| Its own | wardrobe (`dressView` frames the camera from it), settings drawer, house screens (dark by design), `ConfirmCard` | 57 / 1; styles.css; 449 / 3 | no goods | settings: one close and one head | L |

`Shell` on a phone is a bottom sheet made by CSS: no grabber, no swipe, no way out (it vanishes at once), sizes of its
own (86 dvh against 92; 500 px sideways against 610; titles of 26, 25 and 21 px) and CSS keyframes, not the presets.
`ConfirmCard` is dead code: nothing ever sets `confirm`. The other parts with their own CSS (TopDash, XpChip,
HudMode, Compass, ThingTag, Unlocked, the edit cards; FirstSteps is 04's) keep their looks, and get only the
readability and motion passes.

**Readability today**, measured in the CSS:
- 153 font sizes are under 15 px, and 22 under 13 px. The ones a player sees: the word under the second action
  button (11 px), a buyer's mood tag (12.5), the edit cards sideways (12.5), and the house screens (11 to 12.5).
- Targets under 44 px: the settings' segments (38), the switches (30 tall), the house screen's close (36).
- Contrast: `--sun-lip` as text on paper is 2.35:1 (the amber warning when a piece blocks the way, a machine's level,
  an empty place). A card you cannot use yet is dimmed to an opacity of 0.45 to 0.6, so its words read at about 2.2
  to 2.5:1.
- Seven looping keyframes repaint `box-shadow` or `background` on every frame (`level-card-run`, `level-card-ask`,
  `mp-next`, `nw-twinkle`, `nw-chase`, `ob-soon`, `eq`).

**The top at rest** (`ftue-ux.md` shot 27): about 20 things on screen, and up to six loops at the top. The XP road's
stripes always run; the level's gift glows and its prize wiggles; the menu's gift hops; the compass's pin breathes; the
gear on the thing you look at spins.

**What to add.** Each item has at least two uses now.
- **F1. One sheet: `PanelSheet` grows into the only sheet.** It gains:
  - `pic` as a URL or a node (the level's star with its number);
  - `back` for a panel with pages (the machine), and `sub` that can hold tabs (the orders board);
  - `size: 'panel' | 'card'`: a card is a question, as tall as its content;
  - a typed `foot: { cancel?, action }`, so "at most two buttons, Cancel first" is enforced by the types;
  - an exit driven by `AnimatePresence`, as well as by `closing`;
  - SwipeSheet's two good habits: the shade lifts with the finger, and a sheet on its way out takes no touch.

  It keeps `.farm-panel`, its `aria-label` and "Close (Esc)", so tests still find a panel. `Shell` keeps its
  signature and renders a `card` through it, so the lab's boards build unchanged. Uses: 31 kinds, and the lab.
- **F2. Sheet tokens on `:root`**: `--sheet-max-up`, `--sheet-w-side`, `--head-art`, `--title` and `--title-side`, in
  place of the three sets of numbers the frames disagree on. Uses: PanelSheet, the wardrobe, the lab's frames.
- **F3. `nope(el)` and `did(el)` in `src/ui/motion.tsx`**, reading 06's `lessMotion()`. They replace the 6 `NOPE` and
  6 `DID` call sites, which each check reduced motion in their own way. Uses: these 12 call sites, and 06's "cannot"
  sound, which goes inside `nope`.
- **F4. The attention budget** (`src/ui/calls.ts`): `CALLS` rows (the level's gifts, a goal to claim, the daily gift,
  the news, the compass's walk, the thing's tag), each with a rank, and `useCalling(id)`, which is true only for the
  highest-ranked row that applies. Uses: the HUD's chips, and 04's first-session holds (a row `held` until the steps
  end).
- **F5. A readability checker** (`tests/e2e/readable.ts`): text of 13 px at least and 15 px for words; each target's
  real hit area, by `elementFromPoint` on a 44 px box (48 px on touch); contrast on solid surfaces; the panel inside
  the viewport; every good's picture outside a button a `.good-pic`. Uses: `39-panels`, `22-xp`'s top, `07-phone`,
  and 04's new hints. `PANEL_KINDS` in `store.ts`, whose type is checked to cover the whole `Panel` union, lists the
  kinds the spec opens: a new panel is measured by being added.

## Changes

1. **The readability spec, `39-panels`, in report mode.** A phone page of its own (390×844 and 844×390, touch, dpr 2)
   on a farm with plenty of everything (as `25-button` makes it). It opens every kind in `PANEL_KINDS`, then checks
   the top at rest and with a toast. Today's failures are a list of debts, as `05` keeps its debts, and the list
   shrinks with each change below. `PANELS_SHOTS=1` saves stills of each panel. Unit test: `PANEL_KINDS` covers the
   union, with no duplicates. Size M, risk L (tests only; tagged `@boot`).
2. **PanelSheet grows (F1, F2).** Invisible. Files: `src/ui/PanelSheet.tsx`, the sheet section of `styles.css`.
   Size M, risk L.
3. **Shell becomes a card on PanelSheet.** All 22 kinds get the grabber, swipe to close, the picture's `ARRIVE`, the
   0.2 s way out, and the same widths and titles. Code: `Shell.tsx`; the `.farm-backdrop` and `.farm-panel` frame rules
   are deleted. A panel now closes 0.2 s after ✕, so a `closePanel()` helper in `helpers.ts` waits for it. Run specs
   08, 17, 20, 21, 23, 25, 30, 33 and 36. Size M, risk M (one commit, easy to revert).
4. **The level, goals, daily and news cards move off SwipeSheet**, one commit each. Each card's head becomes the
   sheet's head; its CSS keeps its content and loses its frame. SwipeSheet is deleted with the last card, and
   `npm run lab:build` stays green. Size M each, risk M.
5. **The orders board and the machine panel move onto PanelSheet.** Their copies of the sheet go; their wood and
   pages stay. Run specs 17, 25, 32 and 38. Size M, risk M to H (the most code that moves).
6. **The settings drawer moves onto PanelSheet**, after 06 adds its rows. It comes from the right sideways and on a
   computer, as now. The wardrobe keeps its own frame (`dressView` measures it) and uses the tokens. Run specs 03 and
   28. Size S, risk L.
7. **`GoodPic` where it is still missing**, so each good says where it is made: `MarketPanel.tsx:41`, `:338`, `:367`;
   `ContractorPanel.tsx:50`; `AwayPanel.tsx:90`; `DailyCard.tsx:440`; `LevelCard.tsx:52`, `:169`; `GoalsCard.tsx:324`;
   and the lucky draw's two goods once the reels stop (`LuckyReels.tsx:116`). Pictures inside a button stay `ItemPic`.
   Size S, risk L.
8. **The motion pass.** F3's helpers replace the 12 call sites. The 12 hand-made springs and presses use `SPRING`,
   `PRESS` and `SINK`. The seven repainting loops become an opacity on a layer of their own, as `xp-ready` already is:
   they look the same and cost less (06 changes no CSS, so this is ours). Size S, risk L. Players notice nothing.
9. **The top's attention budget (F4).**
   - At rest, at most one loop runs at the top, and the XP road's stripes run only while XP comes in.
   - The level's gift glow and wiggle, the menu's gift hop, the goals' glow and the thing's tag each ask
     `useCalling`.
   - Badges stay on the menu's corners, the level's gifts and the goals' ready count.

   Files: `XpChip.tsx`, `TopDash.tsx`, `HudMode.tsx`, `Compass.tsx`, `ThingTag.tsx`, and their CSS. Unit test:
   `calls.test.ts` (which row calls, for each mix). The spec counts the infinite animations at the top with
   `document.getAnimations()`: at most 1. Size M, risk L to M.
10. **Sizes and targets.** Nothing a player sees is under 13 px, and every line of words is 15 px or more. That covers
    the second action button's word, the mood tags, the edit cards and the house screens, and `.tag` according to
    decision 2. Targets are 44 px to the eye, with a 48 px hit area on touch (decision 3), grown with `::after`, so
    `07-phone`'s boxes do not move. Size M, risk L.
11. **Contrast.** A token `--amber-ink`, at least 4.5:1 on paper, replaces `--sun-lip` wherever it is text. A thing
    not open yet keeps its words in `--ink-2` (6.6:1) and fades only its picture: the `.off` class (decision 5).
    Size S, risk L.
12. **Consistency.**
    - The first button of a card that asks has one word (decision 4; today "Not now" ×6 and "Cancel" ×4).
    - Settings closes with *Done*, not *Back to the house* (`ftue-ux.md` §1.8).
    - *Sell to all · 9* says how many it serves ("Sell to 2 · 14").
    - `ConfirmCard`, its CSS and the unused classes the spec finds (`.eyebrow`, …) are deleted.
    - CLAUDE.md "Interface" is updated: one sheet, Shell as its card, `calls.ts`, `39-panels`.

    Size S, risk L.

No save changes, no new buyables, no numbers and no 3D change: `05`, `16` and `npm run sim` are not affected.

## Order of commits

1. Change 1, the spec in report mode. *(Invisible.)*
2. Change 2, PanelSheet grows. *(Invisible until commit 3.)*
3. Change 3, Shell on PanelSheet.
4. Changes 4 and 5, one commit per panel: level, goals, daily, news (SwipeSheet deleted), the orders board, the
   machine panel.
5. Change 7, `GoodPic`.
6. Change 8, motion, after 06's `lessMotion()` lands. *(Invisible.)*
7. Change 9, the attention budget.
8. Changes 10 and 11, one commit per area: the HUD, the panels, the house screens.
9. Change 6, settings, after 06's rows.
10. Change 12. The list of debts is now empty, and its checks become hard failures.

Each commit runs `npm run check`, `39-panels`, and the specs listed for its change.

## Overlaps

- **04 (first session)** owns what is held back in the first session and when it appears (its rows in `calls.ts`),
  FirstSteps (its ✕ and its loop), `FirstHint`, the `TopStack` slots, the start menu's footer, the stick's hint and
  the welcome-back card's *Next* row. 07 owns the frames, the sizes, the base and the checker. In `AwayPanel.tsx`, 07
  changes only the frame and the `GoodPic`. In `calls.ts`, whichever mission lands first creates the table and the
  other adds rows. 04's new hints must pass `readable.ts`.
- **05 (world feel)**: `celebrate` and the tiers inside DailyCard, LevelCard and XpChip, and `popInto` into TopDash's
  chips. 07 moves only the cards' frames (change 4) and the XpChip loops (change 9). Each mission changes its own
  lines in those files.
- **06 (sound and haptics)**: 06 owns `src/lib/motion.ts` and `useStill()` for less motion, and changes no CSS. 07
  builds `nope()` and `did()` on `lessMotion()`, where 06's sound goes, and moves Settings after 06 adds its rows.
- **01, 02 and 03**: new panels (the album, the season road, the mailbox, neighbours' letters, new machines) are built
  on PanelSheet and added to `PANEL_KINDS`, and the spec measures them by that. 03 adds content to the orders board
  after change 5.
- **08 (engines)**: split FarmUI, MachinePanelView, OrdersBoard and DailyCard after their frames move, or along the
  frame's boundary. `ConfirmCard` and the unused CSS are deleted here, not in 08.

## What is missing

**Decisions only the user can make** (recommendation in bold):

1. Cards that ask stay at the bottom of a phone, where the thumb is, centred only on a computer; and every sheet,
   cards included, can be swiped away (closing never spends). **Yes.**
2. Chips and counts (`.tag`, `.count`, badges) may stay at 13 to 14 px, with every line of words at 15 px or more.
   **Yes** (at 15 px, the top's chips no longer fit in one row sideways).
3. A 48 px hit area on touch screens, keeping the 44 px look. **Yes.**
4. The first button of a card that asks: *Cancel* or *Not now*? **Cancel**: it is CLAUDE.md's own word, and neutral.
5. Something you cannot do yet keeps its words at full contrast, with only its picture faded. **Yes.**
6. At most one looping animation at the top at rest, and the XP stripes run only while XP comes in. **Yes.**
7. Delete the dead `ConfirmCard`. **Yes.**

**Libraries.** None. `@axe-core/playwright@4.14.0` (MPL-2.0, released 2026-10-15) could check contrast, but it
cannot see the 3D scene behind the HUD's chips, and `readable.ts` is about 100 lines.

**Skills and docs.** Motion for React (`AnimatePresence` with drag controls); Radix Popover's collision rules inside a
scrolling sheet; WCAG 2.2's contrast formula and target size (2.5.5, 2.5.8); `env(safe-area-inset-*)`;
`lab/README.md` (the lab's boards render these panels).

**Assets.** None. **Access.** None needed; the npm registry was reachable.

## Done when

- `39-panels` passes with an empty list of debts for every kind in `PANEL_KINDS`, at 390×844 and 844×390: no text
  under 13 px; words at 15 px or more; hit areas of 44 px (48 on touch); contrast of at least 4.5:1 on paper (3:1 for
  large text); the panel inside the viewport; every good's picture outside a button is a `GoodPic`.
- Only `PanelSheet.tsx` creates a sheet (no other panel uses `useDragControls`), and `SwipeSheet` is gone.
- No infinite keyframe animates `box-shadow` or `background`.
- On a farm with plenty, at rest, at most one infinite animation runs at the top.
- The stills of every panel at both sizes, before and after, look alike apart from the intended changes, judged by
  eye, and every panel shows the same head, grabber and way out.
- `npm run check`, `npm run lab:build`, and specs 03, 08, 17, 20 to 23, 25, 28, 30 and 32 to 38 are green.
