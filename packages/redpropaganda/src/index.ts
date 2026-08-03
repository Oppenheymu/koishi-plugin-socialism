import type { Context, Session } from "koishi";
import { Schema, Service } from "koishi";
import type {} from "koishi-plugin-cron-fix";
import type {} from "koishi-plugin-redarchive";
import type {} from "koishi-plugin-redmusic";
import type {} from "koishi-plugin-redposter";
import type {} from "koishi-plugin-redquote";
import type { JobConfig, SourceConfig, SourceType } from "./types";

export const name = "redpropaganda";

export const usage = `
<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">📖 使用说明</h2>
  <ul>
    <li>📣 定时向群内发送红色宣传内容（宣传语/语录/文库段落/歌曲/海报）</li>
    <li>🕐 依赖 <code>cron</code> 服务（koishi-plugin-cron-fix），使用 cron 表达式定时触发</li>
    <li>🔌 可选依赖 <code>redquote</code> / <code>redarchive</code> / <code>redmusic</code> / <code>redposter</code>，未安装对应服务时自动跳过对应来源</li>
    <li>📝 可在配置项中添加自定义宣传语，并配置多个定时任务（jobs）</li>
  </ul>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">⚡ 命令</h2>
  <ul>
    <li><code>红宣传 [数量]</code> — 随机获取一条（或指定数量）宣传口号</li>
    <li><code>红宣传推送 [任务序号]</code> — 立即向配置的目标群手动推送一次（省略序号则推送所有任务）</li>
    <li><code>红宣传推送列表</code> — 查看已配置的定时任务</li>
  </ul>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #e0574a;">💬 交流与反馈</h2>
  <p>🌟 喜欢这个插件？欢迎加入 QQ 群 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#e0574a;text-decoration:none;"><strong>1071284605</strong></a>【晓基地插件工坊】进行交流</p>
  <p>🐛 遇到问题？欢迎在群内反馈，或点击 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#e0574a;text-decoration:none;">此链接</a> 加入群聊</p>
</div>
`;

/** 内置宣传语库 */
const DEFAULT_MESSAGES: string[] = [
    "听党指挥，能打胜仗，作风优良！",
    "不忘初心，牢记使命！",
    "人民有信仰，民族有希望，国家有力量！",
    "撸起袖子加油干！",
    "幸福都是奋斗出来的！",
    "只争朝夕，不负韶华。",
    "敢教日月换新天。",
    "团结就是力量。",
    "自己动手，丰衣足食。",
    "自力更生，艰苦奋斗。",
    "劳动最光荣，奋斗最美丽。",
    "星星之火，可以燎原。",
    "世上无难事，只要肯登攀。",
    "数风流人物，还看今朝。",
];

/** 来源类型的中文描述 */
const SOURCE_NAMES: Record<SourceType, string> = {
    slogan: "宣传语",
    quote: "语录",
    paragraph: "文库段落",
    music: "歌曲",
    poster: "海报",
};

/** 红宣传配置 */
export interface Config {
    /** 自定义宣传语列表 */
    customMessages: string[];
    /** 定时任务列表 */
    jobs: JobConfig[];
}

export const Config: Schema<Config> = Schema.object({
    customMessages: Schema.array(String).role("table").default([]).description("自定义宣传语列表"),
    jobs: Schema.array(
        Schema.object({
            cron: Schema.string()
                .default("0 8 * * *")
                .required()
                .description("cron 表达式（5 段：分 时 日 月 周）"),
            sources: Schema.array(
                Schema.object({
                    type: Schema.union([
                        Schema.const("slogan"),
                        Schema.const("quote"),
                        Schema.const("paragraph"),
                        Schema.const("music"),
                        Schema.const("poster"),
                    ]).description("来源类型"),
                    count: Schema.number().default(1).min(1).description("抽取条数"),
                }),
            )
                .default([{ type: "slogan", count: 1 }])
                .description("内容来源列表"),
            targets: Schema.array(Schema.string())
                .default([])
                .description("目标频道 ID 列表（如 onebot:123456 或纯群号）"),
        }),
    )
        .default([])
        .description("定时任务列表"),
});

// ── Service ──────────────────────────────────────────────

export class RedpropagandaService extends Service {
    /** 内置 + 自定义宣传语合并后的完整列表 */
    private messages: string[];

    constructor(ctx: Context, config: Config) {
        super(ctx, "redpropaganda", true);
        this.messages = [...DEFAULT_MESSAGES, ...config.customMessages];
    }

    /** 语料总数 */
    get size(): number {
        return this.messages.length;
    }

    /** 随机抽取一条宣传语 */
    random(): string {
        if (this.messages.length === 0) return "";
        return this.messages[Math.floor(Math.random() * this.messages.length)] ?? "";
    }

    /** 随机抽取 n 条宣传语（可重复） */
    pick(n: number): string[] {
        return Array.from({ length: n }, () => this.random());
    }

    /** 直接发送随机宣传语，返回是否成功发送 */
    async send(session: Session, n = 1): Promise<boolean> {
        if (this.messages.length === 0) return false;
        await session.send(this.pick(n).join("\n"));
        return true;
    }
}

declare module "koishi" {
    interface Context {
        redpropaganda: RedpropagandaService;
    }
}

// ── 内容采集 ──────────────────────────────────────────────

/** 采集单个来源的内容，返回可发送的消息元素/文本列表 */
async function collectSource(ctx: Context, source: SourceConfig): Promise<string[]> {
    const { type, count } = source;
    const logger = ctx.logger("redpropaganda");
    const results: string[] = [];

    switch (type) {
        case "slogan": {
            results.push(...ctx.redpropaganda.pick(count));
            break;
        }
        case "quote": {
            const quoteService = ctx.redquote;
            if (!quoteService) {
                logger.warn("未安装 redquote，跳过语录来源");
                break;
            }
            const quotes = quoteService.pick(count);
            results.push(...quotes.map((q) => quoteService.format(q)));
            break;
        }
        case "paragraph": {
            const archiveService = ctx.redarchive;
            if (!archiveService) {
                logger.warn("未安装 redarchive，跳过文库段落来源");
                break;
            }
            for (let i = 0; i < count; i++) {
                const result = await archiveService.randomParagraph();
                if (!result) continue;
                results.push(
                    `「${result.text}」\n——${result.doc.title}（${result.category.title}）`,
                );
            }
            break;
        }
        case "music": {
            const musicService = ctx.redmusic;
            if (!musicService) {
                logger.warn("未安装 redmusic，跳过歌曲来源");
                break;
            }
            for (let i = 0; i < count; i++) {
                const outcome = musicService.random(1);
                if (!outcome.hit) continue;
                results.push(outcome.audio);
            }
            break;
        }
        case "poster": {
            const posterService = ctx.redposter;
            if (!posterService) {
                logger.warn("未安装 redposter，跳过海报来源");
                break;
            }
            for (let i = 0; i < count; i++) {
                const outcome = await posterService.random();
                if (!outcome.hit) continue;
                results.push(outcome.image);
            }
            break;
        }
    }

    return results;
}

/** 执行一次任务：采集内容并发送到所有目标群 */
async function runJob(ctx: Context, job: JobConfig): Promise<{ sent: boolean; parts: string[] }> {
    const logger = ctx.logger("redpropaganda");

    // 逐个来源采集（串行，避免并发发送音频/图片造成顺序错乱）
    const parts: string[] = [];
    for (const source of job.sources) {
        const items = await collectSource(ctx, source);
        parts.push(...items);
    }

    if (parts.length === 0) {
        logger.warn(`任务 ${job.cron} 未采集到任何内容（检查是否安装了对应插件）`);
        return { sent: false, parts };
    }

    const content = parts.join("\n");

    // 无目标群时按失败处理（配置缺失）
    if (job.targets.length === 0) {
        logger.warn(`任务 ${job.cron} 未配置目标群，已跳过发送`);
        return { sent: false, parts };
    }

    // 发送到所有目标群
    let sent = false;
    for (const channelId of job.targets) {
        try {
            // 兼容纯群号（自动补 onebot: 前缀）与完整频道 ID
            const id = channelId.includes(":") ? channelId : `onebot:${channelId}`;
            await ctx.bots.find((bot) => bot.platform === "onebot")?.sendMessage(id, content);
            logger.info(`已推送至 ${id}（${job.cron}）`);
            sent = true;
        } catch (e) {
            logger.warn(`推送到 ${channelId} 失败: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    return { sent, parts };
}

// ── 插件入口 ──────────────────────────────────────────────

export const inject = {
    required: ["cron"],
};

export function apply(ctx: Context, config: Config) {
    const logger = ctx.logger("redpropaganda");
    ctx.plugin(RedpropagandaService, config);

    // 注册定时任务
    for (const job of config.jobs) {
        if (!job.cron) continue;
        ctx.cron(job.cron, () => {
            logger.info(`定时任务触发: ${job.cron}`);
            return runJob(ctx, job);
        });
        logger.info(
            `已注册定时任务 ${job.cron}（${job.sources.map((s) => SOURCE_NAMES[s.type]).join(", ")}）`,
        );
    }

    // 红宣传 命令（随机口号）
    ctx.command("红宣传 [count:number]", "随机获取一条宣传口号").action((_, count) => {
        const service = ctx.redpropaganda;
        const n = count ?? 1;
        if (service.size === 0) return "当前没有可用宣传语。";
        return service.pick(n).join("\n");
    });

    // 红宣传推送 命令（手动触发定时任务）
    ctx.command("红宣传推送 [index:number]", "立即向配置的目标群推送一次")
        .alias("红宣传手动推送")
        .action(async (_, index) => {
            const jobs = config.jobs;
            if (jobs.length === 0) return "当前没有配置定时任务。";

            // 指定任务序号（从 1 开始）
            if (index !== undefined) {
                const job = jobs[index - 1];
                if (!job) return `任务序号无效，当前共 ${jobs.length} 个任务。`;
                const { sent } = await runJob(ctx, job);
                return sent ? `✅ 已推送任务 ${index}（${job.cron}）` : "⚠️ 推送失败，请查看日志。";
            }

            // 未指定则推送所有任务
            const results = [];
            for (let i = 0; i < jobs.length; i++) {
                const { sent } = await runJob(ctx, jobs[i]);
                results.push(`任务 ${i + 1}（${jobs[i].cron}）: ${sent ? "✅ 已推送" : "⚠️ 失败"}`);
            }
            return results.join("\n");
        });

    // 红宣传推送列表 命令（查看任务）
    ctx.command("红宣传推送列表", "查看已配置的定时任务").action(() => {
        const jobs = config.jobs;
        if (jobs.length === 0) return "当前没有配置定时任务。";
        return jobs
            .map(
                (job, i) =>
                    `任务 ${i + 1}: ${job.cron}\n  - 来源: ${job.sources
                        .map((s) => `${SOURCE_NAMES[s.type]} ×${s.count}`)
                        .join(", ")}\n  - 目标: ${job.targets.join(", ") || "(未配置)"}`,
            )
            .join("\n");
    });
}
