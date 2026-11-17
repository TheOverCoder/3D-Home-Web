import type { LadderId, ProduceId, StoreId, ToolKind } from './data'

// What an animal's tool panel shows and what it can do: one panel for the three (the coop, the milk bucket, the
// shears; plans/animal-tools.md). The farm's state makes the view (`toolView` in ./state) and does the taking
// (`toolTake`); the panel only draws the view and calls the actions.

/** One of its places: a hen's nest, a cow, a sheep. */
export interface ToolSpot {
  /** "Nest 1", "Bella", "Dolly" */
  name: string
  /** how many wait there, and the most that can */
  has: number
  most: number
  /** 0–1 of the way to the next one (0 while it is full: none on its way) */
  next: number
}

export interface ToolView {
  kind: ToolKind
  name: string
  good: ProduceId
  look: 'nests' | 'pail' | 'shears'
  spots: ToolSpot[]
  /** how many one tap takes */
  perTap: number
  /** room for the good in its building now, and which building */
  room: number
  store: StoreId
  /** its two upgrades (how much each place holds, how many a tap takes) as chips: now, after the next step (null at
   *  the top), and the next step's price */
  ladders: { id: LadderId; now: string; next: string | null; price: number }[]
}

export interface ToolActions {
  /** one tap: from the place tapped, or the fullest; how many were taken */
  tap(spot?: number): number
  /** one of its upgrades (its card asks first) */
  upgrade(id: LadderId): void
}
