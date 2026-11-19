import { ARRIVE } from '../data/maps'
import { driveTo, farm, type Place } from '../farm/state'
import { changeMap, changingMap } from './maps'
import { setDrivePaint } from '../film/drivePaint'
import { paintTint } from '../models/car'
import { CAR_PAINTS } from '../farm/carPaints'

// A drive to the other map, as the car's talk starts it (src/farm/car): the screen goes dark, the drive's film plays
// (src/film/DriveFilm.tsx sets it from the scene's start), the drive happens in the save (`driveTo`), the other map comes
// into the scene with you out of the car where `ARRIVE` says, facing its heading, and the screen comes back (./maps.ts,
// `changeMap`: its shaders compile meanwhile).

/** A drive under way, for the film: from where, to where. */
export interface Trip {
  from: Place
  to: Place
}

/** The drive's films, the last set the one played (while the screen is dark: it resolves when the film is over, and
 *  the map changes after it). */
const films: ((trip: Trip) => Promise<void>)[] = []

/** Sets the drive's film; the returned function takes it away again (the one set before it plays again: a test's own
 *  film over the game's). */
export function setDriveFilm(play: (trip: Trip) => Promise<void>): () => void {
  films.push(play)
  return () => {
    const i = films.lastIndexOf(play)
    if (i >= 0) films.splice(i, 1)
  }
}

/** Whether you can drive there now: the other map, the house only once it is yours, and not while a drive (or a change of
 *  map) is under way. */
export const canTravel = (to: Place) => to !== farm.place && (to === 'farm' || farm.apartment.owned) && !changingMap()

/** A drive to the other map: whether you went (the trip itself goes on behind the curtain for a moment). */
export function travel(to: Place): boolean {
  if (!canTravel(to)) return false
  const trip: Trip = { from: farm.place, to }
  // the film's car in your car's paint
  setDrivePaint(paintTint(CAR_PAINTS[farm.car.worn].hex))
  void changeMap(to, ARRIVE[to], async () => {
    try {
      const film = films[films.length - 1]
      if (film) await film(trip)
    } catch (e) {
      console.warn('[travel] the drive film failed', e)
    }
    return driveTo(to)
  })
  return true
}
