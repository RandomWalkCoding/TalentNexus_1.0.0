# 技术文档：模块划分与职责边界

**版本**：v1.0
**适用范围**：TalentNexus 当前产品及新版 PRD 的新增能力

## 1. 总体拆分

采用前后端分离的单仓多应用结构：

```text
hr-console/
├─ apps/
│  ├─ web/                 # React 前端，只负责页面、交互和展示状态
│  └─ api/                 # Fastify 后端，只负责业务、权限、计算和持久化
├─ packages/
│  └─ contracts/           # Zod/TypeScript DTO，前后端共享契约
├─ apps/api/prisma/         # 数据模型、迁移和脱敏种子
├─ docs/
└─ package.json
```

前端不得直接引用 Prisma、数据库客户端或后端领域服务；后端不得依赖 React 组件或浏览器状态。两端唯一的业务通信边界是 `/api/v1` HTTP API 和 `packages/contracts` 中的契约。

## 2. 后端领域模块

| 模块 | 职责 | 主要资源 | 首期接口归属 |
|---|---|---|---|
| identity | 当前用户、角色、权限、会话 | User、Role、Permission | `/me`、权限中间件 |
| shell | 全局搜索、通知、主题偏好 | Notification、UserPreference | `/search`、`/notifications` |
| dashboard | 欢迎横幅、作战台、推荐目标、触达摘要 | DashboardSnapshot、Recommendation | `/dashboard/*` |
| intelligence | 情报流、来源、重要性、摘要 | IntelligenceItem、Source | `/intelligence/*` |
| competitor | 竞对公司和监测信号 | Competitor、MonitorSignal | `/competitors/*` |
| briefing | AI 快讯、未读和主题 | Briefing、BriefingTag | `/briefings/*` |
| lead | 线索池、阶段、负责人和评分 | Lead、LeadActivity | `/leads/*` |
| talent | 人才库、分类、标签和详情 | Talent、TalentCategory、TalentTag | `/talents/*` |
| research / organization | 摸排任务、组织树、领队档案、事实证据和版本 | ResearchTask、OrganizationUnit、LeaderProfile、Evidence | `/research-tasks/*`、`/organizations/*` |
| search-project | 寻访项目、候选人阶段、去重与反馈 | SearchProject、CandidateProject、Talent | `/search-projects/*` |
| outreach / mail | 触达战役、邮箱连接、审批、发送队列、回信与反馈 | OutreachCampaign、EmailConnection、EmailMessage、OutreachFeedback | `/outreach/*`、`/mail/*` |
| mapping | 公司/岗位/职级映射 | MappingRule、MappingItem | `/mapping/*` |
| job-level / benchmark | 职级序列、公司比较、外部职级映射与证据 | JobSeries、JobLevel、LevelBenchmark | `/job-levels/*`、`/mapping/*` |
| compensation | 薪酬样本、结构、分位数、地区竞争力与版本化计算 | CompensationSample、CompensationAssumption、Calculation | `/compensation/*` |
| market-data | 汇率、PPP 采集、校验、快照发布和回滚 | MarketSnapshot、SyncJob | `/market-data/*` |
| ai-jobs | 模型调用、结构化输出、证据关联与人工审核 | AiJob、AiReview | `/ai-jobs/*` |
| admin | 用户、角色、字典、操作日志 | AuditLog、DictionaryItem | `/admin/*` |

每个后端领域模块内部统一分层：`route -> schema -> application service -> domain -> repository`。路由层只解析请求和返回响应，业务规则放在 application/domain 层，数据库访问集中在 repository 层。

## 3. 前端模块

### 3.1 应用壳层

- `AppShell`：侧边栏、顶部工具栏、内容滚动区。
- `Sidebar`：分组导航、数量徽标、当前路由高亮、折叠和滚动。
- `TopBar`：全局搜索、通知、主题、角色和用户菜单。
- `ThemeProvider`：dark/light 令牌和本地持久化。
- `RouteGuard`：登录态和权限态处理。

### 3.2 页面模块

每个页面目录至少包含 `Page.tsx`、`api.ts`、`types.ts`、`components/`、`__tests__/`：

- `dashboard`：欢迎横幅、推荐目标、今日跟进、触达摘要。
- `intelligence`、`competitor-monitoring`、`ai-briefing`：情报类列表和详情抽屉。
- `leads`、`talent-pool`、`research-tasks`、`outreach`：运营列表、筛选、详情、写操作。
- `organization`、`search-projects`：组织树、领队证据审核、项目阶段和人才漏斗。
- `mapping`：映射表、编辑表单、导入导出反馈。
- `job-levels`：职级架构图、序列说明、公司比较。
- `compensation`：参数区、薪酬结构、地区竞争力、瀑布图和趋势。
- `ai-review`、`data-sources`、`mail-review`：AI 结果审核、宏观数据状态、邮件草稿审批与回信反馈。
- `admin`、`settings`：系统管理与个人偏好。

### 3.3 共享组件

优先建设以下基础组件，再批量复用：`DataTable`、`FilterBar`、`StatCard`、`Tag`、`StatusBadge`、`Drawer`、`ModalForm`、`EmptyState`、`ErrorState`、`Skeleton`、`WaterfallChart`、`LineChart`、`LevelBandChart`。

共享组件只接受显示所需的 props，不在组件内发起领域 API 请求；请求由页面或 feature hook 负责。

## 4. 依赖方向

```text
页面模块 -> feature hooks -> API client -> contracts
页面模块 -> shared UI / design tokens

API route -> application service -> domain -> repository -> Prisma/PostgreSQL
API route -> contracts/schema
```

禁止出现：页面直接拼接数据库字段、共享组件直接请求接口、后端 route 中堆积税制计算、不同领域直接读对方 repository。

## 5. API 责任

- 列表接口统一支持 `page`、`pageSize`、`sort`、`q` 和领域筛选；响应统一返回 `items`、`total`、`page`、`pageSize`。
- 详情接口返回完整领域对象及 `updatedAt`、`createdBy` 等审计字段。
- 写接口使用幂等键或资源版本号防止重复提交和覆盖更新。
- 计算接口必须返回 `calculationId`、`asOfDate`、`assumptionsVersion`，保证结果可复现。
- 错误统一返回 `code`、`message`、`details`、`requestId`，前端根据 `code` 映射用户提示。

## 6. 新增能力的边界

- 组织、领队及人才情报统一通过 `Evidence` 关联原始来源。AI 提取结果是待审核建议；人工确认后才更新正式组织关系。
- 薪酬分位数、汇率、PPP 和税费规则由 API 生成带版本的计算快照。Web 只编辑参数并绘图；旧报告始终引用旧快照。
- 模型供应商、邮箱供应商和宏观数据源都通过后端适配器接入。外部调用在后台任务中执行，任务状态写入数据库；页面不保存凭据，不直接请求第三方。
- 邮件队列负责审批、限流、幂等发送和回信关联；触达反馈再更新人才项目阶段。拒绝和退订触发停止规则。
- 前端和后端只通过已确定的 `packages/contracts` 字段协作。契约改变时先完成契约任务，再分别推进 API 与 Web，避免两端各自定义字段。
