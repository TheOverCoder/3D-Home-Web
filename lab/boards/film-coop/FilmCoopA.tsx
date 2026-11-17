import { useMemo } from 'react'
import { FilmPlayer } from '../../films/Player'
import { coopFilm } from '../../../src/film/coop'
import type { FilmCoopState } from './index'
import './FilmCoopA.css'

// A · One Nest Each: the film played from the moment its state names, in the tool's style its state names (the skin the
// player chose: a when it names none), on the game's own models, with the game's own overlay and end card
// (src/ui/Film.tsx). Its sound is off when the lab runs slower (?speed): the music would not keep time with the picture.

const slow = Number(new URLSearchParams(location.search).get('speed')) || 1

export function FilmCoopA({ s, onClose }: { s: FilmCoopState; onClose: () => void }) {
  const film = useMemo(() => coopFilm(s.style ?? 'a'), [s.style])
  return (
    <div className="v-film-coop-a">
      <FilmPlayer film={film} from={s.from} xp={s.xp} sound={slow === 1} onClose={onClose} />
    </div>
  )
}
