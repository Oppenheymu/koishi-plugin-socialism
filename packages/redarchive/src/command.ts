import type { Context, Session } from 'koishi'
import { Logger } from 'koishi'
import { Crawler } from './crawler'
import { sendAsset } from './utils'
import type { Config } from './types'

const logger = new Logger('redarchive')

// ── 翻页交互 ──────────────────────────────

interface Pageable { title: string; url: string }

function pageText<T extends Pageable>(label: string, items: T[], page: number, pageSize: number): string {
  const total = items.length
  const totalPages = Math.ceil(total / pageSize)
  const start = page * pageSize
  const end = Math.min(start + pageSize, total)
  const lines = items.slice(start, end).map((it, i) => `${start + i + 1}. ${it.title}`)
  const nav = total > pageSize ? `  [${page + 1}/${totalPages}]` : ''
  return `--- ${label}列表 (${start + 1}-${end} / ${total})${nav} ---\n${lines.join('\n')}`
}

function pickOption<T extends Pageable>(input: string, options: T[]): T | null {
  const text = input.trim()
  if (!text) return null
  const idx = parseInt(text, 10) - 1
  if (!Number.isNaN(idx) && idx >= 0 && idx < options.length) return options[idx]
  const kw = text.toLowerCase()
  return options.find(o => o.title.toLowerCase().includes(kw) || o.url.toLowerCase().includes(kw)) ?? null
}

/**
 * 翻页式选择交互
 * - n / 下一页 → 下一页
 * - p / 上一页 → 上一页
 * - 编号 / 关键字 → 选择
 * - q → 取消
 */
async function askSelection<T extends Pageable>(
  session: Session, label: string, options: T[], config: Config,
): Promise<T | null> {
  if (!options.length) return null

  const pageSize = config.optionsChunkSize
  const totalPages = Math.ceil(options.length / pageSize)
  let page = 0

  // 显示首页
  await session.send(pageText(label, options, page, pageSize))

  while (true) {
    const hint = totalPages > 1
      ? '👉 输入编号/关键字选择，n下一页，p上一页，q取消'
      : '👉 输入编号或关键字选择，q取消'
    await session.send(hint)

    const input = await session.prompt(config.promptTimeoutMs)
    if (!input) { await session.send('⌛ 交互超时，已自动取消。'); return null }

    const cmd = input.trim().toLowerCase()

    // 取消
    if (cmd === 'q') { await session.send('🚫 已取消操作。'); return null }

    // 翻页
    if ((cmd === 'n' || cmd === '下一页') && page + 1 < totalPages) {
      page++
      await session.send(pageText(label, options, page, pageSize))
      continue
    }
    if ((cmd === 'p' || cmd === '上一页') && page > 0) {
      page--
      await session.send(pageText(label, options, page, pageSize))
      continue
    }

    // 选择
    const result = pickOption(input, options)
    if (result) return result

    await session.send('⚠️ 未能匹配，请输入编号/关键字，或 n/p 翻页。')
  }
}

// ── 命令注册 ──────────────────────────────

export function registerCommand(ctx: Context, config: Config): void {
  const crawler = new Crawler(config)
  const cooldownMap = new Map<string, number>()
  const activeChannels = new Set<string>()

  ctx.command('马克思', '抓取马克思主义文库文件并发送下载附件').alias('marxists')
    .action(async ({ session }) => {
      if (!session?.channelId || !session?.userId) return '当前上下文不支持会话交互。'

      const { userId, channelId } = session
      const now = Date.now()

      if (activeChannels.has(channelId)) return '⚠️ 当前频道已有正在进行的抓取任务，请稍后再试。'

      if (config.cooldownMs > 0) {
        const remain = config.cooldownMs - (now - (cooldownMap.get(userId) ?? 0))
        if (remain > 0) return `🕒 操作过于频繁，请 ${(remain / 1000).toFixed(1)} 秒后再试。`
      }

      activeChannels.add(channelId)
      cooldownMap.set(userId, now)

      try {
        await session.send('🔍 正在抓取分类，请稍候...')

        const categories = await crawler.listCategories()
        if (!categories.length) return '❌ 未找到可用分类，请检查网络或入口 URL。'

        const category = await askSelection(session, '分类', categories, config)
        if (!category) return

        await session.send(`📂 已选择分类：${category.title}\n正在读取文件列表...`)
        const documents = await crawler.listDocuments(category.url)
        if (!documents.length) return '该分类下没有可用文件。'

        const doc = await askSelection(session, '文件', documents, config)
        if (!doc) return

        await session.send(`📄 已选择：${doc.title}\n正在发送文件...`)
        await sendAsset(session, { title: doc.title, url: doc.url })
      } catch (e) {
        logger.error(`[Command Error] ${e}`)
        return `❌ 抓取过程中发生错误：${e instanceof Error ? e.message : '未知错误'}`
      } finally {
        activeChannels.delete(channelId)
      }
    })
}
