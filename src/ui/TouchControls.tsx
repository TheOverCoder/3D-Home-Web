import { Joystick, VirtualButton } from 'ecctrl/input'
import { useHome } from '../store'

const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

/** On-screen joystick and buttons — only on touch devices. The player reads their stores each frame. */
export function TouchControls() {
  const phase = useHome((s) => s.phase)
  const screen = useHome((s) => s.screen)
  if (!coarse || phase !== 'playing' || screen) return null
  return (
    <>
      <Joystick joystickWrapperStyle={{ left: 12, bottom: 20 }} />
      <VirtualButton id="jump" label="JUMP" buttonWrapperStyle={{ right: 20, bottom: 36, width: 76, height: 76 }} buttonCapStyle={{ width: 58, height: 58 }} />
      <VirtualButton id="interact" label="E" buttonWrapperStyle={{ right: 108, bottom: 96, width: 76, height: 76 }} buttonCapStyle={{ width: 58, height: 58, fontSize: 20 }} />
    </>
  )
}
