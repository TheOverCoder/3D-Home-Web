import { opensAt } from '../../../src/farm/unlocks'
import type { Board } from '../../board'
import { reached, type UnlocksState } from './data'
import { UnlocksA } from './UnlocksA'
import { UnlocksToday } from './UnlocksToday'

// What each level opens (plans/first-hour.md, Part B; its table and pure helpers are in: src/farm/unlocks.ts): a
// locked thing shown faded with the level it opens at — on the seed packets, the farm shop, the decoration, a price
// tag and its card, a machine's prompt, the meadows' labels — and, as a level is reached, what it opened, after the
// level's show (src/farm/XpChip.tsx LevelUp). Its states are the table's own rows at real levels (opensAt, lockedAt);
// one is a sample (a level that opens one thing: the table has none today). Behind: the game's top (the top board's
// D, live), over a still of the yard.

const ASK =
  'מפת "מה נפתח": טבלה אחת של מה כל רמה פותחת (גידולים, שדרוגים, מתכונים, קישוטים, שטחים). מה שעוד סגור מופיע דהוי עם מנעול ו"רמה N"; ' +
  'בעלייה ברמה מופיע כרטיס "נפתח!". מה שכבר שלך נשאר שלך. · המעצב מכין את שני הלוחות (הרמז, וכרטיס "נפתח!") יחד, כדי שתאשר את שניהם בסבב אחד.'

const ADDS = 'רמות פותחות דברים: מה שעוד נעול מופיע דהוי עם הרמה שבה ייפתח, ובעלייה ברמה רואים מה נפתח עכשיו.'

const at = (scene: UnlocksState['scene'], level: number, coins: number): UnlocksState => ({ scene, level, opens: [], coins })

export const unlocksBoard: Board<UnlocksState> = {
  id: 'unlocks',
  title: 'מה נפתח ברמה',
  kind: 'ui',
  added: '2026-11-16T22:30',
  ask: ASK,
  status: 'choose',
  still: 'yard-clean',
  spot: 'level',
  screen: 'level-up',
  devices: ['upright', 'sideways', 'desktop'],
  research: [
    {
      pattern: 'מה שעוד נעול לא מוסתר: הוא בחנות, דהוי, עם הרמה שבה ייפתח. כך החנות היא גם "מה מחכה לי", ויש סיבה לעלות רמה.',
      from: 'Hay Day – החנות ותפריט הבנייה',
      url: 'https://supercell.com/en/games/hayday/',
    },
    {
      pattern: 'בעלייה ברמה – שורה אחת של תמונות עם השמות של מה שנפתח, בכרטיס אחד: רואים הכל במבט ולא קוראים פסקה. (A)',
      from: 'Stardew Valley – מסך עליית המיומנות בלילה (מתכונים חדשים)',
      url: 'https://www.stardewvalley.net/',
    },
    {
      pattern: 'פרס שמתגלה קלף אחרי קלף: כל קלף עף מהתיבה ומתהפך לבד – לכל אחד רגע משלו, וזה מותח. (C)',
      from: 'Clash Royale – פתיחת תיבה',
      url: 'https://supercell.com/en/games/clashroyale/',
    },
    {
      pattern: 'הציפייה היא חצי מהפרס: להראות את מה שייפתח לפני שמגיעים – בכרטיס הרמה, תחת "At level 3".',
      from: 'Schultz, Dayan & Montague 1997 (lab/CRAFT.md)',
    },
  ],
  states: [
    { id: 'two', name: 'רמה 2: המופע של הרמה, ואז שלושה דברים – חיטה, קמח ותרנגולת', data: reached(2, 64) },
    { id: 'seeds', name: 'שקיות הזרעים ברמה 1: שישה מתוך שמונה נעולים', data: at('seeds', 1, 20) },
    { id: 'card', name: 'כרטיס הרמה ברמה 2: "At level 3" ומה שייפתח בה', data: { scene: 'card', level: 2, opens: opensAt(3), coins: 64 } },
  ],
  variants: [
    {
      id: 'today',
      name: 'היום',
      note:
        'במשחק היום אין נעילות: כל גידול, שדרוג, קישוט ושטח נקנים במחיר שלהם כבר מרמה 1, ולא רואים מה מחכה. עלייה ברמה מראה רק את המספר, ובכל רמה חמישית אחריו – כרטיס הבגד. ' +
        'זה הכרטיס ש־A צומח ממנו.',
      motion: 'המספר מתפוצץ באור ובטבעת ועולה למעלה; ברמה חמישית, כרטיס הבגד קופץ מתוך קרני אור מסתובבות ונעלם אחרי שלוש שניות.',
      render: (s, act) => <UnlocksToday s={s} onClose={act.close} />,
    },
    {
      id: 'a',
      name: 'כרטיס "Unlocked!" ושבב מנעול',
      note:
        'כרטיס הבגד נהיה כרטיס כללי: אחרי המספר (ואחרי הבגד, אם יש) קופץ כרטיס "Unlocked!" עם "Level 2", ובו כל מה שנפתח – תמונה ושם מתחתיה; חמישה נשברים לשתי שורות. ' +
        'נעול: התמונה דהויה, ובמקום המחיר – שבב עם מנעול ו־"Level 2". אותו שבב בכל מקום: בכרטיסים, על הכפתור, בתג שעל השדה, ליד הכפתור העגול ובשלטים של השטחים. ' +
        'בחנויות, מה שפתוח ראשון והנעול אחריו לפי הרמה. בכרטיס הרמה, תחת "At level 3" – שורה "Opens" עם התמונות והשמות.',
      motion:
        'הכרטיס קופץ מתוך קרני אור (כמו הבגד), והתמונות נוחתות אחת אחרי השנייה בקפיצה ובסיבוב קטן; אחרי שלוש וחצי שניות הוא עולה ונעלם. ' +
        'נגיעה בדבר נעול: רעידה קצרה, והשבב קופץ – הסיבה כבר כתובה בו. נגיעה בתג של השדה הנעול: רעידה, ואז הכרטיס שלו עם המנעול במקום Build.',
      adds: ADDS,
      render: (s, act) => <UnlocksA s={s} onClose={act.close} />,
    },
  ],
}
