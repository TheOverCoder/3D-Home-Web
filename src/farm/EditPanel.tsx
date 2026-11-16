import { useEffect } from 'react'
import { farmSound, uiClick } from '../audio/sound'
import { coarsePointer } from '../lib/device'
import { useHome } from '../store'
import { art } from '../ui/art'
import { SHOP, type ShopKind } from './decor'
import { putDown } from './DecorShop'
import { turn, useEdit } from './edit'
import { shopArtUrl } from './icons'
import { PARCELS, PLACES, bedHome, canBuyParcel, isPlant, samePlacement, type ParcelId, type PlaceId } from './layout'
import { buyLand, farm, plantOf, sendBedHome, sendHome, stockOf, storeDecor, useFarm } from './state'

// The edit mode's controls on the screen (it opens from the top corner's menu, src/ui/HudMode.tsx, or B): while it is open a
// card along the bottom that says what to do, or about what is picked — turn a place, a bed or a piece of decoration,
// send it back to where it started or put a piece away into the farm's store, buy a field — with the shop (the bag:
// decoration and fruit plants, src/farm/DecorShop.tsx) and what waits in the store to be put down; and a Done button
// where the settings were.

const Coin = () => <img className="edit-coin" src={art('coin')} alt="" />

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
          className="btn soft small"
          onClick={() => {
            uiClick()
            turn(id)
          }}
        >
          ↻ Turn{!coarsePointer && <kbd>R</kbd>}
        </button>
        {!atHome && (
          <button
            className="btn soft small"
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

/** What the drag says: green where it fits, red and why where it does not. */
function useFitLine(key: string, idle: string) {
  const drag = useEdit((s) => (s.drag?.id === key ? s.drag : null))
  const note = useEdit((s) => s.note)
  if (drag) return drag.fit.ok ? <p className="fit-ok">It fits here — let go to put it down.</p> : <p className="fit-bad">{drag.fit.reason}</p>
  if (note) return <p className="fit-bad">{note}</p>
  return <p>{idle}</p>
}

const TurnButton = ({ onTurn }: { onTurn: () => void }) => (
  <button
    className="btn soft small"
    onClick={() => {
      uiClick()
      onTurn()
    }}
  >
    ↻ Turn{!coarsePointer && <kbd>R</kbd>}
  </button>
)

function BedCard({ index }: { index: number }) {
  useFarm(() => farm.layout.beds[index])
  const status = useFitLine(`bed-${index}`, 'Drag it to a free spot, what grows in it and all.')
  const atHome = samePlacement(farm.layout.beds[index], bedHome(index))
  return (
    <>
      <h3>Raised bed</h3>
      {status}
      <div className="edit-actions">
        <TurnButton onTurn={() => turn({ kind: 'bed', index })} />
        {!atHome && (
          <button
            className="btn soft small"
            onClick={() => {
              uiClick()
              const fit = sendBedHome(index)
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

/** Puts a piece away into the farm's store: the pick goes, or the card says why it stays. */
function putAway(id: number) {
  const fit = storeDecor(id)
  if (fit.ok) {
    uiClick()
    useEdit.getState().pick(null)
  } else useEdit.getState().setNote(fit.reason ?? null)
}

function DecorCard({ id }: { id: number }) {
  useFarm((s) => s.rev)
  const d = farm.layout.decor.find((x) => x.id === id)
  const status = useFitLine(`decor-${id}`, 'Drag it to a free spot.')
  if (!d) return null
  const plant = plantOf(id)
  const fruit = plant ? stockOf(plant.kind, plant.index) : 0
  return (
    <>
      <div className="deco-head">
        <img className="decor-pic" src={shopArtUrl(d.kind)} alt="" />
        <div>
          <h3>{SHOP[d.kind].name}</h3>
          {status}
        </div>
      </div>
      <div className="edit-actions">
        <TurnButton onTurn={() => turn({ kind: 'decor', id })} />
        <button className="btn soft small" onClick={() => putAway(id)}>
          Put away{isPlant(d.kind) && fruit > 0 ? ' · picks its fruit' : ''}
          {!coarsePointer && <kbd>Del</kbd>}
        </button>
      </div>
    </>
  )
}

/** What waits in the farm's store: tap one to put it down in view. */
function Stored() {
  useFarm((s) => s.rev)
  const kinds = (Object.keys(farm.layout.stored) as ShopKind[]).filter((k) => farm.layout.stored[k] > 0)
  if (!kinds.length) return null
  return (
    <div className="deco-stored" role="group" aria-label="In your store: tap one to put it down">
      <img className="deco-box" src={art('package')} alt="" />
      {kinds.map((kind) => (
        <button
          key={kind}
          className="deco-stored-piece"
          aria-label={`${SHOP[kind].name} (${farm.layout.stored[kind]}): put it down`}
          title={SHOP[kind].name}
          onClick={() => {
            uiClick()
            putDown(kind)
          }}
        >
          <span className="item-pic">
            <img className="art" src={shopArtUrl(kind)} alt="" draggable={false} />
            <b className="qty">{farm.layout.stored[kind]}</b>
          </span>
        </button>
      ))}
    </div>
  )
}

/** The bag that opens the shop (decoration and fruit plants). */
const ShopButton = () => (
  <button
    className="btn soft deco-shop"
    aria-label="Shop: decoration and fruit trees"
    onClick={() => {
      uiClick()
      useHome.getState().openPanel({ kind: 'decor-shop', tab: 'decor' })
    }}
  >
    <img className="edit-coin" src={art('shopping-bags')} alt="" />
  </button>
)

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
            className="btn small edit-buy"
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
  const note = useEdit((s) => s.note)
  // R turns what is picked; Delete puts a piece of decoration away
  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => {
      const p = useEdit.getState().picked
      if (e.repeat || !p || useHome.getState().panel) return
      if (e.code === 'KeyR' && p.kind !== 'parcel') {
        uiClick()
        turn(p.kind === 'place' ? p.id : p.kind === 'bed' ? { kind: 'bed', index: p.index } : { kind: 'decor', id: p.id })
      } else if ((e.code === 'Delete' || e.code === 'Backspace') && p.kind === 'decor') putAway(p.id)
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
        ) : picked?.kind === 'bed' ? (
          <BedCard index={picked.index} />
        ) : picked?.kind === 'decor' ? (
          <DecorCard id={picked.id} />
        ) : (
          <>
            <div className="deco-head">
              <div>
                <h3>Edit the farm</h3>
                {note ? <p className="fit-bad">{note}</p> : <p>Drag anything to a free spot. Tap a meadow beyond the hedge to buy it.</p>}
              </div>
              <ShopButton />
            </div>
            <Stored />
            <p className="edit-how">{coarsePointer ? 'Drag the ground to look round · pinch to come closer' : 'Drag the ground to look round · scroll to come closer · R turns what you picked'}</p>
          </>
        )}
      </div>
    </>
  )
}
