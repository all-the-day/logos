# Logos — 运维手册（无凭据）

> 本文件记录 Logos 生产运维的非凭据信息。
> **凭据（密码、私钥等）绝不写入本仓库**；只存放在仓库外的运维工具配置中。
>
> 生产运维配置以仓库外
> `D:/coder/aiWorkSpace/server-ops/server-ops.py`
> 中的当前配置为唯一权威来源。
>
> 若该工具不存在、无法读取或与本文档冲突，必须停止并报告；
> 不得退回旧腾讯云配置，不得自行拼接 SSH、PM2 或数据库命令。

## 1. 权威运维工具

生产运维的唯一权威来源是仓库外的项目：

```
D:/coder/aiWorkSpace/server-ops/server-ops.py   # 主脚本
D:/coder/aiWorkSpace/server-ops/config.json      # 服务器配置（含凭据，不入库）
```

仓库内 `.codebuddy/skills/server-ops/` 的旧配置不得用于生产。
运维 skill 入口：`.codebuddy/skills/server-ops/SKILL.md`。

## 2. 服务器概览

运维工具中可用的服务器：

| 名称 | 用途 | IP | PM2 名 | 端口 | 域名 |
|------|------|----|--------|------|------|
| `aliyun-logos` | **本应用（Logos）** | 101.132.34.193 | logos | 3001 | https://logos.duoban.xyz |
| `aliyun-rike` | 主站（同一阿里云主机） | 101.132.34.193 | rike | 3000 | https://duoban.xyz |
| `tencent-hymn` | 已弃用（旧服务器） | 124.222.74.115 | hymn-kb | 3000 | 自签名证书，勿用 |

注意：`101.132.34.193` 是**阿里云**主机，上面同时跑 logos（本应用）与 rike（主站）；`rike` 不是腾讯云，腾讯云那台已弃用。

## 3. Logos 生产参数

| 字段 | 值 |
|------|-----|
| 主机 | 101.132.34.193（阿里云） |
| 应用路径 | /root/logos |
| PM2 进程名 | logos |
| 内部端口 | 3001（3000 被 rike 主站占用） |
| 反向代理 | Caddy：logos.duoban.xyz → 127.0.0.1:3001（Let's Encrypt 自动签） |
| 访问 URL | https://logos.duoban.xyz |
| Node | nvm v22.22.3（不在 PATH，需 node_prefix） |
| 内存 | 1.6G，单进程 150-300MB |
| Git 代理 | 服务器仓库已配 http.proxy=127.0.0.1:7890（mihomo），git pull 走代理 |

## 4. 常用命令

```bash
# 状态
python D:/coder/aiWorkSpace/server-ops/server-ops.py status

# 一键部署（git pull → install → prisma push+generate → build → restart → verify）
python D:/coder/aiWorkSpace/server-ops/server-ops.py deploy

# 日志
python D:/coder/aiWorkSpace/server-ops/server-ops.py logs 50

# 指定服务器（默认 aliyun-logos）
python D:/coder/aiWorkSpace/server-ops/server-ops.py -s aliyun-logos status

# 执行命令（node 不在 PATH，需 node_prefix）
python D:/coder/aiWorkSpace/server-ops/server-ops.py exec "export PATH=/root/.nvm/versions/node/v22.22.3/bin:\$PATH && <cmd>"

# 远端 CodeBuddy CLI
python D:/coder/aiWorkSpace/server-ops/server-ops.py cli "<prompt>" --save name
```

## 5. 服务器差异注意

- node 装在 nvm（v22.22.3），pm2 不在 PATH —— 运维脚本已通过 `node_prefix` 处理
- 应用端口 3001（3000 被 duoban.xyz 主站占用）
- 有真实域名 → Caddy 自动签 Let's Encrypt，HTTPS / Service Worker 正常
- 部署脚本含 `prisma db push + generate` 步骤（schema 变更时必需）
- 服务器仅 1.6G 内存，构建 / 进程资源有限

## 6. 操作纪律

- 未经用户明确确认，不得部署、SSH、PM2、推送或操作生产环境。
- 数据迁移、生产数据库修改必须单独确认并先备份。
- 本文件只含非凭据信息；任何新增凭据信息请放入仓库外的 `server-ops/config.json`，不得写入本仓库。
