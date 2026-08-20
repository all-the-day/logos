# Logos — 圣经背诵学习 APP：Agent 工作约定

`AGENTS.md` 是项目级 Agent 工作契约，不是更新日志。它记录任何 Agent 长期都必须遵守的规则、不变量与红线；频繁变化的状态信息放在 `PROJECT_BRIEF.md`，运维细节放在 `docs/OPERATIONS.md`。

## 1. 文件作用域与权威顺序

| 文档 | 内容 | 更新频率 |
|------|------|---------|
| `AGENTS.md` | 长期规则、产品不变量、架构边界、测试与安全红线（本文件） | 低 |
| `PROJECT_BRIEF.md` | 当前目录结构、书卷库存、功能进度、已知问题、下一步 | 随功能变化 |
| `docs/OPERATIONS.md` | 部署、PM2、Caddy、服务器差异（不含凭据） | 运维变化时 |
| 代码 / schema / package 配置 | 当前实现事实的核验依据 | — |

权威顺序：产品约束、安全规则以 `AGENTS.md` 为准，除非用户明确覆盖；实现事实以代码、schema、package 配置为核验依据。
冲突处理：不得静默忽略冲突，应修正文档或报告问题。

## 2. 项目一句话说明

Logos（"太初有道"）是移动端优先的中文圣经背诵 PWA：中文恢复本 + 英文 KJV 对照，FSRS 间隔重复，每日"复习旧卡 + 学新卡"，签到后原位切换为每日金句。

技术栈：Next.js 15 App Router + React 19 + TypeScript + Tailwind v4 + shadcn/ui + Prisma 6 + SQLite。
Node.js ≥ 22（`lib/import-book.ts` 依赖 `node:sqlite`；以 `package.json#engines` 为准）。

## 3. 产品不可破坏约束

- 产品为移动端优先的中文圣经背诵 PWA，内容为中文恢复本与英文 KJV 对照，全中文 UI。
- 首页跳转 `/plan`；底部导航固定为计划、笔记、设置三项（`BottomNavWrapper` 白名单控制）。
- `/review` 已下线，不得恢复为独立入口；学习统一进入 `/learn`。
- Plan 页有计划时按以下顺序展示：
  1. 日期顶栏
  2. 今日任务卡
  3. 签到／每日金句槽位
  4. 书卷进度卡
- "签到卡原位切换为每日金句"是核心产品动线，不得拆成两个独立区块。
- "开始今日学习"是 Plan 页唯一主 CTA，指向 `/learn`。
- 删除计划只能位于书卷进度卡的更多菜单（"…"）中，并要求确认。
- 今日任务摘要必须与 `/learn` 实际队列一致（共享查询条件）。
- 复习队列不得包含 `state = new` 的卡片；复习队列跨全部已学书卷（卡片是用户永久学习资产：换计划、删除计划都不删除卡片；真正重置学习进度只能在设置页"清除数据"）。
- 新卡仅从当前计划书卷引入，且每日受配额限制：今日新卡数 ≤ `versesPerDay − 今日首次引入数`（`Card.introducedAt` 记录首次离开 `new` 态的时间，重学不重复计数）。
- 学习页动线：新卡先查看后背诵；复习卡（learning/review/relearning）默认直接进入背诵态，保留"查看原文"；一旦查看原文，本次推荐评分封顶"困难"（不再推荐"正确/容易"）。四键评分与快捷键（1-4 / u / Space）不得破坏。

## 4. 架构边界

```
Server Component (page.tsx)  鉴权 + 读取（可调用 Service / DB 层）
        ↓ props
Client Component (*Client.tsx)  用户交互（不得直连 Prisma）
        ↓ fetch
API Route (route.ts)  写操作 + 登录态 cookie
        ↓
Service Layer (services/*.ts)  业务逻辑
        ↓
DB Layer (db/*.ts)  Prisma 查询
        ↓
SQLite (prisma/dev.db)
```

- Server Component 负责鉴权和读取，可调用 Service 或 DB 层；不得直接写。
- Client Component 只负责交互，不得直接访问 Prisma。
- 写操作默认路径：`Client → API Route → Service → DB → Prisma`。
- API Route 必须校验登录态、资源所有权和输入边界。
- DB 层只封装 Prisma 查询，不应包含 UI 或 HTTP 逻辑。
- 核心业务规则优先放在 Service 或纯函数中，避免在页面和 API 中复制。
- 日期敏感逻辑使用统一日期工具；`DateTime` 写入 Prisma 前必须转换为有效的 `Date`；测试时区固定为 `Asia/Shanghai`。

## 5. 数据、鉴权、日期规则

- SQLite 单文件 `prisma/dev.db`，Prisma schema 10 张表：Book / Verse / Annotation / Card / Note / Plan / Checkin / User / Session / Feedback。
- Card 的 `introducedAt`（首次离开 `new` 态的时间）用于每日新卡配额；首次评分时由 `services/card.ts#rateCard` 写入。
- 数据源为 `data/bible.db`（恢复本）与 `data/bible_kjv.db`（KJV），经 `lib/import-book.ts` 用 `node:sqlite` 直读导入（`prisma/seed.ts` 复用），不经过 JSON 中间产物。`npm run db:seed` 已实测可重复执行：连续运行不重复导入、不产生唯一约束错误、不触碰用户数据。
- 鉴权：scrypt 密码哈希 + session cookie（`logos_session`）；写接口用 `requireUser()` 校验登录态。
- 时间：签到日期按本地日期字符串 `YYYY-MM-DD` 存储；服务端 / 测试 TZ=Asia/Shanghai。
- 数据导出／导入是用户数据迁移通道，不得破坏数据语义。

## 6. 开发与质量门槛

```bash
npm run dev           # http://localhost:3000
npm run build         # 生产构建
npm start             # 生产运行
npm run test          # Vitest 单测 + 集成测试
npm run test:watch / test:coverage / test:db:reset
npm run db:push       # 同步 schema → SQLite
npm run db:seed       # 从 data/bible*.db 可重复增量导入（跳过已导入）
npm run db:generate / db:studio
```

- Node.js ≥ 22；不得假定 Node 20 可运行种子导入（`node:sqlite`）。
- TypeScript 严格模式；改动核心算法（FSRS、LCS 比对、日期）必须新增或更新单元测试。
- `next dev` 与 `next build` 共用 `.next` 目录：不要在同一工作区内无清理地交替运行两者，否则可能触发 `MODULE_NOT_FOUND`/500。切换模式前先停服务并删除 `.next`。
- **Android APK（Capacitor 在线壳）**：出包走 GitHub Actions（`.github/workflows/build-apk.yml`，push 到 master 或手动触发），产物为 Actions artifact；不在本地手工执行 `./gradlew` 出包。壳配置 `capacitor.config.json`（appId `com.duoban.logos`，`server.url` 指向线上域名）；`android/` 为 CI 生成目录，不入库。

## 7. 测试数据库安全

- 测试不得连接或重置 `prisma/dev.db`。
- 集成测试固定使用 `prisma/test.db`：vitest 配置 `DATABASE_URL=file:./test.db` + `tests/fixtures/setup.ts` 进程级校验；测试前运行 `npm run test:db:reset`（脚本含精确路径保护，拒绝 dev.db）。
- 不得为了导入经文或跑测试删除 `prisma/dev.db`。

## 8. Git、部署与生产安全

- 未经用户明确要求，不得 commit、push、rebase、改写历史或创建标签。
- 不得使用 `git reset --hard`、`git clean -fd` 等破坏性命令；不得覆盖或删除用户已有的未提交修改。
- 开工前必须查看 `git status --short`，区分当前任务和既有改动。
- 不得提交 `prisma/dev.db`、`prisma/test.db*`、`coverage/`、`data/*.db`、`.env*` 或任何凭据。
- 生产访问凭据不得写入仓库；只能使用经确认的运维工具。
- 生产运维的唯一权威来源为仓库外的 `D:/coder/aiWorkSpace/server-ops/server-ops.py`（其 `config.json` 含凭据，不入库）；仓库内 `.codebuddy` 中的旧运维配置不得用于生产。
- 未经用户明确确认，不得部署、SSH、PM2、推送或操作生产环境。
- 数据迁移、生产数据库修改必须单独确认并先备份。
- APK 壳发布包（签名 keystore）属生产凭据：不得入库，不得写入 workflow 明文；需要签名发布时单独规划。

## 9. 文档同步协议（强制）

### 每个任务开始前

1. 阅读根目录 `AGENTS.md`。
2. 阅读 `PROJECT_BRIEF.md` 及相关目录下的局部说明。
3. 检查 `git status --short` 和真实代码，不得仅凭文档推断当前状态。
4. 任务清单最后一项必须是：`检查并同步 AGENTS.md / PROJECT_BRIEF.md`。

### 必须更新 AGENTS.md 的情况

出现以下任一变化时，必须在同一任务和同一变更集中更新：

- 产品主流程、核心交互或不可破坏的产品约束发生变化
- 新增、删除或改变主要页面、路由、导航入口
- 项目架构、分层方式、目录职责发生变化
- 技术栈、运行环境、依赖管理或主要命令发生变化
- Prisma schema、核心数据语义、鉴权、会话、时区策略发生变化
- 测试体系、质量门槛或测试数据库策略发生变化
- 构建、部署、服务器运维或安全约束发生变化
- 已知问题改变了长期产品约束、数据安全规则或架构边界

普通缺陷状态、测试数量、阶段进度、书卷库存和短期待办只更新 `PROJECT_BRIEF.md`；若同时影响 Agent 的长期工作方式或项目约束，才更新 `AGENTS.md`。

### 通常不需要更新 AGENTS.md 的情况

- 不改变外部行为的局部重构
- 单纯样式、间距、文案调整
- 普通缺陷修复，且不改变架构或数据契约
- 增加测试用例，但测试策略本身没有变化
- 临时调试代码和一次性调查结果

### 任务完成前

1. 查看完整 diff，判断是否触发上述更新条件。
2. 更新时应修改"当前状态"，同时删除过时描述；不要只追加历史记录。
3. 若文档与代码冲突，按第 1 节权威顺序处理，不得静默忽略。
4. 未经用户明确要求，不得自行创建 Git commit。
5. 最终回复必须包含以下二者之一：
   - `AGENTS.md：已更新——<更新内容>`
   - `AGENTS.md：无需更新——<具体原因>`

未完成文档影响检查，不得声明任务完成。

## 10. 相关文档入口

- `PROJECT_BRIEF.md` — 当前目录结构、书卷库存、功能进度、已知问题、下一步
- `docs/OPERATIONS.md` — 部署、PM2、Caddy、服务器差异（无凭据）
- `.codebuddy/skills/server-ops/SKILL.md` — 本地运维 skill 入口
- 旧项目 `d:\coder\aiWorkSpace\bible-memorize` 仅作为算法和行为参考；经文导入使用 `lib/import-book.ts`，不再使用 `scripts/extract-verses.ts`
