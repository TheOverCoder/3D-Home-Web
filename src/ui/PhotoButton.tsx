import { AnimatePresence, m } from 'motion/react'
import { useLessMotion } from './still'
import { useState } from 'react'
import { useSettings } from '../settings'
import { busy, useHome } from '../store'
import { Camera } from './glyphs'
import { EASE, MotionRoot, TIP } from './motion'
import './PhotoButton.css'

// A photo of the farm, in the clear view of the top of the screen only (HudMode "clear", <html data-hud="clean">): the
// view with nothing of the interface on it is the one worth keeping. A tap takes the game's own frame — its canvas,
// which holds the scene and nothing else (every button and card is drawn over it by the page) — with a soft flash, and
// the photo shrinks into the button; then the phone's own share sheet opens (WhatsApp, messages…) where it has one
// (the Web Share API), and otherwise the picture is saved as a file. Nothing is sent anywhere by the game itself.
// Beside the menu in the top corner: clear of the stick and the buttons, which own the bottom corners.

/** The game's canvas (three.js marks its own). */
const gameCanvas = () => document.querySelector<HTMLCanvasElement>('canvas[data-engine]')

/** The frame as it is drawn: copied in an animation frame after the game's own has drawn (the canvas keeps its picture
 *  only until the frame is shown), at its full size. */
function grab(): Promise<HTMLCanvasElement | null> {
  const canvas = gameCanvas()
  if (!canvas || !canvas.width || !canvas.height) return Promise.resolve(null)
  return new Promise((resolve) =>
    requestAnimationFrame(() => {
      const copy = document.createElement('canvas')
      copy.width = canvas.width
      copy.height = canvas.height
      const ctx = copy.getContext('2d')
      if (!ctx) return resolve(null)
      ctx.drawImage(canvas, 0, 0)
      resolve(copy)
    }),
  )
}

const stamp = () => {
  const d = new Date()
  const two = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`
}

function save(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** Shares the photo where the phone can (its own sheet), and saves it as a file otherwise (or when sharing fails). */
async function share(file: File) {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: '3D Home' })
      return
    } catch (e) {
      // closed by the player: nothing more to do
      if (e instanceof DOMException && e.name === 'AbortError') return
    }
  }
  save(file)
}

export function PhotoButton() {
  const phase = useHome((s) => s.phase)
  const occupied = useHome(busy)
  const mode = useSettings((s) => s.hudMode)
  const still = useLessMotion()
  const [shot, setShot] = useState<{ url: string; n: number } | null>(null)
  const [taking, setTaking] = useState(false)
  if (phase !== 'playing' || occupied || mode !== 'clean') return null

  const take = async () => {
    if (taking) return
    setTaking(true)
    try {
      const frame = await grab()
      if (!frame) return
      const blob = await new Promise<Blob | null>((r) => frame.toBlob(r, 'image/jpeg', 0.92))
      if (!blob) return
      const url = URL.createObjectURL(blob)
      setShot((p) => ({ url, n: (p?.n ?? 0) + 1 }))
      setTimeout(() => {
        setShot((p) => (p?.url === url ? null : p))
        URL.revokeObjectURL(url)
      }, 800)
      await share(new File([blob], `3d-home-${stamp()}.jpg`, { type: 'image/jpeg' }))
    } finally {
      setTaking(false)
    }
  }

  return (
    <MotionRoot>
      <m.button
        className="photo-btn"
        onClick={() => void take()}
        aria-label="Take a photo of the farm, to share or keep"
        title="Photo"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        {...TIP}
      >
        <Camera weight="fill" />
      </m.button>
      <AnimatePresence>
        {shot && (
          <div key={shot.n} className="photo-shot" aria-hidden="true">
            <m.i className="photo-flash" initial={{ opacity: still ? 0.25 : 0.85 }} animate={{ opacity: 0 }} transition={{ duration: still ? 0.25 : 0.45, ease: EASE.out }} />
            {/* the photo, shrinking into the button */}
            {!still && (
              <m.img
                className="photo-fly"
                src={shot.url}
                alt=""
                initial={{ opacity: 1, scale: 0.6, x: '0vw', y: '0vh', rotate: 0 }}
                animate={{ opacity: [1, 1, 0], scale: 0.08, x: '42vw', y: '-44vh', rotate: -6 }}
                transition={{ duration: 0.55, ease: EASE.out }}
              />
            )}
          </div>
        )}
      </AnimatePresence>
    </MotionRoot>
  )
}
