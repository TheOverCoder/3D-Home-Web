import '@fontsource-variable/fredoka'
import './lab.css'
import { StrictMode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { Board } from './board'
import { BOARDS } from './boards'

// The lab's page: each board, its states, and its variants side by side — each on a phone held upright and on one held
// sideways (lab/frame.html at the phone's own size, scaled to fit). You choose a letter, or say what to change.

const PHONES = {
  tall: { w: 390, h: 844, name: 'טלפון לאורך' },
  wide: { w: 844, h: 390, name: 'טלפון לרוחב' },
}

/** A phone's screen at its own size, scaled down to the room it has (as wide as `most` at most). */
function Phone({ src, kind, most }: { src: string; kind: keyof typeof PHONES; most: number }) {
  const p = PHONES[kind]
  const box = useRef<HTMLDivElement>(null)
  const [k, setK] = useState(most / p.w)
  useLayoutEffect(() => {
    const el = box.current?.closest('.phones') as HTMLElement | null
    if (!el) return
    const fit = () => setK(Math.min(most, el.clientWidth) / p.w)
    fit()
    const watch = new ResizeObserver(fit)
    watch.observe(el)
    return () => watch.disconnect()
  }, [most, p.w])
  return (
    <figure className="phone">
      <div className="phone-glass" ref={box} style={{ width: p.w * k, height: p.h * k }}>
        <iframe src={src} title={p.name} width={p.w} height={p.h} style={{ transform: `scale(${k})` }} loading="lazy" />
      </div>
      <figcaption>{p.name}</figcaption>
    </figure>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BoardView({ board }: { board: Board<any> }) {
  const [state, setState] = useState(board.states[0].id)
  const [runs, setRuns] = useState<Record<string, number>>({})
  const src = (v: string) => `frame.html#${board.id}/${v}/${state}/${runs[v] ?? 0}`
  return (
    <section className="board" id={board.id} aria-labelledby={`${board.id}-title`}>
      <header className="board-head">
        <h2 id={`${board.id}-title`}>{board.title}</h2>
        <p className="ask">
          <span>הבקשה</span>
          {board.ask}
        </p>
        <div className="states" role="radiogroup" aria-label="מצב">
          {board.states.map((s) => (
            <button key={s.id} role="radio" aria-checked={state === s.id} className={state === s.id ? 'on' : ''} onClick={() => setState(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
      </header>
      <div className="variants">
        {board.variants.map((v) => (
          <article key={v.id} className={`variant${v.id === 'today' ? ' today' : ''}`}>
            <header>
              <b className="letter" aria-hidden="true">
                {v.id === 'today' ? '·' : v.id.toUpperCase()}
              </b>
              <div>
                <h3>{v.id === 'today' ? v.name : `${v.id.toUpperCase()} · ${v.name}`}</h3>
                <p>{v.note}</p>
              </div>
              <button className="again" onClick={() => setRuns((r) => ({ ...r, [v.id]: (r[v.id] ?? 0) + 1 }))} aria-label={`להציג שוב את ${v.name}`}>
                ↻ שוב
              </button>
            </header>
            <div className="phones">
              <Phone src={src(v.id)} kind="tall" most={270} />
              <Phone src={src(v.id)} kind="wide" most={620} />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function Lab() {
  const [, setHash] = useState(location.hash)
  useEffect(() => {
    const on = () => setHash(location.hash)
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return (
    <div className="lab">
      <header className="lab-head">
        <p className="eyebrow">3D HOME · מעבדת עיצוב</p>
        <h1>בוחרים עיצוב לפני שהוא נכנס למשחק</h1>
        <p className="lede">כל לוח הוא חלק אחד מהממשק. "היום" הוא מה שיש במשחק עכשיו, והאותיות הן ההצעות. כל הצעה מוצגת על טלפון לאורך ולרוחב, מעל תמונה אמיתית מהמשחק, והכפתורים בה עובדים.</p>
      </header>
      {BOARDS.map((b) => (
        <BoardView key={b.id} board={b} />
      ))}
      <footer className="lab-foot">
        <h2>איך בוחרים</h2>
        <p>כתבו בצ'אט את האות שבחרתם ומה לשנות, למשל: "חלון הרמה: B, אבל עם הכפתור של C". רק אחרי שתאשרו, העיצוב נכנס למשחק.</p>
      </footer>
    </div>
  )
}

createRoot(document.getElementById('lab')!).render(
  <StrictMode>
    <Lab />
  </StrictMode>,
)
