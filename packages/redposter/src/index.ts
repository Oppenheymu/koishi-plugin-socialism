import type { Context, Session } from 'koishi';
import { Schema, Service } from 'koishi';
import type { Config as ConfigType } from './types';

export const name = 'redposter';

export const usage = `
<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">📖 使用说明</h2>
  <ul>
    <li>🖼️ 将文字生成<strong>红底白字风格</strong>的文本海报，纯文本实现、无需任何额外依赖</li>
    <li>📐 自动按行居中排版，支持中英文混排</li>
    <li>🔌 注入 <code>redposter</code> 服务，其他插件可通过 <code>ctx.redposter</code> 调用</li>
  </ul>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #e0574a;">⚡ 命令</h2>
  <ul>
    <li><code>红海报 &lt;内容&gt;</code> — 将内容排版为文本海报</li>
    <li><code>红海报标题 &lt;内容&gt;</code> — 将内容排版为大号标题海报</li>
  </ul>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #e0574a;">💬 交流与反馈</h2>
  <p>🌟 喜欢这个插件？欢迎加入 QQ 群 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#e0574a;text-decoration:none;"><strong>1071284605</strong></a>【晓基地插件工坊】进行交流</p>
  <p>🐛 遇到问题？欢迎在群内反馈，或点击 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#e0574a;text-decoration:none;">此链接</a> 加入群聊</p>
</div>
`;

export const Config: Schema<ConfigType> = Schema.object({
    width: Schema.number().default(40).min(12).description('海报宽度（字符数）'),
    title: Schema.string().default('庆祝').description('海报顶部标题（如「庆祝」「热烈祝贺」）'),
});

// ── 工具函数 ─────────────────────────────────────────────

/** 计算字符串显示宽度（CJK 按 2 计） */
function displayWidth(text: string): number {
    let width = 0;
    for (const ch of text) {
        width +=
            /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/.test(
                ch
            )
                ? 2
                : 1;
    }
    return width;
}

/** 按显示宽度填充空格到指定宽度（居中对齐） */
function padCenter(text: string, width: number): string {
    const padding = Math.max(0, width - displayWidth(text));
    const left = Math.floor(padding / 2);
    const right = padding - left;
    return ' '.repeat(left) + text + ' '.repeat(right);
}

/** 将文本按显示宽度切分为多行 */
function wrap(text: string, width: number): string[] {
    const lines: string[] = [];
    let current = '';
    let currentWidth = 0;
    for (const ch of text) {
        const w = displayWidth(ch);
        if (currentWidth + w > width && current) {
            lines.push(current);
            current = '';
            currentWidth = 0;
        }
        current += ch;
        currentWidth += w;
    }
    if (current) lines.push(current);
    return lines.length > 0 ? lines : [''];
}

// ── Service ──────────────────────────────────────────────

export class RedposterService extends Service {
    private options: ConfigType;

    constructor(ctx: Context, config: ConfigType) {
        super(ctx, 'redposter', true);
        this.options = config;
    }

    /** 将文本排版为海报样式并返回 */
    generate(text: string, title = this.options.title): string {
        const width = this.options.width;
        const inner = width - 2;
        const top = '═'.repeat(inner);
        const bottom = '═'.repeat(inner);
        const contentLines = wrap(text, inner).map((line) => `║ ${padCenter(line, inner)} ║`);

        const titleLine = wrap(title, inner).map((line) => `║ ${padCenter(line, inner)} ║`);
        const head = [`╔${top}╗`, ...titleLine, `╠${'═'.repeat(inner)}╣`];
        const tail = [`╚${bottom}╝`];

        return [...head, ...contentLines, ...tail].join('\n');
    }

    /** 直接发送海报文本 */
    async send(session: Session, text: string, title?: string): Promise<boolean> {
        if (!text) return false;
        await session.send(this.generate(text, title));
        return true;
    }
}

declare module 'koishi' {
    interface Context {
        redposter: RedposterService;
    }
}

// ── 插件入口 ──────────────────────────────────────────────

export function apply(ctx: Context, config: ConfigType) {
    ctx.plugin(RedposterService, config);

    ctx.command('红海报 <content:text>', '将内容排版为文本海报').action((_, content) => {
        if (!content) return '请提供海报内容，例如：红海报 热烈庆祝';
        return ctx.redposter.generate(content);
    });

    ctx.command('红海报标题 <content:text>', '将内容排版为大号标题海报').action((_, content) => {
        if (!content) return '请提供标题内容，例如：红海报标题 只争朝夕';
        return ctx.redposter.generate(content, content);
    });
}
