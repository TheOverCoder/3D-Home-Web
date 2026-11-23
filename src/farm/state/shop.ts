import { clock } from '../../lib/time'
import { arrivalEvery, BEDS, EXPANSIONS, fullHerd, isExpansion, mostAnimals, PACE_LEVELS, PRODUCERS, QUEUE_LEVELS, queuePlaces, UPGRADES, type UpgradeId } from '../data'
import { bedHome, canBuyParcel, canPlace, canPlaceBed, PARCELS, PLACES, snap, type Fit, type ParcelId, type PlaceId, type Placement } from '../layout'
import { herdUnlock } from '../unlocks'
import { bump, farm, isUnlocked, lockOf, placesAway, save, toast } from './core'
import { gainXp } from './levels'
import { addAnimal, animalName, animals } from './producers'

// The farm shop's upgrades (UPGRADES), the fields for sale and the layout: moving the places and the beds.

/** A countdown as the game writes it (src/lib/time.ts): for the labels and panels that read it from here. */
export { clock as clockText }

/** Steps bought of an upgrade that comes one step at a time (0 for the others). */
export const upgradeLevel = (u: UpgradeId) => (u === 'queue' ? farm.queueLevel : u === 'pace' ? farm.paceLevel : 0)

/** What the next step of an upgrade costs. */
export function upgradePrice(u: UpgradeId) {
  const def = UPGRADES.find((x) => x.id === u)!
  return def.price + (def.priceStep ?? 0) * upgradeLevel(u)
}

/** The herd an upgrade adds an animal to (another hen, cow or sheep). */
const herdOf = (u: UpgradeId) => UPGRADES.find((x) => x.id === u)?.herd

/** The level the next step of an upgrade opens at (null: open): its own row, and for an animal past its herd full, that
 *  animal's (`herd:cows:4`, src/farm/unlocks.ts). */
export function upgradeLock(u: UpgradeId): number | null {
  const own = lockOf(`upgrade:${u}`)
  const herd = herdOf(u)
  if (own !== null || !herd) return own
  const n = animals(herd) + 1
  return n > fullHerd(herd) && n <= mostAnimals(herd) ? lockOf(herdUnlock(herd, n)) : null
}

/** The meadow a piece of land with beds lies on, while it is not the farm's yet (null: none, or it is yours). */
export function landFirst(u: UpgradeId) {
  const land = isExpansion(u) ? EXPANSIONS[u].land : undefined
  return land && !farm.layout.land.includes(land) ? land : null
}

/** Bought (all of it, for an upgrade that comes in steps). */
export function owned(u: UpgradeId) {
  const herd = herdOf(u)
  if (herd) return animals(herd) >= mostAnimals(herd)
  if (isExpansion(u)) return farm.expansions[u]
  switch (u) {
    case 'sprinkler':
      return farm.sprinkler
    case 'compost':
      return farm.compost
    case 'queue':
      return farm.queueLevel >= QUEUE_LEVELS
    case 'pace':
      return farm.paceLevel >= PACE_LEVELS
    default:
      return false
  }
}

export const placesInLine = () => queuePlaces(farm.queueLevel)
export const arrivalSeconds = () => arrivalEvery(farm.paceLevel)

export function buy(id: UpgradeId) {
  const u = UPGRADES.find((x) => x.id === id)
  const price = upgradePrice(id)
  if (!u || owned(id) || upgradeLock(id) !== null || farm.coins < price) return false
  // a field of beds on a meadow: the meadow first (the edit mode sells it)
  const land = landFirst(id)
  if (land) {
    toast(`Buy the ${PARCELS[land].name.toLowerCase()} first: its beds lie on it`)
    return false
  }
  farm.coins -= price
  let note = `${u.name}: done`
  if (u.herd) {
    addAnimal(u.herd)
    // a new cow or sheep comes with her name ("Bella joins the herd"); another hen is just that
    const name = animalName(u.herd, animals(u.herd) - 1)
    if (name) note = `${name} joins ${PRODUCERS[u.herd].herd?.joins}`
  } else if (id === 'sprinkler') farm.sprinkler = true
  else if (id === 'compost') farm.compost = true
  else if (id === 'queue') {
    farm.queueLevel = Math.min(QUEUE_LEVELS, farm.queueLevel + 1)
    note = `The line at the gate has room for ${placesInLine()}`
  } else if (id === 'pace') {
    farm.paceLevel = Math.min(PACE_LEVELS, farm.paceLevel + 1)
    farm.nextVisitorIn = Math.min(farm.nextVisitorIn, arrivalSeconds())
    note = `A buyer every ${clock(arrivalSeconds())}`
  } else if (isExpansion(id)) {
    farm.expansions[id] = true
    BEDS.forEach((def, i) => {
      if (def.expansion === id) farm.beds[i].built = true
    })
    note = `${EXPANSIONS[id].name}: the beds are in`
  }
  gainXp('build')
  toast(note)
  bump()
  save()
  return true
}

/** Buys a field next to your land: the hedge moves out round it, and there is room to move things onto. */
export function buyLand(id: ParcelId) {
  const p = PARCELS[id]
  if (!p || !canBuyParcel(farm.layout, id) || !isUnlocked(`parcel:${id}`) || farm.coins < p.price) return false
  farm.coins -= p.price
  farm.layout = { ...farm.layout, land: [...farm.layout.land, id] }
  gainXp('build')
  toast(`${p.name}: it is yours`)
  bump()
  save()
  return true
}

/** Moves a whole place (the hen run, the pasture, the fold, a tree, a machine) to a free spot on your land, on the
 *  half-metre grid (a machine not bought is not on the farm to move). */
export function movePlace(id: PlaceId, to: Placement): Fit {
  if (placesAway().includes(id)) return { ok: false, reason: 'Not on the farm' }
  const p = { x: snap(to.x), z: snap(to.z), rot: ((Math.round(to.rot) % 4) + 4) % 4 }
  const fit = canPlace(farm.layout, id, p)
  if (!fit.ok) return fit
  farm.layout = { ...farm.layout, places: { ...farm.layout.places, [id]: p } }
  bump()
  save()
  return fit
}

/** Puts a place back where it stood on a new farm (if that spot is free). */
export const sendHome = (id: PlaceId) => movePlace(id, PLACES[id].home)

export const quarter = (rot: number) => ((Math.round(rot) % 4) + 4) % 4

/** Moves (or turns) a built bed, with what grows in it, to a free spot on your land, on the half-metre grid; one not
 *  built yet stays where it was staked out. */
export function moveBed(i: number, to: Placement): Fit {
  if (!farm.beds[i]?.built) return { ok: false, reason: 'Build it first' }
  const p = { x: snap(to.x), z: snap(to.z), rot: quarter(to.rot) }
  const fit = canPlaceBed(farm.layout, i, p)
  if (!fit.ok) return fit
  farm.layout = { ...farm.layout, beds: farm.layout.beds.map((b, k) => (k === i ? p : b)) }
  bump()
  save()
  return fit
}

/** Puts a bed back where it was staked out (if that spot is free). */
export function sendBedHome(i: number): Fit {
  const home = bedHome(i)
  if (!farm.beds[i]?.built) return { ok: false, reason: 'Build it first' }
  const fit = canPlaceBed(farm.layout, i, home)
  if (!fit.ok) return fit
  farm.layout = { ...farm.layout, beds: farm.layout.beds.map((b, k) => (k === i ? home : b)) }
  bump()
  save()
  return fit
}
