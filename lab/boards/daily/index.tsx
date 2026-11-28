import { cameBackTo, claimed, dailyFresh, dailyView, dayNumber, rollClaim, type Daily, type WeekClock } from '../../../src/farm/daily'
import { DailyCard } from '../../../src/farm/DailyCard'
import type { ProduceId } from '../../../src/farm/data'
import { art } from '../../../src/ui/art'
import type { Act, Board } from '../../board'

// The daily gift (src/farm/DailyCard.tsx, its rules src/farm/daily.ts): a gift for each day played, the season's week of
// seven that grow (it waits through any absence), the days played in the title. Built straight into the game at the user's request (no
// round of proposals first), so the board shows it as built: "today" only, live. Its states are the game's own records
// (dailyView of a Daily), made by its pure code (claimed, rollDay); a gift claimed here rolls on dice of the lab's own.

/** A state of the card: the farm's record, the week's clock (the day played today is, the day its seasons began, the
 *  calendar day) and the moment of it (the clock to the next gift counts down from there), its level, the goods it has
 *  made. */
export interface DailyState {
  daily: Daily
  clock: WeekClock
  now: number
  level: number
  made: ProduceId[]
}

/** The lab's dice (the same gift every time for the same day). */
const dice = (seed: number) => () => {
  const x = Math.sin(seed++ * 12.9898) * 43758.5453
  return x - Math.floor(x)
}
const MADE: ProduceId[] = ['lettuce', 'egg', 'flour', 'tomato']
/** A day of the calendar (mid-November 2026) and the days round it; the moment of it the board stands at (late in the
 *  afternoon: 7 h 17 min to the next gift). */
const NOW = new Date(2026, 10, 16, 16, 42, 30).getTime()
const DAY = dayNumber(NOW)

/** The week's clock on day played `played` of a farm whose seasons began on its first, `last` that day's calendar day. */
const on = (played: number, today = DAY): WeekClock => ({ played, from: 1, today })

/** A record claimed on days played 1 to `n` (each a calendar day after the last), the last of them on `today`. */
function run(n: number, level: number, today = DAY - 1): Daily {
  let d = dailyFresh()
  for (let k = 1; k <= n; k++) {
    const c = on(k, today - n + k)
    d = claimed(d, c, rollClaim(d, c, level, MADE, dice(k))!)!
  }
  return d
}

/** What the game's claimDaily does (src/farm/state/daily.ts), on the lab's dice: today's gift rolled and the record
 *  moved on. */
const claim = (s: DailyState, act: Act<DailyState>) => () => {
  const got = rollClaim(s.daily, s.clock, s.level, s.made, dice(s.clock.played))
  if (!got) return null
  act.set({ ...s, daily: claimed(s.daily, s.clock, got)! })
  return [...got.owed.flatMap((o) => o.prizes), ...got.today, ...got.back]
}

/** The coin of the chip at the top of the still, where the game's coins land (an unseen stand-in where the still draws
 *  it: lab/boards/level/board.css). */
const ChipCoin = () => (
  <span className="farm-chip-item coins lab-chip-coin" aria-hidden="true">
    <img src={art('coin')} alt="" />
  </span>
)

export const dailyBoard: Board<DailyState> = {
  id: 'daily',
  title: 'המתנה היומית',
  kind: 'ui',
  added: '2026-11-16T12:30',
  done: { round: '2026-11-16T12:30', what: 'נבנה במשחק: מתנה שנפתחת באמת, שעון דיגיטלי עד המתנה הבאה, ואנימציות ברורות' },
  ask:
    'מתנה יומית עם רצף ימים, בעיצוב הכי גבוה שאפשר, בנויה ישר לתוך המשחק כך שתעבוד: פעם ביום (לפי היום בלוח השנה של המכשיר), בפעם הראשונה שפותחים את החווה באותו יום – בחלון משלה, ' +
    'אחרי תפריט הפתיחה, ואף פעם לא מעל סרט, נסיעה או "ברוך שובך" (בתור אחריהם); וגם מכניסה ברורה עד שלוקחים אותה. רצף של ימים ברצף, שבוע של 7 מתנות שגדלות (ביום 7 – גדולה), ' +
    'שורה של 7 קופסאות: של היום זוהרת, שעברו מסומנות, הבאות מציצות. כפתור Claim אחד גדול ותחושת פרס אמיתית: הקופסה נפתחת, הפרס עף לצ׳יפ שלו, קונפטי ורטט.',
  status: 'live',
  round:
    'נבנה ישר לתוך המשחק, כמו שביקשת. ' +
    'השבוע הוא שבוע העונה, בימי משחק: הוא מחכה כמה שלא תיעדר, ויום 7 – המתנה הגדולה – הוא היום האחרון של העונה. יום ששיחקת בו ולא לקחת – המתנה שלו מצטרפת לבאה; חזרת אחרי יומיים או יותר – מתנת "ברוך שובך" קטנה וקבועה. ' +
    'השבוע: מטבעות, חומר בנייה, יותר מטבעות, סחורה מהחווה, עוד מטבעות, עוד חומרים – וביום 7 המתנה הגדולה: מטבעות, חומר וסחורה יחד. הכמויות לפי הרמה, בקובייה של החווה, בלי XP. ' +
    'נפתחת לבד פעם ביום, רגע אחרי שהחווה מופיעה (בחווה או בבית), בחווה שכבר שתלה משהו (בדקות הראשונות של חווה חדשה – לומדים לשחק). נסגרה בלי לקחת – מחכה בתפריט בפינה: מתנה קטנה על הכפתור ושורה ראשונה "Daily gift". ' +
    'שעון שהוחזר אחורה לא נותן כלום עד שעובר שוב את היום האחרון; יום שמתחלף בזמן משחק – המתנה של היום החדש.',
  still: 'yard',
  spot: 'settings',
  screen: 'daily',
  research: [
    {
      pattern: 'חותמת אחת ליום, ובשביעית קופסה גדולה – והחותמות לא נמחקות כשמפספסים יום. מכאן השבוע של שבע תחנות עם הגדולה בסוף, ושום דבר שכבר קיבלת לא נלקח.',
      from: 'Pokémon GO – Research Breakthrough',
      url: 'https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/105-daily-bonuses/',
    },
    {
      pattern: 'רצף סלחני: יום אחד שהוחמץ לא מוחק את הרצף. דואולינגו מצאו שכשהרצף סולח – יותר אנשים חוזרים, ופחות נוטשים אחרי שבירה. מכאן "הרצף שלך חיכה".',
      from: 'Duolingo – Streak Freeze',
      url: 'https://blog.duolingo.com/duolingo-streak-research/',
    },
    {
      pattern: 'פס של שבעה ימים: היום מודגש, מה שעבר מסומן, הבאים מציצים, והאחרון גדול – הפרס הבא תמיד בעין. כאן הפס הוא דרך שמתמלאת עד היום.',
      from: 'פרסי כניסה יומיים במשחקי מובייל (Unity Daily Rewards)',
      url: 'https://docs.unity.com/en-us/services/solutions/daily-rewards.md',
    },
    {
      pattern: 'אותו רגע פרס כמו בקופסאות של הרמה: רעד → פיצוץ עם אור וקונפטי → הפרס גדול עם שמו → עף לצ׳יפ שלו. ובסוף, הצצה למחר – הביקור נגמר בשיא ובציפייה (כלל השיא והסוף).',
      from: 'חלון הרמה (F) · Kahneman, Fredrickson et al. 1993',
    },
  ],
  states: [
    { id: 'mid', name: 'אמצע השבוע: שלושה ימי משחק, היום יום 4 (סחורה)', data: { daily: run(3, 6), clock: on(4), now: NOW, level: 6, made: MADE } },
    { id: 'first', name: 'המתנה הראשונה אי פעם: יום 1', data: { daily: dailyFresh(), clock: on(1), now: NOW, level: 2, made: [] } },
    { id: 'owed', name: 'שיחקת אתמול ולא לקחת: המתנה של אתמול מחכה עם של היום (יום 5)', data: { daily: run(3, 6, DAY - 2), clock: on(5), now: NOW, level: 6, made: MADE } },
    { id: 'big', name: 'יום 7: המתנה הגדולה, היום האחרון של העונה', data: { daily: run(6, 12), clock: on(7), now: NOW, level: 12, made: MADE } },
    { id: 'back', name: 'חזרת אחרי שלושה ימים: השבוע חיכה, ומתנת "ברוך שובך"', data: { daily: cameBackTo(run(4, 8, DAY - 4), 4), clock: on(5), now: NOW, level: 8, made: MADE } },
    { id: 'taken', name: 'כבר נלקחה היום: ביום המשחק הבא יום 6', data: { daily: run(5, 6, DAY), clock: on(5), now: NOW, level: 6, made: MADE } },
  ],
  variants: [
    {
      id: 'today',
      name: 'במשחק',
      note:
        'בכותרת לוח שנה, "Daily gift" ולהבה חיה עם הרצף. הגיבור – המתנה של היום על במה של אור: קופסה עם מכסה משלה, ועל המכסה תווית שמראה מה בפנים היום (כמה מטבעות, חומר בנייה, סחורה מהחווה; בגדולה – שלושתם), ' +
        'והיום בשבוע על סרט. מתחת – השבוע כדרך של שבע תחנות: מה שנלקח מסומן ב־✓ עם מה שנתן, של היום זוהרת, הבאות מציצות, והשביעית גדולה עם כתר. נגיעה בתחנה – בועה שאומרת מה יש בה (או מה נתנה). ' +
        'כפתור צהוב אחד – Claim, ושורה אחת. אחרי שלוקחים – מחר על הבמה: הקופסה שלו, מה יביא, ושעון דיגיטלי קטן שסופר לאחור עד שהמתנה הבאה נפתחת (בחצות של המכשיר).',
      motion:
        'הגיליון עולה, הקופסה נופלת לבמה ומדי פעם קופצת (מתכווצת, נמתחת, נוחתת) – והמכסה מתרומם כשהיא נוחתת, כך שהאור מבפנים מציץ. הכפתור מנצנץ מדי פעם. ' +
        'Claim: רטט קטן, הקופסה רועדת והמכסה קופץ, האור מתאסף; היא נפתחת – הבזק, קונפטי, צליל ורטט: המכסה עף עם התווית, קרן אור עולה מהקופסה, הפרס עולה מתוכה עם שמו והקופסה הריקה שוקעת. ' +
        'אחרי רגע הפרס עף הביתה (מטבעות לצ׳יפ שסופר אותם כשהם נוחתים, סחורה למחסן) – ורק אז הדרך לוקחת אותו: התחנה של היום מקבלת חותמת עם מה שנתנה, הקו רץ אליה והלהבה סופרת את הרצף. ' +
        'הבמה עוברת למחר והשעון רץ: הספרות מתגלגלות, הנקודתיים מהבהבים, ובדקה האחרונה הוא אדום והקופסה לא יכולה לחכות; נגמר הזמן כשהכרטיס פתוח – המתנה של היום החדש נופלת לבמה. ' +
        'פחות תנועה: בלי קפיצות ובלי מעוף – הפרס, ואז מחר והשעון. Done, גרירה למטה או נגיעה בחוץ – סוגרים.',
      render: (s, act) => (
        <>
          <ChipCoin />
          <DailyCard v={dailyView(s.daily, s.clock, s.level, s.made, s.now)} onClaim={claim(s, act)} onClose={act.close} />
        </>
      ),
    },
  ],
}
