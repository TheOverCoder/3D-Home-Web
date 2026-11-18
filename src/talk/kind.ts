// Kind words only: what a character never says to the player (update-v1 mission 03, change 5; psychology.md §2: no
// "waiting for you", no sad faces at leaving, no hurry, no fake pressure). A line of theirs — a moment's (./lines.ts), a
// letter's, a chapter's — is checked against these; kind.test.ts checks every line the game has.

/** Guilt, hurry, loneliness and sulking, as they would be written. */
export const UNKIND: readonly RegExp[] = [
  /waiting for you/i,
  /still waiting/i,
  /keep(s|ing)? (me|us) waiting/i,
  /\bmiss(ed|ing)? you/i,
  /\bhurry/i,
  /last chance/i,
  /\blonel/i,
  /\bon my own\b/i,
  /oh,? well/i,
  /come back/i,
  /\bdon'?t (go|leave)/i,
  /where (were|have) you/i,
  /only today/i,
  /before it'?s gone/i,
  /too late/i,
  /running out/i,
  /you forgot/i,
  /\bsad\b/i,
  /\bdisappoint/i,
  /\babandon/i,
  /\bneglect/i,
]

/** What is unkind in `text` (the first pattern it meets), or null when it is kind. */
export function unkind(text: string): string | null {
  return UNKIND.find((r) => r.test(text))?.source ?? null
}
