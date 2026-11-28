import type { Board } from '../../board'
import { loadingBoard } from '../loading'
import type { LoadingState } from '../loading/load'
import { TodayLive } from '../loading/TodayLive'
import { ASK } from '../loading-farmer'
import { LoadingTodayA } from './LoadingTodayA'

// The loading screen, round 6, the third of three new ideas (with loading-farmer and loading-almanac): today's page.
// Today is the game's own screen (src/ui/Loading.tsx), drawn live with the same state; the states are the loading
// board's, each on a day of the coming week, so the page shows what the farm news says on that day (in the game: the
// device's own date and clock).

export interface TodayState extends LoadingState {
  /** the device's date and time (ms): the page's day, and what is on at the farm then (src/farm/events.ts) */
  day: number
}

/** Each state on a day of its own (local time), so the page's news is seen on a quiet day and on each kind of event. */
const DAYS: Record<string, number> = {
  slow: new Date(2026, 10, 24, 8, 10).getTime(), // Tuesday: a quiet day, the harvest festival tomorrow
  build: new Date(2026, 10, 25, 19, 30).getTime(), // Wednesday: the harvest festival
  almost: new Date(2026, 10, 27, 17, 5).getTime(), // Friday evening: the machine rush
  ready: new Date(2026, 10, 28, 10, 0).getTime(), // Saturday: the lucky draw
  light: new Date(2026, 10, 30, 10, 0).getTime(), // Monday: market day
  back: new Date(2026, 10, 26, 9, 30).getTime(), // Thursday: gift day
}

export const loadingTodayBoard: Board<TodayState> = {
  id: 'loading-today',
  title: 'מסך טעינה: הדף של היום',
  kind: 'ui',
  added: '2026-11-24T14:21',
  done: { round: '2026-11-24T14:21', what: 'אוחד עם ספר החווה ללוח אחד: לוח התלישה עם הטיפים' },
  ask: ASK,
  status: 'choose',
  still: 'none',
  screen: 'loading',
  research: [
    {
      pattern: 'מסך הטעינה מתחלף לפי מה שקורה עכשיו במשחק (עונה, אירוע), כך שכל פתיחה מספרת משהו חדש ונותנת סיבה להיכנס. מכאן הדף של היום עם האירוע של היום בחווה.',
      from: 'Pokémon GO – מסכי טעינה של עונות ואירועים',
      url: 'https://pokemongo.com/en/post/loadingscreens',
    },
    {
      pattern: 'המשחק חי לפי התאריך והשעה האמיתיים שלך, ואירועים חוזרים בימים קבועים – כל יום שונה. מכאן לוח השנה: השבוע של החווה (שוק, פסטיבל, מתנות…) הוא כבר של המשחק.',
      from: 'Animal Crossing: New Horizons – השעון והלוח האמיתיים',
      url: 'https://animal-crossing.com/new-horizons/',
    },
    {
      pattern: 'כשאי אפשר לדעת בדיוק כמה זמן נשאר – שלבים שנעשו ושנשארו. מכאן שלוש המשיכות של הטוש סביב התאריך, משיכה לכל שלב אמיתי, כל אחת עם התמונה שלה.',
      from: 'Nielsen Norman Group: Progress Indicators',
      url: 'https://www.nngroup.com/articles/progress-indicators/',
    },
    {
      pattern: 'ככל שהמטרה קרובה יותר המאמץ (והעניין) גדל: עיגול שכמעט נסגר מושך את העין. מכאן העיגול סביב התאריך – והחותמת כשהוא נסגר.',
      from: 'Kivetz, Urminsky & Zheng, "The Goal-Gradient Hypothesis Resurrected" (2006)',
      url: 'https://doi.org/10.1509/jmkr.43.1.39',
    },
    {
      pattern: 'המתנה שיש בה משהו להסתכל עליו ולקרוא מרגישה קצרה יותר. מכאן דבר אחד אמיתי ושימושי על היום – לא טיפ כללי.',
      from: 'Maister, "The Psychology of Waiting Lines" (1985)',
      url: 'https://davidmaister.com/articles/the-psychology-of-waiting-lines/',
    },
  ],
  states: loadingBoard.states.map((st) => ({ ...st, data: { ...st.data, day: DAYS[st.id] ?? DAYS.slow } })),
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
      name: 'הדף של היום',
      note:
        'מסך הטעינה הוא לוח השנה של החווה על שולחן עץ: היום בשבוע על פס אדום, התאריך גדול, ומתחתיו מה קורה היום בחווה לפי התאריך של הטלפון – באותן מילים של חדשות החווה ("היום: פסטיבל הקציר – הכל גדל פי 2, עד חצות"), או מה מגיע מחר. ' +
        'ההתקדמות היא טוש שמקיף את התאריך בשלוש משיכות, משיכה לכל שלב אמיתי (חווה, בית, מנורות) עם התמונה שלו; הנוכחית מהירה בהתחלה ואיטית ליד הסוף, ולא נסגרת לפני שהשלב נגמר. ספל מעלה אדים ליד.',
      motion:
        'נכנס: הלוח מחליק למעלה ומתיישר בקפיץ. כל הזמן: הטוש מצייר עם נקודת אור בקצה, התמונה של השלב הנוכחי מתנדנדת, פינת הדף מתרוממת ברוח, האדים עולים מהספל. ' +
        'גם כשהמשחק תקוע: כל אלה ממשיכים (transform/opacity על ה־compositor); רק השורה למטה מחכה. ' +
        'כשמוכן: העיגול נסגר בירוק, וי בכל תמונה, חותמת READY! נוחתת על הדף, הלוח קופץ מהמכה, קונפטי אחד. נגיעה – לתפריט.',
      adds: 'שחקן חוזר: פתק מודבק מתחת ללוח עם מה שמחכה בחווה (נתונים לדוגמה). ואירוע היום – מהטבלה האמיתית של השבוע (צריך אותה במעטפת הדף)',
      render: (s, act) => <LoadingTodayA s={s} onPlay={act.close} />,
    },
  ],
}
