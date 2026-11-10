# quickwork

> **מה זה:** רשימה של דברים מוכנים — ספריות, ריפוזיטוריז, חבילות נכסים וכלים — שחוסכים זמן פיתוח אמיתי **לפרויקט הזה**, עם מה כל אחד נותן, איפה הוא נכנס בקוד, כמה מאמץ ומה הסיכון.
> נכון ל־2026-11-10. הפרויקט: `3D-Home-Web` (Vite 8.3, React 19.3, three 0.186, R3F 9.8, drei 10.7, rapier 2.2, ecctrl 2.0, zustand 5.0).
> **איך אומת:** גרסה, תאריך, רישיון ו־peerDependencies — מה־npm registry ישירות; כוכבים — מעמוד ה־GitHub; רישיונות של ריפוזיטוריז ונכסים — מקובץ ה־LICENSE עצמו ב־GitHub; התנהגות של מה שכבר מותקן — מהקבצים ב־`node_modules` שלנו. אתרים שחסומים מהסביבה הזאת (kenney.nl, ‏quaternius.com, ‏polyhaven.com, ‏ambientcg.com, ‏poly.pizza, ‏freesound.org, ‏itch.io, ‏webkit.org) נבדקו דרך מנוע חיפוש בלבד, ומסומנים כך בטבלאות. מה שלא אומת מסומן **[UNVERIFIED]**.

## TL;DR — עשרת הדברים שחוסכים הכי הרבה זמן

| # | מה | למה (לפרויקט הזה) | מאמץ | עדיפות |
|---|---|---|---|---|
| 1 | **Vitest** לכללי החווה ולבדיקות המודלים | היום כל בדיקה עוברת דרך e2e של 25–35 דקות; `canPlace`, מחירים, `load()` ו־`checks.ts` הם לוגיקה טהורה שתרוץ בשניות בכל שמירה | חצי יום | P1 |
| 2 | **פיצול ה־e2e ב־CI** (`--shard` + ‏`merge-reports`, כבר ב־Playwright שלנו) ו־`--last-failed`/‏`--only-changed` מקומית | כל push מחכה בערך רבע מהזמן; אחרי תיקון מריצים רק את מה שנכשל | חצי שעה | P1 |
| 3 | **leva** (כבר מותקן) תחת `?debug`/`?gallery` | כוונון חי של פרמטרי פיסול, אור, אפקטים וזמני גידול — בלי מחזור עריכה–בנייה–רענון | שעה | P1 |
| 4 | **KayKit Furniture/Restaurant/Prototype Bits** (CC0, ב־GitHub) | קטלוג שלם למצב העיצוב, נגיש מ־`assets:fetch` גם מסביבת הענן; טקסטורת אטלס אחת שמתכווצת ל־128² | יום | P1 |
| 5 | **Paraglide JS** + גופן עברי (Rubik / ‏M PLUS Rounded 1c) + ‏RTL של troika | תרגום מוקלד — מחרוזת חסרה נתפסת ב־`tsc`; ‏Nunito חסר עברית היום | 2–4 ימים (רובם חילוץ מחרוזות) | P1 (כשמתחילים עברית) |
| 6 | **web app manifest** + ‏`@vite-pwa/assets-generator` | התקנה למסך הבית במסך מלא; לפי מדיניות WebKit (מקור משני), מגן על החווה מפני מחיקה אחרי 7 ימי שימוש ב־Safari בלי ביקור | שעה | P1 |
| 7 | **HDR → gain map JPEG** (gainmap-js כבר מותקן, ‏drei תומך) | ‏`home.hdr` הוא 1.5MB מההורדה הראשונה בטלפון; לפי תיעוד drei, gain map הוא הפורמט עם "the smallest footprint" | 1–2 שעות | P1 |
| 8 | **drei שכבר מותקן**: `<Bvh>`, ‏`<Outlines>` (גם על instanced), ‏`<Detailed>` | raycast מהיר והדגשת הנבחר למצב העיצוב ול־edit mode בלי לכתוב אותם | דקות–שעות | P1/P2 |
| 9 | **wawa-vfx** (חלקיקים ב־GPU ל־R3F 9) | "מיץ" לקטיף, מטבעות, השקיה ובנייה בלי לכתוב מערכת חלקיקים | שעות | P2 |
| 10 | **@three.ez/instanced-mesh** בתוך `Parts` | culling ו־LOD לכל מופע לכל העדרים והגינה כשהאדמה גדלה — בלי לגעת במודלים | 1–2 ימים | P2 |

**מפתיע:** (1) ‏`vendor-physics` (Rapier) שוקל 2.2MB ב־`dist` (לפני gzip) — הקובץ הגדול ביותר בבנייה, יותר מ־three ו־R3F יחד. (2) ‏Nunito, גופן הגוף והמספרים, **לא כולל עברית**. (3) ‏drei טוען את מפענחי Draco ו־KTX2 מ־CDN כברירת מחדל, ו־`gltfjsx --transform` דוחס ב־Draco — שילוב ששובר אופליין בשקט. (4) ‏r3f-perf, כלי הביצועים ה"סטנדרטי", עדיין תלוי ב־drei 9. (5) לא נמצא משחק חווה בקוד פתוח על three/R3F; המקור הכי שימושי לעולם חי (יום/עונות/מזג אוויר/רוח בעשב) הוא folio-2025 של Bruno Simon (MIT, אבל WebGPU/TSL).

## 1. ספריות שמביאות מערכות שלמות

**מקרא.** גרסה/תאריך = הגרסה האחרונה ב־npm registry ותאריך פרסומה (נבדק 2026-11-10). כוכבים = כפי שמוצגים בעמוד ה־GitHub (מעוגלים כשהעמוד מעגל).
עדיפות: **P1** = לאמץ עכשיו (חוסך זמן כבר בשבועות הקרובים, מאמץ קטן); **P2** = כשמגיעים לפיצ'ר שהוא משרת; **P3** = רק אם צורך מסוים יתעורר / ללמידה.
"כבר מותקן" = נמצא היום ב־`node_modules` כתלות של drei/ecctrl, כך שאימוץ לא מוסיף הורדה חדשה (רק מה שנכנס לבאנדל בפועל).

### 1א. ניווט, תנועת דמויות ובינה ל־NPC

היום: הקונים הולכים על מסלול נקודות קבוע לאורך הדרך (`walk`/`moveTo` ב־`src/farm/state.ts`), בלי navmesh — וזה מספיק כל עוד הם לא נכנסים לחווה. ברגע שמישהו צריך ללכת *בתוך* החווה (קונה שנכנס לדוכן, עוזר, חיות שמסתובבות במתחם שהוזז ב־edit mode) צריך מציאת דרך סביב המקומות הזזים.

| שם + קישור | רישיון | גרסה / תאריך | מה זה מביא מוכן | איך זה חוסך לנו זמן | מאמץ, סיכונים | עדיפות |
|---|---|---|---|---|---|---|
| [navcat](https://github.com/isaac-mason/navcat) | MIT | 0.4.1 / 2026-05-06 (canary 2026-11-06), ‏301★ | בניית navmesh מגאומטריה, חיפוש מסלול, raycast על ה־navmesh, ו־`navcat/blocks`: סימולציית קהל, היגוי והתחמקות ממכשולים. JavaScript טהור, **בלי WASM**; עזרים ל־three ב־`navcat/three`; peer ‏`three>=0.180` | כשקונים/עוזרים ייכנסו לחווה: navmesh נבנה מחדש מהמלבנים של `layout.ts` אחרי כל שינוי ב־edit mode, והקהל בתור לא נדחס אחד לתוך השני — במקום לכתוב A* + היגוי + התחמקות בעצמנו (שבוע+) | 1–2 ימים. ספרייה צעירה (0.x, API עוד זז). בלי קובץ WASM — עדיף לטלפון על פני recast | P3 |
| [recast-navigation-js](https://github.com/isaac-mason/recast-navigation-js) | MIT | 0.44.0 / 2026-10-30, ‏436★ | Recast/Detour (התקן בתעשייה) ב־WASM: navmesh, ‏DetourCrowd, מכשולים דינמיים (TileCache), עזרים ל־three ב־`@recast-navigation/three` | אותו צורך כמו navcat, עם מנוע בוגר ומוכח; מכשולים זזים בלי לבנות הכול מחדש | חבילת ה־WASM ‏≈1.9MB לא דחוסה ב־npm — כבד לטלפון ולהורדה הראשונה; לבחור רק אם navcat לא יספיק | P3 |
| [ngraph.path](https://github.com/anvaka/ngraph.path) | MIT | 1.6.1 / 2025-11-18 | A* / NBA* מהיר על גרף כללי | החווה כבר על רשת של חצי מטר (`snap` ב־`layout.ts`) עם מלבנים (`BLOCKERS`, footprints): A* על הרשת הזאת הוא הפתרון הזול ביותר לחיות/עוזרים | שעות. (A* של 60 שורות משלנו הוא חלופה שקולה) | P3 |
| [Yuka](https://github.com/Mugen87/yuka) | MIT | 0.7.8 / 2022-09-17, ‏~1.5k★ | התנהגויות היגוי (arrive, wander, separation, obstacle avoidance, path following), ‏FSM, סוכנים מבוססי מטרות, תפיסה וזיכרון | פרות/כבשים שמשוטטות בטבעיות במכלאה בלי להיכנס זו בזו; קונים שמאטים יפה כשמגיעים למקום בתור | לא שוחרר מאז 2022 (אבל עצמאי, בלי תלות ב־three). עדיף להעתיק את האלגוריתמים הספציפיים (MIT) מאשר להוסיף תלות | P3 (כמקור) |

### 1ב. מצב משחק, ECS ומכונות מצבים

היום: החווה היא אובייקט רגיל שמתעדכן כל פריים + `useFarm` שמקפיץ revision לממשק, ו־zustand לממשק. זה עובד טוב — **לא להגר**. מה שכדאי זה הכלים שכבר בתוך zustand.

| שם + קישור | רישיון | גרסה / תאריך | מה זה מביא מוכן | איך זה חוסך לנו זמן | מאמץ, סיכונים | עדיפות |
|---|---|---|---|---|---|---|
| [zustand middlewares](https://github.com/pmndrs/zustand) — `devtools`, `subscribeWithSelector`, `persist` | MIT | 5.1.0 / 2026-11-06 (אצלנו 5.0.15; ה־middlewares נמצאים כבר ב־`node_modules/zustand/middleware`) | `devtools`: כל פעולה בחנות נראית ב־Redux DevTools עם מסע בזמן; `subscribeWithSelector`: מאזינים לשינוי שדה אחד מחוץ ל־React; `persist` + `createJSONStorage`: שמירה עם `version` ו־`migrate` | דיבוג של `useHome`/`useFarm` בלי `console.log`; צלילים/מצפן שמגיבים לשינוי בלי רינדור; מנגנון גרסה+מיגרציה מוכן לשמירות כשהמבנה ישתנה (מצב העיצוב יוסיף רהיטים לשמירה) | דקות. אפס תלות חדשה. `devtools` רק תחת `?debug` | P2 |
| [koota](https://github.com/pmndrs/koota) | ISC | 0.6.6 / 2026-04-09, ‏769★ | ECS של pmndrs עם hooks ל־React ‏(`useQuery`, `useTrait`, `useActions`…) | אם מצב העיצוב יהפוך לעולם של מאות פריטים עם תכונות (ממוקם, בבעלות, בחדר X, דולק): שאילתות מוכנות במקום מערכים ידניים | מיגרציה יקרה; 0.x. לשקול רק לעולם הרהיטים החדש, לא לחווה הקיימת | P3 |
| [XState v5](https://github.com/statelyai/xstate) + `@xstate/react` | MIT | 5.33.4 / 2026-11-07; ‏`@xstate/react` 6.1.0 (React 19 ✓), ‏~30.4k★ | מכונות מצבים עם guards, טיימרים ושחקנים (actors), ועורך ויזואלי (Stately) | הדרכה ראשונה וקווסטים ("שתול → השקה → קטוף → מכור") כמכונה אחת שנבדקת ביחידה, במקום דגלים מפוזרים; מתאים גם להתנהגות קונה (מגיע → בתור → מגיב → הולך) | לא לבנות על זה את כל המשחק; רק לזרימות רב־שלביות. כדאי לבדוק משקל בבאנדל לפני אימוץ | P3 |

### 1ג. אנימציה, מעברים וקפיצים

היום: `MathUtils.damp` בעשרות מקומות (126 מופעים של damp/lerp/ease ב־`src`) ואנימציות CSS בממשק. זה עובד; הספריות כאן חוסכות קוד בעיקר ב"מיץ" (juice) ובמעברי מצלמה.

| שם + קישור | רישיון | גרסה / תאריך | מה זה מביא מוכן | איך זה חוסך לנו זמן | מאמץ, סיכונים | עדיפות |
|---|---|---|---|---|---|---|
| [maath](https://github.com/pmndrs/maath) | MIT | 0.10.8 / 2024-07-07, ‏~1.3k★ — **כבר מותקן** (תלות של drei) | `easing.damp3/dampE/dampQ/dampC/dampLookAt` — SmoothDamp קריטי־מרוסן (כמו ב־Unity) עם `smoothTime` ו־`maxSpeed`, לווקטורים, סיבובים, קווטרניונים וצבעים; גם `random` ו־`buffer` | מעוף המצלמה ל־edit mode וחזרה, "קפיצה" של יבול לסל, סיבוב רהיט בהנחה — שורה אחת במקום שלוש קריאות `damp` לכל ציר | דקות; להוסיף כתלות ישירה כדי לנעול גרסה (drei יכולה להחליף) | P2 |
| [@react-spring/three](https://github.com/pmndrs/react-spring) | MIT | 10.1.2 / 2026-06-24 (React 19 ✓, ‏R3F ≥6) | קפיצים פיזיקליים (overshoot, bounce) כ־props מונפשים על אובייקטים | "מיץ": אובייקט שנקנה נוחת ומקפץ, דלת שנפתחת עם מעט bounce | עוד ספרייה (core+animated+shared); רוב המקרים מכוסים ב־maath | P3 |
| [Motion](https://github.com/motiondivision/motion) (לשעבר Framer Motion) | MIT | 14.11.1 / 2026-11-09 (React 18/19 ✓) | אנימציות פריסה (layout) ויציאה (`AnimatePresence`) לרכיבי DOM, מחוות גרירה | שורת הקונים בפאנל שמתקצרת בתנועה, צ'יפים שנכנסים/יוצאים, sheet שנגרר בטלפון | משקל באנדל ניכר יחסית ל־CSS הקיים; רק אם ה־UI יגדל מאוד | P3 |

### 1ד. ביצועים: instancing, ‏LOD, ‏batching, ‏BVH

היום: כל חלק של מודל מפוסל הוא draw אחד מסוג `InstancedMesh` לכל העדר (`Parts` ב־`src/lib/sculpt/parts.ts`), והגאומטריה הסטטית ממוזגת (`src/lib/batch.ts`). מה שחסר כשהאדמה גדלה (אחו צפון/מזרח/מערב, יער): **culling לכל מופע** (היום `Parts` מחשב bounding sphere לכל ה־`InstancedMesh`, כך שעדר נחתך רק כשכולו מחוץ למסך; כל עוד פרה אחת נראית, כולן מצוירות), ‏LOD, ו־raycast מהיר למצב העיצוב.

| שם + קישור | רישיון | גרסה / תאריך | מה זה מביא מוכן | איך זה חוסך לנו זמן | מאמץ, סיכונים | עדיפות |
|---|---|---|---|---|---|---|
| **drei — מה שכבר מותקן ולא בשימוש**: [`<Bvh>`](https://github.com/pmndrs/drei/blob/master/docs/performances/bvh.mdx), [`<Detailed>`](https://github.com/pmndrs/drei/blob/master/docs/performances/detailed.mdx), [`<Outlines>`](https://github.com/pmndrs/drei/blob/master/docs/abstractions/outlines.mdx), [`<AdaptiveDpr>`](https://github.com/pmndrs/drei/blob/master/docs/performances/adaptive-dpr.mdx), [`<BakeShadows>`](https://github.com/pmndrs/drei/blob/master/docs/performances/bake-shadows.mdx), `useKTX2`, `<StatsGl>` | MIT | drei 10.7.9 / 2026-09-25 (המותקנת אצלנו) | `Bvh`: עוטף תת־עץ ומחליף את ה־raycast במואץ (three-mesh-bvh 0.8, כבר מותקן); `Detailed`: ‏LOD לפי מרחק; `Outlines`: קו מתאר inverted-hull — **תומך ב־`instancedMesh`**; `AdaptiveDpr`: מוריד pixel ratio בזמן תנועה | מצב העיצוב צריך raycast לרצפה/קירות/רהיטים — שורה אחת; הדגשת הפריט/המקום שנבחר ב־edit mode בלי post-processing נוסף (זול לטלפון); ‏LOD לעצים ביער המתרחב | דקות–שעות לכל אחד. `Outlines` מוסיף draw לכל רשת מודגשת (רק לנבחר) | P1 (`Bvh`, `Outlines` במצב העיצוב) / P2 (השאר) |
| [@three.ez/instanced-mesh](https://github.com/three-ez/instanced-mesh) | MIT | 0.3.16 / 2026-07-26, ‏481★ | `InstancedMesh2`: ‏frustum culling לכל מופע, ‏BVH דינמי ל־raycast ול־culling, ‏LOD ו־shadow LOD, מיון (שקיפות/overdraw), נראות ושקיפות לכל מופע, uniforms לכל מופע | החלפת ה־`InstancedMesh` בתוך `Parts` בלבד ⇒ כל העדרים, הגינה והקונים מקבלים culling ו־LOD בלי לגעת במודלים; צל זול יותר (shadow LOD) — הצל הוא המעבר הכבד ביותר אצלנו | 1–2 ימים כולל בדיקות `12-models`/`05-budget`. ‏0.x (יש 1.0.0-beta); דוגמאות R3F רק מהקהילה | P2 |
| [@three.ez/batched-mesh-extensions](https://github.com/agargaro/batched-mesh-extensions) | MIT | 0.0.12 / 2026-06-23, ‏142★ | הרחבות ל־`BatchedMesh` של three: ‏BVH ל־culling ו־raycast, ‏LOD, ‏uniforms לכל מופע (WebGL בלבד) | כל המודלים המפוסלים חולקים חומר אחד (`sculptMaterial`) — כלומר אפשר תיאורטית לצייר רהיטים/חפצים שונים ב־draw אחד ב־BatchedMesh; רלוונטי אם מצב העיצוב יתקרב לתקרת 700 ה־draw calls | ניסיוני (0.0.x). רק אם הספירה ב־`05-budget` תתחיל לטפס | P3 |
| [detect-gpu](https://github.com/pmndrs/detect-gpu) | MIT | 5.0.70 / 2025-02-23, ‏~1.2k★ — **כבר מותקן** (תלות של drei) | `getGPUTier()`: דרגה 0–3 לפי טבלאות ביצועים אמיתיות של מעבדים גרפיים, ‏`isMobile`, שם ה־GPU, והערכת fps (כשיש נתוני benchmark) | דרגת ההתחלה של Auto (`startQuality` ב־`profile.ts`) לפי נתונים במקום לפי ניחוש — פחות שניות ראשונות במשחק בדרגה הלא נכונה עד שה־governor מתקן | שעות. ברירת המחדל מורידה את הטבלאות מ־unpkg — להעתיק את `dist/benchmarks` (16 קבצי JSON) ולהעביר `benchmarksURL` מקומי | P3 |
| [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) (ישירות) | MIT | 0.9.18 / 2026-11-03, ‏~3.6k★ (drei מושכת ^0.8.3) | `shapecast`, ‏`intersectsBox/Sphere`, ‏raycast מואץ גם ל־`BatchedMesh` | בדיקת "האם הרהיט נכנס כאן" (חפיפה עם קירות/רהיטים אחרים) במצב העיצוב בלי מנוע פיזיקה; גם בדיקת ה־"ray parity" ב־`04-physics` | גרסה 0.9 ליד 0.8 של drei = שני עותקים בבאנדל; עדיף להתחיל ב־`<Bvh>` של drei | P2 |

### 1ה. שמיים, צמחייה, חלקיקים ואפקטים

היום: `<Sky>` של drei, ‏HDR של Poly Haven, עשב מטקסטורה פרוצדורלית, עשן ארובה וניצוצות בעבודת יד, שרשרת post-processing מלאה (N8AO, ‏DOF, ‏bloom, ‏AgX).

| שם + קישור | רישיון | גרסה / תאריך | מה זה מביא מוכן | איך זה חוסך לנו זמן | מאמץ, סיכונים | עדיפות |
|---|---|---|---|---|---|---|
| [wawa-vfx](https://github.com/wass08/wawa-vfx) | MIT | 1.2.10 / 2025-09-23, ‏155★ | מנוע חלקיקים ב־GPU עם instancing ל־R3F (billboard, ‏mesh, ‏stretched billboard), וגרסת vanilla (`wawa-vfx-vanilla`) | "מיץ" בלי לכתוב מערכת חלקיקים: התפרצות כשקוטפים, מטבעות שעפים לצ'יפ, ריסוס מהמשפך/ממתזים, אבק כשבונים ערוגה או מזיזים מקום | שעות. ה־peers ‏(R3F ^9, ‏zustand ^5, ‏leva ^0.10 — לא מסומן אופציונלי) כבר אצלנו; לספור draw calls ב־`05-budget` אחרי ההוספה | P2 |
| [three.quarks](https://github.com/Alchemist0823/three.quarks) + `quarks.r3f` | MIT | 0.17.1 / 2026-05-21, ‏~1.2k★ | חלקיקים עם **רינדור מקובץ** (כמה מערכות ב־draw אחד), צורות פליטה, התנהגויות, trails, ‏עורך ויזואלי עם ייצוא JSON | אם יהיו הרבה סוגי אפקטים (מזג אוויר, עונות): מעצבים בעורך במקום בקוד, ונשארים בתקציב ה־draw calls | כבד יותר (≈1.2MB לא דחוס); peer ‏`three>=0.182` ✓ | P3 |
| drei `<Sparkles>`, `<Cloud>/<Clouds>`, `<Float>`, `<Sky>` (כבר מותקן) | MIT | drei 10.7.9 | ניצוצות מרחפים, עננים מ־billboards, ריחוף | ניצוץ על ערוגה בשלה/פריט נדיר; עננים נעים מעל החווה; מחזור יום־לילה פשוט = הזזת `sunPosition` של `<Sky>` + עקומת צבע לאור — בלי ספרייה | שעות. עננים = overdraw: רק מ־Medium ומעלה ב־`profile.ts` | P2 |

### 1ו. סאונד

היום: הכול מסונתז ב־WebAudio (`src/audio/sound.ts`, ‏`music.ts`) — אפס הורדות, וזו החלטה טובה לטלפון. הספריות כאן נבחרו כך שלא ישברו אותה.

| שם + קישור | רישיון | גרסה / תאריך | מה זה מביא מוכן | איך זה חוסך לנו זמן | מאמץ, סיכונים | עדיפות |
|---|---|---|---|---|---|---|
| [ZzFX](https://github.com/KilledByAPixel/ZzFX) + [המעצב](https://killedbyapixel.github.io/ZzFX) | MIT | 1.4.0 / 2026-10-01, ‏811★ | סינתסייזר אפקטים זעיר ("פחות מקילובייט דחוס") + עורך בדפדפן שמוציא שורת פרמטרים | אפקט חדש (פופ של קטיף, מטבע, "לא אפשרי", תקתוק טיימר) מעוצב בדקה בעורך והופך לשורת מספרים בקוד — במקום לכוונן אוסצילטורים ידנית. נשאר "בלי הורדות" | שעות. לנתב לאותו `sfx` gain כדי לשמור על עוצמה והגדרות | P2 |
| `navigator.audioSession.type` (Audio Session API, דפדפן — לא ספרייה) | — | Safari/iOS 17+; [explainer של W3C](https://github.com/w3c/audio-session/blob/main/explainer.md) | `'ambient'` מתערבב עם מוזיקה של אפליקציות אחרות; `'playback'` לא מתערבב | לפי שרשורי באגים של WebKit (נמצאו בחיפוש, לא בעמוד רשמי): בברירת המחדל מתג השקט של האייפון משתיק את כל ה־WebAudio — כלומר אצלנו את *כל* הסאונד והמוזיקה. שורה אחת ב־`unlockAudio` מכריעה את זה | דקות. החלטת מוצר: `playback` משמיע גם במצב שקט אבל עוצר את המוזיקה של השחקן | P2 |
| [howler.js](https://github.com/goldfire/howler.js) | MIT | 2.2.4 / 2023-09-19, ‏~25.4k★ | sprites של סאונד, מיקום מרחבי, פתיחת אודיו במגע ראשון, נפילה ל־HTML5 Audio, ‏"7kb gzipped" | רק אם נעבור להקלטות אמיתיות (געיית פרה מוקלטת, מוזיקה מקובץ): sprite אחד לכל האפקטים ונגינה אמינה במובייל | המנוע שלנו כבר עושה unlock ומיקום; לא שוחרר מאז 2023. טעינת `AudioBuffer` לבד היא ~20 שורות | P3 |
| [Tone.js](https://github.com/Tonejs/Tone.js) | MIT | 15.1.22 / 2025-04-27 | Transport (שעון מוזיקלי), סינתים, אפקטים (reverb, ‏delay), דגימות | מוזיקה גנרטיבית עשירה יותר מ־`music.ts` בלי לכתוב scheduler ואפקטים | כבד (חבילה של ~5MB לא דחוסה) — יעלה את ההורדה הראשונה; לשקול רק אם המוזיקה תהיה פיצ'ר מרכזי | P3 |

### 1ז. קלט, מחוות, גרירה במרחב ומצלמה

היום: מחוות כתובות ידנית (`TouchControls`, צביטה וגרירה ב־`EditMode.tsx`), ‏`CameraControlsImpl` של drei כבר בשימוש. **מצב העיצוב (קנייה והזזה של רהיטים) נחקר בנפרד** — כאן רק ההפניות.

| שם + קישור | רישיון | גרסה / תאריך | מה זה מביא מוכן | איך זה חוסך לנו זמן | מאמץ, סיכונים | עדיפות |
|---|---|---|---|---|---|---|
| [@use-gesture/react](https://github.com/pmndrs/use-gesture) | MIT | 10.3.1 / 2024-03-21, ‏~9.6k★ — **כבר מותקן** (תלות של drei) | drag/pinch/wheel/move מאוחדים לעכבר ומגע, עם מהירות, כיוון, סף ו־rubberband | גרירה, סיבוב בשתי אצבעות וצביטה לרהיט במצב העיצוב בטלפון — בלי לכתוב שוב את ההנדסה של `EditMode.tsx` | דקות–שעות. להוסיף כתלות ישירה | P2 |
| drei [`DragControls`](https://github.com/pmndrs/drei/blob/master/docs/gizmos/drag-controls.mdx), [`PivotControls`](https://github.com/pmndrs/drei/blob/master/docs/gizmos/pivot-controls.mdx), `TransformControls` (כבר מותקן) | MIT | drei 10.7.9 | גרירה עם נעילת צירים וגבולות; ידיות הזזה/סיבוב | אב־טיפוס של מצב העיצוב ביום אחד | ידיות קטנות מדי לאצבע — לטלפון עדיף ידית גדולה משלנו (44px) | P2 (ראו מחקר העיצוב) |
| [@react-three/handle](https://github.com/pmndrs/xr/tree/main/packages/react/handle) | MIT | 6.6.32 / 2026-10-13 | ידיות הזזה/סיבוב/קנה מידה שעובדות עם עכבר, מגע ו־XR; `HandleTarget` | גרירת רהיט וסיבובו במגע | הדוגמה הרשמית מחליפה את מערכת האירועים של R3F (`events={noEvents}` + `<PointerEvents/>`) — סיכון התנגשות עם `interaction.ts` ועם המחוות הקיימות | P3 |
| [camera-controls](https://github.com/yomotsu/camera-controls) | MIT | 3.1.2 / 2025-11-17, ‏~2.5k★ — **כבר מותקן** | truck/dolly/rotate עם מגע, גבולות, `fitToBox`, מעברים חלקים | מצלמת "מבט מלמעלה" למצב העיצוב בתוך הבית (`fitToBox` על החדר) | כבר בשימוש — פשוט לנצל עוד | P2 |

### 1ח. שמירות, התקנה כאפליקציה (PWA) ואחסון

היום: שלוש משבצות ב־localStorage עם ייצוא/ייבוא לקובץ וניקוי (`src/farm/state.ts`), ‏`navigator.storage.persist()`, ‏service worker משלנו שנבדק ב־`11-startup`. **חסר: web app manifest** — אין אפשרות להתקין למסך הבית כמשחק מסך מלא.

| שם + קישור | רישיון | גרסה / תאריך | מה זה מביא מוכן | איך זה חוסך לנו זמן | מאמץ, סיכונים | עדיפות |
|---|---|---|---|---|---|---|
| [@vite-pwa/assets-generator](https://github.com/vite-pwa/assets-generator) (CLI) + manifest שנכתב ביד | MIT | 2.0.0 / 2026-09-12, ‏168★ | פקודה אחת מתמונת מקור אחת (יש לנו `public/favicon.svg`); ה־preset ‏`minimal2023Preset` מייצר PNG ‏64/192/512, ‏`favicon.ico`, אייקון maskable ‏512 ואייקון Apple ‏180 (נבדק בקוד ה־preset) | משחק שמותקן למסך הבית: מסך מלא בלי שורת כתובת (יותר מקום לשליטה, פחות "משיכה לרענון" מקרית). לפי מדיניות WebKit מ־2020 (מקור משני): אתר שלא נפתח 7 ימי שימוש ב־Safari מאבד את ה־localStorage — **החווה נמחקת**; אפליקציה ממסך הבית סופרת ימים בנפרד | שעה. לא נוגעים ב־service worker שלנו. להוסיף בדיקה ב־`11-startup` שה־manifest נטען | **P1** |
| [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa) | MIT | 2.0.0 / 2026-10-03 (peer ‏`vite ^8` ✓), ‏~4.3k★ | Workbox, יצירת manifest, הודעת "גרסה חדשה" ל־React | — | היה חוסך שבוע לפני שכתבנו SW; היום יחליף קוד בדוק (`vite.config.ts`, ‏`sw.ts`) — לא חוסך | נדחה (ראו §6) |
| [idb-keyval](https://github.com/jakearchibald/idb-keyval) | Apache-2.0 | 6.3.0 / 2026-07-08, ‏~3.3k★ | get/set על IndexedDB ב־~573 בתים (brotli) | אם השמירה תגדל (רהיטים, היסטוריה, צילומי מסך של החווה כתמונת משבצת): בלי מגבלת ~5MB ובלי חסימת ה־main thread של localStorage | שמירה אסינכרונית ⇒ לשנות את `saveNow` ב־`pagehide` (סינכרוני היום). כרגע אין צורך | P3 |
| [Valibot](https://github.com/open-circle/valibot) | MIT | 1.5.0 / 2026-09-09 | סכמות מודולריות (tree-shaking לכל פונקציה), ‏`parse` עם ברירות מחדל, טיפוסים מוסקים | `load()` ב־`state.ts` הוא ~70 שורות ניקוי ידני; סכמה אחת = טיפוס + אימות ייבוא קובץ + ברירות מחדל לשדות חדשים במצב העיצוב | שעות; לכתוב רק לשדות חדשים, לא להחליף את מה שעובד | P3 |
| [lz-string](https://github.com/pieroxy/lz-string) | MIT | 1.5.0 / 2023-03-04 | דחיסה ל־base64 בטוח ל־URL | "קוד חווה" להעתקה בין טלפון למחשב (בלי קובץ) או קישור שמשתף חווה | יציב, לא מתעדכן — אין בעיה | P3 |

### 1ט. עברית: תרגום, ‏RTL וגופנים

היום: כל הטקסט באנגלית בתוך הקוד (תוויות ב־`useInteractable`, ‏`count()` לרבים ב־`src/farm/data.ts`, טקסט על canvas בבועות הקונים ב־`Visitors.tsx`, ‏`<Text>` של drei במסכי הקיר). **Fredoka כבר כולל עברית; Nunito לא** (נבדק בקבצים המותקנים: ל־Nunito יש רק latin/latin-ext/cyrillic/vietnamese) — כלומר טקסט ומספרים בעברית ייפלו היום לגופן מערכת.

| שם + קישור | רישיון | גרסה / תאריך | מה זה מביא מוכן | איך זה חוסך לנו זמן | מאמץ, סיכונים | עדיפות |
|---|---|---|---|---|---|---|
| [Paraglide JS](https://github.com/opral/paraglide-js) (`@inlang/paraglide-js`) | MIT | 3.2.1 / 2026-11-07, ‏804★ | קומפיילר שהופך הודעות לפונקציות ESM מוקלדות (`m.harvest_beds({ count })`), ‏tree-shaking של תרגומים שלא בשימוש, תוסף Vite, בלי Provider; רבים דרך `Intl.PluralRules` ווריאנטים | תרגום חסר = שגיאת `tsc` (ה־CI כבר מריץ `tsc`), אין מפתחות מחרוזת שנשברים בשקט, ומשקל זניח בטלפון. העבודה האמיתית — חילוץ המחרוזות — זהה בכל ספרייה; הספרייה חוסכת את בניית מנגנון הרבים/משתנים/טיפוסים | חילוץ: 2–4 ימים לכל הממשק. מוסיף שלב קומפילציה וקבצים מחוללים | **P1** (אם עברית בתוכנית) |
| [i18next](https://github.com/i18next/i18next) + [react-i18next](https://github.com/i18next/react-i18next) | MIT | 27.1.0 / 2026-11-09; ‏18.0.1 / 2026-11-08 (‏peer ‏`typescript ^5‖^6‖^7` ✓), ‏~8.7k★ / ~10.1k★ | הסטנדרט: JSON בזמן ריצה, רבים לפי CLDR, ‏`i18next.dir(lng)` שמחזיר `'rtl'` לעברית (נבדק בקוד המקור), אינטגרציה לשירותי תרגום | אם יגיעו מתרגמים חיצוניים/שפות נוספות — כל כלי תרגום מכיר את הפורמט | runtime כבד יותר ומפתחות כמחרוזות (טיפוסים דרך declaration merging) | P2 (חלופה) |
| גופן גוף עברי מ־[Fontsource](https://github.com/fontsource/font-files): ‏`@fontsource-variable/rubik` או `@fontsource/m-plus-rounded-1c` | OFL-1.1 | 5.3.0 / 2026-07-19 | Rubik: עברית, משקלים 300–900 (משתנה); ‏M PLUS Rounded 1c: עברית, מעוגל כמו Nunito, 100–900; גם Varela Round (עברית, משקל אחד), Heebo, Assistant (מטא־דאטה של Fontsource ב־GitHub) | אותה שיטה כמו היום (`@fontsource-variable`, אחסון עצמי): קובץ העברית יורד רק כשמופיעה עברית (`unicode-range`), ‏Nunito נשאר לאנגלית ולספרות | דקות. לבדוק את הספרות: Nunito נבחר כי כל הספרות ברוחב אחד — לוודא `font-variant-numeric: tabular-nums` בגופן העברי | **P1** (עם התרגום) |
| [troika-three-text](https://github.com/protectwise/troika/tree/main/packages/troika-three-text) (מאחורי `<Text>` של drei) | MIT | 0.53.1 / 2026-11-02, ‏~2.0k★ (troika) — **כבר מותקן** (0.52.5) | פריסה דו־כיוונית (bidi) ו־RTL, ‏prop ‏`direction` ‏(`auto/ltr/rtl`), טעינת גופני fallback אוטומטית | מסכי הקיר וההולוגרמות מציגים עברית נכון בלי עבודה | ה־fallback האוטומטי נטען מ־CDN כברירת מחדל (`unicodeFontsUrl` מאפשר אחסון עצמי) — לתת קובץ גופן עברי מקומי כדי שיעבוד גם אופליין (ה־SW שלנו) | P1 (עם התרגום) |
| בלי ספרייה: `dir="rtl"`, ‏CSS logical properties, ‏`Intl.PluralRules('he')`, ‏`Intl.NumberFormat`, ‏`ctx.direction = 'rtl'` ב־canvas | — | מובנה בדפדפן | — | ההיפוך של הממשק (צ'יפים, כרטיסים, חצים) ב־CSS בלבד; בועות הקונים (canvas) מקבלות כיוון | חשוב להחליט מה **לא** מתהפך: הג'ויסטיק נשאר משמאל וכפתור הפעולה מימין (אגודלים), המצפן מראה כיוונים אמיתיים | P1 (עם התרגום) |

### 1י. מערכות משחק: דיאלוג, הדרכה, קווסטים

היום: המצפן (`ready()` על כל interactable), ‏`GuideMarker`, טוסטים, כרטיס אישור — יש בסיס טוב. מה שעוד אין: הדרכה מסודרת לשחקן חדש ודיאלוגים.

| שם + קישור | רישיון | גרסה / תאריך | מה זה מביא מוכן | איך זה חוסך לנו זמן | מאמץ, סיכונים | עדיפות |
|---|---|---|---|---|---|---|
| [inkjs](https://github.com/y-lohse/inkjs) (Ink של inkle) | MIT | 2.4.0 / 2026-02-17, ‏664★ | runtime לשפת Ink: דיאלוג מסתעף, משתנים, תנאים; כותבים בעורך Inky; טיפוסי TS כלולים; הקומפיילר בנפרד (`inkjs/full`) | אם לקונים/שכנים יהיו שיחות ובקשות ("תביא לי 3 עוגות עד הערב"): הכותב עובד בקובץ טקסט ולא בקוד | לטעון רק את ה־runtime (לא את הקומפיילר); לחבר לבועות ולפאנלים שלנו | P3 |
| [driver.js](https://github.com/nilbuild/driver.js) | MIT | 1.11.0 / 2026-11-08, ‏~27k★ | הדגשת אלמנט DOM + popover + סיור צעד־אחר־צעד, "~5kb gzipped" | סיור ראשון על ה־HUD (צ'יפ המטבעות, ⚙, ‏✥, המצפן) בלי לבנות מערכת; הצעדים בעולם (לך לערוגה) נשארים אצל `GuideMarker` | שעות; לעצב לפי `.paper`/`.btn`; לבדוק על מסך 390px | P3 |
| [react-joyride](https://github.com/gilbarbara/react-joyride) | MIT | 3.2.0 / 2026-07-09 (peer React ‏16.8–19 ✓) | סיורים כרכיב React עם מצב שליטה | אותו צורך כמו driver.js, בתוך React | כבד יותר מ־driver.js | P3 |

### 1יא. בקר דמות ופיזיקה

היום: ecctrl 2 על Rapier. הקובץ הגדול ביותר בבנייה הוא `vendor-physics` — ‏**2.2MB** ב־`dist/assets` לפני gzip (Rapier בגרסת `rapier3d-compat`, עם ה־WASM בתוך ה־JS), יותר מ־`vendor-three` ‏(0.75MB) ומ־`vendor-r3f` ‏(R3F, ‏drei, ‏postprocessing ועוד — 0.8MB) יחד.

| שם + קישור | רישיון | גרסה / תאריך | מה זה מביא מוכן | איך זה חוסך לנו זמן | מאמץ, סיכונים | עדיפות |
|---|---|---|---|---|---|---|
| [BVHEcctrl](https://github.com/pmndrs/BVHEcctrl) (`bvhecctrl`) | MIT | 0.0.18 / 2025-08-14, ‏141★ | בקר דמות ל־R3F **בלי מנוע פיזיקה**: התנגשות עם three-mesh-bvh, קפסולה על מדרגות ושיפועים, מתנגשים סטטיים/קינמטיים/instanced, ג'ויסטיק וכפתורים לנייד | אם נחליט שהפיזיקה המלאה לא שווה 2.2MB בטלפון: הליכה, קפיצה והתנגשות בלי Rapier. מאותו מחבר כמו ecctrl, אז ה־API מוכר | **לא מחליף** את מה ש־Rapier נותן היום (חפצים שנדחפים ונופלים, `04-physics`). ‏0.0.x; תלוי ב־three-mesh-bvh ^0.9 (עותק שני ליד 0.8 של drei). לבדוק כניסוי בענף בלבד | P3 |


## 2. ריפוזיטוריז, תבניות ומשחקי קוד פתוח ללמידה ולשימוש חוזר

שורה תחתונה: **לא נמצא משחק חווה בקוד פתוח על three.js/R3F** שאפשר לקחת ממנו מערכות שלמות (חיפשתי ב־GitHub ובפורום three.js; הקרוב ביותר הם פרויקטי game-jam). מה שכן קיים — ושווה זמן — הם מקורות למערכות הספציפיות: מחזור יום/עונה/מזג אוויר, רוח על צמחייה, צינור דחיסת נכסים, הצבה על רשת.

| שם + קישור | רישיון | מצב | מה יש שם | איך זה חוסך לנו זמן | הסתייגויות | עדיפות |
|---|---|---|---|---|---|---|
| [brunosimon/folio-2025](https://github.com/brunosimon/folio-2025) | MIT (`license.md`) | ‏~2.0k★; ‏three ^0.187, ‏Rapier ^0.19, ‏Vite ^8 | עולם פתוח שלם בדפדפן: מחזורי יום ושנה (`DayCycles`, `YearCycles`), מזג אוויר (גשם, שלג, ברקים, ערפל), רוח שמזיזה **עשב וצמחייה**, משטח מים, סאונד, התראות; ובנוסף צינור Blender → glTF-Transform + KTX2 ‏(etc1s) | המקור הטוב ביותר ל"שכבת העולם החי" שחסרה לחווה: איך רוח אחת מניעה עשב, עלים וחלקיקים; איך מזג אוויר נגזר משעה ועונה; סקריפט `compress` שלם לנכסים | כתוב ב־`three/webgpu` + ‏TSL ‏(`WebGPURenderer`) — אנחנו על `WebGLRenderer` + postprocessing של pmndrs, אז מעבירים לוגיקה ו־shaders ידנית ל־GLSL. ה־MIT חל על הקוד; את המודלים והסאונד שלו לא לקחת בלי לשאול | P2 (מקור) |
| [three.js examples](https://github.com/mrdoob/three.js/tree/r186/examples) (r186) | MIT | תואם בדיוק לגרסה שלנו | `webgl_instancing_scatter` (פיזור צמחים על משטח עם `MeshSurfaceSampler`), `webgl_batch_lod_bvh`, `webgl_loader_gltf_progressive_lod`, `webgl_instancing_raycast`, `webgl_shaders_sky`, `games_fps` (התנגשות קפסולה עם Octree), `physics_rapier_instancing` | פרחי בר/עשב גבוה על האחו החדש, ‏LOD מתקדם, raycast על instances — קוד רשמי שעובד עם three 0.186 כמו שהוא | דוגמאות, לא ספרייה: מעתיקים ומתאימים | P2 (מקור) |
| [isaac-mason/sketches](https://github.com/isaac-mason/sketches) | MIT | ‏344★ | סקיצות רבות של גרפיקה, פיזיקה, ‏game AI ואינטראקציה, מהמחבר של navcat ו־recast-navigation-js (ובעל זכויות היוצרים ב־LICENSE של maath) | דוגמה עובדת לכל אחת מספריות ה־P3 שלמעלה (navmesh, קהל, ECS) לפני שמחליטים לאמץ | סקיצות, לא ספרייה; גרסאות משתנות בין סקיצות | P3 |
| [instructa/viber3d](https://github.com/instructa/viber3d) | MIT | ‏631★ | תבנית למשחק דפדפן: React 19, ‏R3F, ‏drei, ‏Vite, ‏zustand, ‏**koota (ECS)**, ‏Rapier, ‏TypeScript | איך נראה משחק R3F שבנוי על koota — אם נשקול ECS לעולם הרהיטים | לא תבנית להגר אליה; הפרויקט שלנו בשל ממנה | P3 |
| [KenneyNL/Starter-Kit-City-Builder](https://github.com/KenneyNL/Starter-Kit-City-Builder) | MIT (קוד), מודלים CC0 | ‏~1.5k★; ‏Godot 4.6 | בנייה והסרה של מבנים על רשת, החלפה בין סוגים, סיבוב, מצלמה חלקה, שמירה וטעינה | דפוסי UX למצב העיצוב ולחנות (מקום → סובב → אשר; מחזור בין פריטים) — ראו מחקר העיצוב | GDScript: רעיונות בלבד, לא קוד | P3 |
| [pascalorg/editor](https://github.com/pascalorg/editor) | MIT | ‏~25.4k★ | עורך בניינים ב־R3F + ‏WebGPU עם רהיטים, קירות ופתחים | למחקר מצב העיצוב (הפניה בלבד) | מכוון לאדריכלות, WebGPU | P3 (הפניה) |


## 3. נכסים מוכנים (מודלים, טקסטורות, סאונד, UI)

**הקשר:** החיות, האנשים, היבולים ומבני החווה **מפוסלים בקוד** (`src/lib/sculpt`) — זה המראה של המשחק ואין סיבה להחליף אותם בהורדות (חבילות חיות מוכנות, כמו של Quaternius, לא יתאימו לפרות שלנו). נכסים מוכנים חוסכים זמן במקומות אחרים: רהיטים ואביזרי בית (מצב העיצוב), צמחייה ליער ולאחו שמתרחבים, צלילים מוקלטים, אייקוני קלט. כל ההורדות עוברות ב־`npm run assets:fetch` / ‏`assets:optimize` הקיימים, ומקבלות שורה ב־`CREDITS.md` + ‏`src/data/credits.ts`.

> הערת אימות: האתרים kenney.nl, ‏quaternius.com, ‏polyhaven.com, ‏ambientcg.com, ‏poly.pizza, ‏freesound.org ו־itch.io **חסומים מהסביבה הזאת**. מה שמסומן "GitHub" נבדק בקובץ הרישיון עצמו; מה שמסומן "(דרך חיפוש)" נבדק בעמוד המפרסם כפי שהופיע בתוצאות חיפוש — לבדוק שוב את `License.txt` שבתוך ההורדה לפני שמכניסים לריפו.

### 3א. מודלים

| מקור + קישור | רישיון | מה יש | התאמה לסגנון | התאמה לתקציב (טלפון) | איך זה חוסך לנו זמן | עדיפות |
|---|---|---|---|---|---|---|
| [KayKit Furniture Bits](https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0) / [Restaurant Bits](https://github.com/KayKit-Game-Assets/KayKit-Restaurant-Bits-1.0) / [Prototype Bits](https://github.com/KayKit-Game-Assets/KayKit-Prototype-Bits-1.0) (Kay Lousberg) | **CC0** (‏`LICENSE.txt` ב־GitHub) | 50+ רהיטים; ‏140+ פריטי מטבח ואוכל; ‏64+ אביזרים; ‏OBJ/FBX/‏**glTF** | צורות עגולות ורכות בצבעי פסטל — הכי קרוב ל"צעצוע נעים" שלנו מכל המקורות | **טקסטורת אטלס־גרדיאנט אחת (1024²) לכל החבילה, שאפשר להקטין עד 128²** (לפי ה־README) ⇒ כמעט אפס זיכרון GPU, וחומר אחד ⇒ קל למזג/לעשות instancing | **ב־GitHub — כלומר `assets:fetch` מוריד אותן גם מסביבת הענן** (raw.githubusercontent עובד). קטלוג רהיטים שלם למצב העיצוב ביום אחד במקום חודשים של פיסול | **P1** (מצב העיצוב) |
| [Kenney](https://kenney.nl/assets) — ‏[Furniture Kit](https://kenney.nl/assets/furniture-kit), ‏[Nature Kit](https://kenney.nl/assets/nature-kit), ‏[Food Kit](https://www.kenney.nl/assets/food-kit) | **CC0** (דרך חיפוש) | ‏~140 רהיטים; ‏~330 פריטי טבע; ‏200 מאכלים וכלי מטבח | פשוט, צבעים שטוחים — מתאים, אבל "חד" יותר מ־KayKit | כל צבע הוא חומר נפרד ⇒ הרבה draw calls. הפתרון מוכן: **`gltf-transform palette` ואז `join`** (קיימים ב־CLI שכבר מותקן, 4.5.1) מאחדים את הצבעים לטקסטורת פלטה וממזגים רשתות | ספרייה הכי רחבה בשוק ב־CC0; טוב לפריטי מילוי (עציצים, כלים, ארגזים) | P2 |
| [Quaternius — Stylized Nature MegaKit](https://quaternius.com/packs/stylizednaturemegakit.html) | **CC0** (דרך חיפוש: quaternius.com ו־itch.io) | ‏110+ מודלי טבע: עצים, שיחים, סלעים, פרחים, צמחייה; ‏glTF | מסוגנן ורך; יתאים ליער שמעבר לגדר | ‏zip של 99MB — לבחור מעט מודלים, ‏`simplify` + ‏`textureSize` ב־`assets.manifest.json` | יער ואחו מגוונים בלי לפסל עשרות עצים; משלים את `flora.ts` | P2 |
| [Poly Haven](https://polyhaven.com) — ‏HDRI, טקסטורות, מודלים | **CC0** (דרך חיפוש: polyhaven.com/license) | כבר בשימוש (`home.hdr`, אריג) | פוטו־ריאליסטי: מתאים לבית, לא לחווה | **`home.hdr` שוקל 1.5MB** — להמיר ל־gainmap JPEG (ראו §4) | כבר מחובר (`scripts/fetch-polyhaven.mjs`) | P1 (ההמרה), שאר — קיים |
| [ambientCG](https://ambientcg.com) | **CC0** (מקור משני) | ‏2000+ חומרי PBR | פוטו־ריאליסטי | מפות 1K נכנסות לתיקיות `textures/<surface>` ונחתכות לפי `maxTexture` | מחליף משטח מחולל בקובץ אמיתי בלי קוד (המנגנון קיים) | P3 |
| [Poly Pizza](https://poly.pizza) | **לכל מודל בנפרד** (CC0 או CC-BY — דרך חיפוש) | אלפי מודלים low-poly; ‏API עם מפתח | מעורב | משתנה | חיפוש מהיר של פריט נדיר — אבל חובה לבדוק כל מודל ולקרדט כל CC-BY | P3 |

### 3ב. סאונד

| מקור + קישור | רישיון | מה יש | התאמה | איך זה חוסך לנו זמן | עדיפות |
|---|---|---|---|---|---|
| Kenney audio — ‏[UI Audio](https://kenney.nl/assets/ui-audio), ‏[RPG Audio](https://kenney.nl/assets/rpg-audio), ‏[Digital Audio](https://kenney.nl/assets/digital-audio), Interface Sounds, Impact Sounds | **CC0** (דרך חיפוש; Interface Sounds גם ב־[מראה ב־GitHub](https://github.com/Calinou/kenney-interface-sounds) עם CC0) | קליקים, מטבעות, דלתות, צעדים, חפצים (UI Audio ו־RPG Audio: 50 קבצים כל אחת) | עדינים ונקיים — מתאימים לממשק הרך | אם נרצה צליל "מוקלט" לכפתורים/מטבעות בלי לסנתז. **אבל**: הסינתזה שלנו כבר עובדת ולא מורידה כלום — רק להחלפה נקודתית | P3 |
| [Freesound](https://freesound.org) (רק קבצים שמסומנים CC0) | לכל קובץ בנפרד: CC0 / ‏CC-BY / ‏Sampling+ | הקלטות אמיתיות של פרות, כבשים, תרנגולות, אווירת חווה | אותנטי | געייה/פעייה אמיתית במקום מסונתזת. רוב הקלטות החווה שם **אינן** CC0 — לסנן לפי רישיון ולבדוק כל קובץ | P3 |
| [Sonniss GameAudioGDC](https://sonniss.com) | **לא CC0**: רישיון royalty-free, בלי קרדיט, אבל אסור להפיץ את הקבצים כמו שהם, ובחבילות האחרונות אסור לאמן AI (מקורות משניים) | עשרות GB של אפקטים מקצועיים | איכותי | רק אם צריך צליל מקצועי שאין ב־CC0; לשמור את קובץ הרישיון | P3 |

### 3ג. ממשק וגופנים

| מקור + קישור | רישיון | מה יש | איך זה חוסך לנו זמן | עדיפות |
|---|---|---|---|---|
| [Kenney Input Prompts](https://kenney.nl/assets/input-prompts) | **CC0** (דרך חיפוש) | ‏1,280+ סמלים: מקשי מקלדת ועכבר, **מחוות מגע**, בקרים; גרסה 1.4 (2025-04-07) | רשימת הקיצורים ב־⚙, רמזי "גרור כדי להסתכל / צבוט כדי להתקרב" בהדרכה, ‏E/B/R על כפתורים במחשב — בלי לצייר סמלים | P2 |
| Fluent Emoji 3D + ‏Phosphor (כבר בשימוש) | MIT | עוד מאות סמלים ותמונות באותו סגנון | כל פריט חדש בחנות/במצב העיצוב מקבל תמונה מאותה משפחה (לפי `CLAUDE.md`: קובץ חדש ב־`art.ts` + קרדיט) | קיים |
| גופנים עבריים (Rubik / ‏M PLUS Rounded 1c / ‏Varela Round) | OFL-1.1 | ראו §1ט | — | P1 (עם העברית) |


## 4. כלים שמאיצים את העבודה

### 4א. בדיקות ו־CI — המקום שבו הולך הכי הרבה זמן היום

היום כל בדיקה עוברת דרך ה־e2e: ‏~25 דקות מקומית ו־~35 ב־CI (לפי `ci.yml`), עם WebGL בתוכנה. חלק גדול ממה שנבדק שם הוא לוגיקה טהורה.

| כלי + קישור | רישיון | גרסה / תאריך | מה הוא נותן | איך זה חוסך לנו זמן | מאמץ, סיכונים | עדיפות |
|---|---|---|---|---|---|---|
| [Vitest](https://github.com/vitest-dev/vitest) | MIT | 5.1.0 / 2026-11-02 (peer ‏`vite ^8` ✓), ‏~17.4k★ | בדיקות יחידה שמשתמשות באותה תצורת Vite, מצב watch, סביבת `happy-dom` | כללי החווה (`canPlace`, מחירים, `load()` שמנקה שמירות, ההשלמה של עד 3 שעות היעדרות) ו־**בדיקות המודלים** (`src/models/checks.ts` מייבא רק three ואת הקיט — כנראה ירוץ ב־Node; לאשר בבדיקה הראשונה) רצים **בשניות בכל שמירה**, במקום לחכות ל־`12-models` בסוף ריצה של 25 דקות. ה־e2e נשאר לזרימות האמיתיות | חצי יום להקמה + בדיקה ראשונה. `farm/state.ts` קורא localStorage בטעינה — עטוף כבר ב־try, ו־happy-dom מספק אותו | **P1** |
| Playwright — מה שכבר מותקן (1.63): ‏`--shard`, ‏`merge-reports`, ‏`--only-changed`, ‏`--last-failed` | Apache-2.0 | 1.63 (אצלנו) | פיצול הסוויטה לכמה מכונות ואיחוד הדוחות; הרצה רק של קבצי בדיקה שהשתנו מול ענף; הרצה חוזרת רק של מה שנכשל | ב־CI: ארבעה runners עם `--shard=i/4` ⇒ זמן המתנה של בערך רבע (+ אתחול של דקה–שתיים לכל shard; הערכה, לא נמדד). מקומית: `--last-failed` אחרי תיקון במקום ריצה מלאה | חצי שעה ב־`ci.yml` (matrix + ‏`blob` reporter). לוודא שכל קובץ עומד לבד (ה־fixture ‏`game` כבר מאתחל לבד בכל worker) | **P1** |
| [@react-three/test-renderer](https://github.com/pmndrs/react-three-fiber/tree/master/packages/test-renderer) | MIT | 9.1.1 / 2026-07-31 (R3F 9 ✓) | רינדור רכיבי R3F ב־Node ובדיקת גרף הסצנה (כמה instances, אילו props) בלי WebGL | בדיקה מהירה ש־`Visitors` יוצר בועה לכל קונה, ש־`Parts` מקבל את מספר המופעים הנכון וכו' | בונוס על Vitest; לא תחליף ל־e2e | P3 |

### 4ב. דיבוג, כוונון ופרופיילינג

| כלי + קישור | רישיון | גרסה / תאריך | מה הוא נותן | איך זה חוסך לנו זמן | מאמץ, סיכונים | עדיפות |
|---|---|---|---|---|---|---|
| [leva](https://github.com/pmndrs/leva) | MIT | 0.10.1 / 2025-10-31 (React 19 ✓), ‏~6.3k★ — **כבר מותקן** (peer אופציונלי של ecctrl) | פאנל סליידרים/צבעים/כפתורים מ־`useControls` בשורה אחת | כוונון חי במקום שינוי־בנייה־רענון: פרמטרי פיסול בתוך `?gallery` (צורת אוזן, גוון פרווה), השמש והערפל ב־`Lighting.tsx`, ספי ה־bloom ב־`Effects.tsx`, זמני גידול ומחירים ב־`farm/data.ts` | שעה. **לטעון רק ב־`?debug`/`?gallery` ב־dynamic import** כדי שלא ייכנס לבאנדל של הטלפון. (חלופות בלי React: lil-gui 0.21.0, ‏Tweakpane 4.0.5 — שתיהן MIT) | **P1** |
| [Three.js DevTools](https://github.com/mrdoob/three.js/tree/dev/devtools) (תוסף Chrome רשמי) | MIT (חלק מ־three.js) | בתיקיית `devtools` בריפו של three.js | עץ הסצנה, תכונות כל אובייקט, הדגשה על הדף, אורות וצללים, נתוני renderer וזיכרון | "למה זה לא נראה" ו"כמה זיכרון זה תופס" בלי `console.log` ובלי `?debug` | "Load unpacked" מהריפו; כלי מפתח בלבד | P2 |
| [Spector.js](https://github.com/BabylonJS/Spector.js) | MIT | 0.9.33 / 2026-09-14, ‏~1.6k★ | צילום פריים WebGL אחד: כל draw call עם המצב, ה־shaders והטקסטורות | כש־`05-budget` נכשל (700 draw calls) — רואים בדיוק מה נוסף; גם לבאגי פיקסלים שחורים כמו זה שתוקן ב־`hdrGuard.ts` | תוסף דפדפן; אפס קוד | P2 |
| [eruda](https://github.com/liriliri/eruda) | MIT | 3.4.3 / 2025-06-15, ‏~21.2k★ | קונסול, רשת, אחסון ואלמנטים **בתוך הטלפון עצמו** | בדיקה על טלפון אמיתי בלי כבל ו־remote debugging: רואים שגיאות, את השמירה ב־localStorage ואת ה־SW. משלים את *Copy diagnostics* | שעה; רק ב־`?debug` ב־dynamic import (הספרייה גדולה) | P2 |
| `<StatsGl>` של drei (‏[stats-gl](https://github.com/RenaudRohlinger/stats-gl)) | MIT | stats-gl 4.2.3 / 2026-07-10 (drei מושכת 2.x), ‏282★ | FPS, ‏CPU וזמן GPU (כשה־timer query זמין) על המסך | מדידה על טלפון אמיתי של מה ש־`PerformanceMonitor` מחליט לפיו | דקות; תחת `?debug` | P2 |

### 4ג. צינור הנכסים: מודלים, טקסטורות, תאורה

| כלי + קישור | רישיון | גרסה / תאריך | מה הוא נותן | איך זה חוסך לנו זמן | מאמץ, סיכונים | עדיפות |
|---|---|---|---|---|---|---|
| [gainmap-js](https://github.com/MONOGRID/gainmap-js) + הממיר בדפדפן `gainmap-creator.monogrid.com` | MIT | 3.7.3 / 2026-11-05, ‏164★ — **כבר מותקן** (תלות של drei) | המרת ‏`.hdr`/`.exr` ל־JPEG עם gain map; ‏`<Environment files="x.jpg">` של drei טוען אותו ב־`HDRJPGLoader` ("Of all these, gainmap has the smallest footprint" — מתיעוד drei) | **`home.hdr` הוא 1.5MB מתוך ההורדה הראשונה**; gain map ‏JPEG קטן בהרבה (לא מדדתי — לבדוק אחרי ההמרה) ⇒ טעינה מהירה יותר בטלפון בלי לשנות את המראה | 1–2 שעות: המרה; ב־`src/assets/registry.ts` ה־glob הוא `./hdri/*.{hdr,exr}` ו־`tagHdr` בונה data URL לפי הסיומת — להוסיף `jpg`; ‏`labelFor` ב־`vite.config.ts` מסווג "Sky light" לפי `.hdr/.exr` בלבד | **P1** |
| [glTF-Transform CLI](https://github.com/donmccurdy/glTF-Transform) (כבר `devDependency`, ‏4.5.1) — פקודות שעוד לא בשימוש | MIT | 4.5.1 / 2026-09-28, ‏~2.1k★ | ‏`palette` (צבעים שטוחים ⇒ טקסטורת פלטה וחומר אחד), ‏`join`, ‏`instance`, ‏`simplify`, ‏`etc1s`/`uastc` ‏(KTX2), ‏`avif`, ‏`inspect`, ‏`validate` | מודלים של Kenney (חומר לכל צבע) יורדים ל־draw אחד; ‏KTX2 נשאר דחוס **גם בזיכרון ה־GPU** (לפי ה־help של הכלי: PNG/JPEG "fully uncompressed in GPU memory") — פחות קריסות הקשר WebGL בטלפון, הבעיה ש־`startup.ts` מטפל בה | הרחבה של `scripts/optimize-models.mjs`. ‏`etc1s`/`uastc` דורשים התקנת KTX-Software. ‏**drei טוען את מפענחי KTX2 ו־Draco מ־CDN כברירת מחדל** (`jsdelivr`/`gstatic` ב־`core/Ktx2.js`, ‏`core/Gltf.js`) — להעתיק את מפענח ה־Basis מ־`three/examples/jsm/libs/basis` ולהצביע עליו, אחרת אופליין נשבר | P2 |
| [ktx2-encoder](https://github.com/gz65555/ktx2-encoder) | MIT | 0.6.0 / 2026-07-19 | מקודד Basis ב־WASM ל־Node ולדפדפן | KTX2 מתוך הסקריפט שלנו בלי להתקין KTX-Software (טוב ל־CI ולסביבת הענן) | פחות מוכר; להשוות איכות מול `toktx` | P3 |
| [gltfjsx](https://github.com/pmndrs/gltfjsx) | MIT | 6.5.3 / 2024-11-04, ‏~5.9k★ | הופך GLB לרכיב React מוקלד (`--types`), עם instancing אוטומטי (`--instance`) | כל רהיט שנוריד למצב העיצוב הופך לרכיב עם חלקים בשמות (מגירה, דלת ארון) בלי לכתוב אותו ביד | **לא להשתמש ב־`--transform`**: הוא דוחס ב־Draco, ו־`useGLTF` מוריד אז מפענח מ־gstatic (נשבר אופליין, ה־SW לא שומר אותו). קודם `npm run assets:optimize` (meshopt), אחר כך gltfjsx בלי `--transform` | P2 (מצב העיצוב) |
| [rollup-plugin-visualizer](https://github.com/btd/rollup-plugin-visualizer) | MIT | 7.1.3 / 2026-11-08 (Vite + Rolldown ✓), ‏~2.4k★ | מפת treemap של כל chunk | לפני כל ספרייה חדשה מהמסמך הזה: רואים בדיוק כמה היא מוסיפה ל־`vendor-r3f`/`Experience` ומה כדאי לטעון בעצלות בטלפון | רבע שעה; רק ב־build מקומי (`ANALYZE=1`) | P2 |
| [glTF Viewer](https://github.com/donmccurdy/three-gltf-viewer) (`gltf-viewer.donmccurdy.com`) ו־gltf.report | MIT (הצופה) | ‏~2.5k★ | גרירת GLB לדפדפן וצפייה ב־three.js; ‏gltf.report מראה ממה מורכב גודל הקובץ ומריץ סקריפטים של glTF-Transform | בחירת רהיטים/עצים מחבילות לפני שמכניסים ל־manifest: רואים משולשים, חומרים וגודל טקסטורות בשניות | אתרים חיצוניים (לא נבדקו מהסביבה הזאת) | P3 |

### 4ד. עורכים

| כלי + קישור | רישיון | מה הוא נותן | התאמה לנו | עדיפות |
|---|---|---|---|---|
| [Triplex](https://github.com/trytriplex/triplex) (תוסף VS Code) | **AGPL-3.0** (קבצי `LICENSE` בתיקיות `apps/vscode`, ‏`packages/bridge`) | עריכה ויזואלית של רכיבי R3F: גוררים אובייקט והקוד מתעדכן | רוב המיקומים אצלנו בקבצי נתונים (`data/layout.ts`, ‏`farm/layout.ts`) ולא ב־props של JSX — תועלת מוגבלת. מותר ככלי מקומי; **אסור להכניס חבילת `@triplex/*` לבאנדל** | P3 |


## 5. איך זה מתחבר למפת הדרכים שלנו

הסדר נקבע לפי "כמה זמן זה מחזיר לכל שעת עבודה": קודם הכלים שמקצרים *כל* משימה, אחר כך מה שנחוץ לפיצ'רים הבאים, ובסוף מה שמחכה לצורך.

### שלב 0 — השבוע: לקצר את לולאת העבודה (כ־2 ימים בסך הכול)

| מה | איפה זה נכנס בקוד | למה עכשיו |
|---|---|---|
| **Vitest** | `vitest.config.ts` (או בלוק `test` ב־`vite.config.ts`); קבצי `*.test.ts` ליד `src/farm/layout.ts`, ‏`src/farm/state.ts`, ‏`src/models/checks.ts`; צעד `npx vitest run` ב־`ci.yml` לפני ה־e2e | כל שינוי בכללי החווה או במודל נבדק בשניות; ה־e2e נשאר רשת ביטחון ולא כלי פיתוח |
| **Playwright `--shard` + `merge-reports`** | `.github/workflows/ci.yml`: ‏matrix של 4, ‏`--reporter=blob`, ‏job שמאחד ומעלה את הדוח | כל push מחכה בערך רבע מהזמן; מקומית `--last-failed` / ‏`--only-changed` |
| **leva** תחת `?debug`/`?gallery` | dynamic import מ־`src/lib/debug.ts`; פאנל ב־`src/models/Gallery.tsx`, ‏`src/scene/Lighting.tsx`, ‏`src/scene/Effects.tsx` | כוונון מראה ומודלים בזמן אמת במקום מחזור עריכה–בנייה |
| **HDR → gain map** | `src/assets/hdri/home.jpg`; ה־glob ו־`tagHdr` ב־`src/assets/registry.ts`; ‏`labelFor` ב־`vite.config.ts`; ‏`<Environment files>` ב־`src/scene/Lighting.tsx` | רוב ה־1.5MB של `home.hdr` יורדים מההורדה הראשונה בטלפון, בלי לשנות מראה (לאמת גודל ומראה אחרי ההמרה) |
| **manifest + אייקונים** | `public/manifest.webmanifest`, ‏`<link rel="manifest">` ו־`apple-touch-icon` ב־`index.html`, אייקונים מ־`public/favicon.svg` עם `@vite-pwa/assets-generator`; בדיקה ב־`11-startup` | התקנה למסך הבית: מסך מלא, ולפי מדיניות WebKit — הגנה מפני מחיקת החווה אחרי 7 ימים |

### שלב 1 — עם מצב העיצוב (פירוט מלא במחקר הנפרד)

| מה | איפה |
|---|---|
| קטלוג רהיטים: **KayKit Furniture/Restaurant Bits** (CC0, ב־GitHub) | שורות ב־`scripts/assets.manifest.json` ⇒ `npm run assets:fetch` ⇒ `assets:optimize` (meshopt) ⇒ `gltfjsx --types --instance` **בלי `--transform`**; קרדיט ב־`CREDITS.md` + ‏`src/data/credits.ts` |
| פריטים של Kenney | `gltf-transform palette` + ‏`join` כצעד נוסף ב־`scripts/optimize-models.mjs` |
| הצבה: raycast והדגשה | `<Bvh>` סביב הבית ב־`src/scene/House.tsx`; ‏`<Outlines>` על הנבחר (עובד גם על `instancedMesh`) |
| מחוות בטלפון | `@use-gesture/react` (כבר מותקן) לגרירה/סיבוב/צביטה; ‏`camera-controls` ‏`fitToBox` למבט על חדר |
| שמירת הרהיטים | שדה חדש בשמירה עם גרסה; `persist` של zustand עם `version`/`migrate`, או הרחבה של `load()` ב־`src/farm/state.ts` (Valibot לשדות החדשים — אופציונלי) |

### שלב 2 — עברית

| מה | איפה |
|---|---|
| **Paraglide** + תוסף Vite | `vite.config.ts`; ‏`messages/he.json`, ‏`messages/en.json`; החלפת מחרוזות ב־`src/ui/*`, בתוויות של `useInteractable` ב־`src/farm/*`, וב־`count()` ב־`src/farm/data.ts` |
| כיוון | `document.documentElement.dir`; ‏CSS logical properties ב־`src/styles.css`; **לא** להפוך את `TouchControls` |
| גופנים | `@fontsource-variable/rubik` (או `@fontsource/m-plus-rounded-1c`) ב־`src/main.tsx` לצד Nunito; קובץ עברי מקומי ל־`<Text>` ב־`src/scene/screens/fonts.ts` + ‏`direction` |
| טקסט על canvas | `ctx.direction = 'rtl'` ב־`bubbleTexture` ב־`src/farm/Visitors.tsx` ובתמונות שמצוירות על canvas |

### שלב 3 — "מיץ" ועולם חי

| מה | איפה |
|---|---|
| חלקיקים: **wawa-vfx** | `src/farm/Garden.tsx` (קטיף, השקיה), ‏`src/farm/Workshop.tsx` (תנור, טחנה), צ'יפ המטבעות |
| אפקטים חדשים: **ZzFX** | `src/audio/sound.ts`, דרך אותו `sfx` gain |
| מתג השקט באייפון | החלטה על `navigator.audioSession.type` ב־`unlockAudio` |
| יום/לילה ומזג אוויר | `sunPosition` של `<Sky>` ועקומות אור ב־`src/scene/Lighting.tsx` / ‏`LightDirector.tsx`; רוח ועשב לפי folio-2025; פרחי אחו לפי `webgl_instancing_scatter` |
| culling ו־LOD לעדרים כשהאדמה גדלה | `InstancedMesh2` של `@three.ez/instanced-mesh` בתוך `src/lib/sculpt/parts.ts`; מדידה ב־`05-budget` |

### שלב 4 — רק כשהצורך יופיע

navcat (כשקונים/עוזרים נכנסים לחווה) · אלגוריתמי Yuka (פרות שלא נכנסות זו בזו) · inkjs (שיחות וקווסטים כתובים) · driver.js (סיור ב־HUD) · XState (קווסטים רב־שלביים) · idb-keyval (שמירות גדולות) · KTX2 (אם קריסות הקשר בטלפון חוזרות) · BVHEcctrl (ניסוי להורדת 2.2MB של Rapier).

### הערות תאימות לשדרוגים הבאים (מה־peerDependencies ב־npm)

- `postprocessing` 6.39.6 דורש `three < 0.188` — כש־three 0.188 ייצא, לחכות לגרסה חדשה של postprocessing לפני השדרוג (three העדכני היום: 0.187.0 מ־2026-10-30).
- `@react-three/fiber` 9.8.2 דורש `react < 19.4` — React העדכני היום 19.3.1, אז אין חסימה עדיין.
- `@react-three/postprocessing` 3.2.2 דורש `@react-three/fiber >= 9.7` (יש לנו 9.8.1 ✓).
- כמה ספריות מושכות `three-mesh-bvh` 0.9 בעוד drei מושכת ^0.8.3 — כל אחת מהן מוסיפה עותק שני לבאנדל; לבדוק ב־visualizer.

### בדיקה של חמש דקות לפני שמוסיפים ספרייה (מה שלמדנו מהמחקר הזה)

1. **peers:** ‏`npm view <pkg> peerDependencies dependencies` — לוודא R3F ^9, ‏React 19, ‏three 0.186, ושאין תלות שמושכת drei 9 או zustand 4 (כמו r3f-perf).
2. **בלי CDN בזמן ריצה:** ה־SW שלנו שומר רק את הקבצים של המשחק. ברירות מחדל שמורידות מרשת: מפענח Draco של `useGLTF` ‏(gstatic), מפענח KTX2 של `useKTX2` ‏(jsDelivr), ‏`preset` של `<Environment>`, גופני ה־fallback של troika, טבלאות detect-gpu ‏(unpkg) — תמיד לתת נתיב מקומי.
3. **כלי דיבוג לא נכנסים לטלפון:** leva, ‏eruda, ‏`<StatsGl>`, ‏`devtools` של zustand — רק ב־dynamic import תחת `?debug`, ולוודא ב־visualizer שהם ב־chunk נפרד.
4. **תקציב:** כל מה שמוסיף draws (חלקיקים, ‏`Outlines`, עננים) נמדד ב־`05-budget` (700 draw calls, ‏250k משולשים) לפני merge.
5. **רישיון:** ‏MIT/BSD/Apache/ISC/Zlib/CC0 — כן; ‏MPL — רק בלי לשנות את קבצי הספרייה; ‏GPL/AGPL/CC-BY-SA/NC — לא בבאנדל; נכס CC-BY — שורה ב־`CREDITS.md` וב־`src/data/credits.ts`.

## 6. נבדק ונדחה

| שם | למה לא |
|---|---|
| [r3f-perf](https://github.com/utsuboco/r3f-perf) 7.2.3 | תלוי ב־`@react-three/drei ^9.103` וב־`zustand ~4.5` (נבדק ב־npm) — ימשוך drei 9 של R3F 8 לצד ה־10 שלנו; גרסה אחרונה 2024-11. ‏`<StatsGl>` + ‏Spector + ‏DevTools מכסים את זה |
| [@theatre/r3f](https://github.com/AriaMinaei/theatre) / ‏@theatre/studio 0.7.2 | ‏peer ‏`@react-three/fiber ^8.13`; ה־studio ב־**AGPL-3.0**; אין שחרור מאז 2024-05 |
| framer-motion-3d | מסומן **deprecated** ב־npm |
| [GSAP](https://github.com/greensock/GSAP) 3.15.1 | רישיון "Standard 'no charge' license" — לא רישיון קוד פתוח (OSI); maath/CSS מספיקים |
| [Shepherd.js](https://github.com/shipshapecode/shepherd) / ‏[Intro.js](https://github.com/usablica/intro.js) | **AGPL-3.0** (לפי npm) — לא בבאנדל שלנו; driver.js (MIT) עושה את אותו הדבר |
| [Triplex](https://github.com/trytriplex/triplex) כחבילה בבאנדל | **AGPL-3.0**; מותר רק ככלי מקומי (ראו §4ד) |
| [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa) | היה מצוין לפני שכתבנו SW; היום יחליף קוד בדוק (`11-startup`). מה שחסר הוא רק manifest + אייקונים |
| [Lingui](https://github.com/lingui/js-lingui) 6.12 | דורש מאקרו של Babel או SWC; ‏`@vitejs/plugin-react` 6 עובד עם oxc ו־Babel רק כתוסף אופציונלי — עוד שכבת build בלי יתרון על Paraglide |
| [typesafe-i18n](https://github.com/codingcommons/typesafe-i18n) | ה־README: ‏"Created by Ivan Hofer (1995-2023)"; ‏מצב התחזוקה לא ברור (עבר לארגון אחר בלי הסבר) |
| [miniplex](https://github.com/hmans/miniplex) 2.0.0 | אין שחרור מאז 2023-07; אם בכלל ECS — koota (של pmndrs, שוחרר ב־2026) |
| [bitECS](https://github.com/NateTheGreatt/bitECS) 0.4.0 | ‏**MPL-2.0** (copyleft ברמת הקובץ) ו־API נמוך־רמה (מערכים מוקלדים) — לא מתאים לגודל העולם שלנו |
| [three-pathfinding](https://github.com/donmccurdy/three-pathfinding) 1.3.0 | צריך navmesh מוכן מ־Blender; דוגמאות בסגנון three ישן; navcat בונה navmesh בעצמו |
| [PathFinding.js](https://github.com/qiao/PathFinding.js) / ‏[EasyStar.js](https://github.com/prettymuchbryce/easystarjs) | שחרור אחרון 2016 / 2020; ‏ngraph.path מתוחזק, ו־A* על הרשת שלנו קצר לכתוב |
| [@takram/three-atmosphere](https://github.com/takram-design-engineering/three-geospatial) / three-clouds | בטא, חבילה של ~36MB לא דחוסה, ‏API של WebGPU שעתיד להשתנות; שמיים פיזיקליים לא נחוצים בסגנון שלנו ולא בתקציב הטלפון |
| [three-custom-shader-material](https://github.com/FarazzShaikh/THREE-CustomShaderMaterial) | יש לנו `sculptMaterial` משלנו ("one shader for everything") — כל אפקט (רוח, נדנוד) נכנס אליו ישירות |
| [three-nebula](https://github.com/creativelifeform/three-nebula) 13.3.0 | ה־renderer המקובץ (draw אחד לכל החלקיקים) קיים רק ל־`WebGPURenderer` (`three-nebula/webgpu`); עם ה־`WebGLRenderer` שלנו נשאר `SpriteRenderer`. ‏wawa-vfx / ‏three.quarks מתאימים יותר |
| [realism-effects](https://github.com/0beqz/realism-effects) 1.1.2 | אין שחרור מאז 2023-05; ‏SSGI/TRAA כבדים מדי לטלפון |
| [three-good-godrays](https://github.com/ameobea/three-good-godrays) (Zlib) | יש לנו `LightShafts.tsx` |
| `Water`/`Water2` של three, ‏`MeshReflectorMaterial` של drei | השתקפות = מעבר רינדור נוסף של הסצנה (כמעט מכפיל draw calls) — לא בתקציב הטלפון; לבריכה/שוקת: shader פשוט (folio-2025 כמקור) |
| ספריית עשב "מוכנה" | לא נמצאה ספרייה מתוחזקת עם רישיון MIT ל־R3F; המקורות הם `webgl_instancing_scatter` של three ו־folio-2025, על ה־`Parts` שלנו |
| [@react-three/a11y](https://github.com/pmndrs/react-three-a11y) 3.0.0 / ‏@react-three/offscreen 0.0.8 / ‏@react-three/lightmap 0.0.8 | שחרור אחרון 2022–2023 (תקופת R3F 8); לא מתוחזקים |
| [localForage](https://github.com/localForage/localForage) 1.10.0 / ‏Dexie | שחרור אחרון 2021 / ‏Dexie הוא מסד נתונים שלם לשלוש משבצות שמירה; idb-keyval מספיק אם בכלל |
| [unmute-ios-audio](https://github.com/feross/unmute-ios-audio) 3.3.0 | ‏2020, ניגון שקט ב־`<audio>` בכל מגע; ב־iOS 17+ יש `navigator.audioSession` מובנה |
| Sonner / ‏react-hot-toast | יש לנו טוסטים בעיצוב שלנו (`.toast` ב־`styles.css`) |
| [simplex-noise](https://github.com/jwagner/simplex-noise.js) / seedrandom | יש לנו כבר `fbm3` בקיט ו־`mulberry` ב־`flora.ts` |
| ספריות inventory/crafting גנריות | לא נמצאה ספרייה שמצדיקה תלות; המתכונים והמלאי ב־`src/farm/data.ts` כבר מונחי־נתונים |
| [jeremyckahn/farmhand](https://github.com/jeremyckahn/farmhand) | משחק חווה ב־React אבל **GPL-2.0** ו־2D — אפשר רק להסתכל על כלכלת המשחק, לא להעתיק קוד |
| [pmndrs/racing-game](https://github.com/pmndrs/racing-game) | ‏MIT, אבל על R3F 8, ‏React 18, ‏three 0.139 ו־zustand 3 (לפי ה־`package.json` שלו); הדפוסים שבו כבר אצלנו |
| חבילות חיות מוכנות (למשל Quaternius LowPoly Animated Farm Animals, ‏CC0) | החיות שלנו מפוסלות בקוד ונבדקות ב־`checks.ts`; מודל מורד לא ישתלב במראה ובבדיקות |
| KayKit Forest Nature Pack | ב־itch.io בלבד ו"רובו חינם" — רישיון החלק החינמי **[UNVERIFIED]**; ‏Quaternius MegaKit מכסה את אותו צורך ב־CC0 |
| Mixkit (צלילי חווה) | תנאי הרישיון לא אומתו **[UNVERIFIED]** |

