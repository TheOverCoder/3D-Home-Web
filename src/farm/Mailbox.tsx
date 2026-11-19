import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Group, MathUtils } from 'three'
import { personById } from '../data/people'
import { debugSet } from '../lib/debug'
import { useInteractable } from '../lib/interaction'
import { Parts } from '../lib/sculpt'
import { castAsOne, type CastAsOne } from '../lib/sculpt/sun'
import { MAIL_FLAG, mailboxModel, partGeometry } from '../models/structures'
import { useHome } from '../store'
import { art } from '../ui/art'
import { iconUrl } from './icons'
import { LetterWatcher } from './people/LetterPanel'
import { MAILBOX, MAILBOX_REACH, MAILBOX_TOP } from './people/mailbox'
import { lettersWaiting } from './state'

// The mailbox by the garden's gate (update-v1/missions/03-characters-story.md, change 7): a post with a blue tin box on
// it, its door to the lane, on the lane side of the fence just west of the gate (./people/mailbox.ts). Its red flag
// swings up while a letter waits (the neighbours' letters, src/farm/state/neighbours.ts), and the action button says
// Read: it opens the oldest letter (./people/LetterPanel.tsx). The very first letter also opens by itself, through the
// card queue (it registers here: the mailbox is where letters live). Drawn as a crowd of one (src/lib/sculpt/parts.ts:
// the box and the flag, far copies of their own), outdoors (the farm's map), and cast into the sun's map by one mesh
// (castAsOne) while its flag stands still; a collider round its post and box.

/** How fast the flag swings to where it goes (per second, damped). */
const SWING = 7
/** Under this far from where it goes, the flag stands still (radians). */
const STILL = 0.002

/** The compass draws a good's picture (src/farm/icons.ts): it takes the mailbox's mark now that there is the mailbox's
 *  picture (the flag and the word at the top say a letter came, too). */
const MARKED = iconUrl('mailbox') !== art('basket')

/** Who wrote the oldest letter waiting, for the button's words. */
function readLabel() {
  const waiting = lettersWaiting()
  if (waiting.length > 1) return `Read ${waiting.length} letters`
  return waiting[0] ? `Read the letter from ${personById(waiting[0].from).name}` : 'The mailbox'
}

export function Mailbox() {
  const openPanel = useHome((s) => s.openPanel)
  const { parts, root } = useMemo(() => {
    const model = mailboxModel()
    const parts = new Parts(
      {
        body: { geometry: partGeometry(model.body), max: 1, material: model.body.material, castShadow: true, receiveShadow: true },
        flag: { geometry: partGeometry(model.flag), max: 1, material: model.flag.material, castShadow: true, receiveShadow: true },
      },
      'mailbox',
    )
    const root = new Group()
    root.name = 'mailbox'
    root.add(parts.group)
    return { parts, root }
  }, [])
  const flag = useRef({ angle: lettersWaiting().length ? MAIL_FLAG.up : MAIL_FLAG.down, posed: false })
  const sun = useRef<CastAsOne | null>(null)

  /** The mailbox where it stands, its flag at its angle. */
  const pose = (angle: number) => {
    parts.begin()
    parts.at(MAILBOX.x, 0, MAILBOX.z, MAILBOX.heading)
    parts.put('body', 0, 0, 0)
    parts.put('flag', MAIL_FLAG.at[0], MAIL_FLAG.at[1], MAIL_FLAG.at[2], angle)
    parts.end()
  }

  useEffect(() => {
    // ?debug: the flag's angle now (up while a letter waits), and whether it casts as one mesh
    debugSet('mailbox', { flag: () => flag.current.angle, up: MAIL_FLAG.up, down: MAIL_FLAG.down, castsAsOne: () => !!sun.current })
    return () => {
      sun.current?.release()
      sun.current = null
      parts.dispose()
    }
  }, [parts])

  useFrame((_, rawDt) => {
    const f = flag.current
    const to = lettersWaiting().length ? MAIL_FLAG.up : MAIL_FLAG.down
    const moving = Math.abs(f.angle - to) > STILL
    if (!f.posed || moving) {
      // it swings: it casts on its own until it stands still again
      sun.current?.release()
      sun.current = null
      f.angle = moving ? MathUtils.damp(f.angle, to, SWING, Math.min(rawDt, 0.1)) : to
      if (Math.abs(f.angle - to) <= STILL) f.angle = to
      pose(f.angle)
      f.posed = true
    }
    if (!sun.current && f.angle === to) {
      root.updateMatrixWorld(true)
      sun.current = castAsOne(root)
    }
  })

  useInteractable({
    id: 'farm-mailbox',
    position: [MAILBOX.x, 1.0, MAILBOX.z],
    aim: [MAILBOX.x, MAILBOX_TOP, MAILBOX.z],
    // it stands on the lane side of the fence, and is read over it from the garden too (as the line at the gate)
    spaces: ['out', 'lane'],
    radius: MAILBOX_REACH,
    enabled: () => lettersWaiting().length > 0,
    label: readLabel,
    icon: () => ({ verb: 'talk', word: 'Read', art: 'love-letter', count: lettersWaiting().length }),
    ready: () => (MARKED && lettersWaiting().length ? { item: 'mailbox', count: lettersWaiting().length } : null),
    run: () => openPanel({ kind: 'letter' }),
  })

  return (
    <group name="farm-mailbox">
      <primitive object={root} />
      <RigidBody type="fixed" colliders={false} position={[MAILBOX.x, 0, MAILBOX.z]}>
        {/* the post and the box on it (its door towards the lane) */}
        <CuboidCollider args={[0.12, 0.62, 0.26]} position={[0, 0.62, 0.03]} />
      </RigidBody>
      <LetterWatcher />
    </group>
  )
}
