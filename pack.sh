#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'EOF'
用法:
  ./pack.sh                 编译项目并生成 releases/Readmdvue-v<version>.zip
  ./pack.sh --skip-build    跳过编译，仅压缩现有 dist/
EOF
}

case "${1:-}" in
  "")
    SKIP_BUILD=0
    ;;
  --skip-build)
    SKIP_BUILD=1
    ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    echo "[pack] 未知参数: $1" >&2
    usage >&2
    exit 2
    ;;
esac

for command_name in npm zip unzip; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "[pack] 缺少命令: $command_name" >&2
    exit 1
  fi
done

if [[ ! -d node_modules ]]; then
  echo "[pack] 未找到 node_modules，先安装依赖..."
  npm install
fi

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "[pack] 开始编译项目..."
  npm run build
else
  echo "[pack] --skip-build：跳过编译，使用现有 dist/"
fi

manifest_path="dist/manifest.json"
if [[ ! -f "$manifest_path" ]]; then
  echo "[pack] 未找到 $manifest_path，请先完成编译" >&2
  exit 1
fi

version="$(sed -nE 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$manifest_path" | head -n 1)"
if [[ -z "$version" ]]; then
  echo "[pack] 无法从 $manifest_path 读取版本号" >&2
  exit 1
fi

release_dir="releases"
zip_path="$release_dir/Readmdvue-v${version}.zip"
mkdir -p "$release_dir"
rm -f "$zip_path"

echo "[pack] 正在压缩 dist/ → $zip_path"
zip -r -q "$zip_path" dist -x 'dist/.DS_Store'

echo "[pack] 打包完成: $zip_path"
unzip -l "$zip_path" | tail -n 1
