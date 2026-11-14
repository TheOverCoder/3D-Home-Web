import type { Board } from '../../board'
import { TOTAL, type LoadingState } from './load'
import { LoadingA } from './LoadingA'
import { LoadingB } from './LoadingB'
import { LoadingC } from './LoadingC'
import { LoadingToday } from './LoadingToday'

// The loading screen (src/ui/LoadStatus.tsx, inside the start screen src/ui/Intro.tsx): what the player sees from the
// moment the page opens until the first press can start the game. Its states are the loader's real phases with the
// numbers the game itself has (the download is the size of dist/assets-manifest.json; the share is LoadStatus's own
// formula, ./load.ts), and each one goes on moving in the lab as it would in the game: the almost-ready state becomes
// ready by itself a moment after it opens, which is each variant's moment.

const base: LoadingState = { phase: 'download', total: TOTAL, loaded: 0, fromDevice: 0, speed: 0, scene: 0, compile: 0, attempt: 0, returning: false, farm: 1 }

export const loadingBoard: Board<LoadingState> = {
  id: 'loading',
  title: 'מסך הטעינה',
  ask: 'ביקשת לעצב את מסך הטעינה (🙋). מהמפה: היום הוא מדבר כמו מפתח (MB, decoding), יש בו שני אחוזים, והדבר הכי בולט בו הוא כפתור אפור שאי אפשר ללחוץ.',
  status: 'choose',
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
      name: 'החווה על הבמה',
      note: 'הבית עומד על אי קטן של דשא באמצע המסך, והחווה מתאספת סביבו תוך כדי טעינה: נבט, חיטה, תרנגולת, פרה… מתחת לבמה פס אחד ושורה אחת, וליד האגודל טיפ שמתחלף. כשמוכן – Play עולה במקום הטיפ.',
      motion:
        'האי עולה והבית נוחת עליו. כל פעם שהפס עובר סימן, עוד חיה או ירק קופצים על האי, והשמש עולה מאחורי הגג. בזמן ההמתנה הבית נושם, החיות מתנדנדות והפסים בפס זזים אחורה; נגיעה בבית מקפיצה אותו. ' +
        'כשמוכן: קרני שמש מסתובבות, הבית קופץ, ו-Play קופץ למעלה עם ברק שעובר עליו. ב-Play המסך מתקרב לבית ונעלם.',
      render: (s, act) => <LoadingA s={s} onPlay={act.close} />,
    },
    {
      id: 'b',
      name: 'הדרך הביתה',
      note: 'הפס הוא דרך שמתפתלת מהלוגו עד הבית שלך, ליד האגודל (לרוחב: משמאל לימין). טרקטור נוסע עליה, ושלוש תחנות נדלקות כשהוא עובר: החבילה בדרך, בונים את הבית, מדליקים את האורות.',
      motion:
        'הטרקטור נוסע מתחילת הדרך עד המקום של עכשיו, והדרך נצבעת צהוב מאחוריו. התחנה הבאה נושמת טבעת, וכל תחנה שהוא עובר קופצת ונצבעת. נגיעה בטרקטור מקפיצה אותו. ' +
        'כשמוכן: הטרקטור חונה ליד הבית, הבית מתכווץ, קופץ גדול ומקבל ניצוץ, ו-Play יורד אליו מלמטה.',
      render: (s, act) => <LoadingB s={s} onPlay={act.close} />,
    },
    {
      id: 'c',
      name: 'חלון אל הבית',
      note: 'כל המסך הוא הבית עצמו, מטושטש בהתחלה ומתחדד ככל שהטעינה מתקדמת. בגיליון נייר למטה (לרוחב: מימין) כרטיסים של מה שמחכה לך, שאפשר להחליק, ופס דק אחד. כשמוכן – הפס עצמו גדל והופך לכפתור Play.',
      motion:
        'התמונה זזה לאט כמו מצלמה שמתקרבת, והלוגו צץ מעליה. הגיליון עולה, הכרטיסים מתחלפים כל כמה שניות (או בהחלקה), ואור רך עובר על הפס. ' +
        'כשמוכן: הבית נהיה חד, הצל מתבהר, והפס מתנפח לכפתור Play צהוב והמילה קופצת בתוכו.',
      render: (s, act) => <LoadingC s={s} onPlay={act.close} />,
    },
  ],
}
