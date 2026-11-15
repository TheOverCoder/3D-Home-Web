import { art } from '../../../src/ui/art'
import type { Board } from '../../board'
import { BIG, FILLING, FRESH, type OrdersState } from './data'
import { OrdersD } from './OrdersD'
import { Today } from './Today'
import '../level/board.css'

// The order board on the office's computer (src/farm/OrdersPanel.tsx, src/farm/orders.ts). Its states are orders the
// game's pure code makes and prices (./data.tsx); Put in, Send and × do what the game's do, and a sent order's coins
// fly to the coin chip.

/** The coin of the chip at the top of the still, where the game's coins land (as on the level's board). */
const ChipCoin = () => (
  <span className="farm-chip-item coins lab-chip-coin" aria-hidden="true">
    <img src={art('coin')} alt="" />
  </span>
)

const withCoin = (Look: (p: { s: OrdersState; act: Parameters<Board<OrdersState>['variants'][number]['render']>[1] }) => React.ReactElement) =>
  function Render(s: OrdersState, act: Parameters<Board<OrdersState>['variants'][number]['render']>[1]) {
    return (
      <>
        <ChipCoin />
        <Look s={s} act={act} />
      </>
    )
  }

export const ordersBoard: Board<OrdersState> = {
  id: 'orders',
  title: 'לוח ההזמנות',
  kind: 'ui',
  added: '2026-11-15T08:29',
  ask:
    'ביקשת לעצב את זה (🙋). מהמפה: שלושה כפתורי Put in צהובים; כל מוצר מראה שני מספרים; השדרוגים מתחת לגלילה; לרוחב רואים הזמנה וחצי. · ' +
    'סיבוב 2: "שילוב לרפרנס אחד ממה שאהבתי: העץ – כל ההזמנה עם חריטה על העץ בשם מה שנדרש; שיראו את הירק ומספר; שלוחצים על חפץ שחסר או יש – כתוב השם שלו; ועוד אנימציות משופרות ללוח העץ המשולב."',
  status: 'choose',
  round:
    'סיבוב 2, לפי מה שענית (✓ A, ✓ B, "לשלב לרפרנס אחד"): A ו־B הם עכשיו לוח עץ אחד, D. כל הזמנה היא קרש ממוסמר ללוח, וכל ההזמנה חרוטה בעץ: ' +
    'לכל מוצר שורה – התמונה שלו עם המספר של כמה עוד חסר (✓ כשהכל בפנים), השם שלו חרוט בעץ, ויתד לכל אחד שצריך שמתמלאת כשהוא נכנס (מ־B: רואים כמה חסר בלי לקרוא). ' +
    'נגיעה במוצר – חסר או שכבר בפנים – פותחת בועה עם השם שלו, כמה בפנים וכמה יש במחסן. ' +
    'אנימציות: הקרשים נופלים על המסמרים אחד אחרי השני; Put in – היתדות מתמלאות אחת אחת בקפיצה והמספר יורד; כשהכל בפנים נצרבת על הקרש חותמת READY ו־Send קופץ; ' +
    'Send – המטבעות עפים, הקרש מתנדנד מהמסמרים ונופל הצידה, והזמנה חדשה נוחתת במקומו. C (לא סומנה) ירדה. חדש: E – בבועה גם מאיפה המוצר מגיע ו"Show me" (✦ תכונה חדשה).',
  still: 'yard',
  screen: 'orders',
  research: [
    {
      pattern: 'הזמנה היא כרטיס משלוח: מה היא רוצה בתמונות, מה היא משלמת, ופעולה ראשית אחת – לשלוח כשהכל מוכן. מכאן A: תעודת משלוח עם Send גדול ו־Put in שקט.',
      from: 'Hay Day – לוח המשלוחים (משאית)',
      url: 'https://supercell.com/en/games/hayday/',
    },
    {
      pattern: 'מילוי שרואים: לכל פריט מקום משלו, ריק – חיוור, מלא – צבעוני. כמה חסר נראה במבט, בלי לקרוא מספרים. מכאן B: ארגז עם מקום לכל פריט.',
      from: 'Township – הרכבת והנמל (ארגזים שמתמלאים)',
      url: 'https://www.playrix.com/township',
    },
    {
      pattern: 'כרטיס אחד גדול בכל פעם, החלקה לבא, ונקודות שאומרות כמה יש ואיזה מוכן. מכאן C: ערימת הזמנות.',
      from: 'Stardew Valley – לוח המודעות; כרטיסי Tinder/Apple Wallet',
      url: 'https://www.stardewvalley.net/',
    },
    {
      pattern: 'מספר אחד לכל מוצר – כמה עוד חסר – ו־✓ כשהוא שלם, במקום "7" על התמונה ו־"0/7" מתחתיה. התקדמות שרואים גדלה מושכת להשלים.',
      from: "Hodent, The Gamer's Brain (עומס קוגניטיבי); Kivetz 2006 (goal gradient)",
    },
  ],
  states: [
    { id: 'fresh', name: 'שלוש הזמנות חדשות, עוד לא הוכנס כלום', data: FRESH },
    { id: 'filling', name: 'אחת מוכנה לשליחה, אחת באמצע, ומקום שמחכה להזמנה חדשה', data: FILLING },
    { id: 'big', name: 'משרד גדול: חמש הזמנות, אחת ארוכה', data: BIG },
  ],
  variants: [
    {
      id: 'today',
      name: 'היום',
      note: 'תמונה של לוח ההזמנות במשחק היום: שלושה כפתורי Put in צהובים, שני מספרים על כל מוצר, והשדרוגים בתחתית מתחת לגלילה.',
      motion: 'החלון מחליק פנימה. Put in ו־Send מחליפים את הכרטיס בלי תנועה.',
      render: () => <Today />,
    },
    {
      id: 'd',
      name: 'לוח העץ (A + B)',
      note:
        'הזמנות כקרשים ממוסמרים ללוח עץ. על כל קרש חרוט מה ההזמנה משלמת והארגזים שלה, ומתחת כל מוצר בשורה משלו: התמונה עם המספר של כמה עוד חסר, השם חרוט, ויתדות שמתמלאות. ' +
        'נגיעה במוצר אומרת את השם שלו בבועה. כפתור אחד: Put in שקט עד שהכל בפנים, ואז Send ירוק. × קטן על המסמר לסרב. השדרוגים בלשונית Office. לרוחב הקרשים בשורה שמחליקים בה.',
      motion:
        'הקרשים נופלים על המסמרים אחד אחרי השני בקפיצה. Put in: היתדות נדלקות אחת אחת, המספרים יורדים, ✓ קופץ על מוצר שהושלם; כשהכל בפנים READY נצרב על הקרש (גדול ← נמעך ← נח), הקרש זוהר ירוק ו־Send קופץ. ' +
        'Send: המטבעות עפים לצ׳יפ וקונפטי, הקרש מסתובב מהמסמרים ונופל ימינה, והזמנה חדשה נוחתת. נגיעה במוצר: הוא מתנדנד והבועה קופצת מעליו.',
      render: withCoin(OrdersD),
    },
    {
      id: 'e',
      name: 'D + מאיפה זה מגיע',
      note: 'אותו לוח, ובבועה של מוצר גם מאיפה הוא מגיע – ערוגה, התרנגולות, הפרות, הטחנה (ומאיזה מוצר) – וכפתור "Show me" שמסמן את המקום במצפן, כדי ללכת אליו.',
      motion: 'נגיעה במוצר: הבועה קופצת עם המקום והתמונה שלו. Show me: הבועה נסגרת ושורה קטנה יורדת מלמעלה: "Hens · on your compass".',
      adds: 'בבועה של מוצר בהזמנה: מאיפה הוא מגיע (ערוגה, חיה, מכונה ומאיזה מוצר), וכפתור "Show me" שמסמן את המקום במצפן כדי ללכת אליו.',
      render: (s, act) => (
        <>
          <ChipCoin />
          <OrdersD s={s} act={act} find />
        </>
      ),
    },
  ],
}
