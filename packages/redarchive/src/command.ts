import type { Context, Session } from "koishi";
import { Logger } from "koishi";
import { Crawler } from "./crawler";
import type { Config } from "./types";
import { sendAsset } from "./utils";

const logger = new Logger("redarchive");

// ── 翻页交互 ──────────────────────────────

interface Pageable {
    title: string;
    url: string;
}

function pageText<T extends Pageable>(
    label: string,
    items: T[],
    page: number,
    pageSize: number,
): string {
    const total = items.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = page * pageSize;
    const end = Math.min(start + pageSize, total);
    const lines = items.slice(start, end).map((it, i) => `${start + i + 1}. ${it.title}`);
    const nav = total > pageSize ? `  [${page + 1}/${totalPages}]` : "";
    return `--- ${label} (${start + 1}-${end} / ${total})${nav} ---\n${lines.join("\n")}`;
}

function pickOption<T extends Pageable>(input: string, options: T[]): T | null {
    const text = input.trim();
    if (!text) return null;
    const idx = parseInt(text, 10) - 1;
    if (!Number.isNaN(idx) && idx >= 0 && idx < options.length) return options[idx];
    const kw = text.toLowerCase();
    return (
        options.find(
            (o) => o.title.toLowerCase().includes(kw) || o.url.toLowerCase().includes(kw),
        ) ?? null
    );
}

/**
 * 翻页式选择交互
 * - n / 下一页 → 下一页
 * - p / 上一页 → 上一页
 * - 编号 / 关键字 → 选择
 * - q → 取消
 */
async function askSelection<T extends Pageable>(
    session: Session,
    label: string,
    options: T[],
    config: Config,
): Promise<T | null> {
    if (!options.length) return null;

    const pageSize = config.optionsChunkSize;
    const totalPages = Math.ceil(options.length / pageSize);
    let page = 0;

    // 显示首页
    await session.send(pageText(label, options, page, pageSize));

    while (true) {
        const hint =
            totalPages > 1
                ? session.text("redarchive.ask-hint")
                : session.text("redarchive.ask-hint-simple");
        await session.send(hint);

        const input = await session.prompt(config.promptTimeoutMs);
        if (!input) {
            await session.send(session.text("redarchive.ask-timeout"));
            return null;
        }

        const cmd = input.trim().toLowerCase();

        // 取消
        if (cmd === "q") {
            await session.send(session.text("redarchive.ask-cancelled"));
            return null;
        }

        // 翻页
        if ((cmd === "n" || cmd === "下一页") && page + 1 < totalPages) {
            page++;
            await session.send(pageText(label, options, page, pageSize));
            continue;
        }
        if ((cmd === "p" || cmd === "上一页") && page > 0) {
            page--;
            await session.send(pageText(label, options, page, pageSize));
            continue;
        }

        // 选择
        const result = pickOption(input, options);
        if (result) return result;

        await session.send(session.text("redarchive.ask-no-match"));
    }
}

// ── 命令注册 ──────────────────────────────

export function registerCommand(ctx: Context, config: Config): void {
    const crawler = new Crawler(config);
    const cooldownMap = new Map<string, number>();
    const activeChannels = new Set<string>();

    ctx.command("马克思", "抓取马克思主义文库文件并发送下载附件")
        .alias("marxists")
        .action(async ({ session }) => {
            if (!session) return;
            if (!session.channelId || !session.userId) return session.text(".session-unsupported");
            const { userId, channelId } = session;
            const now = Date.now();

            if (activeChannels.has(channelId)) return session.text(".task-busy");

            if (config.cooldownMs > 0) {
                const remain = config.cooldownMs - (now - (cooldownMap.get(userId) ?? 0));
                if (remain > 0) return session.text(".cooldown", [(remain / 1000).toFixed(1)]);
            }

            activeChannels.add(channelId);
            cooldownMap.set(userId, now);

            try {
                await session.send(session.text(".fetching-categories"));

                const categories = await crawler.listCategories();
                if (!categories.length) return session.text(".no-categories");

                const category = await askSelection(
                    session,
                    session.text("redarchive.category-list"),
                    categories,
                    config,
                );
                if (!category) return;

                await session.send(session.text(".category-selected", [category.title]));
                const documents = await crawler.listDocuments(category.url);
                if (!documents.length) return session.text(".no-documents");

                const doc = await askSelection(
                    session,
                    session.text("redarchive.file-list"),
                    documents,
                    config,
                );
                if (!doc) return;

                await session.send(session.text(".document-selected", [doc.title]));
                await sendAsset(
                    session,
                    { title: doc.title, url: doc.url, isDirectFile: doc.isDirectFile },
                    config,
                );
            } catch (e) {
                logger.error(`[Command Error] ${e}`);
                return session.text(".fetch-error", [
                    e instanceof Error ? e.message : session.text(".unknown-error"),
                ]);
            } finally {
                activeChannels.delete(channelId);
            }
        });

    // ── 随机段落 ──────────────────────────────────

    ctx.command("马克思段落", "从文库文档中随机选一段话")
        .alias("marxists段落")
        .action(async ({ session }) => {
            if (!session) return;
            if (!session.channelId || !session.userId) return session.text(".session-unsupported");

            const { userId, channelId } = session;
            const now = Date.now();

            if (activeChannels.has(channelId)) return session.text(".task-busy");

            if (config.cooldownMs > 0) {
                const remain = config.cooldownMs - (now - (cooldownMap.get(userId) ?? 0));
                if (remain > 0) return session.text(".cooldown", [(remain / 1000).toFixed(1)]);
            }

            activeChannels.add(channelId);
            cooldownMap.set(userId, now);

            try {
                await session.send(session.text(".fetching-paragraph"));
                const sent = await ctx.redarchive.send(session);
                if (!sent) return session.text(".no-paragraph");
            } catch (e) {
                logger.error(`[Paragraph Error] ${e}`);
                return session.text(".fetch-error", [
                    e instanceof Error ? e.message : session.text(".unknown-error"),
                ]);
            } finally {
                activeChannels.delete(channelId);
            }
        });
}
