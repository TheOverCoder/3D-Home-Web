import type { StepsState } from './data'
import { Backdrop, Column, FirstHint, Others } from './parts'

// Today: a new farm is told the controls in one quiet line for seven seconds (src/ui/Hud.tsx FirstHint: in the top
// column on a touch screen, along the bottom on a computer), then nothing says what to do first.

export function StepsToday({ s }: { s: StepsState }) {
  return (
    <div className="v-first-steps-today">
      <Backdrop s={s} />
      <Column>{s.play === 'full' ? <Others /> : <FirstHint />}</Column>
    </div>
  )
}
