import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useHome } from '../store'

// The view eases onto an opened screen (Player.tsx); by this time it has settled.
const SETTLE_MS = 1400

/**
 * While a content panel is open, the house sits still behind a blurred backdrop. Keep its last frame on
 * screen and stop rendering it, so the panel's own animations get the whole machine (and laptops stay
 * cool). Rendering resumes the moment the panel closes, so the view eases back exactly as before.
 */
export function RenderPause() {
  const setFrameloop = useThree((s) => s.setFrameloop)

  useEffect(() => {
    let timer: number | undefined
    const apply = (screen: string | null) => {
      window.clearTimeout(timer)
      if (screen) timer = window.setTimeout(() => setFrameloop('never'), SETTLE_MS)
      else setFrameloop('always')
    }
    apply(useHome.getState().screen)
    const unsubscribe = useHome.subscribe((s, prev) => {
      if (s.screen !== prev.screen) apply(s.screen)
    })
    return () => {
      unsubscribe()
      window.clearTimeout(timer)
      setFrameloop('always')
    }
  }, [setFrameloop])

  return null
}
