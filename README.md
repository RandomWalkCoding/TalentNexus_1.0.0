# TalentNexus · AI Talent Operations

TalentNexus 是一个面向 HR、招聘负责人和业务管理者的人才智能运营工作台。

它把组织研究、人才情报、寻访项目、薪酬对标、AI 审核和邮件触达集中在一个工作台中，帮助团队从发现人才信号，到执行运营动作，再到跟踪反馈，形成可审计的闭环。

## 产品能力

- **人才情报**：查看行业、公司和竞争对手动态，沉淀研究证据
- **组织研究**：维护组织单元、团队负责人和证据状态，支持审核与追溯
- **寻访运营**：创建寻访项目、维护候选人和跟进任务，跟踪阶段变化
- **薪酬管理**：查看职级体系、薪酬样本、市场对标和竞争力分析
- **AI 审核**：对 AI 生成内容进行审核、批准、拒绝和历史追踪
- **邮件触达**：支持 Google / Microsoft 授权流程、审批队列、回信同步和退订停止规则
- **权限与审计**：按 admin、HR、manager 角色控制访问，并记录关键操作
- **响应式工作台**：支持桌面端和移动端，包含搜索、通知、加载、错误和重试状态

## 技术栈

- **Web**：React、TypeScript、Vite、React Router、TanStack Query、Lucide
- **API**：Node.js、Fastify、TypeScript、Zod
- **数据层**：PostgreSQL、Prisma
- **工程化**：pnpm workspace、Vitest、Playwright、ESLint

## 快速开始

### 环境要求

- Node.js 20+
- Corepack / pnpm
- PostgreSQL 14+

### 安装依赖

```powershell
corepack pnpm install
```

### 配置数据库

```powershell
$env:DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/hr_console?schema=public"
corepack pnpm --filter @hr-console/api db:deploy
corepack pnpm --filter @hr-console/api db:seed
```

### 启动开发环境

```powershell
corepack pnpm dev
```

启动后访问：

- Web：<http://localhost:5173>
- API 健康检查：<http://localhost:3000/api/v1/health>
- API 就绪检查：<http://localhost:3000/api/v1/ready>

Windows 用户也可以双击项目根目录的 `启动HR操作台.cmd`。

### 演示账号

```text
邮箱：rachel@talentnexus.local
密码：TalentNexus07!
```

## 常用命令

```powershell
corepack pnpm lint       # 代码检查
corepack pnpm typecheck  # 类型检查
corepack pnpm test       # 全量单元与接口测试
corepack pnpm build      # 生产构建
corepack pnpm ops:check -ApiBaseUrl "http://127.0.0.1:3000"
```

## 项目结构

```text
apps/
  api/       Fastify API、Prisma schema、迁移和接口测试
  web/       React 工作台和浏览器验收脚本
packages/
  contracts/ 前后端共享类型与 Zod 契约
prisma/      工作区级数据库资源
scripts/     运维预检和辅助脚本
docs/        架构、阶段交付和部署说明
deploy/      反向代理示例配置
```

## 当前状态

本项目已完成本地集成、核心业务页面、API、数据库迁移、权限审计、AI 审核和邮件触达流程的开发与验证。

生产发布前仍需在受控环境中完成真实 AI / 汇率与 PPP provider、OAuth 应用、测试邮箱、备份恢复、性能基线和浏览器全链路验收。演示数据不应直接用于真实薪酬决策。

## 文档

- [架构说明](docs/ARCHITECTURE.md)
- [产品需求](docs/PRD.md)
- [部署运维说明](docs/DEPLOYMENT_RUNBOOK.md)
- [阶段 13 真实验收计划](docs/STAGE13_PROGRESS.md)

## License

当前仓库尚未声明开源许可证。未经授权，请勿将其用于商业分发或生产部署。
