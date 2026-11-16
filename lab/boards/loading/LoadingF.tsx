import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react'
import { art } from '../../../src/ui/art'
import { loadView, useLive, type LoadingState } from './load'
import { LoadShell } from './Shell'
import './LoadingF.css'

// F · a little planet at sunrise: the farm on a tiny round world in 3D, spinning slowly, and the loading is the night
// turning into day. Round 5, on the shared stage (./Shell.tsx): the night is inside the disc — a round window of deep
// sky full of twinkling stars and the cool light on the planet — and as the bar fills it fades into the disc's own sun,
// the stars going out one by one, the light on the farm warming. Its own moment: ready, the windmill hurries and the
// planet hops. A tap on the planet makes it hop. The 3D is loaded after the page (lazy).

const Planet3D = lazy(() => import('./Planet3D').then((x) => ({ default: x.Planet3D })))

const STARS = Array.from({ length: 26 }, (_, i) => ({ x: 12 + ((i * 37.3) % 76), y: 10 + ((i * 61.7) % 60), s: 1 + (i % 3), d: (i * 0.37) % 3 }))

export function LoadingF({ s: start, onPlay }: { s: LoadingState; onPlay: () => void }) {
  const s = useLive(start)
  const v = loadView(s)
  const [hop, setHop] = useState(0)
  useEffect(() => {
    if (!v.ready) return
    const t = setTimeout(() => setHop((n) => n + 1), 450)
    return () => clearTimeout(t)
  }, [v.ready])
  return (
    <LoadShell name="v-loading-f" v={v} onPlay={onPlay} away={s.away}>
      <span className="lf-night" aria-hidden="true" style={{ '--day': v.ready ? 1 : v.p } as CSSProperties}>
        {STARS.map((st, i) => (
          <i key={i} style={{ left: `${st.x}%`, top: `${st.y}%`, width: st.s * 2, height: st.s * 2, animationDelay: `${-st.d}s` }} />
        ))}
      </span>
      <div className="lf-stage">
        <Suspense fallback={<img className="art lf-wait" src={art('house-with-garden')} alt="" />}>
          <Planet3D p={v.p} ready={v.ready} hop={hop} onTap={() => setHop((n) => n + 1)} />
        </Suspense>
      </div>
    </LoadShell>
  )
}
