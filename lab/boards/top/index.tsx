import { xpAt } from '../../../src/farm/xp'
import type { Board } from '../../board'
import { atHour, type TopState } from './parts'
import { TopToday } from './TopToday'
import { TopC, type Pinned } from './TopC'

// The top of the screen in play (src/farm/FarmUI.tsx FarmChip, XpChip, DayChip; src/ui/Compass.tsx, HudMode.tsx,
// TopStack.tsx): the coins, the level and its XP, the line at the gate, the silo and the barn, the goals, the farm's
// hour, the compass, and the corner buttons. Its states are the farm's own numbers, put through the game's pure code
// (levelView, storeCapacity, queuePlaces, the day's clock) by ./parts.tsx; "today" is a picture of the game's screen
// (the game's top reads the farm, so it cannot be drawn alone).

/** Early: three lettuce beds planted (6 coins of seeds) and watered, one harvested — the first minutes of a farm. */
const early: TopState = {
  coins: 14,
  xp: 8,
  paid: 1,
  line: { n: 0, level: 0 },
  silo: { n: 4, level: 1 },
  barn: { n: 0, level: 1 },
  goals: 0,
  t: atHour(10 + 1 / 3),
  heading: 154,
  marks: [{ item: 'lettuce', count: 8, deg: 118 }],
  hud: 'all',
}

/** Mid game: level 7 reached and not yet claimed (its 70 coins wait), the silo once made bigger, two goals reached,
 *  three buyers in line, and three things ready elsewhere. */
const mid: TopState = {
  coins: 1240,
  xp: xpAt(7) + 37,
  paid: 6,
  line: { n: 3, level: 1 },
  silo: { n: 38, level: 2 },
  barn: { n: 21, level: 1 },
  goals: 2,
  t: atHour(13.5),
  heading: 154,
  marks: [
    { item: 'lettuce', count: 12, deg: 122 },
    { item: 'egg', count: 6, deg: 178 },
    { item: 'milk', count: 3, deg: 212 },
  ],
  hud: 'all',
}

/** Things that need you: the silo full (8 lettuces wait in their beds for room, its mark on the compass ringed red),
 *  every place in the line taken, the evening; level 10 (and its garment) close. */
const attention: TopState = {
  coins: 860,
  xp: xpAt(9) + 96,
  paid: 9,
  line: { n: 6, level: 1 },
  silo: { n: 100, level: 2 },
  barn: { n: 33, level: 1 },
  goals: 0,
  t: atHour(18 + 1 / 3),
  heading: 40,
  marks: [
    { item: 'silo', count: 8, deg: 8, alert: true },
    { item: 'lemon', count: 8, deg: 78 },
    { item: 'wool', count: 4, deg: 230 },
  ],
  hud: 'all',
}

/** SAMPLE (variant D): the goal pinned on the goals board (its E), as the goals' own numbers have it mid game. */
const PINNED: Pinned = { art: 'shopping-bags', words: 'Sell 60 goods', have: 44, target: 60, per: 8 }

export const topBoard: Board<TopState> = {
  id: 'top',
  title: 'החלק העליון של המסך',
  kind: 'ui',
  added: '2026-11-16T10:20',
  done: { round: '2026-11-16T10:20', what: 'נבנה במשחק: לוח המחוונים D בראש המסך' },
  ask: 'החלק העליון לוקח רבע מהמסך לאורך: שורה אחת קטנה, המטבעות במרכז, הרמה מראה כמה נשאר ומה מקבלים, מצפן קריא, וכפתורים עם משמעות ברורה.',
  status: 'live',
  chosen: 'd',
  round:
    'במשחק עכשיו: D נבנה לתוך המשחק, ו"היום" הוא תמונה של המשחק החדש. ' +
    'מה נכנס: לוח המחוונים כולו – המטבעות (סופרים כשהמטבעות נוחתים, קפיצה וברק), דרך הרמה עם רבעים, חלק אחרון חם והפרס בסוף, הממגורה והאסם כמיכלים (אדום ו־Full כשמלא, רעידה אחת), התור והמטרות עם הספירה, בועה עם המספר המדויק ו־Open, המצפן באמצע עם האותיות והשעה מתחתיו, והתפריט בפינה עם שמות (עריכה, תצוגת הראש, הגדרות). ' +
    'מה לא נכנס: המטרה הננעצת (✦) – היא צריכה את הנעיצה בלוח המטרות, שעוד לא נבחר (ביקשת עוד סיבוב שם). ' +
    'שינויים קטנים כי זה משחק אמיתי: לבועה של התור אין Open (משרתים את הקונים בשער, לא מרחוק); מסך לרוחב צר מדי לשורה אחת מקבל שתי שורות כמו לאורך, כדי שהמצפן לא יימעך; בתצוגה "נקי" יש עכשיו גם כפתור צילום (ביקשת)',
  still: 'yard-clean',
  spot: 'coins',
  screen: 'top',
  research: [
    {
      pattern: 'הרמה היא תג עם המספר, וצמוד אליו פס שכתוב עליו כמה XP יש מתוך כמה — המספר על הפס עצמו, לא בחלון אחר. המשאבים בצד השני, כל אחד עם מילוי שמראה כמה המחסן מלא.',
      from: 'Clash of Clans',
      url: 'https://supercell.com/en/games/clashofclans/',
    },
    {
      pattern: 'רק המטבעות והרמה תמיד למעלה. הממגורה והאסם לא על המסך בכלל — הם מופיעים רק כשהם מתמלאים ("הממגורה מלאה"). פחות על המסך, ומה שצריך אותך קופץ.',
      from: 'Hay Day',
      url: 'https://supercell.com/en/games/hayday/',
    },
    {
      pattern: 'השעה, היום והכסף הם גוש אחד קטן בפינה — "מתי" ו"כמה" נקראים במבט אחד, והשעה תמיד כתובה במספרים.',
      from: 'Stardew Valley (טלפון)',
      url: 'https://www.stardewvalley.net/',
    },
    {
      pattern: 'כפתור אחד (הטלפון) פותח רשת של אפליקציות, לכל אחת תמונה ומילה — במקום הרבה כפתורים עגולים בלי שם על המסך.',
      from: 'Animal Crossing: New Horizons',
      url: 'https://www.animal-crossing.com/new-horizons/',
    },
    {
      pattern: 'מצפן בפס עליון: מעט מספרים, האותיות גדולות, הכיוון שאתה מסתכל באמצע, וסימנים עם תמונה על הפס במקום שהם נמצאים.',
      from: 'Fortnite',
      url: 'https://www.fortnite.com/',
    },
  ],
  states: [
    { id: 'early', name: 'תחילת המשחק: מעט דברים', data: early },
    { id: 'mid', name: 'אמצע המשחק: מטבעות של רמה מחכים, 2 מטרות, 3 סימנים במצפן', data: mid },
    { id: 'attention', name: 'צריך אותך: הממגורה מלאה, התור מלא', data: attention },
    { id: 'near', name: 'כמעט רמה: הפס ברבע האחרון', data: { ...early, coins: 312, xp: xpAt(5) + 66, paid: 5, goals: 1, line: { n: 2, level: 0 }, silo: { n: 31, level: 1 } } },
    { id: 'mid-compass', name: 'אמצע המשחק, תצוגת "רק המצפן"', data: { ...mid, hud: 'compass' } },
    { id: 'attention-compass', name: 'צריך אותך, תצוגת "רק המצפן"', data: { ...attention, hud: 'compass' } },
  ],
  variants: [
    {
      id: 'today',
      name: 'היום',
      note: 'תמונה של המשחק עכשיו, אחרי ש־D נכנס (החלק העליון קורא את החווה, אז אי אפשר לצייר אותו לבד כאן). בתצוגת "רק המצפן": המצפן והשעה, והתפריט בפינה.',
      motion: 'כמו ב־D: המצפן נפתח מהאמצע, הכנפיים יוצאות מאחוריו והמיכלים מתמלאים; המטבעות סופרים כשהם נוחתים; הפס מתמלא כשהגבישים נוחתים והכוכב פועם.',
      render: (s) => <TopToday s={s} />,
    },
    {
      id: 'd',
      name: 'לוח מחוונים + המטרה הננעצת (נבחר, במשחק בלי הנעיצה)',
      note:
        'הכל על המסך, אבל כתמונות קטנות: המצפן באמצע, ומשני צדדיו כנפיים — משמאל הממגורה והאסם שמתמלאים כמו מיכל, מימין התור והמטרות. ' +
        'הרמה היא דרך קצרה מהכוכב שלך לרמה הבאה ולפרס שלה, וכתוב כמה XP נשאר. בפינה תפריט שנפתח לכפתורים עם שמות. ' +
        'ומתחת למצפן – במקום שלו בעמודה של ראש המסך – המטרה שננעצה בלוח המטרות: התמונה, המילים, פס שמתמלא והמספר. ' +
        'כך רואים את ההתקדמות תוך כדי משחק. כשהיא מושגת היא נהיית ירוקה וכתוב Claim!; נגיעה פותחת את לוח המטרות. בתצוגות "רק המצפן" ו"נקי" היא מוסתרת.',
      motion:
        'המצפן נפתח ראשון, הכנפיים יוצאות מאחוריו, והמיכלים מתמלאים עם גל קטן. הדרך מתמלאת עם נקודה זוהרת. מחסן שמתמלא רועד פעם אחת ונצבע אדום. נגיעה במחוון פותחת בועה עם המספר המדויק. ' +
        'המטרה הננעצת נכנסת מלמעלה אחרי המחוונים. כל מכירה (נגיעה ב"+24" באמצע המסך): המטבעות עפים לצ׳יפ, הפס של המטרה קופץ ו"+8" עולה ממנו; בהגעה למטרה – קפיצה קטנה והיא נצבעת ירוק.',
      adds: 'המטרה שננעצה בלוח המטרות מופיעה בראש המסך, מתחת למצפן, ומתקדמת עם כל מה שעושים – בלי לפתוח את הלוח.',
      render: (s, act) => <TopC s={s} set={act.set} pinned={PINNED} />,
    },
  ],
}
