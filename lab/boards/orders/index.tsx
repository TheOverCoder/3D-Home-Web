import { art } from '../../../src/ui/art'
import type { Board } from '../../board'
import { BIG, FILLING, FRESH, LONG, type OrdersState } from './data'
import { Live } from './Live'
import '../level/board.css'

// The order board on the office's computer, as the game has it since round 4 (src/farm/orderBoard/OrdersBoard.tsx: E,
// chosen; src/farm/OrdersPanel.tsx feeds it the farm's). Its states are orders the game's pure code makes and prices
// (./data.tsx); Put in, Send, × and the office's Buy do what the game's do, and a sent order's coins fly to the coin
// chip.

/** The coin of the chip at the top of the still, where the game's coins land (as on the level's board). */
const ChipCoin = () => (
  <span className="farm-chip-item coins lab-chip-coin" aria-hidden="true">
    <img src={art('coin')} alt="" />
  </span>
)

export const ordersBoard: Board<OrdersState> = {
  id: 'orders',
  title: 'לוח ההזמנות',
  kind: 'ui',
  added: '2026-11-16T09:23',
  ask:
    'ביקשת לעצב את זה (🙋). מהמפה: שלושה כפתורי Put in צהובים; כל מוצר מראה שני מספרים; השדרוגים מתחת לגלילה; לרוחב רואים הזמנה וחצי. · ' +
    'סיבוב 2: "שילוב לרפרנס אחד ממה שאהבתי: העץ – כל ההזמנה עם חריטה על העץ בשם מה שנדרש; שיראו את הירק ומספר; שלוחצים על חפץ שחסר או יש – כתוב השם שלו; ועוד אנימציות משופרות ללוח העץ המשולב."',
  status: 'live',
  chosen: 'e',
  round:
    'סיבוב 4: E נכנס למשחק – מה שרואים כאן הוא הקוד של המשחק עצמו, עם נתונים לדוגמה. ' +
    'כמו שביקשת: בלי תגית הטרקטור למעלה (הארגזים נשארו על כל קרש). לשונית Office עובדת במשחק: לחיצה על מחיר פותחת את כרטיס האישור מעל הלוח, Buy מוריד את המטבעות, המספר מתהפך, ובמקום חדש חוזרים ללוח והזמנה חדשה נוחתת. ' +
    'שיפורים שהיו חייבים: (1) הזמנה יכולה לבקש עד 9 מוצרים – לרוחב המוצרים של קרש ארוך גוללים בתוך הקרש, ו־Put in / Send תמיד נראים (מצב חדש: "הזמנה ארוכה"); ' +
    '(2) בזמן שהמוצרים עפים הכפתורים נעולים, כך שלחיצה כפולה לא מכניסה פעמיים; (3) כרטיס האישור אומר "Needs N more" כשאין מספיק מטבעות; (4) Esc סוגר קודם בועה, אחר כך את הכרטיס, ורק אז את הלוח; (5) בטאבלט ובמחשב הלוח באמצע, שני קרשים בשורה. ' +
    '"Show me" (ללכת למקום שממנו מגיע מוצר) עוד לא במשחק: הבועה אומרת מאיפה הוא מגיע, והכפתור יופיע כשהמשחק ידע ללכת לשם.',
  still: 'yard',
  screen: 'orders',
  research: [
    {
      pattern: 'הזמנה היא כרטיס משלוח: מה היא רוצה בתמונות, מה היא משלמת, ופעולה ראשית אחת – לשלוח כשהכל מוכן.',
      from: 'Hay Day – לוח המשלוחים (משאית)',
      url: 'https://supercell.com/en/games/hayday/',
    },
    {
      pattern: 'מילוי שרואים: לכל פריט מקום משלו, ריק – חיוור, מלא – צבעוני. כמה חסר נראה במבט, בלי לקרוא מספרים. מכאן היתדות.',
      from: 'Township – הרכבת והנמל (ארגזים שמתמלאים)',
      url: 'https://www.playrix.com/township',
    },
    {
      pattern: 'להראות על הפס כמה הלחיצה הבאה תזיז אותו ("רוח" של הצעד הבא) – המטרה נהיית "עוד לחיצה אחת" ולא מספר. מכאן היתד המקווקו של מה שה־Put in הבא יכניס.',
      from: "Hodent, The Gamer's Brain; Lewis-Evans, GDC 2017 (progression bars)",
    },
    {
      pattern: 'מה שעובר ממקום למקום עף לשם (הפריט לארגז, המטבעות לצ׳יפ) – העין רואה מאיפה ולאן, ולא רק שמספר השתנה.',
      from: 'Juice it or lose it (Jonasson & Purho, GDC 2012); Royal Match – פרסים שעפים למקומם',
      url: 'https://www.youtube.com/watch?v=Fy0aCDmgnxg',
    },
    {
      pattern: 'שדרוג נקנה דרך כרטיס אחד: תמונה, מה משתנה (עכשיו ← אחרי) והמחיר, ביטול קודם והפעולה אחרונה.',
      from: 'Hay Day / Township – שדרוגי מבנים',
      url: 'https://www.playrix.com/township',
    },
  ],
  states: [
    { id: 'fresh', name: 'שלוש הזמנות חדשות, עוד לא הוכנס כלום', data: FRESH },
    { id: 'filling', name: 'אחת מוכנה לשליחה, אחת באמצע, ומקום שמחכה להזמנה חדשה', data: FILLING },
    { id: 'big', name: 'משרד גדול: חמש הזמנות, אחת ארוכה', data: BIG },
    { id: 'long', name: 'הזמנה ארוכה: שמונה מוצרים בקרש אחד', data: LONG },
  ],
  variants: [
    {
      id: 'today',
      name: 'במשחק (E)',
      note:
        'לוח העץ, כמו שהוא במשחק עכשיו: הזמנות כקרשים ממוסמרים, בראש כל קרש מה היא משלמת והארגזים שלה ו־× קטן; לכל מוצר שורה – התמונה עם כמה עוד חסר, השם חרוט, ויתד לכל אחד (מלא, מקווקו צהוב למה שה־Put in הבא יכניס, או ריק). ' +
        'בתחתית לחיצה אחת: Put in, ואז Send ירוק. נגיעה במוצר: השם, כמה בפנים, כמה במחסן ומאיפה הוא מגיע. השדרוגים בלשונית Office, עם כרטיס אישור. בלי תגית הטרקטור.',
      motion:
        'הגיליון עולה (לרוחב: נכנס מימין) והקרשים נופלים על המסמרים אחד אחרי השני. Put in: המוצרים עפים בקשת מהכפתור לשורות שלהם והיתדות נדלקות; כשהכל בפנים התגית READY מתנדנדת על המסמר ו־Send קופץ. ' +
        'Send: המטבעות עפים לצ׳יפ עם קונפטי, הקרש עף ימינה והזמנה חדשה נוחתת. ×: הקרש נופל. Office: הכרטיס קופץ, ובקנייה המספר מתהפך. החלקה של הכותרת למטה (לרוחב: ימינה) סוגרת.',
      render: (s, act) => (
        <>
          <ChipCoin />
          <Live s={s} act={act} />
        </>
      ),
    },
  ],
}
