#!/usr/bin/env node
/**
 * 生成 redquote 语录索引（一次性工具，不属于运行时）
 *
 * 用法：
 *   node scripts/crawl.mjs               全量爬取（6 个人物）
 *   node scripts/crawl.mjs --limit 1     只爬前 1 个人物（调试用）
 *
 * 数据源：
 *   - 中文维基语录（zh.wikiquote.org）：马克思、恩格斯、列宁、毛泽东、切·格瓦拉、斯大林
 *   - Marxists.org（英文）：马克思 130 条 + 恩格斯 30 条（权威，带出处）
 *
 * 产出：packages/redquote/assets/quote-index.json
 *
 * 过滤策略：
 *   - 跳过「衍生」「正误与异见」「存疑」等分区（Wikiquote 标注的不可靠内容）
 *   - 内容黑名单：反犹、种族歧视等攻击性语录（Wikiquote 收录了马克思/毛泽东的
 *     反犹书信、核战争言论等，不适合直接发送）
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const WIKI_BASE = 'https://zh.wikiquote.org/zh-cn';
const MARXISTS_BASE = 'https://www.marxists.org';
const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TIMEOUT = 20000;
const RETRY = 2;

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'quote-index.json');

// ── 人物清单 ──────────────────────────────────────────────

/** 中文维基语录页标题 → 作者信息 */
const WIKI_PERSONS = [
    { id: 'marx', name: '卡尔·马克思', nameEn: 'Karl Marx', page: '卡尔·马克思' },
    {
        id: 'engels',
        name: '弗里德里希·恩格斯',
        nameEn: 'Friedrich Engels',
        page: '弗里德里希·恩格斯',
    },
    { id: 'lenin', name: '列宁', nameEn: 'Vladimir Lenin', page: '列宁' },
    { id: 'mao', name: '毛泽东', nameEn: 'Mao Zedong', page: '毛泽东' },
    { id: 'che', name: '切·格瓦拉', nameEn: 'Che Guevara', page: '切·格瓦拉' },
    { id: 'stalin', name: '约瑟夫·斯大林', nameEn: 'Joseph Stalin', page: '约瑟夫·斯大林' },
];

/** Marxists.org 英文语录页：作者 id → URL */
const MARXISTS_QUOTES = [{ id: 'marx', url: '/archive/marx/works/subject/quotes' }];

// ── 敏感内容过滤 ──────────────────────────────────────────

/**
 * 内容黑名单（正则）：匹配到即丢弃整条语录。
 * 涵盖反犹、种族歧视、人身攻击等不适合直接发送的内容。
 */
const SENSITIVE_PATTERNS = [
    /犹太人|犹太教|jew|antisemit|反犹/i,
    /黑鬼|尼格罗|nigger|negro/i,
    /阉割|割礼|circumcis/i,
    /暴君背后|耶稣会士来扼杀思想/i,
];

/** 需要跳过的 Wikiquote 分区标题（不可靠内容） */
const SKIP_SECTIONS = ['衍生', '正误与异见', '存疑', '误传', '关于', '参见', '外部链接'];

// ── 工具 ──────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function httpGet(url) {
    for (let attempt = 0; attempt <= RETRY; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT);
        try {
            const res = await fetch(url, {
                signal: controller.signal,
                redirect: 'follow',
                headers: {
                    'User-Agent': UA,
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
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

/** 清理 HTML 片段为纯文本（合并空白） */
function cleanText(node) {
    return (node.text() ?? '').replace(/\s+/g, ' ').trim();
}

/** 判断语录文本是否命中敏感黑名单 */
function isSensitive(text) {
    return SENSITIVE_PATTERNS.some((re) => re.test(text));
}

// ── 中文维基语录 ──────────────────────────────────────────

/**
 * 解析维基语录页面：
 * - 按 h2 分节，跳过 SKIP_SECTIONS
 * - 每节下的 li 条目即语录（文本可能跨多行，含出处）
 * - 文本中形如「——出处」的后缀拆分为 source 字段
 */
function parseWikiquotePage(html) {
    const $ = cheerio.load(html);
    const quotes = [];
    let currentSection = '';

    // 只解析主内容区（排除侧边栏/页脚导航）
    const content = $('#mw-content-text');
    if (!content.length) return quotes;

    // 按文档顺序遍历 h2 和 li
    content.find('h2, li').each((_, el) => {
        if (el.tagName === 'h2') {
            currentSection = $(el).text().trim();
            return;
        }
        if (currentSection === '目录') return;
        if (SKIP_SECTIONS.some((s) => currentSection.includes(s))) return;

        const raw = cleanText($(el));
        if (!raw || raw.length < 6) return;
        if (raw.startsWith('衍生') || raw.startsWith('参见')) return;
        // 过滤非语录的界面文字
        if (/^(上传|关于|查看|编辑|分类|访问|创建|登录)/.test(raw)) return;

        // 拆出处：末尾的「——xxx」或「—— xxx」或「——」结尾的引用
        let text = raw;
        let source;
        const m = text.match(/[—-]{1,2}\s*(.+)$/);
        if (m && m[1].length > 1) {
            source = m[1].trim();
            text = text.substring(0, m.index).trim();
        }

        if (!text) return;
        if (isSensitive(text + (source ?? ''))) return;
        quotes.push({ text, source });
    });

    return quotes;
}

/** 抓取单个人物的中文维基语录页 */
async function crawlWikiPerson(person) {
    const url = `${WIKI_BASE}/${encodeURIComponent(person.page)}`;
    const html = await httpGet(url);
    const quotes = parseWikiquotePage(html);
    console.log(`  [${person.id}] 维基语录 ${quotes.length} 条`);
    return quotes.map((q) => ({ author: person.id, ...q, lang: 'zh' }));
}

// ── Marxists.org（英文） ──────────────────────────────────

/**
 * 解析 Marxists 英文语录页：
 * - 语录文本后跟 "Marx, [来源](链接) (年份)" 或 "Engels, ..."
 * - 文本与来源在同一段落，用 cheerio 取 p/div 文本，按 "Marx," / "Engels," 拆分
 */
function parseMarxistsPage(html) {
    const $ = cheerio.load(html);
    const quotes = [];
    const authorNames = { Marx: 'marx', Engels: 'engels' };

    $('p').each((_, el) => {
        const raw = cleanText($(el));
        if (!raw || raw.length < 8) return;

        // 匹配末尾的 "Marx, [Source] (year)" 或 "Engels, ..."
        const m = raw.match(/(?:^|\s)(Marx|Engels),\s*(.+)$/);
        if (!m) return;

        const authorId = authorNames[m[1]];
        if (!authorId) return;
        const text = raw.substring(0, m.index).trim();
        if (!text) return;

        // 清理来源中的链接残留
        const source = m[2].replace(/\s+/g, ' ').trim();
        if (isSensitive(`${text} ${source}`)) return;
        quotes.push({ author: authorId, text, source, lang: 'en' });
    });

    return quotes;
}

async function crawlMarxists() {
    const all = [];
    for (const item of MARXISTS_QUOTES) {
        const url = `${MARXISTS_BASE}${item.url}`;
        const html = await httpGet(url);
        const quotes = parseMarxistsPage(html);
        console.log(`  [${item.id}] Marxists ${quotes.length} 条`);
        all.push(...quotes);
        await sleep(300);
    }
    return all;
}

// ── 主流程 ────────────────────────────────────────────────

async function main() {
    const limit = process.argv.includes('--limit')
        ? Number(process.argv[process.argv.indexOf('--limit') + 1])
        : Infinity;

    const persons = limit === Infinity ? WIKI_PERSONS : WIKI_PERSONS.slice(0, limit);
    console.log(`开始爬取 ${persons.length} 个人物的中文维基语录…`);
    const quotes = [];

    for (const person of persons) {
        try {
            quotes.push(...(await crawlWikiPerson(person)));
        } catch (e) {
            console.warn(`  [${person.id}] 维基语录抓取失败: ${e.message}，跳过`);
        }
        await sleep(300);
    }

    // Marxists 英文（仅全量时抓）
    if (limit === Infinity) {
        console.log('抓取 Marxists.org 英文语录…');
        try {
            quotes.push(...(await crawlMarxists()));
        } catch (e) {
            console.warn(`  Marxists 抓取失败: ${e.message}，跳过`);
        }
    }

    // 按作者统计
    const byAuthor = {};
    for (const q of quotes) {
        byAuthor[q.author] = (byAuthor[q.author] ?? 0) + 1;
    }

    const index = {
        source: { wikiquote: WIKI_BASE, marxists: MARXISTS_BASE },
        generated: new Date().toISOString(),
        authors: WIKI_PERSONS.map((p) => ({
            id: p.id,
            name: p.name,
            nameEn: p.nameEn,
        })),
        quotes,
    };

    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(index, null, 1), 'utf-8');
    console.log(
        `\n完成：共 ${quotes.length} 条语录，按作者：${Object.entries(byAuthor)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ')}`
    );
    console.log(`索引已写入 ${OUT}`);
}

main().catch((e) => {
    console.error('爬取失败:', e);
    process.exit(1);
});
