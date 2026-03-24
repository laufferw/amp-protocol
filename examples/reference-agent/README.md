# AMP Reference Agent — Hello World

The simplest possible AMP agent. Two files, three capabilities, zero magic.

Use this as the starting point for building your own AMP-compliant agent.

---

## What's in here

| File | Purpose |
|---|---|
| `agent.py` | AMP agent — serves the manifest + handles messages |
| `client.py` | Demo client — sends AMP messages and prints responses |
| `requirements.txt` | Dependencies |

---

## Quick Start

### 1. Install dependencies

```bash
pip install fastapi uvicorn httpx
```

### 2. Start the agent

```bash
python agent.py
```

You'll see:
```
🤖 AMP Reference Agent starting on port 8765
   Manifest: http://localhost:8765/.well-known/agent.json
   Messages: http://localhost:8765/api/amp/message
```

### 3. Run the client (in a new terminal)

```bash
python client.py
```

The client will:
1. Fetch the agent's capability manifest
2. Send 4 demo AMP messages (echo, math, summarize, unknown intent)
3. Print the full request/response JSON for each

---

## Expected Output

```
🤖 AMP Reference Client — Agent-to-Agent Communication Demo

🔍 Fetching agent manifest from /.well-known/agent.json ...
{
  "amp": "1.0",
  "id": "reference-agent.amp-protocol.local",
  "name": "AMP Reference Agent",
  "capabilities": [
    "echo any message back to the sender",
    "evaluate basic math expressions",
    "summarize text to a shorter form"
  ],
  ...
}

============================================================
  Demo 1: Echo
============================================================

📤 REQUEST:
{
  "amp": "1.0",
  "id": "msg_a3f1bc92d4e8",
  "from": { "id": "demo-client.amp-protocol.local", ... },
  "intent": "Please echo this message back to me",
  "context": { "text": "Hello from the AMP demo client! 👋" },
  ...
}

📥 RESPONSE:
{
  "amp": "1.0",
  "id": "msg_7c2d91a83b4f",
  "in_reply_to": "msg_a3f1bc92d4e8",
  "status": "ok",
  "result": { "echo": "Hello from the AMP demo client! 👋" },
  "confidence": 1.0,
  ...
}

✅  Status: ok
   Result: {"echo": "Hello from the AMP demo client! 👋"}
   Confidence: 1.0
```

---

## How it works

AMP has two moving parts:

### 1. The manifest (`/.well-known/agent.json`)

Every AMP agent publishes a JSON manifest describing who it is and what it can do:

```json
{
  "amp": "1.0",
  "id": "my-agent.example.com",
  "name": "My Agent",
  "capabilities": [
    "analyze financial data",
    "generate reports"
  ],
  "endpoints": {
    "message": "https://my-agent.example.com/api/amp/message"
  }
}
```

Another agent reads this to decide if your agent is the right one to call.

### 2. The message (`POST /api/amp/message`)

Messages have an **intent** (what you want) and optional **context** (what the agent needs to do it):

```json
{
  "amp": "1.0",
  "id": "msg_abc123",
  "from": { "id": "caller.example.com", "type": "agent" },
  "to": "my-agent.example.com",
  "intent": "Summarize this quarterly report",
  "context": { "text": "Q3 revenue was..." },
  "timestamp": "2026-01-01T12:00:00Z"
}
```

The response carries **status**, **result**, and optional **confidence**:

```json
{
  "amp": "1.0",
  "id": "msg_def456",
  "in_reply_to": "msg_abc123",
  "from": { "id": "my-agent.example.com" },
  "status": "ok",
  "result": { "summary": "Q3 was strong..." },
  "confidence": 0.85,
  "timestamp": "2026-01-01T12:00:01Z"
}
```

---

## Building your own AMP agent

1. **Copy `agent.py`** and change `AGENT_ID`, `AGENT_NAME`

2. **Update the manifest** — add your real capabilities in `AGENT_MANIFEST["capabilities"]`

3. **Add intent routing** — in `receive_message()`, add `if "your keyword" in intent:` blocks

4. **Return AMP responses** using `amp_ok()` or `amp_error()`

That's it. The protocol is just JSON over HTTP — no SDK required.

### Minimal example

```python
# In receive_message():
if "weather" in intent:
    city = context.get("city", "unknown")
    forecast = fetch_weather(city)  # your real logic here
    return amp_ok(
        request_id=request_id,
        result={"city": city, "forecast": forecast},
        confidence=0.9,
    )
```

---

## AMP Message Schema (quick reference)

See the full spec in [SPEC.md](../../SPEC.md).

### Required request fields
- `amp` — always `"1.0"`
- `id` — unique message ID
- `from.id` — sender identifier
- `to` — recipient identifier or URL
- `intent` — what you want (plain English, LLM-readable)
- `timestamp` — ISO 8601

### Required response fields
- `amp`, `id`, `from.id`, `timestamp` — same as above
- `in_reply_to` — the request's `id`
- `status` — `"ok"` | `"error"` | `"partial"` | `"deferred"` | `"refused"`

---

*AMP v1.0-draft — [amp-protocol](https://github.com/laufferw/amp-protocol)*
