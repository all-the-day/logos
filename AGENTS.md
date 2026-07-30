# Logos — 不背经 APP（会话迁移文档）

## 项目基本信息

| 项 | 值 |
|----|-----|
| 名称 | logos（"太初有道"） |
| 路径 | `d:\coder\aiWorkSpace\logos` |
| 技术栈 | Next.js 15 App Router + TypeScript + Prisma + SQLite + Tailwind v4 + shadcn/ui |
| 部署 | 自有服务器（1.6G 内存），单进程 150-300MB |
| 版本 | 0.1.0（从 bible-memorize 重建的新架子） |

## 架构模式（参考 todoList）

```
Server Component (page.tsx) → 取数据 + 鉴权（直查 Prisma）
        ↓ props
Client Component (*Client.tsx) → 用户交互
        ↓ fetch
API Route (route.ts) → 处理写操作
        ↓
Service Layer (services/*.ts) → 业务逻辑
        ↓
DB Layer (db/*.ts) → Prisma 查询
        ↓
SQLite (prisma/dev.db)
```

## 目录结构

```
logos/
├── app/                         # Next.js App Router
│   ├── layout.tsx               # 根布局 + BottomNav
│   ├── page.tsx                 # 首页 → redirect("/plan")
│   ├── globals.css              # Tailwind + shadcn 主题
│   ├── plan/                    # 学习计划（创建/查看/签到/每日金句）
│   │   ├── page.tsx             # Server Component
│   │   └── PlanClient.tsx       # Client Component
│   ├── learn/                   # 今日学习（展示→背诵→比对→评分）
│   │   ├── page.tsx
│   │   └── LearnClient.tsx
│   ├── review/                  # 复习队列
│   │   ├── page.tsx
│   │   └── ReviewClient.tsx
│   ├── notes/                   # 学习笔记
│   │   ├── page.tsx
│   │   └── NotesClient.tsx
│   ├── settings/                # 数据导出/导入/清除
│   │   ├── page.tsx
│   │   └── SettingsClient.tsx
│   └── api/                     # API 路由
│       ├── plan/route.ts        # POST 创建 / GET 查询 / DELETE 删除
│       ├── card/route.ts        # POST FSRS 评分 + PUT 撤销 / GET 到期卡片
│       ├── note/route.ts         # CRUD 笔记
│       ├── checkin/route.ts      # POST 签到 / GET 状态
│       ├── data/route.ts         # GET 导出 / POST 导入
│       ├── annotation/route.ts   # GET 纲目/注解/串珠
│       └── stats/route.ts        # GET 数据统计
├── components/
│   ├── BottomNav.tsx            # 底部导航（5 个独立 SVG 图标）
│   ├── BottomNavWrapper.tsx     # 路由判断包装器
│   ├── BookSelector.tsx         # 书卷选择器（新约/旧约下拉框）
│   ├── ProgressBar.tsx          # 掌握度三色进度条
│   ├── VerseStudy.tsx           # 经文展示/背诵/比对/评分（共享）
│   ├── AnnotationPanel.tsx      # 纲目/注解/串珠可折叠面板
│   ├── VerseNotes.tsx           # 该节已有笔记展示
│   ├── ToastProvider.tsx        # 轻量级操作反馈 Toast
│   ├── SWRegister.tsx           # PWA Service Worker 注册
│   └── ui/                      # shadcn/ui 基础组件
├── services/                    # 业务逻辑层
│   ├── plan.ts                  # 计划详情、初始化
│   ├── learn.ts                 # 今日任务生成（含主日跳过）
│   ├── review.ts                # 复习队列
│   ├── verse.ts                 # 经文查询
│   └── checkin.ts               # 签到业务
├── db/                          # 数据访问层（Prisma）
│   ├── verse.ts                 # 书卷/经文/注解查询
│   ├── plan.ts                  # 计划 CRUD
│   ├── card.ts                  # FSRS 卡片 CRUD
│   ├── note.ts                  # 笔记 CRUD
│   └── checkin.ts               # 签到记录 + 连续天数计算
├── lib/                         # 工具 + 核心算法
│   ├── prisma.ts                # Prisma 单例
│   ├── utils.ts                 # cn() classname 合并
│   ├── date.ts                  # 日期工具
│   ├── fsrs.ts                  # FSRS 间隔重复算法
│   ├── compare.ts               # LCS 中文经文比对算法
│   └── dailyverse.ts            # 每日金句（日期种子随机）
├── types/index.ts               # 全局 TypeScript 类型
├── prisma/
│   ├── schema.prisma            # 7 张表
│   └── seed.ts                  # 从 data/bible.db 直读导入
├── public/                     # PWA 静态资源
└── scripts/
    └── extract-verses.ts        # 从 bible 项目提取经文（复用旧项目 Python 脚本）
```

## 数据库设计

```
Book 1 ──→ N Verse 1 ──→ 1 Annotation
                1 ──→ N Card      (FSRS 状态)
                1 ──→ N Note      (学习笔记)

Plan (当前计划)    Checkin (签到记录)
```

### FSRS Card 状态机
```
NEW → LEARNING → REVIEW
  ↓       ↓ (AGAIN)
  └→ RELEARNING ──→ LEARNING/REVIEW
```

## 已入库数据

| 书卷 | 经节 | 注解 |
|------|------|------|
| 罗马书 | 433 | ✓ |
| 哥林多前书 | 437 | ✓ |
| 哥林多后书 | 257 | ✓ |
| 加拉太书 | 149 | ✓ |
| 以弗所书 | 152 | ✓ |
| 腓立比书 | 104 | ✓ |
| 歌罗西书 | 95 | ✓ |
| 约翰一书 | 104 | ✓ |
| **合计** | **1731** | **1614** |

数据来源于 `d:\coder\aiWorkSpace\logos\data\bible.db` 和 `bible_kjv.db`，seed.ts 使用 Node 原生 `node:sqlite` 直读，不再经过 JSON 中间产物。

## 提取更多书卷

修改 `prisma/seed.ts` 中的 `DEFAULT_BOOKS` 数组，然后：

```bash
rm -rf prisma/dev.db
npx prisma db push
npx tsx prisma/seed.ts
```

## 目录结构补充

```
logos/
├── .codebuddy/skills/server-ops/ # 服务器运维 skill
│   ├── SKILL.md
│   └── scripts/server-ops.py
├── .mcp.json                    # MCP server 配置（ssh-mcp-server）
├── data/                        # 种子数据（不入 git）
│   ├── bible.db                 # 恢复本 66 卷全本
│   └── bible_kjv.db             # KJV 英文圣经
├── scripts/
│   ├── deploy.ps1               # 本地部署脚本
│   └── extract-verses.ts        # 从 bible 项目提取经文（已废弃，改直读）
├── public/sw.js                 # PWA Service Worker
├── public/manifest.json         # PWA manifest
└── public/icon-*.png            # PWA 图标

## 开发命令

```bash
npm run dev         # http://localhost:3000
npm run build       # 生产构建
npm start           # 生产运行（~200MB 内存）
npm run db:push     # 同步 Prisma schema → SQLite
npm run db:seed     # 导入经文 JSON → SQLite
npm run db:studio   # Prisma 数据库管理界面
```

## 和旧项目的关系

| 维度 | bible-memorize (旧) | logos (新) |
|------|---------------------|-----------|
| 框架 | Next.js 14 Pages Router | Next.js 15 App Router |
| 代码 | 单文件 1017 行 JS | 模块化 TS，分 6 层 |
| 数据 | localStorage + IndexedDB | SQLite + Prisma |
| UI | 手写 CSS | shadcn/ui + Tailwind v4 |
| 样式 | globals.css 1071 行 | Tailwind utility classes |
| 类型 | 无 | 严格 TypeScript |

旧项目保留在 `d:\coder\aiWorkSpace\bible-memorize`，作为算法参考。数据提取脚本继续复用。

## 服务器运维

| 项 | 值 |
|----|-----|
| 服务器 IP | 124.222.74.115 |
| SSH | root / password auth |
| 应用路径 | /root/logos |
| PM2 进程名 | logos |
| 内部端口 | 3000 |
| Caddy 代理 | :8443 → 127.0.0.1:3000 (TLS, self-signed) |
| 访问 URL | https://124.222.74.115:8443 |
| Git 仓库 | https://github.com/all-the-day/logos |

### 部署流程

```bash
# 方式 1：本地 skill 一键部署
python .codebuddy/skills/server-ops/scripts/server-ops.py deploy

# 方式 2：手动 SSH
ssh root@124.222.74.115
cd /root/logos
git pull && npm install && npm run build && pm2 restart logos
```

### 可用 skill 命令

```bash
python .codebuddy/skills/server-ops/scripts/server-ops.py status   # 查看状态
python .codebuddy/skills/server-ops/scripts/server-ops.py deploy   # 一键部署
python .codebuddy/skills/server-ops/scripts/server-ops.py logs     # 查看日志
python .codebuddy/skills/server-ops/scripts/server-ops.py seed     # 重新导入数据
```

### MCP（备用）

已配置 `ssh-mcp-server`（`~/.codebuddy/.mcp.json` + `.mcp.json`），需要重启 CodeBuddy 生效。当前用 paramiko skill 替代。
