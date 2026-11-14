import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown'
import { m } from 'motion/react'
import { useState } from 'react'
import { art } from '../../../src/ui/art'
import { ArrowRight } from '../../../src/ui/glyphs'
import { ItemPic } from '../../../src/ui/ItemPic'
import { EASE, PRESS, SPRING } from '../../../src/ui/motion'
import type { Act } from '../../board'
import { ago, farmOf, type Farm, type IntroState } from './data'
import { Backdrop, FarmList, GearButton, MusicButton, Sheet, SettingsBody, Star } from './shared'
import './IntroA.css'

// A · the title: a game's own title screen. The logo is the hero over your farm; at the bottom, under the thumb, one
// dock: the farm you go back to (its level, its coins, what is ready, in pictures) and the big button. Music and
// settings are two small round buttons at the top. The farms open from the farm's name. Its moment: the letters of the
// name drop in one by one and bounce; a press sends the logo up and the dock down while the scene pulls back into
// play. Every rule of its CSS is under .v-intro-a.

const NAME = '3D Home'.split('')
const MOST = 4 // goods shown in the dock; the rest is a "+n"

const letter = {
  hidden: { opacity: 0, y: -46, scale: 0.6 },
  shown: { opacity: 1, y: 0, scale: 1, transition: SPRING.pop },
  gone: { opacity: 0, y: -30, transition: { duration: 0.18, ease: 'easeIn' } },
} as const

function Dock({ f, farms, onFarms }: { f: Farm; farms: number; onFarms: () => void }) {
  const w = f.waiting
  const goods = w?.goods ?? []
  const more = goods.length - MOST
  return (
    <div className="ia-farm paper">
      <m.button className="ia-farm-name" onClick={onFarms} aria-label={`Farm ${f.slot}: your farms`} {...PRESS}>
        <Star level={f.level} />
        <span>
          <strong>Farm {f.slot}</strong>
          <small className={w ? 'ia-away' : ''}>{w ? `${ago(w.seconds)} away` : `${farms} farm${farms === 1 ? '' : 's'}`}</small>
        </span>
        {farms > 1 && <b className="ia-count">{farms}</b>}
        <CaretDown weight="bold" />
      </m.button>
      <span className="tag ia-coins">
        <img src={art('coin')} alt="" />
        {f.coins.toLocaleString('en-US')}
      </span>
      {w && (
        <m.div className="ia-ready" aria-label="Ready on your farm" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.045, delayChildren: 0.42 } } }}>
          {goods.slice(0, MOST).map((g) => (
            <m.span key={g.item} variants={POP}>
              <ItemPic id={g.item} count={g.count} />
            </m.span>
          ))}
          {more > 0 && (
            <m.span className="ia-more" variants={POP}>
              +{more}
            </m.span>
          )}
          {w.buyers > 0 && (
            <m.span className="item-pic ia-buyers" variants={POP} aria-label={`${w.buyers} buyers at the gate`}>
              <img className="art" src={art('people-queue')} alt="" />
              <b className="qty">{w.buyers}</b>
            </m.span>
          )}
        </m.div>
      )}
    </div>
  )
}

const POP = { hidden: { opacity: 0, scale: 0.4, y: 8 }, shown: { opacity: 1, scale: 1, y: 0, transition: SPRING.pop } } as const

export function IntroA({ s, act }: { s: IntroState; act: Act<IntroState> }) {
  const f = farmOf(s)
  const back = f.played
  const [sheet, setSheet] = useState<'farms' | 'settings' | null>(null)
  const [going, setGoing] = useState(false)
  const go = () => {
    if (going) return
    setGoing(true)
    setTimeout(act.close, 150)
  }
  return (
    <div className="v-intro-a">
      <Backdrop />
      <m.div className="ia-top" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={{ delay: 0.5, duration: 0.3 }}>
        <MusicButton />
        <GearButton onOpen={() => setSheet('settings')} />
      </m.div>
      <m.div
        className="ia-logo"
        initial="hidden"
        animate="shown"
        exit="gone"
        variants={{ shown: { transition: { staggerChildren: 0.04, delayChildren: 0.16 } }, gone: { transition: { staggerChildren: 0.02 } } }}
      >
        <m.div
          className="ia-house"
          variants={{
            hidden: { opacity: 0, scale: 0.3, y: 30 },
            shown: { opacity: 1, scale: 1, y: 0, transition: SPRING.soft },
            gone: { opacity: 0, y: -60, scale: 0.8, transition: { duration: 0.22, ease: 'easeIn' } },
          }}
        >
          <img className="art" src={art('house-with-garden')} alt="" />
        </m.div>
        <h1 aria-label="3D Home">
          {NAME.map((c, i) => (
            <m.span key={i} variants={letter} aria-hidden="true">
              {c}
            </m.span>
          ))}
        </h1>
        <m.p variants={{ hidden: { opacity: 0, y: 6 }, shown: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE.out } }, gone: { opacity: 0, transition: { duration: 0.12 } } }}>
          {back ? 'Welcome back' : 'A cosy house and farm'}
        </m.p>
      </m.div>
      <m.div
        className="ia-dock"
        initial={{ opacity: 0, y: 70 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 90, transition: { duration: 0.24, ease: 'easeIn' } }}
        transition={{ ...SPRING.sheet, delay: 0.1 }}
      >
        {back && <Dock f={f} farms={s.farms.filter((x) => x.exists).length} onFarms={() => setSheet('farms')} />}
        <m.button
          className={`btn primary ia-go${going ? ' going' : ''}`}
          onClick={go}
          aria-label={back ? `Continue · Farm ${f.slot}` : 'Play'}
          whileTap={{ scale: 0.95, y: 3 }}
          animate={going ? { scale: [0.95, 1.06, 1], transition: { duration: 0.3, ease: EASE.out } } : undefined}
          transition={SPRING.pop}
        >
          <span>{back ? 'Continue' : 'Play'}</span>
          <ArrowRight weight="bold" />
        </m.button>
        {!back && (
          <m.button className="ia-quiet" onClick={() => setSheet('farms')} {...PRESS}>
            <img src={art('floppy-disk')} alt="" />
            Farms
          </m.button>
        )}
      </m.div>
      <Sheet open={sheet === 'farms'} title="Your farms" pic={art('house-with-garden')} onClose={() => setSheet(null)}>
        <FarmList
          s={s}
          onSet={act.set}
          onPick={(slot) => {
            act.set({ ...s, slot })
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
