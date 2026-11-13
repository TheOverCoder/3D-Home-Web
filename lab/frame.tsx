import '@fontsource-variable/fredoka'
import '@fontsource-variable/nunito'
import '../src/styles.css'
import '../src/farm/Xp.css'
import './frame.css'
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BOARDS } from './boards'
import yardTall from './stills/yard-upright.jpg'
import yardWide from './stills/yard-sideways.jpg'

// One screen of the game in the lab, at the size of its frame (a phone upright or sideways): a still of the game behind,
// and one variant of a board in one of its states (#board/variant/state/n: n plays it again).

const STILLS = { yard: { tall: yardTall, wide: yardWide } }

const parse = () => {
  const [b, v, s, n] = decodeURIComponent(location.hash.slice(1)).split('/')
  return { b, v, s, n }
}

function Frame() {
  const [at, setAt] = useState(parse)
  const board = BOARDS.find((x) => x.id === at.b) ?? BOARDS[0]
  const variant = board.variants.find((x) => x.id === at.v) ?? board.variants[0]
  const state = board.states.find((x) => x.id === at.s) ?? board.states[0]
  const [data, setData] = useState(state.data)
  const [open, setOpen] = useState(true)
  const [wide, setWide] = useState(() => innerWidth > innerHeight)
  useEffect(() => {
    const again = () => {
      const next = parse()
      setAt(next)
      const b = BOARDS.find((x) => x.id === next.b) ?? BOARDS[0]
      setData((b.states.find((x) => x.id === next.s) ?? b.states[0]).data)
      setOpen(false)
      requestAnimationFrame(() => setOpen(true))
    }
    const turned = () => setWide(innerWidth > innerHeight)
    addEventListener('hashchange', again)
    addEventListener('resize', turned)
    return () => {
      removeEventListener('hashchange', again)
      removeEventListener('resize', turned)
    }
  }, [])
  const still = STILLS[board.still]
  const act = {
    set: setData,
    close: () => {
      setOpen(false)
      setTimeout(() => {
        setData(state.data)
        setOpen(true)
      }, 700)
    },
  }
  return (
    <>
      <img className="lab-still" src={wide ? still.wide : still.tall} alt="" />
      {open && variant.render(data, act)}
    </>
  )
}

// what the lab holds, for scripts/lab-shots.mjs
;(window as unknown as { __lab: unknown }).__lab = BOARDS.map((b) => ({ id: b.id, variants: b.variants.map((v) => v.id), states: b.states.map((s) => s.id) }))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Frame />
  </StrictMode>,
)
