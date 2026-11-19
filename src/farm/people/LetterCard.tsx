import { AnimatePresence, m } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { art } from '../../ui/art'
import { burst } from '../../ui/burst'
import { ItemPic } from '../../ui/ItemPic'
import { ITEM, SPRING } from '../../ui/motion'
import { PanelSheet } from '../../ui/PanelSheet'
import { Portrait } from '../../ui/Portrait'
import { useLessMotion } from '../../ui/still'
import type { Line } from '../../talk/lines'
import { SHOP } from '../decor'
import { shopArtUrl } from '../icons'
import { prizeWords, type Prize } from '../prize'
import { Hearts } from './Hearts'
import type { LetterView } from './view'
import './LetterCard.css'

// A neighbour's letter (the design layer: it draws a LetterView, nothing of the farm in it; ./LetterPanel.tsx feeds it).
// The writer's portrait in the sheet's head with their name and their hearts; on the paper, one line at a time, typed
// in, with the face of whoever says it (a line can be another's: the farmer opens a neighbour's first letter), read
// aloud in their voice when the sound is on (`onLine`). A tap on the paper, or Next, brings the next line; the last
// page shows the gift, and Claim takes it (it flies home as surprises do; no XP). A letter read again has no gift, and
// ends with Close.

/** Letters typed a second (ms each). */
const TYPE_MS = 28

/** The gift's picture with how many: coins, a good or a material, a piece of decoration. */
function PrizePic({ p }: { p: Prize }) {
  if ('coins' in p) return <ItemPic id="coin" count={p.coins} />
  if ('item' in p) return <ItemPic id={p.item} count={p.n} />
  if ('decor' in p)
    return (
      <span className="item-pic">
        <img className="art" src={shopArtUrl(p.decor)} alt="" draggable={false} />
        <b className="qty">1</b>
      </span>
    )
  return <img className="art" src={art('wrapped-gift')} alt="" />
}

/** The gift's name in a few words: "a bench", "12 coins". */
const giftName = (p: Prize) => ('decor' in p ? SHOP[p.decor].name : prizeWords(p))

/** One line on the paper, typed in (all at once with less motion), with the speaker's face when it is not the writer. */
function Said({ line, writer, still, whole, onTyped }: { line: Line; writer: string; still: boolean; whole: boolean; onTyped: () => void }) {
  const [shown, setShown] = useState(still ? line.say.length : 0)
  const typed = useRef(onTyped)
  typed.current = onTyped
  useEffect(() => {
    // (a tap while it types: the whole line at once)
    if (still || whole) {
      setShown(line.say.length)
      typed.current()
      return
    }
    setShown(0)
    let n = 0
    const t = window.setInterval(() => {
      n += 1
      setShown(n)
      if (n >= line.say.length) {
        window.clearInterval(t)
        typed.current()
      }
    }, TYPE_MS)
    return () => window.clearInterval(t)
  }, [line, still, whole])
  const other = line.who !== writer && line.who !== 'buyer'
  return (
    <m.span
      className={`lc-line${other ? ' other' : ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
      transition={SPRING.pop}
    >
      {other && line.who !== 'buyer' && <Portrait who={line.who} mood={line.mood} size={44} beat={line.say} />}
      <span aria-hidden="true">
        {line.say.slice(0, shown)}
        <i className="lc-rest">{line.say.slice(shown)}</i>
      </span>
      <span className="lc-say">{line.say}</span>
    </m.span>
  )
}

/** The card: `onLine` as each line comes up (read aloud), `onClaim` as it is read to its end (its gift taken, from the
 *  element it shows on), `onClose` once it has gone. */
export function LetterCard({ v, onLine, onClaim, onClose }: { v: LetterView; onLine?: (line: Line) => void; onClaim: (from: HTMLElement) => void; onClose: () => void }) {
  const still = !!useLessMotion()
  const [k, setK] = useState(0)
  const [typed, setTyped] = useState(false)
  const [closing, setClosing] = useState(false)
  const line = v.lines[Math.min(k, v.lines.length - 1)]
  const last = k >= v.lines.length - 1
  const said = useRef(onLine)
  said.current = onLine
  useEffect(() => {
    said.current?.(line)
  }, [line])
  const next = () => {
    if (!typed) setTyped(true)
    else if (!last) {
      setTyped(false)
      setK((n) => n + 1)
    }
  }
  const gift = useRef<HTMLDivElement>(null)
  const paper = useRef<HTMLButtonElement>(null)
  /** The letter read (its gift claimed, from where it shows), then the card goes. */
  const claim = () => {
    if (closing) return
    const from = gift.current ?? paper.current
    if (from) onClaim(from)
    if (v.prize && !still && from) burst(from, { count: 36, spread: 60, power: 22 })
    setClosing(true)
  }
  const action =
    !last || !typed
      ? { label: 'Next', onPress: next, kind: 'soft' as const }
      : v.prize
        ? { label: 'Claim', onPress: claim, kind: 'leaf' as const }
        : { label: v.again ? 'Close' : 'Done', onPress: claim }
  return (
    <PanelSheet
      label={`A letter from ${v.name}`}
      title={`From ${v.name}`}
      pic={<Portrait who={v.from} mood={line.who === v.from ? line.mood : 'cheerful'} size={56} beat={line.say} />}
      sub={
        v.kind === 'birthday' ? (
          <img className="art lc-cake" src={art('birthday-cake')} alt="A birthday" />
        ) : (
          <span className="lc-hearts">
            <Hearts n={v.hearts} />
          </span>
        )
      }
      size="card"
      className="letter-card"
      closing={closing}
      onClose={onClose}
      foot={{ action }}
    >
      <m.button ref={paper} className="lc-paper" variants={ITEM} onClick={next} aria-label={last ? 'The letter' : 'Next line'}>
        <img className="art lc-stamp" src={art(v.kind === 'birthday' ? 'birthday-cake' : 'love-letter')} alt="" aria-hidden="true" />
        <AnimatePresence mode="wait" initial={false}>
          <Said key={k} line={line} writer={v.from} still={still} whole={typed} onTyped={() => setTyped(true)} />
        </AnimatePresence>
        <span className="lc-pages" aria-hidden="true">
          {v.lines.map((_, i) => (
            <i key={i} className={i === k ? 'on' : i < k ? 'was' : ''} />
          ))}
        </span>
      </m.button>
      <AnimatePresence>
        {last && typed && v.prize && (
          <m.div ref={gift} className="lc-gift" initial={{ opacity: 0, scale: 0.6, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={SPRING.pop}>
            <PrizePic p={v.prize} />
            <span>{giftName(v.prize)}</span>
          </m.div>
        )}
      </AnimatePresence>
    </PanelSheet>
  )
}
