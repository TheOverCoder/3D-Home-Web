// The interface's size (Settings → Picture → Interface size): one number, `--ui` on <html>, that every length of the CSS
// is made of (src/styles.css: 1 rem = 16 px × it; src/styles.units.test.ts keeps every length in rem). The player picks a
// size; the screen caps how big it may grow, so the interface keeps the room it was laid out for — at least MIN_SIDE css
// px on a phone's short side — and a big screen lets every size be what it says. The touch controls keep their size
// (src/ui/TouchControls.tsx places them in px): a thumb is a thumb.
import { useSettings, type UiSize } from '../settings'

/** Each size's scale of the interface as it was drawn. */
export const UI_SIZES: Readonly<Record<UiSize, number>> = { small: 0.9, medium: 1, large: 1.12, larger: 1.25 }
/** The fewest css px the interface is given on a screen's short side (it is laid out for a 360 px phone, and holds a
 *  little less). */
export const MIN_SIDE = 350

/** The scale for a size picked, on a screen w × h (css px): what it says, unless that would leave the short side under
 *  MIN_SIDE; never under the default size for it (a small screen still gets medium). */
export function uiScale(pick: UiSize, w: number, h: number): number {
  const most = Math.max(1, Math.min(w, h) / MIN_SIDE)
  return Math.round(Math.min(UI_SIZES[pick] ?? 1, most) * 1000) / 1000
}

/** The scale this screen gives the size picked now. */
export const uiScaleNow = () => uiScale(useSettings.getState().uiSize, innerWidth, innerHeight)

function apply() {
  document.documentElement.style.setProperty('--ui', String(uiScaleNow()))
}
if (typeof document !== 'undefined') {
  apply()
  useSettings.subscribe((s, was) => s.uiSize !== was.uiSize && apply())
  addEventListener('resize', apply)
}
