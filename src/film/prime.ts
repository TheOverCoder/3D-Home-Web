// A phone lets a page speak (speechSynthesis) only once it has spoken from a touch: this says nothing, silently, in
// that touch — the game's Buy button for the film it opens (./films.ts), any tap on a film in the lab (./speak.ts).

/** Says nothing, silently, so that the page may speak later (run it in a tap). */
export function primeSpeech() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return
  const u = new SpeechSynthesisUtterance(' ')
  u.volume = 0
  window.speechSynthesis.speak(u)
}
