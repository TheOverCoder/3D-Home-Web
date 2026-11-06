import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { useHome } from '../store'

// The view eases onto an opened screen (Player.tsx); by this time it has settled.
const SETTLE_MS = 1400

/**
 * While a content panel is open, the house sits still behind a blurred backdrop. Keep its last frame on
 * screen and stop rendering it, so the panel's own animations get the whole machine (and laptops stay
 * cool). Rendering resumes the moment the panel closes, so the view eases back exactly as before.
 *
 * Anything that clears the canvas while paused gets one fresh frame, or the backdrop would turn black: a resize
 * (a phone's address bar sliding away, a rotation) and coming back from another app or tab.
 */
export function RenderPause() {
  const setFrameloop = useThree((s) => s.setFrameloop)
  const get = useThree((s) => s.get)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  const paused = useRef(false)

  useEffect(() => {
    let timer: number | undefined
    // one frame at the current clock time: nothing moves, the picture is just drawn again
    const redraw = () => {
      const s = get()
      if (paused.current) s.advance(s.clock.elapsedTime)
    }
    const apply = (screen: string | null) => {
      window.clearTimeout(timer)
      if (screen)
        timer = window.setTimeout(() => {
          paused.current = true
          setFrameloop('never')
        }, SETTLE_MS)
      else {
        paused.current = false
        setFrameloop('always')
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') redraw()
    }
    apply(useHome.getState().screen)
    const unsubscribe = useHome.subscribe((s, prev) => {
      if (s.screen !== prev.screen) apply(s.screen)
    })
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onVisible)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onVisible)
      window.clearTimeout(timer)
      paused.current = false
      setFrameloop('always')
    }
  }, [setFrameloop, get])

  useEffect(() => {
    if (!paused.current) return
    const s = get()
    s.advance(s.clock.elapsedTime)
  }, [size, dpr, get])

  return null
}
