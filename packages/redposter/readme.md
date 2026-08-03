# koishi-plugin-redposter

[![npm](https://img.shields.io/npm/v/koishi-plugin-redposter?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-redposter)

## 使用说明

- 将文字生成红底白字风格的文本海报（纯文本实现，无需额外依赖）
- 自动按行居中排版，适合宣传标语、庆祝活动等场景
- 注入 `redposter` 服务，供其它插件调用

## 命令

- `红海报 <内容>` — 将内容排版为文本海报
- `红海报标题 <内容>` — 将内容排版为大号标题海报

## 服务

- `ctx.redposter.generate(text)` — 将文本排版为海报样式并返回
- `ctx.redposter.send(session, text)` — 直接发送海报文本

## 配置项

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `width` | 海报宽度（字符数） | `40` |
| `title` | 海报顶部标题（如「庆祝」） | `庆祝` |