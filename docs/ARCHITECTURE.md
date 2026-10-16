# 技术文档：前后端分离架构

## 1. 技术基线

| 层 | 选型 | 原因 |
|---|---|---|
| Web | React + Vite + TypeScript | 适合数据密集型桌面 SPA，开发反馈快 |
| 路由 | React Router | 路由、嵌套路由和权限拦截清晰 |
| 服务端状态 | TanStack Query | 缓存、重试、失效和请求状态统一 |
| 客户端状态 | Zustand | 只保存主题、侧栏、筛选偏好等轻量状态 |
| 图表 | Apache ECharts | 瀑布图、折线图和自定义职级带可控性高 |
| API | Node.js + Fastify + TypeScript | 轻量、类型友好、适合模块化 REST 服务 |
| 校验 | Zod + OpenAPI | 请求/响应运行时校验，并生成可共享契约 |
| ORM | Prisma | 迁移、类型生成和本地种子流程简单 |
| 数据库 | PostgreSQL | 关系数据、筛选、审计和事务需求匹配 |
| 测试 | Vitest、Fastify inject、Playwright | 覆盖单元、接口和真实浏览器回归 |

## 2. 本地服务

| 服务 | 默认端口 | 说明 |
|---|---:|---|
| Web | 5173 | Vite 开发服务器，`/api` 代理到 API |
| API | 3000 | Fastify REST 服务 |
| PostgreSQL | 5432 | 本地开发数据库 |
| Redis（可选） | 6379 | 通知/缓存/异步任务；首期无则不阻塞启动 |

## 3. 请求流程

1. 页面通过 feature hook 调用 `packages/contracts` 生成的 API client。
2. Vite 开发代理将 `/api/v1/*` 转发到 API 服务；生产环境由反向代理转发。
3. Fastify 完成 request id、鉴权、权限、参数校验和统一错误处理。
4. Application service 组合领域规则和 repository 查询，返回 DTO，不返回 Prisma model。
5. 前端 Query cache 更新页面；写操作成功后按资源粒度失效相关 query。

## 4. 环境与配置

- `.env.example` 只提交变量名和安全示例，不提交密钥、真实人员数据或生产连接串。
- Web 变量使用 `VITE_` 前缀；API 变量由服务端读取。
- 必填环境变量在启动时通过 schema 校验，缺失时立即失败并说明变量名。
- 开发、测试、生产使用不同数据库和签名密钥；种子数据必须可重复执行。

## 5. 认证与权限

首期默认提供本地 mock 管理员身份，但接口保留真实认证边界：

- `request.user` 由 auth plugin 注入。
- permission middleware 按 `resource:action` 判断权限。
- 前端 RouteGuard 只负责体验层拦截，后端权限校验始终有效。
- 无权访问统一返回 403 和 `PERMISSION_DENIED`，不通过前端隐藏来替代安全控制。

## 6. 图表和计算边界

- 薪酬税制、汇率、企业成本等计算全部在 API domain service 完成；前端只负责参数编辑、格式化和图形绘制。
- API 返回图表所需的语义序列（类别、值、颜色令牌、tooltip 字段），前端不重新推导业务金额。
- ECharts option 由前端 adapter 从 DTO 转换，禁止把后端字段直接散落在 JSX 中。

## 7. 交付和质量门禁

每个阶段分支必须同时通过：

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e   # 有页面或交互变化时必须执行
```

后端接口增加必须有 schema、服务测试和错误路径测试；前端页面增加必须有主要状态测试和至少一张 1440px 浏览器截图回归。
