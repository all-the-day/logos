# Logos — 项目简报（当前状态快照）

> 本文件记录项目当前状态（目录、库存、进度、已知问题、下一步）。
> 长期规则与不变量见 `AGENTS.md`；运维细节见 `docs/OPERATIONS.md`。
> 最近同步：2026-08-20。**事实以代码与数据库为准，不凭本文推断。**

---

## 1. 项目概述

Logos（"太初有道"）是一款**中文圣经背诵学习 APP**，移动端优先的 PWA。

| 项 | 值 |
|----|-----|
| 名称 | Logos |
| 路径 | `d:\coder\aiWorkSpace\logos` |
| 技术栈 | Next.js 15.5 (App Router) + React 19 + TypeScript + Tailwind v4 + shadcn/ui + Prisma 6 + SQLite |
| 运行时 | Node.js ≥ 22（`node:sqlite` 依赖）；`package.json#engines` |
| 版本 | 0.1.0 |
| 语言 | 全中文 UI，内容为中文恢复本 + 英文 KJV 对照 |

核心玩法：
- **每日任务** = 复习旧经节 + 学新经节（FSRS 间隔重复）
- **学习流程**：看经文 → 默写/填空背诵 → LCS 比对评分 → 四键评分（忘记/困难/良好/容易）
- **签到 → 每日金句** 动线（产品亮点）
- 附带：学习笔记、数据导入导出、反馈、后台用户管理

---

## 2. 开发命令

```bash
npm install
npm run dev          # 开发：http://localhost:3000
npm run build        # 生产构建
npm start            # 生产运行
npm run lint         # ESLint
npm run test         # Vitest 单测 + 集成测试（56 用例，覆盖率约 85% stmts）
npm run test:db:reset # 重建 prisma/test.db（精确路径保护）
npm run db:push      # 同步 schema 到 SQLite
npm run db:seed      # 从 data/bible*.db 可重复增量导入（跳过已导入）
npm run db:studio    # Prisma Studio
npm run feedback:pull  # 拉取线上反馈 → tools/feedback/inbox.md（凭据 .env.local）
npm run feedback:close <id>  # 标记反馈为已处理（闭环工作流）
```

**Android APK（方案 A：Capacitor 在线壳）**：APK 由 **GitHub Actions** 构建（`.github/workflows/build-apk.yml`，push 到 master 或手动触发，产物为 Actions artifact `logos-apk`）。本地不在 android 目录手工出包。壳配置 `capacitor.config.json`：appId `com.duoban.logos`、appName `太初有道`、`server.url` 指向线上 `https://logos.duoban.xyz`（WebView 加载远程站点）。`www/` 为占位资源（启动等待页 + icon），`android/` 本地生成不入库。改动壳相关文件后 push 即可自动重新出包。

依赖要点：`@prisma/client`、`next@15.5.22`、`react@19`、`tailwindcss@4`、`shadcn@4`、`@base-ui/react`（shadcn 底层）、`lucide-react`（图标）、`tw-animate-css`、`@capacitor/{core,cli,android}@6`（APK 壳）。`date-fns` 目前未使用（可清理）。

---

## 3. 目录结构（当前准确版）

```
app/
├── layout.tsx            根布局（ToastProvider + BottomNavWrapper + pb-16）
├── page.tsx              首页 → redirect("/plan")
├── globals.css           Tailwind v4 + shadcn 主题 token + glass utility
├── admin/                后台用户管理（admin 角色可见）
├── plan/                 Plan 页（v2，见 §6）
├── learn/                学习页（今日队列：复习+新卡）
├── notes/                笔记列表 + 新建/编辑 Dialog
├── settings/             用户卡/数据管理/统计/反馈/关于
├── login/                登录页
├── error.tsx / loading.tsx / not-found.tsx
└── api/
    ├── auth/{login,logout,me,register}  注册仅管理员
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
services/  card.ts(评分业务: rateCard) checkin.ts learn.ts plan.ts verse.ts
db/        card.ts checkin.ts feedback.ts note.ts plan.ts session.ts user.ts verse.ts
lib/       auth.ts(会话/scrypt) fsrs.ts(算法) compare.ts(LCS) dailyverse.ts date.ts import-book.ts prisma.ts utils.ts
types/index.ts            全局类型
prisma/    schema.prisma seed.ts
scripts/   create-local-user.ts(本地造号) deploy.ps1 extract-verses.ts(已废弃)
public/    manifest.json sw.js icons
www/       Capacitor 壳占位资源（启动等待页 index.html + icon.png，APK 用）
tools/feedback/  反馈闭环脚本（pull.ts/close.ts/lib.ts/README.md；inbox.md 为生成物不入库）
capacitor.config.json  APK 壳配置（appId / appName / server.url → 线上站点）
.github/workflows/build-apk.yml  GitHub Actions 构建 debug APK
data/      bible.db(恢复本) bible_kjv.db(KJV)  ← 不入 git
```

> `android/`（Capacitor 原生工程）由 CI `cap add` 生成，本地存在但不入库（`.gitignore` 已忽略）。

---

## 4. 数据模型（prisma/schema.prisma，SQLite，10 张表）

```
User 1─→N Plan / Card / Note / Checkin / Feedback / Session
Book 1─→N Verse 1─→1 Annotation
           1─→N Card（FSRS 卡片，@@unique([userId, verseId])）
           1─→N Note
Plan: userId, bookId, versesPerDay(default 3), status(active/deleted)
Card: stability, difficulty, elapsedDays, scheduledDays, reps, lapses,
      state(new/learning/review/relearning), lastReview, due, introducedAt(首次离开 new 态，每日新卡配额)
Checkin: @@unique([userId, date])，date 为本地日期字符串 YYYY-MM-DD
```

FSRS 卡状态机：`NEW → LEARNING → REVIEW`，AGAIN 时进入 `RELEARNING`。

### 已入库数据（2026-08-10 实测 dev.db）

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

数据源 `data/bible.db`、`data/bible_kjv.db`；`lib/import-book.ts` 用 `node:sqlite` 直读增量导入（`prisma/seed.ts` 复用），不经过 JSON 中间产物。新增书卷：修改 `prisma/seed.ts` 的 `DEFAULT_BOOKS`（书卷索引数组），然后 `npm run db:push && npm run db:seed`。**不得删除 `prisma/dev.db` 来重建**（见 AGENTS.md §7）。

**seed 幂等性已实测**（2026-08-10，独立 `test.db` 上连续执行两次）：Book 8 / Verse 1731 / Annotation 1614 数量完全不变、无唯一约束错误、标记用户与卡片数据完好，确认不覆盖用户学习数据。

---

## 5. 核心算法

| 模块 | 说明 |
|------|------|
| `lib/fsrs.ts` | FSRS 间隔重复：`updateCard(card, rating)` 返回新 stability/difficulty/due/state；四评级 AGAIN/HARD/GOOD/EASY；另有 `recommendRating(accuracy)` 按背诵准确率推荐 |
| `lib/compare.ts` | LCS 中文经文比对：`compareVerse(input, target)` 产出差异段（错字/漏字/多字），`generateFillBlanks` 填空模式，`densityForStability` 按稳定性决定填空密度 |
| `lib/dailyverse.ts` | 每日金句：日期字符串 hash 选书选节，同一天恒定；结构 `DailyVerse{book,chapter,section,content,kjv,reference}` |
| `lib/date.ts` | 本地时区日期工具：`getTodayString/getDateString/getTodayLabel/isWeekday` |
| `lib/auth.ts` | scrypt 密码哈希 + session cookie（`logos_session`，30 天） |

---

## 6. 功能现状（Plan v2 已重构，2026-08-07 完成）

### 6.1 Plan 页
有计划的页面结构（自上而下）：
1. **日期顶栏**（如 `周五 · 8月7日`，`getTodayLabel`）
2. **今日任务卡**：`待复习 X 节 · 新经文 Y 节` + 全宽主按钮「开始今日学习」→ `/learn`（唯一 CTA）+ **今日进度 `已完成/总量` 与进度条**（总量=已完成+待复习+待学新卡，口径随学习收敛稳定）
3. **签到→金句槽位**：未签到=签到卡（含连续天数 streak）；已签到=每日金句。**产品动线，结构不可改**
4. **书卷进度卡**：ProgressBar 三色（总进度）+ `每日 X 节 · 已学 N/总数` + `…` 菜单内「删除计划」（带 confirm）

无计划时：显示「新建背诵计划」表单（书卷选择 + 每日节数调节）。

### 6.2 学习页 /learn
- 队列 = 复习卡（**跨全部已学书卷**，`state != new` 且 `due <= now`，按 due/stability/verseId 排序，上限 50）+ 新卡（`state == new`，仅当前计划书卷，按章节顺序，取今日剩余配额 `versesPerDay − 今日首次引入数`）
- 三态：新卡先查看再背诵；**复习卡默认直接进入背诵**（保留"查看原文"，查看后本次推荐评分封顶"困难"）→ 背诵输入 → 结果比对 + 四键评分
- 快捷键：`1-4` 评分，`u` 撤销，`Space` 跳过

### 6.3 其他页面
- **/notes**：笔记列表（出处标题+内容+日期+编辑/删除）+ 新建/编辑 Dialog（书卷/章/节 + 内容）
- **/settings**：用户卡（退出登录/后台入口）→ 数据管理（导出 JSON/导入/清除）→ 数据统计 2×2 → 反馈 → 关于
- **/admin**：用户管理（仅 admin）
- **/login**：账号密码登录；注册仅管理员
- **反馈闭环**：`GET /api/feedback` 支持 admin 分支（查全部含提交人）；`PATCH` **仅 admin 可改状态**（普通用户提交/查看自己的）；本地 `npm run feedback:pull / feedback:close <id>` 拉取处理线上反馈（详见 `tools/feedback/README.md`）
- **/learn**：最后一节完成点「完成」→ 显示"今日任务已完成"空状态（回归测试覆盖）

---

## 7. 设计系统（app/globals.css）

- **双主题** CSS 变量（`:root` 浅色 + `.dark` 深色），oklch 中性灰阶，无品牌色
- 圆角 `--radius: 0.625rem`（10px）；`@utility glass` 毛玻璃
- 进度三色语义（可换色相但语义保留）：绿=已掌握 / 橙=学习中 / 蓝=新
- 移动优先：`max-w-lg`（448px）单列，底部 3 项固定导航，body `pb-16`
- 图标：lucide（组件内联 SVG）
- 设计参考：`.codebuddy/plan/ui-designer-brief.md`（视觉线框）、`.codebuddy/plan/ui-agent-reference.md`（工程视角）

---

## 8. 已知问题 / 待办

**2026-08-10 学习核心改进（对应产品评审三个 P0）**：
- ~~每日新卡配额失效（versesPerDay 只是每次进入上限）~~ —— **已修复**：Card 增加 `introducedAt`，`services/card.ts#rateCard` 在首次离开 new 态时写入；今日新卡 = `versesPerDay − 今日引入数`；含集成测试（学满后再取为 0、次日重置）
- ~~换计划删除学习历史~~ —— **已修复**：换计划/删除计划不再删卡（卡片永久化），复习队列跨全部已学书卷；建卡改为幂等（`getExistingCardVerseIds`），避免重复建卡撞唯一约束
- ~~复习卡先显示原文削弱检索练习~~ —— **已修复**：复习卡默认直接进入背诵态；查看原文后推荐评分封顶"困难"
- ~~跨节状态串扰（上一节的输入/比对结果残留到下一节，如显示 1:4 却按 1:2 判 100%）~~ —— **已修复**（`LearnClient`）：任务切换改为原子清空全部单次背诵状态（含章节快捷跳转）；keydown 通过 ref 读取最新处理器，消除旧闭包把 Enter/评分误接到上一节的窗口；评分加防重锁

未处理项：
1. **Undo 评分重构**：`LearnClient.handleUndo` 用"评分前快照 + PUT 整卡恢复"，脆弱，需重构（已加日期边界校验，架构重构待规划）
2. **`lib/auth.ts:7` ESLint warning**：`userDb` 未使用（留作单独 chore）
3. **`date-fns` 依赖未使用**（可清理，另开 chore）
4. **`compare.ts` 空原文缺陷**：`it.fails` 已标注，修复后移除 `.fails`
5. **会话内重学**：AGAIN/HARD 卡暂排次日，未插回当前队列（评审建议项，待做）
6. **积压时减少新卡**：`MAX_REVIEW_PER_DAY=50` 仍为死上限（评审建议项，待做）
7. **评分按钮显示下次间隔**：`POST /api/card` 已返回 `nextInterval`，前端未展示（评审建议项，待做）

---

## 9. 测试现状与建议

**现状（2026-08-10 Vitest 基建已落地）**：
- 单元测试：`lib/fsrs`（15，含 peeked 推荐封顶）、`lib/compare`（17，含全组合还原 + `it.fails` 记录空原文缺陷）、`lib/date`（10）
- 集成测试：学习队列 14 场景（隔离/排序/上限 50/统一 `now`/每日新卡配额）、`getDueCards` 新卡泄漏、Card DateTime 存储诊断
- 组件测试（jsdom + @testing-library/react）：`LearnClient` 跨节状态隔离 1 场景（复现上一节输入/比对残留 bug 的回归防护）
- 测试库隔离：`prisma/test.db` + `tests/fixtures/setup.ts` 进程级校验 + `reset-test-db.ts` 精确路径保护（拒绝 dev.db）
- 当前共 **60 个用例**；`npm run test` / `test:coverage`（约 85% stmts）/ `test:db:reset`

**功能验收基线**（Plan v2 人工验证过，可作为回归清单）：
1. 无计划：/plan 显示创建表单
2. 有计划：日期顶栏 → 今日任务卡 → 签到卡/金句槽位 → 书卷进度卡
3. 摘要数字与 /learn 队列实际数量一致（复习+新卡）
4. 主按钮唯一入口 /learn；/review 应 404
5. 签到→金句动线：未签到显签到卡，签到后同一位置变金句
6. 删除计划仅在 `…` 菜单
7. 学习流：新卡先查看再背诵；复习卡默认直接背诵；快捷键 1-4/u/Space，Undo 生效
8. 每日新卡配额：学满 `versesPerDay` 张新卡后，当天再次进入 /learn 不再出新卡；次日恢复
9. 换计划不丢进度：切换书卷后，旧书卷到期复习卡仍出现在 /learn 队列，卡片数据保留

**下一步建议**：
- E2E：Playwright（未装），配置 `serviceWorkers: "block"` 避免 PWA 缓存干扰；主流程登录→建计划→学习→签到→笔记→导出
- API 鉴权集成测试：未登录写接口 401、跨用户隔离、重复签到幂等、建计划事务性

---

## 10. 相关文档

- `AGENTS.md` — 长期契约、产品不变量、安全红线
- `docs/OPERATIONS.md` — 部署、PM2、Caddy、服务器差异
- 旧项目 `d:\coder\aiWorkSpace\bible-memorize` 仅作算法/行为参考（`scripts/extract-verses.ts` 已废弃，导入走 `lib/import-book.ts`）
