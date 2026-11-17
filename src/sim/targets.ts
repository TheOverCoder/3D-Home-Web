// The pace a new farm is held to (src/sim/pace.test.ts, played by src/sim/play.ts; `npm run sim` prints it).
//
// What a well-paced casual farm game does in its first hours: a first reward within the first few minutes, a level
// every few minutes through the first session, then each level a little longer, so that the first hour brings about
// ten and the second a few more. A first session lasts about nine minutes on average, and games whose first session
// runs longer keep more players the next day (31 % against 20 %: deltaDNA's study of over 5,000 games, "How first
// session length impacts game performance", Game Developer); the first ten minutes decide whether a player comes back
// (Google Play, "Why the first ten minutes are crucial if you want to keep players coming back to your mobile game").
// Hay Day's levels have the same shape: a few XP each to the first ones, about a thousand to level 10. The bands are
// for the simulation's player, who never dawdles: a real one gets there later.

export const PACE = {
  /** the minutes of play by which each level is reached: [no sooner than, no later than] */
  levels: {
    2: [0, 3],
    3: [1, 6],
    4: [3, 10],
    5: [5, 15],
    6: [8, 20],
    7: [11, 26],
    8: [14, 32],
    9: [18, 40],
    10: [22, 48],
    11: [27, 57],
    12: [32, 67],
    13: [38, 78],
    14: [44, 90],
    15: [50, 105],
  } as Record<number, readonly [number, number]>,
  /** in the first `within` minutes, no stretch with nothing useful to do longer than `most` minutes */
  idle: { within: 60, most: 5 },
  /** each animal's tool (plans/animal-tools.md) is bought within `within` minutes of play after its herd is full */
  tools: { within: 20 },
} as const
