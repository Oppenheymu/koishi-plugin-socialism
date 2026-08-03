# koishi-plugin-redquote

[![npm](https://img.shields.io/npm/v/koishi-plugin-redquote?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-redquote)

收录革命导师经典语录，发送「红色语录」即可随机收到一条。语录索引（1200+ 条，中英双语）随 npm 包发布，插件零网络依赖。

## 数据源

- [中文维基语录](https://zh.wikiquote.org/)（zh.wikiquote.org）：马克思、恩格斯、列宁、毛泽东、切·格瓦拉、斯大林 6 位人物
- [Marxists.org](https://www.marxists.org/)：马克思 / 恩格斯英文语录（每条带原始出处）

> **过滤说明**：爬虫已剔除 Wikiquote 标注的「衍生/存疑」分区与反犹、种族歧视等攻击性内容；插件运行时默认开启**敏感内容过滤器**（`filterSensitive`），过滤文革/江青/四人帮/习近平等国内平台敏感语录。

## 指令

| 指令 | 说明 |
| --- | --- |
| `红色语录 [作者] [数量]` | 随机获取语录，可按作者 / 数量筛选 |
| `红色语录列表` | 查看所有作者及语录数量 |

### 用法示例

```
红色语录              # 随机一条
红色语录 毛泽东        # 按作者（支持中英文名）
红色语录 3            # 随机 3 条
红色语录 列宁 2        # 按作者取 2 条
红色语录列表           # 查看作者
```

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `count` | number | 1 | 每次随机抽取的条数 |
| `showSource` | boolean | true | 是否显示语录出处 |
| `filterSensitive` | boolean | true | 敏感内容过滤器：过滤文革/江青/四人帮/习近平等语录 |

## 服务 API

本插件注入 `redquote` 服务，可供其他插件通过 `ctx.redquote` 调用：

### `ctx.redquote.random(filter?)`

随机一条语录，未命中返回 `null`。

```ts
const quote = ctx.redquote.random({ author: '毛泽东' })
if (quote) await session.send(ctx.redquote.format(quote))
```

### `ctx.redquote.pick(n, filter?)`

随机 n 条不重复语录。

```ts
const quotes = ctx.redquote.pick(3, { lang: 'zh' })
```

### `ctx.redquote.list(filter?)`

列出匹配语录。

```ts
const quotes = ctx.redquote.list({ keyword: '联合起来' })
```

### `ctx.redquote.authors()`

列出全部作者。

```ts
const authors = ctx.redquote.authors()
```

### `ctx.redquote.format(quote, showSource?)`

将语录格式化为 `「文本」——作者` 的发送文本。

### `ctx.redquote.send(session, filter?)`

直接发送一条随机语录。

```ts
await ctx.redquote.send(session, { author: 'Marx' })
```

筛选条件 `filter`：`{ author?: string; keyword?: string; lang?: 'zh' | 'en' }`。

## 数据索引

- 索引文件：`assets/quote-index.json`（作者 + 语录，约 230KB）
- 生成脚本：`scripts/crawl.mjs`（Node 脚本，需重新生成时运行）
