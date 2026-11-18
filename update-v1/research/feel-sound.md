# Game feel, sound and haptics: research for the 3D HOME polish round

Scope: what makes each action feel satisfying ("juice") through motion, sound, haptics and the way a reward is shown,
checked against what 3D HOME does today (code read on 2026-11-18). Priorities: **P1** do in this round, **P2** next,
**P3** only if cheap. Sources marked *(search summary)* were blocked for direct reading in this session (gamedeveloper.com,
nngroup.com, uwaterloo.ca, research.tue.nl, gameaccessibilityguidelines.com); their claims come from search-engine
summaries and should be checked before quoting.

## 1. Principles

**1. Feedback must follow success, and more is not always better (P1).**
- Evidence: Kao 2020 (four versions of one action RPG, from no juice to extreme juice, N = 3018): both no juice and extreme juice
  lowered player experience compared with the middle levels, an inverted U *(search summary)*. Kao, Ballou, Gerling, Breitsohl and Deterding (CHI '24,
  N = 1699): feedback that depends on success raised competence, curiosity and effectance, while plain amplification
  *lowered* them, probably because it blurred the action → outcome link. Curiosity, driven by uncertain or graded
  success, was the only predictor of free playtime. Hicks et al. (CHI PLAY '19): visual embellishments always raised visual
  appeal, but raised competence only under some conditions. Jonasson & Purho: juice is "maximum output for minimum input".
  A thread on Nijman's 30 tricks notes that some tricks made the game worse.
- Why: juice works because it amplifies a *result*. If it shows up for a non-result, it becomes noise and teaches the wrong thing.
- 3D HOME: the button already gives a "wait" status and no celebration when nothing can be done (good). Juice should
  scale with the size of the outcome (section 4, #2), and the effect must start where the cause is (the bed, the buyer).
- Sources: https://dblp.uni-trier.de/rec/journals/entcom/Kao20.html (DOI 10.1016/j.entcom.2020.100359) · https://spiral.imperial.ac.uk/entities/publication/253c32f5-d124-4a23-88b5-9aaaf114608d · https://bibtex.github.io/CHI-PLAY-2019-HicksGDA.html · https://gdcvault.com/play/1016487/Juice-It-or-Lose · https://makegamessa.com/discussion/comment/16542

**2. Respond within 100 ms and let the finger feel the press (P2).**
- Evidence: Miller (1968), cited by Nielsen: within 0.1 s a response feels like direct manipulation, 1 s keeps the
  user's flow of thought, 10 s holds attention *(search summary)*. web.dev RAIL: answer input within 100 ms, so handle
  it within 50 ms. Swink's *Game Feel* defines feel as real-time control in a simulated space, made vivid by polish. His
  correction cycle is about 100 ms of perception inside about 240 ms in all *(secondary sources)*. Apple, WWDC18 "Designing
  Fluid Interfaces": "Everything needs to respond instantly", and motion should be interruptible and redirectable.
- 3D HOME: the action button shows a ring on `pointerdown` and acts on `click`, which fires on release
  (`src/ui/TouchControls.tsx`). The AudioContext is created with `latencyHint: 'interactive'`, and sounds start 4 ms
  ahead. All state is local, so every result can be shown at once; no network, so nothing has to be shown optimistically. The one deliberate delay is the
  confirmation card's armed *Build* button, which is right for spending. Keep the tap target's visual response on
  touch-down, and keep the 3D change and the sound in the same frame as the press.
- Sources: https://www.nngroup.com/articles/response-times-3-important-limits/ · https://web.dev/articles/rail · https://developer.apple.com/videos/play/wwdc2018/803/ · https://lizengland.com/blog/review-game-feel-by-steve-swink/

**3. Close the loop: show where the reward goes, and count it as it lands (P1).**
- Evidence: Apple HIG: visual, audio and haptic feedback "in harmony", with the haptic's intensity and sharpness matched to the
  animation it goes with. Android: design visuals, audio and haptics together, because feedback out of sync "can be a bit unsettling".
  Free-to-play reward screens use the same pattern everywhere: the item flies to its counter, the counter ticks up as it lands, then the counter pops.
- 3D HOME already does this for coins (`src/fx/coins.ts`, counted in by `TopDash`), XP crystals (`src/fx/xp.ts`: the bar
  grows only as each crystal lands), surprises (`flyItem`), and goods in the tool and machine panels (`flyGoods`, `flyInto`).
  **Gap:** an in-world harvest or collection (beds, nest, cows, sheep, lemon tree) flies nothing to the silo or barn
  gauge. The gauge just springs up. The commonest action has the weakest loop.

**4. Grade rewards: crescendo with size, tiers with rarity, anticipation before a reveal (P1).**
- Evidence: Larche et al. 2021 (loot boxes): arousal rose *before* the reveal, during the shake. Rarer items
  produced larger arousal and reward responses. Dixon et al. 2014: winning sounds raised arousal (skin conductance) and
  made players overestimate their wins (24 % against 15 % without sound). Kao et al. '24: graded success drives curiosity.
- Why and limits: a bigger result deserves a bigger show, so the size is readable at a glance. But sound must never dress up a
  loss or a neutral result as a win (the slot-machine finding). Keep the tiers honest.
- 3D HOME: the visuals already scale in places (coins 3 to 7 by amount, crystals by √XP, confetti 54 or 110 on the daily card's
  big day). The **sounds do not**: one `coins` sound plays for a 5-coin sale, a whole line sold at once, an order and a goal. The
  daily gift's seventh day and a gift box use the same `surprise` sting as any surprise. The shakes before a reveal
  (daily card 680 ms, gift boxes 820 ms) are silent.
- Sources: https://pmc.ncbi.nlm.nih.gov/articles/PMC7882574 · https://pmc.ncbi.nlm.nih.gov/articles/PMC4225056/

**5. Anticipation, squash and stretch, follow-through: the animation principles (P2).**
- Evidence: Thomas & Johnston's principles (*The Illusion of Life*, 1981) applied to UI. Anticipation is rated
  high priority for presses and drag starts, and arcs and slow-in/slow-out apply everywhere. WWDC18: springs start fast and settle
  slowly; start with no overshoot and add some only where the gesture had momentum. Material: mobile transitions run about
  300 ms and exits about 195 ms. (I found no specific Pixar or Disney *UI* talk, so these are the closest sources.)
- 3D HOME, interface: strong. `SQUISH`, `SINK`, `DID`, `NOPE`, `ARRIVE` and springs live in `src/ui/motion.tsx`. The daily
  box hops with squash and stretch. Flights travel on arcs. Coins arrive, then the chip pops and a shine crosses it.
  **3D world: none.** Plants disappear on the frame they are harvested, a new seedling appears at full size, and watered plants and
  milked or sheared animals do not react. A short scale pulse on the instances (`Parts.put` already takes a scale)
  costs no draws and changes nothing in `16-view`, because both passes draw the same scale.
- Sources: https://ixdf.org/literature/article/ui-animation-how-to-apply-disney-s-12-principles-of-animation-to-ui-design · https://m1.material.io/motion/duration-easing.html · https://developer.apple.com/videos/play/wwdc2018/803/

**6. Particles and number pops (P2).**
- 3D HOME: three.quarks bursts (water splash, sparkles in the crop's colour, dust) share one material, so they cost one draw
  while any is alive and none otherwise. The engine loads lazily and is skipped under reduced motion. Number pops today are
  toasts ("+ 120 coins · name"), the tool panel's "+n to the barn" line, and count-ups in the chips. **Gap:** no number
  appears where it happened. A "+16" with the good's picture, rising 30 to 40 px from the bed (in the DOM, projected like the
  coins), makes a batch harvest readable without a panel.

**7. Screen shake and hit-stop: mostly "don't", on a phone (P3).**
- Evidence: Nijman: screen shake, camera kick and a short sleep on impact make an action game punchy. Sakurai: hit-stop
  freezes both parties for a moment on impact, with a cap on its length. Xbox Accessibility Guideline 117: avoid camera shake or let
  players turn it off. Screen shake is the effect most likely to cause motion sickness.
- 3D HOME is first-person, held in the hand, and calm in pace: **never shake the 3D camera.** Shake only interface pieces (`NOPE`
  already does). The cosy version of hit-stop is a short hold at the top of a pop before the flight, which `flyItem` already
  has (pop 520 ms, hold 420 ms). Give the goods' flights of #3 a 60 to 100 ms hold.
- Sources: https://dkliao.itch.io/the-art-of-screenshake-recreation/devlog/451576/quick-breakdown-of-all-the-effects · https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/ · https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117

**8. Haptics: few, short, consistent, in sync, optional (P2).**
- Apple HIG (read directly): keep a "clear, causal relationship between each haptic and the action that causes it". Never reuse a
  pattern for the opposite meaning. Complement the visuals and sound and match their intensity. "Avoid overusing haptics":
  "the best haptic experience is one that people may not be conscious of, but miss when it's turned off". Prefer short haptics
  for discrete events. Make them optional.
- Android (read directly): "less is more". "Given the choice of buzzy haptics or no haptics … choose no haptics". "A good keyclick
  haptic feedback signal should last between 10 to 20 milliseconds". Strength should follow importance, with frequent events
  very subtle. Legacy on/off vibrations, which is all `navigator.vibrate` can do (no amplitude), are "a last resort",
  because a cheap actuator rings on for 20 to 50 ms after the pulse ends. So on the web, rhythm and duration are the only levers.
- Singhal & Schneider (CHI '21, phone Breakout game, N = 38): adding vibrotactile juice at a low *or* a high level
  raised enjoyment, aesthetic appeal, immersion and meaning. Low and high hardly differed. Their principles: exact
  synchronisation with the visuals, haptics that convey energy, and varied intensity and sharpness *(search summary)*.
- iPhone: Safari has no Vibration API. A hidden `<input type="checkbox" switch>` (Safari 17.4+) buzzes when toggled.
  `ios-haptics` 3.3.0 uses it, but only for a *trusted tap on a label* over the element, so it can never fire for a delayed
  reward. One README reports Apple closed it in iOS 26.5. Fragile, so treat it as optional at most.
- 3D HOME (`src/lib/device.ts`): seven patterns, Android only, behind a Vibration setting: `tick` 12 ms on work done (one
  per press, not one per bed, which is good), `sale` [10,60,14], `buy` 26, `gift` roll, `level` [30,70,50], `lift` 8, `drop` 16.
  The farm's own sounds (animals, a machine done, the bell) have no haptic, which fits Apple's causality rule. Gaps: `lift` and `drop` are used only by the
  machine queue's drag, not by placing decoration or furniture. Invalid actions have no pattern. Keep that: errors stay visual plus sound,
  so the vocabulary stays small and positive. `level` (30 and 50 ms) and `buy` (26) are longer than the 10 to 20 ms advice, which is
  acceptable only because they are rare.
- Sources: https://developer.apple.com/design/human-interface-guidelines/playing-haptics · https://developer.android.com/develop/ui/views/haptics/haptics-principles · https://developer.android.com/develop/ui/views/haptics/haptics-apis · https://uwspace.uwaterloo.ca/handle/10012/16894 · https://npmjs.com/package/ios-haptics · https://lists.webkit.org/pipermail/webkit-changes/2023-December/294748.html

**9. Sound: one palette, varied, rising for streaks, layered by state, mixed for a phone, sometimes silent (P1/P2).**
- Evidence: Candy Crush rewards a cascade with the same sound a semitone higher for each row *(search summary)*. Peggle Blast
  raises the pitch of one sound over time for variety without new assets. A random pitch shift per play (N semitones = ×1.06^N)
  reduces repetition fatigue, but recognisable cues should stay fixed. Hicks et al. (CHI PLAY '24, 12 audio designers)
  describe juicy audio as emphasis, cohesion and synaesthesia. Smets & van der Spek 2021: juicy audio raised presence.
  Adaptive music: vertical layering (stems of one timeline fade in and out) against horizontal resequencing (Phillips, GDC 2021).
  Phone mixing: speakers lose the low end, so add upper harmonics. Mobile loudness targets are about −16 to −18 LUFS.
- Sound and retention: I found no rigorous retention study. Self-reported sound-on rates range from 8 % (TapResearch,
  2,400 respondents, lowest for casual puzzles) to 73 % (Appington analytics, older). A King talk at GDC 2024 says up to half of casual players play muted *(search summary)*.
  So design for **muted play first**: every sound needs a visual twin, which the game already mostly has.
- Sources: https://www.gamedeveloper.com/audio/why-candy-crush-saga-is-so-engaging-an-audio-breakdown · https://www.audiogang.org/realtime-synthesis-for-sound-creation-in-peggle-blast/ · https://gamedeveloper.com/audio/the-power-of-pitch-shifting · https://eprints.staffs.ac.uk/8527/ · https://dl.ifip.org/hal-04144377v1 · https://www.gamedeveloper.com/game-platforms/hybrid-horizontal-vertical-structure-for-game-music-composers-from-spyder-to-sackboy-gdc-2021- · https://audiokinetic.com/en/mastering-a-game-with-wwise-part1 · https://blog.tapresearch.com/how-sound-preferences-impact-player-engagement · https://toucharcade.com/?p=144198

**10. Accessibility: less motion, mute and volumes, no harmful flashes (P2).**
- WCAG 2.3.1 (A): no more than three flashes in any second above the general or red flash thresholds. WCAG 2.3.3 (AAA): motion
  triggered by interaction can be turned off. Xbox AG 117: motion settings. Do not carry information by sound alone.
- 3D HOME: `prefers-reduced-motion` is respected everywhere (`MotionConfig reducedMotion="user"`, `burst`, `flyInto`,
  `flyXp`, `itemFx`, `effectsOn`, `CountUp`, the CSS), and the drive film becomes one still. The level-up flash is a single
  0.75 s local flash, and the ready pulse runs at 0.6 Hz, so both are safe. Settings have sound on/off, volume, music on/off,
  music volume and vibration. **Gaps:** there is no *in-game* "less motion" switch, only the OS setting, which many players never find. Effects
  and ambience share one slider, although the engine already has separate `sfx` and `amb` buses. On iPhone, Web Audio's default session
  is "ambient", so the ring switch silences the game. That is fine to keep, but say it in Settings.
- Sources: https://w3c.github.io/wcag21/understanding/three-flashes-or-below-threshold · https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html · https://developer.mozilla.org/docs/Web/API/AudioSession/type · https://bugs.webkit.org/show_bug.cgi?id=237322

**11. Juice must be cheap on a phone (P2).**
- web.dev: animate only `transform` and `opacity` so the work stays on the compositor, and keep layers few, because each costs memory.
  canvas-confetti can render in a worker on an OffscreenCanvas (`confetti.create(canvas, { useWorker: true })`).
- 3D HOME is already cheap: the DOM flights are WAAPI `transform`/`opacity` with caps (14 coins, 12 crystals, 5 goods), the
  particles cost one draw only while alive, the sound is synthesised (no downloads), and confetti fires only on big moments. Rules for
  new juice: squash through instance scale (no draws, no new meshes); numbers and flights in the DOM, never 3D text; read
  `getBoundingClientRect` once before a flight; confetti through one worker-backed canvas; nothing new in the sun's
  shadow pass. Check the drawing passes with `05-budget` and `16-view`, and the frame with `?tune`.
- Sources: https://web.dev/articles/animations-guide · https://github.com/catdad/canvas-confetti

## 2. Action by action: feedback today and what is missing

Read from `farmSound`, `haptic`, `farmFx`/`coinsFx`/`itemFx`/`xpFx`, `burst`, `flyGoods`/`flyInto`/`flyCoins` and the
motion presets. "tick", "sale" and the others are the haptics in `src/lib/device.ts`.

| Action | Today | Missing |
|---|---|---|
| Press the action button | ring on pointerdown, scale 0.9 (`.act-btn`), then the action's own feedback | nothing major; the action fires on release (fine for taps) |
| Plant | `plant` (two scrapes and a pat), tick, hand gesture, XP crystals; seed coins: coin chip dips | no soil puff, the sprout appears at full size, the same pitch every time |
| Water | `water` (pour and drops), tick, splash on each bed, gesture | plants do not perk up (no squash); fixed pitch |
| Harvest (N beds) | `harvest` (rustle and snap), tick, crop-coloured sparkles on each bed, XP, silo gauge springs | plants vanish at once; **nothing flies to the silo**; one sound for 1 or 6 beds (no cascade); no "+16" pop |
| Collect eggs, milk, wool (in the world) | the animal's sound (`cluck`, `milk`, `shear`), tick, sparkles, XP | **nothing flies to the barn**; the animal does not react (hop or shake); no pop |
| Tap the tool (panel) | `SQUISH` target, goods fly to the barn chip (`flyGoods`), chip `DID` on each landing, "+n to the barn", sound and tick; full: `NOPE` on target and chip and a red line | landings are silent (no rising ticks); rapid taps do not climb in pitch |
| Sell at the gate (one or all) | `coins` and sale haptic, 3–7 coins fly from the buyer (14 at most), chip counts up, pops and shines, toast, buyer leaves happy, XP; a surprise pops and flies with a sparkle and the gift haptic | **one sound for 5 coins or a whole line**; the sound plays at the press while coins land about 1 s later in silence; no tier |
| Send an order | `coins` and sale haptic, coins fly from *Send*, confetti 40, toast, XP; crates later ride the tractor (good follow-through). *Put in*: `plant` | a big order sounds like a small sale; *Put in* borrows the planting sound (muddles the palette); no "stamped / sent" beat |
| Machine job done / collect | `ding` timer at the machine (placed in space, no haptic: right), compass mark; collect: `harvest` and tick, goods fly queue → *Collect* → barn chip; machine level: confetti and a chip pop | the same `ding` for every machine and recipe; collect borrows the crops' `harvest` |
| Level up | crystals climb a pentatonic step each (`XP_STEPS`, the cascade already exists here), bar pulse, flash, ring and number, `level` arpeggio and chord, strongest haptic, coins and gift fly off, `garment` flourish, Unlocked cards with confetti | every level the same size (no milestone tier at 10, 25, 50, 100); music does not duck or answer |
| Buy or build (price tag → card) | armed *Build*, `build` (three hammer knocks), buy haptic, dust round beds, fields and stores; big buys play a film | the hammer's 120–180 Hz body is lost on phone speakers (only the noise click carries) |
| Decorate (farm edit, house) | outline turns green, red or amber with words; `uiClick` on drop; house: dust on drop; buying decor: `build` and buy haptic | farm piece: no dust or settle bounce on drop; an invalid drop "went back" with only a toast (no `NOPE`, no soft "no" sound); `lift` and `drop` haptics unused here |
| Daily gift | box hops (squash and stretch), claim tick → 680 ms shake → confetti 54 or 110 → `surprise` and gift haptic → coins held, then flown home; streak flame | the **shake is silent**; day 7 uses day 1's sting (only the confetti grows); no duck before the reveal |
| Claim a goal | coin spins 720°, coins fly, material flies to its store, confetti 70, `coins` and sale haptic | the same `coins` as any sale; no tier by the goal's step |
| Open a gift box (level card) | 820 ms shake → open, confetti, `surprise`, gift haptic; *Collect* flies | **silent shake**; the four boxes (25/50/75/100 %) share one sting, with no crescendo toward the fourth |
| Drive the car | curtain, film with engine and road hiss, two toots on arrival, a tap skips; less motion: one still | `uiClick` only on *Drive*; no haptic at departure or arrival (optional) |

## 3. Sound

**What exists.** Everything is synthesised with Web Audio, with no files (`src/audio/sound.ts`, about 820 lines): two noise
buffers, `tone`/`burst`/`voice` building blocks, buses `master → limiter` (DynamicsCompressor −10 dB, ratio 6), `sfx`
and `amb`, and stereo placement by `placeSound` (pan ±0.75, distance). There are 28 `FarmSound` kinds (work, animals, machines,
coins, till, bell, xp, level, garment, keys, chime, surprise), footsteps by floor, doors, lamps and pickups. Ambience
follows place and time: wind and birds by day, crickets at night, a room tone per room, quiet inside walk-ins, and ducking
under screens. There are four generative music tracks (`music.ts`: pad, pluck, bass, bells and shaker, each with a key and scale), the drive's
engine (`src/film/driveSound.ts`, already filtered for phone speakers) and the films' stings. The XP crystals already climb a scale (a reset after a
450 ms gap).

**What a good palette for this game needs.**
1. *Families with one character.* Work (soft, organic: soil, leaves, water, cloth), coins (bright metal), reward stings
   (glassy bells), errors (soft, low, two falling notes, never harsh), the world (animals, machines, placed in space). Today the families
   are clear, but *machine collect* reuses `harvest` and *order put-in* and shelf filling reuse `plant`. Each needs its own variant.
2. *One key for rewards.* The stings sit in several keys: coins and level in C major, surprise and keys in G, xp in A
   pentatonic, garment in E minor. Tune every reward sting to one pentatonic key (C major pentatonic, the first
   track's). Set the tier by register and length, not by key, and they will never clash with each other.
3. *Variation.* `harvest`, `plant`, `coins` and `build` play fixed pitches on every press. Add a random detune of about ±1 semitone and ±10 %
   gain (the noise bursts already start at a random offset). Keep level, keys and ding fixed: they are cues.
4. *Streaks (the Candy Crush cascade).* Reuse the `XP_STEPS` logic: consecutive harvests, collections or tool taps within
   about 2.5 s climb one pentatonic step (capped, then holding the top). Coin landings tick up the scale in time with the count-up and
   end on a small chime.
5. *Tiers.* `coins` at three sizes (a few clinks / a cascade of clinks / clinks and a chord), and stings for common, rare and big
   (day 7, a fourth gift box, milestone levels). The size must be honest: the tier comes from the amount, never from chance.
6. *Anticipation and silence.* A rattle that speeds up under every shake before a reveal. Duck the music and ambience by about 6 dB for
   300 ms before a big sting and let it ring in the clear (sidechain style), then restore. Silence is already used well:
   ambient events play only when near, and the room tone ducks under screens.
7. *Music that answers the farm.* The tracks are generative, so vertical layering is cheap: night drops the shaker and bells,
   indoors keeps the pad and pluck, an open panel takes −3 to −6 dB, and a level-up ducks the music.
8. *Phone mix.* Keep the musical stings in the 1–4 kHz band, where phone speakers are strongest. Give each low thump (`build` at
   180→120 Hz, landings, `chug` at 62 Hz) a click or harmonic layer at 500 Hz–2 kHz. Check in mono at low volume, and keep the
   limiter.
9. *Controls.* Separate Effects, Ambience and Music sliders (the buses exist), and a note that the iPhone ring switch silences
   the game (`navigator.audioSession` stays at its default, `auto`, so the switch is respected).

**Free sounds, if recorded layers are ever wanted** (credit them in `src/data/credits.ts` and `CREDITS.md`):
- Kenney, **CC0**: *Interface Sounds* (100 files), *UI Audio* (50), *Casino Audio* (54, with chips that work for coins),
  and *Impact Sounds* and *RPG Audio* (licence per a secondary list; check on kenney.nl). https://kenney.nl/assets/interface-sounds · https://opengameart.org/content/54-casino-sound-effects-cards-dice-chips
- OpenGameArt, with the CC0 filter (check each file's licence). Freesound, with the CC0 licence filter (check each file).
- Sonniss GDC bundles: royalty-free, commercial use, no attribution, but **not CC0** (no resale, no AI training). Second
  choice. https://gamefromscratch.com/sonniss-27-5gb-sound-effect-giveaway-at-gdc-2024/

**Libraries: none needed.** The game already owns a Web Audio engine that does more than these libraries would. Checked on npm
(`npm view`, 2026-11-18). Nothing was installed.

| Package | Version (released) | Licence | Verdict |
|---|---|---|---|
| howler | 2.2.4 (2023-09-19) | MIT | file playback, sprites, HTML5 fallback; only worth it with many recorded files, and even then a short AudioBuffer loader on `engine.sfx` does the job |
| tone | 15.1.22 (2025-04-27) | MIT | a full music framework, 5.4 MB unpacked; it duplicates `music.ts`. No |
| zzfx | 1.4.0 (2026-10-01) | MIT | under 1 KB, 20-parameter synth with a web designer; useful to *sketch* new stings, then port them to `tone`/`burst` |
| ios-haptics | 3.3.0 (2026-10-25) | MIT | 4.5 KB; iPhone haptic on a trusted tap only (the switch trick, reported closed in iOS 26.5). Optional for the action button, never for rewards (web-haptics 0.0.6 wraps the same trick, pre-1.0: no) |

In use: canvas-confetti 1.9.4 is the latest (consider `useWorker`); three.quarks is pinned at 0.17.1, and 0.18.0 (2026-11-17) is
under two weeks old, so wait.

## 4. Top 10 for 3D HOME, ranked

1. **Goods fly from the world to their store (P1).** On a harvest or a collection in the world (`Garden.tsx`, `useProducer.ts`,
   `Herd`), project the point as `FarmFx` does for coins and `flyGoods` 1–5 pictures to the silo or barn gauge, which rises as
   each lands (as the XP bar does), with a 60–100 ms hold at the top of the pop. This closes the loop of the commonest action. No flight
   under reduced motion or with the top of the screen hidden (the count still changes).
2. **Reward tiers in one place (P1).** A small function maps an amount or rarity to a tier (small, medium, big, rare), which sets the sound
   variant, the number of coins flying, the confetti size and the haptic. Use it for a sale and for selling to the whole line,
   orders, goals, the till, the daily gift's seventh day, the fourth gift box and milestone levels. It must be honest: the tier comes from the amount, never
   from chance or a near miss.
3. **A palette pass on the sounds (P1).** ±1 semitone and ±10 % gain on frequent sounds; every reward sting in one pentatonic key;
   their own sounds for machine collect, order put-in and shelf filling (no more borrowed `harvest`/`plant`); a 0.5–2 kHz
   layer on low thumps so `build` and landings are heard on a phone speaker.
4. **Cascades (P1).** Streaks of harvest, collect or tool taps climb a pentatonic step (the `XP_STEPS` pattern). Coin landings
   tick up in time with the coin chip's count-up and end on a chime, so the sound moves from the press to the landing (one sale haptic at the
   press stays).
5. **The 3D world reacts (P2).** Through instance scale only: plants stretch up and pop away on harvest (about 150 ms), perk up when
   watered, and grow in from 0.6 when planted; an animal hops when collected from; a placed decoration or piece of furniture settles with a small bounce
   and a dust puff (the house already puffs; add it on the farm). No draws, no change in `16-view`, nothing in reduced motion.
6. **Anticipation, then the reveal in the clear (P2).** A rattle that speeds up under the daily card's and the gift boxes' shakes;
   music and ambience ducked by about 6 dB for 300 ms before the sting; the fourth box and day 7 get the big sting.
7. **World-anchored number pops (P2).** "+16" with the good's picture rising from the bed, and "+120" coins over the buyer: DOM
   elements projected like the coins, sized by tier, gone in about 700 ms (decorative: the toast keeps the words).
8. **A gentle "no" (P2).** One family for "cannot": the `NOPE` motion, a soft two-note falling sound (the `decline` timbre), no
   vibration. Use it for a decoration that "went back", an item that cannot be afforded and a full store pressed in a panel. `lift` and `drop`
   haptics when picking up and placing decoration and furniture (`drop` only when it fits).
9. **Motion and sound settings (P2).** An in-game "Less motion" that drives the same switch as the OS setting
   (`MotionConfig reducedMotion="always"` plus the existing checks); separate Effects, Ambience and Music volumes; a line on the
   iPhone ring switch. iPhone haptics through `ios-haptics` only on the action button, as an experiment, behind the Vibration setting.
10. **Music that answers the farm, and the cost guard (P3).** Vertical layering in `music.ts` (night, indoors, panels,
    level-up duck); confetti from one worker-backed canvas; check every new effect with `05-budget`, `16-view` and a phone
    screenshot at phone size.
