/** A touch screen is the main input (phones, tablets): on-screen controls, drag to look. */
export const coarsePointer = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

/** The phone can buzz (Android browsers; iPhones cannot from a web page). */
export const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
