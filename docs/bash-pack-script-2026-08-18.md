# Bash 一键打包脚本（2026-08-18）

## 目标

使用项目根目录的 Bash 脚本完成 Readmdvue 编译和扩展 ZIP 打包，不再要求用户直接执行 JavaScript 打包命令。

## 使用方式

```bash
./pack.sh
```

完整流程：检查 `npm/zip/unzip` → 缺少 `node_modules` 时安装依赖 → `npm run build` → 读取 `dist/manifest.json` 版本号 → 生成 `releases/Readmdvue-v<version>.zip`。

已有最新 `dist/` 时可快速压缩：

```bash
./pack.sh --skip-build
```

`npm run pack` 和 `npm run pack:zip` 也已改为调用上述 Bash 脚本。

## 验证

- `bash -n pack.sh`：通过。
- `./pack.sh`：编译成功，生成 `releases/Readmdvue-v2.1.14.zip`。
- `./pack.sh --skip-build`：跳过编译并重新生成同名 ZIP。
- ZIP 校验：包含 `dist/` 前缀，共 105 个文件，总大小 7,953,648 bytes。
