import { GoalsCard } from '../../../src/farm/GoalsCard'
import { goalsView } from '../../../src/farm/goalsView'
import { art } from '../../../src/ui/art'
import type { Board } from '../../board'
import { asFarm, claimed, CLOSE, LATER, READY, START, type GoalsState } from './data'
import '../level/board.css'

// The goals board (src/farm/GoalsCard.tsx, fed by goalsView from src/farm/goalsView.ts; GoalsPanel reads the farm): the
// trophy at the top opens it. In the game since the user chose F, the medal case, with gold medals only and the goods
// in their full colours. Its states are made by the game's own pure code from a farm's numbers (./data.ts); a claim
// moves a goal on to its next step as the game's claimGoal does, and its coins fly to the coin chip.

/** The coin of the chip at the top of the still, where the game's coins land (as on the level's board). */
const ChipCoin = () => (
  <span className="farm-chip-item coins lab-chip-coin" aria-hidden="true">
    <img src={art('coin')} alt="" />
  </span>
)

export const goalsBoard: Board<GoalsState> = {
  id: 'goals',
  title: 'מטרות',
  kind: 'ui',
  added: '2026-11-16T09:47',
  ask:
    'ביקשת לעצב את זה (🙋). מהמפה: שש שורות דומות, כולן ב־0, אף אחת לא "הבאה בתור"; הפרס קטן בצד; כשמטרה מושגת יש רק כפתור Claim ירוק – אין רגע. · ' +
    'סיבוב 2: "לשלב את B ו־A: שרואים 2 בשורה, פס התקדמות, עוד אנימציות – שילוב שלהם ושיפור." · ' +
    'F נבחר: "תכניס למשחק רק מדליות זהב וחפצים פחות דהוי שיהיה תואם לצבעי המשחק"',
  status: 'live',
  chosen: 'f',
  spot: 'goals',
  screen: 'goals',
  round:
    'F במשחק, כמו שביקשת: כל המדליות מזהב (בלי ארד, כסף, פלטינה ויהלום), והחפצים על המדליות בצבעים המלאים שלהם – בלי הדהייה של מדליה שעוד לא הושגה, והשכנות בצדדים לא שקופות; פני המדליה זהב בהיר, כך שהחפץ בולט. ' +
    'כל מדרגה של מטרה היא מדליית זהב: תחת המדליה הגדולה שורת המדרגות (שהושגו בזהב, הנוכחית בטבעת, הבאה ריקה), ובכותרת – כמה מדליות זכית. ' +
    'האיסוף הוא של החווה מיד בלחיצה: המדליה מסתובבת פעמיים, המטבעות עפים לצ׳יפ והחומר למחסן שלו, והטבעת מתמלאת מחדש ממה שכבר יש ("33% there already!"). המטרה שבידך נשארת במקומה גם כשהלוח מסתדר מחדש.',
  still: 'yard',
  research: [
    {
      pattern: 'המשימה הבאה גדולה למעלה עם הפרס שלה, והשאר ברשימה קצרה מתחת; נגיעה בשורה מביאה אותה למעלה.',
      from: 'Animal Crossing: New Horizons – Nook Miles',
      url: 'https://animal-crossing.com/new-horizons/',
    },
    {
      pattern: 'הישגים כאריחים: כל אחד תמונה בתוך טבעת שמתמלאת, וכשמושג – הוא "קופץ" מהדף ומחכה ללחיצה.',
      from: 'Pokémon GO – מדליות; Duolingo – הישגים',
      url: 'https://pokemongolive.com/',
    },
    {
      pattern: 'מאמץ גדל כשהמטרה קרובה, ומה שכבר נעשה נספר הלאה: אחרי איסוף המדרגה הבאה מתחילה מלאה בחלקה, וברבע האחרון כתוב "Only 3 more!".',
      from: 'Kivetz, Urminsky & Zheng 2006 (goal gradient); Nunes & Drèze 2006 (endowed progress)',
      url: 'https://business.columbia.edu/faculty/research/goal-gradient-hypothesis-resurrected-purchase-acceleration-illusionary-goal',
    },
    {
      pattern: 'מדליה שמסובבים באצבע, כמו מטבע ביד: היא אובייקט שרוצים לגעת בו, לא תמונה. מכאן ההטיה מתחת לאצבע והסיבוב באיסוף.',
      from: 'Apple Fitness – Awards (המדליות)',
      url: 'https://developer.apple.com/forums/thread/706570',
    },
    {
      pattern: 'הפרס בסוף הפס: מה שמקבלים עומד במקום שהפס מוביל אליו, כך שהעין הולכת מההתקדמות לפרס בלי לחפש.',
      from: 'lab/CRAFT.md – progress with the next reward in view; Hay Day / Township – פסי משימות',
    },
  ],
  states: [
    { id: 'start', name: 'תחילת המשחק: הכל בהתחלה', data: START },
    { id: 'close', name: 'כמה מטרות קרובות לסוף', data: CLOSE },
    { id: 'ready', name: 'שתי מטרות הושגו ומחכות לאיסוף', data: READY },
    { id: 'later', name: 'הרבה אחר כך: מספרים גדולים, מדרגות עמוקות', data: LATER },
  ],
  variants: [
    {
      id: 'today',
      name: 'במשחק (F)',
      note:
        'ארון המדליות, כולן זהב: המדליה שעובדים עליה גדולה באמצע – השפה שלה היא הטבעת שמתמלאת, והחפץ על פניה בצבעים המלאים; השכנות עומדות בצדדים, קטנות ומסובבות. ' +
        'מתחתיה: שורת המדרגות, מה לעשות, כמה נשאר, הפס ובסופו הפרס (מטבעות וחומר) – וכשהושגה, Claim במקום הפס. למטה הארון: שש המטרות כמדליות קטנות – נגיעה מביאה אחת למרכז.',
      motion:
        'הגיליון עולה; החלקה לצדדים מזיזה את המדף, והמדליה הגדולה נוטה מתחת לאצבע כמו מטבע ביד; נגיעה במדליה בצד מביאה אותה למרכז. מדליה שהושגה מבריקה (אור עובר עליה) ומדליה קטנה שהושגה קופצת בארון. ' +
        'Claim: המדליה מסתובבת פעמיים וחוזרת על המדרגה הבאה, המטבעות עפים לצ׳יפ והחומר למחסן, עם קונפטי, והטבעת מתמלאת מחדש ממה שכבר יש. פחות תנועה: בלי סיבוב, בלי הטיה ובלי מעוף.',
      render: (s, act) => (
        <>
          <ChipCoin />
          <GoalsCard v={goalsView(asFarm(s))} onClaim={(id) => act.set(claimed(s, id))} onClose={act.close} />
        </>
      ),
    },
  ],
}
