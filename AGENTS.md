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
│   ├── notes/                   # 学习笔记
│   │   ├── page.tsx
│   │   └── NotesClient.tsx
│   ├── settings/                # 数据导出/导入/清除
│   │   ├── page.tsx
│   │   └── SettingsClient.tsx
│   └── api/                     # API 路由
│       ├── plan/route.ts        # POST 创建 / GET 查询 / DELETE 删除
│       ├── card/route.ts        # POST FSRS 评分 + PUT 撤销 / GET 到期卡片
│       ├── note/route.ts        # CRUD 笔记
│       ├── checkin/route.ts     # POST 签到 / GET 状态
│       ├── data/route.ts        # GET 导出 / POST 导入
│       ├── annotation/route.ts  # GET 纲目/注解/串珠
│       ├── stats/route.ts       # GET 数据统计
│       ├── feedback/route.ts    # 反馈 CRUD
│       ├── users/route.ts       # 用户列表（admin）
│       └── book/import/route.ts # 经文导入
├── components/
│   ├── BottomNav.tsx            # 底部导航 3 项（计划/笔记/设置）
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
│   ├── learn.ts                 # 今日任务（复习+新卡混合队列、getTodaySummary，支持 now 参数）
│   ├── verse.ts                 # 经文查询
│   └── checkin.ts               # 签到业务
├── db/                          # 数据访问层（Prisma）
│   ├── verse.ts                 # 书卷/经文/注解查询
│   ├── plan.ts                  # 计划 CRUD
│   ├── card.ts                  # FSRS 卡片 CRUD（getDueCards 只含非新卡；getTodayReviewedCount）
│   ├── note.ts                  # 笔记 CRUD
│   ├── checkin.ts               # 签到记录 + 连续天数计算
│   ├── user.ts / session.ts     # 用户与会话
│   └── feedback.ts              # 反馈 CRUD
├── lib/                         # 工具 + 核心算法
│   ├── prisma.ts                # Prisma 单例
│   ├── utils.ts                 # cn() classname 合并
│   ├── date.ts                  # 日期工具
│   ├── fsrs.ts                  # FSRS 间隔重复算法
│   ├── compare.ts               # LCS 中文经文比对算法
│   └── dailyverse.ts            # 每日金句（日期种子随机）
├── types/index.ts               # 全局 TypeScript 类型
├── tests/                       # 测试（Vitest，SQLite 单 worker 串行）
│   ├── unit/                    # 纯函数单测（fsrs/compare/date）
│   ├── integration/             # 学习队列/到期卡/日期存储集成测试
│   └── fixtures/                # reset-test-db / setup 校验 / seed-test
├── vitest.config.ts             # 测试配置（TZ=Asia/Shanghai、DATABASE_URL=test.db）
├── prisma/
│   ├── schema.prisma            # 10 张表
│   └── seed.ts                  # 从 data/bible.db 直读导入
├── public/                     # PWA 静态资源
└── scripts/
    ├── create-local-user.ts     # 本地测试账号创建/重置
    └── extract-verses.ts        # 从 bible 项目提取经文（已废弃，改用 lib/import-book 直读）
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

数据来源于 `d:\coder\aiWorkSpace\logos\data\bible.db` 和 `bible_kjv.db`，`lib/import-book.ts` 用 Node 原生 `node:sqlite` 直读导入（seed.ts 复用），不再经过 JSON 中间产物。

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
│   ├── extract-verses.ts        # 从 bible 项目提取经文（已废弃，改用 lib/import-book 直读）
│   └── create-local-user.ts     # 本地测试账号创建/重置
├── public/sw.js                 # PWA Service Worker
├── public/manifest.json         # PWA manifest
└── public/icon-*.png            # PWA 图标

## 开发命令

```bash
npm run dev           # http://localhost:3000
npm run build         # 生产构建
npm start             # 生产运行（~200MB 内存）
npm run test          # Vitest 单测 + 集成测试
npm run test:watch    # 测试监听
npm run test:coverage # 覆盖率
npm run test:db:reset # 重建 prisma/test.db（含精确路径保护）
npm run db:push       # 同步 Prisma schema → SQLite
npm run db:seed       # 导入经文 JSON → SQLite
npm run db:studio     # Prisma 数据库管理界面
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
| 服务器 IP | 101.132.34.193（rike，腾讯云） |
| SSH | root / password auth |
| 应用路径 | /root/logos |
| PM2 进程名 | logos（pm2 需完整路径，node 在 nvm） |
| 内部端口 | 3001 |
| Caddy 代理 | logos.duoban.xyz → 127.0.0.1:3001（Let's Encrypt） |
| 访问 URL | https://logos.duoban.xyz |
| Git 仓库 | https://github.com/all-the-day/logos |

> 旧服务器 124.222.74.115 已弃用（自签名证书问题），访问走域名 logos.duoban.xyz。

### 部署流程

```bash
# 本地 skill 一键部署（自动处理 nvm PATH / prisma generate）
python D:/coder/aiWorkSpace/server-ops/server-ops.py deploy
python D:/coder/aiWorkSpace/server-ops/server-ops.py -s logos status
```

### 服务器差异注意

- rike 上 node 装在 nvm（v22.22.3），pm2 不在 PATH，脚本已通过 `node_prefix` 处理
- 应用端口 3001（3000 被 duoban.xyz 主站占用）
- 有真实域名 → Caddy 自动签 Let's Encrypt 证书，HTTPS/SW 正常
- 部署脚本含 `prisma db push + generate` 步骤（schema 变更时必需）


## 文档同步协议（强制）

`AGENTS.md` 是项目级 Agent 工作契约，不是更新日志。

### 每个任务开始前

1. 阅读根目录 `AGENTS.md`。
2. 阅读 `PROJECT_BRIEF.md` 及相关目录下的局部说明。
3. 检查 `git status` 和真实代码，不得仅凭文档推断当前状态。
4. 任务清单最后一项必须是：
   `检查并同步 AGENTS.md / PROJECT_BRIEF.md`。

### 必须更新 AGENTS.md 的情况

出现以下任一变化时，必须在同一任务、尽量在同一提交中更新：

- 产品主流程、核心交互或不可破坏的产品约束发生变化
- 新增、删除或改变主要页面、路由、导航入口
- 项目架构、分层方式、目录职责发生变化
- 技术栈、运行环境、依赖管理或主要命令发生变化
- Prisma schema、核心数据语义、鉴权、会话、时区策略发生变化
- 测试体系、质量门槛或测试数据库策略发生变化
- 构建、部署、服务器运维或安全约束发生变化
- 重要已知问题被解决，或出现新的高风险已知问题
- 当前优先级和项目大方向发生变化

只改变详细功能清单或阶段状态时，更新 `PROJECT_BRIEF.md`；
若同时影响 Agent 的长期工作方式或项目约束，也要更新 `AGENTS.md`。

### 通常不需要更新 AGENTS.md 的情况

- 不改变外部行为的局部重构
- 单纯样式、间距、文案调整
- 普通缺陷修复，且不改变架构或数据契约
- 增加测试用例，但测试策略本身没有变化
- 临时调试代码和一次性调查结果

### 任务完成前

1. 查看完整 diff，判断是否触发上述更新条件。
2. 更新时应修改“当前状态”，同时删除过时描述；不要只追加历史记录。
3. 若文档与代码冲突：
   - 当前实现事实以代码、schema 和 package 配置为核验依据；
   - 产品约束、安全规则以本文件为准，除非用户明确覆盖；
   - 不得静默忽略冲突，应修正文档或报告问题。
4. 最终回复必须包含以下二者之一：
   - `AGENTS.md：已更新——<更新内容>`
   - `AGENTS.md：无需更新——<具体原因>`

未完成文档影响检查，不得声明任务完成。

## 操作安全

- 未经用户明确确认，不得 push、部署或操作生产环境。
- 测试不得连接或重置 `prisma/dev.db`。
- 集成测试固定使用 `prisma/test.db`：vitest 配置 `DATABASE_URL=file:./test.db` + `tests/fixtures/setup.ts` 进程级校验；测试前运行 `npm run test:db:reset`（脚本含精确路径保护，拒绝 dev.db）。
- 数据迁移、生产数据库修改必须单独确认并先备份。
