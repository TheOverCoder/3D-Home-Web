import { ArrowCounterClockwise } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise'
import { DotsThree } from '@phosphor-icons/react/dist/csr/DotsThree'
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple'
import { MusicNotes } from '@phosphor-icons/react/dist/csr/MusicNotes'
import { UploadSimple } from '@phosphor-icons/react/dist/csr/UploadSimple'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { Switch, ToggleGroup } from 'radix-ui'
import { useEffect, useState, type ReactNode } from 'react'
import type { Slot } from '../../../src/farm/state'
import { art } from '../../../src/ui/art'
import { Check, GearSix, X } from '../../../src/ui/glyphs'
import { EASE, PRESS, SPRING } from '../../../src/ui/motion'
import yardTall from '../../stills/yard-upright.jpg'
import yardWide from '../../stills/yard-sideways.jpg'
import { cleared, savedAgo, type Farm, type IntroState } from './data'
import './shared.css'

// What the three proposals share, so they differ only in what matters (hierarchy, layout, motion): the scene behind,
// the music and settings buttons, the sheet they open, and the list of farms with its file menu. Every rule of
// ./shared.css is under .v-intro-….

/** Wider than tall: two columns, sheets on the right. */
export function useWide() {
  const [wide, setWide] = useState(() => innerWidth > innerHeight)
  useEffect(() => {
    const fit = () => setWide(innerWidth > innerHeight)
    addEventListener('resize', fit)
    return () => removeEventListener('resize', fit)
  }, [])
  return wide
}

/** The scene behind: the farm, close and warm while the screen is open. Going out it pulls back to the view of play
 *  (the frame's own still, the HUD over it) and lets it through, so the press reads as walking into the farm. */
export function Backdrop() {
  const wide = useWide()
  return (
    <m.div className="v-intro-bg" aria-hidden="true" initial={false} exit={{ opacity: 0, transition: { delay: 0.42, duration: 0.18 } }}>
      <m.img
        className="v-intro-bg-pic"
        src={wide ? yardWide : yardTall}
        alt=""
        initial={{ scale: 1.46 }}
        animate={{ scale: 1.36 }}
        exit={{ scale: 1, transition: { duration: 0.55, ease: EASE.sheet } }}
        transition={{ duration: 1.6, ease: EASE.out }}
      />
      <m.div className="v-intro-bg-wash" exit={{ opacity: 0, transition: { duration: 0.4, ease: 'easeIn' } }} />
      <Motes />
    </m.div>
  )
}

/** A few specks of light rising slowly through the warm air: the screen is alive while it waits (none for reduced
 *  motion). */
const Motes = () => (
  <div className="v-intro-motes">
    {Array.from({ length: 7 }, (_, i) => (
      <i key={i} style={{ left: `${8 + i * 13}%`, animationDelay: `${-i * 1.9}s`, animationDuration: `${11 + (i % 3) * 3}s` }} />
    ))}
  </div>
)

/** Music on or off: a round button whose notes dance while it plays. */
export function MusicButton({ className = '' }: { className?: string }) {
  const [on, setOn] = useState(false)
  return (
    <m.button className={`v-intro-round${on ? ' on' : ''} ${className}`} aria-label={on ? 'Music on' : 'Music off'} aria-pressed={on} onClick={() => setOn(!on)} {...PRESS}>
      <MusicNotes weight="fill" />
      <span className="v-intro-eq" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </m.button>
  )
}

export function GearButton({ onOpen, className = '' }: { onOpen: () => void; className?: string }) {
  return (
    <m.button className={`v-intro-round ${className}`} aria-label="Settings" onClick={onOpen} {...PRESS}>
      <GearSix weight="fill" />
    </m.button>
  )
}

/** A sheet over the screen, as every sheet of the game: from the bottom upright, from the right sideways; a swipe down
 *  (sideways: right) or a touch outside closes it. */
export function Sheet({ open, title, pic, onClose, children }: { open: boolean; title: string; pic: string; onClose: () => void; children: ReactNode }) {
  const wide = useWide()
  const still = useReducedMotion()
  const off = wide ? { x: '105%' } : { y: '105%' }
  return (
    <AnimatePresence>
      {open && (
        <m.div className="v-intro-scrim" key="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={onClose}>
          <m.div
            className={`v-intro-sheet paper${wide ? ' wide' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            initial={still ? { opacity: 0 } : off}
            animate={still ? { opacity: 1 } : { x: 0, y: 0 }}
            exit={still ? { opacity: 0 } : { ...off, transition: { duration: 0.22, ease: 'easeIn' } }}
            transition={SPRING.sheet}
            drag={wide ? 'x' : 'y'}
            dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
            dragElastic={{ top: 0, left: 0, bottom: 0.7, right: 0.7 }}
            onDragEnd={(_, i) => {
              const d = wide ? i.offset.x : i.offset.y
              const v = wide ? i.velocity.x : i.velocity.y
              if (d > 80 || v > 500) onClose()
            }}
          >
            <span className="v-intro-grip" aria-hidden="true" />
            <header>
              <img className="art" src={pic} alt="" />
              <h2>{title}</h2>
              <m.button className="close" onClick={onClose} aria-label="Close (Esc)" {...PRESS}>
                <X weight="bold" />
              </m.button>
            </header>
            {children}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )
}

/** The settings the opening screen offers today, as one short page (the settings themselves are another board). */
export function SettingsBody() {
  const [sound, setSound] = useState(true)
  const [music, setMusic] = useState(true)
  const [quality, setQuality] = useState('auto')
  return (
    <div className="v-intro-settings">
      <label className="v-intro-row">
        <span>Sound</span>
        <Switch.Root className="v-intro-switch" checked={sound} onCheckedChange={setSound} aria-label="Sound">
          <Switch.Thumb className="v-intro-thumb" />
        </Switch.Root>
      </label>
      <label className="v-intro-row">
        <span>Music</span>
        <Switch.Root className="v-intro-switch" checked={music} onCheckedChange={setMusic} aria-label="Music">
          <Switch.Thumb className="v-intro-thumb" />
        </Switch.Root>
      </label>
      <div className="v-intro-row col">
        <span>Graphics</span>
        <ToggleGroup.Root className="v-intro-seg" type="single" value={quality} onValueChange={(v) => v && setQuality(v)} aria-label="Graphics quality">
          {['auto', 'high', 'medium', 'low'].map((q) => (
            <ToggleGroup.Item key={q} value={q} className="v-intro-seg-item">
              {q[0].toUpperCase() + q.slice(1)}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
      </div>
      <p className="v-intro-credits">Credits · Kept on this device</p>
    </div>
  )
}

/** A farm's level: the game's star with the number on it. */
export const Star = ({ level, className = '' }: { level: number; className?: string }) => (
  <span className={`v-intro-star ${className}`} aria-label={`Level ${level}`}>
    <img className="art" src={art('glowing-star')} alt="" />
    <b>{level}</b>
  </span>
)

/** The farms kept on this device, as cards: a touch on one plays it (an empty one starts a new farm there); its ⋯
 *  saves it as a file, loads one into it, or starts it afresh — that last one asks first, on the card itself. */
export function FarmList({ s, onPick, onSet }: { s: IntroState; onPick: (slot: Slot) => void; onSet: (s: IntroState) => void }) {
  const [menu, setMenu] = useState<Slot | null>(null)
  const [ask, setAsk] = useState<Slot | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const told = (t: string) => {
    setDone(t)
    setMenu(null)
  }
  return (
    <m.ul className="v-intro-farms" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } } }}>
      {s.farms.map((f) => (
        <m.li
          key={f.slot}
          className={`v-intro-farm${f.slot === s.slot ? ' on' : ''}${f.exists ? '' : ' empty'}`}
          variants={{ hidden: { opacity: 0, y: 14 }, shown: { opacity: 1, y: 0, transition: SPRING.pop } }}
          layout
        >
          <div className="v-intro-farm-main">
            <m.button className="v-intro-farm-pick" onClick={() => onPick(f.slot)} aria-label={f.exists ? `Play Farm ${f.slot}` : `New farm in place ${f.slot}`} {...PRESS}>
              {f.exists ? <Star level={f.level} /> : <img className="art v-intro-farm-new" src={art('seedling')} alt="" />}
              <span className="v-intro-farm-text">
                <strong>
                  Farm {f.slot}
                  {f.slot === s.slot && <span className="tag v-intro-playing">{f.exists ? 'Playing' : 'Next'}</span>}
                </strong>
                {f.exists ? <FarmTags f={f} /> : <span className="v-intro-farm-none">Empty · a new farm</span>}
              </span>
            </m.button>
            <m.button className="v-intro-round small" aria-label={`More for Farm ${f.slot}`} aria-expanded={menu === f.slot} onClick={() => setMenu(menu === f.slot ? null : f.slot)} {...PRESS}>
              <DotsThree weight="bold" />
            </m.button>
          </div>
          <AnimatePresence initial={false}>
            {menu === f.slot && (
              <m.div
                className="v-intro-farm-menu"
                key="menu"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: EASE.out }}
              >
                {ask === f.slot ? (
                  <div className="v-intro-ask">
                    <span>Start Farm {f.slot} afresh?</span>
                    <m.button className="btn soft small" onClick={() => setAsk(null)} {...PRESS}>
                      Cancel
                    </m.button>
                    <m.button
                      className="btn berry small"
                      onClick={() => {
                        onSet(cleared(s, f.slot))
                        setAsk(null)
                        told(`Farm ${f.slot} starts afresh`)
                      }}
                      {...PRESS}
                    >
                      Clear
                    </m.button>
                  </div>
                ) : (
                  <div className="v-intro-farm-acts">
                    <m.button className="btn soft small" disabled={!f.exists} onClick={() => told(`Farm ${f.slot} saved as a file`)} {...PRESS}>
                      <DownloadSimple weight="bold" /> Save file
                    </m.button>
                    <m.button className="btn soft small" onClick={() => told(`Choose a farm file for Farm ${f.slot}`)} {...PRESS}>
                      <UploadSimple weight="bold" /> Load file
                    </m.button>
                    <m.button className="btn soft small v-intro-danger" disabled={!f.exists} onClick={() => setAsk(f.slot)} aria-label={`Start Farm ${f.slot} afresh`} {...PRESS}>
                      <ArrowCounterClockwise weight="bold" />
                    </m.button>
                  </div>
                )}
              </m.div>
            )}
          </AnimatePresence>
        </m.li>
      ))}
      <AnimatePresence>
        {done && (
          <m.li className="v-intro-done" key={done} role="status" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={SPRING.pop}>
            <Check weight="bold" /> {done}
          </m.li>
        )}
      </AnimatePresence>
    </m.ul>
  )
}

/** A farm in chips: its coins, its beds growing, its animals, and when it was played. */
export const FarmTags = ({ f }: { f: Farm }) => (
  <span className="v-intro-tags">
    <span className="tag">
      <img src={art('coin')} alt="" />
      {f.coins.toLocaleString('en-US')}
    </span>
    <span className="tag">
      <img src={art('seedling')} alt="" />
      {f.growing}
    </span>
    <span className="tag">
      <img src={art('chicken')} alt="" />
      {f.animals}
    </span>
    {f.savedAt && <span className="tag v-intro-ago">{savedAgo(f)}</span>}
  </span>
)
