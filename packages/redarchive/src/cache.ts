import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

interface CacheEnvelope<T> {
	expiresAt: number;
	data: T;
}

function filePath(dir: string, ns: string, key: string): string {
	const hash = createHash("sha1").update(key).digest("hex");
	return path.join(dir, `${ns}-${hash}.json`);
}

/** 读取缓存，过期返回 null */
export async function readCache<T>(
	dir: string,
	ns: string,
	key: string,
): Promise<T | null> {
	try {
		const raw = await readFile(filePath(dir, ns, key), "utf8");
		const parsed = JSON.parse(raw) as CacheEnvelope<T>;
		if (typeof parsed?.expiresAt !== "number" || Date.now() > parsed.expiresAt)
			return null;
		return parsed.data;
	} catch {
		return null;
	}
}

/** 写入缓存 */
export async function writeCache<T>(
	dir: string,
	ns: string,
	key: string,
	data: T,
	ttlMs: number,
): Promise<void> {
	await mkdir(dir, { recursive: true });
	await writeFile(
		filePath(dir, ns, key),
		JSON.stringify({ expiresAt: Date.now() + Math.max(0, ttlMs), data }),
		"utf8",
	);
}
