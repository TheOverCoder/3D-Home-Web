import type { ToolStyle } from '../models/tools'
import type { Film } from './format'
import { beats, build, carryIn, lens, setDown } from './kit'
import { toolEnd } from './tools'

// "Out of Reach": the milk bucket bought in the farm shop (plans/animal-tools.md: the cows' tool, by the pasture's gate
// post, so the herd's milk is taken there instead of chasing each cow round the field). A film of the style the player
// chose for it (src/models/tools.ts).
//
// The turn: at the start the pail is Daisy's to kick, three times running (the third lands on your head); at the end
// it stands on its stand behind the fence, out of her reach, she kicks at nothing, and the herd's milk fills it.
// Logline: Daisy kicks over three pails in a row, the third onto the player's head; the fourth is hung up on a stand,
// and all she can do is moo.
// Who doubts: the contractor, at the player with a pail on his head ("Hang it up? She'll kick that too."). The rule of
// three: pail one flies, pail two flies out of the pen (a crash far away), pail three comes down on the player's head.
// The callback: the herd's own names (Bella, Mazal, Daisy: src/farm/data.ts) and the game's milking sound. The look into
// the lens: Daisy after the first kick, and after the kick at nothing. The button: the player's one line, a dare
// ("Kick it now, Daisy."), and her long, defeated moo. What the player got: the bucket, the herd's milk at the post, the
// build's XP, and its two ladders' first steps.
// Where: the pen's set (./set.ts, PEN): the milking inside it, filmed from inside looking at the woods; the stand
// outside the fence by the gate, filmed from the lane's side; evening light.

export function bucketFilm(style: ToolStyle = 'a'): Film {
  /** where each kicked pail comes down: west on the grass, out over the north fence */
  const land1 = { x: -2.3, z: 23.35, heading: 1.2 }
  const far = { x: -6.2, z: 17.4, heading: 0.4 }
  const stand = build({ tool: 'tool', crate: 'crate', look: 'pail', style, cam: { from: 10 } })
  return {
    id: 'bucket',
    title: 'Out of Reach',
    logline: 'Daisy kicks over three pails in a row, the third onto the player’s head; the fourth is hung up on a stand, and all she can do is moo.',
    turn: 'The pail is Daisy’s to kick, three times running; at the end it stands out of her reach, she kicks at nothing, and the milk fills it.',
    herd: 'cows',
    style,
    cast: {
      you: { name: 'You', look: 'player', at: 'milker' },
      guy: { name: 'Contractor', look: 'contractor', at: 'east', off: true },
      daisy: { name: 'Daisy', look: { herd: 2 }, at: 'milk' },
      bella: { name: 'Bella', look: { herd: 0 }, at: { x: 0.4, z: 26.0, heading: 2.2 } },
      mazal: { name: 'Mazal', look: { herd: 1 }, at: { x: -0.9, z: 26.25, heading: -0.6 } },
    },
    props: {
      // her pail, on the ground by her hind legs (the tool's own pail, alone)
      pail: { kind: 'piece', piece: 'pail', on: 'pail' },
      crate: { kind: 'crate', on: 'guy' },
      tool: { kind: 'tool', on: 'tool', open: 0, show: '0' },
    },
    scenes: [
      {
        place: 'pen',
        light: 'evening',
        line: ['you', 'guy'],
        side: -1,
        shots: [
          {
            // say where: the pen in the evening, you crouched milking Daisy, the shop's muzak in your head
            len: 3.0,
            cam: { on: ['daisy', 'you'], from: 70, size: 'full', move: 'push' },
            caption: 'Pail No. 1',
            do: [{ at: 0, who: 'you', pose: 'crouch' }],
            hear: [{ at: 0, music: 'muzak' }, ...beats(0.6, 0.8, 3, 'milk')],
          },
          {
            // suspense: the pail by her hind legs; her head comes up; tick, tick
            len: 1.8,
            cam: { on: 'pail', from: 160, size: 'medium', angle: 'low' },
            do: [{ at: 0.5, who: 'daisy', pose: 'surprise' }],
            hear: beats(0.7, 0.5, 2, 'tick'),
          },
          {
            // the kick, on the cut: the pail flies, the milk with it, the music torn off
            len: 1.7,
            cam: { on: ['daisy', 'pail'], from: 110, size: 'full', shake: 0.6 },
            do: [
              { at: 0.05, who: 'daisy', pose: 'kick' },
              { at: 0.2, who: 'you', pose: 'flinch' },
            ],
            props: [{ at: 0.1, prop: 'pail', to: land1, show: 'tipped', over: 0.65 }],
            hear: [
              { at: 0.08, sting: 'clunk' },
              { at: 0.1, sting: 'scratch', music: 'stop' },
              { at: 0.75, sting: 'thud' },
            ],
            fx: [
              { at: 0.15, fx: 'splash', on: 'pail' },
              { at: 0.78, fx: 'splash', on: 'pail' },
            ],
          },
          {
            // her look into the lens: nothing happened
            len: 1.5,
            cam: lens('daisy'),
            do: [
              { at: 0, who: 'daisy', pose: 'stand' },
              { at: 0, who: 'daisy', face: 135 },
            ],
            hear: [{ at: 0.75, sting: 'moo' }],
          },
          {
            // pail two: back to it, the muzak again … and away it goes, out of the pen
            len: 2.6,
            cam: { on: 'you', from: 60, size: 'medium' },
            caption: 'Pail No. 2',
            do: [
              { at: 0, who: 'daisy', face: 90 },
              { at: 0, who: 'you', pose: 'crouch' },
              { at: 1.5, who: 'daisy', pose: 'kick' },
              { at: 1.75, who: 'you', pose: 'freeze' },
            ],
            props: [
              { at: 0, prop: 'pail', on: 'pail', show: '' },
              { at: 1.55, prop: 'pail', to: far, show: 'tipped', over: 1.6 },
            ],
            hear: [
              { at: 0, music: 'muzak' },
              { at: 0.6, sting: 'milk' },
              { at: 1.55, sting: 'clunk' },
              { at: 1.6, sting: 'whoosh', music: 'stop' },
            ],
            fx: [{ at: 1.6, fx: 'splash', on: 'pail' }],
          },
          {
            // the held beat: you, frozen; far away, a crash, and a moo of complaint
            len: 1.7,
            cam: { on: 'you', from: 40, size: 'close' },
            hear: [
              { at: 1.0, sting: 'thud' },
              { at: 1.25, sting: 'moo' },
            ],
          },
          {
            // pail three: you watch her … nothing … one squirt … and it comes down on your head
            len: 3.0,
            cam: { on: ['you', 'daisy'], from: 50, size: 'full' },
            caption: 'Pail No. 3',
            do: [
              { at: 0, who: 'you', pose: 'crouch' },
              { at: 0.1, who: 'you', face: 'daisy' },
              { at: 1.25, who: 'you', face: 90 },
              { at: 1.6, who: 'daisy', pose: 'kick' },
              { at: 1.8, who: 'you', pose: 'surprise' },
              { at: 2.45, who: 'you', pose: 'stand' },
            ],
            props: [
              { at: 0, prop: 'pail', on: 'pail', show: '' },
              { at: 1.65, prop: 'pail', to: 'you', show: 'head', over: 0.75 },
            ],
            hear: [
              { at: 1.3, sting: 'milk' },
              { at: 1.65, sting: 'clunk' },
              { at: 2.4, sting: 'bonk' },
              { at: 2.55, sting: 'slide' },
            ],
            fx: [{ at: 2.4, fx: 'stars', on: 'you' }],
          },
          {
            // the laugh is in the reaction: you, the pail over your eyes, stars round it; she chews
            len: 1.7,
            cam: { on: 'you', from: 25, size: 'medium', move: 'punch' },
            hear: [{ at: 0.9, sting: 'moo' }],
          },
          // the doubt, at the gate: the contractor with the crate, and you coming out with the pail on your head
          carryIn({
            who: 'guy',
            crate: 'crate',
            len: 3.2,
            pace: 1.35,
            cam: { from: -20 },
            say: { at: 0.7, text: 'Hang it up? She’ll kick that too.', mood: 'smug', hold: 2.2 },
            also: [
              { at: 0, who: 'you', put: 'out-gate' },
              { at: 0, who: 'you', pose: 'stand' },
              { at: 0.2, who: 'you', to: 'tool-east', pace: 1.0 },
              { at: 0, who: 'daisy', put: { x: -2.6, z: 23.4, heading: 0.6 } },
            ],
          }),
          // (he has nothing more to do here: he goes)
          setDown({ who: 'guy', crate: 'crate', away: 'east' }),
          {
            // the pail off your head and tossed away, and the stand goes up out of the crate
            ...stand,
            do: [
              { at: 0, who: 'you', pose: 'surprise' },
              { at: 0.45, who: 'you', pose: 'stand' },
              { at: 0.6, who: 'you', face: 'tool' },
            ],
            props: [...(stand.props ?? []), { at: 0.15, prop: 'pail', to: { x: -1.6, z: 19.4, heading: 2 }, show: 'tipped', over: 0.55 }],
          },
          {
            // the suspense: Daisy comes to the fence behind it, turns her back on it … tick, tick
            len: 2.8,
            cam: { on: ['tool', 'daisy'], from: 25, size: 'full' },
            do: [
              { at: 0, who: 'daisy', to: { x: 0.0, z: 22.15 }, pace: 1.1 },
              { at: 1.7, who: 'daisy', face: -10 },
            ],
            hear: [{ at: 0, music: 'tension' }, ...beats(1.9, 0.4, 2, 'tick')],
          },
          {
            // the kick at nothing: her hoof swings through the air, the stand does not move
            len: 1.5,
            cam: { on: ['daisy', 'tool'], from: -140, size: 'full' },
            do: [{ at: 0.15, who: 'daisy', pose: 'kick' }],
            hear: [
              { at: 0.1, music: 'stop' },
              { at: 0.2, sting: 'whoosh' },
            ],
          },
          {
            // she turns round, and looks into the lens (past the stand's roof)
            len: 1.8,
            cam: { ...lens('daisy', 'close'), from: 30 },
            do: [
              { at: 0, who: 'daisy', pose: 'stand' },
              { at: 0, who: 'daisy', face: 180 },
            ],
          },
          {
            // the drop: the herd comes to the fence by the stand, and the milk fills it
            len: 3.0,
            cam: { on: ['tool', 'bella'], from: 20, size: 'full', angle: 'high' },
            do: [
              { at: 0, who: 'bella', to: { x: -0.45, z: 22.0 }, pace: 1.5, face: 180 },
              { at: 0.1, who: 'mazal', to: { x: -1.5, z: 22.35 }, pace: 1.6, face: 180 },
              { at: 0, who: 'you', pose: 'cool' },
            ],
            props: [
              { at: 1.4, prop: 'tool', show: '1' },
              { at: 1.9, prop: 'tool', show: '2' },
              { at: 2.4, prop: 'tool', show: '3' },
            ],
            hear: [{ at: 0, music: 'beat', sting: 'drop' }, ...beats(1.4, 0.5, 3, 'milk')],
            fx: [
              { at: 0, fx: 'flash' },
              { at: 2.45, fx: 'sparkle' },
            ],
          },
          {
            // the button: the dare, without looking at her; a held beat; her long, defeated moo
            len: 3.0,
            cam: { on: ['you', 'daisy'], from: 10, size: 'full', angle: 'low' },
            do: [{ at: 0, who: 'you', face: 180 }],
            say: [{ at: 0.3, who: 'you', text: 'Kick it now, Daisy.', mood: 'cool', hold: 1.6 }],
            hear: [
              { at: 1.95, music: 'stop' },
              { at: 2.2, sting: 'moo' },
              { at: 2.25, sting: 'trombone' },
            ],
          },
        ],
      },
    ],
    end: toolEnd({
      art: 'bucket',
      title: 'The bucket is yours',
      ribbon: 'No more kicks',
      owns: [
        { art: 'bucket', text: 'Milk bucket' },
        { art: 'droplet', text: 'Milk at the post' },
      ],
      place: 'cow',
    }),
  }
}

/** The film in the style every farm starts with (a); the player's own skin is `bucketFilm(style)`. */
export const BUCKET = bucketFilm()
