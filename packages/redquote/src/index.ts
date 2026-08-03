import type { Context, Session } from 'koishi';
import { Schema, Service } from 'koishi';
import { countByAuthor, filterQuotes, listAuthors, loadIndex, setSensitiveFilter } from './catalog';
import type { AuthorEntry, QuoteEntry, QuoteFilter } from './types';

export const name = 'redquote';

export const usage = `
<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">📖 使用说明</h2>
  <p>📜 发送「红色语录」即可随机收到一条革命导师语录</p>
  <p>📚 语录来自 <a href="https://zh.wikiquote.org" style="color:#4a6ee0;">中文维基语录</a> 与 <a href="https://www.marxists.org" style="color:#4a6ee0;">Marxists.org</a>，收录马克思、恩格斯、列宁、毛泽东、切·格瓦拉、斯大林 6 位人物，中英双语共 1200+ 条，索引随包发布</p>
  <p>🛡️ 默认开启<strong>敏感内容过滤器</strong>，过滤文革/江青/四人帮/习近平等敏感内容，可在插件配置中关闭</p>
  <p>🔌 注入 <code>redquote</code> 服务，其他插件可通过 <code>ctx.redquote</code> 调用</p>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #e0574a;">⚡ 命令</h2>
  <ul>
    <li><code>红色语录 [作者] [数量]</code> — 随机获取语录，可按作者（如「红色语录 毛泽东」）和数量（如「红色语录 3」）筛选</li>
    <li><code>红色语录列表</code> — 查看所有作者及语录数量</li>
  </ul>
  <h3 style="color: #e0574a;">🔌 服务 API</h3>
  <ul>
    <li><code>ctx.redquote.random(筛选?)</code> — 随机一条语录</li>
    <li><code>ctx.redquote.pick(n, 筛选?)</code> — 随机 n 条语录</li>
    <li><code>ctx.redquote.list(筛选?)</code> — 列出匹配语录</li>
    <li><code>ctx.redquote.authors()</code> — 列出作者</li>
    <li><code>ctx.redquote.send(session, 筛选?)</code> — 直接发送一条语录</li>
  </ul>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #e0574a;">💬 交流与反馈</h2>
  <p>🌟 喜欢这个插件？欢迎加入 QQ 群 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#e0574a;text-decoration:none;"><strong>1071284605</strong></a>【晓基地插件工坊】进行交流</p>
  <p>🐛 遇到问题？欢迎在群内反馈，或点击 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#e0574a;text-decoration:none;">此链接</a> 加入群聊</p>
</div>
`;

export interface Config {
    /** 每次随机抽取的条数 */
    count: number;
    /** 是否显示语录出处 */
    showSource: boolean;
    /** 是否过滤国内平台敏感内容（文革/江青/四人帮/习近平等） */
    filterSensitive: boolean;
}

export const Config: Schema<Config> = Schema.object({
    count: Schema.number().default(1).min(1).description('每次随机抽取的条数'),
    showSource: Schema.boolean().default(true).description('是否显示语录出处'),
    filterSensitive: Schema.boolean()
        .default(true)
        .description('敏感内容过滤器：过滤文革/江青/四人帮/习近平等敏感语录'),
});

// ── Service ──────────────────────────────────────────────

export class RedquoteService extends Service {
    constructor(ctx: Context) {
        super(ctx, 'redquote', true);
    }

    /** 随机一条语录（未命中返回 null） */
    random(filter?: QuoteFilter): QuoteEntry | null {
        const pool = filterQuotes(filter);
        if (!pool.length) return null;
        return pool[Math.floor(Math.random() * pool.length)] ?? null;
    }

    /** 随机 n 条语录（不重复） */
    pick(n: number, filter?: QuoteFilter): QuoteEntry[] {
        const pool = filterQuotes(filter);
        const result: QuoteEntry[] = [];
        const used = new Set<number>();
        while (result.length < n && used.size < pool.length) {
            const i = Math.floor(Math.random() * pool.length);
            if (used.has(i)) continue;
            used.add(i);
            result.push(pool[i]);
        }
        return result;
    }

    /** 列出匹配语录 */
    list(filter?: QuoteFilter): QuoteEntry[] {
        return filterQuotes(filter);
    }

    /** 列出作者 */
    authors(): AuthorEntry[] {
        return listAuthors();
    }

    /** 将语录格式化为可发送文本 */
    format(quote: QuoteEntry, showSource = true): string {
        const author = listAuthors().find((a) => a.id === quote.author);
        const name = author?.name ?? quote.author;
        const source = showSource && quote.source ? `\n——${quote.source}` : '';
        return `「${quote.text}」\n——${name}${source}`;
    }

    /** 直接发送一条随机语录 */
    async send(session: Session, filter?: QuoteFilter): Promise<boolean> {
        const quote = this.random(filter);
        if (!quote) return false;
        await session.send(this.format(quote));
        return true;
    }
}

declare module 'koishi' {
    interface Context {
        redquote: RedquoteService;
    }
}

// ── 插件入口 ──────────────────────────────────────────────

export function apply(ctx: Context, config: Config) {
    ctx.plugin(RedquoteService);
    setSensitiveFilter(config.filterSensitive);

    // 启动时校验索引可用，尽早暴露数据问题
    loadIndex();

    // ── 红色语录 ──────────────────────────────────────

    ctx.command('红色语录 [作者:text] [数量:number]', '随机获取革命导师语录')
        .alias('红语录')
        .usage(
            '直接输入「红色语录」随机一条；输入「红色语录 毛泽东」按作者；' +
                '输入「红色语录 3」取 3 条；支持「红色语录 毛泽东 2」组合'
        )
        .example('红色语录')
        .example('红色语录 毛泽东')
        .example('红色语录 3')
        .example('红色语录 列宁 2')
        .action(async ({ session }, author, count) => {
            if (!session?.userId) return;

            // 解析：作者可能是数字（数量），也可能是名字
            let authorName: string | undefined;
            let n = config.count;
            if (author && /^\d+$/.test(author)) {
                n = Number(author);
            } else if (author) {
                authorName = author;
            }
            if (count) n = count;

            const filter: QuoteFilter | undefined = authorName ? { author: authorName } : undefined;
            const pool = ctx.redquote.list(filter);
            if (!pool.length) {
                return authorName
                    ? `未找到作者「${authorName}」的语录，试试「红色语录列表」`
                    : '暂无可用语录';
            }

            const quotes = ctx.redquote.pick(Math.min(n, pool.length), filter);
            if (!quotes.length) return '暂无可用语录';
            return quotes.map((q) => ctx.redquote.format(q, config.showSource)).join('\n\n');
        });

    // ── 红色语录列表 ──────────────────────────────────

    ctx.command('红色语录列表', '查看所有作者及语录数量')
        .alias('红色语录list')
        .action(({ session }) => {
            if (!session) return;
            const authors = listAuthors();
            if (!authors.length) return '暂无可用语录';
            const counts = countByAuthor();
            const lines = authors.map((a) => {
                const n = counts.get(a.id) ?? 0;
                return `- ${a.name}（${a.nameEn}）：${n} 条`;
            });
            return `共 ${authors.length} 位作者：\n${lines.join('\n')}`;
        });
}
