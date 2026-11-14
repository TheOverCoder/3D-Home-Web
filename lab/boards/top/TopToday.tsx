import type { TopState } from './parts'
import up from '../../map/top-upright.jpg'
import side from '../../map/top-sideways.jpg'
import up2 from '../../map/top-upright-2.jpg'
import side2 from '../../map/top-sideways-2.jpg'
import './TopToday.css'

// Today: the game's top reads the farm (its chips, the compass, the corner buttons), so it cannot be drawn alone here.
// This is a picture of it from the game (lab/map), the whole screen; "only the compass" shows that view's picture.

export function TopToday({ s }: { s: TopState }) {
  const compass = s.hud !== 'all'
  return (
    <picture className="v-top-today">
      <source media="(orientation: landscape)" srcSet={compass ? side2 : side} />
      <img src={compass ? up2 : up} alt="The top of the screen in the game today (a picture)" />
    </picture>
  )
}
