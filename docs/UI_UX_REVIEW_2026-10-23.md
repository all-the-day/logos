# Logos UI/UX 评审方案（2026-10-23）

> 仅出方案，**不在本变更集落地**。评审依据：
> - **Vercel Web Interface Guidelines**（vercel-labs/web-interface-guidelines，191 条规则全文）
> - **WCAG 2.2 SC 2.5.8 Target Size (Minimum)**：指针目标 ≥ 24×24 CSS px（AA）
> - **Apple HIG**：触摸目标 ≥ 44×44 pt
> - **Material Design 3**：触摸目标 ≥ 48×48 dp
> - **NN/g 触摸目标研究**（移动端拇指操作区）
> - 浏览器实测：dev 服务器 390×844 视口下逐页量取关键控件尺寸、比对真实渲染

评审范围：`app/plan`、`app/learn`、`app/practice`、`app/notes`、`app/settings`、`app/login`、`components/{BottomNav,VerseStudy,ToastProvider,ProgressBar,BookSelector}`、`components/ui/button.tsx`、`app/globals.css`、`app/layout.tsx`。

---

## 总体判断

Logos 的核心学习动线（主动回忆 → 默写 → 自动判定）在交互逻辑上已经很扎实，特别是：
- 结果页按钮的 `aria-label` 带状态（「未通过，重新练习」/「通过，下一组」），满足 WCAG 1.4.1 不依赖颜色单独传达信息
- 颜色对比度合格（orange-700 白字 5.18:1、green-700 白字 5.02:1、muted 灰 4.67:1，均过 AA）
- 语音输入的长按手势 + 上滑取消 + 录音回放 + 可修改文本，在移动端习惯上是对的
- 删除计划/清空数据有确认（`confirm()` / 输入「清除」）

但作为**移动端优先**的 PWA，存在一组系统性问题：**主 CTA 高度 32px、次级按钮 28px，全部低于 WCAG 24px 最小值，更远低于 iOS HIG 44pt / Material 48dp 的移动触摸推荐值**。用户在公交车上单手操作时，主操作点不中是最高频的挫败来源。

---

## P0 —— 阻断性体验问题（建议本轮修）

### 1. 全局按钮尺寸过小，主 CTA 不达标

**现状**（`components/ui/button.tsx:11-21`）：
| size | 高度 | 实测典型场景 |
|------|------|------------|
| `xs` | 24px | （目前未用） |
| `sm` | 28px | 「填空」切换、「整章」、「重新练习」、「新建笔记」、「后台管理」 |
| `default` | 32px | **「开始今日学习」主 CTA**、「提交 (Enter)」、「清除所有数据」 |
| `lg` | 36px | 「签到」 |

**实测**（390×844 视口）：
- 「开始今日学习」主 CTA：**326×32 px**（app/plan/PlanClient.tsx）
- 「提交 (Enter)」：**326×32 px**（components/VerseStudy.tsx:409）
- 「重新练习」（结果页唯一主操作）：**73×28 px**、字号 12.8px（components/VerseStudy.tsx:465）
- 「填空」toggle：**47×28 px**
- 「签到」：**49×36 px**

**违反**：
- WCAG 2.2 SC 2.5.8：24×24 最小值，`sm` 与 `default` 都在边缘或以下
- Apple HIG 44pt：全部不达标
- Material 48dp：全部不达标
- Vercel 规则：「Interactive states increase contrast: hover/active/focus more prominent than rest」（尺寸本身就是可点性的最直观信号）

**建议**：
- 移动端全局把 `default` 按钮提到 **44px**（`h-11`），`lg` 到 **48px**（`h-12`）
- `sm` 保留给「次要操作 + 有等价大目标」的场景（如章节快速跳转 pills 可保持小，因为不是主路径）
- 桌面端可用 `md:h-9` 回退到 36px，避免桌面鼠标场景显得过大
- 主 CTA（开始今日学习 / 提交 / 重新练习 / 下一组）统一用 `lg` = **48px**，并加 `text-base` 字号
- 结果页「重新练习」从 73×28 改为 **至少 120×44**，字号从 12.8px 提到 14px

**影响面**：所有页面，但改动集中在 `components/ui/button.tsx` 的 size 定义 + 少数直接写死高度的地方（`Input className="h-9"`、`Select px-3 py-2` 等）。

---

### 2. 语音输入只支持触摸，桌面与键盘用户无法使用

**现状**（`components/VerseStudy.tsx:267-275`）：
- 语音区只有 `onTouchStart / onTouchMove / onTouchEnd / onTouchCancel`
- 桌面端鼠标点击**完全无响应**
- 键盘 Tab 到语音按钮后，Enter/Space 也无效（没有 `onKeyDown`）
- 虽标了 `role="button" tabIndex={0}`，但只是个"看起来可点的死元素"

**违反**：
- Vercel 规则：「Gesture-only action without tap/click and keyboard alternative」（反模式清单）
- Vercel 规则：「Interactive elements need keyboard handlers (`onKeyDown`/`onKeyUp`)」
- WCAG 2.1 SC 2.1.1 Keyboard：所有功能必须键盘可达

**建议**：
- 增加 `onMouseDown / onMouseUp / onMouseLeave` 对应桌面长按
- 增加 `onKeyDown`：Space/Enter 按下开始录音，松开停止
- 桌面端提示文案从「按住 说话」改为「按住说话（或按 Space）」
- 若用户环境 `asrEnabled=false`，整个语音区应该隐藏而不是禁用（现在已隐藏，保持）

**影响面**：仅 `VerseStudy.tsx` 的语音输入组件。

---

### 3. 登录页输入框无 label、无 autocomplete

**现状**（`app/login/LoginClient.tsx:38-56`）：
- 两个 `<input>` 只有 `placeholder="账号" / "密码"`
- 没有 `<Label>`、没有 `id`、没有 `name`、没有 `autoComplete`
- 错误信息 `text-sm text-red-600` 无 `role="alert"`（line 66）

**违反**：
- Vercel 规则：「Form controls need `<label>` or `aria-label`」、「Inputs need `autocomplete` and meaningful `name`」、「Errors inline next to fields; focus first error on submit」
- WCAG 2.1 SC 1.3.1 / 3.3.2 / 4.1.3

**建议**：
- 加 `<Label htmlFor="login-username">账号</Label>`（可视觉上 sr-only 保留 placeholder 风格，但语义必须存在）
- 加 `id` / `name="username"` / `autoComplete="username"` 与 `name="password"` / `autoComplete="current-password"`
- 错误提示加 `role="alert"`，提交失败时 `focus()` 到第一个错误字段
- `spellCheck={false}` 加在账号输入框（Vercel 规则）

**影响面**：仅 `LoginClient.tsx`。

---

### 4. Toast 无 aria-live，屏幕阅读器无法感知

**现状**（`components/ToastProvider.tsx:25-58`）：
- 3 秒自动消失的浮动提示，无 `role="status"` / `aria-live`
- 颜色硬编码 `bg-green-600 / bg-red-600 / bg-primary`

**违反**：
- Vercel 规则：「Async updates (toasts, validation) need `aria-live="polite"`」
- WCAG 2.1 SC 4.1.3 Status Messages

**建议**：
- 容器加 `role="status" aria-live="polite" aria-atomic="true"`
- 错误 Toast 用 `role="alert"`
- 颜色改为语义 token（`bg-emerald-600` → `bg-success`，`bg-red-600` → `bg-destructive`），或在 `globals.css` 新增 `--success` token
- 3 秒消失对屏幕阅读器偏短，错误类 Toast 建议 5 秒或常驻直到用户关闭

**影响面**：`ToastProvider.tsx` + `globals.css`。

---

## P1 —— 高价值改进（建议下一轮）

### 5. 页面缺 h1 或层级跳跃

**现状**：
- `/plan` 用 `<h1 className="sr-only">今日背诵计划</h1>` ✓
- `/learn` 用 `<h2>` 作为页面主标题（罗马书 1:1）
- `/practice` 用 `<h2>自由练习</h2>` 作页面标题，无 h1
- `/notes`、`/settings` 完全无 h1（底部导航高亮承担了页面指示）

**违反**：
- Vercel 规则：「Headings hierarchical `<h1>`–`<h6>`」
- WCAG 2.1 SC 1.3.1

**建议**：
- 所有页面都有视觉或 sr-only 的 h1：`/learn` 改为 `<h1 className="sr-only">学习</h1>` + 经节引用仍用 h2；`/notes`/`/settings`/`/practice` 同理
- 避免 h1 → h3 跳级

---

### 6. 底部导航缺 `aria-current="page"`

**现状**（`components/BottomNav.tsx:38-50`）：
- 激活态只靠 `text-primary` 颜色区分
- `<nav>` 无 `aria-label`
- `/learn` 在 `BottomNavWrapper` 白名单里显示底栏，但底栏三项都不激活（学习页其实不属于"计划/笔记/设置"任一项，视觉上会让人觉得"我没在任何 Tab 上"）

**违反**：
- WCAG 2.1 SC 4.1.2 / Vercel 规则：「Use semantic HTML before ARIA」+「Meaningful state」

**建议**：
- `<nav aria-label="主导航">`
- 激活项加 `aria-current="page"`
- 决定 `/learn` 的归属：要么把「计划」项在学习时也高亮（因为它从计划进入），要么学习页隐藏底栏（更沉浸，学习动线更聚焦——**推荐**，避免背诵时误触跳走）

---

### 7. 硬编码颜色散布，缺少语义 token

**现状**：审计发现 **17+ 处**硬编码颜色，绕过了 `globals.css` 的语义 token：
- `text-red-600 / red-500 / red-400 / bg-red-50`（PlanClient、VerseStudy、ToastProvider、SettingsClient）
- `text-green-600/700 / bg-green-500/600/700`（VerseStudy、ToastProvider、SettingsClient）
- `text-orange-400/600 / bg-orange-50/400`（VerseStudy）
- `text-amber-600`（SettingsClient 反馈状态）
- `bg-blue-200`（ProgressBar 新卡段）
- `themeColor: "#1a1a2e"`（`app/layout.tsx:8`，与浅色背景不一致——PWA 在 Android 上标题栏会是深色）

**问题**：
- 暗色模式上线时全部要改一遍
- 语义不一致（同一个"通过"绿色在 5 个地方用了 3 种色阶）

**建议**：
- 在 `globals.css` 扩展 token：`--success / --warning / --danger / --info`，含 `foreground` 变体
- `ProgressBar` 的三色语义（绿=已掌握 / 橙=学习中 / 蓝=新）抽成 `--progress-mastered / --progress-learning / --progress-new`
- `themeColor` 改成 `oklch(1 0 0)` 或动态匹配 `prefers-color-scheme`
- 逐文件替换硬编码类名

---

### 8. 笔记/自由练习的表单 label 未关联

**现状**：
- `app/notes/NotesClient.tsx:160-167`：`<Label>书卷</Label>` 没有 `htmlFor`，`<select>` 没有 `id`
- `app/practice/PracticeSetupClient.tsx:218-228`：节范围起/止输入框只有 `aria-label="起始节"/"结束节"`，没有可见 label
- `app/practice/PracticeSetupClient.tsx:127-133`：「自由练习」用了 h2 但整页无 h1（前面 P1-5 已提）

**建议**：
- 所有 `<Label>` 加 `htmlFor`，对应控件加 `id`
- 节范围输入框：保留 `aria-label` + 补一个可见的 `<span id>` 说明，或 `<fieldset><legend>节范围</legend>`
- 提交失败时 focus 第一个错误字段（Vercel 规则）

---

### 9. 缺 `overscroll-behavior` 和 safe-area 适配

**现状**：
- `<body>` 没有 `overscroll-behavior`，iOS 橡皮筋滚动会牵动整个 WebView
- 没有 `env(safe-area-inset-bottom)`，iPhone 底部 Home 指示条会盖住底栏的 1-2px 边
- `<meta name="theme-color">` 是深色 `#1a1a2e`，但页面是浅色 —— PWA 安装后 Android 标题栏颜色错误

**建议**：
- `html { overscroll-behavior: none; }`（桌面 fine pointer 下）+ `@media (pointer: coarse) { html { overscroll-behavior: auto; } }` 保留移动端 pull-to-refresh（Vercel 规则）
- 底栏容器加 `padding-bottom: env(safe-area-inset-bottom)`
- Dialog/Drawer 打开时 `overscroll-behavior: contain`（Vercel 规则）
- `themeColor` 改为浅色或按主题切换

---

### 10. 学习页顶部状态区信息密度可优化

**现状**（`app/learn/LearnClient.tsx:315-360`）：
- 顶栏一行挤了「经节引用 + 复习/新卡 Badge + 填空 toggle + 进度 1/7」
- 进度点太小（`h-1.5 w-3`），只能勉强看清位置
- 「首答 0/7」计数只在 `aria-label` 里，视觉上看不到

**建议**：
- 进度点改为更明显的 segmented bar（4-6px 高），或直接用 `1/7` 数字加粗
- 「首答 X/Y」视觉上显示（比如 `text-xs text-muted-foreground`），跟 aria-label 对齐
- 经节引用字号从 `text-sm` 提到 `text-base`（这是用户当前任务的**最主要标识**）

---

## P2 —— 细节打磨（有空再做）

### 11. 动画与 motion
- 现在用了 `transition-all`（Vercel 反模式：`transition: all` → 应列出具体属性）
  - 位置：`PlanClient.tsx:308`、`VerseStudy.tsx`、`ProgressBar.tsx` 多处
- 没有 `prefers-reduced-motion` 适配
- 建议：列出 `transition-colors / transition-transform / transition-opacity`；加 `@media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important } }`

### 12. 页面刷新策略
- `PlanClient.tsx:96,113,135`、`NotesClient.tsx:54,71`、`SettingsClient.tsx` 多处用 `window.location.reload()`
- 体验粗糙（白屏 + 闪烁），建议改为 `router.refresh()` + 本地乐观更新
- 失败时用 `alert()`（NotesClient line 54, 71）—— 改用 toast

### 13. 排版细节
- 没有 `text-wrap: balance` 在标题上（Vercel 规则）
- 数字列没有 `tabular-nums`（进度、统计数字会跳动）
- 中文没有明确字栈，依赖系统默认 —— 建议显式声明 `font-family: -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`
- "..." 应改为 "…"（`PlanClient.tsx`、加载态多处）

### 14. 确认对话框不统一
- 删除计划：原生 `confirm()`
- 删除笔记：原生 `confirm()`
- 清空数据：自定义 Dialog（输入"清除"）✓
- 建议：统一用自定义 Dialog（原生 `confirm()` 在 PWA 里样式突兀，且无障碍差）

### 15. 语音输入 60s 限制无前馈
- `VerseStudy.tsx:203-207` 只在到 60s 时自动停
- 建议：50s 时给一个视觉提示（倒计时 / 进度环），避免用户被打断时惊讶

### 16. 自由练习的章节选择
- 选了书卷后才出现章下拉，**章下拉没有 loading 骨架**（只有"正在读取本章经节..."文字提示，视觉跳变）
- 建议：用 `<Skeleton>` 占位

---

## 不建议改的地方（守住产品决策）

在评审中发现以下设计是**有意为之且合理**，不建议为了"符合通用规范"破坏：

1. **结果页只用按钮颜色 + aria-label 表达通过/未通过**，不显示文字「通过/未通过」——这是产品决策（避免负面标签打击用户），且已通过 aria-label 满足 WCAG 1.4.1。保留。
2. **学习页不提供"跳过"按钮**——产品决策（强制过 90%）。保留。
3. **新卡先 view 再 recite**、复习卡直接 recite ——主动回忆学习法。保留。
4. **签到卡原位切换为金句**——核心产品动线。保留。
5. **底部导航只有 3 项**（计划/笔记/设置）——产品边界。保留。
6. **语音输入的"按住 说话"交互**——移动端微信用户习惯已养成，比"点一下开始、再点一下结束"更不容易误触。只需补桌面/键盘支持（见 P0-2）。

---

## 建议落地顺序

按"影响面 × 修复成本"排序，**每个变更集独立可上线**：

| 批次 | 内容 | 预计工作量 | 用户感知 |
|------|------|-----------|---------|
| **B1** | P0-1 按钮尺寸全局调整（`components/ui/button.tsx` 改 size 定义 + 主 CTA 用 lg） | 0.5d | ⭐⭐⭐⭐⭐ |
| **B2** | P0-2 语音输入桌面/键盘支持 | 0.5d | ⭐⭐⭐ |
| **B3** | P0-3 登录页 label/autocomplete + P0-4 Toast aria-live | 0.5d | ⭐⭐ |
| **B4** | P1-5 各页 h1 + P1-6 底栏 aria-current + 学习页隐藏底栏 | 0.5d | ⭐⭐ |
| **B5** | P1-7 颜色 token 化 + P1-9 safe-area / overscroll / themeColor | 1d | ⭐⭐ |
| **B6** | P1-8 表单 label 关联 + P1-10 学习页顶部信息密度 | 0.5d | ⭐⭐ |
| **B7** | P2 全部细节（动画/刷新/排版/Dialog 统一/语音倒计时/骨架屏） | 1.5d | ⭐ |

**总工作量约 4.5 天**，B1 单独做就能带来最大的单点改进。

---

## 评审方式与证据存档

- **规则来源**：`docs/references/web-interface-guidelines.md`（191 条规则全文，建议入库作为长期参照）
- **实测截图**：会话 artifact 目录（`mcp__node_repl__js_*.png`），关键页面 390×844 视口截图
- **代码位置引用**：全部用 `file:line` 格式，VS Code 可点击跳转

---

## 未评审范围

- `/admin` 后台（非 C 端，本次跳过）
- PWA 离线体验（`public/sw.js` 缓存策略）
- APK 壳内表现（Capacitor WebView）
- 深色模式（`.dark` token 存在但无切换入口，暗色上线前需专项评审）
- 性能（LCP / INP / 包体积）
- 信息架构（"为什么签到在计划页"这类产品问题，不属于 UI/UX 规范评审）
