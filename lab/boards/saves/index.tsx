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
  added: '2026-11-15T08:29',
  ask: 'ביקשת לעצב את זה (🙋). מהמפה: ארבעה כפתורים לכל חווה באותו משקל ו־Clear ממש ליד Play; מחיקה בלי כרטיס; שורת פרטים ארוכה במילים; הרשימה יורדת מתחת למסך.',
  status: 'chosen',
  chosen: 'c',
  round:
    'סיבוב 2: בחרת ב־C (✗ A, ✗ B – הם ירדו מהלוח). C לוטש לרפרנס הסופי: על הכרטיס של החווה שמשחקים בה כתוב "Playing now" (לא רק נקודה ירוקה בלשונית); ' +
    'מקום ריק אומר את זה בתמונה ובשבב ("An empty place" ו־20 מטבעות להתחלה) במקום משפט; Play עכשיו נכנס לחווה – הבית קופץ והגיליון יורד; ' +
    'לרוחב "Hold to start afresh" בשורה אחת. חדש: D – C עם תמונה של החווה כמו שנשמרה ועם השם שלה (✦ תכונה חדשה).',
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
      note: 'תמונה של החוות השמורות במשחק היום: ארבעה כפתורים באותו משקל לכל חווה, Clear ליד Play, ושורה ארוכה של מילים.',
      motion: 'בלי תנועה. Clear לוחצים פעמיים על אותו כפתור קטן.',
      render: () => <Today />,
    },
    {
      id: 'c',
      name: 'חווה אחת במלואה (נבחר)',
      note:
        'שלוש לשוניות למעלה (Farm 1 · 2 · 3, כל אחת עם כוכב הרמה שלה, ונקודה ירוקה על זו שמשחקים בה), ומתחת – החווה שנבחרה ככרטיס של תמונות עם מספרים: רמה, מטבעות, ערוגות שגדלות, בעלי חיים, ' +
        '"Playing now" על החווה הנוכחית. אז Play גדול, ושקט יותר – הקובץ והלחיצה הארוכה להתחלה מחדש. מקום ריק: נבט, "An empty place" וכמה מטבעות מתחילים. לרוחב: הכרטיס משמאל, הכפתורים מימין.',
      motion: 'בלשונית – הסימון מחליק אליה והכרטיס מסתובב אל החווה ההיא. Play – הבית קופץ והגיליון יורד אל החווה. לחיצה ארוכה – מילוי אדום שרץ (עזבת מוקדם: הוא חוזר), ובסוף הכרטיס מסתובב למקום ריק.',
      render: (s, act) => <SavesC s={s} act={act} />,
    },
    {
      id: 'd',
      name: 'C + תמונה ושם לכל חווה',
      note: 'כמו C, אבל בכרטיס של כל חווה – תמונה של החווה עצמה כמו שהייתה כשנשמרה (במקום ציור הבית), עם השם שלה עליה (השם שנותנים במסך הפתיחה, D שם). כך מזהים חווה במבט.',
      motion: 'בלשונית – התמונה מסתובבת אל החווה ההיא, מוטה קצת כמו תמונה מודבקת. השאר כמו C.',
      adds: 'תמונה של כל חווה, שהמשחק מצלם בעצמו כששומר, ושם לכל חווה – בכרטיס של החוות השמורות.',
      render: (s, act) => <SavesC s={s} act={act} extras />,
    },
  ],
}
