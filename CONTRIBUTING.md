# Contributing to AMP

AMP is an open protocol. The spec, helpers, and reference implementation are all fair game for contributions.

## What we're looking for

**Most useful right now:**
- Corrections or ambiguities in the spec (SPEC.md)
- New language helpers (Go, TypeScript, Rust) following the pattern in `lib/`
- A2A interoperability improvements in the reference agent
- Real-world examples of AMP in use
- Edge cases in message validation or routing logic

**Not the focus:**
- Registry features (AgentBoard handles that separately)
- Transport changes — AMP is HTTPS + JSON, intentionally simple

## Getting started

```bash
git clone https://github.com/laufferw/amp-protocol
cd amp-protocol

# Python reference agent
cd examples/reference-agent
pip install -r requirements.txt
python agent.py

# In a second terminal
python client.py
```

## How to contribute

1. For spec changes, open an issue first — protocol changes affect all implementors
2. For helper libraries or examples, a PR is fine without a prior issue
3. Keep new helpers consistent with `lib/amp.py` and `lib/amp.js` in structure and naming
4. New examples go in `examples/` with their own README

## Spec changes

AMP is intentionally minimal. Before proposing an addition:
- Is this something every AMP agent needs, or just some?
- Can it be expressed with the existing `context` field instead?
- Does it break existing implementations?

If the answer to the last question is yes, it needs very strong justification.

## Questions

Open a GitHub Discussion or file an issue tagged `question`.
