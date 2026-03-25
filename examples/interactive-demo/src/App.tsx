// @ts-nocheck
/**
 * AMP Protocol Interactive Demo
 * Built with Gridland (gridland.io) — runs in browser and native terminal.
 *
 * Architecture:
 *   @gridland/web  → Canvas renderer for browser
 *   React          → Component model
 *   @gridland/utils → Hooks (useKeyboard, useTerminalDimensions)
 */

import React, { useState, useEffect, useCallback, useRef } from "react"
import { TUI } from "@gridland/web"
import { useKeyboard, useTerminalDimensions } from "@gridland/utils"

// ─── Types ─────────────────────────────────────────────────────────────────────

type Screen =
  | "loading"
  | "manifest"
  | "menu"
  | "input"
  | "request_preview"
  | "sending"
  | "response"

interface AgentManifest {
  amp: string
  id: string
  name: string
  description: string
  capabilities: string[]
  endpoints: { message: string }
  version?: string
}

interface AmpRequest {
  amp: string
  id: string
  from: { id: string; name: string; type: string }
  to: string
  intent: string
  type: string
  context: Record<string, unknown>
  sync: boolean
  timestamp: string
}

interface AmpResponse {
  amp: string
  id: string
  in_reply_to: string
  from: { id: string; name?: string }
  status: string
  confidence?: number
  result?: unknown
  uncertainty?: { note: string; recommend?: string }
  error?: { code: string; message: string }
  timestamp: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENT_URL = "https://amp-agent.agentboard.fyi"
const SENDER_ID = "amp-demo.interactive"
const SENDER_NAME = "AMP Interactive Demo"

const CAPABILITIES = [
  {
    key: "1",
    label: "Echo",
    intent: "echo",
    description: "Echo any message back",
    placeholder: "Type something to echo…",
    buildContext: (input: string) => ({ text: input }),
    buildIntent: (input: string) => `echo: ${input}`,
  },
  {
    key: "2",
    label: "Math",
    intent: "math",
    description: "Evaluate a math expression",
    placeholder: "e.g. 42 * 2 + 8",
    buildContext: (input: string) => ({ expression: input }),
    buildIntent: (input: string) => `calculate: ${input}`,
  },
  {
    key: "3",
    label: "Summarize",
    intent: "summarize",
    description: "Summarize a passage of text",
    placeholder: "Paste some text to summarize…",
    buildContext: (input: string) => ({ text: input }),
    buildIntent: () => "summarize the provided text",
  },
  {
    key: "4",
    label: "Custom",
    intent: "custom",
    description: "Type any free-form intent",
    placeholder: "e.g. what can you do?",
    buildContext: () => ({}),
    buildIntent: (input: string) => input,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newId(): string {
  return `msg_${Math.random().toString(36).slice(2, 14)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function buildAmpRequest(intent: string, context: Record<string, unknown>, agentId: string): AmpRequest {
  return {
    amp: "1.0",
    id: newId(),
    from: { id: SENDER_ID, name: SENDER_NAME, type: "human" },
    to: agentId,
    intent,
    type: "query",
    context,
    sync: true,
    timestamp: nowIso(),
  }
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const C = {
  bg: "#0d0d1a",
  bgPanel: "#12122a",
  bgInput: "#1a1a35",
  border: "#334",
  borderAccent: "#6644cc",
  text: "#e0e0ff",
  textDim: "#7788aa",
  textMuted: "#445566",
  accent: "#a855f7",
  accentBright: "#c084fc",
  green: "#4ade80",
  yellow: "#facc15",
  red: "#f87171",
  blue: "#60a5fa",
  cyan: "#22d3ee",
  orange: "#fb923c",
}

// ─── Styled Components ────────────────────────────────────────────────────────

function Panel({
  children,
  style = {},
}: {
  children: React.ReactNode
  style?: Record<string, unknown>
}) {
  return (
    <box
      style={{
        borderStyle: "rounded",
        borderColor: C.border,
        backgroundColor: C.bgPanel,
        padding: 1,
        ...style,
      }}
    >
      {children}
    </box>
  )
}

function Label({ text, color = C.textDim }: { text: string; color?: string }) {
  return <text style={{ color, fontWeight: "bold" }}>{text}</text>
}

function Separator({ color = C.border }: { color?: string }) {
  return <text style={{ color }}>{"─".repeat(60)}</text>
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ok: C.green,
    error: C.red,
    partial: C.yellow,
    deferred: C.blue,
    refused: C.orange,
  }
  const color = colors[status] ?? C.textDim
  return <text style={{ color, fontWeight: "bold" }}>[{status.toUpperCase()}]</text>
}

// ─── Screens ──────────────────────────────────────────────────────────────────

function Header() {
  return (
    <box
      style={{
        flexDirection: "column",
        alignItems: "center",
        padding: 1,
        borderBottomStyle: "single",
        borderColor: C.borderAccent,
        backgroundColor: C.bg,
        marginBottom: 1,
      }}
    >
      <text style={{ color: C.accentBright, fontWeight: "bold", fontSize: 16 }}>
        ⬡  AMP Protocol — Interactive Demo  ⬡
      </text>
      <text style={{ color: C.textMuted, marginTop: 0 }}>
        Agent Message Protocol  ·  v1.0-draft  ·  intent-aware semantics for agent communication
      </text>
    </box>
  )
}

function LoadingScreen() {
  return (
    <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
      <text style={{ color: C.accent }}>⟳ Fetching agent manifest from {AGENT_URL}/.well-known/agent.json…</text>
    </box>
  )
}

function ManifestScreen({
  manifest,
  onContinue,
}: {
  manifest: AgentManifest
  onContinue: () => void
}) {
  useKeyboard((key) => {
    if (key.name === "return" || key.name === "space" || key.sequence === "\r") {
      onContinue()
    }
  })

  return (
    <box style={{ flexDirection: "column", flex: 1, padding: 1, gap: 1 }}>
      <Panel style={{ borderColor: C.borderAccent }}>
        <box style={{ flexDirection: "column", gap: 0 }}>
          <text style={{ color: C.accentBright, fontWeight: "bold", marginBottom: 1 }}>
            ⬡ Agent Manifest — /.well-known/agent.json
          </text>
          <Separator color={C.borderAccent} />

          <box style={{ flexDirection: "row", gap: 2, marginTop: 1 }}>
            <Label text="ID:      " />
            <text style={{ color: C.cyan }}>{manifest.id}</text>
          </box>
          <box style={{ flexDirection: "row", gap: 2 }}>
            <Label text="Name:    " />
            <text style={{ color: C.text }}>{manifest.name}</text>
          </box>
          <box style={{ flexDirection: "row", gap: 2 }}>
            <Label text="Version: " />
            <text style={{ color: C.text }}>{manifest.version ?? "—"}</text>
          </box>
          <box style={{ flexDirection: "row", gap: 2 }}>
            <Label text="Protocol:" />
            <text style={{ color: C.green }}>amp/1.0</text>
          </box>

          <box style={{ marginTop: 1, flexDirection: "column" }}>
            <Label text="Description:" />
            <text style={{ color: C.text, marginLeft: 2 }}>{manifest.description}</text>
          </box>

          <box style={{ marginTop: 1, flexDirection: "column" }}>
            <Label text="Capabilities:" />
            {manifest.capabilities.map((cap, i) => (
              <text key={i} style={{ color: C.cyan, marginLeft: 2 }}>
                • {cap}
              </text>
            ))}
          </box>

          <box style={{ marginTop: 1, flexDirection: "column" }}>
            <Label text="Endpoint:" />
            <text style={{ color: C.blue, marginLeft: 2 }}>{manifest.endpoints.message}</text>
          </box>
        </box>
      </Panel>

      <text style={{ color: C.textDim, textAlign: "center" }}>
        Press <text style={{ color: C.accentBright }}>[Enter]</text> to try the protocol →
      </text>
    </box>
  )
}

function MenuScreen({
  onSelect,
  onQuit,
}: {
  onSelect: (idx: number) => void
  onQuit: () => void
}) {
  const [selected, setSelected] = useState(0)

  useKeyboard((key) => {
    if (key.name === "up" || key.name === "k") {
      setSelected((s) => (s - 1 + CAPABILITIES.length) % CAPABILITIES.length)
    } else if (key.name === "down" || key.name === "j") {
      setSelected((s) => (s + 1) % CAPABILITIES.length)
    } else if (key.name === "return" || key.sequence === "\r") {
      onSelect(selected)
    } else if (key.sequence >= "1" && key.sequence <= "4") {
      onSelect(parseInt(key.sequence) - 1)
    } else if (key.name === "q" || (key.ctrl && key.name === "c")) {
      onQuit()
    }
  })

  return (
    <box style={{ flexDirection: "column", flex: 1, padding: 1, gap: 1 }}>
      <Panel>
        <box style={{ flexDirection: "column", gap: 0 }}>
          <text style={{ color: C.accentBright, fontWeight: "bold", marginBottom: 1 }}>
            ⬡ Choose a Capability to Demo
          </text>
          <Separator />
          <text style={{ color: C.textDim, marginBottom: 1 }}>
            Use ↑↓ or 1-4 to select, Enter to confirm, Q to quit
          </text>

          {CAPABILITIES.map((cap, i) => {
            const isSelected = i === selected
            return (
              <box
                key={cap.key}
                style={{
                  flexDirection: "row",
                  gap: 2,
                  padding: isSelected ? 0 : 0,
                  backgroundColor: isSelected ? C.bgInput : "transparent",
                  borderRadius: isSelected ? 1 : 0,
                }}
              >
                <text style={{ color: isSelected ? C.accentBright : C.textDim, fontWeight: "bold" }}>
                  {isSelected ? "▶" : " "} [{cap.key}]
                </text>
                <text style={{ color: isSelected ? C.text : C.textDim, fontWeight: isSelected ? "bold" : "normal" }}>
                  {cap.label}
                </text>
                <text style={{ color: C.textMuted }}>— {cap.description}</text>
              </box>
            )
          })}
        </box>
      </Panel>
    </box>
  )
}

function InputScreen({
  capability,
  onSubmit,
  onBack,
}: {
  capability: (typeof CAPABILITIES)[number]
  onSubmit: (input: string) => void
  onBack: () => void
}) {
  const [input, setInput] = useState("")

  useKeyboard((key) => {
    if (key.name === "return" || key.sequence === "\r") {
      if (input.trim()) onSubmit(input.trim())
    } else if (key.name === "backspace") {
      setInput((s) => s.slice(0, -1))
    } else if (key.name === "escape") {
      onBack()
    } else if (key.ctrl && key.name === "c") {
      onBack()
    } else if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
      setInput((s) => s + key.sequence)
    }
  })

  return (
    <box style={{ flexDirection: "column", flex: 1, padding: 1, gap: 1 }}>
      <Panel style={{ borderColor: C.borderAccent }}>
        <box style={{ flexDirection: "column", gap: 1 }}>
          <text style={{ color: C.accentBright, fontWeight: "bold" }}>
            ⬡ {capability.label} — Enter Input
          </text>
          <Separator color={C.borderAccent} />
          <text style={{ color: C.textDim }}>{capability.description}</text>

          <box style={{ marginTop: 1 }}>
            <text style={{ color: C.textDim }}>{capability.placeholder}</text>
          </box>

          <box
            style={{
              borderStyle: "single",
              borderColor: C.borderAccent,
              padding: 1,
              marginTop: 1,
              backgroundColor: C.bgInput,
              minHeight: 3,
            }}
          >
            <text style={{ color: C.text }}>
              {input || " "}
              <text style={{ color: C.accent }}>█</text>
            </text>
          </box>
        </box>
      </Panel>

      <text style={{ color: C.textDim, textAlign: "center" }}>
        <text style={{ color: C.accentBright }}>[Enter]</text> to send  ·{" "}
        <text style={{ color: C.textDim }}>[Esc]</text> to go back
      </text>
    </box>
  )
}

function RequestPreviewScreen({
  request,
  onSend,
  onBack,
}: {
  request: AmpRequest
  onSend: () => void
  onBack: () => void
}) {
  useKeyboard((key) => {
    if (key.name === "return" || key.sequence === "\r" || key.name === "s") {
      onSend()
    } else if (key.name === "escape" || key.name === "b") {
      onBack()
    }
  })

  const json = JSON.stringify(request, null, 2)

  return (
    <box style={{ flexDirection: "column", flex: 1, padding: 1, gap: 1 }}>
      <Panel style={{ borderColor: C.yellow }}>
        <box style={{ flexDirection: "column", gap: 0 }}>
          <text style={{ color: C.yellow, fontWeight: "bold", marginBottom: 1 }}>
            ⬡ AMP Request — What will be sent
          </text>
          <Separator color={C.yellow} />
          <text style={{ color: C.textDim, marginBottom: 1 }}>
            POST {AGENT_URL}/api/amp/message
          </text>

          <box
            style={{
              backgroundColor: C.bg,
              padding: 1,
              borderStyle: "single",
              borderColor: C.border,
              overflow: "hidden",
            }}
          >
            {json.split("\n").map((line, i) => {
              // Colorize JSON keys vs values
              const keyMatch = line.match(/^(\s*)"([^"]+)":/)
              if (keyMatch) {
                const rest = line.slice(keyMatch[0].length)
                return (
                  <text key={i} style={{ color: C.text }}>
                    <text style={{ color: C.textDim }}>{keyMatch[1]}</text>
                    <text style={{ color: C.cyan }}>"{keyMatch[2]}"</text>
                    <text style={{ color: C.textDim }}>:</text>
                    <text style={{ color: C.green }}>{rest}</text>
                  </text>
                )
              }
              return (
                <text key={i} style={{ color: C.text }}>
                  {line}
                </text>
              )
            })}
          </box>
        </box>
      </Panel>

      <text style={{ color: C.textDim, textAlign: "center" }}>
        <text style={{ color: C.green }}>[Enter]</text> to send  ·{" "}
        <text style={{ color: C.textDim }}>[Esc]</text> to go back
      </text>
    </box>
  )
}

function SendingScreen() {
  return (
    <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
      <text style={{ color: C.accent }}>⟳ Sending AMP message to agent…</text>
    </box>
  )
}

function ResponseScreen({
  request,
  response,
  error,
  onAgain,
  onQuit,
}: {
  request: AmpRequest
  response: AmpResponse | null
  error: string | null
  onAgain: () => void
  onQuit: () => void
}) {
  useKeyboard((key) => {
    if (key.name === "return" || key.name === "r" || key.sequence === "\r") {
      onAgain()
    } else if (key.name === "q" || (key.ctrl && key.name === "c")) {
      onQuit()
    }
  })

  const responseJson = response ? JSON.stringify(response, null, 2) : null

  return (
    <box style={{ flexDirection: "column", flex: 1, padding: 1, gap: 1 }}>
      {/* Response panel */}
      <Panel
        style={{
          borderColor: error ? C.red : response?.status === "ok" ? C.green : C.yellow,
          flex: 1,
        }}
      >
        <box style={{ flexDirection: "column", gap: 0 }}>
          <box style={{ flexDirection: "row", gap: 2, marginBottom: 1 }}>
            <text style={{ color: C.accentBright, fontWeight: "bold" }}>⬡ AMP Response</text>
            {response && <StatusBadge status={response.status} />}
          </box>
          <Separator color={error ? C.red : response?.status === "ok" ? C.green : C.yellow} />

          {error && (
            <box style={{ flexDirection: "column", gap: 0, marginTop: 1 }}>
              <text style={{ color: C.red, fontWeight: "bold" }}>✗ Request failed:</text>
              <text style={{ color: C.red, marginLeft: 2 }}>{error}</text>
              <text style={{ color: C.textDim, marginTop: 1 }}>
                Is the reference agent running? → cd examples/reference-agent && python agent.py
              </text>
            </box>
          )}

          {responseJson && (
            <box
              style={{
                backgroundColor: C.bg,
                padding: 1,
                borderStyle: "single",
                borderColor: C.border,
                marginTop: 1,
                overflow: "hidden",
              }}
            >
              {responseJson.split("\n").map((line, i) => {
                const keyMatch = line.match(/^(\s*)"([^"]+)":/)
                if (keyMatch) {
                  const rest = line.slice(keyMatch[0].length)
                  // Highlight special fields
                  const key = keyMatch[2]
                  const keyColor =
                    key === "status"
                      ? C.yellow
                      : key === "result"
                        ? C.green
                        : key === "confidence"
                          ? C.cyan
                          : key === "uncertainty" || key === "error"
                            ? C.red
                            : C.cyan
                  return (
                    <text key={i} style={{ color: C.text }}>
                      <text style={{ color: C.textDim }}>{keyMatch[1]}</text>
                      <text style={{ color: keyColor }}>"{key}"</text>
                      <text style={{ color: C.textDim }}>:</text>
                      <text style={{ color: C.green }}>{rest}</text>
                    </text>
                  )
                }
                return (
                  <text key={i} style={{ color: C.text }}>
                    {line}
                  </text>
                )
              })}
            </box>
          )}

          {/* Highlight key result fields */}
          {response?.status === "ok" && response.result && (
            <box style={{ marginTop: 1, flexDirection: "column", gap: 0 }}>
              <Separator color={C.green} />
              <text style={{ color: C.green, fontWeight: "bold" }}>✓ Result:</text>
              <text style={{ color: C.text, marginLeft: 2 }}>
                {JSON.stringify(response.result, null, 2)}
              </text>
              {response.confidence !== undefined && (
                <text style={{ color: C.textDim, marginLeft: 2 }}>
                  Confidence:{" "}
                  <text style={{ color: C.cyan }}>{Math.round(response.confidence * 100)}%</text>
                </text>
              )}
            </box>
          )}

          {response?.uncertainty && (
            <box style={{ marginTop: 1, flexDirection: "column" }}>
              <text style={{ color: C.yellow, fontWeight: "bold" }}>⚠ Uncertainty:</text>
              <text style={{ color: C.yellow, marginLeft: 2 }}>{response.uncertainty.note}</text>
              {response.uncertainty.recommend && (
                <text style={{ color: C.textDim, marginLeft: 2 }}>
                  → {response.uncertainty.recommend}
                </text>
              )}
            </box>
          )}
        </box>
      </Panel>

      <text style={{ color: C.textDim, textAlign: "center" }}>
        <text style={{ color: C.accentBright }}>[Enter / R]</text> try again  ·{" "}
        <text style={{ color: C.textDim }}>[Q]</text> quit
      </text>
    </box>
  )
}

function QuitScreen() {
  return (
    <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
      <text style={{ color: C.accentBright, fontWeight: "bold" }}>
        ⬡ AMP Protocol — Interactive Demo
      </text>
      <text style={{ color: C.textDim, marginTop: 1 }}>
        Thanks for exploring AMP! Check out the spec at /SPEC.md
      </text>
      <text style={{ color: C.textMuted, marginTop: 1 }}>
        Goodbye ✨
      </text>
    </box>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export function AMPDemoApp() {
  const [screen, setScreen] = useState<Screen>("loading")
  const [manifest, setManifest] = useState<AgentManifest | null>(null)
  const [manifestError, setManifestError] = useState<string | null>(null)
  const [selectedCapIdx, setSelectedCapIdx] = useState(0)
  const [userInput, setUserInput] = useState("")
  const [ampRequest, setAmpRequest] = useState<AmpRequest | null>(null)
  const [ampResponse, setAmpResponse] = useState<AmpResponse | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [quit, setQuit] = useState(false)

  // Fetch manifest on mount
  useEffect(() => {
    fetch(`${AGENT_URL}/.well-known/agent.json`)
      .then((r) => r.json())
      .then((data) => {
        setManifest(data)
        setScreen("manifest")
      })
      .catch((err) => {
        setManifestError(`Could not reach agent at ${AGENT_URL}. Start it first: python agent.py`)
        setManifest({
          amp: "1.0",
          id: "reference-agent.amp-protocol.local",
          name: "AMP Reference Agent (offline)",
          description: "Agent is not running — start it to see live responses",
          capabilities: [
            "echo any message back to the sender",
            "evaluate basic math expressions",
            "summarize text to a shorter form",
          ],
          endpoints: { message: `${AGENT_URL}/api/amp/message` },
          version: "1.0.0",
        })
        setScreen("manifest")
      })
  }, [])

  const handleSelectCap = useCallback((idx: number) => {
    setSelectedCapIdx(idx)
    setUserInput("")
    setScreen("input")
  }, [])

  const handleUserInput = useCallback(
    (input: string) => {
      const cap = CAPABILITIES[selectedCapIdx]
      const req = buildAmpRequest(cap.buildIntent(input), cap.buildContext(input), manifest?.id ?? "agent")
      setUserInput(input)
      setAmpRequest(req)
      setScreen("request_preview")
    },
    [selectedCapIdx, manifest],
  )

  const handleSend = useCallback(async () => {
    if (!ampRequest) return
    setScreen("sending")
    setSendError(null)
    setAmpResponse(null)

    try {
      const res = await fetch(`${AGENT_URL}/api/amp/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ampRequest),
      })
      const data: AmpResponse = await res.json()
      setAmpResponse(data)
    } catch (err) {
      setSendError(
        err instanceof Error
          ? err.message
          : "Network error — is the reference agent running?",
      )
    }

    setScreen("response")
  }, [ampRequest])

  if (quit) {
    return (
      <box style={{ flexDirection: "column", flex: 1, backgroundColor: C.bg }}>
        <Header />
        <QuitScreen />
      </box>
    )
  }

  return (
    <box style={{ flexDirection: "column", flex: 1, backgroundColor: C.bg }}>
      <Header />

      {screen === "loading" && <LoadingScreen />}

      {screen === "manifest" && manifest && (
        <ManifestScreen manifest={manifest} onContinue={() => setScreen("menu")} />
      )}

      {screen === "menu" && (
        <MenuScreen
          onSelect={handleSelectCap}
          onQuit={() => setQuit(true)}
        />
      )}

      {screen === "input" && (
        <InputScreen
          capability={CAPABILITIES[selectedCapIdx]}
          onSubmit={handleUserInput}
          onBack={() => setScreen("menu")}
        />
      )}

      {screen === "request_preview" && ampRequest && (
        <RequestPreviewScreen
          request={ampRequest}
          onSend={handleSend}
          onBack={() => setScreen("input")}
        />
      )}

      {screen === "sending" && <SendingScreen />}

      {screen === "response" && ampRequest && (
        <ResponseScreen
          request={ampRequest}
          response={ampResponse}
          error={sendError}
          onAgain={() => setScreen("menu")}
          onQuit={() => setQuit(true)}
        />
      )}
    </box>
  )
}

// ─── Root export ──────────────────────────────────────────────────────────────

export function App() {
  return (
    <TUI style={{ width: "100vw", height: "100vh" }} backgroundColor={C.bg}>
      <AMPDemoApp />
    </TUI>
  )
}
