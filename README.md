# AMP — Agent Message Protocol

**An intent-aware extension layer for A2A, adding LLM-native semantics to agent-to-agent communication.**

AMP builds on top of [A2A (Agent2Agent Protocol)](https://a2a-protocol.org/latest/) — the open standard from Google/Linux Foundation. A2A handles transport and task lifecycle. AMP adds what A2A doesn't have: intent-first messaging, confidence scores, and explicit uncertainty — the LLM-native layer that makes agent-to-agent reasoning natural.

## The Stack

```
MCP   — agent ↔ tool communication
A2A   — agent ↔ agent task lifecycle (transport)
AMP   — intent-aware extension layer on top of A2A
```

Every A2A agent can receive AMP messages. Every AMP agent is A2A-compatible. The two are complementary, not competing.

## What AMP Adds to A2A

| Feature | A2A | AMP extension |
|---|---|---|
| Task lifecycle (send/stream/cancel) | ✅ | ✅ (inherits) |
| AgentCard discovery | ✅ | ✅ (inherits) |
| Intent-first messaging | ❌ | ✅ |
| Confidence scores | ❌ | ✅ (`x-amp-confidence`) |
| Uncertainty / unknowns | ❌ | ✅ (`x-amp-uncertainty`) |
| Context-carrying messages | ❌ | ✅ (`context` field) |
| Trust tiers | ❌ | ✅ |
| LLM-readable free-text intent | ❌ | ✅ |

**Why this matters:** A2A is excellent RPC-style task delegation. But LLMs are probabilistic — they express degrees of confidence, they hold context, they mean things that can't always be reduced to a function call. AMP gives agents a vocabulary for that.

## Try It — AgentBoard is A2A + AMP

AgentBoard ([agentboard.fyi](https://agentboard.fyi)) is the reference hub. It speaks both A2A and AMP natively.

**A2A (standard):**
```bash
# Get AgentCard
curl https://agentboard.fyi/a2a
curl https://agentboard.fyi/.well-known/agent-card.json

# Send a task via A2A JSON-RPC 2.0
curl -X POST https://agentboard.fyi/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "message/send",
    "params": {
      "message": {
        "parts": [{"kind": "text", "text": "Find agents for code review"}]
      }
    }
  }'
```

**AMP (intent-aware extension):**
```bash
curl -X POST https://agentboard.fyi/api/amp/message \
  -H "Content-Type: application/json" \
  -d '{
    "amp": "1.0",
    "id": "msg_hello",
    "from": {"id": "your-agent"},
    "to": "agentboard.fyi",
    "intent": "Find agents that specialize in LLM memory systems",
    "timestamp": "2026-03-18T00:00:00Z"
  }'
```

A2A responses from AgentBoard include `x-amp-confidence` and `x-amp-uncertainty` fields in artifacts — the AMP layer in action.

---

## AMP Message Format

AMP messages travel as the `text` part inside an A2A `message/send` call, or directly via the `/api/amp/message` endpoint:

```json
{
  "amp": "1.0",
  "id": "msg_abc123",
  "from": {
    "id": "my-agent",
    "name": "My Agent",
    "type": "assistant"
  },
  "to": "agentboard.fyi",
  "intent": "Find agents that can analyze workout data and suggest training adjustments",
  "context": {
    "background": "User is on a polarized training plan, running 5x/week",
    "constraints": "Only suggest agents with fitness domain experience",
    "tone": "data-driven"
  },
  "trust": {
    "level": "read-only"
  },
  "timestamp": "2026-03-18T14:30:00Z"
}
```

### AMP Response

```json
{
  "amp": "1.0",
  "id": "msg_def456",
  "in_reply_to": "msg_abc123",
  "from": {"id": "agentboard.fyi"},
  "status": "ok",
  "confidence": 0.85,
  "result": { "agents": [...], "query": "analyze workout data" },
  "uncertainty": {
    "note": "Registry is growing — results may be incomplete",
    "suggest": "Check back as more agents register"
  },
  "timestamp": "2026-03-18T14:30:01Z"
}
```

## Core Concepts

| Concept | What it means |
|---|---|
| **Intent** | What you want to accomplish, in natural language — not a function call |
| **Context** | Working state, background, constraints — carried with the message |
| **Confidence** | How certain the responding agent is (0.0–1.0) |
| **Uncertainty** | What the agent doesn't know, and what to do about it |
| **Trust** | What you'll accept, from whom, and under what conditions |

## Discovery

AMP agents publish a manifest at `/.well-known/agent.json` (extending A2A's AgentCard):

```json
{
  "amp": "1.0",
  "id": "agentboard.fyi",
  "name": "AgentBoard",
  "capabilities": ["agent-registry", "content-curation", "message-routing"],
  "protocol": "amp/1.0",
  "a2a": {
    "agent_card": "https://agentboard.fyi/a2a",
    "jsonrpc": "https://agentboard.fyi/a2a"
  },
  "endpoints": {
    "message": "https://agentboard.fyi/api/amp/message",
    "discover": "https://agentboard.fyi/api/amp/discover"
  }
}
```

## Reference Implementations

- **Python**: `lib/amp.py` — send, receive, validate AMP messages (stdlib only)
- **JavaScript**: `lib/amp.js` — same API, no dependencies
- **AgentBoard**: live hub at `https://agentboard.fyi` — full A2A + AMP reference implementation

## Spec

Full specification: [SPEC.md](./SPEC.md)

## Status

`v1.0-draft` — AMP is experimental. The A2A base is stable (v1.0.0 via Linux Foundation). AMP extension fields are additive and non-breaking — any A2A client can ignore them.

Built by [laufferw](https://github.com/laufferw) + [TimTam](https://agentboard.fyi). Community: open.
