import { DotsThree } from '@phosphor-icons/react/dist/csr/DotsThree'
import { Plus } from '@phosphor-icons/react/dist/csr/Plus'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { ToggleGroup } from 'radix-ui'
import { useState } from 'react'
import type { Slot } from '../../../src/farm/state'
import { art } from '../../../src/ui/art'
import { ArrowRight } from '../../../src/ui/glyphs'
import { ItemPic } from '../../../src/ui/ItemPic'
import { EASE, PRESS, SPRING } from '../../../src/ui/motion'
import type { Act } from '../../board'
import { ago, farmOf, type Farm, type IntroState } from './data'
import { Backdrop, FarmList, GearButton, MusicButton, Sheet, SettingsBody, Star } from './shared'
import './IntroB.css'

// B · the showcase: what waits for you is the hero. A sheet at the bottom (sideways on the right) holds a sunny stage
// with what came ready while you were away — each good big, with its count — and under it the farm's level, coins and
// who waits at the gate; then Continue. Several farms are pills over the stage: a touch on one swaps the stage to that
// farm. A new player's stage has the house on it, and the 20 coins they start with. Its moment: the goods drop onto the
// stage one by one and land with a squash; on Continue they leap up off the screen (to the chips of play) and the
// sheet goes down. Every rule of its CSS is under .v-intro-b.

const MOST = 4
const DROP = 0.24 // s: when the first good starts to fall

/** One good falling onto the stage: it stretches as it falls, squashes as it lands, and settles; on Continue it leaps up
 *  and away, the first one first. */
function Good({ i, going, children }: { i: number; going: boolean; children: React.ReactNode }) {
  const still = useReducedMotion()
  return (
    <m.span
      className="ib-good"
      initial={still ? { opacity: 0 } : { opacity: 0, y: -110 }}
      animate={
        going
          ? { opacity: [1, 1, 0], y: [0, 12, -520], scale: [1, 0.85, 0.7], transition: { delay: i * 0.045, duration: 0.5, times: [0, 0.2, 1], ease: ['easeOut', 'easeIn'] } }
          : still
            ? { opacity: 1 }
            : {
                opacity: [0, 1, 1, 1],
                y: [-110, 0, -8, 0],
                scaleX: [0.9, 1.14, 0.97, 1],
                scaleY: [1.12, 0.84, 1.03, 1],
                transition: { delay: DROP + i * 0.08, duration: 0.56, times: [0, 0.45, 0.72, 1], ease: ['easeIn', 'easeOut', 'easeInOut'] },
              }
      }
    >
      {children}
    </m.span>
  )
}

function Stage({ f, going }: { f: Farm; going: boolean }) {
  const w = f.waiting
  const goods = w?.goods ?? []
  const more = goods.length - MOST
  return (
    <section className={`ib-stage${f.played ? '' : ' fresh'}`} aria-label={f.played ? 'Ready on your farm' : 'Your farm'}>
      <m.h3 className="ib-ribbon" initial={{ opacity: 0, scaleX: 0.2 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ ...SPRING.pop, delay: 0.12 }}>
        {f.played ? (w ? `Ready · ${ago(w.seconds)} away` : `Farm ${f.slot}`) : 'Your own farm'}
      </m.h3>
      <span className="ib-rays" aria-hidden="true" />
      <span className="ib-floor" aria-hidden="true" />
      <div className="ib-goods">
        {f.played ? (
          <>
            {goods.slice(0, MOST).map((g, i) => (
              <Good key={g.item} i={i} going={going}>
                <ItemPic id={g.item} count={g.count} />
              </Good>
            ))}
            {more > 0 && (
              <Good i={MOST} going={going}>
                <span className="ib-more">+{more}</span>
              </Good>
            )}
            {goods.length === 0 && <span className="ib-none">Nothing new yet</span>}
          </>
        ) : (
          <Good i={0} going={going}>
            <img className="art ib-house" src={art('house-with-garden')} alt="" />
          </Good>
        )}
      </div>
    </section>
  )
}

/** The farms as pills over the stage: those with something on them, and one more place for a new farm. */
function Pills({ s, onPick, onMore }: { s: IntroState; onPick: (n: Slot) => void; onMore: () => void }) {
  const shown = s.farms.filter((f) => f.exists || f.slot === s.slot)
  const free = s.farms.find((f) => !f.exists && f.slot !== s.slot)
  return (
    <div className="ib-pills">
      <ToggleGroup.Root className="ib-pill-row" type="single" value={String(s.slot)} onValueChange={(v) => v && onPick(Number(v) as Slot)} aria-label="Your farms">
        {shown.map((f) => (
          <ToggleGroup.Item key={f.slot} value={String(f.slot)} className="ib-pill" aria-label={`Farm ${f.slot}`}>
            {f.slot === s.slot && <m.span className="ib-pill-on" layoutId="ib-pill-on" transition={SPRING.pop} />}
            <span className="ib-pill-text">
              Farm {f.slot}
              {f.exists && <small>★{f.level}</small>}
            </span>
          </ToggleGroup.Item>
        ))}
        {free && (
          <ToggleGroup.Item value={String(free.slot)} className="ib-pill ib-pill-new" aria-label={`New farm in place ${free.slot}`}>
            <Plus weight="bold" />
          </ToggleGroup.Item>
        )}
      </ToggleGroup.Root>
      <m.button className="v-intro-round small" aria-label="Your farms: files and more" onClick={onMore} {...PRESS}>
        <DotsThree weight="bold" />
      </m.button>
    </div>
  )
}

export function IntroB({ s, act }: { s: IntroState; act: Act<IntroState> }) {
  const f = farmOf(s)
  const back = f.played
  const any = s.farms.some((x) => x.exists)
  const [sheet, setSheet] = useState<'farms' | 'settings' | null>(null)
  const [going, setGoing] = useState(false)
  const go = () => {
    if (going) return
    setGoing(true)
    setTimeout(act.close, 330)
  }
  const pick = (slot: Slot) => act.set({ ...s, slot })
  return (
    <div className="v-intro-b">
      <Backdrop />
      <m.header
        className="ib-top"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16, transition: { duration: 0.18 } }}
        transition={{ ...SPRING.pop, delay: 0.05 }}
      >
        <div className="ib-logo" aria-label="3D Home">
          <img className="art" src={art('house-with-garden')} alt="" />
          <h1 aria-hidden="true">3D Home</h1>
        </div>
        <MusicButton />
        <GearButton onOpen={() => setSheet('settings')} />
      </m.header>
      <m.div
        className="ib-sheet paper"
        initial={{ opacity: 0, y: 120 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 160, transition: { delay: 0.05, duration: 0.24, ease: 'easeIn' } }}
        transition={SPRING.sheet}
      >
        {any ? (
          <Pills s={s} onPick={pick} onMore={() => setSheet('farms')} />
        ) : (
          <div className="ib-pills">
            <h2 className="ib-title">A cosy house and farm</h2>
            <m.button className="v-intro-round small" aria-label="Your farms: files and more" onClick={() => setSheet('farms')} {...PRESS}>
              <DotsThree weight="bold" />
            </m.button>
          </div>
        )}
        <AnimatePresence mode="popLayout" initial={false}>
          <m.div key={f.slot} className="ib-show" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.22, ease: EASE.out }}>
            <Stage f={f} going={going} />
            <div className="ib-facts">
              {back && <Star level={f.level} className="ib-star" />}
              <span className="tag ib-coins">
                <img src={art('coin')} alt="" />
                {f.coins.toLocaleString('en-US')}
              </span>
              {f.waiting && f.waiting.buyers > 0 && (
                <span className="tag" aria-label={`${f.waiting.buyers} buyers at the gate`}>
                  <img src={art('people-queue')} alt="" />
                  {f.waiting.buyers}
                </span>
              )}
              {f.waiting && f.waiting.orders > 0 && (
                <span className="tag" aria-label={`${f.waiting.orders} new orders`}>
                  <img src={art('clipboard')} alt="" />
                  {f.waiting.orders}
                </span>
              )}
              {!back && <span className="ib-start">to start with</span>}
            </div>
          </m.div>
        </AnimatePresence>
        <m.button
          className={`btn primary ib-go${going ? ' going' : ''}`}
          onClick={go}
          aria-label={back ? `Continue · Farm ${f.slot}` : 'Play'}
          whileTap={{ scale: 0.95, y: 3 }}
          transition={SPRING.pop}
        >
          <span>{back ? 'Continue' : 'Play'}</span>
          <ArrowRight weight="bold" />
        </m.button>
      </m.div>
      <Sheet open={sheet === 'farms'} title="Your farms" pic={art('house-with-garden')} onClose={() => setSheet(null)}>
        <FarmList
          s={s}
          onSet={act.set}
          onPick={(slot) => {
            pick(slot)
            setSheet(null)
          }}
        />
      </Sheet>
      <Sheet open={sheet === 'settings'} title="Settings" pic={art('gear')} onClose={() => setSheet(null)}>
        <SettingsBody />
      </Sheet>
    </div>
  )
}
