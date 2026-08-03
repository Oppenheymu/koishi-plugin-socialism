import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import iconv from "iconv-lite";
import type { Session } from "koishi";
import { h } from "koishi";
import { extractMarkdown } from "./extract";

// ── HTTP 抓取 ────────────────────────────────

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** 抓取 URL 内容并按页面编码解码为字符串 */
export async function httpGet(url: string, timeout: number): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
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
        const buffer = Buffer.from(await res.arrayBuffer());
        return decodeHtml(buffer, res.headers.get("content-type"));
    } finally {
        clearTimeout(timer);
    }
}

// ── 编码检测 ────────────────────────────────

function extractCharsetFromHeader(contentType?: string | null): string | null {
    if (!contentType) return null;
    const m = contentType.match(/charset\s*=\s*['"]?([^;\s'"]+)/i);
    return m?.[1]?.trim().toLowerCase() ?? null;
}

function extractCharsetFromMeta(buffer: Buffer): string | null {
    const head = buffer.subarray(0, Math.min(buffer.length, 8192)).toString("ascii");
    const direct = head.match(/<meta[^>]*charset\s*=\s*['"]?([^\s'">/]+)/i)?.[1];
    if (direct) return direct.toLowerCase();
    const httpEquiv = head.match(
        /<meta[^>]*http-equiv\s*=\s*['"]content-type['"][^>]*content\s*=\s*['"][^"]*charset\s*=\s*([^\s'"';>]+)/i,
    )?.[1];
    return httpEquiv?.toLowerCase() ?? null;
}

function normalizeCharset(charset?: string | null): string | null {
    if (!charset) return null;
    const lower = charset.toLowerCase();
    if (lower === "gb2312" || lower === "gbk" || lower === "x-gbk") return "gb18030";
    if (lower === "utf8") return "utf-8";
    return lower;
}

/** 从 Buffer 解码 HTML，自动检测编码 */
export function decodeHtml(buffer: Buffer, contentType?: string | null): string {
    const charset =
        normalizeCharset(extractCharsetFromHeader(contentType)) ??
        normalizeCharset(extractCharsetFromMeta(buffer)) ??
        "utf-8";
    return iconv.decode(buffer, iconv.encodingExists(charset) ? charset : "utf-8");
}

// ── URL 工具 ────────────────────────────────

const DIRECT_FILE_EXTS = new Set([
    ".pdf",
    ".epub",
    ".mobi",
    ".txt",
    ".doc",
    ".docx",
    ".zip",
    ".rar",
    ".chm",
]);

/** 将相对/绝对 href 解析为完整 URL，过滤无效链接 */
export function resolveUrl(base: string, href?: string | null): string | null {
    if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("javascript:") ||
        href.startsWith("mailto:")
    )
        return null;
    try {
        return new URL(href, base).toString();
    } catch {
        return null;
    }
}

/** 判断 URL 是否为可下载文件 */
export function isDirectFile(url: string): boolean {
    const pathname = new URL(url).pathname.toLowerCase();
    const dot = pathname.lastIndexOf(".");
    return dot >= 0 && DIRECT_FILE_EXTS.has(pathname.slice(dot));
}

/** 判断 URL 是否指向 HTML 页面（而非目录或文件） */
export function isHtmlPage(url: string): boolean {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith("/") || isDirectFile(url)) return false;
    return /\.(html?|xhtml|shtml|php|asp|aspx)$/i.test(pathname);
}

/** 清理链接文本，兜底用 URL 最后一段 */
export function cleanTitle(raw: string, fallbackUrl: string): string {
    const title = raw.replace(/\s+/g, " ").trim();
    if (title) return title;
    const segment = new URL(fallbackUrl).pathname.split("/").filter(Boolean).at(-1);
    return segment ? decodeURIComponent(segment) : fallbackUrl;
}

// ── 发送工具 ────────────────────────────────

function fileNameFromUrl(url: string, fallback: string): string {
    const name = new URL(url).pathname.split("/").filter(Boolean).at(-1);
    return name ? decodeURIComponent(name) : fallback || "document";
}

/** 将标题清理为安全的文件名（保留中文，去掉非法字符） */
function safeFileName(title: string): string {
    // 逐字符过滤，去掉控制字符与路径非法字符
    const cleaned = title
        .split("")
        .filter((ch) => {
            const code = ch.charCodeAt(0);
            return code >= 32 && !/[\\/:*?"<>|]/.test(ch);
        })
        .join("")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
    return cleaned || "document";
}

/**
 * 发送文档给用户。
 * - 直接文件（pdf/epub 等）：原样发送下载链接
 * - HTML 页面（.htm 等）：下载 → 提取正文 → 生成 .md 文件 → 以 file: 协议发送；
 *   提取失败时回退为原样发送
 */
export async function sendAsset(
    session: Session,
    asset: { title: string; url: string; isDirectFile: boolean },
    config: { cacheDir: string; navigationTimeout: number },
): Promise<void> {
    const fileName = fileNameFromUrl(asset.url, asset.title);

    // 非 HTML 页面直接原样发送
    if (asset.isDirectFile || !isHtmlPage(asset.url)) {
        await session.send(`已获取下载文件：${fileName}`);
        await session.send(h("file", { src: asset.url, title: fileName }));
        return;
    }

    // HTML 页面：清洗正文并转为 Markdown 文件
    try {
        await session.send(`📄 正在清洗正文并生成 Markdown 文件...`);
        const html = await httpGet(asset.url, config.navigationTimeout);
        const markdown = extractMarkdown(html);
        if (markdown.length < 100) {
            // 提取到的内容过少，判定为清洗失败
            await session.send(`⚠️ 正文提取失败（仅 ${markdown.length} 字），改为发送原文件。`);
            await session.send(h("file", { src: asset.url, title: fileName }));
            return;
        }

        const mdName = `${safeFileName(asset.title || fileName)}.md`;
        // cacheDir 可能是相对路径（相对进程工作目录），转成绝对路径后再写文件
        const mdDir = resolve(config.cacheDir, "documents");
        await mkdir(mdDir, { recursive: true });
        const mdPath = join(mdDir, mdName);
        await writeFile(mdPath, markdown, "utf8");

        await session.send(
            `已生成清洗后的 Markdown 文件：${mdName}（${(markdown.length / 1000).toFixed(1)} KB）`,
        );
        await session.send(h("file", { src: pathToFileURL(mdPath).href, title: mdName }));
    } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        await session.send(`⚠️ 正文清洗失败（${reason}），改为发送原文件。`);
        await session.send(h("file", { src: asset.url, title: fileName }));
    }
}
