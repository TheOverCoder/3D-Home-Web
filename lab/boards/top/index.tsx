import { xpAt } from '../../../src/farm/xp'
import type { Board } from '../../board'
import { atHour, type TopState } from './parts'
import { TopToday } from './TopToday'
import { TopA } from './TopA'
import { TopB } from './TopB'
import { TopC } from './TopC'

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

export const topBoard: Board<TopState> = {
  id: 'top',
  title: 'החלק העליון של המסך',
  ask: 'החלק העליון לוקח רבע מהמסך לאורך: שורה אחת קטנה, המטבעות במרכז, הרמה מראה כמה נשאר ומה מקבלים, מצפן קריא, וכפתורים עם משמעות ברורה.',
  status: 'choose',
  still: 'yard',
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
    { id: 'mid-compass', name: 'אמצע המשחק, תצוגת "רק המצפן"', data: { ...mid, hud: 'compass' } },
    { id: 'attention-compass', name: 'צריך אותך, תצוגת "רק המצפן"', data: { ...attention, hud: 'compass' } },
  ],
  variants: [
    {
      id: 'today',
      name: 'היום',
      note: 'תמונה של המשחק היום (החלק העליון קורא את החווה, אז אי אפשר לצייר אותו לבד כאן). לאורך: שלוש שורות של שבבים ועוד המצפן.',
      motion: 'שבב קופץ כשהמספר שלו גדל, והפס של ה־XP מתמלא כשהגבישים נוחתים.',
      render: (s) => <TopToday s={s} />,
    },
    {
      id: 'a',
      name: 'שורה אחת ומגירה',
      note:
        'שורה אחת: המטבעות (הכי גדולים), הרמה עם פס שכתוב עליו כמה XP ובסופו מה הרמה הבאה נותנת, ובפינה השעה. המצפן מתחתיה. ' +
        'כל השאר — התור, הממגורה, האסם, המטרות, והתפריט עם מילים (עריכה, הגדרות, מה רואים למעלה) — במגירה אחת שנפתחת מהשעה. נקודה על השעה אומרת שמשהו שם מחכה לך.',
      motion:
        'השבבים קופצים אחד אחרי השני משמאל לימין, הפס מתמלא והמספר רץ, והנקודה קופצת אחרונה. מכירה: המטבעות עפים בקשת, כל אחד שנוחת מועך את המטבע, המספר עולה, ו"+24" עולה ונעלם. ' +
        'המגירה נופלת מהשעה עם קפיץ, השורות נכנסות אחת אחרי השנייה, והפסים מתמלאים. החלקה למעלה סוגרת.',
      render: (s, act) => <TopA s={s} set={act.set} />,
    },
    {
      id: 'b',
      name: 'רק מה שצריך אותך',
      note:
        'למעלה רק לוח אחד: המטבעות והרמה. השעה בלב המצפן, במקום המעלות. מה שצריך אותך (ממגורה מלאה, תור מלא, מטרות) מופיע מתחת למצפן כשלט עם מילים, ורק אז. ' +
        'כפתור "Farm" אחד עם מילה פותח רשת של אריחים: כל המספרים של החווה והתפריט.',
      motion:
        'הלוח יורד מלמעלה, ואחריו המצפן נפתח מהאמצע לצדדים. שלט חדש נופל עם קפיץ ומתנדנד פעם אחת. מכירה: המטבעות עפים, והמטבע של הלוח מסתובב כשהאחרון נוחת. ' +
        'האריחים נפתחים מהכפתור בגל. שלט אפשר להעיף הצידה.',
      render: (s, act) => <TopB s={s} set={act.set} />,
    },
    {
      id: 'c',
      name: 'לוח מחוונים',
      note:
        'הכל על המסך, אבל כתמונות קטנות: המצפן באמצע, ומשני צדדיו כנפיים — משמאל הממגורה והאסם שמתמלאים כמו מיכל, מימין התור והמטרות. ' +
        'הרמה היא דרך קצרה מהכוכב שלך לרמה הבאה ולפרס שלה, וכתוב כמה XP נשאר. בפינה תפריט שנפתח לכפתורים עם שמות.',
      motion:
        'המצפן נפתח ראשון, הכנפיים יוצאות מאחוריו, והמיכלים מתמלאים עם גל קטן. הדרך מתמלאת עם נקודה זוהרת. מכירה: המטבעות עפים, השבב קופץ ואור עובר עליו. ' +
        'מחסן שמתמלא רועד פעם אחת ונצבע אדום. נגיעה במחוון פותחת בועה עם המספר המדויק.',
      render: (s, act) => <TopC s={s} set={act.set} />,
    },
  ],
}
