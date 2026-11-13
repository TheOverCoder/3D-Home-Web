import { LevelCard } from '../../../src/farm/LevelCard'
import { levelView, type LevelView } from '../../../src/farm/levelView'
import { xpAt } from '../../../src/farm/xp'
import type { Board } from '../../board'

// The level's card (src/farm/LevelCard.tsx): the level chip opens it. Its states from the game's own numbers.

export const levelBoard: Board<LevelView> = {
  id: 'level',
  title: 'חלון הרמה',
  ask: 'הפופאפ של הרמה לא נראה מקצועי לעיצוב',
  still: 'yard',
  states: [
    { id: 'gift', name: 'ברמה הבאה בגד, ויש מטבעות לאסוף', data: levelView(xpAt(4) + 40, 2) },
    { id: 'later', name: 'ברמה הבאה אין בגד', data: levelView(xpAt(6) + 30, 6) },
    { id: 'top', name: 'הרמה העליונה', data: levelView(xpAt(500) + 1, 500) },
  ],
  variants: [
    {
      id: 'today',
      name: 'היום',
      note: 'מה שיש במשחק עכשיו.',
      render: (v, act) => <LevelCard v={v} onClaim={() => act.set({ ...v, unpaid: 0 })} onClose={act.close} />,
    },
  ],
}
