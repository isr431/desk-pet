# Desk Pet

A small animated pet that lives beside your Claude Code session and reacts to what Claude is doing, so long sessions are more fun to glance at.

![Five desk pets reading, hammering, typing, celebrating and bringing gifts](docs/demo.gif)

Pick an **axolotl**, **quokka**, **tiny robot**, **dog** or **cat**. Each one has its own take on every reaction.

| When | Your pet |
|---|---|
| A turn starts | wakes up and stretches |
| Claude reads files | reads a tiny book |
| Claude edits code | hammers (quokka, robot, dog) or knits (axolotl, cat) |
| Claude runs a shell command | types furiously at a mini keyboard |
| Claude searches or fetches the web | peers through binoculars |
| Tests pass | dances in a shower of confetti |
| Tests fail | hides behind a rock, then peeks out |
| A turn runs 5+ minutes | gets bored: yawns, plays with yarn, builds a sandcastle |
| Claude needs your input | waves until you respond |
| A turn finishes | brings you a little trophy or envelope |
| Context compaction | tidies its room, stacking boxes |
| Nothing happening | breathes and blinks |

Your pet lives in a little pixel room (wallpaper, a curtained window, a pendant lamp, a wooden floor and a rug) that follows your local time of day: a pink sunrise at dawn (5–7), blue skies and drifting clouds in the morning (7–11) and at noon (11–14), golden light in the afternoon (14–17), a sunset in the evening (17–20), and a starry night with the lamp glowing (20–5). Sunlight through the window falls across the floor and shifts with the sun, and the caption's idle icon changes with the hour. It's drawn with half-block pixels in the terminal (48 columns by 12 rows) and as an animated SVG in the Claude desktop app.

You choose where it sits:

- **Side panel** (default): its own panel beside the conversation, with the pet's name, what it's doing and a settings button. If you close it, `/desk-pet show` brings it back. A terminal opens the panel by itself only when it's at least 144 columns wide.
- **Above the prompt**: a full-width card just above the message box, with the pet on the left, what it's doing beside it and a settings button.

## Install

In Claude Code, add this repository as a plugin marketplace, then install the plugin:

```
/plugin marketplace add isr431/desk-pet
/plugin install desk-pet@desk-pet
```

Or from a shell:

```bash
claude plugin marketplace add isr431/desk-pet
claude plugin install desk-pet@desk-pet
```

Start a new session and your pet appears. Run `/desk-pet` to pick your pet and settings.

Desk Pet is a function-hooks plugin. It needs Claude Code 2.1.286 or newer. The function-hooks API is early access, so a future release may change it.

To try it from a local checkout without installing:

```bash
claude --plugin-dir /path/to/desk-pet
```

## Settings

- **Pet**: axolotl (default), quokka, robot, dog or cat.
- **Position**: side panel (default) or above the prompt.
- **Sound**: off by default. When on, a soft chime plays when Claude needs input and when a turn finishes. Both chimes are synthesized in code; no audio files are shipped.
- **Reactions**: each one can be switched on or off. All are on by default.

You can change these in three places:

- `/desk-pet` opens a settings pane with a preview button for each reaction.
- `/desk-pet cat` (or `axolotl`, `quokka`, `robot`, `dog`) switches pets.
- `/desk-pet show` reopens the side panel.
- `/config` in the terminal lists every setting as a "Desk Pet: …" row. Pet and position are typed there as text (`axolotl`, `quokka`, `robot`, `dog`, `cat`; `panel`, `above`); anything else falls back to the default.

`/desk-pet demo` plays every reaction in turn, which is handy for a screenshot or a GIF.

## How it decides what to show

- Tests are detected from the shell command (`npm test`, `pytest`, `go test`, `cargo test`, `vitest`, `jest`, `rspec` and similar). A non-zero exit counts as a failure.
- "Needs input" covers permission prompts, MCP elicitations, `AskUserQuestion` and plan approval. Permission prompts and MCP elicitations are noticed through Claude Code's notification event, the same one that drives desktop notifications. The pet stops waving when you send a prompt or when the tool call it was waiting on finishes. One known gap: after you approve a long-running command, the pet keeps waving until that command ends, because the hooks API has no event for the moment a prompt is answered.
- Reactions from subagents count too. Only the main conversation's turns trigger wake-up, boredom and the end-of-turn gift.

## Privacy and data handling

[Privacy policy](https://github.com/isr431/desk-pet#privacy-and-data-handling): the disclosure below describes the mod’s data handling.

Desk Pet only watches what Claude is doing and draws a pet. It makes no network requests, reads no files, runs no commands, and keeps no data of its own between sessions.

**Hooks.** Every hook looks, then passes the event on unchanged. None of them approves, blocks or rewrites anything.

| Hook | What it reads | Why |
|---|---|---|
| `session.start` | nothing | starts the animation, opens the side panel and registers `/desk-pet` |
| `prompt.submit` | nothing, not even your prompt's text | stops the "needs input" wave as soon as you reply |
| `turn.start`, `turn.complete` | whether the turn ended with an answer, and whether it was a subagent's | wake-up, boredom after 5 minutes, the end-of-turn gift |
| `tool.call` | the tool's name, plus a file's name (never its contents), a search pattern or query, a URL's host, the first ~38 characters of a shell command, and whether the call failed | picks the reaction and its caption, and spots test runs and whether they passed |
| `session.compact` | whether it was a subagent's, or a background precompute | the tidying-up reaction |
| `classic.Notification` | the notification's type only (`permission_prompt` or `elicitation_dialog`) | starts the "needs input" wave |
| `classic.PermissionDenied` | nothing | stops the wave when a prompt is refused |
| `command.run` | what you typed after `/desk-pet` | the command |
| `ui.render` | the surface and the space available | draws the pet |

Captions appear on your screen only. The current caption is held in memory for the session (`$.state`) so the panel can redraw it. It is never written to disk or sent anywhere.

**Settings it writes.** Desk Pet changes a setting only when you ask: a button in the `/desk-pet` settings pane, or `/desk-pet cat` (or another pet). Each write is to one of Desk Pet's own settings (`desk-pet.pet`, `desk-pet.position`, `desk-pet.sound` or a `desk-pet.react_…` switch), which Claude Code saves in your settings file under `pluginConfigs`, exactly as `/config` would. It never touches any other setting, permission or environment variable.

**Sound.** Off by default. When on, it plays a short chime that it synthesizes in code.

In the "above the prompt" position, press ctrl+x ctrl+a to collapse the card in the terminal.

## Development

```bash
claude plugin validate .
claude plugin test .
```

The pixel art lives in `hooks/art.ts`. It's plain TypeScript with no engine calls, so you can import it under Node to render previews.

## License

MIT
