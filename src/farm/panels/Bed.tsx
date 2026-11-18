import { uiClick } from '../../audio/sound'
import { useHome } from '../../store'
import { LockCorner, opensWords, useNope } from '../../ui/LockTag'
import { Shell } from '../../ui/Sheet'
import { art } from '../../ui/art'
import { CROPS, type CropDef, type CropId } from '../data'
import { iconUrl } from '../icons'
import { farm, fixBed, useFarm } from '../state'
import { openFirst } from '../unlockArt'
import { cap, cropLock } from './crops'

/** What a bed always grows (its gear): one crop — the action button then buys those seeds and plants them there —
 *  or nothing set, and the seed packets open each time. Choosing is all there is: it closes. */
export function BedPanel({ bed }: { bed: number }) {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const fixed = farm.beds[bed]?.fixed ?? null
  const choose = (crop: CropId | null) => {
    fixBed(bed, crop)
    uiClick()
    close()
  }
  return (
    <Shell title="This bed grows" art={art('gear')} onClose={close}>
      <p className="farm-line">Set a crop and the button buys its seeds and plants it.</p>
      <div className="farm-grid compact">
        <button className="farm-card" aria-pressed={fixed === null} onClick={() => choose(null)}>
          <img className="art" src={art('seedling')} alt="" />
          <span className="farm-card-name">I choose</span>
        </button>
        {openFirst(CROPS, cropLock).map((c) => (
          <BedChoice key={c.id} c={c} on={fixed === c.id} onChoose={choose} />
        ))}
      </div>
    </Shell>
  )
}

/** A crop a bed can be set to grow: its picture and name; not open yet, faded with its level (a tap shakes it). */
function BedChoice({ c, on, onChoose }: { c: CropDef; on: boolean; onChoose: (crop: CropId) => void }) {
  const lock = cropLock(c)
  const [scope, nope] = useNope<HTMLButtonElement>()
  return (
    <button
      ref={scope}
      className={`farm-card${lock !== null ? ' locked' : ''}`}
      aria-pressed={on}
      aria-disabled={lock !== null || undefined}
      aria-label={lock !== null ? `${cap(c.plural)}: ${opensWords(lock)}` : undefined}
      onClick={() => (lock !== null ? nope() : onChoose(c.id))}
    >
      {lock !== null && <LockCorner level={lock} />}
      <img className="art" src={iconUrl(c.id)} alt="" />
      <span className="farm-card-name">{cap(c.plural)}</span>
    </button>
  )
}
