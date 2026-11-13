// The player's clothes (the wardrobe in the house, src/home/Wardrobe.tsx): the people engine's clothes (src/models/look.ts
// — its shirt, its trousers, the straw hat, the cap and the beanie) in a table of garments, each with the level it
// comes with. Level 1 has two of each; then one more every GARMENT_EVERY levels, up to the top level (LEVELS.max), so
// every fifth level brings one. The clothes the buyers wear come first, in the order of their table; after them the
// same clothes in more colours. Pure: what is worn is in the farm's save (`outfit`), changed by state.ts.

import type { HatKind } from '../models/person'
import { LEVELS } from './data'

export type GarmentSlot = 'shirt' | 'trousers' | 'hat'

export interface Garment {
  id: string
  slot: GarmentSlot
  /** a few words: "Teal shirt", "Navy cap" */
  name: string
  /** the cloth's colour; on the straw hat, its band's */
  colour: string
  /** a hat's kind */
  hat?: HatKind
  /** the level it comes with (1: in the wardrobe from the start) */
  level: number
}

/** A new garment every this many levels. */
export const GARMENT_EVERY = 5

type Row = [name: string, colour: string]
type HatRow = [kind: HatKind, name: string, colour: string]

/** Two of each from the start: the shirt and trousers the player always wore, a shirt and trousers more, two hats. */
const START = {
  shirt: [
    ['Blue', '#4c6a82'],
    ['Rust', '#c9573f'],
  ] as Row[],
  trousers: [
    ['Charcoal', '#2b3038'],
    ['Denim', '#3d4a5c'],
  ] as Row[],
  hat: [
    ['straw', 'Brown', '#8a4b3a'],
    ['cap', 'Navy', '#2f4a6b'],
  ] as HatRow[],
}

/** What comes later, each list in the order it comes: first the people engine's own (its shirts, trousers, hat bands;
 *  the manager's white shirt and suit trousers, the contractor's orange shirt and yellow cap), then more colours. */
const LATER = {
  shirt: [
    ['Cobalt', '#3f6fa3'],
    ['Leaf', '#5c8a4a'],
    ['Mustard', '#d9a441'],
    ['Violet', '#7b5aa6'],
    ['Teal', '#2f8f8a'],
    ['Coral', '#e07a5f'],
    ['Slate', '#4d5d73'],
    ['Cherry', '#b23a48'],
    ['Sand', '#f2cc8f'],
    ['White', '#f2eee8'],
    ['Work orange', '#e8742c'],
    ['Sky', '#7fb3d5'],
    ['Mint', '#8fd1b5'],
    ['Lemon', '#f2e27a'],
    ['Lilac', '#b9a3d9'],
    ['Peach', '#f4b183'],
    ['Rose', '#e58fa6'],
    ['Olive', '#7d8a3c'],
    ['Plum', '#6e3b5e'],
    ['Ocean', '#1f6f9f'],
    ['Moss', '#4f6b2f'],
    ['Brick', '#a4472f'],
    ['Ink', '#23324d'],
    ['Pine', '#2e5e4a'],
    ['Lavender', '#9b8fd0'],
    ['Apricot', '#f0a35e'],
    ['Berry', '#8e2c5c'],
    ['Cream', '#efe3c8'],
    ['Graphite', '#3a3d42'],
    ['Ruby', '#9b1d2e'],
    ['Jade', '#3a9d78'],
    ['Saffron', '#f0b429'],
    ['Cornflower', '#5577a3'],
    ['Sage', '#9cae8f'],
    ['Tangerine', '#f28c38'],
    ['Grape', '#5b3f8a'],
    ['Cocoa', '#6b4632'],
    ['Ice', '#cfe6f2'],
    ['Flamingo', '#f08da0'],
    ['Golden', '#d4a017'],
  ] as Row[],
  trousers: [
    ['Brown', '#5a4636'],
    ['Forest', '#1f2a24'],
    ['Khaki', '#6b6255'],
    ['Navy', '#283044'],
    ['Suit', '#2f3a4f'],
    ['Sand', '#c2b280'],
    ['Olive', '#5b5e3a'],
    ['Grey', '#6e7178'],
    ['Black', '#18191c'],
    ['Rust', '#8a4a2c'],
    ['Wine', '#5c2232'],
    ['Teal', '#24524f'],
    ['Stone', '#9a948a'],
    ['Chocolate', '#3e2a1f'],
    ['Indigo', '#2c2f6b'],
    ['Moss', '#47553a'],
    ['Steel', '#4f5b66'],
    ['Burgundy', '#6b1f2e'],
    ['Cream', '#ddd2b8'],
    ['Golden', '#b8902a'],
  ] as Row[],
  hat: [
    ['straw', 'Navy', '#2f4a6b'],
    ['cap', 'Brown', '#8a4b3a'],
    ['beanie', 'Rust', '#8a4b3a'],
    ['straw', 'Green', '#3d5a3a'],
    ['cap', 'Green', '#3d5a3a'],
    ['beanie', 'Navy', '#2f4a6b'],
    ['straw', 'Wine', '#7a2e3a'],
    ['cap', 'Wine', '#7a2e3a'],
    ['beanie', 'Green', '#3d5a3a'],
    ['straw', 'Gold', '#d9a441'],
    ['cap', 'Mustard', '#d9a441'],
    ['beanie', 'Wine', '#7a2e3a'],
    ['cap', 'Yellow', '#f2c230'],
    ['beanie', 'Mustard', '#d9a441'],
    ['straw', 'Red', '#b23a48'],
    ['cap', 'Red', '#b23a48'],
    ['beanie', 'Red', '#b23a48'],
    ['straw', 'Sky', '#5c9ccf'],
    ['cap', 'Sky', '#5c9ccf'],
    ['beanie', 'Sky', '#5c9ccf'],
    ['straw', 'Teal', '#2f8f8a'],
    ['cap', 'Teal', '#2f8f8a'],
    ['beanie', 'Teal', '#2f8f8a'],
    ['straw', 'Violet', '#7b5aa6'],
    ['cap', 'Black', '#1c1c1c'],
    ['beanie', 'Black', '#1c1c1c'],
    ['straw', 'White', '#f2eee8'],
    ['cap', 'White', '#f2eee8'],
    ['beanie', 'White', '#f2eee8'],
    ['straw', 'Black', '#1c1c1c'],
    ['cap', 'Orange', '#e8742c'],
    ['beanie', 'Orange', '#e8742c'],
    ['straw', 'Orange', '#e8742c'],
    ['cap', 'Purple', '#7b5aa6'],
    ['beanie', 'Pink', '#e58fa6'],
    ['straw', 'Rose', '#e07a8f'],
    ['beanie', 'Lime', '#9ccf4a'],
    ['cap', 'Lime', '#9ccf4a'],
    ['beanie', 'Golden', '#d4a017'],
    ['cap', 'Golden', '#d4a017'],
  ] as HatRow[],
}

/** The order the later ones come in: a shirt, a hat, trousers, a shirt, a hat, and again (two shirts and two hats to
 *  a pair of trousers). The last of the hats, the golden cap, comes with the top level. */
const TURNS: GarmentSlot[] = ['shirt', 'hat', 'trousers', 'shirt', 'hat']

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')
const HAT_WORD: Record<HatKind, (name: string) => string> = {
  straw: (name) => `${name}-band straw hat`,
  cap: (name) => `${name} cap`,
  beanie: (name) => `${name} beanie`,
}

function cloth(slot: 'shirt' | 'trousers', [name, colour]: Row, level: number): Garment {
  return { id: `${slot}-${slug(name)}`, slot, name: `${name} ${slot}`, colour, level }
}
function hat([kind, name, colour]: HatRow, level: number): Garment {
  return { id: `${kind}-${slug(name)}`, slot: 'hat', name: HAT_WORD[kind](name), colour, hat: kind, level }
}

function build(): Garment[] {
  const out: Garment[] = [...START.shirt.map((r) => cloth('shirt', r, 1)), ...START.trousers.map((r) => cloth('trousers', r, 1)), ...START.hat.map((r) => hat(r, 1))]
  const next = { shirt: 0, trousers: 0, hat: 0 }
  const count = Math.floor(LEVELS.max / GARMENT_EVERY)
  for (let k = 0; k < count; k++) {
    const level = (k + 1) * GARMENT_EVERY
    const slot = TURNS[k % TURNS.length]
    const i = next[slot]++
    out.push(slot === 'hat' ? hat(LATER.hat[i], level) : cloth(slot, LATER[slot][i], level))
  }
  return out
}

/** Every garment, in the order they come (the six of level 1 first). */
export const GARMENTS: readonly Garment[] = build()

const BY_ID = new Map(GARMENTS.map((g) => [g.id, g]))
const BY_LEVEL = new Map(GARMENTS.filter((g) => g.level > 1).map((g) => [g.level, g]))

export const garmentById = (id: string | null | undefined): Garment | undefined => (id ? BY_ID.get(id) : undefined)

/** The garment that comes with reaching exactly this level (none on most levels). */
export const garmentAt = (level: number): Garment | undefined => BY_LEVEL.get(level)

/** The first garment still to come after `level` (none at the top). */
export const nextGarment = (level: number): Garment | undefined => GARMENTS.find((g) => g.level > level)

/** What is in the wardrobe at this level: every garment that came with it or before. */
export const garmentsAt = (level: number): Garment[] => GARMENTS.filter((g) => g.level <= level)

/** What the player wears (as saved): a garment for each slot, a hat or none, and the level up to which the wardrobe has
 *  shown its garments (one that came after is marked new there). */
export interface Outfit {
  shirt: string
  trousers: string
  hat: string | null
  seen: number
}

/** The clothes the player always wore: the blue shirt, the charcoal trousers, no hat. */
export const DEFAULT_OUTFIT: Outfit = { shirt: 'shirt-blue', trousers: 'trousers-charcoal', hat: null, seen: 1 }

const worn = (id: unknown, slot: GarmentSlot, level: number) => {
  const g = typeof id === 'string' ? BY_ID.get(id) : undefined
  return g && g.slot === slot && g.level <= level ? g.id : null
}

/** A saved outfit read back at the farm's level: each garment one the wardrobe has (a farm from before the wardrobe, or
 *  anything else: the clothes it always wore); the new marks from the level saved. */
export function sanitizeOutfit(raw: unknown, level: number): Outfit {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const seen = typeof r.seen === 'number' && Number.isFinite(r.seen) ? Math.min(level, Math.max(1, Math.floor(r.seen))) : 1
  return {
    shirt: worn(r.shirt, 'shirt', level) ?? DEFAULT_OUTFIT.shirt,
    trousers: worn(r.trousers, 'trousers', level) ?? DEFAULT_OUTFIT.trousers,
    hat: worn(r.hat, 'hat', level),
    seen,
  }
}

/** The outfit with a garment put on (one of the wardrobe's at this level; anything else changes nothing). A hat
 *  already worn comes off when chosen again. */
export function putOn(outfit: Outfit, id: string, level: number): Outfit {
  const g = BY_ID.get(id)
  if (!g || g.level > level) return outfit
  if (g.slot === 'hat') return { ...outfit, hat: outfit.hat === id ? null : id }
  return { ...outfit, [g.slot]: id }
}

/** How the outfit looks: the shirt's and trousers' colours, and the hat (its kind and colour) or none. */
export function outfitLook(o: Outfit): { shirt: string; trousers: string; hat: { kind: HatKind; colour: string } | null } {
  const shirt = BY_ID.get(o.shirt) ?? BY_ID.get(DEFAULT_OUTFIT.shirt)!
  const trousers = BY_ID.get(o.trousers) ?? BY_ID.get(DEFAULT_OUTFIT.trousers)!
  const hat = o.hat ? BY_ID.get(o.hat) : undefined
  return { shirt: shirt.colour, trousers: trousers.colour, hat: hat?.hat ? { kind: hat.hat, colour: hat.colour } : null }
}
