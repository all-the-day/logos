# 反馈闭环工作流

真实用户（APP/网页）提交的反馈 → 本地拉取开发 → 部署后标记完成。

## 使用

```bash
npm run feedback:pull            # 拉取未处理反馈，写入 tools/feedback/inbox.md
npm run feedback:pull -- --all   # 包含已处理
npm run feedback:close 12        # 标记 #12 为已处理
```

## 凭据

`LOGO_ADMIN_USER` / `LOGO_ADMIN_PASSWORD` 写在项目根 `.env.local`（不入库）。
可选 `LOGO_API_BASE` 覆盖线上地址（默认 https://logos.duoban.xyz，本地联调可指向 http://localhost:3000）。

## 闭环流程

```
用户提交反馈(open)
  → npm run feedback:pull → inbox.md     ← Agent 按清单开发/修复
  → 开发 → 部署
  → npm run feedback:close <id>          ← 用户端可见 resolved
```

依赖服务端：`GET/PATCH /api/feedback` 的 admin 分支（admin 可查全部/改任意状态）。
