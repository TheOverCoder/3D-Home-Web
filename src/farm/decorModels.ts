import type { ProduceId } from './data'
import type { FruitId } from './decor'
import { fruitGoodModel } from '../models/decorStub'
import { GOODS } from '../models/goods'
import type { Structure } from '../models/structures'

// The models of the farm's decoration, its fruit trees and bushes and their fruit, from this one place: today the
// stand-ins (src/models/decorStub.ts); the 3D designer's (src/models/decor.ts, src/models/fruit.ts, the fruit in
// src/models/goods.ts) take their place by changing the imports here, and nothing else.

export { decorModel, fruitPlantModel, fruitSpots } from '../models/decorStub'

/** A good's model: its own (src/models/goods.ts), or for a fruit that has none yet, its stand-in. */
export function goodModel(id: ProduceId): Structure {
  const own = (GOODS as Partial<Record<ProduceId, () => Structure>>)[id]
  return own ? own() : fruitGoodModel(id as FruitId)
}

/** The goods drawn by a stand-in (no model of their own yet): their pictures are drawn from it too. */
export const STAND_IN_GOODS = (['apple', 'orange', 'cherry', 'blueberry', 'raspberry'] as const).filter((id) => !(id in GOODS))
