import type { FilmId } from './films'
import type { Film } from './format'
import { BUCKET } from './bucket'
import { COOP } from './coop'
import { SHEARS } from './shears'
import { SUPERMARKET } from './supermarket'

// The heavy part of a moment's film (./StoryFilm.tsx loads it the first time one plays, so the game's start carries
// none of it): the films themselves, their clock and sound, and the stage they play on.

export { FilmRun } from './run'
export { FilmStage } from './stage3d'

/** The film each moment opens (./films.ts): the tools' in their first style, as the user chose them at purchase. */
export const FILMS: Record<FilmId, Film> = { shop: SUPERMARKET, coop: COOP, bucket: BUCKET, shears: SHEARS }
