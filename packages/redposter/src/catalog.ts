import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Logger } from "koishi";
import type { PosterEntry, PosterFilter, PosterIndex, ThemeEntry } from "./types";

const logger = new Logger("redposter");

let _index: PosterIndex | null = null;

/**
 * 国内平台敏感主题 slug（启用 filterSensitive 时过滤）。
 * 由用户点名：习近平、文化大革命、江青、四人帮。
 * 注意：大跃进、人民公社等主题不在此列，不做过度过滤。
 */
const SENSITIVE_THEMES: string[] = [
    "xijinping", // 习近平
    "cultural-revolution-campaigns", // 文化大革命
    "jiangqing", // 江青
    "gang-of-four", // 四人帮
];

let _filterSensitive = true;

/** 由入口按配置设置是否过滤国内敏感主题 */
export function setSensitiveFilter(enabled: boolean): void {
    _filterSensitive = enabled;
}

function isSensitiveTheme(id: string): boolean {
    return SENSITIVE_THEMES.includes(id);
}

/** 过滤掉属于任何敏感主题的海报 */
function applySensitiveFilter(posters: PosterEntry[]): PosterEntry[] {
    if (!_filterSensitive) return posters;
    return posters.filter((p) => !p.themes.some((t) => isSensitiveTheme(t)));
}

/**
 * 定位并加载海报索引（assets/poster-index.json）。
 * 生产环境位于 <pkg>/lib/../assets/，开发环境位于 <pkg>/src/../assets/，
 * 二者在包根目录下，用同一相对路径即可。
 */
export function loadIndex(): PosterIndex {
    if (_index) return _index;

    const indexPath = resolve(__dirname, "..", "assets", "poster-index.json");
    if (!existsSync(indexPath)) {
        throw new Error(`redposter: 未找到索引文件 ${indexPath}，请先运行 scripts/crawl.mjs 生成`);
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _index = require(indexPath) as PosterIndex;
    logger.info("已加载 %d 张海报、%d 个主题", _index.posters.length, _index.themes.length);
    return _index;
}

/** 列出主题（支持关键词过滤：中文别名、主题名、slug） */
export function listThemes(keyword?: string): ThemeEntry[] {
    const index = loadIndex();
    const base = _filterSensitive
        ? index.themes.filter((t) => !isSensitiveTheme(t.id))
        : index.themes;
    if (!keyword) return base;

    const raw = keyword.trim();
    const kw = raw.toLowerCase();
    const aliasSlugs = new Set(
        Object.entries(index.aliases)
            .filter(([zh]) => zh.includes(raw))
            .map(([, slug]) => slug),
    );

    return base.filter(
        (t) => aliasSlugs.has(t.id) || t.id.includes(kw) || t.name.toLowerCase().includes(kw),
    );
}

/** 按筛选条件过滤海报 */
export function filterPosters(filter?: PosterFilter): PosterEntry[] {
    const index = loadIndex();
    let result = applySensitiveFilter(index.posters);
    if (!filter) return result;

    if (filter.themes?.length) {
        const themes = filter.themes;
        result = result.filter((p) => themes.every((t) => p.themes.includes(t)));
    }

    if (filter.keyword) {
        const raw = filter.keyword.trim();
        const kw = raw.toLowerCase();

        // 命中的主题集合：中文别名（子串）+ 主题 id/名称（不区分大小写）
        const matchedThemes = new Set<string>();
        for (const [zh, slug] of Object.entries(index.aliases)) {
            if (zh.includes(raw)) matchedThemes.add(slug);
        }
        for (const t of index.themes) {
            if (t.id.includes(kw) || t.name.toLowerCase().includes(kw)) matchedThemes.add(t.id);
        }

        // 纯数字年份：按出版年份精确匹配
        const year = /^\d{4}$/.test(raw) ? Number(raw) : undefined;

        result = result.filter((p) => {
            if (p.themes.some((t) => matchedThemes.has(t))) return true;
            if (p.title.toLowerCase().includes(kw)) return true;
            if (p.id.includes(kw)) return true;
            if (year !== undefined && p.year === year) return true;
            return false;
        });
    }

    return result;
}

/** 每个主题的海报数量（供列表命令展示） */
export function countByTheme(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const p of applySensitiveFilter(loadIndex().posters)) {
        for (const t of p.themes) {
            counts.set(t, (counts.get(t) ?? 0) + 1);
        }
    }
    return counts;
}
