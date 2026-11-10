import { useEffect } from 'react'
import { uiClick } from '../audio/sound'
import type { RoomId } from '../data/layout'
import { farm, useFarm } from '../farm/state'
import { coarsePointer } from '../lib/device'
import { useHome } from '../store'
import { art } from '../ui/art'
import { ArrowClockwise, ArrowUUpLeft } from '../ui/glyphs'
import { PIECES, type PieceType } from './catalogue'
import { pieceUrl } from './pictures'
import { movable, placeFromStorage, putAwayPicked, stopDecorating, turnPicked, undo, useDecorate } from './decorate'

// The decorate mode's controls on the screen: Done where the settings were, undo at the top left, and a card along
// the bottom — what to do, the rooms and what is in storage; or, with a piece picked, its name, whether it fits
// where it is dragged (and if not, why), Turn and Put away.

const ROOM_ORDER: RoomId[] = ['living', 'office', 'kitchen', 'bedroom']
/** The rooms' names as one word each, so the four fit on one row. */
const SHORT: Record<RoomId, string> = { living: 'Living', office: 'Studio', kitchen: 'Kitchen', bedroom: 'Bedroom' }
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)

/** A piece's picture, with how many when there are more than the one shown (storage). */
function PiecePic({ type, count }: { type: PieceType; count?: number }) {
  return (
    <span className="item-pic">
      <img className="art" src={pieceUrl(type)} alt="" draggable={false} />
      {count !== undefined && <b className="qty">{count}</b>}
    </span>
  )
}

function PickedCard({ id }: { id: string }) {
  useFarm(() => farm.home)
  const drag = useDecorate((s) => (s.drag?.id === id ? s.drag : null))
  const note = useDecorate((s) => s.note)
  const piece = farm.home.pieces.find((p) => p.id === id)
  if (!piece) return null
  const def = PIECES[piece.type]
  let status = <p>{coarsePointer ? 'Drag it to move it' : 'Drag it to move it · R turns it'}</p>
  if (drag) status = drag.fit.ok ? <p className="fit-ok">It fits here — let go to put it down</p> : <p className="fit-bad">{drag.fit.reason}</p>
  else if (note) status = <p className="fit-bad">{note}</p>
  return (
    <>
      <div className="deco-head">
        <PiecePic type={piece.type} />
        <div>
          <h3>{def.name}</h3>
          {status}
        </div>
      </div>
      <div className="edit-actions">
        <button
          className="btn soft small"
          onClick={() => {
            uiClick()
            turnPicked()
          }}
        >
          <ArrowClockwise weight="bold" /> Turn{!coarsePointer && <kbd>R</kbd>}
        </button>
        <button
          className="btn soft small"
          onClick={() => {
            uiClick()
            putAwayPicked()
          }}
        >
          <img className="edit-coin" src={art('package')} alt="" /> Put away{!coarsePointer && <kbd>Del</kbd>}
        </button>
      </div>
    </>
  )
}

function RoomCard() {
  useFarm(() => farm.home)
  const room = useDecorate((s) => s.room)
  const note = useDecorate((s) => s.note)
  // what is in storage, each kind once with how many
  const stored = new Map<PieceType, number>()
  for (const t of farm.home.stored) stored.set(t, (stored.get(t) ?? 0) + 1)
  return (
    <>
      <div className="deco-head">
        <div>
          <h3>Decorate</h3>
          {note ? <p className="fit-bad">{note}</p> : <p>Tap a piece, then drag it.</p>}
        </div>
        <button
          className="btn soft deco-shop"
          onClick={() => {
            uiClick()
            useHome.getState().openPanel({ kind: 'furniture' })
          }}
        >
          <img className="edit-coin" src={art('shopping-bags')} alt="" /> Shop
        </button>
      </div>
      <div className="edit-actions deco-rooms" role="group" aria-label="Rooms">
        {ROOM_ORDER.map((r) => (
          <button key={r} className={`btn small ${r === room ? 'leaf' : 'soft'}`} aria-pressed={r === room} onClick={() => useDecorate.setState({ room: r, note: null })}>
            {SHORT[r]}
          </button>
        ))}
      </div>
      {stored.size > 0 && (
        <div className="deco-stored" role="group" aria-label="In storage: tap one to stand it in this room">
          <img className="deco-box" src={art('package')} alt="" />
          {[...stored].map(([type, n]) => (
            <button
              key={type}
              className="deco-stored-piece"
              aria-label={`${PIECES[type].name}${n > 1 ? ` (${n})` : ''}: stand it here`}
              title={PIECES[type].name}
              onClick={() => {
                uiClick()
                placeFromStorage(type)
              }}
            >
              <PiecePic type={type} count={n} />
            </button>
          ))}
        </div>
      )}
    </>
  )
}

/** The decorate mode's card, its Done button and undo (Esc or B leaves too; R turns, Delete puts away, Ctrl+Z undoes). */
export function DecoratePanel() {
  const decorating = useHome((s) => s.decorating)
  const panel = useHome((s) => s.panel)
  const picked = useDecorate((s) => s.picked)
  const canUndo = useDecorate((s) => s.undo.length > 0)
  useEffect(() => {
    if (!decorating) return
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || e.repeat || useHome.getState().panel) return
      const id = useDecorate.getState().picked
      if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (undo()) uiClick()
      } else if (e.code === 'KeyR' && id && movable(id)) {
        uiClick()
        turnPicked(e.shiftKey ? -1 : 1)
      } else if ((e.code === 'Delete' || e.code === 'Backspace') && id) {
        e.preventDefault()
        uiClick()
        putAwayPicked()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [decorating])
  // the shop open over it: only the shop
  if (!decorating || panel) return null
  return (
    <>
      <button className="edit-done primary" onClick={() => stopDecorating()}>
        Done{!coarsePointer && <kbd>B</kbd>}
      </button>
      <button
        className="btn soft round deco-undo"
        disabled={!canUndo}
        onClick={() => {
          if (undo()) uiClick()
        }}
        aria-label="Undo (Ctrl+Z)"
        title="Undo (Ctrl+Z)"
      >
        <ArrowUUpLeft weight="bold" />
      </button>
      <div className="edit-card" role="region" aria-label="Decorate the house">
        {picked ? <PickedCard id={picked} /> : <RoomCard />}
      </div>
    </>
  )
}
