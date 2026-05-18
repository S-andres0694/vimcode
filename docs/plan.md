# vimcode: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An OpenCode TUI plugin that adds vim-style modal editing (normal/insert modes) to the prompt textarea.

**Architecture:** A single-file TUI plugin registers two keymap layers (one for insert mode, one for normal mode), gated by a SolidJS signal via `activeWhen`. Layers use a priority high enough to win over OpenCode's defaults (verified in Task 0). Normal mode maps single keys (h, j, k, l, w, b, etc.) to existing textarea commands. A `key:after` intercept suppresses character insertion for any unbound key in normal mode. A slot component shows the current mode next to the prompt.

**Tech Stack:** TypeScript, SolidJS, `@opentui/keymap` (layers, `activeWhen`, intercepts, sequences), `@opencode-ai/plugin/tui`

**Reference locations in the OpenCode repo (`~/repos/opensource/opencode`):**
- Plugin types: `packages/plugin/src/tui.ts` -- `TuiPluginApi`, `TuiKeymap`, slot types
- Keymap types: `packages/opencode/node_modules/@opentui/keymap/src/types.d.ts` -- `Layer`, `Binding`, intercepts
- Keymap SolidJS helpers: `packages/opencode/node_modules/@opentui/keymap/src/solid/index.d.ts` -- `reactiveMatcherFromSignal`
- Existing command names: `packages/opencode/src/cli/cmd/tui/config/keybind.ts` -- `CommandMap` object
- Example plugin: `.opencode/plugins/tui-smoke.tsx` (1000-line exercise of the full plugin API)
- Plugin runtime: `packages/opencode/src/cli/cmd/tui/plugin/runtime.ts`
- Plugin discovery: `.opencode/plugins/*.{ts,js}` auto-discovered, or `plugin` array in config

---

## Decisions

Explicit behavioral choices for the prototype:

- **Enter submits from normal mode.** No Enter binding in the normal-mode layer — pressing Enter sends the prompt regardless of mode. This lets users `escape` then `enter` to submit without switching back to insert. Vim's `enter` (move to next line) is not implemented.
- **Backspace is suppressed in normal mode.** The `key:after` intercept catches it as an unbound, unmodified key. This matches vim (backspace is a motion in normal mode, not a delete). If this feels wrong during dogfooding, bind backspace to `input.move.left`.
- **Mode persists across prompt submissions.** After submitting, the mode signal keeps its value. If you submit from normal mode, the next prompt starts in normal mode. This is a known UX cliff — the user must press `i` before typing. Acceptable for the prototype; a future version should reset to insert on submit if the API exposes a submit event hook.
- **No focus scoping.** The layers are active whenever the mode signal matches, regardless of which widget is focused. The intercept guards against dialogs (`api.ui.dialog.open`), and modifier combos pass through. If this causes issues with non-prompt UI (file picker, session list), add a focus condition to `activeWhen` in a follow-up.
- **No layer disposal.** `registerLayer` likely returns a disposer; the prototype doesn't capture it. This means hot-reloading the plugin during development will accumulate duplicate layers. Acceptable for now — restart opencode to reset.

---

## File structure

```
vimcode/
  package.json          # npm package, peer deps on @opentui/* and @opencode-ai/plugin
  tsconfig.json         # TypeScript config
  src/
    index.tsx           # plugin module export + all implementation
```

One file for the prototype. The plugin is ~200 lines. Split when it grows.

---

### Task 0: verify API shapes

**Files:** None (read-only investigation)

Before writing any code, read the actual type definitions and confirm every API assumption the plan relies on. This is the cheapest insurance against "builds fine, does nothing."

- [ ] **Step 1: Verify command names**

Open `packages/opencode/src/cli/cmd/tui/config/keybind.ts` and confirm these exact command IDs exist in `CommandMap`:

- `input.move.left`, `input.move.right`, `input.move.down`, `input.move.up`
- `input.word.forward`, `input.word.backward`
- `input.line.home`, `input.line.end`
- `input.buffer.home`, `input.buffer.end`
- `input.delete`, `input.delete.line`, `input.delete.to.line.end`
- `input.undo`, `input.redo`
- `input.newline`

If any name is wrong, update the binding tables in Tasks 3a-3c before implementing.

- [ ] **Step 2: Verify keymap API shapes**

Read `packages/opencode/node_modules/@opentui/keymap/src/types.d.ts` and confirm:

1. `registerLayer` accepts a `priority` field and an `activeWhen` field.
2. A binding's `cmd` field accepts both a string command name *and* an inline function `() => boolean`. If `cmd` only accepts strings, the escape absorber (`cmd: () => true`) and the insert-mode escape binding need to use a named command instead.
3. A layer's `commands` array uses `{ name: string, run: () => boolean }` shape (not `execute`, `handler`, etc.).

- [ ] **Step 3: Verify intercept API**

Read the intercept types and confirm:

1. `intercept("key:after", callback)` is the correct signature.
2. The callback's `ctx` object has: `handled` (boolean), `consume()` (method), `event.ctrl` / `event.meta` / `event.super` / `event.alt` (booleans on the event, not nested in a `modifiers` object).

- [ ] **Step 4: Verify dispatchCommand**

Read `packages/plugin/src/tui.ts` (`TuiKeymap` type) and confirm:

1. The method is called `dispatchCommand` (not `dispatch`, `runCommand`, `execute`).
2. It is synchronous (returns `void` or `boolean`, not `Promise`). The `vim.open.below` and `vim.open.above` commands chain multiple dispatches in the same tick and rely on sequential execution.

- [ ] **Step 5: Verify key syntax**

Check how `@opentui/keymap` parses key strings:

1. Does it accept `"$"` as a character binding, or must it be `"shift+4"`? Use whichever the keymap canonicalizes. (The plan uses `"$"` — adjust if the engine requires `"shift+4"`.)
2. Confirm `"shift+a"`, `"shift+g"`, `"shift+d"`, `"shift+o"` resolve correctly. If the engine uses uppercase letters (`"A"`, `"G"`, etc.), update all shifted-letter bindings.
3. Confirm space-separated keys (`"g g"`, `"d d"`) create two-key sequences.

- [ ] **Step 6: Verify slot and theme API**

Confirm in `packages/plugin/src/tui.ts`:

1. `api.slots.register` accepts a component function (SolidJS-style, called once with reactive subscriptions), not a render function called on every update.
2. `api.theme.current.warning` and `api.theme.current.success` are valid color paths.
3. `api.ui.dialog.open` exists and is a plain boolean (not a signal accessor that needs `()` to read).

- [ ] **Step 7: Verify import paths**

Confirm `@opentui/keymap` exports a `/solid` subpath in its `package.json` `exports` map. If it doesn't, `import { reactiveMatcherFromSignal } from "@opentui/keymap/solid"` will fail at load time.

- [ ] **Step 8: Check existing layer priorities**

Look at how OpenCode registers its own keybind layers (in `keybind.ts` or the plugin runtime). Note the priority numbers used. Pick a priority for the vimcode layers that is strictly higher. The plan uses `1000` — adjust if needed.

- [ ] **Step 9: Record findings**

Update the plan's code snippets with any corrections found above (command names, key syntax, API shapes, priority number). If `dispatchCommand` is async, redesign the `o`/`O` implementations to await.

---

### Task 1: project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/index.tsx`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "vimcode",
  "version": "0.0.1",
  "type": "module",
  "private": true,
  "exports": {
    ".": "./src/index.tsx"
  },
  "peerDependencies": {
    "@opencode-ai/plugin": "*",
    "@opentui/core": "*",
    "@opentui/keymap": "*",
    "@opentui/solid": "*",
    "solid-js": "*"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "jsxImportSource": "@opentui/solid",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create plugin entry skeleton**

Create `src/index.tsx` with a no-op plugin that proves the loading path works:

```tsx
/** @jsxImportSource @opentui/solid */
import type { TuiPluginModule } from "@opencode-ai/plugin/tui"

const plugin: TuiPluginModule = {
  id: "vimcode",
  tui: async (api) => {
    api.ui.toast({ message: "vimcode loaded", variant: "info", duration: 2000 })
  },
}

export default plugin
```

- [ ] **Step 4: Register plugin in OpenCode for testing**

Create or edit `~/.opencode/config.json` to add the plugin path:

```json
{
  "plugin": ["~/repos/personal/vimcode"]
}
```

If that doesn't resolve, try the absolute form: `"file:///Users/orbarila/repos/personal/vimcode"`.

- [ ] **Step 5: Verify plugin loads**

Run `opencode` in any project directory. You should see the "vimcode loaded" toast. If it doesn't appear, check `opencode --debug` output for plugin loading errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "scaffold: plugin entry point and package config"
```

---

### Task 2: mode state and escape-to-normal

**Files:**
- Modify: `src/index.tsx`

Adds:
- A SolidJS signal for the current mode (`normal` | `insert`)
- An insert-mode layer: escape switches to normal
- The mode indicator slot so we can visually confirm switching works

We add the indicator early (instead of deferring it) because debugging mode transitions without visual feedback is miserable.

- [ ] **Step 1: Write the full plugin body**

Replace `src/index.tsx`:

```tsx
/** @jsxImportSource @opentui/solid */
import { createSignal } from "solid-js"
import { reactiveMatcherFromSignal } from "@opentui/keymap/solid"
import type { TuiPluginModule } from "@opencode-ai/plugin/tui"

type Mode = "normal" | "insert"

const plugin: TuiPluginModule = {
  id: "vimcode",
  tui: async (api) => {
    const [mode, setMode] = createSignal<Mode>("insert")

    // --- Insert mode layer ---
    // Only binding: escape switches to normal mode.
    api.keymap.registerLayer({
      priority: 1000,
      bindings: [
        {
          key: "escape",
          cmd: () => {
            setMode("normal")
            return true
          },
        },
      ],
      activeWhen: reactiveMatcherFromSignal(mode, (m) => m === "insert"),
    })

    // --- Mode indicator ---
    const indicator = () => {
      const label = () => (mode() === "normal" ? "NORMAL" : "INSERT")
      const color = () =>
        mode() === "normal" ? api.theme.current.warning : api.theme.current.success
      return (
        <box paddingLeft={1} paddingRight={1}>
          <text fg={color()} bold={true}>
            {label()}
          </text>
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
```

Priority is set to `1000` to win over OpenCode's default layers (verified in Task 0 Step 8 — adjust if needed).

- [ ] **Step 2: Verify mode indicator**

Run opencode. You should see `INSERT` in green next to the prompt. Press escape -- it should change to `NORMAL` in yellow/orange. You can't switch back to insert yet (no `i` binding), so restart opencode to reset.

Verify both surfaces: the home screen prompt and inside a session. Both should show the indicator.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: mode signal, escape-to-normal, mode indicator"
```

---

### Task 3a: basic motions and insert entry

**Files:**
- Modify: `src/index.tsx`

Adds a normal mode layer with the smallest testable slice: `h`/`j`/`k`/`l` motions and `i` to return to insert mode. This proves the layer activation, priority, command dispatch, and mode switching all work end-to-end before adding more bindings.

- [ ] **Step 1: Add the normal mode layer with basic motions**

Add after the insert-mode layer in `src/index.tsx`, before the indicator code:

```tsx
    // --- Normal mode layer ---
    api.keymap.registerLayer({
      priority: 1000,
      commands: [
        {
          name: "vim.insert",
          run: () => {
            setMode("insert")
            return true
          },
        },
      ],
      bindings: [
        // Basic motions
        { key: "h", cmd: "input.move.left" },
        { key: "l", cmd: "input.move.right" },
        { key: "j", cmd: "input.move.down" },
        { key: "k", cmd: "input.move.up" },

        // Insert entry
        { key: "i", cmd: "vim.insert" },

        // Absorb escape so double-escape doesn't trigger session_interrupt
        { key: "escape", cmd: () => true },
      ],
      activeWhen: reactiveMatcherFromSignal(mode, (m) => m === "normal"),
    })
```

- [ ] **Step 2: Verify basic motions**

Run opencode. Type a few lines of text. Press escape (indicator says NORMAL).
- `h`/`l`/`j`/`k` -- cursor moves
- `i` -- indicator says INSERT, typing works
- Press escape again -- back to NORMAL
- Random letters (f, w, q) still insert text -- expected, fixed in Task 4

- [ ] **Step 3: Verify escape absorption**

Press escape twice rapidly in normal mode. The indicator should stay on NORMAL. Session should NOT be interrupted. `ctrl+c` should still work for exit/interrupt.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: normal mode layer with basic motions and i"
```

---

### Task 3b: remaining motions and insert entries

**Files:**
- Modify: `src/index.tsx`

Adds word motions (`w`/`b`/`e`), line motions (`0`/`$`), buffer motions (`gg`/`G`), and all insert entry commands (`a`/`A`/`o`/`O`).

**Note on `$`:** the plan uses `"$"` as the key string. If Task 0 Step 5 found the keymap requires `"shift+4"`, substitute here.

**Note on `O`:** the `vim.open.above` implementation chains `input.line.home` → `input.newline` → `input.move.up`. The correctness of this sequence depends on `input.newline` leaving the cursor on the new lower line. If during testing `O` lands on the wrong line, adjust the sequence (e.g., try `input.move.up` → `input.line.end` → `input.newline` instead).

- [ ] **Step 1: Add remaining motions and insert commands**

Expand the normal mode layer's `commands` and `bindings` arrays:

```tsx
    // Add to commands array:
        {
          name: "vim.append",
          run: () => {
            api.keymap.dispatchCommand("input.move.right")
            setMode("insert")
            return true
          },
        },
        {
          name: "vim.append.eol",
          run: () => {
            api.keymap.dispatchCommand("input.line.end")
            setMode("insert")
            return true
          },
        },
        {
          name: "vim.open.below",
          run: () => {
            api.keymap.dispatchCommand("input.line.end")
            api.keymap.dispatchCommand("input.newline")
            setMode("insert")
            return true
          },
        },
        {
          name: "vim.open.above",
          run: () => {
            // See note above — verify cursor placement during testing
            api.keymap.dispatchCommand("input.line.home")
            api.keymap.dispatchCommand("input.newline")
            api.keymap.dispatchCommand("input.move.up")
            setMode("insert")
            return true
          },
        },

    // Add to bindings array:
        // Word motions
        { key: "w", cmd: "input.word.forward" },
        { key: "b", cmd: "input.word.backward" },
        { key: "e", cmd: "input.word.end" },

        // Line motions
        { key: "0", cmd: "input.line.home" },
        { key: "$", cmd: "input.line.end" },

        // Buffer motions
        { key: "g g", cmd: "input.buffer.home" },
        { key: "shift+g", cmd: "input.buffer.end" },

        // Insert entries
        { key: "a", cmd: "vim.append" },
        { key: "shift+a", cmd: "vim.append.eol" },
        { key: "o", cmd: "vim.open.below" },
        { key: "shift+o", cmd: "vim.open.above" },
```

Note on `e`: maps to `input.word.end`. If this command doesn't exist in `CommandMap` (check Task 0), remove `e` and leave it in the deferred list.

Note on `g g`: space-separated keys create a two-key sequence. The `@opentui/keymap` engine handles the sequence state automatically. Verify that pressing `g` then `escape` cancels the pending sequence (standard vim behavior).

- [ ] **Step 2: Verify word and line motions**

From normal mode:
- `w`/`b` -- cursor jumps by word
- `e` -- cursor jumps to end of word (if command exists)
- `0` -- start of line, `$` -- end of line
- `gg` -- top of buffer, `G` -- bottom

- [ ] **Step 3: Verify insert entries**

From normal mode:
- `i` -- INSERT, cursor stays (already tested)
- `a` -- cursor moves right one, then INSERT
- `A` -- cursor jumps to end of line, then INSERT
- `o` -- new line below, INSERT
- `O` -- new line above, INSERT (check cursor lands on the new blank line, not the line above original)

- [ ] **Step 4: Verify sequence cancellation**

Press `g`, then `escape`. The pending sequence should cancel. The indicator should stay on NORMAL. Then press `g g` -- should jump to top of buffer.

Same for `d` (once editing bindings exist in 3c): press `d` then `escape` should cancel.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: word/line/buffer motions, insert entries (a/A/o/O)"
```

---

### Task 3c: editing operators

**Files:**
- Modify: `src/index.tsx`

Adds editing bindings: `x` (delete char), `dd` (delete line), `D` (delete to EOL), `u` (undo), `ctrl+r` (redo).

**Note on `x`:** maps to `input.delete`. Verify during testing that this deletes the character *under* the cursor (vim's `x`), not the character before it (backspace semantics). If it's backspace-semantics, `x` will feel off-by-one.

- [ ] **Step 1: Add editing bindings**

Add to the normal mode layer's `bindings` array:

```tsx
        // Editing
        { key: "x", cmd: "input.delete" },
        { key: "d d", cmd: "input.delete.line" },
        { key: "shift+d", cmd: "input.delete.to.line.end" },
        { key: "u", cmd: "input.undo" },
        { key: "ctrl+r", cmd: "input.redo" },
```

- [ ] **Step 2: Verify editing**

From normal mode:
- `x` -- deletes character under cursor (not before it)
- `dd` -- deletes entire line
- `D` -- deletes from cursor to end of line
- `u` -- undoes last change
- `ctrl+r` -- redoes

- [ ] **Step 3: Verify `x` semantics**

Position cursor in the middle of a word. Press `x`. The character the cursor was sitting on should disappear, and the character to the right should slide into its place. If instead the character to the *left* disappears, `input.delete` has backspace semantics — file a note and decide whether to keep it or find an alternative command.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: editing operators (x/dd/D/u/ctrl+r)"
```

---

### Task 4: suppress character insertion in normal mode

**Files:**
- Modify: `src/index.tsx`

In normal mode, pressing a key not bound to any command (like `f`, `q`, `z`) currently still inserts text because the key falls through to the textarea. We need a `key:after` intercept that catches unhandled keys and prevents insertion.

- [ ] **Step 1: Add the key:after intercept**

Add after the normal mode layer, before the indicator code:

```tsx
    // --- Suppress unbound keys in normal mode ---
    api.keymap.intercept("key:after", (ctx) => {
      if (mode() !== "normal") return
      if (ctx.handled) return
      // Let dialogs handle their own input
      if (api.ui.dialog.open) return
      // Don't suppress modifier combos -- other layers may need them
      if (ctx.event.ctrl || ctx.event.meta || ctx.event.super || ctx.event.alt) return
      ctx.consume()
    })
```

- [ ] **Step 2: Verify suppression**

Run opencode. Type text. Press escape.
- Press `f`, `q`, `z`, `p`, `r` -- nothing is inserted
- Press `h`, `l`, `j`, `k` -- cursor moves (these are bound, not suppressed)
- Press `i` -- switches to insert mode, typing works again
- Press backspace in normal mode -- nothing happens (suppressed as an unbound, unmodified key)

- [ ] **Step 3: Verify dialogs still work**

Press escape to enter normal mode, then `ctrl+p` to open the command palette. Type in the search field -- characters should appear. Close the palette with escape.

- [ ] **Step 4: Verify modifier keys pass through**

In normal mode:
- `ctrl+c` -- should exit/interrupt
- `ctrl+p` -- command palette opens
- `alt+<key>` -- should pass through (not suppressed)

These are not suppressed because of the modifier guard.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: suppress unbound key insertion in normal mode"
```

---

## What's not in the prototype

Listed here so a future plan can pick them up without rethinking the architecture.

**Needs new state machines or subsystems:**
- **Visual mode** (v, V, ctrl+v): needs the textarea selection API, which may not be exposed
- **Operator + motion combos** (dw, cw, yw, ci, di): needs a state machine for operator-pending mode. Also covers `c` (change), `cc` (change line), `C` (change to EOL)
- **Counts** (3j, 5x): needs a digit accumulator that feeds into motion/operator dispatch
- **Registers and yanking** (y, yy, p, P, named registers): needs clipboard integration + register state. Consider mapping `p` to OpenCode's existing paste command as a quick win
- **Search** (/, ?, n, N): needs a search overlay UI
- **Dot repeat** (.): needs a command history ring
- **Marks** (m, '): needs mark state tied to buffer positions
- **Replace char** (r): single-keystroke but needs a "next key" capture state

**Needs minor additions only (no arch changes):**
- **Word-end motions** (e, ge): one binding each, if `input.word.end` exists in `CommandMap`
- **Substitute** (s, S): `s` = delete char + insert mode; `S` = delete line + insert mode. Two commands, no new state
- **`I`** (insert at first non-blank): one command if the underlying motion exists

**Needs external capabilities:**
- **Cursor shape** (block in normal, bar in insert): depends on @opentui/core exposing cursor style control
- **Keybind overrides via config**: let users remap vim keys through plugin options + `createBindingLookup`

**Undefined behavior (decide later):**
- **Mouse clicks in normal mode**: does clicking change mode? Currently no — mode stays normal.
- **Mode reset on submit**: currently mode persists (see Decisions). A submit event hook could auto-reset to insert.
- **Hot reload / multi-instance**: no disposal story — restarting opencode is the reset mechanism.
