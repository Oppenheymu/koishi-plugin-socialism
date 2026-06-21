import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { h, Logger } from "koishi";
import type { SongEntry, SongFilter, RandomOutcome } from "./types";

const logger = new Logger("redmusic");

// ── 索引加载（元数据，随包发布，始终可用） ────────────────

/**
 * index.json 随 npm 包发布，体积很小（几 KB），
 * 作为歌曲元数据来源。生产环境在 <pkg>/assets/index.json，
 * 开发环境在 <pkg>/../../assets/index.json。
 */
function findIndexJson(): string {
  // 1) <package>/lib/ → <package>/assets/index.json  (生产)
  const prod = resolve(__dirname, "..", "assets", "index.json");
  if (existsSync(prod)) return prod;

  // 2) <package>/src/ → <package>/assets/index.json  (开发)
  const dev = resolve(__dirname, "..", "..", "assets", "index.json");
  if (existsSync(dev)) return dev;

  throw new Error("redmusic: 无法定位 assets/index.json");
}

let _catalog: SongEntry[] | null = null;

export function loadCatalog(): SongEntry[] {
  if (_catalog) return _catalog;

  const indexPath = findIndexJson();
  if (!existsSync(indexPath)) {
    throw new Error(
      `redmusic: 未找到索引文件 ${indexPath}，请先运行 scripts/generate_index.py`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  _catalog = require(indexPath) as SongEntry[];
  logger.info("已加载 %d 首歌曲索引", _catalog?.length);
  return _catalog;
}

// ── 音频目录（由外部注入：本地缓存目录） ─────────────────

let _assetsDir: string | null = null;

/**
 * 由 index.ts 在启动时（下载完成后）注入缓存目录路径。
 * 注入前 buildAudioElement 会返回空串，避免崩溃。
 */
export function setAssetsDir(dir: string): void {
  _assetsDir = dir;
}

export function getAssetsDir(): string | null {
  return _assetsDir;
}

/** 音频资源是否就绪（目录已注入且存在） */
export function isAssetsReady(): boolean {
  return !!_assetsDir && existsSync(_assetsDir);
}

// ── 过滤 ─────────────────────────────────────────────────

export function filterSongs(
  catalog: SongEntry[],
  filter?: SongFilter,
): SongEntry[] {
  if (!filter) return catalog;

  let result = catalog;

  if (filter.name) {
    const target = filter.name.toLowerCase();
    result = result.filter((e) => e.name.toLowerCase() === target);
  }

  if (filter.tags?.length) {
    result = result.filter((e) =>
      filter.tags?.every((t) => e.tags.includes(t)),
    );
  }

  return result;
}

// ── 音频元素生成 ──────────────────────────────────────────

export function buildAudioElement(entry: SongEntry): string {
  if (!_assetsDir) {
    logger.warn("音频资源尚未就绪（缓存目录未注入），无法播放");
    return "";
  }
  const filePath = resolve(_assetsDir, entry.file);
  if (!existsSync(filePath)) {
    logger.warn("文件不存在: %s", filePath);
    return "";
  }
  const src = pathToFileURL(filePath).href;
  return h("audio", { src }).toString();
}

// ── 随机选取（按概率） ────────────────────────────────────

export function randomPick(
  probability: number,
  filter?: SongFilter,
): RandomOutcome {
  const catalog = loadCatalog();
  const pool = filterSongs(catalog, filter);

  if (!pool.length) {
    logger.warn("没有匹配的歌曲 (filter=%j)", filter);
    return { hit: false };
  }

  if (probability <= 0) return { hit: false };

  const p = Math.min(1, probability);
  if (Math.random() >= p) return { hit: false };

  const entry = pool[Math.floor(Math.random() * pool.length)];
  const audio = buildAudioElement(entry);
  if (!audio) return { hit: false };

  return { hit: true, entry, audio };
}

// ── 精确选取 ──────────────────────────────────────────────

export function exactPick(
  filter: SongFilter,
): { entry: SongEntry; audio: string } | null {
  const catalog = loadCatalog();
  const pool = filterSongs(catalog, filter);

  if (!pool.length) {
    logger.warn("没有匹配的歌曲 (filter=%j)", filter);
    return null;
  }

  const entry = pool[Math.floor(Math.random() * pool.length)];
  const audio = buildAudioElement(entry);
  if (!audio) return null;

  return { entry, audio };
}

// ── 列出歌曲（仅元数据，不涉及文件） ──────────────────────

export function listSongs(filter?: SongFilter): SongEntry[] {
  const catalog = loadCatalog();
  return filterSongs(catalog, filter);
}
