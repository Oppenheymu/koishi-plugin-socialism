import type { Context } from "koishi";
import { Schema } from "koishi";
import type { Config as ConfigType } from "./types";
import { registerCommand } from "./command";

export const name = "redarchive";

export const usage = `
<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">📖 使用说明</h2>
  <ul>
    <li>📚 抓取<strong>中文马克思主义文库</strong>文档，以进行学术研究</li>
    <li>🔗 支持配置多个镜像入口，按优先级依次尝试</li>
    <li>⚡ 仅使用 HTTP 抓取，无需 Playwright</li>
  </ul>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #e0574a;">💬 交流与反馈</h2>
  <p>🌟 喜欢这个插件？欢迎加入 QQ 群 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#e0574a;text-decoration:none;"><strong>1071284605</strong></a>【晓基地插件工坊】进行交流</p>
  <p>🐛 遇到问题？欢迎在群内反馈，或点击 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#e0574a;text-decoration:none;">此链接</a> 加入群聊</p>
</div>
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
