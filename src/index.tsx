/** @jsxImportSource @opentui/solid */
import { createSignal } from "solid-js"
import type { TuiPluginModule } from "@opencode-ai/plugin/tui"

type Mode = "normal" | "insert"

const MOTIONS: Record<string, string> = {
  h: "input.move.left",
  l: "input.move.right",
  j: "input.move.down",
  k: "input.move.up",
  w: "input.word.forward",
  b: "input.word.backward",
  "0": "input.line.home",
  $: "input.line.end",
  G: "input.buffer.end",
}

const EDITS: Record<string, string> = {
  x: "input.delete",
  u: "input.undo",
}

const plugin: TuiPluginModule = {
  id: "vimcode",
  tui: async (api) => {
    const [mode, setMode] = createSignal<Mode>("insert")

    function dispatch(cmd: string) {
      setTimeout(() => api.keymap.dispatchCommand(cmd), 0)
    }

    function enterInsert() {
      setMode("insert")
    }

    // ── Key intercept ───────────────────────────────────────────
    // Single intercept handles both escape (insert→normal) and
    // all normal-mode keys. Runs before any layer.
    api.keymap.intercept(
      "key",
      (ctx) => {
        if (ctx.event.eventType === "release") return
        const ev = ctx.event
        const name: string = ev.name

        // ── Escape: insert → normal ──
        if (name === "escape" && mode() === "insert") {
          ctx.consume()
          setMode("normal")
          return
        }

        // ── Enter in insert mode: newline, not submit ──
        // Ctrl+Enter submits from any mode.
        if (name === "return" && mode() === "insert") {
          if (ev.ctrl) return // let ctrl+enter fall through to submit
          ctx.consume()
          dispatch("input.newline")
          return
        }

        // ── Tab in insert mode: block agent cycling ──
        // In normal mode, tab falls through to cycle agents as usual.
        if (name === "tab" && mode() === "insert") {
          ctx.consume()
          return
        }

        // Everything below is normal-mode only
        if (mode() !== "normal") return

        // Let meta/super pass through
        if (ev.meta || ev.super) return
        // Let most ctrl combos pass through (except vim ones)
        if (ev.ctrl) {
          if (name === "r") { ctx.consume(); dispatch("input.redo"); return }
          return
        }

        // Translate shifted keys
        let key = name
        if (ev.shift && name.length === 1) {
          if (/[a-z]/.test(name)) key = name.toUpperCase()
          else if (name === "4") key = "$"
          else if (name === "6") key = "^"
        }

        // ── Submit: Enter in normal mode ──
        if (name === "return") {
          ctx.consume()
          dispatch("input.submit")
          return
        }

        // In normal mode, let escape pass through to OpenCode's
        // double-escape session_interrupt handler.
        if (name === "escape") return

        // ── Motions ──
        if (key in MOTIONS) {
          ctx.consume()
          dispatch(MOTIONS[key])
          return
        }

        // ── gg (buffer home) ──
        if (key === "g") {
          // Can't do sequences in an intercept, so just dispatch buffer.home.
          // A real gg would need state tracking; for now single g = go top.
          ctx.consume()
          dispatch("input.buffer.home")
          return
        }

        // ── Edits ──
        if (key in EDITS) {
          ctx.consume()
          dispatch(EDITS[key])
          return
        }

        // ── dd (delete line) ──
        // Same sequence caveat as gg — single d deletes line for now
        if (key === "d") {
          ctx.consume()
          dispatch("input.delete.line")
          return
        }

        // ── D (delete to end of line) ──
        if (key === "D") {
          ctx.consume()
          dispatch("input.delete.to.line.end")
          return
        }

        // ── Insert entries ──
        if (key === "i") { ctx.consume(); enterInsert(); return }
        if (key === "a") { ctx.consume(); dispatch("input.move.right"); enterInsert(); return }
        if (key === "A") { ctx.consume(); dispatch("input.line.end"); enterInsert(); return }
        if (key === "o") {
          ctx.consume()
          dispatch("input.line.end")
          dispatch("input.newline")
          enterInsert()
          return
        }
        if (key === "O") {
          ctx.consume()
          dispatch("input.line.home")
          dispatch("input.newline")
          dispatch("input.move.up")
          enterInsert()
          return
        }

        // ── Unbound key — consume to prevent insertion ──
        ctx.consume()
      },
      { priority: 10_000 },
    )

    // ── Mode indicator ──────────────────────────────────────────
    const indicator = () => {
      const m = mode()
      const label = m === "normal" ? "NORMAL" : "INSERT"
      const color = m === "normal"
        ? api.theme.current.warning
        : api.theme.current.success
      return (
        <box paddingLeft={1} paddingRight={1}>
          <text fg={color} bold>{label}</text>
        </box>
      )
    }

    api.slots.register({
      slots: {
        session_prompt_right: indicator,
        home_prompt_right: indicator,
      },
    })
  },
}

export default plugin
