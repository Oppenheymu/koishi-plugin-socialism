/** 单条语录 */
export interface QuoteEntry {
    /** 作者 id（marx/engels/lenin/mao/che/stalin） */
    author: string;
    /** 语录正文 */
    text: string;
    /** 出处（可能缺失） */
    source?: string;
    /** 语言：zh / en */
    lang: 'zh' | 'en';
}

/** 作者信息 */
export interface AuthorEntry {
    id: string;
    /** 中文名 */
    name: string;
    /** 英文名 */
    nameEn: string;
}

/** assets/quote-index.json 的整体结构 */
export interface QuoteIndex {
    source: { wikiquote: string; marxists: string };
    generated: string;
    authors: AuthorEntry[];
    quotes: QuoteEntry[];
}

/** 选取语录时的筛选条件 */
export interface QuoteFilter {
    /** 作者 id 或名称（中文/英文） */
    author?: string;
    /** 关键词：匹配语录正文 */
    keyword?: string;
    /** 语言：zh / en */
    lang?: 'zh' | 'en';
}
