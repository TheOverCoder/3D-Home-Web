import type { Board } from '../../board'
import { TodayLive } from '../loading/TodayLive'
import { ASK } from '../loading-farmer'
import { loadingTodayBoard, type TodayState } from '../loading-today'
import { LoadingCalendarA } from './LoadingCalendarA'

// The loading screen, round 7: the two of round 6's three ideas the user liked, as one — loading-today's tear-off
// calendar (its look) and loading-almanac's tips swiped while waiting. Today is the game's own screen (src/ui/Loading.tsx),
// drawn live with the same state; the states are the loading board's, each on a day of the coming week as loading-today
// has them, so the page's event is seen on a quiet day and on each kind of event.

export const loadingCalendarBoard: Board<TodayState> = {
  id: 'loading-calendar',
  title: 'מסך טעינה: לוח התלישה של החווה',
  kind: 'ui',
  added: '2026-11-27T00:05',
  ask: 'ביקשת (במילים שלך): "את הזה עם הטיפים אהבתי וגם את הסגנון של הלוח שנה – שיעשה רפרנס אחד של שניהם משולבים לאחד, שאפשר להעביר טיפים בלוח שנה." · ' + 'הבקשה הקודמת: ' + ASK,
  status: 'choose',
  round:
    'סבב 7: שני הרעיונות שאהבת מסבב 6 – ספר החווה (הטיפים שמעבירים באצבע) והדף של היום (לוח השנה על שולחן העץ) – בהצעה אחת: לוח התלישה נשאר כמו שהיה (הפס האדום, התאריך הגדול והטוש שמקיף אותו, מה קורה היום בחווה, הספל וחותמת READY), ' +
    'ומתחת לקו מנוקב יש בו פנקס של פתקים – כל פתק טיפ (תמונה, מילה, שורה). מחליקים – הפתק העליון נתלש והבא מתחתיו; בלי לגעת – פתק נתלש מעצמו כל כמה שניות. לשחקן חוזר הפתק הראשון הוא מה שמחכה בחווה (✦).',
  still: 'none',
  screen: 'loading',
  research: [
    {
      pattern: 'לוח תלישה: בכל דף התאריך הגדול ומתחתיו משהו קצר לקרוא (משפט, טיפ). החלקה תולשת את הדף, והבא כבר מתחתיו – הטקס הקטן של כל יום. מכאן: הטיפים הם פתקים שנתלשים מהלוח.',
      from: 'אפליקציות לוח תלישה (Daily Affirmation Calendar, RipIt)',
      url: 'https://apps.apple.com/us/app/%EB%A7%A4%EC%9D%BC-%EC%95%84%EC%B9%A8-%EA%B8%8D%EC%A0%95-%ED%99%95%EC%96%B8-%EB%8B%AC%EB%A0%A5/id1671649518',
    },
    {
      pattern: 'הלוח של המשחק מראה ביום עצמו את מה שקורה בו (פסטיבל, יום הולדת) בתמונה. מכאן האירוע של היום מודפס על הדף מתחת לתאריך – לא עוד טיפ שנתלש.',
      from: 'Stardew Valley – לוח השנה',
      url: 'https://stardewvalleywiki.com/Calendar',
    },
    {
      pattern: 'כל כרטיס טעינה: ציור גדול ושורה אחת של טיפ שמתאימה לו. מכאן כל פתק – תמונה בחלון צבעוני, מילה ושורה (מספר הלוח הקודם שאהבת).',
      from: 'Cookie Run: Kingdom – מסכי הטעינה',
      url: 'https://cookierun.wiki/w/Loading_Screens_(Kingdom)',
    },
    {
      pattern:
        'גלילה, והאנימציות שקשורות אליה (scroll-driven, של transform ו־opacity), רצות מחוץ ל־thread הראשי. לכן הפתקים ממשיכים להיתלש תחת האצבע גם כשהמשחק תקוע שניות בבניית הבית – הפנקס הוא גלילה, והתלישה היא אנימציה של הגלילה.',
      from: 'Chrome for Developers – Scroll-driven animations',
      url: 'https://developer.chrome.com/blog/scroll-animation-performance-case-study',
    },
    {
      pattern: 'בהמתנה ארוכה שאי אפשר לדעת כמה תימשך – שלבים שנעשו ושנשארו. מכאן שלוש המשיכות של הטוש סביב התאריך, אחת לכל שלב אמיתי.',
      from: 'Nielsen Norman Group: Progress Indicators',
      url: 'https://www.nngroup.com/articles/progress-indicators/',
    },
  ],
  states: loadingTodayBoard.states,
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
      name: 'לוח התלישה עם פתקי הטיפים',
      note:
        'לוח השנה של החווה על שולחן עץ, כמו בדף של היום: היום בשבוע על פס אדום, התאריך גדול, ומתחתיו מה קורה היום בחווה לפי התאריך של הטלפון (או מה מגיע הבא), במילים של חדשות החווה. ' +
        'מתחת לקו מנוקב – פנקס פתקים, כל פתק טיפ אחד כמו בכרטיסים של ספר החווה: תמונה בחלון צבעוני, מילה ושורה, ו"טיפ 2 מתוך 6". מחליקים (או נוגעים בפתק, או בפינה המקופלת) – הפתק העליון נתלש והבא כבר מתחתיו; בסוף הפנקס מתחיל פנקס חדש. ' +
        'ההתקדמות: הטוש מקיף את התאריך בשלוש משיכות, אחת לכל שלב אמיתי (חווה, בית, מנורות), ולא נסגר לפני שהשלב נגמר. לא צריך לגעת בכלום כדי שהטעינה תיגמר.',
      motion:
        'נכנס: הלוח מחליק למעלה ומתיישר בקפיץ. בהחלקה: הפתק העליון הולך עם האצבע, נוטה ונתלש מהקו המנוקב ונעלם, והבא עולה מתחתיו. בלי נגיעה – פתק נתלש מעצמו כל 6 שניות; אחרי נגיעה הלוח לא מחליף לבד עד 15 שניות בלי מגע. ' +
        'כל הזמן: הטוש מצייר עם נקודת אור בקצה, התמונה של השלב מתנדנדת, הציור בפתק קופץ, פינת הפתק מתרוממת ברוח, היד ברמז מחליקה, האדים עולים מהספל. ' +
        'גם כשהמשחק תקוע: כל אלה ממשיכים, וגם התלישה באצבע (הפנקס הוא גלילה של הדפדפן, והתלישה אנימציה של הגלילה – transform/opacity מחוץ ל־thread הראשי). מחכים רק ההחלפה מעצמה, נגיעה (במקום החלקה) והשורה למטה. ' +
        'כשמוכן: העיגול נסגר בירוק, וי בכל תמונה, חותמת READY! נוחתת על התאריך, הלוח קופץ מהמכה, קונפטי אחד; "Tap to go on". פחות תנועה: הפתק מתחלף בבת אחת ובלי הטיה, החותמת כבר שם.',
      adds: 'שחקן חוזר: הפתק הראשון בפנקס הוא מה שמחכה בחווה – תמונות עם כמויות והקונים בשער (נתונים לדוגמה). והאירוע של היום – מהטבלה האמיתית של השבוע (צריך אותה במעטפת הדף)',
      render: (s, act) => <LoadingCalendarA s={s} onPlay={act.close} />,
    },
  ],
}
