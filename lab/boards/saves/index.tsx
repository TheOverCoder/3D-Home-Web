import type { Board } from '../../board'
import { STATES, type SavesState } from './parts'
import { SavesC } from './SavesC'
import { Today } from './Today'

// The saved farms (src/ui/SavesPanel.tsx; opened from the opening screen's Farms): three places on this device, each a
// farm or empty. Its states are the save list's own summaries (lab/boards/intro/data.ts, as the opening screen's
// board); a press plays a farm, a full hold starts one afresh.

export const savesBoard: Board<SavesState> = {
  id: 'saves',
  title: 'חוות שמורות',
  kind: 'ui',
  added: '2026-11-16T10:20',
  done: { round: '2026-11-16T10:20', what: 'נבנה במשחק: מסך החוות D' },
  ask: 'ביקשת לעצב את זה (🙋). מהמפה: ארבעה כפתורים לכל חווה באותו משקל ו־Clear ממש ליד Play; מחיקה בלי כרטיס; שורת פרטים ארוכה במילים; הרשימה יורדת מתחת למסך.',
  status: 'live',
  chosen: 'd',
  round:
    'במשחק עכשיו: D נבנה לתוך המשחק (הדף Load farm במסך הפתיחה), ו"היום" הוא תמונה שלו. ' +
    'מה נכנס: שלוש הלשוניות עם כוכב הרמה של כל חווה ונקודה ירוקה על זו שמשחקים בה, הכרטיס שמסתובב אל החווה שבחרת עם הרמה, המטבעות, הערוגות ובעלי החיים, Play גדול, הקובץ (שמירה וטעינה), והלחיצה הארוכה להתחלה מחדש. ' +
    'מה לא נכנס: התמונה של כל חווה והשם שלה (✦) – המשחק צריך קודם לצלם את החווה כששומר ולשמור לה שם; עד אז הכרטיס מראה את הבית ו־"Farm 1"',
  still: 'yard',
  screen: 'saves',
  research: [
    {
      pattern: 'כל שמירה כרטיס עם תמונה, שם, יום וכסף; נגיעה בכרטיס נכנסת; מחיקה היא כפתור קטן בצד ששואל קודם. מכאן A: כרטיס לכל חווה, והשאר ב־⋯.',
      from: 'Stardew Valley – Load',
      url: 'https://www.stardewvalley.net/',
    },
    {
      pattern: 'מחיקה הרסנית בלחיצה ארוכה (מילוי שרץ בזמן שמחזיקים) – טעות של אצבע לא מוחקת חווה. מכאן כפתור "Hold to start afresh" בכל ההצעות.',
      from: 'Destiny 2 / Overwatch – hold to confirm; Apple HIG – destructive actions',
      url: 'https://developer.apple.com/design/human-interface-guidelines/buttons',
    },
    {
      pattern: 'עולמות כגלויות בשורה שמחליקים בה, והעולם שלפנים גדל ומקבל את הכפתור הגדול. מכאן B.',
      from: 'Minecraft (מובייל) – Worlds; Animal Crossing – Dream Address',
      url: 'https://www.minecraft.net/',
    },
    {
      pattern: 'לשוניות למעלה ופרטים מלאים של מה שנבחר – רמה, כסף, בעלי חיים – בתמונות עם מספרים, לא במשפט. מכאן C.',
      from: 'Hollow Knight – בחירת שמירה',
      url: 'https://www.hollowknight.com/',
    },
  ],
  states: STATES,
  variants: [
    {
      id: 'today',
      name: 'היום',
      note: 'תמונה של החוות השמורות במשחק עכשיו, אחרי ש־D נכנס (בלי התמונה והשם של כל חווה).',
      motion: 'כמו ב־D: הסימון מחליק ללשונית והכרטיס מסתובב; Play – הבית קופץ ונכנסים לחווה; לחיצה ארוכה – מילוי אדום שרץ.',
      render: () => <Today />,
    },
    {
      id: 'd',
      name: 'חווה אחת במלואה, עם תמונה ושם (נבחר, במשחק בלי התמונה והשם)',
      note:
        'שלוש לשוניות למעלה (כל חווה בשם שלה וכוכב הרמה שלה, ונקודה ירוקה על זו שמשחקים בה), ומתחת – החווה שנבחרה: תמונה שלה כמו שנשמרה עם השם עליה, ' +
        'ומספרים בתמונות – רמה, מטבעות, ערוגות שגדלות, בעלי חיים, "Playing now" על החווה הנוכחית. אז Play גדול, ושקט יותר – הקובץ והלחיצה הארוכה להתחלה מחדש. ' +
        'מקום ריק: נבט, "An empty place" וכמה מטבעות מתחילים. לרוחב: הכרטיס משמאל, הכפתורים מימין.',
      motion: 'בלשונית – הסימון מחליק אליה והכרטיס מסתובב אל החווה ההיא. Play – הגיליון יורד אל החווה. ' + 'לחיצה ארוכה – מילוי אדום שרץ (עזבת מוקדם: הוא חוזר), ובסוף הכרטיס מסתובב למקום ריק.',
      adds: 'תמונה של כל חווה, שהמשחק מצלם בעצמו כששומר, ושם לכל חווה – בכרטיס של החוות השמורות.',
      render: (s, act) => <SavesC s={s} act={act} extras />,
    },
  ],
}
