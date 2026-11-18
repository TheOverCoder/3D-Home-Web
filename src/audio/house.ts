// The sounds of moving about and handling things: footsteps by floor, landings, a jump, the interface's clicks, the
// lamps' switches, the doors, things picked up, put down or dropped, and the screens. Each plays on the live engine
// (./engine.ts), and is silent until a gesture has unlocked audio, or while sound is off.
import type { FloorKind } from '../data/layout'
import { burst, live, rnd, tone, out } from './engine'

/** One footfall. `strength` 0..1 follows the walking speed. */
export function footstep(kind: FloorKind, strength = 1, run = false) {
  const e = live()
  if (!e) return
  const t = e.ac.currentTime + 0.004
  const v = rnd(0.82, 1.12) * Math.max(0.35, Math.min(1, strength)) * (run ? 1.25 : 1)
  if (kind === 'wood') {
    // heel thump into the boards, then a short hollow knock
    burst(e, t, { type: 'lowpass', freq: rnd(330, 420), q: 0.7, gain: 0.55 * v, attack: 0.004, decay: 0.09 })
    burst(e, t + 0.006, { type: 'bandpass', freq: rnd(950, 1350), q: 1.6, gain: 0.2 * v, attack: 0.002, decay: 0.05 })
    tone(e, t, { type: 'sine', f0: rnd(96, 118), f1: 58, gain: 0.22 * v, attack: 0.003, decay: 0.08 })
    if (Math.random() < 0.06) tone(e, t + 0.03, { type: 'triangle', f0: rnd(420, 520), f1: rnd(380, 460), gain: 0.012, attack: 0.04, decay: 0.12 }) // the odd creak
  } else if (kind === 'tile') {
    // hard heel click with a little ring
    burst(e, t, { type: 'highpass', freq: 2300, q: 0.7, gain: 0.2 * v, attack: 0.001, decay: 0.028 })
    burst(e, t, { type: 'bandpass', freq: rnd(3100, 3900), q: 5, gain: 0.1 * v, attack: 0.001, decay: 0.07 })
    burst(e, t, { type: 'lowpass', freq: 520, q: 0.7, gain: 0.28 * v, attack: 0.003, decay: 0.05 })
    tone(e, t, { type: 'sine', f0: 150, f1: 85, gain: 0.12 * v, attack: 0.002, decay: 0.05 })
  } else if (kind === 'stone') {
    // stone: a dull, solid knock with a short gritty scrape, lower and drier than tiles
    burst(e, t, { type: 'lowpass', freq: rnd(380, 460), q: 0.8, gain: 0.32 * v, attack: 0.002, decay: 0.06 })
    burst(e, t, { type: 'bandpass', freq: rnd(1500, 1900), q: 1.2, gain: 0.08 * v, attack: 0.001, decay: 0.035 })
    burst(e, t + 0.004, { type: 'highpass', freq: 3200, q: 0.6, gain: 0.05 * v, attack: 0.002, decay: 0.02 })
    tone(e, t, { type: 'sine', f0: 120, f1: 70, gain: 0.14 * v, attack: 0.002, decay: 0.05 })
  } else if (kind === 'grass') {
    // grass: a soft thud into turf and the swish of blades
    burst(e, t, { type: 'lowpass', freq: rnd(300, 380), q: 0.6, gain: 0.3 * v, attack: 0.012, decay: 0.1 })
    burst(e, t + 0.01, { type: 'bandpass', freq: rnd(3200, 4200), q: 0.6, gain: 0.05 * v, attack: 0.02, decay: 0.12 })
  } else {
    // carpet: a soft muffled pad and a brush of fibre
    burst(e, t, { type: 'lowpass', freq: rnd(460, 600), q: 0.5, gain: 0.34 * v, attack: 0.014, decay: 0.12 })
    burst(e, t + 0.02, { type: 'bandpass', freq: 1900, q: 0.7, gain: 0.025 * v, attack: 0.012, decay: 0.07 })
  }
}

/** Coming down after a jump or a fall; `strength` 0..1. */
export function land(kind: FloorKind, strength: number) {
  const e = live()
  if (!e) return
  const t = e.ac.currentTime + 0.004
  const v = Math.max(0.3, Math.min(1, strength))
  burst(e, t, { type: 'lowpass', freq: kind === 'carpet' ? 260 : 340, q: 0.7, gain: 0.8 * v, attack: 0.004, decay: 0.16 })
  tone(e, t, { type: 'sine', f0: 82, f1: 44, gain: 0.35 * v, attack: 0.004, decay: 0.14 })
  // the knock of it a phone's speaker plays (it carries nothing of the thump under 500 Hz)
  burst(e, t, { type: 'bandpass', freq: kind === 'carpet' ? 700 : 900, q: 1.2, gain: 0.22 * v, attack: 0.003, decay: 0.06 })
  if (kind !== 'carpet') burst(e, t + 0.012, { type: 'bandpass', freq: kind === 'tile' ? 2600 : 1100, q: 1.4, gain: 0.12 * v, attack: 0.002, decay: 0.05 })
  footstep(kind, v * 0.6)
}

/** Push off for a jump: clothes and a breath of air. */
export function jumpSound() {
  const e = live()
  if (!e) return
  const t = e.ac.currentTime + 0.004
  burst(e, t, { type: 'bandpass', freq: 700, sweepTo: 1600, q: 0.9, gain: 0.05, attack: 0.03, decay: 0.12 })
}

/** Soft "tock" for buttons and switches in the interface. */
export function uiClick(on = true) {
  const e = live()
  if (!e) return
  const t = e.ac.currentTime + 0.002
  tone(e, t, { type: 'triangle', f0: on ? 1750 : 1350, f1: on ? 1250 : 950, gain: 0.05, attack: 0.002, decay: 0.035 })
  burst(e, t, { type: 'highpass', freq: 4500, q: 0.7, gain: 0.025, attack: 0.001, decay: 0.012 })
}

/** A rocker switch: a tick and a clack, brighter when switching on. */
export function lampSwitch(on: boolean, pan = 0, near = 1) {
  const e = live()
  if (!e) return
  const t = e.ac.currentTime + 0.004
  const g = 0.35 + 0.65 * near
  burst(e, t, { type: 'highpass', freq: on ? 3800 : 3000, q: 0.8, gain: 0.16 * g, attack: 0.001, decay: 0.012, pan })
  burst(e, t + 0.022, { type: 'bandpass', freq: on ? 1900 : 1500, q: 2.2, gain: 0.22 * g, attack: 0.001, decay: 0.035, pan })
  tone(e, t + 0.022, { type: 'sine', f0: on ? 900 : 700, f1: on ? 640 : 520, gain: 0.03 * g, attack: 0.002, decay: 0.04, pan })
}

/** Door: the latch, a short wooden creak, and the thud when it closes. */
export function doorSound(opening: boolean, pan = 0, near = 1) {
  const e = live()
  if (!e) return
  const { ac } = e
  const t = ac.currentTime + 0.004
  const g = 0.35 + 0.65 * near
  // latch
  burst(e, t, { type: 'bandpass', freq: 2400, q: 3, gain: 0.16 * g, attack: 0.001, decay: 0.03, pan })
  tone(e, t, { type: 'square', f0: 1200, f1: 700, gain: 0.012 * g, attack: 0.001, decay: 0.025, pan })
  // creak: a buzzy tone through a narrow wooden resonance, with a slow pitch drift and stick-slip grain
  const dur = opening ? 0.75 : 0.5
  const osc = ac.createOscillator()
  osc.type = 'sawtooth'
  const f0 = rnd(150, 190)
  osc.frequency.setValueAtTime(f0, t + 0.05)
  osc.frequency.linearRampToValueAtTime(f0 * (opening ? 1.45 : 1.25), t + 0.05 + dur * 0.55)
  osc.frequency.linearRampToValueAtTime(f0 * 1.1, t + 0.05 + dur)
  const grain = ac.createOscillator()
  grain.type = 'square'
  grain.frequency.value = rnd(22, 30)
  const grainDepth = ac.createGain()
  grainDepth.gain.value = 0.5
  const am = ac.createGain()
  am.gain.value = 0.5
  grain.connect(grainDepth).connect(am.gain)
  const res = ac.createBiquadFilter()
  res.type = 'bandpass'
  res.frequency.value = rnd(850, 1100)
  res.Q.value = 7
  const env = ac.createGain()
  env.gain.setValueAtTime(0.0001, t + 0.05)
  env.gain.exponentialRampToValueAtTime(0.05 * g, t + 0.05 + dur * 0.25)
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.05 + dur)
  osc.connect(am).connect(res).connect(env).connect(out(e, pan))
  osc.start(t + 0.05)
  grain.start(t + 0.05)
  osc.stop(t + 0.1 + dur)
  grain.stop(t + 0.1 + dur)
  // air moved by the leaf
  burst(e, t + 0.05, { type: 'lowpass', freq: 500, q: 0.5, gain: 0.05 * g, attack: 0.2, decay: dur, pan })
  if (!opening) {
    const tc = t + 0.62
    burst(e, tc, { type: 'lowpass', freq: 240, q: 0.8, gain: 0.55 * g, attack: 0.004, decay: 0.18, pan })
    tone(e, tc, { type: 'sine', f0: 74, f1: 42, gain: 0.3 * g, attack: 0.004, decay: 0.16, pan })
    burst(e, tc + 0.01, { type: 'bandpass', freq: 2100, q: 3, gain: 0.12 * g, attack: 0.001, decay: 0.03, pan })
  }
}

export function pickupSound() {
  const e = live()
  if (!e) return
  const t = e.ac.currentTime + 0.004
  burst(e, t, { type: 'bandpass', freq: 380, sweepTo: 1500, q: 1.1, gain: 0.07, attack: 0.04, decay: 0.1 })
  tone(e, t + 0.05, { type: 'sine', f0: 560, f1: 760, gain: 0.03, attack: 0.006, decay: 0.09 })
}

export function dropSound() {
  const e = live()
  if (!e) return
  const t = e.ac.currentTime + 0.004
  burst(e, t, { type: 'bandpass', freq: 1400, sweepTo: 420, q: 1.1, gain: 0.06, attack: 0.03, decay: 0.12 })
}

/** Something you carried or pushed hits the floor or the furniture. */
export function impactSound(kind: 'mug' | 'book' | 'gift', strength: number, pan = 0) {
  const e = live()
  if (!e) return
  const t = e.ac.currentTime + 0.003
  const v = Math.max(0.08, Math.min(1, strength))
  if (kind === 'mug') {
    // ceramic: a short knock and a couple of bright, fast-decaying partials
    burst(e, t, { type: 'bandpass', freq: 2200, q: 2, gain: 0.22 * v, attack: 0.001, decay: 0.03, pan })
    tone(e, t, { type: 'sine', f0: rnd(2100, 2350), gain: 0.06 * v, attack: 0.001, decay: 0.16, pan })
    tone(e, t, { type: 'sine', f0: rnd(3350, 3600), gain: 0.03 * v, attack: 0.001, decay: 0.09, pan })
  } else if (kind === 'book') {
    burst(e, t, { type: 'lowpass', freq: 900, q: 0.8, gain: 0.4 * v, attack: 0.002, decay: 0.06, pan })
    burst(e, t, { type: 'bandpass', freq: 2600, q: 1, gain: 0.08 * v, attack: 0.001, decay: 0.025, pan })
  } else {
    burst(e, t, { type: 'lowpass', freq: 320, q: 0.9, gain: 0.45 * v, attack: 0.003, decay: 0.1, pan })
    burst(e, t, { type: 'bandpass', freq: 750, q: 1.6, gain: 0.16 * v, attack: 0.002, decay: 0.07, pan })
  }
}

/** A soft glassy chime when a screen opens, falling when it closes. */
export function screenSound(open: boolean) {
  const e = live()
  if (!e) return
  const t = e.ac.currentTime + 0.004
  const [a, b] = open ? [587, 880] : [880, 587]
  tone(e, t, { type: 'sine', f0: a, gain: 0.035, attack: 0.012, decay: 0.45 })
  tone(e, t + 0.07, { type: 'sine', f0: b, gain: 0.03, attack: 0.012, decay: 0.6 })
  tone(e, t + 0.07, { type: 'sine', f0: b * 2.01, gain: 0.006, attack: 0.01, decay: 0.3 })
  burst(e, t, { type: 'bandpass', freq: open ? 600 : 2200, sweepTo: open ? 2400 : 500, q: 0.8, gain: 0.025, attack: 0.08, decay: 0.2 })
}
