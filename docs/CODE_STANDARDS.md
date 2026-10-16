# 技术文档：代码规范与协作约定

## 1. 基本原则

- TypeScript 开启 strict；禁止用 `any` 绕过类型，确需未知数据使用 `unknown` 并在边界校验。
- 业务规则命名使用英文，页面文案和产品字段显示使用中文；不要把中文文案散落在领域服务中。
- 小函数、单一职责、显式依赖；不为了“复用”提前抽象只有一次使用的代码。
- 任何接口输入、外部数据和环境变量都必须在边界校验。
- 不提交调试日志、临时注释、死代码、生成的本地数据库和真实敏感数据。

## 2. 命名

| 对象 | 规则 | 示例 |
|---|---|---|
| 文件/目录 | kebab-case | `compensation-calculator/` |
| React 组件 | PascalCase | `StatCard.tsx` |
| hooks | `use` + camelCase | `useCompensation.ts` |
| 函数/变量 | camelCase | `calculateEnterpriseCost` |
| 类型/接口 | PascalCase | `CompensationResult` |
| 常量 | UPPER_SNAKE_CASE | `DEFAULT_PAGE_SIZE` |
| API 路径 | 复数名词、kebab-case | `/api/v1/research-tasks` |
| 权限 code | `resource:action` | `talent:read` |
| 数据库表 | snake_case 复数 | `outreach_campaigns` |

## 3. 前端规范

- 页面组件负责组合布局和状态；请求、转换、表单校验放在 feature hook 或 adapter。
- 组件必须声明 props 类型；复杂 props 用 type，不使用隐式 `React.FC` 作为默认模板。
- 使用设计令牌（颜色、间距、圆角、阴影、字号），禁止在业务组件中随意复制颜色值。
- 列表必须实现 loading、empty、error、正常四态；按钮在提交中要禁用并显示进行中状态。
- 表单提交前做客户端校验，服务端错误按 `error.code` 映射到字段或全局提示。
- 图表容器必须有稳定高度或 aspect-ratio，避免数据加载造成布局跳动。
- 不使用截图作为图表背景；图表必须由真实 DTO 绘制，支持 tooltip 和键盘可达的替代信息。
- 可访问性最低要求：语义化标题、label、键盘 focus、颜色之外的状态提示、弹窗焦点管理。

## 4. 后端规范

- route 只做协议适配；业务决策必须进入 application/domain service。
- repository 只负责查询和持久化，不返回 ORM 类型到 route 层。
- 每个写操作定义输入 schema、权限要求、事务边界和审计行为。
- 错误使用受控的 domain error code；不要把数据库异常堆栈返回给客户端。
- 分页、排序和过滤必须使用白名单字段，禁止直接拼接用户输入到 SQL。
- 日志包含 `requestId`、模块、操作和耗时；禁止记录 token、密码、完整简历和敏感薪酬明细。
- 计算类服务必须是可测试的纯函数或明确隔离副作用的服务。

## 5. 测试规范

- domain/application：覆盖正常路径、边界值、权限失败和关键异常。
- API：每个 endpoint 至少有成功、参数错误、未授权/无权限和依赖失败测试。
- Web：页面至少覆盖初始加载、空状态、错误状态和一个关键交互。
- E2E：覆盖登录态进入、侧边导航、主题切换、薪酬参数修改和一个写操作。
- 测试数据使用 factory/seed，不在测试中依赖真实时间、随机值或外部网络。

## 6. Git 规范

以 [新增需求分支与实施安排](./NEW_SCOPE_BRANCH_PLAN.md) 的实际分支状态为准。每个阶段有一个集成分支；一个会话处理一个可验证的小任务。只安排前端与后端并行：后端任务按依赖顺序串行；前端可与当前后端任务并行。两端不共用工作目录编辑，同一文件只指定一个负责人。小任务分支可以用 `task/web-*`、`task/api-*`，也可以直接在独立 worktree 完成后合入阶段分支，关键是变更范围清楚且不会相互覆盖。

新增接口先约定 `packages/contracts`，由一个任务负责修改。前端任务只改 `apps/web`，后端任务只改 `apps/api` 与其 Prisma 文件；公共文档和契约的修改先在阶段分支协调。前端暂用符合契约的 adapter，后端就绪后联调。

提交信息使用：

```text
feat(web): add talent pool filters
fix(api): validate compensation assumptions
test(api): cover lead stage transition
docs: update module boundary
```

提交前运行 lint、类型检查、受影响测试和构建；有页面变更时做浏览器回归。不要把多个无关功能合并到一个提交。

### 小任务合成最终版本

1. 先把当前 `stage/07-ai-product` 的未提交成果整理、验证并形成可回退的基线提交。若质量检查失败，先修复基线；不能为开始新阶段而丢弃改动。
2. 从通过验收的阶段提交创建下一阶段分支。契约先合入阶段分支；后端任务一个接一个推进，前端任务可基于同一契约同时开展。
3. 每个小任务完成后提交或合并到阶段分支。冲突由阶段集成任务解决，随后运行两端检查和真实 API 联调；每次合入记录变更和测试结果。
4. 阶段验收通过后，以该阶段的提交作为下一阶段起点。最终 `stage/12-integration-release` 集成前面所有阶段的提交、迁移和页面，跑完整端到端场景并生成交付版本。是否建立 `main` 或发布分支由实际仓库和交付方式决定；本地当前没有 `main`。

## 7. 完成定义（Definition of Done）

- 功能符合 PRD 和对应截图基准，包含加载、空、错误和权限状态。
- 前后端契约已更新，接口有测试，前端有浏览器验证或截图回归。
- 无 TypeScript、lint、格式化和构建错误。
- 代码没有跨层依赖、调试输出、硬编码业务结果或敏感数据。
- PR/合并说明包含变更、测试命令、已知限制和回滚方式。
