import { env } from '../../env'
import { FilmPlayer } from '../../films/Player'
import { SUPERMARKET } from '../../films/supermarket'
import type { FilmSupermarketState } from './index'
import './FilmSupermarketA.css'

// A · Under New Management: the film played from the moment its state names, on the game's own models. Its sound is
// off when the lab runs slower (?speed): the music would not keep time with the picture.

export function FilmSupermarketA({ s, onClose }: { s: FilmSupermarketState; onClose: () => void }) {
  return (
    <div className="v-film-supermarket-a">
      <FilmPlayer film={SUPERMARKET} from={s.from} sound={env.speed === 1} onClose={onClose} />
    </div>
  )
}
