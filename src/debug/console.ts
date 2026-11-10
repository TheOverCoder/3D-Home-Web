import eruda from 'eruda'

// ?console: a console, the page's storage, its network requests and its elements, on the page itself (eruda) — for a
// phone with no developer tools at hand (an iPhone without a Mac). src/main.tsx loads it first when the flag is there;
// it is a chunk of its own that players never download. It complements ⚙ → Copy diagnostics.
eruda.init()
