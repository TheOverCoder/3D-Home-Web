import { useEffect, useRef, useState, type ReactNode } from 'react'
import { PICKUPS, ROOMS } from '../data/layout'
import { coarsePointer } from '../lib/device'
import { triggerInteraction, type ActionIcon, type Verb } from '../lib/interaction'
import { useSettings } from '../settings'
import { busy, useHome, type Nearby } from '../store'
import { iconUrl } from '../farm/icons'
import type { ProduceId } from '../farm/data'
import { clockText } from '../farm/state'
import { ActionFace, TurnHint, VerbMark } from './ActionGlyph'
import { art } from './art'
import { Compass } from './Compass'
import { ConfirmCard } from './ConfirmCard'
import { ArrowRight, Clock } from './glyphs'
import { ItemPic } from './ItemPic'

/** Room name that fades in when you walk into a new room, like a film title. */
function RoomTitle() {
  const room = useHome((s) => s.room)
  const outdoors = useHome((s) => s.outdoors)
  const place = outdoors ? 'garden' : room
  const [shown, setShown] = useState<{ name: string; key: number } | null>(null)
  const seq = useRef(0)
  const last = useRef(place)

  useEffect(() => {
    if (!place || place === last.current) {
      last.current = place ?? last.current
      return
    }
    last.current = place
    setShown({ name: place === 'garden' ? 'Garden' : ROOMS[place].name, key: ++seq.current })
    const t = setTimeout(() => setShown(null), 3200)
    return () => clearTimeout(t)
  }, [place])

  return shown ? (
    <div className="room-title" key={shown.key} aria-live="polite">
      {shown.name}
    </div>
  ) : null
}

/** One quiet line the first time you step inside; everything else lives in the settings panel. */
function FirstHint() {
  const hintShown = useHome((s) => s.hintShown)
  const [visible, setVisible] = useState(!hintShown)
  useEffect(() => {
    if (hintShown) return
    useHome.getState().markHintShown()
    const t = setTimeout(() => setVisible(false), 7000)
    return () => clearTimeout(t)
  }, [hintShown])
  if (!visible) return null
  return coarsePointer ? (
    <div className="first-hint touch" aria-hidden="true">
      Walk with the stick · drag anywhere to look · the round button does what is near you
    </div>
  ) : (
    <div className="first-hint" aria-hidden="true">
      Move with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> · look with the mouse · <kbd>Esc</kbd> for settings
    </div>
  )
}

const good = (id: string) => iconUrl(id as ProduceId)

/** A picture in the prompt, a good's or a piece of art. On a computer the first carries the verb's coloured mark in
 *  its corner: there the prompt is the only button, while on a touch screen the round button under it shows the verb. */
function Pic({ src, verb }: { src: string; verb?: Verb }) {
  return (
    <span className="prompt-pic">
      <img src={src} alt="" draggable={false} />
      {verb && <VerbMark verb={verb} />}
    </span>
  )
}

/** How many, beside a good's picture: ×3. */
const Count = ({ n }: { n: number }) => <b className="prompt-count">×{n}</b>

/** The coins that change hands: what a press costs, or what the buyer offers. */
const CoinTag = ({ n }: { n: number }) => (
  <span className="tag">
    <img src={art('coin')} alt="" draggable={false} />
    {n}
  </span>
)

/**
 * An action as pictures instead of a sentence: the good with how many beside it (the bottle of milk ×3), and a coin
 * chip where coins change hands (seeds, a buyer's offer) — or, to build, its picture and price. Null for what is
 * about no good (a door, a lamp, the shop, the seed packets): that keeps its few words.
 */
function actionPictures(icon: ActionIcon | undefined, mark: Verb | undefined): ReactNode {
  if (icon?.item && icon.count !== undefined) {
    const goods = [{ item: icon.item, count: icon.count }, ...(icon.also ?? [])]
    return (
      <span className="prompt-goods" aria-hidden="true">
        {goods.map((g, k) => (
          <span key={g.item} className="prompt-good">
            <Pic src={good(g.item)} verb={k === 0 ? mark : undefined} />
            <Count n={g.count} />
          </span>
        ))}
        {icon.coins !== undefined && <CoinTag n={icon.coins} />}
      </span>
    )
  }
  if (icon?.art && icon.coins !== undefined)
    return (
      <span className="prompt-goods" aria-hidden="true">
        <Pic src={art(icon.art)} />
        <CoinTag n={icon.coins} />
      </span>
    )
  return null
}

/**
 * What is on its way, as pictures: the thing (how many) and how long; at the oven with something missing, what is
 * missing (each with how many) → the cake it is for; at a machine with nothing to work on, what it makes from what.
 * Null when there is nothing to draw it with (the label is shown instead).
 */
function statusPictures(status: Nearby): ReactNode {
  const icon = status.icon
  const arrow = <ArrowRight weight="bold" className="prompt-arrow" />
  if (status.needs?.length)
    return (
      <span className="prompt-goods" aria-hidden="true">
        <span className="status-needs">
          {status.needs.map((n) => (
            <ItemPic key={n.item} id={n.item} count={n.count} />
          ))}
        </span>
        {icon?.item && (
          <>
            {arrow}
            <Pic src={good(icon.item)} />
          </>
        )}
      </span>
    )
  if (icon?.makes?.length)
    return (
      <span className="prompt-goods" aria-hidden="true">
        {icon.makes.map((m) => (
          <span key={m.from} className="prompt-make">
            <Pic src={good(m.from)} />
            {arrow}
            <Pic src={good(m.to)} />
          </span>
        ))}
      </span>
    )
  if (icon?.item && icon.seconds !== undefined)
    return (
      <span className="prompt-goods" aria-hidden="true">
        <span className="prompt-good">
          <Pic src={good(icon.item)} />
          {icon.count !== undefined && <Count n={icon.count} />}
        </span>
        <span className="prompt-time">
          <Clock weight="bold" />
          {clockText(icon.seconds)}
        </span>
      </span>
    )
  return null
}

export function Hud() {
  const phase = useHome((s) => s.phase)
  const nearby = useHome((s) => s.nearby)
  const status = useHome((s) => s.status)
  const carrying = useHome((s) => s.carrying)
  const occupied = useHome(busy)
  const toast = useHome((s) => s.toast)
  const cinema = useSettings((s) => s.cinema)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => useHome.setState((s) => (s.toast?.id === toast.id ? { toast: null } : s)), 2200)
    return () => clearTimeout(t)
  }, [toast])

  if (phase !== 'playing') return null

  const carried = PICKUPS.find((p) => p.id === carrying)
  const prompt: Nearby | null = occupied ? null : (nearby ?? (carried ? { id: 'drop', label: `Put down the ${carried.name}`, icon: { verb: 'drop' } } : null))
  const turn = prompt?.reach ? prompt.side : undefined
  // drawn as pictures where it can be (the label stays behind them, for screen readers)
  const pictures = prompt && actionPictures(prompt.icon, coarsePointer ? undefined : (prompt.icon?.verb ?? 'pick'))
  const shown = !occupied && status && !prompt ? status : null
  const statusPics = shown && statusPictures(shown)

  return (
    <>
      {cinema && <div className="cinema-bars" aria-hidden="true" />}
      <RoomTitle />
      <FirstHint />

      <div className="hud-prompt" aria-live="polite">
        {prompt && (
          // on a touch screen the round action button carries the picture and the verb; this line above it says how
          // many (the bottle of milk ×3), and is a second way to tap it
          <button className={`prompt${turn && turn !== 'ahead' ? ` turn-${turn}` : ''}`} onClick={() => triggerInteraction()} data-verb={prompt.icon?.verb ?? 'pick'}>
            {!coarsePointer && <kbd>E</kbd>}
            {!coarsePointer && !pictures && <ActionFace icon={prompt.icon} className="small" />}
            {turn === 'left' && <TurnHint side="left" className="prompt-turn" />}
            {pictures}
            <span className={pictures ? 'prompt-sr' : 'prompt-text'}>{prompt.label}</span>
            {!coarsePointer && prompt.hint && <span className="prompt-hint">{prompt.hint}</span>}
            {(turn === 'right' || turn === 'back') && <TurnHint side={turn} className="prompt-turn" />}
          </button>
        )}
        {shown && (
          // nothing to do here: what is on its way (not a button: there is nothing to press)
          <div className="prompt status" data-verb="wait">
            {statusPics || <ActionFace icon={shown.icon} className="small" />}
            <span className={statusPics ? 'prompt-sr' : 'prompt-text'}>{shown.label}</span>
          </div>
        )}
      </div>

      <Compass />
      <ConfirmCard />

      {toast && (
        <div className="toast" role="status" key={toast.id}>
          {toast.item && <img className="toast-item" src={iconUrl(toast.item as ProduceId)} alt="" draggable={false} />}
          <span>{toast.text}</span>
        </div>
      )}
    </>
  )
}
