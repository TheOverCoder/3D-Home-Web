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

/** SAMPLE (variant G): a returning player's away report — the opening screen's evening farm (lab/boards/intro/data.ts):
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
  added: '2026-11-15T08:29',
  ask:
    'ביקשת לעצב את מסך הטעינה (🙋). מהמפה: היום הוא מדבר כמו מפתח (MB, decoding), יש בו שני אחוזים, והדבר הכי בולט בו הוא כפתור אפור שאי אפשר ללחוץ. · ' +
    'הערה על B: "לשפר את שלוש ההצעות עם motion graphics מתקדם יותר, יש לך ספריות 3D; 6 אפשרויות, ואת ה־3 הקיימות לשפר משמעותית."',
  status: 'choose',
  round:
    'סיבוב 4. ההערה שלך ("6 אפשרויות, motion graphics מתקדם, תלת־ממד, לשפר את השלוש") נענתה כבר בסיבוב 3, אבל הלוח לא סומן אז כחדש – אז הנה הוא שוב, מחכה לך: ' +
    'שש אפשרויות, כל אחת טכניקה אחרת – A אי בתלת־ממד שהבית נבנה עליו חלק אחרי חלק; B דרך בשש שכבות עומק (parallax) והשמיים מהשחר ליום; C פתיחה של סרט (פוקוס, קרני אור, אבק, פסים שחורים); ' +
    'D זרע שגדל לחמנייה (עלה בכל רבע); E הסמל נבנה מצורות שעפות פנימה עם טבעת; F כוכב לכת בתלת־ממד שהלילה בו הופך ליום. בכולן אותו פס, אותה שורה ואותו טיפ, כדי להשוות רק את התנועה. ' +
    'בסיבוב הזה: לרוחב השמש של A כבר לא נחתכת בראש המסך. חדש: G – האי של A, ולשחקן שחוזר, במקום טיפ: מה מחכה לו בחווה, בתמונות עם כמויות, כבר בזמן הטעינה (✦ תכונה חדשה). ' +
    'סמן ✓ על מה שאהבת (אפשר יותר מאחת) ו־✗ על מה שלא.',
  still: 'none',
  screen: 'loading',
  research: [
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
      note: 'אי קטן של דשא באמת בתלת־ממד, מסתובב לאט באוויר, והבית נבנה עליו חלק אחרי חלק בזמן הטעינה: רצפה, קירות, גג, דלת וחלונות, ארובה עם עשן, ואז עצים, ערוגה וגדר. השמש עולה מאחוריו עם הפס.',
      motion:
        'כל חלק נופל מלמעלה, נמעך כשהוא נוחת וקופץ בחזרה. העננים מסתובבים סביב האי, ניצוצות אור עולים, והאי מרחף. נגיעה באי – הוא קופץ. ' +
        'כשמוכן: האורות בחלונות נדלקים, האי קופץ, קרני שמש נפתחות וקונפטי – ו־Play במקום הטיפ.',
      render: (s, act) => <LoadingA s={s} onPlay={act.close} />,
    },
    {
      id: 'b',
      name: 'הדרך הביתה, בשכבות',
      note: 'הטרקטור נוסע הביתה דרך נוף בשש שכבות – גבעות רחוקות חיוורות ואיטיות, עצים, גבעות קרובות, כביש ודשא מקדימה מהיר ומטושטש – כך שהמסך השטוח מקבל עומק. השמיים עוברים מהשחר ליום עם הפס, והשמש מטפסת בקשת.',
      motion:
        'כל שכבה זזה במהירות משלה (parallax), הטרקטור מיטלטל על המהמורות ואבק עף מהגלגל. כל שלב בטעינה עובר כשלט בצד הדרך. נגיעה בטרקטור – הוא קופץ. ' +
        'כשמוכן: העולם מאט ונעצר, הבית שלך מתגלגל פנימה מימין, הטרקטור חונה ליד השער בקפיצה, קונפטי – ו־Play.',
      render: (s, act) => <LoadingB s={s} onPlay={act.close} />,
    },
    {
      id: 'c',
      name: 'פתיחה של סרט',
      note: 'כל המסך הוא הבית עצמו (תמונה מהמשחק), כמו השוט הראשון של סרט: מטושטש בהתחלה ומתחדד עם הטעינה, עם קרני אור מהחלון, אבק שמרחף באור, שוליים כהים ופסים שחורים למעלה ולמטה. הפס והטיפ על זכוכית חלבית.',
      motion:
        'המצלמה מתקרבת לאט, קרני האור מתנדנדות ונושמות, והאבק עולה בשלושה עומקים (רחוק – קטן וחד, קרוב – גדול ומטושטש, כמו עדשה). ברק עובר על הלוגו מדי פעם. ' +
        'כשמוכן: התמונה נהיית חדה בבת אחת, הבזק אור חוצה אותה, הפסים השחורים נפתחים כמו מסך, קונפטי – ו־Play.',
      render: (s, act) => <LoadingC s={s} onPlay={act.close} />,
    },
    {
      id: 'd',
      name: 'מזרע לפרח',
      note: 'הפס הוא צמח שגדל: זרע נופל לאדמה, השורשים מציירים את עצמם, הגבעול עולה עם הטעינה, ובכל רבע של הדרך נפתח עלה – מטרות קטנות שרואים. ליד הסוף מופיע ניצן.',
      motion:
        'עננים חולפים מהר כמו בצילום מואץ, אבקה מרחפת, והצמח מתנדנד ברוח. כל עלה נפתח בקפיץ עם הבזק קטן. ' + 'כשמוכן: הניצן מתפוצץ לחמנייה – העלים יוצאים אחד אחרי השני, גל אור, קונפטי – ו־Play.',
      render: (s, act) => <LoadingD s={s} onPlay={act.close} />,
    },
    {
      id: 'e',
      name: 'הסמל נבנה',
      note: 'motion design בצבעי המשחק: כתמי צבע רכים נמסים ברקע, ובאמצע הבית נבנה מצורות פשוטות שעפות פנימה – עיגול השמש, ריבוע הקירות, משולש הגג, הדלת, החלונות, הארובה והגבעה. מסביב טבעת מתמלאת עם שמונה סימנים שנדלקים.',
      motion:
        'כל צורה עפה פנימה בקשת, מסתובבת, עוברת קצת ונעצרת. ניצוץ רץ בראש הטבעת, וכל סימן שעוברים קופץ. האותיות של השם קופצות אחת אחת ואז עוברות בהן אדוות. ' +
        'כשמוכן: כל הצורות מקבלות קו מתאר בבת אחת – הן הופכות ללוגו – קרניים מתפרצות, קונפטי – ו־Play.',
      render: (s, act) => <LoadingE s={s} onPlay={act.close} />,
    },
    {
      id: 'f',
      name: 'כוכב לכת עם זריחה',
      note: 'כוכב לכת זעיר בתלת־ממד, עם החווה עליו – הבית, עצים, טחנת רוח ושדות – מסתובב לאט בחלל. הטעינה היא הלילה שהופך ליום: בהתחלה לילה עם כוכבים והירח, באמצע שחר, וכשמוכן – יום מלא.',
      motion:
        'הכוכב מסתובב, טחנת הרוח מסתובבת, הכוכבים מנצנצים ונעלמים עם הפס, השמיים עוברים מסגול כהה דרך ורוד־כתום לזהב, והאור על החווה מתחמם. נגיעה בכוכב – הוא קופץ. ' +
        'כשמוכן: השמש גבוהה, טחנת הרוח ממהרת, הכוכב קופץ, קונפטי – ו־Play.',
      render: (s, act) => <LoadingF s={s} onPlay={act.close} />,
    },
    {
      id: 'g',
      name: 'A + מה מחכה לך בחווה',
      note:
        'האי בתלת־ממד של A, ולשחקן שחוזר – במקום הטיפ – "Waiting on your farm": מה הבשיל ומה החיות נתנו בזמן שלא היה, ומי מחכה בשער, בתמונות עם כמויות. ' +
        'זמן הטעינה הופך לרגע של "יש לי מה לעשות", והכפתור Continue כבר מבטיח משהו. שחקן חדש (ההורדה הראשונה) רואה את הטיפים כמו ב־A.',
      motion: 'כמו A; והדברים שמחכים קופצים לכרטיס אחד אחרי השני עם קפיצה קטנה. כשמוכן – Continue במקומם.',
      adds: 'דוח "מה קרה בזמן שלא היית" כבר במסך הטעינה, לשחקן שחוזר – בתמונות עם כמויות, במקום טיפ.',
      render: (s, act) => <LoadingA s={s} onPlay={act.close} away={s.phase === 'download' && s.fromDevice < s.total && !s.returning ? undefined : AWAY} />,
    },
  ],
}
