# Logos 部署（GitHub Actions 构建，服务器只接收产物）

**产物在 GitHub Actions 上构建，生产服务器只接收和解包。**
服务器只有 1.6G 内存（还与 rike / bible-kv 等应用共享），**永远不要在服务器上跑 `npm ci` / `npm run build`** —— rike 在 2026-09-16 因此连续两次 OOM 拖死整机。

## 架构

```
push master
   ↓ GitHub Actions (ubuntu-24.04, Node 22)
npm ci → prisma generate → next build(standalone) → logos-release.tar.gz
   ↓ scp
/root/logos/incoming/logos-release.tar.gz
   ↓ SSH: bash deploy/remote-deploy.sh <git-sha>
/root/logos/releases/<git-sha>/        ← 解包后的 standalone 产物
/root/logos/current → releases/<sha>   ← 软链
   ↓
pm2（shared/ecosystem.config.js，跑 current/server.js:3001）→ Caddy → logos.duoban.xyz
```

| 路径 | 说明 |
|---|---|
| `releases/<sha>/` | 每次部署的产物，脚本自动保留最近 5 个 |
| `current` | 指向当前版本的软链（回滚就是改它） |
| `shared/.env` | **运行时环境变量的唯一真源**（至少包含 `DATABASE_URL`） |
| `shared/ecosystem.config.js` | 每次部署由脚本从产物同步 |
| `incoming/` | 上传的 tarball 落地处 |
| `shared/data/` | 经文源库（`bible.db` / `bible_kjv.db`），供 `current/data` 软链引用；不入 git |
| `prisma/dev.db` | SQLite 数据库，**保持在旧位置，不在 releases 里，部署永远不会碰到** |

## 一次性设置（服务器上执行，只需一次）

以下命令在服务器 `/root/logos` 下执行。

1. **备份数据库与现有环境变量**（必须）：

```bash
cd /root/logos
cp prisma/dev.db "prisma/dev.db.bak-$(date +%Y%m%d-%H%M%S)"
cp .env ".env.bak-$(date +%Y%m%d-%H%M%S)"
```

2. **创建部署目录，并把经文源库放到 shared/data**：

```bash
mkdir -p /root/logos/{releases,shared,incoming,shared/data}
cp -a /root/logos/data/. /root/logos/shared/data/
ls -lh /root/logos/shared/data/bible.db /root/logos/shared/data/bible_kjv.db
```

> `data/*.db` 不入 git，CI 构建产物里没有这两个文件；部署脚本会把 `current/data` 软链到 `shared/data`。漏了这一步，管理员“导入书卷”会在新版本里失效。

3. **设置运行时环境变量**（关键：`DATABASE_URL` 必须用绝对路径）：

```bash
cat > /root/logos/shared/.env <<'EOF'
DATABASE_URL="file:/root/logos/prisma/dev.db"
EOF
chmod 600 /root/logos/shared/.env
```

> 为什么必须是绝对路径：standalone 进程的 cwd 是 `releases/<sha>/`，相对路径 `file:./dev.db` 会解析到发布目录里，创建一个空数据库。旧 checkout 里 `.env` 的 `file:./dev.db` 不能直接复用。
>
> 如果现有数据库不在 `/root/logos/prisma/dev.db`，把上面的路径换成真实位置；**不要**在部署脚本里移动或删除数据库。

4. **生成 CI 专用 SSH 密钥**，并把公钥加入 `authorized_keys`：

```bash
ssh-keygen -t ed25519 -C "github-actions-logos" -f /root/.ssh/github_logos -N ""
cat /root/.ssh/github_logos.pub >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
```

5. **在 GitHub 仓库 Secrets 中配置**（Settings → Secrets and variables → Actions）：

| Secret | 值 |
|---|---|
| `SSH_HOST` | `101.132.34.193` |
| `SSH_USER` | `root` |
| `SSH_KEY` | `/root/.ssh/github_logos` 的私钥全文 |
| `SSH_PORT` | `22`（可省，默认 22） |

6. **首次部署会自动接管旧进程**：`remote-deploy.sh` 会检测当前 PM2 进程是否还是旧的 `npm start`（或 `current` 尚不存在），命中时自动 `pm2 delete logos` 再按新 ecosystem 启动。这一次会有短暂停机，之后部署走 `startOrReload`，不再删除。若想提前手动停机，可执行：

```bash
export PATH=/root/.nvm/versions/node/v22.22.3/bin:$PATH
pm2 delete logos || true
pm2 save
```

7. **首次部署**：push 到 `master`，或在 Actions 页面手动运行 `Deploy` workflow。

8. **首次部署后确认**：

```bash
export PATH=/root/.nvm/versions/node/v22.22.3/bin:$PATH
pm2 list
pm2 logs logos --lines 50 --nostream
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/login   # 应为 200
curl -s -o /dev/null -w '%{http_code}\n' https://logos.duoban.xyz/login
```

9. **禁用旧部署入口**（仓库外的 `server-ops` 配置；aliyun-logos 已于 2026-10-20 配置）：

在 `D:/AIWorkSpace/project/server-ops/config.json` 的 `aliyun-logos` 下增加：

```json
"deploy_disabled": true,
"deploy_hint": "logos 的构建在 GitHub Actions 完成（push master 自动部署），服务器只接收 .next/standalone 产物。禁止在服务器上跑 npm install / next build。见 logos 仓库 deploy/README.md。"
```

否则 `python server-ops.py deploy` 仍会在服务器上 `npm install + next build`，可能把整机 OOM。

## 日常操作

```bash
export PATH=/root/.nvm/versions/node/v22.22.3/bin:$PATH

pm2 logs logos                 # 看日志
pm2 list                       # 看状态
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/login
```

### 回滚

```bash
ln -sfn /root/logos/releases/<旧sha> /root/logos/current
pm2 startOrReload /root/logos/shared/ecosystem.config.js --update-env
pm2 save
```

### schema 变更（`prisma/schema.prisma`）

**部署流程不会自动跑 `prisma db push`**，这是有意的：数据库变更必须先备份、单独确认。

```bash
cd /root/logos
cp prisma/dev.db "prisma/dev.db.bak-$(date +%Y%m%d-%H%M%S)"
DATABASE_URL="file:/root/logos/prisma/dev.db" ./node_modules/.bin/prisma db push
```

旧 checkout 里的 `node_modules` 只用于 Prisma CLI，**不要**在这里跑 `npm install` / `next build`。如果旧 checkout 已被清理，改为在本地导出 schema 后按变更计划处理，不要在服务器上重新安装依赖。

## 注意事项

- 不得把 `prisma/dev.db`、`.env*`、SSH 私钥提交到仓库。
- 部署脚本只操作 `releases/`、`current`、`incoming/` 和 `shared/`；数据库与 `.env` 不在发布目录内。
- 健康检查使用 `/login`；如果登录页行为改变，需同步修改 `remote-deploy.sh`。
- 构建失败或健康检查失败时，workflow 会停止；旧版本仍在 `current` 上运行，可手动回滚。
- GitHub Actions 首次运行需要仓库 Secrets 已配置；未配置时会在上传/SSH 步骤失败，不会影响现有生产进程。
