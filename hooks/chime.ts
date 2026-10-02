// Soft chimes synthesized on the fly as WAV bytes, so the mod ships no audio
// files: a few sine notes with a gentle overtone, each fading out.

const RATE = 22050

function wav(samples: Float32Array): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2)
  const v = new DataView(bytes.buffer)
  const text = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)))
  text(0, 'RIFF')
  v.setUint32(4, 36 + samples.length * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, RATE, true)
  v.setUint32(28, RATE * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  text(36, 'data')
  v.setUint32(40, samples.length * 2, true)
  samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true))

  return bytes
}

function toBase64(bytes: Uint8Array): string {
  const native = (bytes as Uint8Array & { toBase64?: () => string }).toBase64
  if (typeof native === 'function') return native.call(bytes)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))

  return btoa(s)
}

function render(notes: readonly number[], gap: number, ring: number): string {
  const length = Math.ceil((gap * (notes.length - 1) + ring) * RATE)
  const out = new Float32Array(length)
  notes.forEach((hz, n) => {
    const start = Math.floor(n * gap * RATE)
    for (let i = 0; start + i < length && i < ring * RATE; i++) {
      const t = i / RATE
      const attack = Math.min(1, t / 0.008)
      const env = attack * Math.exp(-t * 6)
      const tone = Math.sin(2 * Math.PI * hz * t) + 0.25 * Math.sin(4 * Math.PI * hz * t)
      out[start + i]! += 0.16 * env * tone
    }
  })

  return toBase64(wav(out))
}

let attention: string | undefined
let done: string | undefined

/** Two rising notes: the pet would like your attention. */
export function attentionChime(): string {
  attention ??= render([880, 1174.66], 0.14, 0.7)

  return attention
}

/** A little three-note arpeggio: the turn is done. */
export function doneChime(): string {
  done ??= render([659.25, 830.61, 987.77], 0.11, 0.8)

  return done
}
