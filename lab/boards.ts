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
import { newsBoard } from './boards/news'
import { dailyBoard } from './boards/daily'
import { unlocksBoard } from './boards/unlocks'
import { firstStepsBoard } from './boards/first-steps'
import { tools3dBoard } from './boards/tools-3d'

/** Every board of the lab, newest first. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const BOARDS: Board<any>[] = [
  tools3dBoard,
  firstStepsBoard,
  unlocksBoard,
  dailyBoard,
  newsBoard,
  scarecrowBoard,
  woodsBoard,
  savesBoard,
  ordersBoard,
  goalsBoard,
  filmSupermarketBoard,
  topBoard,
  introBoard,
  loadingBoard,
  levelBoard,
]
