# vimcode — vim mode for OpenCode

# Install dependencies
install:
    npm install

# Launch OpenCode with the vimcode plugin active
dev:
    OPENCODE_TUI_CONFIG=dev-tui.json opencode

# Interactive terminal sandbox for the @vimee/core engine.
# Play with vim motions, operators, text objects — no OpenCode needed.
# Ctrl-C to exit.
test-engine:
    npx tsx test/vimee-smoke.ts
