import { m, useReducedMotion } from 'motion/react'
import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from 'react'
import { art } from '../../../src/ui/art'
import { burst } from '../../../src/ui/burst'
import { SPRING } from '../../../src/ui/motion'
import { Chrome, Logo } from './Chrome'
import { loadView, useLive, useTip, useWide, type LoadingState } from './load'
import './LoadingF.css'

// F · a little planet at sunrise: the farm on a tiny round world in 3D, spinning slowly in space, and the loading is the
// night turning into day. At the start it is night — a deep sky full of twinkling stars, the moon up, cool light on the
// planet; as the bar fills the sun comes up round it, the stars fade, the sky warms through dawn's colours to day, and
// the light on the farm turns warm. Its moment: ready, the sun stands high, the windmill hurries, the planet hops, the
// sky blooms gold and confetti flies; Play. A tap on the planet makes it hop. The 3D is loaded after the page (lazy).

const Planet3D = lazy(() => import('./Planet3D').then((x) => ({ default: x.Planet3D })))

const STARS = Array.from({ length: 34 }, (_, i) => ({ x: (i * 37.3) % 100, y: (i * 61.7) % 70, s: 1 + (i % 3), d: (i * 0.37) % 3 }))

export function LoadingF({ s: start, onPlay }: { s: LoadingState; onPlay: () => void }) {
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
      if (stage.current && !still) burst(stage.current, { count: 70, spread: 100, power: 32 })
    }, 600)
    return () => clearTimeout(t)
  }, [v.ready, still])
  const day = v.ready ? 1 : v.p
  return (
    <m.div
      className={`v-loading-f${wide ? ' wide' : ''}${v.ready ? ' ready' : ''}`}
      style={{ '--day': day } as CSSProperties}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.06, transition: { duration: 0.3, ease: [0.4, 0, 1, 1] } }}
      transition={{ duration: 0.3 }}
    >
      <span className="lf-night" aria-hidden="true" />
      <span className="lf-dawn" aria-hidden="true" />
      <span className="lf-day" aria-hidden="true" />
      <div className="lf-stars" aria-hidden="true">
        {STARS.map((st, i) => (
          <i key={i} style={{ left: `${st.x}%`, top: `${st.y}%`, width: st.s * 2, height: st.s * 2, animationDelay: `${-st.d}s` }} />
        ))}
      </div>
      <m.header className="lf-logo" initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.sheet, delay: 0.05 }}>
        <Logo small={wide} />
      </m.header>
      <div className="lf-stage" ref={stage}>
        <Suspense fallback={<img className="art lf-wait" src={art('house-with-garden')} alt="" />}>
          <Planet3D p={v.p} ready={v.ready} hop={hop} onTap={() => setHop((n) => n + 1)} />
        </Suspense>
      </div>
      <m.div className="lf-low" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.sheet, delay: 0.12 }}>
        <Chrome v={v} tip={tip} onPlay={onPlay} tone="glass" />
      </m.div>
    </m.div>
  )
}
