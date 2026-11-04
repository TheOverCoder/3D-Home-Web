import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { SCREENS, screenById, type Card, type Cta, type ScreenDef, type ScreenTab, type Stat } from '../data/screens'
import { useHome } from '../store'
import { drawArt } from './screens/art'
import './screens/screenModal.css'

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** "140+" counts 0 → 140 and keeps the "+"; values without a number ("Mon–Fri") are shown as they are. */
function CountUp({ value }: { value: string }) {
  const m = /^(\D*)(\d+(?:[.,]\d+)?)(.*)$/.exec(value)
  const target = m ? parseFloat(m[2].replace(',', '.')) : 0
  const decimals = m && /[.,]/.test(m[2]) ? m[2].split(/[.,]/)[1].length : 0
  const [shown, setShown] = useState(() => (m && !reducedMotion() ? 0 : target))
  useEffect(() => {
    if (!m || reducedMotion()) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / 1100)
      setShown(target * (1 - Math.pow(1 - k, 3)))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  if (!m) return <>{value}</>
  return (
    <>
      <span aria-hidden="true">
        {m[1]}
        {shown.toFixed(decimals)}
        {m[3]}
      </span>
      <span className="sm-sr">{value}</span>
    </>
  )
}

function Stats({ stats, className }: { stats: Stat[]; className: string }) {
  return (
    <dl className={className}>
      {stats.map((s) => (
        <div key={s.label}>
          <dd>
            <CountUp value={s.value} />
          </dd>
          <dt>{s.label}</dt>
        </div>
      ))}
    </dl>
  )
}

function Art({ seed, accent }: { seed: number; accent: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.round((c.clientWidth || 320) * dpr)
    const h = Math.round((c.clientHeight || 200) * dpr)
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    if (ctx) drawArt(ctx, w, h, seed, accent)
  }, [seed, accent])
  return <canvas ref={ref} className="sm-art" aria-hidden="true" />
}

function CardGrid({ cards, accent }: { cards: Card[]; accent: string }) {
  return (
    <ul className={`sm-cards n${cards.length}`}>
      {cards.map((c, i) => (
        <li key={c.title} className="sm-card" style={{ animationDelay: `${80 + i * 60}ms` }}>
          <Art seed={c.seed ?? i * 7 + 1} accent={accent} />
          <div className="sm-card-body">
            <p className="sm-kicker">{c.kicker}</p>
            <h4>{c.title}</h4>
            <p>{c.body}</p>
            {c.meta && <p className="sm-meta">{c.meta}</p>}
          </div>
        </li>
      ))}
    </ul>
  )
}

function CtaBlock({ cta }: { cta: Cta }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])
  const external = /^https?:/.test(cta.href)
  return (
    <div className="sm-cta-row">
      <a className="sm-cta" href={cta.href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
        {cta.label}
        <span aria-hidden="true">→</span>
      </a>
      {cta.copy && (
        <button
          type="button"
          className="sm-ghost"
          onClick={() => {
            navigator.clipboard?.writeText(cta.copy!).then(
              () => setCopied(true),
              () => undefined,
            )
          }}
        >
          {copied ? 'Copied ✓' : `Copy ${cta.copy}`}
        </button>
      )}
      {cta.note && <p className="sm-note">{cta.note}</p>}
      <span className="sm-sr" aria-live="polite">
        {copied ? 'Copied to the clipboard' : ''}
      </span>
    </div>
  )
}

function Section({ tab, def }: { tab: ScreenTab; def: ScreenDef }) {
  return (
    <>
      <h3>{tab.heading}</h3>
      <p className="sm-body">{tab.body}</p>
      {tab.stats && <Stats stats={tab.stats} className="sm-stats sm-stats-inline" />}
      {tab.cards && <CardGrid cards={tab.cards} accent={def.accent} />}
      {tab.steps && (
        <ol className="sm-steps">
          {tab.steps.map((s, i) => (
            <li key={s.title} style={{ animationDelay: `${80 + i * 70}ms` }}>
              <span className="sm-step-n" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <h4>{s.title}</h4>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {tab.points && (
        <ul className="sm-points">
          {tab.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {tab.cta && <CtaBlock cta={tab.cta} />}
    </>
  )
}

const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

export function ScreenModal() {
  const id = useHome((s) => s.screen)
  const close = useHome((s) => s.closeScreen)
  const def = id ? screenById(id) : undefined
  const [tab, setTab] = useState(0)
  const [dir, setDir] = useState(1)
  const panel = useRef<HTMLElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const indicator = useRef<HTMLSpanElement>(null)
  const swipe = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    setTab(0)
    if (def) panel.current?.focus({ preventScroll: true })
  }, [def])

  const count = def?.tabs.length ?? 0
  const go = (next: number) => {
    if (!count) return
    const n = (next + count) % count
    if (n === tab) return
    setDir(n > tab ? 1 : -1)
    setTab(n)
    // keep keyboard focus on the tab strip when that is where it was (roving tabindex)
    if (document.activeElement?.getAttribute('role') === 'tab') {
      requestAnimationFrame(() => tabsRef.current?.querySelectorAll<HTMLButtonElement>('[role=tab]')[n]?.focus())
    }
  }

  // ← → / Home / End / 1‥9 switch sections; Tab stays inside the dialog. Esc is handled by the player (closes).
  useEffect(() => {
    if (!def) return
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      if (e.key === 'Tab') {
        const items = panel.current ? [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)] : []
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        const inside = panel.current?.contains(document.activeElement)
        if (e.shiftKey && (document.activeElement === first || !inside)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
          e.preventDefault()
          first.focus()
        }
        return
      }
      let next = -1
      if (e.key === 'ArrowRight') next = tab + 1
      else if (e.key === 'ArrowLeft') next = tab - 1
      else if (e.key === 'Home') next = 0
      else if (e.key === 'End') next = count - 1
      else if (/^[1-9]$/.test(e.key) && Number(e.key) <= count) next = Number(e.key) - 1
      if (next === -1) return
      e.preventDefault()
      go(next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // sliding underline under the active tab
  useLayoutEffect(() => {
    const el = tabsRef.current?.querySelectorAll<HTMLElement>('[role=tab]')[tab]
    const bar = indicator.current
    if (!el || !bar) return
    bar.style.width = `${el.offsetWidth}px`
    bar.style.transform = `translateX(${el.offsetLeft}px)`
  }, [tab, def])

  if (!def) return null
  const active = def.tabs[tab] ?? def.tabs[0]
  const index = SCREENS.indexOf(def)
  const nextTab = def.tabs[(tab + 1) % count]

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') swipe.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e: ReactPointerEvent) => {
    const s = swipe.current
    swipe.current = null
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.6) go(tab + (dx < 0 ? 1 : -1))
  }

  return (
    <div className="modal-backdrop sm-backdrop" onClick={close} style={{ ['--accent' as string]: def.accent }}>
      <section
        ref={panel}
        className="modal sm-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-tagline"
        tabIndex={-1}
        style={{ ['--accent' as string]: def.accent }}
        onClick={(e) => e.stopPropagation()}
      >
        <aside className="sm-hero">
          <p className="sm-eyebrow">
            <span className="sm-dot" aria-hidden="true" />
            {def.subtitle}
            <span className="sm-count">
              {String(index + 1).padStart(2, '0')} / {String(SCREENS.length).padStart(2, '0')}
            </span>
          </p>
          <h2 id="modal-title">{def.title}</h2>
          <p id="modal-tagline" className="sm-tagline">
            {def.tagline}
          </p>
          <Stats stats={def.stats} className="sm-stats" />
          {def.cta && <CtaBlock cta={def.cta} />}
          {/* the small chart yields to a call to action: on the contact screen the button matters more */}
          {!def.cta && (
            <div className="sm-meter" aria-hidden="true">
              <p className="sm-meter-title">At a glance</p>
              {def.bars.map((b, i) => (
                <div key={b.label} className="sm-meter-row">
                  <span>{b.label}</span>
                  <b>{Math.round(b.value * 100)}%</b>
                  <i>
                    <em style={{ width: `${b.value * 100}%`, animationDelay: `${200 + i * 70}ms` }} />
                  </i>
                </div>
              ))}
            </div>
          )}
        </aside>

        <div className="sm-main">
          <div className="sm-tabs" role="tablist" aria-label={`${def.title} sections`} ref={tabsRef}>
            {def.tabs.map((t, i) => (
              <button
                key={t.label}
                id={`sm-tab-${i}`}
                role="tab"
                type="button"
                aria-selected={i === tab}
                aria-controls="sm-tabpanel"
                tabIndex={i === tab ? 0 : -1}
                className={i === tab ? 'on' : ''}
                onClick={() => go(i)}
              >
                {t.label}
              </button>
            ))}
            <span ref={indicator} className="sm-indicator" aria-hidden="true" />
          </div>

          <article
            key={`${def.id}-${tab}`}
            id="sm-tabpanel"
            role="tabpanel"
            aria-labelledby={`sm-tab-${tab}`}
            className={`sm-section ${dir > 0 ? 'from-right' : 'from-left'}`}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (swipe.current = null)}
          >
            <Section tab={active} def={def} />
            {count > 1 && (
              <button type="button" className="sm-next" onClick={() => go(tab + 1)}>
                <span>{tab + 1 < count ? 'Next' : 'Back to'}</span> {nextTab.label} <span aria-hidden="true">→</span>
              </button>
            )}
          </article>

          <footer className="sm-foot">
            <span className="sm-keys">
              <kbd>←</kbd>
              <kbd>→</kbd> sections
            </span>
            <span className="sm-keys">
              <kbd>Esc</kbd> back to the house
            </span>
            <button type="button" className="sm-back" onClick={close}>
              Back to the house
            </button>
          </footer>
        </div>

        <button className="close sm-close" type="button" onClick={close} aria-label="Close (Esc)">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </section>
    </div>
  )
}
