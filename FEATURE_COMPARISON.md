# Logos 功能迁移对照表

旧项目 `bible-memorize` (Next.js 14 Pages Router, JS, localStorage) → 新项目 `logos` (Next.js 15 App Router, TS, SQLite+Prisma)

状态说明：✅ 已迁移 ⚠️ 部分迁移/有 bug ❌ 未迁移

---

## A. 计划与签到 (Plan & Checkin)

| # | 功能点 | 旧项目实现 | 新项目状态 | 优先级 | 工作量 |
|---|--------|-----------|-----------|--------|--------|
| A1 | 创建计划 — 书卷选择 | BookSelector 下拉，从 available_books.json 加载 | ✅ BookSelector 组件，分新旧约两栏 | - | - |
| A2 | 创建计划 — 每日节数 | 数字选择器 (min 1) | ✅ 数字调节器 (1-10) | - | - |
| A3 | 创建计划 — 预览确认 | PlanPreview：总节数/工作日/完成日期估算 | ✅ POST /api/plan 创建 | - | - |
| A4 | 创建计划 — 主日跳过 | 计算工作日跳过星期天 | ✅ lib/date.ts isWeekday() | - | - |
| A5 | 删除计划 | 清除 localStorage plan 数据 | ✅ DELETE /api/plan（软删除） | - | - |
| A6 | 删除计划 — 关联清理 | 同时删除 cards 数据 | ✅ DELETE 清理 cards | - | - |
| A7 | 签到卡片 | 玻璃态卡片 + 日期 + 签到按钮 | ✅ 签到卡片组件 | - | - |
| A8 | 签到 — 连续天数 | localStorage 数组去重计算 | ✅ checkinDb.getCheckinStreak() | - | - |
| A9 | 每日金句 | 日期种子随机选经文 | ✅ lib/dailyverse.ts（数据库驱动） | - | - |
| A10 | 进度条 | 三色条：已掌握/学习/新 + 百分比 | ✅ ProgressBar 组件 | - | - |
| A11 | 进度统计 | 书卷级 mastered/learning/new 计数 | ✅ cardDb.getCardProgress(bookId) | - | - |

**待修复**

- **A6** — `app/api/plan/route.ts` DELETE 只做软删除，不同时清理 Cards。需补充：`prisma.card.deleteMany({ where: { verse: { bookId } } })`
- **A10** — 进度条百分比计算依赖 verseId 范围（按 verse.id >= start && verse.id <= end），跨书卷场景下失效

---

## B. 学习流程 (Learn)

| # | 功能点 | 旧项目实现 | 新项目状态 | 优先级 | 工作量 |
|---|--------|-----------|-----------|--------|--------|
| B1 | 今日任务列表 | getTodayTasks() 按计划范围取经文 | ✅ learnService.getTodayTasks()（已修复数组切片） | - | - |
| B2 | 任务列表 — 章节导航 | 快速跳转按钮（按章分组） | ✅ 章节 chip 条（含计数） | - | - |
| B3 | 经文展示 View | VerseView：大字体 + 中/EN 切换 | ✅ LearnClient ViewMode | - | - |
| B4 | 背诵模式 Recite | textarea 全文字输入 + Enter 提交 | ✅ ReciteMode（全文模式） | - | - |
| B5 | 填空模式 Fill | generateFillBlanks() 随机挖空 + inline inputs | ✅ ReciteMode（填空模式） | - | - |
| B6 | 全文/填空切换 | 按钮切换 reciteMode | ✅ mode 状态切换 | - | - |
| B7 | 中文/英文切换 | 按钮切换，显示 KJV 对照 | ✅ showEnglish 状态 | - | - |
| B8 | "查看原文"按钮 | 背诵时查看原文参考 | ✅ showOriginal 状态切换 | - | - |
| B9 | LCS 比对 | compareVerse() 生成 diff segments | ✅ lib/compare.ts → DiffView | - | - |
| B10 | Diff 展示 | 颜色标注：绿=正确/红=错误/橙=缺失/红=多余 | ✅ DiffView 组件 | - | - |
| B11 | 准确率显示 | matching_chars / total_chars | ✅ accuracy 百分比 | - | - |
| B12 | FSRS 评分 | Again/Hard/Good/Easy 四按钮 + 下次复习提示 | ✅ RatingButtons + previewInterval | - | - |
| B13 | 键盘快捷键 | 1-4 评分 + Enter 提交 + Space 跳过 + U 撤销 | ✅ 支持 1-4 + Enter + Space（U 待做） | - | - |
| B14 | 撤销评分 | 保存前一个 card 快照，可回退 | ✅ U 键 + "撤销"按钮 | - | - |
| B15 | 进度指示器 | "n/N" 完成进度 | ✅ Badge 显示 | - | - |
| B16 | 下一节/完成导航 | 自动跳下一节或完成页 | ✅ 自动切换 | - | - |
| B17 | cardId/verseId 映射 | 通过 verseId 找到对应的 Card | ✅ API 支持 verseId 参数 | - | - |

**已知问题**

1. **B17 (P0)** — `LearnClient.tsx:83` 中 `cardId: task.id`，task.id 是经文 verseId，但 API 的 `POST /api/card` 需要真实的 Card.id。当前数据碰巧未出错，但这是隐患。需在评分前先查询 Card。
2. **B1** — `services/learn.ts` 的 `getTodayTasks` 依赖 seed 生成的连续 ID（`book_index * 100000 + chapter * 1000 + section`），跨书卷场景下 `verse.id >= start && verse.id <= end` 会错误地包含其他书卷的经文。建议改为 `verse.bookId === plan.bookId && verse.chapter * 1000 + verse.verse` 范围判断。
3. **B8 (P1)** — "查看原文"按钮在 `LearnClient.tsx:287`，只有 `<Button variant="outline" size="sm">查看原文</Button>` 无 onClick。需添加：点击后显示原文模态框或内联展示。

---

## C. 复习流程 (Review)

| # | 功能点 | 旧项目实现 | 新项目状态 | 优先级 | 工作量 |
|---|--------|-----------|-----------|--------|--------|
| C1 | 到期卡片列表 | getDueCards() 按时序排序 | ✅ cardDb.getDueCards() → 列表展示 | - | - |
| C2 | 卡片选择 | 点击卡片高亮选中 | ✅ selectedId 状态 | - | - |
| C3 | 准确率彩色标识 | ≥95%绿 / ≥70%橙 / <70%红 | ⚠️ 前端通过 stability 估算准确率（非实际值） | P2 | S |
| C4 | 背诵模式 | 进入 View → Recite 流程 | ✅ 完整流程已实现 | - | - |
| C5 | LCS 比对 | 输入与原文比对 | ✅ 复用 VerseStudy 组件 | - | - |
| C6 | FSRS 评分 | 复习后更新卡片状态 | ✅ cardId 直接可用 | - | - |
| C7 | "还没有复习内容"空状态 | 空列表提示 | ✅ 空状态提示已实现 | - | - |
| C8 | 背诵时禁用填空模式 | 复习只支持全文背诵 | ✅ ReviewClient 仅全文模式 | - | - |

**核心问题**

复习页目前只有一个"列表浏览器"。完整流程需要：
1. 点击卡片 → 进入 ViewMode（展示经文）
2. "开始背诵" → ReciteMode（输入背诵）
3. 提交 → ResultMode（LCS 比对 + FSRS 评分）
4. 评分后 → 回到列表（或自动下一张）

**方案**：将 LearnClient 的 ViewMode/ReciteMode/ResultMode 三种模式抽取为独立组件（或共享 hook），让 ReviewClient 复用。参见旧项目 `pages/index.js` 中 `startReviewVerse()` / `startLearnVerse()` 共用同一套渲染逻辑的区别仅在于 `fromTab` 参数。

---

## D. 笔记 (Notes)

| # | 功能点 | 旧项目实现 | 新项目状态 | 优先级 | 工作量 |
|---|--------|-----------|-----------|--------|--------|
| D1 | 笔记列表（全局） | getAllNotes() — IndexedDB 倒序 | ✅ noteDb.getAllNotes() | - | - |
| D2 | 笔记列表 — 书卷名称 | 显示 book 名称 | ✅ 从 bookMap 读取真实名称 | - | - |
| D3 | 删除笔记 | deleteNote() + 确认弹窗 | ✅ Dialog 确认 + DELETE | - | - |
| D4 | 创建笔记 | 在 RateVerse 结果页添加笔记 textarea | ✅ 笔记页新建笔记 Dialog | - | - |
| D5 | 编辑笔记 | updateNote() 修改内容 | ✅ PUT handler + 编辑弹窗 | - | - |
| D6 | 按经文查看笔记 | 在背诵结果页显示该节笔记 | ❌ 缺失 | P2 | S |
| D7 | 空状态 | 图标 + "还没有笔记" + 提示文字 | ✅ 空状态 + CTA 按钮 | - | - |

**修复方案**

- **D2**: 在 `NotesClient.tsx:30` 中，需传入 bookId→name 映射或直接传 name
- **D4**: 两种方案
  - 方案 A：在学习结果页（ResultMode）增加"添加笔记"入口，类似于旧项目 RateVerse 中的 notes section
  - 方案 B：在 Notes 页面增加"新建笔记"按钮 + 弹窗表单（选择经文 + 内容）
- **D5**: 在 `app/api/note/route.ts` 增加 PUT handler

---

## E. 数据管理 (Settings)

| # | 功能点 | 旧项目实现 | 新项目状态 | 优先级 | 工作量 |
|---|--------|-----------|-----------|--------|--------|
| E1 | 导出数据 | 导出 localStorage 所有 key 为 JSON 文件 | ✅ 导出 plan/cards/notes/checkins | - | - |
| E2 | 导入数据 | 文件上传 → 解析 JSON → 恢复 | ✅ 完整导入（含 cards + notes） | - | - |
| E3 | 清除所有数据 | 删除 localStorage + IndexedDB | ✅ DELETE /api/data 清除所有表 | - | - |
| E4 | 版本信息展示 | 版本号 + 技术栈 + 数据来源 | ✅ 已展示 | - | - |
| E5 | 数据行数统计 | 显示总节数/卡片数/笔记数 | ❌ 缺失 | P2 | XS |

**修复清单**

- **E1** — `app/api/data/route.ts` GET handler 需增加 cards 导出
- **E2** — POST handler 需完成 notes 导入逻辑，并增加 cards 导入
- **E3** — DELETE 需清除所有关联表：Cards → Notes → Checkins → Plan

---

## F. 注解系统 (Annotations)

| # | 功能点 | 旧项目实现 | 新项目状态 | 优先级 | 工作量 |
|---|--------|-----------|-----------|--------|--------|
| F1 | 纲目（Outlines） | 可折叠 details + 层级缩进 | ✅ AnnotationPanel 组件 | - | - |
| F2 | 注解（Footnotes） | 可折叠 details + 序号列表 | ✅ AnnotationPanel 组件 | - | - |
| F3 | 串珠（Cross-refs） | 可折叠 details + 交叉引用 | ✅ AnnotationPanel 组件 | - | - |
| F4 | 注解数据 | 罗马书 54 纲目/254 注解/277 串珠 + 约翰一书 | ✅ 数据库已入库（2 卷，371 条） | - | - |
| F5 | 注解查询 API | 无（本地 JSON） | ✅ GET /api/annotation?verseId= | - | - |

**方案**：在学习/复习的 ResultMode 中增加 AnnotationPanel 组件（shadcn Collapsible/Accordion），从 `verseDb.getVerseAnnotations(verseId)` 获取数据。

---

## G. 基础设施 (Infrastructure)

| # | 功能点 | 旧项目实现 | 新项目状态 | 优先级 | 工作量 |
|---|--------|-----------|-----------|--------|--------|
| G1 | PWA Service Worker | 网络优先策略 + 缓存回退 | ❌ 缺失 | P3 | M |
| G2 | PWA Manifest | standalone, portrait, 自定义主题色 | ❌ 缺失 | P3 | S |
| G3 | 离线支持 | SW 缓存经文 JSON | ❌ 缺失 | P3 | M |
| G4 | 错误边界 | 无 | ✅ app/error.tsx + not-found.tsx | - | - |
| G5 | 加载状态/Skeleton | 无 | ✅ app/loading.tsx 全局骨架屏 | - | - |
| G6 | 移动端适配 | max-width 480px 居中 | ✅ Tailwind responsive | - | - |
| G7 | 底部导航图标 | SVG 矢量图标 | ✅ 5 个独立图标（计划/学习/复习/笔记/设置） | - | - |
| G8 | 静默更新 SW | _app.js 中 SW 更新 + 自动 reload | ❌ 不适用（SSR + 非 PWA） | P3 | - |
| G9 | Hydration 修复 | _app.js 中 mounted 状态 | ❌ 无（App Router 处理方式不同） | P2 | S |
| G10 | 服务部署脚本 | 无 | ❌ AGENTS.md 标记待做 | P3 | M |

---

## H. 对比功能列表（老项目有，新项目无）

| # | 功能点 | 说明 | 优先级 | 工作量 |
|---|--------|------|--------|--------|
| H1 | 快速章节导航 | 任务列表底部：按章分组跳转按钮（36x36 chip） | P2 | S |
| H2 | 撤销评分 | rateHistory 数组（上限 50），记录前后快照 | P2 | M |
| H3 | Space 跳过 | 按空格跳过当前经文 | P1 | XS |
| H4 | U 撤销 | 撤回最近一次评分 | P2 | S |
| H5 | 计划预览确认 | 创建前显示总天数+完成日期估算 | P2 | S |
| H6 | 评级按钮预览 | previewInterval 显示"X天后""X个月后"等 | ✅ 已实现 | - | - |
| H7 | 玻璃态卡片样式 | backdrop-blur + 半透明背景 | ❌ 缺失（可用 Tailwind 实现） | P3 | M |

---

## 按优先级分批推进计划

### 第一批：P0 阻断项（✅ 已完成）

| # | 任务 | 涉及文件 | 预估 | 状态 |
|---|------|---------|------|------|
| P0-1 | 修复 cardId 映射 | LearnClient.tsx:83, app/api/card/route.ts | 30min | ✅ |
| P0-2 | 修复学习任务范围计算 | services/learn.ts getTodayTasks | 30min | ✅ |
| P0-3 | 复习流程：嵌入背诵+比对+评分 | ReviewClient.tsx, components/VerseStudy.tsx | 2h | ✅ |
| P0-4 | 删除计划联动清理 Cards | app/api/plan/route.ts DELETE, db/card.ts | 15min | ✅ |
| P0-5 | 导出数据包含 Cards + 导入/清除完整 | app/api/data/route.ts, db/*.ts, SettingsClient.tsx | 1h | ✅ |

### 第二批：P1 核心缺失（本周完成）

| # | 任务 | 涉及文件 | 预估 | 状态 |
|---|------|---------|------|------|
| P1-1 | 导入数据补充 Cards + Notes | app/api/data/route.ts POST/PUT | 1h | ✅ |
| P1-2 | 清除数据联动清理所有表 | app/api/data/route.ts + SettingsClient | 30min | ✅ |
| P1-3 | 笔记创建 UI（笔记页 + 学习结果页） | NotesClient + note API | 1.5h | ✅ |
| P1-4 | 笔记编辑 API + UI | app/api/note/route.ts PUT + NotesClient | 45min | ✅ |
| P1-5 | "查看原文"按钮功能 | LearnClient.tsx:287 | 15min | ✅ |
| P1-6 | 复习页禁用填空模式 | ReviewClient.tsx | 15min | ✅ |

### 第三批：P2 体验优化（迭代完善）

| # | 任务 | 涉及文件 | 预估 | 状态 |
|---|------|---------|------|------|
| P2-1 | 注解面板（学习/复习结果页） | AnnotationPanel.tsx + api/annotation + VerseStudy | 2h | ✅ |
| P2-2 | 加载状态 Skeleton | app/loading.tsx | 1.5h | ✅ |
| P2-3 | 错误边界 | app/error.tsx + not-found.tsx | 1h | ✅ |
| P2-4 | 底部导航真实图标 | BottomNav.tsx | 30min | ✅ |
| P2-5 | 笔记列表空状态 | NotesClient.tsx | 15min | ✅ |
| P2-6 | 快速章节导航 | LearnClient.tsx | 1h | ✅ |
| P2-7 | 撤销功能 | LearnClient.tsx + ReviewClient.tsx | 1h | ✅ |

### 第四批：P3 增强（择时推进）

| # | 任务 | 涉及文件 | 预估 |
|---|------|---------|------|
| P3-1 | PWA (SW + manifest) | public/ + app/ | 2h |
| P3-2 | 更多书卷数据（全 NT） | seed + data JSON | 2h |
| P3-3 | 服务器部署脚本 | scripts/deploy.ps1 | 1h |
| P3-4 | 玻璃态 UI 风格 | globals.css / Tailwind | 1.5h |
| P3-5 | 操作反馈 Toast | 新组件 | 1h |

---

## 附加资料

- 旧项目代码：`d:\coder\aiWorkSpace\bible-memorize\pages\index.js` (~1017 行单文件)
- 旧项目样式：`d:\coder\aiWorkSpace\bible-memorize\styles\globals.css` (1071 行手写 CSS)
- 新项目架构：参考 AGENTS.md 六层架构图
- FSRS 算法：旧项目 `lib/fsrs.js` (261 行) → 新项目 `lib/fsrs.ts` (功能完整)
- LCS 比对：旧项目 `lib/compare.js` (148 行) → 新项目 `lib/compare.ts` (功能完整)

---

*最后更新：2026-07-29*
