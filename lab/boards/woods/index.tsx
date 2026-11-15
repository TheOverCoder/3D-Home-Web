import type { Board } from '../../board'
import { WoodsView } from './WoodsView'

// The big trees (3D, the 3D designer's): the woods round the farm and the three trees in the garden's corners, all made
// by src/scene/flora.ts `tree` and drawn by src/farm/Land.tsx and src/farm/Places.tsx. "Today" is that maker with the
// game's materials; A, B and C are proposals made with the kit in ./models/trees.ts. Its states: in the game (the
// farm from the garden at the player's eye, in the haze) and close (turning under a finger).

export interface WoodsState {
  view: 'game' | 'close'
}

export const woodsBoard: Board<WoodsState> = {
  id: 'woods',
  title: 'העצים הגדולים',
  kind: '3d',
  added: '2026-11-15T07:50',
  ask: 'צריך עוד סוכן לעיצוב תלת־ממד: שיפורים שמביאים אלמנטים בתלת־ממד שמתאימים למשחק, או שיפורי תלת־ממד לאישור. תעשה את הסוכן ותן לו לבנות גם הצעות.',
  status: 'choose',
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
      id: 'a',
      name: 'אותו עץ, צבע חדש',
      note: 'אותן צורות בדיוק, רק הצבע והאור: למעלה ירוק בהיר כמו בשמש, למטה ובפנים ירוק עמוק, והצמרת מוארת כמו גוש אחד, בלי תמונת הדשא. אף משולש לא נוסף: 23,956, כמו היום.',
      render: (s) => <WoodsView v="a" s={s} />,
    },
    {
      id: 'b',
      name: 'עץ עגול ומלא',
      note: 'עץ חדש מהערכה: צמרת מלאה ונמוכה יותר מכמה גושים גדולים (הגדול באמצע), תחתית שטוחה יותר, גזע עבה שמתרחב לאדמה ומתפצל לשלושה ענפים. צבע כמו ב־A. 1,127 משולשים לעץ (היום 1,208–1,568): 19,159 לכל ה־17 במקום 23,956.',
      render: (s) => <WoodsView v="b" s={s} />,
    },
    {
      id: 'c',
      name: 'יער מעורב',
      note: 'ביער, לסירוגין: העץ העגול של B, צפצפה גבוהה וצרה, ואורן בקומות — קו אופק עם צורות עגולות, גבוהות ומחודדות. שלושת העצים בגינה נשארים עגולים. עגול 1,127, צפצפה 404, אורן 480 משולשים: 12,956 לכל ה־17 במקום 23,956.',
      render: (s) => <WoodsView v="c" s={s} />,
    },
  ],
}
