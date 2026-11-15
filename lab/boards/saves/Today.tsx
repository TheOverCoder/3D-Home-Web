import { m } from 'motion/react'
import { useWide } from '../intro/shared'
import tall from '../../map/saves-upright.jpg'
import wide from '../../map/saves-sideways.jpg'
import '../intro/Today.css'

// Today: the game's SavesPanel reads the browser's saves itself, so "today" is a picture of it from the game (lab/map).

export function Today() {
  const side = useWide()
  return (
    <m.div className="v-intro-today" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <img src={side ? wide : tall} alt="The saved farms as the game has them today (a picture)" />
      <span className="v-intro-today-tag">a picture of the game</span>
    </m.div>
  )
}
