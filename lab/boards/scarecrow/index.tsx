import type { Board } from '../../board'
import { ScarecrowView } from './ScarecrowView'

// Scarecrows for the beds (3D, the 3D designer's): something new the farm lacked, in the place they would stand — at
// the far end of the west beds by the fence, facing the garden door, the first thing seen down the path on the way out
// of the garden door. The user chose B (the English and Scottish fields), now in the game: three kinds of the farm's
// decoration (src/models/scarecrows.ts, src/farm/decor.ts). "Today" is the place as it was, without them; A and C (the
// American farm, the Japanese rice field) left the board once B was chosen (in git, 323e07f). Its states: in the game
// (at the player's eye on the path) and close (turning round the three under a finger).

export interface ScarecrowState {
  view: 'game' | 'close'
}

export const scarecrowBoard: Board<ScarecrowState> = {
  id: 'scarecrow',
  title: 'דחלילים בערוגות',
  kind: '3d',
  added: '2026-11-16T09:00',
  ask:
    'צריך עוד סוכן לעיצוב תלת־ממד: שיפורים שמביאים אלמנטים בתלת־ממד שמתאימים למשחק, או שיפורי תלת־ממד לאישור. תעשה את הסוכן ותן לו לבנות גם הצעות. · ' +
    'סיבוב 2: "לייצר לכל וריאציה 3 סוגי דחלילים תואמים, סך הכל 9, לפי דחלילים שבאמת היו טרנד פעם במציאות. תבנה אותם."',
  status: 'live',
  chosen: 'b',
  round:
    'במשחק: B, שלושת הדחלילים של אנגליה וסקוטלנד, הם עכשיו שלושה קישוטים חדשים בחנות הקישוטים (התיק בכרטיס של מצב העריכה): ' +
    'האדון עם ראש הלפת (200 מטבעות), החורש עם ראש המנגולד (160) והבוגל עם ראש השק, הצעיף והרעשן (180) – כל אחד הבא יקר יותר, כמו כל קישוט. ' +
    'מציבים אותם איפה שרוצים ומסובבים ברבעי סיבוב, הם מטילים צל אמיתי כמו שאר הקישוטים, ואי אפשר לעבור דרכם. ' +
    'A ו־C ירדו מהלוח כדי שיישאר מה שבחרת (החווה האמריקאית ושדה האורז ביפן; הם שמורים בהיסטוריה של הקוד).',
  still: 'none',
  research: [
    {
      pattern: 'בבריטניה ממלאים שק בקש ושמים עליו לפת או דלעת עם פרצוף מגולף; וורזל גאמידג׳ החליף ראשים של לפת, מנגולד ולפת שוודית. מכאן ראשי השורש המגולפים של B.',
      from: 'Worzel Gummidge ודחלילים בריטיים',
      url: 'https://en.wikipedia.org/wiki/Worzel_Gummidge',
    },
    {
      pattern: 'הדחליל הבריטי לובש בגדים ישנים של אחרים: כובע צילינדר או מגבעת באולר, מעיל, וחלוק העבודה של החורש הכפרי.',
      from: 'The smock frock – the English rural smock',
      url: 'https://www.smockfrock.co.uk/tag/katty-king/',
    },
    {
      pattern: 'דמות צריכה להיקרא קודם בצללית ואחר כך בצבע: כל שלישייה כאן שונה בצללית (כובע רחב, צילינדר, קונוס; מכנסיים, שמלה, גלימה) ולא רק בצבעים.',
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
      note: 'הערוגות כמו שהיו לפני הדחלילים: בסוף השביל רק הגדר והשדה שמעבר לה.',
      render: (s) => <ScarecrowView v="today" s={s} />,
    },
    {
      id: 'b',
      name: 'השדות של אנגליה (במשחק)',
      note:
        'שלושה דחלילים בבגדים ישנים: האדון עם ראש לפת מגולף, כובע צילינדר מעוך, פראק שחור עם זנבות ואפוד אדום (1,352 משולשים); החורש עם ראש מנגולד, חלוק עבודה ארוך בצבע זית עם צווארון רחב, מטפחת אדומה וכובע לבד רחב (1,456); והבוגל הסקוטי עם ראש שק, מגבעת באולר, ז׳קט טוויד וצעיף ארוך שעף ברוח, יד מורמת עם רעשן להברחת ציפורים (1,755). ' +
        'כאן הם מסובבים חצי סיבוב, עם הפנים לשביל, כמו ששחקן מציב אותם. המשקל של כל אחד במשחק הוא המשולשים שלו; מרחוק המשחק מצייר אותם בעותק קל יותר.',
      adds: 'שלושה קישוטים חדשים בחנות הקישוטים של החווה, בכרטיס של מצב העריכה.',
      render: (s) => <ScarecrowView v="b" s={s} />,
    },
  ],
}
