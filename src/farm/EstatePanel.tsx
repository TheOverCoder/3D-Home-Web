import { AGENT_SEAT } from '../data/estate'
import { playGesture } from '../lib/gestures'
import { walkTo } from '../lib/route/walking'
import { useHome } from '../store'
import { Coins, Purse, Shell, useArmed } from '../ui/Sheet'
import { art } from '../ui/art'
import { Check, Clock, NavigationArrow } from '../ui/glyphs'
import { AGENT, talk } from '../talk/speech'
import { KeepTag } from './ContractorPanel'
import { ESTATE } from './data'
import { clockOf, hoursText, opensAt } from './day'
import { agentHere, buyApartment, estateOpen, farm, useFarm } from './state'

// The estate office's panels (src/farm/Estate.tsx opens them): the agent's — the house for sale, its picture and its
// price, whose price opens the card; once it is yours, that it is, and the way to the car — and the card that asks
// before the house is bought (Cancel, and Buy with its price, armed after a moment).

/** The car on the farm's interactable (src/farm/car/Car.tsx): where "Go to the car" walks you. */
const CAR_ID = 'car-farm'

/** The office's hours, as a chip. */
const HoursTag = () => (
  <span className="tag" title="The estate office's opening hours">
    <Clock weight="bold" />
    {hoursText('estate')}
  </span>
)

/** The estate agent: the house for sale (its picture, what it waits for — the coins — and its price, which opens the
 *  card), or, once it is yours, that it is, and the way to the car that drives you there. */
export function EstatePanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const openPanel = useHome((s) => s.openPanel)
  const owned = farm.apartment.owned
  const price = ESTATE.price
  const toCar = () => {
    close()
    walkTo(CAR_ID)
  }
  return (
    <Shell
      title="The estate agent"
      art={art('man-office-worker')}
      sub={
        <>
          <Purse />
          <HoursTag />
        </>
      }
      onClose={close}
    >
      {owned ? (
        <>
          <p className="farm-line">The house is yours.</p>
          <div className="farm-shop-item">
            <img className="art" src={art('house')} alt="" />
            <div className="farm-shop-text">
              <strong>The house</strong>
              <div className="farm-shop-tags">
                <span className="tag ok">
                  <Check weight="bold" />
                  Yours
                </span>
              </div>
            </div>
            <button className="btn small" onClick={toCar}>
              <NavigationArrow weight="fill" />
              To the car
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="farm-line">A house of your own, a drive from the farm.</p>
          <div className="farm-upgrade market-buy-row">
            <div className="farm-upgrade-head">
              <img className="art" src={art('house')} alt="" />
              <strong>The house</strong>
            </div>
            <div className="farm-needs">
              <KeepTag pic={art('coin')} have={farm.coins} need={price} title={`It costs ${price} coins`} />
            </div>
            <button className="btn small farm-upgrade-go" onClick={() => openPanel({ kind: 'house-buy' })} aria-label={`Buy the house for ${price} coins`}>
              <Coins n={price} />
            </button>
          </div>
        </>
      )}
    </Shell>
  )
}

/** The card that asks before the house is bought: what you get, Cancel, and Buy with its price (it arms after a
 *  moment). Bought, the card closes: the keys are yours, and the car drives you there. Out of the agent's hours it
 *  says when he is back. */
export function HouseBuyPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const armed = useArmed()
  const price = ESTATE.price
  const here = agentHere()
  const owned = farm.apartment.owned
  const afford = farm.coins >= price
  const confirm = () => {
    if (!armed || !buyApartment()) return
    playGesture('interact')
    close()
    // the agent hands you the keys (src/talk)
    talk('agent-sold', AGENT, AGENT_SEAT)
  }
  return (
    <Shell title="Buy the house" art={art('house')} sub={<Purse />} onClose={close}>
      <p className="farm-line">Its keys are yours, and the car drives you there.</p>
      <div className="farm-confirm">
        <button className="btn soft" onClick={close}>
          Cancel
        </button>
        <button className={`btn farm-buy${armed ? '' : ' arming'}`} disabled={owned || !here || !afford} aria-disabled={!armed} onClick={confirm}>
          {owned ? (
            'Yours'
          ) : !here ? (
            estateOpen() ? (
              'On his way in'
            ) : (
              `Opens at ${clockOf(opensAt('estate'))}`
            )
          ) : afford ? (
            <>
              Buy · <Coins n={price} />
            </>
          ) : (
            <>Needs {price - farm.coins} more</>
          )}
        </button>
      </div>
    </Shell>
  )
}
