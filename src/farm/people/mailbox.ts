import { GATE } from '../../data/layout'
import { PARKING } from '../../data/estate'

// Where the mailbox stands (src/farm/Mailbox.tsx draws it, src/models/structures.ts is its model): on the lane side of
// the garden's fence, just west of the gate — between the gate's west post and the parking lot's east end — its door
// to the lane, where the post comes. You reach it over the fence from the garden as from the lane (as the line at the
// gate). Its flag is up while a letter waits.

/** Its post's foot (x, z), and the way its door faces (radians about y; 0: +z, the lane). */
export const MAILBOX = { x: (GATE.x - GATE.width / 2 + PARKING.x1) / 2, z: 13.48, heading: 0 } as const
/** How far you may stand from it and still read the letters (m, on the ground). */
export const MAILBOX_REACH = 1.7
/** Its height, where the box is (what you look at). */
export const MAILBOX_TOP = 1.1
