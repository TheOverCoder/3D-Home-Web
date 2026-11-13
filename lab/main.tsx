import '@fontsource-variable/fredoka'
import './lab.css'
import { StrictMode, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import type { Board } from './board'
import { BOARDS } from './boards'
import { DEVICES, DEVICE_IDS, type DeviceId } from './devices'
import { AREAS, MAP, type Screen } from './map'

// The lab's page. At the top, every board (a piece of the interface waiting for the user's choice, chosen, or in the
// game) and the map of the game's interface. A board: the request, its states, and its variants side by side, each on
// the screens it is for (lab/frame.html at the device's own size, scaled to fit), every button and gesture working.
// The bar sets what all of them show: the screens, slow motion, the marks of touches. ⛶ opens one variant full
// screen: on a phone, at the phone's own size under the user's own finger.

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyBoard = Board<any>

interface View {
  devices: DeviceId[]
  speed: number
  touches: boolean
}

const STATUS = { choose: 'מחכה לבחירה שלך', chosen: 'נבחר', live: 'במשחק' } as const
const statusText = (b: AnyBoard) => (b.status === 'chosen' && b.chosen ? `נבחר: ${b.chosen === 'today' ? 'היום' : b.chosen.toUpperCase()}` : STATUS[b.status])
const letter = (id: string) => (id === 'today' ? 'היום' : id.toUpperCase())

const frameSrc = (o: { board: string; variant: string; state: string; run: number; device: DeviceId | 'real'; speed: number; touches: boolean }) =>
  `frame.html?device=${o.device}&speed=${o.speed}&touches=${o.touches ? 1 : 0}#${o.board}/${o.variant}/${o.state}/${o.run}`

// what the viewer set last time (a convenience: the lab works the same without it)
const SAVED = 'lab-view'
function savedView(): View {
  const plain: View = { devices: ['upright', 'sideways'], speed: 1, touches: true }
  try {
    const v = JSON.parse(localStorage.getItem(SAVED) ?? 'null') as Partial<View> | null
    if (!v) return plain
    return { devices: (v.devices ?? plain.devices).filter((d) => d in DEVICES), speed: v.speed === 0.25 ? 0.25 : 1, touches: v.touches !== false }
  } catch {
    return plain
  }
}
function saveView(v: View) {
  try {
    localStorage.setItem(SAVED, JSON.stringify(v))
  } catch {
    // private window: nothing kept
  }
}

/** A device's screen at its own size, scaled down to the room it has (as wide as the device's `most` at most). */
function DeviceScreen({ src, device }: { src: string; device: DeviceId }) {
  const d = DEVICES[device]
  const box = useRef<HTMLDivElement>(null)
  const [k, setK] = useState(d.most / d.w)
  useLayoutEffect(() => {
    const row = box.current?.closest('.screens') as HTMLElement | null
    if (!row) return
    const fit = () => setK(Math.min(d.most, row.clientWidth - 12) / d.w)
    fit()
    const watch = new ResizeObserver(fit)
    watch.observe(row)
    return () => watch.disconnect()
  }, [d.most, d.w])
  return (
    <figure className={`screen screen-${device}`}>
      <div className="glass" ref={box} style={{ width: d.w * k, height: d.h * k }}>
        <iframe src={src} title={d.name} width={d.w} height={d.h} style={{ transform: `scale(${k})` }} loading="lazy" />
      </div>
      <figcaption>
        {d.name} · {d.w}×{d.h}
      </figcaption>
    </figure>
  )
}

function Toggle({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: ReactNode; label?: string }) {
  return (
    <button className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={onClick} aria-label={label}>
      {children}
    </button>
  )
}

function Bar({ view, setView, onAgain }: { view: View; setView: (v: View) => void; onAgain: () => void }) {
  const flip = (d: DeviceId) => {
    const has = view.devices.includes(d)
    const devices = has ? view.devices.filter((x) => x !== d) : DEVICE_IDS.filter((x) => x === d || view.devices.includes(x))
    if (devices.length) setView({ ...view, devices })
  }
  return (
    <div className="bar" role="toolbar" aria-label="מה רואים">
      <div className="group" aria-label="מסכים">
        {DEVICE_IDS.map((d) => (
          <Toggle key={d} on={view.devices.includes(d)} onClick={() => flip(d)}>
            {DEVICES[d].name}
          </Toggle>
        ))}
      </div>
      <div className="group">
        <Toggle on={view.speed !== 1} onClick={() => setView({ ...view, speed: view.speed === 1 ? 0.25 : 1 })} label="הילוך איטי: פי ארבעה לאט">
          🐢 הילוך איטי
        </Toggle>
        <Toggle on={view.touches} onClick={() => setView({ ...view, touches: !view.touches })} label="סימון של כל נגיעה">
          👆 נגיעות
        </Toggle>
        <button className="chip" onClick={onAgain}>
          ↻ הכל שוב
        </button>
      </div>
    </div>
  )
}

function BoardView({ board, view, setView, onTry }: { board: AnyBoard; view: View; setView: (v: View) => void; onTry: (variant: string, state: string) => void }) {
  const [state, setState] = useState(board.states[0].id)
  const [runs, setRuns] = useState<Record<string, number>>({})
  const [all, setAll] = useState(0)
  const devices = view.devices.length ? view.devices : (board.devices ?? ['upright', 'sideways'])
  const src = (variant: string, device: DeviceId) => frameSrc({ board: board.id, variant, state, run: all + (runs[variant] ?? 0), device, speed: view.speed, touches: view.touches })
  return (
    <section className="board" aria-labelledby={`${board.id}-title`}>
      <header className="board-head">
        <div className="title-row">
          <h2 id={`${board.id}-title`}>{board.title}</h2>
          <span className={`status ${board.status}`}>{statusText(board)}</span>
        </div>
        <p className="ask">
          <span>הבקשה</span>
          {board.ask}
        </p>
        {board.round && (
          <p className="ask round">
            <span>מה חדש</span>
            {board.round}
          </p>
        )}
      </header>
      <div className="sticky">
        <div className="states" role="radiogroup" aria-label="מצב">
          {board.states.map((s) => (
            <button key={s.id} role="radio" aria-checked={state === s.id} className={`chip${state === s.id ? ' on' : ''}`} onClick={() => setState(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
        <Bar view={view} setView={setView} onAgain={() => setAll((n) => n + 1)} />
      </div>
      <div className="variants">
        {board.variants.map((v) => (
          <article key={v.id} className={`variant${v.id === 'today' ? ' today' : ''}${board.chosen === v.id ? ' picked' : ''}`}>
            <header>
              <b className="letter" aria-hidden="true">
                {v.id === 'today' ? '·' : v.id.toUpperCase()}
              </b>
              <div>
                <h3>{v.id === 'today' ? v.name : `${v.id.toUpperCase()} · ${v.name}`}</h3>
                <p>{v.note}</p>
                {v.motion && (
                  <p className="motion">
                    <span aria-hidden="true">✦</span> {v.motion}
                  </p>
                )}
              </div>
              <div className="actions">
                <button className="act" onClick={() => setRuns((r) => ({ ...r, [v.id]: (r[v.id] ?? 0) + 1 }))} aria-label={`להציג שוב את ${v.name}`}>
                  ↻ שוב
                </button>
                <button className="act primary" onClick={() => onTry(v.id, state)} aria-label={`לנסות את ${v.name} במסך מלא`}>
                  ⛶ מסך מלא
                </button>
              </div>
            </header>
            <div className="screens">
              {devices.map((d) => (
                <DeviceScreen key={d} device={d} src={src(v.id, d)} />
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

/** One variant full screen. On a touch screen it is the screen itself (the user's own phone, at its size); elsewhere a
 *  phone at its own size, as big as the window lets it be. */
function Try({ board, variant, state, view, onClose }: { board: AnyBoard; variant: string; state: string; view: View; onClose: () => void }) {
  const real = matchMedia('(pointer: coarse)').matches
  const [v, setV] = useState(variant)
  const [s, setS] = useState(state)
  const [run, setRun] = useState(0)
  const [device, setDevice] = useState<DeviceId>(view.devices.find((d) => d !== 'desktop') ?? 'upright')
  const [room, setRoom] = useState({ w: innerWidth, h: innerHeight })
  const close = useRef<HTMLButtonElement>(null)
  const done = useRef(onClose)
  done.current = onClose
  useEffect(() => {
    close.current?.focus()
    const was = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const key = (e: KeyboardEvent) => e.key === 'Escape' && done.current()
    const fit = () => setRoom({ w: innerWidth, h: innerHeight })
    addEventListener('keydown', key)
    addEventListener('resize', fit)
    return () => {
      document.body.style.overflow = was
      removeEventListener('keydown', key)
      removeEventListener('resize', fit)
    }
  }, [])
  const d = DEVICES[device]
  const k = Math.min(1, (room.w - 32) / d.w, (room.h - 92) / d.h)
  const src = frameSrc({ board: board.id, variant: v, state: s, run, device: real ? 'real' : device, speed: view.speed, touches: view.touches })
  return (
    <div className={`try${real ? ' real' : ''}`} role="dialog" aria-modal="true" aria-label={`לנסות: ${board.title}`}>
      <div className="try-bar">
        <button ref={close} className="chip close" onClick={onClose} aria-label="סגור">
          ✕
        </button>
        <div className="group" role="radiogroup" aria-label="הצעה">
          {board.variants.map((x) => (
            <button key={x.id} role="radio" aria-checked={v === x.id} className={`chip${v === x.id ? ' on' : ''}`} onClick={() => setV(x.id)}>
              {letter(x.id)}
            </button>
          ))}
        </div>
        <select value={s} onChange={(e) => setS(e.target.value)} aria-label="מצב">
          {board.states.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        {!real && (
          <div className="group" aria-label="מסך">
            {DEVICE_IDS.filter((x) => x !== 'desktop').map((x) => (
              <Toggle key={x} on={device === x} onClick={() => setDevice(x)}>
                {DEVICES[x].name}
              </Toggle>
            ))}
          </div>
        )}
        <button className="chip" onClick={() => setRun((n) => n + 1)} aria-label="שוב">
          ↻
        </button>
      </div>
      <div className="try-stage">
        {real ? (
          <iframe className="try-real" src={src} title={board.title} />
        ) : (
          <div className="glass" style={{ width: d.w * k, height: d.h * k }}>
            <iframe src={src} title={d.name} width={d.w} height={d.h} style={{ transform: `scale(${k})` }} />
          </div>
        )}
      </div>
    </div>
  )
}

const MAP_PICS = import.meta.glob('./map/*.{jpg,png,webp}', { eager: true, import: 'default' }) as Record<string, string>
const picsOf = (id: string) =>
  ['upright', 'sideways'].flatMap((k) => {
    const hit = Object.entries(MAP_PICS).find(([p]) => p.startsWith(`./map/${id}-${k}.`))
    return hit ? [{ k, url: hit[1] }] : []
  })
const GRADE = { good: 'טוב כמו שהוא', fix: 'לשפר', redo: 'לעצב מחדש', missing: 'חסר' } as const

function MapView({ onBoard }: { onBoard: (id: string) => void }) {
  const [big, setBig] = useState<string | null>(null)
  const screens = [...MAP.screens].sort((a, b) => a.priority - b.priority || AREAS.indexOf(a.area) - AREAS.indexOf(b.area))
  return (
    <section className="board map" aria-labelledby="map-title">
      <header className="board-head">
        <div className="title-row">
          <h2 id="map-title">מפת הממשק</h2>
          <span className="status chosen">{screens.length} מסכים</span>
        </div>
        <p className="ask">
          <span>מה זה</span>
          כל מה שעוטף את המשחק, כמו שהוא היום, עם מה שהמעצב מציע לשפר, לפי סדר עדיפות. מכאן באים הלוחות הבאים.
        </p>
        {MAP.summary && <p className="lede">{MAP.summary}</p>}
      </header>
      {screens.length === 0 && <p className="lede">המפה עוד בהכנה.</p>}
      <div className="map-grid">
        {screens.map((s: Screen) => (
          <article key={s.id} className={`spot grade-${s.grade}`}>
            <div className="pics">
              {picsOf(s.id).map((p) => (
                <button key={p.k} className={`pic pic-${p.k}`} onClick={() => setBig(p.url)} aria-label={`להגדיל את ${s.name}`}>
                  <img src={p.url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
            <div className="spot-text">
              <div className="title-row">
                <h3>{s.name}</h3>
                <span className="tag-p">עדיפות {s.priority}</span>
                <span className={`tag-g ${s.grade}`}>{GRADE[s.grade]}</span>
              </div>
              <p className="area">
                {s.area} · <code>{s.where}</code>
              </p>
              {s.works && <p className="works">✓ {s.works}</p>}
              {s.wrong.length > 0 && (
                <ul className="wrong">
                  {s.wrong.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
              <p className="idea">
                <b>ההצעה:</b> {s.idea}
              </p>
              {s.board && (
                <button className="act" onClick={() => onBoard(s.board!)}>
                  ללוח שלו ←
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {big && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="תמונה" onClick={() => setBig(null)}>
          <img src={big} alt="" />
          <button className="chip close" aria-label="סגור">
            ✕
          </button>
        </div>
      )}
    </section>
  )
}

function Lab() {
  const [hash, setHash] = useState(() => location.hash.slice(1))
  const [view, setViewState] = useState(savedView)
  const [trying, setTrying] = useState<{ board: AnyBoard; variant: string; state: string } | null>(null)
  useEffect(() => {
    const on = () => setHash(location.hash.slice(1))
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  const setView = (v: View) => {
    setViewState(v)
    saveView(v)
  }
  const go = (id: string) => {
    location.hash = id
    scrollTo({ top: 0 })
  }
  const board = hash === 'map' ? null : (BOARDS.find((b) => b.id === hash) ?? BOARDS[0])
  return (
    <div className="lab">
      <header className="lab-head">
        <p className="eyebrow">3D HOME · מעבדת עיצוב</p>
        <h1>בוחרים עיצוב לפני שהוא נכנס למשחק</h1>
        <p className="lede">
          כל לוח הוא חלק אחד מהממשק: "היום" הוא מה שיש במשחק עכשיו, והאותיות הן ההצעות. בכל מסך אפשר ללחוץ, לגרור ולהחליק כמו במשחק. ⛶ פותח הצעה במסך מלא – בטלפון שלך, בגודל האמיתי ובאצבע שלך.
        </p>
      </header>
      <nav className="boards" aria-label="לוחות">
        {BOARDS.map((b) => (
          <a key={b.id} href={`#${b.id}`} className={`board-card${board?.id === b.id ? ' on' : ''}`} aria-current={board?.id === b.id ? 'page' : undefined}>
            <b>{b.title}</b>
            <span className={`status ${b.status}`}>{statusText(b)}</span>
            <small>{b.variants.filter((v) => v.id !== 'today').length} הצעות</small>
          </a>
        ))}
        <a href="#map" className={`board-card map-card${hash === 'map' ? ' on' : ''}`} aria-current={hash === 'map' ? 'page' : undefined}>
          <b>מפת הממשק</b>
          <span className="status chosen">{MAP.screens.length ? `${MAP.screens.length} מסכים` : 'בהכנה'}</span>
          <small>מה לשפר אחר כך</small>
        </a>
      </nav>
      {board ? <BoardView key={board.id} board={board} view={view} setView={setView} onTry={(variant, state) => setTrying({ board, variant, state })} /> : <MapView onBoard={go} />}
      <footer className="lab-foot">
        <h2>איך בוחרים</h2>
        <p>כתבו בצ'אט את האות שבחרתם ומה לשנות, למשל: "חלון הרמה: B, אבל עם הכפתור של C". רק אחרי שתאשרו, העיצוב נכנס למשחק.</p>
      </footer>
      {trying && <Try {...trying} view={view} onClose={() => setTrying(null)} />}
    </div>
  )
}

createRoot(document.getElementById('lab')!).render(
  <StrictMode>
    <Lab />
  </StrictMode>,
)
