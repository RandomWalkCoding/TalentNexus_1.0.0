# 阶段 10：AI 与宏观数据进展

日期：2026-10-14

## 当前已完成

- AI 任务列表与创建接口：`GET/POST /api/v1/ai/tasks`
- AI 建议审核接口：`GET/PATCH /api/v1/ai/reviews`
- 审核状态支持接受、编辑、驳回；使用 `expectedVersion` 防止并发覆盖。
- 汇率与 PPP 快照状态接口：`GET /api/v1/market-data/snapshots`
- 宏观快照发布接口：`POST /api/v1/market-data/snapshots/:id/publish`
- 过期状态、发布状态、版本冲突和旧版本 superseded 状态可见。
- Web 新增 `/ai-review` 页面，展示审核队列与数据源状态，并支持接受、驳回、刷新。
- 阶段 10 资源已接入现有 RBAC：AI 写操作复用 `intelligence:write`，宏观数据写操作复用 `compensation:write`。
- 已新增 Prisma 模型与迁移：`ai_tasks`、`ai_reviews`、`macro_snapshots`，并完成 Prisma Client 生成。

## 验证

- API：14 个测试文件、58 项测试通过。
- Web：13 个测试文件、27 项测试通过。
- API typecheck/build 通过。
- Web lint/typecheck/build 通过。

## 当前边界

当前路由仍默认使用受控演示适配器；数据库表已经准备好，但生产切换还需要将路由 repository 接到这些表，并接入真实模型/汇率/PPP provider。外部调用还需要补超时、重试、脱敏、数据签名校验、回退快照和历史回放测试。阶段 09 已保存的薪酬报告不应被新快照改写。
