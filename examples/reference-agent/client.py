"""
AMP Reference Client — Demo of agent-to-agent communication
============================================================

Sends AMP messages to the reference agent and shows the full
request/response JSON so you can see exactly how AMP works.

Run the agent first:
    python agent.py

Then in another terminal:
    python client.py
"""

import json
import sys
import time
import uuid
from datetime import datetime, timezone

import httpx

# ─── Configuration ─────────────────────────────────────────────────────────────

AGENT_URL = "http://localhost:8765"
CLIENT_ID = "demo-client.amp-protocol.local"
CLIENT_NAME = "AMP Demo Client"


# ─── AMP Message Builder ───────────────────────────────────────────────────────

def make_message(
    intent: str,
    to: str,
    context: dict = None,
    message_type: str = "query",
) -> dict:
    """Build a well-formed AMP message."""
    return {
        "amp": "1.0",
        "id": f"msg_{uuid.uuid4().hex[:12]}",
        "from": {
            "id": CLIENT_ID,
            "name": CLIENT_NAME,
            "type": "agent",
        },
        "to": to,
        "intent": intent,
        "type": message_type,
        "context": context or {},
        "trust": {"level": "read-only"},
        "sync": True,
        "ttl": 300,
        "trace_id": f"trace_{uuid.uuid4().hex[:8]}",
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


# ─── Send and Display ──────────────────────────────────────────────────────────

def send_amp_message(intent: str, context: dict = None, label: str = "") -> dict:
    """Send an AMP message and print the full exchange."""
    msg = make_message(intent=intent, to=AGENT_URL, context=context)

    print("=" * 60)
    if label:
        print(f"  {label}")
    print("=" * 60)
    print()
    print("📤 REQUEST:")
    print(json.dumps(msg, indent=2))
    print()

    try:
        resp = httpx.post(
            f"{AGENT_URL}/api/amp/message",
            json=msg,
            headers={"Content-Type": "application/json"},
            timeout=10.0,
        )
        resp.raise_for_status()
        result = resp.json()
    except httpx.ConnectError:
        print("❌  Could not connect to agent. Is it running?")
        print(f"   Start it with: python agent.py")
        sys.exit(1)
    except Exception as e:
        print(f"❌  Request failed: {e}")
        sys.exit(1)

    print("📥 RESPONSE:")
    print(json.dumps(result, indent=2))
    print()

    # Friendly summary
    status = result.get("status", "unknown")
    if status == "ok":
        print(f"✅  Status: {status}")
        if "result" in result:
            print(f"   Result: {json.dumps(result['result'])}")
        if "confidence" in result:
            print(f"   Confidence: {result['confidence']}")
        if "uncertainty" in result:
            print(f"   ⚠️  Uncertainty: {result['uncertainty']['note']}")
    elif status == "error":
        err = result.get("error", {})
        print(f"❌  Error [{err.get('code')}]: {err.get('message')}")
    elif status == "refused":
        err = result.get("error", {})
        print(f"🚫  Refused: {err.get('message')}")
    else:
        print(f"ℹ️  Status: {status}")

    print()
    return result


# ─── Demo Sequence ─────────────────────────────────────────────────────────────

def main():
    print()
    print("🤖 AMP Reference Client — Agent-to-Agent Communication Demo")
    print()

    # 0. Discover the agent
    print("🔍 Fetching agent manifest from /.well-known/agent.json ...")
    print()
    try:
        resp = httpx.get(f"{AGENT_URL}/.well-known/agent.json", timeout=5.0)
        manifest = resp.json()
        print(json.dumps(manifest, indent=2))
        print()
        print(f"✅  Agent: {manifest['name']}")
        print(f"   Capabilities: {', '.join(manifest['capabilities'])}")
        print()
    except httpx.ConnectError:
        print("❌  Could not connect to agent. Is it running?")
        print(f"   Start it with: python agent.py")
        sys.exit(1)

    input("Press Enter to start sending AMP messages...\n")

    # 1. Echo capability
    send_amp_message(
        intent="Please echo this message back to me",
        context={"text": "Hello from the AMP demo client! 👋"},
        label="Demo 1: Echo",
    )

    input("Press Enter for next demo...\n")

    # 2. Math capability
    send_amp_message(
        intent="Calculate the result of this math expression",
        context={"expression": "(42 * 7) + 100"},
        label="Demo 2: Math",
    )

    input("Press Enter for next demo...\n")

    # 3. Summarize capability
    long_text = (
        "The Agent Message Protocol (AMP) is a communication standard designed "
        "for AI agents to exchange messages in a structured, intent-driven way. "
        "Unlike REST APIs that focus on resources and CRUD operations, AMP centers "
        "on what an agent wants to accomplish — the intent — rather than the specific "
        "steps to get there. This allows agents to collaborate without tight coupling. "
        "An orchestrating agent can discover peers via agent.json manifests, understand "
        "their capabilities through free-text descriptions, and route tasks intelligently. "
        "The protocol is minimal by design: a message envelope, a response envelope, "
        "and a discovery manifest. Everything else is optional."
    )
    send_amp_message(
        intent="Summarize this text into a shorter form",
        context={"text": long_text},
        label="Demo 3: Summarize",
    )

    input("Press Enter for final demo...\n")

    # 4. Unknown intent — see how the agent refuses gracefully
    send_amp_message(
        intent="Book me a flight to Tokyo next Tuesday",
        label="Demo 4: Unknown intent (graceful refusal)",
    )

    print("=" * 60)
    print("  Demo complete!")
    print("=" * 60)
    print()
    print("What you just saw:")
    print("  • Agent discovery via /.well-known/agent.json")
    print("  • AMP messages with intent + context")
    print("  • Responses with status, result, and confidence")
    print("  • Graceful handling of unknown capabilities")
    print()
    print("To build your own AMP agent, edit agent.py and add")
    print("new intent-routing logic in receive_message().")
    print()


if __name__ == "__main__":
    main()
