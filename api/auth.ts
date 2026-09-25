import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac } from 'node:crypto'

type Session = { id: string; role: 'admin' | 'user' }
const ADMIN_ID = 'devterradagaroa'
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'devterradagaroa-admin'
const SESSION_SECRET = process.env.SESSION_SECRET || ADMIN_SECRET
const EDGE_URL = `${process.env.SUPABASE_URL || 'https://zrjfzxqkpjhsisbjvpbx.supabase.co'}/functions/v1/terradagaroa-auth`
function token(payload: Session) { const body = Buffer.from(JSON.stringify(payload)).toString('base64url'); const signature = createHmac('sha256', SESSION_SECRET).update(body).digest('base64url'); return `${body}.${signature}` }
function verify(value?: string): Session | null { try { if (!value) return null; const [body, signature] = value.split('.'); if (createHmac('sha256', SESSION_SECRET).update(body).digest('base64url') !== signature) return null; return JSON.parse(Buffer.from(body, 'base64url').toString()) as Session } catch { return null } }
function cookies(req: VercelRequest) { return Object.fromEntries((req.headers.cookie || '').split(';').map((part) => part.trim().split('=').map(decodeURIComponent)).filter(([key]) => key)) }
function setCookie(res: VercelResponse, name: string, value: string, maxAge = 60 * 60 * 24 * 30) { res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax; Secure`) }
function json(res: VercelResponse, status: number, body: unknown) { return res.status(status).json(body) }
async function edge(action: string, payload: Record<string, unknown>) { const response = await fetch(EDGE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload }) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw Object.assign(new Error(data.error || 'Edge Function error'), { status: response.status }); return data }

export function verifySession(value?: string) { return verify(value) }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Use POST.' })
  const body = req.body || {}; const jar = cookies(req); const current = verify(jar.tg_session)
  try {
    if (body.action === 'logout') { setCookie(res, 'tg_session', '', 0); return json(res, 200, { ok: true }) }
    if (body.action === 'me') return current ? json(res, 200, { ok: true, user: current }) : json(res, 401, { error: 'Não autenticado.' })
    if (body.action === 'restore') {
      const result = await edge('login', { id: String(body.id || '').trim(), deviceToken: jar.tg_device })
      setCookie(res, 'tg_device', result.deviceToken, 60 * 60 * 24 * 365 * 2); setCookie(res, 'tg_session', token({ id: result.id, role: 'user' })); return json(res, 200, { ok: true, user: { id: result.id, role: 'user' } })
    }
    if (body.action === 'list' || body.action === 'create' || body.action === 'delete' || body.action === 'reset-device') {
      if (!current || current.role !== 'admin') return json(res, 403, { error: 'Acesso admin necessário.' })
      return json(res, 200, await edge(body.action, body))
    }
    const id = String(body.id || '').trim(); const secret = String(body.secret || '')
    if (id.toLowerCase() === ADMIN_ID) { if (secret !== ADMIN_SECRET) return json(res, 401, { error: 'Chave admin inválida.' }); setCookie(res, 'tg_session', token({ id: ADMIN_ID, role: 'admin' })); return json(res, 200, { ok: true, user: { id: ADMIN_ID, role: 'admin' } }) }
    const result = await edge('login', { id, deviceToken: jar.tg_device })
    setCookie(res, 'tg_device', result.deviceToken, 60 * 60 * 24 * 365 * 2); setCookie(res, 'tg_session', token({ id: result.id, role: 'user' })); return json(res, 200, { ok: true, user: { id: result.id, role: 'user' } })
  } catch (error) { const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500; return json(res, status, { error: error instanceof Error ? error.message : 'Falha na autenticação.' }) }
}
