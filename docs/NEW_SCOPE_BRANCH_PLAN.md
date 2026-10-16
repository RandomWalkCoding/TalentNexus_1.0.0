# 新增需求的分支与实施安排

**依据**：[新版 PRD](./PRD.md)、[阶段任务](./STAGE_TASKS.md)、[架构](./ARCHITECTURE.md)
**制定日期**：2026-10-10

## 1. 当前分支事实与起点

本地已有 `stage/00-foundation`、`stage/01-shell`、`stage/02-dashboard`、`stage/06-admin-hardening`、`stage/07-ai-product`。`stage/06` 与 `stage/07` 当前指向同一提交；本地没有 `main`、`stage/03`、`stage/04`、`stage/05`。现有 03—05 阶段的部分功能已经包含在当前代码中，因此不回到旧分支重复开发。

当前 `stage/07-ai-product` 工作区还有未提交的登录、管理台、通知、搜索、薪酬等代码和文档。先在此分支逐项核对变更、执行现有质量检查，整理为可运行的基线提交；保留已有改动和数据库迁移，不用 checkout/reset 覆盖工作区。本文只安排后续实施，没有把计划中的分支当成已创建或已完工。

## 2. 分支顺序与交付

新阶段依次从上一阶段验收后的提交创建。每阶段一个集成分支；具体功能用 `task/api-*`、`task/web-*` 小任务分支。若两端同时编辑，使用独立 worktree，避免两个会话共用一个 checkout。契约改动先在阶段分支落地，再让前后端任务分支同步。

| 顺序 | 分支 | 后端任务 | 前端任务 | 阶段验收 |
|---|---|---|---|---|
| 基线 | 现有 `stage/07-ai-product` | 核对现有 API、迁移、seed、权限及测试 | 核对现有页面、启动脚本和浏览器回归 | 未提交成果安全入库；现有产品可启动，四张基准页可用 |
| 08 | `stage/08-organization-search` | `task/api-organization-evidence`、`task/api-leader-research`、`task/api-search-projects`：组织/领队/证据模型、摸排任务、寻访项目和人才阶段 | `task/web-organization-map`、`task/web-search-projects`：组织图、证据审核、寻访漏斗和详情 | 从来源到组织关系、领队和候选人项目可追溯，去重与权限有效 |
| 09 | `stage/09-compensation-benchmark` | `task/api-compensation-samples`、`task/api-level-benchmark`、`task/api-region-competitiveness`：样本、职级映射、分位数与竞争力计算 | `task/web-compensation-structure`、`task/web-level-benchmark`、`task/web-region-competitiveness`：结构图、映射审核、地区对比 | 同一快照下的图表与报告金额一致；样本不足、税费估算有清晰提示 |
| 10 | `stage/10-ai-macro-data` | `task/api-ai-jobs`、`task/api-organization-analysis`、`task/api-market-sync`：模型任务、结构化校验、人工审核、汇率/PPP 采集与版本发布 | `task/web-ai-review`、`task/web-data-sources`：AI 审核队列、证据链接、数据源状态与异常处理 | 模型建议可核验/纠错；汇率和 PPP 过期告警、失败回退、历史快照复现通过 |
| 11 | `stage/11-mail-outreach-feedback` | `task/api-mail-connection`、`task/api-outreach-queue`、`task/api-reply-feedback`：邮箱授权、发送审批与队列、幂等重试、回信同步、反馈回流 | `task/web-mail-review`、`task/web-outreach-feedback`：草稿预览、审批、发送状态、回复分类与漏斗 | 真实测试邮箱端到端通过；失败不重发；拒绝/退订停止后续触达 |
| 12 | `stage/12-integration-release` | `task/api-hardening`：跨模块权限、审计、性能和备份恢复检查 | `task/web-end-to-end`：工作台串联、全局搜索、通知、响应式和可访问性 | 新 PRD 的端到端场景通过，部署说明和回滚步骤可执行 |
| 13 | `stage/13-production-acceptance` | `task/api-provider-acceptance`、`task/api-recovery-drill`、`task/api-performance-baseline`：真实模型/宏观/邮箱依赖、恢复演练、性能与发布制品 | `task/web-real-e2e`：真实 API 浏览器闭环、权限矩阵、响应式、键盘和错误恢复验收 | 六类真实验收证据齐全，发布制品可复核、可回退；未满足时明确记录阻塞 |

旧的 `stage/00`—`02`、`06` 作为历史节点保留。`stage/03`—`05` 没有实体分支，不为补齐编号而创建空分支。若以后建立 `main`，应在 07 基线和后续阶段通过验收后再决定合并点，不把未验收工作直接指向它。

## 3. 前后端编辑与运行规则（沿用当前项目）

1. **目录边界**：前端任务只改 `apps/web` 及其测试；后端任务只改 `apps/api`、其 Prisma 迁移/seed 及测试。共享输入/输出 schema 放 `packages/contracts`，由契约任务先定稿；前端不直接读 Prisma 或调用模型/邮箱供应商，后端不引用 React 代码。
2. **调用路径**：浏览器页面 → feature API client → `/api/v1/*` → Vite 代理 → Fastify route → service → repository/PostgreSQL。业务金额、PPP/汇率快照、职级映射和邮件状态由服务端决定；前端负责编辑参数、展示状态和图表，不重新计算业务结果。
3. **开发顺序**：一个小任务一个明确文件范围。后端按契约/数据模型 → migration/seed → service/repository → route → 测试推进；前端可在契约确定后用可替换 mock adapter 开发，接口就绪后接真实 API 并移除临时业务假数据。跨模块接口变更先更新契约，再同步两端。
4. **本地运行**：项目根目录双击 `启动HR操作台.cmd` 或运行 `corepack pnpm start:product`，现有脚本检查 PostgreSQL、执行迁移与 seed，启动 API 3000 和 Web 5173。开发调试可分别使用 `corepack pnpm dev:api`、`corepack pnpm dev:web`；Web 请求 `/api` 由 Vite 代理到 API。两端使用同一个数据库连接配置，不能各自启动另一套不一致的数据环境。
5. **环境变量**：模型密钥、邮箱令牌和数据源凭据只放服务端环境/受控密钥存储；`.env.example` 仅列变量名及安全示例。开发/测试使用隔离的数据库和邮箱，seed 不写真实人员或敏感邮件。
6. **协作提交**：契约、API、Web 分开提交；任务说明列出接口变化、迁移、运行命令及回滚方式。一个阶段集成通过后再从该提交创建下一阶段；不得通过切换分支丢弃当前工作区改动。

## 4. 每阶段检查与依赖门槛

- 基线先执行 `corepack pnpm lint`、`corepack pnpm typecheck`、`corepack pnpm test`、`corepack pnpm build`，再运行现有浏览器脚本检查核心页面。失败先定位当前遗留问题，记录修复提交。
- 后端新增接口需有 schema、权限校验、成功/参数错误/权限失败/依赖失败测试；迁移在测试库及本地库验证，涉及已有数据时验证升级路径。
- 前端新增页面需覆盖加载、空、错误、权限和关键写操作；1440px 截图回归与实际 API 联调通过。模型、邮箱和宏观数据的外部依赖在自动化测试中使用替身，在各阶段验收时另做受控真实连接验证。
- 08 的组织/项目实体是 10 的 AI 输入与 11 的触达关联前提；09 的薪酬样本/对标是 10 的宏观快照联动前提；10 的 AI 审核和数据源状态是 11 的邮件草稿与报告前提。
- 阶段完成报告统一写明改动文件、接口/视觉变化、验证命令与结果、数据迁移、已知限制及下一阶段依赖。未通过质量门禁的功能留在当前阶段继续修复。

## 5. 可交给单个会话的小任务清单

以下每行是一个会话的目标。每阶段先完成契约，再让前端与当前后端任务并行；后端任务按依赖顺序串行。同一文件只指定一个负责人。

| 阶段 | 顺序 | 单会话任务 | 交付检查 |
|---|---:|---|---|
| 07 | 1 | 盘点当前未提交改动和启动、迁移、测试状态 | 逐项归属清楚，无成果丢失 |
| 07 | 2 | 修复基线检查失败项并形成基线提交 | lint、typecheck、test、build 和核心浏览器回归通过 |
| 08 | 1 | 定义组织、证据、领队、寻访项目契约 | 字段、权限、状态流转和错误码确定 |
| 08 | 2 | API：组织及证据模型、迁移、查询与核验 | 来源可追溯，冲突与版本可读写 |
| 08 | 3 | API：领队档案与摸排任务关联 | 同名合并/拆分和审核记录可追溯 |
| 08 | 4 | API：寻访项目与候选人阶段 | 跨项目历史、阶段变更可追溯 |
| 08 | W1 | Web：组织图和证据审核 | 加载/空/错/权限状态齐全 |
| 08 | W2 | Web：寻访项目、长短名单与漏斗 | 与真实 API 联调，关键操作可用 |
| 09 | 1 | 定义薪酬样本、职级映射、地区竞争力契约 | 分位数、来源、快照和不足样本口径确定 |
| 09 | 2 | API：薪酬样本与结构聚合 | 现金、股权、雇主成本边界正确 |
| 09 | 3 | API：职级映射证据与确认 | 人工确认及历史版本可查 |
| 09 | 4 | API：地区竞争力计算 | A/B 方案和市场分位数一致 |
| 09 | W1 | Web：薪酬结构与样本说明 | 与 API 金额和口径一致 |
| 09 | W2 | Web：职级对标审核 | 证据、置信度和确认状态可见 |
| 09 | W3 | Web：地区竞争力并排与导出 | 图表、卡片、导出共用计算快照 |
| 10 | 1 | 定义 AI 任务、审核、宏观快照契约 | 状态、证据、发布日期与回退字段确定 |
| 10 | 2 | API：模型任务、结构校验和持久化 | 超时、限额、重试和脱敏测试通过 |
| 10 | 3 | API：组织分析及人工审核回写 | AI 推断不覆盖已确认事实 |
| 10 | 4 | API：汇率/PPP 采集、校验、发布与回滚 | 过期告警，异常保留旧快照 |
| 10 | W1 | Web：AI 结果审核 | 接受、编辑、驳回可用 |
| 10 | W2 | Web：数据源状态与异常处理 | 过期和失败处理入口可用 |
| 11 | 1 | 定义邮箱连接、消息、反馈契约 | 审批、退订、幂等状态确定 |
| 11 | 2 | API：邮箱授权与连接状态 | 令牌不泄露，失效可重连 |
| 11 | 3 | API：草稿审批、发送队列及幂等重试 | 测试邮箱发送成功，失败不重复发送 |
| 11 | 4 | API：回信同步、回复分类和停止规则 | 拒绝/退订停止后续触达 |
| 11 | W1 | Web：草稿审批与发送状态 | 收件人、内容、排除名单可核对 |
| 11 | W2 | Web：回复详情、反馈修正和漏斗 | 项目阶段同步更新 |
| 12 | 1 | API：跨模块权限、审计和迁移升级验证 | 敏感读取、导出和外部任务可审计 |
| 12 | W1 | Web：工作台入口、搜索通知和全链路串联 | 新页面可发现、可到达 |
| 12 | 2 | 全链路验收与交付整理 | PRD 端到端场景通过 |
| 13 | 1 | 真实 provider、测试邮箱和隔离恢复环境准备 | 凭据隔离、数据范围和回滚责任人确认 |
| 13 | 2 | 真实 AI/宏观/邮箱闭环验收 | provider 失败回退、发送幂等、回信反馈和停止规则有证据 |
| 13 | 3 | 权限审计、恢复演练与性能基线 | 角色矩阵、恢复记录、查询/导出/登录基线通过 |
| 13 | 4 | 浏览器验收与最终发布归档 | 桌面/手机/键盘通过，制品校验和与回滚点已记录 |

## 6. 会话提示词与合并方法

### 后端会话提示词

```text
你负责 TalentNexus 阶段 <编号> 的一个后端小任务：<任务名>。
基线分支/提交：<明确写出>；本会话分支或 worktree：<明确写出>。
只修改 apps/api、apps/api/prisma 与本任务测试；共享契约必须先由契约任务确定，不改 apps/web。
先读 docs/PRD.md、docs/TECH_MODULES.md、docs/DATA_SELECTION.md、docs/CODE_STANDARDS.md、docs/NEW_SCOPE_BRANCH_PLAN.md。
本任务只交付：<资源、接口、迁移和验收条件>。按数据/schema、repository/service、route、测试顺序推进，不启动下一个后端任务。
运行受影响测试、lint、typecheck、build；说明数据库迁移和回滚影响。
交付时写明改动文件、接口示例、测试结果、提交号或工作区状态、待集成事项。不要覆盖其他会话文件。
```

### 前端会话提示词

```text
你负责 TalentNexus 阶段 <编号> 的一个前端小任务：<任务名>。
基线分支/提交：<明确写出>；本会话分支或 worktree：<明确写出>。
只修改 apps/web 中指定页面、API client 和对应测试，不改 apps/api 或 Prisma；使用阶段已确定的 packages/contracts 字段。
先读 docs/PRD.md、docs/TECH_MODULES.md、docs/ARCHITECTURE.md、docs/CODE_STANDARDS.md、docs/NEW_SCOPE_BRANCH_PLAN.md。
本任务只交付：<页面、交互和验收条件>。后端未就绪时使用符合契约的可替换 adapter，联调时移除临时业务数据。
验证加载、空、错误、权限状态和关键交互；运行受影响测试、lint、typecheck、build，并做 1440px 浏览器检查。
交付时写明改动文件、截图/交互结果、测试结果、提交号或工作区状态、待联调事项。不要覆盖其他会话文件。
```

### 阶段集成会话提示词

```text
你负责集成 TalentNexus 阶段 <编号>，不是开发新功能。
先确认上一阶段基线提交与当前所有任务提交；逐个合入已完成的契约、后端、前端任务，解决冲突时保留已验收逻辑。
运行迁移、seed、lint、typecheck、test、build 和本阶段真实 API/浏览器流程；修复集成引入的问题。
记录阶段最终提交、合入任务、测试结果、未完成项和下一阶段起点。阶段未通过验收时继续修复，不宣称完成。
```

实际整合方式：小任务在各自分支形成提交 → 合入当前 stage 分支 → 运行集成检查 → 阶段通过后从最终提交创建下一阶段。最终版本是 `stage/12-integration-release` 通过验收的提交，包含前面阶段的全部增量；之后如需主分支，再以该验收提交建立或合入。
