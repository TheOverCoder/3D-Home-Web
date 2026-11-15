import { m } from 'motion/react'
import { useWide } from '../intro/shared'
import tall from '../../map/goals-upright.jpg'
import wide from '../../map/goals-sideways.jpg'
import '../intro/Today.css'

// Today: the game's GoalsPanel reads the farm itself (it is not yet a component fed with data), so "today" is a picture
// of it from the game (lab/map). A picture: nothing in it can be pressed.

export function Today() {
  const side = useWide()
  return (
    <m.div className="v-intro-today" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <img src={side ? wide : tall} alt="The goals board as the game has it today (a picture)" />
      <span className="v-intro-today-tag">a picture of the game</span>
    </m.div>
  )
}
