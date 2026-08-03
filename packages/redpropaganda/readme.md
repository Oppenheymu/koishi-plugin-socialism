# koishi-plugin-redpropaganda

[![npm](https://img.shields.io/npm/v/koishi-plugin-redpropaganda?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-redpropaganda)

## 使用说明

- 通过 cron 表达式定时向群内推送红色宣传内容：语录、文库段落、歌曲、海报
- 依赖 `cron` 服务（`koishi-plugin-cron-fix`），使用标准 5 段 cron 表达式（分 时 日 月 周）
- 内容全部来自可选依赖 `redquote` / `redarchive` / `redmusic` / `redposter`，未安装对应插件时自动跳过对应来源
- 可配置多个定时任务（jobs），每个任务独立配置来源与目标群

## 命令

- `红宣传推送 [任务序号]` — 立即向配置的目标群手动推送一次（省略序号则推送所有任务）
- `红宣传推送列表` — 查看已配置的定时任务

## 配置项

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `jobs` | 定时任务列表，每项含 `cron` / `sources` / `targets` | `[]` |

### jobs 结构

```jsonc
{
  "jobs": [
    {
      "cron": "0 8 * * *",            // 每天 8:00
      "sources": [
        { "type": "quote", "count": 2 },      // 语录 ×2
        { "type": "poster", "count": 1 }      // 海报 ×1
      ],
      "targets": ["onebot:123456", "123456789"]
    }
  ]
}
```

- `cron`：5 段 cron 表达式（分 时 日 月 周）
- `sources[].type`：`quote`（语录）/ `paragraph`（文库段落）/ `music`（歌曲）/ `poster`（海报）
- `sources[].count`：该来源抽取条数
- `targets`：目标频道 ID 列表，支持完整 ID（`onebot:123456`）或纯群号（自动补 `onebot:` 前缀）
