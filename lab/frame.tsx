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

const STILLS = import.meta.glob('./stills/*.jpg', { eager: true, import: 'default' }) as Record<string, string>
const stillOf = (name: string, wide: boolean) => STILLS[`./stills/${name}-${wide ? 'sideways' : 'upright'}.jpg`] ?? STILLS[`./stills/${name}-upright.jpg`]

const parse = () => {
  const [b, v, s, n] = decodeURIComponent(location.hash.slice(1)).split('/')
  return { b, v, s, n: n ?? '0' }
}

type Hooks = { __labGo?: () => void; __labReady?: boolean; __labShown?: number; __lab?: unknown }
const hooks = window as unknown as Hooks

/** What a variant draws, as one child of AnimatePresence. */
const Slot = ({ children }: { children: ReactNode }) => children

function Frame() {
  const [at, setAt] = useState(parse)
  const board = BOARDS.find((x) => x.id === at.b) ?? BOARDS[0]
  const variant = board.variants.find((x) => x.id === at.v) ?? board.variants[0]
  const state = board.states.find((x) => x.id === at.s) ?? board.states[0]
  const [data, setData] = useState(state.data)
  const [open, setOpen] = useState(!env.hold)
  const [run, setRun] = useState(0)
  const [wide, setWide] = useState(() => innerWidth > innerHeight)
  useEffect(() => {
    const again = () => {
      const next = parse()
      setAt(next)
      const b = BOARDS.find((x) => x.id === next.b) ?? BOARDS[0]
      setData((b.states.find((x) => x.id === next.s) ?? b.states[0]).data)
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
    })
    return () => {
      removeEventListener('hashchange', again)
      removeEventListener('resize', turned)
    }
  }, [])
  useEffect(() => {
    if (open) hooks.__labShown = (hooks.__labShown ?? 0) + 1
  }, [open, run])
  const pic = board.still === 'none' ? null : stillOf(board.still, wide)
  const act = {
    set: setData,
    close: () => {
      setOpen(false)
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
      <AnimatePresence mode="wait">{open && <Slot key={`${variant.id}/${state.id}/${at.n}/${run}`}>{variant.render(data, act)}</Slot>}</AnimatePresence>
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
