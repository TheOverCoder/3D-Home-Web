// the frame's settings first, before anything of the game loads: its device, touch, speed (./env.ts)
import { env } from './env'
import '@fontsource-variable/fredoka'
import '@fontsource-variable/nunito'
import '../src/styles.css'
import '../src/farm/Xp.css'
import './frame.css'
import { AnimatePresence } from 'motion/react'
import { StrictMode, useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionRoot } from '../src/ui/motion'
import { BOARDS } from './boards'
import { DEVICES } from './devices'

// One screen of the game in the lab, at the size of its frame (a phone upright or sideways, a tablet…): a still of the
// game behind, and one variant of a board in one of its states (frame.html?device=…#board/variant/state/n: a new n
// plays it again). The variant is inside the game's motion root and an AnimatePresence, so it moves in and out as it
// would in the game: `act.close` lets its way out play, then opens it again.
//
// In the sandbox (?play=1, lab/play) it is the game's screen: with nothing open, the chips and buttons a board opens
// from are marked on the still (where lab/stills/<still>.json says they are), and a touch on one asks the page round
// it to open that board (a message to the parent); a close goes back to the screen.

const STILLS = import.meta.glob('./stills/*.jpg', { eager: true, import: 'default' }) as Record<string, string>
const stillOf = (name: string, wide: boolean) => STILLS[`./stills/${name}-${wide ? 'sideways' : 'upright'}.jpg`] ?? STILLS[`./stills/${name}-upright.jpg`]

interface Spots {
  w: number
  h: number
  spots: Record<string, { x: number; y: number; w: number; h: number }>
}
const SPOTS = import.meta.glob('./stills/*.json', { eager: true, import: 'default' }) as Record<string, Spots>
const spotsOf = (name: string, wide: boolean) => SPOTS[`./stills/${name}-${wide ? 'sideways' : 'upright'}.json`]

/** The game's screen the sandbox opens on: the yard with its chips (a board may stand on another still once open). */
const HOME = 'yard'

const parse = () => {
  const [b, v, s, n] = decodeURIComponent(location.hash.slice(1)).split('/')
  return { b: b ?? '', v, s, n: n ?? '0' }
}

type Hooks = { __labGo?: () => void; __labReady?: boolean; __labShown?: number; __lab?: unknown }
const hooks = window as unknown as Hooks

const tell = (message: Record<string, unknown>) => window.parent !== window && window.parent.postMessage({ lab: true, ...message }, '*')

/** What a variant draws, as one child of AnimatePresence. */
const Slot = ({ children }: { children: ReactNode }) => children

/** The sandbox's marks on the still: each board's chip or button, ringed and named, where the still has it. */
function Marks({ still, wide }: { still: string; wide: boolean }) {
  const [room, setRoom] = useState({ w: innerWidth, h: innerHeight })
  const [hint, setHint] = useState(0)
  useEffect(() => {
    const fit = () => setRoom({ w: innerWidth, h: innerHeight })
    // a touch anywhere else lights the marks up for a moment: this is what can be opened
    const elsewhere = (e: PointerEvent) => {
      if ((e.target as Element).closest?.('.lab-spot')) return
      setHint((n) => n + 1)
      tell({ type: 'hint' })
    }
    addEventListener('resize', fit)
    addEventListener('pointerdown', elsewhere)
    return () => {
      removeEventListener('resize', fit)
      removeEventListener('pointerdown', elsewhere)
    }
  }, [])
  const map = spotsOf(still, wide)
  if (!map) return null
  // the still covers the screen from its top (frame.css): the same scale and offset place its spots
  const k = Math.max(room.w / map.w, room.h / map.h)
  const ox = (room.w - map.w * k) / 2
  const oy = 0
  const pad = 5
  // a name near an edge of the screen hangs from that side of its ring, so it stays on the screen
  const side = (b: { left: number; width: number }) => (b.left + b.width / 2 < room.w * 0.25 ? ' start' : b.left + b.width / 2 > room.w * 0.75 ? ' end' : '')
  return (
    <div className={`lab-marks${hint ? ' hint' : ''}`} key={hint}>
      {BOARDS.filter((b) => b.spot && map.spots[b.spot]).map((b) => {
        const r = map.spots[b.spot!]
        const box = { left: ox + r.x * k - pad, top: oy + r.y * k - pad, width: r.w * k + pad * 2, height: r.h * k + pad * 2 }
        return (
          <button key={b.id} className={`lab-spot${box.top > room.h / 2 ? ' low' : ''}${side(box)}`} style={box} onClick={() => tell({ type: 'open', board: b.id })} aria-label={`לפתוח: ${b.title}`}>
            <span className="lab-spot-name">{b.title}</span>
          </button>
        )
      })}
    </div>
  )
}

function Frame() {
  const [at, setAt] = useState(parse)
  const found = BOARDS.find((x) => x.id === at.b)
  const board = found ?? BOARDS[0]
  const variant = board.variants.find((x) => x.id === at.v) ?? board.variants[0]
  const state = board.states.find((x) => x.id === at.s) ?? board.states[0]
  const [data, setData] = useState(state.data)
  const [open, setOpen] = useState(!env.hold && (!env.play || !!found))
  const [run, setRun] = useState(0)
  const [wide, setWide] = useState(() => innerWidth > innerHeight)
  useEffect(() => {
    const again = () => {
      const next = parse()
      setAt(next)
      const b = BOARDS.find((x) => x.id === next.b)
      if (env.play && !b) {
        setOpen(false)
        return
      }
      const bb = b ?? BOARDS[0]
      setData((bb.states.find((x) => x.id === next.s) ?? bb.states[0]).data)
      setRun((r) => r + 1)
      setOpen(true)
    }
    const turned = () => setWide(innerWidth > innerHeight)
    addEventListener('hashchange', again)
    addEventListener('resize', turned)
    hooks.__labGo = () => setOpen(true)
    // ready when the fonts and the still are in: a picture or a film starts from the screen as it will look
    const still = document.querySelector<HTMLImageElement>('.lab-still')
    void Promise.all([
      document.fonts.load('600 20px "Fredoka Variable"'),
      document.fonts.load('400 16px "Nunito Variable"'),
      document.fonts.load('800 16px "Nunito Variable"'),
      still?.decode().catch(() => {}),
    ]).then(() => {
      hooks.__labReady = true
      tell({ type: 'ready' })
    })
    return () => {
      removeEventListener('hashchange', again)
      removeEventListener('resize', turned)
    }
  }, [])
  useEffect(() => {
    if (open) hooks.__labShown = (hooks.__labShown ?? 0) + 1
  }, [open, run])
  const shown = open && (!env.play || !!found)
  const stillName = env.play && (!found || board.still === 'none') ? (found && board.still === 'none' ? 'none' : HOME) : board.still
  const pic = stillName === 'none' ? null : stillOf(stillName, wide)
  const act = {
    set: setData,
    close: () => {
      setOpen(false)
      // the sandbox goes back to the game's screen; elsewhere it opens again, so its opening is seen once more
      if (env.play) {
        tell({ type: 'closed' })
        return
      }
      setTimeout(() => {
        setData(state.data)
        setRun((r) => r + 1)
        setOpen(true)
      }, 900)
    },
  }
  return (
    <MotionRoot>
      {pic && <img className="lab-still" src={pic} alt="" />}
      {env.play && !shown && stillName !== 'none' && <Marks still={stillName} wide={wide} />}
      <AnimatePresence mode="wait">{shown && <Slot key={`${board.id}/${variant.id}/${state.id}/${at.n}/${run}`}>{variant.render(data, act)}</Slot>}</AnimatePresence>
    </MotionRoot>
  )
}

// what the lab holds, for the scripts (scripts/lab-shots.mjs, scripts/lab-film.mjs)
hooks.__lab = { boards: BOARDS.map((b) => ({ id: b.id, variants: b.variants.map((v) => v.id), states: b.states.map((s) => s.id), devices: b.devices ?? ['upright', 'sideways'] })), devices: DEVICES }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Frame />
  </StrictMode>,
)
