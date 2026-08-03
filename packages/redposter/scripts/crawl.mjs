#!/usr/bin/env node
/**
 * 生成 redposter 海报索引（一次性工具，不属于运行时）
 *
 * 用法：
 *   node scripts/crawl.mjs              全量爬取（所有主题）
 *   node scripts/crawl.mjs --limit 5    只爬前 5 个主题（调试用）
 *
 * 数据源：https://chineseposters.net（Stefan Landsberger 的中国宣传画收藏站）
 * 产出：packages/redposter/assets/poster-index.json
 *
 * 说明：
 * - 目标站为服务端渲染，普通 HTTP + cheerio 即可解析，无需浏览器。
 * - 爬取遵循 robots.txt 许可；请求带 UA、限并发、加间隔，避免给站点压力。
 * - 海报元数据（标题/年份/主题）来自主题页 img 标签的 alt 与 src，无需进详情页。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const BASE = "https://chineseposters.net";
const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const CONCURRENCY = 4;
const REQUEST_DELAY = 200;
const RETRY = 2;
const TIMEOUT = 20000;

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "assets", "poster-index.json");

// ── 国内平台敏感主题（不进入索引，双保险） ──
// 即使运行时 filterSensitive 被关闭，这些主题的海报也不会出现在索引中。
const EXCLUDED_THEMES = [
    "falun-gong", // 法轮功
    "peoples-movement-1989", // 六四（1989 人民运动）
    "democracy-freedom-1989", // 八九民主与自由系列
    "zhaoziyang", // 赵紫阳
    "umbrella-movement", // 占中（2014）
    "christian-crimes", // 批判天主教（宗教敏感）
    "eradicate-evil-cults", // 取缔邪教（海报标题含法轮功）
    "political-reform", // 政治改革（含占中海报）
];

/** 标题敏感词黑名单：即使海报属于保留主题，标题含这些词也剔除（跨主题兜底） */
const TITLE_BLOCKLIST = [/falun/i, /umbrella movement/i];

// ── 中文别名 → 主题 slug（人工精选，脚本会校验 slug 是否存在） ──

const ALIASES = {
    大跃进: "great-leap-forward",
    人民公社: "great-leap-forward",
    文化大革命: "cultural-revolution-campaigns",
    文革: "cultural-revolution-campaigns",
    学雷锋: "leifeng",
    雷锋: "leifeng",
    毛泽东: "mao-cult",
    毛主席: "mao-cult",
    语录: "mao-quotations",
    毛语录: "mao-quotations",
    长征: "long-march",
    抗日战争: "second-sino-japanese-war",
    门神: "door-gods",
    年画: "new-year-prints",
    妇女: "women",
    国庆: "1-october",
    十一: "1-october",
    解放军: "pla",
    人民解放军: "pla",
    白求恩: "bethune",
    列宁: "lenin",
    马克思: "marx",
    邓小平: "dengxiaoping",
    周恩来: "zhouenlai",
    周总理: "zhouenlai",
    蒋介石: "chiang-kai-shek",
    四人帮: "gang-of-four",
    江青: "jiangqing",
    计划生育: "population-policy",
    大寨: "dazhai-study",
    学大寨: "dazhai-study",
    王进喜: "wangjinxi",
    张海迪: "zhanghaidi",
    中国梦: "chinese-dream",
    习近平: "xijinping",
    经济特区: "special-economic-zones",
    香港回归: "hong-kong-handover",
    澳门: "macao",
    台湾: "taiwan-reunification",
    环保: "environment",
    回收: "recycling",
    体育: "sports",
    乒乓球: "table-tennis",
    航天: "space-program",
    卫生: "hygiene",
    老人: "elderly",
    抗洪: "floods",
    地震: "earthquakes",
    中苏友好: "sino-soviet-cooperation",
    苏联: "soviet-union",
    样板戏: "model-operas",
    沙家浜: "shajiabang",
    智取威虎山: "taking-tiger-mountain",
    龙江颂: "longjiang-song",
    雷锋日: "leifeng",
    铁人: "wangjinxi",
};

// ── 工具 ──────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function httpGet(url) {
    for (let attempt = 0; attempt <= RETRY; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT);
        try {
            const res = await fetch(url, {
                signal: controller.signal,
                redirect: "follow",
                headers: {
                    "User-Agent": UA,
                    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.text();
        } catch (e) {
            if (attempt < RETRY) {
                console.warn(`  重试 ${url} (${e.message})`);
                await sleep(1000 * (attempt + 1));
            } else {
                throw e;
            }
        } finally {
            clearTimeout(timer);
        }
    }
}

/** 解析海报 alt 文本为 { title, year } */
function parseAlt(alt) {
    const text = (alt ?? "").trim();
    if (!text) return { title: "", year: undefined };
    // "Title, 1959" / "Title, ca. 1960"
    let m = text.match(/^(.+?),\s*(?:ca\.?\s*)?((?:19|20)\d{2})$/);
    if (m) return { title: m[1].trim(), year: Number(m[2]) };
    // "Title (1958, February)" / "Title (ca. 1960)"
    m = text.match(/^(.+?)\s*\(\s*(?:ca\.?\s*)?((?:19|20)\d{2})[^)]*\)$/);
    if (m) return { title: m[1].trim(), year: Number(m[2]) };
    return { title: text, year: undefined };
}

// ── 主题索引 ──────────────────────────────────────────────

/** 从 /themes/index 解析全部主题（含分类） */
async function fetchThemes() {
    console.log("抓取主题索引页…");
    const html = await httpGet(`${BASE}/themes/index`);
    const $ = cheerio.load(html);
    const themes = [];
    const seen = new Set();
    let category = "未分类";

    // 按文档顺序遍历：<strong> 是分类标题，其后跟主题文本链接
    $("body")
        .find("strong, a[href]")
        .each((_, el) => {
            if (el.tagName === "strong") {
                category = $(el).text().trim() || category;
                return;
            }
            const href = $(el).attr("href");
            const text = $(el).text().trim();
            if (!href || !text) return;
            if (href.startsWith("/") || href.startsWith("http") || href.startsWith("#")) return;
            const resolved = new URL(href, `${BASE}/themes/index`);
            const path = resolved.pathname;
            if (!path.startsWith("/themes/")) return;
            const slug = path.replace(/^\/themes\//, "").replace(/\/+$/, "");
            if (!slug || seen.has(slug)) return;
            // 排除国内平台敏感主题
            if (EXCLUDED_THEMES.includes(slug)) {
                console.log(`  跳过敏感主题: ${slug}`);
                return;
            }
            seen.add(slug);
            themes.push({ id: slug, name: text, category });
        });

    console.log(`共发现 ${themes.length} 个主题`);
    return themes;
}

// ── 主题页 → 海报 ─────────────────────────────────────────

/** 抓取单个主题页（含分页），返回该主题下所有海报 */
async function crawlTheme(theme) {
    const posters = new Map(); // id -> entry

    async function fetchPage(page) {
        const url =
            page === 0 ? `${BASE}/themes/${theme.id}` : `${BASE}/themes/${theme.id}?page=${page}`;
        const html = await httpGet(url);
        const $ = cheerio.load(html);

        let maxPage = 0;
        $("a[href]").each((_, el) => {
            const href = $(el).attr("href");
            const m = href?.match(/[?&]page=(\d+)/);
            if (m) maxPage = Math.max(maxPage, Number(m[1]));
        });

        $("img[src]").each((_, el) => {
            const src = $(el).attr("src");
            if (!src) return;
            const abs = new URL(src, `${BASE}/themes/${theme.id}`).href;
            const m = abs.match(
                /\/sites\/default\/files\/(?:styles\/[^/]+\/public\/)?images\/([^/?#]+)/,
            );
            if (!m) return;
            const filename = m[1];
            const id = filename.replace(/\.[a-z0-9]+$/i, "");
            if (!id) return;

            const { title, year } = parseAlt($(el).attr("alt"));
            // 标题含敏感词（跨主题兜底）：法轮功、占中等
            if (TITLE_BLOCKLIST.some((re) => re.test(title))) return;
            const existing = posters.get(id);
            if (existing) {
                if (!existing.themes.includes(theme.id)) existing.themes.push(theme.id);
                if (!existing.title && title) existing.title = title;
                if (existing.year === undefined && year !== undefined) existing.year = year;
                return;
            }
            posters.set(id, {
                id,
                title,
                year,
                image: `/sites/default/files/images/${filename}`,
                page: `/posters/${id}`,
                themes: [theme.id],
            });
        });

        return maxPage;
    }

    const maxPage = await fetchPage(0);
    for (let p = 1; p <= maxPage; p++) {
        await fetchPage(p);
        await sleep(REQUEST_DELAY);
    }
    return [...posters.values()];
}

// ── 并发控制 ──────────────────────────────────────────────

async function mapLimit(items, limit, worker) {
    const results = new Array(items.length);
    let next = 0;
    async function run() {
        while (next < items.length) {
            const i = next++;
            results[i] = await worker(items[i]);
            await sleep(REQUEST_DELAY);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
    return results;
}

// ── 主流程 ────────────────────────────────────────────────

async function main() {
    const limit = process.argv.includes("--limit")
        ? Number(process.argv[process.argv.indexOf("--limit") + 1])
        : Infinity;

    const themes = await fetchThemes();
    const targets = limit === Infinity ? themes : themes.slice(0, limit);

    console.log(`开始爬取 ${targets.length} 个主题…`);
    const allPosters = await mapLimit(targets, CONCURRENCY, async (theme) => {
        try {
            const posters = await crawlTheme(theme);
            console.log(`  [${theme.id}] ${posters.length} 张海报`);
            return posters;
        } catch (e) {
            console.warn(`  [${theme.id}] 抓取失败: ${e.message}，跳过`);
            return [];
        }
    });

    // 合并、按 id 去重
    const posterMap = new Map();
    for (const list of allPosters) {
        for (const entry of list) {
            const existing = posterMap.get(entry.id);
            if (existing) {
                existing.themes = [...new Set([...existing.themes, ...entry.themes])];
            } else {
                posterMap.set(entry.id, entry);
            }
        }
    }
    const posters = [...posterMap.values()].sort((a, b) => a.id.localeCompare(b.id));

    // 校验别名
    const themeIds = new Set(themes.map((t) => t.id));
    const aliases = {};
    for (const [zh, slug] of Object.entries(ALIASES)) {
        if (themeIds.has(slug)) {
            aliases[zh] = slug;
        } else {
            console.warn(`别名「${zh}」指向不存在的主题 ${slug}，已忽略`);
        }
    }

    const index = {
        source: BASE,
        generated: new Date().toISOString(),
        themes,
        posters,
        aliases,
    };

    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(index, null, 1), "utf-8");
    console.log(
        `\n完成：${posters.length} 张海报、${themes.length} 个主题、${Object.keys(aliases).length} 个别名`,
    );
    console.log(`索引已写入 ${OUT}`);
}

main().catch((e) => {
    console.error("爬取失败:", e);
    process.exit(1);
});
