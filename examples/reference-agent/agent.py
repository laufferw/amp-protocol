"""
AMP Reference Agent — The "Hello World" of AMP
===============================================

A minimal AMP-compliant agent built with FastAPI.
Serves 3 demo capabilities: echo, math, and summarize.

Run:
    pip install fastapi uvicorn
    python agent.py

Then in another terminal:
    python client.py
"""

import sys
import time
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import uvicorn

# ─── Agent Identity ────────────────────────────────────────────────────────────

AGENT_ID = "reference-agent.amp-protocol.local"
AGENT_NAME = "AMP Reference Agent"
AGENT_VERSION = "1.0.0"
AGENT_PORT = 8765

app = FastAPI(title=AGENT_NAME)


# ─── Capability Manifest ───────────────────────────────────────────────────────

AGENT_MANIFEST = {
    "amp": "1.0",
    "id": AGENT_ID,
    "name": AGENT_NAME,
    "description": (
        "A minimal AMP reference agent demonstrating the protocol. "
        "Can echo messages, do basic math, and summarize text."
    ),
    "version": AGENT_VERSION,
    "capabilities": [
        "echo any message back to the sender",
        "evaluate basic math expressions",
        "summarize text to a shorter form",
    ],
    "accepts": ["query", "delegate"],
    "trust_tiers": ["public"],
    "protocol": "amp/1.0",
    "endpoints": {
        "message": f"http://localhost:{AGENT_PORT}/api/amp/message",
    },
    "updated_at": "2026-01-01T00:00:00Z",
}


@app.get("/.well-known/agent.json")
async def agent_manifest():
    """Publish this agent's capabilities — discovery endpoint."""
    return JSONResponse(AGENT_MANIFEST)


# ─── AMP Message Handler ───────────────────────────────────────────────────────

@app.post("/api/amp/message")
async def receive_message(request: Request):
    """
    Main AMP message endpoint.

    Receives an AMP message, routes to the right capability,
    and returns an AMP response.
    """
    try:
        msg = await request.json()
    except Exception:
        return amp_error("invalid_request", "Could not parse JSON body", request_id=None)

    # Validate required fields
    valid, err = validate_amp_message(msg)
    if not valid:
        return amp_error("invalid_message", err, request_id=msg.get("id"))

    intent: str = msg["intent"].lower()
    request_id: str = msg["id"]
    trace_id: str = msg.get("trace_id")
    context: dict = msg.get("context", {})

    # ── Route intent to capability ──────────────────────────────────────────

    # Capability 1: Echo
    if "echo" in intent:
        # Extract what to echo from context or the intent itself
        text = context.get("text") or msg["intent"]
        return amp_ok(
            request_id=request_id,
            result={"echo": text},
            confidence=1.0,
            trace_id=trace_id,
        )

    # Capability 2: Math
    if any(word in intent for word in ["math", "calculate", "compute", "evaluate", "solve"]):
        expression = context.get("expression") or extract_expression(msg["intent"])
        if not expression:
            return amp_error(
                "intent_unclear",
                "Please include a math expression in context.expression or your intent",
                request_id=request_id,
            )
        try:
            # Safe evaluation: only allow numbers and basic operators
            safe_expr = "".join(c for c in expression if c in "0123456789+-*/(). ")
            result = eval(safe_expr)  # noqa: S307 — sanitized above
            return amp_ok(
                request_id=request_id,
                result={"expression": expression, "result": result},
                confidence=1.0,
                trace_id=trace_id,
            )
        except Exception as e:
            return amp_error(
                "capability_mismatch",
                f"Could not evaluate expression '{expression}': {e}",
                request_id=request_id,
            )

    # Capability 3: Summarize
    if any(word in intent for word in ["summarize", "summary", "shorten", "tldr", "brief"]):
        text = context.get("text")
        if not text:
            return amp_error(
                "intent_unclear",
                "Please include text to summarize in context.text",
                request_id=request_id,
            )
        summary = naive_summarize(text)
        return amp_ok(
            request_id=request_id,
            result={"summary": summary, "original_length": len(text), "summary_length": len(summary)},
            confidence=0.7,
            uncertainty={
                "note": "This is a naive extractive summary (no LLM). Results may be rough.",
                "recommend": "Connect an LLM for better summarization.",
            },
            trace_id=trace_id,
        )

    # Unknown intent
    return amp_response(
        request_id=request_id,
        status="refused",
        result=None,
        error={
            "code": "capability_mismatch",
            "message": (
                f"No capability matched intent: '{msg['intent']}'. "
                f"Supported: echo, math/calculate, summarize."
            ),
        },
        trace_id=trace_id,
    )


# ─── Capabilities ──────────────────────────────────────────────────────────────

def naive_summarize(text: str) -> str:
    """
    Dead-simple extractive summarization.
    Takes the first sentence + last sentence if text is long.
    """
    sentences = [s.strip() for s in text.replace("\n", " ").split(".") if s.strip()]
    if len(sentences) <= 2:
        return text
    # Return first + last sentence as a rough summary
    return sentences[0] + ". [...] " + sentences[-1] + "."


def extract_expression(intent: str) -> str | None:
    """Try to pull a math expression from the intent string."""
    import re
    # Look for patterns like "2 + 2", "100 * 3.5", etc.
    match = re.search(r"[\d][\d\s\+\-\*\/\(\)\.]+[\d\)]", intent)
    return match.group(0).strip() if match else None


# ─── AMP Response Helpers ──────────────────────────────────────────────────────

def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def new_id() -> str:
    return f"msg_{uuid.uuid4().hex[:12]}"


def amp_response(
    request_id: str | None,
    status: str,
    result=None,
    confidence: float | None = None,
    uncertainty: dict | None = None,
    error: dict | None = None,
    trace_id: str | None = None,
) -> JSONResponse:
    body = {
        "amp": "1.0",
        "id": new_id(),
        "in_reply_to": request_id,
        "from": {"id": AGENT_ID, "name": AGENT_NAME},
        "status": status,
        "timestamp": now_iso(),
    }
    if result is not None:
        body["result"] = result
    if confidence is not None:
        body["confidence"] = confidence
    if uncertainty:
        body["uncertainty"] = uncertainty
    if error:
        body["error"] = error
    if trace_id:
        body["trace_id"] = trace_id
    return JSONResponse(body)


def amp_ok(request_id, result, confidence=None, uncertainty=None, trace_id=None):
    return amp_response(request_id, "ok", result, confidence, uncertainty, trace_id=trace_id)


def amp_error(code: str, message: str, request_id: str | None, trace_id: str | None = None):
    return amp_response(
        request_id,
        status="error",
        error={"code": code, "message": message},
        trace_id=trace_id,
    )


# ─── Validation ────────────────────────────────────────────────────────────────

def validate_amp_message(msg: dict) -> tuple[bool, str]:
    """Check required AMP fields are present."""
    required = ["amp", "id", "from", "to", "intent", "timestamp"]
    for field in required:
        if field not in msg:
            return False, f"Missing required field: {field}"
    if msg.get("amp") != "1.0":
        return False, f"Unsupported AMP version: {msg.get('amp')}"
    if not isinstance(msg.get("from"), dict) or "id" not in msg["from"]:
        return False, "from.id is required"
    return True, ""


# ─── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"🤖 {AGENT_NAME} starting on port {AGENT_PORT}")
    print(f"   Manifest: http://localhost:{AGENT_PORT}/.well-known/agent.json")
    print(f"   Messages: http://localhost:{AGENT_PORT}/api/amp/message")
    print()
    uvicorn.run(app, host="0.0.0.0", port=AGENT_PORT, log_level="info")
