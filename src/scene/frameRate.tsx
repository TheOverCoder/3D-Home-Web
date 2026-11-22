import { useEffect, useState } from 'react'
import { useFrame, useThree, type RootState } from '@react-three/fiber'
import { useSettings } from '../settings'

// The frames a second the player chose (Settings → Picture → Frame rate): 60 by default, the screen's own pace (the
// loop draws every frame of the screen); 30 to save the battery and keep a steady pace on a phone that cannot hold 60
// (the loop draws on demand, and the pacer asks for every other frame of the screen). Whatever holds the frames still
// for a while (a change of map, the warm-up, a film) lets them go again with `runFrames`, so the choice holds after it.

export type FrameRate = 60 | 30

/** The loop a rate runs on. */
export const loopFor = (rate: FrameRate): 'always' | 'demand' => (rate === 30 ? 'demand' : 'always')

/** Whether a frame is due at `now` (ms) for `rate`, the last asked for at `last`: a few ms early is on time (the
 *  screen's frames come at their own pace, a little either side). */
export const frameDue = (now: number, last: number, rate: number) => now - last >= 1000 / rate - 4

/** The frames going again after a hold, at the rate the player chose. */
export function runFrames(setFrameloop: RootState['setFrameloop']) {
  setFrameloop(loopFor(useSettings.getState().frameRate))
}

/** In the canvas: keeps the loop at the chosen rate (switched at once, unless something holds the frames still), and
 *  at 30 asks for a frame every other frame of the screen. */
export function FramePacer() {
  const rate = useSettings((s) => s.frameRate)
  const get = useThree((s) => s.get)
  useEffect(() => {
    const s = get()
    if (s.frameloop !== 'never') s.setFrameloop(loopFor(rate))
    if (rate !== 30) return
    let raf = 0
    let last = 0
    const tick = (now: number) => {
      const st = get()
      if (st.frameloop === 'demand' && frameDue(now, last, rate)) {
        last = now
        st.invalidate()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [rate, get])
  return null
}

// `?fps` in the address (any page, a player's too: it changes nothing else): the frames a second really drawn, in a
// small readout at the bottom of the screen, to measure a phone as it plays.

/** Whether the readout was asked for. */
export const fpsAsked = typeof location !== 'undefined' && new URLSearchParams(location.search).has('fps')

/** The frames drawn since the page opened (counted in the canvas by FrameCount). */
const drawn = { frames: 0 }

/** In the canvas, with `?fps`: counts each frame drawn. */
export function FrameCount() {
  useFrame(() => {
    drawn.frames++
  })
  return null
}

/** The readout: the frames drawn over the last half second, as a rate. */
export function FpsMeter() {
  const [fps, setFps] = useState(0)
  useEffect(() => {
    let from = drawn.frames
    let at = performance.now()
    const t = setInterval(() => {
      const now = performance.now()
      setFps(Math.round(((drawn.frames - from) * 1000) / (now - at)))
      from = drawn.frames
      at = now
    }, 500)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="fps-meter" aria-hidden="true">
      {fps} fps
    </div>
  )
}
