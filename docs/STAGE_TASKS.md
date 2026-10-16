# 阶段任务清单与会话提示词

**目标**：前后端分离、仅前后端并行、后端任务串行、每阶段独立 Git 分支、每个会话只处理一个小任务。
**依据**：[PRD](./PRD.md)、[模块划分](./TECH_MODULES.md)、[前后端架构](./ARCHITECTURE.md)、[数据选型](./DATA_SELECTION.md)、[代码规范](./CODE_STANDARDS.md)

**当前执行清单**：[新增需求分支与实施安排](./NEW_SCOPE_BRANCH_PLAN.md) 第 5 节列出可交给单个会话的任务，第 6 节提供前端、后端与阶段集成提示词。下文 00—06 是原阶段记录，其中部分分支并不存在；新增任务按 07 基线、08—12 阶段执行。当前分支和工作区状态以新增安排第 1 节为准。

## 1. 协作规则

- 当前本地没有 `main`；最终版本以通过验收的最后一个阶段提交为准，如需主分支再创建或合入。
- 每个阶段建立 `stage/xx-name` 分支；阶段内前端和后端使用各自 `task/web-*`、`task/api-*` 分支。
- 前端与后端不直接修改对方目录；共享接口只改 `packages/contracts`，并在提交说明中列出契约变化。
- 后端任务按领域串行推进：先契约和数据，再 service，再 route，再测试；下一段依赖上一段通过检查后才能开始。
- 前端可与当前后端任务并行，前端任务若修改同一文件则串行；页面先使用符合契约的 mock adapter 或契约类型，不能自行发明字段。
- 每个会话只做一个小任务；完成后必须报告：改动文件、接口/视觉变化、测试命令、未完成项。
- 不在同一个任务中顺手重构无关模块，不覆盖其他分支未合并的文件。

## 2. 阶段总览

| 阶段 | 分支 | 目标 | 前后端并行范围 | 退出条件 |
|---|---|---|---|---|
| 00 | `stage/00-foundation` | 仓库、工具链、契约、壳层骨架 | Web/API 基础并行 | 两端可启动、lint/typecheck/build 通过 |
| 01 | `stage/01-shell` | 全局壳层和导航 | Web 壳层；API 用户/通知/搜索串行 | 所有侧边栏路由可进入，权限和主题状态可用 |
| 02 | `stage/02-dashboard` | TalentNexus 工作台首页 | Web 首页；API dashboard 串行 | 首页接入 API，截图回归通过 |
| 03 | `stage/03-talent-operations` | 情报、竞对、AI 快讯、线索、人才、任务、触达、Mapping | 各 Web 页面并行；API 按领域串行 | 所有侧边栏模块可查询、筛选、详情和必要写操作 |
| 04 | `stage/04-job-levels` | 职级体系 | Web 图表；API 职级和公司比较串行 | 职级图、序列说明和横向比较可用 |
| 05 | `stage/05-compensation` | 薪酬计算器和分析 | Web 参数/图表；API 规则/计算串行 | 参数修改、地区对比、瀑布图、趋势一致 |
| 06 | `stage/06-admin-hardening` | 管理台、设置、审计和质量加固 | Web 管理页面；API RBAC/审计串行 | 权限、错误、性能、E2E 和发布检查通过 |

## 3. 阶段 00：基础设施

### 后端串行任务

1. `task/api-bootstrap`：Fastify、环境变量 schema、统一错误、requestId、健康检查。
2. `task/api-prisma`：Prisma、PostgreSQL、初始迁移、脱敏 seed。
3. `task/api-contracts`：OpenAPI/DTO 基础类型和分页/错误响应。

### 前端并行任务

1. `task/web-bootstrap`：Vite、React、TypeScript、路由入口、基础 CSS 令牌。
2. `task/web-ui-foundation`：按钮、标签、卡片、表格、状态组件。
3. `task/web-chart-foundation`：ECharts 容器、tooltip、稳定尺寸适配器。

### 检查

- 两端独立启动；Web `/api` 代理能访问 API `/health`。
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 全部通过。

## 4. 阶段 01：全局壳层

### 后端串行任务

1. `task/api-identity-read`：`GET /me`、角色和权限 DTO。
2. `task/api-shell-preferences`：主题/显示密度偏好读写。
3. `task/api-shell-search-notifications`：全局搜索建议、通知列表和已读操作。

### 前端并行任务

1. `task/web-app-shell`：侧边栏分组、所有路由菜单、顶部工具栏。
2. `task/web-theme`：深浅主题、主题持久化、截图风格令牌。
3. `task/web-search-notifications`：搜索下拉、通知面板、用户菜单。
4. `task/web-route-states`：权限、404、加载、错误和空页面骨架。

### 检查

- 侧边栏全部可见功能有真实路由，不能出现死链或“待开发”文案。
- 1440px 截图检查：导航宽度、顶部高度、滚动和主题切换。

## 5. 阶段 02：TalentNexus 工作台首页

### 后端串行任务

1. `task/api-dashboard-summary`：欢迎信息、统计胶囊和日期。
2. `task/api-dashboard-recommendations`：推荐卡列表、忽略、撤销/任务创建。
3. `task/api-dashboard-followups`：今日跟进和触达摘要。

### 前端并行任务

1. `task/web-dashboard-hero`：深色欢迎横幅、统计胶囊和响应式布局。
2. `task/web-dashboard-recommendations`：推荐目标卡、行动按钮和撤销提示。
3. `task/web-dashboard-followups`：跟进列表、触达时间线、排版/卡片视图。

### 检查

- 与 `mmexport1790043955354.jpg` 做 1440px 和 1920px 截图对比。
- 推荐卡操作、列表 loading/empty/error、API 失败回退通过。

## 6. 阶段 03：侧边栏业务模块

### 后端串行顺序

按以下顺序逐个完成，每个领域完成后必须先过测试再开始下一个：

1. `intelligence` / `competitor`
2. `briefing`
3. `lead`
4. `talent` / `talent-category`
5. `research`
6. `outreach`
7. `mapping`

每个领域固定执行：schema/DTO → migration/seed → repository → service → route → 单元/API 测试。

### 前端并行任务

- `task/web-intelligence`、`task/web-competitor`、`task/web-briefing`
- `task/web-leads`、`task/web-talent-pool`
- `task/web-research`、`task/web-outreach`、`task/web-mapping`

每个页面至少包含：分页列表、领域筛选、详情抽屉、空/错误状态；有写操作的页面增加表单校验、成功提示、失败回滚。

### 检查

- 侧边栏所有页面真实请求 API，不得长期依赖页面内静态业务结果。
- 每个页面保留筛选条件返回、分页和详情关闭后的滚动位置。

## 7. 阶段 04：职级体系

### 后端串行任务

1. `task/api-job-series-levels`：EX/M/P/S/T/U/W 序列和等级区块。
2. `task/api-job-level-details`：等级详情和薪酬带。
3. `task/api-company-benchmarks`：公司筛选、口径和币种转换。

### 前端并行任务

1. `task/web-level-band-chart`：横轴 grade、彩色职级带、横向滚动。
2. `task/web-level-details`：区块详情抽屉和序列过滤。
3. `task/web-company-benchmarks`：公司标签筛选、币种/薪酬口径。

### 检查

- 与 `mmexport1790043957837.jpg` 做大屏截图对比。
- 图表不使用静态图片；区块点击、过滤和 tooltip 可用。

## 8. 阶段 05：薪酬计算器

### 后端串行任务

1. `task/api-compensation-assumptions`：地区、币种、汇率日期、版本化规则。
2. `task/api-compensation-domain`：正算、反推、跨地区对比纯业务服务。
3. `task/api-compensation-calculate`：计算接口、快照和审计字段。
4. `task/api-compensation-analysis`：指标、候选人侧/公司侧瀑布序列、月度趋势。

### 前端并行任务

1. `task/web-compensation-controls`：模式、地点、币种、月薪/年终奖输入。
2. `task/web-compensation-cards`：地区结果卡和假设折叠区。
3. `task/web-compensation-waterfalls`：候选人侧、公司侧瀑布图。
4. `task/web-compensation-trend`：月度折线和分析页联动。

### 检查

- 与 `mmexport1790043960106.jpg`、`mmexport1790043962275.jpg` 做截图对比。
- 修改任一参数后，地区卡、两组瀑布图和趋势共享同一 `calculationId`。
- 规则版本、金额精度、币种和错误回退有测试。

## 9. 阶段 06：管理与加固

### 后端串行任务

- `task/api-rbac-enforcement`：资源级读写权限和 403 错误。
- `task/api-audit-log`：写操作、登录和敏感读取审计。
- `task/api-performance-hardening`：索引、分页上限、缓存和慢查询检查。

### 前端并行任务

- `task/web-admin`：用户、角色、字典、操作日志页面。
- `task/web-settings`：主题、通知、默认地区/币种和展示密度。
- `task/web-accessibility-polish`：键盘、焦点、对比度、错误文案。

### 检查

- 全量单元/API/E2E、构建和四张基准截图回归通过。
- 未授权、无权限、接口超时和空数据库均有可理解反馈。

## 10. 可直接复制的会话提示词

### 后端任务模板

```text
你负责 TalentNexus 后端任务：<任务名>。
只修改 apps/api、packages/contracts、prisma 中与本任务直接相关的文件，不改前端页面。
先阅读 docs/PRD.md、docs/TECH_MODULES.md、docs/DATA_SELECTION.md、docs/CODE_STANDARDS.md。
按 schema/DTO -> repository -> service -> route -> 测试顺序实现。
完成后运行 pnpm lint、pnpm typecheck、pnpm test、pnpm build，修复所有问题。
最终报告：改动文件、API 示例、测试命令和结果、已知限制。不要顺手重构无关代码。
当前分支：<stage 分支>/<task 分支>。
```

### 前端任务模板

```text
你负责 TalentNexus 前端任务：<任务名>。
只修改 apps/web、packages/ui（如确有必要）和对应测试，不改后端业务代码。
先阅读 docs/PRD.md、docs/TECH_MODULES.md、docs/ARCHITECTURE.md、docs/CODE_STANDARDS.md。
按截图基准实现 1440px 桌面布局，并完整处理 loading/empty/error/permission 状态。
API 只通过 contracts/API client 调用；若后端尚未完成，使用可替换 mock adapter，不发明字段。
完成后运行 pnpm lint、pnpm typecheck、pnpm test、pnpm build，并用 Playwright 做页面截图回归。
最终报告：改动文件、截图/交互结果、测试命令和结果、已知限制。不要顺手重构无关代码。
当前分支：<stage 分支>/<task 分支>。
```

## 11. 当前进度

- 阶段 00：基础设施已建立。
- 阶段 01：全局壳层已完成，分支为 `stage/01-shell`。
- 阶段 02：TalentNexus 工作台首页已完成，分支为 `stage/02-dashboard`。Dashboard 数据目前由 Fastify 进程内种子提供，写操作服务于演示与交互验证，不作为持久化业务数据。
- 阶段 03「侧边栏业务模块」的八个页面、共享契约、Prisma schema/迁移/seed、查询和必要写操作已实现；这些功能现随当前 `stage/07-ai-product` 工作区一起整理基线。本地没有实体 `stage/03` 分支。
- 阶段 04「职级体系」功能与浏览器回归已完成：共享契约、`GET /api/v1/job-levels`、职级图、序列过滤、详情抽屉和公司对标均已接通；API 样本仍为版本化进程内演示数据，真实 PostgreSQL 环境验收已完成。
- 阶段 05「薪酬计算器」已完成首期闭环：地区/币种/汇率日期/版本化假设、正算/反推/跨地区对比、计算快照、审计字段、候选人侧与公司侧瀑布、月度趋势，以及 `/compensation` 和 `/compensation/analysis` 页面均已实现；API 19 项测试、Web 14 项测试、1440px/手机浏览器回归和真实 PostgreSQL 规则读取/计算验收通过。计算快照由 API 返回并由前端持久化以供分析页复用。
- 阶段 08「组织摸排与人才寻访」已完成：组织/证据/领队/寻访项目契约、迁移、seed、API 路由与测试、`/organizations` 组织图证据审核、`/search-projects` 寻访项目和候选人阶段漏斗已接通。2026-10-14 已通过 `corepack pnpm lint`、`corepack pnpm typecheck`、`corepack pnpm test`、`corepack pnpm build`。后续还剩阶段 09「薪酬样本与对标」、阶段 10「AI 与宏观数据」、阶段 11「邮箱触达与反馈」、阶段 12「集成发布」共 4 个阶段。
- 阶段 09「薪酬样本与对标」已完成当前闭环，位于 `stage/09-compensation-benchmark`：样本结构/分位数及不足样本抑制、带证据与版本历史的职级映射、地区 A/B 对比、预算反推和一致快照导出。真实 PostgreSQL 迁移/seed、lint、typecheck、全量单元测试、build 及 1440px/390px 真实 API 浏览器验收通过。此阶段演示数据不供真实薪酬决策；详见 [交付说明](./STAGE09_DELIVERY.md)。下一阶段为 10「AI 与宏观数据」，其后仍有 11、12。
- 2026-10-15 更新：阶段 10 已有 AI 审核与宏观快照演示接口及页面，真实供应商、持久化等仍待完成，不能视为整阶段验收通过，详见 [阶段 10 进展](./STAGE10_PROGRESS.md)。阶段 11 的契约、Google/Microsoft 授权、审批与发送队列、回信同步/停止规则、反馈回流、漏斗和 `/mail-review` 页面已在当前阶段 12 工作区实现，本地迁移已应用；真实邮箱收发和故障恢复验收待配置后执行，详见 [契约说明](./STAGE11_CONTRACTS.md) 与 [进展记录](./STAGE11_PROGRESS.md)。
- 2026-10-15 阶段 12：已创建 `stage/12-integration-release`，保留既有未提交成果，落地跨模块权限搜索、详情直达、通知故障状态、敏感读取审计、就绪探测、按需加载及发布预检/回滚说明。完整 PRD、浏览器、迁移升级与备份恢复验收未完成，阶段 10/11 仍有前置阻塞；详见 [阶段 12 进展](./STAGE12_PROGRESS.md) 和 [部署运维说明](./DEPLOYMENT_RUNBOOK.md)。
- 2026-10-16 阶段 13：已建立 `stage/13-production-acceptance` 执行基线，承接真实 provider、测试邮箱、权限审计、恢复演练、浏览器全链路、性能基线和最终发布归档。当前外部凭据与受控环境尚未提供，六项工作包均待执行；详见 [阶段 13 进展](./STAGE13_PROGRESS.md)。
