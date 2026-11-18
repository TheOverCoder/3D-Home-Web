# Update v1: what to reuse

**In short:** no new package pays for itself. Every mission's hand-made part is either already covered by an engine
the game has (Motion, Radix, canvas-confetti, three.quarks, meshoptimizer, fast-check, Phosphor) or by a browser
API, or it is a few dozen lines that a package would turn into upkeep. What saves real work is in sections 1 and 3:
the installed engines' parts nobody uses yet, 17 checked pictures, and seven snippets. **Code added to the bundle: 0
KB.** Pictures: about 4 KB each, loaded with the panel that shows them, never in the page shell.

**Read:** `PLAN.md`, the eight missions and `BRIEF.md`, `package.json`. Missions 09 and 10 are not written yet (no
file on any branch on 2026-11-18). Mission 09 is covered from its one line, "the house computer's charts", and should be
read against this file once it lands. Mission 10 (seasons and weather) is left alone.

**How each candidate was vetted (2026-11-18), with nothing installed and no downloaded code run:**
- **Registry data:** for 58 packages (a 59th name, `@yarnspinnertool/core`, does not exist), a script of my own read
  `npm view --json`: the latest version and its date, the
  newest release at least 14 days old, the licence, the dependencies, the install hooks, the unpacked size and any
  deprecation.
- **Advisories:** npm's bulk advisory endpoint (`/-/npm/v1/security/advisories/bulk`), asked about the exact versions
  below. A control (lodash 4.17.15) returned its advisories, so the endpoint answers. **No candidate has a known
  advisory.**
- **Code:** seven candidates were `npm pack --ignore-scripts`-ed, each into its own empty folder under the session's
  scratchpad. I read their files, measured them with `gzip -9`, and searched them for `fetch`, XHR, `sendBeacon`,
  sockets and `eval`. None makes a network call.
- **Tree-shaken size:** one measurement, with the project's own esbuild, which parses the code without running it.
- **The game's own side:** I read `node_modules` (installed versions, exports, install hooks), `vite.config.ts`, the
  CSS's colour functions, `src/lib/ErrorBoundary.tsx`, `src/farm/daily.ts` and the CI workflows.

## 1. Recommended

### Packages to install: none

Nothing clears "pays for itself". If a later need changes that, install it the safe way, at a version at least two
weeks old: `npm install --save-exact --ignore-scripts <pkg>@<version>`, then add a row here.

### Already installed: use these, don't write them (0 KB added)

| Engine (installed) | Mission | Use | Instead of |
|---|---|---|---|
| `motion` 14.7.1 | 05 | `interpolate(times, values, { ease })`, `transform`, `mix`, `backOut`, `anticipate`, `cubicBezier` from `'motion'` sample the `REACTIONS` keys and the number pop's curve | a hand-written keyframe sampler and easing table (about 40 lines). The `'motion'` entry imports no React (checked: 0 React imports in `framer-motion/dist/es/dom.mjs`; `sideEffects: false`), so `src/fx/react.ts` stays pure and runs in the sim. Motion is in the shell already. |
| `canvas-confetti` 1.9.4 (ISC) | 05 | `confetti.create(canvas, { resize: true, useWorker: true })` keeps confetti off the main thread on phones. It checks for `transferControlToOffscreen` and falls back by itself (read in `dist/confetti.module.mjs`). | — Do **not** use its `disableForReducedMotion`: it reads only the device's setting, never the game's own *Less motion*. Gate in `celebrate` on 07's `stillNow()`. |
| `three.quarks` 0.17.1 | 05 | the bursts it already draws (dust, sparkles, splash), one draw | any particle library. 0.18.0 came out 2026-11-17: no mission needs it, so stay. |
| `radix-ui` 1.8.1 | 02, 06, 07 | `Tabs` (02's "This month"), `Popover` (02's odds "?"), `Switch` and `ToggleGroup` (06's settings) | new controls |
| `@phosphor-icons/react` 2.1.10 | 02, 03, 04, 09 | `HandSwipeRight` (04), `Mailbox`, `EnvelopeOpen`, `Heart` (03), `BookOpen`, `Palette` (02), `ChartLineUp` (09): all present in `dist/csr` | drawn glyphs |
| `fast-check` 4.10.2 | 02, 03, 08 | properties for `saved.ts`'s readers, the two-tab rule and each new sanitizer | hand-picked cases |
| `meshoptimizer` 1.1.1 | 08 | the furniture's far copies (`farFromCopies`) | — |
| Browser APIs | all | `Intl.DateTimeFormat` (01's `readyAt`); `OfflineAudioContext`, `BiquadFilterNode`, `IIRFilterNode` (06's measurement, §3.3); `navigator.locks` and `BroadcastChannel` (08's tabs, §3.4); `navigator.storage.estimate()` and `.persist()` (08); `document.getAnimations()` and `elementFromPoint` (07); `createRoot(el, { onUncaughtError, onCaughtError })` (08); `speechSynthesis` (03, in use) | the packages rejected in §2 |

### Pictures: Fluent Emoji 3D (MIT), all 17 checked

The repository's `LICENSE` is MIT (Microsoft). Each file answered **HTTP 200** to a HEAD request on 2026-11-18, at
`https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/<Name>/3D/<name>_3d.png`. Fetch, convert and
credit them as the 67 pictures in `src/assets/art` were: a 128 px WebP (those average **3.9 KB**), a row in `ArtId`
(`src/ui/art.ts`), and the Fluent line in `src/data/credits.ts` and `CREDITS.md`.

| Mission | Emoji (folder name) | For |
|---|---|---|
| 01 | Honeybee | the beehive's card and unlock |
| 02 | Open book · Waving hand (has skin tones: `Waving hand/Default/3D/waving_hand_3d_default.png`) · Rosette · Triangular flag · Artist palette | the album, welcome back, charm, the season, paint |
| 03 | Closed mailbox with raised flag (or Postbox) · Love letter · Envelope · Red heart · Birthday cake | the mailbox, letters, hearts, birthdays |
| 09 | Chart increasing · Bar chart | the house computer's headers, if it wants a picture |
| 01 (reference only) | Honey pot · Cheese wedge · Butter | to look at while modelling: a good is pictured by its own model (`iconUrl`), never an emoji |

### Sounds for reference listening only (CC0, not shipped)

Kenney's *Interface Sounds* (100 files), *UI Audio* (50) and *Casino Audio* (50, v1.1 2024-07-22, with chips for
coins) are **CC0** by Kenney's own pages, as found by a search. **The session cannot reach kenney.nl** (the proxy
answers 403), so it has to be allowed in the session's network settings, or the zips downloaded by hand. Take them
from kenney.nl, never from a port: one Godot Asset Library port of *Interface Sounds* is listed as AGPL-3.0. Mission 06
synthesises every sound, and I agree: listen, then port by ear.

### A tool used outside the game: the ZzFX designer (MIT)

`https://killedbyapixel.github.io/ZzFX/` is for 06's sketches: shape a sting there, then port its numbers by hand to
`tone` and `burst`. **The package must never be imported.** `zzfx` 1.4.0 creates `new AudioContext` the moment it
loads (`ZzFXMicro.min.js`, line 3; `ZzFX.js`, line 62). A second context would play past the game's buses, limiter
and volumes, and on an iPhone it starts outside the player's tap.

## 2. Considered and rejected

Size is gzip of the minified file where I measured it, else the registry's unpacked size. "Hooks" means
`preinstall`, `install` or `postinstall`. A `prepare` script never runs on a registry install, so it is not listed.

| Package @ version (date) | For | Licence · size · deps | Why not |
|---|---|---|---|
| zzfx 1.4.0 (2026-10-01) | 06 | MIT · 0.9 KB · 0 | As a runtime: its own `AudioContext` on import (above). The engine already does more. Sketch tool only. |
| ios-haptics 3.3.0 (2026-10-25) | 06 | MIT · 0.6 KB · 0 | It sniffs the user agent and injects a hidden `<label>` with an `<input switch>` into the element, so it fires only on a trusted tap there. Reported closed in iOS 26.5; 06's decision 6 is no. |
| web-haptics 0.0.6 | 06 | MIT · 64 KB · peers react, vue, svelte | Pre-1.0, the same trick. |
| howler 2.2.4 (2023-09-19) | 06 | MIT · 311 KB · 0 | Plays files; the game has none. Three years without a release. |
| tone 15.1.22 | 06 | MIT · 5.3 MB · 2 | Duplicates `music.ts`. |
| standardized-audio-context-mock 10.0.1 | 06 | MIT · 259 KB · 5 (incl. `@babel/runtime`) | 06's fake of about 80 lines records exactly the frequencies `palette.test` reads. |
| fft.js 4.0.4 (2021) | 06 | MIT · 22 KB · 0 | Not needed: filters inside an `OfflineAudioContext` measure band energy (§3.3). |
| @tsparticles/engine 4.6.0 · /confetti | 05 | MIT · 1.2 MB · **`install` hook** (`node ./scripts/install.js`); confetti pulls 16 packages | 4 days old. canvas-confetti and three.quarks already do this. |
| lottie-web 5.13.0 · @lottiefiles/dotlottie-web 0.83.2 | 05 | MIT · 24.8 MB / 7.2 MB (wasm) | It needs animations authored elsewhere; Motion, confetti and instance scale already make the feel. dotlottie is 6 days old. |
| @tweenjs/tween.js 25.0.0 · maath 0.10.8 · @use-gesture/react 10.3.1 | 05, 07 | MIT | Motion's `animate`/`interpolate`, `src/lib/damp.ts` and Motion's drag already cover these. maath is in already, through drei. |
| uplot 1.6.32 (2025-03-14) | 09 | MIT · **22 KB** · 0, plus its CSS | Built for big time series on canvas; a house screen's handful of points needs about 15 lines (§3.1). |
| chart.js 4.6.1 · @visx/shape 4.0.0 · react-sparklines 1.7.0 (2017) | 09 | MIT · 6 MB / 5 deps / unmaintained | Far past the need. |
| d3-shape 3.2.1 + d3-path 3.1.1 | 09 | ISC · **4.3 KB** tree-shaken for `line`, `area` and `curveMonotoneX` (measured) · 1 | Clean (SLSA provenance, no network), but it costs more than the ~70 lines it would save. Copy the curve instead (§3.1). |
| date-fns 4.4.0 · dayjs 1.11.23 · temporal-polyfill 1.0.8 · @internationalized/date 3.12.4 | 02 | MIT / Apache-2.0 | 02's F4 is four functions, and `dayNumber` is already safe across daylight saving (§3.6). |
| inkjs 2.4.0 | 03 | MIT · 6.7 MB · 0 | An ink script would be a second source of truth beside `PEOPLE`, `TALK` and `CHAPTERS`. 03 has no choices, and its lines need `who`, `mood` and `hearts` as typed rows that unit tests check (kind words, ids, levels). |
| yarn-bound 0.5.5 → @mnbroatch/bondage 4.2.4 (2023) · bondage 2.2.0 (2020) | 03 | ISC / MIT; bondage depends on jison, inquirer, commander | The same reason, and stale. No official Yarn Spinner package exists (`@yarnspinnertool/core`: 404). |
| driver.js 1.14.0 | 04 | MIT · 0 deps · 4 days old | A DOM tour over the canvas; 04 teaches in the world (the farmer's hint, the guide marker), under the attention budget. |
| shepherd.js 16.0.0 · intro.js 8.6.0 | 04 | **AGPL-3.0** | The licence is off the list. |
| @axe-core/playwright 4.14.0 · axe-core 4.14.x | 07 | **MPL-2.0** | The licence is off the list, and axe cannot judge text over the 3D canvas. `readable.ts` is about 100 lines (§3.2). |
| wcag-contrast 3.0.0 (2019) · culori 4.0.2 · colorjs.io 0.7.1 | 07 | BSD-2 / MIT | A dependency for a 10-line formula. Parsing `oklab()` and `color(srgb …)`, which the CSS's 247 `color-mix()` calls produce (176 in srgb, 71 in oklab), takes 6 lines with a canvas (§3.2). |
| vaul 1.1.2 (2024-12-14) | 07 | MIT · 1 dep (`@radix-ui/react-dialog`) | No release in nearly two years, and a second copy of Radix's dialog. `PanelSheet` on Motion is the game's own. |
| size-limit 14.3.0 + @size-limit/file | 08 | MIT · 2 deps | `lightShell` with `SHELL_BYTES` is already the build's guard. |
| rollup-plugin-visualizer 7.1.3 · vite-bundle-analyzer 1.3.9 · source-map-explorer 2.5.3 | 08 | MIT / Apache-2.0 · 4 / 0 / 12 deps | Rolldown 1.2.12 already gives each module's `renderedLength` in `generateBundle` (read in its types); `lightShell` can print the shell's biggest modules (§3.5). |
| knip 6.45.1 | 07, 08 | ISC · 11 deps, native parser | A one-off; 07 already lists its dead code by reading. |
| @sentry/browser 11.14.0 | 08 | MIT · 6 deps (incl. session replay) · 1 day old | It sends to a service; against "track no one". `diagnostics.ts` plus React 19's root hooks do what is needed. |
| posthog-js 1.450.1 | 08 | Apache-2.0 + MIT · **28 MB**, 10 deps (core-js, preact, dompurify) | Autocapture and a stored id by default. 08's ~40 lines of `fetch` is the right size, and only if decision 20 is yes. |
| react-error-boundary 6.1.6 | 08 | MIT · 1.2 KB · 0 | Clean, but `src/lib/ErrorBoundary.tsx` (25 lines, `onError`, `fallback`) is the same thing. `PanelGuard` is that plus `key={panel}`. |
| error-stack-parser 2.1.4 (2022) · web-vitals 6.2.3 | 08 | MIT / Apache-2.0 | The diagnostics copy the raw `stack`; no timing leaves the device. |
| broadcast-channel 7.4.0 · idb-keyval 6.3.0 | 08 | MIT / Apache-2.0 · 4 / 0 deps | Native `BroadcastChannel` and Web Locks exist; the saves fit `localStorage` (tens of KB against about 5 MB). |
| valibot 1.5.0 · zod 4.6.7 | 08 | MIT | The sanitizers clamp and convert, they don't only validate. Rewriting ten of them is churn that the property test already guards. |
| xstate 5.33.4 · @xstate/store 4.3.0 · robot3 1.4.0 | 02–04, 08 | MIT / BSD-2 · robot3 1.9 KB | The game's flows (first-step turns, the card queue, story beats, a machine's queue) are rows read by pure functions; a machine library would be a second way to write them. |

## 3. Snippets and repos to copy from

Each snippet is a sketch for the mission that owns it, not code to paste unread. MDN's code samples are CC0. The W3C
and ITU formulas are definitions, not code.

**3.1 · 09: a sparkline, SVG and canvas from one path** (my own; MIT like the game). `new Path2D(d)` draws the
same string on the wall screen's canvas.
```ts
export function sparkPath(values: number[], w: number, h: number, pad = 2): string {
  if (!values.length) return ''
  const lo = Math.min(...values), span = Math.max(...values) - lo || 1
  const x = (i: number) => pad + (values.length < 2 ? (w - 2 * pad) / 2 : (i * (w - 2 * pad)) / (values.length - 1))
  const y = (v: number) => h - pad - ((v - lo) / span) * (h - 2 * pad)
  return values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
}
```
- **A smooth curve:** if one is wanted, copy `slope3`, `slope2`, `point` and `MonotoneX` from d3-shape **v3.2.0**
  (ISC, Mike Bostock, 2022): `https://github.com/d3/d3-shape/blob/v3.2.0/src/curve/monotone.js`. That is about 70
  lines; keep the ISC notice in a comment. A monotone curve never overshoots, so it invents no peak.
- **An axis:** `tickIncrement` and `ticks` from d3-array **v3.2.4** (ISC):
  `https://github.com/d3/d3-array/blob/v3.2.4/src/ticks.js`.
- **The look:** the `dataviz` skill.

**3.2 · 07: contrast for any computed colour** (in the page, inside `readable.ts`'s `page.evaluate`). The formula is
WCAG 2.2's "relative luminance" and "contrast ratio" (`https://www.w3.org/TR/WCAG22/#dfn-relative-luminance`).
Chromium returns `oklab(…)` and `color(srgb …)` for `color-mix()`, and a 1×1 canvas turns any of them into sRGB.
```ts
const cx = new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true })!
function rgba(css: string): number[] {
  cx.clearRect(0, 0, 1, 1); cx.fillStyle = 'transparent'; cx.fillStyle = css; cx.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = cx.getImageData(0, 0, 1, 1).data
  return [r, g, b, a / 255] // a 0 for a colour the canvas could not read
}
const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
const lum = (c: number[]) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])
const ratio = (a: number[], b: number[]) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
```
- **See-through text:** blend it over its surface first (`fg·a + bg·(1−a)`).
- **The top's loops:** count them with
  `document.getAnimations().filter((a) => a.effect?.getTiming().iterations === Infinity)`, narrowed to the elements
  inside the top.

**3.3 · 06: a sound's band share and loudness, measured in the browser** (MDN `OfflineAudioContext`,
`IIRFilterNode`). The K-weighting coefficients are ITU-R BS.1770-4's Tables 1 and 2, valid at **48 kHz** only. No FFT
is needed.
```ts
async function energy(draw: (ctx: BaseAudioContext, out: AudioNode) => void, s: number, chain: (c: BaseAudioContext) => AudioNode[]) {
  const ctx = new OfflineAudioContext(1, Math.ceil(48000 * s), 48000)
  const input = ctx.createGain()
  chain(ctx).reduce<AudioNode>((last, f) => last.connect(f), input).connect(ctx.destination)
  draw(ctx, input) // 06's play(engine, kind) writing into this context
  const d = (await ctx.startRendering()).getChannelData(0)
  let sum = 0
  for (let i = 0; i < d.length; i++) sum += d[i] * d[i]
  return sum / d.length
}
const pass = (c: BaseAudioContext, type: BiquadFilterType, frequency: number) => new BiquadFilterNode(c, { type, frequency, Q: Math.SQRT1_2 })
const BAND = (c: BaseAudioContext) => [pass(c, 'highpass', 500), pass(c, 'highpass', 500), pass(c, 'lowpass', 4000), pass(c, 'lowpass', 4000)]
const K = (c: BaseAudioContext) => [
  new IIRFilterNode(c, { feedforward: [1.53512485958697, -2.69169618940638, 1.19839281085285], feedback: [1, -1.69065929318241, 0.73248077421585] }),
  new IIRFilterNode(c, { feedforward: [1, -2, 1], feedback: [1, -1.99004745483398, 0.99007225036621] }),
]
// share = energy(…, BAND) / energy(…, () => [])  (06: ≥ 0.35);  loudness = -0.691 + 10·log10(energy(…, K))  (ungated)
```

**3.4 · 08: one writer per farm, with no clock** (MDN `LockManager.request`, the `steal` option). The newest tab takes
the slot's lock, and the tab it was taken from learns it at once. A tab that closes or crashes releases its lock by
itself. This could replace the stamp's comparison of time and writer in 08's change 8; the `storage` event still
brings the newest save across. Supported from Chrome 69, Safari 15.4 and Firefox 96.
```ts
export function holdSlot(slot: string, lost: () => void): () => void {
  let release = () => {}
  navigator.locks
    ?.request(`3d-home:slot:${slot}`, { steal: true }, () => new Promise<void>((done) => (release = done)))
    .catch((e: unknown) => (e as DOMException)?.name === 'AbortError' && lost()) // taken by a newer tab: stop saving
  return () => release() // on switchSlot
}
```

**3.5 · 08: what fills the shell** (Rolldown's `RenderedModule.renderedLength`, MIT). Put it in `lightShell`'s
`generateBundle` behind `SHELL_MEASURE=1`, as `BUDGET_MEASURE` is. The lengths come before minification, so use them
to rank modules, not as bytes.
```ts
const sizes: [string, number][] = []
for (const f of shell.keys()) { const c = bundle[f]; if (c?.type === 'chunk') for (const [id, m] of Object.entries(c.modules)) sizes.push([short(id), m.renderedLength]) }
for (const [id, n] of sizes.sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`${(n / 1024).toFixed(1).padStart(7)} KB  ${id}`)
```

**3.6 · 02: the calendar.**
- **Day numbers:** `dayNumber` in `src/farm/daily.ts` is already right. `Date.UTC` of the local date's fields gives
  the same number all day, whatever the 23- and 25-hour days of daylight saving do. Move it as it is.
- **`monthKey`:** build it from local fields too: `` `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` ``.
  Never use `toISOString().slice(0, 7)`, which is UTC: east of Greenwich, the 1st's first hours would still be last
  month.

**3.7 · 08: the CI's actions.**
- **Current majors:** the workflows pin `actions/*@v4`, which run on Node 20. By their release notes, as quoted by a
  search (the session cannot reach those repositories' API), `checkout`, `setup-node` and `upload-artifact` run on
  Node 24 from **v6**. Some mirrors show a v7 that I could not confirm.
- **Before changing them:** read each release page, then pin each action by its commit SHA with the tag in a comment.

## 4. Scaffold (approved and written)

No package is approved, so no wrapper is needed. Two guard rails stand instead, so that the eight agents of phases 1
and 2 cannot add upkeep by accident. CLAUDE.md's "Before pushing" points to them.

1. **`.npmrc` at the root:** `save-exact=true` and `ignore-scripts=true`.
   - **It changes nothing today.** `npm query` finds no installed package with a `preinstall`, `install` or
     `postinstall` script, and the CI installs with `npm ci`. The lockfile flags one package for another platform:
     `fsevents` 2.3.3 (macOS only, optional, Vite's), whose `node-gyp rebuild` is skipped. Its package ships its
     built binary, so a Mac works without it.
   - **`npm run` still works.** Scripts called by name still run (`npm run check`, `build`, `sim`); only lifecycle
     hooks stop, and the project has none.
   - **What it does:** every future install is pinned and runs no package's code.
2. **`src/deps.test.ts`, beside `src/deps.allowed.json`:** it fails, naming the package, when `package.json` gains a
   dependency that is not on the list, or when the list names one `package.json` no longer has. The list is today's 38
   names. A name added later gets its row in this file first, so a new package is a decision you see in review, never
   a side effect of a mission.

If you later approve a package, it gets one module in `src/lib/` that imports it (as `src/ui/motion.tsx` is for
Motion), and an oxlint `no-restricted-imports` rule in `.oxlintrc.json` keeps every other file from importing it
directly.
