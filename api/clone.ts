import type { VercelRequest, VercelResponse } from '@vercel/node'
import { strToU8, zipSync } from 'fflate'
import { verifySession } from './auth'

type Item = { requestedUrl: string; url: string; path: string; bytes: Uint8Array; contentType: string }
const MAX_PAGES = 40
const MAX_ASSETS = 160
const MAX_TOTAL_BYTES = 24 * 1024 * 1024
const TIMEOUT_MS = 9000
const HTML_EXT = /\.(html?|php|aspx?|jsp)(?:$|\?)/i
const ASSET_EXT = /\.(css|js|mjs|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|mp3|wav|ogg|mp4|webm|pdf|zip|json|xml)(?:$|\?)/i

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '::1') return true
  if (/^(10|127)\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true
  const match = host.match(/^172\.(\d+)\./)
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31)
}
function rootDomain(hostname: string) { return hostname.toLowerCase().replace(/^www\./, '') }
function allowedHost(url: URL, root: URL) {
  const rootHost = rootDomain(root.hostname); const host = url.hostname.toLowerCase().replace(/^www\./, '')
  return host === rootHost || host.endsWith(`.${rootHost}`)
}
function normalizeUrl(value: string, base: URL) {
  try { const url = new URL(value, base); if (!['http:', 'https:'].includes(url.protocol)) return null; url.hash = ''; return url } catch { return null }
}
function filePath(url: URL, fallback: string) {
  let path = decodeURIComponent(url.pathname || '/').replace(/^\/+/, '')
  if (!path || path.endsWith('/')) path += 'index.html'
  if (!/\.[a-z0-9]{1,8}$/i.test(path)) path += '.html'
  const suffix = url.search ? `-${Buffer.from(url.search).toString('base64url').slice(0, 8)}` : ''
  const dot = path.lastIndexOf('.')
  return `${path.slice(0, dot)}${suffix}${path.slice(dot)}` || fallback
}
function extractRefs(text: string, base: URL) {
  const raw = new Set<string>()
  const patterns = [
    /(?:href|src|poster|action|data-src|data-url)\s*=\s*["']([^"']+)["']/gi,
    /url\(\s*["']?([^"')]+)["']?\s*\)/gi,
    /(?:location(?:\.href)?|window\.open|fetch|import|navigate|redirect)\s*\(?\s*["'`]([^"'`]+)["'`]/gi,
    /["'`]([^"'`\s]+\.html?(?:\?[^"'`\s]*)?)["'`]/gi,
  ]
  for (const pattern of patterns) { let match; while ((match = pattern.exec(text))) { const value = match[1].trim(); if (!value.startsWith('#') && !value.startsWith('data:') && !value.startsWith('mailto:') && !value.startsWith('javascript:')) raw.add(value) } }
  return [...raw].map((ref) => normalizeUrl(ref, base)).filter((url): url is URL => Boolean(url))
}
function extractSitemapLocs(xml: string, base: URL) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => normalizeUrl(match[1], base)).filter((url): url is URL => Boolean(url))
}
function relativePath(from: string, target: string) {
  const base = from.split('/'); base.pop(); const targetParts = target.split('/'); let common = 0
  while (common < base.length && common < targetParts.length && base[common] === targetParts[common]) common++
  return `${'../'.repeat(base.length - common)}${targetParts.slice(common).join('/')}` || './'
}
function rewriteDocument(text: string, source: URL, sourcePath: string, paths: Map<string, string>) {
  const rewrite = (value: string) => { const target = normalizeUrl(value, source); const local = target && paths.get(target.href); return local ? relativePath(sourcePath, local) : value }
  return text.replace(/(href|src|poster|action|data-src|data-url)\s*=\s*(["'])([^"']+)(\2)/gi, (full, attr, quote, value) => `${attr}=${quote}${rewrite(value)}${quote}`).replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (full, quote, value) => `url(${quote}${rewrite(value)}${quote})`).replace(/(["'`])([^"'`\s]+\.html?(?:\?[^"'`\s]*)?)\1/gi, (full, quote, value) => `${quote}${rewrite(value)}${quote}`)
}
async function fetchItem(url: URL): Promise<Item | null> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Terradagaroa-Crackers/1.1 (authorized-site-export)' }, signal: controller.signal })
    if (!response.ok) return null
    const bytes = new Uint8Array(await response.arrayBuffer()); if (bytes.byteLength > MAX_TOTAL_BYTES) return null
    const finalUrl = new URL(response.url || url.href)
    return { requestedUrl: url.href, url: finalUrl.href, path: '', bytes, contentType: response.headers.get('content-type') || '' }
  } catch { return null } finally { clearTimeout(timer) }
}
function jsonError(response: VercelResponse, status: number, message: string) { return response.status(status).json({ error: message }) }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return jsonError(res, 405, 'Use POST.')
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map((part) => part.trim().split('=').map(decodeURIComponent)).filter(([key]) => key))
  if (!verifySession(cookies.tg_session)) return jsonError(res, 401, 'Faça login antes de iniciar uma clonagem.')
  const { url: rawUrl, mode = 'basic', consent } = req.body || {}
  if (!consent) return jsonError(res, 400, 'Confirme que você tem autorização para exportar este site.')
  if (typeof rawUrl !== 'string' || !['basic', 'advanced'].includes(mode)) return jsonError(res, 400, 'URL ou modo inválido.')
  let root: URL
  try { root = new URL(rawUrl); if (!['http:', 'https:'].includes(root.protocol) || isBlockedHost(root.hostname)) throw new Error() } catch { return jsonError(res, 400, 'Use uma URL pública http(s) e não um endereço local ou privado.') }

  const queue: URL[] = [root]; const queued = new Set([root.href]); const seen = new Set<string>(); const items: Item[] = []; let total = 0; let pageCount = 0; let assetCount = 0
  if (mode === 'advanced') { for (const candidate of ['/sitemap.xml', '/sitemap_index.xml', '/robots.txt']) { const url = new URL(candidate, root); queue.push(url); queued.add(url.href) } }
  while (queue.length && items.length < MAX_PAGES + MAX_ASSETS) {
    const current = queue.shift()!; if (seen.has(current.href) || !allowedHost(current, root) || isBlockedHost(current.hostname)) continue; seen.add(current.href)
    const item = await fetchItem(current); if (!item || !allowedHost(new URL(item.url), root)) continue
    total += item.bytes.byteLength; if (total > MAX_TOTAL_BYTES) break
    const isHtml = item.contentType.includes('html') || HTML_EXT.test(current.pathname) || current.href === root.href
    const isAsset = ASSET_EXT.test(current.pathname) && !isHtml
    if (isAsset && assetCount >= MAX_ASSETS) continue
    if (!isAsset && pageCount >= MAX_PAGES) continue
    item.path = items.length === 0 ? 'index.html' : filePath(new URL(item.url), `pages/page-${items.length}.html`)
    if (items.some((saved) => saved.path === item.path)) item.path = `files/${items.length}-${item.path}`
    items.push(item); if (isAsset) assetCount++; else pageCount++
    if (mode === 'advanced') {
      const text = new TextDecoder().decode(item.bytes)
      const refs = item.contentType.includes('xml') || current.pathname.endsWith('.xml') ? extractSitemapLocs(text, current) : extractRefs(text, current)
      for (const ref of refs) {
        if (!allowedHost(ref, root) || isBlockedHost(ref.hostname) || seen.has(ref.href) || queued.has(ref.href)) continue
        const refIsAsset = ASSET_EXT.test(ref.pathname) && !HTML_EXT.test(ref.pathname)
        if (refIsAsset && assetCount + queue.filter((queuedUrl) => ASSET_EXT.test(queuedUrl.pathname)).length >= MAX_ASSETS) continue
        if (!refIsAsset && pageCount + queue.filter((queuedUrl) => !ASSET_EXT.test(queuedUrl.pathname)).length >= MAX_PAGES) continue
        queue.push(ref); queued.add(ref.href)
      }
    }
  }
  if (!items.length) return jsonError(res, 502, 'Não foi possível acessar essa URL. Verifique se o site é público e permite requisições.')
  const paths = new Map<string, string>(); for (const item of items) { paths.set(item.requestedUrl, item.path); paths.set(item.url, item.path) }
  const files: Record<string, Uint8Array> = {}
  for (const item of items) { const isHtml = item.contentType.includes('html') || item.path.endsWith('.html'); files[item.path] = isHtml ? strToU8(rewriteDocument(new TextDecoder().decode(item.bytes), new URL(item.url), item.path, paths)) : item.bytes }
  files['README-TERRADAGAROA.txt'] = strToU8(`Exportado pelo Terradagaroa Crackers\nURL de origem: ${root.href}\nModo: ${mode}\nPáginas: ${pageCount}\nAssets: ${assetCount}\n\nUse somente conteúdo para o qual você possui autorização.\n`)
  const archive = zipSync(files, { level: 6 }); res.setHeader('Content-Type', 'application/zip'); res.setHeader('Content-Disposition', `attachment; filename="terradagaroa-${mode}-clone.zip"`); res.setHeader('Cache-Control', 'no-store'); return res.status(200).send(Buffer.from(archive))
}
