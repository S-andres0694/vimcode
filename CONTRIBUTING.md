# Contributing to vimcode

## Development setup

```bash
npm install      # install deps
just dev         # launch OpenCode with the plugin loaded (sets OPENCODE_TUI_CONFIG=dev-tui.json)
bun test         # run characterization tests
```

Running `opencode` directly in this directory won't load the plugin; you need `just dev`.

## Adding a keybinding

1. Add the key check in the right section of `src/vim.ts` (`handleNormalKey()` for normal mode keys).
2. Return appropriate actions: `{ consume: true, actions: [{ type: "cmd", cmd: "input.some.command" }] }`
3. Add a test in `test/vim.test.ts`.
4. Run `bun test`, then `just dev` to verify in OpenCode.

See `AGENTS.md` for operator+motion combos and other patterns.

## Commit messages

Use conventional-ish prefixes: `feat:`, `fix:`, `refactor:`, `chore:`, `test:`, `docs:`.

## Changelog

Follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Add your change to `[Unreleased]` in `CHANGELOG.md` in the same PR that introduces it. Past tense, reader's perspective, one bullet per change.

## Versioning

[Semantic Versioning](https://semver.org/spec/v2.0.0.html). 0.x.y until the plugin API stabilizes:

- **PATCH**: Bug fixes, docs
- **MINOR**: New keybindings, new features (backward compatible)
- **MAJOR**: Breaking changes, removed keybindings

## Release process

Releases are manual, never automatic.

1. Verify `[Unreleased]` in CHANGELOG.md is complete.
2. Decide the version bump (SemVer rules above).
3. Move `[Unreleased]` entries into a new `## [X.Y.Z] — YYYY-MM-DD` section, keep `[Unreleased]` empty at top.
4. Update link references at bottom of CHANGELOG.md.
5. Bump version in `package.json` (`npm version X.Y.Z --no-git-tag-version`).
6. Run `bun test`.
7. Commit as `Release vX.Y.Z: <one-line summary>`.
8. Tag: `git tag vX.Y.Z`
9. Push: `git push origin main vX.Y.Z`

## Distribution

vimcode is installed via git URL in OpenCode's `tui.json`:

```json
{ "plugin": ["vimcode@git+https://github.com/oribarilan/vimcode.git"] }
```

Bare names (like `"vimcode"`) trigger npm resolution, which won't work since the package isn't published. The `@git+` prefix tells OpenCode to clone from GitHub instead.

## Architecture

`src/vim.ts` owns all key handling (pure functions). `src/index.tsx` owns all OpenCode API interaction. See `AGENTS.md` for the architecture guide.
