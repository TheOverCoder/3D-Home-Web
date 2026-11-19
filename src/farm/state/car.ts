import { CAR_PAINTS, freshCar, isPaintId, sanitizeCar, type CarRecord, type PaintId } from '../carPaints'
import { personLook } from '../../data/people'
import { SELLER_SPOT } from '../../data/dealer'
import { isOpen, untilOpen } from '../day'
import { walker } from '../script'
import { bump, farm, isUnlocked, save, type Person, type Walking } from './core'
import { gainXp } from './levels'

// Your car's paints on the farm (src/farm/carPaints.ts): bought once at the dealer (`build` XP, as a tool's skin), worn
// for free (and changed back for free: no XP). Kept in the save as `farm.car`.

declare module './core' {
  interface FarmData {
    /** your car (src/farm/carPaints.ts): the paints it owns and the one it wears */
    car: CarRecord
  }
}

export const carFresh = freshCar
export const savedCar = sanitizeCar

/** Why a paint cannot be bought now (null: it can): owned already, not open yet at the farm's level, or short of coins. */
export function paintProblem(id: PaintId): 'owned' | 'locked' | 'coins' | null {
  if (farm.car.owned.includes(id)) return 'owned'
  if (!isUnlocked(`paint:${id}`)) return 'locked'
  if (!(farm.coins >= CAR_PAINTS[id].price)) return 'coins'
  return null
}

/** Buys a paint at its price (its card asked first) and puts it on: whether it was bought. */
export function buyPaint(id: PaintId): boolean {
  if (!isPaintId(id) || paintProblem(id) !== null) return false
  farm.coins -= CAR_PAINTS[id].price
  farm.car = { owned: [...farm.car.owned, id].sort((a, b) => Object.keys(CAR_PAINTS).indexOf(a) - Object.keys(CAR_PAINTS).indexOf(b)) as PaintId[], worn: id }
  gainXp('build')
  bump()
  save()
  return true
}

/** Puts on a paint the car owns (free): whether what it wears changed. */
export function wearPaint(id: PaintId): boolean {
  if (!isPaintId(id) || !farm.car.owned.includes(id) || farm.car.worn === id) return false
  farm.car = { ...farm.car, worn: id }
  bump()
  save()
  return true
}

/** The paint your car wears now (its colour: CAR_PAINTS). */
export const carPaintNow = (): PaintId => farm.car.worn

// ───────────────────────────── the dealer's hours and its seller ─────────────────────────────

const SELLER_ID = -4
const SELLER_DRESS = personLook('seller')!
const sellerStanding: Person = { id: SELLER_ID, ...walker(SELLER_SPOT.x, SELLER_SPOT.z, SELLER_SPOT.heading, []), look: SELLER_DRESS }

/** The car dealer is open (HOURS.dealer: 9:00 to 17:00): its door opens for you, the seller behind the desk. */
export const dealerOpen = () => isOpen('dealer', farm.day.t)
/** The seconds until it opens (0 while it is open). */
export const dealerOpensIn = () => untilOpen('dealer', farm.day.t)
/** The seller behind the desk in the dealer's hours (drawn with the market's people: src/farm/marketPeople.ts). */
export const sellerNow = (): Walking | null => (dealerOpen() ? sellerStanding : null)
