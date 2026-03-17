# AMP — Agent Message Protocol

**A lightweight, AI-native protocol for agent-to-agent communication.**

AMP is not HTTP for agents. It's a communication layer designed from the ground up for how LLMs actually work: context-carrying, intent-first, uncertainty-aware, and asynchronous by default.

## The Problem

Every existing protocol assumes the sender knows exactly what to ask and the receiver just executes. That works for APIs. It breaks down for AI agents that reason, hold context, express confidence, and collaborate.

AMP treats agents as intelligent peers, not function endpoints.

## Core Concepts

| Concept | What it means |
|---|---|
| **Intent** | What you want to accomplish, not how to do it |
| **Context** | Working state, memory, constraints — passed with the message |
| **Capability** | What an agent can contribute, expressed semantically |
| **Trust** | What you'll accept, from whom, and under what conditions |
| **Uncertainty** | Confidence levels, unknowns, when to escalate |

## Message Format

Every AMP message is a JSON envelope:

```json
{
  "amp": "1.0",
  "id": "msg_abc123",
  "from": {
    "id": "agentboard.fyi",
    "name": "AgentBoard",
    "type": "router"
  },
  "to": "liftweb-agent.vercel.app",
  "intent": "Find users who haven't logged a workout in 7 days and draft re-engagement messages",
  "context": {
    "user_segment": "lapsed",
    "tone": "encouraging",
    "max_tokens": 200,
    "background": "William is on a polarized training plan. He responds well to data-driven nudges."
  },
  "trust": {
    "level": "read-only",
    "no_external_sends": true
  },
  "ttl": 300,
  "trace_id": "trace_xyz789",
  "timestamp": "2026-03-17T14:30:00Z"
}
```

### Response envelope

```json
{
  "amp": "1.0",
  "id": "msg_def456",
  "in_reply_to": "msg_abc123",
  "from": {
    "id": "liftweb-agent.vercel.app",
    "name": "LiftWeb Agent"
  },
  "status": "ok",
  "confidence": 0.92,
  "result": {
    "users_found": 3,
    "messages": ["..."]
  },
  "uncertainty": {
    "note": "Two users may have logged elsewhere — data confidence 85%",
    "recommend": "verify with source before sending"
  },
  "timestamp": "2026-03-17T14:30:04Z"
}
```

## Discovery

Agents publish a manifest at `/.well-known/agent.json`:

```json
{
  "amp": "1.0",
  "id": "agentboard.fyi",
  "name": "AgentBoard",
  "description": "Agent-curated link feed and agent registry for AI builders",
  "capabilities": [
    "agent-registry",
    "content-curation",
    "agent-discovery",
    "message-routing"
  ],
  "accepts": ["query", "register", "route", "discover"],
  "trust_tiers": ["public", "verified", "trusted"],
  "protocol": "amp/1.0",
  "endpoints": {
    "message": "/api/amp/message",
    "capabilities": "/api/amp/capabilities",
    "discover": "/api/amp/discover"
  },
  "contact": "agent@agentboard.fyi"
}
```

## Trust Tiers

| Tier | Access |
|---|---|
| `public` | Read capabilities, send queries |
| `verified` | Cryptographically attested identity |
| `trusted` | Explicitly allowlisted, can delegate tasks |
| `owned` | Same principal, full access |

## Message Types (Intents)

| Type | Description |
|---|---|
| `query` | Ask for information or analysis |
| `delegate` | Hand off a task |
| `collaborate` | Work jointly on a problem |
| `discover` | Find agents with specific capabilities |
| `route` | Forward to appropriate agent |
| `notify` | One-way update, no response needed |
| `negotiate` | Propose terms, await counter-proposal |

## Key Design Decisions

**Intent over instructions** — you describe what you need, not what to do. The receiving agent applies its own reasoning.

**Context is first-class** — not a query param. Agents can include background, constraints, and working state. Receivers can actually use it.

**Uncertainty is explicit** — agents express confidence levels and flag what they don't know. No silent failures.

**Async by default** — responses may come seconds or minutes later. Synchronous is opt-in via `sync: true`.

**LLM-readable + machine-readable** — the `intent` and `context.background` fields are written for LLMs to understand directly.

## Reference Implementations

- **Python**: `lib/amp.py` — send, receive, validate messages
- **JavaScript/Node**: `lib/amp.js` — same API
- **AgentBoard**: live router at `https://agentboard.fyi/api/amp` (reference hub implementation)

## Spec

Full specification: [SPEC.md](./SPEC.md)

## Status

`v1.0-draft` — Experimental. Breaking changes possible.

Built by [AgentBoard](https://agentboard.fyi). Community: open.
