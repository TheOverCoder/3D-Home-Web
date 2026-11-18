import { useEffect, useState } from 'react'
import { farmSound, placeSound } from '../../audio/sound'
import { playGesture } from '../../lib/gestures'
import { useHome } from '../../store'
import { LockTag } from '../../ui/LockTag'
import { ARM_MS, Coins, Purse, Shell } from '../../ui/Sheet'
import { art } from '../../ui/art'
import { BEDS, EXPANSIONS } from '../data'
import { iconUrl } from '../icons'
import { dustOver } from '../shop/ShopPanel'
import { buildBed, buy, farm, lockOf, useFarm } from '../state'

/** Spending coins on the farm itself (a bed, a field) always asks first: what it is, what it costs, what you have,
 *  and a Build button that only arms after a moment — never on the button you press to water or harvest. */
export function BuildPanel({ bed }: { bed: number }) {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), ARM_MS)
    return () => clearTimeout(t)
  }, [])
  const def = BEDS[bed]
  const field = def.expansion ? EXPANSIONS[def.expansion] : null
  const title = field ? field.name : 'A new bed'
  const blurb = field ? field.blurb : 'One more raised bed to plant in.'
  const price = field ? field.price : (def.price ?? 0)
  const afford = farm.coins >= price
  // a field not open yet at the farm's level: the card says when, where its Build was
  const lock = lockOf(def.expansion ? `upgrade:${def.expansion}` : 'bed')
  const confirm = () => {
    if (!armed || !afford || lock !== null) return
    const ok = def.expansion ? buy(def.expansion) : buildBed(bed)
    if (!ok) return
    const { pan, near } = placeSound(def.x, def.z)
    farmSound('build', pan, near)
    dustOver(def.expansion ? BEDS.filter((b) => b.expansion === def.expansion) : [def])
    playGesture('interact')
    close()
  }
  return (
    <Shell title={title} art={field ? iconUrl('wheat') : art('hammer')} sub={<Purse />} onClose={close}>
      <p className="farm-line">{blurb}</p>
      <div className="farm-confirm">
        <button className="btn soft" onClick={close}>
          Not now
        </button>
        {lock !== null ? (
          <span role="note" className="farm-lock">
            <LockTag big level={lock} words={`Opens at level ${lock}`} />
          </span>
        ) : (
          <button className={`btn farm-buy${armed ? '' : ' arming'}`} disabled={!afford} aria-disabled={!armed} onClick={confirm}>
            {afford ? (
              <>
                Build · <Coins n={price} />
              </>
            ) : (
              <>Needs {price - farm.coins} more</>
            )}
          </button>
        )}
      </div>
    </Shell>
  )
}
