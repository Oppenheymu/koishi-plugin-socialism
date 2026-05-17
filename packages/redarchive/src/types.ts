/** 爬取相关配置 */
export interface CrawlConfig {
	/** 入口 URL 列表，按优先级排列 */
	entryUrls: string[];
	/** 页面导航超时(ms) */
	navigationTimeout: number;
	/** 缓存目录 */
	cacheDir: string;
	/** 分类缓存 TTL(ms) */
	categoryCacheTtlMs: number;
	/** 文档缓存 TTL(ms) */
	documentCacheTtlMs: number;
}

/** 交互相关配置 */
export interface InteractionConfig {
	/** 用户输入等待超时(ms) */
	promptTimeoutMs: number;
	/** 展示选项数上限 */
	maxShownOptions: number;
	/** 选项分段发送每段条数 */
	optionsChunkSize: number;
}

/** 冷却配置 */
export interface CooldownConfig {
	/** 同一用户冷却时间(ms) */
	cooldownMs: number;
}

/** 全部配置 */
export interface Config extends CrawlConfig, InteractionConfig, CooldownConfig {}

/** 分类条目 */
export interface CategoryItem {
	title: string;
	url: string;
}

/** 文档条目 */
export interface DocumentItem {
	title: string;
	url: string;
	/** 是否为可直接下载的文件(pdf/epub等) */
	isDirectFile: boolean;
}
