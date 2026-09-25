import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash, createHmac, randomBytes } from 'node:crypto'

type Access = { id: string; expires_at: string | null; device_hash: string | null; created_at: string; last_login_at?: string }
const ADMIN_ID = 'devterradagaroa'
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'devterradagaroa-admin'
const SESSION_SECRET = process.env.SESSION_SECRET || ADMIN_SECRET
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zrjfzxqkpjhsisbjvpbx.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TABLE = 'terradagaroa_accesses'

function hash(value: string) { return createHash('sha256').update(value).digest('hex') }
function sessionToken(payload: Record<string, string>) { const body = Buffer.from(JSON.stringify(payload)).toString('base64url'); const signature = createHmac('sha256', SESSION_SECRET).update(body).digest('base64url'); return `${body}.${signature}` }
export function verifySession(value?: string) { try { if (!value) return null; const [body, signature] = value.split('.'); const expected = createHmac('sha256', SESSION_SECRET).update(body).digest('base64url'); if (signature !== expected) return null; return JSON.parse(Buffer.from(body, 'base64url').toString()) as { id: string; role: string } } catch { return null } }
function cookies(req: VercelRequest) { return Object.fromEntries((req.headers.cookie || '').split(';').map((part) => part.trim().split('=').map(decodeURIComponent)).filter(([key]) => key)) }
function setCookie(res: VercelResponse, name: string, value: string, maxAge = 60 * 60 * 24 * 30) { res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax; Secure`) }
function json(res: VercelResponse, status: number, body: unknown) { return res.status(status).json(body) }
function expired(access: Access) { return Boolean(access.expires_at && new Date(access.expires_at).getTime() < Date.now()) }
async function supabase<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente')
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}${path}`, { ...init, headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) } })
  if (!response.ok) throw new Error(`Supabase ${response.status}`)
  const text = await response.text(); return (text ? JSON.parse(text) : null) as T
}
async function findAccess(id: string) { const result = await supabase<Access[]>(`?id=eq.${encodeURIComponent(id)}&select=id,expires_at,device_hash,created_at,last_login_at&limit=1`); return result[0] }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Use POST.' })
  const body = req.body || {}; const jar = cookies(req); const current = verifySession(jar.tg_session)
  try {
    if (body.action === 'logout') { setCookie(res, 'tg_session', '', 0); return json(res, 200, { ok: true }) }
    if (body.action === 'me') return current ? json(res, 200, { ok: true, user: current }) : json(res, 401, { error: 'Não autenticado.' })
    if (body.action === 'list') { if (!current || current.role !== 'admin') return json(res, 403, { error: 'Acesso admin necessário.' }); const accesses = await supabase<Access[]>('?select=id,expires_at,created_at,last_login_at,device_hash&order=created_at.desc&limit=500'); return json(res, 200, { accesses: accesses.map(({ device_hash, ...access }) => ({ ...access, expiresAt: access.expires_at, deviceBound: Boolean(device_hash) })) }) }
    if (body.action === 'create') {
      if (!current || current.role !== 'admin') return json(res, 403, { error: 'Acesso admin necessário.' })
      const id = String(body.id || '').trim(); if (!/^[a-zA-Z0-9_.-]{3,80}$/.test(id) || id.toLowerCase() === ADMIN_ID) return json(res, 400, { error: 'ID inválido.' })
      const expiresAt = body.expiresAt === 'permanent' || !body.expiresAt ? null : new Date(body.expiresAt).toISOString(); await supabase(`?on_conflict=id`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id, expires_at: expiresAt, device_hash: null }) }); return json(res, 200, { ok: true })
    }
    if (body.action === 'reset-device' || body.action === 'delete') {
      if (!current || current.role !== 'admin') return json(res, 403, { error: 'Acesso admin necessário.' })
      const id = String(body.id || ''); const exists = await findAccess(id); if (!exists) return json(res, 404, { error: 'ID não encontrado.' })
      if (body.action === 'delete') await supabase(`?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' as const }); else await supabase(`?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ device_hash: null }) }); return json(res, 200, { ok: true })
    }
    const id = String(body.id || '').trim(); const secret = String(body.secret || '')
    if (id === ADMIN_ID) { if (secret !== ADMIN_SECRET) return json(res, 401, { error: 'Chave admin inválida.' }); setCookie(res, 'tg_session', sessionToken({ id: ADMIN_ID, role: 'admin' })); return json(res, 200, { ok: true, user: { id: ADMIN_ID, role: 'admin' } }) }
    const access = await findAccess(id); if (!access || expired(access)) return json(res, 401, { error: !access ? 'ID Discord não autorizado.' : 'Este acesso expirou.' })
    let device = jar.tg_device; if (!device) { device = randomBytes(32).toString('hex'); setCookie(res, 'tg_device', device, 60 * 60 * 24 * 365 * 2) }
    const deviceHash = hash(device); if (access.device_hash && access.device_hash !== deviceHash) return json(res, 403, { error: 'Este ID já está vinculado a outro dispositivo.' })
    await supabase(`?id=eq.${encodeURIComponent(access.id)}`, { method: 'PATCH', body: JSON.stringify({ device_hash: deviceHash, last_login_at: new Date().toISOString() }) }); setCookie(res, 'tg_session', sessionToken({ id: access.id, role: 'user' })); return json(res, 200, { ok: true, user: { id: access.id, role: 'user' } })
  } catch (error) { console.error(error); return json(res, 500, { error: 'Supabase não está configurado. Defina SUPABASE_SERVICE_ROLE_KEY na Vercel.' }) }
}
