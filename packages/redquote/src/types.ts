/** 红语录配置 */
export interface Config {
    /** 自定义语录列表，格式：作者|内容 */
    customQuotes: string[];
    /** 每次随机抽取的条数 */
    count: number;
}