import { useEffect } from 'react'
import { farmSound, uiClick } from '../audio/sound'
import { coarsePointer } from '../lib/device'
import { busy, useHome } from '../store'
import { iconUrl } from './icons'
import { turn, useEdit } from './edit'
import { PARCELS, PLACES, canBuyParcel, samePlacement, type ParcelId, type PlaceId } from './layout'
import { buyLand, farm, sendHome, useFarm } from './state'

// The edit mode's controls on the screen: the button that opens it (beside the settings), and while it is open a
// card along the bottom that says what to do, or about what is picked — turn a place, send it back to where it
// started, buy a field — and a Done button where the settings were.

const MoveGlyph = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v18M3 12h18" />
    <path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />
  </svg>
)

/** Opens the edit mode (B). */
export function EditButton() {
  const phase = useHome((s) => s.phase)
  const occupied = useHome(busy)
  if (phase !== 'playing' || occupied) return null
  return (
    <button className="gear edit-open" onClick={() => useHome.getState().setEditing(true)} aria-label="Edit the farm: move things, buy land (B)" title="Edit the farm (B)">
      <MoveGlyph />
    </button>
  )
}

const Coin = () => <img className="edit-coin" src={iconUrl('coin', 40)} alt="" />

function PlaceCard({ id }: { id: PlaceId }) {
  useFarm(() => farm.layout.places[id])
  const drag = useEdit((s) => (s.drag?.id === id ? s.drag : null))
  const note = useEdit((s) => s.note)
  const def = PLACES[id]
  const atHome = samePlacement(farm.layout.places[id], def.home)
  let status = <p>Drag it to a free spot: its outline turns green where it fits.</p>
  if (drag) status = drag.fit.ok ? <p className="fit-ok">It fits here — let go to put it down.</p> : <p className="fit-bad">{drag.fit.reason}</p>
  else if (note) status = <p className="fit-bad">{note}</p>
  return (
    <>
      <h3>{def.name}</h3>
      {status}
      <div className="edit-actions">
        <button
          className="farm-secondary"
          onClick={() => {
            uiClick()
            turn(id)
          }}
        >
          ↻ Turn{!coarsePointer && <kbd>R</kbd>}
        </button>
        {!atHome && (
          <button
            className="farm-secondary"
            onClick={() => {
              uiClick()
              const fit = sendHome(id)
              useEdit.getState().setNote(fit.ok ? null : `Its first spot is taken: ${fit.reason?.toLowerCase()}`)
            }}
          >
            Back to its first spot
          </button>
        )}
      </div>
    </>
  )
}

function ParcelCard({ id }: { id: ParcelId }) {
  useFarm((s) => s.rev)
  const def = PARCELS[id]
  const owned = farm.layout.land.includes(id)
  const open = canBuyParcel(farm.layout, id)
  const afford = farm.coins >= def.price
  const first = def.after?.map((a) => PARCELS[a].name.toLowerCase()).join(' or the ')
  return (
    <>
      <h3>{def.name}</h3>
      {owned ? (
        <p className="fit-ok">It is yours: move things onto it.</p>
      ) : !open ? (
        <p>Next to land you have not got yet: buy the {first} first.</p>
      ) : (
        <p>Twelve metres of open ground beyond the hedge: room to move things onto. The hedge and the woods move out round it.</p>
      )}
      {!owned && open && (
        <div className="edit-actions">
          <button
            className="primary"
            disabled={!afford}
            onClick={() => {
              if (buyLand(id)) {
                farmSound('build', 0, 1)
                useEdit.getState().pick(null)
              }
            }}
          >
            Buy · <Coin /> {def.price}
          </button>
          {!afford && <span className="edit-short">You have {farm.coins}</span>}
        </div>
      )}
    </>
  )
}

/** The edit mode's card and its Done button (Esc or B leaves too). */
export function EditPanel() {
  const editing = useHome((s) => s.editing)
  const picked = useEdit((s) => s.picked)
  // R turns the picked place
  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => {
      const p = useEdit.getState().picked
      if (e.code === 'KeyR' && !e.repeat && p?.kind === 'place') {
        uiClick()
        turn(p.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])
  if (!editing) return null
  return (
    <>
      <button className="edit-done primary" onClick={() => useHome.getState().setEditing(false)}>
        Done{!coarsePointer && <kbd>B</kbd>}
      </button>
      <div className="edit-card" role="region" aria-label="Edit the farm">
        {picked?.kind === 'place' ? (
          <PlaceCard id={picked.id} />
        ) : picked?.kind === 'parcel' ? (
          <ParcelCard id={picked.id} />
        ) : (
          <>
            <h3>Edit the farm</h3>
            <p>Drag the hen run, the pasture, the sheep fold or a tree to a free spot. Tap a meadow beyond the hedge to buy it.</p>
            <p className="edit-how">{coarsePointer ? 'Drag the ground to look round · pinch to come closer' : 'Drag the ground to look round · scroll to come closer · R turns what you picked'}</p>
          </>
        )}
      </div>
    </>
  )
}
