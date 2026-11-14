import { m } from 'motion/react'
import up from '../../map/loading-upright.jpg'
import side from '../../map/loading-sideways.jpg'
import { useWide } from './load'
import './LoadingToday.css'

// Today: a picture of the game's loading screen as it is now (lab/map, from the game itself). The game's LoadStatus reads
// the game's stores (the loader, the scene's count), so the lab shows its picture rather than the component.

export function LoadingToday() {
  const wide = useWide()
  return (
    <m.div className="v-loading-today" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <img src={wide ? side : up} alt="The loading screen today" />
    </m.div>
  )
}
