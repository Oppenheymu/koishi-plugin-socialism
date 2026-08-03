# koishi-plugin-redposter

[![npm](https://img.shields.io/npm/v/koishi-plugin-redposter?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-redposter)

从 [chineseposters.net](https://chineseposters.net/)（Stefan Landsberger 的中国宣传画收藏站）抓取的中国社会主义宣传画海报库。发送「红色海报」即可收到一张海报图片，支持按主题/关键词筛选。

> **数据说明**：海报元数据索引（298 个主题 / 4400+ 张海报）随 npm 包发布，海报原图在首次请求时按需下载到本地缓存目录（`<koishi数据目录>/data/redposter/`），不热链源站。若需更新索引，可运行 `scripts/crawl.mjs` 重新生成。

## 指令

| 指令 | 说明 |
| --- | --- |
| `红色海报 [关键词]` | 随机发送一张海报，或按主题/关键词筛选 |
| `红色海报列表 [关键词]` | 查看所有可用主题及海报数量 |
| `红色海报重载` | 清空图片缓存（需 2 级及以上权限） |

### 用法示例

```
红色海报              # 完全随机
红色海报 大跃进        # 中文别名筛选
红色海报 leap          # 英文主题名/slug 筛选
红色海报 1958          # 按年份筛选
红色海报列表           # 查看全部主题
红色海报列表 mao       # 搜索主题
```

关键词匹配规则：中文别名（大跃进、文革、雷锋、毛主席…）→ 主题，其次匹配主题名/slug、海报标题、海报 ID、年份。

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `cooldown` | number | 30 | 发送海报冷却时间（秒） |
| `showTitle` | boolean | true | 发图前是否显示海报标题 |

## 缓存目录

海报原图下载到 `<koishi数据目录>/data/redposter/`，按海报 ID 命名（如 `e35-586.jpg`）。图片约 100~500KB/张，首次请求后即本地复用。执行「红色海报重载」可清空缓存强制重新下载。

## 服务 API

本插件注入 `redposter` 服务，可供其他插件通过 `ctx.redposter` 调用。以下接口均为异步（图片需要下载）：

### `ctx.redposter.random(filter?)`

随机选取一张海报并下载图片，返回 image 元素。未命中或下载失败时 `hit=false`。

```ts
const result = await ctx.redposter.random({ keyword: '大跃进' })
if (result.hit) {
  await session.send(result.image)
}
```

### `ctx.redposter.pick(filter?)`

精确选取一张海报（命中范围内随机），返回 `{ entry, image }` 或 `null`。

```ts
const result = await ctx.redposter.pick({ keyword: 'leifeng' })
```

### `ctx.redposter.list(filter?)`

列出匹配海报的元数据（不下载图片）。

```ts
const posters = ctx.redposter.list({ keyword: '1958' })
```

### `ctx.redposter.themes(keyword?)`

列出主题（支持关键词过滤）。

```ts
const themes = ctx.redposter.themes('mao')
```

### `ctx.redposter.send(session, filter?)`

直接发送一张海报，返回是否成功。

```ts
await ctx.redposter.send(session, { keyword: '大跃进' })
```

## 数据来源

- 站点：[chineseposters.net](https://chineseposters.net/)（中国宣传画收藏，含 300+ 主题分类）
- 索引生成：`scripts/crawl.mjs`（Node 脚本，遵循 robots.txt，限并发、带 UA、请求间隔）
- 索引文件：`assets/poster-index.json`（主题、海报、中文别名）
