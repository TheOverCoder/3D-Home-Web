// What can stand in the house: every kind of piece, its size, the layer it lives on, whether it is fitted (stays
// where it is), what another one costs and what it costs to draw. The models are the ones the house is built with
// (src/scene/Furnishings.tsx); each is built with its back towards −z at no turn.

export type PieceType =
  | 'sofa'
  | 'coffee-table'
  | 'tv-console'
  | 'plant-tall'
  | 'plant'
  | 'armchair'
  | 'accent-chair'
  | 'pouf'
  | 'desk'
  | 'chair'
  | 'bookshelf'
  | 'counter'
  | 'fridge'
  | 'island'
  | 'stool'
  | 'bed'
  | 'nightstand'
  | 'wardrobe'
  | 'rug-living'
  | 'rug-studio'
  | 'rug-bedroom'

export interface PieceDef {
  name: string
  /** its box at no turn: width (x), height, depth (z), metres */
  size: [number, number, number]
  /** rugs lie on the floor under furniture; everything else stands on the floor and keeps clear of the rest */
  layer: 'floor' | 'rug'
  /** built in: it stays where it is (the kitchen's counter, fridge and island) */
  fitted?: boolean
  /** what another one costs in the shop (0: not for sale) */
  price: number
  /** which tab of the shop it is under */
  group: 'seating' | 'tables' | 'storage' | 'plants' | 'rugs' | 'beds' | 'kitchen'
  /** what it costs to draw: the triangles of its model (the real one in src/assets/models/props, else the one built in
   *  Furnishings.tsx), counted in the game. A room holds pieces up to ROOM_WEIGHT of it (src/home/layout.ts); a
   *  model must stay within its weight (15-decorate counts them). */
  weight: number
}

export const PIECES: Record<PieceType, PieceDef> = {
  sofa: { name: 'Sofa', size: [2.2, 0.95, 0.95], layer: 'floor', price: 220, group: 'seating', weight: 4196 },
  'coffee-table': { name: 'Coffee table', size: [1.1, 0.42, 0.6], layer: 'floor', price: 90, group: 'tables', weight: 1800 },
  'tv-console': { name: 'Low cabinet', size: [1.8, 0.5, 0.45], layer: 'floor', price: 120, group: 'storage', weight: 900 },
  'plant-tall': { name: 'Tall plant', size: [0.7, 1.3, 0.7], layer: 'floor', price: 60, group: 'plants', weight: 9544 },
  plant: { name: 'Plant', size: [0.45, 1.0, 0.45], layer: 'floor', price: 35, group: 'plants', weight: 1248 },
  armchair: { name: 'Armchair', size: [0.85, 0.95, 0.85], layer: 'floor', price: 140, group: 'seating', weight: 7985 },
  'accent-chair': { name: 'Easy chair', size: [0.83, 0.69, 0.57], layer: 'floor', price: 110, group: 'seating', weight: 9984 },
  pouf: { name: 'Pouf', size: [0.6, 0.2, 0.6], layer: 'floor', price: 40, group: 'seating', weight: 9753 },
  desk: { name: 'Desk', size: [1.8, 0.76, 0.8], layer: 'floor', price: 150, group: 'tables', weight: 1200 },
  chair: { name: 'Desk chair', size: [0.5, 0.95, 0.5], layer: 'floor', price: 60, group: 'seating', weight: 668 },
  bookshelf: { name: 'Bookshelf', size: [1.4, 2.0, 0.4], layer: 'floor', price: 130, group: 'storage', weight: 3144 },
  counter: { name: 'Kitchen counter', size: [4.6, 0.9, 0.62], layer: 'floor', fitted: true, price: 0, group: 'kitchen', weight: 672 },
  fridge: { name: 'Fridge', size: [0.8, 1.9, 0.75], layer: 'floor', fitted: true, price: 0, group: 'kitchen', weight: 912 },
  island: { name: 'Kitchen island', size: [2.0, 0.92, 0.9], layer: 'floor', fitted: true, price: 0, group: 'kitchen', weight: 600 },
  stool: { name: 'Stool', size: [0.38, 0.65, 0.38], layer: 'floor', price: 30, group: 'seating', weight: 208 },
  bed: { name: 'Bed', size: [1.7, 0.7, 2.1], layer: 'floor', price: 260, group: 'beds', weight: 1800 },
  nightstand: { name: 'Nightstand', size: [0.5, 0.58, 0.45], layer: 'floor', price: 50, group: 'storage', weight: 612 },
  wardrobe: { name: 'Wardrobe', size: [1.6, 2.2, 0.6], layer: 'floor', price: 200, group: 'storage', weight: 348 },
  'rug-living': { name: 'Brown rug', size: [3.0, 0.01, 2.2], layer: 'rug', price: 70, group: 'rugs', weight: 2 },
  'rug-studio': { name: 'Slate rug', size: [2.4, 0.01, 1.6], layer: 'rug', price: 55, group: 'rugs', weight: 2 },
  'rug-bedroom': { name: 'Grey rug', size: [2.8, 0.01, 3.0], layer: 'rug', price: 75, group: 'rugs', weight: 2 },
}

export const PIECE_TYPES = Object.keys(PIECES) as PieceType[]
export const isPieceType = (t: unknown): t is PieceType => typeof t === 'string' && t in PIECES
