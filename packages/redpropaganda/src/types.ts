/** 内容来源类型 */
export type SourceType = "quote" | "paragraph" | "music" | "poster";

/** 单个内容来源配置 */
export interface SourceConfig {
    /** 来源类型 */
    type: SourceType;
    /** 该来源抽取条数 */
    count: number;
}

/** 单个定时任务配置 */
export interface JobConfig {
    /** cron 表达式（5 段：分 时 日 月 周），如 `0 8 * * *` */
    cron: string;
    /** 内容来源列表 */
    sources: SourceConfig[];
    /** 目标频道 ID 列表（如 onebot:123456 或纯群号） */
    targets: string[];
}
