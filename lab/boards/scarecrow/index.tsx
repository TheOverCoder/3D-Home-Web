import type { Board } from '../../board'
import { ScarecrowView } from './ScarecrowView'

// Scarecrows for the farm (3D, the 3D designer's): something new the farm lacked. The user rejected the three of the
// English and Scottish fields that went into the game from round 2 and asked for nine new ones, three styles of three,
// built straight into the game with no lab round: nine kinds of the farm's decoration (src/models/scarecrows.ts,
// src/farm/decor.ts). "Before" is the place without them; the round-2 sets are in git (6ed5f7d, and B in 0d86b7a). Its
// states: in the game (at the player's eye, about eight metres off) and close (turning round the nine under a finger).

export interface ScarecrowState {
  view: 'game' | 'close'
}

export const scarecrowBoard: Board<ScarecrowState> = {
  id: 'scarecrow',
  title: 'דחלילים בערוגות',
  kind: '3d',
  added: '2026-11-16T09:00',
  done: { round: '2026-11-16T09:00', what: 'נבנה במשחק: 9 דחלילים חדשים בשלושה סגנונות, בחנות הקישוטים' },
  ask:
    'צריך עוד סוכן לעיצוב תלת־ממד: שיפורים שמביאים אלמנטים בתלת־ממד שמתאימים למשחק, או שיפורי תלת־ממד לאישור. תעשה את הסוכן ותן לו לבנות גם הצעות. · ' +
    'סיבוב 2: "לייצר לכל וריאציה 3 סוגי דחלילים תואמים, סך הכל 9, לפי דחלילים שבאמת היו טרנד פעם במציאות. תבנה אותם." · ' +
    'סיבוב 3: "התכוונתי לשדרג את כל ה־3 ל־3 דחלילים, סך הכל 9 ב־3 אופציות, ומה שיש עכשיו נפסל – 9 חדשים."',
  status: 'live',
  chosen: 'nine',
  round:
    'לפי ההערה שלך: שלושת הדחלילים הקודמים ירדו, ובמקומם תשעה חדשים בחנות הקישוטים – שלושה סגנונות, שלושה בכל אחד, כל אחד בתנוחה, בגדים, כובע וחפץ משלו. ' +
    'קש וטלאים: החקלאי, אוסף החציר עם הקלשון, והקטן עם החמנייה. הקציר: ראש הדלעת (הפנים המגולפות זוהרות בלילה), המכשפה עם המטאטא, וחבר העורבים. ' +
    'סרטים וברק: המנופף עם הסרטים, השבשבת, והמצלצל עם תבניות הפח. ' +
    'מי שכבר קנה דחליל ישן מקבל את החדש הכי דומה לו, באותה רמה: החורש ← החקלאי, הבוגל ← אוסף החציר, האדון ← המכשפה.',
  still: 'none',
  research: [
    {
      pattern: 'אוסף של דחלילי קישוט שכל אחד מהם מספר דבר אחד ברור: לכן כל דחליל כאן מחזיק משהו אחר – קלשון, חמנייה, עורב, מטאטא, סרטים, שבשבות, תבניות פח.',
      from: 'Stardew Valley – the Rarecrows',
      url: 'https://www.thegamer.com/stardew-valley-rarecrow-location-purchase-unlock-guide/',
    },
    {
      pattern: 'ציפורים נבהלות ממה שזז ומבריק ברוח: תבניות פח תלויות על חוט, שבשבות וסרטים. מכאן הסגנון "סרטים וברק".',
      from: 'Epic Gardening – keeping birds away from the garden',
      url: 'https://www.epicgardening.com/keep-birds-away-from-garden/',
    },
    {
      pattern: 'ראש דלעת הוא דחליל הקציר הקלאסי: ג׳ק ראש־הדלעת של באום (1904) והדחליל עם ראש הדלעת של הות׳ורן. מכאן ראשי הדלעת של "הקציר".',
      from: 'Jack Pumpkinhead (ויקיפדיה)',
      url: 'https://en.wikipedia.org/wiki/Jack_Pumpkinhead',
    },
    {
      pattern: 'בחוות האמריקאיות של שנות ה־30 הדחליל עשוי מבגדי עבודה ישנים, עם קש שיוצא מהם: מכאן "קש וטלאים" – ראש שק תפור, סרבל וכובע קש.',
      from: 'Popular Science – the history of scarecrows',
      url: 'https://www.popsci.com/environment/scarecrow-history/',
    },
    {
      pattern: 'דמות צריכה להיקרא קודם בצללית ואחר כך בצבע: כל אחד מהתשעה שונה בצללית (כובע, תנוחה, מה שהוא מחזיק) ולא רק בצבעים.',
      from: 'Valve – Illustrative Rendering in Team Fortress 2',
      url: 'https://steamcdn-a.akamaihd.net/apps/valve/2007/NPAR07_IllustrativeRenderingInTeamFortress2.pdf',
    },
  ],
  states: [
    { id: 'game', name: 'במשחק', data: { view: 'game' } },
    { id: 'close', name: 'מקרוב', data: { view: 'close' } },
  ],
  variants: [
    {
      id: 'today',
      name: 'לפני',
      note: 'המקום בלי הדחלילים.',
      render: (s) => <ScarecrowView v="today" s={s} />,
    },
    {
      id: 'nine',
      name: 'תשעת הדחלילים (במשחק)',
      note:
        'קש וטלאים, ראשי שק תפורים: החקלאי בכובע קש, חולצה אדומה וסרבל ג׳ינס, ידיים פרושות; אוסף החציר בכובע צמר ירוק, חולצת חרדל, כתפיות אדומות וקלשון; והקטן, ידיים למעלה, בכובע מצחייה צהוב, סרבל קצר אדום, רגלי קש וחמנייה. ' +
        'הקציר, ראשי דלעת ועורבים: ראש דלעת מגולף (הפנים זוהרות בלילה) עם וסט חום ועורב על היד; המכשפה עם דלעת לבנה, אף גזר, כובע סגול גבוה, שמלה, צעיף ומטאטא; וחבר העורבים עם דלעת מפוספסת, כובע מצחייה, מעיל ארוך, יד למעלה ועורב עליה ועוד אחד על הכובע. ' +
        'סרטים וברק, ראשי בד עם פרצוף מצויר: המנופף הגבוה בכובע אדום ומעיל טורקיז עם מקל סרטים; השבשבת במעיל גשם צהוב, מגפיים ירוקים ושבשבת בכל יד; והמצלצל עם סיר על הראש, שמלה ורודה, סינר ותבניות פח מבריקות. ' +
        'כל אחד 1,319–1,748 משולשים; מרחוק המשחק מצייר אותם בעותק קל יותר.',
      adds: 'תשעה קישוטים בחנות הקישוטים של החווה, במקום שלושת הדחלילים הקודמים.',
      render: (s) => <ScarecrowView v="nine" s={s} />,
    },
  ],
}
