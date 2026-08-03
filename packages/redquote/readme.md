# koishi-plugin-redquote

[![npm](https://img.shields.io/npm/v/koishi-plugin-redquote?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-redquote)

## 使用说明

- 收录革命导师经典语录，支持随机抽取
- 可通过配置项添加自定义语录
- 注入 `redquote` 服务，供其它插件调用

## 命令

- `红语录` — 随机获取一条革命语录

## 服务

- `ctx.redquote.random()` — 随机抽取一条语录
- `ctx.redquote.pick(n)` — 随机抽取 n 条语录
- `ctx.redquote.send(session, n?)` — 直接发送随机语录

## 配置项

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `customQuotes` | 自定义语录列表（格式：`作者\|内容`） | `[]` |
| `count` | 每次随机抽取条数 | `1` |