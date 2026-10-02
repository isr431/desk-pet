import type { On } from 'claude-code'
import { describe, expect, mock, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: true,
    maxRows: 20,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 19 },
    view: {},
  },
} as const

const PANEL = {
  component: 'Pane',
  requestId: 'desk-pet',
  props: {
    title: 'Desk Pet',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const HINT = {
  component: 'PromptHint',
  props: { isDraft: false, isWorking: false, hint: '? for shortcuts' },
} as const

const engine = (on: On) => {
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ command: e.name }))
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.close', () => ({ value: {} }) as never)
  // The engine's own drawing of the band and the hint line, beneath the pet.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Text({ children: 'engine band' }))
  on('ui.render', { component: 'PromptHint' }, ($, e) => $.ui.resolve(e).Text({ children: e.props.hint }))
}

describe('desk pet band', () => {
  test('draws the pet and reacts to tools on both surfaces', async ($, on) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    engine(on)
    on('tool.call', { tool: 'Read' }, async () => {
      await clock.sleep(1000)

      return { result: { ok: true }, text: 'file contents' }
    })
    on('tool.call', { tool: 'Bash' }, async () => {
      await clock.sleep(500)

      return { result: { ok: false }, text: '2 failed', isError: true }
    })
    await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })

    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ plugin: 'desk-pet', surface, ...PANEL })
      expect(await ui.find({ text: /Axolotl/ })).toBeDefined()
      expect(await ui.find({ type: surface === 'terminal' ? 'Raster' : 'Svg' })).toBeDefined()

      void $.tool.call({ tool: 'Read', file_path: '/repo/src/app.ts' })
      await clock.advance(200)
      expect((await ui.find({ text: /reading app\.ts/ }))?.text).toContain('reading app.ts')

      await clock.advance(4000)
      expect(await ui.find({ text: /reading/ })).toBeUndefined()

      void $.tool.call({ tool: 'Bash', command: 'npm test' })
      await clock.advance(800)
      expect(await ui.find({ text: /tests failed/ })).toBeDefined()

      await clock.advance(6000)
      expect(await ui.find({ text: /tests failed/ })).toBeUndefined()
      await ui.unmount()
    }
  })

  test('a switched-off reaction stays idle', { options: { react_reading: false } }, async ($, on) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    engine(on)
    on('tool.call', { tool: 'Read' }, async () => ({ result: {}, text: 'x' }))
    await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount({ plugin: 'desk-pet', surface: 'terminal', ...PANEL })
    void $.tool.call({ tool: 'Read', file_path: '/repo/a.ts' })
    await clock.advance(200)
    expect(await ui.find({ text: /reading/ })).toBeUndefined()
    await ui.unmount()
  })

  test('a turn wakes the pet, bores it, asks for help and ends with a gift', async ($, on) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    engine(on)
    on('turn.start', (_$, e) => ({ turnId: e.turnId }))
    on('turn.complete', (_$, e) => ({ text: e.answer }))
    on('tool.call', { tool: 'AskUserQuestion' }, async () => {
      await clock.sleep(3000)

      return { result: {}, text: 'answered' }
    })
    await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount({ plugin: 'desk-pet', surface: 'terminal', ...PANEL })

    void $.turn.start({ text: 'go', turnId: 't1' })
    await clock.advance(100)
    expect(await ui.find({ text: /waking up/ })).toBeDefined()

    await clock.advance(5 * 60 * 1000)
    expect(await ui.find({ text: /yawning|yarn|sandcastle/ })).toBeDefined()

    void $.tool.call({ tool: 'AskUserQuestion', questions: [] } as never)
    await clock.advance(200)
    expect(await ui.find({ text: /question for you/ })).toBeDefined()
    await clock.advance(3500)
    expect(await ui.find({ text: /question for you/ })).toBeUndefined()

    void $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' })
    await clock.advance(200)
    expect(await ui.find({ text: /brought you a trophy/ })).toBeDefined()
    await clock.advance(5000)
    expect(await ui.find({ text: /trophy/ })).toBeUndefined()
    await ui.unmount()
  })

  test('in the side panel the band is left to the engine', async ($, on) => {
    mock.clock(on, { now: 1_000_000 })
    engine(on)
    await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
    const panelBand = await $.ui.mount({ plugin: 'desk-pet', surface: 'desktop', ...BAND })
    expect(await panelBand.find({ type: 'Svg' })).toBeUndefined()
    expect(await panelBand.find({ text: /engine band/ })).toBeDefined()
    await panelBand.unmount()
  })

  test('above the prompt draws a compact card', { options: { position: 'above' } }, async ($, on) => {
    mock.clock(on, { now: 1_000_000 })
    engine(on)
    await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ plugin: 'desk-pet', surface, ...BAND })
      expect(await ui.find({ type: surface === 'terminal' ? 'Raster' : 'Svg' })).toBeDefined()
      expect(await ui.find({ text: /hanging out/ })).toBeDefined()
      await ui.unmount()
    }
  })

  test('under the prompt keeps the hint and adds the pet', { options: { position: 'footer' } }, async ($, on) => {
    mock.clock(on, { now: 1_000_000 })
    engine(on)
    await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
    const ui = await $.ui.mount({ plugin: 'desk-pet', surface: 'desktop', ...HINT })
    expect(await ui.find({ type: 'Svg' })).toBeDefined()
    expect(await ui.find({ text: /hanging out/ })).toBeDefined()
    expect(await ui.find({ text: /for shortcuts/ })).toBeDefined()
    await ui.unmount()
  })

  test('when the panel cannot be placed the pet sits above the prompt', async ($, on) => {
    mock.clock(on, { now: 1_000_000 })
    on('session.start', (_$, e) => ({ cwd: e.cwd }))
    on('command.register', (_$, e) => ({ command: e.name }))
    on('ui.open', () => ({ value: { isPlaced: false, reason: 'no surface places panes' } }) as never)
    on('ui.toast', () => ({ value: {} }) as never)
    on('ui.invalidate', () => ({ value: {} }) as never)
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Text({ children: 'engine band' }))
    await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
    const ui = await $.ui.mount({ plugin: 'desk-pet', surface: 'desktop', ...BAND })
    expect(await ui.find({ type: 'Svg' })).toBeDefined()
    await ui.unmount()
  })

  test('the settings pane lists every pet and reaction', async $ => {
    const ui = await $.ui.mount({
      plugin: 'desk-pet',
      surface: 'terminal',
      component: 'Pane',
      requestId: 'desk-pet-settings',
      props: { bodyColumns: 80 } as never,
    })
    for (const key of ['pet-axolotl', 'pet-quokka', 'pet-robot', 'pet-dog', 'pet-cat', 'position-panel', 'position-footer', 'sound', 'react_idle', 'preview-wave']) {
      expect(await ui.find({ key })).toBeDefined()
    }
    await ui.unmount()
  })
})
