import type { Context, Session } from 'koishi';
import { Schema, Service } from 'koishi';
import { countByTheme, filterPosters, listThemes, loadIndex } from './catalog';
import {
    buildImageElement,
    clearCache,
    ensureImage,
    getCacheDir,
    isCacheReady,
    setCacheDir,
} from './downloader';
import type { PosterEntry, PosterFilter, RandomOutcome, ThemeEntry } from './types';

export const name = 'redposter';

export const usage = `
<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">📖 使用说明</h2>
  <p>🖼️ 发送「红色海报」即可随机收到一张中国社会主义宣传画海报图片</p>
  <p>🗂️ 海报数据来自 <a href="https://chineseposters.net" style="color:#4a6ee0;">chineseposters.net</a>（Stefan Landsberger 的中国宣传画收藏站），索引随包发布，图片按需下载缓存到本地 <code>data/redposter/</code></p>
  <p>🔤 支持中文别名（大跃进、文革、雷锋、毛主席…）与英文关键词（leap、mao、leifeng…），也支持按年份（如 1958）筛选</p>
  <p>🔌 注入 <code>redposter</code> 服务，其他插件可通过 <code>ctx.redposter</code> 调用</p>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #e0574a;">⚡ 命令</h2>
  <ul>
    <li><code>红色海报 [关键词]</code> — 随机发送一张海报，或按主题/关键词筛选（如「红色海报 大跃进」）</li>
    <li><code>红色海报列表 [关键词]</code> — 查看所有可用主题及海报数量</li>
    <li><code>红色海报重载</code> — 清空图片缓存（需 2 级权限）</li>
  </ul>
  <h3 style="color: #e0574a;">🔌 服务 API</h3>
  <ul>
    <li><code>ctx.redposter.random(筛选?)</code> — 随机选取一张并下载图片，返回 image 元素</li>
    <li><code>ctx.redposter.pick(筛选?)</code> — 精确选取一张，返回 image 元素</li>
    <li><code>ctx.redposter.list(筛选?)</code> — 列出匹配海报的元数据（不下载图片）</li>
    <li><code>ctx.redposter.themes(关键词?)</code> — 列出主题</li>
    <li><code>ctx.redposter.send(session, 筛选?)</code> — 直接发送一张海报</li>
  </ul>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #e0574a;">💬 交流与反馈</h2>
  <p>🌟 喜欢这个插件？欢迎加入 QQ 群 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#e0574a;text-decoration:none;"><strong>1071284605</strong></a>【晓基地插件工坊】进行交流</p>
  <p>🐛 遇到问题？欢迎在群内反馈，或点击 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#e0574a;text-decoration:none;">此链接</a> 加入群聊</p>
</div>
`;

export interface Config {
    /** 发送海报冷却时间（秒） */
    cooldown: number;
    /** 发图前是否显示海报标题 */
    showTitle: boolean;
}

export const Config: Schema<Config> = Schema.object({
    cooldown: Schema.number().default(30).min(0).description('发送海报冷却时间（秒）'),
    showTitle: Schema.boolean().default(true).description('发图前是否显示海报标题'),
});

// ── Service ──────────────────────────────────────────────

export class RedPosterService extends Service {
    constructor(ctx: Context) {
        super(ctx, 'redposter', true);
    }

    /**
     * 按关键词/主题随机选取一张海报，下载图片并返回 image 元素。
     * 未命中或下载失败时 hit=false。
     */
    async random(filter?: PosterFilter): Promise<RandomOutcome> {
        const pool = filterPosters(filter);
        if (!pool.length) {
            this.ctx.logger('redposter').warn('没有匹配的海报 (filter=%j)', filter);
            return { hit: false };
        }
        const entry = pool[Math.floor(Math.random() * pool.length)];
        const filePath = await ensureImage(this.ctx, entry);
        if (!filePath) return { hit: false };
        const image = buildImageElement(filePath);
        if (!image) return { hit: false };
        return { hit: true, entry, image };
    }

    /** 精确选取一张海报（命中范围内随机），返回 image 元素 */
    async pick(filter?: PosterFilter): Promise<{ entry: PosterEntry; image: string } | null> {
        const result = await this.random(filter);
        if (!result.hit) return null;
        return { entry: result.entry, image: result.image };
    }

    /** 列出匹配海报的元数据（不下载图片） */
    list(filter?: PosterFilter): PosterEntry[] {
        return filterPosters(filter);
    }

    /** 列出主题（支持关键词过滤） */
    themes(keyword?: string): ThemeEntry[] {
        return listThemes(keyword);
    }

    /** 按筛选直接发送一张海报 */
    async send(session: Session, filter?: PosterFilter): Promise<boolean> {
        const result = await this.random(filter);
        if (!result.hit) return false;
        await session.send(result.image);
        return true;
    }
}

declare module 'koishi' {
    interface Context {
        redposter: RedPosterService;
    }
}

// ── 插件入口 ──────────────────────────────────────────────

export function apply(ctx: Context, config: Config) {
    ctx.plugin(RedPosterService);

    // 启动时校验索引可用，尽早暴露数据问题
    loadIndex();

    const cacheDir = getCacheDir(ctx);
    setCacheDir(cacheDir);

    const cooldowns = new Map<string, number>();
    function checkCooldown(userId: string): number {
        const now = Date.now();
        const remaining = config.cooldown * 1000 - (now - (cooldowns.get(userId) ?? 0));
        return Math.max(0, remaining);
    }

    // ── 红色海报 ──────────────────────────────────────

    ctx.command('红色海报 [关键词:text]', '随机发送一张中国宣传画海报，或按主题/关键词筛选')
        .alias('红海报')
        .usage(
            '直接输入「红色海报」随机发送一张；输入「红色海报 大跃进」按主题筛选；' +
                '支持中文别名与英文关键词，也支持年份（如 1958）'
        )
        .example('红色海报')
        .example('红色海报 大跃进')
        .example('红色海报 leap')
        .example('红色海报 1958')
        .action(async ({ session }, keyword) => {
            if (!session?.userId) return;

            if (!isCacheReady()) {
                return '海报缓存尚未就绪，请稍后再试';
            }

            const remaining = checkCooldown(session.userId);
            if (remaining > 0) {
                return `请等待 ${(remaining / 1000).toFixed(0)} 秒后再发送`;
            }

            const raw = keyword?.trim();
            const filter: PosterFilter | undefined = raw ? { keyword: raw } : undefined;
            const result = await ctx.redposter.random(filter);
            if (!result.hit) {
                return raw
                    ? `未找到与「${raw}」相关的海报，试试「红色海报列表」查看可用主题`
                    : '暂无可用海报';
            }

            cooldowns.set(session.userId, Date.now());

            const entry = result.entry;
            const parts: string[] = [];
            if (config.showTitle) {
                const year = entry.year ? `（${entry.year}）` : '';
                parts.push(`🖼️ ${entry.title}${year}`);
            }
            parts.push(result.image);
            await session.send(parts.join('\n'));
        });

    // ── 红色海报列表 ──────────────────────────────────

    ctx.command('红色海报列表 [关键词:text]', '查看所有可用主题及海报数量')
        .alias('红色海报list')
        .action(({ session }, keyword) => {
            if (!session) return;

            const themes = listThemes(keyword?.trim());
            if (!themes.length) {
                return keyword ? `未找到匹配「${keyword.trim()}」的主题` : '暂无可用主题';
            }

            const counts = countByTheme();
            const groups = new Map<string, ThemeEntry[]>();
            for (const t of themes) {
                const list = groups.get(t.category) ?? [];
                list.push(t);
                groups.set(t.category, list);
            }

            const lines: string[] = [];
            for (const [category, items] of groups) {
                lines.push(`【${category}】`);
                for (const t of items) {
                    lines.push(`- ${t.name} [${counts.get(t.id) ?? 0}]`);
                }
            }

            const note = keyword
                ? ''
                : '\n\n输入「红色海报 <主题>」可发送该主题的海报，如「红色海报 大跃进」';
            return `共 ${themes.length} 个主题：\n${lines.join('\n')}${note}`;
        });

    // ── 红色海报重载（管理员） ────────────────────────

    ctx.command('红色海报重载', '清空海报图片缓存（管理员）')
        .alias('红色海报reload')
        .userFields(['authority'])
        .action(async ({ session }) => {
            if (!session) return;
            const user = session.user as { authority?: number } | undefined;
            if ((user?.authority ?? 0) < 2) {
                return '权限不足，需要 2 级及以上权限';
            }
            clearCache();
            return '海报图片缓存已清空，下次发送时会重新下载';
        });
}
