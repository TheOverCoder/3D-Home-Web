import { LevelCard } from '../../../src/farm/LevelCard'
import { levelView, type LevelView } from '../../../src/farm/levelView'
import { xpAt } from '../../../src/farm/xp'
import type { Board } from '../../board'
import { LevelCardA } from './LevelCardA'
import { LevelCardB } from './LevelCardB'
import { LevelCardC } from './LevelCardC'

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
    {
      id: 'a',
      name: 'מדליה',
      note: 'הרמה במרכז: הכוכב הגדול בתוך טבעת שמתמלאת לפי ה-XP. מה שהרמה הבאה נותנת – בשני אריחים, הבגד הגדול והמטבעות לידו.',
      render: (v, act) => <LevelCardA v={v} onClaim={() => act.set({ ...v, unpaid: 0 })} onClose={act.close} />,
    },
    {
      id: 'b',
      name: 'חלון ראווה',
      note: 'הפרס של הרמה הבאה הוא הגיבור: הבגד גדול על במה עם קרני אור, ומיד מתחתיו הסרגל – כמה XP חסר כדי לקבל אותו.',
      render: (v, act) => <LevelCardB v={v} onClaim={() => act.set({ ...v, unpaid: 0 })} onClose={act.close} />,
    },
    {
      id: 'c',
      name: 'מסלול',
      note: 'דרך קצרה מהרמה שלך לרמה הבאה, שמתמלאת לפי ה-XP. מהתחנה הבאה יורד כרטיס עם מה שהיא נותנת.',
      render: (v, act) => <LevelCardC v={v} onClaim={() => act.set({ ...v, unpaid: 0 })} onClose={act.close} />,
    },
  ],
}
