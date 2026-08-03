import * as cheerio from 'cheerio';
import type { AnyNode, Element as DomElement } from 'domhandler';

/**
 * 从 marxists.org 中文文库的「上古 HTML」（多为 GB2312 编码、<p>/<br> 混排）中
 * 提取正文并转成 Markdown。不同年代/来源的页面结构差异很大，没有统一的正文容器，
 * 因此采用「基于 body 顺序的通用提取」策略：
 *
 * 1. 丢弃首部导航（面包屑/相关链接）与尾部注释/页脚
 * 2. 保序遍历 body 的块级内容，过滤噪音（页内锚点 [n]、说明框等）
 * 3. <p>/<div>/<h1~h6>/<blockquote> 视为段落块，其余行内内容按 <br> 换行
 */

/** 需要被跳过的页内锚点链接（脚注引用/返回标记等） */
const ANCHOR_RE = /^\[\d+\]$|^\[\*\]$/;

/** 注释区块的起始标记（位于正文末尾，含「注释」「附注」等） */
const NOTE_START_RE = /^(注(释|解)?|附注|脚注|尾注)\s*$/;

/** 说明/编辑说明框（页面中由上传者添加，非原文） */
const EDITORIAL_RE = /^(说\s*明|编者按|编辑说明|按语|资料来源|出处说明|关于本文|整理说明)\s*[:：]?/;

/** 用于定位正文起点/终点的话题性标记（命中即截断） */
const TRAILER_RE =
    /^(上一篇|下一篇|下一章|上一章|返回目录|回到首页|版权所有|参考书目|读者评论|【关闭窗口】|阅读次数)/;

/** 头部导航标记：在第一个正文标题之前出现则跳过 */
const HEADER_LINK_RE = /^(中文马克思主义文库|马克思主义文库|回目录|首页|相关链接)/;

/**
 * 判断一个元素是否为「块级」元素（在 Markdown 中独占一行）。
 * 注：table 需要特殊处理，见 extractTableText。
 */
function isBlockTag(name: string): boolean {
    return /^(p|div|h[1-6]|blockquote|center|pre|table|ul|ol|li|tr|form|fieldset)$/.test(name);
}

/**
 * 将 HTML 元素转为 Markdown 文本。
 * - <br> → 换行
 * - 块级元素 → 段落
 * - <sup>/<sub> 保留原样（脚注引用会在后续被过滤）
 */
function htmlToText(el: DomElement): string {
    const parts: string[] = [];
    for (const child of el.children) {
        if (child.type === 'text') {
            parts.push(child.data);
        } else if (child.type === 'tag') {
            const tag = child.tagName.toLowerCase();
            if (tag === 'br') {
                parts.push('\n');
            } else if (isBlockTag(tag)) {
                // 块级元素内的文本递归处理
                parts.push('\n', htmlToText(child), '\n');
            } else {
                // 行内元素（b/strong/i/em/u/font/span/a 等）：只取文本
                parts.push(htmlToText(child));
            }
        } else if (child.type === 'comment') {
            parts.push('\n');
        }
    }
    return parts.join('');
}

/**
 * 归一化一段 HTML 文本：折叠空白、去除行首全角空格缩进。
 */
export function normalizeText(raw: string): string {
    return raw
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^[　 ]+/gm, '')
        .trim();
}

/**
 * 从整页 HTML 中提取正文的 Markdown。
 * @param html 已解码为字符串的 HTML
 * @returns Markdown 文本；若提取不到有效内容返回空字符串
 */
export function extractMarkdown(html: string): string {
    const $ = cheerio.load(html);
    const body = $('body').first();
    if (!body.length) return '';

    const paragraphs: string[] = [];

    // ── 第一阶段：按 body 顶层顺序，把非导航内容收集为候选块 ──
    // 我们遍历 body 的所有直接子节点（含文本节点），跳过首部导航与尾部注释。
    // 注意必须用 contents() 而非 children()：children() 会丢弃游离文本节点，
    // 而 mao2/mao4 这类旧页面的正文恰恰是 <br> 分隔的自由文本。
    const bodyChildren = body.contents().toArray() as AnyNode[];
    let started = false; // 是否已进入正文（遇到首个「有意义」内容）
    let inNotes = false; // 是否已进入注释区
    let pendingText = ''; // 累积的自由文本（<br> 分隔）

    /** 把累积的自由文本刷入段落列表 */
    const flushPending = () => {
        const text = normalizeText(pendingText);
        if (text) paragraphs.push(text);
        pendingText = '';
    };

    for (const node of bodyChildren) {
        if (node.type === 'text') {
            // 自由文本（如 mao2/mao4 中 <br> 分隔的正文）
            const text = node.data;
            if (text.trim() && started) pendingText += text;
            continue;
        }
        if (node.type !== 'tag') continue;

        const el = $(node);
        const tag = node.tagName.toLowerCase();

        // 跳过空块与纯空白
        const text = el.text();
        if (!text.trim()) continue;

        // ── 未进入正文时：识别头部导航并跳过 ──
        if (!started) {
            if (tag === 'a' || tag === 'font') {
                const t = normalizeText(text);
                if (HEADER_LINK_RE.test(t) || t.length <= 10) continue;
            }
            if (tag === 'hr' || tag === 'br') continue;
            // 第一个有意义的内容：可能是标题 <p>、简介 <blockquote>、或正文
            started = true;
        }

        // ── 注释区检测（正文结束） ──
        if (!inNotes && isNoteBlock(el)) {
            inNotes = true;
            flushPending();
            continue;
        }

        // ── 跳过纯导航/噪音块 ──
        if (isNoiseBlock(el)) continue;

        // ── 处理内容块 ──
        if (tag === 'blockquote') {
            // 正文中的引文块（也可能是简介题解）。若在正文中（前面已有内容），保留；
            // 若是页首简介（首个内容块且很短），跳过。
            const inner = normalizeText(htmlToText(node));
            if (inner) {
                if (paragraphs.length === 0 && !pendingText && inner.length < 200) {
                    // 页首简介/题解：跳过
                } else {
                    flushPending();
                    paragraphs.push(`> ${inner.replace(/\n+/g, '\n> ')}`);
                }
            }
        } else if (
            tag === 'h1' ||
            tag === 'h2' ||
            tag === 'h3' ||
            tag === 'h4' ||
            tag === 'h5' ||
            tag === 'h6'
        ) {
            flushPending();
            const level = Number(tag[1]);
            paragraphs.push(`${'#'.repeat(level)} ${normalizeText(htmlToText(node))}`);
        } else if (tag === 'p' || tag === 'div' || tag === 'center') {
            flushPending();
            const inner = normalizeText(htmlToText(node));
            if (inner) paragraphs.push(inner);
        } else if (tag === 'table') {
            flushPending();
            const inner = extractTableText(node);
            if (inner) paragraphs.push(inner);
        } else if (tag === 'a') {
            // 孤立链接（非导航）：可能是正文中的 [n] 引用，直接丢弃
            const t = normalizeText(text);
            if (t && !ANCHOR_RE.test(t)) flushPending();
        } else if (tag === 'br') {
            // 分隔符，不处理（自由文本会累积）
        } else if (tag === 'hr') {
            // 分隔线：正文内视为段落分隔
            flushPending();
        }
    }
    flushPending();

    // ── 第二阶段：后处理 ──
    // 去掉首尾的空段落、合并标题等
    const cleaned = paragraphs
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
        .filter((p) => !TRAILER_RE.test(p));

    // 去掉开头的孤立导航链接文本（若清洗后首个段落仍是导航，直接丢弃）
    while (cleaned.length && cleaned[0].length <= 20 && HEADER_LINK_RE.test(cleaned[0])) {
        cleaned.shift();
    }

    return cleaned.join('\n\n');
}

/**
 * 判断一个元素是否为「注释/脚注区」的起始块。
 * 特征：文本以「注释」「附注」等开头，且内部包含 [n] 锚点。
 */
function isNoteBlock(el: cheerio.Cheerio<AnyNode>): boolean {
    const text = normalizeText(el.text());
    if (!NOTE_START_RE.test(text) && !/^注\s*[释解]?\s*[:：]/.test(text)) {
        return false;
    }
    // 必须有脚注锚点或较长内容，避免误伤正文
    return /\[\d+\]/.test(text) || text.length > 30;
}

/**
 * 判断一个元素是否为需要跳过的噪音块：
 * - 页内锚点列表（[1] [2] ...）
 * - 说明/编辑说明框
 */
function isNoiseBlock(el: cheerio.Cheerio<AnyNode>): boolean {
    const text = normalizeText(el.text());
    if (!text) return true;
    // 全是脚注锚点的块
    if (/^(\[\d+\]|\[\*\]|[ \t]*)+$/.test(text)) return true;
    // 说明框
    if (EDITORIAL_RE.test(text) && text.length < 200) return true;
    return false;
}

/**
 * 将 <table> 内的文本提取为段落。
 * 表格在旧页面中常被用来做整体排版（如 mao4 整页一个 table），
 * 因此先按单元格/换行拆成文本行，再过滤导航与说明框，最后合并为段落。
 */
function extractTableText(el: DomElement): string {
    const rows: string[] = [];

    const walk = (node: DomElement) => {
        for (const child of node.children) {
            if (child.type === 'tag') {
                const tag = child.tagName.toLowerCase();
                if (tag === 'td' || tag === 'th') {
                    // 单元格内可能有 <br> 分隔的多行正文
                    const inner = normalizeText(htmlToText(child));
                    for (const line of inner.split('\n')) {
                        const t = line.trim();
                        if (t) rows.push(t);
                    }
                } else {
                    walk(child);
                }
            }
        }
    };
    walk(el);

    return rows
        .filter((line) => !HEADER_LINK_RE.test(line)) // 面包屑/相关链接
        .filter((line) => !EDITORIAL_RE.test(line)) // 说明框
        .filter((line) => !TRAILER_RE.test(line)) // 页脚导航
        .filter((line) => !ANCHOR_RE.test(line)) // 孤立锚点 [n]
        .filter((line) => !/^【附(录|件)?/.test(line)) // 相关链接区的附录条目
        .join('\n\n');
}
