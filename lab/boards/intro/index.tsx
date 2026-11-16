import type { Board } from '../../board'
import { STATES, type IntroState } from './data'
import { IntroE } from './IntroE'
import { Today } from './Today'

// The opening screen (src/ui/Intro.tsx, with SavesPanel.tsx and MusicPlayer.tsx): the first thing the game shows, over
// the scene, until Play or Continue. Its states are the save list's own (SlotSummary) with each farm's level and its
// away report, numbers the game makes (./data.ts). "Today" is a picture of the game's screen: Intro cannot be drawn
// without the game round it.

export const introBoard: Board<IntroState> = {
  id: 'intro',
  title: 'מסך הפתיחה',
  kind: 'ui',
  added: '2026-11-16T10:20',
  ask:
    'עיצובים למסך הפתיחה ולחוות השמורות (🙋): להיכנס לשחק בלחיצה אחת, ולשחקן שחוזר – לראות מה מחכה לו בחווה. · ' +
    'הערה על A: "כתבת שזה מסך פתיחה – זה לא נראה כמו מסך פתיחה; התיאורים לא ברורים; צריך שיהיה ברור מה זה, ואם זה מסך פתיחה – חסרים דברים."',
  status: 'live',
  chosen: 'e',
  round:
    'במשחק עכשיו: E נבנה לתוך המשחק, ו"היום" הוא תמונה שלו. ' +
    'מה נכנס: השם והבית מעל החווה האמיתית (מאחורה רצה החווה עצמה), כרטיס החווה לשחקן חוזר עם הרמה, המטבעות, כמה זמן לא היה ומה מחכה לו – מהדוח האמיתי של הזמן שעבר, הכפתור הגדול (Continue, או New farm בפעם הראשונה) ושישה אריחים: New farm, Load farm (החוות השמורות, D), Settings (רק מה שיש במשחק, בשלוש לשוניות), Music, How to play, Credits. ' +
    'איך זה מתחבר למסך הטעינה (B, שגם הוא נבחר): בפתיחה רואים את מסך הטעינה, וכשהמשחק מוכן – הרגע שלו (הבית מתגלגל, קונפטי) ואז מסך הפתיחה תופס את מקומו. הכפתור הגדול נהיה פס טעינה כשהמשחק נטען שוב (למשל אחרי מעבר לגרפיקה קלה). ' +
    'מה לא נכנס: השם לחווה ובחירת המקום שלה (✦) – בלי שם, New farm פותח חווה חדשה במקום הריק הראשון (וכשאין מקום ריק – מפנה ל־Load farm, שם מתחילים חווה מחדש בלחיצה ארוכה), ובפעם הראשונה הכפתור הגדול מתחיל ישר. How to play במחשב מראה את המקשים במקום המגע',
  still: 'yard',
  screen: 'intro',
  devices: ['upright', 'sideways', 'small'],
  research: [
    {
      pattern: 'מסך הכותרת הוא העולם עצמו, חי: הלוגו מעל החווה, וכפתורי התפריט הגדולים (New, Load, ועוד) על לוח אחד מעליו – כל אחד מילה ותמונה. מכאן הכרטיס עם הכפתור הגדול והאריחים.',
      from: 'Stardew Valley – מסך הכותרת (New, Load, Co-op, Exit)',
      url: 'https://www.stardewvalley.net/',
    },
    {
      pattern: 'כפתור Play אחד ענק, וכל השאר קטן ממנו; העולמות ברשימה משלהם. מכאן הכפתור הגדול: Continue לשחקן חוזר, New farm בפעם הראשונה.',
      from: 'Minecraft – מסך הפתיחה ורשימת העולמות',
      url: 'https://www.minecraft.net/',
    },
    {
      pattern: 'ההגדרות הן דף אחד של מתגים ומחוונים עם שם קצר לכל אחד, מחולק לקבוצות – בלי מונחים של מפתחים. מכאן שלוש הלשוניות: תמונה, צליל, שליטה.',
      from: 'Hay Day ומשחקי Supercell – Settings',
      url: 'https://supercell.com/en/games/hayday/',
    },
    {
      pattern: 'שמירה וטעינה במקום אחד, וטעינת חווה היא אותו מסך שבו מנהלים את החוות. מכאן Load farm שהוא בדיוק לוח החוות השמורות.',
      from: 'Story of Seasons – היומן (Journal)',
      url: 'https://fogu.com/sos3/basics/menus.html',
    },
    {
      pattern: 'מי שחוזר רואה מה מחכה לו עוד לפני שנכנס – בתמונות עם כמויות – והכניסה היא לחיצה אחת.',
      from: 'Hay Day – הכניסה לחווה',
      url: 'https://supercell.com/en/games/hayday/',
    },
  ],
  states: STATES,
  variants: [
    {
      id: 'today',
      name: 'היום',
      note: 'תמונה של מסך הפתיחה במשחק עכשיו, אחרי ש־E נכנס (המסך עצמו לא יכול לרוץ בלי המשחק סביבו).',
      motion: 'כמו ב־E: האותיות נופלות, הכרטיס עולה והאריחים קופצים; אריח – הדף נכנס מימין; Continue – השם עף למעלה והכרטיס יורד אל המשחק.',
      render: (s) => <Today s={s} />,
    },
    {
      id: 'e',
      name: 'תפריט הפתיחה (נבחר, במשחק)',
      note:
        'מסך הפתיחה של המשחק כתפריט אמיתי, במראה של היום: השם והבית מעל החווה, ובכרטיס הנייר – הכפתור הגדול (טעינה ← Continue, או New farm בפעם הראשונה) ושישה אריחים: ' +
        'New farm, Load farm, Settings, Music, How to play, Credits. כל אריח פותח דף בתוך הכרטיס, עם Back. לשחקן חוזר – כרטיס החווה שלו עם מה שמחכה. לרוחב: השם והחווה משמאל, הכרטיס מימין בכל הגובה.',
      motion:
        'האותיות של השם נופלות וקופצות והשמש מאחור נפתחת; הכרטיס עולה והאריחים קופצים אחד אחרי השני. בזמן הטעינה הכפתור מתמלא בפסים ואז הופך ל־Continue בקפיצה. ' +
        'אריח: התפריט מחליק שמאלה, הדף נכנס מימין והכרטיס גדל לגובה שלו; Back – הפוך. Continue: השם עף למעלה, הכרטיס יורד, והמסך נסוג אל המשחק.',
      adds: 'שם לכל חווה (נבחר בדף New farm בקובייה או בהקלדה), ובחירת המקום שלה; כל השאר – ההגדרות, המוזיקה, החוות – הם מה שיש במשחק היום, מסודר מחדש.',
      render: (s, act) => <IntroE s={s} act={act} />,
    },
  ],
}
