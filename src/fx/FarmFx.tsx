import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { debugSet } from '../lib/debug'
import { profile } from '../lib/profile'
import { useHome } from '../store'
import { flyCoins, flyItem } from './coins'
import { flyXp } from './xp'
import { iconUrl } from '../farm/icons'
import { coinsFx, coinsToFly, effectsOn, farmFx, fxStats, takeFx, type FxRequest } from './fx'
import type { FxEngine } from './quarks'

// Plays the effects the game asks for (src/fx/fx.ts). The particle engine (three.quarks, src/fx/quarks.ts) is a chunk
// of its own, imported a moment after the game starts playing — never before the first frame — and only where effects
// are drawn at all; its shader is compiled ahead of the first burst. A burst asked for before it has arrived plays if
// it is still fresh, else it is dropped. Coins fly on the page itself, from where the buyer stands on the screen.

/** An effect asked for before the engine arrived plays if it is younger than this, else it is dropped (it would come
 *  too late to mean anything). */
const FRESH_MS = 700
/** At most this many coins in the air from one frame's sales (selling to a whole line at once). */
const MAX_COINS = 14

const at = new Vector3()
/** For screenshots and tests (`window.__home.fx.time`): how fast the particles' clock runs. */
const time = { speed: 1 }

/** Follows the player's "reduce motion" choice while the game runs. */
function useMotionOk() {
  const [ok, setOk] = useState(effectsOn)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const q = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setOk(effectsOn())
    q.addEventListener?.('change', update)
    return () => q.removeEventListener?.('change', update)
  }, [])
  return ok
}

export function FarmFx() {
  const playing = useHome((s) => s.phase === 'playing')
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const get = useThree((s) => s.get)
  const motionOk = useMotionOk()
  const engine = useRef<FxEngine | null>(null)
  const waiting = useRef<FxRequest[]>([])

  useEffect(() => {
    debugSet('fx', { stats: fxStats, time, play: farmFx, coins: coinsFx })
  }, [])

  useEffect(() => {
    if (!playing || !motionOk) return
    let gone = false
    let made: FxEngine | null = null
    // after the first frames of play, when the page is idle: the engine is never in the way of starting
    const idle = (fn: () => void) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 2500 }) : window.setTimeout(fn, 1200))
    const handle = idle(() => {
      import('./quarks')
        .then(({ createFx }) => {
          if (gone) return
          made = createFx(scene)
          engine.current = made
          fxStats.loaded = true
          return made.warm(gl, get().camera, scene)
        })
        .catch(() => {
          /* no effects this time (offline before the chunk was kept): the game plays on without them */
        })
    })
    return () => {
      gone = true
      if (typeof cancelIdleCallback === 'function') cancelIdleCallback(handle as number)
      else window.clearTimeout(handle as number)
      made?.dispose()
      engine.current = null
      fxStats.loaded = false
      fxStats.alive = 0
    }
  }, [playing, motionOk, scene, gl, get])

  useFrame(({ camera, size }, dt) => {
    const fx = engine.current
    const asked = takeFx()
    let coins = 0
    for (const r of asked) {
      if (r.kind === 'item') {
        // a surprise: from where it was found on the screen (or low in the middle, when that is behind you)
        at.set(r.x, r.y, r.z).project(camera)
        const behind = at.z > 1
        const x = behind ? size.width / 2 : Math.min(size.width - 40, Math.max(40, ((at.x + 1) / 2) * size.width))
        const y = behind ? size.height * 0.6 : Math.min(size.height - 40, Math.max(90, ((1 - at.y) / 2) * size.height))
        if (r.item && flyItem(x, y, iconUrl(r.item as Parameters<typeof iconUrl>[0]), r.order)) fxStats.items++
      } else if (r.kind === 'xp') {
        // XP: crystals from where it was gained (or low in the middle, when that is behind you) into the level chip;
        // asked for while no frame ran (the page hidden), they would only take their XP back off the bar: it is there
        if (performance.now() - r.at > FRESH_MS) continue
        at.set(r.x, r.y, r.z).project(camera)
        const behind = at.z > 1
        const x = behind ? size.width / 2 : Math.min(size.width - 30, Math.max(30, ((at.x + 1) / 2) * size.width))
        const y = behind ? size.height * 0.6 : Math.min(size.height - 30, Math.max(90, ((1 - at.y) / 2) * size.height))
        if (flyXp(x, y, r.xp ?? 1)) fxStats.xp++
      } else if (r.kind === 'coins') {
        // from the buyer's place on the screen (or the bottom edge, when they are behind you)
        at.set(r.x, r.y, r.z).project(camera)
        const behind = at.z > 1
        const x = behind ? size.width / 2 : Math.min(size.width - 20, Math.max(20, ((at.x + 1) / 2) * size.width))
        const y = behind ? size.height - 40 : Math.min(size.height - 20, Math.max(20, ((1 - at.y) / 2) * size.height))
        const n = Math.min(coinsToFly(r.coins ?? 0), MAX_COINS - coins)
        if (n > 0) {
          const flown = flyCoins(x, y, n)
          coins += flown
          if (flown) fxStats.coins++
        }
      } else if (fx) {
        fx.burst(r, profile.particles)
        fxStats.started++
      } else waiting.current.push(r)
    }
    // asked for while the engine was on its way: what is still fresh plays now
    if (waiting.current.length) {
      const now = performance.now()
      const fresh = waiting.current.filter((r) => now - r.at < FRESH_MS)
      waiting.current = fx ? [] : fresh
      if (fx)
        for (const r of fresh) {
          fx.burst(r, profile.particles)
          fxStats.started++
        }
    }
    if (fx) {
      fx.update(dt * time.speed)
      fxStats.alive = fx.alive()
    }
  })

  return null
}
