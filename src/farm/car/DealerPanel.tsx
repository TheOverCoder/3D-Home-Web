import { useState } from 'react'
import { farmSound, uiClick } from '../../audio/sound'
import { useHome } from '../../store'
import { LockTag } from '../../ui/LockTag'
import { Coins, Purse, Shell, useArmed } from '../../ui/Sheet'
import { art } from '../../ui/art'
import { Check } from '../../ui/glyphs'
import { CAR_PAINTS, PAINT_IDS, type PaintId } from '../carPaints'
import { buyPaint, farm, lockOf, paintProblem, useFarm, wearPaint } from '../state'

// The car dealer's sheet (Lane Motors, update-v1/missions/11-buildings.md c10; the seller's talk: src/farm/Dealer.tsx):
// the paints for your car, each a swatch with its name — the one worn marked, one owned put on with a tap (free), one
// for sale its price (a card that asks first, its Buy armed a moment after it opens), one not open yet faded with the
// level it opens at. Your car wears it on both maps and in the drive's film.

/** One paint's row: its swatch, its name, and what a tap does (worn; Wear; its price; its lock). */
function PaintRow({ id, onPick }: { id: PaintId; onPick: (id: PaintId) => void }) {
  const p = CAR_PAINTS[id]
  const owned = farm.car.owned.includes(id)
  const worn = farm.car.worn === id
  const lock = lockOf(`paint:${id}`)
  return (
    <div className={`farm-shop-item dealer-paint${worn ? ' owned' : ''}${lock !== null && !owned ? ' locked' : ''}`}>
      <span className="dealer-swatch" style={{ background: p.hex }} aria-hidden="true" />
      <div className="farm-shop-text">
        <strong>{p.name}</strong>
        <div className="farm-shop-tags">
          {worn && (
            <span className="tag ok">
              <Check weight="bold" />
              On your car
            </span>
          )}
          {owned && !worn && <span className="tag">Yours</span>}
          {!owned && lock !== null && <LockTag level={lock} />}
        </div>
      </div>
      {worn ? null : owned ? (
        <button
          className="btn small soft"
          onClick={() => {
            if (wearPaint(id)) uiClick()
          }}
        >
          Wear
        </button>
      ) : lock === null ? (
        <button className="btn small" onClick={() => onPick(id)} aria-label={`${p.name}: ${p.price} coins`}>
          <img className="tag-coin" src={art('coin')} alt="" />
          {p.price}
        </button>
      ) : null}
    </div>
  )
}

/** The card that asks before a paint is bought: its swatch, its price and what you have, Cancel or Buy. */
function BuyPaint({ id, onBack }: { id: PaintId; onBack: () => void }) {
  const armed = useArmed()
  const p = CAR_PAINTS[id]
  const problem = paintProblem(id)
  const buy = () => {
    if (!armed || problem !== null) return
    if (!buyPaint(id)) return
    farmSound('build', 0, 1)
    onBack()
  }
  return (
    <>
      <div className="dealer-buy">
        <span className="dealer-swatch big" style={{ background: p.hex }} aria-hidden="true" />
        <p className="farm-line">{p.name} for your car, on both maps.</p>
      </div>
      <div className="farm-confirm">
        <button className="btn soft" onClick={onBack}>
          Cancel
        </button>
        <button className={`btn farm-buy${armed ? '' : ' arming'}`} disabled={problem === 'coins'} aria-disabled={!armed} onClick={buy}>
          {problem === 'coins' ? (
            <>Needs {p.price - farm.coins} more</>
          ) : (
            <>
              Buy · <Coins n={p.price} />
            </>
          )}
        </button>
      </div>
    </>
  )
}

/** Lane Motors: your car's paints. */
export function DealerPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const [buying, setBuying] = useState<PaintId | null>(null)
  return (
    <Shell title={buying ? CAR_PAINTS[buying].name : 'Lane Motors'} art={art('automobile')} sub={<Purse />} onClose={buying ? () => setBuying(null) : close}>
      {buying ? (
        <BuyPaint id={buying} onBack={() => setBuying(null)} />
      ) : (
        <>
          <p className="farm-line">Paint for your car.</p>
          <div className="farm-list">
            {PAINT_IDS.map((id) => (
              <PaintRow
                key={id}
                id={id}
                onPick={(pick) => {
                  uiClick()
                  setBuying(pick)
                }}
              />
            ))}
          </div>
        </>
      )}
    </Shell>
  )
}
