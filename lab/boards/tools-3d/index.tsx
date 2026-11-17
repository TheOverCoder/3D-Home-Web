import type { Board } from '../../board'
import type { ToolLook } from '../../../src/models/tools'
import { ToolsView } from './ToolsView'

// The animals' tools (3D, the 3D designer's; plans/animal-tools.md §3, the board `tools-3d`): the hens' coop (a nest a
// hen), the cows' milk bucket and the sheep's shears with their wool basket, each at its place at its animal's fence.
// Three families of the three, one style each, made with the kit (src/models/tools.ts: in the gallery and the model
// checks; nothing in the farm draws them until the user chooses): A little red houses, B tin and blue enamel, C wicker
// and plain wood. "Today" is the pens as they are. Its states, for each tool: in the game (the player's eyes where the
// action button offers it), close (turning round it, its pieces rising into place on a press, as the films' prop
// `tool` does with its `open`), and with its herd.

export interface ToolsState {
  look: ToolLook
  view: 'game' | 'close' | 'herd'
}

const TRI = 'משולשים מתוך 800'
const MOTION = 'מקרוב, הכפתור "בנייה" מרים את החלקים מהאדמה למקומם אחד אחרי השני, כמו בסרטון. עם הבהמות: התרנגולות מנקרות, הפרות לועסות ומניפות זנב, הכבשים רועות.'
const ADDS = 'כלי לכל בעל חיים ליד הגדר שלו: לול עם קן לכל תרנגולת, דלי חלב, ומספריים עם סל צמר.'

export const tools3dBoard: Board<ToolsState> = {
  id: 'tools-3d',
  title: 'הכלים של בעלי החיים',
  kind: '3d',
  added: '2026-11-17T06:12',
  ask:
    'כשקונים את כל השדרוגים של סוג חיה, נפתח לו כלי: לול עם קן לכל תרנגולת, דלי חלב לפרות, מספריים וסל צמר לכבשים. עומדים ליד הגדר, לוחצים על הכפתור, ונפתח חלון שבו אוספים בהקשות. · ' +
    'הוחלט: כל החיות זהות במספרים ובלוגיקה, ושונות רק במראה הכלי, במקומו ליד הגדר ובסרטון.',
  status: 'choose',
  still: 'none',
  research: [
    {
      pattern: 'דוכן לכדי חלב: באנגליה, באירלנד ובצפון אמריקה בנו ליד הדרך במה בגובה של עגלה, ועליה חיכו כדי החלב. מכאן הדוכן של A ליד שער המרעה, וכד החלב ב־A וב־B.',
      from: 'Milk churn stand',
      url: 'https://en.wikipedia.org/wiki/Milk_churn_stand',
    },
    {
      pattern: 'מספרי גז ידניים הם שני להבים שמחוברים למעלה בקשת קפיץ. את הקשת מזהים מרחוק, ולכן בכל שלוש ההצעות היא עבה ובולטת, והמספריים קצת יותר גדולות מבמציאות.',
      from: 'Blade shearing',
      url: 'https://en.wikipedia.org/wiki/Blade_shearing',
    },
    {
      pattern: 'תיבת הטלה לשש תרנגולות: שתי שורות של פתחים, מכסה משופע שהתרנגולות לא יעמדו עליו, ומוט לעמידה לפני הפתחים, הרבה פעמים מפח מגולוון. מכאן התיבה של B והמוט של A.',
      from: 'תיבות הטלה מפח לשש תרנגולות (Brower)',
      url: 'https://www.wayfair.com/brand/bnd/brower-b38697.html',
    },
    {
      pattern: 'קודם הצללית, אחר כך הצורות הגדולות ורק אז הצבע: כל משפחה שונה בצללית (גג משופע, עיגולים ופח מבריק, סלים נמוכים ועגולים) ולא רק בצבע, והפרטים הולכים לחפץ עצמו ולא לעמודים.',
      from: 'RocketBrush: low poly art in games',
      url: 'https://rocketbrush.com/blog/low-poly-art-in-games',
    },
  ],
  states: [
    { id: 'nests-game', name: 'לול · במשחק', data: { look: 'nests', view: 'game' } },
    { id: 'pail-game', name: 'דלי · במשחק', data: { look: 'pail', view: 'game' } },
    { id: 'shears-game', name: 'מספריים · במשחק', data: { look: 'shears', view: 'game' } },
  ],
  variants: [
    {
      id: 'today',
      name: 'היום',
      note: 'הגדרות כמו שהן היום: לתרנגולות תיבת קן אחת קטנה שבולטת מהגדר, ולפרות ולכבשים אין כלום ליד השער.',
      render: (s) => <ToolsView v="today" s={s} />,
    },
    {
      id: 'a',
      name: 'בתים אדומים',
      note:
        'כל כלי בבית קטן משלו, כמו הלול שכבר יש: קרשים אדומים עם פסים, שוליים לבנים וגג רעפים. ' +
        `הלול: שישה קנים בשתי שורות, קש שגולש מכל קן ומוט לעמידה לפניהם (612 ${TRI}). ` +
        `הדלי: דוכן חלב ליד השער, במה בגובה עגלה עם דלי פח וכד חלב תחת גג (656 ${TRI}). ` +
        `המספריים: לוח אדום עם גג, המספריים תלויות על יתד, וסל נצרים מלא צמר על ספסל (722 ${TRI}). ` +
        'מרחוק כל אחד נראה כמו מקום, בזכות הגג.',
      motion: MOTION,
      adds: ADDS,
      render: (s) => <ToolsView v="a" s={s} />,
    },
  ],
}
