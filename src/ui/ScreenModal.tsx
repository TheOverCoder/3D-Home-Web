import { useEffect, useRef, useState } from 'react'
import { screenById } from '../data/screens'
import { useHome } from '../store'

export function ScreenModal() {
  const id = useHome((s) => s.screen)
  const close = useHome((s) => s.closeScreen)
  const def = id ? screenById(id) : undefined
  const [tab, setTab] = useState(0)
  const closeButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setTab(0)
    if (def) closeButton.current?.focus()
  }, [def])

  if (!def) return null
  const active = def.tabs[tab] ?? def.tabs[0]

  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={{ ['--accent' as string]: def.accent }}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <p className="eyebrow">{def.subtitle}</p>
            <h2 id="modal-title">{def.title}</h2>
          </div>
          <button ref={closeButton} className="close" onClick={close} aria-label="Close (Esc)">
            ✕
          </button>
        </header>

        <div className="tabs" role="tablist">
          {def.tabs.map((t, i) => (
            <button key={t.label} role="tab" aria-selected={i === tab} className={i === tab ? 'on' : ''} onClick={() => setTab(i)}>
              {t.label}
            </button>
          ))}
        </div>

        <article role="tabpanel">
          <h3>{active.heading}</h3>
          <p>{active.body}</p>
          {active.points && (
            <ul>
              {active.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </article>

        <div className="bars" aria-hidden="true">
          {def.bars.map((b) => (
            <div key={b.label} className="bar">
              <div className="fill" style={{ height: `${b.value * 100}%` }} />
              <span>{b.label}</span>
            </div>
          ))}
        </div>
        <p className="foot">Press Esc to return to the house</p>
      </section>
    </div>
  )
}
