# 阶段 09：薪酬样本与对标

状态：2026-10-14 完成当前闭环，分支 `stage/09-compensation-benchmark`。工作区此前已有阶段 08 和其他未提交改动，本阶段保留它们且尚未形成独立提交。

## 交付

- 共享契约：薪酬样本、结构聚合、职级映射审核、地区竞争力输入/报告与不可变快照。
- API：`GET /api/v1/compensation/structure`、`GET /api/v1/level-benchmarks`、`PATCH /api/v1/level-benchmarks/:id`、`POST /api/v1/compensation/competitiveness`、`GET /api/v1/compensation/reports/:id`。映射审核需写权限、证据和版本号；报告按创建者或管理员授权读取，敏感读取写审计。
- 数据：`20261014090000_compensation_benchmark` 迁移建样本、映射审核和快照表；幂等 seed 写入 13 条虚构样本与 3 条映射。样本保留来源、许可、日期、目标与实际奖金、股权及缺失值；分位数至少需要 3 条有效样本。
- Web：`/compensation/analysis` 为样本结构；`/compensation/calculation-analysis` 保留原计算瀑布图与趋势；`/job-levels/benchmarks` 审核映射；`/compensation/competitiveness` 做 A/B 比较、预算反推和 JSON 导出。报告卡、趋势和导出取同一 API 快照。

## 验证

`corepack pnpm lint`、`corepack pnpm typecheck`、`corepack pnpm test`、`corepack pnpm build` 均通过（contracts 4、API 56、Web 26 项测试）。真实 PostgreSQL 上 `db:deploy`、`db:seed` 通过。浏览器在 1440px 和 390px 验证登录、筛选、数据不足、空状态、审核历史、A/B 计算、报告取回与导出，截图在 `apps/web/output/playwright/stage09/`。

独立运行浏览器验收时，先启动数据库和 API 端口 3019，再以 `API_PROXY_TARGET=http://127.0.0.1:3019` 启动 Web 端口 5199，运行 `corepack pnpm --filter @hr-console/web test:browser:stage09`。脚本会写入一条演示职级审核记录及比较快照，适合隔离的演示数据库。

## 边界与后续

样本、税费、汇率和 PPP 均为固定演示数据，不是外部市场报价或实时政策。税后、雇主成本、预算反推和等额月付趋势仅为估算；样本不足或宏观版本过期时不输出竞争力判断。阶段 10 需接入可核验的宏观数据源、版本发布及历史快照回放，且不改写本阶段已保存的报告。

数据库迁移已在本地应用；回退应先备份快照和审核历史，再按迁移 SQL 的三张表及外键依赖制定单独回退迁移，不能直接重置数据库。
