import type { AnyNode } from 'domhandler'
import * as cheerio from 'cheerio'
import { Logger } from 'koishi'
import { readCache, writeCache } from './cache'
import { cleanTitle, decodeHtml, isDirectFile, isHtmlPage, resolveUrl } from './utils'
import type { CategoryItem, CrawlConfig, DocumentItem } from './types'

const logger = new Logger('redarchive')

// ── HTTP 抓取 ──────────────────────────────

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

async function httpGet(url: string, timeout: number): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    })
    const buffer = Buffer.from(await res.arrayBuffer())
    return decodeHtml(buffer, res.headers.get('content-type'))
  } finally {
    clearTimeout(timer)
  }
}

/** 依次尝试入口 URL 列表，返回首个成功抓取的 HTML */
async function tryFetchEntry(urls: string[], timeout: number): Promise<{ html: string; usedUrl: string }> {
  let lastError: unknown
  for (const url of urls) {
    try {
      const html = await httpGet(url, timeout)
      return { html, usedUrl: url }
    } catch (e) {
      lastError = e
      logger.warn(`入口 ${url} 抓取失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }
  throw lastError ?? new Error('所有入口 URL 均不可用')
}

// ── HTML 解析 ──────────────────────────────

/** 判断 URL 是否处于中文分区下 */
function isInChineseScope(url: string): boolean {
  return new URL(url).pathname.toLowerCase().split('/').includes('chinese')
}

/** 从入口页面解析分类列表 */
function parseCategories(baseHtmlUrl: string, html: string): CategoryItem[] {
  const $ = cheerio.load(html)
  const seen = new Map<string, CategoryItem>()

  $('a[href]').each((_index: number, el: AnyNode) => {
    const absUrl = resolveUrl(baseHtmlUrl, $(el).attr('href'))
    if (!absUrl || !isInChineseScope(absUrl) || isDirectFile(absUrl)) return

    // 将 HTML 页面链接规范化为目录
    let dirPath = new URL(absUrl).pathname
    if (!dirPath.endsWith('/')) {
      const last = dirPath.split('/').filter(Boolean).at(-1) ?? ''
      if (isHtmlPage(absUrl) || /^(index|default)\./i.test(last)) {
        dirPath = dirPath.substring(0, dirPath.lastIndexOf('/') + 1)
      }
    }
    if (!dirPath.endsWith('/')) dirPath += '/'

    // 过滤掉入口自身和浅层路径
    const segments = dirPath.split('/').filter(Boolean)
    if (segments.length < 2) return // 至少 /chinese/xxx/

    const finalUrl = new URL(dirPath, new URL(absUrl).origin).toString()
    if (finalUrl === baseHtmlUrl || !isInChineseScope(finalUrl)) return

    const title = cleanTitle($(el).text(), finalUrl)
    seen.set(finalUrl, { title, url: finalUrl })
  })

  return [...seen.values()].sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
}

/** 从分类页面解析文档列表 */
function parseDocuments(categoryUrl: string, html: string): DocumentItem[] {
  const $ = cheerio.load(html)
  const seen = new Map<string, DocumentItem>()
  const categoryPath = new URL(categoryUrl).pathname

  $('a[href]').each((_index: number, el: AnyNode) => {
    const url = resolveUrl(categoryUrl, $(el).attr('href'))
    if (!url || !isInChineseScope(url) || url === categoryUrl) return

    const parsed = new URL(url)
    // 只取当前分类路径下的直接子文件，不深入子目录
    if (!parsed.pathname.startsWith(categoryPath) || parsed.pathname.endsWith('/')) return

    // 排除指向其他分类目录下 index 页的链接（跨目录跳转）
    const relativePath = parsed.pathname.slice(categoryPath.length)
    if (relativePath.includes('/') && !isDirectFile(url)) return

    seen.set(url, {
      title: cleanTitle($(el).text(), url),
      url,
      isDirectFile: isDirectFile(url),
    })
  })

  return [...seen.values()].sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
}

// ── Crawler 对外 API ──────────────────────

export class Crawler {
  constructor(private config: CrawlConfig) {}

  /** 获取分类列表（带缓存） */
  async listCategories(): Promise<CategoryItem[]> {
    const cacheKey = this.config.entryUrls.join('|')
    const cached = await readCache<CategoryItem[]>(this.config.cacheDir, 'categories', cacheKey)
    if (cached?.length) return cached

    const { html, usedUrl } = await tryFetchEntry(this.config.entryUrls, this.config.navigationTimeout)
    const categories = parseCategories(usedUrl, html)

    if (categories.length) {
      await writeCache(this.config.cacheDir, 'categories', cacheKey, categories, this.config.categoryCacheTtlMs)
    }
    return categories
  }

  /** 获取某分类下的文档列表（带缓存） */
  async listDocuments(categoryUrl: string): Promise<DocumentItem[]> {
    const cached = await readCache<DocumentItem[]>(this.config.cacheDir, 'documents', categoryUrl)
    if (cached?.length) return cached

    const html = await httpGet(categoryUrl, this.config.navigationTimeout)
    const documents = parseDocuments(categoryUrl, html)

    if (documents.length) {
      await writeCache(this.config.cacheDir, 'documents', categoryUrl, documents, this.config.documentCacheTtlMs)
    }
    return documents
  }
}
