import type { PieceType } from './catalogue'

// The furniture's pictures: each drawn from the piece itself (src/home/FurnitureArtPage.tsx) and saved as a WebP
// file in src/assets/furniture by scripts/render-furniture-art.mjs.

const files = import.meta.glob('../assets/furniture/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

/** The picture of a kind of piece, as an image URL. */
export const pieceUrl = (type: PieceType): string => files[`../assets/furniture/${type}.webp`]
