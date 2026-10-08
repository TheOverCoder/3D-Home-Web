import type { Object3D } from 'three'
import { create } from 'zustand'

// Where the active avatar's right hand is, so whatever you carry is attached to it. Set by the placeholder
// mannequin or by a glTF character (found by bone name); empty until one has mounted.
interface RigStore {
  rightHand: Object3D | null
  setRightHand: (hand: Object3D | null) => void
}

export const useRig = create<RigStore>()((set) => ({
  rightHand: null,
  setRightHand: (rightHand) => set({ rightHand }),
}))
