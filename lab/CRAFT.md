# The craft: UX, UI and motion for 3D HOME

The interface designer's knowledge (`.claude/agents/ui-designer.md`): read it before every board. It is the why behind
the game's rules (`CLAUDE.md`, _Interface_); where a rule there is stricter, the rule wins. Numbers here are starting
points to judge by eye in the lab (a film, a finger), not laws.

## Who we design for

A cosy farm and house game played mostly on a phone: short sessions, often one hand, upright or sideways, outdoors
light, a thumb not a cursor. The player comes to do one small thing (collect, sell, build) and leave happy. Every
screen answers three questions at a glance: _what is this, what can I do here, what happens if I press_.

## UX: how a screen should work

- **One hero per screen.** The one thing the player came for is the biggest, brightest, nearest the thumb; everything
  else is quieter. One main action per screen (a yellow button), a second at most (Cancel first, the action last).
- **Feedback for every press, at once** (under 100 ms): the button sinks, then the result shows where it happened
  (coins fly to the coin chip, the bar fills, the item lands in its slot). A press with no visible answer is a bug.
- **Show, don't tell.** Pictures and numbers before words: an item's picture with its count, a coin and a price, a ring
  that fills for time. One line of text at most; words a player says, never a developer's (no MB, decoding, ids).
- **Less on screen.** The HUD shows what matters now and fades what does not; group what belongs together; never
  cover the middle of the scene; a number the player needs is never under 13 px.
- **Consistency.** The same thing looks and moves the same everywhere: one kind of sheet, one kind of price, one
  kind of "new" badge, one kind of claim. A new pattern needs a reason the old one cannot serve.
- **Prevent errors, forgive them.** Spending asks first (a card with the price); destructive actions are away from
  the main one and confirmed; anything done by mistake can be undone or is cheap.
- **States, all of them.** Each screen in its empty, partly full, full, locked, waiting, error and first-time states —
  a board's states are these, not only the happy one.
- **The first 30 seconds decide** (first-time experience): the first screen gets the player playing in one press, says
  where they are, and teaches by doing, never by a wall of text. A returning player sees what waits for them.
- **Cognitive load.** Few choices at once (3–5), recognisable icons, the same place for the same thing, progress shown
  as a picture (a bar, a ring, a path), not a calculation.

## Phones: hands and screens

- Targets 44 px at least, 48–56 px for the main action; 8 px between targets. The thumb reaches the bottom third
  easily, the top corners badly: actions low, information high.
- Safe areas: nothing under the notch, the rounded corners or the home bar (`env(safe-area-inset-*)`; the lab shows
  them). Upright: sheets from the bottom. Sideways: sheets on the right, the scene stays in view on the left; the
  height is short (≈ 360 px): no tall stacks, use columns.
- Touch controls own the bottom corners (the stick on the left, the action buttons on the right): keep clear.
- Text 15 px and up (13 px only for small labels), high contrast on any background (a shadow or a solid chip behind
  text that sits on the scene).

## Visual hierarchy and layout

- Size, contrast, colour and position say what matters, in that order; one accent colour per screen for the action.
- Group with space before lines and boxes; align to a few edges; a grid of 8 px.
- Rounded, soft, tactile shapes fit a cosy game: thick outlines or a lip under buttons (the game's `.btn`), soft
  shadows, paper sheets (`.paper`), the Fluent 3D pictures, Fredoka for titles, Nunito for numbers.
- Numbers are heroes in games: big, bold, tabular, and they count when they change.

## Patterns that work in casual farm and life games

Learn the pattern, never copy a game's art or layout one to one.

- **Currency chips** at the top that pulse and count when coins arrive; collected things fly into them.
- **Progress with the next reward in view**: a bar or ring and, at its end, what it brings (a level's prize, a goal's
  reward); the reward is a picture, not a sentence.
- **Reward reveal**: anticipation (a box shakes, light gathers) → reveal (it opens, the item lands with a squash) →
  celebration (a short burst, a sound) → collect (a tap sends it to where it lives). Skippable, never blocking.
- **"New" and "ready" marks**: a dot or badge on what has something waiting, gone once seen.
- **Timers as rings or bars** filling on the thing itself, with the time left as a number; a "ready" pop when done.
- **Locked things** shown with their level tag (what you will get), not hidden.
- **Lists of goals or orders** as cards with a picture, a progress bar and a claim button that glows when ready.
- **Talks with characters**: a portrait, the name, one short line that types or fades in, what they want as pictures
  with counts, and answers as buttons (never more than two or three); tap to go on.
- **Away summary**: what happened while you were gone, as pictures with counts, one button to collect all.
- **Loading**: the world's art or a living scene, one bar that really moves, one friendly line, a tip or a teaser of
  what is coming; the first press possible as soon as the game can take it.
- **Opening screen**: for a new player one big _Play_; for a returning one _Continue_ with what waits (level, what is
  ready), saves and settings quieter; music and credits small.

## Motion

Motion explains: where something came from, where it went, what changed, what to look at. It is quick and never in
the way of the next press.

- **Easing, never linear** (except a progress bar's fill or a loop). Coming in: ease-out (fast then gentle). Going
  out: ease-in, shorter. Under a finger or for a playful pop: a spring (`SPRING.pop`, `.sheet`, `.soft` in
  `src/ui/motion.tsx`).
- **Durations** (feel first): a press 60–120 ms; a chip, a tooltip, a fade 150–250 ms; a sheet 250–400 ms; a page
  300–500 ms; a celebration 600–1200 ms, in the background of play, skippable. Going out is shorter than coming in.
- **Disney's principles, for UI**: _anticipation_ (a small wind-up before a big move, a shake before a reveal);
  _squash and stretch_ (a coin or badge landing squashes a little); _follow-through and overshoot_ (a sheet or medal
  overshoots and settles); _staging_ (one thing moves at a time where the eye is); _slow in, slow out_; _arcs_ (things
  that fly, fly on a curve); _secondary action_ (a shine crossing a tile after it lands); _timing_ (heavy things slow,
  light things quick); _exaggeration_ with restraint.
- **Choreography**: the container first, then its content with a stagger of 30–60 ms, the hero last and biggest.
  One moment per screen.
- **Juice** (feedback layered on an action: motion, light, particles, sound, counting numbers): it makes a press feel
  good, but only where the player looks and only for what matters; a sale gets coins flying, a level gets a burst,
  a page turn gets nothing.
- **Reduced motion**: the same result without travel: fades instead of slides, the end state at once, no bursts.

## The feeling of progress

What makes a bar or a reward give a small high, from studies that measured it, and what each means on a screen. It
applies to every board: a level, a goal, an order, a store filling, a timer, a loading bar. Used ethically (the last
point): the player should leave happier, never trapped.

- **The goal gradient: effort rises as the goal comes near** (Hull 1932; Kivetz, Urminsky & Zheng 2006, a café's
  stamp card: people bought coffee faster the fewer stamps were left). → The last stretch of a bar is the hottest:
  make it look it (the fill warms, a glow at its tip, "only 2 more!"), and keep the goal in view at the bar's end.
- **Endowed progress: a bar that starts with something in it is finished more often** (Nunes & Drèze 2006, a car
  wash card with 2 of 10 stamps already given: 34 % redeemed against 19 %). → Never show an empty bar after a
  reward: a new level starts with what the player carried over, or with the first step already ticked ("you're
  on your way"). Show the real numbers: the gift must be true (a step already done), never a lie.
- **Proximal sub-goals beat one far goal** (Bandura & Schunk 1981: children with small near goals learned faster and
  liked the subject more; Locke & Latham 2002, goal setting: specific near goals). → Cut a long bar into stations
  (ticks, notches) and give each a small reward or a mark when passed; the next station is always near. One long
  empty bar is the opposite.
- **The small area: show the smaller part** (Koo & Fishbach 2012: early on, "done so far" motivates more; near the
  end, "left to go" does). → Below half the label says what is done ("+40 XP so far", the ticks passed); past half it
  says what is left ("72 XP to go", "2 more sales"). The bar's own label can switch at the middle.
- **Make the next press visible on the bar** (the action→feedback link of Hodent 2017, _The Gamer's Brain_; the
  "little bursts of feedback" of progression bars, Lewis-Evans, GDC 2017). → Mark on the bar how far one ordinary
  action moves it (a ghost segment: "one sale ≈ this much"): the goal becomes "3 more of these", not a number.
- **Small, frequent wins** (Amabile & Kramer 2011, _The Progress Principle_: of everything that lifts a day, small
  visible progress lifts it most). → Every press that adds progress shows it at once where the eye is: the bar
  jumps with a bright head, a "+12" floats off it, the number counts. Never a silent fill.
- **Unfinished pulls** (Zeigarnik 1927, Ovsiankina 1928: an interrupted task is remembered and wants finishing;
  the effect is weaker in replications, so use it lightly). → A nearly full bar is shown nearly full on the way
  out (the chip's ring), so the player leaves with "almost" in mind, not "nothing".
- **Anticipation is half the reward** (Schultz, Dayan & Montague 1997: dopamine answers to the _expected_ reward and
  to a better-than-expected one, not to a fully predicted one). → Show the prize before it is earned (the next
  level's picture at the bar's end), let it wind up before it opens (a shake, gathering light), and give a small
  honest surprise now and then (a bonus coin, a rare garment) on top of the promised one: the surprise is the
  high, the promise is the reason.
- **Variable rewards, with limits** (Ferster & Skinner 1957, variable schedules; Eyal 2014, _Hooked_: trigger →
  action → variable reward → investment). → Variety in what comes (which buyer, which surprise), never in whether
  effort counts: the bar always moves by what was done. Investment shows: what you built and wore stays in view.
- **Competence, not compulsion** (Ryan, Rigby & Przybylski 2006, self-determination theory: games are enjoyed for
  competence, autonomy and relatedness; Csikszentmihalyi 1990, flow). → Progress says what the player did ("you
  sold 5 crates"), the next goal is just reachable, and the player chooses when to claim.
- **End on a peak** (Kahneman, Fredrickson et al. 1993, the peak-end rule: an experience is remembered by its best
  and last moments). → A card's last moment is its high (the claim's burst, the full bar), not a scroll of fine print.
- **Ethics** (Eyal's _Manipulation Matrix_; Hodent 2017 on dark patterns; Clark et al. 2009 on how near-misses
  drive gambling; Zendle & Cairns 2018 on loot boxes). Never a fake near-miss, a fake "almost", a bar that slows to
  keep you, a reward that rots if not claimed, a countdown to pressure a purchase, or a random box for money. Progress
  is true, every reward can wait for the player, and a session can end on a good note.

## Accessibility

Contrast 4.5:1 for text (3:1 for big numbers and icons); never colour alone (a ✓ and a colour); every control named
for a screen reader (`aria-label`, kept by the tests); focus visible; reduced motion respected; text that can grow.

## Research, before drawing

For each board, look at how 3–5 good games handle the same screen and say what pattern you take and why (the board's
`research`). Where to look:

- **Game UI Database** (gameuidatabase.com, by Edd Coates): tens of thousands of screens and videos from games, by
  screen type (HUD, menus, inventories, loading, dialogue…) and element; the videos show motion and flow.
- **Interface In Game** (interfaceingame.com): game UI by genre and element.
- Casual, farm and life games (their patterns, not their art), and the platforms' guides: Apple's Human Interface
  Guidelines, Material Design's motion (durations and easing).
- Books and talks behind this page: Celia Hodent, _The Gamer's Brain_ (UX for games: usability and engage-ability);
  Steve Swink, _Game Feel_; Martin Jonasson and Petri Purho, _Juice it or lose it_ (GDC Europe 2012); the Disney
  principles applied to interfaces.

## Before you hand back

- The hero reads in one second; the main action is under the thumb; nothing under a notch, home bar or the controls.
- Every state of the board drawn; text ≥ 15 px; targets ≥ 44 px; contrast holds on the scene.
- The opening, the main press and the way out filmed and smooth; reduced motion checked.
- Each variant is a real alternative (layout, hierarchy, motion), named and explained in a line, with what moves.
