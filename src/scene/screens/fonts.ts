import interRegular from '@pmndrs/assets/fonts/inter_regular.woff'
import interSemiBold from '@pmndrs/assets/fonts/inter_semi_bold.woff'
import interBold from '@pmndrs/assets/fonts/inter_bold.woff'

/**
 * Inter, bundled, so the wall screens (2D canvas) and the screen panel look the same on every machine
 * instead of falling back to whatever system font is installed. Registered as "HomeInter".
 */
export const FONT_FAMILY = 'HomeInter, Inter, ui-sans-serif, system-ui, sans-serif'

let ready: Promise<void> | null = null

export function loadScreenFonts(): Promise<void> {
  if (ready) return ready
  if (typeof FontFace === 'undefined' || !document.fonts) return (ready = Promise.resolve())
  const faces = [
    new FontFace('HomeInter', `url(${interRegular})`, { weight: '400' }),
    new FontFace('HomeInter', `url(${interSemiBold})`, { weight: '600' }),
    new FontFace('HomeInter', `url(${interBold})`, { weight: '700' }),
  ]
  ready = Promise.all(
    faces.map((f) =>
      f.load().then(
        (loaded) => void document.fonts.add(loaded),
        () => undefined, // a blocked data: URL just means the fallback font is used
      ),
    ),
  ).then(() => undefined)
  return ready
}
