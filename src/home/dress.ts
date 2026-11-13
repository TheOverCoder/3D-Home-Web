// The wardrobe's dressing view (./Wardrobe.tsx), shared without React: how far the camera has gone from your eyes to
// film you (0..1; the avatar shows its head once it has left them), whether it is there with you turned round
// (`settled`: what a test waits for), and the part of the screen the wardrobe's sheet leaves free, in normalised device
// coordinates (./WardrobePanel.tsx measures it; the camera frames you in it).
export const dressView = { blend: 0, settled: false, free: { x0: -1, x1: 1, y0: -1, y1: 1 } }
