import { useEffect, useState } from 'react'
import { uiClick } from '../audio/sound'
import { useHome } from '../store'
import { registerCard } from '../ui/cardQueue'
import { Shell } from '../ui/Sheet'
import { art, type ArtId } from '../ui/art'
import { iconUrl } from './icons'
import { cap } from './panels/crops'
import { cropById } from './data'
import type { SeasonView } from './season'
import { arrivalShown, seasonArrival } from './state'

// A season's arrival on the farm (mission 10 c7): one card, once a season, after the welcome back and the day's gift on
// the card queue (src/ui/cardQueue.ts, 'season'): its picture, "Autumn on the farm", its crops (a quarter more sown now)
// and one button. Shown, it is told: it never comes again for that season. The look is SeasonArrival, fed with data.

/** The card's look, fed with a season (the lab shows it as it is). */
export function SeasonArrival({ v, onClose }: { v: SeasonView; onClose: () => void }) {
  return (
    <Shell title={`${v.name} on the farm`} art={art(v.pic as ArtId)} className="season-card" onClose={onClose}>
      <p className="season-card-line">In season now, a quarter more from each bed:</p>
      <div className="farm-basket">
        {v.crops.map((c) => (
          <div key={c} className="farm-basket-item">
            <img className="art" src={iconUrl(c)} alt="" />
            <span>{cap(cropById(c).plural)}</span>
          </div>
        ))}
      </div>
      <button className="btn leaf" onClick={onClose}>
        Lovely
      </button>
    </Shell>
  )
}

export function SeasonPanel() {
  const close = useHome((s) => s.closePanel)
  // (the season it opened with: telling it changes what is due)
  const [v] = useState(seasonArrival)
  useEffect(() => {
    if (!v) close()
    else arrivalShown()
  }, [v, close])
  if (!v) return null
  return (
    <SeasonArrival
      v={v}
      onClose={() => {
        uiClick()
        close()
      }}
    />
  )
}

/** The arrival on the card queue: due while a season began that the farm has not shown. */
export function SeasonWatcher() {
  useEffect(
    () =>
      registerCard('season', {
        due: () => seasonArrival() !== null,
        open: () => useHome.getState().openPanel({ kind: 'season' }),
        showing: () => useHome.getState().panel?.kind === 'season',
      }),
    [],
  )
  return null
}
