# 技术文档：数据选型与数据契约原则

## 1. 选型结论

### 主数据库：PostgreSQL

TalentNexus 的核心对象具有稳定关系：人才属于分类、线索有阶段和负责人、触达属于战役、职级与公司比较存在映射、薪酬计算需要可审计版本。因此使用 PostgreSQL 作为唯一事实来源，支持事务、索引、分页、聚合和审计查询。

### ORM 与迁移：Prisma

Prisma schema 是开发期模型来源；所有结构变化必须通过迁移提交。禁止在运行时自动同步表结构。生产数据变更使用显式 migration，种子数据只用于开发和测试。

### 缓存与异步：Redis（可选）

当前不把 Redis 设为硬依赖。通知和搜索可以使用短期缓存。AI、邮箱、汇率与 PPP 的长期任务状态、重试次数、幂等键及结果须持久化到 PostgreSQL；后台 worker 可以先基于数据库队列实现，吞吐量确有需要时再引入 Redis。缓存失效不能破坏事实数据或造成邮件重复发送。

### 文件与图片：本地资源 + 对象存储接口

截图参考图、图标和插画进入前端 `public/assets` 或受控对象存储。人才简历、导入报告等未来文件只保存 metadata 和受控 URL，不把大文件写入 PostgreSQL。

## 2. 核心实体

| 实体 | 关键字段 | 关系/说明 |
|---|---|---|
| User | id、name、email、status | 关联 Role、Preference、AuditLog |
| Role/Permission | code、resource、action | RBAC；权限代码稳定，不使用中文作为程序 key |
| Talent | id、name、company、function、level、location | 关联 Category、Tag、Activity |
| TalentCategory | id、name、ownerId | 一个分类包含多个 Talent |
| Lead | id、subject、stage、ownerId、score | 可关联 Company、Talent、Activity |
| Company | id、name、industry、location | 竞对、公司比较和 Mapping 共用 |
| IntelligenceItem | title、summary、source、importance、publishedAt | 情报和 AI 快讯的来源对象 |
| OutreachCampaign | id、name、channel、status | 关联 OutreachEvent 和 Talent/Lead |
| ResearchTask | id、name、ownerId、status、progress | 关联 ResearchResult |
| JobSeries/JobLevel | code、name、gradeFrom、gradeTo | 组成 EX/M/P/S/T/U/W 职级图 |
| CompensationAssumption | version、region、effectiveFrom、payload | 不覆盖历史版本 |
| Calculation | input、result、currency、assumptionsVersion | 保存可复现的薪酬计算快照 |
| AuditLog | actorId、action、resource、resourceId、createdAt | 记录写操作和权限敏感操作 |

### 新版 PRD 的增量实体

| 实体 | 关键字段 | 关系/说明 |
|---|---|---|
| OrganizationUnit / LeaderProfile | companyId、parentId、region、role、verifiedAt | 组织树与领队档案；关联证据和历史版本 |
| Evidence / ResearchFinding | sourceUrl、capturedAt、status、confidence | 来源事实与 AI 推断分开保存，支持人工核验和冲突处理 |
| SearchProject / CandidateProject | ownerId、target、stage、nextActionAt | 寻访项目与人才阶段，防止跨项目重复触达 |
| CompensationSample / LevelBenchmark | region、currency、period、source、sampleDate | 薪酬样本、分位数与职级映射，缺失或样本不足留状态 |
| MarketSnapshot / SyncJob | kind、source、base、publishedAt、status | 汇率/PPP 版本、采集校验、发布和回滚记录 |
| AiJob / AiReview | inputRefs、modelVersion、promptVersion、status | 模型输出与人工审核，保存证据引用和用量 |
| EmailConnection / EmailMessage | accountId、threadId、providerId、status | 授权邮箱、发送队列、回信同步；令牌加密且不返回前端 |
| OutreachFeedback | candidateId、campaignId、kind、occurredAt | 送达、回复、拒绝、退订和人工反馈 |

## 3. 数据建模规则

- 主键统一使用 UUID；对外 ID 不暴露数据库自增序列。
- 所有业务表包含 `createdAt`、`updatedAt`；可恢复删除使用 `deletedAt`，不默认物理删除。
- 金额使用 `numeric/Decimal`，禁止用浮点数保存薪酬、汇率和税率。
- 日期时间统一存 UTC，接口返回 ISO 8601；前端按用户时区展示。
- 枚举在 API 契约中使用稳定英文 code，前端通过字典映射中文显示。
- 多对多关系使用显式关系表，关系表保留创建人和更新时间。
- 搜索字段建立有针对性的索引；模糊搜索首期使用 PostgreSQL `pg_trgm`，数据量扩大后再评估专用搜索服务。

## 4. 薪酬计算数据策略

首期使用版本化规则和脱敏种子数据：

- 地区、币种、汇率和税制参数独立存储。
- 每次计算记录输入快照、规则版本、汇率日期和输出快照。
- 修改新规则只能创建新版本，不能覆盖已经产生计算结果所依赖的版本。
- 计算服务返回中间步骤，支持候选人侧和公司侧瀑布图复用同一结果。
- mock 规则必须显式标记 `source=seed`，便于未来替换为真实规则或外部数据源。

## 5. 外部数据与敏感信息

- 汇率与 PPP 使用有授权的数据源，经采集、格式/范围/异常波动校验后发布快照。保留原始值、基准币或国际元基准、地区、发布日期、抓取时间、来源及版本；异常时维持最近已发布值并显示过期状态。
- 薪酬样本记录来源许可、地区、职位/职级、现金与非现金组成、样本日期和最小样本量。无法满足样本门槛时不计算确定性市场分位。
- AI 输入只引用当前任务可访问的数据；保存任务状态、结构化结果、来源引用和审核记录。提示词版本、模型版本、调用耗时与用量用于复现和质量评估，不在普通日志中写入敏感正文。
- 邮箱令牌和模型密钥只在服务端加密保存或从密钥服务读取。邮件正文根据保留期限管理，发送/同步任务保存 providerId 和幂等键；退订名单在发送前检查。
- 组织和领队资料以来源事实为主，推断与人工确认单独建状态；同名人员合并和拆分留下审计记录。

## 6. API 响应格式

列表：

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 20,
  "requestId": "req_xxx"
}
```

错误：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数无效",
    "details": [],
    "requestId": "req_xxx"
  }
}
```

## 7. 脱敏、种子与备份

- 仓库内只使用虚构姓名、公司和联系方式；不得提交真实手机号、邮箱、简历或薪资明细。
- `seed` 必须幂等，重复执行不会产生重复核心记录。
- 测试使用独立数据库 schema 或容器，测试结束可清理。
- 生产备份、恢复、留存周期在上线前另行确定；首期代码只提供迁移和导出接口，不把备份脚本伪装成业务功能。
