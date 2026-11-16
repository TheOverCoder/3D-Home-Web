import { Shape, type V3 } from '../../src/lib/sculpt'

// A lathe whose rings all share one frame (the kit's lathe turns each ring to its spine, so a profile that turns back
// on itself — a hat's brim out along the underside and back along the top, a pine's tier — would twist): for the 3D
// designer's proposals, closed round shapes in one piece.

/** Round about the vertical axis from a profile [radius, height], bottom to top round the outside (a radius of 0 at
 *  an end closes it at a point), every ring in one frame (so a profile may turn back on itself: a tier's underside
 *  and top). `ring(i, a)` scales ring i's radius at angle a and `lift` raises it (ragged, drooping bough tips); `paint`
 *  colours it by ring. */
export function spin(
  profile: [number, number][],
  seg: number,
  o: { ring?: (i: number, a: number) => number; lift?: (i: number, a: number) => number; paint?: (i: number, a: number) => V3 } = {},
): Shape {
  const s = new Shape()
  const first: number[] = []
  const pole = (i: number) => profile[i][0] === 0 && (i === 0 || i === profile.length - 1)
  profile.forEach(([radius, y], i) => {
    first.push(s.count)
    if (pole(i)) {
      s.vertex(0, y, 0, o.paint?.(i, 0))
      return
    }
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2
      const rr = radius * (o.ring?.(i, a) ?? 1)
      s.vertex(Math.cos(a) * rr, y + (o.lift?.(i, a) ?? 0), Math.sin(a) * rr, o.paint?.(i, a))
    }
  })
  for (let i = 0; i < profile.length - 1; i++) {
    for (let k = 0; k < seg; k++) {
      const k1 = (k + 1) % seg
      if (pole(i)) s.tri(first[i], first[i + 1] + k, first[i + 1] + k1)
      else if (pole(i + 1)) s.tri(first[i] + k, first[i + 1], first[i] + k1)
      else {
        s.tri(first[i] + k, first[i + 1] + k, first[i] + k1)
        s.tri(first[i] + k1, first[i + 1] + k, first[i + 1] + k1)
      }
    }
  }
  return s
}
