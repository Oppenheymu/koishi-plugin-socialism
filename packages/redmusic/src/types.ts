/** index.json 中单首歌的元数据 */
export interface SongEntry {
  /** 文件名（相对于 assets/ 目录） */
  file: string
  /** 简体中文歌名 */
  name: string
  /** 标签列表，如 ['纯曲', '交响乐', '中版'] */
  tags: string[]
}

/** 随机选取 / 精确选取时的过滤选项 */
export interface SongFilter {
  /** 只匹配包含所有指定标签的歌（AND 逻辑） */
  tags?: string[]
  /** 按歌名精确匹配（忽略大小写） */
  name?: string
}

/** random() 的返回结果 */
export interface RandomResult {
  /** 是否命中（概率触发） */
  hit: true
  /** 选中的歌曲条目 */
  entry: SongEntry
  /** h('audio', { src }) 字符串，可直接 session.send */
  audio: string
}

/** random() 未命中时的返回 */
export interface RandomMiss {
  hit: false
}

/** random() 的完整返回类型 */
export type RandomOutcome = RandomResult | RandomMiss
