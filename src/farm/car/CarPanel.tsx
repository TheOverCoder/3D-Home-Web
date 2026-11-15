import { uiClick } from '../../audio/sound'
import { walkTo } from '../../lib/route/walking'
import { travel } from '../../scene/travel'
import { useHome } from '../../store'
import { Shell } from '../../ui/Sheet'
import { art, type ArtId } from '../../ui/art'
import { CarProfile, Check, LockSimple, NavigationArrow } from '../../ui/glyphs'
import { ESTATE } from '../data'
import { farm, useFarm, type Place } from '../state'

// The car's sheet (its talk): where it drives you. The house — once it is yours (bought from the estate agent by the
// market), Drive; before, locked, saying where it is sold and for how much, with the way there — and the farm. The map
// you are on says "You are here". Drive starts the trip (src/scene/travel.ts) and closes the sheet.

/** The car's two places: their names and pictures. */
const PLACES: Record<Place, { name: string; art: ArtId }> = {
  home: { name: 'The house', art: 'house' },
  farm: { name: 'The farm', art: 'sheaf-of-rice' },
}

/** The estate agent's interactable (src/farm/Estate.tsx): where "Go there" walks you. */
export const AGENT_ID = 'farm-estate-agent'

function Destination({ to }: { to: Place }) {
  const close = useHome((s) => s.closePanel)
  const here = farm.place === to
  const locked = to === 'home' && !farm.apartment.owned
  const p = PLACES[to]
  const drive = () => {
    if (!travel(to)) return
    uiClick()
    close()
  }
  const goThere = () => {
    close()
    walkTo(AGENT_ID)
  }
  return (
    <div className={`farm-shop-item${here ? ' owned' : ''}`}>
      <img className="art" src={art(p.art)} alt="" />
      <div className="farm-shop-text">
        <strong>{p.name}</strong>
        <div className="farm-shop-tags">
          {here && (
            <span className="tag ok">
              <Check weight="bold" />
              You are here
            </span>
          )}
          {!here && !locked && to === 'home' && (
            <span className="tag ok">
              <Check weight="bold" />
              Yours
            </span>
          )}
          {locked && (
            <>
              <span className="tag short" title="The house is sold at the estate office by the market">
                <LockSimple weight="bold" />
                Estate office
              </span>
              <span className="tag" title={`It costs ${ESTATE.price} coins`}>
                <img src={art('coin')} alt="" />
                {ESTATE.price}
              </span>
            </>
          )}
        </div>
      </div>
      {locked ? (
        <button className="btn small soft" onClick={goThere} aria-label="Walk to the estate office, where the house is sold">
          <NavigationArrow weight="fill" />
          Go there
        </button>
      ) : (
        <button className="btn small" disabled={here} onClick={drive} aria-label={here ? `${p.name}: you are here` : `Drive to ${p.name.toLowerCase()}`}>
          {here ? (
            <Check weight="bold" />
          ) : (
            <>
              <CarProfile weight="fill" />
              Drive
            </>
          )}
        </button>
      )}
    </div>
  )
}

/** The car: the house and the farm, each with Drive (or where you are, or the way to buy the house). */
export function CarPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  return (
    <Shell title="The car" art={art('automobile')} sub={<span className="tag">{farm.place === 'home' ? 'At the house' : 'On the farm'}</span>} onClose={close}>
      {!farm.apartment.owned && <p className="farm-line">The house is for sale by the market.</p>}
      <div className="farm-list">
        <Destination to="home" />
        <Destination to="farm" />
      </div>
    </Shell>
  )
}
