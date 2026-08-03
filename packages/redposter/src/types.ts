/** 单个主题（来自 chineseposters.net 主题索引） */
export interface ThemeEntry {
    /** 主题 slug（如 great-leap-forward） */
    id: string;
    /** 主题英文名 */
    name: string;
    /** 分类（如 Campaigns - 1949-1965） */
    category: string;
}

/** 单张海报元数据 */
export interface PosterEntry {
    /** 海报 ID（如 e35-586），也是图片文件名 */
    id: string;
    /** 英文标题 */
    title: string;
    /** 出版年份（可能缺失） */
    year?: number;
    /** 原图路径（相对源站根目录，如 /sites/default/files/images/e35-586.jpg） */
    image: string;
    /** 详情页路径（如 /posters/e35-586） */
    page: string;
    /** 所属主题 slug 列表 */
    themes: string[];
}

/** assets/poster-index.json 的整体结构 */
export interface PosterIndex {
    /** 源站根地址 */
    source: string;
    /** 索引生成时间 */
    generated: string;
    themes: ThemeEntry[];
    posters: PosterEntry[];
    /** 中文别名 → 主题 slug */
    aliases: Record<string, string>;
}

/** 选取海报时的筛选条件 */
export interface PosterFilter {
    /** 关键词：匹配中文别名、主题名/slug、海报标题、海报 ID、年份 */
    keyword?: string;
    /** 主题 slug 列表（AND 逻辑） */
    themes?: string[];
}

/** random() 命中：返回图片消息元素 */
export interface PosterHit {
    hit: true;
    entry: PosterEntry;
    /** h('image') 元素，可直接 session.send */
    image: string;
}

/** random() 未命中 */
export interface PosterMiss {
    hit: false;
}

export type RandomOutcome = PosterHit | PosterMiss;
