import { coarsePointer } from '../lib/device'
import { busy, useHome } from '../store'
import { Check, Clock, X } from './glyphs'
import { ItemPic } from './ItemPic'

const time = (s: number) => (s < 60 ? `${s} s` : `${Math.round((s / 60) * 10) / 10} min`)

/**
 * A machine asking before it takes its ingredients — the oven a cake's, the mill a load of wheat, the loom the
 * fleeces: a small card right over the action button (on a computer, over the prompt) with what comes out, how
 * long it takes and, small, what goes in, each with how many. Cancel first, the action last. The action button
 * again (or E, or Esc) closes it, so a second press by mistake never uses anything up; Enter goes ahead.
 */
export function ConfirmCard() {
  const confirm = useHome((s) => s.confirm)
  const occupied = useHome(busy)
  if (!confirm || occupied) return null
  const close = () => useHome.getState().setConfirm(null)
  const go = () => {
    confirm.go()
    close()
  }
  return (
    <div className={`confirm-card paper${coarsePointer ? ' touch' : ''}`} role="dialog" aria-label={`${confirm.word} ${confirm.title}?`}>
      <div className="confirm-head">
        <ItemPic id={confirm.item} count={confirm.count} />
        <div className="confirm-title">
          <strong>{confirm.title}</strong>
          <span className="tag">
            <Clock weight="bold" />
            {time(confirm.seconds)}
          </span>
        </div>
      </div>
      <div className="confirm-inputs" aria-label="It takes">
        {confirm.inputs.map((i) => (
          <ItemPic key={i.item} id={i.item} count={i.count} />
        ))}
      </div>
      <div className="confirm-actions">
        <button className="btn soft round" onClick={close} aria-label="Cancel" title={coarsePointer ? undefined : 'Cancel (Esc)'}>
          <X weight="bold" />
        </button>
        <button className="btn leaf" onClick={go}>
          <Check weight="bold" />
          {confirm.word}
          {!coarsePointer && <kbd>Enter</kbd>}
        </button>
      </div>
    </div>
  )
}
