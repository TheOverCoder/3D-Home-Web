import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import type { Board } from '../board'
import { BOARDS } from '../boards'
import { DEVICES } from '../devices'
import { AREAS, MAP, type Screen } from '../map'
import { useReviews, type Note } from './reviews'

// The sandbox: the game with nothing of the game in it but its look. It opens on the game's screen (a still of the
// game, lab/frame.html?play=1) where every chip or button that has designs waiting is ringed and named; a touch opens
// it there, as the game would, and the bar under the thumb switches between today and the proposals (A, B, C) and the
// states, and says what the user thinks: ✓ or ✗ on a variant, a note on it, or a note pinned to one point of it. ☰
// lists every screen of the game (the map, lab/map.ts): those with designs open from it, the others can be asked for.
// On a phone the screen is the phone's own, at its size; on a computer, a phone at its size, as big as the window
// lets it be. A board needs nothing to be here: its `spot` rings it on the screen, its `screen` puts it in the list.

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyBoard = Board<any>

const letter = (id: string) => (id === 'today' ? 'היום' : id.toUpperCase())
const firstPick = (b: AnyBoard) => (b.variants.find((v) => v.id !== 'today') ?? b.variants[0]).id

const MAP_PICS = import.meta.glob('../map/*.{jpg,png,webp}', { eager: true, import: 'default' }) as Record<string, string>
const thumbOf = (id?: string) => (id ? (MAP_PICS[`../map/${id}-upright.jpg`] ?? MAP_PICS[`../map/${id}-sideways.jpg`]) : undefined)
const GRADE = { good: 'טוב כמו שהוא', fix: 'לשפר', redo: 'לעצב מחדש', missing: 'חסר' } as const

// the viewer's own settings of the sandbox (a convenience: it works the same without them)
interface Prefs {
  device: 'upright' | 'sideways'
  slow: boolean
  reduced: boolean
  seen: boolean
  last: Record<string, string>
}
const PREFS = 'lab-play'
function readPrefs(): Prefs {
  const plain: Prefs = { device: 'upright', slow: false, reduced: false, seen: false, last: {} }
  try {
    return { ...plain, ...(JSON.parse(localStorage.getItem(PREFS) ?? '{}') as Partial<Prefs>) }
  } catch {
    return plain
  }
}
function keepPrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS, JSON.stringify(p))
  } catch {
    // private window
  }
}

type Sheet = null | { kind: 'list' } | { kind: 'states' } | { kind: 'note'; x?: number; y?: number } | { kind: 'pin'; note: Note }

export function Play({ start, onPage }: { start?: string; onPage: (hash: string) => void }) {
  const real = useRef(matchMedia('(pointer: coarse)').matches).current
  const [prefs, setPrefsState] = useState(readPrefs)
  const setPrefs = (p: Partial<Prefs>) =>
    setPrefsState((was) => {
      const now = { ...was, ...p }
      keepPrefs(now)
      return now
    })
  const startBoard = BOARDS.find((b) => b.id === start)
  const [openId, setOpenId] = useState<string | null>(startBoard?.id ?? null)
  const board = BOARDS.find((b) => b.id === openId) ?? null
  const [variant, setVariant] = useState(startBoard ? (prefs.last[startBoard.id] ?? firstPick(startBoard)) : '')
  const [stateId, setStateId] = useState(startBoard?.states[0].id ?? '')
  const [run, setRun] = useState(0)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [pinning, setPinning] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [wide, setWide] = useState(() => innerWidth > innerHeight)
  const r = useReviews()

  const frame = useRef<HTMLIFrameElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState({ w: 0, h: 0 })

  // the screen: the phone's own on a phone, else a phone at its size fitted to the stage
  const kind: 'upright' | 'sideways' = real ? (wide ? 'sideways' : 'upright') : prefs.device
  const d = DEVICES[kind]
  const k = real ? 1 : Math.min(1, Math.max(0.2, (room.w - 24) / d.w), Math.max(0.2, (room.h - 24) / d.h))
  const query = `play=1&device=${real ? 'real' : kind}&touches=1&speed=${prefs.slow ? 0.25 : 1}${prefs.reduced ? '&motion=reduce' : ''}`
  const hashOf = (id: string | null, v: string, s: string, n: number) => (id ? `${id}/${v}/${s}/${n}` : '')
  const [src] = useState(() => `frame.html?${query}#${hashOf(openId, variant, stateId, 0)}`)
  const [srcQuery, setSrcQuery] = useState(query)

  useLayoutEffect(() => {
    const el = stage.current
    if (!el) return
    const fit = () => setRoom({ w: el.clientWidth, h: el.clientHeight })
    fit()
    const watch = new ResizeObserver(fit)
    watch.observe(el)
    const turn = () => setWide(innerWidth > innerHeight)
    addEventListener('resize', turn)
    return () => {
      watch.disconnect()
      removeEventListener('resize', turn)
    }
  }, [])

  // the frame follows what is open: the address after # (no reload); its settings, a reload
  useEffect(() => {
    const w = frame.current?.contentWindow
    // until the frame has its own page (about:blank first), its first address already says what to show
    if (!w || !w.location.pathname.endsWith('frame.html')) return
    if (query !== srcQuery) {
      w.location.replace(`frame.html?${query}#${hashOf(openId, variant, stateId, run)}`)
      setSrcQuery(query)
      return
    }
    try {
      w.location.replace(`${w.location.pathname}${w.location.search}#${hashOf(openId, variant, stateId, run)}`)
    } catch {
      // the frame is still loading: its first address already says it
    }
  }, [openId, variant, stateId, run, query, srcQuery])

  const open = (id: string) => {
    const b = BOARDS.find((x) => x.id === id)
    if (!b) return
    setSheet(null)
    setPinning(false)
    setOpenId(b.id)
    setVariant(prefs.last[b.id] ?? firstPick(b))
    setStateId(b.states[0].id)
    setRun((n) => n + 1)
  }
  const close = () => {
    setPinning(false)
    setSheet(null)
    setOpenId(null)
  }
  const pick = (v: string) => {
    setVariant(v)
    if (board) setPrefs({ last: { ...prefs.last, [board.id]: v } })
  }
  const say = (text: string) => {
    setToast(text)
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), 2600)
  }

  // what the screen asks: open a board, it closed, a touch where nothing opens
  useEffect(() => {
    const heard = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !e.data?.lab) return
      if (e.data.type === 'open') open(String(e.data.board))
      else if (e.data.type === 'closed') close()
      else if (e.data.type === 'hint' && !pinning) say(BOARDS.some((b) => b.spot) ? 'מה שאפשר לפתוח מסומן בטבעת צהובה. הכל נמצא גם ב־☰' : 'פתחו את ☰ כדי לבחור מסך')
    }
    addEventListener('message', heard)
    return () => removeEventListener('message', heard)
  })

  // keys on a computer: Esc closes, ← → go between the variants
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.('textarea, input, select')) return
      if (e.key === 'Escape') {
        if (pinning) setPinning(false)
        else if (sheet) setSheet(null)
        else close()
      } else if (board && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const ids = board.variants.map((v) => v.id)
        const i = ids.indexOf(variant) + (e.key === 'ArrowLeft' ? 1 : -1)
        if (ids[i]) pick(ids[i])
      }
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  })

  const review = board ? r.review(board.id) : null
  const here = (n: Note) => n.variant === variant && n.state === stateId && n.kind === kind
  const pins = review?.notes.filter((n) => here(n) && n.x != null) ?? []
  const notesOnVariant = review?.notes.filter((n) => n.variant === variant) ?? []
  const state = board?.states.find((s) => s.id === stateId)
  const box = real ? { w: room.w, h: room.h } : { w: d.w * k, h: d.h * k }

  const catchPin = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setPinning(false)
    setSheet({ kind: 'note', x, y })
  }

  return (
    <div className={`play${real ? ' real' : ''}${wide && real ? ' wide' : ''}${board ? ' opened' : ''}`} dir="rtl" lang="he">
      <div className="play-stage" ref={stage}>
        <div className={`play-screen${real ? '' : ' glass'}`} style={real ? undefined : { width: box.w, height: box.h }}>
          <iframe ref={frame} src={src} title="המסך של המשחק" width={real ? undefined : d.w} height={real ? undefined : d.h} style={real ? undefined : { transform: `scale(${k})` }} />
          {board && (
            <div className="pins" aria-hidden={pins.length === 0}>
              {pins.map((n, i) => (
                <button key={n.id} className="pin" style={{ left: `${n.x! * 100}%`, top: `${n.y! * 100}%` }} onClick={() => setSheet({ kind: 'pin', note: n })} aria-label={`הערה ${i + 1}: ${n.text}`}>
                  <span>{i + 1}</span>
                </button>
              ))}
            </div>
          )}
          {pinning && (
            <div className="pin-catch" onPointerDown={catchPin} role="button" aria-label="גע בנקודה בעיצוב">
              <span>גע בנקודה שעליה ההערה</span>
            </div>
          )}
        </div>
        {!prefs.seen && (
          <div className="coach" role="dialog" aria-label="ברוכים הבאים">
            <p>
              <b>זה ארגז החול:</b> המסך של המשחק, רק עם העיצובים. מה שעוצב מסומן <span className="ring">בטבעת צהובה</span> – געו בו כדי לפתוח, החליפו בין ההצעות למטה, וסמנו ✓ או ✗.
            </p>
            <button className="primary-btn" onClick={() => setPrefs({ seen: true })}>
              הבנתי
            </button>
          </div>
        )}
        {toast && (
          <p className="toast" role="status">
            {toast}
          </p>
        )}
      </div>

      {board && review ? (
        <div className="dock" role="toolbar" aria-label={`ההצעות ל${board.title}`}>
          <button className="d-btn d-close" onClick={close} aria-label="לסגור ולחזור למסך">
            ✕
          </button>
          <div className="d-seg" role="radiogroup" aria-label="הצעה">
            {board.variants.map((v) => (
              <button
                key={v.id}
                role="radio"
                aria-checked={variant === v.id}
                className={`d-var${variant === v.id ? ' on' : ''}${v.id === 'today' ? ' today' : ''}`}
                onClick={() => pick(v.id)}
                aria-label={`${letter(v.id)}: ${v.name}`}
              >
                {letter(v.id)}
                {review.verdicts[v.id] && <i className={`mark ${review.verdicts[v.id]}`}>{review.verdicts[v.id] === 'yes' ? '✓' : '✗'}</i>}
              </button>
            ))}
          </div>
          <button className="d-btn d-state" onClick={() => setSheet({ kind: 'states' })} aria-label={`מצב: ${state?.name}`}>
            <span>{state?.name}</span>
            <b className="short">מצב</b> ▾
          </button>
          <div className="judge">
            <button className={`d-btn d-yes${review.verdicts[variant] === 'yes' ? ' on' : ''}`} aria-pressed={review.verdicts[variant] === 'yes'} onClick={() => r.verdict(board.id, variant, 'yes')}>
              ✓ <span>אהבתי</span>
            </button>
            <button className={`d-btn d-no${review.verdicts[variant] === 'no' ? ' on' : ''}`} aria-pressed={review.verdicts[variant] === 'no'} onClick={() => r.verdict(board.id, variant, 'no')}>
              ✗ <span>לא</span>
            </button>
            <button className="d-btn d-note" onClick={() => setSheet({ kind: 'note' })}>
              💬 <span>הערה</span>
              {notesOnVariant.length > 0 && <i className="count">{notesOnVariant.length}</i>}
            </button>
            <button className={`d-btn d-pin${pinning ? ' on' : ''}`} aria-pressed={pinning} onClick={() => setPinning((p) => !p)}>
              📍 <span>נקודה</span>
            </button>
            <button className="d-btn d-again" onClick={() => setRun((n) => n + 1)} aria-label="לפתוח שוב (לראות את הפתיחה)">
              ↻
            </button>
            <button className="d-btn d-menu" onClick={() => setSheet({ kind: 'list' })} aria-label="כל המסכים">
              ☰
            </button>
          </div>
        </div>
      ) : (
        <div className="dock idle">
          <button className="d-btn d-list" onClick={() => setSheet({ kind: 'list' })}>
            ☰ <span>כל המסכים</span>
          </button>
          <p className="d-hint">געו בטבעת הצהובה במסך כדי לפתוח</p>
        </div>
      )}

      {sheet && (
        <div className="sheet-back" onClick={() => setSheet(null)}>
          <div className={`sheet sheet-${sheet.kind}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            {sheet.kind === 'list' && <List r={r} onOpen={open} onPage={onPage} prefs={prefs} setPrefs={setPrefs} real={real} onClose={() => setSheet(null)} />}
            {sheet.kind === 'states' && board && (
              <Options
                title="באיזה מצב לראות"
                options={board.states.map((s) => ({ id: s.id, name: s.name }))}
                on={stateId}
                onPick={(id) => {
                  setStateId(id)
                  setRun((n) => n + 1)
                  setSheet(null)
                }}
                onClose={() => setSheet(null)}
              />
            )}
            {sheet.kind === 'note' && board && (
              <NoteSheet
                title={sheet.x != null ? `הערה על הנקודה · ${letter(variant)}` : `הערה על ${letter(variant)}`}
                notes={notesOnVariant}
                onRemove={(id) => r.removeNote(board.id, id)}
                onSave={(text) => {
                  r.addNote(board.id, { variant, state: stateId, kind, x: sheet.x, y: sheet.y, text })
                  setSheet(null)
                  say(r.keeping === 'shared' ? 'נשמר. המעצב יקבל את זה' : 'נשמר בדפדפן הזה')
                }}
                onClose={() => setSheet(null)}
              />
            )}
            {sheet.kind === 'pin' && board && (
              <div className="pin-note">
                <h2>הערה על נקודה</h2>
                <p>{sheet.note.text}</p>
                <div className="sheet-actions">
                  <button
                    className="soft-btn"
                    onClick={() => {
                      r.removeNote(board.id, sheet.note.id)
                      setSheet(null)
                    }}
                  >
                    למחוק
                  </button>
                  <button className="primary-btn" onClick={() => setSheet(null)}>
                    סגירה
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Options({ title, options, on, onPick, onClose }: { title: string; options: { id: string; name: string }[]; on: string; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <>
      <SheetHead title={title} onClose={onClose} />
      <div className="options" role="radiogroup" aria-label={title}>
        {options.map((o) => (
          <button key={o.id} role="radio" aria-checked={on === o.id} className={`option${on === o.id ? ' on' : ''}`} onClick={() => onPick(o.id)}>
            {o.name}
          </button>
        ))}
      </div>
    </>
  )
}

function SheetHead({ title, onClose, children }: { title: string; onClose: () => void; children?: ReactNode }) {
  return (
    <header className="sheet-head">
      <h2>{title}</h2>
      {children}
      <button className="d-btn" onClick={onClose} aria-label="סגור">
        ✕
      </button>
    </header>
  )
}

function NoteSheet({ title, notes, onRemove, onSave, onClose }: { title: string; notes: Note[]; onRemove: (id: string) => void; onSave: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState('')
  const area = useRef<HTMLTextAreaElement>(null)
  useEffect(() => area.current?.focus({ preventScroll: true }), [])
  return (
    <>
      <SheetHead title={title} onClose={onClose} />
      <textarea ref={area} value={text} onChange={(e) => setText(e.target.value)} placeholder="מה לשנות? למשל: הכפתור קטן מדי, הכוכב צריך להיות גדול יותר…" rows={3} />
      <div className="sheet-actions">
        <button className="soft-btn" onClick={onClose}>
          ביטול
        </button>
        <button className="primary-btn" disabled={!text.trim()} onClick={() => onSave(text.trim())}>
          שמירה
        </button>
      </div>
      {notes.length > 0 && (
        <ul className="notes">
          {notes.map((n) => (
            <li key={n.id}>
              <span>
                {n.x != null && '📍 '}
                {n.text}
              </span>
              <button className="d-btn" onClick={() => onRemove(n.id)} aria-label={`למחוק: ${n.text}`}>
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/** Every screen of the game: those with designs first (they open), then the map's, by part of the game. */
function List({
  r,
  onOpen,
  onPage,
  prefs,
  setPrefs,
  real,
  onClose,
}: {
  r: ReturnType<typeof useReviews>
  onOpen: (id: string) => void
  onPage: (hash: string) => void
  prefs: Prefs
  setPrefs: (p: Partial<Prefs>) => void
  real: boolean
  onClose: () => void
}) {
  const designed = new Set(BOARDS.map((b) => b.screen).filter(Boolean))
  const rest = MAP.screens.filter((s) => !designed.has(s.id))
  const areas = AREAS.map((a) => ({ a, screens: rest.filter((s) => s.area === a) })).filter((g) => g.screens.length)
  const summary = (b: AnyBoard) => {
    const rv = r.review(b.id)
    const marks = Object.entries(rv.verdicts).map(([v, x]) => `${x === 'yes' ? '✓' : '✗'} ${letter(v)}`)
    return [...marks, rv.notes.length === 1 ? 'הערה אחת' : rv.notes.length ? `${rv.notes.length} הערות` : ''].filter(Boolean).join(' · ')
  }
  return (
    <>
      <SheetHead title="כל המסכים של המשחק" onClose={onClose} />
      <p className={`keeping ${r.keeping}`}>{r.keeping === 'shared' ? '✓ מה שתסמנו נשמר ומגיע למעצב' : r.keeping === 'local' ? 'מה שתסמנו נשמר רק בדפדפן הזה' : 'מתחבר…'}</p>
      <h3 className="list-title">יש הצעות – לבחירה שלך</h3>
      <div className="rows">
        {BOARDS.map((b) => (
          <div key={b.id} className="row board-row">
            <button className="row-main" onClick={() => onOpen(b.id)}>
              {thumbOf(b.screen) ? <img src={thumbOf(b.screen)} alt="" /> : <span className="thumb-none">✦</span>}
              <span className="row-text">
                <b>{b.title}</b>
                <small>
                  {b.variants.filter((v) => v.id !== 'today').length} הצעות{summary(b) && ` · ${summary(b)}`}
                </small>
              </span>
              <span className={`status ${b.status}`}>{b.status === 'live' ? 'במשחק' : b.status === 'chosen' ? 'נבחר' : 'פתיחה ←'}</span>
            </button>
            <button className="link-btn" onClick={() => onPage(b.id)}>
              זה לצד זה
            </button>
          </div>
        ))}
      </div>
      {areas.map(({ a, screens }) => (
        <section key={a}>
          <h3 className="list-title">{a}</h3>
          <div className="rows">
            {screens.map((s: Screen) => (
              <div key={s.id} className="row">
                <div className="row-main still">
                  {thumbOf(s.id) ? <img src={thumbOf(s.id)} alt="" /> : <span className="thumb-none">?</span>}
                  <span className="row-text">
                    <b>{s.name}</b>
                    <small className="idea">{s.idea}</small>
                  </span>
                  <span className={`grade ${s.grade}`}>{GRADE[s.grade]}</span>
                </div>
                <button className={`ask-btn${r.requests[s.id] ? ' on' : ''}`} aria-pressed={!!r.requests[s.id]} onClick={() => r.request(s.id)}>
                  {r.requests[s.id] ? '✓ ביקשת עיצוב' : '🙋 לעצב את זה'}
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
      <h3 className="list-title">תצוגה</h3>
      <div className="prefs">
        {!real && (
          <div className="seg" role="radiogroup" aria-label="הטלפון">
            {(['upright', 'sideways'] as const).map((k) => (
              <button key={k} role="radio" aria-checked={prefs.device === k} className={prefs.device === k ? 'on' : ''} onClick={() => setPrefs({ device: k })}>
                {DEVICES[k].name}
              </button>
            ))}
          </div>
        )}
        <button className={`pref${prefs.slow ? ' on' : ''}`} aria-pressed={prefs.slow} onClick={() => setPrefs({ slow: !prefs.slow })}>
          🐢 הילוך איטי
        </button>
        <button className={`pref${prefs.reduced ? ' on' : ''}`} aria-pressed={prefs.reduced} onClick={() => setPrefs({ reduced: !prefs.reduced })}>
          🧘 פחות תנועה
        </button>
        <button className="pref" onClick={() => onPage('map')}>
          🗺 מפת הממשק המלאה
        </button>
      </div>
    </>
  )
}
