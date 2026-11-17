import type { Board } from '../../board'
import type { StepsState } from './data'
import { StepsA } from './StepsA'
import { StepsB } from './StepsB'
import { StepsC } from './StepsC'
import { StepsToday } from './StepsToday'

// A new farm's first ten minutes (plans/first-hour.md, Part C; its steps, record and pure engine are in:
// src/farm/firstSteps.ts): one step at a time in the top column, right under the compass — its picture, its words,
// its reward — a tap walks you there (the compass's walk), done it pays and the next comes, ✕ skips them (after a
// question), the last ends on "All set!". Its states are the game's own rows (FIRST_STEPS) at real points of a new
// farm; the lab's stand-in for the action passes a step, so the whole run can be played through under a finger.
// Behind: the game's top (the top board's D, live), over a still of the yard.

const ASK =
  'עשר הדקות הראשונות: 8 צעדים – לשתול, לאסוף ביצים, להשקות, לקצור, למכור בשער, לגזוז כבשה, לארוג בנול, לשלוח הזמנה. ' +
  'רמז קטן מתחת למצפן; נגיעה בו מובילה למקום; פרס קטן על כל צעד; אפשר לדלג. · המעצב מכין את שני הלוחות (הרמז, וכרטיס "נפתח!") יחד, כדי שתאשר את שניהם בסבב אחד.'

const ADDS = 'עשר דקות ראשונות מודרכות: צעד אחד בכל פעם מתחת למצפן, נגיעה מובילה למקום, פרס קטן על כל צעד, ובסוף "All set!".'

const MOTION_STAND_IN = ' (בלוח: הכפתור המקווקו "דוגמה" למטה עושה את הצעד, כך אפשר לעבור את כל השמונה.)'

export const firstStepsBoard: Board<StepsState> = {
  id: 'first-steps',
  title: 'צעדים ראשונים',
  kind: 'ui',
  added: '2026-11-16T22:30',
  ask: ASK,
  status: 'choose',
  still: 'yard-clean',
  spot: 'compass',
  screen: 'first-steps',
  devices: ['upright', 'sideways', 'desktop'],
  research: [
    {
      pattern: 'המשימה שבמעקב היא שורה אחת ליד המפה, ובעולם יש סימן שמראה לאן ללכת. כאן: הרמז מתחת למצפן, ונגיעה מפעילה את ההליכה של המצפן עצמו.',
      from: 'Genshin Impact – מעקב המשימה',
      url: 'https://genshin.hoyoverse.com/',
    },
    {
      pattern: 'דמות שמלמדת בבועת דיבור: פנים, משפט קצר אחד – וממשיכים לשחק בעצמך. בדקות הראשונות של החווה מדבר החוואי. (C)',
      from: 'Hay Day – ההדרכה בפתיחה',
      url: 'https://supercell.com/en/games/hayday/',
    },
    {
      pattern: 'משימה בשורה אחת והפרס שלה כתמונה לידה; מה שנעשה מסומן, ויודעים כמה נשאר. (B: הנקודות, "3 of 8")',
      from: 'Pokémon GO – Field Research',
      url: 'https://pokemongolive.com/',
    },
    {
      pattern: 'ללמד באותם כלים שישמשו אחר כך, ולא במסך הסבר: הנגיעה ברמז היא ההליכה של המצפן, והצעד נעשה בכפתור הרגיל.',
      from: 'Meta – Growth Insights: onboarding',
      url: 'https://developers.meta.com/horizon/blog/growth-insights-series-best-practices-user-onboarding-recall-progression/',
    },
    {
      pattern: 'התקדמות שכבר התחילה נגמרת יותר: הצעדים שנעשו נשארים מלאים, והפרס של כל צעד בא מיד – ניצחונות קטנים ותכופים.',
      from: 'Nunes & Drèze 2006; Amabile & Kramer 2011 (lab/CRAFT.md)',
    },
  ],
  states: [
    { id: 'first', name: 'חווה חדשה: הצעד הראשון – לשתול', data: { step: 0, coins: 20, level: 1 } },
    { id: 'walking', name: 'נגעו ברמז: הולכים לערוגה (הרמז מסומן, כמו סימן במצפן)', data: { step: 0, coins: 20, level: 1, play: 'walk' } },
    { id: 'passed', name: 'צעד נעשה: ✓, חמישה מטבעות עפים, והבא נכנס (3 מתוך 8)', data: { step: 2, coins: 29, level: 1, play: 'pass' } },
    { id: 'skip', name: 'לדלג? (נלחץ ✕)', data: { step: 3, coins: 34, level: 1, play: 'skip' } },
    { id: 'finale', name: 'הצעד האחרון נעשה: "All set!"', data: { step: 7, coins: 118, level: 3, play: 'pass' } },
    { id: 'full', name: 'העמודה מלאה: הודעה, עלייה ברמה, הרמז של הפתיחה – והצעד מתחתם', data: { step: 4, coins: 44, level: 2, play: 'full' } },
  ],
  variants: [
    {
      id: 'today',
      name: 'היום',
      note: 'חווה חדשה מקבלת שורה שקטה אחת על השליטה, לשבע שניות (בטלפון – מתחת למצפן, במחשב – למטה), ואז כלום: שום דבר לא אומר מה עושים קודם.',
      motion: 'השורה נכנסת בהדרגה, נשארת שבע שניות ונעלמת.',
      render: (s) => <StepsToday s={s} />,
    },
    {
      id: 'a',
      name: 'A · שבב מתחת למצפן',
      note:
        'גלולה כהה אחת, כמו הסימנים של המצפן: התמונה של הצעד, המילים, והפרס (מטבע ו־"+10"), ו־✕ קטן לידה. ' +
        'נגיעה – הולכים לשם (ההליכה של המצפן), והשבב מסומן בשמש עד שמגיעים; נגיעה נוספת עוצרת. ✕ – השבב שואל במקומו "Skip the tips?" עם Keep ו־Skip.',
      motion:
        'השבב עולה מלמטה בקפיצה קטנה. צעד שנעשה: ✓ ירוק קופץ על התמונה, המטבעות עפים בקשת לצ׳יפ המטבעות (שסופר אותם), והשבב יוצא למעלה כשהבא נכנס מלמטה. ' +
        'בהליכה – שוליים בצבע שמש שנושמים והולך קטן על התמונה. בסוף: כרטיס "All set!" עם שמונה התמונות מסומנות וסך המטבעות, וקונפטי פעם אחת.' +
        MOTION_STAND_IN,
      adds: ADDS,
      render: (s, act) => <StepsA s={s} onClose={act.close} />,
    },
    {
      id: 'b',
      name: 'B · כרטיס עם "Show me" ונקודות',
      note:
        'כרטיס נייר קטן מתחת למצפן: למעלה שמונה נקודות – מה שנעשה ירוק עם ✓, הצעד הזה בטבעת שמש – ו־"3 of 8"; מתחת התמונה, המילים, "+5 coins", וכפתור צהוב "Show me" שמוביל לשם (בזמן ההליכה – "Stop"). ' +
        '✕ בפינה; השאלה מופיעה בתוך הכרטיס.',
      motion:
        'הכרטיס יורד למקומו. צעד שנעשה: הנקודה שלו מתמלאת בירוק בקפיצה, ✓ על התמונה, המטבעות עפים, והכרטיס "מתהפך" לצעד הבא – הישן יוצא שמאלה והחדש נכנס מימין. ' +
        'בהליכה – שוליים בצבע שמש. בסוף: "All set!" וקונפטי.' +
        MOTION_STAND_IN,
      adds: ADDS,
      render: (s, act) => <StepsB s={s} onClose={act.close} />,
    },
    {
      id: 'c',
      name: 'C · בועת דיבור מהחוואי',
      note:
        'חוואי (פנים עגולות) אומר כל צעד בבועה: התמונה, המילים והפרס; נגיעה בבועה מובילה לשם. ✕ קטן על פינת הבועה, והשאלה – בבועה. ' +
        'דמות שמלווה את עשר הדקות הראשונות, כמו שכן שעוזר. התמונה היא דוגמה (Fluent Emoji 3D, כמו שאר האיורים), שמורה בתיקיית הלוח.',
      motion:
        'הפנים קופצות, הבועה גדלה מהזנב והמילים מוקלדות אות אחרי אות (כמו מישהו שמדבר). צעד שנעשה: חותמת ✓ ירוקה נוחתת על הבועה, המטבעות עפים, החוואי קופץ משמחה, והמשפט הבא נאמר. ' +
        'בהליכה – שוליים בצבע שמש והולך קטן. בסוף החוואי מעל כרטיס "All set!", וקונפטי.' +
        MOTION_STAND_IN,
      adds: ADDS + ' ודמות חדשה – חוואי שמדבר בבועה (תמונה חדשה למשחק).',
      render: (s, act) => <StepsC s={s} onClose={act.close} />,
    },
  ],
}
