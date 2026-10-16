# 邮箱配置与验收说明

入口：侧栏「邮箱触达」或 `/mail-review`。本说明针对已实现的阶段 11 代码；真实邮箱验收尚未执行。

## 服务端配置

变量清单见 `apps/api/.env.example`。API 从进程环境读取，启动器不会自动加载该示例文件；应通过服务管理器、受控密钥存储或启动 API 的 PowerShell 进程注入。修改后重启 API。

| 变量 | 配置 |
|---|---|
| `MAIL_ENCRYPTION_KEY` | 固定的 32 字节随机密钥，编码为 64 位十六进制；服务端安全保存，重启保持一致，与数据库独立备份 |
| `MAIL_API_ORIGIN` / `MAIL_WEB_ORIGIN` | 浏览器使用的同源地址，开发默认均为 `http://localhost:5173`；Vite 将 `/api` 代理至 API。生产均为站点 HTTPS origin，不含末尾 `/` 或路径 |
| `MAIL_GOOGLE_CLIENT_ID` / `MAIL_GOOGLE_CLIENT_SECRET` | Google OAuth Web 应用凭据 |
| `MAIL_MICROSOFT_CLIENT_ID` / `MAIL_MICROSOFT_CLIENT_SECRET` | Microsoft Entra Web 应用凭据；secret 使用值，不是 secret ID |
| `MAIL_MICROSOFT_TENANT` | 默认 `common`；专用组织可使用租户 ID，须与应用支持的账户类型一致 |
| `MAIL_WORKER_ENABLED` | 默认 `true`，同时控制发送、同步、结果核对和清理；隔离恢复副本设 `false` |
| `MAIL_TIMEZONE` | 默认 `Asia/Shanghai`，有效 IANA 时区 |
| `MAIL_SEND_START_HOUR` / `MAIL_SEND_END_HOUR` | 默认 9 / 18，开始包含、结束不含；支持同日窗口 |
| `MAIL_DAILY_LIMIT` / `MAIL_MIN_INTERVAL_SECONDS` | 默认每连接每日 100 封、最小间隔 60 秒，结果不明的发送占用配额 |
| `MAIL_SYNC_INTERVAL_SECONDS` | 默认 300；后台定时排入同步任务，连接页可手动同步 |
| `MAIL_BODY_RETENTION_DAYS` | 默认 90 天；删除过期回复正文与未关联暂存，保留分类和审计元数据 |

未配置 OAuth 或加密密钥时，页面可读取已有数据；授权返回 `MAIL_NOT_CONFIGURED`，不使用演示发送适配器。密钥不进入前端变量、仓库、浏览器存储或日志。

## Google Gmail

1. 在 Google Cloud 项目启用 Gmail API，配置 OAuth 同意屏幕和 Web 应用。测试状态时加入验收账户；生产按 Gmail 敏感/受限 scope 要求完成应用验证。
2. 注册精确回调：`http://localhost:5173/api/v1/mail/oauth/google/callback`。生产替换为同源 HTTPS origin。
3. 注入 client ID/secret。应用请求 `https://www.googleapis.com/auth/gmail.modify` 和 offline access；服务器核对实际 scope 和 refresh token。
4. 登录工作台，从「邮箱连接」发起授权。回调须使用原浏览器和登录会话；不要将 `localhost` 换成 `127.0.0.1`。
5. 测试模式 refresh token 可能受 Google 有效期限制，失效后重连。重连只能授权同一邮箱，切换身份应新建连接。

## Microsoft Graph

1. 在 Entra 注册应用，选择适当账户类型，添加 Web 平台回调：`http://localhost:5173/api/v1/mail/oauth/microsoft/callback`，生产替换为同源 HTTPS origin。
2. 配置 delegated permissions：`User.Read`、`Mail.ReadWrite`、`Mail.Send`，同时请求 `offline_access`；按组织要求完成管理员同意。
3. 注入 client ID、secret 值和 tenant，启动 API 并在连接页授权。账户需具有可通过 Graph 访问的 Outlook/Exchange 邮箱。
4. 发送先创建草稿并持久化 immutable ID，再正式发送；结果不明时查询该 ID 的 `isDraft` 核对。断开删除本地凭据；彻底撤销同意可在 Microsoft 账户/组织应用设置操作。

API 日志只记录路由模板，不记录 OAuth 参数；生产代理的回调访问日志也应省略查询参数。

## 操作流程

1. HR/管理员连接自己的邮箱。创建草稿时选择真实人才、项目/候选人项目及战役，填写实际收件邮箱、已经渲染的主题和正文。
2. 提交审批。由具备写权限的项目负责人或管理员审批；无项目邮件由管理员审批。修改内容或计划后重新审批。
3. 生成预览，逐封核对正文、收件人和计划，检查排除项，勾选确认后入队。后台按窗口和配额执行，刷新查看状态。
4. 前序已发且无回复时可创建跟进草稿，保持同人才/邮箱/项目/战役/连接，每封重新审批。回复、拒绝、退订和退信会阻止后续触达。
5. 连接页展示最近同步时间和手动任务进度。回复详情可查看原文、修正分类；人工反馈可记录预约、拒绝、退订和备注。
6. 拒绝/退订生成工作区排除并结束相应寻访；退信只排除邮箱。分类纠正不自动解除排除或重开项目。漏斗按首次发送时间 `[from,to)` 归组、按邮件去重。

## 待执行的真实验收

在拥有并明确授权的测试发件箱和收件箱上记录以下结果。本清单是后续操作说明，本轮没有发送邮件或运行这些测试。

- OAuth 成功、取消、会话过期、身份不匹配、缺 scope、重连和断开；响应/日志无明文凭据。
- 审批邮件实际只到达一次；重复入队返回原结果；修改内容使旧预览失效；窗口与限额行为正确。
- 明确拒绝的发送可重试；发送超时进入 `delivery_unknown`，重启后先核对供应商，不盲目重发。
- 真实回复自动/手动同步，重复同步不重复入库；项目阶段与漏斗随人工修正更新。
- 拒绝/退订停止同人才/邮箱在其他项目、战役和连接的未发消息；发送前新增排除能阻断。
- 同步中断/多进程恢复时旧任务不能覆盖新任务，断开停止同步和发送并保留历史事实。
- 桌面/窄屏、键盘、加载/空/错误/权限状态；隔离恢复副本 worker 关闭。

取得真实结果前，阶段 11 保持“实现已交付、真实验收待完成”。AI 草稿/分类依赖阶段 10 真实供应商闭环，当前人工和规则路径可用。
