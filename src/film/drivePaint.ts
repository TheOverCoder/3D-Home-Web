import { Color } from 'three'

// The car's paint in the drive's film (an instance colour over its red: src/models/car.ts, paintTint): your car's, set
// as a trip begins (src/scene/travel.ts) without loading the film; red, as made, until then (the lab's film boards).

export const drivePaint = new Color(1, 1, 1)
export function setDrivePaint(tint: readonly [number, number, number]) {
  drivePaint.setRGB(tint[0], tint[1], tint[2])
}
