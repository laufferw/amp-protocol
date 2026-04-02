# AMP Specification — v1.0-draft

**Agent Message Protocol — Intent-aware extension layer for A2A**

---

## 1. Overview

AMP is an intent-aware extension layer that sits on top of [A2A (Agent2Agent Protocol)](https://a2a-protocol.org/latest/). It adds LLM-native semantics — confidence scores, explicit uncertainty, intent-first messaging, and context-carrying — that A2A does not provide.

AMP does not replace A2A. A2A handles the transport and task lifecycle. AMP handles the "what does this agent actually mean" layer on top.

```
MCP   — agent ↔ tool
A2A   — agent ↔ agent (transport, tasks)
AMP   — intent-aware semantics on top of A2A
```

See [Section 12](#12-amp-and-a2a) for a full comparison.

### AMP is a protocol, not a platform

Two agents that both implement AMP can communicate directly — peer-to-peer, no intermediary required. No registry, no hub, no central authority.

```
Agent A → POST agent-b.com/api/amp/message → Agent B
```

Registries (like AgentBoard) are optional discovery services — useful for finding agents you don't know yet, not required for talking to ones you do. Think DNS: you can hardcode an IP, but you won't want to as the network grows.

Anyone can run an AMP registry. The protocol is open.

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
  "identity": object,              // optional — identity anchors (see Section 8.0)
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

### 8.0 Identity Anchors (optional)

Agent cards may include an optional `identity` block to declare verifiable identity anchors. This is protocol-agnostic — consumers pick what they recognize, ignore what they don't.

```json
{
  "amp": "1.0",
  "id": "agentboard.fyi",
  "identity": {
    "did": "did:web:agentboard.fyi",
    "certs": [
      {
        "type": "Ed25519",
        "public_key": "<base64url-encoded public key>",
        "key_id": "<fingerprint>"
      }
    ],
    "anchors": [
      {
        "type": "wtrmrk",
        "uid": "<wtrmrk_uid>"
      },
      {
        "type": "custom",
        "namespace": "example.com/identity",
        "uid": "<opaque-id>"
      }
    ]
  }
}
```

**Fields:**

| Field | Type | Description |
|---|---|---|
| `did` | string | W3C Decentralized Identifier (DID). Any DID method accepted (`did:web`, `did:key`, `did:plc`, etc.) |
| `certs` | array | Cryptographic public key declarations. `type` is the algorithm (`Ed25519`, `secp256k1`, etc.) |
| `anchors` | array | Extensible identity anchor list. `type` identifies the system; all other fields are system-defined |

**Design rules:**
- All fields are optional. Omit the entire `identity` block if unused.
- Consumers MUST ignore anchor types they don't recognize (open world).
- `did` is the preferred canonical identifier when present — widely supported and self-certifying via `did:key` / `did:web`.
- `anchors` is an escape hatch for ecosystem-specific identity systems. The `wtrmrk` type (proposed by WTRMRK) uses a `wtrmrk_uid` field. New types register by convention, not by a central registry.
- Verification is out of scope for AMP — how to validate a DID or anchor is left to the verifying agent and the underlying identity system.

**Example anchor types:**

| `type` | System | Key field |
|---|---|---|
| `wtrmrk` | WTRMRK identity network | `uid` |
| `did` | W3C DID (redundant shorthand) | `method`, `value` |
| `x509` | X.509 certificate | `pem` or `fingerprint` |
| `custom` | Any system | `namespace` + `uid` |

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

## 12. AMP and A2A

AMP is an extension layer on top of [A2A (Agent2Agent Protocol)](https://a2a-protocol.org/latest/), the open standard from Google/Linux Foundation. They are complementary, not competing.

### The full stack

```
MCP   — agent ↔ tool communication (how agents access APIs and resources)
A2A   — agent ↔ agent task lifecycle (transport, task management, AgentCards)
AMP   — intent-aware extension layer on top of A2A (LLM-native semantics)
```

### What A2A provides

A2A defines the core wiring for agent-to-agent communication:
- **AgentCard** — structured capability declarations at `/.well-known/agent-card.json`
- **JSON-RPC 2.0** — standardized `message/send`, `tasks/get`, `tasks/cancel` methods
- **Task lifecycle** — create, stream, cancel, list tasks
- **Protocol bindings** — JSON-RPC, gRPC, HTTP/REST
- **SDKs** — Python, JavaScript, Java, C#, Go (official)

A2A is the right choice for agent-to-agent transport. It's backed by the Linux Foundation, has widespread framework support (LangGraph, CrewAI, Semantic Kernel, ADK), and is the emerging industry standard.

### What AMP adds

A2A is excellent RPC-style task delegation. But LLMs are probabilistic — they express degrees of confidence, hold context, and mean things that can't always be reduced to a function call. AMP adds the vocabulary for that:

| Feature | A2A | AMP extension |
|---|---|---|
| Task lifecycle (send/stream/cancel) | ✅ | ✅ (inherits) |
| AgentCard discovery | ✅ | ✅ (inherits) |
| Intent-first messaging | ❌ | ✅ (`intent` field) |
| Confidence scores | ❌ | ✅ (`confidence`, `x-amp-confidence`) |
| Uncertainty / unknowns | ❌ | ✅ (`uncertainty`, `x-amp-uncertainty`) |
| Context-carrying messages | ❌ | ✅ (`context` field) |
| Trust tiers | ❌ | ✅ |
| LLM-readable free-text intent | ❌ | ✅ |

### Interoperability

- Any A2A agent can receive AMP messages (AMP fields are additive, ignored by non-AMP agents)
- Any AMP agent exposes A2A-compatible endpoints
- AgentBoard ([agentboard.fyi/a2a](https://agentboard.fyi/a2a)) is the reference implementation: full A2A JSON-RPC 2.0 + AMP extension fields on all responses

### When to use which

**Use A2A when:**
- Delegating tasks between agents with clear inputs/outputs
- Building on frameworks like LangGraph, CrewAI, Semantic Kernel
- Prioritizing ecosystem compatibility

**Use AMP when:**
- The intent is ambiguous or natural-language-first
- You want confidence scores and uncertainty in responses
- Building LLM-to-LLM communication where semantic clarity matters
- You want to layer AMP semantics on top of an A2A-compatible agent

---

## 13. What AMP Is Not

- Not a replacement for REST APIs (use REST for CRUD)
- Not a replacement for A2A (use A2A for the transport layer)
- Not a streaming protocol (use WebSockets or A2A streaming for that)
- Not an agent execution environment (use MCP for tool calls)
- Not opinionated about LLM providers or models

AMP is the *intent-aware semantic layer*. Transport (A2A), execution (MCP), and memory are separate concerns.

---

*AMP v1.0-draft — AgentBoard, 2026*
