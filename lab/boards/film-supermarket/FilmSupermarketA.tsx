import { FilmPlayer } from '../../films/Player'
import { SUPERMARKET } from '../../films/supermarket'
import type { FilmSupermarketState } from './index'
import './FilmSupermarketA.css'

// A · Under New Management: the film played from the moment its state names, on the game's own models. Its sound is
// off when the lab runs slower (?speed): the music would not keep time with the picture.

// the frame's speed, from its address: sound only at full speed
const slow = Number(new URLSearchParams(location.search).get('speed')) || 1

export function FilmSupermarketA({ s, onClose }: { s: FilmSupermarketState; onClose: () => void }) {
  return (
    <div className="v-film-supermarket-a">
      <FilmPlayer film={SUPERMARKET} from={s.from} sound={slow === 1} onClose={onClose} />
    </div>
  )
}
