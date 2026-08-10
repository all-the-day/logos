# Logos — 项目简报（交接 GPT-5.6 Sol Max）

> 本文件是给外部 AI（GPT-5.6 Sol Max）指导开发与测试的交接上下文。
> 生成日期：2026-08-07，最近同步：2026-08-10。**当前状态以 `AGENTS.md`（已同步）与本文件为准。**

---

## 1. 项目概述

Logos（"太初有道"）是一款**中文bible背诵学习 APP**，移动端优先的 PWA。

| 项 | 值 |
|----|-----|
| 名称 | Logos |
| 路径 | `d:\coder\aiWorkSpace\logos` |
| 技术栈 | Next.js 15.5 (App Router) + React 19 + TypeScript + Tailwind v4 + shadcn/ui (base-nova) + Prisma 6 + SQLite |
| 部署 | 自有服务器（阿里云，1.6G 内存），单进程 150-300MB；`npm run build && npm start` |
| 版本 | 0.1.0 |
| 语言 | 全中文 UI，内容为中文恢复本 + 英文 KJV 对照 |

核心玩法：
- **每日任务** = 复习旧经节 + 学新经节（FSRS 间隔重复）
- **学习流程**：看经文 → 默写/填空背诵 → LCS 比对评分 → 四键评分（忘记/困难/良好/容易）
- **签到 → 每日金句** 动线（产品亮点）
- 附带：学习笔记、数据导入导出、反馈

---

## 2. 技术栈与运行

```bash
npm install
npm run dev          # 开发：http://localhost:3000
npm run build        # 生产构建
npm start            # 生产运行
npm run lint         # ESLint
npm run db:push      # 同步 schema 到 SQLite
npm run db:seed      # 导入经文数据（npx tsx prisma/seed.ts）
npm run db:studio    # Prisma Studio 查看数据
```

依赖要点：`@prisma/client`、`next@15.5.22`、`react@19`、`tailwindcss@4`、`shadcn@4`、`@base-ui/react`（shadcn 底层）、`lucide-react`（图标）、`date-fns`（暂未见使用）、`tw-animate-css`。

**注意**：数据库为 SQLite，文件 `prisma/dev.db`；生产与本地共用同一套 schema。

---

## 3. 架构模式

```
Server Component (app/<page>/page.tsx)  取数据 + 鉴权（直查 Prisma/Service）
        ↓ props（JSON 序列化后传入）
Client Component (app/<page>/*Client.tsx)  用户交互 / 状态
        ↓ fetch
API Route (app/api/<x>/route.ts)  写操作 / 登录态写 cookie
        ↓
Service Layer (services/*.ts)  业务逻辑
        ↓
DB Layer (db/*.ts)  Prisma 查询封装
        ↓
SQLite (prisma/dev.db)
```

- 读操作：page.tsx 服务端直查，序列化后传 props 给 Client
- 写操作：Client fetch → API route → Service → DB；API 用 `requireUser()`（cookie session）鉴权
- 页面普遍 `export const dynamic = "force-dynamic"`（按需渲染）

## 4. 目录结构（当前准确版）

```
app/
├── layout.tsx            根布局（ToastProvider + BottomNavWrapper + pb-16）
├── page.tsx              首页 → redirect("/plan")
├── globals.css           Tailwind v4 + shadcn 主题 token + glass utility
├── admin/                后台用户管理（admin 角色可见）
├── plan/                 Plan 页（v2 已重构，见 §7）
├── learn/                学习页（今日队列：复习+新卡）
├── notes/                笔记列表 + 新建/编辑 Dialog
├── settings/             用户卡/数据管理/统计/反馈/关于
├── login/                登录页
├── error.tsx / loading.tsx / not-found.tsx
└── api/
    ├── auth/{login,logout,me,register}   注册仅管理员
    ├── plan/route.ts     GET 详情 / POST 创建(含批量建卡) / DELETE 删除
    ├── card/route.ts     POST FSRS评分 / PUT 撤销恢复 / GET 到期卡
    ├── note/route.ts     CRUD 笔记
    ├── checkin/route.ts  POST 签到 / GET 状态
    ├── data/route.ts     GET 导出 / POST 导入 / DELETE 清除
    ├── annotation/route.ts  GET 纲目/注解/串珠
    ├── book/import/route.ts  经文导入
    ├── stats/route.ts    统计
    ├── feedback/route.ts 反馈 CRUD
    └── users/route.ts    用户列表
components/
├── BottomNav.tsx        固定底栏 3 项（计划/笔记/设置），内联 SVG
├── BottomNavWrapper.tsx  路由白名单控制底栏显示
├── BookSelector.tsx      书卷选择器
├── ProgressBar.tsx       三色进度条（绿=已掌握/橙=学习中/蓝=新）
├── VerseStudy.tsx        经文展示/背诵/比对/评分（学习核心，共享）
├── AnnotationPanel.tsx   纲目/注解/串珠可折叠面板
├── VerseNotes.tsx        该节已有笔记
├── ToastProvider.tsx     轻量 toast（useToast）
├── SWRegister.tsx        PWA Service Worker 注册
└── ui/                   shadcn 基础组件（button/card/badge/input/label/select/separator/tabs/dialog）
services/  checkin.ts learn.ts plan.ts verse.ts
db/        card.ts checkin.ts feedback.ts note.ts plan.ts session.ts user.ts verse.ts
lib/       auth.ts(会话/scrypt) fsrs.ts(算法) compare.ts(LCS) dailyverse.ts date.ts import-book.ts prisma.ts utils.ts
types/index.ts            全局类型
prisma/    schema.prisma seed.ts
scripts/   create-local-user.ts(本地造号) deploy.ps1 extract-verses.ts
public/    manifest.json sw.js icons
```

---

## 5. 数据模型（prisma/schema.prisma，SQLite）

```
User 1─→N Plan / Card / Note / Checkin / Feedback / Session
Book 1─→N Verse 1─→1 Annotation
           1─→N Card（FSRS 卡片，@@unique([userId, verseId])）
           1─→N Note
Plan: userId, bookId, versesPerDay(default 3), status(active/deleted)
Card: stability, difficulty, elapsedDays, scheduledDays, reps, lapses,
      state(new/learning/review/relearning), lastReview, due
Checkin: @@unique([userId, date])，date 为本地日期字符串 YYYY-MM-DD
```

FSRS 卡状态机：`NEW → LEARNING → REVIEW`，AGAIN 时进入 `RELEARNING`。
已入库书卷：**罗马书（433 节）**；数据源 `data/bible.db`、`data/bible_kjv.db`。

---

## 6. 核心算法

| 模块 | 说明 |
|------|------|
| `lib/fsrs.ts` | FSRS 间隔重复：`updateCard(card, rating)` 返回新 stability/difficulty/due/state；四评级 AGAIN/HARD/GOOD/EASY；另有 `recommendRating(accuracy)` 按背诵准确率推荐 |
| `lib/compare.ts` | LCS 中文经文比对：`compareVerse(input, target)` 产出差异段（错字/漏字/多字），`generateFillBlanks` 填空模式，`densityForStability` 按稳定性决定填空密度 |
| `lib/dailyverse.ts` | 每日金句：日期字符串 hash 选书选节，同一天恒定；结构 `DailyVerse{book,chapter,section,content,kjv,reference}` |
| `lib/date.ts` | 本地时区日期工具：`getTodayString/getDateString/getTodayLabel/isWeekday` |
| `lib/auth.ts` | scrypt 密码哈希 + session cookie（`logos_session`，30 天） |

---

## 7. 功能现状与最近重构（Plan v2，已完成）

### 7.1 Plan 页 v2（2026-08-07 重构完成，`npm run build` 通过、本地验收通过）
有计划的页面结构（自上而下）：
1. **日期顶栏**（如 `周五 · 8月7日`，`getTodayLabel`）
2. **今日任务卡**：`待复习 X 节 · 新经文 Y 节` + 全宽主按钮「开始今日学习」→ `/learn`（唯一 CTA）+ `今日已完成 N 节`（无分母）
3. **签到→金句槽位**：未签到=签到卡（含连续天数 streak）；已签到=每日金句。**产品动线，结构不可改**
4. **书卷进度卡**：ProgressBar 三色 + `每日 X 节 · 已学 N/总数` + `…` 菜单内「删除计划」（带 confirm）

无计划时：显示「新建背诵计划」表单（书卷选择 + 每日节数调节）。

**本次改动涉及**：
- `services/learn.ts`：新增 `getTodaySummary(userId)`（review/new 计数，条件与 `getTodayTasks` 一致）
- `db/card.ts`：新增 `getTodayReviewedCount(userId, bookId)`（今日已复习数，本地零点）
- `app/plan/page.tsx`：新 props `todaySummary`/`todayReviewed`，移除 `user` prop
- `app/plan/PlanClient.tsx`：重构（见上）
- `lib/date.ts`：新增 `getTodayLabel`
- **下线 `/review`**：删除 `app/review/` 目录、`services/review.ts`；`BottomNavWrapper` 白名单移除 `/review`；`api/card` GET 保留不动

### 7.2 学习页 /learn
- 队列 = 复习卡（`state != new` 且 `due <= now`，按 due/stability 排序，上限 50）+ 新卡（`state == new`，按章节顺序，取 `versesPerDay` 个）
- 三态：查看（可切换 全文/填空、中/英对照、章节快速跳转 chips）→ 背诵输入 → 结果比对 + 四键评分
- 快捷键：`1-4` 评分，`u` 撤销，`Space` 跳过

### 7.3 其他页面
- **/notes**：笔记列表（出处标题+内容+日期+编辑/删除）+ 新建/编辑 Dialog（书卷/章/节 + 内容）
- **/settings**：用户卡（退出登录/后台入口）→ 数据管理（导出 JSON/导入/清除）→ 数据统计 2×2 → 反馈 → 关于
- **/admin**：用户管理（仅 admin）
- **/login**：账号密码登录；注册仅管理员

---

## 8. 设计系统（app/globals.css）

- **双主题** CSS 变量（`:root` 浅色 + `.dark` 深色），oklch 中性灰阶，无品牌色
- 圆角 `--radius: 0.625rem`（10px）；`@utility glass` 毛玻璃
- 进度三色语义（可换色相但语义保留）：绿=已掌握 / 橙=学习中 / 蓝=新
- 移动优先：`max-w-lg`（448px）单列，底部 3 项固定导航，body `pb-16`
- 图标：lucide（组件内联 SVG）
- 设计参考文档：`.codebuddy/plan/ui-designer-brief.md`（视觉线框）、`.codebuddy/plan/ui-agent-reference.md`（工程视角）

---

## 9. 已知问题 / 待办（未做）

1. **结果页塞研读内容**：`/learn` 结果态接入注解/笔记的问题 —— **本次明确不做，另开 plan**
2. **Undo 评分重构**：`LearnClient.handleUndo` 用"评分前快照 + PUT 整卡恢复"，脆弱，需重构 —— **未做**（已加日期边界校验，架构重构仍待规划）
3. ~~**`getDueCards` 新卡泄漏**~~ —— **已修复**（2026-08-10，补 `state != "new"` 过滤，含失败测试）
4. ~~**SQLite DateTime 混合存储**~~ —— **已确认一致**（当前 Prisma 所有写入路径均存整数毫秒；dev.db 审计 433 张卡全 INTEGER，无需迁移）
5. **`lib/auth.ts:7` ESLint warning**：`userDb` 未使用（留作单独 chore）
6. **`date-fns` 依赖未使用**（可清理，另开 chore）

---

## 10. 测试现状与建议

**现状（2026-08-10 已落地 Vitest 基建）**：
- 单元测试：`lib/fsrs`（14）、`lib/compare`（17，含全组合还原 + `it.fails` 记录空原文缺陷）、`lib/date`（10，含 `parseDateInput`）
- 集成测试：学习队列 12 场景（隔离/排序/上限 50/统一 `now`）、`getDueCards` 新卡泄漏、Card DateTime 存储诊断
- 测试库隔离：`prisma/test.db` + `tests/fixtures/setup.ts` 进程级校验 + `reset-test-db.ts` 精确路径保护（拒绝 dev.db）
- 当前共 **56 个用例**，`npm run test` / `test:coverage`（覆盖率约 85% stmts）/ `test:db:reset`

**功能验收基线**（Plan v2 时人工验证过，可作为回归清单）：
1. 无计划：/plan 显示创建表单
2. 有计划：日期顶栏 → 今日任务卡 → 签到卡/金句槽位 → 书卷进度卡
3. 摘要数字与 /learn 队列实际数量一致（复习+新卡）
4. 主按钮唯一入口 /learn；/review 应 404
5. 签到→金句动线：未签到显签到卡，签到后同一位置变金句
6. 删除计划仅在 `…` 菜单
7. 学习流：查看→背诵→评分，快捷键 1-4/u/Space，Undo 生效

**下一步建议**：
- E2E：Playwright（未装），配置 `serviceWorkers: "block"` 避免 PWA 缓存干扰；主流程登录→建计划→学习→签到→笔记→导出
- API 鉴权集成测试：未登录写接口 401、跨用户隔离、重复签到幂等、建计划事务性
- 修复 `compare.ts` 空原文缺陷（`it.fails` 已标注，修复后移除 `.fails`）

---

## 11. 部署（重要）

- 生产服务器：**101.132.34.193（rike）**，域名 https://logos.duoban.xyz；运维脚本：`D:/coder/aiWorkSpace/server-ops/server-ops.py`（本地 skill 一键部署）
- 运行方式：PM2 进程 `logos`，内部端口 **3001**，Caddy 代理 + Let's Encrypt（HTTPS/SW 正常）
- 旧服务器 124.222.74.115 已弃用；`.mcp.json` 已删除（无任何 MCP，部署仅走本地 server-ops 项目）
- 服务器仅 1.6G 内存，构建/进程资源有限
- **约定：未经明确确认不部署、不 push 生产**

---

## 12. 给 GPT-5.6 Sol Max 的关注点建议

1. **测试体系**：单元 + 集成已落地（56 用例），E2E 与 API 鉴权测试是下一块
2. **Undo 架构重构**（客户端快照 → 服务端撤销）与 `compare.ts` 空原文缺陷修复
3. **结果页研读内容整合**（待规划）
4. **UI 设计落地**：Pixso 设计稿已存在（`xwvHjMQp80mM79a8Z0jQLg`，需登录）；读取方式为导出 PNG 到项目（MCP 已移除）；按 `.codebuddy/plan/ui-designer-brief.md` 对照落地
5. **chore**：`lib/auth.ts` 未使用导入、`date-fns` 依赖清理
