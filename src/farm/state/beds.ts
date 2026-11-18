import { groundDistance } from '../../lib/interaction'
import { BED_BOX, BED_REACH, BEDS, count, cropById, ITEM_ODDS, WATER_SHARE, type CropId, type ItemId } from '../data'
import { rollItems } from '../storage'
import type { Placement } from '../layout'
import { bump, cropOpen, farm, isUnlocked, random, save, toast } from './core'
import { gainXp } from './levels'
import { gainItems, room, store, surpriseWords } from './stores'

// The beds: what each is doing, planting, watering, harvesting (a press does every like bed in reach), building one,
// setting what it always grows, and their growing as the farm runs.

/** The water a crop's seeds go in with, and a watering gives: this share of its growing time. */
export const fullWater = (crop: CropId) => cropById(crop).growSeconds * WATER_SHARE

export type BedStage = 'unbought' | 'locked' | 'empty' | 'thirsty' | 'growing' | 'ripe'

export function bedStage(i: number): BedStage {
  const b = farm.beds[i]
  const def = BEDS[i]
  if (def.expansion && !farm.expansions[def.expansion]) return 'unbought'
  if (!b.built) return 'locked'
  if (!b.crop) return 'empty'
  if (b.growth >= cropById(b.crop).growSeconds) return 'ripe'
  if (!farm.sprinkler && b.water <= 0) return 'thirsty'
  return 'growing'
}

/** The beds within reach of (x, z) at `stage`, the given one first: one press harvests, waters or plants them all.
 *  Within reach as the action button measures it: from the edge of each bed's frame (BED_REACH). */
export function bedsNear(index: number, stage: BedStage, x: number, z: number): number[] {
  const out = [index]
  BEDS.forEach((_, i) => {
    if (i !== index && bedStage(i) === stage && groundDistance(x, z, bedSpot(i), bedBox(i)) <= BED_REACH) out.push(i)
  })
  return out
}

/** Where a bed stands now (its middle, and its quarter turns): built ones can be moved in the edit mode. */
export const bedSpot = (i: number): Placement => farm.layout.beds[i] ?? { x: BEDS[i].x, z: BEDS[i].z, rot: 0 }
/** A bed's frame on the ground, half its size each way, as it stands (turned a quarter, its length runs along z). */
export const bedBox = (i: number) => (bedSpot(i).rot % 2 ? { x: BED_BOX.z, z: BED_BOX.x } : BED_BOX)

/** 0 … 1 */
/** The empty beds near (x, z) that seeds chosen by hand go into: this one, and those within reach not set to grow
 *  something else. */
export const bedsForSeeds = (index: number, crop: CropId, x: number, z: number) => bedsNear(index, 'empty', x, z).filter((i) => i === index || !farm.beds[i].fixed || farm.beds[i].fixed === crop)

export const bedProgress = (i: number) => {
  const b = farm.beds[i]
  return b.crop ? Math.min(1, b.growth / cropById(b.crop).growSeconds) : 0
}

/** Where a bed's crystals (and surprises) fly up from. */
const bedAt = (i: number) => ({ x: bedSpot(i).x, y: 0.7, z: bedSpot(i).z })

export const yieldOf = (crop: CropId) => Math.round(cropById(crop).yield * (farm.compost ? 1.5 : 1))

export function plant(i: number, crop: CropId) {
  const b = farm.beds[i]
  const def = cropById(crop)
  if (!b?.built || b.crop || !cropOpen(crop) || farm.coins < def.seedCost) return false
  farm.coins -= def.seedCost
  b.crop = crop
  b.growth = 0
  b.water = fullWater(crop) // seeds go in with a good soak
  farm.started = true
  if (!farm.planted.includes(crop)) farm.planted.push(crop)
  gainXp('plant', 1, bedAt(i))
  bump()
  save()
  return true
}

/** Plants a crop in each of these beds that is empty, as far as the coins go (seeds are bought as they go in):
 *  how many were planted. */
export function plantBeds(beds: number[], crop: CropId) {
  let n = 0
  for (const i of beds) if (plant(i, crop)) n++
  return n
}

export function water(i: number) {
  const b = farm.beds[i]
  if (!b?.crop) return false
  // XP only for a bed that needed it: under half its water
  if (b.water < fullWater(b.crop) / 2) gainXp('water', 1, bedAt(i))
  b.water = fullWater(b.crop)
  farm.stats.watered++
  bump()
  save()
  return true
}

export function harvest(i: number) {
  return harvestBeds([i])
}

/** The ripe beds near (x, z) one press harvests: this one first, then the others within reach, as many as the silo
 *  has room for (a harvest cannot half stay in its bed: a bed whose crop does not fit waits, ripe). */
export function bedsToHarvest(index: number, x: number, z: number): number[] {
  let left = room('silo')
  return bedsNear(index, 'ripe', x, z).filter((i) => {
    const n = yieldOf(farm.beds[i].crop!)
    if (n > left) return false
    left -= n
    return true
  })
}

/** A ripe bed's harvest fits in the silo. */
export const harvestFits = (i: number) => bedStage(i) === 'ripe' && yieldOf(farm.beds[i].crop!) <= room('silo')

/** Harvests every ripe bed of these (what is within reach, in one go) whose crop the silo has room for: one toast
 *  for all of it. A bed that does not fit stays ripe (the toast says the silo is full). Each bed harvested may turn
 *  up a surprise. */
export function harvestBeds(beds: number[]) {
  const got = new Map<CropId, number>()
  const found: ItemId[] = []
  let total = 0
  let full = false
  for (const i of beds) {
    const b = farm.beds[i]
    if (!b?.crop || bedStage(i) !== 'ripe') continue
    const n = yieldOf(b.crop)
    if (n > room('silo')) {
      full = true
      continue
    }
    store(b.crop, n)
    farm.stats.harvested += n
    farm.got[b.crop] += n
    got.set(b.crop, (got.get(b.crop) ?? 0) + n)
    total += n
    b.crop = null
    b.growth = 0
    b.water = 0
    const items = rollItems(1, ITEM_ODDS.harvest, random)
    gainItems(items, bedAt(i))
    gainXp('harvest', 1, bedAt(i))
    found.push(...items)
  }
  if (!total) {
    if (full) toast('The silo is full', 'silo')
    return 0
  }
  toast(`+ ${[...got].map(([crop, n]) => count(crop, n)).join(', ')}${full ? ' · the silo is full' : ''}${surpriseWords(found)}`, found[0] ?? [...got][0][0])
  bump()
  save()
  return total
}

/** Waters every bed of these that has something growing (what is within reach, in one go). */
export function waterBeds(beds: number[]) {
  let n = 0
  for (const i of beds) if (water(i)) n++
  return n
}

export function buildBed(i: number) {
  const b = farm.beds[i]
  const price = BEDS[i]?.price ?? 0
  if (!b || b.built || BEDS[i]?.expansion || !isUnlocked('bed') || farm.coins < price) return false
  farm.coins -= price
  b.built = true
  gainXp('build', 1, bedAt(i))
  toast('A new bed, ready for seeds')
  bump()
  save()
  return true
}

/** What a bed always grows, set from its gear: the action button then buys those seeds and plants them there
 *  (null: you choose the seeds each time). */
export function fixBed(i: number, crop: CropId | null) {
  const b = farm.beds[i]
  // (a crop not open yet cannot be chosen: the button would offer seeds it cannot buy)
  if (!b?.built || (crop && !cropOpen(crop))) return false
  b.fixed = crop
  bump()
  save()
  return true
}

/** The beds grow for `dt` seconds, `crops` times as fast (the harvest festival): only while the soil is wet, never past
 *  ripe; the soil dries as they do. */
export function growBeds(dt: number, crops: number) {
  for (const b of farm.beds) {
    if (!b.crop) continue
    const def = cropById(b.crop)
    if (b.growth >= def.growSeconds) continue
    // growth stops while the soil is dry; with sprinklers it never is
    const wet = farm.sprinkler ? dt : Math.min(dt, b.water)
    b.growth = Math.min(def.growSeconds, b.growth + wet * crops)
    if (!farm.sprinkler) b.water = Math.max(0, b.water - dt)
  }
}
