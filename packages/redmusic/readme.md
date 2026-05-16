# koishi-plugin-redmusic

[![npm](https://img.shields.io/npm/v/koishi-plugin-redmusic?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-redmusic)

收集了一些红歌，注入到 `ctx` 供其它插件使用。所有歌曲均已获得"小市民红球"授权。

## 指令

| 指令 | 说明 |
| --- | --- |
| `红歌 [歌名]` | 随机点一首红歌，或指定歌名；用 `/` 前缀筛选标签 |
| `红歌列表` | 查看所有可用红歌 |

### 用法示例

```
红歌            # 完全随机
红歌 国际歌      # 指定歌名
红歌 /纯曲       # 按标签筛选
红歌 /纯曲 /交响乐  # 多标签筛选
```

### 可用标签

纯曲、中版、交响乐、电音、军乐、器乐、稀有版、阅兵版、TNO版、单曲版、波兰、罗马尼亚语

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `cooldown` | number | 30 | 点歌冷却时间（秒） |
| `showName` | boolean | true | 是否在语音前显示歌名和标签 |

## 服务 API

本插件注入 `redmusic` 服务，可供其他插件通过 `ctx.redmusic` 调用：

### `ctx.redmusic.random(probability?, filter?)`

按概率随机选取一首歌，返回音频元素。未命中时 `hit=false`。

```ts
const result = ctx.redmusic.random(0.5, { tags: ['纯曲'] })
if (result.hit) {
  await session.send(result.audio)
}
```

### `ctx.redmusic.pick(filter)`

精确选取一首歌（同名多版本时随机），返回音频元素。

```ts
const result = ctx.redmusic.pick({ name: '国际歌' })
```

### `ctx.redmusic.list(filter?)`

列出匹配歌曲的元数据（不发送音频）。

```ts
const songs = ctx.redmusic.list({ tags: ['交响乐'] })
```

### `ctx.redmusic.send(session, probability?, filter?)`

按概率直接发送语音消息，返回是否命中并发送。

```ts
await ctx.redmusic.send(session, 1, { name: '喀秋莎' })
```

## 致谢

所有歌曲资源来自 **小市民红球**，已获授权使用。
