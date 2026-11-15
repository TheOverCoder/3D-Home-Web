import { ARRIVE } from '../data/maps'
import { driveTo, farm, type Place } from '../farm/state'
import { changeMap, changingMap } from './maps'

// A drive to the other map, as the car's talk starts it (src/farm/car): the screen goes dark, the drive happens (in the
// save, `driveTo`; and, in a later phase, its film), the other map comes into the scene with you out of the car where
// `ARRIVE` says, facing its heading, and the screen comes back (./maps.ts, `changeMap`: its shaders compile meanwhile).

/** A drive under way, for the film: from where, to where. */
export interface Trip {
  from: Place
  to: Place
}

/** The drive's film, played while the screen is dark (none yet: a later phase sets it). It resolves when the film is
 *  over; the map changes after it. */
let film: ((trip: Trip) => Promise<void>) | null = null

/** Sets the drive's film (null: none); the returned function takes it away again. */
export function setDriveFilm(play: (trip: Trip) => Promise<void>): () => void {
  film = play
  return () => {
    if (film === play) film = null
  }
}

/** Whether you can drive there now: the other map, the house only once it is yours, and not while a drive (or a change of
 *  map) is under way. */
export const canTravel = (to: Place) => to !== farm.place && (to === 'farm' || farm.apartment.owned) && !changingMap()

/** A drive to the other map: whether you went (the trip itself goes on behind the curtain for a moment). */
export function travel(to: Place): boolean {
  if (!canTravel(to)) return false
  const trip: Trip = { from: farm.place, to }
  void changeMap(to, ARRIVE[to], async () => {
    try {
      if (film) await film(trip)
    } catch (e) {
      console.warn('[travel] the drive film failed', e)
    }
    return driveTo(to)
  })
  return true
}
