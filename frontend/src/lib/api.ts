import type {
  BulkConversionResponse,
  ConversionRecord,
  ConversionRecordDetail,
} from '@/types'
import logger from '@/lib/logger'

const BASE = '/api'
const log = logger.child('api')

// ── LLM session rate limiting ─────────────────────────────────────────────────
// Tracks how many LLM (vision) calls have been made in this browser session.
// The backend enforces the hard limits; this counter is sent via header so the
// backend can apply per-session enforcement without needing cookies or auth.

const SESSION_KEY = 'llm_session_count'

export function getLlmSessionCount(): number {
  return parseInt(sessionStorage.getItem(SESSION_KEY) ?? '0', 10)
}

function incrementLlmSessionCount(): void {
  sessionStorage.setItem(SESSION_KEY, String(getLlmSessionCount() + 1))
}

function llmSessionHeaders(): Record<string, string> {
  return { 'X-LLM-Session-Count': String(getLlmSessionCount()) }
}

function trackLlmUsage(record: ConversionRecord): void {
  if (record.llm_tokens) {
    incrementLlmSessionCount()
    log.info('LLM session usage: %d call(s) this session', getLlmSessionCount())
  }
}

// ── Shared ────────────────────────────────────────────────────────────────────

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const msg = err.detail ?? 'An error occurred'
    log.error('%s %s → %d  %s', res.type, res.url, res.status, msg)
    throw new Error(msg)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// ── Convert ──────────────────────────────────────────────────────────────────

export async function convertFile(file: File): Promise<ConversionRecord> {
  log.info('convertFile: %s (%d bytes)', file.name, file.size)
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/convert`, {
    method: 'POST',
    headers: llmSessionHeaders(),
    body: form,
  })
  const record = await handleResponse<ConversionRecord>(res)
  trackLlmUsage(record)
  log.debug('convertFile result: id=%s status=%s', record.id, record.status)
  return record
}

export async function convertFiles(files: File[]): Promise<BulkConversionResponse> {
  log.info('convertFiles: %d file(s)', files.length)
  files.forEach((f) => log.debug('  └ %s (%d bytes)', f.name, f.size))
  const form = new FormData()
  for (const f of files) form.append('files', f)
  const res = await fetch(`${BASE}/convert/bulk`, {
    method: 'POST',
    headers: llmSessionHeaders(),
    body: form,
  })
  const response = await handleResponse<BulkConversionResponse>(res)
  // Count how many results used LLM in this bulk request
  response.results.forEach(trackLlmUsage)
  log.debug('convertFiles → %d result(s)', response.results.length)
  return response
}

export async function convertUrl(url: string): Promise<ConversionRecord> {
  log.info('convertUrl: %s', url.slice(0, 80))
  const res = await fetch(`${BASE}/convert/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...llmSessionHeaders() },
    body: JSON.stringify({ url }),
  })
  const record = await handleResponse<ConversionRecord>(res)
  trackLlmUsage(record)
  log.debug('convertUrl result: id=%s status=%s', record.id, record.status)
  return record
}

// ── History ───────────────────────────────────────────────────────────────────

export async function getHistory(): Promise<ConversionRecord[]> {
  log.debug('getHistory')
  const res = await fetch(`${BASE}/history`)
  const records = await handleResponse<ConversionRecord[]>(res)
  log.debug('getHistory → %d record(s)', records.length)
  return records
}

export async function getRecord(id: string): Promise<ConversionRecordDetail> {
  log.debug('getRecord id=%s', id)
  const res = await fetch(`${BASE}/history/${id}`)
  return handleResponse<ConversionRecordDetail>(res)
}

export async function deleteRecord(id: string): Promise<void> {
  log.info('deleteRecord id=%s', id)
  const res = await fetch(`${BASE}/history/${id}`, { method: 'DELETE' })
  return handleResponse<void>(res)
}

export async function clearHistory(): Promise<void> {
  log.warn('clearHistory: deleting ALL records')
  const res = await fetch(`${BASE}/history`, { method: 'DELETE' })
  return handleResponse<void>(res)
}

// ── Download ──────────────────────────────────────────────────────────────────

export function downloadUrl(id: string): string {
  return `${BASE}/download/${id}`
}

export async function downloadFile(id: string, filename: string): Promise<void> {
  log.info('downloadFile id=%s filename=%s', id, filename)
  const res = await fetch(downloadUrl(id))
  if (!res.ok) throw new Error('Download failed')
  const blob = await res.blob()
  log.debug('downloadFile blob size=%d bytes', blob.size)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const stem = filename.replace(/\.[^.]+$/, '')
  a.download = `${stem}.md`
  a.click()
  URL.revokeObjectURL(url)
}
