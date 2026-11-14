import { m } from 'motion/react'
import introTall from '../../map/intro-upright.jpg'
import introWide from '../../map/intro-sideways.jpg'
import backTall from '../../map/intro-upright-3.jpg'
import backWide from '../../map/intro-sideways-3.jpg'
import savesTall from '../../map/saves-upright.jpg'
import savesWide from '../../map/saves-sideways.jpg'
import { farmOf, several, type IntroState } from './data'
import { useWide } from './shared'
import './Today.css'

// Today: the game's Intro cannot be drawn without the game round it (the loader, the farm's store, the graphics), so
// "today" is a picture of it from the game (lab/map), in the state's closest shot: a new player, a returning one, the
// saves open. A picture: nothing in it can be pressed.

const SHOTS: Record<string, [string, string]> = { new: [introTall, introWide], back: [backTall, backWide], many: [savesTall, savesWide] }

export function Today({ s }: { s: IntroState }) {
  const wide = useWide()
  const [tall, side] = SHOTS[several(s) ? 'many' : farmOf(s).played ? 'back' : 'new']
  return (
    <m.div className="v-intro-today" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <img src={wide ? side : tall} alt="The opening screen as the game has it today (a picture)" />
      <span className="v-intro-today-tag">a picture of the game</span>
    </m.div>
  )
}
