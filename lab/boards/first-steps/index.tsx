import type { Board } from '../../board'
import type { StepsState } from './data'
import { StepsC } from './StepsC'

// A new farm's first ten minutes (plans/first-hour.md, Part C; its steps, record and pure engine are in:
// src/farm/firstSteps.ts): one step at a time in the top column, right under the compass — its picture, its words,
// its reward — a tap walks you there (the compass's walk), done it pays and the next comes, ✕ skips them (after a
// question), the last ends on "All set!". Its states are the game's own rows (FIRST_STEPS) at real points of a new
// farm; the lab's stand-in for the action passes a step, so the whole run can be played through under a finger.
// Behind: the game's top (the top board's D, live), over a still of the yard.

const ASK =
  'עשר הדקות הראשונות: 8 צעדים – לשתול, לאסוף ביצים, להשקות, לקצור, למכור בשער, לגזוז כבשה, לארוג בנול, לשלוח הזמנה. ' +
  'רמז קטן מתחת למצפן; נגיעה בו מובילה למקום; פרס קטן על כל צעד; אפשר לדלג. · המעצב מכין את שני הלוחות (הרמז, וכרטיס "נפתח!") יחד, כדי שתאשר את שניהם בסבב אחד. · ' +
  'C נבחר: "ליישם באופן מלא ולשפר את דמות החקלאי לעוד רגשות בהתאם לדיאלוג"'

const MOTION_STAND_IN = ' (בלוח: הכפתור המקווקו "דוגמה" למטה עושה את הצעד, כך אפשר לעבור את כל השמונה.)'

export const firstStepsBoard: Board<StepsState> = {
  id: 'first-steps',
  title: 'צעדים ראשונים',
  kind: 'ui',
  added: '2026-11-16T22:30',
  ask: ASK,
  status: 'live',
  chosen: 'c',
  round:
    'C במשחק, ולחוואי עשרה מצבי רוח לפי מה שהוא אומר. הפנים שלו הן החוואי של Fluent Emoji 3D, ומתחת לכובע – פרצוף של Fluent לכל רגש: ' +
    'עליז ("Let\'s plant some seeds!"), מופתע מהביצים, מעודד בהשקיה, עיניים של כוכבים ליבול הראשון, קורץ ("Psst… sell at the gate"), צוחק על התספורת של הכבשה, ' +
    'סקרן ליד הנול, וגאה בצעד האחרון. גם לכל רגע יש פנים: צעד שנעשה – קורן; ההליכה – מעודד; "Skip the tips?" – מתחנן שתישאר; "All set!" – כוכבים בעיניים; ואין לאן ללכת עדיין – נאנח. ' +
    'המשפטים נכתבו מחדש כך שיתאימו לרגש, וכל רגש עם תנועה משלו.',
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
      name: 'במשחק (C)',
      note:
        'החוואי אומר כל צעד בבועה – התמונה, המילים והפרס – ונגיעה בבועה מובילה לשם. הפנים שלו לפי מה שהוא אומר: לכל משפט רגש משלו, ולכל רגע (הליכה, צעד שנעשה, השאלה, הסוף) פנים משלו. ' +
        '✕ קטן על פינת הבועה, והשאלה – בבועה, כשהוא מתחנן קצת שתישאר.',
      motion:
        'משפט חדש מוקלד אות אחרי אות, והפנים מתחלפות איתו ונעות לפי הרגש: קפיצה כשהוא שמח, הטיית ראש כשהוא סקרן, קורץ או מתחנן, הנהון כשהוא מעודד, מתכווץ ונמתח כשהוא מופתע, ' +
        'רעד קטן כשהוא צוחק, ושקיעה איטית באנחה. צעד שנעשה: חותמת ✓ ירוקה, המטבעות עפים, והוא קורן וקופץ. בהליכה – שוליים בצבע שמש, הולך קטן, והוא מהנהן. ' +
        'בסוף – כוכבים בעיניים מעל "All set!", וקונפטי. מי שמעדיף פחות תנועה רואה רק את הפנים מתחלפות.' +
        MOTION_STAND_IN,
      render: (s, act) => <StepsC s={s} onClose={act.close} />,
    },
  ],
}
