import type { Context } from "koishi";
import { Schema } from "koishi";
import { registerCommand } from "./command";
import { RedarchiveService } from "./service";
export { RedarchiveService } from "./service";
import type { Config as ConfigType } from "./types";

export const name = "redarchive";

export const usage = `
<style>
  .ra-radio-zh, .ra-radio-en, .ra-radio-ru { display: none; }
  .ra-content-en, .ra-content-ru { display: none; }
  .ra-radio-en:checked ~ .ra-content-zh { display: none; }
  .ra-radio-en:checked ~ .ra-content-en { display: block; }
  .ra-radio-ru:checked ~ .ra-content-zh { display: none; }
  .ra-radio-ru:checked ~ .ra-content-ru { display: block; }
  .ra-lang-switch { text-align: right; margin-bottom: 16px; user-select: none; }
  .ra-lang-switch label {
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
  .ra-lang-switch label:hover { border-color: #4a6ee0; color: #4a6ee0; }
  .ra-radio-zh:checked ~ .ra-lang-switch label[for="ra-zh"],
  .ra-radio-en:checked ~ .ra-lang-switch label[for="ra-en"],
  .ra-radio-ru:checked ~ .ra-lang-switch label[for="ra-ru"] {
    background: #4a6ee0; color: #fff; border-color: #4a6ee0;
  }
</style>
<input type="radio" name="ra-lang" id="ra-zh" class="ra-radio-zh" checked>
<input type="radio" name="ra-lang" id="ra-en" class="ra-radio-en">
<input type="radio" name="ra-lang" id="ra-ru" class="ra-radio-ru">
<div class="ra-lang-switch">
  <label for="ra-zh">🇨🇳 中文</label>
  <label for="ra-en">🇬🇧 English</label>
  <label for="ra-ru">🇷🇺 Русский</label>
</div>

<div class="ra-content-zh">
  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #4a6ee0;">📖 使用说明</h2>
    <ul>
      <li>📚 抓取<strong>中文马克思主义文库</strong>文档，以进行学术研究</li>
      <li>🔗 支持配置多个镜像入口，按优先级依次尝试</li>
      <li>⚡ 仅使用 HTTP 抓取，无需 Playwright</li>
      <li>🧹 HTML 页面自动<strong>清洗正文</strong>（去除导航/页脚/注释噪音），生成 <strong>.md</strong> 文件发送</li>
      <li>📎 直接文件（pdf/epub 等）原样发送；清洗失败自动回退原文件</li>
      <li>📖 <code>马克思段落</code>：随机从文库文档中选一段话发送</li>
      <li>🔌 注入 <code>redarchive</code> 服务，供其他插件通过 <code>ctx.redarchive</code> 调用</li>
    </ul>
  </div>

  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #e0574a;">⚡ 命令</h2>
    <ul>
      <li><code>马克思</code> — 抓取马克思主义文库文档并发送下载附件</li>
      <li><code>马克思段落</code> — 从文库文档中随机选一段话</li>
    </ul>
  </div>

  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #e0574a;">💬 交流与反馈</h2>
    <p>🌟 喜欢这个插件？欢迎加入 QQ 群 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#e0574a;text-decoration:none;"><strong>1071284605</strong></a>【晓插件工坊】进行交流</p>
    <p>🐛 遇到问题？欢迎在群内反馈，或点击 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#e0574a;text-decoration:none;">此链接</a> 加入群聊</p>
  </div>
</div>

<div class="ra-content-en">
  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #4a6ee0;">📖 Usage</h2>
    <ul>
      <li>📚 Scrapes documents from the <strong>Chinese Marxist Internet Archive</strong> for academic research</li>
      <li>🔗 Multiple mirror entries are supported, tried in priority order</li>
      <li>⚡ HTTP-only scraping, no Playwright required</li>
      <li>🧹 HTML pages are auto-<strong>cleaned</strong> (removes nav/footer/comment noise) and sent as <strong>.md</strong> files</li>
      <li>📎 Direct files (pdf/epub etc.) are sent as-is; falls back to the original file when cleaning fails</li>
      <li>📖 <code>马克思段落</code>: sends a random paragraph from a library document</li>
      <li>🔌 Injects the <code>redarchive</code> service, callable via <code>ctx.redarchive</code></li>
    </ul>
  </div>

  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #e0574a;">⚡ Commands</h2>
    <ul>
      <li><code>马克思</code> — scrape a Marxist Internet Archive document and send the downloaded attachment</li>
      <li><code>马克思段落</code> — send a random paragraph from a library document</li>
    </ul>
  </div>
</div>

<div class="ra-content-ru">
  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #4a6ee0;">📖 Использование</h2>
    <ul>
      <li>📚 Извлекает документы из <strong>Китайского марксистского интернет-архива</strong> для академических исследований</li>
      <li>🔗 Поддерживается несколько зеркал, пробуются по приоритету</li>
      <li>⚡ Только HTTP, без Playwright</li>
      <li>🧹 HTML-страницы автоматически <strong>очищаются</strong> (удаляются навигация/подвал/комментарии) и отправляются как <strong>.md</strong></li>
      <li>📎 Прямые файлы (pdf/epub и т.д.) отправляются как есть; при сбое очистки — откат к оригиналу</li>
      <li>📖 <code>马克思段落</code>: случайный абзац из документа архива</li>
      <li>🔌 Внедряет сервис <code>redarchive</code>, доступный через <code>ctx.redarchive</code></li>
    </ul>
  </div>

  <div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h2 style="margin-top: 0; color: #e0574a;">⚡ Команды</h2>
    <ul>
      <li><code>马克思</code> — извлечь документ из архива и отправить загруженное вложение</li>
      <li><code>马克思段落</code> — отправить случайный абзац из документа архива</li>
    </ul>
  </div>
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
    navigationTimeout: Schema.number().default(30_000).description("页面导航超时（毫秒）"),
    cacheDir: Schema.string().default("cache/redseries/redarchive").description("缓存目录"),
    categoryCacheTtlMs: Schema.number()
        .min(0)
        .default(10 * 60 * 1000)
        .description("分类列表缓存有效期（毫秒）"),
    documentCacheTtlMs: Schema.number()
        .min(0)
        .default(10 * 60 * 1000)
        .description("文件列表缓存有效期（毫秒）"),
    promptTimeoutMs: Schema.number().default(60_000).description("用户输入等待超时（毫秒）"),
    maxShownOptions: Schema.number().min(5).max(5000).default(5000).description("展示选项数量上限"),
    optionsChunkSize: Schema.number()
        .min(10)
        .max(200)
        .default(50)
        .description("选项分段发送每段条数"),
    cooldownMs: Schema.number().min(0).default(8000).description("同一用户命令冷却时间（毫秒）"),
});

export function apply(ctx: Context, config: ConfigType) {
    ctx.plugin(RedarchiveService, config);
    registerCommand(ctx, config);
}
