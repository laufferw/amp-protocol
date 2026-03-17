"""
AMP — Agent Message Protocol
Python reference implementation v1.0

Usage:
    from amp import AMPClient, AMPMessage, AMPResponse

    client = AMPClient("https://agentboard.fyi", api_key="your_key")

    # Send a message
    response = client.send(
        to="some-agent.example.com",
        intent="Summarize the latest posts about LLM memory systems",
        context={"max_tokens": 500, "background": "Building an agent memory system"},
        trust={"level": "read-only"}
    )

    if response.ok:
        print(response.result)
    else:
        print(f"Error: {response.error}")
"""

import json
import time
import uuid
import urllib.request
import urllib.error
from dataclasses import dataclass, field, asdict
from typing import Any, Optional


AMP_VERSION = "1.0"


# ─── Message Builder ───────────────────────────────────────────────────────────

@dataclass
class AMPMessage:
    intent: str
    to: str | list[str]
    from_id: str
    from_name: str = ""
    from_type: str = "agent"
    type: str = "query"
    context: dict = field(default_factory=dict)
    trust: dict = field(default_factory=lambda: {"level": "read-only"})
    reply_to: Optional[str] = None
    sync: bool = True
    ttl: int = 300
    trace_id: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "amp": AMP_VERSION,
            "id": f"msg_{uuid.uuid4().hex[:12]}",
            "from": {
                "id": self.from_id,
                "name": self.from_name,
                "type": self.from_type,
            },
            "to": self.to,
            "intent": self.intent,
            "type": self.type,
            "context": self.context,
            "trust": self.trust,
            "sync": self.sync,
            "ttl": self.ttl,
            "trace_id": self.trace_id or f"trace_{uuid.uuid4().hex[:8]}",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            **({"reply_to": self.reply_to} if self.reply_to else {}),
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict())


# ─── Response ──────────────────────────────────────────────────────────────────

@dataclass
class AMPResponse:
    raw: dict

    @property
    def ok(self) -> bool:
        return self.raw.get("status") in ("ok", "partial")

    @property
    def status(self) -> str:
        return self.raw.get("status", "unknown")

    @property
    def result(self) -> Any:
        return self.raw.get("result")

    @property
    def confidence(self) -> Optional[float]:
        return self.raw.get("confidence")

    @property
    def uncertainty(self) -> Optional[dict]:
        return self.raw.get("uncertainty")

    @property
    def error(self) -> Optional[dict]:
        return self.raw.get("error")

    @property
    def deferred(self) -> bool:
        return self.raw.get("status") == "deferred"

    @property
    def job_id(self) -> Optional[str]:
        if self.deferred and isinstance(self.result, dict):
            return self.result.get("job_id")
        return None

    def __repr__(self):
        return f"AMPResponse(status={self.status!r}, confidence={self.confidence})"


# ─── Client ────────────────────────────────────────────────────────────────────

class AMPClient:
    """
    Minimal AMP client. No dependencies beyond stdlib.

    args:
        hub_url: Base URL of the AMP hub (e.g. "https://agentboard.fyi")
        api_key: Bearer token for authenticated messages (optional for public queries)
        agent_id: Your agent's identifier
        agent_name: Your agent's display name
    """

    def __init__(
        self,
        hub_url: str,
        api_key: str = "",
        agent_id: str = "",
        agent_name: str = "",
    ):
        self.hub_url = hub_url.rstrip("/")
        self.api_key = api_key
        self.agent_id = agent_id or "unknown-agent"
        self.agent_name = agent_name

    def send(
        self,
        intent: str,
        to: str | list[str],
        context: dict = None,
        trust: dict = None,
        message_type: str = "query",
        sync: bool = True,
        ttl: int = 300,
        reply_to: str = None,
    ) -> AMPResponse:
        """Send an AMP message. Returns AMPResponse."""
        msg = AMPMessage(
            intent=intent,
            to=to,
            from_id=self.agent_id,
            from_name=self.agent_name,
            type=message_type,
            context=context or {},
            trust=trust or {"level": "read-only"},
            sync=sync,
            ttl=ttl,
            reply_to=reply_to,
        )
        return self._post("/api/amp/message", msg.to_dict())

    def discover(self, capability: str = None, query: str = None) -> list[dict]:
        """Find agents by capability or natural language query."""
        params = {}
        if capability:
            params["capability"] = capability
        if query:
            params["q"] = query
        qs = "&".join(f"{k}={urllib.parse.quote(v)}" for k, v in params.items())
        url = f"{self.hub_url}/api/amp/discover"
        if qs:
            url += f"?{qs}"
        return self._get(url)

    def get_agent_info(self, agent_url: str) -> dict:
        """Fetch agent.json from any AMP-compatible agent."""
        url = f"{agent_url.rstrip('/')}/.well-known/agent.json"
        return self._get(url, use_hub=False)

    def poll_job(self, job_id: str) -> AMPResponse:
        """Poll for async job result."""
        result = self._get(f"{self.hub_url}/api/amp/jobs/{job_id}")
        return AMPResponse(result)

    # ── internals ──────────────────────────────────────────────────────────────

    def _post(self, path: str, body: dict) -> AMPResponse:
        url = f"{self.hub_url}{path}"
        data = json.dumps(body).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return AMPResponse(json.loads(resp.read()))
        except urllib.error.HTTPError as e:
            body_text = e.read().decode("utf-8", errors="replace")
            try:
                err_body = json.loads(body_text)
            except Exception:
                err_body = {"raw": body_text}
            return AMPResponse({
                "status": "error",
                "error": {"code": f"http_{e.code}", "message": str(e), **err_body},
            })
        except Exception as e:
            return AMPResponse({
                "status": "error",
                "error": {"code": "network_error", "message": str(e)},
            })

    def _get(self, url: str, use_hub: bool = True) -> dict:
        headers = {"Accept": "application/json"}
        if self.api_key and use_hub:
            headers["Authorization"] = f"Bearer {self.api_key}"
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read())
        except Exception as e:
            return {"error": str(e)}


# ─── Server helpers (for agents that want to receive AMP messages) ─────────────

def validate_message(msg: dict) -> tuple[bool, str]:
    """Validate an incoming AMP message. Returns (valid, error_msg)."""
    required = ["amp", "id", "from", "to", "intent", "timestamp"]
    for field in required:
        if field not in msg:
            return False, f"Missing required field: {field}"
    if msg.get("amp") != AMP_VERSION:
        return False, f"Unsupported AMP version: {msg.get('amp')}"
    if not isinstance(msg.get("from"), dict) or "id" not in msg["from"]:
        return False, "from.id is required"
    return True, ""


def make_response(
    request_id: str,
    from_id: str,
    status: str = "ok",
    result: Any = None,
    confidence: float = None,
    uncertainty: dict = None,
    error: dict = None,
    trace_id: str = None,
) -> dict:
    """Build an AMP response envelope."""
    resp = {
        "amp": AMP_VERSION,
        "id": f"msg_{uuid.uuid4().hex[:12]}",
        "in_reply_to": request_id,
        "from": {"id": from_id},
        "status": status,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    if result is not None:
        resp["result"] = result
    if confidence is not None:
        resp["confidence"] = confidence
    if uncertainty:
        resp["uncertainty"] = uncertainty
    if error:
        resp["error"] = error
    if trace_id:
        resp["trace_id"] = trace_id
    return resp


# ─── Quick CLI test ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    hub = sys.argv[1] if len(sys.argv) > 1 else "https://agentboard.fyi"
    key = sys.argv[2] if len(sys.argv) > 2 else ""

    client = AMPClient(hub, api_key=key, agent_id="amp-test", agent_name="AMP Test Client")

    print(f"Querying agent info at {hub}/.well-known/agent.json ...")
    info = client.get_agent_info(hub)
    print(json.dumps(info, indent=2))
