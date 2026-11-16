import type { Board } from '../../board'
import { WoodsView } from './WoodsView'

// The big trees (3D, the 3D designer's): the woods round the farm and the three trees in the garden's corners, all made
// by src/scene/flora.ts `tree` and drawn by src/farm/Land.tsx and src/farm/Places.tsx. "Today" is that maker with the
// game's materials; D is the one reference the user asked for in round 2, made from B and C (both ✓) with the kit in
// ./models/woods.ts. Its states: in the game (the farm from the garden at the player's eye, in the haze) and close
// (its four kinds side by side, turning under a finger).

export interface WoodsState {
  view: 'game' | 'close'
}

export const woodsBoard: Board<WoodsState> = {
  id: 'woods',
  title: 'העצים הגדולים',
  kind: '3d',
  added: '2026-11-16T09:00',
  ask:
    'צריך עוד סוכן לעיצוב תלת־ממד: שיפורים שמביאים אלמנטים בתלת־ממד שמתאימים למשחק, או שיפורי תלת־ממד לאישור. תעשה את הסוכן ותן לו לבנות גם הצעות. · ' +
    'סיבוב 2 (✓ B, ✓ C): "צריך בפחות משולשים לייצר כמה סוגים ברמה גבוהה. תעשה רפרנס אחד שהוא באמת הכי טוב שאתה יכול מ־B ו־C שאהבתי."',
  status: 'choose',
  round:
    'סיבוב 2, לפי מה שענית (✓ B, ✓ C, "פחות משולשים, כמה סוגים ברמה גבוהה, רפרנס אחד"): B ו־C הם עכשיו רפרנס אחד, D. ' +
    'מ־B: העץ העגול – גושים גדולים, בהיר למעלה וכהה למטה, מוצלל כגוש אחד. מ־C: יער מעורב – עגול, גבוה ומחודד לסירוגין. ' +
    'ארבעה סוגים: אלון עגול (גם שלושת העצים בגינה), ליבנה עם גזע לבן, צפצפה גבוהה כמו להבה, ואורן בקומות עם קצוות ענפים מרופטים. ' +
    'פחות משולשים: הצמרת היא עכשיו עור אחד מעל כל הגושים – אין גוש שמסתתר בתוך גוש אחר, אז כל משולש נראה. ' +
    '9,197 משולשים לכל 17 העצים: B היה 19,159, C היה 12,956, היום 23,956.',
  still: 'none',
  research: [
    {
      pattern: 'צבע מלמעלה למטה: החלק העליון של הצמרת בהיר (שם השמש), התחתון והפנימי כהה. ככה גם עץ רחוק בערפל נראה עגול ולא כתם שטוח.',
      from: 'פירוק של עץ מסוגנן ב־Unreal: מעטפת בשכבות וגרדיאנט מלמטה למעלה',
      url: 'https://threadreaderapp.com/thread/1582911895149113345.html',
    },
    {
      pattern: 'הנורמלים של העלים מכוונים כמו של כדור אחד: הצמרת מוצללת כגוש אחד רך, בלי "רעש" של הרבה כדורים קטנים — זה מה שנשאר קריא מרחוק.',
      from: 'Roblox DevForum: עצים מסוגננים, נורמלים כדוריים',
      url: 'https://devforum.roblox.com/t/trying-to-make-stylized-trees-correctly/1359589',
    },
    {
      pattern: 'צמרת מכמה גושים גדולים, הגדול באמצע, והשוליים שבורים בגושים קטנים יותר: צללית ברורה בלי חורים.',
      from: 'Games Artist: Lush tree',
      url: 'https://gamesartist.co.uk/lush-tree/',
    },
    {
      pattern: 'בחבילות עצים למובייל עץ מסוגנן טוב הוא כמה מאות עד כ־1,600 משולשים, וצללית ברורה ומוכרת היא מה שמוכר אותו. לכן כאן 369–809 לעץ, וכל סוג בצללית אחרת.',
      from: 'חבילות עצים מסוגננים למובייל (CGTrader)',
      url: 'https://www.cgtrader.com/3d-models/plant/leaf/low-poly-deciduous-tree-stylized-3d-model-4608058e-2f03-4a18-989e-23d65ec9c7de',
    },
  ],
  states: [
    { id: 'game', name: 'במשחק', data: { view: 'game' } },
    { id: 'close', name: 'מקרוב', data: { view: 'close' } },
  ],
  variants: [
    {
      id: 'today',
      name: 'היום',
      note: 'העצים של היום: גזע דק עם שני ענפים וצמרת של 6–8 כדורים עטופים בתמונת דשא, באחד משלושה גוונים. ביער, בערפל, הצמרת נראית כמו דיסק אפור־ירוק על מקל. 1,208–1,568 משולשים לעץ: 23,956 לכל 17 העצים (14 ביער ו־3 בגינה).',
      render: (s) => <WoodsView v="today" s={s} />,
    },
    {
      id: 'd',
      name: 'יער מעורב, רפרנס אחד',
      note:
        'הטוב מ־B ומ־C: ארבעה סוגי עצים לסירוגין ביער – אלון עגול (589 משולשים), ליבנה עם גזע לבן (409), צפצפה גבוהה (369) ואורן בקומות (497) – ושלושת העצים בגינה אלונים, קצת יותר עדינים כי רואים אותם מקרוב (809). ' +
        'כל צמרת היא עור אחד מעל הגושים, בלי משולשים מוסתרים, בהירה למעלה, כהה בקפלים ובתחתית, ומוצללת כגוש אחד. ' +
        '9,197 משולשים לכל 17 העצים: 38% מהיום (23,956), 48% מ־B (19,159), 71% מ־C (12,956).',
      render: (s) => <WoodsView v="d" s={s} />,
    },
  ],
}
