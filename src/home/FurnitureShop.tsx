import { useEffect, useState } from 'react'
import { farmSound, uiClick } from '../audio/sound'
import { farm, useFarm } from '../farm/state'
import { useHome } from '../store'
import { art } from '../ui/art'
import { ARM_MS, Coins, Purse, Shell } from '../ui/Sheet'
import { PIECES, PIECE_TYPES, isPieceType, type PieceDef, type PieceType } from './catalogue'
import { buyFurniture } from './decorate'
import { pieceUrl } from './pictures'

// The furniture shop (decorating, the bag on the card): every piece for sale by kind, each with its picture, name and
// price. A piece opens its card first — what it is, what it costs, Cancel or Buy (armed a moment after it opens) —
// and once bought it stands at the free spot nearest the middle of the room in view, picked, so a drag moves it on
// (with no room it waits in storage).

const GROUPS: { id: PieceDef['group']; name: string }[] = [
  { id: 'seating', name: 'Seating' },
  { id: 'tables', name: 'Tables' },
  { id: 'storage', name: 'Storage' },
  { id: 'beds', name: 'Beds' },
  { id: 'plants', name: 'Plants' },
  { id: 'rugs', name: 'Rugs' },
]

const metres = (n: number) => `${Math.round(n * 10) / 10} m`

export function FurnitureShop() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const open = useHome((s) => s.openPanel)
  const forSale = PIECE_TYPES.filter((t) => PIECES[t].price > 0)
  return (
    <Shell title="Furniture" art={art('shopping-bags')} sub={<Purse />} onClose={close}>
      {GROUPS.map((g) => {
        const types = forSale.filter((t) => PIECES[t].group === g.id)
        if (!types.length) return null
        return (
          <section key={g.id} className="deco-shop-group">
            <h3>{g.name}</h3>
            <div className="farm-grid compact">
              {types.map((t) => (
                <button
                  key={t}
                  className="farm-card"
                  onClick={() => {
                    uiClick()
                    open({ kind: 'buy-piece', type: t })
                  }}
                >
                  <img className="art" src={pieceUrl(t)} alt="" />
                  <span className="farm-card-name">{PIECES[t].name}</span>
                  <span className="farm-card-tags">
                    <span className="tag">
                      <img src={art('coin')} alt="" />
                      {PIECES[t].price}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </Shell>
  )
}

/** Buying one piece always asks first: its picture, its size, what it costs and what you have, Cancel or Buy. */
export function BuyPiece({ type }: { type: string }) {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const open = useHome((s) => s.openPanel)
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), ARM_MS)
    return () => clearTimeout(t)
  }, [])
  if (!isPieceType(type)) return null
  const def = PIECES[type as PieceType]
  const afford = farm.coins >= def.price
  const buy = () => {
    if (!armed || !afford) return
    close()
    // it stands in the room in view, picked; with no room there it waits in storage (the card says so)
    if (buyFurniture(type)) farmSound('build', 0, 1)
  }
  return (
    <Shell title={def.name} art={pieceUrl(type)} sub={<Purse />} onClose={() => open({ kind: 'furniture' })}>
      <div className="farm-shop-tags">
        <span className="tag">
          {metres(def.size[0])} × {metres(def.size[2])}
        </span>
      </div>
      <p className="farm-line">It goes in the room you are looking at, ready to drag.</p>
      <div className="farm-confirm">
        <button className="btn soft" onClick={() => open({ kind: 'furniture' })}>
          Cancel
        </button>
        <button className={`btn farm-buy${armed ? '' : ' arming'}`} disabled={!afford} aria-disabled={!armed} onClick={buy}>
          {afford ? (
            <>
              Buy · <Coins n={def.price} />
            </>
          ) : (
            <>Needs {def.price - farm.coins} more</>
          )}
        </button>
      </div>
    </Shell>
  )
}
