import type { Board } from './board'
import { levelBoard } from './boards/level'

/** Every board of the lab, newest first. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const BOARDS: Board<any>[] = [levelBoard]
