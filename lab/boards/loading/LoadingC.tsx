import { m } from 'motion/react'
import { type CSSProperties } from 'react'
import { loadView, useLive, type LoadingState } from './load'
import poster from './poster.jpg'
import { LoadShell } from './Shell'
import './LoadingC.css'

// C · a window onto the house, round 3: a film's first shot. The house itself fills the screen (a picture of the game),
// out of focus and coming into focus as it loads, the camera pushing in slowly; beams of afternoon light fall through
// the window and turn, dust floats in them at three depths (far specks sharp and slow, near ones big, soft and quick: a
// lens's depth of field), the edges breathe dark, and black bars top and bottom say "the film is about to start". A
// shine runs across the logo now and then. Its moment: ready, the picture snaps into focus, a flare crosses the light,
// the black bars slide away as the curtain does, a burst of confetti, and Play. Round 5, on the shared stage
// (./Shell.tsx): the shot is a round window in the disc's place — the house coming into focus inside it, with its light,
// its dust and its black bars — and the sky, the name, the card and the moment are the others'.

/** Dust in the light, at three depths: how many, how big (px), how soft (blur px), how long one rise takes (s). */
const DUST = [
  { n: 14, size: 3, blur: 0, time: 26, depth: 'far' },
  { n: 9, size: 6, blur: 1.5, time: 18, depth: 'mid' },
  { n: 5, size: 16, blur: 5, time: 11, depth: 'near' },
] as const

export function LoadingC({ s: start, onPlay }: { s: LoadingState; onPlay: () => void }) {
  const s = useLive(start)
  const v = loadView(s)
  // the picture comes into focus over the way, the last of it the moment it is ready
  const blur = v.ready ? 0 : 2 + (1 - v.p) * 9
  return (
    <LoadShell name="v-loading-c" v={v} onPlay={onPlay} away={s.away}>
      <div className="lc3-window">
        <div className="lc3-shot" aria-hidden="true">
          <img className="lc3-pic" src={poster} alt="" style={{ filter: `blur(${blur}px) saturate(${0.75 + v.p * 0.35})` }} />
        </div>
        {/* beams of light through the window, turning slowly */}
        <div className="lc3-beams" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        {/* dust in the light, at three depths */}
        <div className="lc3-dust" aria-hidden="true">
          {DUST.map((d) =>
            Array.from({ length: d.n }, (_, i) => (
              <i
                key={`${d.depth}${i}`}
                className={d.depth}
                style={
                  {
                    left: `${(i * 37 + d.size * 11) % 100}%`,
                    top: `${(i * 53 + d.size * 7) % 100}%`,
                    width: d.size,
                    height: d.size,
                    filter: d.blur ? `blur(${d.blur}px)` : undefined,
                    animationDuration: `${d.time + (i % 4) * 2}s`,
                    animationDelay: `${-((i * 3.7) % d.time)}s`,
                  } as CSSProperties
                }
              />
            )),
          )}
        </div>
        {/* the flare as the picture comes sharp */}
        {v.ready && (
          <div className="lc3-flare" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
        )}
        <span className="lc3-vignette" aria-hidden="true" />
        {/* the black bars of a film, until it starts */}
        <m.span
          className="lc3-bar top"
          aria-hidden="true"
          initial={{ scaleY: 1 }}
          animate={{ scaleY: v.ready ? 0 : 1 }}
          transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1], delay: v.ready ? 0.25 : 0 }}
        />
        <m.span
          className="lc3-bar bottom"
          aria-hidden="true"
          initial={{ scaleY: 1 }}
          animate={{ scaleY: v.ready ? 0 : 1 }}
          transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1], delay: v.ready ? 0.25 : 0 }}
        />
      </div>
    </LoadShell>
  )
}
