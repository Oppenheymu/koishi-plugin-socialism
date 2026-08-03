import type { Context, Session } from "koishi";
import { Logger, Service } from "koishi";
import { readCache, writeCache } from "./cache";
import { Crawler } from "./crawler";
import { extractMarkdown } from "./extract";
import type { CategoryItem, Config, DocumentItem } from "./types";
import { httpGet, isHtmlPage } from "./utils";

const logger = new Logger("redarchive");

/** 随机段落的最小/最大长度（字符） */
const MIN_PARAGRAPH_LEN = 20;
const MAX_PARAGRAPH_LEN = 500;

/** 随机抽取时的最大尝试次数（网络失败/无合适段落时重试） */
const MAX_TRIES = 5;

/**
 * 噪音段落特征（译注/来源注/编辑注/人物小传/作者头注等）。
 * 文库页面清洗后这些注释常混在正文中，随机抽取时应剔除。
 */
const NOISE_PARAGRAPH_RE = [
    /^\s*[*]/, // 编辑注：* 这是毛泽东为中共中央起草的对党内的指示。
    /^\s*[〔【]/, // 作者头注：〔美〕 H.马尔库塞
    /^\s*[（(][^)）]{1,60}[)）]\s*$/, // 纯括号注释：（《马布利选集》，商务印书馆1960年版）
    /(译自|载于|来源[:：]|责任编辑|编译|出版社|年版|编辑注|译者注|整理者注|中译者|译者按|校者注|press|translated by|published by)/i, // 译注/来源
    /^\[\d+\]/, // 正文注释：[7] 指1927年…
    /（(?:19|20)\d{2}年.*?—.*?(?:19|20)\d{2}年?）/i, // 人物小传：（1887年—1954年）
];

/** 一篇文档 + 其所属分类，供随机段落引用 */
export interface PickedDocument {
    category: CategoryItem;
    doc: DocumentItem;
}

/** 随机选中的一段话，附带出处 */
export interface PickedParagraph extends PickedDocument {
    /** 段落正文 */
    text: string;
}

/**
 * redarchive 服务：供其他插件调用，抓取中文马克思主义文库文档。
 *
 * - listCategories / listDocuments：复用 Crawler 的分类/文档列表（带缓存）
 * - getMarkdown：抓取并清洗为 Markdown（带内容缓存）
 * - randomParagraph：随机选一篇文档中的一段话（特色）
 */
export class RedarchiveService extends Service {
    private readonly crawler: Crawler;
    private readonly options: Config;

    constructor(ctx: Context, config: Config) {
        super(ctx, "redarchive", true);
        this.options = config;
        this.crawler = new Crawler(config);
    }

    /** 分类列表（带缓存） */
    async listCategories(): Promise<CategoryItem[]> {
        return this.crawler.listCategories();
    }

    /** 某分类下的文档列表（带缓存） */
    async listDocuments(categoryUrl: string): Promise<DocumentItem[]> {
        return this.crawler.listDocuments(categoryUrl);
    }

    /** 抓取文档并清洗为 Markdown（带内容缓存） */
    async getMarkdown(url: string): Promise<string> {
        const cached = await readCache<string>(this.options.cacheDir, "content", url);
        if (cached) return cached;

        const html = await httpGet(url, this.options.navigationTimeout);
        const markdown = extractMarkdown(html);
        if (markdown) {
            await writeCache(
                this.options.cacheDir,
                "content",
                url,
                markdown,
                this.options.documentCacheTtlMs,
            );
        }
        return markdown;
    }

    /** 从 Markdown 中拆出可发送的正文段落（过滤标题/引用块/过短/过长/注释噪音） */
    private splitParagraphs(markdown: string): string[] {
        return markdown
            .split(/\n{2,}/)
            .map((p) => p.replace(/\n/g, " ").replace(/\s+/g, " ").trim())
            .filter((p) => p.length >= MIN_PARAGRAPH_LEN && p.length <= MAX_PARAGRAPH_LEN)
            .filter((p) => !/^[#>]/.test(p))
            .filter((p) => !NOISE_PARAGRAPH_RE.some((re) => re.test(p)));
    }

    /** 随机挑一个分类 */
    async randomCategory(): Promise<CategoryItem | null> {
        const categories = await this.listCategories();
        if (!categories.length) return null;

        // 马恩列毛优先：以 70% 概率只从马恩列毛分类中抽取，
        // 其余 30% 从全部分类抽取，提升核心作者著作的被抽中率。
        const core = categories.filter((c) => this.isCoreAuthor(c));
        const pool = core.length && Math.random() < 0.7 ? core : categories;
        return pool[Math.floor(Math.random() * pool.length)] ?? null;
    }

    /** 判断分类是否属于马恩列毛（按标题关键词） */
    private isCoreAuthor(category: CategoryItem): boolean {
        const title = category.title;
        return /马克思|恩格斯|列宁|毛泽东|斯大林/.test(title);
    }

    /** 随机挑一个可清洗的 HTML 文档（跳过 pdf 等直接文件） */
    async randomDocument(): Promise<PickedDocument | null> {
        for (let i = 0; i < MAX_TRIES; i++) {
            const category = await this.randomCategory();
            if (!category) return null;
            const docs = await this.listDocuments(category.url);
            const candidates = docs.filter((d) => !d.isDirectFile && isHtmlPage(d.url));
            if (!candidates.length) continue;
            const doc = candidates[Math.floor(Math.random() * candidates.length)];
            if (doc) return { category, doc };
        }
        return null;
    }

    /**
     * 特色：随机选一篇文档中的一段话。
     * 随机分类 → 随机文档 → 抓取清洗 → 随机挑一段正文。
     */
    async randomParagraph(): Promise<PickedParagraph | null> {
        for (let i = 0; i < MAX_TRIES; i++) {
            const picked = await this.randomDocument();
            if (!picked) return null;
            const { category, doc } = picked;
            try {
                const markdown = await this.getMarkdown(doc.url);
                const paragraphs = this.splitParagraphs(markdown);
                if (!paragraphs.length) continue;
                const text = paragraphs[Math.floor(Math.random() * paragraphs.length)];
                if (text) return { category, doc, text };
            } catch (e) {
                logger.warn(
                    `抓取文档失败：${doc.url}（${e instanceof Error ? e.message : String(e)}）`,
                );
            }
        }
        return null;
    }

    /** 直接发送一段随机语录 */
    async send(session: Session): Promise<boolean> {
        const result = await this.randomParagraph();
        if (!result) return false;
        const { category, doc, text } = result;
        await session.send(session.text("redarchive.quote", [text, doc.title, category.title]));
        return true;
    }
}

declare module "koishi" {
    interface Context {
        redarchive: RedarchiveService;
    }
}
