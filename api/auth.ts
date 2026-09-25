import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

type Access = { id: string; expiresAt: string | null; deviceHash: string | null; createdAt: string; lastLoginAt?: string }
type Store = { accesses: Access[] }
const ADMIN_ID = 'devterradagaroa'
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'devterradagaroa-admin'
const SECRET = process.env.SESSION_SECRET || ADMIN_SECRET
const file = join(process.cwd(), 'data', 'access.json')
const memoryStore: Store = { accesses: [] }

async function load(): Promise<Store> { try { const parsed = JSON.parse(await readFile(file, 'utf8')) as Store; memoryStore.accesses = parsed.accesses || []; return memoryStore } catch { return memoryStore } }
async function save(store: Store) { try { await writeFile(file, JSON.stringify(store, null, 2) + '\n', 'utf8') } catch { /* Vercel filesystem is read-only; demo data remains in memory. */ } }
function hash(value: string) { return createHash('sha256').update(value).digest('hex') }
function token(payload: Record<string, string>) { const body = Buffer.from(JSON.stringify(payload)).toString('base64url'); const signature = createHmac('sha256', SECRET).update(body).digest('base64url'); return `${body}.${signature}` }
export function verifySession(value?: string) { try { if (!value) return null; const [body, signature] = value.split('.'); const expected = createHmac('sha256', SECRET).update(body).digest('base64url'); if (signature !== expected) return null; return JSON.parse(Buffer.from(body, 'base64url').toString()) as { id: string; role: string } } catch { return null } }
function cookies(req: VercelRequest) { return Object.fromEntries((req.headers.cookie || '').split(';').map((part) => part.trim().split('=').map(decodeURIComponent)).filter(([key]) => key)) }
function setCookie(res: VercelResponse, name: string, value: string, maxAge = 60 * 60 * 24 * 30) { res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax; Secure`) }
function json(res: VercelResponse, status: number, body: unknown) { return res.status(status).json(body) }
function expired(access: Access) { return Boolean(access.expiresAt && new Date(access.expiresAt).getTime() < Date.now()) }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Use POST.' })
  const body = req.body || {}; const store = await load(); const jar = cookies(req); const current = verifySession(jar.tg_session)
  if (body.action === 'logout') { setCookie(res, 'tg_session', '', 0); return json(res, 200, { ok: true }) }
  if (body.action === 'me') return current ? json(res, 200, { ok: true, user: current }) : json(res, 401, { error: 'Não autenticado.' })
  if (body.action === 'list') { if (!current || current.role !== 'admin') return json(res, 403, { error: 'Acesso admin necessário.' }); return json(res, 200, { accesses: store.accesses.map(({ deviceHash, ...safe }) => ({ ...safe, deviceBound: Boolean(deviceHash) })) }) }
  if (body.action === 'create') {
    if (!current || current.role !== 'admin') return json(res, 403, { error: 'Acesso admin necessário.' })
    const id = String(body.id || '').trim(); if (!/^[a-zA-Z0-9_.-]{3,80}$/.test(id) || id === ADMIN_ID) return json(res, 400, { error: 'ID inválido.' })
    const expiresAt = body.expiresAt === 'permanent' || !body.expiresAt ? null : new Date(body.expiresAt).toISOString(); const existing = store.accesses.find((access) => access.id.toLowerCase() === id.toLowerCase())
    if (existing) { existing.expiresAt = expiresAt; existing.deviceHash = null } else store.accesses.push({ id, expiresAt, deviceHash: null, createdAt: new Date().toISOString() })
    await save(store); return json(res, 200, { ok: true })
  }
  if (body.action === 'reset-device' || body.action === 'delete') {
    if (!current || current.role !== 'admin') return json(res, 403, { error: 'Acesso admin necessário.' })
    const id = String(body.id || ''); const access = store.accesses.find((item) => item.id === id); if (!access) return json(res, 404, { error: 'ID não encontrado.' })
    if (body.action === 'delete') store.accesses = store.accesses.filter((item) => item.id !== id); else access.deviceHash = null
    await save(store); return json(res, 200, { ok: true })
  }
  const id = String(body.id || '').trim(); const secret = String(body.secret || '')
  if (id === ADMIN_ID) { if (secret !== ADMIN_SECRET) return json(res, 401, { error: 'Chave admin inválida.' }); setCookie(res, 'tg_session', token({ id: ADMIN_ID, role: 'admin' })); return json(res, 200, { ok: true, user: { id: ADMIN_ID, role: 'admin' } }) }
  const access = store.accesses.find((item) => item.id.toLowerCase() === id.toLowerCase())
  if (!access || expired(access)) return json(res, 401, { error: !access ? 'ID Discord não autorizado.' : 'Este acesso expirou.' })
  let device = jar.tg_device; if (!device) { device = randomBytes(32).toString('hex'); setCookie(res, 'tg_device', device, 60 * 60 * 24 * 365 * 2) }
  const deviceHash = hash(device); if (access.deviceHash && access.deviceHash !== deviceHash) return json(res, 403, { error: 'Este ID já está vinculado a outro dispositivo.' })
  access.deviceHash = deviceHash; access.lastLoginAt = new Date().toISOString(); await save(store); setCookie(res, 'tg_session', token({ id: access.id, role: 'user' })); return json(res, 200, { ok: true, user: { id: access.id, role: 'user' } })
}
