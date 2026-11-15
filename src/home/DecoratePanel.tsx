import { useEffect, type ReactNode } from 'react'
import { uiClick } from '../audio/sound'
import { ROOMS, type RoomId } from '../data/layout'
import { farm, useFarm } from '../farm/state'
import { coarsePointer } from '../lib/device'
import { useHome } from '../store'
import { art } from '../ui/art'
import { ArrowClockwise, ArrowUUpLeft, CaretLeft, CaretRight, Couch, Door, DoorOpen, GridFour, PaintRoller, SquaresFour, Wall } from '../ui/glyphs'
import { PIECES, onWall, type PieceType } from './catalogue'
import { pieceUrl } from './pictures'
import {
  floorRoomInView,
  movable,
  nudgeOpening,
  openingOf,
  paintRoomInView,
  placeFromStorage,
  putAwayPicked,
  stopDecorating,
  storable,
  toggleOpening,
  turnPicked,
  undo,
  useDecorate,
  type DecorateTab,
} from './decorate'
import { FLOORS, INTERIOR, PAINTS, openingsOf, type PlacedOpening } from './shell'

// The decorate mode's controls on the screen: Done where the settings were, undo at the top left, and a card along
// the bottom — the rooms, and for the room in view its things (what to do, what is in storage), its walls' paint or
// its floor; or, with something picked, its name, whether it fits where it is dragged (and if not, why; if it blocks
// the way, a word about it), and what else it can do: Turn and Put away a piece, close or open a doorway or a window.

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

/** The line under a picked thing's name: how to move it, or (while it is dragged) whether it fits there. */
function FitLine({ id, how }: { id: string; how: string }) {
  const drag = useDecorate((s) => (s.drag?.id === id ? s.drag : null))
  const note = useDecorate((s) => s.note)
  const warn = useDecorate((s) => s.warn)
  if (drag) {
    if (!drag.fit.ok) return <p className="fit-bad">{drag.fit.reason}</p>
    return drag.fit.warn ? <p className="fit-warn">{drag.fit.warn} — you can still put it here</p> : <p className="fit-ok">It fits here — let go to put it down</p>
  }
  if (note) return <p className={warn ? 'fit-warn' : 'fit-bad'}>{note}</p>
  return <p>{how}</p>
}

function PickedCard({ id }: { id: string }) {
  useFarm(() => farm.home)
  const piece = farm.home.pieces.find((p) => p.id === id)
  if (!piece) return null
  const def = PIECES[piece.type]
  const hanging = onWall(piece.type)
  const how = hanging ? 'Drag it along the walls' : coarsePointer ? 'Drag it to move it' : 'Drag it to move it · R turns it'
  return (
    <>
      <div className="deco-head">
        <PiecePic type={piece.type} />
        <div>
          <h3>{def.name}</h3>
          <FitLine id={id} how={how} />
        </div>
      </div>
      <div className="edit-actions">
        {!hanging && (
          <button
            className="btn soft small"
            onClick={() => {
              uiClick()
              turnPicked()
            }}
          >
            <ArrowClockwise weight="bold" /> Turn{!coarsePointer && <kbd>R</kbd>}
          </button>
        )}
        {storable(id) && (
          <button
            className="btn soft small"
            onClick={() => {
              uiClick()
              putAwayPicked()
            }}
          >
            <img className="edit-coin" src={art('package')} alt="" /> Put away{!coarsePointer && <kbd>Del</kbd>}
          </button>
        )}
      </div>
    </>
  )
}

/** What an opening is called on its card. */
const openingName = (o: PlacedOpening) => (o.kind === 'garden' ? 'Garden door' : o.hinged ? 'Kitchen door' : o.kind === 'doorway' ? 'Doorway' : 'Window')
/** Where it is: the rooms a doorway joins, a window's room. */
const openingWhere = (o: PlacedOpening) =>
  o.sides
    .filter((r): r is RoomId => r !== null)
    .map((r) => ROOMS[r].name)
    .join(' ↔ ')

/** A picked doorway, window or the garden door: slide it along its wall (drag, or the arrows), close or open it. */
function OpeningCard({ id }: { id: string }) {
  const shell = useFarm(() => farm.home.shell)
  const o = openingsOf(shell).find((q) => q.id === id)
  if (!o) return null
  const key = `opening:${id}`
  const Glyph = o.kind === 'window' ? GridFour : o.closed ? Wall : o.kind === 'garden' ? DoorOpen : Door
  const how = o.closed ? 'Closed — it is wall now' : o.kind === 'window' ? 'Drag it along its room’s outer walls' : 'Drag it along its wall'
  return (
    <>
      <div className="deco-head">
        <span className="deco-glyph" aria-hidden>
          <Glyph weight="fill" />
        </span>
        <div>
          <h3>{openingName(o)}</h3>
          <p className="deco-where">{openingWhere(o)}</p>
          <FitLine id={key} how={how} />
        </div>
      </div>
      <div className="edit-actions">
        <button
          className="btn soft small"
          aria-label="Slide it one way"
          disabled={o.closed}
          onClick={() => {
            uiClick()
            nudgeOpening(id, -1)
          }}
        >
          <CaretLeft weight="bold" />
        </button>
        <button
          className="btn soft small"
          aria-label="Slide it the other way"
          disabled={o.closed}
          onClick={() => {
            uiClick()
            nudgeOpening(id, 1)
          }}
        >
          <CaretRight weight="bold" />
        </button>
        {o.kind !== 'garden' && (
          <button
            className={`btn small ${o.closed ? 'leaf' : 'soft'}`}
            onClick={() => {
              uiClick()
              toggleOpening(id)
            }}
          >
            {o.closed ? (
              <>{o.kind === 'window' ? <GridFour weight="bold" /> : <DoorOpen weight="bold" />} Open it</>
            ) : (
              <>
                <Wall weight="bold" /> Close it
              </>
            )}
          </button>
        )}
      </div>
    </>
  )
}

/** A row of choices that scrolls sideways on a narrow screen. */
const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="deco-swatches" role="group" aria-label={label}>
    {children}
  </div>
)

/** The room in view's walls: as built, or one of the paints (free; undo goes back). */
function Paints({ room }: { room: RoomId }) {
  const shell = useFarm(() => farm.home.shell)
  const now = shell.paint[room]
  return (
    <Row label={`Paint the ${ROOMS[room].name.toLowerCase()}`}>
      <button
        className="deco-swatch"
        style={{ background: `linear-gradient(135deg, ${ROOMS[room].wall} 50%, ${INTERIOR} 50%)` }}
        aria-pressed={now === null}
        aria-label="As built"
        title="As built"
        onClick={() => {
          if (paintRoomInView(null)) uiClick()
        }}
      />
      {PAINTS.map((p) => (
        <button
          key={p.id}
          className="deco-swatch"
          style={{ background: p.hex }}
          aria-pressed={now === p.id}
          aria-label={p.name}
          title={p.name}
          onClick={() => {
            if (paintRoomInView(p.id)) uiClick()
          }}
        />
      ))}
    </Row>
  )
}

/** The room in view's floor (free; undo goes back). */
function Floors({ room }: { room: RoomId }) {
  const shell = useFarm(() => farm.home.shell)
  const now = shell.floors[room]
  return (
    <Row label={`The ${ROOMS[room].name.toLowerCase()}'s floor`}>
      {FLOORS.map((f) => (
        <button
          key={f.id}
          className={`deco-swatch deco-floor ${f.kind}`}
          style={{ backgroundColor: f.tint }}
          aria-pressed={now === f.id}
          aria-label={f.name}
          title={f.name}
          onClick={() => {
            if (floorRoomInView(f.id)) uiClick()
          }}
        />
      ))}
    </Row>
  )
}

const TABS: { id: DecorateTab; name: string; glyph: typeof Couch }[] = [
  { id: 'things', name: 'Things', glyph: Couch },
  { id: 'walls', name: 'Walls', glyph: PaintRoller },
  { id: 'floor', name: 'Floor', glyph: SquaresFour },
]

function RoomCard() {
  useFarm(() => farm.home)
  const room = useDecorate((s) => s.room)
  const tab = useDecorate((s) => s.tab)
  const note = useDecorate((s) => s.note)
  const warn = useDecorate((s) => s.warn)
  // what is in storage, each kind once with how many
  const stored = new Map<PieceType, number>()
  for (const t of farm.home.stored) stored.set(t, (stored.get(t) ?? 0) + 1)
  return (
    <>
      <div className="deco-head">
        <div className="edit-actions deco-tabs" role="tablist" aria-label="Decorate">
          {TABS.map(({ id, name, glyph: G }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={`btn small ${tab === id ? 'leaf' : 'soft'}`}
              onClick={() => {
                uiClick()
                useDecorate.setState({ tab: id, note: null, warn: false })
              }}
            >
              <G weight="bold" /> {name}
            </button>
          ))}
        </div>
        <button
          className="btn soft deco-shop"
          aria-label="Shop"
          onClick={() => {
            uiClick()
            useHome.getState().openPanel({ kind: 'furniture' })
          }}
        >
          <img className="edit-coin" src={art('shopping-bags')} alt="" />
        </button>
      </div>
      <div className="edit-actions deco-rooms" role="group" aria-label="Rooms">
        {ROOM_ORDER.map((r) => (
          <button key={r} className={`btn small ${r === room ? 'leaf' : 'soft'}`} aria-pressed={r === room} onClick={() => useDecorate.setState({ room: r, note: null, warn: false })}>
            {SHORT[r]}
          </button>
        ))}
      </div>
      {tab === 'walls' && <Paints room={room} />}
      {tab === 'floor' && <Floors room={room} />}
      {tab === 'things' &&
        (note ? <p className={`deco-hint ${warn ? 'fit-warn' : 'fit-bad'}`}>{note}</p> : stored.size === 0 ? <p className="deco-hint">Tap a piece, a door or a window, then drag it.</p> : null)}
      {tab === 'things' && stored.size > 0 && (
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

/** The decorate mode's card, its Done button and undo (Esc or B leaves too; R turns, Delete puts away, Ctrl+Z undoes;
 *  with a doorway or a window picked the arrow keys slide it). */
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
      const opening = openingOf(id)
      if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (undo()) uiClick()
      } else if (opening && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
        e.preventDefault()
        uiClick()
        nudgeOpening(opening, e.code === 'ArrowLeft' ? -1 : 1)
      } else if (e.code === 'KeyR' && id && !opening && movable(id)) {
        uiClick()
        turnPicked(e.shiftKey ? -1 : 1)
      } else if ((e.code === 'Delete' || e.code === 'Backspace') && id && !opening) {
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
  const opening = openingOf(picked)
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
        {opening ? <OpeningCard id={opening} /> : picked ? <PickedCard id={picked} /> : <RoomCard />}
      </div>
    </>
  )
}
