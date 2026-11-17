import type { Board } from '../../board'
import { STATES, type ShopState } from './data'
import { ShopAnimalsB } from './ShopAnimalsB'
import { ShopAnimalsToday } from './ShopAnimalsToday'

// The farm shop's animal section (plans/animal-tools.md §3: ShopPanel leaves FarmUI.tsx for src/farm/shop/, with
// upgradesView() and ShopCard.tsx): per kind its herd row (bought at once, as today, with Part B's lock), its tool —
// locked until the herd is full — and its two ladders, then the two premium remotes; a tool, a step or a remote opens
// the game's ladder card first. The farm's rows and numbers are the game's (UPGRADES, UNLOCKS); the tools, ladders and
// remotes are SAMPLE DATA (../animal-tools/sample.ts, the plan's TOOL) until the game has them. Buying works: coins go,
// rows change, a tool bought opens its ladders.

const ASK =
  'בחנות יהיה אזור נפרד לחיות. כשקונים את כל השדרוגים של סוג חיה (6 תרנגולות, 3 פרות, 4 כבשים) נפתח לו כלי. לכל כלי שני שדרוגים, כל שלב יקר יותר: כמה כל מקום מחזיק (3 עד 10) וכמה כל הקשה לוקחת (1 עד 10). ' +
  'כל החיות זהות במספרים. ובסוף – שני שלטי פרימיום, 10,000 מטבעות כל אחד.'

const ADDS = 'אזור החיות בחנות: לכל חיה – עוד חיה, הכלי שלה (נפתח כשהעדר מלא) ושני השדרוגים שלו; ואחריהם שני שלטי הפרימיום.'

export const shopAnimalsBoard: Board<ShopState> = {
  id: 'shop-animals',
  title: 'החנות: אזור החיות',
  kind: 'ui',
  added: '2026-11-17T06:30',
  ask: ASK,
  status: 'choose',
  still: 'yard-clean',
  spot: 'action',
  screen: 'shop',
  devices: ['upright', 'sideways', 'desktop'],
  research: [
    {
      pattern: 'חנות בלשוניות לפי סוג (זרעים, עצים, חיות, קישוטים, מבנים): במבט רואים איפה מה, ולא גוללים רשימה אחת ארוכה. (A)',
      from: 'FarmVille – ה־Market עם שש לשוניות',
      url: 'https://farmvillepals.blogspot.com/2013/04/general-store-update.html',
    },
    {
      pattern: 'מה שעוד נעול עומד בחנות במקומו, דהוי, עם מה שחסר כדי לפתוח ("4/6 hens") – כך החנות היא גם "מה מחכה לי". והכלי שנפתח זוהר פעם אחת.',
      from: 'Hay Day – החנות ותפריט הבנייה (נעול לפי רמה)',
      url: 'https://supercell.com/en/games/hayday/',
    },
    {
      pattern: 'דרך של תחנות עם הפרס הבא מואר: רואים מה כבר נקנה, מה הבא, ומה אחריו – מטרה קרובה במקום רשימה. (B)',
      from: 'Bandura & Schunk 1981, Proximal sub-goals; lab/CRAFT.md – Progress with the next reward in view',
    },
    {
      pattern: 'מדף של כרטיסים גדולים שגוללים הצידה, והבא מציץ מהקצה – אומר "יש עוד" בלי מילה. (C)',
      from: 'App Store – מדפים אופקיים; Apple Human Interface Guidelines – Collections',
      url: 'https://developer.apple.com/design/human-interface-guidelines/collections',
    },
  ],
  states: [
    { id: 'locked', name: 'הכלים נעולים: 4/6 תרנגולות, 2/3 פרות, 2/4 כבשים (רמה 7)', data: STATES.locked },
    { id: 'sale', name: 'הלול ודלי החלב למכירה: העדרים מלאים (רמה 8)', data: STATES.sale },
    { id: 'owned', name: 'הלול והדלי שלך, השדרוגים שלהם פתוחים; המספריים למכירה', data: STATES.owned },
  ],
  variants: [
    {
      id: 'today',
      name: 'היום',
      note:
        'החנות כמו במשחק: רשימה אחת של כל השדרוגים בסדר של הטבלה – השדות, התור, עוד פרה/כבשה/תרנגולת, ממטרות וקומפוסט – לכל אחד תמונה, רמה, "עכשיו ← אחרי" ומחיר על הכפתור, שקונה מיד. ' +
        'אין כלים ואין שלטים; מה שנעול לפי רמה עוד לא מסומן (מחכה ללוח "מה נפתח ברמה").',
      motion: 'החלון עולה; לחיצה על מחיר קונה, והשורה קופצת.',
      render: (s, act) => <ShopAnimalsToday s={s} act={act} />,
    },
    {
      id: 'b',
      name: 'רצועה לכל חיה: עדר ← כלי ← שדרוגים',
      note:
        'רשימה אחת, החיות ראשונות. כל חיה היא דרך של ארבע תחנות – עוד חיה, הכלי, "מחזיק יותר", "יותר בהקשה" – וקו ביניהן שמתמלא בירוק כשקונים. ' +
        'התחנה הבאה לקנייה זוהרת בצהוב; מה שעוד רחוק אפור עם המנעול והסיבה. אחריהן שורות החווה (מה שלך בסוף) ושני השלטים. שלושה כפתורים בראש קופצים לכל חלק.',
      motion: 'התחנה הבאה "נושמת" בטבעת צהובה. נגיעה בה: שוקעת וקופצת, הקו מתמלא עד אליה, והטבעת עוברת לתחנה שאחריה. נעולה: רעידה והמנעול קופץ. הכפתורים למעלה גוללים בעדינות לחלק.',
      adds: ADDS,
      render: (s, act) => <ShopAnimalsB s={s} act={act} />,
    },
  ],
}
