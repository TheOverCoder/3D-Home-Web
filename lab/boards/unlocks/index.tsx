import { opensAt } from '../../../src/farm/unlocks'
import type { Board } from '../../board'
import { reached, type UnlocksState } from './data'
import { UnlocksA } from './UnlocksA'
import { UnlocksB } from './UnlocksB'
import { UnlocksC } from './UnlocksC'
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
  done: { round: '2026-11-16T22:30', what: 'נבנה במשחק: "נפתח!" גדול וארוך יותר: כרטיסים שיוצאים מהכוכב של הרמה' },
  ask: ASK,
  status: 'live',
  chosen: 'c',
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
    { id: 'three', name: 'רמה 3: חמישה דברים – איך זה נשבר לשורות', data: reached(3, 120) },
    { id: 'one', name: 'דבר אחד (דוגמה: השדה המערבי לבד – בטבלה היום אין רמה שפותחת רק אחד)', data: { ...reached(9, 640), opens: ['upgrade:west'] } },
    { id: 'ten', name: 'רמה 10: קודם הבגד, ואחריו ארבעה דברים', data: reached(10, 900) },
    { id: 'seeds', name: 'שקיות הזרעים ברמה 1: שישה מתוך שמונה נעולים', data: at('seeds', 1, 20) },
    { id: 'shop', name: 'החנות ברמה 4: שלושה פתוחים, שישה נעולים', data: at('shop', 4, 180) },
    { id: 'decor', name: 'הקישוטים ברמה 4: חמישה פתוחים, 13 נעולים', data: at('decor', 4, 180) },
    { id: 'world', name: 'בחצר ברמה 1: תגי מחיר (ערוגה פתוחה, שדה נעול – נגיעה פותחת את הכרטיס) והתנור ליד הכפתור', data: at('world', 1, 75) },
    { id: 'edit', name: 'מלמעלה, במצב עריכה (רמה 5): השטחים מעבר לגדר', data: at('edit', 5, 252) },
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
      name: 'A · כרטיס "Unlocked!" ושבב מנעול',
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
    {
      id: 'b',
      name: 'B · סרט מתחת למספר ותג על התמונה',
      note:
        'בלי כרטיס שני: המופע של הרמה עצמו מביא את מה שנפתח – סרט אדום (כמו "At level N" בכרטיס הרמה) נפרש מתחת למספר, ועליו כל דבר בעיגול לבן עם השם. רגע אחד, ואז שניהם עולים ונעלמים. ' +
        'נעול: התמונה דהויה, על הפינה שלה תג סגול (צבע הרמות) עם מנעול ומספר הרמה, והמחיר נשאר במקומו – אפור – כדי שיודעים גם כמה זה יעלה.',
      motion: 'המספר מתפוצץ כמו היום, וחצי שנייה אחר כך הסרט נפרש מהאמצע לצדדים; העיגולים קופצים אחד אחרי השני. כל המופע כחמש שניות, ואז עולה ונעלם. נגיעה בדבר נעול: רעידה, והתג הסגול קופץ.',
      adds: ADDS,
      render: (s, act) => <UnlocksB s={s} onClose={act.close} />,
    },
    {
      id: 'c',
      name: 'C · קלפים שמחולקים, וסרט הרמה בפינה',
      note:
        'אחרי המספר, קלף קטן לכל דבר שנפתח, מחולק אחד אחרי השני: התמונה, השם, ואיפה מוצאים אותו (Seeds, Mill, Shop, Decor). אחרי רגע הקלפים נאספים לכוכב של הרמה למעלה – שם, בכרטיס הרמה, מחכה "מה הבא". ' +
        'נעול: סרט אדום באלכסון על הפינה – "Level 6" – והמחיר נעלם; בתג שעל השדה ובשלטים הסרט הוא התג עצמו.',
      motion:
        'כל קלף עף מלמעלה, מסתובב מהגב (כוכב על אדום) לפנים ונוחת עם הטיה קטנה, כל 0.2 שנייה אחד. אחרי שתי שניות הם עפים בקשת לכוכב של הרמה בלוח, והכוכב קופץ כשהאחרון נוחת. ' +
        'נגיעה בדבר נעול: רעידה, והסרט קופץ.',
      adds: ADDS + ' ועל כל קלף – איפה מוצאים את מה שנפתח.',
      render: (s, act) => <UnlocksC s={s} onClose={act.close} />,
    },
  ],
}
