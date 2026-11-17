import type { ArtId } from '../ui/art'
import type { LadderId, ProduceId, StoreId, ToolKind, ToolPart } from './data'

// What an animal's tool panel shows and what it can do: one panel for the three (the coop, the milk bucket, the
// shears; plans/animal-tools.md). The farm's state makes the view (`toolView` in ./state) and does the taking
// (`toolTake`); the panel (./tool/ToolPanelView.tsx) only draws the view and calls the actions.

/** One of its places: a hen's nest, a cow, a sheep. */
export interface ToolSpot {
  /** "Nest 1", "Bella", "Dolly" */
  name: string
  /** how many wait there, and the most that can */
  has: number
  most: number
  /** 0–1 of the way to the next one (0 while it is full: none on its way) */
  next: number
  /** whole seconds to the next one (0 while it is full) */
  seconds: number
}

export interface ToolView {
  kind: ToolKind
  name: string
  good: ProduceId
  look: 'nests' | 'pail' | 'shears'
  /** the tool's picture, and its animal's */
  art: ArtId
  animal: ArtId
  spots: ToolSpot[]
  /** how many one tap takes */
  perTap: number
  /** room for the good in its building now, which building, how much it holds and of how much */
  room: number
  store: StoreId
  stored: number
  capacity: number
  /** its two upgrades (how much each place holds, how many a tap takes) as chips: their words, now, after the next step
   *  (null at the top), the next step's price, and the steps bought of how many */
  ladders: { id: LadderId; part: Exclude<ToolPart, 'tool'>; name: string; now: string; next: string | null; price: number; k: number; steps: number }[]
}

export interface ToolActions {
  /** one tap: from the place tapped, or the fullest; how many were taken */
  tap(spot?: number): number
  /** one of its upgrades: its card, which asks first */
  upgrade(id: LadderId): void
  /** how the tool looks: its skins */
  skins(): void
}
