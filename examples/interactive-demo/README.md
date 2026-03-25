# AMP Protocol — Interactive Demo

An educational TUI that lets you interactively send AMP messages to the reference agent and see the protocol in action. The JSON request and response are displayed explicitly so you can understand exactly how AMP works.

## Architecture

Two modes:

| Mode | Runtime | How it works |
|------|---------|-------------|
| **Browser** | Vite + [Gridland](https://gridland.io) (`@gridland/web`) | Canvas-rendered TUI in your browser — keyboard navigation, colored JSON, the works |
| **Terminal** | Node.js (zero deps) | Pure readline TUI with ANSI colors — works anywhere Node runs |

Both modes talk to the same reference agent over HTTP.

## Prerequisites

Start the reference agent first:

```bash
cd ../reference-agent
pip install fastapi uvicorn
python agent.py
# → Running on http://localhost:8765
```

## Run in Browser (Gridland)

```bash
npm install
npm run dev
# → opens http://localhost:5173
```

**User flow:**
1. App fetches and displays the agent's manifest (capabilities, endpoints)
2. Pick a capability: Echo / Math / Summarize / Custom
3. Type your input
4. See the full AMP request JSON that will be sent
5. Send it → see the full AMP response JSON
6. Try again or quit

## Run in Terminal (Node.js)

```bash
node terminal-demo.mjs
```

No `npm install` needed — uses only Node.js built-ins.

## What you'll learn

- How `/.well-known/agent.json` manifests work (discovery)
- The structure of an AMP request: `intent`, `context`, `from`/`to`, `type`
- The structure of an AMP response: `status`, `result`, `confidence`, `uncertainty`
- How intent-first messaging differs from RPC-style calls
- Error handling: `capability_mismatch`, `intent_unclear`, etc.

## Files

```
interactive-demo/
├── README.md              ← you are here
├── package.json           ← Gridland + Vite deps (browser mode)
├── index.html             ← Vite entry point
├── vite.config.ts         ← Vite + Gridland plugin config
├── tsconfig.json          ← TypeScript config
├── gridland-jsx.d.ts      ← JSX type declarations
├── src/
│   ├── main.tsx           ← React entry point
│   └── App.tsx            ← Main Gridland TUI app (all screens)
└── terminal-demo.mjs      ← Standalone Node.js terminal version
```

## About Gridland

[Gridland](https://gridland.io) is a React-based TUI framework built on [OpenTUI](https://opentui.com). It renders terminal-style UIs to a `<canvas>` in the browser, giving you:

- Monospace grid rendering with sub-pixel precision
- Keyboard input handling via `useKeyboard` hook
- React component model (Box, Text, etc.)
- Same app runs in browser AND native terminal (with `bun` + `@gridland/bun`)

The browser mode uses `@gridland/web` with the Vite plugin. For native terminal rendering, you'd use `@gridland/bun` (requires `bun` and `zig` installed). The terminal fallback in this demo uses plain Node.js readline as a portable alternative.
