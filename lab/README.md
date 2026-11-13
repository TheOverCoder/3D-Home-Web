# The design lab

Design references for everything that wraps the game (its screens, sheets, cards, talks, settings, the opening…), built
and chosen **before** they go into the game. A board is one piece of the interface: the request in the user's words,
the states it is seen in, and its variants side by side — "today" (what the game has now) and the new ones, A, B, C —
each on the screens it is for, over a real still of the game, with its buttons, gestures and motion working. The user
opens one link, chooses a letter or says what to change; only then does a design go into the game. The map
(`lab/map.ts`) is every screen of the interface as it is today, with what to improve next.

It is the game's own interface with no game round it: the panels' presentational components (`src/farm/LevelCard.tsx`
…), the game's CSS and tokens, its fonts and pictures, its motion kit, and the data its pure code makes (`levelView`).
No 3D, no farm state, no CI: it builds in a second and is published as a link of its own in a few more.

- `npm run lab` — the lab as you work on it (port 5180, live reload).
- `npm run lab:build` — `dist-lab/`, ready to publish (`scripts/lab-finish.mjs` makes its page the link's main page and
  lists its files in `files.json`).
- `node scripts/lab-shots.mjs <board> <out-dir>` — one sheet per state and screen, every variant side by side.
- `node scripts/lab-film.mjs <board> <variant> <out.png>` — an animation as one sheet of frames at exact times (the
  opening, or what a press does: `--tap ".selector"`).
- `node scripts/lab-stills.mjs` — the game stills behind the frames again (`lab/stills/<place>-upright.jpg` and
  `-sideways.jpg`, the dev server up).

## The page

At the top every board, with where it stands (waiting for a choice, chosen, in the game), and the map. A board's bar
sets what every frame shows: its state, the screens (a phone upright and sideways, a small phone, a tablet, a
computer), slow motion (four times slower: CSS, Web Animations, Motion and timers alike) and the marks of touches. ↻
plays a variant's opening again; ⛶ opens it full screen — on a phone, at the phone's own size under the user's own
finger, with the variants and states to switch between.

## A frame

`frame.html?device=…&speed=…&touches=…#board/variant/state/n` (`lab/env.ts`, applied before anything of the game loads):

- **a touch screen**: the game's `(pointer: coarse)` rules and checks hold on every device but the computer; on a
  computer the pointer is a fingertip, 44 px across, so a target too small for a finger shows;
- **the device's safe areas**: the notch and the home bar drawn over it, and their size given to the game's
  `env(safe-area-inset-*)` (in its CSS and inline styles); `device=real` (a phone, full screen) keeps its own;
- **motion as in the game**: the variant inside `MotionRoot` and `AnimatePresence`, so `act.close()` plays its way out
  and then opens it again; `?hold=1` shows nothing until `window.__labGo()` (for films).

## A board

`lab/boards/<id>/index.tsx` exports a `Board` (`lab/board.ts`) and is listed in `lab/boards.ts`. It names its still
(`still: 'yard'`, or `'none'` for a page of its own), the screens it is for (`devices`, upright and sideways when not
given) and where it stands (`status`, `chosen`, and `round`: what changed since the last one). Each variant is a
component and a CSS file of its own in that folder, every rule under a class of its own (`.v-level-a …`), with a `note`
(what is different) and a `motion` line (what moves and when). Its `render(state, act)` draws it; `act.set` changes the
state as a press would (a claim), `act.close` lets it go out and opens it again.

Who works here: the interface designer (`.claude/agents/ui-designer.md`).
