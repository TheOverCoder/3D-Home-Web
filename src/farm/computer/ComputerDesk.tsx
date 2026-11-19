import { m } from 'motion/react'
import { Tabs } from 'radix-ui'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { art, type ArtId } from '../../ui/art'
import { CaretLeft, Clock } from '../../ui/glyphs'
import { GoodPic } from '../../ui/GoodPic'
import { ITEM, MotionRoot, PRESS, REVEAL, SQUISH } from '../../ui/motion'
import { PanelSheet } from '../../ui/PanelSheet'
import { useSheetMode } from '../../ui/sheetMode'
import { produceById, DAY, type DayPhase, type ProduceId } from '../data'
import { APPS, type AppId, type AppRow } from './apps'
import type { BookView } from './bookView'
import { Spark } from './charts'
import { BookApp } from './BookApp'
import { MarketApp } from './MarketApp'
import type { MarketView } from './marketView'
import { PlanApp } from './PlanApp'
import type { PlanView } from './planView'
import type { TodayView } from './todayView'
import { CHANNEL_WORDS, coinsText, moveText } from './words'
import './Computer.css'

// The house's computer, its look (update-v1 mission 09: the desktop and its three apps): a design layer fed with the
// views (./ComputerPanel.tsx reads the farm), nothing of the farm in it. On the panel sheet (src/ui/PanelSheet.tsx):
// its picture, "Computer", and chips for the coins and the clock — the device's time and the farm's hour. Its body is
// the desktop: a wallpaper in the colours of the farm's time of day, the "Today" widget (the vegetable index and where
// it is heading, the lucky draw's goods, what pays most now and the best bed), and the dock with the apps (at the
// bottom upright, a rail on the left sideways). An app opens in a window over the desktop — its title bar the way back,
// its picture and name, then its tabs (Radix Tabs) — and Esc closes the page in it, then the window, then the
// computer (the window says it is over the sheet: `data-over-sheet`).

export interface DeskView {
  market: MarketView
  plan: PlanView
  book: BookView
  today: TodayView
  coins: number
  /** today, on the device's calendar */
  day: number
  /** the device's time, the farm's hour, and its time of day */
  clock: { device: string; farm: string; phase: DayPhase }
}

/** Where the desktop is: an app's window open (its tab, and in the Market a good's page), or none. */
export interface DeskOpen {
  app: AppId | null
  tab: Partial<Record<AppId, string>>
  good: ProduceId | null
}

const PHASE_ART = Object.fromEntries(DAY.phases.map((p) => [p.id, p.art])) as Record<DayPhase, ArtId>

export function ComputerDesk({ v, onClose, closing, start }: { v: DeskView; onClose: () => void; closing?: boolean; start?: Partial<DeskOpen> }) {
  return (
    <MotionRoot>
      <Desk v={v} onClose={onClose} closing={closing} start={start} />
    </MotionRoot>
  )
}

function Desk({ v, onClose, closing, start }: { v: DeskView; onClose: () => void; closing?: boolean; start?: Partial<DeskOpen> }) {
  const mode = useSheetMode()
  const [open, setOpen] = useState<DeskOpen>({ app: null, tab: {}, good: null, ...start })
  const app = APPS.find((a) => a.id === open.app) ?? null
  const tab = app ? (open.tab[app.id] ?? app.tabs[0].id) : null
  const show = (id: AppId) => setOpen((o) => ({ ...o, app: o.app === id ? o.app : id, good: o.app === id ? o.good : null }))
  // back one step: the page in the window, then the window
  const back = useCallback(() => setOpen((o) => (o.good ? { ...o, good: null } : { ...o, app: null })), [])
  return (
    <PanelSheet
      label="Computer"
      title="Computer"
      pic={art('desktop-computer')}
      className="pc-panel"
      closing={closing}
      onClose={onClose}
      sub={
        <>
          <span className="tag" aria-label={`${v.coins} coins`}>
            <img src={art('coin')} alt="" />
            {v.coins}
          </span>
          <span className="tag" aria-label={`The time: ${v.clock.device}`}>
            <Clock weight="bold" />
            {v.clock.device}
          </span>
          <span className="tag" aria-label={`On the farm: ${v.clock.farm}`}>
            <img src={art(PHASE_ART[v.clock.phase])} alt="" />
            Farm {v.clock.farm}
          </span>
        </>
      }
    >
      <m.div className={`pc-desk pc-${v.clock.phase}${mode === 'right' ? ' side' : ''}`} variants={ITEM}>
        <img className="pc-wall-art" src={art(PHASE_ART[v.clock.phase])} alt="" />
        <nav className="pc-dock" aria-label="Apps">
          {APPS.map((a) => (
            <m.button key={a.id} className={`pc-app${open.app === a.id ? ' on' : ''}`} aria-pressed={open.app === a.id} onClick={() => show(a.id)} {...SQUISH}>
              <img className="art" src={art(a.pic)} alt="" />
              <span>{a.name}</span>
            </m.button>
          ))}
        </nav>
        <div className="pc-screen">
          {app && tab ? (
            <Window key={app.id} app={app} tab={tab} onTab={(t) => setOpen((o) => ({ ...o, tab: { ...o.tab, [app.id]: t }, good: null }))} onBack={back}>
              {app.view === 'market' ? (
                <MarketApp v={v} tab={tab} good={open.good} openGood={(good) => setOpen((o) => ({ ...o, good }))} />
              ) : app.view === 'plan' ? (
                <PlanApp v={v} tab={tab} />
              ) : (
                <BookApp v={v} tab={tab} />
              )}
            </Window>
          ) : (
            <Today v={v} open={(id, good) => setOpen((o) => ({ ...o, app: id, good: good ?? null }))} />
          )}
        </div>
      </m.div>
    </PanelSheet>
  )
}

/** The desktop's widget: the index, the draw, what pays most, the best bed — each a line in words. */
function Today({ v, open }: { v: DeskView; open: (app: AppId, good?: ProduceId) => void }) {
  const t = v.today
  const mv = moveText(t.index.pct)
  return (
    <m.section className="pc-today" aria-label="Today" {...REVEAL}>
      <h3 className="sheet-heading">Today</h3>
      <m.button className="pc-today-index" onClick={() => open('market')} aria-label={`The vegetable index: ${Math.round(t.index.now)}, tomorrow ${mv.words}. Open the Market`} {...PRESS}>
        <span className="pc-today-word">Vegetable index</span>
        <b className="pc-big">{Math.round(t.index.now)}</b>
        <Spark days={t.index.days} next={t.index.tomorrow} tone={mv.tone} />
        <span className={`tag pc-move ${mv.chip}`}>{mv.text}</span>
      </m.button>
      {t.drawn.length > 0 && (
        <div className="pc-today-line">
          <span className="pc-today-pics">
            {t.drawn.map((g) => (
              <GoodPic key={g} good={g} className="pc-good" />
            ))}
          </span>
          <span>
            On the lucky draw: <b>×2</b> today
          </span>
        </div>
      )}
      {t.paysMost && (
        <div className="pc-today-line">
          <GoodPic good={t.paysMost.good} className="pc-good" />
          <span>
            Pays most now: <b>{cap(produceById(t.paysMost.good).plural)}</b>, {coinsText(t.paysMost.per)} a unit {CHANNEL_WORDS[t.paysMost.channel].at}
          </span>
        </div>
      )}
      {t.bestBed && (
        <div className="pc-today-line">
          <GoodPic good={t.bestBed.crop} className="pc-good" />
          <span>
            Best bed: <b>{cap(produceById(t.bestBed.crop).plural)}</b>, {coinsText(t.bestBed.perMinute)} coins a minute
          </span>
        </div>
      )}
    </m.section>
  )
}

const cap = (t: string) => t[0].toUpperCase() + t.slice(1)

/** An app's window: its title bar (the way back, its picture and name, its tabs) and the open tab, which scrolls. */
function Window({ app, tab, onTab, onBack, children }: { app: AppRow; tab: string; onTab: (t: string) => void; onBack: () => void; children: ReactNode }) {
  // Esc: the page in it, then the window (a good's bubble open over it takes Esc first; then the sheet the computer)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('.good-pop')) return
      e.stopPropagation()
      onBack()
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [onBack])
  return (
    <m.section className="pc-window" data-over-sheet="" aria-label={app.name} {...REVEAL}>
      <Tabs.Root value={tab} onValueChange={onTab} className="pc-tabs-root">
        <header className="pc-bar">
          <m.button className="mp-round pc-back" onClick={onBack} aria-label="Back (Esc)" {...PRESS}>
            <CaretLeft weight="bold" />
          </m.button>
          <img className="art pc-bar-pic" src={art(app.pic)} alt="" />
          <h3 className="pc-bar-name">{app.name}</h3>
          <Tabs.List className="pc-tabs" aria-label={app.name}>
            {app.tabs.map((t) => (
              <Tabs.Trigger key={t.id} value={t.id} className="pc-tab">
                {t.name}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </header>
        {/* (each tab, and each page in it, starts at its top) */}
        <Tabs.Content key={tab} value={tab} className="pc-content" tabIndex={-1}>
          {children}
        </Tabs.Content>
      </Tabs.Root>
    </m.section>
  )
}
