import { FilmPlayer } from '../../films/Player'
import { BUCKET } from '../../../src/film/bucket'
import type { FilmMilkBucketState } from './index'
import './FilmMilkBucketA.css'

// A · Out of Reach: the film played from the moment its state names, on the game's own models, with the game's own
// overlay and end card (src/ui/Film.tsx). Its sound is off when the lab runs slower (?speed): the music would not keep
// time with the picture.

const slow = Number(new URLSearchParams(location.search).get('speed')) || 1

export function FilmMilkBucketA({ s, onClose }: { s: FilmMilkBucketState; onClose: () => void }) {
  return (
    <div className="v-film-milk-bucket-a">
      <FilmPlayer film={BUCKET} from={s.from} xp={s.xp} sound={slow === 1} onClose={onClose} />
    </div>
  )
}
