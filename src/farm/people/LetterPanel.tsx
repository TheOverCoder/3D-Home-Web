import { useEffect, useState } from 'react'
import { farmSound, uiClick } from '../../audio/sound'
import { useHome } from '../../store'
import { sayLine } from '../../talk/speech'
import { registerCard } from '../../ui/cardQueue'
import { farm, firstLetterDue, readLetter } from '../state'
import { LetterCard } from './LetterCard'
import { MAILBOX, MAILBOX_TOP } from './mailbox'
import { letterOf } from './mail'
import { letterView, type LetterView } from './view'

// A letter, read (./LetterCard.tsx draws it): the one asked for (`id`: read again from the neighbours' sheet), else the
// oldest waiting in the mailbox. Read to its end, it goes with the letters read and its gift comes in (src/farm/state/
// neighbours.ts, readLetter), shown as a reward at the mailbox. The card keeps the letter it opened with: reading it
// changes the mailbox under it.

/** The letter the card opens with (null: none to read). */
function opening(id?: string, again = false): LetterView | null {
  const waiting = farm.mail.waiting
  const read = farm.mail.read
  // (one asked for that the mailbox no longer keeps is read again all the same: its words are the game's)
  const text = id ? letterOf(id) : null
  const l = id ? (waiting.find((x) => x.id === id) ?? read.find((x) => x.id === id) ?? (text ? { id, from: text.from } : undefined)) : waiting[0]
  if (!l) return null
  return letterView(l, farm.friends, again || !waiting.includes(l))
}

export function LetterPanel({ id, again = false }: { id?: string; again?: boolean }) {
  const close = useHome((s) => s.closePanel)
  const [v] = useState(() => opening(id, again))
  useEffect(() => {
    if (!v) close()
  }, [v, close])
  if (!v) return null
  return (
    <LetterCard
      v={v}
      onLine={(line) => {
        uiClick()
        sayLine(line)
      }}
      onClaim={() => {
        if (v.again) return
        readLetter(v.id, { x: MAILBOX.x, y: MAILBOX_TOP + 0.4, z: MAILBOX.z })
        if (v.prize) farmSound('surprise')
      }}
      onClose={close}
    />
  )
}

/** The very first letter on the card queue (src/ui/cardQueue.ts, 'letter'): due while it waits unread, it opens by
 *  itself after the welcome back and the day's gift, within the visit's budget, never in the visit a new farm's first
 *  steps end in. Every later letter waits on the mailbox's flag. */
export function LetterWatcher() {
  useEffect(
    () =>
      registerCard('letter', {
        due: firstLetterDue,
        open: () => useHome.getState().openPanel({ kind: 'letter' }),
        showing: () => useHome.getState().panel?.kind === 'letter',
      }),
    [],
  )
  return null
}
