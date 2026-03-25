# AMP Interactive Demo

An interactive TUI demo of the AMP protocol — runs in your **browser** (via [Gridland](https://gridland.io)) or a **native terminal**.

Built with [Gridland](https://gridland.io) + OpenTUI. No install required for the browser version.

---

## What it shows

1. Fetches the agent's `/.well-known/agent.json` manifest — displays capabilities and endpoints
2. Lets you pick a capability: **echo**, **math**, **summarize**, or **custom intent**
3. Builds the full AMP request JSON in front of you before sending
4. Sends the request to the reference agent and displays the full AMP response JSON
5. Highlights key fields: `status`, `result`, `confidence`, `uncertainty`

The goal: understand the AMP protocol by seeing real requests and responses.

---

## Prerequisites

Start the reference agent first:

```bash
cd ../reference-agent
pip install -r requirements.txt
python agent.py
# Running at http://localhost:8765
```

---

## Run in browser

```bash
npm install
npm run dev
# Open http://localhost:5173
```

Or build for production:

```bash
npm run build
npm run preview
```

---

## Controls

| Key | Action |
|-----|--------|
| `↑` / `↓` or `j` / `k` | Navigate menu |
| `1`–`4` | Select capability directly |
| `Enter` | Confirm / send |
| `Esc` | Go back |
| `R` | Try again (on response screen) |
| `Q` / `Ctrl+C` | Quit |

---

## How it works

The demo is built with [`@gridland/web`](https://gridland.io) — a React-based TUI renderer that draws to an HTML canvas in the browser using the same component model that runs in a native terminal.

The AMP protocol flow:
```
Browser TUI → buildAmpRequest() → POST /api/amp/message → Reference Agent → AmpResponse
```

Every request includes:
- `amp: "1.0"` — protocol version
- `from` — sender identity
- `to` — recipient agent ID
- `intent` — what you want (LLM-readable free text)
- `type: "query"` — message type
- `sync: true` — wait for response
- `timestamp` — ISO 8601

See the full spec at [SPEC.md](../../SPEC.md).
