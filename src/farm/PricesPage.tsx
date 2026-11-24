// The prices page (`?prices`): every price of the game (the price book, ./priceBook.ts) by its group, to set on this
// device and try in play — the farm puts them in as it starts. What was changed is copied as text (to send, so it
// becomes the game's own in the tables) or pasted back. Its own small page, loaded only when asked for (main.tsx), in
// the dev-pages chunk the loader never downloads (vite.config.ts).
import { useMemo, useState } from 'react'
import { allPrices, applyDevicePrices, applyPrices, GROUP_NAMES, keepDevicePrices, priceOverrides, resetPrices, setPrice, type PriceRow } from './priceBook'
import './PricesPage.css'

applyDevicePrices()

const fmt = (n: number) => n.toLocaleString('en')

/** One price: its name, its value to change, and where it started when it differs. */
function Row({ row, onChange }: { row: PriceRow; onChange: () => void }) {
  const now = row.get()
  const [text, setText] = useState(String(now))
  const changed = now !== row.base
  const put = (value: string) => {
    setText(value)
    const n = Number(value)
    if (value.trim() !== '' && Number.isFinite(n) && setPrice(row.key, n)) {
      keepDevicePrices()
      onChange()
    }
  }
  return (
    <li className={`pp-row${changed ? ' changed' : ''}`}>
      <label className="pp-name" htmlFor={`pp-${row.key}`}>
        {row.name}
        {changed && <small>was {fmt(row.base)}</small>}
      </label>
      <input
        id={`pp-${row.key}`}
        className="pp-value"
        inputMode="numeric"
        value={text}
        onChange={(e) => put(e.target.value.replace(/[^\d.]/g, ''))}
        onBlur={() => setText(String(row.get()))}
        onFocus={(e) => e.target.select()}
      />
      <button className="btn soft small pp-undo" disabled={!changed} aria-label={`${row.name}: back to ${fmt(row.base)}`} onClick={() => put(String(row.base))}>
        ↺
      </button>
    </li>
  )
}

export function PricesPage() {
  // a price typed redraws the page (the count, the copy); a set pasted or all reset draws every row afresh (`epoch`)
  const [, setRev] = useState(0)
  const bump = () => setRev((r) => r + 1)
  const [epoch, setEpoch] = useState(0)
  const [query, setQuery] = useState('')
  const [paste, setPaste] = useState<string | null>(null)
  const [word, setWord] = useState('')
  const [sure, setSure] = useState(false)
  const rows = useMemo(() => allPrices(), [])
  const changed = Object.keys(priceOverrides()).length
  const q = query.trim().toLowerCase()
  const shown = q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.key.includes(q)) : rows
  const groups = Object.keys(GROUP_NAMES).filter((g) => shown.some((r) => r.group === g))

  const copy = async () => {
    const text = JSON.stringify(priceOverrides(), null, 2)
    try {
      await navigator.clipboard.writeText(text)
      setWord(`Copied ${changed} ${changed === 1 ? 'price' : 'prices'}`)
    } catch {
      setPaste(text)
      setWord('Select the text and copy it')
    }
  }
  const load = () => {
    try {
      const n = applyPrices(JSON.parse(paste ?? '{}'))
      keepDevicePrices()
      setWord(`${n} ${n === 1 ? 'price' : 'prices'} set`)
      setPaste(null)
      setEpoch((e) => e + 1)
    } catch {
      setWord('That is not a set of prices')
    }
  }
  const reset = () => {
    if (!sure) return setSure(true)
    resetPrices()
    keepDevicePrices()
    setSure(false)
    setWord('Every price as the game has it')
    setEpoch((e) => e + 1)
  }

  return (
    <main className="prices-page">
      <header className="paper pp-head">
        <h1>Prices</h1>
        <p>
          {changed ? (
            <>
              <b>{changed}</b> changed on this device only. Play to try them; to make them the game's, copy them and send them.
            </>
          ) : (
            "The game's own prices. A change here is for this device only, to try in play."
          )}
        </p>
        <div className="pp-actions">
          <button className="btn small" disabled={!changed} onClick={copy}>
            Copy changes
          </button>
          <button className="btn soft small" onClick={() => (setPaste(paste === null ? '' : null), setWord(''))}>
            Paste
          </button>
          <button className={`btn small ${sure ? 'berry' : 'soft'}`} disabled={!changed} onClick={reset} onBlur={() => setSure(false)}>
            {sure ? 'Reset all?' : 'Reset all'}
          </button>
          <a className="btn leaf small" href="./">
            Play
          </a>
        </div>
        {word && (
          <p className="pp-word" role="status">
            {word}
          </p>
        )}
        {paste !== null && (
          <div className="pp-paste">
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder='{ "machines:oven": 90 }' aria-label="Prices as text" rows={5} />
            <button className="btn small" disabled={!paste.trim()} onClick={load}>
              Set these
            </button>
          </div>
        )}
        <input className="pp-search" type="search" placeholder="Find a price" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find a price" />
      </header>
      {groups.map((g) => (
        <section key={g} className="paper pp-group">
          <h2>{GROUP_NAMES[g]}</h2>
          <ul>
            {shown
              .filter((r) => r.group === g)
              .map((r) => (
                <Row key={`${r.key}:${epoch}`} row={r} onChange={bump} />
              ))}
          </ul>
        </section>
      ))}
      {!groups.length && <p className="pp-none">No price by that name</p>}
    </main>
  )
}
