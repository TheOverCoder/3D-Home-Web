import type { FilmId } from './films'
import type { Film } from './format'
import { SUPERMARKET } from './supermarket'

// The heavy part of a moment's film (./StoryFilm.tsx loads it the first time one plays, so the game's start carries
// none of it): the films themselves, their clock and sound, and the stage they play on.

export { FilmRun } from './run'
export { FilmStage } from './stage3d'

/** The film each moment opens (./films.ts). */
export const FILMS: Record<FilmId, Film> = { shop: SUPERMARKET }
