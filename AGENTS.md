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
│       ├── card/route.ts        # POST FSRS 评分 / GET 到期卡片
│       ├── note/route.ts        # CRUD 笔记
│       ├── checkin/route.ts     # POST 签到 / GET 状态
│       └── data/route.ts        # GET 导出 / POST 导入
├── components/
│   ├── BottomNav.tsx            # 底部导航（计划/学习/复习/笔记/设置）
│   ├── BottomNavWrapper.tsx     # 路由判断包装器
│   ├── BookSelector.tsx         # 书卷选择器（新约/旧约分栏）
│   ├── ProgressBar.tsx          # 掌握度进度条
│   └── ui/                      # shadcn/ui 基础组件（9 个）
│       ├── button.tsx  card.tsx  badge.tsx  tabs.tsx
│       ├── dialog.tsx  input.tsx  label.tsx
│       ├── select.tsx  separator.tsx
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
│   ├── fsrs.ts                  # FSRS 间隔重复算法（从旧项目迁移，JS→TS）
│   ├── compare.ts               # LCS 中文经文比对算法（迁移 + TS 化）
│   └── dailyverse.ts            # 每日金句（日期种子随机，从旧项目迁移）
├── types/index.ts               # 全局 TypeScript 类型
├── prisma/
│   ├── schema.prisma            # 7 张表：Book/Verse/Annotation/Plan/Card/Note/Checkin
│   └── seed.ts                  # 导入 public/data/*.json → SQLite
├── public/data/                 # 经文 JSON（8 卷 NT + 2 卷注解）
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
| 哥林多前书 | 437 | - |
| 哥林多后书 | 257 | - |
| 加拉太书 | 149 | - |
| 以弗所书 | 152 | - |
| 腓立比书 | 104 | - |
| 歌罗西书 | 95 | - |
| 约翰一书 | 104 | ✓ |
| **合计** | **1731** | **371** |

数据来源于 `d:\coder\aiWorkSpace\bible\data\raw\bible_root\{bible.db, bible_kjv.db}`，通过旧项目 `bible-memorize/scripts/extract_verses.py` 提取。

## 提取更多书卷

```bash
cd d:\coder\aiWorkSpace\bible-memorize
python scripts/extract_verses.py <book_index> ...
# 提取后复制到 logos
cp public/data/<文件名>.json ../logos/public/data/
cd ../logos
npx tsx prisma/seed.ts   # 导入 SQLite
```

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

## 后续待完善

1. **添加更多书卷数据** — 目前只有 8 卷 NT，需扩展到全本
2. **错误边界** — 生产环境需要 React Error Boundary
3. **加载状态** — 添加 Skeleton 组件
4. **复习流程完善** — 当前复习页只有列表，需复用学习流程的背诵+评分
5. **移动端适配** — 测试小屏体验
6. **服务器部署脚本** — 类似 todoList 的 deploy.ps1
