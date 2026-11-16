import { art } from '../../../src/ui/art'
import type { Board } from '../../board'
import { CLOSE, LATER, READY, START, type GoalsState } from './data'
import { GoalsE } from './GoalsE'
import { GoalsF } from './GoalsF'
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
  added: '2026-11-16T09:47',
  ask:
    'ביקשת לעצב את זה (🙋). מהמפה: שש שורות דומות, כולן ב־0, אף אחת לא "הבאה בתור"; הפרס קטן בצד; כשמטרה מושגת יש רק כפתור Claim ירוק – אין רגע. · ' +
    'סיבוב 2: "לשלב את B ו־A: שרואים 2 בשורה, פס התקדמות, עוד אנימציות – שילוב שלהם ושיפור."',
  status: 'choose',
  chosen: 'e',
  round:
    'סיבוב 4 (על E כתבת: "לשפר, לדייק, לראות איפה הבעיות – יש פרס מתחת לקובייה, בלוק של אתגר אחר – ועוד תיקונים ושיפורים משמעותיים, ועוד וריאציה לרפרנס ברמה הכי גבוהה"). ' +
    'מה היה לא בסדר ב־E ותוקן: (1) מדבקת המטבעות של כל מטרה הייתה תלויה מעל הכרטיס שמעליה – לא היה ברור של מי הפרס. עכשיו כל פרס בתוך הכרטיס שלו: במדבקה בתחתית ("Gives" עם המטבעות והחומר), ובזרקור בסוף הפס – הפס מוביל אל מה שמקבלים; ' +
    '(2) לרוחב הסיכה ישבה צמודה מתחת לפרס של הזרקור – עכשיו יש לה תא משלה ליד המילים; (3) לחיצה על מדבקה הזיזה את כל המדבקות בבת אחת – עכשיו רק שתיים מתחלפות: המדבקה עולה לזרקור והמטרה שהייתה שם יורדת בדיוק למקום שלה, והשאר לא זזות; ' +
    '(4) "87% there already!" הופיע על כל מטרה שנלחצה – עכשיו רק אחרי איסוף, כשזה באמת נכון; (5) מטרה שהושגה לרוחב נחתכה ("Harvest ...") – עכשיו השם שלם, ו־Claim מתחתיו; (6) הדף נמוג בתחתית כשיש עוד למטה. ' +
    'שיפור חדש ב־E: כששתי מטרות או יותר הושגו – "Claim all" בכותרת, לחיצה אחת אוספת את כולן (✦). ' +
    'ועוד רפרנס, F – ארון המדליות: כל מטרה מדליה, וכל מדרגה מתכת (ארד, כסף, זהב, פלטינה, יהלום); המדליה במרכז גדולה, מסתובבת קצת מתחת לאצבע, החלקה מעבירה למדליה הבאה, ובאיסוף היא מסתובבת פעמיים וחוזרת במתכת הבאה.',
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
    {
      pattern: 'כל מדליה בארבע דרגות (ארד, כסף, זהב, פלטינה), טבעת מסביב שמתמלאת עד הדרגה הבאה – רואים במבט איפה אתה ומה הבא. מכאן המתכות של F.',
      from: 'Pokémon GO – מדליות',
      url: 'https://bulbapedia.bulbagarden.net/wiki/Medal_(GO)',
    },
    {
      pattern: 'מדליה שמסובבים באצבע, כמו מטבע ביד: היא אובייקט שרוצים לגעת בו, לא תמונה. מכאן ההטיה מתחת לאצבע והסיבוב של F באיסוף.',
      from: 'Apple Fitness – Awards (המדליות)',
      url: 'https://developer.apple.com/forums/thread/706570',
    },
    {
      pattern: 'הפרס בסוף הפס: מה שמקבלים עומד במקום שהפס מוביל אליו, כך שהעין הולכת מההתקדמות לפרס בלי לחפש (ולא מדבקה בפינה שנראית שייכת לכרטיס השכן).',
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
      name: 'היום',
      note: 'תמונה של לוח המטרות במשחק היום (הוא קורא את החווה בעצמו, אז אי אפשר לצייר אותו לבד כאן): שש שורות דומות עם פס דק, והפרס קטן בצד.',
      motion: 'החלון מחליק פנימה. Claim ירוק – והשורה מתחלפת, בלי רגע.',
      render: () => <Today />,
    },
    {
      id: 'e',
      name: 'זרקור ומדבקות, מדויק (נבחר)',
      note:
        'המטרה הבאה בזרקור למעלה: התמונה בטבעת עם אור מאחוריה, מה לעשות, "Only 3 more!" ברבע האחרון, ופס עבה שבסופו מה שהיא נותנת (מטבעות וחומר). סיכה בפינה נועצת אותה לראש המסך. ' +
        'מתחת – שאר המטרות כמדבקות, שתיים בשורה: טבעת, מילים, פס עם המספר, ובתחתית "Gives" עם הפרס – כל פרס בתוך הכרטיס שלו. מטרה שהושגה קמה מהדף עם Claim משלה; שתיים ומעלה – "Claim all" בכותרת.',
      motion:
        'הגיליון עולה, הזרקור והמדבקות קופצים אחד אחרי השני; הטבעות והפסים מתמלאים בגל, וברק עובר על הפסים מדי פעם. ' +
        'נגיעה במדבקה: היא גדלה ועולה למקום של הזרקור, והזרקור הקודם יורד בדיוק למקום שלה – רק השתיים זזות; השאר מתעמעם לרגע. ' +
        'Claim: חותמת ✓ נוחתת, המטבעות עפים לצ׳יפ, קונפטי, והכרטיס מתהפך למדרגה הבאה – כבר מלאה בחלקה. Claim all: חותמת על כל אחת שהושגה ומטבעות של כולן.',
      adds: 'לנעוץ מטרה אחת לראש המסך (פס קטן מתחת למצפן), ו־"Claim all" שאוסף בלחיצה אחת את כל המטרות שהושגו.',
      render: (s, act) => (
        <>
          <ChipCoin />
          <GoalsE s={s} act={act} />
        </>
      ),
    },
    {
      id: 'f',
      name: 'ארון המדליות',
      note:
        'כל מטרה מדליה, וכל מדרגה שלה מתכת: ארד, כסף, זהב, פלטינה, ואחר כך יהלום עם כוכב לכל מדרגה. המדליה שעובדים עליה גדולה באמצע – השפה שלה היא הטבעת שמתמלאת, היא עמומה עד שמגיעים ומבריקה כשמגיעים; השכנות עומדות בצדדים, קטנות ומסובבות. ' +
        'מתחתיה: המתכת והמדרגה, מה לעשות, כמה נשאר, הפס ובסופו הפרס, וסולם המתכות (מה זכית, מה עכשיו, מה הבא). למטה הארון: כל המטרות כמדליות קטנות – נגיעה מביאה אחת למרכז.',
      motion:
        'החלקה לצדדים מזיזה את המדף, והמדליה הגדולה נוטה מתחת לאצבע כמו מטבע ביד; נגיעה במדליה בצד מביאה אותה למרכז. מדליה שהושגה מבריקה (אור עובר עליה) ומדליה קטנה שהושגה קופצת בארון. ' +
        'Claim: המדליה מסתובבת פעמיים וחוזרת במתכת הבאה, המטבעות עפים לצ׳יפ עם קונפטי, והטבעת מתמלאת מחדש ממה שכבר יש ("33% there already!"). פחות תנועה: בלי סיבוב ובלי הטיה.',
      render: (s, act) => (
        <>
          <ChipCoin />
          <GoalsF s={s} act={act} />
        </>
      ),
    },
  ],
}
