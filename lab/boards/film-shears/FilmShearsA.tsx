import { FilmPlayer } from '../../films/Player'
import { SHEARS } from '../../../src/film/shears'
import type { FilmShearsState } from './index'
import './FilmShearsA.css'

// A · Next!: the film played from the moment its state names, on the game's own models, with the game's own overlay
// and end card (src/ui/Film.tsx). Its sound is off when the lab runs slower (?speed): the music would not keep time
// with the picture.

const slow = Number(new URLSearchParams(location.search).get('speed')) || 1

export function FilmShearsA({ s, onClose }: { s: FilmShearsState; onClose: () => void }) {
  return (
    <div className="v-film-shears-a">
      <FilmPlayer film={SHEARS} from={s.from} xp={s.xp} sound={slow === 1} onClose={onClose} />
    </div>
  )
}
