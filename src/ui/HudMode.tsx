import { AnimatePresence, m } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useDailyWaiting } from '../farm/useDaily'
import { BusyCard, useNextReady, whenReady } from '../farm/Busy'
import { produceById } from '../farm/data'
import { iconUrl } from '../farm/icons'
import { editHere, openEdit } from '../home/decorate'
import { newsBadge, useFarm } from '../farm/state'
import { useSettings, type Settings } from '../settings'
import { busy, useHome } from '../store'
import { art } from './art'
import { ArrowsOutCardinal, CompassRose, Couch, EyeSlash, GearSix, List, Newspaper, SquaresFour, X } from './glyphs'
import { MotionRoot, POP, PRESS, SPRING } from './motion'
import './Compass.css'
import './HudMode.css'

type Mode = Settings['hudMode']

const NEXT: Record<Mode, Mode> = { all: 'compass', compass: 'clean', clean: 'all' }
const SAYS: Record<Mode, string> = { all: 'Top of the screen: everything', compass: 'Top of the screen: only the compass', clean: 'Top of the screen: clear' }
const WORD: Record<Mode, string> = { all: 'All', compass: 'Compass', clean: 'Clear' }

/** Whether the keys typed are going into a text field (then H is a letter, not a shortcut). */
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

/**
 * The menu in the top corner (the design lab's board "top", D): one round button that opens into its buttons, each with
 * its name — the daily gift while today's waits (src/farm/daily.ts: it opens by itself once a day; closed unclaimed, it
 * waits here), the farm news (the week's events and the lucky draw, src/farm/news), edit the farm (or decorate, in the
 * house), what the top of the screen shows (everything: the dashboard and the compass; only the compass; or nothing at
 * all, a clear view of the farm), and the settings. It keeps the corner in every view, so the view can always be changed
 * back; the view's own button cycles it and leaves the menu open, so pressing it again and again goes round the three
 * views. H does the same on a keyboard. The choice is remembered; the stylesheets read it from <html data-hud>. A touch
 * anywhere else closes the menu.
 *
 * What waits inside shows on the button, on its two right-hand corners in the dial's order (the left side is the
 * dashboard's: the level's road ends beside it): today's gift on the top corner, a small gift that hops now and then;
 * the news's sun badge with how many wait there on the top corner too while it is alone, on the bottom one while the
 * gift is there, so the two never cover each other. In the dial, the news's own button carries its number again.
 */
export function HudMode() {
  const phase = useHome((s) => s.phase)
  const occupied = useHome(busy)
  const edit = useHome(editHere)
  const mode = useSettings((s) => s.hudMode)
  // what waits in the farm news (an event not shown yet, the lucky draw not made), and whether today's gift waits
  useFarm((s) => s.rev)
  const news = newsBadge()
  const gift = useDailyWaiting()
  // while the farm is busy (src/farm/Busy.tsx): what is ready next, and when
  const next = useNextReady()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const shown = phase === 'playing' && !occupied

  useEffect(() => {
    document.documentElement.dataset.hud = mode
  }, [mode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyH' || e.repeat || typing(e.target)) return
      const s = useHome.getState()
      if (s.phase !== 'playing' || busy(s)) return
      const { hudMode, update } = useSettings.getState()
      update({ hudMode: NEXT[hudMode] })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // a touch anywhere else closes it; anything opening over the game (a panel, the settings, the edit mode) too
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', away, true)
    return () => document.removeEventListener('pointerdown', away, true)
  }, [open])
  if (!shown && open) setOpen(false)

  // the busy card (its own top slot) lives beside the menu, as the menu comes and goes
  if (!shown)
    return (
      <>
        <BusyCard />
      </>
    )
  const ViewIcon = mode === 'all' ? SquaresFour : mode === 'compass' ? CompassRose : EyeSlash
  // the dial's buttons: the daily gift while it waits, the news, edit where there is something to edit, the view, the
  // settings (five: on a phone on its side they go in two columns, see HudMode.css)
  const buttons = (gift ? 1 : 0) + (next ? 1 : 0) + 1 + (edit ? 1 : 0) + 2
  return (
    <>
      <BusyCard />
      <MotionRoot>
        <div className="top-menu" ref={box}>
          <m.button
            className={`top-menu-btn${open ? ' on' : ''}${gift ? ' gift' : ''}`}
            {...PRESS}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={`Menu: ${gift ? "today's gift waits; " : ''}${next ? `next ready ${whenReady(next.ready)}; ` : ''}the farm news${news ? ` (${news} new)` : ''}, edit, the top's view, settings`}
            title="Menu"
          >
            {open ? <X weight="bold" /> : <List weight="bold" />}
            <AnimatePresence>
              {gift && !open && (
                <m.span
                  key="gift"
                  className="top-menu-gift"
                  aria-hidden="true"
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, transition: { duration: 0.12 } }}
                  transition={SPRING.pop}
                >
                  <img src={art('wrapped-gift')} alt="" />
                </m.span>
              )}
              {news > 0 && !open && <Badge key="news" n={news} />}
            </AnimatePresence>
          </m.button>
          <AnimatePresence>
            {open && (
              <m.ul
                className={`top-dial${buttons > 4 ? ' many' : ''}`}
                initial="shut"
                animate="open"
                exit="shut"
                variants={{ open: { transition: { staggerChildren: 0.045 } }, shut: { transition: { staggerChildren: 0.03, staggerDirection: -1 } } }}
              >
                {gift && (
                  <Dial
                    className="daily-open"
                    icon={<img className="art" src={art('wrapped-gift')} alt="" />}
                    word="Daily gift"
                    label="Daily gift: today's is waiting"
                    onTap={() => {
                      setOpen(false)
                      useHome.getState().openPanel({ kind: 'daily' })
                    }}
                  />
                )}
                {next && 'item' in next.what && (
                  <m.li variants={dial} className="next-ready" role="note" aria-label={`Next ready: ${produceById(next.what.item).plural}, ${whenReady(next.ready)}`}>
                    <span className="top-dial-btn">
                      <span className="top-dial-word">Next ready {whenReady(next.ready)}</span>
                      <span className="top-dial-icon">
                        <img className="art" src={iconUrl(next.what.item)} alt="" />
                      </span>
                    </span>
                  </m.li>
                )}
                <Dial
                  className="news-open"
                  icon={<Newspaper weight="bold" />}
                  badge={news}
                  word="Farm news"
                  label={`The farm news: the week's events${news ? ` — ${news} new` : ''}`}
                  onTap={() => {
                    setOpen(false)
                    if (!useHome.getState().panel) useHome.getState().openPanel({ kind: 'news' })
                  }}
                />
                {edit && (
                  <Dial
                    className="edit-open"
                    icon={edit === 'farm' ? <ArrowsOutCardinal weight="bold" /> : <Couch weight="bold" />}
                    word={edit === 'farm' ? 'Edit the farm' : 'Decorate'}
                    label={`${edit === 'farm' ? 'Edit the farm: move things, buy land and decoration' : 'Decorate: move, turn and put away the furniture'} (B)`}
                    onTap={() => {
                      setOpen(false)
                      openEdit()
                    }}
                  />
                )}
                <Dial
                  className="hud-mode"
                  mode={mode}
                  icon={<ViewIcon weight="bold" />}
                  word={`Top: ${WORD[mode]}`}
                  label={`${SAYS[mode]} — tap to change`}
                  title={`${SAYS[mode]} (H)`}
                  onTap={() => useSettings.getState().update({ hudMode: NEXT[mode] })}
                />
                <Dial
                  className="settings-open"
                  icon={<GearSix weight="bold" />}
                  word="Settings"
                  label="Settings and controls (Esc)"
                  onTap={() => {
                    setOpen(false)
                    useHome.getState().setSettingsOpen(true)
                  }}
                />
              </m.ul>
            )}
          </AnimatePresence>
        </div>
      </MotionRoot>
    </>
  )
}

const dial = { shut: { opacity: 0, y: -14, scale: 0.6 }, open: { opacity: 1, y: 0, scale: 1, transition: SPRING.pop } }

/** How many things wait (the farm news): a sun badge that pops in, and out quicker. */
function Badge({ n }: { n: number }) {
  return (
    <m.b className="top-badge" variants={POP} initial="hidden" animate="show" exit="out" aria-hidden="true">
      {n}
    </m.b>
  )
}

/** One of the menu's buttons: its name on a paper pill, its picture in a round one (with a badge when something waits). */
function Dial({
  className,
  mode,
  icon,
  badge = 0,
  word,
  label,
  title,
  onTap,
}: {
  className: string
  mode?: Mode
  icon: ReactNode
  badge?: number
  word: string
  label: string
  title?: string
  onTap: () => void
}) {
  return (
    <m.li variants={dial}>
      <m.button className={`top-dial-btn ${className}`} data-mode={mode} {...PRESS} onClick={onTap} aria-label={label} title={title ?? word}>
        <span className="top-dial-word">{word}</span>
        <span className="top-dial-icon">
          {icon}
          {badge > 0 && <Badge n={badge} />}
        </span>
      </m.button>
    </m.li>
  )
}
