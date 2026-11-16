import { lazy, Suspense, useEffect, useState } from 'react'
import { art } from '../../../src/ui/art'
import { loadView, useLive, type LoadingState } from './load'
import { LoadShell } from './Shell'
import './LoadingA.css'

// A · the island: the farm on a little world in 3D — a low-poly island floating and turning slowly over the disc, the
// house building itself on it as the game loads (floor, walls, roof, door and windows, chimney and smoke, then the
// trees, a bed and the fence), each piece dropping in and squashing as it lands. Its own moment: ready, the lamps come
// on in the windows and the island hops. A tap on the island makes it hop while you wait. The 3D is loaded after the
// page (lazy): the bar never waits for it. Round 5: on the shared stage (./Shell.tsx) — the sky, the name, the disc
// and its rays, the card and the moment are the same in every look.

const Island3D = lazy(() => import('./Island3D').then((x) => ({ default: x.Island3D })))

export function LoadingA({ s: start, onPlay }: { s: LoadingState; onPlay: () => void }) {
  const s = useLive(start)
  const v = loadView(s)
  const [hop, setHop] = useState(0)
  useEffect(() => {
    if (!v.ready) return
    const t = setTimeout(() => setHop((n) => n + 1), 300)
    return () => clearTimeout(t)
  }, [v.ready])
  return (
    <LoadShell name="v-loading-a" v={v} onPlay={onPlay} away={s.away}>
      <div className="la-stage">
        <Suspense fallback={<img className="art la-wait" src={art('house-with-garden')} alt="" />}>
          <Island3D p={v.p} ready={v.ready} hop={hop} onTap={() => setHop((n) => n + 1)} />
        </Suspense>
      </div>
    </LoadShell>
  )
}
