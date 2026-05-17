# koishi-plugin-redarchive

[![npm](https://img.shields.io/npm/v/koishi-plugin-redarchive?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-redarchive)

## 使用说明

- 抓取中文马克思主义文库文档，以进行学术研究
- 支持配置多个镜像入口，按优先级依次尝试
- 仅使用 HTTP 抓取，无需 Playwright
- 自动检测页面编码（GB2312/GBK/UTF-8）

## 命令

- `马克思` / `marxists` — 交互式选择分类和文件，获取下载链接

## 配置项

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `entryUrls` | 入口 URL 列表（按优先级排列） | marxists.org, incn.tech, architexturez.net |
| `navigationTimeout` | 页面导航超时(ms) | 30000 |
| `cacheDir` | 缓存目录 | cache/redarchive |
| `categoryCacheTtlMs` | 分类缓存有效期(ms) | 600000 |
| `documentCacheTtlMs` | 文档缓存有效期(ms) | 600000 |
| `promptTimeoutMs` | 用户输入等待超时(ms) | 60000 |
| `maxShownOptions` | 展示选项数上限 | 5000 |
| `optionsChunkSize` | 分段发送每段条数 | 50 |
| `cooldownMs` | 同一用户冷却时间(ms) | 8000 |
