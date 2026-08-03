# koishi-plugin-redpropaganda

[![npm](https://img.shields.io/npm/v/koishi-plugin-redpropaganda?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-redpropaganda)

## 使用说明

- 收录红色宣传口号与广播语料，支持随机抽取
- 可通过配置项添加自定义宣传语
- 注入 `redpropaganda` 服务，供其它插件调用

## 命令

- `红宣传` — 随机获取一条宣传口号

## 服务

- `ctx.redpropaganda.random()` — 随机抽取一条宣传语
- `ctx.redpropaganda.pick(n)` — 随机抽取 n 条宣传语
- `ctx.redpropaganda.send(session, n?)` — 直接发送随机宣传语

## 配置项

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `customMessages` | 自定义宣传语列表 | `[]` |
| `count` | 每次随机抽取条数 | `1` |