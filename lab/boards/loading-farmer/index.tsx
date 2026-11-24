import type { Board } from '../../board'
import { loadingBoard } from '../loading'
import type { LoadingState } from '../loading/load'
import { TodayLive } from '../loading/TodayLive'
import { LoadingFarmerA } from './LoadingFarmerA'

// The loading screen, round 6, the first of three new ideas (with loading-almanac and loading-today): the farmer keeps
// you company. Today is the game's own screen (src/ui/Loading.tsx), drawn live with the same state. The states are the
// loading board's (the loader's real phases with the numbers the game has: ../loading/load.ts), and each goes on in the
// lab as it would in the game; the almost-ready one becomes ready by itself, which is the screen's moment.

export const ASK =
  'ביקשת (במילים שלך): "אני לא יודע למה המסך טעינה עדיין לא משופר ויזואלית… הוא תקוע, מכוער ולא מעוצב בצורה שכיף להמתין במסך הטעינה. אולי בכלל לעשות מסך טעינה אחר שהוא מרגיש יותר חכם – 3 רפרנסים שונים לגמרי, חדשים, למסכי טעינה גאוניים." ' +
  'לפני הציור צילמתי את הטעינה האמיתית בטלפון מדומה (מעבד איטי פי 4): הפס נראה מלא כבר אחרי 26 שניות ועומד כך עוד 25 שניות; בזמן שהבית נבנה המילים, השמיים והשמש קפואים; ובסוף מבזיק המשחק הגולמי בחושך לפני התפריט. ' +
  'לכן שלוש ההצעות (החקלאי, ספר החווה, הדף של היום) מראות את הדרך כשלושה שלבים אמיתיים – כל שלב ממלא את שלו ולא נראה גמור לפני שהוא גמור – וכל מה שזז בהן ממשיך לזוז גם כשהמשחק עסוק.'

export const loadingFarmerBoard: Board<LoadingState> = {
  id: 'loading-farmer',
  title: 'מסך טעינה: החקלאי מחכה איתך',
  kind: 'ui',
  added: '2026-11-24T14:19',
  ask: ASK,
  status: 'choose',
  still: 'none',
  screen: 'loading',
  research: [
    {
      pattern: 'כשרואים את העבודה נעשית ("מחפשים בחברת תעופה X, עכשיו Y…") ההמתנה שווה יותר בעיני האנשים מאשר פס רגיל – גם כשהיא ארוכה יותר. מכאן החקלאי שאומר מה הוא עושה עכשיו.',
      from: 'Buell & Norton, "The Labor Illusion" (Management Science, 2011)',
      url: 'https://pubsonline.informs.org/doi/10.1287/mnsc.1110.1376',
    },
    {
      pattern: 'המתנה שלא מוסברת מרגישה ארוכה יותר מהמתנה מוסברת, וזמן שיש בו משהו מרגיש קצר יותר. מכאן "החלק הזה איטי יותר בחלק מהטלפונים – זה ממשיך" כששלב מתארך.',
      from: 'Maister, "The Psychology of Waiting Lines" (1985)',
      url: 'https://davidmaister.com/articles/the-psychology-of-waiting-lines/',
    },
    {
      pattern: 'בהמתנה של יותר מ־10 שניות, כשאי אפשר לדעת בדיוק כמה זמן נשאר – רשימה של שלבים שנעשו ושנשארו. מכאן שלוש התחנות במקום פס אחד שנעצר ליד הסוף.',
      from: 'Nielsen Norman Group: Progress Indicators',
      url: 'https://www.nngroup.com/articles/progress-indicators/',
    },
    {
      pattern: 'דמות של המשחק מקבלת אותך כשנכנסים ומספרת מה קורה היום, בפרצוף ובמילים שלה. מכאן החקלאי – אותו אחד שילווה את הצעדים הראשונים בחווה.',
      from: 'Animal Crossing: New Horizons (ההודעות של הבוקר)',
      url: 'https://animal-crossing.com/new-horizons/',
    },
    {
      pattern: 'כל מסך טעינה מצמיד שורה קצרה (טיפ או משהו על העולם) לדמות שמתאימה לה. מכאן הטיפ שהחקלאי אומר כשנוגעים בו, עם התמונה שלו.',
      from: 'Cookie Run: Kingdom – מסכי הטעינה',
      url: 'https://cookierun.wiki/w/Loading_Screens_(Kingdom)',
    },
  ],
  states: loadingBoard.states,
  variants: [
    {
      id: 'today',
      name: 'היום',
      note: 'מסך הטעינה שבמשחק עכשיו, חי (אותו קוד): הטרקטור בחלון עגול, הכרטיס עם הפס והטיפ. הפס כאן רץ לפי המצב של הלוח.',
      motion: 'הנוף בשכבות, הטרקטור והפס זזים; כשמוכן – הבית מתגלגל, קרניים וקונפטי.',
      render: (s, act) => <TodayLive s={s} onPlay={act.close} />,
    },
    {
      id: 'a',
      name: 'החקלאי מחכה איתך',
      note:
        'במקום פס – שיחה: החקלאי (אותו אחד של הצעדים הראשונים) נשען על הגדר של החווה ואומר במילים שלו מה נעשה עכשיו: "מביא את החווה מהעיר…", "בונה את הבית, קרש אחרי קרש…", "מדליק את המנורות…". ' +
        'מתחתיו שלוש תחנות של הדרך (חווה, בית, מנורות): כל אחת עם תמונה ופס קטן משלה, וכשנגמרת – וי ירוק. כשמשהו מתארך הוא אומר את זה בכנות ("איטי יותר בחלק מהטלפונים – זה ממשיך"). נגיעה בו – קריצה וטיפ על המשחק.',
      motion:
        'נכנס: הבועה קופצת מעליו, התחנות עולות מלמטה. כל הזמן: עננים עוברים, הוא מתנדנד ונושם, שלוש נקודות אחרי המילים, והפס של התחנה הנוכחית מתמלא – מהר בהתחלה ולאט ליד הסוף, אף פעם לא מלא לפני שהשלב נגמר. ' +
        'גם כשהמשחק תקוע (בונה את הבית): העננים, הנדנוד, הנקודות, הפס והתמונה של התחנה ממשיכים לזוז – כולם CSS על ה־compositor. רק המילים מחכות. ' +
        'כשמוכן: עיני כוכבים, קפיצה, הקרניים מאחוריו נפתחות, שלושה וי בזה אחר זה וקונפטי אחד. נגיעה – לתפריט.',
      adds: 'שחקן חוזר: החקלאי מספר מה מחכה בחווה – תמונות עם כמויות (נתונים לדוגמה)',
      render: (s, act) => <LoadingFarmerA s={s} onPlay={act.close} />,
    },
  ],
}
