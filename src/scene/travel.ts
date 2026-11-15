import { driveTo, type Place } from '../farm/state'

/** A drive to the other map, as the car's talk starts it: whether you went. For now only the move itself (`driveTo`);
 *  the trip round it (the screen going out, the map changing, you put out of the car at the other end, the drive's
 *  film) is being built here, and the car keeps calling this. */
export function travel(to: Place): boolean {
  return driveTo(to)
}
