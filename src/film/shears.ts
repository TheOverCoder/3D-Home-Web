import type { ToolStyle } from '../models/tools'
import type { Film } from './format'
import { beats, build, carryIn, establish, lens, setDown } from './kit'
import { toolEnd } from './tools'

// "Next!": the shears bought in the farm shop (plans/animal-tools.md: the sheep's tool, shears and a wool basket by the
// fold's gate post, so the flock's wool is taken there instead of chasing each sheep). A film of the style the player
// chose for it (src/models/tools.ts).
//
// The turn: at the start the flock runs from your shears and you chase Dolly round the pen; at the end it waits in a
// line at the gate for them, like customers at a barber's, and Dolly sits in the chair.
// Logline: the player creeps up on Dolly with the shears, she bolts and the chase is lost; the contractor says sheep
// always run, and then the flock queues up for a haircut.
// Who doubts: the contractor ("Sheep run. Every time."). Suspense before surprise: the creep on tiptoe (the sneak's
// plucked strings), the snip, snip in the air, her head coming up. The look into the lens: Dolly when she hears the
// snip, and Dolly shorn. The callback: the game's own shearing snip and the flock's names (Dolly first:
// src/farm/data.ts). The twist (kishōtenketsu's third beat): not a beat drop but the shop's muzak — a waiting room — and
// the flock walks out of the gate and lines up. The button: the player's one line, the barber's "Next!". What the player
// got: the shears and the basket, the build's XP, and its two ladders' first steps.
// Where: the pen's set (./set.ts, PEN): the creep and the chase inside it, filmed from inside and from above the fence;
// the stand outside the fence by the gate, filmed from the lane's side; noon light.

export function shearsFilm(style: ToolStyle = 'a'): Film {
  const flock = ['pnina', 'lulu', 'tzipi']
  return {
    id: 'shears',
    title: 'Next!',
    logline: 'The player creeps up on Dolly with the shears, she bolts and the chase is lost; the contractor says sheep always run, and then the flock queues up for a haircut.',
    turn: 'The flock runs from your shears; at the end it waits in a line at the gate for them, and Dolly sits in the chair.',
    herd: 'sheep',
    style,
    cast: {
      you: { name: 'You', look: 'player', at: 'creep-from' },
      guy: { name: 'Contractor', look: 'contractor', at: 'east', off: true },
      dolly: { name: 'Dolly', look: { herd: 0 }, at: 'graze' },
      pnina: { name: 'Pnina', look: { herd: 1 }, at: 'field-0' },
      lulu: { name: 'Lulu', look: { herd: 2 }, at: 'field-2' },
      tzipi: { name: 'Tzipi', look: { herd: 3 }, at: 'field-5' },
    },
    props: {
      // the old shears in your hand (the tool's own, alone)
      clip: { kind: 'piece', piece: 'shears', on: 'you' },
      crate: { kind: 'crate', on: 'guy' },
      tool: { kind: 'tool', on: 'tool', open: 0, show: '0' },
    },
    scenes: [
      {
        place: 'pen',
        light: 'noon',
        line: ['you', 'guy'],
        side: -1,
        shots: [
          {
            // say where: noon in the pen, Dolly grazing, you creeping up on her on tiptoe, the shears up
            len: 3.2,
            cam: { on: ['dolly', 'you'], from: -30, size: 'full' },
            do: [
              { at: 0, who: 'you', pose: 'sneak' },
              { at: 0.1, who: 'you', to: 'creep', pace: 0.5 },
            ],
            hear: [{ at: 0, music: 'sneak' }],
          },
          {
            // snip, snip, in the air
            len: 1.7,
            cam: { on: 'you', from: 60, size: 'medium', move: 'push' },
            do: [
              { at: 0.2, who: 'you', pose: 'snap' },
              { at: 0.85, who: 'you', pose: 'stand' },
              { at: 0.95, who: 'you', pose: 'snap' },
            ],
            hear: [
              { at: 0.45, sting: 'shear' },
              { at: 1.2, sting: 'shear' },
            ],
          },
          {
            // her head comes up, and she looks at us: the music stops
            len: 1.6,
            cam: lens('dolly', 'close'),
            do: [
              { at: 0.15, who: 'dolly', pose: 'surprise' },
              { at: 0.15, who: 'dolly', face: 135 },
            ],
            hear: [{ at: 0.1, music: 'stop' }],
          },
          {
            // she bolts, and the flock with her; you go after her
            len: 2.0,
            cam: { on: ['you', 'dolly'], from: -20, size: 'wide', angle: 'high' },
            do: [
              { at: 0, who: 'dolly', to: 'lap-2', pace: 3.4 },
              { at: 0.1, who: 'pnina', to: { x: -4.6, z: 25.3 }, pace: 3.0 },
              { at: 0.15, who: 'lulu', to: { x: -1.0, z: 24.8 }, pace: 3.0 },
              { at: 0.05, who: 'tzipi', to: { x: -2.4, z: 23.3 }, pace: 3.1 },
              { at: 0, who: 'you', pose: 'surprise' },
              { at: 0.7, who: 'you', pose: 'stand' },
              { at: 0.75, who: 'you', to: 'lap-2', pace: 2.8 },
            ],
            hear: [
              { at: 0.02, sting: 'scratch' },
              { at: 0.1, sting: 'whoosh' },
              { at: 0.35, sting: 'baa' },
              { at: 0.8, music: 'beat' },
            ],
            fx: [
              { at: 0.05, fx: 'dust', on: 'dolly' },
              { at: 0.1, fx: 'tufts', on: 'dolly' },
            ],
          },
          {
            // the chase, from above the fence: round the pen, and she keeps ahead
            len: 3.4,
            cam: { ...establish('pen', 0), size: 'wide', move: 'drift' },
            do: [
              { at: 0, who: 'dolly', to: ['lap-3', 'lap-0', 'lap-1', { x: -4.9, z: 24.7, heading: 2.4 }], pace: 3.2 },
              { at: 0.3, who: 'you', to: ['lap-2', 'lap-3', { x: -3.3, z: 23.2 }], pace: 2.9 },
            ],
            hear: [
              { at: 0.4, sting: 'baa' },
              { at: 1.9, sting: 'baa' },
            ],
            fx: [
              { at: 0.6, fx: 'dust', on: 'dolly' },
              { at: 1.8, fx: 'dust', on: 'you' },
            ],
          },
          {
            // out of breath; she grazes, a few steps off, as if nothing happened
            len: 2.2,
            cam: { on: ['dolly', 'you'], from: 60, size: 'full' },
            do: [
              { at: 0, who: 'you', pose: 'stoop' },
              { at: 1.2, who: 'you', pose: 'hips' },
              { at: 0, who: 'you', face: 'dolly' },
              { at: 0, who: 'dolly', pose: 'stand' },
            ],
            hear: [{ at: 0.1, music: 'stop' }],
          },
          // the doubt, at the gate: the contractor with the crate
          carryIn({
            who: 'guy',
            crate: 'crate',
            len: 3.2,
            pace: 1.35,
            say: { at: 0.7, text: 'Sheep run. Every time.', mood: 'flat', hold: 2.0 },
            also: [
              { at: 0, who: 'you', put: 'out-gate' },
              { at: 0.2, who: 'you', to: 'tool-east', pace: 1.2 },
              { at: 0, who: 'dolly', put: 'in-gate' },
              { at: 0, who: 'dolly', pose: 'stand' },
              { at: 0, who: 'you', pose: 'slump' },
            ],
          }),
          setDown({ who: 'guy', crate: 'crate' }),
          build({
            tool: 'tool',
            crate: 'crate',
            look: 'shears',
            style,
            cam: { from: -10 },
            also: [{ at: 0, who: 'you', face: 'tool' }],
          }),
          {
            // not a beat: the waiting room's muzak. Dolly comes out of the gate and sits in the chair
            len: 3.0,
            cam: { on: ['dolly', 'tool'], from: 25, size: 'full' },
            do: [
              { at: 0.3, who: 'dolly', to: ['out-gate', 'chair'], pace: 1.0, face: 180 },
              { at: 0, who: 'you', pose: 'stand' },
            ],
            hear: [{ at: 0, music: 'muzak', sting: 'swell' }],
            fx: [{ at: 0.2, fx: 'sparkle' }],
          },
          {
            // and the flock lines up behind her
            len: 2.8,
            cam: { on: ['pnina', 'tool'], from: 15, size: 'wide', angle: 'high' },
            do: flock.map((who, k) => ({ at: 0.1 + k * 0.35, who, to: ['in-gate', 'out-gate', `queue-${k}`], pace: 1.5 + k * 0.25, face: 90 })),
            hear: beats(0.8, 0.7, 2, 'baa'),
          },
          {
            // the two of you: he scratches his head
            len: 2.0,
            cam: { on: ['guy', 'you'], from: 'side', size: 'medium' },
            do: [
              { at: 0.2, who: 'guy', face: 'you' },
              { at: 0.5, who: 'guy', pose: 'scratch' },
              { at: 0.6, who: 'you', pose: 'shrug' },
            ],
          },
          {
            // the haircut: snip, snip, snip, the wool off her in three, the basket filling
            len: 3.0,
            cam: { on: ['dolly', 'you'], from: -35, size: 'medium' },
            do: [
              { at: 0, who: 'you', to: 'barber', pace: 1.0, face: 'dolly' },
              { at: 0.6, who: 'you', pose: 'snap' },
              { at: 0.9, who: 'dolly', wool: 0.65, over: 0.3 },
              { at: 1.5, who: 'dolly', wool: 0.32, over: 0.3 },
              { at: 2.1, who: 'dolly', wool: 0, over: 0.3 },
            ],
            props: [{ at: 2.3, prop: 'tool', show: '1' }],
            hear: [...beats(0.9, 0.6, 3, 'shear'), { at: 2.3, sting: 'pop' }],
            fx: [
              { at: 0.9, fx: 'tufts', on: 'dolly' },
              { at: 1.5, fx: 'tufts', on: 'dolly' },
              { at: 2.1, fx: 'tufts', on: 'dolly' },
            ],
          },
          {
            // Dolly, shorn, looks up at us
            len: 1.7,
            cam: lens('dolly', 'close'),
            do: [{ at: 0, who: 'dolly', pose: 'surprise' }],
            hear: [{ at: 0.9, sting: 'baa' }],
          },
          {
            // the button: the barber's call
            len: 2.6,
            cam: { on: ['you', 'pnina'], from: -40, size: 'full', angle: 'low' },
            do: [
              { at: 0, who: 'dolly', to: { x: 3.4, z: 19.2 }, pace: 1.2 },
              { at: 0.4, who: 'you', pose: 'point' },
              { at: 1.3, who: 'pnina', to: 'chair', pace: 0.8, face: 180 },
            ],
            say: [{ at: 0.45, who: 'you', text: 'Next!', mood: 'cool', hold: 1.4 }],
          },
        ],
      },
    ],
    end: toolEnd({
      art: 'scissors',
      title: 'The shears are yours',
      ribbon: 'Next!',
      owns: [
        { art: 'scissors', text: 'Shears' },
        { art: 'yarn', text: 'Wool basket' },
      ],
      place: 'sheep',
    }),
  }
}

/** The film in the style every farm starts with (a); the player's own skin is `shearsFilm(style)`. */
export const SHEARS = shearsFilm()
