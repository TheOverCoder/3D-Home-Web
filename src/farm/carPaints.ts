import { isObject } from '../lib/saved'

// Paints for your car (update-v1/missions/11-buildings.md c10), sold by the car dealer on the lane (Lane Motors,
// src/farm/Dealer.tsx): red, the car as it was made, free and yours from the start, and five more, each opening at a
// level (src/farm/unlocks.ts, `paint:<id>`) and bought once at its price; the one worn is your car's on both maps and
// in the drive's film (an instance colour over its red: src/models/car.ts, paintTint). Pure: the farm keeps
// `farm.car` (src/farm/state/car.ts).

export type PaintId = 'red' | 'sky' | 'mint' | 'sunflower' | 'navy' | 'plum'

/** [review] The paints, in the order the dealer shows them: their name, colour and price (red free). */
export const CAR_PAINTS: Readonly<Record<PaintId, { name: string; hex: string; price: number }>> = {
  red: { name: 'Tomato red', hex: '#d4402f', price: 0 },
  sky: { name: 'Sky blue', hex: '#6fa8d6', price: 300 },
  mint: { name: 'Mint', hex: '#8fd3b6', price: 450 },
  sunflower: { name: 'Sunflower', hex: '#f2c230', price: 650 },
  navy: { name: 'Midnight', hex: '#2c3e66', price: 900 },
  plum: { name: 'Plum', hex: '#7a3b6a', price: 1200 },
}
export const PAINT_IDS = Object.keys(CAR_PAINTS) as PaintId[]
export const isPaintId = (v: unknown): v is PaintId => typeof v === 'string' && (PAINT_IDS as string[]).includes(v)

/** What the farm keeps of its car: the paints it owns (red always) and the one it wears. */
export interface CarRecord {
  owned: PaintId[]
  worn: PaintId
}

/** A new farm's car: red, owned and worn. */
export const freshCar = (): CarRecord => ({ owned: ['red'], worn: 'red' })

/** The car as saved: known paints only, each once, in the table's order, red always among them; the one worn one it
 *  owns (else red). Missing (a farm from before it): red, owned and worn. */
export function sanitizeCar(raw: unknown): CarRecord {
  if (!isObject(raw)) return freshCar()
  const listed = Array.isArray(raw.owned) ? raw.owned : []
  const owned = PAINT_IDS.filter((id) => id === 'red' || listed.includes(id))
  const worn = isPaintId(raw.worn) && owned.includes(raw.worn) ? raw.worn : 'red'
  return { owned, worn }
}
