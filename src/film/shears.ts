import type { Film } from './format'
import { toolEnd } from './tools'

// "Next!": the shears bought in the farm shop (plans/animal-tools.md: the sheep's tool, shears and a wool basket by the
// fold's gate post, so the flock's wool is taken there instead of chasing each sheep).
//
// The turn: at the start the flock runs from your shears; at the end it waits in a line at the gate for them, like
// customers at a barber's.
// Logline: the flock scatters at the first snip; the contractor says sheep always run, and then they queue up for a
// haircut.
// Who doubts: the contractor ("Sheep run. Every time."). The callback: the game's own shearing snip (the sound of the
// shears in play) and the flock's names (Dolly first: src/farm/data.ts). The button: the player's one line, the
// barber's "Next!", over the waiting room's music. What the player got: the shears and the basket, the build's XP, and
// its two ladders' first steps.
// Beats (lab/FILM.md): enter late, mid-creep · snip, snip · she looks up, at us (a held beat) · the flock scatters, the
// music torn off · the doubt, as the crate comes in shut · it lands, opens, and the basket and the shears rise by the
// post · a silence, then not a beat but the shop's muzak (the contrast is the joke): the flock walks back and lines up
// at the gate · "Next!".
// Where: the pen's set (./set.ts, PEN), filmed from the lane's side, the woods behind; noon light.

export const SHEARS: Film = {
  id: 'shears',
  title: 'Next!',
  logline: 'The flock scatters at the first snip; the contractor says sheep always run, and then they queue up for a haircut.',
  turn: 'The flock runs from your shears; at the end it waits in a line at the gate for them.',
  herd: 'sheep',
  cast: {
    you: { name: 'You', look: 'player', at: 'creep-from' },
    guy: { name: 'Contractor', look: 'contractor', at: 'east', off: true },
    dolly: { name: 'Dolly', look: { herd: 0 }, at: 'milk' },
    pnina: { name: 'Pnina', look: { herd: 1 }, at: 'field-0' },
    lulu: { name: 'Lulu', look: { herd: 2 }, at: 'field-2' },
    tzipi: { name: 'Tzipi', look: { herd: 3 }, at: 'field-5' },
  },
  props: {
    crate: { kind: 'crate', on: 'guy' },
    tool: { kind: 'tool', on: 'post', open: 0, show: '0' },
  },
  scenes: [
    {
      place: 'pen',
      light: 'noon',
      line: ['you', 'guy'],
      side: -1,
      shots: [
        {
          // say where: the pen at noon, Dolly grazing, you creeping up behind her: snip, snip
          len: 2.4,
          cam: { on: ['dolly', 'you'], from: 15, size: 'full' },
          do: [
            { at: 0, who: 'you', to: 'creep', pace: 0.5 },
            { at: 0.9, who: 'you', pose: 'snap' },
          ],
          hear: [
            { at: 0, music: 'tension' },
            { at: 1.3, sting: 'shear' },
            { at: 1.75, sting: 'shear' },
          ],
        },
        {
          // she looks up, at us
          len: 1.3,
          cam: { on: 'dolly', from: 0, size: 'medium' },
          do: [{ at: 0.1, who: 'dolly', pose: 'surprise' }],
        },
        {
          // the flock scatters, the music torn off
          len: 1.8,
          cam: { on: ['you', 'dolly'], from: 20, size: 'wide', angle: 'high' },
          do: [
            { at: 0, who: 'dolly', to: 'corner-2', pace: 2.8 },
            { at: 0.1, who: 'pnina', to: 'corner-0', pace: 2.6 },
            { at: 0.15, who: 'lulu', to: 'corner-1', pace: 2.6 },
            { at: 0.05, who: 'tzipi', to: 'corner-3', pace: 2.7 },
            { at: 0.6, who: 'you', pose: 'shrug' },
          ],
          hear: [
            { at: 0.02, sting: 'scratch', music: 'stop' },
            { at: 0.1, sting: 'whoosh' },
            { at: 0.35, sting: 'baa' },
          ],
        },
        {
          // the doubt, as the crate comes in shut
          len: 2.4,
          cam: { on: 'guy', size: 'medium' },
          do: [
            { at: 0, who: 'guy', put: 'east' },
            { at: 0, who: 'guy', pose: 'box' },
            { at: 0, who: 'guy', to: 'aside', pace: 1.6 },
            { at: 0, who: 'you', put: 'outside' },
            { at: 0, who: 'you', pose: 'stand' },
            { at: 0, who: 'dolly', pose: 'stand' },
          ],
          say: [{ at: 0.4, who: 'guy', text: 'Sheep run. Every time.', mood: 'flat', hold: 1.9 }],
        },
        {
          // it lands, opens, and the basket and the shears rise by the post
          len: 2.6,
          cam: { on: 'tool', from: 0, size: 'medium' },
          props: [
            { at: 0, prop: 'crate', on: 'drop' },
            { at: 0.3, prop: 'crate', open: 1, over: 0.5 },
            { at: 0.8, prop: 'tool', open: 1, over: 0.9 },
          ],
          do: [
            { at: 0, who: 'guy', pose: 'stand' },
            { at: 0.5, who: 'guy', to: 'east', pace: 1.1 },
          ],
          hear: [
            { at: 0.04, sting: 'thud' },
            { at: 0.32, sting: 'whoosh' },
            { at: 0.8, sting: 'riser' },
            { at: 1.25, sting: 'clunk' },
            { at: 1.7, sting: 'shear' },
            { at: 2.2, music: 'stop' },
          ],
          fx: [{ at: 1.75, fx: 'glint' }],
        },
        {
          // not the beat: the waiting room's music, and the flock walks back and lines up at the gate
          len: 2.8,
          cam: { on: ['dolly', 'pnina'], from: 30, size: 'full', angle: 'high' },
          props: [{ at: 2.0, prop: 'tool', show: '1' }],
          do: [
            // (back from the corners while the crate was opened: in a column behind the gate, then out and into a line)
            { at: 0, who: 'dolly', put: 'in-gate' },
            { at: 0, who: 'pnina', put: { x: -1.5, z: 23.1, heading: Math.PI } },
            { at: 0, who: 'lulu', put: { x: -1.5, z: 24.3, heading: Math.PI } },
            { at: 0, who: 'tzipi', put: { x: -1.5, z: 25.5, heading: Math.PI } },
            { at: 0, who: 'dolly', to: ['gate', 'queue-0'], pace: 1.1 },
            { at: 0, who: 'pnina', to: ['in-gate', 'gate', 'queue-1'], pace: 1.3 },
            { at: 0, who: 'lulu', to: ['in-gate', 'gate', 'queue-2'], pace: 1.9 },
            { at: 0, who: 'tzipi', to: ['in-gate', 'gate', 'queue-3'], pace: 2.0 },
            { at: 0, who: 'you', put: 'barber' },
            { at: 0, who: 'you', pose: 'cool' },
          ],
          hear: [
            { at: 0, music: 'muzak', sting: 'swell' },
            { at: 2.0, sting: 'shear' },
          ],
          fx: [{ at: 0.1, fx: 'sparkle' }],
        },
        {
          // the button: the barber's call, from low
          len: 2.4,
          cam: { on: ['you', 'dolly'], from: -50, size: 'full', angle: 'low' },
          props: [{ at: 0.2, prop: 'tool', show: '2' }],
          say: [{ at: 0.5, who: 'you', text: 'Next!', mood: 'cool', hold: 1.4 }],
          do: [{ at: 0.1, who: 'you', pose: 'point' }],
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
