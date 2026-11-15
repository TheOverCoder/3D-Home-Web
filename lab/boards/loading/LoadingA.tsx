import { m, useReducedMotion } from 'motion/react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { art } from '../../../src/ui/art'
import { burst } from '../../../src/ui/burst'
import { SPRING } from '../../../src/ui/motion'
import { Chrome, Logo, type Away } from './Chrome'
import { loadView, useLive, useTip, useWide, type LoadingState } from './load'
import './LoadingA.css'

// A · the island, round 3: the farm on a stage is now a real little world in 3D — a low-poly island floating and
// turning slowly over a warm sky, the house building itself on it as the game loads (floor, walls, roof, door and
// windows, chimney and smoke, then the trees, a bed and the fence), each piece dropping in and squashing as it lands.
// Clouds drift round it, specks of light rise, the sun climbs behind it with the bar. Its moment: ready, the lamps come
// on in the windows, the island hops, the sun's rays open and a burst of confetti; Play takes the tip's place. A tap on
// the island makes it hop while you wait. The 3D is loaded after the page (lazy): the bar never waits for it.

const Island3D = lazy(() => import('./Island3D').then((x) => ({ default: x.Island3D })))

export function LoadingA({ s: start, onPlay, away }: { s: LoadingState; onPlay: () => void; away?: Away }) {
  const s = useLive(start)
  const v = loadView(s)
  const wide = useWide()
  const still = useReducedMotion()
  const [tip] = useTip()
  const [hop, setHop] = useState(0)
  const stage = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!v.ready) return
    const t = setTimeout(() => {
      setHop((n) => n + 1)
      if (stage.current && !still) burst(stage.current, { count: 70, spread: 90, power: 32 })
    }, 280)
    return () => clearTimeout(t)
  }, [v.ready, still])
  const enter = (i: number) => ({ initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { ...SPRING.sheet, delay: 0.08 + i * 0.06 } })
  return (
    <m.div
      className={`v-loading-a${wide ? ' wide' : ''}${v.ready ? ' ready' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.08, transition: { duration: 0.32, ease: [0.4, 0, 1, 1] } }}
      transition={{ duration: 0.22 }}
    >
      {/* the sky: it warms as the sun climbs with the bar */}
      <span className="la-sky" aria-hidden="true" style={{ opacity: 0.35 + v.p * 0.65 }} />
      <m.header className="la-logo" {...enter(0)}>
        <Logo />
        <p>A cosy house and farm</p>
      </m.header>
      <div className="la-stage" ref={stage}>
        <m.span className="la-rays" aria-hidden="true" initial={false} animate={{ opacity: v.ready ? 1 : 0, scale: v.ready ? 1 : 0.6 }} transition={SPRING.soft} />
        <m.img className="art la-sun" src={art('sun')} alt="" initial={{ y: 80, opacity: 0 }} animate={{ y: 60 - v.p * 110, opacity: 1 }} transition={{ type: 'spring', stiffness: 40, damping: 16 }} />
        <Suspense fallback={<img className="art la-wait" src={art('house-with-garden')} alt="" />}>
          <Island3D p={v.p} ready={v.ready} hop={hop} onTap={() => setHop((n) => n + 1)} />
        </Suspense>
      </div>
      <m.div className="la-low" {...enter(2)}>
        <Chrome v={v} tip={tip} onPlay={onPlay} tone="card" away={away} />
      </m.div>
    </m.div>
  )
}
