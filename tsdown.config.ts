import yaml from '@rollup/plugin-yaml'
import { defineConfig } from 'tsdown'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)

// 旧源码直接 `require("../locales/zh_CN")`（无扩展名）加载 i18n locales：
// 1. 先把无后缀请求重定向到对应 .yml 文件（@rollup/plugin-yaml 只匹配 .yml 后缀）
// 2. 再由 yaml 插件把 YAML 解析为对象
const resolveYmlLocales = () => ({
    name: 'resolve-yml-locales',
    resolveId(source: string, importer?: string) {
        if (!importer || !source.includes('/locales/') || /\.[a-z]+$/i.test(source)) return null
        const dir = path.dirname(importer).replace(/^file:\/\//, '')
        const abs = path.resolve(dir, source)
        const candidates = ['.yml', '.yaml'].map((ext) => abs + ext)
        for (const file of candidates) {
            try {
                require.resolve(file)
                return file
            } catch {
                /* try next */
            }
        }
        return null
    },
})

// Monorepo 统一构建：根配置作为默认值被 workspace 内所有子包继承。
// 用法：pnpm build（根目录执行 `tsdown -W` 自动发现 packages/* 并逐个构建）。
export default defineConfig({
    // 自动发现 packages 下的所有子包
    workspace: {
        include: ['packages/*'],
    },
    entry: ['src/index.ts'],
    outDir: 'lib',
    dts: true,
    // 源码保持 ESM（package.json 为 type:module，tsconfig/编辑器按 ESM 解析）；
    // 但 Koishi 的 loader 用 require() 加载插件，因此构建产物固定为 CJS（.cjs 扩展名）。
    format: 'cjs',
    platform: 'node',
    outExtensions: () => ({ js: '.cjs', dts: '.d.ts' }),
    clean: true,
    plugins: [resolveYmlLocales(), yaml() as any],
    deps: {
        // 依赖全部 external（koishi 为 peer 单实例），不打进产物。
        bundle: false,
        dts: {
            // koishi 生态 d.ts 用 CJS dts 语法（export = Element）或 namespace 成员
            // re-export（Fragment/Render），dts 打包无法解析 → 生成 d.ts 时保持
            // 外部引用（产物 d.ts 保留 import，消费端由 koishi 提供类型）。
            neverBundle: [/^koishi/, /^@satorijs\//, /^@koishijs\//, /^cordis/, /^minato/, /^cosmokit/],
        },
    },
})
