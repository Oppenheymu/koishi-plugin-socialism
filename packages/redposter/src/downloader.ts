import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Context } from 'koishi';
import { h, Logger } from 'koishi';
import { loadIndex } from './catalog';
import type { PosterEntry } from './types';

const logger = new Logger('redposter');

let _cacheDir: string | null = null;

/** 计算图片缓存目录：<baseDir>/data/red/redposter（红色系列统一聚合在 data/red/ 下） */
export function getCacheDir(ctx: Context): string {
    return resolve(ctx.baseDir, 'data', 'red', 'redposter');
}

/** 由入口注入缓存目录（启动时） */
export function setCacheDir(dir: string): void {
    _cacheDir = dir;
}

export function isCacheReady(): boolean {
    return !!_cacheDir;
}

/** 清空图片缓存目录（重载命令使用） */
export function clearCache(): void {
    if (!_cacheDir) return;
    rmSync(_cacheDir, { recursive: true, force: true });
    mkdirSync(_cacheDir, { recursive: true });
    logger.info('已清空图片缓存目录 %s', _cacheDir);
}

/**
 * 确保海报原图已下载到本地缓存，返回本地文件路径。
 * 已存在则直接复用，避免重复下载；失败返回 null。
 */
export async function ensureImage(ctx: Context, entry: PosterEntry): Promise<string | null> {
    if (!_cacheDir) {
        logger.warn('图片缓存目录未注入，无法发送海报');
        return null;
    }
    const filename = entry.image.split('/').pop();
    if (!filename) return null;

    const filePath = resolve(_cacheDir, filename);
    if (existsSync(filePath)) return filePath;

    const url = new URL(entry.image, loadIndex().source).href;
    try {
        mkdirSync(_cacheDir, { recursive: true });
        const buffer = await ctx.http.get<Buffer>(url, {
            responseType: 'arraybuffer',
            timeout: 60000,
        });
        writeFileSync(filePath, buffer);
        logger.info('已缓存海报图片 %s（%d 字节）', filename, buffer.byteLength);
        return filePath;
    } catch (e) {
        logger.warn('海报图片下载失败: %s（%s）', url, (e as Error).message ?? e);
        return null;
    }
}

/** 构造 image 消息元素（本地文件用 file: 协议） */
export function buildImageElement(filePath: string): string {
    if (!existsSync(filePath)) return '';
    return h('image', { src: pathToFileURL(filePath).href }).toString();
}
