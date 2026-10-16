# 部署、备份恢复与回滚

适用：阶段 12 集成基线，含阶段 11 邮件增量。当前发布阻塞项见 [阶段 12 进展](./STAGE12_PROGRESS.md)；本说明和预检通过均不表示完整 PRD 已验收。下列命令是生产操作步骤，尚未执行生产发布或备份恢复。本地开发库已应用 AI 数据表和邮件新增表迁移，见 [阶段 11 进展](./STAGE11_PROGRESS.md)。

## 配置和制品

- 使用干净、已审阅且已提交的版本作为发布单元，记录 `git rev-parse HEAD`、锁文件、数据库迁移状态和上一版本的制品目录。当前工作区含之前阶段的未提交成果，还不具备该条件。
- 安装仓库 `packageManager` 指定版本的 pnpm，并使用受支持的 Node.js 22.12+ 或 24 LTS。依赖安装和构建需要开发依赖；API 启动需要完整的生产依赖和生成的 Prisma client，不能只复制 `dist/server.js`。
- API 必须设置 `NODE_ENV=production`、`DATABASE_URL`、`HOST=127.0.0.1`、`PORT=3000`。通过服务管理器/受控凭据存储注入，不把数据库密码写入脚本、Git 或输出日志。外部 PostgreSQL 连接按环境启用 TLS。
- 推荐 Web 与 API 同源：HTTPS 反向代理提供 `apps/web/dist`，把 `/api/` 转发给 API；`CORS_ORIGINS` 留空。同源会话无需额外跨域 Cookie 配置。`CORS_ORIGINS` 仅支持逗号分隔的精确 HTTP(S) origin，没有路径和通配符；设置它不会自动提供跨域登录。
- [Nginx 示例](../deploy/nginx.conf.example) 使用 Linux 路径；替换域名、证书和部署目录，并运行 `nginx -t` 后才加载配置。SPA 路由需要回退到 `index.html`。保留前一版本的带哈希静态资源，避免已打开页面在发布后无法加载旧模块。
- 正式环境只使用受控创建的正式账户并撤销演示会话。当前尚无独立首个管理员初始化命令，这是首次生产部署前的待办；开发 seed 会写演示账户和数据，不能作为生产初始化步骤。
- 邮件配置见 [邮箱操作说明](./MAIL_OUTREACH_SETUP.md)。通过进程环境注入 OAuth 凭据和固定 `MAIL_ENCRYPTION_KEY`，API 不自动加载 `.env.example`；生产 origin 使用同源 HTTPS。加密密钥与数据库独立受控备份，丢失密钥需重新授权全部连接。

在新版本的独立目录执行，失败即停止：

```powershell
corepack pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed" }
corepack pnpm --filter @hr-console/api db:generate
if ($LASTEXITCODE -ne 0) { throw "Prisma generation failed" }
corepack pnpm build
if ($LASTEXITCODE -ne 0) { throw "Build failed" }
corepack pnpm --filter @hr-console/api db:status
```

`db:status` 非零可能表示有待应用迁移，也可能表示连接或迁移历史异常，必须先区分。待应用迁移需先在隔离库演练并完成备份；迁移失败或历史异常先修复，不能用 reset 或随意 resolve 跳过。

## 备份和隔离恢复演练

使用与服务器主版本兼容的 PostgreSQL 客户端。通过 `pg_service.conf` / `.pgpass` 定义 `hr-console-prod`、`hr-console-admin`、`hr-console-restore` 三个服务，最后一个必须指向隔离的全新数据库。示例中的日期和备份目录在实际操作时替换；备份包含个人信息，保存在受控加密存储中。

先暂停写流量或进入维护窗口，使计数对照与备份处于同一稳定状态：

```powershell
$backupFile = "D:\HR-backups\hr-console-before-release-20261015.dump"
pg_dump --dbname="service=hr-console-prod" --format=custom --no-owner --no-privileges --file=$backupFile
if ($LASTEXITCODE -ne 0) { throw "Backup failed" }
Get-FileHash -LiteralPath $backupFile -Algorithm SHA256
pg_restore --list $backupFile
if ($LASTEXITCODE -ne 0) { throw "Backup catalog unreadable" }
```

目录可读只代表归档可识别，完整恢复成功才算演练通过。管理员服务连接维护库，显式创建新库；已存在同名库时停止并选用新的名字：

```powershell
createdb --maintenance-db="service=hr-console-admin" hr_console_restore_20261015
if ($LASTEXITCODE -ne 0) { throw "Restore database creation failed" }
# hr-console-restore 的 dbname 必须为上面刚创建的库。
psql --dbname="service=hr-console-restore" --set=ON_ERROR_STOP=1 --command="SELECT current_database();"
# 核对输出确为隔离库后，再执行下行。
pg_restore --dbname="service=hr-console-restore" --exit-on-error --single-transaction --no-owner --no-privileges $backupFile
if ($LASTEXITCODE -ne 0) { throw "Restore failed" }
```

在源库与恢复库分别核对 `_prisma_migrations` 的 migration_name/checksum/finished_at/rolled_back_at，及以下关键表的计数：`talents`、`organization_units`、`organization_evidences`、`leader_profiles`、`search_projects`、`candidate_projects`、`level_benchmark_reviews`、`benchmark_snapshots`、`audit_logs`，以及新增的 `mail_connections`、`mail_messages`、`mail_replies`、`mail_feedback`、`mail_suppressions`、`mail_operations`、`mail_sync_jobs`、`mail_audit`。抽样核对关联、候选人阶段、报告快照、发送状态与幂等记录。恢复副本含会话摘要和加密邮箱令牌，必须网络隔离；在启动 API 前设置 `MAIL_WORKER_ENABLED=false`，禁止副本连接真实邮箱或执行外部任务。

恢复旧备份后不能直接开启 worker：备份时间点之后可能已发送邮件，旧队列/租约会失去该事实。先对照供应商记录核对所有待发、发送中和结果不明的意图，再由运行负责人决定恢复。保留排除名单和幂等结果，加密密钥通过独立安全渠道恢复，不写入备份说明或日志。

把 `DATABASE_URL` 切换为隔离库的受控连接配置，在该副本应用待发布迁移，再检查 `db:status`、启动 API 并做真实接口验收。记录备份 SHA256、数据库标识、开始/结束时间、计数和抽样结果；演练未通过不能发布。本轮尚未执行恢复演练。

## 上线顺序和运行探测

1. 完成独立环境验收、恢复演练和发布阻塞项，保留上一版制品，安排维护窗口。
2. 在目标库完成发布前备份后，使用迁移权限的连接执行：

```powershell
corepack pnpm --filter @hr-console/api db:deploy
if ($LASTEXITCODE -ne 0) { throw "Migration failed: keep maintenance mode" }
corepack pnpm --filter @hr-console/api db:status
if ($LASTEXITCODE -ne 0) { throw "Migration status is not current" }
```

3. 服务管理器以应用权限的连接和生产环境变量启动 `corepack pnpm --filter @hr-console/api start`，并配置异常退出后的重启。切换 Web 制品目录及同源代理。不要使用 `start:product`，该开发脚本自动执行 seed。
4. 从仓库根目录运行只读运维预检：

```powershell
corepack pnpm ops:check -RequireProduction -ApiBaseUrl "https://hr.example.test"
if ($LASTEXITCODE -ne 0) { throw "Operational preflight failed" }
```

预检只读取制品存在性、干净 Git 状态、环境、迁移状态和探测端点。未传 `-ApiBaseUrl` 时跳过运行探测，不能视为实例已就绪。它不校验构建制品与提交的内容一致性、不检测 schema drift、不验证备份恢复或完整业务链路。

`GET /api/v1/health` 只证明 API 存活；`GET /api/v1/ready` 在数据库查询成功时返回 200，失败或等待超过 3 秒返回 503，且不返回连接串。ready 不代替迁移检查，也不证明 AI/邮箱外部供应商可用。数据库探测超时不会取消已提交的查询，需要数据库自身配置连接/查询超时。

5. 解除维护前核对登录、admin/HR/manager 权限、搜索目标详情、组织证据、寻访阶段、薪酬报告快照与通知。阶段 10/11 完成后，还需核对真实模型、宏观数据版本、审批发送、失败幂等、拒绝/退订停止和回信回流。记录真实结果后再恢复流量。

## 回滚

- **只回退应用**：本轮阶段 12 无新增数据库迁移。保持现有数据库，停止接收新流量，终止新 API、切换到已保留的上一版 API/Web 制品、重新启动并探测；前提是上一版已验证兼容当前 schema。API 收到 SIGINT/SIGTERM 会尝试关闭连接，超过 10 秒退出；Windows 服务需配置可传递的停止信号或等效停止流程。
- **发布包含前序迁移**：阶段 09、AI 数据表和阶段 11 邮件迁移均属于发布内容，不能因阶段 12 无独立迁移而略过。回退邮件功能前先关闭 worker，保留发送、幂等、排除与审计数据。先在恢复副本验证旧应用兼容性；不兼容时保持维护，采用审阅过的修复迁移或备份恢复方案。Prisma deploy 不提供自动向下迁移。
- **确需恢复数据**：先隔离/保留当前库和故障现场，备份切换后的新写入；将已验证备份恢复到新的替代库，核对时间点与可能丢失的写入，经发布负责人确定后切换受控连接。不要直接覆盖原库，也不要把隔离演练服务误当生产服务。
- 回退后重新核对 health、ready、迁移历史、账号权限、敏感读取审计及报告快照。当前审计在响应后写入，失败会记录日志但不回滚业务操作；生产需要监测 `audit write failed` 并补齐可靠审计方案。

## 故障定位

| 现象 | 优先检查 |
|---|---|
| health 失败 | 服务进程、端口、反向代理与 TLS |
| health 成功、ready 503 | 数据库网络/凭据/连接池与查询超时；在可信终端执行 db:status |
| ready 成功但业务表报错 | 迁移状态和 schema drift，ready 只做 SELECT 1 |
| 登录后仍 401 | HTTPS Secure Cookie、同源 `/api` 代理、会话有效期与账户状态 |
| 403 | 当前用户权限，不能通过 Web 隐藏按钮替代 API 授权 |
| 审计失败或慢查询告警 | 通过 requestId 关联服务日志；不把搜索词、Cookie、密码和连接串加入日志 |
