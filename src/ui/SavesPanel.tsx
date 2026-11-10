import { useRef, useState } from 'react'
import { SLOTS, currentSlot, deleteSlot, exportSlot, importSlot, slotSummary, switchSlot, useFarm, type Slot } from '../farm/state'
import { persistStorage } from '../lib/sw'

// Three farms kept in this browser (no account needed): pick one to play, save one as a file on the device
// (a backup, or to carry it to another phone or computer), load one from a file, or start one afresh.

function ago(t: number | null) {
  if (!t) return ''
  const s = (Date.now() - t) / 1000
  if (s < 90) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} days ago`
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function SavesPanel() {
  useFarm((s) => s.rev)
  const [note, setNote] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Slot | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const target = useRef<Slot>(1)
  const current = currentSlot()

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const result = importSlot(target.current, await f.text())
    setNote(result.ok ? `Farm ${target.current} loaded from “${f.name}”.` : result.error)
    if (result.ok) void persistStorage(true)
  }

  return (
    <div className="saves">
      <p className="panel-note">Kept on this device. Save a file to keep a copy or move a farm.</p>
      <ul className="slots">
        {SLOTS.map((n) => {
          const s = slotSummary(n)
          const isCurrent = n === current
          return (
            <li key={n} className={`slot${isCurrent ? ' current' : ''}`}>
              <div className="slot-info">
                <strong>
                  Farm {n}
                  {isCurrent && <span className="slot-badge">playing</span>}
                </strong>
                <span>
                  {s.exists
                    ? `${s.coins} coins · ${s.sold} sold · ${s.growing} beds growing · ${s.animals} animals${s.savedAt ? ` · saved ${ago(s.savedAt)}` : ''}`
                    : 'Empty — a new farm'}
                </span>
              </div>
              <div className="slot-actions">
                {!isCurrent && (
                  <button
                    className="chip-btn strong"
                    onClick={() => {
                      switchSlot(n)
                      setNote(`Now playing Farm ${n}.`)
                    }}
                  >
                    Play
                  </button>
                )}
                <button
                  className="chip-btn"
                  disabled={!s.exists && !isCurrent}
                  onClick={() => {
                    const out = exportSlot(n)
                    download(out.name, out.text)
                    setNote(`Saved Farm ${n} as ${out.name}.`)
                    void persistStorage(true)
                  }}
                >
                  Save file
                </button>
                <button
                  className="chip-btn"
                  onClick={() => {
                    target.current = n
                    file.current?.click()
                  }}
                >
                  Load file
                </button>
                {confirm === n ? (
                  <button
                    className="chip-btn danger"
                    onClick={() => {
                      deleteSlot(n)
                      setConfirm(null)
                      setNote(`Farm ${n} starts afresh.`)
                    }}
                  >
                    Sure? Clear it
                  </button>
                ) : (
                  <button className="chip-btn" disabled={!s.exists} onClick={() => setConfirm(n)}>
                    Clear
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={onFile} />
      {note && (
        <p className="panel-note ok" role="status">
          {note}
        </p>
      )}
    </div>
  )
}
