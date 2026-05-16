import type { Context } from 'koishi'
import { randomPick, exactPick, listSongs } from './core'
import type { SongFilter } from './types'

export interface ListenConfig {
  /** 点歌冷却时间（秒） */
  cooldown: number
  /** 是否在语音前显示歌名 */
  showName: boolean
}

export function registerListenCommands(ctx: Context, config: ListenConfig) {
  const cooldowns = new Map<string, number>()

  function checkCooldown(userId: string): number {
    const now = Date.now()
    const last = cooldowns.get(userId) ?? 0
    const remaining = Math.max(0, config.cooldown * 1000 - (now - last))
    return remaining
  }

  function setCooldown(userId: string) {
    cooldowns.set(userId, Date.now())
  }

  // ── 红歌 ────────────────────────────────────────────

  ctx.command('红歌 [query:text]', '随机点一首红歌，或指定歌名')
    .alias('redmusic')
    .usage('直接输入"红歌"随机一首；输入"红歌 国际歌"指定歌名；输入"红歌 /纯曲"按标签筛选（/前缀表示标签）')
    .example('红歌')
    .example('红歌 国际歌')
    .example('红歌 /纯曲 /交响乐')
    .action(async ({ session }, query) => {
      if (!session?.userId) return

      // 冷却检查
      const remaining = checkCooldown(session.userId)
      if (remaining > 0) {
        return `请等待 ${(remaining / 1000).toFixed(0)} 秒后再点歌`
      }

      // 解析输入
      const tags: string[] = []
      let name: string | undefined

      if (query?.trim()) {
        const parts = query.trim().split(/\s+/)
        for (const part of parts) {
          if (part.startsWith('/')) {
            tags.push(part.slice(1))
          } else {
            name = part
          }
        }
      }

      // 选取歌曲
      let result: { entry: { name: string; tags: string[] }; audio: string } | null = null

      if (name) {
        // 指定歌名：精确选取
        const filter: SongFilter = { name }
        if (tags.length) filter.tags = tags
        const picked = exactPick(filter)
        if (picked) result = picked
      } else if (tags.length) {
        // 只有标签：按标签随机
        const picked = randomPick(1, { tags })
        if (picked.hit) result = picked
      } else {
        // 完全随机
        const picked = randomPick(1)
        if (picked.hit) result = picked
      }

      if (!result) {
        if (name) return `未找到歌曲"${name}"${tags.length ? `（标签: ${tags.join(', ')}）` : ''}`
        return '暂无可用歌曲'
      }

      // 设置冷却
      setCooldown(session.userId)

      // 发送
      const parts: string[] = []
      if (config.showName) {
        const tagStr = result.entry.tags.length ? ` [${result.entry.tags.join(', ')}]` : ''
        parts.push(`🎵 ${result.entry.name}${tagStr}`)
      }
      parts.push(result.audio)
      await session.send(parts.join('\n'))
    })

  // ── 红歌列表 ────────────────────────────────────────

  ctx.command('红歌列表', '查看所有可用红歌')
    .alias('红歌list')
    .action(({ session }) => {
      if (!session) return
      const songs = listSongs()

      if (!songs.length) return '暂无可用歌曲'

      // 按歌名分组（同名不同版本合并展示）
      const groups = new Map<string, string[]>()
      for (const s of songs) {
        const versions = groups.get(s.name) ?? []
        versions.push(s.tags.length ? `(${s.tags.join(', ')})` : '(原版)')
        groups.set(s.name, versions)
      }

      const lines = [...groups.entries()].map(([name, versions]) => {
        return `${name} ${versions.join(' ')}`
      })

      return `共 ${songs.length} 首歌曲：\n${lines.join('\n')}`
    })
}
