import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register, Timer } from 'claude-code'

import type { PetShow } from '../types'
import {
  animLength,
  animSvg,
  buildAnim,
  frameAt,
  PET_IDS,
  PETS,
  RASTER_COLUMNS,
  RASTER_ROWS,
  rasterCells,
  ROOM,
  H,
  W,
  type Anim,
  type Kind,
  type PetId,
} from './art'
import { attentionChime, doneChime } from './chime'

const PANE = 'desk-pet-settings'
const PET_PANE = 'desk-pet'
const RASTER_KEY = 'pet'
const LONG_RUN_MS = 5 * 60 * 1000
const BORED_SPAN_MS = 12 * 1000
const MIN_TOOL_MS = 2400

const IDLE: PetShow = { kind: 'idle', variant: 0, startedAt: 0, frameMs: 0, label: '' }
const shown = atom({ plugin: 'desk-pet', key: 'show' } as const, IDLE)

const REACTIONS = [
  { field: 'react_turn_start', kind: 'wake', title: 'Turn starts' },
  { field: 'react_reading', kind: 'read', title: 'Reading files' },
  { field: 'react_editing', kind: 'edit', title: 'Editing code' },
  { field: 'react_shell', kind: 'shell', title: 'Running shell commands' },
  { field: 'react_web_search', kind: 'search', title: 'Web search' },
  { field: 'react_tests_pass', kind: 'pass', title: 'Tests pass' },
  { field: 'react_tests_fail', kind: 'fail', title: 'Tests fail' },
  { field: 'react_long_run', kind: 'bored', title: 'Long run (5+ min)' },
  { field: 'react_needs_input', kind: 'wave', title: 'Claude needs input' },
  { field: 'react_turn_finish', kind: 'finish', title: 'Turn finishes' },
  { field: 'react_compaction', kind: 'tidy', title: 'Context compaction' },
  { field: 'react_idle', kind: 'idle', title: 'Idle' },
] as const

const BORED_LABELS = ['yawning', 'playing with yarn', 'building a sandcastle']
const BORED_ICONS = ['🥱', '🧶', '🏖️']

type Position = 'panel' | 'above' | 'footer'
const POSITIONS: readonly { id: Position; title: string }[] = [
  { id: 'panel', title: 'Side panel' },
  { id: 'above', title: 'Above the prompt' },
  { id: 'footer', title: 'Under the prompt' },
]

/** The little icon beside the caption for what the pet is doing. */
const iconFor = (show: PetShow): string => {
  switch (show.kind) {
    case 'wake':
      return '☀️'
    case 'read':
      return '📖'
    case 'edit':
      return PETS[pet].edit === 'knit' ? '🧶' : '🔨'
    case 'shell':
      return '⌨️'
    case 'search':
      return '🔭'
    case 'pass':
      return '🎉'
    case 'fail':
      return '🙈'
    case 'bored':
      return BORED_ICONS[show.variant % 3]!
    case 'wave':
      return '👋'
    case 'finish':
      return PETS[pet].gift === 'trophy' ? '🏆' : '💌'
    case 'tidy':
      return '📦'
  }

  return '🌙'
}

const captionFor = (show: PetShow) => `${iconFor(show)} ${show.label || 'hanging out'}`

const TEST_COMMAND =
  /(^|[\s;&|(])((npm|pnpm|yarn|bun)\s+(run\s+)?test\b|(npx\s+|bunx\s+)?(jest|vitest|mocha|ava|playwright\s+test|cypress\s+run)\b|py\.?test\b|python3?\s+-m\s+(pytest|unittest)\b|go\s+test\b|cargo\s+(test|nextest)\b|deno\s+test\b|rspec\b|phpunit\b|mix\s+test\b|dotnet\s+test\b|(\.\/)?gradlew?\s+(\S+\s+)*test\b|mvn\s+(\S+\s+)*test\b|ctest\b|make\s+(test|check)\b|swift\s+test\b|xcodebuild\s+(\S+\s+)*test\b|tox\b|nox\b|rake\s+test\b|bundle\s+exec\s+(rspec|rake\s+test)\b)/

type Reaction = {
  kind: Kind
  variant: number
  startedAt: number
  frameMs: number
  until: number
  active: number
  label: string
}

type ToolReaction = { kind: Kind; label: string; frameMs?: number; isTest?: boolean }

const basename = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path

const clip = (text: string, max = 38) => {
  const one = text.replace(/\s+/g, ' ').trim()

  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

const field = (e: object, name: string): string => {
  const value = (e as Record<string, unknown>)[name]

  return typeof value === 'string' ? value : ''
}

/** Pages flip faster the bigger the file. */
const readPace = (bytes: number) => (bytes > 200_000 ? 70 : bytes > 50_000 ? 110 : bytes > 10_000 ? 160 : 240)

const sameShow = (a: PetShow, b: PetShow) =>
  a.kind === b.kind && a.variant === b.variant && a.startedAt === b.startedAt && a.frameMs === b.frameMs && a.label === b.label

// The settings in force, set by register() from the plugin's options.
let options: PluginOptions = {}
let pet: PetId = 'axolotl'
let petName = PETS.axolotl.name
let isSoundOn = false
let position: Position = 'panel'
/** True while the side panel is open but undrawn: the band stands in for it. */
let isPaneWaiting = false

const isOn = (kind: string) => {
  const reaction = REACTIONS.find(one => one.kind === kind)

  return reaction === undefined || options[reaction.field] !== false
}

// What drives the band. Plain module values: a reload starts them over,
// and the band falls back to idle until the next event.
let reaction: Reaction | null = null
let waiting: { label: string; since: number } | null = null
let turnStartedAt: number | null = null
let current: PetShow | null = null
// The site whose Raster the beat repaints in the terminal: the band or the pane.
let site: { requestId: string; animKey: string; frame: number } | null = null
let timer: Timer | null = null
let wake: (() => void) | null = null
let previews = 0

const anims = new Map<string, Anim>()
const cells = new Map<string, string[]>()
const svgs = new Map<string, string>()

const animKey = (show: PetShow) => `${pet}:${show.kind}:${show.variant}:${show.frameMs}`

const animFor = (show: PetShow): Anim => {
  const key = animKey(show)
  let anim = anims.get(key)
  if (!anim) {
    anim = buildAnim(pet, show.kind as Kind, show.variant, show.frameMs || undefined)
    anims.set(key, anim)
  }

  return anim
}

const cellsFor = (show: PetShow, index: number): string => {
  const key = animKey(show)
  let list = cells.get(key)
  if (!list) {
    list = []
    cells.set(key, list)
  }
  list[index] ??= rasterCells(animFor(show).frames[index]!, ROOM)

  return list[index]!
}

const svgFor = (show: PetShow): string => {
  const key = animKey(show)
  let svg = svgs.get(key)
  if (!svg) {
    svg = animSvg(animFor(show), 4, ROOM)
    svgs.set(key, svg)
  }

  return svg
}

/**
 * Opens the pet's own pane, sized to the scene. Where the surface can't seat
 * it, the pet moves to the card above the prompt rather than vanishing.
 */
async function openPetPane($: EngineInterface): Promise<void> {
  try {
    const opened = await $.ui.open({ id: PET_PANE, title: 'Desk Pet', columns: RASTER_COLUMNS + 2, rows: RASTER_ROWS + 4 })
    isPaneWaiting = !opened.isPlaced
    if (!opened.isPlaced) $.ui.toast(`Desk Pet: the side panel can't show here yet (${opened.reason}), so your pet sits above the prompt for now.`)
  } catch {
    isPaneWaiting = true
  }
  $.ui.invalidate('ui.render')
}

function chime($: EngineInterface, wav: string): void {
  if (!isSoundOn) return
  void $.audio.play({ base64: wav, mime: 'audio/wav' }, { gain: 0.8 }).catch(() => undefined)
}

/** What the pet should be doing at `now`, most important first. */
const desired = (now: number): PetShow => {
  if (waiting && isOn('wave')) {
    return { kind: 'wave', variant: 0, startedAt: waiting.since, frameMs: 0, label: waiting.label }
  }
  if (reaction) {
    if (reaction.active > 0 || now < reaction.until) {
      const { kind, variant, startedAt, frameMs, label } = reaction

      return { kind, variant, startedAt, frameMs, label }
    }
    reaction = null
  }
  if (turnStartedAt !== null && isOn('bored') && now - turnStartedAt >= LONG_RUN_MS) {
    const take = Math.floor((now - turnStartedAt - LONG_RUN_MS) / BORED_SPAN_MS)
    const variant = take % 3

    return {
      kind: 'bored',
      variant,
      startedAt: turnStartedAt + LONG_RUN_MS + take * BORED_SPAN_MS,
      frameMs: 0,
      label: BORED_LABELS[variant]!,
    }
  }

  return isOn('idle') ? IDLE : { ...IDLE, kind: 'still' }
}

/** One beat of the band: switch reactions, or repaint the terminal frame. */
async function step($: EngineInterface): Promise<number> {
  const now = await $.clock.now()
  current ??= await read($, shown)
  const want = desired(now)
  if (!sameShow(want, current)) {
    current = want
    await update($, shown, () => want)

    return 60
  }
  const anim = animFor(want)
  const index = frameAt(anim, now - want.startedAt)
  const key = animKey(want)
  if (site && (site.frame !== index || site.animKey !== key)) {
    site = { ...site, animKey: key, frame: index }
    const { deny } = await $.ui.blit({ requestId: site.requestId, key: RASTER_KEY, cells: cellsFor(want, index) })
    if (deny) site = null
  }
  const intoFrame = (now - want.startedAt) % anim.frameMs
  const toNextFrame = anim.frameMs - intoFrame

  return Math.max(40, Math.min(site ? toNextFrame + 5 : 250, 500))
}

/** One chain of beats: a nudge mid-beat runs the next one at once, never a second chain. */
function loop($: EngineInterface): void {
  timer?.cancel()
  let isBeating = false
  let isNudged = false
  const beat = async () => {
    isBeating = true
    isNudged = false
    let delay = 250
    try {
      delay = await step($)
    } catch {
      // A missed beat is harmless; the next one catches up.
    }
    isBeating = false
    timer = $.clock.after(isNudged ? 1 : delay, () => void beat())
  }
  wake = () => {
    if (isBeating) {
      isNudged = true

      return
    }
    timer?.cancel()
    timer = $.clock.after(1, () => void beat())
  }
  void beat()
}

const nudge = () => wake?.()

const play = (kind: Kind, now: number, opts: { label: string; variant?: number; frameMs?: number; holdMs?: number; active?: number }) => {
  const anim = buildAnim(pet, kind, opts.variant ?? 0, opts.frameMs)
  const length = anim.loop ? MIN_TOOL_MS : animLength(anim)
  reaction = {
    kind,
    variant: opts.variant ?? 0,
    startedAt: now,
    frameMs: opts.frameMs ?? 0,
    until: now + Math.max(length, opts.holdMs ?? 0),
    active: opts.active ?? 0,
    label: opts.label,
  }
  nudge()

  return reaction
}

const finish = (mine: Reaction, now: number) => {
  if (reaction !== mine) return
  mine.active = Math.max(0, mine.active - 1)
  mine.until = Math.max(mine.until, Math.min(now + 600, mine.startedAt + MIN_TOOL_MS))
  nudge()
}

function ask($: EngineInterface, label: string, now: number): void {
  if (waiting) return
  waiting = { label, since: now }
  if (isOn('wave')) chime($, attentionChime())
  nudge()
}

const answered = () => {
  if (!waiting) return
  waiting = null
  nudge()
}

const preview = (kind: Kind, now: number) => {
  const variant = kind === 'bored' ? previews++ % 3 : 0
  const label = REACTIONS.find(one => one.kind === kind)?.title.toLowerCase() ?? kind
  play(kind, now, { label: `preview: ${label}`, variant, holdMs: 3600 })
}

async function classify($: EngineInterface, e: { tool: string }): Promise<ToolReaction | null> {
  switch (e.tool) {
    case 'Read':
    case 'NotebookRead': {
      const path = field(e, 'file_path') || field(e, 'notebook_path')
      let size = 0
      try {
        size = (await $.fs.stat(path)).size
      } catch {
        // An unreadable path reads at the gentle pace.
      }

      return { kind: 'read', label: `reading ${basename(path)}`, frameMs: readPace(size) }
    }
    case 'Grep':
    case 'Glob':
      return { kind: 'read', label: `looking for ${clip(field(e, 'pattern'), 28)}` }
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
    case 'NotebookEdit': {
      const path = field(e, 'file_path') || field(e, 'notebook_path')
      const verb = PETS[pet].edit === 'knit' ? 'knitting' : 'hammering at'

      return { kind: 'edit', label: `${verb} ${basename(path)}` }
    }
    case 'Bash':
    case 'PowerShell': {
      const command = field(e, 'command')

      return { kind: 'shell', label: `$ ${clip(command)}`, isTest: TEST_COMMAND.test(command) }
    }
    case 'WebSearch':
      return { kind: 'search', label: `searching “${clip(field(e, 'query'), 30)}”` }
    case 'WebFetch': {
      const url = field(e, 'url')
      let host = url
      try {
        host = new URL(url).host
      } catch {
        // Not a URL after all: show it as written.
      }

      return { kind: 'search', label: `peeking at ${clip(host, 30)}` }
    }
  }

  return null
}

export const register: Register = (on, given) => {
  options = given
  pet = PET_IDS.includes(given.pet as PetId) ? (given.pet as PetId) : 'axolotl'
  petName = PETS[pet].name
  isSoundOn = given.sound === true
  position = POSITIONS.some(one => one.id === given.position) ? (given.position as Position) : 'panel'

  on('session.start', async ($, e, next) => {
    loop($)
    if (position === 'panel') void openPetPane($)
    else void $.ui.close({ id: PET_PANE }).catch(() => undefined)
    try {
      await $.command.register({
        name: 'desk-pet',
        description: 'Desk Pet: pick a pet, sound and reactions',
        argumentHint: '[show|demo|axolotl|quokka|robot|dog|cat]',
      })
    } catch {
      // The pet still runs without its command.
    }

    return next(e)
  })

  on('prompt.submit', ($, e, next) => {
    answered()

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    const now = await $.clock.now()
    turnStartedAt = now
    answered()
    if (isOn('wake')) play('wake', now, { label: 'waking up' })

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    const now = await $.clock.now()
    turnStartedAt = null
    answered()
    if (e.reason === 'answer' && isOn('finish')) {
      const gift = PETS[pet].gift === 'trophy' ? 'a trophy' : 'a letter'
      play('finish', now, { label: `brought you ${gift}` })
      chime($, doneChime())
    } else {
      reaction = null
      nudge()
    }

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const now = await $.clock.now()
    if (e.tool === 'AskUserQuestion' || e.tool === 'ExitPlanMode') {
      ask($, e.tool === 'ExitPlanMode' ? 'has a plan for you' : 'has a question for you', now)
      try {
        return await next(e)
      } finally {
        answered()
      }
    }

    const wants = await classify($, e)
    if (!wants) return next(e)
    const mine = isOn(wants.kind) ? play(wants.kind, now, { label: wants.label, frameMs: wants.frameMs, active: 1 }) : null
    let ran: Awaited<ReturnType<typeof next>>
    try {
      ran = await next(e)
    } finally {
      const end = await $.clock.now()
      if (mine) finish(mine, end)
      // The call ran (or was refused), so any permission prompt was answered.
      answered()
    }

    if (wants.isTest && !('deny' in ran && ran.deny !== undefined)) {
      const hasFailed = 'isError' in ran && ran.isError === true
      const kind: Kind = hasFailed ? 'fail' : 'pass'
      if (isOn(kind)) play(kind, await $.clock.now(), { label: hasFailed ? 'tests failed…' : 'tests pass!' })
    }

    return ran
  })

  on('session.compact', async ($, e, next) => {
    if (e.agentId !== undefined || e.trigger === 'precompute' || !isOn('tidy')) return next(e)
    const mine = play('tidy', await $.clock.now(), { label: 'tidying up the context', holdMs: 3000, active: 1 })
    try {
      return await next(e)
    } finally {
      finish(mine, await $.clock.now())
    }
  })

  on('classic.Notification', async ($, e, next) => {
    if (e.notification_type === 'permission_prompt' || e.notification_type === 'elicitation_dialog') {
      ask($, 'needs your OK', await $.clock.now())
    }

    return next(e)
  })

  on('classic.PermissionRequest', async ($, e, next) => {
    ask($, 'needs your OK', await $.clock.now())

    return next(e)
  })

  on('classic.Elicitation', async ($, e, next) => {
    ask($, 'has a question for you', await $.clock.now())

    return next(e)
  })

  on('classic.PermissionDenied', ($, e, next) => {
    answered()

    return next(e)
  })

  on('command.run', { command: 'desk-pet' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'show') {
      await openPetPane($)

      return { text: `Desk Pet: ${petName} is in the side panel.` }
    }
    if (arg === 'demo') {
      const kinds: Kind[] = ['wake', 'read', 'edit', 'shell', 'search', 'pass', 'fail', 'bored', 'wave', 'finish', 'tidy']
      kinds.forEach((kind, i) => {
        $.clock.after(i * 3800, () => void $.clock.now().then(now => preview(kind, now)))
      })

      return { text: `${petName} is running through all ${kinds.length} reactions (about 40 seconds).` }
    }
    const wanted = PET_IDS.find(id => id === arg || PETS[id].name.toLowerCase() === arg || (arg === 'tiny robot' && id === 'robot'))
    if (wanted) {
      const { deny } = await $.config.set({ key: 'desk-pet.pet', value: wanted })

      return { text: deny ? `Desk Pet: couldn't switch pets (${deny}).` : `Desk Pet: say hello to your ${PETS[wanted].name.toLowerCase()}.` }
    }
    if (arg !== '') {
      return { text: 'Desk Pet: try /desk-pet, /desk-pet show, /desk-pet demo, or /desk-pet axolotl|quokka|robot|dog|cat.' }
    }
    await $.ui.open({ id: PANE, title: 'Desk Pet', focus: true, closeOnEscape: true })

    return { text: 'Desk Pet settings opened.' }
  })

  // The side panel: the room scene, then the pet's name and what it's up to.
  on('ui.render', { component: 'Pane', requestId: PET_PANE }, async ($, e) => {
    isPaneWaiting = false
    const show = await read($, shown)
    const caption = captionFor(show)
    const openSettings = () => void $.ui.open({ id: PANE, title: 'Desk Pet settings', focus: true, closeOnEscape: true })

    if (e.surface === 'terminal') {
      const { Box, Button, Raster, Text } = $.ui.resolve(e)
      const now = await $.clock.now()
      const index = frameAt(animFor(show), now - show.startedAt)
      site = { requestId: e.requestId, animKey: animKey(show), frame: index }

      return (
        <Box flexDirection="column">
          <Raster key={RASTER_KEY} columns={RASTER_COLUMNS} rows={RASTER_ROWS} cells={cellsFor(show, index)} />
          <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
            <Box flexDirection="column">
              <Text bold>{petName}</Text>
              <Text dimColor wrap="truncate-end">
                {caption}
              </Text>
            </Box>
            <Button key="settings" label="settings" plain dimColor onPress={openSettings} />
          </Box>
        </Box>
      )
    }

    const { Box, Button, Svg, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column" gap={1}>
        <Svg source={svgFor(show)} alt={`${petName}: ${caption}`} width={W * 5} height={H * 5} isInteractive />
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          <Box flexDirection="column">
            <Text bold>{petName}</Text>
            <Text dimColor>{caption}</Text>
          </Box>
          <Button key="settings" label="Settings" plain dimColor onPress={openSettings} />
        </Box>
      </Box>
    )
  })

  // Above the prompt: a compact card at the right edge.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const isCard = position === 'above' || (position === 'panel' && isPaneWaiting)
    if (!isCard || e.props.hasSurvey) return next(e)
    const show = await read($, shown)
    const caption = captionFor(show)

    if (e.surface === 'terminal') {
      const { Box, Raster, Text } = $.ui.resolve(e)
      const now = await $.clock.now()
      const index = frameAt(animFor(show), now - show.startedAt)
      site = { requestId: e.requestId, animKey: animKey(show), frame: index }
      const hasRoom = e.props.bodyColumns >= RASTER_COLUMNS + 24

      return (
        <Box flexDirection="row" justifyContent="flex-end" alignItems="center">
          {hasRoom && (
            <Box flexDirection="column" alignItems="flex-end" marginRight={1}>
              <Text bold>{petName}</Text>
              <Text dimColor wrap="truncate-end">
                {caption}
              </Text>
            </Box>
          )}
          <Raster key={RASTER_KEY} columns={RASTER_COLUMNS} rows={RASTER_ROWS} cells={cellsFor(show, index)} />
        </Box>
      )
    }

    if (e.surface === 'desktop') {
      const { Box, Svg, Text } = $.ui.resolve(e)

      return (
        <Box flexDirection="row" justifyContent="flex-end">
          <Box flexDirection="row" alignItems="center" gap={1} borderStyle="round" paddingX={1}>
            <Svg source={svgFor(show)} alt={`${petName}: ${caption}`} width={W * 2} height={H * 2} isInteractive />
            <Box flexDirection="column">
              <Text bold>{petName}</Text>
              <Text dimColor>{caption}</Text>
            </Box>
          </Box>
        </Box>
      )
    }

    return next(e)
  })

  // Under the prompt: a tiny pet beside the hint line on the desktop, a
  // caption at the end of it in the terminal.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (position !== 'footer') return next(e)
    const show = await read($, shown)
    const caption = captionFor(show)

    if (e.surface === 'terminal') {
      return next({ ...e, props: { ...e.props, tail: `  ${petName} ${caption}` } })
    }

    if (e.surface === 'desktop') {
      const { Box, Svg, Text } = $.ui.resolve(e)
      const hint = await next(e)

      return (
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
          {hint}
          <Box flexDirection="row" alignItems="center" gap={1}>
            <Text dimColor>{caption}</Text>
            <Svg source={svgFor(show)} alt={`${petName}: ${caption}`} width={W * 1.5} height={H * 1.5} isInteractive />
          </Box>
        </Box>
      )
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const set = async (key: string, value: string | boolean) => {
      const { deny } = await $.config.set({ key: `desk-pet.${key}`, value })
      if (deny) $.ui.toast(`Desk Pet: ${deny}`)
    }

    return (
      <Box flexDirection="column">
        <Text bold>Pet</Text>
        <Box flexDirection="row" gap={1} marginBottom={1}>
          {PET_IDS.map(id => (
            <Button
              key={`pet-${id}`}
              label={PETS[id].name}
              variant={id === pet ? 'primary' : 'secondary'}
              onPress={() => void set('pet', id)}
            />
          ))}
        </Box>
        <Text bold>Position</Text>
        <Box flexDirection="row" gap={1}>
          {POSITIONS.map(one => (
            <Button
              key={`position-${one.id}`}
              label={one.title}
              variant={one.id === position ? 'primary' : 'secondary'}
              onPress={() => void set('position', one.id)}
            />
          ))}
        </Box>
        <Box flexDirection="row" gap={1} marginTop={1}>
          <Text bold>Sound</Text>
          <Button key="sound" label={isSoundOn ? 'On' : 'Off'} onPress={() => void set('sound', !isSoundOn)} />
          <Text dimColor>a soft chime for needs input and turn finishes</Text>
        </Box>
        <Box marginTop={1}>
          <Text bold>Reactions</Text>
        </Box>
        {REACTIONS.map(one => (
          <Box key={`row-${one.field}`} flexDirection="row" gap={1}>
            <Button
              key={one.field}
              label={`${isOn(one.kind) ? '●' : '○'} ${one.title}`}
              plain
              dimColor={!isOn(one.kind)}
              onPress={() => void set(one.field, !isOn(one.kind))}
            />
            {one.kind !== 'idle' && (
              <Button
                key={`preview-${one.kind}`}
                label="preview"
                plain
                dimColor
                onPress={() => void $.clock.now().then(now => preview(one.kind, now))}
              />
            )}
          </Box>
        ))}
        <Box marginTop={1}>
          <Text dimColor>/desk-pet demo plays every reaction · /desk-pet show reopens the panel</Text>
        </Box>
      </Box>
    )
  })
}
