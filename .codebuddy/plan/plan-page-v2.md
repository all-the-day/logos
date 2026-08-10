# Plan 页 v2 — 今日任务重构

## 1. 背景与问题

现状 Plan 页（`app/plan/PlanClient.tsx`）在首屏堆了 6 种动机：用户信息/登出、签到卡、每日金句、计划进度、学习+复习双入口、删除计划按钮。违背"一页一核心任务"。

三个已核实的硬事实：

1. **Learn 和 Review 数据层已是同一队列**（`services/learn.ts:39` `const allCards = [...reviewCards, ...newCards]`），页面层却保留两个入口。Plan 页的"开始学习"和"复习"两个按钮指向同一批卡。
2. **Review 页 `getDueCards`（`db/card.ts:15`）不过滤 `state != "new"` 且不按书卷过滤**——新卡会泄漏进复习队列，多计划场景下语义分叉。
3. **签到→金句是产品动线亮点**（`PlanClient.tsx:163-187`）：未签到显示签到卡，签完同一位置变每日金句。这是用户明确喜欢的设计，**保留**。

## 2. 设计目标

**Plan 页一屏回答："我今天该做什么？"**

- 今日任务（复习+新卡混合队列）成为唯一主角
- **保留原"签到→金句"槽位设计**（`PlanClient.tsx:163-187`）：未签到显示签到卡（邀请动作），签完同一位置变每日金句（奖励）。这是产品动线亮点，**不可改动**
- 危险操作（删除计划）收进"…"菜单
- 用户信息/登出从首页移除（Settings 已有 `SettingsClient.tsx:96-105`）
- 底部导航保持 3 项不变（计划/笔记/设置）

## 3. 页面结构（自上而下）

```
┌─────────────────────────────────┐
│ 周五 · 8月7日                   │  ← 顶栏：日期（streak 留在签到卡）
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 今日任务                    │ │  ← 核心卡
│ │  待复习 5 节 · 新经文 3 节   │ │
│ │  ┌───────────────────────┐  │ │
│ │  │   开始今日学习         │  │ │  ← 全宽主按钮（唯一 CTA → /learn）
│ │  └───────────────────────┘  │ │
│ │  今日已完成 2 节            │ │  ← 无分母，避免队列漂移
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 未签到: 签到卡(邀请+签到按钮)│ │  ← 原槽位设计，两态之一
│ │ 已签到: 每日金句             │ │  ← 原槽位设计，两态之二
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 罗马书        [学习中]      │ │  ← 书卷进度卡（纯展示）
│ │ ██████████░░░░░░░ (43%)     │ │  ← ProgressBar 三色
│ │ 每日 3 节 · 已学 128/433    │ │
│ │                         ⋮   │ │  ← DropdownMenu：删除计划
│ └─────────────────────────────┘ │
│                                 │
│ [计划]   [笔记]   [设置]        │
└─────────────────────────────────┘
```

## 4. 数据需求

### 4.1 新增：`getTodaySummary(userId)`

**位置**：`services/learn.ts` 新增导出。

**约束**：where 条件必须与 `getTodayTasks`（`services/learn.ts:14-36`）完全一致，否则摘要与队列实际数量不符。

```
review  = count(Card where userId, state != "new", due <= now, verse.bookId = plan.bookId)
new     = count(Card where userId, state = "new", verse.bookId = plan.bookId)   // 上限 plan.versesPerDay
```

返回 `{ review: number, new: number }`。

注意 review 计数需与 `MAX_REVIEW_PER_DAY` 取 min（50），new 与 `plan.versesPerDay` 取 min——与 `getTodayTasks` 的 `take` 保持一致。

### 4.2 新增：`getTodayReviewedCount(userId, bookId)`

**位置**：`db/card.ts` 新增。

```
count(Card where userId, verse.bookId = bookId, lastReview >= 今日零点)
```

用本地时间零点（参考 `lib/date.ts` 已有工具，勿用 UTC）。

### 4.3 复用（不改）

- `planService.getActivePlanDetails` → 计划/书卷/总数/工作日
- `cardDb.getCardProgress(bookId, userId)` → 三色进度
- `checkinService.getCheckinStatus(userId)` → `{ checkedIn, streak }`
- `getDailyVerse()` → 金句（含 `reference` 字段，结构 `DailyVerse`）

## 5. 改动清单（文件级）

### 5.1 `services/learn.ts`
新增 `getTodaySummary`（见 4.1）。

### 5.2 `db/card.ts`
新增 `getTodayReviewedCount`（见 4.2）。

### 5.3 `app/plan/page.tsx`
- 调 `getTodaySummary` 和 `getTodayReviewedCount`（无计划时不调用，传 null）
- props 增加 `todaySummary`、`todayReviewed` 两个字段
- 其余现有 props 保留（progress/checkin/dailyVerse/books）

### 5.4 `app/plan/PlanClient.tsx`（主要重构）
- **顶栏**：替换现有 `user.name + 退出登录` 行（`:153-161`）为日期（`周五 · 8月7日`，`new Date()` 格式化）
- **今日任务卡**：新建卡片，替换原双按钮区（`:210-217`）：
  - 副文案 `待复习 {review} 节 · 新经文 {new} 节`
  - 全宽主按钮 `开始今日学习` → `/learn`（有任务时）；无任务时按钮文案 `今日已完成`（disabled 或点击回看）
  - `今日已完成 {todayReviewed} 节` 小字（永远显示，无分母）
- **签到→金句槽位（不动结构）**：原 `:163-187` 条件渲染原样保留——未签到显示签到卡（含 streak + 签到按钮 `handleCheckin`），已签到显示金句。**此部分逻辑不可改动**
- **书卷进度卡**：移除"开始学习/复习"两个 Link（`:210-217`），只留进度 + `…` 菜单（删除计划，现有 `handleDelete` 移入）
- **新增**：`DropdownMenu` 或 `Popover`（shadcn）承载删除计划；无则用 `<details>` 简易实现
- 无计划分支（`:96-146`）保持不变（新建计划流程不动）

### 5.5 下线 Review 页面
- 删除 `app/review/` 目录（page.tsx + ReviewClient.tsx）
- 删除 `services/review.ts`
- `components/BottomNavWrapper.tsx:7` NAV_PAGES 移除 `"/review"`
- **保留** `app/api/card/route.ts` 的 `getDueCards` 用法（API 层不动）

### 5.6 复核
`app/learn/LearnClient.tsx` 无需改动（队列已含复习+新卡，Badge 已有 `复习/新卡` 标识）。

## 6. 明确不做（Scope 边界）

- 不改 `LearnClient.tsx` 交互
- 不动底部导航结构（保持 3 项）
- 不动 `api/card` 的 GET（review 数据 API 保留，供未来复用）
- 注解/笔记入口优化（结果页塞研读内容的问题）——**本次不做**，另开 plan
- Undo 评分重构——**本次不做**
- **不部署到线上**：本次改动只在本地验证（`npm run dev` / `npm run build`），不上服务器、不 push 生产环境。部署命令按需由人工确认后再执行

## 7. 验收标准

1. Plan 页无计划时：显示创建计划表单（原逻辑不变）
2. 有计划时：首屏从上到下 = 顶栏(日期) → 今日任务卡 → 签到卡/金句槽位 → 书卷进度卡
3. 摘要数字与进入 `/learn` 后队列实际数量一致
4. 主按钮点击进入 `/learn`，无独立 `/review` 入口
5. **签到→金句动线不变**：未签到显示签到卡（含连续天数），点签到后同一位置变成今日金句
6. 删除计划仅存在于"…"菜单，首页主视觉不可见
7. `npm run build` 通过；`/review` 访问 404
8. **本地验证即可**：`npm run dev` 人工过一遍上述场景，不触发任何部署流程

## 8. 备注（给开发者的上下文）

- 现有 `handleDelete` 用 `confirm()`（`PlanClient.tsx:71`）——收进菜单后建议保留 confirm，双重防误触
- streak 由签到卡展示（原样保留），顶栏只放日期，避免重复
- 日期格式化参考 `lib/date.ts` 现有工具函数风格，本地时区
- 金句的 `dailyVerse` 类型含 `reference` 字段，可直接用（`约 1:1`）
