import type { Board } from '../../board'
import { AnimalToolsA } from './AnimalToolsA'
import { AnimalToolsB } from './AnimalToolsB'
import { AnimalToolsC } from './AnimalToolsC'
import { AnimalToolsToday } from './AnimalToolsToday'
import { HOLD_STEPS, toolAt, TOOL, type ToolState } from './sample'

// The animal tools' panel (plans/animal-tools.md, §3: one panel for the three tools, src/farm/tool/ToolPanelView.tsx
// fed a ToolView): E at the fence opens it once the tool is bought, and one tap takes one good (more with its "per
// tap" ladder) from a nest, a cow or a sheep under the barn's rule. Today there is no tool: each animal is the action
// button's own offer, collected one by one where it stands. The states are the herds full (the tool's need) with what
// the plan's numbers make (TOOL: 3 a place → 10, 1 a tap → 10), on SAMPLE DATA (./sample.ts) until the game has them;
// the board's rings fill as the farm's clocks would (PRODUCERS' `every`).

const ASK =
  'כלים לבעלי החיים: כשקונים את כל השדרוגים של סוג חיה (6 תרנגולות, 3 פרות, 4 כבשים) נפתח לו כלי – לול עם קן לכל תרנגולת, דלי חלב לפרות, מספריים וסל צמר לכבשים. ' +
  'עומדים ליד הגדר, לוחצים על הכפתור, ונפתח חלון שבו אוספים בהקשות, במקום לרדוף אחרי כל פרה. · הוחלט: הקשה לוקחת אחד מכל חיה, ומשדרגים עד 10; כל החיות זהות במספרים ובלוגיקה, ושונות רק במראה הכלי.'

const ADDS = 'כלי לכל סוג חיה: עומדים ליד הגדר, וחלון אחד אוסף בהקשות – אחד בכל הקשה, עם שני שדרוגים (כמה כל מקום מחזיק, כמה כל הקשה לוקחת).'

export const animalToolsBoard: Board<ToolState> = {
  id: 'animal-tools',
  title: 'כלים לבעלי החיים',
  kind: 'ui',
  added: '2026-11-17T06:30',
  ask: ASK,
  status: 'choose',
  still: 'yard-clean',
  spot: 'action',
  screen: 'action',
  devices: ['upright', 'sideways', 'desktop'],
  research: [
    {
      pattern: 'כלי אחד שאוסף מכל החיות בלי לרדוף אחרי כל אחת: הסל עובר על החיות ואוסף חלב וצמר. כאן: חלון אחד ליד הגדר, הקשה על כל חיה – בלי ללכת ממנה לאחרת.',
      from: 'Klondike Adventures – הסל לאיסוף מהחיות (דף העזרה של Vizor)',
      url: 'https://vizor.helpshift.com/hc/en/5-klondike-adventures/faq/1871-what-is-the-basket-for-and-how-can-i-get-it',
    },
    {
      pattern: 'כלי לכל סוג חיה (דלי חלב לפרות, מספריים לכבשים): המראה של הכלי אומר מה הוא עושה עוד לפני שקוראים. מכאן הלול, הדלי והמספריים בראש החלון.',
      from: 'Stardew Valley – Milk Pail ו־Shears',
      url: 'https://stardewvalleywiki.com/Milk_Pail',
    },
    {
      pattern: 'מה שנאסף עף מהמקום שנגעו בו אל המחסן, והמספר שם עולה כשהוא נוחת: העין רואה מאיפה ולאן. (המחסן כאן הוא שבב האסם בראש החלון.)',
      from: 'Hay Day – ביצים ושקי צמר שעפים לאסם; Juice it or lose it (GDC 2012)',
      url: 'https://hayday.fandom.com/wiki/Chicken',
    },
    {
      pattern: 'טיימר כטבעת שמתמלאת על הדבר עצמו (התרנגולת, הפרה), ולא שעון בצד; מלא – הוא זוהר.',
      from: 'lab/CRAFT.md – Timers as rings; Township – מבני הייצור',
      url: 'https://www.playrix.com/township',
    },
  ],
  states: [
    { id: 'coop', name: 'הלול: 6 תרנגולות, 3 בכל קן, 1 בהקשה', data: toolAt('hens', { has: [3, 2, 3, 1, 0, 2] }) },
    { id: 'bucket', name: 'דלי החלב: 3 פרות', data: toolAt('cows', { has: [3, 1, 2] }) },
    { id: 'shears', name: 'המספריים: 4 כבשים', data: toolAt('sheep', { has: [3, 3, 2, 0] }) },
    {
      id: 'ten',
      name: '10 בכל קן, 5 בהקשה (שני השדרוגים קנויים בחלקם)',
      data: toolAt('hens', { has: [10, 10, 8, 10, 6, 10], hold: HOLD_STEPS, tap: 5 - TOOL.tap.from, stored: 90, barn: 4, coins: 3180 }),
    },
    { id: 'full', name: 'האסם מלא (פרות): אי אפשר לקחת', data: toolAt('cows', { has: [3, 3, 2], stored: 150, barn: 3 }) },
    { id: 'empty', name: 'אין מה לקחת (כבשים): מחכים לבאים', data: toolAt('sheep', { has: [0, 0, 0, 0], next: [0.25, 0.7, 0.45, 0.9] }) },
  ],
  variants: [
    {
      id: 'today',
      name: 'היום',
      note:
        'היום אין כלי: כל חיה היא הצעה של הכפתור העגול במקום שבו היא עומדת – הקן המשותף של התרנגולות (עד 6 ביצים), כל פרה (עד 3) וכל כבשה (עד 2). ' +
        'כדי לאסוף עדר הולכים מאחת לשנייה. כאן: הכפתור והשורה שמעליו כמו במשחק; לחיצה לוקחת מהחיה הזאת, והכפתור עובר לבאה.',
      motion: 'הכפתור שוקע וטבעת יוצאת ממנו; השורה מעליו מתחלפת לחיה הבאה.',
      render: (s) => <AnimalToolsToday s={s} />,
    },
    {
      id: 'a',
      name: 'A · המקום עצמו',
      note:
        'החלון מצייר את הכלי כמו שהוא עומד ליד הגדר, ובו לוחצים. בלול – תיבת קינים מעץ, קן לכל תרנגולת: הביצים בערימה עם המספר שלהן, והתרנגולת בפינה עם טבעת עד הביצה הבאה. ' +
        'בפרות – דלי עץ אחד שמתמלא מהחלב של כל העדר, והפרות כשבבים מתחתיו; בכבשים – סל צמר והמספריים מעליו, והכבשים כשבבים. ' +
        'הקשה על הדלי או הסל לוקחת מהחיה המלאה ביותר; על קן או שבב – ממנה. בראש: כמה הקשה לוקחת ושבב האסם; למטה שני השדרוגים.',
      motion:
        'החלון עולה מלמטה (לרוחב: מימין) והחלקים נכנסים אחד אחרי השני. הקשה: הקן או הדלי שוקעים וקופצים, הביצה או הבקבוק עפים בקשת לשבב האסם, והוא קופץ וסופר כשהם נוחתים; ' +
        'החלב בדלי יורד, המספריים "גוזזים". אין מקום – רעידה, השבב אדום ו"The barn is full". הטבעות מתמלאות בזמן אמת.',
      adds: ADDS,
      render: (s, act) => <AnimalToolsA s={s} act={act} />,
    },
    {
      id: 'b',
      name: 'B · כרטיס לכל חיה, מטרה אחת גדולה',
      note:
        'אותו חלון בדיוק לשלושת הכלים (רק התמונה בראש אומרת איזה): כרטיס לכל חיה – התמונה והשם שלה, מטרה עגולה אחת עם המוצר והמספר, טבעת סביבה עד הבא, ויתד לכל מקום שהיא מחזיקה. ' +
        'הקשה על המטרה לוקחת ממנה. אין מה לקחת: המטרה חיוורת עם הזמן שנשאר. כמו התאים של חלון המכונה – אותה שפה.',
      motion: 'הכרטיסים נכנסים יחד אחרי החלון; הקשה: המטרה מתכווצת וחוזרת בקפיצה, המוצרים עפים לשבב האסם, היתדות מתרוקנות והמספר יורד. כרטיס מלא זוהר בצהוב.',
      adds: ADDS,
      render: (s, act) => <AnimalToolsB s={s} act={act} />,
    },
    {
      id: 'c',
      name: 'C · ערימה אחת, החיות כדיוקנאות',
      note:
        'הגיבור הוא מה שמחכה: כל מה שהעדר נתן בערימה אחת באמצע, על הבסיס של הכלי (הקן, הדלי, הסל), והמספר גדול מתחתיה – הקשה עליה לוקחת מהחיה המלאה ביותר. ' +
        'מעליה החיות כדיוקנאות עגולים, לכל אחת המספר שלה וטבעת עד הבא; הקשה על דיוקן לוקחת ממנה.',
      motion: 'הערימה נבנית מלמטה למעלה כשהחלון נפתח (כל פריט נופל למקומו). הקשה: הערימה שוקעת, הפריט העליון עף לשבב האסם, המספר הגדול יורד. דיוקן מלא זוהר.',
      adds: ADDS,
      render: (s, act) => <AnimalToolsC s={s} act={act} />,
    },
  ],
}
