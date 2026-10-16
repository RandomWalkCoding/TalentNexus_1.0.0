import cors from "@fastify/cors";
import { jobLevelsQuerySchema, readinessResponseSchema } from "@hr-console/contracts";
import type { DashboardResponse, HealthResponse, JobLevel, JobSeries, CompanyBenchmark } from "@hr-console/contracts";
import { fastify } from "fastify";
import type { FastifyInstance, FastifyRequest } from "fastify";

import { prisma } from "./db/prisma.js";
import { PrismaOperationsRepository } from "./modules/operations/prisma-repository.js";
import type { OperationsRepository } from "./modules/operations/repository.js";
import { operationsRoutes } from "./modules/operations/routes.js";
import { OperationsService } from "./modules/operations/service.js";
import { extraOperationsRoutes } from "./modules/extra-operations.js";
import { PrismaWorkflowRepository } from "./modules/workflow-repository.js";
import type { WorkflowRepository } from "./modules/workflow-repository.js";
import { briefingRoutes, PrismaBriefingRepository } from "./modules/briefing.js";
import type { BriefingRepository } from "./modules/briefing.js";
import { compensationRoutes } from "./modules/compensation.js";
import { adminRoutes } from "./modules/admin.js";
import type { Actor } from "./modules/admin.js";
import { registerAccess } from "./modules/access.js";
import { authRoutes } from "./modules/auth.js";
import { notificationRoutes } from "./modules/notifications.js";
import { searchRoutes } from "./modules/search.js";
import { storageRoutes } from "./modules/storage.js";
import { organizationRoutes } from "./modules/organizations.js";
import { leaderRoutes } from "./modules/leaders.js";
import { searchProjectRoutes } from "./modules/search-projects.js";
import { benchmarkRoutes } from "./modules/benchmark-routes.js";
import { registerAiMacroRoutes } from "./modules/ai-macro.js";
import { env } from "./config/env.js";
import { mailRoutes } from "./modules/mail/routes.js";

const dashboardSeed: DashboardResponse = {
  stats: { talentCount: 5341, weeklyNew: 540, monitoredCompanies: 14 },
  recommendations: [
    { id: "northstar-ai", company: "Northstar AI", category: "生成式 AI", region: "美国 · 旧金山", signal: "企业版客户增长，Go-to-Market 团队持续扩张", estimatedSize: "15–25 人" },
    { id: "harbor-robotics", company: "Harbor Robotics", category: "机器人", region: "中国 · 深圳", signal: "新一轮融资完成，正在搭建商业化与供应链团队", estimatedSize: "20–30 人" },
    { id: "fieldnote-health", company: "Fieldnote Health", category: "数字医疗", region: "新加坡", signal: "进入新市场并新增多个区域负责人岗位", estimatedSize: "10–18 人" }
  ],
  followups: [
    { id: "fu-104", name: "林予安", role: "资深产品经理", company: "Northstar AI", summary: "已发送产品团队介绍，等待本周回复", status: "跟进中", occurredAt: "2026-09-28T08:40:00.000Z" },
    { id: "fu-103", name: "周启明", role: "研发总监", company: "Harbor Robotics", summary: "确认下周二进行首次沟通", status: "已回复", occurredAt: "2026-09-28T07:15:00.000Z" },
    { id: "fu-102", name: "陈嘉宁", role: "商业化负责人", company: "Fieldnote Health", summary: "补充区域扩张背景与团队规划", status: "待联系", occurredAt: "2026-09-27T10:20:00.000Z" },
    { id: "fu-101", name: "沈亦舟", role: "算法工程师", company: "Northstar AI", summary: "对方查看了岗位资料，建议今天再次触达", status: "跟进中", occurredAt: "2026-09-27T05:50:00.000Z" }
  ],
  outreach: {
    total: 128,
    repliesLast7Days: 18,
    events: [
      { id: "event-4", title: "AI 产品人才专题", channel: "邮件", occurredAt: "2026-09-28T08:10:00.000Z", replies: 4, touched: 32 },
      { id: "event-3", title: "华南机器人研发人才", channel: "站内信", occurredAt: "2026-09-27T06:30:00.000Z", replies: 7, touched: 46 },
      { id: "event-2", title: "国际化商业化负责人", channel: "邮件", occurredAt: "2026-09-25T02:20:00.000Z", replies: 5, touched: 28 },
      { id: "event-1", title: "医疗科技产品团队", channel: "站内信", occurredAt: "2026-09-23T09:45:00.000Z", replies: 2, touched: 22 }
    ]
  }
};

const jobSeriesSeed: JobSeries[] = [
  { code: "EX", name: "Executive", nameZh: "高管序列", color: "#ed8b2f", description: "制定公司的战略方向，拥有全局决策与组织管理责任。", roles: ["总经理", "事业部负责人", "VP"] },
  { code: "M", name: "Management", nameZh: "管理序列", color: "#1ca094", description: "通过管理他人的工作来达成目标，承担团队与业务结果。", roles: ["主管", "经理", "总监"] },
  { code: "P", name: "Professional", nameZh: "专业序列", color: "#e42b7b", description: "通过专业知识和持续交付创造业务价值。", roles: ["产品", "设计", "职能专家"] },
  { code: "S", name: "Sales", nameZh: "客户管理/销售序列", color: "#bf1984", description: "通过客户经营、销售拓展与商业结果创造价值。", roles: ["销售", "客户成功", "解决方案"] },
  { code: "T", name: "Technology", nameZh: "技术支持序列", color: "#7138a6", description: "以技术能力解决复杂问题，持续提升产品与系统质量。", roles: ["研发", "数据", "技术支持"] },
  { code: "U", name: "Business Support", nameZh: "业务支持序列", color: "#482495", description: "为业务提供专业支持与运营保障，推动组织高效运行。", roles: ["运营", "财务", "人力"] },
  { code: "W", name: "Operations", nameZh: "操作序列", color: "#96226b", description: "通过标准化流程完成执行工作，保障服务稳定交付。", roles: ["客服", "仓储", "现场运营"] }
];

const levelSeed: JobLevel[] = [
  { id: "ex", code: "EX", series: "EX", name: "Executive", gradeFrom: 15, gradeTo: 24, summary: "负责公司级战略与经营结果。", responsibilities: ["制定组织战略", "统筹跨区域资源", "对经营结果负责"], salaryBand: { currency: "USD", min: 180000, mid: 260000, max: 420000 } },
  ...(["M1 Supervisor", "M2 Manager", "M3 Sr. Manager", "M4 Group Mgr", "M5 Sr. Group Mgr"].map((name, index) => ({ id: `m${index + 1}`, code: `M${index + 1}`, series: "M" as const, name: name.replace(/^M\\d+ /, ""), gradeFrom: 10 + index, gradeTo: 11 + index, summary: "带领团队完成目标并培养组织能力。", responsibilities: ["目标拆解与跟进", "团队辅导与招聘", "跨团队协作"], salaryBand: { currency: "USD" as const, min: 105000 + index * 18000, mid: 132000 + index * 22000, max: 175000 + index * 28000 } }))),
  ...(["Entry", "Intern.", "Career", "Specialist", "Expert", "Recognized Expert"].map((name, index) => ({ id: `p${index + 1}`, code: `P${index + 1}`, series: "P" as const, name, gradeFrom: 8 + index, gradeTo: 9 + index, summary: "在专业领域独立交付并持续提升影响力。", responsibilities: ["完成专业交付", "沉淀方法与标准", "影响协作团队"], salaryBand: { currency: "USD" as const, min: 65000 + index * 15000, mid: 80000 + index * 18000, max: 108000 + index * 22000 } }))),
  ...(["Entry", "Intern.", "Senior", "Lead/Advanced"].map((name, index) => ({ id: `t${index + 1}`, code: `T${index + 1}`, series: "T" as const, name, gradeFrom: 4 + index, gradeTo: 5 + index, summary: "解决技术问题并推动工程质量提升。", responsibilities: ["设计与实现方案", "保障系统稳定性", "技术分享与评审"], salaryBand: { currency: "USD" as const, min: 58000 + index * 18000, mid: 72000 + index * 22000, max: 96000 + index * 26000 } }))),
  ...(["Entry", "Intern.", "Career", "Specialist", "Expert", "Recognized Expert"].map((name, index) => ({ id: `s${index + 1}`, code: `S${index + 1}`, series: "S" as const, name, gradeFrom: 8 + index, gradeTo: 9 + index, summary: "经营客户关系并达成销售与服务目标。", responsibilities: ["客户经营与拓展", "推动商业转化", "维护客户体验"], salaryBand: { currency: "USD" as const, min: 62000 + index * 16000, mid: 78000 + index * 20000, max: 104000 + index * 24000 } })) ),
  ...(["Entry", "Intern.", "Senior", "Lead/Advanced"].map((name, index) => ({ id: `u${index + 1}`, code: `U${index + 1}`, series: "U" as const, name, gradeFrom: 4 + index, gradeTo: 5 + index, summary: "以专业运营与职能能力支持业务发展。", responsibilities: ["保障业务流程", "提供专业支持", "提升运营效率"], salaryBand: { currency: "USD" as const, min: 52000 + index * 15000, mid: 67000 + index * 19000, max: 90000 + index * 23000 } })) ),
  ...(["Entry", "Intermediate", "Senior", "Lead/Advanced"].map((name, index) => ({ id: `w${index + 1}`, code: `W${index + 1}`, series: "W" as const, name, gradeFrom: 2 + index, gradeTo: 3 + index, summary: "按标准流程完成现场执行与服务交付。", responsibilities: ["按流程执行任务", "保障服务质量", "及时反馈异常"], salaryBand: { currency: "USD" as const, min: 38000 + index * 9000, mid: 47000 + index * 11000, max: 62000 + index * 14000 } })))
];

const benchmarkSeed: CompanyBenchmark[] = [
  ["Alibaba", "P4", "P", 145000, 235000], ["ByteDance", "P4", "P", 162000, 180000], ["Tencent", "P4", "P", 138000, 105000], ["Google", "T4", "T", 210000, 180000], ["Microsoft", "T4", "T", 198000, 220000], ["Amazon", "T3", "T", 176000, 150000], ["Meituan", "M3", "M", 154000, 90000], ["Huawei", "P5", "P", 128000, 207000]
].map(([company, levelCode, series, salary, employees], index) => ({ id: `benchmark-${index + 1}`, company: String(company), levelCode: String(levelCode), series: series as JobSeries["code"], salary: Number(salary), employees: Number(employees), source: "2026 Q3 薪酬调研" }));

export function buildApp(options: { operationsRepository?: OperationsRepository; workflowRepository?: WorkflowRepository; briefingRepository?: BriefingRepository; identity?: (request?: FastifyRequest) => Actor | null | Promise<Actor | null>; audit?: (entry: { actorId: string; action: string; resource: string; resourceId: string | null; requestId: string }) => Promise<void> } = {}): FastifyInstance {
  const app = fastify({
    logger: {
      redact: ["req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]'],
      serializers: { req: (request) => ({ method: request.method, route: request.routeOptions?.url }) }
    },
    requestTimeout: 30_000,
    bodyLimit: 1_048_576
  });
  app.setErrorHandler((error, request, reply) => {
    const failure = error as { code?: string; statusCode?: number };
    request.log.error({ code: failure.code, requestId: request.id }, "request failed");
    const status = failure.code === "P2002"
      ? 409
      : failure.statusCode && failure.statusCode >= 400 && failure.statusCode < 500
        ? failure.statusCode
        : 503;
    const conflict = status === 409;
    const unavailable = status === 503;
    return reply.code(status).send({
      error: {
        code: conflict ? "CONFLICT" : unavailable ? "SERVICE_UNAVAILABLE" : "REQUEST_ERROR",
        message: conflict ? "记录已存在，请检查输入" : unavailable ? "服务暂时不可用，请稍后重试" : "请求无效，请检查输入",
        requestId: request.id
      }
    });
  });
  const dashboard: DashboardResponse = structuredClone(dashboardSeed);
  const ignoredRecommendations = new Map<string, (typeof dashboard.recommendations)[number]>();
  const operationsRepository = options.operationsRepository ?? new PrismaOperationsRepository(prisma);

  void app.register(cors, { origin: env.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean) });
  authRoutes(app, prisma);
  const getActor = registerAccess(app, prisma, options);
  adminRoutes(app, prisma, getActor);
  notificationRoutes(app, prisma, getActor);
  searchRoutes(app, prisma, getActor);
  storageRoutes(app, prisma, getActor);
  organizationRoutes(app, prisma);
  leaderRoutes(app, prisma);
  searchProjectRoutes(app, prisma);
  void app.register(operationsRoutes, { service: new OperationsService(operationsRepository) });
  void app.register(extraOperationsRoutes, { repository: options.workflowRepository ?? new PrismaWorkflowRepository(prisma) });
  void app.register(briefingRoutes, { repository: options.briefingRepository ?? new PrismaBriefingRepository(prisma) });
  compensationRoutes(app, prisma);
  benchmarkRoutes(app, prisma, getActor);
  registerAiMacroRoutes(app);
  mailRoutes(app, prisma, getActor);

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  app.get("/api/v1/health", async (request): Promise<HealthResponse> => ({
    status: "ok",
    service: "api",
    timestamp: new Date().toISOString(),
    requestId: request.id
  }));

  app.get("/api/v1/ready", async (request, reply) => {
    reply.header("cache-control", "no-store");
    let database: "up" | "down" = "down";
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Readiness timeout")), 3000); })
      ]);
      database = "up";
    } catch {
      reply.code(503);
    } finally {
      clearTimeout(timer);
    }
    return readinessResponseSchema.parse({ status: database === "up" ? "ready" : "unavailable", service: "api", database, timestamp: new Date().toISOString(), requestId: request.id });
  });

  app.get("/api/v1/dashboard", async (): Promise<DashboardResponse> => dashboard);

  app.get<{ Querystring: Record<string, string | undefined> }>("/api/v1/job-levels", async (request, reply) => {
    const parsed = jobLevelsQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "请求参数无效", details: parsed.error.issues, requestId: request.id } });
    const { series, currency, metric } = parsed.data;
    const fxRate = 7.12;
    const totalCashFactor = metric === "totalCash" ? 1.2 : 1;
    const benchmarks = benchmarkSeed.filter((benchmark) => !series || benchmark.series === series).map((benchmark) => ({
      ...benchmark,
      salary: Math.round(benchmark.salary * totalCashFactor * (currency === "CNY" ? fxRate : 1))
    }));
    const levels = levelSeed.filter((level) => !series || level.series === series).map((level) => ({
      ...level,
      salaryBand: Object.fromEntries(Object.entries(level.salaryBand).map(([key, value]) => [key, typeof value === "number" ? Math.round(value * totalCashFactor) : value])) as JobLevel["salaryBand"]
    }));
    return {
      surveyGrades: Array.from({ length: 24 }, (_, index) => index + 2),
      series: jobSeriesSeed,
      levels,
      benchmarks,
      currency,
      metric,
      fxRate,
      asOf: "2026-09-28",
      requestId: request.id
    };
  });

  app.post<{ Params: { recommendationId: string } }>("/api/v1/dashboard/recommendations/:recommendationId/ignore", async (request, reply) => {
    const index = dashboard.recommendations.findIndex((item) => item.id === request.params.recommendationId);
    if (index < 0) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "推荐目标不存在", requestId: request.id } });
    const [recommendation] = dashboard.recommendations.splice(index, 1);
    if (recommendation) ignoredRecommendations.set(recommendation.id, recommendation);
    return { ok: true as const, message: `已忽略 ${recommendation?.company ?? "推荐目标"}` };
  });

  app.post<{ Params: { recommendationId: string } }>("/api/v1/dashboard/recommendations/:recommendationId/restore", async (request, reply) => {
    const recommendation = ignoredRecommendations.get(request.params.recommendationId);
    if (!recommendation) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "可撤销的推荐目标不存在", requestId: request.id } });
    ignoredRecommendations.delete(recommendation.id);
    dashboard.recommendations.push(recommendation);
    return { ok: true as const, message: `已恢复 ${recommendation.company}` };
  });

  app.post<{ Params: { recommendationId: string } }>("/api/v1/dashboard/recommendations/:recommendationId/tasks", async (request, reply) => {
    const recommendation = dashboard.recommendations.find((item) => item.id === request.params.recommendationId);
    if (!recommendation) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "推荐目标不存在", requestId: request.id } });
    const followup = {
      id: `fu-${Date.now()}`,
      name: recommendation.company,
      role: "人才摸排任务",
      company: recommendation.company,
      summary: "已创建推荐目标跟进任务",
      status: "待联系" as const,
      occurredAt: new Date().toISOString()
    };
    dashboard.followups.unshift(followup);
    return { ok: true as const, message: `已为 ${recommendation.company} 创建跟进任务`, followup };
  });

  return app;
}
