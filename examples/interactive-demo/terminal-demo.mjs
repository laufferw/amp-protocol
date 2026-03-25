#!/usr/bin/env node
/**
 * AMP Protocol Interactive Demo — Terminal Version
 * =================================================
 *
 * A pure Node.js TUI that walks through the AMP protocol interactively.
 * No external dependencies required — uses built-in readline.
 *
 * For the full Gridland browser experience: npm run dev
 *
 * Usage:
 *   node terminal-demo.mjs
 *
 * Requires the reference agent running:
 *   cd ../reference-agent && python agent.py
 */

import readline from "node:readline"

// ─── Config ──────────────────────────────────────────────────────────────────

const AGENT_URL = "http://localhost:8765"
const SENDER_ID = "amp-demo.interactive"
const SENDER_NAME = "AMP Interactive Demo"

// ─── ANSI Colors ─────────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  purple: "\x1b[38;5;141m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
  white: "\x1b[97m",
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function newId() {
  return `msg_${Math.random().toString(36).slice(2, 14)}`
}

function hr(char = "─", len = 60, color = c.gray) {
  return `${color}${char.repeat(len)}${c.reset}`
}

function printHeader() {
  console.log()
  console.log(hr("═", 60, c.purple))
  console.log(
    `${c.purple}${c.bold}  ⬡  AMP Protocol — Interactive Demo  ⬡${c.reset}`,
  )
  console.log(
    `${c.gray}  Agent Message Protocol · v1.0-draft · intent-aware semantics${c.reset}`,
  )
  console.log(hr("═", 60, c.purple))
  console.log()
}

function printJson(label, json, accentColor = c.cyan) {
  console.log(`${accentColor}${c.bold}${label}${c.reset}`)
  console.log(hr("─", 60, accentColor))

  const formatted = JSON.stringify(json, null, 2)
  for (const line of formatted.split("\n")) {
    const keyMatch = line.match(/^(\s*)"([^"]+)"(:)/)
    if (keyMatch) {
      const [, indent, key, colon] = keyMatch
      const rest = line.slice(keyMatch[0].length)
      const keyColor =
        key === "status" ? c.yellow
        : key === "result" ? c.green
        : key === "confidence" ? c.cyan
        : key === "error" || key === "uncertainty" ? c.red
        : c.cyan
      console.log(
        `${c.gray}${indent}${keyColor}"${key}"${c.gray}${colon}${c.white}${rest}${c.reset}`,
      )
    } else {
      console.log(`${c.gray}${line}${c.reset}`)
    }
  }
  console.log()
}

// ─── Capabilities ────────────────────────────────────────────────────────────

const CAPABILITIES = [
  {
    key: "1",
    label: "Echo",
    description: "Echo any message back",
    prompt: "Type something to echo: ",
    buildContext: (input) => ({ text: input }),
    buildIntent: (input) => `echo: ${input}`,
  },
  {
    key: "2",
    label: "Math",
    description: "Evaluate a math expression",
    prompt: "Enter a math expression (e.g. 42 * 2 + 8): ",
    buildContext: (input) => ({ expression: input }),
    buildIntent: (input) => `calculate: ${input}`,
  },
  {
    key: "3",
    label: "Summarize",
    description: "Summarize text to a shorter form",
    prompt: "Enter text to summarize: ",
    buildContext: (input) => ({ text: input }),
    buildIntent: () => "summarize the provided text",
  },
  {
    key: "4",
    label: "Custom",
    description: "Type any free-form intent",
    prompt: "Enter your intent: ",
    buildContext: () => ({}),
    buildIntent: (input) => input,
  },
]

// ─── AMP Message Builder ─────────────────────────────────────────────────────

function buildAmpRequest(intent, context, agentId) {
  return {
    amp: "1.0",
    id: newId(),
    from: { id: SENDER_ID, name: SENDER_NAME, type: "human" },
    to: agentId,
    intent,
    type: "query",
    context,
    sync: true,
    timestamp: new Date().toISOString(),
  }
}

// ─── Network ─────────────────────────────────────────────────────────────────

async function fetchManifest() {
  try {
    const res = await fetch(`${AGENT_URL}/.well-known/agent.json`)
    return await res.json()
  } catch {
    return null
  }
}

async function sendAmpMessage(request) {
  const res = await fetch(`${AGENT_URL}/api/amp/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })
  return await res.json()
}

// ─── Readline Helper ─────────────────────────────────────────────────────────

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve))
}

// ─── Main Flow ───────────────────────────────────────────────────────────────

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  printHeader()

  // Step 1: Fetch manifest
  console.log(`${c.dim}⟳ Fetching agent manifest from ${AGENT_URL}/.well-known/agent.json…${c.reset}`)
  console.log()

  const manifest = await fetchManifest()

  if (!manifest) {
    console.log(
      `${c.red}${c.bold}✗ Could not reach agent at ${AGENT_URL}${c.reset}`,
    )
    console.log(
      `${c.gray}  Start the reference agent first:${c.reset}`,
    )
    console.log(
      `${c.white}  cd ../reference-agent && python agent.py${c.reset}`,
    )
    console.log()
    rl.close()
    process.exit(1)
  }

  // Step 2: Show manifest
  console.log(`${c.purple}${c.bold}⬡ Agent Manifest${c.reset}`)
  console.log(hr("─", 60, c.purple))
  console.log(`  ${c.gray}ID:${c.reset}           ${c.cyan}${manifest.id}${c.reset}`)
  console.log(`  ${c.gray}Name:${c.reset}         ${c.white}${manifest.name}${c.reset}`)
  console.log(`  ${c.gray}Version:${c.reset}      ${c.white}${manifest.version ?? "—"}${c.reset}`)
  console.log(`  ${c.gray}Protocol:${c.reset}     ${c.green}amp/1.0${c.reset}`)
  console.log(`  ${c.gray}Description:${c.reset}  ${c.white}${manifest.description}${c.reset}`)
  console.log(`  ${c.gray}Endpoint:${c.reset}     ${c.blue}${manifest.endpoints.message}${c.reset}`)
  console.log()
  console.log(`  ${c.gray}Capabilities:${c.reset}`)
  for (const cap of manifest.capabilities) {
    console.log(`    ${c.cyan}• ${cap}${c.reset}`)
  }
  console.log()

  // Main loop
  let running = true
  while (running) {
    // Step 3: Menu
    console.log(hr("─", 60, c.purple))
    console.log(`${c.purple}${c.bold}⬡ Choose a Capability to Demo${c.reset}`)
    console.log()
    for (const cap of CAPABILITIES) {
      console.log(
        `  ${c.purple}[${cap.key}]${c.reset} ${c.white}${cap.label}${c.reset} ${c.gray}— ${cap.description}${c.reset}`,
      )
    }
    console.log(`  ${c.gray}[q] Quit${c.reset}`)
    console.log()

    const choice = (await ask(rl, `${c.purple}▶ ${c.reset}Select (1-4 or q): `)).trim()

    if (choice === "q" || choice === "Q") {
      running = false
      break
    }

    const cap = CAPABILITIES.find((c) => c.key === choice)
    if (!cap) {
      console.log(`${c.red}  Invalid choice. Try 1-4 or q.${c.reset}\n`)
      continue
    }

    // Step 4: Get input
    console.log()
    const input = (await ask(rl, `${c.cyan}  ${cap.prompt}${c.reset}`)).trim()
    if (!input) {
      console.log(`${c.red}  Empty input, going back to menu.${c.reset}\n`)
      continue
    }

    // Step 5: Build and display request
    const intent = cap.buildIntent(input)
    const context = cap.buildContext(input)
    const request = buildAmpRequest(intent, context, manifest.id)

    console.log()
    printJson("⬡ AMP Request — POST /api/amp/message", request, c.yellow)

    // Step 6: Send
    console.log(`${c.dim}⟳ Sending to ${AGENT_URL}/api/amp/message…${c.reset}`)
    console.log()

    try {
      const response = await sendAmpMessage(request)

      // Step 7: Display response
      const statusColor =
        response.status === "ok" ? c.green
        : response.status === "error" ? c.red
        : c.yellow
      printJson(
        `⬡ AMP Response [${response.status.toUpperCase()}]`,
        response,
        statusColor,
      )

      // Highlight result
      if (response.status === "ok" && response.result) {
        console.log(`${c.green}${c.bold}✓ Result:${c.reset}`)
        console.log(`  ${c.white}${JSON.stringify(response.result)}${c.reset}`)
        if (response.confidence !== undefined) {
          console.log(
            `  ${c.gray}Confidence: ${c.cyan}${Math.round(response.confidence * 100)}%${c.reset}`,
          )
        }
        console.log()
      }

      if (response.uncertainty) {
        console.log(`${c.yellow}${c.bold}⚠ Uncertainty:${c.reset}`)
        console.log(`  ${c.yellow}${response.uncertainty.note}${c.reset}`)
        if (response.uncertainty.recommend) {
          console.log(`  ${c.gray}→ ${response.uncertainty.recommend}${c.reset}`)
        }
        console.log()
      }

      if (response.error) {
        console.log(`${c.red}${c.bold}✗ Error:${c.reset}`)
        console.log(`  ${c.red}[${response.error.code}] ${response.error.message}${c.reset}`)
        console.log()
      }
    } catch (err) {
      console.log(`${c.red}${c.bold}✗ Network error:${c.reset} ${c.red}${err.message}${c.reset}`)
      console.log(
        `${c.gray}  Is the reference agent running?${c.reset}\n`,
      )
    }
  }

  // Goodbye
  console.log()
  console.log(hr("═", 60, c.purple))
  console.log(
    `${c.purple}${c.bold}  Thanks for exploring AMP! ✨${c.reset}`,
  )
  console.log(
    `${c.gray}  Check out the full spec: ../../SPEC.md${c.reset}`,
  )
  console.log(hr("═", 60, c.purple))
  console.log()

  rl.close()
}

main().catch((err) => {
  // Ignore readline close errors from piped input
  if (err.message?.includes("readline was closed")) process.exit(0)
  console.error(`${c.red}Fatal: ${err.message}${c.reset}`)
  process.exit(1)
})
