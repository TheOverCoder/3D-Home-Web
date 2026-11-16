import { AnimatePresence, m } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { editHere, openEdit } from '../home/decorate'
import { useSettings, type Settings } from '../settings'
import { busy, useHome } from '../store'
import { ArrowsOutCardinal, CompassRose, Couch, EyeSlash, GearSix, List, SquaresFour, X } from './glyphs'
import { MotionRoot, PRESS, SPRING } from './motion'
import './Compass.css'
import './HudMode.css'

type Mode = Settings['hudMode']

const NEXT: Record<Mode, Mode> = { all: 'compass', compass: 'clean', clean: 'all' }
const SAYS: Record<Mode, string> = { all: 'Top of the screen: everything', compass: 'Top of the screen: only the compass', clean: 'Top of the screen: clear' }
const WORD: Record<Mode, string> = { all: 'All', compass: 'Compass', clean: 'Clear' }

/** Whether the keys typed are going into a text field (then H is a letter, not a shortcut). */
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

/**
 * The menu in the top corner (the design lab's board "top", D): one round button that opens into three, each with its
 * name — edit the farm (or decorate, in the house), what the top of the screen shows (everything: the dashboard and the
 * compass; only the compass; or nothing at all, a clear view of the farm), and the settings. It keeps the corner in
 * every view, so the view can always be changed back; the view's own button cycles it and leaves the menu open, so
 * pressing it again and again goes round the three. H does the same on a keyboard. The choice is remembered;
 * the stylesheets read it from <html data-hud>. A touch anywhere else closes the menu.
 */
export function HudMode() {
  const phase = useHome((s) => s.phase)
  const occupied = useHome(busy)
  const edit = useHome(editHere)
  const mode = useSettings((s) => s.hudMode)
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

  if (!shown) return null
  const ViewIcon = mode === 'all' ? SquaresFour : mode === 'compass' ? CompassRose : EyeSlash
  return (
    <MotionRoot>
      <div className="top-menu" ref={box}>
        <m.button className={`top-menu-btn${open ? ' on' : ''}`} {...PRESS} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Menu: edit, the top's view, settings" title="Menu">
          {open ? <X weight="bold" /> : <List weight="bold" />}
        </m.button>
        <AnimatePresence>
          {open && (
            <m.ul
              className="top-dial"
              initial="shut"
              animate="open"
              exit="shut"
              variants={{ open: { transition: { staggerChildren: 0.045 } }, shut: { transition: { staggerChildren: 0.03, staggerDirection: -1 } } }}
            >
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
  )
}

const dial = { shut: { opacity: 0, y: -14, scale: 0.6 }, open: { opacity: 1, y: 0, scale: 1, transition: SPRING.pop } }

/** One of the menu's buttons: its name on a paper pill, its picture in a round one. */
function Dial({ className, mode, icon, word, label, title, onTap }: { className: string; mode?: Mode; icon: ReactNode; word: string; label: string; title?: string; onTap: () => void }) {
  return (
    <m.li variants={dial}>
      <m.button className={`top-dial-btn ${className}`} data-mode={mode} {...PRESS} onClick={onTap} aria-label={label} title={title ?? word}>
        <span className="top-dial-word">{word}</span>
        <span className="top-dial-icon">{icon}</span>
      </m.button>
    </m.li>
  )
}
