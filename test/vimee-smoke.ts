/**
 * Interactive terminal sandbox for @vimee/core.
 * Run with: just test-engine
 *
 * Shows a text buffer with a block cursor. Every keypress is fed through
 * vimee's processKeystroke, and the result is rendered immediately.
 * Ctrl-C exits.
 */
import { TextBuffer, createInitialContext, processKeystroke } from "@vimee/core"

const SAMPLE = [
  "Hello, world!",
  "Use hjkl to move, dw to delete a word, ciw to change inner word.",
  "Press i for insert mode, Escape for normal mode.",
  "Try: dd, yy, p, /search, :s/old/new/g, 3j, v + motion + d",
  "",
  "function greet(name) {",
  '  return `Hello, ${name}!`',
  "}",
].join("\n")

const buffer = new TextBuffer(SAMPLE)
let ctx = createInitialContext({ line: 0, col: 0 })

function render() {
  // Move cursor to top-left and clear
  process.stdout.write("\x1b[H\x1b[2J")

  const lines = buffer.getContent().split("\n")
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (i === ctx.cursor.line) {
      const col = Math.min(ctx.cursor.col, line.length)
      const before = line.slice(0, col)
      const under = line[col] ?? " "
      const after = line.slice(col + 1)
      // Reverse-video for cursor
      process.stdout.write(`${before}\x1b[7m${under}\x1b[0m${after}\n`)
    } else {
      process.stdout.write(line + "\n")
    }
  }

  const modeLabel = ctx.mode.toUpperCase()
  const phase = ctx.phase !== "idle" ? ` | phase: ${ctx.phase}` : ""
  const op = ctx.operator ? ` | op: ${ctx.operator}` : ""
  const count = ctx.count > 0 ? ` | count: ${ctx.count}` : ""
  const status = ctx.statusMessage ? `\n${ctx.statusMessage}` : ""

  process.stdout.write(
    `\n\x1b[36m-- ${modeLabel} --\x1b[0m  ${ctx.cursor.line + 1}:${ctx.cursor.col + 1}${phase}${op}${count}${status}\n`,
  )
}

render()

process.stdin.setRawMode(true)
process.stdin.resume()
process.stdin.setEncoding("utf8")

process.stdin.on("data", (raw: string) => {
  // Ctrl-C to exit
  if (raw === "\x03") {
    process.stdout.write("\x1b[?25h\n") // show cursor
    process.exit(0)
  }

  const { key, ctrl } = parseTerminalKey(raw)
  if (!key) return

  const result = processKeystroke(key, ctx, buffer, ctrl)
  ctx = result.newCtx

  // Log actions for debugging (faint text below status)
  const interesting = result.actions.filter((a) => a.type !== "noop")

  render()

  if (interesting.length) {
    process.stdout.write(
      `\x1b[2m${interesting.map((a) => a.type).join(", ")}\x1b[0m\n`,
    )
  }
})

function parseTerminalKey(raw: string): { key: string; ctrl: boolean } {
  if (raw === "\x1b" || raw === "\x1b\x1b") return { key: "Escape", ctrl: false }
  if (raw === "\r") return { key: "Enter", ctrl: false }
  if (raw === "\x7f") return { key: "Backspace", ctrl: false }
  if (raw === "\t") return { key: "Tab", ctrl: false }
  if (raw === "\x1b[A") return { key: "ArrowUp", ctrl: false }
  if (raw === "\x1b[B") return { key: "ArrowDown", ctrl: false }
  if (raw === "\x1b[C") return { key: "ArrowRight", ctrl: false }
  if (raw === "\x1b[D") return { key: "ArrowLeft", ctrl: false }
  if (raw === "\x1b[H") return { key: "Home", ctrl: false }
  if (raw === "\x1b[F") return { key: "End", ctrl: false }
  if (raw === "\x1b[3~") return { key: "Delete", ctrl: false }
  if (raw === " ") return { key: " ", ctrl: false }

  // Ctrl+letter (0x01-0x1a → a-z)
  if (raw.length === 1) {
    const code = raw.charCodeAt(0)
    if (code >= 1 && code <= 26) {
      return { key: String.fromCharCode(code + 96), ctrl: true }
    }
    return { key: raw, ctrl: false }
  }

  return { key: raw, ctrl: false }
}
