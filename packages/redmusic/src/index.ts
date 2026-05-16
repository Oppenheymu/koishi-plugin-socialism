import type { Context, Session } from "koishi";
import { Schema, Service } from "koishi";
import { randomPick, exactPick, listSongs } from "./core";
import { registerListenCommands } from "./listen";
import type { SongEntry, SongFilter, RandomOutcome } from "./types";

export const name = "redmusic";

export const usage = `
## 使用说明
插件是我vibe的
所有歌曲均已获得“小市民红球”授权
本插件注入 \`redmusic\` 服务，可供其他插件通过 \`ctx.redmusic\` 调用：

- \`ctx.redmusic.random(概率?, 过滤?)\` — 按概率随机选取一首，返回音频元素
- \`ctx.redmusic.pick(过滤)\` — 精确选取一首（同名多版本时随机），返回音频元素
- \`ctx.redmusic.list(过滤?)\` — 列出匹配歌曲的元数据（不发送音频）
- \`ctx.redmusic.send(session, 概率?, 过滤?)\` — 按概率直接发送语音

## 命令
- \`红歌 [歌名]\` — 随机点一首红歌，或指定歌名；用 /前缀筛选标签
- \`红歌列表\` — 查看所有可用红歌

### 标签列表
纯曲、中版、交响乐、电音、军乐、器乐、稀有版、阅兵版、TNO版、单曲版、波兰、罗马尼亚语
`;

export interface Config {
	/** 点歌冷却时间（秒） */
	cooldown: number;
	/** 是否在语音前显示歌名 */
	showName: boolean;
}

export const Config: Schema<Config> = Schema.object({
	cooldown: Schema.number()
		.default(30)
		.min(0)
		.description("点歌冷却时间（秒）"),
	showName: Schema.boolean()
		.default(true)
		.description("是否在语音前显示歌名和标签"),
});

// ── Service ──────────────────────────────────────────────

export class RedMusicService extends Service {
	constructor(ctx: Context) {
		super(ctx, "redmusic", true);
	}

	/**
	 * 按概率随机选取一首歌，返回音频 h 元素。
	 * 未命中时 hit=false，可直接判断后决定是否发送。
	 */
	random(probability = 1, filter?: SongFilter): RandomOutcome {
		return randomPick(probability, filter);
	}

	/**
	 * 精确选取一首歌（同名多版本时随机），返回音频 h 元素。
	 */
	pick(filter: SongFilter): { entry: SongEntry; audio: string } | null {
		return exactPick(filter);
	}

	/**
	 * 列出匹配歌曲的元数据（不涉及文件、不生成元素）。
	 */
	list(filter?: SongFilter): SongEntry[] {
		return listSongs(filter);
	}

	/**
	 * 按概率直接 session.send 语音消息。
	 * @returns 是否命中并发送
	 */
	async send(
		session: Session,
		probability = 1,
		filter?: SongFilter,
	): Promise<boolean> {
		const result = randomPick(probability, filter);
		if (!result.hit) return false;
		await session.send(result.audio);
		return true;
	}
}

declare module "koishi" {
	interface Context {
		redmusic: RedMusicService;
	}
}

// ── 插件入口 ──────────────────────────────────────────────

export function apply(ctx: Context, config: Config) {
	ctx.plugin(RedMusicService);
	registerListenCommands(ctx, config);
}
