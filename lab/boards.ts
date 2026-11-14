import type { Board } from './board'
import { levelBoard } from './boards/level'
import { loadingBoard } from './boards/loading'
import { introBoard } from './boards/intro'
import { topBoard } from './boards/top'

/** Every board of the lab, newest first. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const BOARDS: Board<any>[] = [topBoard, introBoard, loadingBoard, levelBoard]
