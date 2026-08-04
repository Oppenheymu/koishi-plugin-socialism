import type { Context, Session } from "koishi";
import { Schema, Service } from "koishi";
import { countByTheme, filterPosters, listThemes, loadIndex, setSensitiveFilter } from "./catalog";
import {
    buildImageElement,
    clearCache,
    ensureImage,
    getCacheDir,
    isCacheReady,
    setCacheDir,
} from "./downloader";
import type { PosterEntry, PosterFilter, RandomOutcome, ThemeEntry } from "./types";

export const name = "redposter";

export const usage = `
<style>
  .rps-radio-zh, .rps-radio-en, .rps-radio-ru { display: none; }
  .rps-content-en, .rps-content-ru { display: none; }
  .rps-radio-en:checked ~ .rps-content-zh { display: none; }
  .rps-radio-en:checked ~ .rps-content-en { display: block; }
  .rps-radio-ru:checked ~ .rps-content-zh { display: none; }
  .rps-radio-ru:checked ~ .rps-content-ru { display: block; }
  .rps-lang-switch { text-align: right; margin-bottom: 16px; user-select: none; }
  .rps-lang-switch label {
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
  .rps-lang-switch label:hover { border-color: #4a6ee0; color: #4a6ee0; }
  .rps-radio-zh:checked ~ .rps-lang-switch label[for="rps-zh"],
  .rps-radio-en:checked ~ .rps-lang-switch label[for="rps-en"],
  .rps-radio-ru:checked ~ .rps-lang-switch label[for="rps-ru"] {
    background: #4a6ee0; color: #fff; border-color: #4a6ee0;
  }
</style>
<input type="radio" name="rps-lang" id="rps-zh" class="rps-radio-zh" checked>
<input type="radio" name="rps-lang" id="rps-en" class="rps-radio-en">
<input type="radio" name="rps-lang" id="rps-ru" class="rps-radio-ru">
<div class="rps-lang-switch">
  <label for="rps-zh">🇨🇳 中文</label>
  <label for="rps-en">🇬🇧 English</label>
  <label for="rps-ru">🇷🇺 Русский</label>
</div>

<div class="rps-content-zh">
  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #4a6ee0;">📖 使用说明</h2>
    <p>🖼️ 发送「红色海报」即可随机收到一张中国社会主义宣传画海报图片</p>
    <p>🗂️ 海报数据来自 <a href="https://chineseposters.net" style="color:#4a6ee0;">chineseposters.net</a>（Stefan Landsberger 的中国宣传画收藏站），索引随包发布，图片按需下载缓存到本地 <code>data/redseries/redposter/</code></p>
    <p>🔤 支持中文别名（大跃进、文革、雷锋、毛主席…）与英文关键词（leap、mao、leifeng…），也支持按年份（如 1958）筛选</p>
    <p>🔇 默认开启<strong>国内政治敏感过滤器</strong>，过滤习近平、文化大革命、江青、四人帮等主题的海报，可在插件配置中关闭</p>
    <p>🔌 注入 <code>redposter</code> 服务，其他插件可通过 <code>ctx.redposter</code> 调用</p>
  </div>

  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #e0574a;">⚡ 命令</h2>
    <ul>
      <li><code>红色海报 [关键词]</code> — 随机发送一张海报，或按主题/关键词筛选（如「红色海报 大跃进」）</li>
      <li><code>红色海报列表 [关键词]</code> — 查看所有可用主题及海报数量</li>
      <li><code>红色海报重载</code> — 清空图片缓存（需 2 级权限）</li>
    </ul>
    <h3 style="color: #e0574a;">🔌 服务 API</h3>
    <ul>
      <li><code>ctx.redposter.random(筛选?)</code> — 随机选取一张并下载图片，返回 image 元素</li>
      <li><code>ctx.redposter.pick(筛选?)</code> — 精确选取一张，返回 image 元素</li>
      <li><code>ctx.redposter.list(筛选?)</code> — 列出匹配海报的元数据（不下载图片）</li>
      <li><code>ctx.redposter.themes(关键词?)</code> — 列出主题</li>
      <li><code>ctx.redposter.send(session, 筛选?)</code> — 直接发送一张海报</li>
    </ul>
  </div>

  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #e0574a;">💬 交流与反馈</h2>
    <p>🌟 喜欢这个插件？欢迎加入 QQ 群 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#e0574a;text-decoration:none;"><strong>1071284605</strong></a>【晓插件工坊】进行交流</p>
    <p>🐛 遇到问题？欢迎在群内反馈，或点击 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#e0574a;text-decoration:none;">此链接</a> 加入群聊</p>
  </div>
</div>

<div class="rps-content-en">
  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #4a6ee0;">📖 Usage</h2>
    <p>🖼️ Send <code>红色海报</code> to receive a random Chinese socialist propaganda poster image</p>
    <p>🗂️ Poster data comes from <a href="https://chineseposters.net" style="color:#4a6ee0;">chineseposters.net</a> (Stefan Landsberger's collection of Chinese propaganda posters); the index is shipped with the package, images are downloaded on demand and cached to <code>data/redseries/redposter/</code></p>
    <p>🔤 Supports Chinese aliases (大跃进、文革、雷锋、毛主席…) and English keywords (leap、mao、leifeng…), as well as year filtering (e.g. 1958)</p>
    <p>🔇 The <strong>domestic politically-sensitive filter</strong> is enabled by default, filtering posters on topics such as Xi Jinping, Cultural Revolution, Jiang Qing, Gang of Four; can be disabled in plugin config</p>
    <p>🔌 Injects the <code>redposter</code> service, callable via <code>ctx.redposter</code></p>
  </div>

  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #e0574a;">⚡ Commands</h2>
    <ul>
      <li><code>红色海报 [keyword]</code> — send a random poster, or filter by theme/keyword (e.g. 「红色海报 大跃进」)</li>
      <li><code>红色海报列表 [keyword]</code> — list all available themes and poster counts</li>
      <li><code>红色海报重载</code> — clear the image cache (requires level 2 permission)</li>
    </ul>
    <h3 style="color: #e0574a;">🔌 Service API</h3>
    <ul>
      <li><code>ctx.redposter.random(filter?)</code> — pick a random poster and download the image, returns an image element</li>
      <li><code>ctx.redposter.pick(filter?)</code> — pick exactly one poster, returns an image element</li>
      <li><code>ctx.redposter.list(filter?)</code> — list metadata of matching posters (no image download)</li>
      <li><code>ctx.redposter.themes(keyword?)</code> — list themes</li>
      <li><code>ctx.redposter.send(session, filter?)</code> — send a poster directly</li>
    </ul>
  </div>
</div>

<div class="rps-content-ru">
  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #4a6ee0;">📖 Использование</h2>
    <p>🖼️ Отправьте <code>红色海报</code>, чтобы получить случайный плакат китайской социалистической пропаганды</p>
    <p>🗂️ Данные о плакатах взяты с <a href="https://chineseposters.net" style="color:#4a6ee0;">chineseposters.net</a> (коллекция китайских пропагандистских плакатов Стефана Ландсбергера); индекс входит в пакет, изображения загружаются по запросу и кэшируются в <code>data/redseries/redposter/</code></p>
    <p>🔤 Поддерживаются китайские алиасы (大跃进、文革、雷锋、毛主席…) и английские ключевые слова (leap、mao、leifeng…), а также фильтр по году (например, 1958)</p>
    <p>🔇 По умолчанию включён <strong>фильтр внутренней политической чувствительности</strong>, отсекающий плакаты на темы Си Цзиньпина, Культурной революции, Цзян Цин, Банды четырёх; можно отключить в конфигурации плагина</p>
    <p>🔌 Внедряет сервис <code>redposter</code>, доступный через <code>ctx.redposter</code></p>
  </div>

  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #e0574a;">⚡ Команды</h2>
    <ul>
      <li><code>红色海报 [ключевое слово]</code> — случайный плакат или фильтр по теме/ключевому слову</li>
      <li><code>红色海报列表 [ключевое слово]</code> — список всех доступных тем и количества плакатов</li>
      <li><code>红色海报重载</code> — очистка кэша изображений (требуется уровень 2)</li>
    </ul>
    <h3 style="color: #e0574a;">🔌 Сервисный API</h3>
    <ul>
      <li><code>ctx.redposter.random(фильтр?)</code> — случайный плакат с загрузкой изображения, возвращает элемент image</li>
      <li><code>ctx.redposter.pick(фильтр?)</code> — точный выбор плаката, возвращает элемент image</li>
      <li><code>ctx.redposter.list(фильтр?)</code> — список метаданных подходящих плакатов (без загрузки)</li>
      <li><code>ctx.redposter.themes(ключевое слово?)</code> — список тем</li>
      <li><code>ctx.redposter.send(session, фильтр?)</code> — отправить плакат напрямую</li>
    </ul>
  </div>
</div>
`;

export interface Config {
    /** 发送海报冷却时间（秒） */
    cooldown: number;
    /** 发图前是否显示海报标题 */
    showTitle: boolean;
    /** 是否过滤国内平台敏感主题（习近平、文化大革命、江青、四人帮） */
    filterSensitive: boolean;
}

export const Config: Schema<Config> = Schema.object({
    cooldown: Schema.number().default(30).min(0).description("发送海报冷却时间（秒）"),
    showTitle: Schema.boolean().default(true).description("发图前是否显示海报标题"),
    filterSensitive: Schema.boolean()
        .default(true)
        .description("国内政治敏感过滤器：过滤习近平、文化大革命、江青、四人帮等主题的海报"),
});

// ── Service ──────────────────────────────────────────────

export class RedPosterService extends Service {
    constructor(ctx: Context) {
        super(ctx, "redposter", true);
    }

    /**
     * 按关键词/主题随机选取一张海报，下载图片并返回 image 元素。
     * 未命中或下载失败时 hit=false。
     */
    async random(filter?: PosterFilter): Promise<RandomOutcome> {
        const pool = filterPosters(filter);
        if (!pool.length) {
            this.ctx.logger("redposter").warn("没有匹配的海报 (filter=%j)", filter);
            return { hit: false };
        }
        const entry = pool[Math.floor(Math.random() * pool.length)];
        const filePath = await ensureImage(this.ctx, entry);
        if (!filePath) return { hit: false };
        const image = buildImageElement(filePath);
        if (!image) return { hit: false };
        return { hit: true, entry, image };
    }

    /** 精确选取一张海报（命中范围内随机），返回 image 元素 */
    async pick(filter?: PosterFilter): Promise<{ entry: PosterEntry; image: string } | null> {
        const result = await this.random(filter);
        if (!result.hit) return null;
        return { entry: result.entry, image: result.image };
    }

    /** 列出匹配海报的元数据（不下载图片） */
    list(filter?: PosterFilter): PosterEntry[] {
        return filterPosters(filter);
    }

    /** 列出主题（支持关键词过滤） */
    themes(keyword?: string): ThemeEntry[] {
        return listThemes(keyword);
    }

    /** 按筛选直接发送一张海报 */
    async send(session: Session, filter?: PosterFilter): Promise<boolean> {
        const result = await this.random(filter);
        if (!result.hit) return false;
        await session.send(result.image);
        return true;
    }
}

declare module "koishi" {
    interface Context {
        redposter: RedPosterService;
    }
}

// ── 插件入口 ──────────────────────────────────────────────

export function apply(ctx: Context, config: Config) {
    ctx.i18n.define("zh", require("../locales/zh_CN"));
    ctx.i18n.define("en", require("../locales/en"));

    ctx.plugin(RedPosterService);
    setSensitiveFilter(config.filterSensitive);

    // 启动时校验索引可用，尽早暴露数据问题
    loadIndex();

    const cacheDir = getCacheDir(ctx);
    setCacheDir(cacheDir);

    const cooldowns = new Map<string, number>();
    function checkCooldown(userId: string): number {
        const now = Date.now();
        const remaining = config.cooldown * 1000 - (now - (cooldowns.get(userId) ?? 0));
        return Math.max(0, remaining);
    }

    // 命令依赖本插件提供的 redposter 服务，用 inject 声明以消除
    // 「property redposter is not registered」警告
    ctx.inject(["redposter"], (ctx) => {
        // ── 红色海报 ──────────────────────────────────────

        ctx.command("红色海报 [关键词:text]", "随机发送一张中国宣传画海报，或按主题/关键词筛选")
            .alias("红海报")
            .usage(
                "直接输入「红色海报」随机发送一张；输入「红色海报 大跃进」按主题筛选；" +
                "支持中文别名与英文关键词，也支持年份（如 1958）",
            )
            .example("红色海报")
            .example("红色海报 大跃进")
            .example("红色海报 leap")
            .example("红色海报 1958")
            .action(async ({ session }, keyword) => {
                if (!session?.userId) return;

                if (!isCacheReady()) {
                    return session.text(".cache-not-ready");
                }

                const remaining = checkCooldown(session.userId);
                if (remaining > 0) {
                    return session.text(".cooldown", [(remaining / 1000).toFixed(0)]);
                }

                const raw = keyword?.trim();
                const filter: PosterFilter | undefined = raw ? { keyword: raw } : undefined;
                // 先检查是否有匹配（纯元数据，不下载），区分「无匹配」与「下载失败」
                const matched = ctx.redposter.list(filter);
                if (!matched.length) {
                    return raw ? session.text(".not-found", [raw]) : session.text(".no-posters");
                }
                const result = await ctx.redposter.random(filter);
                if (!result.hit) {
                    // 有匹配但图片下载失败（网络问题等），避免误报「未找到」
                    return session.text(".download-failed");
                }

                cooldowns.set(session.userId, Date.now());

                const entry = result.entry;
                const parts: string[] = [];
                if (config.showTitle) {
                    const year = entry.year ? `（${entry.year}）` : "";
                    parts.push(`🖼️ ${entry.title}${year}`);
                }
                parts.push(result.image);
                await session.send(parts.join("\n"));
            });

        // ── 红色海报列表 ──────────────────────────────────

        ctx.command("红色海报列表 [关键词:text]", "查看所有可用主题及海报数量")
            .alias("红色海报list")
            .action(({ session }, keyword) => {
                if (!session) return;

                const themes = listThemes(keyword?.trim());
                if (!themes.length) {
                    return keyword
                        ? session.text(".theme-not-found", [keyword.trim()])
                        : session.text(".no-themes");
                }

                const counts = countByTheme();
                const groups = new Map<string, ThemeEntry[]>();
                for (const t of themes) {
                    const list = groups.get(t.category) ?? [];
                    list.push(t);
                    groups.set(t.category, list);
                }

                const lines: string[] = [];
                for (const [category, items] of groups) {
                    lines.push(`【${category}】`);
                    for (const t of items) {
                        lines.push(`- ${t.name} [${counts.get(t.id) ?? 0}]`);
                    }
                }

                const note = keyword ? "" : session.text(".theme-hint");
                return session.text(".theme-list", [themes.length, lines.join("\n"), note]);
            });

        // ── 红色海报重载（管理员） ────────────────────────

        ctx.command("红色海报重载", "清空海报图片缓存（管理员）")
            .alias("红色海报reload")
            .userFields(["authority"])
            .action(async ({ session }) => {
                if (!session) return;
                const user = session.user as { authority?: number } | undefined;
                if ((user?.authority ?? 0) < 2) {
                    return session.text(".permission-denied");
                }
                clearCache();
                return session.text(".cache-cleared");
            });
    });
}
