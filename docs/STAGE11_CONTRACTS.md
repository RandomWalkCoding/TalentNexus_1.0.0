# 阶段 11：邮箱触达与反馈契约

日期：2026-10-15。状态：共享契约、以下 API、持久队列及 `/mail-review` 页面已实现；真实邮箱端到端验收待配置后执行。

代码入口：`packages/contracts/src/mail.ts`，通过 `@hr-console/contracts` 导出全部 schema 和 DTO。首期采用 Google/Microsoft OAuth、单收件人和纯文本邮件。邮件模板渲染应在生成草稿时完成；审批与发送使用已渲染内容。真实 Google/Microsoft 适配器已实现；真实应用配置与测试邮箱验收见 [配置说明](./MAIL_OUTREACH_SETUP.md)。

## 1. 当前起点

- 当前工作分支：`stage/12-integration-release`，保留此前阶段成果，未提交。
- 创建时阶段 09、10 及部分阶段 08 页面成果仍在未提交工作区，本分支保留了它们；此起点不能视为阶段 10 的验收提交。
- [阶段 10 进展](./STAGE10_PROGRESS.md) 记录了模型供应商、专用数据库持久化和宏观数据真实来源尚未完成。邮件可以先使用人工草稿与人工分类推进；AI 草稿和分类接入仍依赖后续补齐阶段 10。
- 当前已交付邮件模型/迁移、API、Google/Microsoft 适配器、后台队列/同步、审批/反馈/漏斗页面，并在本地数据库应用迁移；没有实际授权邮箱或发送邮件。

## 2. 接口与权限

路径均以 `/api/v1` 开头。列表响应包含 `items/total/page/pageSize/requestId`，查询支持分页及白名单排序。普通详情读取和写操作都要验证工作区、资源归属及关联项目权限。权限复用现有 `outreach:read/write`，`/mail` 已映射至该资源。项目负责人可查看关联消息并审批；编辑、提交、预览/入队和重试限发件人或管理员。后台 worker 发送前再次检查授权，不信任排队时的身份快照。

| 方法与路径 | 请求 schema | 响应 schema | 权限 / HTTP 成功码 |
|---|---|---|---|
| GET `/mail/connections` | `mailConnectionListQuerySchema` | `mailConnectionListResponseSchema` | read / 200 |
| POST `/mail/connections/authorize` | `mailAuthorizeRequestSchema` | `mailAuthorizationResponseSchema` | write / 200 |
| POST `/mail/connections/:id/reconnect` | `mailReconnectRequestSchema` | `mailAuthorizationResponseSchema` | write，连接所有者 / 200 |
| POST `/mail/connections/:id/disconnect` | `mailDisconnectRequestSchema` | `mailConnectionSchema` | write，连接所有者 / 200 |
| GET `/mail/messages` | `mailMessageListQuerySchema` | `mailMessageListResponseSchema` | read / 200 |
| GET `/mail/messages/:id` | UUID 路径参数 | `mailMessageResponseSchema` | read，敏感读取审计 / 200 |
| POST `/mail/messages` | `mailDraftCreateSchema` | `mailMessageResponseSchema` | write / 201 |
| PATCH `/mail/messages/:id` | `mailDraftUpdateSchema` | `mailMessageResponseSchema` | write / 200 |
| POST `/mail/messages/:id/submit-review` | `mailSubmitReviewSchema` | `mailMessageResponseSchema` | write / 200 |
| POST `/mail/messages/:id/review` | `mailReviewDecisionSchema` | `mailMessageResponseSchema` | write，项目负责人或管理员 / 200 |
| POST `/mail/send-previews` | `mailSendPreviewRequestSchema` | `mailSendPreviewResponseSchema` | write / 200 |
| POST `/mail/send-batches` | `mailEnqueueRequestSchema` | `mailEnqueueResponseSchema` | write / 202，幂等重放 200 |
| POST `/mail/messages/:id/retry` | `mailRetryRequestSchema` | `mailMessageResponseSchema` | write / 202 |
| POST `/mail/messages/:id/stop` | `mailStopRequestSchema` | `mailMessageResponseSchema` | write / 200 |
| POST `/mail/connections/:id/sync` | `mailSyncRequestSchema` | `mailSyncResponseSchema` | write，连接所有者 / 202，重放 200 |
| GET `/mail/sync-jobs/:id` | UUID 路径参数 | `mailSyncJobSchema` | read，连接所有者 / 200 |
| GET `/mail/replies` | `mailReplyListQuerySchema` | `mailReplyListResponseSchema` | read / 200 |
| GET `/mail/replies/:id` | UUID 路径参数 | `mailReplyResponseSchema` | read，敏感读取审计 / 200 |
| PATCH `/mail/replies/:id/feedback` | `mailFeedbackCorrectionSchema` | `mailFeedbackCorrectionResponseSchema` | write / 200 |
| POST `/mail/messages/:id/feedback` | `mailManualFeedbackCreateSchema` | `mailManualFeedbackResponseSchema` | write / 201，重放 200 |
| GET `/mail/suppressions` | `mailSuppressionListQuerySchema` | `mailSuppressionListResponseSchema` | read / 200 |
| POST `/mail/suppressions` | `mailSuppressionCreateSchema` | `mailSuppressionSchema` | write / 201，已有记录返回 200 |
| GET `/mail/funnel` | `mailFunnelQuerySchema` | `mailFunnelResponseSchema` | read / 200 |

### 邮箱授权

授权起始请求只接受供应商名。服务器从配置生成回调地址和必要权限，创建一次性的、绑定当前用户会话与目标连接的 OAuth state、PKCE verifier。授权 URL 必须为 HTTPS 且匹配服务端供应商白名单；`authorizationUrl` 仅用于导航，不持久化到浏览器存储或日志。

供应商回调 `/mail/oauth/:provider/callback` 是仅供 OAuth 使用的协议入口：服务端解析 `code/state` 或授权失败参数，验证 state、会话、有效期及供应商后一次性消费，在服务端换取并加密保存令牌，随后 303 跳转到固定站内结果页。该路由需要显式的 OAuth 专用鉴权，不能简单跳过现有全局访问控制。回调参数、令牌、原始供应商异常不得进入日志或前端响应；重连必须验证原连接的邮箱身份，切换邮箱应新建连接。

`capabilities` 为应用权限 `mail.read/mail.send/offline_access`，具体 OAuth scopes 在服务端映射并核对实际授权。连接响应采用严格字段白名单，不含 accessToken、refreshToken、clientSecret、sync cursor。授权拒绝保留可处理的连接状态，令牌过期置 `expired`。断开连接删除本地凭据、停止尚未发送的消息；Google 尝试撤销令牌，Microsoft 完整撤销需在账户/租户操作；已进入供应商调用的消息仍需核对最终发送结果。

## 3. 审批与状态流转

首期首次触达、跟进均要求人工审批。每封邮件只有一个实际收件人，不支持隐藏抄送；收件人与正文在详情可核对。`talentId` 与 `campaignId` 沿用现有不超过 80 字符的业务 ID；项目、候选人项目、模板、邮箱和邮件使用 UUID。服务端核对候选人项目确实属于指定人才与项目，跟进链属于同一收件人和关联范围。

| 当前状态 | 允许的动作及结果 |
|---|---|
| draft / rejected | 替换完整内容，保持或回到 draft；提交后 pending_review |
| pending_review | 负责人批准为 approved 或驳回为 rejected；修改内容则回到 draft |
| approved | 预览后入队为 queued；修改内容则回到 draft，并清除审批 |
| queued | worker 校验通过后 sending；停止为 stopped |
| sending | 供应商明确接受后 sent；确认未接受的可恢复错误进入 failed；结果不明进入 delivery_unknown |
| delivery_unknown | 核对供应商发送记录或可关联回信后更新事实；无法证明结果则保留待核对，禁止直接重试 |
| failed | 未达到尝试上限且确认未被供应商接受时可重试入队；不可恢复错误需修改草稿重新审批或停止 |
| sent / delivered | 确认送达后 delivered；收到真实回复后 replied；退信后 bounced |
| replied / bounced / stopped | 不自动生成或重发跟进；回复分类修正不重新发送原消息 |

`version` 在资源每次修改时递增，所有变更通过 `expectedVersion` 比较并更新。`contentVersion` 随收件人、主题、正文或计划时间变化递增，审批记录固定 `contentVersion`。入队时必须确认审批仍匹配当前内容版本。编辑入队或发送中的内容返回 `INVALID_STATE`，避免审批后的实际发送内容变化。AI 建议不能自动批准或触发发送。

时间均为 UTC ISO 8601；`scheduledAt=null` 表示下一个允许的发送时刻。服务端配置发送窗口、IANA 时区、每日上限和最小发送间隔，API 边界验证配置；worker 每次发送前检查。窗口、限流或时间调整只能延后已批准的发送，不改变正文；新增计划时间须重新审批。

## 4. 预览、幂等与队列

1. 预览最多 100 个不同消息 ID，返回实际收件人、主题、批准版本与排除原因。`previewId` 在服务器保存版本、操作者、收件人集合和有效期；排除项不入队。无可发送项时禁止创建发送批次。
2. 入队仅提交 `previewId/idempotencyKey`。服务器在事务中重新核对版本、审批、归属、连接和排除名单；预览过期返回 `PREVIEW_EXPIRED`，预览后发生版本变化返回 `VERSION_CONFLICT`。任何预览外消息都不得被隐式加入。
3. 同一操作者、操作类型和幂等键绑定规范化请求摘要与结果；同键同请求返回原结果，同键不同请求返回 409 `IDEMPOTENCY_CONFLICT`。成功重放先读取保存结果，不因预览过期或版本变化失败。幂等记录与批次、任务在同一事务写入。
4. 数据库对消息发送意图建立唯一约束，并发使用不同请求键也不能生成两个可执行发送任务。worker 用数据库租约认领任务；供应商请求的幂等键/稳定 Message-ID 由消息发送意图派生，重试不得更换。供应商缺乏可靠的幂等/查询能力时，超时后停在 `delivery_unknown`，由人工核对。
5. `attemptCount` 在 worker 认领发送尝试时递增；调用前若取消也保留该尝试审计。指数退避保留原发送意图，达到 `maxAttempts` 标记 `RETRY_EXHAUSTED`。明确已接受的发送不会因响应落库失败而盲目重发；进程恢复先核对供应商。
6. 同一人才/标准化邮箱在不同项目的并行首次触达也需排除为 `DUPLICATE_CONTACT`；合法跟进必须提供同一收件人的 `followUpOfId`，前序需已发且无回复、拒绝、退订或退信。首次触达与跟进均不能绕过工作区排除名单。

## 5. 回信、停止与反馈

手动同步与默认每 300 秒自动同步共用持久任务，恢复时以 startedAt 和租约保护旧进程写入。同步 cursor 仅存服务端；按连接与供应商消息 ID 唯一去重。关联优先使用供应商 threadId 与 In-Reply-To/References，并核对发件人；不能仅凭主题自动绑定候选人。无法确定归属时进入服务端待处理队列，计入同步任务 `unassociatedCount`，不更新人才阶段。同步数据落库与 cursor 前进在同一事务内完成，失败可重放；重复 provider 事件也不能重复产生反馈。

回复列表不包含正文；详情提供保留期内的纯文本原文。保留期删除后 `bodyText=null` 且记录 `contentDeletedAt`，审批、分类和审计元数据保留。分类区分建议、当前结果、来源、置信度和人工修正；无模型时仅识别明确拒绝、退订和自动回复的保守规则，其余使用 `unknown/unclassified`；不伪造 AI 分类、时间意向或关注点。

| 事件或当前分类 | 寻访项目同步与停止规则 |
|---|---|
| 首次成功发送 | 早于 contacted 的候选人推进至 contacted |
| positive / discussion | 早于 replied 的候选人推进至 replied，待人工确认沟通中 |
| unknown | 记录回复并推进至 replied，暂停跟进，进入人工分类 |
| auto_reply | 记录回复但不计有效回复，保留候选人阶段，暂停跟进等待人工处理 |
| rejected / unsubscribed | 候选人结束，创建工作区排除记录，停止所有未发后续触达 |
| bounced | 创建工作区邮箱排除记录并停止后续发送，不直接判定人才拒绝 |
| 人工 appointment | 推进至 conversation，记录预约事件 |
| 人工 manual | 记录人工备注，不自动改变候选人阶段 |

所有项目推进由服务端执行，不回退已在 conversation 或 closed 的候选人；拒绝/退订可以将 conversation 结束。修正分类不自动重开 closed 项目；需现有寻访项目操作单独授权并留痕。修正接口返回实际 `projectStageChange` 与 `suppressionId`，前端据此刷新项目及漏斗。

拒绝/退订、排除记录、停止待发消息、反馈及项目阶段更新必须在同一事务提交，并在供应商调用前检查排除状态。已进入网络调用的邮件可能无法撤回，原消息保留真实送达状态，后续发送停止。更正误分类不删除拒绝或退订记录；本期没有自动解除排除名单接口。

人工反馈通过独立事件记录预约、拒绝、退订或备注，要求版本、幂等键、时间及原因；拒绝和退订执行相同停止规则。反馈更正保存修改前后值、操作者与理由；统计按当前事实重新聚合，保留历史审计。

## 6. 漏斗与错误

漏斗采用 `cohort=first_sent_at`：选择首次发送时间在 `[from,to)` 内且满足筛选的邮件，统计截至 `asOf` 的后续事件。所有数值按不同消息 ID 去重，多封回复不会增加同一消息的 replied 数。sent 包含供应商已接受的消息；delivered 只计有送达证据的消息，不把 sent 推断为 delivered；当前 Gmail/Graph 适配器未接通用送达回执，因此没有证据时此项为 0。effectiveReplies 计 positive/discussion；appointments 来自人工预约；manualFeedback 计存在人工备注事件的消息。拒绝、退订、退信为独立事件计数，彼此可以重叠，不能相加当作总人数。owner/template 采用发送时的快照归属。

错误沿用 `apiErrorSchema` 格式，代码使用 `mailErrorCodeSchema`；字段错误 400，未认证 401，无权限 403，不存在 404；状态、版本、幂等、审批、排除冲突 409；限流 429；未配置或供应商不可用 503。未授权/越权不返回邮箱正文或供应商异常细节。

示例：发送预览确认后入队。

```json
{
  "previewId": "550e8400-e29b-41d4-a716-446655440000",
  "idempotencyKey": "mail_batch_20261015_001"
}
```

审计覆盖授权/断开、敏感详情读取、编辑与审批、入队/重试/停止、同步、分类修正、人工反馈和排除名单写入；记录资源、操作者、时间、关联任务、变更前后状态和 requestId，禁止写入令牌或完整正文。

## 7. 验证与后续

运行时 API、数据库迁移和页面已实现，lint、TypeScript 检查和构建通过；本轮未新增或运行测试。已执行本地新增表迁移，结果与回滚边界见 [阶段 11 进展](./STAGE11_PROGRESS.md)。撤回时先关闭 worker，保留发送/幂等/排除记录，不删除已执行迁移或整体恢复共享文件。

真实授权、发送、故障恢复与回信验收仍需配置供应商应用及明确授权的测试邮箱，详见 [配置与验收说明](./MAIL_OUTREACH_SETUP.md)。首期模板需在创建草稿前渲染，AI 建议依赖阶段 10 真实任务闭环；未关联暂存没有手工绑定 UI。
