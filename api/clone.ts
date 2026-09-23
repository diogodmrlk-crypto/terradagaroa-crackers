import type { VercelRequest, VercelResponse } from '@vercel/node'
import { zipSync, strToU8 } from 'fflate'

type Item = { url: string; path: string; bytes: Uint8Array; contentType: string }
const MAX_PAGES = 18
const MAX_ASSETS = 80
const MAX_TOTAL_BYTES = 12 * 1024 * 1024
const TIMEOUT_MS = 9000

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '::1') return true
  if (/^(10|127)\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true
  const match = host.match(/^172\.(\d+)\./)
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31)
}
function normalizeUrl(value: string, base: URL) {
  try { const url = new URL(value, base); if (!['http:', 'https:'].includes(url.protocol)) return null; url.hash = ''; return url } catch { return null }
}
function sameOrigin(url: URL, root: URL) { return url.origin === root.origin }
function filePath(url: URL, fallback: string) {
  let path = decodeURIComponent(url.pathname || '/').replace(/^\/+/, '')
  if (!path || path.endsWith('/')) path += 'index.html'
  if (!/\.[a-z0-9]{1,8}$/i.test(path)) path += '.html'
  const suffix = url.search ? `-${Buffer.from(url.search).toString('base64url').slice(0, 8)}` : ''
  const dot = path.lastIndexOf('.')
  return `${path.slice(0, dot)}${suffix}${path.slice(dot)}` || fallback
}
function extractRefs(html: string, base: URL) {
  const refs = new Set<string>()
  const patterns = [/(?:href|src|poster|data-src)\s*=\s*["']([^"']+)["']/gi, /url\(\s*["']?([^"')]+)["']?\s*\)/gi]
  for (const pattern of patterns) { let match; while ((match = pattern.exec(html))) { const value = match[1].trim(); if (!value.startsWith('#') && !value.startsWith('data:') && !value.startsWith('mailto:')) refs.add(value) } }
  return [...refs].map((ref) => normalizeUrl(ref, base)).filter((url): url is URL => Boolean(url))
}
function relativePath(from: string, target: string) {
  const base = from.split('/'); base.pop()
  const targetParts = target.split('/'); let common = 0
  while (common < base.length && common < targetParts.length && base[common] === targetParts[common]) common++
  return `${'../'.repeat(base.length - common)}${targetParts.slice(common).join('/')}` || './'
}
function rewriteDocument(html: string, source: URL, sourcePath: string, paths: Map<string, string>) {
  return html.replace(/(href|src|poster|data-src)\s*=\s*(["'])([^"']+)(\2)/gi, (full, attr, quote, value) => {
    const target = normalizeUrl(value, source); const local = target && paths.get(target.href)
    return local ? `${attr}=${quote}${relativePath(sourcePath, local)}${quote}` : full
  }).replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (full, quote, value) => {
    const target = normalizeUrl(value, source); const local = target && paths.get(target.href)
    return local ? `url(${quote}${relativePath(sourcePath, local)}${quote})` : full
  })
}
async function fetchItem(url: URL): Promise<Item | null> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Terradagaroa-Crackers/1.0 (authorized-site-export)' }, signal: controller.signal })
    if (!response.ok) return null
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > MAX_TOTAL_BYTES) return null
    return { url: url.href, path: '', bytes, contentType: response.headers.get('content-type') || '' }
  } catch { return null } finally { clearTimeout(timer) }
}
function jsonError(response: VercelResponse, status: number, message: string) { return response.status(status).json({ error: message }) }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return jsonError(res, 405, 'Use POST.')
  const { url: rawUrl, mode = 'basic', consent } = req.body || {}
  if (!consent) return jsonError(res, 400, 'Confirme que você tem autorização para exportar este site.')
  if (typeof rawUrl !== 'string' || !['basic', 'advanced'].includes(mode)) return jsonError(res, 400, 'URL ou modo inválido.')
  let root: URL
  try { root = new URL(rawUrl); if (!['http:', 'https:'].includes(root.protocol) || isBlockedHost(root.hostname)) throw new Error() } catch { return jsonError(res, 400, 'Use uma URL pública http(s) e não um endereço local ou privado.') }

  const queue: URL[] = [root]; const seen = new Set<string>(); const items: Item[] = []; let total = 0
  while (queue.length && items.length < (mode === 'basic' ? 1 : MAX_PAGES + MAX_ASSETS)) {
    const current = queue.shift()!; if (seen.has(current.href) || !sameOrigin(current, root)) continue; seen.add(current.href)
    const item = await fetchItem(current); if (!item) continue
    total += item.bytes.byteLength; if (total > MAX_TOTAL_BYTES) break
    item.path = items.length === 0 ? 'index.html' : filePath(current, `pages/page-${items.length}.html`)
    items.push(item)
    const isHtml = item.contentType.includes('html') || /\.(html?|php|aspx?)($|\?)/i.test(current.pathname) || current.href === root.href
    if (mode === 'advanced' && isHtml) {
      const text = new TextDecoder().decode(item.bytes)
      for (const ref of extractRefs(text, current)) {
        if (!sameOrigin(ref, root) || seen.has(ref.href)) continue
        const likelyPage = !/\.(css|js|mjs|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|mp3|wav|mp4|webm|pdf|zip)$/i.test(ref.pathname)
        if (likelyPage && queue.length < MAX_PAGES) queue.push(ref)
        else if (!likelyPage && items.length + queue.length < MAX_PAGES + MAX_ASSETS) queue.push(ref)
      }
    }
  }
  if (!items.length) return jsonError(res, 502, 'Não foi possível acessar essa URL. Verifique se o site é público e permite requisições.')
  const paths = new Map(items.map((item) => [item.url, item.path])); const files: Record<string, Uint8Array> = {}
  for (const item of items) {
    const isHtml = item.contentType.includes('html') || item.path.endsWith('.html')
    files[item.path] = isHtml ? strToU8(rewriteDocument(new TextDecoder().decode(item.bytes), new URL(item.url), item.path, paths)) : item.bytes
  }
  files['README-TERRADAGAROA.txt'] = strToU8(`Exportado pelo Terradagaroa Crackers\nURL de origem: ${root.href}\nModo: ${mode}\nArquivos coletados: ${items.length}\n\nUse somente conteúdo para o qual você possui autorização.\n`)
  const archive = zipSync(files, { level: 6 })
  res.setHeader('Content-Type', 'application/zip'); res.setHeader('Content-Disposition', `attachment; filename="terradagaroa-${mode}-clone.zip"`); res.setHeader('Cache-Control', 'no-store')
  return res.status(200).send(Buffer.from(archive))
}
