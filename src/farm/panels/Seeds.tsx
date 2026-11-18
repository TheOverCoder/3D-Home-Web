import { useEffect, useMemo } from 'react'
import { farmSound, placeSound } from '../../audio/sound'
import { playGesture } from '../../lib/gestures'
import { playerState } from '../../lib/playerState'
import { useHome } from '../../store'
import { LockCorner, opensWords, useNope } from '../../ui/LockTag'
import { Purse, Shell } from '../../ui/Sheet'
import { art } from '../../ui/art'
import { Clock } from '../../ui/glyphs'
import { readyAt, span } from '../../lib/time'
import { CROPS, type CropDef, type CropId } from '../data'
import { iconUrl } from '../icons'
import { bedSpot, bedsForSeeds, bedsNear, eventSpeed, farm, plantBeds, useFarm } from '../state'
import { openFirst } from '../unlockArt'
import { cap, cropLock } from './crops'

// The seed packets: what an empty bed (and every empty bed in reach with it) is planted with. Twelve of them, from the
// lettuce's 45 seconds to the cotton's night (update-v1/missions/01-loop-economy.md): a phone shows them three to a
// row upright, more sideways (the compact grid).

/** A crop of an hour or more is for while you are away: its packet says when it will be ready, on the device's clock. */
export const LONG_CROP = 3600

/** How long a crop grows now (the week's events: the harvest festival's crops grow twice as fast), in real seconds. */
const growing = (c: CropDef) => c.growSeconds / eventSpeed('crops')

/** What a packet's time says: how long (45 s, 20 min), or for a long crop when it will be ready (21:40, tomorrow 07:10). */
export const packetTime = (c: CropDef, now = Date.now()) => (c.growSeconds >= LONG_CROP ? readyAt(growing(c), now) : span(growing(c)))

/** A seed packet: its picture, its name, how long it grows and what its seeds cost (a key on a computer) — or, not open
 *  yet at the farm's level, faded with the level it opens at across its corner (a tap shakes it). */
function SeedCard({ c, k, perBed, onChoose }: { c: CropDef; k: number | null; perBed: boolean; onChoose: (crop: CropId) => void }) {
  const lock = cropLock(c)
  const [scope, nope] = useNope<HTMLButtonElement>()
  const stock = (
    <span className={`tag farm-stock${farm.inv[c.id] ? '' : ' none'}`} title={`${farm.inv[c.id]} in the silo`} aria-label={`${farm.inv[c.id]} in the silo`}>
      <img src={iconUrl('silo')} alt="" />
      {farm.inv[c.id]}
    </span>
  )
  const time = (
    <span className="tag" title={c.growSeconds >= LONG_CROP ? `Grows ${span(growing(c))}` : undefined}>
      <Clock weight="bold" />
      {packetTime(c)}
    </span>
  )
  if (lock !== null)
    return (
      <button ref={scope} className="farm-card locked" aria-disabled="true" aria-label={`${cap(c.plural)}: ${opensWords(lock)}`} onClick={nope}>
        <LockCorner level={lock} />
        {stock}
        <img className="art" src={iconUrl(c.id)} alt="" />
        <span className="farm-card-name">{cap(c.plural)}</span>
        <span className="farm-card-tags">{time}</span>
      </button>
    )
  return (
    <button className="farm-card" disabled={farm.coins < c.seedCost} onClick={() => onChoose(c.id)}>
      {k !== null && <kbd className="farm-key">{k}</kbd>}
      {stock}
      <img className="art" src={iconUrl(c.id)} alt="" />
      <span className="farm-card-name">{cap(c.plural)}</span>
      <span className="farm-card-tags">
        {time}
        <span className="tag">
          <img src={art('coin')} alt="" />
          {c.seedCost}
          {perBed ? '/bed' : ''}
        </span>
      </span>
    </button>
  )
}

export function SeedsPanel({ bed }: { bed: number }) {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  // every empty bed within reach gets the same seeds (as far as the coins go), but one set to grow something else
  const beds = useMemo(() => bedsNear(bed, 'empty', playerState.position.x, playerState.position.z).filter((i) => i === bed || !farm.beds[i].fixed), [bed])
  // what is open first, then what a level opens next (in the order the levels come); the keys 1–9 go to the open ones
  const crops = openFirst(CROPS, cropLock)
  const open = crops.filter((c) => cropLock(c) === null)
  const choose = (crop: CropId) => {
    if (!plantBeds(bedsForSeeds(bed, crop, playerState.position.x, playerState.position.z), crop)) return
    const at = bedSpot(bed)
    const { pan, near } = placeSound(at.x, at.z)
    farmSound('plant', pan, near)
    playGesture('interact')
    close()
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = open[Number(e.key) - 1]
      if (c && farm.coins >= c.seedCost) choose(c.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  return (
    <Shell title={beds.length > 1 ? `Plant ${beds.length} beds` : 'Plant seeds'} art={art('seedling')} sub={<Purse />} onClose={close}>
      <div className="farm-grid compact">
        {crops.map((c) => {
          const k = open.indexOf(c)
          return <SeedCard key={c.id} c={c} k={k >= 0 ? k + 1 : null} perBed={beds.length > 1} onChoose={choose} />
        })}
      </div>
    </Shell>
  )
}
