import type { Context } from "koishi";
import { exactPick, isAssetsReady, listSongs, randomPick } from "./core";
import type { SongFilter } from "./types";

export interface ListenConfig {
    /** 点歌冷却时间（秒） */
    cooldown: number;
    /** 是否在语音前显示歌名 */
    showName: boolean;
}

export function registerListenCommands(
    ctx: Context,
    config: ListenConfig,
    onRedownload: () => Promise<boolean>,
) {
    const cooldowns = new Map<string, number>();

    function checkCooldown(userId: string): number {
        const now = Date.now();
        const last = cooldowns.get(userId) ?? 0;
        const remaining = Math.max(0, config.cooldown * 1000 - (now - last));
        return remaining;
    }

    function setCooldown(userId: string) {
        cooldowns.set(userId, Date.now());
    }

    // ── 红歌 ────────────────────────────────────────────

    ctx.command("红歌 [query:text]", "随机点一首红歌，或指定歌名")
        .alias("redmusic")
        .usage(
            '直接输入"红歌"随机一首；输入"红歌 国际歌"指定歌名；输入"红歌 /纯曲"按标签筛选（/前缀表示标签）',
        )
        .example("红歌")
        .example("红歌 国际歌")
        .example("红歌 /纯曲 /交响乐")
        .action(async ({ session }, query) => {
            if (!session?.userId) return;

            // 资源就绪检查
            if (!isAssetsReady()) {
                return session.text(".assets-not-ready");
            }

            // 冷却检查
            const remaining = checkCooldown(session.userId);
            if (remaining > 0) {
                return session.text(".cooldown", [(remaining / 1000).toFixed(0)]);
            }

            // 解析输入
            const tags: string[] = [];
            let name: string | undefined;

            if (query?.trim()) {
                const parts = query.trim().split(/\s+/);
                for (const part of parts) {
                    if (part.startsWith("/")) {
                        tags.push(part.slice(1));
                    } else {
                        name = part;
                    }
                }
            }

            // 选取歌曲
            let result: { entry: { name: string; tags: string[] }; audio: string } | null = null;

            if (name) {
                // 指定歌名：精确选取
                const filter: SongFilter = { name };
                if (tags.length) filter.tags = tags;
                const picked = exactPick(filter);
                if (picked) result = picked;
            } else if (tags.length) {
                // 只有标签：按标签随机
                const picked = randomPick(1, { tags });
                if (picked.hit) result = picked;
            } else {
                // 完全随机
                const picked = randomPick(1);
                if (picked.hit) result = picked;
            }

            if (!result) {
                if (name) {
                    const tagHint = tags.length ? session.text(".tag-hint", [tags.join(", ")]) : "";
                    return session.text(".song-not-found", [name, tagHint]);
                }
                return session.text(".no-songs");
            }

            // 设置冷却
            setCooldown(session.userId);

            // 发送
            const parts: string[] = [];
            if (config.showName) {
                const tagStr = result.entry.tags.length ? ` [${result.entry.tags.join(", ")}]` : "";
                parts.push(`🎵 ${result.entry.name}${tagStr}`);
            }
            parts.push(result.audio);
            await session.send(parts.join("\n"));
        });

    // ── 红歌列表 ────────────────────────────────────────

    ctx.command("红歌列表", "查看所有可用红歌")
        .alias("红歌list")
        .action(({ session }) => {
            if (!session) return;
            const songs = listSongs();

            if (!songs.length) return session.text(".no-songs");

            // 按歌名分组（同名不同版本合并展示）
            const groups = new Map<string, string[]>();
            for (const s of songs) {
                const versions = groups.get(s.name) ?? [];
                versions.push(s.tags.length ? `(${s.tags.join(", ")})` : "(原版)");
                groups.set(s.name, versions);
            }

            const lines = [...groups.entries()].map(([name, versions]) => {
                return `${name} ${versions.join(" ")}`;
            });

            const readyNote = isAssetsReady() ? "" : session.text(".assets-pending");
            return session.text(".list", [songs.length, lines.join("\n"), readyNote]);
        });

    // ── 红歌重载（管理员手动触发重新下载） ────────────────

    ctx.command("红歌重载", "重新下载红歌音频资源（管理员）")
        .alias("红歌reload")
        .userFields(["authority"])
        .action(async ({ session }) => {
            if (!session) return;
            // 需要 2 级及以上权限（koishi 默认 owner=5，admin=4，user=1）
            const user = session.user as { authority?: number } | undefined;
            if ((user?.authority ?? 0) < 2) {
                return session.text(".permission-denied");
            }
            await session.send(session.text(".reload-start"));
            const ok = await onRedownload();
            return ok ? session.text(".reload-ok") : session.text(".reload-fail");
        });
}
