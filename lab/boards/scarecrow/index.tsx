import type { Board } from '../../board'
import { ScarecrowView } from './ScarecrowView'

// A scarecrow for the beds (3D, the 3D designer's): something new the farm lacks, in the place it would stand — at the
// far end of the west beds by the fence, facing the garden door, the first thing seen down the path on the way out of
// the house. "Today" is the place as it is, without it; A, B and C are made with the kit in ./models/scarecrow.ts. Its
// states: in the game (at the player's eye on the path) and close (turning under a finger).

export interface ScarecrowState {
  view: 'game' | 'close'
}

export const scarecrowBoard: Board<ScarecrowState> = {
  id: 'scarecrow',
  title: 'דחליל בערוגות',
  kind: '3d',
  added: '2026-11-15T07:50',
  ask: 'צריך עוד סוכן לעיצוב תלת־ממד: שיפורים שמביאים אלמנטים בתלת־ממד שמתאימים למשחק, או שיפורי תלת־ממד לאישור. תעשה את הסוכן ותן לו לבנות גם הצעות.',
  status: 'choose',
  still: 'none',
  research: [
    {
      pattern: 'דחליל קלאסי נקרא מרחוק בצללית שלו: צורת T של ידיים פרושות, כובע רחב, ראש שק עם פרצוף תפור.',
      from: 'דחליל כפרי קלאסי במודלים מסוגננים (CGTrader)',
      url: 'https://www.cgtrader.com/3d-models/exterior/landscape/classic-rural-farm-scarecrow-3d-model',
    },
    {
      pattern: 'דמות צריכה להיקרא קודם בצללית ואחר כך בצבע: כל הצעה כאן שונה בצללית (T, ראש עגול עם עורב, יד מורמת) ולא רק בצבעים.',
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
      name: 'היום',
      note: 'הערוגות היום, בלי דחליל: בסוף השביל רק הגדר והשדה שמעבר לה.',
      render: (s) => <ScarecrowView v="today" s={s} />,
    },
    {
      id: 'a',
      name: 'דחליל קלאסי',
      note: 'ראש שק עם חיוך תפור ועיני כפתור, כובע הקש של המשחק, חולצה אדומה וג׳ינס עם טלאים, קש יוצא מהשרוולים ומהמכנסיים, ידיים פרושות ב־T. מוסיף 2,332 משולשים ו־5 ציורים לנוף של הערוגות: כ־1% מהתקציב של המצלמה (250,000 משולשים, 700 ציורים), ועוד כ־2,300 בצל של השמש (מתוך 150,000).',
      render: (s) => <ScarecrowView v="a" s={s} />,
    },
    {
      id: 'b',
      name: 'ראש דלעת ועורב',
      note: 'דלעת מהחווה כראש עם פרצוף מצויר, צעיף מפוספס ירוק־לבן, סרבל כחול על חולצה צהובה, ידיים קצת למטה, ועורב שיושב על היד. מוסיף 3,024 משולשים ו־7 ציורים: כ־1.2% מהתקציב. העורב לא מטיל צל, כך שהצל של השמש לא מצויר מחדש כשהוא זז.',
      motion: 'העורב מסובב את הראש לצדדים, ומדי פעם מנקר בשרוול.',
      render: (s) => <ScarecrowView v="b" s={s} />,
    },
    {
      id: 'c',
      name: 'דחליל שמנופף',
      note: 'גבוה ורזה במעיל ירוק ארוך, ראש מוטה הצידה, כובע טמבל אדום, ויד אחת מורמת כמו נפנוף — עם סרטים בצבעי המשחק (אדום, שמנת, צהוב). מוסיף 2,266 משולשים ו־6 ציורים: כ־1% מהתקציב. הסרטים לא מטילים צל, כך שהצל של השמש לא מצויר מחדש כשהם זזים.',
      motion: 'הסרטים ביד המורמת מתנופפים ברוח.',
      render: (s) => <ScarecrowView v="c" s={s} />,
    },
  ],
}
