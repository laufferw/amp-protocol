/**
 * AMP — Agent Message Protocol
 * JavaScript/Node.js reference implementation v1.0
 *
 * No dependencies. Works in Node 18+ and modern browsers.
 *
 * Usage (ESM):
 *   import { AMPClient, makeResponse, validateMessage } from './amp.js'
 *
 *   const client = new AMPClient('https://agentboard.fyi', { apiKey: 'your_key' })
 *
 *   const response = await client.send({
 *     to: 'some-agent.example.com',
 *     intent: 'Summarize recent posts about LLM memory systems',
 *     context: { max_tokens: 500, background: 'Building an agent memory system' },
 *   })
 *
 *   if (response.ok) console.log(response.result)
 *   else console.error(response.error)
 */

const AMP_VERSION = '1.0'

function nanoid(len = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  const arr = new Uint8Array(len)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr)
  } else {
    // Node.js fallback
    const { randomFillSync } = await import('crypto').catch(() => ({ randomFillSync: (b) => { for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256); return b } }))
    randomFillSync(arr)
  }
  for (const byte of arr) id += chars[byte % chars.length]
  return id
}

function isoNow() {
  return new Date().toISOString()
}

// ── Message Builder ─────────────────────────────────────────────────────────

export function buildMessage({
  intent,
  to,
  fromId,
  fromName = '',
  fromType = 'agent',
  type = 'query',
  context = {},
  trust = { level: 'read-only' },
  replyTo = null,
  sync = true,
  ttl = 300,
  traceId = null,
}) {
  const msg = {
    amp: AMP_VERSION,
    id: `msg_${nanoid()}`,
    from: { id: fromId, name: fromName, type: fromType },
    to,
    intent,
    type,
    context,
    trust,
    sync,
    ttl,
    trace_id: traceId || `trace_${nanoid(8)}`,
    timestamp: isoNow(),
  }
  if (replyTo) msg.reply_to = replyTo
  return msg
}

// ── Response wrapper ────────────────────────────────────────────────────────

export class AMPResponse {
  constructor(raw) {
    this.raw = raw
  }

  get ok() {
    return ['ok', 'partial'].includes(this.raw.status)
  }

  get status() {
    return this.raw.status ?? 'unknown'
  }

  get result() {
    return this.raw.result
  }

  get confidence() {
    return this.raw.confidence ?? null
  }

  get uncertainty() {
    return this.raw.uncertainty ?? null
  }

  get error() {
    return this.raw.error ?? null
  }

  get deferred() {
    return this.raw.status === 'deferred'
  }

  get jobId() {
    return this.deferred && this.raw.result?.job_id ? this.raw.result.job_id : null
  }

  toString() {
    return `AMPResponse(status=${this.status}, confidence=${this.confidence})`
  }
}

// ── Client ──────────────────────────────────────────────────────────────────

export class AMPClient {
  /**
   * @param {string} hubUrl - Base URL of the AMP hub
   * @param {object} opts
   * @param {string} opts.apiKey - Bearer token
   * @param {string} opts.agentId - Your agent's identifier
   * @param {string} opts.agentName - Your agent's display name
   */
  constructor(hubUrl, { apiKey = '', agentId = '', agentName = '' } = {}) {
    this.hubUrl = hubUrl.replace(/\/$/, '')
    this.apiKey = apiKey
    this.agentId = agentId || 'unknown-agent'
    this.agentName = agentName
  }

  /**
   * Send an AMP message.
   * @returns {Promise<AMPResponse>}
   */
  async send({
    intent,
    to,
    context = {},
    trust = { level: 'read-only' },
    type = 'query',
    sync = true,
    ttl = 300,
    replyTo = null,
  }) {
    const msg = buildMessage({
      intent,
      to,
      fromId: this.agentId,
      fromName: this.agentName,
      type,
      context,
      trust,
      sync,
      ttl,
      replyTo,
    })
    return this._post('/api/amp/message', msg)
  }

  /**
   * Discover agents by capability or free-text query.
   * @returns {Promise<object[]>}
   */
  async discover({ capability, query } = {}) {
    const params = new URLSearchParams()
    if (capability) params.set('capability', capability)
    if (query) params.set('q', query)
    const qs = params.toString()
    const url = `${this.hubUrl}/api/amp/discover${qs ? '?' + qs : ''}`
    const raw = await this._get(url)
    return raw.agents || raw
  }

  /**
   * Fetch agent.json from any AMP-compatible agent.
   * @returns {Promise<object>}
   */
  async getAgentInfo(agentUrl) {
    const url = `${agentUrl.replace(/\/$/, '')}/.well-known/agent.json`
    return this._get(url, false)
  }

  /**
   * Poll for an async job result.
   * @returns {Promise<AMPResponse>}
   */
  async pollJob(jobId) {
    const raw = await this._get(`${this.hubUrl}/api/amp/jobs/${jobId}`)
    return new AMPResponse(raw)
  }

  // internals ─────────────────────────────────────────────────────────────────

  async _post(path, body) {
    const url = `${this.hubUrl}${path}`
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' }
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      })
      const raw = await res.json()
      return new AMPResponse(raw)
    } catch (err) {
      return new AMPResponse({
        status: 'error',
        error: { code: 'network_error', message: err.message },
      })
    }
  }

  async _get(url, useAuth = true) {
    const headers = { 'Accept': 'application/json' }
    if (this.apiKey && useAuth) headers['Authorization'] = `Bearer ${this.apiKey}`

    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) })
      return res.json()
    } catch (err) {
      return { error: err.message }
    }
  }
}

// ── Server helpers ───────────────────────────────────────────────────────────

/**
 * Validate an incoming AMP message.
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateMessage(msg) {
  const required = ['amp', 'id', 'from', 'to', 'intent', 'timestamp']
  for (const field of required) {
    if (!(field in msg)) return { valid: false, error: `Missing required field: ${field}` }
  }
  if (msg.amp !== AMP_VERSION) return { valid: false, error: `Unsupported AMP version: ${msg.amp}` }
  if (!msg.from?.id) return { valid: false, error: 'from.id is required' }
  return { valid: true }
}

/**
 * Build an AMP response envelope.
 */
export function makeResponse({
  requestId,
  fromId,
  status = 'ok',
  result = undefined,
  confidence = undefined,
  uncertainty = undefined,
  error = undefined,
  traceId = undefined,
}) {
  const resp = {
    amp: AMP_VERSION,
    id: `msg_${nanoid()}`,
    in_reply_to: requestId,
    from: { id: fromId },
    status,
    timestamp: isoNow(),
  }
  if (result !== undefined) resp.result = result
  if (confidence !== undefined) resp.confidence = confidence
  if (uncertainty) resp.uncertainty = uncertainty
  if (error) resp.error = error
  if (traceId) resp.trace_id = traceId
  return resp
}
