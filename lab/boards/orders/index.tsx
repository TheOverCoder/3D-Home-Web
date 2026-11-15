import { art } from '../../../src/ui/art'
import type { Board } from '../../board'
import { BIG, FILLING, FRESH, type OrdersState } from './data'
import { OrdersA } from './OrdersA'
import { OrdersB } from './OrdersB'
import { OrdersC } from './OrdersC'
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
  added: '2026-11-15T01:38',
  ask: 'ביקשת לעצב את זה (🙋). מהמפה: שלושה כפתורי Put in צהובים; כל מוצר מראה שני מספרים; השדרוגים מתחת לגלילה; לרוחב רואים הזמנה וחצי.',
  status: 'choose',
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
      id: 'a',
      name: 'תעודות משלוח',
      note:
        'כל הזמנה – תעודה: המוצרים, ולכל אחד מספר אחד – כמה עוד חסר (✓ כשהוא שלם); פס אחד לכל ההזמנה והארגזים שלה בסופו; כמה היא משלמת. ' +
        'פעולה ראשית אחת: Send ירוק וגדול כשהכל בפנים, ועד אז Put in שקט עם כמה אפשר להכניס עכשיו. × קטן בפינה לסרב. השדרוגים בלשונית משלהם, Office.',
      motion:
        'התעודות נכנסות אחת אחרי השנייה. Put in: המספרים יורדים, הפס מתמלא, ו־✓ קופץ על כל מוצר שהושלם; כשהכל בפנים התעודה מאירה ו־Send קופץ במקום Put in. ' +
        'Send: המטבעות עפים לצ׳יפ, קונפטי, והתעודה יוצאת ימינה כשההזמנה הבאה נכנסת משמאל. הלשונית הפעילה מחליקה ביניהן.',
      render: withCoin(OrdersA),
    },
    {
      id: 'b',
      name: 'ארגזים לאריזה',
      note:
        'כל הזמנה היא ארגז עץ עם מקום לכל פריט: מקום ריק מראה את הפריט חיוור, מלא – צבעוני. כמה חסר רואים, לא קוראים. כשהכל בפנים המכסה נסגר ו־Send הוא הכפתור. ' +
        'לרוחב הארגזים בשורה שאפשר להחליק. השדרוגים יוצאים מהרשימה (לכרטיס של המשרד).',
      motion:
        'Put in: המקומות מתמלאים אחד אחרי השני עם קפיצה קטנה לכל אחד. כשהכל בפנים המכסה מחליק למטה בחבטה ו"Ready" ירוק מוטבע עליו. ' +
        'Send: המטבעות עפים לצ׳יפ, הארגז מחליק החוצה ימינה, וארגז ריק של ההזמנה הבאה נכנס.',
      render: withCoin(OrdersB),
    },
    {
      id: 'c',
      name: 'הזמנה אחת בכל פעם',
      note:
        'ערימת הזמנות, והעליונה גדולה: כל מוצר גדול בתוך טבעת שמתמלאת כשהוא נכנס, כמה היא משלמת, וכפתור רחב אחד. החלקה – או הנקודות למטה – עוברת להזמנה הבאה; ' +
        'נקודה ירוקה = הזמנה מוכנה, נקודה ריקה = מקום שמחכה להזמנה חדשה. לרוחב הכרטיס רחב והמוצרים בשורה.',
      motion:
        'הכרטיס נכנס מהצד עם סיבוב קטן, והכרטיסים מאחור מציצים. Put in: הטבעות מתמלאות אחת אחרי השנייה ו־✓ קופץ. Send: המטבעות עפים לצ׳יפ והכרטיס עף מראש הערימה. ' +
        'גרירה הצידה מעבירה הזמנה, והנקודה הפעילה נמתחת.',
      render: withCoin(OrdersC),
    },
  ],
}
