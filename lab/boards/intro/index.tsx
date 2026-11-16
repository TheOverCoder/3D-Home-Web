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
  added: '2026-11-16T05:10',
  ask:
    'עיצובים למסך הפתיחה ולחוות השמורות (🙋): להיכנס לשחק בלחיצה אחת, ולשחקן שחוזר – לראות מה מחכה לו בחווה. · ' +
    'הערה על A: "כתבת שזה מסך פתיחה – זה לא נראה כמו מסך פתיחה; התיאורים לא ברורים; צריך שיהיה ברור מה זה, ואם זה מסך פתיחה – חסרים דברים."',
  status: 'choose',
  round:
    'סיבוב 5, לפי ההערה על D ("צריך שיהיה דף New farm, Load farm, Settings, Music ועוד, בעיצוב כמו שיש עכשיו רק משופר, עם הגדרות שאפשר ליישם במשחק; לעדכן את הרפרנס משמעותית לאחד יציב וברור"). ' +
    'A ו־D ירדו; נשאר רפרנס אחד, E, בנוי מחדש כתפריט אמיתי של משחק, באותו מראה של היום (השם והבית מעל החווה, כרטיס נייר, אריחים עם תמונה ומילה): ' +
    'בכרטיס – הכפתור הגדול (בזמן הטעינה הוא פס הטעינה עצמו, ואז Continue לחווה שלך, או New farm בפעם הראשונה), ומתחתיו שישה אריחים: New farm, Load farm, Settings, Music, How to play, Credits. ' +
    'לשחקן חוזר – כרטיס של החווה שלו מעל: השם, הרמה, המטבעות, כמה זמן לא היה, ומה מחכה לו בתמונות. ' +
    'כל אריח פותח דף בתוך אותו כרטיס (התפריט מחליק שמאלה והדף נכנס מימין; Back מחזיר): ' +
    'New farm – שם לחווה (קובייה מגרילה, אפשר להקליד), באיזה מקום מתוך השלושה, ומה מקבלים בהתחלה; Start – ומקום תפוס מבקש לחיצה ארוכה, אף פעם לא נגיעה. ' +
    'Load farm – החוות השמורות, בדיוק העיצוב שבחרת בלוח שלהן (D), כך ששני המקומות זהים. ' +
    'Settings – רק הגדרות שיש במשחק באמת, בשלוש לשוניות: תמונה (איכות Auto/High/Medium/Low, גרפיקה קלה, אווירה, עומק שדה, גרעין סרט, פסי קולנוע), צליל (צליל, עוצמה, מוזיקה, עוצמת מוזיקה, רטט), שליטה (גוף ראשון או שלישי, שדה ראייה, מהירות מבט, היפוך, נדנוד בהליכה, מבט לאן שהולכים), ומה נשמר במכשיר + איפוס. ' +
    'Music – ארבעת השירים שהמשחק מלחין תוך כדי, נגן/עצור, הקודם והבא, ועוצמה; האריח רוקד כשהמוזיקה מנגנת. How to play – השליטה במגע, במילים של המשחק. Credits – מי עשה מה. ' +
    'מצבים חדשים: כל דף פתוח (New farm, Load farm, Settings, Music).',
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
      note: 'תמונה של המסך במשחק היום (המסך עצמו לא יכול לרוץ בלי המשחק סביבו). לרוחב Play מתחת לפס הבית, ושחקן חוזר רואה "0 sold · 0 growing".',
      motion: 'הבית קופץ והכרטיס עולה. לשונית נפתחת ודוחפת את הכל למעלה.',
      render: (s) => <Today s={s} />,
    },
    {
      id: 'e',
      name: 'תפריט הפתיחה',
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
