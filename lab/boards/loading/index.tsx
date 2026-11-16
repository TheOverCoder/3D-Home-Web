import type { Board } from '../../board'
import type { Away } from './Chrome'
import { TOTAL, type LoadingState } from './load'
import { LoadingA } from './LoadingA'
import { LoadingB } from './LoadingB'
import { LoadingC } from './LoadingC'
import { LoadingD } from './LoadingD'
import { LoadingE } from './LoadingE'
import { LoadingF } from './LoadingF'
import { LoadingToday } from './LoadingToday'

// The loading screen (src/ui/LoadStatus.tsx, inside the start screen src/ui/Intro.tsx): what the player sees from the
// moment the page opens until the first press can start the game. Its states are the loader's real phases with the
// numbers the game itself has (the download is the size of dist/assets-manifest.json; the share is LoadStatus's own
// formula, ./load.ts), and each one goes on moving in the lab as it would in the game: the almost-ready state becomes
// ready by itself a moment after it opens, which is each variant's moment.

/** SAMPLE (the state "back", a feature the game does not have): a returning player's away report — the opening screen's evening farm (lab/boards/intro/data.ts):
 *  two beds of tomatoes and one of strawberries ripe, the nest and the cow full, four buyers at the gate. */
const AWAY: Away = {
  ago: '3 h',
  goods: [
    { item: 'tomato', count: 16 },
    { item: 'strawberry', count: 8 },
    { item: 'egg', count: 6 },
    { item: 'milk', count: 3 },
  ],
  buyers: 4,
}

const base: LoadingState = { phase: 'download', total: TOTAL, loaded: 0, fromDevice: 0, speed: 0, scene: 0, compile: 0, attempt: 0, returning: false, farm: 1 }

export const loadingBoard: Board<LoadingState> = {
  id: 'loading',
  title: 'מסך הטעינה',
  kind: 'ui',
  added: '2026-11-16T05:50',
  ask:
    'ביקשת לעצב את מסך הטעינה (🙋). מהמפה: היום הוא מדבר כמו מפתח (MB, decoding), יש בו שני אחוזים, והדבר הכי בולט בו הוא כפתור אפור שאי אפשר ללחוץ. · ' +
    'הערה על B: "לשפר את שלוש ההצעות עם motion graphics מתקדם יותר, יש לך ספריות 3D; 6 אפשרויות, ואת ה־3 הקיימות לשפר משמעותית."',
  status: 'choose',
  round:
    'סיבוב 5, לפי ההערות על B ו־G ("לשפר את כל מסכי הטעינה – כל פעם תהיה טעינה אחרת, אז כל הרעיונות משופרים ובאותו סגנון"; "שכל סוגי הטעינה יהיו תואמים יותר"): ' +
    'כל השש עומדות עכשיו על אותה במה (רכיב אחד משותף), כך שלא משנה איזו המשחק יגריל – זה אותו מסך: ' +
    'אותם שמיים לכולן (משחר סגלגל־אפרסקי ליום חמים עם הפס, ונקודות אור שעולות), אותו שם של המשחק כמו במסך הפתיחה (האותיות נופלות אחת אחת), ' +
    'אותה במה עגולה באמצע – דיסקית בצבע השמש עם שוליים לבנים וקרניים שמסתובבות מאחוריה ומתחממת עם הפס – אותו כרטיס ליד האגודל (השורה, הפס, הטיפ, ואז Play), ' +
    'ואותו רגע לכולן כשמוכן: הקרניים נפתחות לרווחה, הבזק חוצה את הדיסקית, קונפטי פעם אחת ממנה, ו־Play קופץ. ' +
    'מה שנשאר שונה הוא רק העולם הקטן על הבמה, באותו גודל ובאותו מקום: A האי בתלת־ממד שהבית נבנה עליו; B הדרך הביתה דרך חלון עגול; C הבית שמתחדד בחלון עגול עם קרני אור ופסי קולנוע שנפתחים; ' +
    'D הזרע שגדל לחמנייה על תלולית; E הסמל שנבנה מצורות, הטבעת שלו על שולי הדיסקית; F כוכב הלכת, והלילה בתוך הדיסקית שהופך ליום. ' +
    'G ירדה (היא הייתה A עם תוספת): "מה מחכה לך בחווה" (✦) הוא עכשיו מצב של כולן – "שחקן חוזר" – כי זה חלק מהכרטיס המשותף.',
  still: 'none',
  screen: 'loading',
  research: [
    {
      pattern: 'מסכי טעינה שמתחלפים בכל פתיחה עם ציור אחר – אבל הלוגו, הפס והטיפ תמיד באותו מקום ובאותו עיצוב, כך שזה תמיד אותו מסך. מכאן הבמה המשותפת: רק העולם שבאמצע משתנה.',
      from: 'Clash Royale / Brawl Stars – מסכי טעינה מתחלפים',
      url: 'https://supercell.com/en/games/clashroyale/',
    },
    {
      pattern: 'תמונה גדולה של העולם, פס אחד נמוך במסך, ומתחתיו שורה אחת של טיפ שמתחלף. בלי מספרים טכניים.',
      from: 'Hay Day ושאר משחקי Supercell',
      url: 'https://supercell.com/en/games/hayday/',
    },
    {
      pattern: 'הטעינה היא מסע אל יעד: מטוס שטס אל האי. ההמתנה מרגישה כמו הגעה, לא כמו עיכוב – מכאן הדרך והטרקטור בהצעה B.',
      from: 'Animal Crossing: New Horizons',
      url: 'https://animal-crossing.com/new-horizons/',
    },
    {
      pattern: 'שורות קטנות ומשעשעות שמתחלפות בזמן הטעינה ואומרות "מה עושים עכשיו" בשפה של המשחק, לא של המחשב.',
      from: 'The Sims ("Reticulating splines")',
      url: 'https://www.ea.com/games/the-sims',
    },
    {
      pattern: 'פסים עם פסים אלכסוניים שזזים אחורה, ופס שמאיץ לקראת הסוף, מרגישים מהירים יותר מאותו זמן בדיוק. לכן בפס של A הפסים זזים אחורה.',
      from: 'Harrison, Yeo & Hudson, "Faster Progress Bars" (CHI 2010)',
      url: 'https://www.chrisharrison.net/index.php/Research/ProgressBars',
    },
    {
      pattern: 'דיורמה קטנה שמסתובבת לאט, וכל חלק שמונח קופץ ונוחת בקפיצה רכה. מכאן האי של A: הבית נבנה חלק אחרי חלק עם הטעינה.',
      from: 'Townscaper / Islanders',
      url: 'https://store.steampowered.com/app/1291340/Townscaper/',
    },
    {
      pattern: 'שכבות נוף שזזות במהירויות שונות ושמיים שמשנים צבע לפי שעת היום – עומק ואווירה בלי תלת־ממד. מכאן B.',
      from: "Alto's Adventure / Alto's Odyssey",
      url: 'https://www.altosadventure.com/',
    },
    {
      pattern: 'כוכב לכת זעיר עם עולם שלם עליו, שמסתובב, ויום ולילה שעוברים סביבו. מכאן F: הטעינה היא הלילה שהופך ליום.',
      from: 'Before We Leave / Tiny Glade (עולמות זעירים)',
      url: 'https://store.steampowered.com/app/1073910/Before_We_Leave/',
    },
    {
      pattern: 'זמן שיש בו מה לראות מרגיש קצר יותר מזמן ריק – לכן בכל אחת יש משהו חי לראות ולגעת בו.',
      from: 'Maister, "The Psychology of Waiting Lines" (1985)',
      url: 'https://davidmaister.com/articles/the-psychology-of-waiting-lines/',
    },
    {
      pattern: 'להראות משהו מיד, לתת משהו לעשות בזמן ההמתנה (טיפ, צעצוע קטן ללחוץ עליו), ולאפשר את הלחיצה הראשונה ברגע שאפשר – לא כפתור אפור שמחכה.',
      from: 'Apple Human Interface Guidelines: Loading',
      url: 'https://developer.apple.com/design/human-interface-guidelines/loading',
    },
  ],
  states: [
    { id: 'slow', name: 'הורדה ראשונה בחיבור איטי (15%)', data: { ...base, loaded: Math.round((TOTAL * 0.15) / 0.7), speed: 180_000 } },
    { id: 'build', name: 'בונים את הבית (75%)', data: { ...base, phase: 'prepare', loaded: TOTAL, scene: 33 } },
    { id: 'almost', name: 'כמעט מוכן – ונהיה מוכן מעצמו (96%)', data: { ...base, phase: 'compile', loaded: TOTAL, scene: 100, compile: 0.7 } },
    { id: 'ready', name: 'מוכן – שחקן חוזר', data: { ...base, phase: 'ready', loaded: TOTAL, fromDevice: TOTAL, scene: 100, compile: 1, returning: true } },
    { id: 'light', name: 'מתחילים שוב בגרפיקה קלה (73%)', data: { ...base, phase: 'prepare', loaded: TOTAL, scene: 20, attempt: 1 } },
    {
      id: 'back',
      name: 'שחקן חוזר: בזמן הטעינה רואים מה מחכה בחווה (✦ הצעה, נתונים לדוגמה)',
      data: { ...base, phase: 'prepare', loaded: TOTAL, fromDevice: TOTAL, scene: 40, returning: true, away: AWAY },
    },
  ],
  variants: [
    {
      id: 'today',
      name: 'היום',
      note: 'תמונה של מסך הטעינה כמו שהוא במשחק עכשיו (צילום, לא המשחק עצמו – אותה תמונה בכל המצבים).',
      motion: 'הפס מתמלא עם ברק שעובר עליו. הכפתור האפור מחכה עד שהכול מוכן.',
      render: () => <LoadingToday />,
    },
    {
      id: 'a',
      name: 'האי בתלת־ממד',
      note: 'אי קטן של דשא בתלת־ממד מרחף לפני הדיסקית ומסתובב לאט, והבית נבנה עליו חלק אחרי חלק בזמן הטעינה: רצפה, קירות, גג, דלת וחלונות, ארובה עם עשן, ואז עצים, ערוגה וגדר. סביב – אותם שמיים, אותו שם, אותה דיסקית וקרניים, אותו כרטיס ואותו רגע כמו בכל השש.',
      motion: 'כל חלק נופל מלמעלה, נמעך כשהוא נוחת וקופץ בחזרה; האי מרחף. נגיעה באי – הוא קופץ. כשמוכן: האורות בחלונות נדלקים והאי קופץ, הקרניים נפתחות, הבזק, קונפטי – ו־Play.',
      render: (s, act) => <LoadingA s={s} onPlay={act.close} />,
    },
    {
      id: 'b',
      name: 'הדרך הביתה, בחלון עגול',
      note: 'דרך חלון עגול במקום הדיסקית: הטרקטור נוסע הביתה דרך נוף בשכבות – גבעות רחוקות איטיות, עצים, גבעות קרובות, כביש ודשא מקדימה מהיר – והשמיים בחלון עוברים מהשחר ליום עם הפס. כל שלב בטעינה עובר כשלט בצד הדרך. סביב – אותם שמיים, אותו שם, אותה דיסקית וקרניים, אותו כרטיס ואותו רגע כמו בכל השש.',
      motion:
        'כל שכבה זזה במהירות משלה (parallax), הטרקטור מיטלטל ואבק עף מהגלגל. נגיעה בטרקטור – הוא קופץ. כשמוכן: העולם נעצר, הבית מתגלגל פנימה, הטרקטור חונה לידו בקפיצה; הקרניים נפתחות, הבזק, קונפטי – ו־Play.',
      render: (s, act) => <LoadingB s={s} onPlay={act.close} />,
    },
    {
      id: 'c',
      name: 'הבית מתחדד, בחלון עגול',
      note: 'חלון עגול במקום הדיסקית, ובו הבית עצמו (תמונה מהמשחק), כמו השוט הראשון של סרט: מטושטש בהתחלה ומתחדד עם הטעינה, עם קרני אור, אבק שמרחף בשלושה עומקים ופסים שחורים למעלה ולמטה. סביב – אותם שמיים, אותו שם, אותה דיסקית וקרניים, אותו כרטיס ואותו רגע כמו בכל השש.',
      motion: 'המצלמה מתקרבת לאט, קרני האור נושמות והאבק עולה. כשמוכן: התמונה נהיית חדה, הבזק אור, הפסים השחורים נפתחים; הקרניים נפתחות, קונפטי – ו־Play.',
      render: (s, act) => <LoadingC s={s} onPlay={act.close} />,
    },
    {
      id: 'd',
      name: 'מזרע לפרח',
      note: 'על הדיסקית תלולית אדמה, ובה צמח שגדל עם הטעינה: זרע נופל, השורשים מציירים את עצמם, הגבעול עולה, ובכל רבע של הדרך נפתח עלה; ליד הסוף ניצן. סביב – אותם שמיים, אותו שם, אותה דיסקית וקרניים, אותו כרטיס ואותו רגע כמו בכל השש.',
      motion: 'הצמח מתנדנד ברוח ואבקה מרחפת; כל עלה נפתח בקפיץ עם הבזק קטן. כשמוכן: הניצן מתפוצץ לחמנייה, העלים יוצאים אחד אחרי השני; הקרניים נפתחות, קונפטי – ו־Play.',
      render: (s, act) => <LoadingD s={s} onPlay={act.close} />,
    },
    {
      id: 'e',
      name: 'הסמל נבנה',
      note: 'על הדיסקית הבית נבנה מצורות פשוטות שעפות פנימה – עיגול השמש, ריבוע הקירות, משולש הגג, הדלת, החלונות, הארובה והגבעה – וסביב, על שולי הדיסקית, טבעת מתמלאת עם שמונה סימנים שנדלקים. סביב – אותם שמיים, אותו שם, אותה דיסקית וקרניים, אותו כרטיס ואותו רגע כמו בכל השש.',
      motion: 'כל צורה עפה פנימה בקשת, מסתובבת ונעצרת; ניצוץ רץ בראש הטבעת. כשמוכן: כל הצורות מקבלות קו מתאר בבת אחת – הן הופכות ללוגו – הקרניים נפתחות, קונפטי – ו־Play.',
      render: (s, act) => <LoadingE s={s} onPlay={act.close} />,
    },
    {
      id: 'f',
      name: 'כוכב לכת עם זריחה',
      note: 'כוכב לכת זעיר בתלת־ממד עם החווה עליו – הבית, עצים, טחנת רוח – מסתובב לאט לפני הדיסקית. בתוך הדיסקית לילה עם כוכבים, והטעינה היא הלילה שהופך ליום: הכוכבים כבים, והדיסקית מתחממת לשמש. סביב – אותם שמיים, אותו שם, אותה דיסקית וקרניים, אותו כרטיס ואותו רגע כמו בכל השש.',
      motion: 'הכוכב מסתובב, טחנת הרוח מסתובבת, הכוכבים מנצנצים וכבים עם הפס. נגיעה בכוכב – הוא קופץ. כשמוכן: טחנת הרוח ממהרת והכוכב קופץ; הקרניים נפתחות, קונפטי – ו־Play.',
      render: (s, act) => <LoadingF s={s} onPlay={act.close} />,
    },
  ],
}
