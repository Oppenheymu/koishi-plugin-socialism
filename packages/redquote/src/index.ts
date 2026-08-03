import type { Context, Session } from 'koishi';
import { Schema, Service } from 'koishi';
import type { Config as ConfigType } from './types';

export const name = 'redquote';

export const usage = `
<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">📖 使用说明</h2>
  <ul>
    <li>📜 收录革命导师经典语录，支持随机抽取</li>
    <li>📝 可在配置项中通过 <code>作者|内容</code> 格式添加自定义语录</li>
    <li>🔌 注入 <code>redquote</code> 服务，其他插件可通过 <code>ctx.redquote</code> 调用</li>
  </ul>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #e0574a;">💬 交流与反馈</h2>
  <p>🌟 喜欢这个插件？欢迎加入 QQ 群 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#e0574a;text-decoration:none;"><strong>1071284605</strong></a>【晓基地插件工坊】进行交流</p>
  <p>🐛 遇到问题？欢迎在群内反馈，或点击 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#e0574a;text-decoration:none;">此链接</a> 加入群聊</p>
</div>
`;

/** 内置语录库 */
const DEFAULT_QUOTES: string[] = [
    '全世界无产者，联合起来！—— 卡尔·马克思',
    '哲学家们只是用不同的方式解释世界，而问题在于改变世界。—— 卡尔·马克思',
    '人的本质不是单个人所固有的抽象物，在其现实性上，它是一切社会关系的总和。—— 卡尔·马克思',
    '资产阶级在它的不到一百年的阶级统治中所创造的生产力，比过去一切世代创造的全部生产力还要多，还要大。—— 卡尔·马克思',
    '让统治阶级在共产主义革命面前发抖吧。无产者在这个革命中失去的只是锁链，他们获得的将是整个世界。—— 卡尔·马克思',
    '一个民族想要站在科学的最高峰，就一刻也不能没有理论思维。—— 弗里德里希·恩格斯',
    '劳动创造了人本身。—— 弗里德里希·恩格斯',
    '所谓“社会主义社会”不是一种一成不变的东西，而应当和任何其他社会制度一样，把它看成是经常变化和改革的社会。—— 弗里德里希·恩格斯',
    '没有革命的理论，就不会有革命的运动。—— 弗拉基米尔·列宁',
    '堡垒最容易从内部攻破。—— 弗拉基米尔·列宁',
    '忘记过去就意味着背叛。—— 弗拉基米尔·列宁',
    '我们唯一恐惧的就是恐惧本身。—— 富兰克林·罗斯福',
    '枪杆子里面出政权。—— 毛泽东',
    '星星之火，可以燎原。—— 毛泽东',
    '为人民服务。—— 毛泽东',
    '世界上怕就怕“认真”二字，共产党就最讲“认真”。—— 毛泽东',
    '雄关漫道真如铁，而今迈步从头越。—— 毛泽东',
    '多少事，从来急；天地转，光阴迫。一万年太久，只争朝夕。—— 毛泽东',
];

export const Config: Schema<ConfigType> = Schema.object({
    customQuotes: Schema.array(String)
        .role('table')
        .default([])
        .description('自定义语录列表，格式：作者|内容'),
    count: Schema.number().default(1).min(1).description('每次随机抽取的条数'),
});

// ── Service ──────────────────────────────────────────────

export class RedquoteService extends Service {
    /** 内置 + 自定义语录合并后的完整列表 */
    private quotes: string[];

    constructor(ctx: Context, config: ConfigType) {
        super(ctx, 'redquote', true);
        this.quotes = [...DEFAULT_QUOTES, ...config.customQuotes];
    }

    /** 语料总数 */
    get size(): number {
        return this.quotes.length;
    }

    /** 随机抽取一条语录 */
    random(): string {
        if (this.quotes.length === 0) return '';
        return this.quotes[Math.floor(Math.random() * this.quotes.length)] ?? '';
    }

    /** 随机抽取 n 条语录（可重复） */
    pick(n: number): string[] {
        return Array.from({ length: n }, () => this.random());
    }

    /** 直接发送随机语录，返回是否成功发送 */
    async send(session: Session, n = 1): Promise<boolean> {
        if (this.quotes.length === 0) return false;
        await session.send(this.pick(n).join('\n'));
        return true;
    }
}

declare module 'koishi' {
    interface Context {
        redquote: RedquoteService;
    }
}

// ── 插件入口 ──────────────────────────────────────────────

export function apply(ctx: Context, config: ConfigType) {
    ctx.plugin(RedquoteService, config);

    ctx.command('红语录 [count:number]', '随机获取革命语录').action((_, count) => {
        const service = ctx.redquote;
        const n = count ?? config.count;
        if (service.size === 0) return '当前没有可用语录。';
        return service.pick(n).join('\n');
    });
}
