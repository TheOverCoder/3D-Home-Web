# The design lab

Design references for the game's interface, built and chosen **before** they go into the game. A board is one piece
of the interface (the level's card, a machine's panel…): the request in the user's words, the states it is seen in,
and its variants side by side — "today" (what the game has now) and the new ones, A, B, C. Every variant is shown on a
phone held upright (390×844) and sideways (844×390), over a real still of the game, with its buttons working. The
user opens one link, chooses a letter or says what to change; only then does a design go into the game.

It is the game's own interface with no game round it: the panels' presentational components (`src/farm/LevelCard.tsx`
…), the game's CSS and tokens, its fonts and pictures, and the data its pure code makes (`levelView`). No 3D, no farm
state, no CI: it builds in a second and is published as a link of its own in a few more.

- `npm run lab` — the lab as you work on it (port 5180, live reload).
- `npm run lab:build` — `dist-lab/`, ready to publish (`scripts/lab-finish.mjs` makes its page the link's main page
  and lists its files in `files.json`).
- `node scripts/lab-shots.mjs <board> <out-dir>` — every variant in every state on both phones, as pictures.
- `node scripts/lab-stills.mjs` — the game stills behind the phones again (`lab/stills`, the dev server up).

## A board

`lab/boards/<id>/index.tsx` exports a `Board` (`lab/board.ts`) and is listed in `lab/boards.ts`. Each variant is a
component and a CSS file of its own in that folder, every rule under a class of its own (`.v-level-a …`). Its
`render(state, act)` draws it; `act.set` changes the state as a press would (a claim), `act.close` closes it and
opens it again, so its opening is seen once more.

Who works here: the interface designer (`.claude/agents/ui-designer.md`).
