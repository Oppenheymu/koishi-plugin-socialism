import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Logger } from 'koishi';
import type { AuthorEntry, QuoteEntry, QuoteFilter, QuoteIndex } from './types';

const logger = new Logger('redquote');

let _index: QuoteIndex | null = null;

/**
 * 国内平台敏感内容关键词（启用 filterSensitive 时过滤）。
 * 与 redposter 的敏感过滤思路一致：聚焦习近平、文革、江青、四人帮等。
 */
const SENSITIVE_CONTENT = ['习近平', '文化大革命', '四人帮', '江青', '走资派', '斗私批修'];

let _filterSensitive = true;

/** 由入口按配置设置是否过滤敏感内容 */
export function setSensitiveFilter(enabled: boolean): void {
    _filterSensitive = enabled;
}

function isSensitive(quote: QuoteEntry): boolean {
    if (!_filterSensitive) return false;
    return SENSITIVE_CONTENT.some((kw) => quote.text.includes(kw));
}

/**
 * 定位并加载语录索引（assets/quote-index.json）。
 * 生产环境位于 <pkg>/lib/../assets/，开发环境位于 <pkg>/src/../assets/。
 */
export function loadIndex(): QuoteIndex {
    if (_index) return _index;

    const indexPath = resolve(__dirname, '..', 'assets', 'quote-index.json');
    if (!existsSync(indexPath)) {
        throw new Error(`redquote: 未找到索引文件 ${indexPath}，请先运行 scripts/crawl.mjs 生成`);
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _index = require(indexPath) as QuoteIndex;
    logger.info('已加载 %d 条语录、%d 位作者', _index.quotes.length, _index.authors.length);
    return _index;
}

/** 按作者名/id 解析作者 id（支持中英文名） */
function resolveAuthorId(keyword: string): string | null {
    const index = loadIndex();
    const kw = keyword.trim().toLowerCase();
    const hit = index.authors.find(
        (a) => a.id === kw || a.name === keyword.trim() || a.nameEn.toLowerCase() === kw
    );
    return hit?.id ?? null;
}

/** 列出作者（含语录数量） */
export function listAuthors(): AuthorEntry[] {
    return loadIndex().authors;
}

/** 按筛选条件过滤语录 */
export function filterQuotes(filter?: QuoteFilter): QuoteEntry[] {
    const index = loadIndex();
    let result = index.quotes.filter((q) => !isSensitive(q));

    if (!filter) return result;

    if (filter.author) {
        const authorId = resolveAuthorId(filter.author);
        if (!authorId) return [];
        result = result.filter((q) => q.author === authorId);
    }

    if (filter.lang) {
        result = result.filter((q) => q.lang === filter.lang);
    }

    if (filter.keyword) {
        const kw = filter.keyword.trim().toLowerCase();
        result = result.filter((q) => q.text.toLowerCase().includes(kw));
    }

    return result;
}

/** 每个作者的语录数量（供列表展示） */
export function countByAuthor(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const q of loadIndex().quotes) {
        if (isSensitive(q)) continue;
        counts.set(q.author, (counts.get(q.author) ?? 0) + 1);
    }
    return counts;
}
