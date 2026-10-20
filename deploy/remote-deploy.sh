#!/usr/bin/env bash
# 服务器侧部署脚本（由 GitHub Actions 上传产物后通过 SSH 调用）
# 用法：bash remote-deploy.sh <git-sha>
# 前置：产物已解包到 /root/logos/releases/<git-sha>/
set -euo pipefail

SHA="${1:?用法: remote-deploy.sh <git-sha>}"
BASE=/root/logos
REL="$BASE/releases/$SHA"
export PATH=/root/.nvm/versions/node/v22.22.3/bin:$PATH

echo "=== logos deploy $SHA $(date '+%F %T') ==="

[ -f "$REL/server.js" ] || { echo "产物不完整：$REL/server.js 不存在"; exit 1; }
[ -f "$BASE/shared/.env" ] || { echo "缺少 $BASE/shared/.env（见 deploy/README.md）"; exit 1; }

mkdir -p "$BASE/releases" "$BASE/shared" "$BASE/incoming"

# 经文源库（data/bible.db、data/bible_kjv.db）不入 git，发布产物里也没有；
# 放在 shared/data 供 current/data 软链引用，避免每个版本重复携带 ~30MB。
if [ -f "$BASE/shared/data/bible.db" ]; then
  rm -rf "$REL/data"
  ln -sfn "$BASE/shared/data" "$REL/data"
else
  echo "警告：$BASE/shared/data/bible.db 不存在，管理员“导入书卷”将不可用（见 deploy/README.md）"
fi

# PM2 配置与运维脚本跟随仓库走，每次部署同步一份到 shared/（路径稳定，跨版本不变）
cp -f "$REL/deploy/ecosystem.config.js" "$BASE/shared/ecosystem.config.js"
cp -f "$REL"/deploy/*.sh "$BASE/shared/"

# 切软链：PM2 始终通过 current 启动
PREV="$(readlink -f "$BASE/current" 2>/dev/null || true)"

# 旧布局的 PM2 进程是 `npm start`，直接 startOrReload 不会替换 script/cwd；
# 首次部署（或检测到进程不是 current/server.js）时先 delete，让新配置真正接管。
NEED_DELETE=0
if [ -z "$PREV" ]; then
  NEED_DELETE=1
elif pm2 describe logos >/dev/null 2>&1; then
  CURRENT_SCRIPT="$(pm2 jlist 2>/dev/null | python3 -c "import sys,json; apps=json.load(sys.stdin); print(next((a.get('pm2_env',{}).get('pm_exec_path','') for a in apps if a.get('name')=='logos'), ''))" 2>/dev/null || true)"
  case "$CURRENT_SCRIPT" in
    */current/server.js) ;;
    *) NEED_DELETE=1 ;;
  esac
fi

ln -sfn "$REL" "$BASE/current"

cd "$BASE"
if [ "$NEED_DELETE" = "1" ]; then
  echo "检测到旧进程或首次部署，删除 PM2 条目以应用新配置（短暂停机）"
  pm2 delete logos || true
fi
pm2 startOrReload "$BASE/shared/ecosystem.config.js" --update-env
pm2 save

# 健康检查
code=""
for _ in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 5 http://127.0.0.1:3001/login || true)
  [ "$code" = "200" ] && break
  sleep 2
done

if [ "$code" != "200" ]; then
  echo "健康检查失败（/login -> ${code:-无响应}），最近日志："
  pm2 logs logos --lines 30 --nostream || true
  if [ -n "$PREV" ] && [ -d "$PREV" ]; then
    echo "回滚到上一版本：$PREV"
    ln -sfn "$PREV" "$BASE/current"
    pm2 startOrReload "$BASE/shared/ecosystem.config.js" --update-env || true
    pm2 save || true
  else
    echo "首次部署失败，尝试恢复旧进程（/root/logos 的 npm start）"
    cd /root/logos && NODE_ENV=production PORT=3001 HOSTNAME=127.0.0.1 pm2 start npm --name logos -- start || true
    pm2 save || true
  fi
  exit 1
fi
echo "健康检查通过（/login -> 200）"

# 只保留最近 5 个版本
ls -1dt "$BASE"/releases/* 2>/dev/null | tail -n +6 | xargs -r rm -rf

rm -f "$BASE/incoming/logos-release.tar.gz"
echo "=== LOGOS_DEPLOY_DONE $SHA $(date '+%F %T') ==="
