import type { Context, Session } from 'koishi';
import { Schema, Service } from 'koishi';
import type { Config as ConfigType } from './types';

export const name = 'redpropaganda';

export const usage = `
<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">📖 使用说明</h2>
  <ul>
    <li>📣 收录红色宣传口号与广播语料，支持随机抽取</li>
    <li>📝 可在配置项中添加自定义宣传语</li>
    <li>🔌 注入 <code>redpropaganda</code> 服务，其他插件可通过 <code>ctx.redpropaganda</code> 调用</li>
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
    '听党指挥，能打胜仗，作风优良！',
    '不忘初心，牢记使命！',
    '人民有信仰，民族有希望，国家有力量！',
    '撸起袖子加油干！',
    '幸福都是奋斗出来的！',
    '只争朝夕，不负韶华。',
    '敢教日月换新天。',
    '团结就是力量。',
    '自己动手，丰衣足食。',
    '自力更生，艰苦奋斗。',
    '劳动最光荣，奋斗最美丽。',
    '星星之火，可以燎原。',
    '世上无难事，只要肯登攀。',
    '数风流人物，还看今朝。',
];

export const Config: Schema<ConfigType> = Schema.object({
    customMessages: Schema.array(String).role('table').default([]).description('自定义宣传语列表'),
    count: Schema.number().default(1).min(1).description('每次随机抽取的条数'),
});

// ── Service ──────────────────────────────────────────────

export class RedpropagandaService extends Service {
    /** 内置 + 自定义宣传语合并后的完整列表 */
    private messages: string[];

    constructor(ctx: Context, config: ConfigType) {
        super(ctx, 'redpropaganda', true);
        this.messages = [...DEFAULT_MESSAGES, ...config.customMessages];
    }

    /** 语料总数 */
    get size(): number {
        return this.messages.length;
    }

    /** 随机抽取一条宣传语 */
    random(): string {
        if (this.messages.length === 0) return '';
        return this.messages[Math.floor(Math.random() * this.messages.length)] ?? '';
    }

    /** 随机抽取 n 条宣传语（可重复） */
    pick(n: number): string[] {
        return Array.from({ length: n }, () => this.random());
    }

    /** 直接发送随机宣传语，返回是否成功发送 */
    async send(session: Session, n = 1): Promise<boolean> {
        if (this.messages.length === 0) return false;
        await session.send(this.pick(n).join('\n'));
        return true;
    }
}

declare module 'koishi' {
    interface Context {
        redpropaganda: RedpropagandaService;
    }
}

// ── 插件入口 ──────────────────────────────────────────────

export function apply(ctx: Context, config: ConfigType) {
    ctx.plugin(RedpropagandaService, config);

    ctx.command('红宣传 [count:number]', '随机获取一条宣传口号').action((_, count) => {
        const service = ctx.redpropaganda;
        const n = count ?? config.count;
        if (service.size === 0) return '当前没有可用宣传语。';
        return service.pick(n).join('\n');
    });
}
