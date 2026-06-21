import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Context } from "koishi";
import { Logger } from "koishi";
import AdmZip from "adm-zip";
import type { SongEntry } from "./types";

const logger = new Logger("redmusic");

/**
 * 音频资源包的 GitHub Release 下载地址。
 * tag = redmusic-assets-v1，文件 = redmusic-assets.zip
 * 仓库 public，无需鉴权。
 */
export const ASSETS_ZIP_URL =
  "https://github.com/Oppenheymu/koishi-plugin-socialism/releases/download/redmusic-assets-v1/redmusic-assets.zip";

/**
 * 用来标记"已成功解压完整"的标记文件名。
 * 下载并解压成功后写入，启动时只看这个文件在不在即可。
 */
const READY_MARKER = ".ready";

/**
 * 计算音频缓存目录：使用 koishi 的 baseDir/data/redmusic。
 * koishi 在 ctx 上提供 baseDir（实例根目录）。
 */
export function getCacheDir(ctx: Context): string {
  return resolve(ctx.baseDir, "data", "redmusic");
}

/**
 * 判断缓存目录是否已经"就绪"（即之前成功下载并解压过完整资源）。
 * 判据：目录存在、有 .ready 标记文件、且标记文件里记录的文件数与 catalog 一致。
 */
export function isCacheReady(cacheDir: string, catalog: SongEntry[]): boolean {
  if (!existsSync(cacheDir)) return false;
  const markerPath = resolve(cacheDir, READY_MARKER);
  if (!existsSync(markerPath)) return false;

  try {
    const expected = catalog.length;
    const content = require(markerPath) as { count?: number };
    if (content.count !== expected) return false;

    // 进一步抽查：所有 catalog 里的文件都应该在
    for (const entry of catalog) {
      if (!existsSync(resolve(cacheDir, entry.file))) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 下载 zip 到内存，解压到 cacheDir。
 * 解压前先清空 cacheDir，避免半截残留。
 *
 * @param force 是否强制重新下载（即使已经就绪）
 * @returns 下载并解压是否成功
 */
export async function downloadAssets(
  ctx: Context,
  cacheDir: string,
  catalog: SongEntry[],
  force = false,
): Promise<boolean> {
  if (!force && isCacheReady(cacheDir, catalog)) {
    logger.info("音频缓存已就绪，跳过下载");
    return true;
  }

  logger.info("开始下载红歌音频资源包…");

  try {
    // 1) 下载 zip 二进制
    const buffer = await ctx.http.get<Buffer>(ASSETS_ZIP_URL, {
      responseType: "arraybuffer",
      timeout: 300000, // 5 分钟，110MB 慢网络也够
    });
    logger.info("下载完成，大小 %d 字节，开始解压…", buffer.byteLength);

    // 2) 准备目录：若存在则清空，重建
    if (existsSync(cacheDir)) {
      rmSync(cacheDir, { recursive: true, force: true });
    }
    mkdirSync(cacheDir, { recursive: true });

    // 3) 解压
    const zip = new AdmZip(Buffer.from(buffer));
    const entries = zip.getEntries();
    let extracted = 0;
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      // 只取文件名部分，防止 zip 内部带子目录导致写到意外位置
      const baseName = entry.entryName.split("/").pop();
      if (!baseName || !baseName.toLowerCase().endsWith(".ogg")) continue;
      const targetPath = resolve(cacheDir, baseName);
      writeFileSync(targetPath, entry.getData());
      extracted++;
    }
    logger.info("解压完成，共 %d 个 ogg 文件", extracted);

    // 4) 校验：catalog 里每个文件都得在
    const missing = catalog.filter(
      (e) => !existsSync(resolve(cacheDir, e.file)),
    );
    if (missing.length) {
      logger.error(
        "解压后仍有 %d 个文件缺失，首例: %s",
        missing.length,
        missing[0]?.file,
      );
      return false;
    }

    // 5) 写入就绪标记
    writeFileSync(
      resolve(cacheDir, READY_MARKER),
      JSON.stringify({ count: catalog.length, ts: Date.now() }),
      "utf-8",
    );
    logger.info("红歌音频缓存就绪 (%d 首)", catalog.length);
    return true;
  } catch (e) {
    logger.error("下载/解压红歌音频失败: %s", (e as Error).message ?? e);
    return false;
  }
}
