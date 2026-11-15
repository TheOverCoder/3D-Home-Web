import type { Board } from './board'
import { levelBoard } from './boards/level'
import { loadingBoard } from './boards/loading'
import { introBoard } from './boards/intro'
import { topBoard } from './boards/top'
import { filmSupermarketBoard } from './boards/film-supermarket'
import { goalsBoard } from './boards/goals'
import { ordersBoard } from './boards/orders'
import { savesBoard } from './boards/saves'
import { woodsBoard } from './boards/woods'
import { scarecrowBoard } from './boards/scarecrow'

/** Every board of the lab, newest first. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const BOARDS: Board<any>[] = [scarecrowBoard, woodsBoard, savesBoard, ordersBoard, goalsBoard, filmSupermarketBoard, topBoard, introBoard, loadingBoard, levelBoard]
