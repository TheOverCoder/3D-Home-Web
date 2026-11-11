// The people engine: one table of what people look like (TRAITS), and one roll that makes a whole person from it on the
// farm's dice — the buyers at the gate, the shoppers in the market. A character who always looks the same (the
// manager, the contractor) is a roll with some traits fixed (`overrides`). A look is saved as its traits, never as
// the roll, so changing the table never changes someone already standing in the line; a trait added later has a
// default, and older saves load as they were (sanitizeLook).
//
// What it costs to draw: height, build and head are the rig's joints scaled, and every colour is per person (one
// draw a part for the whole crowd); only a new shape (a hair style, a hat, the tie) is another part, drawn while
// someone wearing it is in view (src/models/person.ts).

import type { HatKind, PersonLook } from './person'

export const TRAITS = {
  shirts: ['#c9573f', '#3f6fa3', '#5c8a4a', '#d9a441', '#7b5aa6', '#2f8f8a', '#e07a5f', '#4d5d73', '#b23a48', '#f2cc8f'],
  trousers: ['#2b3038', '#3d4a5c', '#5a4636', '#1f2a24', '#6b6255', '#283044'],
  skins: ['#f1c7a5', '#e0ac87', '#c68863', '#9a6646', '#704a32', '#f6d5bd'],
  hairs: ['#2b2017', '#5a3a22', '#a8743f', '#d9b98a', '#1c1c1c', '#7b4b2a', '#b9b2a8'],
  eyes: ['#4a2f1e', '#2a1c14', '#6b5a2a', '#4f6b3a', '#3f6a8f', '#6d7680'],
  bands: ['#8a4b3a', '#2f4a6b', '#3d5a3a', '#7a2e3a', '#d9a441'],
  /** hair styles by build: 0 short, 1 long, 2 bun, 3 curly, 4 ponytail (each listed once, more likely when listed more) */
  hairStyles: { f: [1, 1, 2, 2, 4, 4, 3, 0], m: [0, 0, 0, 3, 3, 1] },
  hats: [false, false, false, 'straw', 'cap', 'beanie'] as (false | HatKind)[],
  height: [0.92, 1.08],
  /** the build's shoulders and hips, and the head, as ranges round 1 */
  build: { f: { shoulders: [0.9, 1.0], hips: [1.0, 1.1] }, m: { shoulders: [1.0, 1.1], hips: [0.9, 1.0] } },
  head: [0.95, 1.05],
} as const

/** How many looks the table makes, counting only the traits that are picked from a list (the sizes come on top). */
export const LOOK_VARIETY = 2 * 5 * TRAITS.hairs.length * 4 * TRAITS.shirts.length * TRAITS.trousers.length * TRAITS.skins.length * TRAITS.eyes.length

/** A whole person, rolled on `rand` (the farm's dice), with any traits in `overrides` fixed. */
export function rollLook(rand: () => number, overrides: Partial<PersonLook> = {}): PersonLook {
  const pick = <T>(list: readonly T[]) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))]
  const span = ([a, b]: readonly [number, number]) => a + (b - a) * rand()
  const sex = overrides.sex ?? (rand() < 0.5 ? 'f' : 'm')
  const look: PersonLook = {
    sex,
    shirt: pick(TRAITS.shirts),
    trousers: pick(TRAITS.trousers),
    skin: pick(TRAITS.skins),
    hair: pick(TRAITS.hairs),
    hairStyle: pick(TRAITS.hairStyles[sex]),
    hat: pick(TRAITS.hats),
    hatBand: pick(TRAITS.bands),
    height: span(TRAITS.height),
    shoulders: span(TRAITS.build[sex].shoulders),
    hips: span(TRAITS.build[sex].hips),
    head: span(TRAITS.head),
    eyes: pick(TRAITS.eyes),
  }
  return { ...look, ...overrides }
}

/** The manager: a white shirt, navy trousers, grey short hair, a tie; no hat, no basket. */
export const MANAGER_LOOK: Partial<PersonLook> = { sex: 'm', shirt: '#f2eee8', trousers: '#2f3a4f', hair: '#9a9894', hairStyle: 0, hat: false, extra: 'tie', basket: false, height: 1.02 }
/** The contractor: the cap in yellow for a hard hat, an orange work shirt, no basket. */
export const CONTRACTOR_LOOK: Partial<PersonLook> = { sex: 'm', shirt: '#e8742c', trousers: '#3d4a5c', hat: 'cap', hatBand: '#f2c230', basket: false, height: 1.04 }

const isColour = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
const inRange = (v: unknown, [a, b]: readonly [number, number], d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d)

/** A saved look read back, or null when it is not one (its four colours are what every save has). Older saves' looks
 *  load as they were; traits they lack get the defaults (the built size, brown eyes, no band colour of its own). */
export function sanitizeLook(raw: unknown): PersonLook | null {
  if (!raw || typeof raw !== 'object') return null
  const l = raw as Record<string, unknown>
  if (!isColour(l.shirt) || !isColour(l.trousers) || !isColour(l.skin) || !isColour(l.hair)) return null
  const sex = l.sex === 'f' || l.sex === 'm' ? l.sex : undefined
  const hat = l.hat === 'straw' || l.hat === 'cap' || l.hat === 'beanie' ? l.hat : l.hat === true
  const style = typeof l.hairStyle === 'number' && Number.isInteger(l.hairStyle) && l.hairStyle >= 0 && l.hairStyle <= 4 ? l.hairStyle : 0
  return {
    shirt: l.shirt,
    trousers: l.trousers,
    skin: l.skin,
    hair: l.hair,
    hairStyle: style,
    hat,
    height: inRange(l.height, [0.9, 1.08], 1),
    ...(sex ? { sex } : {}),
    ...(l.shoulders !== undefined ? { shoulders: inRange(l.shoulders, [0.85, 1.15], 1) } : {}),
    ...(l.hips !== undefined ? { hips: inRange(l.hips, [0.85, 1.15], 1) } : {}),
    ...(l.head !== undefined ? { head: inRange(l.head, [0.9, 1.1], 1) } : {}),
    ...(isColour(l.eyes) ? { eyes: l.eyes } : {}),
    ...(isColour(l.hatBand) ? { hatBand: l.hatBand } : {}),
    ...(l.extra === 'tie' ? { extra: 'tie' as const } : {}),
    ...(l.basket === false ? { basket: false } : {}),
  }
}
