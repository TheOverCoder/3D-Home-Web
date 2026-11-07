import { useEffect, useState, type CSSProperties } from 'react'
import { Joystick, VirtualButton } from 'ecctrl/input'
import { coarsePointer } from '../lib/device'
import { busy, useHome } from '../store'

const PAD = 14 // gap to the screen edge, on top of the safe area (notches, gesture bar)

/** Control sizes follow the screen: comfortable for a thumb, never a quarter of a small landscape screen. */
function measure() {
  const short = Math.min(window.innerWidth, window.innerHeight)
  const stick = Math.round(Math.min(164, Math.max(112, short * 0.36))) // the joystick's touch area
  const button = Math.round(Math.min(68, Math.max(54, short * 0.16)))
  return { stick, button }
}

/**
 * On-screen joystick and jump button — only on touch devices; the player reads their stores each frame.
 * Interacting is the action label itself (the HUD prompt above the stick): it only appears when there is
 * something to open, toggle or pick up, so a permanent extra button would just cover the view.
 */
export function TouchControls() {
  const phase = useHome((s) => s.phase)
  const occupied = useHome(busy)
  const [size, setSize] = useState(measure)

  useEffect(() => {
    if (!coarsePointer) return
    const update = () => setSize(measure())
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  // the HUD keeps clear of the controls (styles.css reads these)
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--touch-stick', `${size.stick}px`)
    root.setProperty('--touch-pad', `${PAD}px`)
  }, [size])

  if (!coarsePointer || phase !== 'playing' || occupied) return null

  const ring = Math.round(size.stick * 0.62)
  const knob = Math.round(ring * 0.48)
  const edge = (side: 'left' | 'right'): CSSProperties => ({
    [side]: `calc(${PAD}px + env(safe-area-inset-${side}))`,
    bottom: `calc(${PAD}px + env(safe-area-inset-bottom))`,
  })

  return (
    <>
      <Joystick
        joystickMaxRadius={ring / 2}
        joystickWrapperStyle={{ ...edge('left'), width: size.stick, height: size.stick }}
        joystickBaseStyle={{
          width: ring,
          height: ring,
          background: 'radial-gradient(circle, rgba(10, 13, 18, 0.12), rgba(10, 13, 18, 0.34))',
          border: '1.5px solid rgba(255, 255, 255, 0.6)',
          boxShadow: '0 4px 18px rgba(0, 0, 0, 0.28)',
        }}
        joystickKnobStyle={{
          width: knob,
          height: knob,
          background: 'rgba(255, 255, 255, 0.86)',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.35)',
        }}
      />
      <VirtualButton
        id="jump"
        label="JUMP"
        buttonWrapperStyle={{
          ...edge('right'),
          width: size.button + 18,
          height: size.button + 18,
          background: 'transparent',
        }}
        buttonCapStyle={{
          width: size.button,
          height: size.button,
          background: 'rgba(12, 15, 21, 0.55)',
          border: '1.5px solid rgba(255, 255, 255, 0.55)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.12em',
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        }}
      />
    </>
  )
}
