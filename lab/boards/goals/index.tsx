import { art } from '../../../src/ui/art'
import type { Board } from '../../board'
import { CLOSE, LATER, READY, START, type GoalsState } from './data'
import { GoalsE } from './GoalsE'
import { Today } from './Today'
import '../level/board.css'

// The goals board (src/farm/GoalsPanel.tsx, src/farm/goals.ts): the trophy at the top opens it. Its states are made by
// the game's own pure code from a farm's numbers (./data.tsx); a claim moves a goal on to its next step as the game's
// claimGoal does, and its coins fly to the coin chip.

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
  added: '2026-11-16T03:40',
  ask:
    'ביקשת לעצב את זה (🙋). מהמפה: שש שורות דומות, כולן ב־0, אף אחת לא "הבאה בתור"; הפרס קטן בצד; כשמטרה מושגת יש רק כפתור Claim ירוק – אין רגע. · ' +
    'סיבוב 2: "לשלב את B ו־A: שרואים 2 בשורה, פס התקדמות, עוד אנימציות – שילוב שלהם ושיפור."',
  status: 'chosen',
  chosen: 'e',
  round:
    'סיבוב 3: בחרת E (✓), ועל D כתבת "להכניס למשחק, רק לשפר את המעבר כשלוחצים להגדיל משימה – שירגיש טבעי יותר לעין ומתקדם יותר". ' +
    'D ו־E היו אותו לוח (E = D ועוד הנעיצה), אז נשאר רק E – הרפרנס היחיד, מוכן להיכנס למשחק. ' +
    'מה השתנה – רק המעבר: קודם רק התמונה עפה למעלה והכרטיס התהפך. עכשיו המדבקה עצמה גדלה והופכת לזרקור – הצורה שלה מתרחבת וזזה למקום ולגודל של הזרקור, ' +
    'התמונה עפה לפניה לטבעת הגדולה, והמילים נכנסות בעדינות כשהיא נעצרת; באותו רגע המטרה שהייתה בזרקור מתכווצת חזרה למקום של המדבקה, ' +
    'המדבקות האחרות זזות הצידה בעדינות, ושאר הדף מתעמעם לרגע כדי שהעין תלך אחרי מה שזז. האור מאחורי התמונה נפתח כשהיא נוחתת, והטבעת מתמלאת מחדש. ' +
    'עוד: הדף גולל בעצמו (רק הכותרת מורידה את הגיליון), ומדבקה שנלחצה למטה – הדף עולה אל הזרקור. מי שמעדיף פחות תנועה: הן פשוט מתחלפות.',
  still: 'yard',
  spot: 'goals',
  screen: 'goals',
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
      pattern: 'Container transform: כשפריט נפתח לתצוגה גדולה, הכרטיס שלו עצמו גדל למקום החדש (צורה אחת שמשתנה), והתוכן מתחלף בתוכו – העין לא מאבדת את מה שנלחץ. מכאן המעבר מהמדבקה לזרקור.',
      from: 'Material Design – Motion: the container transform pattern',
      url: 'https://m3.material.io/styles/motion/transitions/transition-patterns',
    },
    {
      pattern: 'כשמשהו זז קדימה, מה שמאחוריו נסוג (מתעמעם) לרגע – כך ברור מה בחזית, בלי להסתיר את ההקשר.',
      from: 'Apple HIG – Motion; iOS App Store (כרטיס שנפתח)',
      url: 'https://developer.apple.com/design/human-interface-guidelines/motion',
    },
    {
      pattern: 'מאמץ גדל כשהמטרה קרובה, ומה שכבר נעשה נספר הלאה: אחרי איסוף המדרגה הבאה מתחילה מלאה בחלקה, וברבע האחרון כתוב "Only 3 more!".',
      from: 'Kivetz, Urminsky & Zheng 2006 (goal gradient); Nunes & Drèze 2006 (endowed progress)',
      url: 'https://business.columbia.edu/faculty/research/goal-gradient-hypothesis-resurrected-purchase-acceleration-illusionary-goal',
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
      name: 'היום',
      note: 'תמונה של לוח המטרות במשחק היום (הוא קורא את החווה בעצמו, אז אי אפשר לצייר אותו לבד כאן): שש שורות דומות עם פס דק, והפרס קטן בצד.',
      motion: 'החלון מחליק פנימה. Claim ירוק – והשורה מתחלפת, בלי רגע.',
      render: () => <Today />,
    },
    {
      id: 'e',
      name: 'זרקור ומדבקות, עם נעיצה (נבחר)',
      note:
        'המטרה הבאה בזרקור למעלה: התמונה בטבעת עם אור מאחוריה, מה לעשות, "Only 3 more!" ברבע האחרון, מה היא נותנת בתמונות, ופס עבה עם המספרים וסימן לבן איפה המדרגה התחילה. ' +
        'ליד הפס סיכה: מטרה ננעצת עולה לראש המסך במשחק (פס קטן מתחת למצפן). מתחת – שאר המטרות כמדבקות, שתיים בשורה, לכל אחת טבעת, מילים, פס עם המספר ומדבקת מטבעות. ' +
        'מטרה שהושגה קמה מהדף עם Claim משלה. נגיעה במדבקה – היא גדלה והופכת לזרקור.',
      motion:
        'הגיליון עולה, הזרקור והמדבקות קופצים אחד אחרי השני; הטבעות והפסים מתמלאים בגל, וברק עובר על הפסים מדי פעם. ' +
        'נגיעה במדבקה: הכרטיס שלה גדל ועולה למקום של הזרקור (התמונה עפה לפניו, המילים נכנסות כשהוא נעצר), והזרקור הקודם מתכווץ למקום שלה; השאר מתעמעם לרגע; האור נפתח והטבעת מתמלאת. ' +
        'Claim: חותמת ✓ נוחתת, המטבעות עפים לצ׳יפ, קונפטי, והכרטיס מתהפך למדרגה הבאה – כבר מלאה בחלקה. סיכה: הפס הקטן עף לראש המסך ונוחת בקפיצה.',
      adds: 'לנעוץ מטרה אחת לראש המסך: פס קטן מתחת למצפן שמראה את ההתקדמות שלה תוך כדי משחק, בלי לפתוח את לוח המטרות.',
      render: (s, act) => (
        <>
          <ChipCoin />
          <GoalsE s={s} act={act} />
        </>
      ),
    },
  ],
}
