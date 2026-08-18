#!/usr/bin/env node
/**
 * 一键打包 Readmdvue 扩展（发布用 zip）：
 *   npm run build（可选 --skip-build 跳过）→ 压缩 dist/ 为 releases/Readmdvue-v<version>.zip
 *
 * 用法：
 *   npm run pack              # 先 build 再打 zip（推荐，保证 dist 最新）
 *   npm run pack -- --skip-build   # 仅压缩现有 dist/（不重新构建，快）
 *
 * zip 内路径带 dist/ 前缀（与 releases/ 历史包一致：解压后选择 dist 目录加载扩展）。
 */
import { execSync } from 'node:child_process'
import { readFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const skipBuild = process.argv.includes('--skip-build')

if (!skipBuild) {
  console.log('[pack] npm run build ...')
  execSync('npm run build', { cwd: root, stdio: 'inherit' })
} else {
  console.log('[pack] --skip-build：跳过构建，直接压缩现有 dist/')
}

const dist = join(root, 'dist')
const manifestPath = join(dist, 'manifest.json')
if (!existsSync(manifestPath)) {
  console.error('[pack] 未找到 dist/manifest.json——请先 npm run build 或去掉 --skip-build')
  process.exit(1)
}

const version = JSON.parse(readFileSync(manifestPath, 'utf8')).version
const releasesDir = join(root, 'releases')
mkdirSync(releasesDir, { recursive: true })
const zipPath = join(releasesDir, `Readmdvue-v${version}.zip`)

// 先删旧包：zip 同名会追加而非覆盖，旧包多余文件会残留
if (existsSync(zipPath)) rmSync(zipPath)

console.log(`[pack] 压缩 dist/ → ${zipPath}`)
execSync(`zip -r -q "${zipPath}" dist -x "dist/.DS_Store"`, { cwd: root, stdio: 'inherit' })

const summary = execSync(`unzip -l "${zipPath}" | tail -1`, { encoding: 'utf8' }).trim()
console.log(`[pack] 完成：${zipPath}`)
console.log(`[pack] ${summary}`)
