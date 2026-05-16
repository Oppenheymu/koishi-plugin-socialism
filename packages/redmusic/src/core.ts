import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { h, Logger } from "koishi";
import type { SongEntry, SongFilter, RandomOutcome } from "./types";

const logger = new Logger("redmusic");

// ── 资源定位 ──────────────────────────────────────────────

function findAssetsDir(): string {
	// 1) <package>/lib/ → <package>/assets/  (生产环境)
	const prod = resolve(__dirname, "..", "assets");
	if (existsSync(prod)) return prod;

	// 2) <package>/src/ → <package>/assets/  (开发环境)
	const dev = resolve(__dirname, "..", "..", "assets");
	if (existsSync(dev)) return dev;

	throw new Error("redmusic: 无法定位 assets/ 目录");
}

// ── 索引加载 ──────────────────────────────────────────────

let _catalog: SongEntry[] | null = null;
let _assetsDir: string | null = null;

export function loadCatalog(): { catalog: SongEntry[]; assetsDir: string } {
	if (_catalog && _assetsDir)
		return { catalog: _catalog, assetsDir: _assetsDir };

	_assetsDir = findAssetsDir();
	const indexPath = resolve(_assetsDir, "index.json");

	if (!existsSync(indexPath)) {
		throw new Error(
			`redmusic: 未找到索引文件 ${indexPath}，请先运行 scripts/generate_index.py`,
		);
	}

	// eslint-disable-next-line @typescript-eslint/no-var-requires
	_catalog = require(indexPath) as SongEntry[];
	logger.info("已加载 %d 首歌曲索引", _catalog?.length);
	return { catalog: _catalog, assetsDir: _assetsDir };
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

export function buildAudioElement(entry: SongEntry, assetsDir: string): string {
	const filePath = resolve(assetsDir, entry.file);
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
	const { catalog, assetsDir } = loadCatalog();
	const pool = filterSongs(catalog, filter);

	if (!pool.length) {
		logger.warn("没有匹配的歌曲 (filter=%j)", filter);
		return { hit: false };
	}

	if (probability <= 0) return { hit: false };

	const p = Math.min(1, probability);
	if (Math.random() >= p) return { hit: false };

	const entry = pool[Math.floor(Math.random() * pool.length)];
	const audio = buildAudioElement(entry, assetsDir);
	if (!audio) return { hit: false };

	return { hit: true, entry, audio };
}

// ── 精确选取 ──────────────────────────────────────────────

export function exactPick(
	filter: SongFilter,
): { entry: SongEntry; audio: string } | null {
	const { catalog, assetsDir } = loadCatalog();
	const pool = filterSongs(catalog, filter);

	if (!pool.length) {
		logger.warn("没有匹配的歌曲 (filter=%j)", filter);
		return null;
	}

	const entry = pool[Math.floor(Math.random() * pool.length)];
	const audio = buildAudioElement(entry, assetsDir);
	if (!audio) return null;

	return { entry, audio };
}

// ── 列出歌曲（仅元数据，不涉及文件） ──────────────────────

export function listSongs(filter?: SongFilter): SongEntry[] {
	const { catalog } = loadCatalog();
	return filterSongs(catalog, filter);
}
