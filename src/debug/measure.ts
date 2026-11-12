// A measuring tool for real phones (?tune, the Measure folder; src/debug/Tune.tsx loads it in its own chunk, which
// players never download). Timer queries are nearly absent on phones and the frame rate is capped by the screen, so
// it measures the work of a frame: from its first useFrame to a 1-pixel readPixels after the effects have drawn it
// (that waits for the GPU), in "sync" slices only; the others measure the frame interval and the CPU time as they
// are. A measurement is six 5-second slices with a switch on and off — ON, OFF, ON, OFF, ON-sync, OFF-sync — standing
// still or turning; the switch is the drawing pass (src/lib/visibility), one of its parts, or `keep` (the sun's map
// kept while only what it leaves out moves). Per frame: interval, CPU, work, the pass's own time, shadow redraws; per
// slice: draws and triangles as 05-budget counts them. Copy puts the result on the clipboard as JSON (and in the
// console). Soak runs ten minutes as it is, work per minute (does the phone slow down as it warms up?).

import { WebGLRenderTarget, type Camera, type Scene, type WebGLRenderer } from 'three'
import { roomAt } from '../data/layout'
import { PRODUCER_IDS } from '../farm/data'
import { buy, buyPiece, currentSlot, farm, inLine, placeStored, placesInLine, plant, spawnVisitor } from '../farm/state'
import { PIECES, type PieceType } from '../home/catalogue'
import { startDecorating, stopDecorating } from '../home/decorate'
import { findFreeSpot } from '../home/layout'
import { look } from '../lib/look'
import { playerState } from '../lib/playerState'
import { profile } from '../lib/profile'
import { view } from '../lib/visibility/pass'
import { useHome } from '../store'

/** What a measurement switches on and off. */
export const SWITCHES = { pass: 'the drawing pass', portals: 'rooms and portals', crowds: 'crowds in view', sun: "the sun's culling", keep: "the sun's map kept" } as const
export type Switch = keyof typeof SWITCHES

const SLICE_MS = 5000
const SETTLE = 2 // frames dropped at the start of each slice (the switch has just turned)
/** A slice ends once its time is up and it has measured this many frames: where a frame takes a second or more (software
 *  rendering, a sync slice waiting on every frame) its time alone could pass with none measured. A phone has dozens. */
const MIN_FRAMES = 3
const LONG = 33.4 // ms: a frame that missed two 60 Hz refreshes
const TURN = 0.6 // radians a second, "turning"

interface Frame {
  interval: number
  cpu: number
  work: number
  pass: number
  shadow: number
}
interface Slice {
  name: string
  on: boolean
  sync: boolean
  frames: Frame[]
  draws: number
  triangles: number
}

const q = (a: number[], p: number) => {
  if (!a.length) return NaN
  const s = [...a].sort((x, y) => x - y)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]
}
const r2 = (v: number) => Math.round(v * 100) / 100
const spread = (a: number[]) => ({ p50: r2(q(a, 0.5)), p95: r2(q(a, 0.95)), max: r2(a.length ? Math.max(...a) : NaN) })

function sliceSummary(s: Slice) {
  const f = s.frames
  const pick = (k: keyof Frame) => f.map((x) => x[k])
  return {
    name: s.name,
    frames: f.length,
    fps: r2(f.length / (f.reduce((t, x) => t + x.interval, 0) / 1000 || 1)),
    interval: spread(pick('interval')),
    cpu: spread(pick('cpu')),
    ...(s.sync ? { work: spread(pick('work')) } : {}),
    pass: spread(pick('pass')),
    long: f.filter((x) => x.interval > LONG).length,
    shadowRedraws: f.reduce((t, x) => t + x.shadow, 0),
    draws: s.draws,
    triangles: s.triangles,
  }
}

/** ON against OFF: the medians of each, their ratio, and the noise (how far apart the two ON slices are, and the two
 *  OFF ones, as a share of their mean). */
function compare(slices: ReturnType<typeof sliceSummary>[], key: 'interval' | 'cpu' | 'pass') {
  const on = slices.filter((s) => s.name.startsWith('ON') && !s.name.endsWith('sync')).map((s) => s[key].p50)
  const off = slices.filter((s) => s.name.startsWith('OFF') && !s.name.endsWith('sync')).map((s) => s[key].p50)
  const mean = (a: number[]) => a.reduce((t, v) => t + v, 0) / a.length
  const noise = (a: number[]) => (a.length > 1 ? r2((Math.abs(a[0] - a[1]) / (mean(a) || 1)) * 100) : NaN)
  return { on: r2(mean(on)), off: r2(mean(off)), ratio: r2(mean(on) / (mean(off) || 1)), noiseOnPct: noise(on), noiseOffPct: noise(off) }
}

export interface Meter {
  /** the lines the folder shows (lil-gui listens to them) */
  lines: Record<string, string>
  switch: Switch
  busy: () => boolean
  info: () => Record<string, string>
  goTo: (place: string) => void
  fill: () => void
  /** a measurement: six slices of `sliceMs` (5 s; longer where frames are slow, as in software rendering) */
  run: (kind: 'still' | 'turning', sliceMs?: number) => void
  soak: (minutes?: number) => void
  stop: () => void
  copy: () => string
  /** the last result (JSON-ready) */
  result: () => unknown
  /** called by Tune: first thing in a frame, and last (after the effects have drawn it) */
  begin: () => void
  end: () => void
}

export function createMeter(gl: WebGLRenderer, scene: Scene, camera: Camera): Meter {
  const lines: Record<string, string> = { status: 'idle', work: '–', interval: '–', cpu: '–', pass: '–', draws: '–', shadow: '–' }
  let result: unknown = null
  let battery: { level: number; charging: boolean } | null = null
  type BatteryNav = { getBattery?: () => Promise<{ level: number; charging: boolean }> }
  const readBattery = () =>
    (navigator as BatteryNav)
      .getBattery?.()
      .then((b) => (battery = { level: b.level, charging: b.charging }))
      .catch(() => {})
  void readBattery()

  // ── the info line ──
  const ctx = gl.getContext()
  const ext = ctx.getExtension('WEBGL_debug_renderer_info')
  const gpu = String(ctx.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : ctx.RENDERER))
  const multiDraw = !!ctx.getExtension('WEBGL_multi_draw')
  const info = () => {
    const s = useHome.getState()
    const p = playerState.position
    const room = roomAt(p.x, p.z)
    const animals = PRODUCER_IDS.map((id) => farm.producers[id]?.animals ?? 0)
      .filter((n) => n > 0)
      .join('/')
    return {
      device: `${profile.device}${profile.light ? ' (light)' : ''} · ${navigator.hardwareConcurrency ?? '?'} cores`,
      gpu,
      multi_draw: multiDraw ? 'yes' : 'no',
      canvas: `${ctx.drawingBufferWidth}×${ctx.drawingBufferHeight} @ ${gl.getPixelRatio().toFixed(2)}`,
      tier: `${s.quality}${s.qualityAuto ? ' (auto)' : ''} · shadow ${profile.shadowMap[s.quality]}`,
      view: s.decorating ? 'decorate' : s.editing ? 'edit' : s.view,
      place: `${room ?? 'outdoors'} (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`,
      content: `farm ${currentSlot()} · ${farm.home.pieces.length} pieces · animals ${animals || 0} · line ${inLine().length}`,
      battery: battery ? `${Math.round(battery.level * 100)}%${battery.charging ? ' charging' : ''}` : 'n/a',
    }
  }

  // ── go to ──
  const PLACES: Record<string, { x: number; z: number; yaw: number; door?: boolean; third?: boolean; decorate?: boolean }> = {
    'Living room': { x: -3.5, z: 1.3, yaw: Math.PI },
    'Kitchen (door shut)': { x: 3.5, z: -3, yaw: Math.PI, door: false },
    Bedroom: { x: 3.5, z: 1, yaw: Math.PI },
    Gate: { x: 4.2, z: 10.8, yaw: Math.PI - 0.5 },
    'Yard NW': { x: -12, z: -10.5, yaw: (-3 * Math.PI) / 4 },
    'Third person': { x: -3.5, z: 2.5, yaw: Math.PI, third: true },
    Decorate: { x: -3.5, z: 2.5, yaw: Math.PI, decorate: true },
  }
  const goTo = (name: string) => {
    const at = PLACES[name]
    const teleport = (window as unknown as { __home?: { teleport?: (x: number, y: number, z: number) => void } }).__home?.teleport
    if (!at) return
    if (!teleport) {
      lines.status = 'Go to needs ?debug'
      return
    }
    const s = useHome.getState()
    if (s.decorating) stopDecorating()
    if (s.view !== 'first') s.setView('first')
    if (at.door !== undefined && s.doors['door-kitchen-bedroom'] !== at.door) s.toggleDoor('door-kitchen-bedroom')
    teleport(at.x, 1.4, at.z)
    look.yaw = at.yaw
    look.pitch = -0.04
    if (at.third) setTimeout(() => useHome.getState().setView('third'), 300)
    if (at.decorate) setTimeout(() => startDecorating(), 300)
    lines.status = `at ${name}`
  }

  // ── fill the test farm (farm 3 only: never a farm someone plays) ──
  const fill = () => {
    if (currentSlot() !== 3) {
      lines.status = 'Fill only on farm 3'
      return
    }
    farm.coins = Math.max(farm.coins, 1_000_000)
    const heaviest = (Object.keys(PIECES) as PieceType[]).filter((t) => PIECES[t].price > 0).sort((a, b) => PIECES[b].weight - PIECES[a].weight)[0]
    let pieces = 0
    for (const room of ['bedroom', 'living', 'office', 'kitchen'] as const)
      for (let spot = findFreeSpot(farm.home, heaviest, room), n = 0; spot && n < 50; spot = findFreeSpot(farm.home, heaviest, room), n++) {
        if (!buyPiece(heaviest) || !placeStored(heaviest, spot).ok) break
        pieces++
      }
    for (let i = 0; i < 10; i++) for (const id of ['hen', 'cow', 'sheep'] as const) buy(id)
    for (let i = 0; i < 12; i++) buy('queue')
    for (let i = inLine().length; i < placesInLine(); i++) spawnVisitor({ queued: true })
    const crops = ['lettuce', 'carrot', 'strawberry', 'tomato', 'corn', 'pumpkin', 'wheat', 'sugarcane'] as const
    farm.beds.forEach((b, i) => {
      b.built = true
      if (plant(i, crops[i % crops.length])) farm.beds[i].growth = 1e6
    })
    lines.status = `filled: ${pieces} ${heaviest}, line ${inLine().length}`
  }

  // ── measuring ──
  let sw: Switch = 'pass'
  const set = (sw: Switch, on: boolean) => {
    if (sw === 'pass') view.on = on
    else view[sw] = on
  }
  const saved = { on: view.on, portals: view.portals, crowds: view.crowds, sun: view.sun, keep: view.keep }
  let plan: { name: string; on: boolean; sync: boolean }[] = []
  let slices: Slice[] = []
  let current: Slice | null = null
  let sliceStart = 0
  let kind: 'still' | 'turning' | 'soak' = 'still'
  let soakEnd = 0
  let soakMinute: { minute: number; frames: Frame[] }[] = []
  let soakBattery: unknown = null
  let frameStart = 0
  let lastStart = 0
  let passStart = 0
  let shadowCount = 0
  let settle = 0
  const px = new Uint8Array(4)

  // a shadow-map redraw counted as three does it
  const shadowMap = gl.shadowMap as unknown as { render: (...a: unknown[]) => void; enabled: boolean; autoUpdate: boolean; needsUpdate: boolean }
  const ownRender = shadowMap.render
  const counting = function (this: unknown, ...a: unknown[]) {
    if (shadowMap.enabled && (shadowMap.autoUpdate || shadowMap.needsUpdate) && (a[0] as unknown[]).length > 0) shadowCount++
    return ownRender.apply(this, a)
  }

  /** draws and triangles of the camera pass as 05-budget counts them (shadow maps frozen, no effects) */
  // (into a tiny target of its own: the frame on the screen, already drawn, stays)
  const countTarget = new WebGLRenderTarget(4, 4)
  const count = () => {
    const prevAuto = gl.info.autoReset
    const prevNeeds = gl.shadowMap.needsUpdate
    const prevTarget = gl.getRenderTarget()
    gl.info.autoReset = false
    gl.shadowMap.needsUpdate = false
    gl.setRenderTarget(countTarget)
    gl.info.reset()
    gl.render(scene, camera)
    const r = { calls: gl.info.render.calls, triangles: gl.info.render.triangles }
    gl.setRenderTarget(prevTarget)
    gl.info.autoReset = prevAuto
    gl.shadowMap.needsUpdate = prevNeeds
    return r
  }

  const startSlice = (i: number) => {
    const p = plan[i]
    set(sw, p.on)
    current = { name: p.name, on: p.on, sync: p.sync, frames: [], draws: 0, triangles: 0 }
    sliceStart = performance.now()
    settle = SETTLE
    lines.status = `${kind}: ${p.name} (${i + 1}/${plan.length})`
  }
  const finish = () => {
    shadowMap.render = ownRender
    Object.assign(view, saved)
    const summary = slices.map(sliceSummary)
    result = {
      kind,
      switch: sw,
      switchName: SWITCHES[sw],
      at: new Date().toISOString(),
      info: info(),
      slices: summary,
      onOff: { interval: compare(summary, 'interval'), cpu: compare(summary, 'cpu'), pass: compare(summary, 'pass') },
      work: (() => {
        const on = summary.find((s) => s.name === 'ON-sync')
        const off = summary.find((s) => s.name === 'OFF-sync')
        return on?.work && off?.work ? { on: on.work.p50, off: off.work.p50, ratio: r2(on.work.p50 / (off.work.p50 || 1)), onP95: on.work.p95, offP95: off.work.p95 } : null
      })(),
    }
    const r = result as { work: { on: number; off: number; ratio: number } | null; slices: ReturnType<typeof sliceSummary>[]; onOff: { interval: { on: number; off: number; noiseOnPct: number } } }
    const on = r.slices.find((s) => s.name === 'ON')
    const off = r.slices.find((s) => s.name === 'OFF')
    lines.work = r.work ? `${r.work.on} / ${r.work.off} ms (×${r.work.ratio})` : '–'
    lines.interval = `${r.onOff.interval.on} / ${r.onOff.interval.off} ms · noise ${r.onOff.interval.noiseOnPct}%`
    lines.cpu = on && off ? `${on.cpu.p50} / ${off.cpu.p50} ms` : '–'
    lines.pass = on ? `p95 ${on.pass.p95} ms (max ${on.pass.max})` : '–'
    lines.draws = on && off ? `${on.draws} / ${off.draws} · ${Math.round(on.triangles / 1000)}k / ${Math.round(off.triangles / 1000)}k` : '–'
    lines.shadow = on && off ? `${on.shadowRedraws} / ${off.shadowRedraws} redraws` : '–'
    lines.status = `done (${kind}, ${sw}): Copy`
    current = null
    plan = []
  }

  let sliceMs = SLICE_MS
  const run = (k: 'still' | 'turning', ms = SLICE_MS) => {
    if (plan.length || soakEnd) return
    kind = k
    sliceMs = ms
    Object.assign(saved, { on: view.on, portals: view.portals, crowds: view.crowds, sun: view.sun, keep: view.keep })
    plan = [
      { name: 'ON', on: true, sync: false },
      { name: 'OFF', on: false, sync: false },
      { name: 'ON', on: true, sync: false },
      { name: 'OFF', on: false, sync: false },
      { name: 'ON-sync', on: true, sync: true },
      { name: 'OFF-sync', on: false, sync: true },
    ]
    slices = []
    shadowMap.render = counting
    lastStart = 0
    startSlice(0)
  }

  const soak = (minutes = 10) => {
    if (plan.length || soakEnd) return
    kind = 'soak'
    soakEnd = performance.now() + minutes * 60_000
    soakMinute = [{ minute: 0, frames: [] }]
    sliceStart = performance.now()
    soakBattery = battery ? { ...battery } : null
    shadowMap.render = counting
    lastStart = 0
    lines.status = `soak: ${minutes} min`
  }
  const endSoak = () => {
    shadowMap.render = ownRender
    void readBattery()
    result = {
      kind: 'soak',
      switch: sw,
      at: new Date().toISOString(),
      info: info(),
      batteryStart: soakBattery,
      batteryEnd: battery,
      minutes: soakMinute.map((m) => ({
        minute: m.minute + 1,
        frames: m.frames.length,
        work: spread(m.frames.map((f) => f.work)),
        interval: spread(m.frames.map((f) => f.interval)),
        long: m.frames.filter((f) => f.interval > LONG).length,
      })),
    }
    const mins = (result as { minutes: { work: { p50: number } }[] }).minutes
    lines.work = mins.length ? `minute 1 ${mins[0].work.p50} ms → last ${mins[mins.length - 1].work.p50} ms` : '–'
    lines.status = 'soak done: Copy'
    soakEnd = 0
  }

  const stop = () => {
    if (plan.length) {
      plan = []
      current = null
      shadowMap.render = ownRender
      Object.assign(view, saved)
    }
    if (soakEnd) endSoak()
    lines.status = 'stopped'
  }

  const begin = () => {
    if (!current && !soakEnd) return
    const now = performance.now()
    frameStart = now
    if (kind === 'turning' && lastStart) look.yaw += (TURN * Math.min(100, now - lastStart)) / 1000
    passStart = view.stats.hookSum
    shadowCount = 0
  }
  const end = () => {
    if (!current && !soakEnd) return
    const cpuEnd = performance.now()
    const sync = soakEnd > 0 || !!current?.sync
    let work = NaN
    if (sync) {
      // wait for the GPU: one pixel of what the effects drew
      gl.setRenderTarget(null)
      ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px)
      work = performance.now() - frameStart
    }
    const frame: Frame = { interval: lastStart ? frameStart - lastStart : NaN, cpu: cpuEnd - frameStart, work, pass: view.stats.hookSum - passStart, shadow: shadowCount }
    lastStart = frameStart
    if (soakEnd) {
      const minute = Math.floor((frameStart - sliceStart) / 60_000)
      if (minute !== soakMinute[soakMinute.length - 1].minute) soakMinute.push({ minute, frames: [] })
      if (!Number.isNaN(frame.interval)) soakMinute[soakMinute.length - 1].frames.push(frame)
      lines.status = `soak: minute ${minute + 1}`
      if (frameStart >= soakEnd) endSoak()
      return
    }
    const s = current!
    if (settle > 0) settle--
    else if (!Number.isNaN(frame.interval)) s.frames.push(frame)
    if (cpuEnd - sliceStart < sliceMs || s.frames.length < MIN_FRAMES) return
    // the slice is over: its draws counted once (outside the frames measured), then the next one
    const c = count()
    s.draws = c.calls
    s.triangles = c.triangles
    slices.push(s)
    lastStart = 0
    if (slices.length < plan.length) startSlice(slices.length)
    else finish()
  }

  const copy = () => {
    const json = JSON.stringify(result ?? { info: info() }, null, 1)
    console.log('[measure]', json)
    navigator.clipboard?.writeText(json).catch(() => {})
    return json
  }

  const m: Meter = {
    lines,
    get switch() {
      return sw
    },
    set switch(v: Switch) {
      sw = v
    },
    busy: () => plan.length > 0 || soakEnd > 0,
    info,
    goTo,
    fill,
    run,
    soak,
    stop,
    copy,
    result: () => result,
    begin,
    end,
  }
  return m
}

/** `?pass=off` (with ?tune): the game starts with the drawing pass off. */
export function passFromQuery() {
  const p = new URLSearchParams(location.search).get('pass')
  if (p === 'off') view.on = false
  if (p === 'nokeep') view.keep = false
}

export const PLACE_NAMES = ['Living room', 'Kitchen (door shut)', 'Bedroom', 'Gate', 'Yard NW', 'Third person', 'Decorate']
