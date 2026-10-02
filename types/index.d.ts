/** What the band is showing now: one reaction of the chosen pet. */
export type PetShow = {
  /** The reaction (`idle`, `read`, `wave`, ...). */
  kind: string
  /** Which take of the reaction, for those with several (bored). */
  variant: number
  /** When it began, milliseconds since the epoch; 0 for a free-running loop. */
  startedAt: number
  /** The pace override in milliseconds per frame; 0 keeps the reaction's own. */
  frameMs: number
  /** The caption beside the pet. */
  label: string
}

declare module 'claude-code' {
  interface PluginState {
    'desk-pet': { show: PetShow }
  }
}
