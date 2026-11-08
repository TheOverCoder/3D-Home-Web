// The sculpt kit: models made in code, in one consistent style — no downloads, a few kilobytes of code each,
// one small geometry per moving part, instanced by the hundred. How to make a new model:
//
//   1. Build its parts from the shapes (shapes.ts): `loft` for anything organic (rings along a spine — a body, a
//      head, a limb; `round` closes an end with a smooth dome, `squircle` squares the rings), `lathe` for round
//      things, `tube` for stems and tails, `blade` for leaves, `blob` for lumps, `ellipsoid` for eyes and beads.
//   2. Colour them (core.ts): `paint` the base, `pattern` a second colour with a crisp edge (patches, seeds,
//      stripes), `blend` soft markings over both, `shade` darker where light does not reach. Give a vertex tint 1
//      where an instance's own colour should apply (a coat, a shirt, ripening fruit) and 0 where it must not (eyes,
//      hooves, a calyx).
//   3. Build each part round its joint (the point it turns about, at the origin), merge what moves together, and
//      hand the geometries to `Parts` (parts.ts): one instanced draw per part, posed per frame with `at` and `put`.
//      The material (material.ts) takes `detail` for bumps finer than a vertex (wool, cloth, feathers) and `leaf`
//      for thin leaves lit on both sides.
//   4. Add it to the gallery (src/models/gallery.ts, open the site with ?gallery) to look at it from every side.
//
// The animals, people and crops in src/models/ are the examples to copy from.

export { Shape, merge, rgb, mixRgb, noise3, fbm3, random, smoothstep, type V3 } from './core'
export { loft, lathe, tube, ellipsoid, blade, blob, squircle, type Ring, type LoftOptions, type BladeOptions } from './shapes'
export { sculptMaterial, setSculptDetail, type SculptMaterialOptions } from './material'
export { Parts, shadowPart, type PartDef } from './parts'
export { checkPieces, checkPose, posedPieces, piecesOf, describeIssue, type Issue, type CheckOptions, type Piece } from './check'
