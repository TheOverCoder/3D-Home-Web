// The goods on the market's shelves: a unit on each shelf of a place, from the bottom shelf up (src/data/market.ts:
// BAYS, SHELF_YS), each the good's own model (src/models/goods.ts), the same one its picture is drawn from. Every good
// is a crowd of its own (src/lib/sculpt/parts.ts), made the first time it goes on a shelf, and each unit is one model
// of it: the drawing pass draws only the units in view and not hidden behind a wall, the island's middle panel or the
// shut front door. They cast no shadow: no sunlight reaches inside the shell (`casters` turns it on, for the pixel
// guard to prove that).

import { Box3, Group } from 'three'
import { BAYS, SHELF_YS } from '../data/market'
import { Parts, type PartDef } from '../lib/sculpt'
import { GOODS } from '../models/goods'
import { BAY_DEPTH } from '../models/market'
import type { ProduceId } from './data'
import type { Shelf } from './market'

/** The most units of one good on the shelves at once: every shelf of every place. */
const MOST = BAYS.length * SHELF_YS.length
/** How big a unit may be (m): under the next shelf up, within its place's width, within the shelf's depth. */
const ROOM = { h: 0.36, across: 0.5 }
/** How far into the shelf a unit stands, from its place's front (m): the middle of the shelf. */
const DEPTH = BAY_DEPTH / 2
/** Each unit turned a little towards the aisle as its picture shows it (seen from the front left), and a little more or
 *  less from shelf to shelf, as things are put down by hand. */
const TURN = Math.PI / 6
const JITTER = [0, 0.14, -0.11, 0.07, -0.05]

interface Good {
  parts: Parts
  keys: string[]
  /** how much it is made smaller to fit its shelf (1: as it is) */
  scale: number
  /** the middle of its footprint, in its own frame (it is put there) */
  cx: number
  cz: number
  triangles: number
}

/** A good's model as a crowd: one draw per part, up to every shelf's unit. */
function build(id: ProduceId, castShadow: boolean): Good {
  const model = GOODS[id]()
  const keys = Object.keys(model)
  const box = new Box3()
  const defs: Record<string, PartDef> = {}
  let triangles = 0
  for (const k of keys) {
    const geometry = model[k].shape.geometry()
    box.union(geometry.boundingBox!)
    triangles += geometry.index!.count / 3
    defs[k] = { geometry, max: MOST, material: model[k].material, castShadow }
  }
  const w = box.max.x - box.min.x
  const d = box.max.z - box.min.z
  const h = box.max.y - box.min.y
  return {
    parts: new Parts(defs, `market-goods-${id}`),
    keys,
    scale: Math.min(1, ROOM.h / h, ROOM.across / Math.max(w, d)),
    cx: (box.min.x + box.max.x) / 2,
    cz: (box.min.z + box.max.z) / 2,
    triangles,
  }
}

export class MarketGoods {
  readonly group = new Group()
  private goods = new Map<ProduceId, Good>()
  private castShadow = false

  constructor() {
    this.group.name = 'market-goods'
  }

  private good(id: ProduceId): Good {
    let g = this.goods.get(id)
    if (!g) {
      g = build(id, this.castShadow)
      this.goods.set(id, g)
      this.group.add(g.parts.group)
    }
    return g
  }

  /** Puts every unit on the shelves as they are now (the places past `open` hold nothing). */
  put(shelves: readonly Shelf[], open: number) {
    for (const g of this.goods.values()) g.parts.begin()
    for (let k = 0; k < Math.min(open, shelves.length, BAYS.length); k++) {
      const shelf = shelves[k]
      if (!shelf.good || shelf.units <= 0) continue
      const g = this.good(shelf.good)
      const bay = BAYS[k]
      // into the shelf from its front: against the way it faces
      const x = bay.x - Math.sin(bay.heading) * DEPTH
      const z = bay.z - Math.cos(bay.heading) * DEPTH
      for (let u = 0; u < Math.min(shelf.units, SHELF_YS.length); u++) {
        g.parts.at(x, SHELF_YS[u], z, bay.heading + TURN + JITTER[(k * 3 + u) % JITTER.length], g.scale)
        for (const key of g.keys) g.parts.put(key, -g.cx, 0, -g.cz)
      }
    }
    for (const g of this.goods.values()) g.parts.end()
  }

  /** Whether the goods cast a shadow (they do not: the pixel guard turns it on to prove it changes nothing). Made again,
   *  and put again by the next `put`. */
  setCasters(on: boolean) {
    if (on === this.castShadow) return
    this.castShadow = on
    this.clear()
  }

  /** The triangles of one unit of each good made so far. */
  triangles(): Partial<Record<ProduceId, number>> {
    const out: Partial<Record<ProduceId, number>> = {}
    for (const [id, g] of this.goods) out[id] = g.triangles
    return out
  }

  private clear() {
    for (const g of this.goods.values()) {
      g.parts.group.removeFromParent()
      g.parts.dispose()
      for (const k of g.keys) g.parts.meshes[k].geometry.dispose()
    }
    this.goods.clear()
  }

  dispose() {
    this.clear()
  }
}

/** The triangles of one unit of every good that can go on a shelf (each model built once to count; for the tests). */
export function goodsTriangles(ids: readonly ProduceId[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const id of ids) {
    const model = GOODS[id]()
    let n = 0
    for (const k of Object.keys(model)) n += model[k].shape.triangles()
    out[id] = n
  }
  return out
}
