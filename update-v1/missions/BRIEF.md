# Update v1: how each mission is written

The goal of update v1: a full **beta** of 3D HOME. It should be intuitive from the first minute, and it should be a
game people want to come back to every day. The pull must come from proven principles, not from pressure. It must
stand on strong, stable engines, so that future content is rows of data and not new code. And it must need no
upkeep it doesn't need.

Read these first:
- the four research files in `update-v1/research/`: `psychology.md`, `farm-games.md`, `ftue-ux.md`, `feel-sound.md`;
- `CLAUDE.md`, which holds the project's rules;
- `README.md`.

Then read the code of your area until you know it.

## Your mission file

Write one file, `update-v1/missions/<NN>-<area>.md`, in English, at most about 200 lines. Write nothing else, change
no code, and do no git operations.

1. **Goal**, in one line. Then **how a player will feel it**, in two or three lines.
2. **Principles applied.** Each with its research file and section, for example `psychology.md §3`.
3. **Foundation first.** What shared engine, table or base (data rows, one function every caller uses, tokens)
   this area needs, so that later content is data. Say what exists already and what you would add. Add only what
   at least two uses need now.
4. **Changes**, numbered. For each one give:
   - what the player sees;
   - the files and functions it touches;
   - the data or rows it adds;
   - the tests: a unit test beside the code for every rule and save change, and an e2e spec only for UI;
   - its size (S, M or L) and its risk.

   Keep the project's rules: phones first, the budget (`05`), `16-view`, the shared interface base, `UNLOCKS` for
   every new buyable, `PACE` and `npm run sim` for every number, and saves converted in `load()` with a test.
5. **Order of commits.** Small and each one green. Mark where a commit is invisible to players until the next lands.
6. **Overlaps.** Name the files the other missions are likely to touch too (the list is below), and how to stay out
   of each other's way.
7. **What is missing.** This is the most important part for the plan.
   - **Decisions only the user can make.** Phrase each one as a yes/no or a short choice, with your
     recommendation.
   - **Libraries.** Give the exact npm name and a version at least two weeks old, why it is needed, and why the
     game's own code cannot do the job. Prefer none.
   - **Skills, knowledge or docs** an agent building this would need.
   - **Assets.** Sounds, pictures or models, with free sources and their licences (CC0 or MIT).
   - **Access.** Hosts the session could not reach.
8. **Done when.** Measurable: a sim number, a test, or a screenshot at phone size.

Be bold where the research supports it, and safe where it does not. Never add a dark pattern (`psychology.md`,
"Do NOT do"): no punishment for being away, no fake scarcity, no paid randomness, no guilt.

## The missions (one agent each)

1. `01-loop-economy` — the core loop, appointments (long timers, time away), the economy and the unlock cadence
   past level 13, plus the sim and `PACE` as the guard.
2. `02-meta-collections` — what keeps a player for weeks: collections or an album, a free season road, goals,
   decoration as self-expression, and the daily gift's and events' rules, made kind (a streak that waits).
3. `03-characters-story` — named neighbours, their requests and a light story in chapters, built from the people
   engine, the talk lines and the orders board. One engine; characters and chapters as rows.
4. `04-first-session` — a new player's first 10 minutes and a returning player's first 30 seconds:
   - the busy first screen, with progressive disclosure of the HUD;
   - the first-steps bugs that `ftue-ux.md` found: step 3 during the harvest festival, step 8's orders;
   - "Show me" being hard to find;
   - the welcome-back card's next goal;
   - the farmer's pleading face at "Skip?".
5. `05-world-feel` — feedback in the 3D world:
   - goods fly from the world to their store;
   - squash and stretch of plants, animals and pieces through their scale only;
   - reactions;
   - one reward-tier function that every reward uses.
6. `06-sound-haptics` — the sound palette: pitch variation, stings in one key, a sound of its own for each action,
   rising pitch for combos and streaks, separate volumes, a map of haptics, and an in-game "less motion" switch.
7. `07-interface` — every panel moved onto the shared base (`PanelSheet`, tokens, motion presets, `GoodPic` in
   the panels still without it), the HUD's clutter, readability, and a consistency pass.
8. `08-engines-stability` — code health and engines:
   - big files split where it pays;
   - duplicated logic;
   - CI speed and flakes;
   - the page shell's size;
   - far copies for the furniture;
   - error and crash safety;
   - how the game will measure that it works (the sim's retention-like numbers; any outside analytics only as a
     decision for the user, since players' data is private).
