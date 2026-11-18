// The sound of where you are: each room's quiet tone (air, the fridge's hum, the studio's fan), the open air
// outdoors with birds by day and a cricket at night, and the house's quiet indoor tone inside a walk-in building (its
// walls keep out the wind and the birds), and where a sound is heard from where you stand. It starts with the live
// engine (./engine.ts) and follows the player.
import { insideWalkIn } from '../data/buildings'
import type { RoomId } from '../data/layout'
import { playerState } from '../lib/playerState'
import { engineNow, live, rnd, tone, type Engine } from './engine'
import { SCREEN_DUCK, hold } from './mix'

let wantedRoom: RoomId | null = null
let ambient: { filter: BiquadFilterNode; gain: GainNode; hum: GainNode; fan: GainNode; fanFilter: BiquadFilterNode } | null = null

let outdoors = false
let birdTimer: number | undefined
let isNight = () => false
/** Outdoors but inside a walk-in building (the market): its walls keep out the wind and the birds. */
let walledIn = false
let walledTimer: number | undefined

/** Stereo position (−1 left … 1 right) and nearness (0..1) of a sound at (x, z), heard where the player stands and faces. */
export function placeSound(x: number, z: number) {
  const p = playerState.position
  const f = playerState.facing
  const dx = x - p.x
  const dz = z - p.z
  const d = Math.hypot(dx, dz) || 1e-6
  return { pan: ((-f.z * dx + f.x * dz) / d) * 0.75, near: Math.max(0, Math.min(1, 1 - d / 9)) }
}

/** The room whose tone is wanted (null: between rooms or outside). */
export const roomNow = () => wantedRoom

/** The walk-in buildings are the farm's: on the house's map there are none (SoundDirector says which map you are on). */
let walkIns = true
export function hearWalkIns(on: boolean) {
  walkIns = on
}

/** Whether you have stepped into or out of a walk-in building; its room tone follows. */
function checkWalledIn() {
  const at = playerState.position
  const now = outdoors && walkIns && insideWalkIn(at.x, at.z) !== null
  if (now === walledIn) return
  walledIn = now
  setRoomTone(wantedRoom)
}

/** How the garden's sounds know the farm's time of day (src/farm/DayChip.tsx tells them, so this file never loads the
 *  farm): no birds at night, a few crickets instead. */
export function hearNight(night: () => boolean) {
  isNight = night
}

/** A cricket somewhere in the dark: two or three chirps, each a quick trill of four pulses. */
function cricket(e: Engine) {
  const t = e.ac.currentTime + 0.01
  const pan = rnd(-0.9, 0.9)
  const f = rnd(4200, 4800)
  const g = rnd(0.006, 0.014)
  const chirps = 2 + Math.floor(Math.random() * 2)
  for (let c = 0; c < chirps; c++) for (let i = 0; i < 4; i++) tone(e, t + c * 0.32 + i * 0.024, { type: 'sine', f0: f, gain: g, attack: 0.003, decay: 0.012, pan })
}

/** One bird somewhere in the garden: a songbird's quick phrase, now and then a dove. At night a cricket instead, now
 *  and then; inside a walk-in building (the market) neither. */
function birdCall() {
  checkWalledIn()
  const e = outdoors && !walledIn ? live() : null
  if (e && isNight()) {
    if (Math.random() < 0.6) cricket(e)
  } else if (e) {
    const t = e.ac.currentTime + 0.01
    const pan = rnd(-0.9, 0.9)
    const g = rnd(0.012, 0.03)
    if (Math.random() < 0.18) {
      // a laughing dove: soft, low, rising and falling
      for (let i = 0; i < 4; i++) tone(e, t + i * 0.24, { type: 'sine', f0: rnd(430, 470), f1: rnd(380, 410), gain: g * 0.9, attack: 0.04, decay: 0.16, pan })
    } else {
      const notes = 2 + Math.floor(Math.random() * 5)
      const base = rnd(2600, 3800)
      for (let i = 0; i < notes; i++) {
        const up = Math.random() < 0.6
        tone(e, t + i * rnd(0.07, 0.12), { type: 'sine', f0: base * (up ? 0.85 : 1.2), f1: base * (up ? 1.25 : 0.8), gain: g, attack: 0.008, decay: rnd(0.03, 0.07), pan })
      }
    }
  }
  birdTimer = window.setTimeout(birdCall, rnd(900, 3800))
}

/** In the garden: open-air wind instead of a room's tone, and birds (but inside a walk-in building, the house's
 *  quiet indoor tone and no birds: looked at a few times a second while you are outdoors). */
export function setOutdoors(on: boolean) {
  if (on === outdoors) return
  outdoors = on
  window.clearTimeout(birdTimer)
  window.clearInterval(walledTimer)
  walledIn = false
  if (on) {
    birdTimer = window.setTimeout(birdCall, 500)
    walledTimer = window.setInterval(checkWalledIn, 400)
    checkWalledIn()
  }
  setRoomTone(wantedRoom)
}

// ─────────────────────── room tone ───────────────────────

// Each room has its own quiet bed: air, a fridge in the kitchen, a computer fan in the studio.
const ROOM_TONE: Record<RoomId, { cutoff: number; level: number; hum: number; fan: number }> = {
  living: { cutoff: 380, level: 0.05, hum: 0, fan: 0 },
  office: { cutoff: 520, level: 0.045, hum: 0, fan: 0.012 },
  kitchen: { cutoff: 460, level: 0.05, hum: 0.012, fan: 0 },
  bedroom: { cutoff: 300, level: 0.035, hum: 0, fan: 0 },
}

/** The room tone's sources, started once with the live engine (it fades in). */
export function startAmbient() {
  const engine = engineNow()
  if (!engine || ambient) return
  const { ac, amb, brown, white } = engine
  const src = ac.createBufferSource()
  src.buffer = brown
  src.loop = true
  const filter = ac.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 400
  filter.Q.value = 0.4
  const gain = ac.createGain()
  gain.gain.value = 0
  src.connect(filter).connect(gain).connect(amb)
  src.start()
  // mains hum of the fridge: 100 Hz and its harmonic
  const hum = ac.createGain()
  hum.gain.value = 0
  for (const [f, level] of [
    [100, 1],
    [200, 0.35],
  ]) {
    const o = ac.createOscillator()
    o.frequency.value = f
    const g = ac.createGain()
    g.gain.value = level
    o.connect(g).connect(hum)
    o.start()
  }
  hum.connect(amb)
  // fan: band-passed noise
  const fanSrc = ac.createBufferSource()
  fanSrc.buffer = white
  fanSrc.loop = true
  const fanFilter = ac.createBiquadFilter()
  fanFilter.type = 'bandpass'
  fanFilter.frequency.value = 700
  fanFilter.Q.value = 1.2
  const fan = ac.createGain()
  fan.gain.value = 0
  fanSrc.connect(fanFilter).connect(fan).connect(amb)
  fanSrc.start()
  ambient = { filter, gain, hum, fan, fanFilter }
  amb.gain.setTargetAtTime(1, ac.currentTime, 1.2)
  setRoomTone(wantedRoom)
}

/** Cross-fades the room tone to `room` (null: between rooms or outside). */
export function setRoomTone(room: RoomId | null) {
  wantedRoom = room
  const engine = engineNow()
  if (!engine || !ambient) return
  const now = engine.ac.currentTime
  // the open air outdoors; a room's own tone; else the house's quiet indoor tone (between its rooms, or in a walk-in)
  const tone = outdoors && !walledIn ? { cutoff: 1100, level: 0.05, hum: 0, fan: 0 } : room ? ROOM_TONE[room] : { cutoff: 350, level: 0.04, hum: 0, fan: 0 }
  ambient.filter.frequency.setTargetAtTime(tone.cutoff, now, 0.8)
  ambient.gain.gain.setTargetAtTime(tone.level, now, 0.8)
  ambient.hum.gain.setTargetAtTime(tone.hum, now, 1.0)
  ambient.fan.gain.setTargetAtTime(tone.fan, now, 1.0)
}

/** The room tone steps back while something has your attention: a screen or the settings (`who` 'screen'), a film
 *  ('film'). Each holds its own step back (./mix.ts, hold), so one ending never brings the tone back under another. */
export function duckAmbient(ducked: boolean, who = 'screen') {
  hold(`amb:${who}`, 'amb', ducked ? SCREEN_DUCK : null)
}
