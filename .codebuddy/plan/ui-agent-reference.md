# UI 设计参考文档 — Logos 背经 APP

> 用途：作为 UI 设计 agent 的输入上下文，确保新设计与现有功能、组件、设计语言一致。
> 本文件随 UI 演进持续更新。

## 1. 产品与品牌

| 项 | 值 |
|----|-----|
| 名称 | Logos|
| 定位 | 圣经背诵学习 APP（中文恢复本 + 英文 KJV 对照） |
| 核心机制 | FSRS 间隔重复算法（四键评分：忘记/困难/良好/容易） |
| 目标用户 | 中文圣经学习者，移动端为主 |
| 形态 | PWA（有 manifest + service worker，可安装到主屏） |

## 2. 技术栈与布局约束

- **技术栈**：Next.js 15 App Router + TypeScript + Tailwind v4 + shadcn/ui（style: base-nova）+ lucide 图标
- **组件模型**：Server Component（page.tsx 直查 Prisma 取数）→ Client Component（*Client.tsx 交互）→ API → Service → DB
- **布局约束**：移动优先，内容容器 `max-w-lg mx-auto`（448px）单列堆叠；底部固定导航 `h-16`，body 有 `pb-16` 留白
- **主题**：CSS 变量双主题（`:root` 浅色 + `.dark` 深色），当前默认浅色
- **文案**：全中文

## 3. 设计系统（globals.css tokens）

### 色彩（oklch，中性无彩系）

| Token | 浅色 | 深色 | 用途 |
|-------|------|------|------|
| `--background` | `oklch(1 0 0)` 纯白 | `0.145` 近黑 | 页面背景 |
| `--foreground` | `0.145` 近黑 | `0.985` 近白 | 正文 |
| `--primary` | `0.205` 近黑 | `0.985` 近白 | 主按钮/强调 |
| `--primary-foreground` | `0.985` 近白 | `0.205` 近黑 | 主按钮文字 |
| `--secondary` | `0.97` 浅灰 | `0.269` 深灰 | 次级背景/标签 |
| `--muted` | `0.97` 浅灰 | `0.269` 深灰 | 弱化区域 |
| `--muted-foreground` | `0.556` 中灰 | `0.708` | 次要文字 |
| `--border` | `0.922` | `0.269` | 卡片描边 |
| `--destructive` | `0.577 0.245 27.325` 红 | `0.396...` | 危险操作 |

- 色相全部为 0（纯灰阶），无品牌色点缀 —— **阅读类应用的克制中性风格**
- 特殊状态色为内联 Tailwind（非 token）：进度三色 绿/橙/蓝、反馈 amber/green
- `@utility glass`：毛玻璃卡片（`blur(16px)` + 半透明白）
- 预留"暖纸"主题（globals.css 注释块，未启用，色相 ~80 米黄）

### 圆角与间距

- `--radius: 0.625rem`（10px），派生 `sm=6px / md=8px / lg=10px / xl=14px`
- 页面内卡片间距统一 `space-y-4`，页面容器 `p-4`

### 语义色约定（勿改）

- 进度条三色：`green-500`=已掌握、`orange-400`=学习中、`blue-200`=新（见 ProgressBar.tsx）

## 4. 组件清单

### shadcn/ui（components/ui/，可继续用）
`button` `card` `badge` `input` `label` `select` `separator` `tabs` `dialog`

### 自定义组件（components/）
| 组件 | 职责 |
|------|------|
| `BottomNav.tsx` | 固定底栏 3 项（计划/笔记/设置），内联 SVG 图标，激活态 `text-primary` |
| `BottomNavWrapper.tsx` | 按路由白名单决定是否显示底栏 |
| `ProgressBar.tsx` | 三色分段进度条 + 图例 |
| `BookSelector.tsx` | 书卷下拉选择器 |
| `VerseStudy.tsx` | 经文展示/背诵输入/比对评分（学习核心，被 learn/review 共享） |
| `AnnotationPanel.tsx` | 纲目/注解/串珠可折叠面板 |
| `VerseNotes.tsx` | 展示某节已有笔记 |
| `ToastProvider.tsx` | 轻量 toast（`useToast()` 返回 `toast(msg, "success"\|"error")`） |

## 5. 页面现状（信息架构）

路由：`/login` `/plan` `/learn` `/notes` `/settings` `/admin`（另有 not-found/error/loading 全局页）

| 页面 | 当前结构 | 设计意图 |
|------|---------|---------|
| **/login** | 账号/密码表单 | 简洁居中 |
| **/plan**（v2 已重构） | ① 日期顶栏（`周五 · 8月7日`）→ ② **今日任务卡**：`待复习 X 节 · 新经文 Y 节` + 全宽主按钮"开始今日学习"（唯一 CTA → /learn）+ `今日已完成 N 节` 小字 → ③ **签到→金句槽位**（未签到=签到卡含连续天数；已签到=每日金句）→ ④ 书卷进度卡（ProgressBar + `每日 X 节 · 已学 N/总数` + `…` 菜单内"删除计划"）。无计划时显示创建表单（书卷选择 + 每日节数） | 一屏回答"今天该做什么"，单 CTA |
| **/learn** | 任务队列（复习卡在前+新卡在后），模式流：**查看经文 → 背诵输入（全文/填空，可切 EN 对照）→ 比对结果 + 四键评分 → 下一节**。顶部 Badge `复习/新卡` + `当前/总数`，多章时有章节快速跳转 chip，快捷键 1-4 评分 / u 撤销 / Space 跳过 | 专注背诵流，键盘可达 |
| **/notes** | 笔记列表（书卷 章:节 标题 + 内容 + 日期 + 编辑/删除），空态插画，新建/编辑走 Dialog（书卷/章/节 + 文本域） | 简单 CRUD，无多余层级 |
| **/settings** | 用户卡（名/账号/管理员标记/退出登录 + 后台入口）→ 数据管理（导出/导入/清除，危险操作红色）→ 数据统计 2×2 → 反馈卡（类型 select + 提交 + 历史列表）→ 关于 | 工具页堆叠卡片 |
| **/admin** | 后台用户管理（管理员可见） | 独立管理页 |

## 6. 现有功能动线（UI 必须服务的功能，勿破坏）

1. **今日任务 = 复习 + 新卡混合队列**（单一入口 /learn，无独立复习页 —— v2 已下线 /review）
2. **签到→每日金句动线**：未签到显示签到卡（含连续天数 streak），签到后同一位置变每日金句（奖励）—— 产品亮点，**结构不可改**
3. **FSRS 四键评分**（忘记/困难/良好/容易），支持快捷键 1-4
4. **Undo 撤销评分**（快捷键 u），评分后出现"撤销"
5. **背诵模式**：全文 / 填空切换；中英（恢复本/KJV）切换
6. **数据管理**：JSON 导出/导入/清除（settings）
7. **删除计划**：仅存在于计划页 `…` 菜单，带 `confirm()` 二次确认

## 7. 给 UI agent 的约束

- **只改 UI 层**（组件、样式、布局、动效），不动数据流/交互逻辑/API
- 保持 CSS 变量双主题机制；新增颜色尽量用现有 token 或内联 Tailwind 语义色
- 保持移动优先 `max-w-lg` 单列布局与底部导航（3 项不变）
- 优先复用现有组件；确需新 shadcn 组件时说明（`npx shadcn add <name>`）
- 中文文案；经文类长文本注意字号、行距（leading-relaxed）、留白
- 完成后必须 `npm run build` 通过；改动只在本地验证，不部署

## 8. 代码索引（给 agent 的入口文件）

- 设计 token：`app/globals.css`
- 根布局/底栏：`app/layout.tsx`、`components/BottomNav.tsx`
- 各页：`app/<route>/page.tsx` + `*Client.tsx`
- 共享学习组件：`components/VerseStudy.tsx`
- 类型：`types/index.ts`（BookInfo / PlanInfo / TaskData / DailyVerse / CardProgress...）
