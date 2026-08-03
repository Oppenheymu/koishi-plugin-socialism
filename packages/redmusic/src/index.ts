import type { Context, Session } from "koishi";
import { Schema, Service } from "koishi";
import { exactPick, listSongs, loadCatalog, randomPick, setAssetsDir } from "./core";
import { downloadAssets, getCacheDir, isCacheReady } from "./downloader";
import { registerListenCommands } from "./listen";
import type { RandomOutcome, SongEntry, SongFilter } from "./types";

export const name = "redmusic";

export const usage = `
<style>
  .rm-radio-zh, .rm-radio-en, .rm-radio-ru { display: none; }
  .rm-content-en, .rm-content-ru { display: none; }
  .rm-radio-en:checked ~ .rm-content-zh { display: none; }
  .rm-radio-en:checked ~ .rm-content-en { display: block; }
  .rm-radio-ru:checked ~ .rm-content-zh { display: none; }
  .rm-radio-ru:checked ~ .rm-content-ru { display: block; }
  .rm-lang-switch { text-align: right; margin-bottom: 16px; user-select: none; }
  .rm-lang-switch label {
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
  .rm-lang-switch label:hover { border-color: #4a6ee0; color: #4a6ee0; }
  .rm-radio-zh:checked ~ .rm-lang-switch label[for="rm-zh"],
  .rm-radio-en:checked ~ .rm-lang-switch label[for="rm-en"],
  .rm-radio-ru:checked ~ .rm-lang-switch label[for="rm-ru"] {
    background: #4a6ee0; color: #fff; border-color: #4a6ee0;
  }
</style>
<input type="radio" name="rm-lang" id="rm-zh" class="rm-radio-zh" checked>
<input type="radio" name="rm-lang" id="rm-en" class="rm-radio-en">
<input type="radio" name="rm-lang" id="rm-ru" class="rm-radio-ru">
<div class="rm-lang-switch">
  <label for="rm-zh">🇨🇳 中文</label>
  <label for="rm-en">🇬🇧 English</label>
  <label for="rm-ru">🇷🇺 Русский</label>
</div>

<div class="rm-content-zh">
  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #4a6ee0;">📖 使用说明</h2>
    <p>✨ 插件是我 vibe 的</p>
    <p>🎵 所有歌曲均已获得 <strong>"小市民红球"</strong> 授权</p>
    <p>📦 音频资源（约 110MB）在插件首次启动时从 GitHub Release 自动下载到本地缓存，不随包发布。若下载失败可执行「红歌重载」指令重试。</p>
    <p>🔌 本插件注入 <code>redmusic</code> 服务，可供其他插件通过 <code>ctx.redmusic</code> 调用：</p>
    <ul>
      <li><code>ctx.redmusic.random(概率?, 过滤?)</code> — 按概率随机选取一首，返回音频元素</li>
      <li><code>ctx.redmusic.pick(过滤)</code> — 精确选取一首（同名多版本时随机），返回音频元素</li>
      <li><code>ctx.redmusic.list(过滤?)</code> — 列出匹配歌曲的元数据（不发送音频）</li>
      <li><code>ctx.redmusic.send(session, 概率?, 过滤?)</code> — 按概率直接发送语音</li>
    </ul>
  </div>

  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #e0574a;">⚡ 命令</h2>
    <ul>
      <li><code>红歌 [歌名]</code> — 随机点一首红歌，或指定歌名；用 /前缀筛选标签</li>
      <li><code>红歌列表</code> — 查看所有可用红歌</li>
      <li><code>红歌重载</code> — 重新下载音频资源（需 2 级权限）</li>
    </ul>
    <h3 style="color: #e0574a;">🏷️ 标签列表</h3>
    <p>纯曲、中版、交响乐、电音、军乐、器乐、稀有版、阅兵版、TNO版、单曲版、波兰、罗马尼亚语</p>
  </div>

  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #4a6ee0;">💬 交流与反馈</h2>
    <p>🌟 喜欢这个插件？欢迎加入 QQ 群 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#4a6ee0;text-decoration:none;"><strong>1071284605</strong></a>【晓插件工坊】进行交流</p>
    <p>🐛 遇到问题？欢迎在群内反馈，或点击 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#4a6ee0;text-decoration:none;">此链接</a> 加入群聊</p>
  </div>
</div>

<div class="rm-content-en">
  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #4a6ee0;">📖 Usage</h2>
    <p>✨ This plugin was made on a vibe</p>
    <p>🎵 All songs are licensed from <strong>"小市民红球"</strong></p>
    <p>📦 Audio assets (~110MB) are auto-downloaded from GitHub Release to the local cache on first startup, not shipped with the package. If the download fails, run <code>红歌重载</code> to retry.</p>
    <p>🔌 This plugin injects the <code>redmusic</code> service, callable by other plugins via <code>ctx.redmusic</code>:</p>
    <ul>
      <li><code>ctx.redmusic.random(probability?, filter?)</code> — pick one song by probability, returns an audio element</li>
      <li><code>ctx.redmusic.pick(filter)</code> — pick exactly one song (random among same-name versions), returns an audio element</li>
      <li><code>ctx.redmusic.list(filter?)</code> — list metadata of matching songs (no audio sent)</li>
      <li><code>ctx.redmusic.send(session, probability?, filter?)</code> — send a voice message by probability</li>
    </ul>
  </div>

  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #e0574a;">⚡ Commands</h2>
    <ul>
      <li><code>红歌 [song]</code> — play a random red song, or specify a name; prefix <code>/</code> filters by tag</li>
      <li><code>红歌列表</code> — list all available red songs</li>
      <li><code>红歌重载</code> — re-download audio assets (requires level 2 permission)</li>
    </ul>
    <h3 style="color: #e0574a;">🏷️ Tags</h3>
    <p>纯曲、中版、交响乐、电音、军乐、器乐、稀有版、阅兵版、TNO版、单曲版、波兰、罗马尼亚语</p>
  </div>
</div>

<div class="rm-content-ru">
  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #4a6ee0;">📖 Использование</h2>
    <p>✨ Плагин сделан на вайбе</p>
    <p>🎵 Все песни лицензированы от <strong>"小市民红球"</strong></p>
    <p>📦 Аудиоресурсы (~110 МБ) автоматически загружаются с GitHub Release в локальный кэш при первом запуске и не входят в пакет. При сбое загрузки выполните команду <code>红歌重载</code> для повторной попытки.</p>
    <p>🔌 Плагин внедряет сервис <code>redmusic</code>, доступный другим плагинам через <code>ctx.redmusic</code>:</p>
    <ul>
      <li><code>ctx.redmusic.random(вероятность?, фильтр?)</code> — случайный выбор одной песни по вероятности, возвращает аудиоэлемент</li>
      <li><code>ctx.redmusic.pick(фильтр)</code> — точный выбор одной песни (при одинаковых названиях — случайно), возвращает аудиоэлемент</li>
      <li><code>ctx.redmusic.list(фильтр?)</code> — список метаданных подходящих песен (аудио не отправляется)</li>
      <li><code>ctx.redmusic.send(session, вероятность?, фильтр?)</code> — отправить голосовое сообщение по вероятности</li>
    </ul>
  </div>

  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #e0574a;">⚡ Команды</h2>
    <ul>
      <li><code>红歌 [название]</code> — случайная красная песня или выбор по названию; префикс <code>/</code> фильтрует по тегам</li>
      <li><code>红歌列表</code> — список всех доступных песен</li>
      <li><code>红歌重载</code> — повторная загрузка аудиоресурсов (требуется уровень 2)</li>
    </ul>
    <h3 style="color: #e0574a;">🏷️ Теги</h3>
    <p>纯曲、中版、交响乐、电音、军乐、器乐、稀有版、阅兵版、TNO版、单曲版、波兰、罗马尼亚语</p>
  </div>
</div>
`;

export interface Config {
    /** 点歌冷却时间（秒） */
    cooldown: number;
    /** 是否在语音前显示歌名 */
    showName: boolean;
    /** 插件启动时是否自动下载音频资源 */
    autoDownload: boolean;
}

export const Config: Schema<Config> = Schema.object({
    cooldown: Schema.number().default(30).min(0).description("点歌冷却时间（秒）"),
    showName: Schema.boolean().default(true).description("是否在语音前显示歌名和标签"),
    autoDownload: Schema.boolean()
        .default(true)
        .description("插件启动时自动下载音频资源（约 110MB）。关闭后需手动执行「红歌重载」"),
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
    async send(session: Session, probability = 1, filter?: SongFilter): Promise<boolean> {
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

    // 加载元数据索引（始终可用，几 KB）
    const catalog = loadCatalog();
    const cacheDir = getCacheDir(ctx);

    // 触发下载并注入 assetsDir 的统一入口
    async function ensureAssets(force = false): Promise<boolean> {
        const ok = await downloadAssets(ctx, cacheDir, catalog, force);
        if (ok) {
            setAssetsDir(cacheDir);
        }
        return ok;
    }

    // 注册指令（把重载回调传进去）
    registerListenCommands(ctx, config, () => ensureAssets(true));

    // 启动时若已就绪，直接注入目录；否则按配置决定是否自动下载
    ctx.on("ready", async () => {
        if (isCacheReady(cacheDir, catalog)) {
            setAssetsDir(cacheDir);
            ctx.logger("redmusic").info("音频缓存已就绪，跳过下载，路径: %s", cacheDir);
            return;
        }

        if (!config.autoDownload) {
            ctx.logger("redmusic").warn(
                "autoDownload 已关闭且本地缓存未就绪，点歌暂不可用。可执行「红歌重载」手动下载。",
            );
            return;
        }

        // 异步下载，不阻塞插件启动（其他指令如「红歌列表」仍可用）
        ctx.logger("redmusic").info("开始下载红歌音频资源（后台）…");
        void ensureAssets(false).then((ok) => {
            if (!ok) {
                ctx.logger("redmusic").warn(
                    "音频资源下载失败，点歌暂不可用。可执行「红歌重载」重试。",
                );
            }
        });
    });
}
