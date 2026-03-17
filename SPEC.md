# AMP Specification — v1.0-draft

**Agent Message Protocol**

---

## 1. Overview

AMP is a message-passing protocol for AI agent communication. It is designed around how LLMs actually operate: contextual, intent-driven, non-deterministic, and asynchronous.

AMP does not replace HTTP. It uses HTTP as transport but defines a semantic layer on top optimized for agent collaboration.

---

## 2. Principles

1. **Intent over instructions** — Senders declare goals, not procedures.
2. **Context is first-class** — Shared state travels with every message.
3. **Uncertainty is explicit** — Confidence and unknowns are part of the response contract.
4. **Async by default** — Agents operate on their own timescales.
5. **LLM-readable** — Free-text fields are written for language models to process directly.
6. **Minimal surface area** — The spec should fit in one page. Complexity is opt-in.

---

## 3. Transport

AMP messages are JSON objects transmitted over HTTPS.

- **Endpoint**: POST to the agent's `endpoints.message` URL (from `agent.json`)
- **Content-Type**: `application/json`
- **Auth**: Bearer token (tier-dependent) or unsigned (public queries)

---

## 4. Message Schema

### 4.1 Request

```
{
  "amp": "1.0",                    // required — protocol version
  "id": string,                    // required — unique message id (nanoid/uuid)
  "from": {
    "id": string,                  // required — sender identifier (domain or URN)
    "name": string,                // optional — human-readable name
    "type": string                 // optional — "agent" | "router" | "human"
  },
  "to": string | string[],         // required — recipient id(s)
  "intent": string,                // required — what you want to accomplish (LLM-readable)
  "type": string,                  // optional — "query"|"delegate"|"collaborate"|"discover"|"route"|"notify"|"negotiate"
  "context": {                     // optional — shared working state
    "background": string,          // optional — narrative context for the LLM
    "constraints": object,         // optional — hard constraints
    "budget": {
      "max_tokens": number,        // optional — max response tokens
      "max_cost_usd": number       // optional — cost ceiling
    },
    [key: string]: any             // optional — arbitrary context fields
  },
  "trust": {                       // optional — what permissions the receiver has
    "level": string,               // "read-only" | "read-write" | "full"
    "no_external_sends": boolean,  // default false
    "allowlist": string[]          // optional — permitted actions
  },
  "reply_to": string,              // optional — URL to send async response to
  "sync": boolean,                 // optional — request synchronous response (default false)
  "ttl": number,                   // optional — seconds until message expires
  "trace_id": string,              // optional — for distributed tracing
  "timestamp": string              // required — ISO 8601
}
```

### 4.2 Response

```
{
  "amp": "1.0",                    // required
  "id": string,                    // required — unique response id
  "in_reply_to": string,           // required — id of the request message
  "from": {
    "id": string,                  // required
    "name": string                 // optional
  },
  "status": string,                // required — "ok" | "error" | "partial" | "deferred" | "refused"
  "confidence": number,            // optional — 0.0–1.0
  "result": any,                   // optional — response payload
  "uncertainty": {                 // optional — what the agent isn't sure about
    "note": string,                // human/LLM-readable explanation
    "recommend": string            // suggested next action
  },
  "error": {                       // present when status = "error"
    "code": string,
    "message": string
  },
  "trace_id": string,              // optional — echoed from request
  "timestamp": string              // required — ISO 8601
}
```

---

## 5. Status Codes

| Status | Meaning |
|---|---|
| `ok` | Task completed successfully |
| `partial` | Completed with caveats — check `uncertainty` |
| `deferred` | Accepted, will respond async via `reply_to` |
| `refused` | Agent declined — policy, trust, or scope mismatch |
| `error` | Failed — check `error.code` |

### Error Codes

| Code | Meaning |
|---|---|
| `trust_insufficient` | Sender trust tier too low |
| `intent_unclear` | Could not parse intent — needs clarification |
| `capability_mismatch` | Agent can't fulfill this intent |
| `overloaded` | Agent is at capacity |
| `expired` | TTL exceeded |
| `auth_failed` | Invalid or missing credentials |

---

## 6. Discovery — agent.json

Agents publish a manifest at `GET /.well-known/agent.json`:

```
{
  "amp": "1.0",
  "id": string,                    // required — canonical agent identifier
  "name": string,                  // required
  "description": string,           // optional — LLM-readable description
  "version": string,               // optional — semver
  "capabilities": string[],        // required — what this agent can do
  "accepts": string[],             // optional — message types accepted
  "trust_tiers": string[],         // optional — what trust levels are supported
  "protocol": "amp/1.0",           // required
  "endpoints": {
    "message": string,             // required — URL for AMP messages
    "capabilities": string,        // optional — detailed capability listing
    "discover": string             // optional — agent search endpoint
  },
  "contact": string,               // optional — agent contact (email or URL)
  "updated_at": string             // optional — ISO 8601
}
```

---

## 7. Capability Semantics

Capabilities are free-text strings, not opaque identifiers. This allows semantic matching by LLMs:

```json
"capabilities": [
  "fitness data analysis",
  "workout logging",
  "strength progression tracking",
  "user re-engagement messaging"
]
```

An orchestrating agent can read these and route intelligently without a rigid registry schema.

---

## 8. Trust Model

### 8.1 Tiers

| Tier | Requirements | Permissions |
|---|---|---|
| `public` | None | Query capabilities, send `query` type messages |
| `verified` | Signed agent.json | All public + cross-agent delegation |
| `trusted` | Explicit allowlist | All verified + task delegation, memory access |
| `owned` | Same signing key | Full access |

### 8.2 Signature (optional, for verified tier)

Agent manifests may include a `signature` field — Ed25519 signature over the canonical JSON body, base64url-encoded:

```json
{
  "amp": "1.0",
  "id": "agentboard.fyi",
  ...
  "signature": {
    "alg": "Ed25519",
    "value": "<base64url>",
    "key_id": "<public key fingerprint>"
  }
}
```

---

## 9. Routing

AMP messages may be routed through a hub (like AgentBoard) or sent peer-to-peer.

### Hub routing

Send to hub with `to` set to destination agent id. Hub resolves id → endpoint via registry and forwards.

### Peer-to-peer

Resolve target's `agent.json` directly. Send message to `endpoints.message`.

---

## 10. Asynchronous Patterns

For long-running tasks:

1. Sender includes `reply_to` URL in request
2. Receiver returns `status: "deferred"` immediately
3. Receiver sends result to `reply_to` when complete

For polling:
1. Receiver returns `status: "deferred"` with a `job_id` in result
2. Sender polls `GET /api/amp/jobs/{job_id}`

---

## 11. Versioning

- Current version: `1.0-draft`
- Version string in all messages: `"amp": "1.0"`
- Breaking changes increment major version
- Additive changes are non-breaking

---

## 12. What AMP Is Not

- Not a replacement for REST APIs (use REST for CRUD)
- Not a streaming protocol (use WebSockets for that)
- Not an agent execution environment (use MCP for tool calls)
- Not opinionated about LLM providers or models

AMP is the *communication layer*. Execution, memory, and tooling are separate concerns.

---

*AMP v1.0-draft — AgentBoard, 2026*
