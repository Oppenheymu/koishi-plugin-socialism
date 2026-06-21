# koishi-plugin-socialism

> Koishi「社会主义」插件集合 · 单仓多包管理

## 子包导航

| 包名 | 路径 | 版本 | 简介 |
|------|------|------|------|
| [koishi-plugin-redmusic](./packages/redmusic) | `packages/redmusic` | ![npm](https://img.shields.io/npm/v/koishi-plugin-redmusic) | 收集红歌并注入 `ctx.redmusic` 服务，供其他插件按概率点歌、随机播放 |
| [koishi-plugin-redarchive](./packages/redarchive) | `packages/redarchive` | ![npm](https://img.shields.io/npm/v/koishi-plugin-redarchive) | 抓取中文马克思主义文库文档，支持多镜像入口、HTTP 纯抓取 |

## 特性一览

### 🎵 redmusic

- 内置红歌音频库（69 首 `.ogg`），已获“小市民红球”授权
- 注入 `redmusic` 服务：`random` / `pick` / `list` / `send` 四个 API
- 命令：`红歌 [歌名]`、`红歌列表`，支持标签筛选
- 可配置冷却时间、是否显示歌名

### 📚 redarchive

- 抓取 [中文马克思主义文库](https://www.marxists.org/chinese/) 文档，用于学术研究
- 支持配置多个镜像入口，按优先级依次尝试
- 仅使用 HTTP 抓取，无需 Playwright
- 内置分类列表 / 文件列表缓存，可配 TTL

## 交流与反馈

遇到问题或有建议？欢迎加入 QQ 群 **[1071284605【晓基地插件工坊】](https://qm.qq.com/q/WngX4RQoca)** 进行交流。

## 许可证

MIT
