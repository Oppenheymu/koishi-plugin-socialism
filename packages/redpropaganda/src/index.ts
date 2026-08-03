import { type Context, Schema } from "koishi";
import type { } from "koishi-plugin-cron-fix";
import type { } from "koishi-plugin-redarchive";
import type { } from "koishi-plugin-redmusic";
import type { } from "koishi-plugin-redposter";
import type { } from "koishi-plugin-redquote";
import type { JobConfig, SourceConfig, SourceType } from "./types";

export const name = "redpropaganda";

export const usage = `
<style>
  .rpg-radio-zh, .rpg-radio-en, .rpg-radio-ru { display: none; }
  .rpg-content-en, .rpg-content-ru { display: none; }
  .rpg-radio-en:checked ~ .rpg-content-zh { display: none; }
  .rpg-radio-en:checked ~ .rpg-content-en { display: block; }
  .rpg-radio-ru:checked ~ .rpg-content-zh { display: none; }
  .rpg-radio-ru:checked ~ .rpg-content-ru { display: block; }
  .rpg-lang-switch { text-align: right; margin-bottom: 16px; user-select: none; }
  .rpg-lang-switch label {
    display: inline-block;
    padding: 4px 14px;
    font-size: 12px;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    cursor: pointer;
    background: #fff;
    color: #666;
    margin-left: 8px;
    transition: all 0.2s;
  }
  .rpg-lang-switch label:hover { border-color: #4a6ee0; color: #4a6ee0; }
  .rpg-radio-zh:checked ~ .rpg-lang-switch label[for="rpg-zh"],
  .rpg-radio-en:checked ~ .rpg-lang-switch label[for="rpg-en"],
  .rpg-radio-ru:checked ~ .rpg-lang-switch label[for="rpg-ru"] {
    background: #4a6ee0; color: #fff; border-color: #4a6ee0;
  }
</style>
<input type="radio" name="rpg-lang" id="rpg-zh" class="rpg-radio-zh" checked>
<input type="radio" name="rpg-lang" id="rpg-en" class="rpg-radio-en">
<input type="radio" name="rpg-lang" id="rpg-ru" class="rpg-radio-ru">
<div class="rpg-lang-switch">
  <label for="rpg-zh">🇨🇳 中文</label>
  <label for="rpg-en">🇬🇧 English</label>
  <label for="rpg-ru">🇷🇺 Русский</label>
</div>

<div class="rpg-content-zh">
  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #4a6ee0;">📖 使用说明</h2>
    <ul>
      <li>📣 定时向群内发送红色宣传内容（语录/文库段落/歌曲/海报）</li>
      <li>🕐 依赖 <code>cron</code> 服务（koishi-plugin-cron-fix），使用 cron 表达式定时触发</li>
      <li>🔌 内容全部来自可选依赖 <code>redquote</code> / <code>redarchive</code> / <code>redmusic</code> / <code>redposter</code>，未安装对应服务时自动跳过对应来源</li>
      <li>📝 可配置多个定时任务（jobs），每个任务独立配置来源与目标群</li>
    </ul>
  </div>

  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #4a6ee0;">⚡ 命令</h2>
    <ul>
      <li><code>红宣传推送 [任务序号]</code> — 立即向配置的目标群手动推送一次（省略序号则推送所有任务）</li>
      <li><code>红宣传推送列表</code> — 查看已配置的定时任务</li>
    </ul>
  </div>

  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #e0574a;">💬 交流与反馈</h2>
    <p>🌟 喜欢这个插件？欢迎加入 QQ 群 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#e0574a;text-decoration:none;"><strong>1071284605</strong></a>【晓插件工坊】进行交流</p>
    <p>🐛 遇到问题？欢迎在群内反馈，或点击 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#e0574a;text-decoration:none;">此链接</a> 加入群聊</p>
  </div>
</div>

<div class="rpg-content-en">
  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #4a6ee0;">📖 Usage</h2>
    <ul>
      <li>📣 Sends red propaganda content (quotes/archive paragraphs/songs/posters) to groups on a schedule</li>
      <li>🕐 Depends on the <code>cron</code> service (koishi-plugin-cron-fix), triggered by cron expressions</li>
      <li>🔌 Content comes from optional dependencies <code>redquote</code> / <code>redarchive</code> / <code>redmusic</code> / <code>redposter</code>; sources whose service is not installed are skipped automatically</li>
      <li>📝 Multiple scheduled jobs are supported, each with its own sources and target groups</li>
    </ul>
  </div>

  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #4a6ee0;">⚡ Commands</h2>
    <ul>
      <li><code>红宣传推送 [job index]</code> — manually push once to the configured target groups (omit the index to push all jobs)</li>
      <li><code>红宣传推送列表</code> — view the configured scheduled jobs</li>
    </ul>
  </div>
</div>

<div class="rpg-content-ru">
  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #4a6ee0;">📖 Использование</h2>
    <ul>
      <li>📣 Регулярно отправляет в группы красный пропагандистский контент (цитаты/абзацы из архива/песни/плакаты)</li>
      <li>🕐 Зависит от сервиса <code>cron</code> (koishi-plugin-cron-fix), запускается по cron-выражениям</li>
      <li>🔌 Контент поступает из опциональных зависимостей <code>redquote</code> / <code>redarchive</code> / <code>redmusic</code> / <code>redposter</code>; источники без установленного сервиса автоматически пропускаются</li>
      <li>📝 Поддерживается несколько задач (jobs), каждая с собственными источниками и целевыми группами</li>
    </ul>
  </div>

  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #4a6ee0;">⚡ Команды</h2>
    <ul>
      <li><code>红宣传推送 [номер задачи]</code> — немедленно отправить разовое сообщение в настроенные группы (без номера — все задачи)</li>
      <li><code>红宣传推送列表</code> — просмотр настроенных задач</li>
    </ul>
  </div>
</div>
<img src="https://i0.hdslb.com/bfs/archive/f03cc4cc1b32799e9f8dcc4d69a6cdb653883aa2.jpg" style="max-width:100%;border-radius:10px;display:block;margin-top:8px;" alt="世界人民大团结万岁">`;

/** 来源类型的中文描述 */
const SOURCE_NAMES: Record<SourceType, string> = {
    quote: "语录",
    paragraph: "文库段落",
    music: "歌曲",
    poster: "海报",
};

/** 红宣传配置 */
export interface Config {
    /** 定时任务列表 */
    jobs: JobConfig[];
}

export const Config: Schema<Config> = Schema.object({
    jobs: Schema.array(
        Schema.object({
            cron: Schema.string()
                .default("0 8 * * *")
                .pattern(
                    /^(\*|[0-9]{1,2})(\/(\*|[0-9]{1,2}))? ([1-5]?[0-9](\/[1-5]?[0-9])?|\*)( (\*|[1-5]?[0-9])(\/(\*|[1-5]?[0-9])?)?)( (\*|[1-5]?[0-9])(\/(\*|[1-5]?[0-9])?)?)( (\*|[1-5]?[0-9])(\/(\*|[1-5]?[0-9])?)?)$/
                )
                .required()
                .description("cron 表达式（5 段：分 时 日 月 周）"),
            sources: Schema.array(
                Schema.object({
                    type: Schema.union([
                        Schema.const("quote"),
                        Schema.const("paragraph"),
                        Schema.const("music"),
                        Schema.const("poster"),
                    ]).description("来源类型"),
                    count: Schema.number().default(1).min(1).description("抽取条数"),
                }),
            )
                .default([{ type: "quote", count: 1 }])
                .description("内容来源列表"),
            targets: Schema.array(Schema.string())
                .default([])
                .description("目标频道 ID 列表（如 onebot:123456 或纯群号）"),
        }),
    )
        .default([])
        .description("定时任务列表"),
});

// ── 内容采集 ──────────────────────────────────────────────

/** 采集单个来源的内容，返回可发送的消息元素/文本列表 */
async function collectSource(ctx: Context, source: SourceConfig): Promise<string[]> {
    const { type, count } = source;
    const logger = ctx.logger("redpropaganda");
    const results: string[] = [];

    switch (type) {
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
