---
name: server-ops
description: Logos server deployment & management via SSH. 正确服务器是阿里云 101.132.34.193（域名 logos.duoban.xyz）。真实运维脚本在 D:/coder/aiWorkSpace/server-ops/server-ops.py（不是本目录下的脚本）。
---

# Logos Server Operations

管理 Logos 生产服务器。**注意：本目录旧脚本已废弃（指向腾讯云），真实运维请用独立仓库脚本。**

## ⚠️ 重要：正确运维入口

```bash
python D:/coder/aiWorkSpace/server-ops/server-ops.py <command>   # 默认 aliyun-logos
python D:/coder/aiWorkSpace/server-ops/server-ops.py -s <server> <command>
```

可用服务器：`aliyun-logos`（本应用）、`aliyun-rike`、`tencent-hymn`。

## 服务器信息（正确）

| 字段 | 值 |
|-------|-----|
| IP | 101.132.34.193（阿里云，有域名） |
| App path | /root/logos |
| PM2 name | logos |
| 内部端口 | 3001（3000 被 rike 主站占用） |
| Caddy | logos.duoban.xyz → 127.0.0.1:3001（Let's Encrypt） |
| 访问 URL | https://logos.duoban.xyz |
| Node | nvm v22.22.3（需 node_prefix） |
| Git 代理 | 仓库已配 http.proxy=127.0.0.1:7890（mihomo），git pull 走代理 |

## 常用命令

```bash
# 状态
python D:/coder/aiWorkSpace/server-ops/server-ops.py status

# 一键部署（git pull → install → prisma push+generate → build → restart → verify）
python D:/coder/aiWorkSpace/server-ops/server-ops.py deploy

# 日志
python D:/coder/aiWorkSpace/server-ops/server-ops.py logs 50

# 执行命令（node 不在 PATH，需 node_prefix）
python D:/coder/aiWorkSpace/server-ops/server-ops.py exec "export PATH=/root/.nvm/versions/node/v22.22.3/bin:\$PATH && <cmd>"

# 远端 CodeBuddy CLI
python D:/coder/aiWorkSpace/server-ops/server-ops.py cli "<prompt>" --save name
```

## 废弃信息（勿用）

- 腾讯云 124.222.74.115（旧服务器，自签名证书，已弃用）
- 本目录 `scripts/server-ops.py`（指向腾讯云的过时脚本）
