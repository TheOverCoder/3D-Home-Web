import type { Board } from '../../board'
import { STATES, type SavesState } from './parts'
import { SavesA } from './SavesA'
import { SavesB } from './SavesB'
import { SavesC } from './SavesC'
import { Today } from './Today'

// The saved farms (src/ui/SavesPanel.tsx; opened from the opening screen's Farms): three places on this device, each a
// farm or empty. Its states are the save list's own summaries (lab/boards/intro/data.ts, as the opening screen's
// board); a press plays a farm, a full hold starts one afresh.

export const savesBoard: Board<SavesState> = {
  id: 'saves',
  title: 'חוות שמורות',
  ask: 'ביקשת לעצב את זה (🙋). מהמפה: ארבעה כפתורים לכל חווה באותו משקל ו־Clear ממש ליד Play; מחיקה בלי כרטיס; שורת פרטים ארוכה במילים; הרשימה יורדת מתחת למסך.',
  status: 'choose',
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
      id: 'a',
      name: 'כרטיס לכל חווה',
      note: 'כל חווה כרטיס: הבית שלה, השם, כוכב הרמה, המטבעות ומתי שיחקו בה. נגיעה בכרטיס = לשחק בה (מקום ריק = חווה חדשה). כל השאר ב־⋯ שלו: לשמור לקובץ, לטעון מקובץ, ולהתחיל מחדש – בלחיצה ארוכה, לא בנגיעה.',
      motion:
        'נגיעה בכרטיס: הוא שוקע, והסרט "Playing" מחליק אליו מהכרטיס הקודם. ⋯ פותח מגירה מתחת לכרטיס. לחיצה ארוכה: מילוי אדום רץ לרוחב הכפתור; עזבת מוקדם – הוא חוזר. בסוף – הבית עף מהכרטיס ונבט צומח במקומו.',
      render: (s, act) => <SavesA s={s} act={act} />,
    },
    {
      id: 'b',
      name: 'גלויות',
      note: 'כל חווה גלויה גדולה בשורה שמחליקים בה (הבאה מציצה בקצה): הבית על תמונה שמשית, הרמה, המטבעות ומתי שיחקו. מתחת – לגלויה שלפנים – כפתור אחד גדול ("Play Farm 2" או "Start a new farm"), ושקטים יותר: קובץ, ולחיצה ארוכה להתחלה מחדש.',
      motion: 'בהחלקה הגלויה שלפנים גדלה ונדלקת והאחרות נסוגות, והנקודה למטה נמתחת. לחיצה ארוכה עד הסוף – הבית עף מהגלויה ונבט צץ.',
      render: (s, act) => <SavesB s={s} act={act} />,
    },
    {
      id: 'c',
      name: 'חווה אחת במלואה',
      note: 'שלוש לשוניות למעלה (Farm 1 · 2 · 3, כל אחת עם כוכב הרמה שלה), ומתחת – החווה שנבחרה ככרטיס של תמונות עם מספרים: רמה, מטבעות, ערוגות שגדלות, בעלי חיים. אז Play גדול, ושקט יותר – הקובץ והלחיצה הארוכה. לרוחב: הכרטיס משמאל, הכפתורים מימין.',
      motion: 'בלשונית – הסימון מחליק אליה והכרטיס מסתובב אל החווה ההיא. לחיצה ארוכה – מילוי אדום שרץ, ובסוף החווה מתרוקנת.',
      render: (s, act) => <SavesC s={s} act={act} />,
    },
  ],
}
