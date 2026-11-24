import type { Board } from '../../board'
import { loadingBoard } from '../loading'
import type { LoadingState } from '../loading/load'
import { TodayLive } from '../loading/TodayLive'
import { ASK } from '../loading-farmer'
import { LoadingAlmanacA } from './LoadingAlmanacA'

// The loading screen, round 6, the second of three new ideas (with loading-farmer and loading-today): the farm's almanac
// in your hand. Today is the game's own screen (src/ui/Loading.tsx), drawn live with the same state; the states are the
// loading board's.

export const loadingAlmanacBoard: Board<LoadingState> = {
  id: 'loading-almanac',
  title: 'מסך טעינה: ספר החווה בכף היד',
  kind: 'ui',
  added: '2026-11-24T14:20',
  ask: ASK,
  status: 'choose',
  still: 'none',
  screen: 'loading',
  research: [
    {
      pattern: 'משחקים נתנו לשחקן משהו לעשות בידיים בזמן שהמשחק נטען (Ridge Racer – משחק Galaxian קטן בזמן הטעינה). ההמתנה נהיית זמן שלך, לא זמן מת. מכאן חפיסת הכרטיסים שמדפדפים בה.',
      from: 'Namco – משחקים קטנים במסכי טעינה (הפטנט פג ב־2015)',
      url: 'https://www.pcgamer.com/loading-screen-jam-celebrates-the-end-of-namcos-dumb-minigame-patent',
    },
    {
      pattern: 'בזמן ההמתנה למשחק, משהו קטן לשחק בו בכף היד – במסך של השלט. מכאן: הדבר שמחכה לאגודל הוא חלק מהמסך, לא כפתור נוסף.',
      from: 'Splatoon (Wii U) – Squid Jump בלובי',
      url: 'https://www.nintendolife.com/news/2015/05/play_8-bit_retro_squid_games_while_you_wait_for_an_online_match_in_splatoon',
    },
    {
      pattern:
        'גלילה, והאנימציות שקשורות אליה (scroll-driven, של transform ו־opacity), רצות מחוץ ל־thread הראשי של הדף. לכן החפיסה ממשיכה לענות לאצבע גם כשהמשחק תקוע שניות בבניית הבית – כל דבר אחר שנוגעים בו היה מחכה.',
      from: 'Chrome for Developers – Scroll-driven animations',
      url: 'https://developer.chrome.com/blog/scroll-animation-performance-case-study',
    },
    {
      pattern: 'כל מסך טעינה הוא כרטיס: ציור גדול ושורה אחת של טיפ שמתאימה לו. מכאן כרטיס לכל דבר במשחק – תמונה, מילה, שורה.',
      from: 'Cookie Run: Kingdom – מסכי הטעינה',
      url: 'https://cookierun.wiki/w/Loading_Screens_(Kingdom)',
    },
    {
      pattern: 'בהמתנה ארוכה – שלבים שנעשו ושנשארו, כשאי אפשר לדעת בדיוק כמה זמן נשאר. מכאן הפס שחתוך לשלושה, חלק לכל שלב אמיתי.',
      from: 'Nielsen Norman Group: Progress Indicators',
      url: 'https://www.nngroup.com/articles/progress-indicators/',
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
      name: 'ספר החווה בכף היד',
      note:
        'במקום תמונה להסתכל עליה – חפיסת כרטיסים גדולים מתחת לאגודל, שמדפדפים בה בהחלקה: כל כרטיס הוא דבר אחד במשחק – ציור גדול, מילה ושורה (הקונים בשער, המחסן והאסם, התנור, המתנות, הפסטיבל של יום רביעי…). ' +
        'ההחלקה עובדת גם כשהמשחק תקוע בבניית הבית, כי הדפדפן גולל בעצמו. מתחת – שורה אחת ופס שחתוך לשלושה, חלק לכל שלב אמיתי (חווה, בית, מנורות), שלא נראה מלא לפני שהוא באמת מלא.',
      motion:
        'נכנס: החפיסה מחליקה מימין, הפס עולה מלמטה. בהחלקה: הכרטיס שבאמצע גדל ומתיישר, השכנים קטנים ונוטים, והציור בכל כרטיס נכנס בעומק (parallax); הנקודה שמתחת זזה עם האצבע. בלי נגיעה – כרטיס חדש מתחלף מעצמו כל כמה שניות. ' +
        'גם כשהמשחק תקוע: ההחלקה, ההטיה והציורים, הקפיצה של כל ציור, האור שרץ על החלק הנוכחי של הפס והמילוי שלו ממשיכים – הכל transform/opacity מחוץ ל־thread הראשי. רק ההחלפה האוטומטית מחכה. ' +
        'כשמוכן: שלושת החלקים נצבעים בירוק משמאל לימין, וי קופץ בסוף הפס, קונפטי אחד. נגיעה – לתפריט.',
      adds: 'שחקן חוזר: הכרטיס הראשון בחפיסה הוא מה שמחכה בחווה – תמונות עם כמויות (נתונים לדוגמה)',
      render: (s, act) => <LoadingAlmanacA s={s} onPlay={act.close} />,
    },
  ],
}
