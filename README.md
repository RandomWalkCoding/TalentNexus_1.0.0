# TalentNexus

AI Talent Operations 工作台。

前后端分离的 HR 数据分析与人才运营工作台。页面范围、视觉基准和实现分期见 `docs/`。

## 本地启动

双击项目根目录的 `启动HR操作台.cmd`，或运行 `corepack pnpm start:product`，会自动检查 PostgreSQL、执行迁移与 seed，并同时启动前后端。产品入口：`http://localhost:5173`。

阶段 03 的业务 API 需要 PostgreSQL。安装依赖并创建数据库后，在启动 API 的终端配置连接串（示例值请替换为本机凭据）：

```powershell
corepack pnpm install
$env:DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/hr_console?schema=public"
corepack pnpm --filter @hr-console/api db:deploy
corepack pnpm --filter @hr-console/api db:seed
```

默认登录：`rachel@talentnexus.local` / `TalentNexus07!`。

```powershell
corepack pnpm dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:3000/api/v1/health`
- 未启动 API 或 PostgreSQL 时，Web 的阶段 03 页面显示只读演示数据；写操作需要真实 API 与数据库。

## 质量检查

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm --filter @hr-console/web test:browser
corepack pnpm --filter @hr-console/web test:browser:stage09
```

原有浏览器脚本拦截 API 请求验证阶段 03 页面和交互；阶段 09 脚本需要已启动的 PostgreSQL、API（3019）和 Web（5199），通过真实数据库验证样本结构、职级审核、地区比较和快照导出。具体运行条件见 [阶段 09 交付说明](docs/STAGE09_DELIVERY.md)。

## 当前阶段

阶段 09「薪酬样本与对标」已完成当前闭环。阶段 10 已实现 AI 审核和宏观快照的演示接口及页面，真实供应商和持久化仍有待办，见 [阶段 10 进展](docs/STAGE10_PROGRESS.md)。阶段 11「邮箱触达与反馈」已交付 Google/Microsoft 授权、审批队列、回信同步/停止规则及 `/mail-review` 页面，本地迁移已应用，真实邮箱验收待配置后完成，见 [阶段 11 进展](docs/STAGE11_PROGRESS.md)。样本、汇率和 PPP 目前均为演示数据，不可用于真实薪酬决策。

阶段 12 已完成本地集成加固；阶段 13「真实验收与最终发布」已建立，负责真实 provider、测试邮箱、权限审计、恢复演练、浏览器全链路、性能基线和发布归档。当前这些外部验收仍待受控凭据与环境，不能将本地预检视为生产验收，详见 [阶段 13 进展](docs/STAGE13_PROGRESS.md) 和 [阶段 12 进展](docs/STAGE12_PROGRESS.md)。部署配置和备份回滚步骤见 [运维说明](docs/DEPLOYMENT_RUNBOOK.md)；`corepack pnpm ops:check -ApiBaseUrl "http://127.0.0.1:3000"` 仅为只读运维预检。生产不要使用自动 seed 的 `start:product`。
