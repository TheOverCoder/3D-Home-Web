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

- `node scripts/lab-new.mjs <id> "<title>" --kind ui|film|3d [--spot level] [--screen level]` — a new board, ready to
  fill (its folder, a first variant, listed in `lab/boards.ts`, its kind and the time it was put before the user): in
  the sandbox at once.
- `npm run lab` — the lab as you work on it (port 5180, live reload).
- `npm run lab:build` — `dist-lab/`, ready to publish (`scripts/lab-finish.mjs` makes its page the link's main page and
  lists its files in `files.json`).
- `node scripts/lab-shots.mjs <board> <out-dir>` — one sheet per state and screen, every variant side by side.
- `node scripts/lab-film.mjs <board> <variant> <out.png>` — an animation as one sheet of frames at exact times (the
  opening, what a press does: `--tap ".selector"`, or a swipe: `--swipe x,y,dx,dy`). `--reduced` on either script: as
  someone who prefers less motion sees it.
- `node scripts/lab-audit.mjs` — every screen of every board (each variant, state, upright and sideways) checked:
  errors, nothing drawn, scrolling, buttons under 44 px, text under 13 px, a button under the notch or the home bar or
  off the screen → `lab/audit.json`.
- `node scripts/lab-check.mjs` — the lab used end to end as the user uses it (the sandbox: its list, every board, every
  variant and state, ✓ / ✗, notes and pins kept and the row turning green, "next", a request, the game's screen, the
  status, a card sent and brought back) on a phone upright and sideways and a computer → `lab/check.json`. Both show in the lab's status (the
  sidebar's 📋): run them after a change, before publishing.
- `node scripts/lab-stills.mjs` — the game stills behind the frames again (`lab/stills/<place>-upright.jpg` and
  `-sideways.jpg`, the dev server up; if the game never starts for it, the dev server's dependency cache is stale:
  restart it with `npx vite --force`).

## The sandbox (what the user sees first)

`lab/play/Play.tsx` is the lab's one view, full screen like the game: a sidebar of every design, the screen, and a bar
under the thumb.

- **The sidebar** (always beside the screen on a computer; on a phone it slides over it, ☰) has two lists. **Designs**:
  every board, the oldest first, as a card with its picture and its kind's icon (🎬 a film, a window a piece of the
  interface, a cube a 3D element: every board has one, its `kind`). A card waiting is grey and numbered (1 the oldest,
  by its `added`), with its title only; answered, it turns **green** ("אושר", a ✓, or "הערות", only notes) or **red**
  ("נדחה", only ✗) and gets a send button (✈) that moves it to **ready to send**, the outbox for the designer, where a
  return button brings it back. A new round of a board (a later `added`) waits again: what was said and sent about the
  round before no longer counts for it. Under them: the game's screen, the screens with no design yet (🙋 to ask for
  one), and the settings (the screen on a computer, 🐢 slow, 🧘 less motion, 📋 the lab's status).
- **The screen**: the game's screen with nothing of the game in it but its look — a still of the game (the frame,
  `?play=1`) on which every chip or button that has designs is ringed in yellow and named. A touch opens it there, as
  the game would. On a phone the screen is the phone's own, at its size; on a computer a phone stands beside the list.
- **The bar** (a rail on the left, sideways): today and the proposals, each letter marked by its answer (tap the open
  one to see it open again); the state; **✓ / ✗** on the letter shown, a **💬 note**, a **📍 note pinned to one point**,
  **ℹ︎** (the request, what is new in this round, this letter's note and motion, and every answer given, each one
  deletable), and **הבא ←** to the next design still waiting. Keys: ← / → letters, N next, Esc closes.

A board is in it by itself: its `spot` (a chip or button of the game's screen, as `lab/stills/<still>.json` names it:
`coins`, `line`, `store`, `goals`, `day`, `level`, `settings`…, recorded by `scripts/lab-stills.mjs`) rings it on the
screen, its `screen` (an id of `lab/map.ts`) gives it its picture and place in the list.

**What the user said** is kept in the published lab's database (the artifact's `db` capability: `reviews/<board>` —
`verdicts` by variant, `notes` with the variant, state, the phone's way round and the point, `at` — `outbox/<board>` —
`sent`, `at` — and `requests/screens`). The main agent reads it (`ArtifactData`, `list` of `reviews` and `outbox` with
`out_dir`) and hands what is **ready to send** to its designer as `lab/feedback/<board>.json`. Where there is no database (`npm run lab`), it is kept in that browser.

## The side by side and the map (for the designer)

Not linked from the sandbox: `#<board>` shows every variant of a board side by side, `#map` the map. A board's bar
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
  and then opens it again; `?speed=0.25` slower, `?motion=reduce` as someone who prefers less motion sees it, `?hold=1`
  nothing shown until `window.__labGo()` (for films).

## A board

`lab/boards/<id>/index.tsx` exports a `Board` (`lab/board.ts`) and is listed in `lab/boards.ts`. It names its still
(`still: 'yard'`, or `'none'` for a page of its own), the screens it is for (`devices`, upright and sideways when not
given) and where it stands (`status`, `chosen`, and `round`: what changed since the last one). Each variant is a
component and a CSS file of its own in that folder, every rule under a class of its own (`.v-level-a …`), with a `note`
(what is different) and a `motion` line (what moves and when). Its `render(state, act)` draws it; `act.set` changes the
state as a press would (a claim), `act.close` lets it go out and opens it again.

Who works here: the interface designer (`.claude/agents/ui-designer.md`).
