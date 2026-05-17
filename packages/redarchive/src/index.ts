import type { Context } from "koishi";
import { Schema } from "koishi";
import type { Config as ConfigType } from "./types";
import { registerCommand } from "./command";

export const name = "redarchive";

export const usage = `
## 使用说明
- 抓取中文马克思主义文库文档，以进行学术研究
- 支持配置多个镜像入口，按优先级依次尝试
- 仅使用 HTTP 抓取，无需 Playwright
`;

export const Config: Schema<ConfigType> = Schema.object({
	entryUrls: Schema.array(String)
		.role("table")
		.default([
			"https://www.marxists.org/chinese/",
			"https://marxists.incn.tech/chinese/",
			"https://marxists.architexturez.net/chinese/",
		])
		.description("入口 URL 列表（按优先级排列，首个成功即使用）"),
	navigationTimeout: Schema.number()
		.default(30_000)
		.description("页面导航超时（毫秒）"),
	cacheDir: Schema.string().default("cache/redarchive").description("缓存目录"),
	categoryCacheTtlMs: Schema.number()
		.min(0)
		.default(10 * 60 * 1000)
		.description("分类列表缓存有效期（毫秒）"),
	documentCacheTtlMs: Schema.number()
		.min(0)
		.default(10 * 60 * 1000)
		.description("文件列表缓存有效期（毫秒）"),
	promptTimeoutMs: Schema.number()
		.default(60_000)
		.description("用户输入等待超时（毫秒）"),
	maxShownOptions: Schema.number()
		.min(5)
		.max(5000)
		.default(5000)
		.description("展示选项数量上限"),
	optionsChunkSize: Schema.number()
		.min(10)
		.max(200)
		.default(50)
		.description("选项分段发送每段条数"),
	cooldownMs: Schema.number()
		.min(0)
		.default(8000)
		.description("同一用户命令冷却时间（毫秒）"),
});

export function apply(ctx: Context, config: ConfigType) {
	registerCommand(ctx, config);
}
