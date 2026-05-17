import iconv from 'iconv-lite'
import { h } from 'koishi'
import type { Session } from 'koishi'

// ── 编码检测 ────────────────────────────────

function extractCharsetFromHeader(contentType?: string | null): string | null {
  if (!contentType) return null
  const m = contentType.match(/charset\s*=\s*['"]?([^;\s'"]+)/i)
  return m?.[1]?.trim().toLowerCase() ?? null
}

function extractCharsetFromMeta(buffer: Buffer): string | null {
  const head = buffer.subarray(0, Math.min(buffer.length, 8192)).toString('ascii')
  const direct = head.match(/<meta[^>]*charset\s*=\s*['"]?([^\s'">/]+)/i)?.[1]
  if (direct) return direct.toLowerCase()
  const httpEquiv = head.match(
    /<meta[^>]*http-equiv\s*=\s*['"]content-type['"][^>]*content\s*=\s*['"][^"]*charset\s*=\s*([^\s'"';>]+)/i,
  )?.[1]
  return httpEquiv?.toLowerCase() ?? null
}

function normalizeCharset(charset?: string | null): string | null {
  if (!charset) return null
  const lower = charset.toLowerCase()
  if (lower === 'gb2312' || lower === 'gbk' || lower === 'x-gbk') return 'gb18030'
  if (lower === 'utf8') return 'utf-8'
  return lower
}

/** 从 Buffer 解码 HTML，自动检测编码 */
export function decodeHtml(buffer: Buffer, contentType?: string | null): string {
  const charset =
    normalizeCharset(extractCharsetFromHeader(contentType))
    ?? normalizeCharset(extractCharsetFromMeta(buffer))
    ?? 'utf-8'
  return iconv.decode(buffer, iconv.encodingExists(charset) ? charset : 'utf-8')
}

// ── URL 工具 ────────────────────────────────

const DIRECT_FILE_EXTS = new Set(['.pdf', '.epub', '.mobi', '.txt', '.doc', '.docx', '.zip', '.rar', '.chm'])

/** 将相对/绝对 href 解析为完整 URL，过滤无效链接 */
export function resolveUrl(base: string, href?: string | null): string | null {
  if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:'))
    return null
  try { return new URL(href, base).toString() } catch { return null }
}

/** 判断 URL 是否为可下载文件 */
export function isDirectFile(url: string): boolean {
  const pathname = new URL(url).pathname.toLowerCase()
  const dot = pathname.lastIndexOf('.')
  return dot >= 0 && DIRECT_FILE_EXTS.has(pathname.slice(dot))
}

/** 判断 URL 是否指向 HTML 页面（而非目录或文件） */
export function isHtmlPage(url: string): boolean {
  const pathname = new URL(url).pathname.toLowerCase()
  if (pathname.endsWith('/') || isDirectFile(url)) return false
  return /\.(html?|xhtml|shtml|php|asp|aspx)$/i.test(pathname)
}

/** 清理链接文本，兜底用 URL 最后一段 */
export function cleanTitle(raw: string, fallbackUrl: string): string {
  const title = raw.replace(/\s+/g, ' ').trim()
  if (title) return title
  const segment = new URL(fallbackUrl).pathname.split('/').filter(Boolean).at(-1)
  return segment ? decodeURIComponent(segment) : fallbackUrl
}

// ── 发送工具 ────────────────────────────────

function fileNameFromUrl(url: string, fallback: string): string {
  const name = new URL(url).pathname.split('/').filter(Boolean).at(-1)
  return name ? decodeURIComponent(name) : fallback || 'document'
}

/** 发送文件给用户 */
export async function sendAsset(session: Session, asset: { title: string; url: string }): Promise<void> {
  const fileName = fileNameFromUrl(asset.url, asset.title)
  await session.send(`已获取下载文件：${fileName}`)
  await session.send(h('file', { src: asset.url, title: fileName }))
}
