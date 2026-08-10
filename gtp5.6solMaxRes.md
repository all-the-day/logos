已接收交接信息。后续应以本简报和实际代码为准，忽略过时的 `AGENTS.md`；未经明确确认，不部署、不推送生产，也不使用旧腾讯云配置。

## 一、建议执行顺序

### P0：建立测试基线，不改业务行为

推荐使用：

- **Vitest**：纯函数、Service、DB 集成测试
- **Playwright**：API HTTP 测试和主流程 E2E
- **独立 SQLite 测试库**：严禁连接 `prisma/dev.db`
- 初期不引入 jsdom/React Testing Library，避免设施过重

建议目录：

```text
tests/
├── unit/
│   ├── fsrs.test.ts
│   ├── compare.test.ts
│   └── date.test.ts
├── integration/
│   ├── learn.test.ts
│   ├── card-db.test.ts
│   └── checkin.test.ts
├── fixtures/
│   ├── db.ts
│   └── seed-test.ts
└── setup.ts

e2e/
├── auth.spec.ts
├── plan.spec.ts
├── learn.spec.ts
└── notes-data.spec.ts
```

推荐依赖：

```bash
npm install -D vitest @vitest/coverage-v8 vite-tsconfig-paths cross-env
npm install -D @playwright/test
npx playwright install chromium
```

建议脚本：

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

### 测试数据库安全要求

使用类似 `prisma/test.db` 的独立文件，并在重置脚本中加入硬保护：

- `DATABASE_URL` 必须明确指向 `test.db`
- 不符合时立即退出
- 集成测试和 E2E 使用单 worker，避免 SQLite 写锁竞争
- 测试前重建 schema，并导入少量确定性 fixture
- `prisma/test.db` 加入 `.gitignore`

不要直接让测试运行：

```bash
prisma db push --force-reset
```

应由带路径检查的脚本包装，防止误删开发或生产数据。

---

## 二、第一批必须覆盖的测试

### 1. `lib/fsrs.ts`

使用固定时间，覆盖：

- `NEW / LEARNING / REVIEW / RELEARNING` 的合法状态转移
- 四种评分 `AGAIN/HARD/GOOD/EASY`
- `reps` 每次只增加一次
- `lapses` 的增加条件
- `stability > 0`
- `difficulty` 不越界
- `due > lastReview`
- 通常应满足 `EASY` 间隔不短于 `GOOD`，`GOOD` 不短于 `HARD`
- `recommendRating` 的准确率边界

数值计算使用 `toBeCloseTo`，时间和状态使用精确断言，避免无意义快照。

### 2. `lib/compare.ts`

至少覆盖：

- 完全一致
- 漏字、错字、多字
- 空输入和空目标
- 重复汉字产生的 LCS 歧义
- 中文标点、英文标点、空白
- 差异段重组后仍能还原输入和目标
- `generateFillBlanks` 的密度边界
- `densityForStability` 在低、中、高稳定性下的结果

如果填空生成含随机逻辑，应先允许注入随机函数或种子，否则测试容易不稳定。

### 3. `lib/date.ts`

必须固定业务时区和系统时间，覆盖：

- 本地零点前后
- 月末、年末
- 周一到周日标签
- `YYYY-MM-DD` 格式
- `isWeekday`

这里存在一个潜在生产风险：浏览器、开发机和阿里云服务器的“本地时区”可能不同。建议明确业务时区为 `Asia/Shanghai`，至少确保启动环境和测试环境一致，不能依赖服务器默认时区。

### 4. `services/learn.ts`

这是当前最重要的回归测试：

- `getTodaySummary()` 与 `getTodayTasks()` 数量一致
- 51 张到期复习卡时，队列上限 50，摘要也必须显示 50
- 新卡数量不超过 `versesPerDay`
- 剩余新卡不足时按实际数量计算
- 新卡不得泄漏进复习队列
- 其他用户、其他书卷、非激活计划的数据不得进入队列
- `due === now` 应被选中
- 排序与章节顺序符合约定

建议给两个函数增加可选 `now` 参数，使一次业务计算只使用同一个时间点，避免零点附近出现摘要和队列不一致。

---

## 三、数据正确性修复顺序

### 1. 修复 `getDueCards`

建议将语义明确为：

```ts
getDueCards(userId, {
  bookId,
  now,
  limit,
})
```

查询条件至少包含：

```ts
{
  userId,
  state: { not: "new" },
  due: { lte: now },
  // 有 bookId 时通过 verse 关联过滤
}
```

并统一：

- `due ASC`
- `stability ASC`
- 明确 `limit`
- 新卡只能由新卡查询负责

修复前先写失败测试，避免再次出现新卡泄漏。

### 2. 重构 Undo

目前“客户端保存评分前整卡快照，再 PUT 恢复”存在以下问题：

- 客户端可篡改卡片字段
- 旧快照可能覆盖更新后的数据
- 重复撤销不易保证幂等
- 多标签页或重复请求容易产生竞态

推荐增加服务端 `ReviewEvent`/`ReviewLog`：

```text
ReviewEvent
- id
- userId
- cardId
- rating
- beforeSnapshot
- afterRevision
- createdAt
- undoneAt
```

评分过程放入事务：

1. 校验卡片所有权
2. 读取评分前状态
3. 计算 FSRS 新状态
4. 更新 Card
5. 保存 ReviewEvent
6. 返回 `reviewId`

撤销时客户端只提交 `reviewId`，服务端负责：

- 校验用户归属
- 只允许撤销最新有效评分
- 校验卡片版本未被后续操作改变
- 事务恢复并标记 `undoneAt`
- 重复请求保持幂等

不应再接受客户端提交完整 Card 作为可信恢复数据。

### 3. DateTime 存储一致性

先不要直接编写 SQL 修复生产库。应先：

1. 查清 `createMany` 和更新路径的真实存储格式
2. 所有应用写入统一传递 JavaScript `Date`
3. 禁止业务代码拼接日期字符串写 DateTime
4. 增加测试覆盖创建、更新、到期查询
5. 如需迁移，先备份数据库并编写一次性校验脚本

---

## 四、API 与 E2E 测试重点

API 鉴权测试最好通过真实 Next HTTP 服务完成，不建议大量 mock `cookies()`。

优先覆盖：

- 未登录访问写接口返回 401
- 用户不能操作其他用户的 Card、Note、Plan
- 重复签到只产生一条记录
- 创建计划和批量建卡具有事务性
- 重复建卡不破坏唯一约束
- 数据导入失败时不产生半成品
- 导出数据只包含当前用户
- 清除数据不影响其他用户

Playwright 主流程：

1. 登录
2. 无计划时显示创建表单
3. 创建计划
4. Plan 页面区块顺序正确
5. 唯一主 CTA 指向 `/learn`
6. 签到槽位由签到卡原位切换为每日金句
7. 学习：查看 → 背诵 → 比对 → 评分
8. 快捷键 `1-4`、`u`、`Space`
9. 删除计划仅在 `…` 菜单中
10. `/review` 返回 404
11. 新建、编辑、删除笔记
12. 导出数据

E2E 使用 Chromium 单浏览器、`workers: 1`，以控制资源和 SQLite 并发。

---

## 五、建议拆分的提交

```text
1. test: add vitest and isolated sqlite test harness
2. test: cover fsrs compare and date utilities
3. test: cover learn queue and summary consistency
4. fix: align due-card selection with learn queue semantics
5. test: add authenticated API integration coverage
6. refactor: replace client snapshot undo with transactional review log
7. test: add playwright critical user journeys
```

每个阶段都应通过：

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
```

## 六、当前最合适的下一步

先完成第一个小里程碑：

> 搭建 Vitest、独立 SQLite 测试库和时间冻结设施，并为 `fsrs.ts`、`compare.ts`、`date.ts` 添加测试；这一阶段不修改产品行为、不部署。

完成后再用测试锁定 `getTodaySummary`、`getTodayTasks` 和 `getDueCards` 的语义，然后进入数据正确性修复。结果页研读内容继续保持独立规划，不应混入本轮。
