import { z } from "zod";

export * from "./mail.js";

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.unknown()).optional(),
    requestId: z.string()
  })
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("api"),
  timestamp: z.iso.datetime(),
  requestId: z.string().min(1)
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const loginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128)
}).strict();
export type LoginRequest = z.infer<typeof loginRequestSchema>;

const dashboardRecommendationSchema = z.object({
  id: z.string(),
  company: z.string(),
  category: z.string(),
  region: z.string(),
  signal: z.string(),
  estimatedSize: z.string()
});

const dashboardFollowupSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  company: z.string(),
  summary: z.string(),
  status: z.enum(["待联系", "跟进中", "已回复"]),
  occurredAt: z.iso.datetime()
});

const outreachEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  channel: z.string(),
  occurredAt: z.iso.datetime(),
  replies: z.number().int().nonnegative(),
  touched: z.number().int().nonnegative()
});

export const dashboardResponseSchema = z.object({
  stats: z.object({
    talentCount: z.number().int().nonnegative(),
    weeklyNew: z.number().int().nonnegative(),
    monitoredCompanies: z.number().int().nonnegative()
  }),
  recommendations: z.array(dashboardRecommendationSchema),
  followups: z.array(dashboardFollowupSchema),
  outreach: z.object({
    total: z.number().int().nonnegative(),
    repliesLast7Days: z.number().int().nonnegative(),
    events: z.array(outreachEventSchema)
  })
});

export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;

export const dashboardActionResponseSchema = z.object({
  ok: z.literal(true),
  message: z.string(),
  followup: dashboardFollowupSchema.optional()
});

export type DashboardActionResponse = z.infer<typeof dashboardActionResponseSchema>;

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(200).optional()
});

const listMetadataSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  requestId: z.string().min(1)
});

const sourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.url().nullable()
});

export const organizationEvidenceStatusSchema = z.enum(["pending", "unverified", "verified", "rejected"]);
export const organizationUnitSchema = z.object({
  id: z.string(), companyId: z.string(), parentId: z.string().nullable(), name: z.string(), kind: z.string(),
  region: z.string().nullable(), role: z.string().nullable(), status: organizationEvidenceStatusSchema, version: z.number().int().positive(),
  childrenCount: z.number().int().nonnegative(), evidenceCount: z.number().int().nonnegative(), updatedAt: z.iso.datetime()
});
export const organizationEvidenceSchema = z.object({
  id: z.string(), organizationUnitId: z.string(), source: sourceSchema, title: z.string(), excerpt: z.string(),
  collectedAt: z.iso.datetime(), confidence: z.number().int().min(0).max(100), status: organizationEvidenceStatusSchema,
  reviewNote: z.string().nullable(), reviewedAt: z.iso.datetime().nullable()
});
export const organizationsResponseSchema = z.object({ items: z.array(organizationUnitSchema), ...listMetadataSchema.shape });
export const organizationDetailResponseSchema = organizationUnitSchema.extend({ evidence: z.array(organizationEvidenceSchema), children: z.array(organizationUnitSchema) });
export const createEvidenceRequestSchema = z.object({ sourceId: z.string().uuid(), title: z.string().trim().min(1).max(300), excerpt: z.string().trim().min(1).max(10000), collectedAt: z.iso.datetime(), confidence: z.number().int().min(0).max(100).default(50) }).strict();
export const reviewEvidenceRequestSchema = z.object({ status: organizationEvidenceStatusSchema, reviewNote: z.string().trim().max(2000).nullable().optional() }).strict();
export type OrganizationEvidenceStatus = z.infer<typeof organizationEvidenceStatusSchema>;
export type OrganizationUnit = z.infer<typeof organizationUnitSchema>;
export type OrganizationEvidence = z.infer<typeof organizationEvidenceSchema>;
export type OrganizationDetailResponse = z.infer<typeof organizationDetailResponseSchema>;

export const leaderProfileSchema = z.object({
  id: z.string(), companyId: z.string(), organizationUnitId: z.string().nullable(), name: z.string(),
  currentTitle: z.string().nullable(), previousTitles: z.array(z.string()), regions: z.array(z.string()),
  teamSummary: z.string().nullable(), contactChannels: z.array(z.string()), status: organizationEvidenceStatusSchema,
  version: z.number().int().positive(), researchTaskIds: z.array(z.string()), updatedAt: z.iso.datetime()
});
export const leaderListResponseSchema = z.object({ items: z.array(leaderProfileSchema), ...listMetadataSchema.shape });
export const leaderCreateSchema = z.object({ companyId: z.string().uuid(), organizationUnitId: z.string().uuid().nullable().default(null), name: z.string().trim().min(1).max(120), currentTitle: z.string().trim().max(200).nullable().default(null), previousTitles: z.array(z.string().trim().min(1).max(200)).max(20).default([]), regions: z.array(z.string().trim().min(1).max(160)).max(20).default([]), teamSummary: z.string().trim().max(5000).nullable().default(null), contactChannels: z.array(z.string().trim().min(1).max(240)).max(10).default([]) }).strict();
export const leaderUpdateSchema = leaderCreateSchema.omit({ companyId: true }).partial().strict().refine((value) => Object.keys(value).length > 0);
export const leaderEvidenceSchema = organizationEvidenceSchema.omit({ organizationUnitId: true });
export const leaderDetailResponseSchema = leaderProfileSchema.extend({ evidence: z.array(leaderEvidenceSchema) });
export type LeaderProfile = z.infer<typeof leaderProfileSchema>;
export type LeaderEvidence = z.infer<typeof leaderEvidenceSchema>;

export const intelligenceItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  content: z.string().min(1),
  kind: z.enum(["industry", "company"]),
  companyName: z.string().min(1).nullable(),
  source: sourceSchema,
  importance: z.enum(["low", "medium", "high"]),
  tags: z.array(z.string().min(1)),
  publishedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime()
});

export type IntelligenceItem = z.infer<typeof intelligenceItemSchema>;

export const intelligenceListQuerySchema = paginationQuerySchema.extend({
  kind: z.enum(["industry", "company"]).optional(),
  sourceId: z.string().uuid().optional(),
  importance: z.enum(["low", "medium", "high"]).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  source: z.string().trim().min(1).max(160).optional(),
  sort: z.enum(["publishedAt:desc", "publishedAt:asc", "importance:desc"]).default("publishedAt:desc")
}).refine((query) => !query.from || !query.to || query.from <= query.to, {
  message: "from must be on or before to",
  path: ["from"]
});

export type IntelligenceListQuery = z.infer<typeof intelligenceListQuerySchema>;

export const intelligenceListResponseSchema = z.object({
  items: z.array(intelligenceItemSchema),
  ...listMetadataSchema.shape
});

export type IntelligenceListResponse = z.infer<typeof intelligenceListResponseSchema>;

export const monitorSignalSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["funding", "hiring", "other"]),
  title: z.string().min(1),
  summary: z.string().min(1),
  source: sourceSchema,
  occurredAt: z.iso.datetime()
});

export type MonitorSignal = z.infer<typeof monitorSignalSchema>;

export const competitorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  industry: z.string().min(1),
  region: z.string().min(1),
  employeeCount: z.number().int().nonnegative().nullable(),
  monitored: z.boolean(),
  fundingSignal: z.string().nullable(),
  hiringSignal: z.string().nullable(),
  lastUpdatedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime()
});

export type Competitor = z.infer<typeof competitorSchema>;

export const competitorListQuerySchema = paginationQuerySchema.extend({
  industry: z.string().trim().min(1).max(100).optional(),
  monitored: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  sort: z.enum(["name:asc", "lastUpdatedAt:desc", "employeeCount:desc"]).default("lastUpdatedAt:desc")
});

export type CompetitorListQuery = z.infer<typeof competitorListQuerySchema>;

export const competitorListResponseSchema = z.object({
  items: z.array(competitorSchema),
  ...listMetadataSchema.shape
});

export type CompetitorListResponse = z.infer<typeof competitorListResponseSchema>;

export const competitorDetailResponseSchema = z.object({
  competitor: competitorSchema,
  signals: z.array(monitorSignalSchema)
});

export type CompetitorDetailResponse = z.infer<typeof competitorDetailResponseSchema>;

export const competitorMonitorUpdateSchema = z.object({ monitored: z.boolean() });

export type CompetitorMonitorUpdate = z.infer<typeof competitorMonitorUpdateSchema>;

export const jobSeriesCodeSchema = z.enum(["EX", "M", "P", "S", "T", "U", "W"]);
export type JobSeriesCode = z.infer<typeof jobSeriesCodeSchema>;

export const jobSeriesSchema = z.object({
  code: jobSeriesCodeSchema,
  name: z.string().min(1),
  nameZh: z.string().min(1),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  description: z.string().min(1),
  roles: z.array(z.string().min(1))
});
export type JobSeries = z.infer<typeof jobSeriesSchema>;

export const jobLevelSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  series: jobSeriesCodeSchema,
  name: z.string().min(1),
  gradeFrom: z.number().int().min(2).max(25),
  gradeTo: z.number().int().min(2).max(25),
  summary: z.string().min(1),
  responsibilities: z.array(z.string().min(1)),
  salaryBand: z.object({ currency: z.literal("USD"), min: z.number().nonnegative(), mid: z.number().nonnegative(), max: z.number().nonnegative() })
}).refine((level) => level.gradeFrom <= level.gradeTo && level.salaryBand.min <= level.salaryBand.mid && level.salaryBand.mid <= level.salaryBand.max, {
  message: "level ranges must be ordered"
});
export type JobLevel = z.infer<typeof jobLevelSchema>;

export const companyBenchmarkSchema = z.object({
  id: z.string().min(1),
  company: z.string().min(1),
  levelCode: z.string().min(1),
  series: jobSeriesCodeSchema,
  salary: z.number().nonnegative(),
  employees: z.number().int().positive().nullable(),
  source: z.string().min(1)
});
export type CompanyBenchmark = z.infer<typeof companyBenchmarkSchema>;

export const jobLevelsQuerySchema = z.object({
  series: jobSeriesCodeSchema.optional(),
  currency: z.enum(["USD", "CNY"]).default("USD"),
  metric: z.enum(["baseSalary", "totalCash"]).default("baseSalary")
});
export type JobLevelsQuery = z.infer<typeof jobLevelsQuerySchema>;

export const jobLevelsResponseSchema = z.object({
  surveyGrades: z.array(z.number().int().min(2).max(25)),
  series: z.array(jobSeriesSchema),
  levels: z.array(jobLevelSchema),
  benchmarks: z.array(companyBenchmarkSchema),
  currency: z.enum(["USD", "CNY"]),
  metric: z.enum(["baseSalary", "totalCash"]),
  fxRate: z.number().positive(),
  asOf: z.iso.date(),
  requestId: z.string().min(1)
});
export type JobLevelsResponse = z.infer<typeof jobLevelsResponseSchema>;

const operationBaseSchema = z.object({ id: z.string().min(1), updatedAt: z.iso.datetime() });
const shortText = z.string().trim().min(1).max(120);
const titleText = z.string().trim().min(1).max(300);
const summaryText = z.string().trim().min(1).max(5000);
export const leadSchema = operationBaseSchema.extend({ subject: titleText, company: z.string().trim().min(1).max(200), source: shortText.optional(), lastTouchedAt: z.iso.date().nullable().optional(), stage: z.enum(["new", "qualified", "contacted", "won", "lost"]), owner: shortText, score: z.number().int().min(0).max(100), summary: summaryText });
export type Lead = z.infer<typeof leadSchema>;
export const talentSchema = operationBaseSchema.extend({ name: shortText, title: titleText, company: titleText, location: shortText, category: shortText, tags: z.array(shortText), level: z.string().max(100).optional() });
export type Talent = z.infer<typeof talentSchema>;
export const searchProjectStatusSchema = z.enum(["draft", "active", "paused", "completed"]);
export const candidateProjectStageSchema = z.enum(["research", "longlist", "shortlist", "ready_to_contact", "contacted", "replied", "conversation", "closed"]);
export const searchProjectSchema = operationBaseSchema.extend({ id: z.string().uuid(), name: titleText, companyId: z.string().uuid().nullable(), targetRole: shortText, regions: z.array(shortText), owner: shortText, status: searchProjectStatusSchema, targetCount: z.number().int().nonnegative(), deadline: z.iso.date().nullable(), summary: summaryText, candidateCount: z.number().int().nonnegative() });
export const searchProjectCandidateSchema = z.object({ id: z.string().uuid(), projectId: z.string().uuid(), talentId: z.string().min(1), stage: candidateProjectStageSchema, source: shortText.nullable(), nextActionAt: z.iso.datetime().nullable(), feedback: z.string().max(5000).nullable(), talent: talentSchema });
export const searchProjectDetailSchema = searchProjectSchema.extend({ candidates: z.array(searchProjectCandidateSchema) });
export const searchProjectListResponseSchema = z.object({ items: z.array(searchProjectSchema), ...listMetadataSchema.shape });
export const searchProjectCreateSchema = z.object({ name: titleText, companyId: z.string().uuid().nullable().default(null), targetRole: shortText, regions: z.array(shortText).min(1).max(20), owner: shortText, status: searchProjectStatusSchema.default("draft"), targetCount: z.number().int().nonnegative().default(0), deadline: z.iso.date().nullable().default(null), summary: summaryText }).strict();
export const searchProjectUpdateSchema = searchProjectCreateSchema.omit({ name: true, companyId: true }).partial().strict().refine((value) => Object.keys(value).length > 0);
export const searchProjectCandidateCreateSchema = z.object({ talentId: z.string().trim().min(1).max(80), stage: candidateProjectStageSchema.default("research"), source: shortText.nullable().default(null), nextActionAt: z.iso.datetime().nullable().default(null), feedback: z.string().trim().max(5000).nullable().default(null) }).strict();
export const searchProjectCandidateUpdateSchema = searchProjectCandidateCreateSchema.partial().strict().refine((value) => Object.keys(value).length > 0);
export type CandidateProjectStage = z.infer<typeof candidateProjectStageSchema>;
export type SearchProject = z.infer<typeof searchProjectSchema>;
export type SearchProjectCandidate = z.infer<typeof searchProjectCandidateSchema>;
export type SearchProjectDetail = z.infer<typeof searchProjectDetailSchema>;
export const researchTaskSchema = operationBaseSchema.extend({ name: titleText, status: z.enum(["todo", "in_progress", "done"]), progress: z.number().int().min(0).max(100), owner: shortText, target: z.string().trim().min(1).max(200), summary: summaryText, deadline: z.iso.date().nullable().optional(), result: z.string().trim().max(5000).optional() });
export type ResearchTask = z.infer<typeof researchTaskSchema>;
export const outreachCampaignSchema = operationBaseSchema.extend({ name: titleText, channel: z.enum(["email", "linkedin", "phone"]), status: z.enum(["draft", "running", "paused", "done"]), targetCount: z.number().int().nonnegative().optional(), touched: z.number().int().nonnegative(), replies: z.number().int().nonnegative(), summary: summaryText });
export type OutreachCampaign = z.infer<typeof outreachCampaignSchema>;
export const mappingItemSchema = operationBaseSchema.extend({ source: titleText, target: titleText, type: z.enum(["company", "role", "level"]), confidence: z.number().int().min(0).max(100), summary: summaryText });
export type MappingItem = z.infer<typeof mappingItemSchema>;
export const operationListQuerySchema = paginationQuerySchema.extend({ filter: z.string().trim().max(100).optional(), location: z.string().trim().max(120).optional(), tag: z.string().trim().max(120).optional(), channel: z.enum(["email", "linkedin", "phone"]).optional() });
export type OperationListQuery = z.infer<typeof operationListQuerySchema>;
export const leadCreateSchema = leadSchema.pick({ subject: true, company: true, owner: true, score: true, summary: true }).extend({ source: shortText.default("手动录入"), lastTouchedAt: z.iso.date().nullable().default(null), stage: leadSchema.shape.stage.default("new") }).strict();
export const researchTaskCreateSchema = researchTaskSchema.pick({ name: true, owner: true, target: true, summary: true }).extend({ deadline: z.iso.date().nullable().default(null), result: z.string().trim().max(5000).default(""), status: researchTaskSchema.shape.status.default("todo"), progress: z.number().int().min(0).max(100).default(0) }).strict();
export const outreachCreateSchema = outreachCampaignSchema.pick({ name: true, channel: true, touched: true, replies: true, summary: true }).extend({ targetCount: z.number().int().nonnegative(), status: outreachCampaignSchema.shape.status.default("draft") }).strict().refine((input) => input.replies <= input.touched && input.touched <= input.targetCount, { message: "目标人数、发送数和回复数应依次递减", path: ["targetCount"] });
export const mappingCreateSchema = mappingItemSchema.omit({ id: true, updatedAt: true }).strict();
export const mappingImportSchema = z.object({ items: z.array(mappingCreateSchema).min(1).max(100) }).strict();
export const leadUpdateSchema = leadSchema.pick({ stage: true, owner: true, source: true, lastTouchedAt: true }).partial().strict().refine((input) => Object.keys(input).length > 0);
export const leadBatchSchema = z.object({ ids: z.array(z.string().min(1).max(80)).min(1).max(100).refine((ids) => new Set(ids).size === ids.length), patch: leadUpdateSchema }).strict();
export const talentUpdateSchema = talentSchema.pick({ category: true }).extend({ category: z.string().trim().min(1).max(100) }).strict();
export const talentCategorySchema = z.object({ name: z.string().trim().min(1).max(100), owner: shortText.optional(), count: z.number().int().nonnegative().optional() });
export const talentCategoryUpdateSchema = z.object({ name: z.string().trim().min(1).max(100).optional(), owner: shortText.optional() }).strict().refine((input) => Object.keys(input).length > 0);
export const talentCategoryListSchema = z.object({ items: z.array(talentCategorySchema), requestId: z.string().min(1) });
export const researchTaskUpdateSchema = researchTaskSchema.pick({ status: true, owner: true, progress: true, deadline: true, result: true }).partial().strict().refine((input) => Object.keys(input).length > 0);
export const outreachUpdateSchema = outreachCampaignSchema.pick({ status: true, targetCount: true, touched: true, replies: true }).partial().strict().refine((input) => Object.keys(input).length > 0);
export const mappingUpdateSchema = mappingItemSchema.pick({ target: true, confidence: true, summary: true }).partial().strict().refine((value) => Object.keys(value).length > 0);
export const operationListResponseSchema = z.object({ items: z.array(z.unknown()), total: z.number().int().nonnegative(), page: z.number().int().min(1), pageSize: z.number().int().min(1), requestId: z.string().min(1) });
export type OperationListResponse = z.infer<typeof operationListResponseSchema>;
export const briefingSchema = z.object({ id: z.string().min(1), intelligence: intelligenceItemSchema, read: z.boolean(), confidence: z.number().int().min(0).max(100).optional(), updatedAt: z.iso.datetime() });
export const briefingListQuerySchema = paginationQuerySchema.extend({ read: z.enum(["true", "false"]).transform((value) => value === "true").optional(), topic: z.string().trim().max(120).optional() });
export type BriefingListQuery = z.infer<typeof briefingListQuerySchema>;
export type Briefing = z.infer<typeof briefingSchema>;
export const briefingListResponseSchema = z.object({ items: z.array(briefingSchema), ...listMetadataSchema.shape });
export const briefingUpdateSchema = z.object({ read: z.boolean() }).strict();

export const compensationLocationSchema = z.enum([
  "beijing", "shanghai", "shenzhen", "guangzhou", "hong-kong",
  "singapore", "united-states", "japan", "south-korea", "germany",
  "united-kingdom", "uae", "saudi-arabia", "france"
]);
export type CompensationLocation = z.infer<typeof compensationLocationSchema>;

export const compensationCurrencySchema = z.enum(["CNY", "USD", "HKD", "SGD", "JPY", "EUR", "GBP", "AED", "SAR"]);
export type CompensationCurrency = z.infer<typeof compensationCurrencySchema>;

export const compensationModeSchema = z.enum(["forward", "reverse", "compare"]);
export type CompensationMode = z.infer<typeof compensationModeSchema>;

export const compensationBasisSchema = z.enum(["native", "nominal", "ppp"]);
export type CompensationBasis = z.infer<typeof compensationBasisSchema>;

export const compensationCalculateSchema = z.object({
  mode: compensationModeSchema.default("compare"),
  basis: compensationBasisSchema.default("nominal"),
  locations: z.array(compensationLocationSchema).min(1).max(6),
  currency: compensationCurrencySchema.default("CNY"),
  monthlyGross: z.number().finite().positive().max(10000000),
  annualBonus: z.number().finite().nonnegative().max(100000000).default(0)
}).refine((input) => input.mode !== "compare" || input.locations.length >= 2, {
  message: "对比模式至少选择两个地区",
  path: ["locations"]
});
export type CompensationCalculateInput = z.infer<typeof compensationCalculateSchema>;

export const compensationAssumptionSchema = z.object({
  location: compensationLocationSchema,
  label: z.string().min(1),
  currency: compensationCurrencySchema,
  fxToCny: z.number().positive(),
  taxRate: z.number().min(0).max(1),
  mandatoryRate: z.number().min(0).max(1),
  employerRate: z.number().min(0).max(1),
  pppFactor: z.number().positive(),
  effectiveFrom: z.iso.date(),
  notes: z.array(z.string().min(1))
});
export type CompensationAssumption = z.infer<typeof compensationAssumptionSchema>;

export const compensationAssumptionsResponseSchema = z.object({
  version: z.string().min(1),
  asOfDate: z.iso.date(),
  exchangeRateDate: z.iso.date(),
  assumptions: z.array(compensationAssumptionSchema),
  requestId: z.string().min(1)
});
export type CompensationAssumptionsResponse = z.infer<typeof compensationAssumptionsResponseSchema>;

const compensationWaterfallItemSchema = z.object({
  label: z.string().min(1),
  value: z.number().finite(),
  kind: z.enum(["base", "deduction", "addition", "total"]),
  color: z.string().regex(/^#[0-9a-f]{6}$/i)
});

const compensationTrendPointSchema = z.object({
  month: z.string().min(1),
  gross: z.number().finite(),
  takeHome: z.number().finite(),
  employerCost: z.number().finite()
});

export const compensationResultSchema = z.object({
  location: compensationLocationSchema,
  label: z.string().min(1),
  currency: compensationCurrencySchema,
  grossAnnual: z.number().finite(),
  bonusAnnual: z.number().finite(),
  mandatoryAnnual: z.number().finite(),
  taxAnnual: z.number().finite(),
  takeHomeAnnual: z.number().finite(),
  employerCostAnnual: z.number().finite(),
  effectiveTaxRate: z.number().min(0).max(1),
  takeHomeRate: z.number().min(0).max(1),
  candidateWaterfall: z.array(compensationWaterfallItemSchema),
  employerWaterfall: z.array(compensationWaterfallItemSchema),
  trend: z.array(compensationTrendPointSchema)
});
export type CompensationResult = z.infer<typeof compensationResultSchema>;

export const compensationCalculateResponseSchema = z.object({
  calculationId: z.string().min(1),
  asOfDate: z.iso.date(),
  exchangeRateDate: z.iso.date(),
  assumptionsVersion: z.string().min(1),
  input: compensationCalculateSchema,
  results: z.array(compensationResultSchema),
  requestId: z.string().min(1)
});
export type CompensationCalculateResponse = z.infer<typeof compensationCalculateResponseSchema>;

export const compensationSampleQuerySchema = z.object({
  location: compensationLocationSchema.optional(),
  series: z.enum(["EX", "M", "P", "S", "T", "U", "W"]).optional(),
  levelCode: z.string().trim().min(1).max(20).optional(),
  asOfDate: z.iso.date().optional()
}).strict();
export type CompensationSampleQuery = z.infer<typeof compensationSampleQuerySchema>;

const compensationSampleStructureSchema = z.object({
  base: z.number().nonnegative(), bonus: z.number().nonnegative(), equity: z.number().nonnegative(),
  allowances: z.number().nonnegative(), employerCost: z.number().nonnegative()
});
export const compensationSampleSchema = z.object({
  id: z.string().min(1), company: z.string().min(1), role: z.string().min(1),
  location: compensationLocationSchema, currency: compensationCurrencySchema,
  levelCode: z.string().min(1), series: z.enum(["EX", "M", "P", "S", "T", "U", "W"]),
  annualTotalCash: z.number().nonnegative(), annualEquity: z.number().nonnegative(),
  sampleDate: z.iso.date(), source: z.string().min(1), structure: compensationSampleStructureSchema
});
export type CompensationSample = z.infer<typeof compensationSampleSchema>;
const compensationSampleAggregateSchema = z.object({
  location: compensationLocationSchema, levelCode: z.string().min(1),
  series: z.enum(["EX", "M", "P", "S", "T", "U", "W"]), currency: compensationCurrencySchema,
  sampleCount: z.number().int().nonnegative(), insufficient: z.boolean(),
  p25: z.number().nonnegative(), p50: z.number().nonnegative(), p75: z.number().nonnegative(),
  structure: compensationSampleStructureSchema, sampleDate: z.iso.date(), warning: z.string().nullable()
});
export type CompensationSampleAggregate = z.infer<typeof compensationSampleAggregateSchema>;
export const compensationSamplesResponseSchema = z.object({
  snapshotId: z.string().min(1), asOfDate: z.iso.date(), filters: compensationSampleQuerySchema,
  minimumSampleCount: z.number().int().positive(), aggregates: z.array(compensationSampleAggregateSchema),
  samples: z.array(compensationSampleSchema), requestId: z.string().min(1)
});
export type CompensationSamplesResponse = z.infer<typeof compensationSamplesResponseSchema>;

export const roleCodeSchema = z.enum(["admin", "hr", "manager"]);
export type RoleCode = z.infer<typeof roleCodeSchema>;
export const permissionSchema = z.string().regex(/^[a-z-]+:(read|write)$/);
export const adminUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  email: z.email(),
  role: roleCodeSchema,
  status: z.enum(["active", "disabled"]),
  updatedAt: z.iso.datetime()
});
export type AdminUser = z.infer<typeof adminUserSchema>;
export const roleSchema = z.object({ code: roleCodeSchema, name: z.string(), permissions: z.array(permissionSchema) });
export type AdminRole = z.infer<typeof roleSchema>;
export const dictionarySchema = z.object({
  id: z.string().uuid(), group: z.string().trim().min(1).max(80),
  code: z.string().trim().regex(/^[a-z0-9-]{1,80}$/), label: z.string().trim().min(1).max(120),
  enabled: z.boolean(), updatedAt: z.iso.datetime()
});
export type DictionaryItem = z.infer<typeof dictionarySchema>;
export const auditLogSchema = z.object({
  id: z.string().uuid(), actorName: z.string(), action: z.string(), resource: z.string(),
  resourceId: z.string().nullable(), requestId: z.string(), createdAt: z.iso.datetime()
});
export type AuditLog = z.infer<typeof auditLogSchema>;
export const preferencesSchema = z.object({
  theme: z.enum(["dark", "light"]), density: z.enum(["comfortable", "compact"]),
  notifications: z.boolean(), defaultLocation: compensationLocationSchema,
  defaultCurrency: compensationCurrencySchema
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const meResponseSchema = z.object({ user: adminUserSchema, permissions: z.array(permissionSchema), preferences: preferencesSchema });
export type MeResponse = z.infer<typeof meResponseSchema>;
export const notificationSchema = z.object({
  id: z.string().uuid(), title: z.string().min(1), body: z.string().min(1),
  read: z.boolean(), href: z.string().nullable(), createdAt: z.iso.datetime()
});
export type Notification = z.infer<typeof notificationSchema>;
export const notificationsResponseSchema = z.object({
  items: z.array(notificationSchema), unreadCount: z.number().int().nonnegative(), requestId: z.string().min(1)
});
export type NotificationsResponse = z.infer<typeof notificationsResponseSchema>;
export const searchResultSchema = z.object({
  id: z.string().min(1), kind: z.enum(["talent", "company", "user", "organization", "leader", "research-task", "search-project"]), title: z.string().min(1),
  subtitle: z.string().min(1), href: z.string().min(1)
});
export type SearchResult = z.infer<typeof searchResultSchema>;
export const searchResponseSchema = z.object({ items: z.array(searchResultSchema), requestId: z.string().min(1) });
export type SearchResponse = z.infer<typeof searchResponseSchema>;
export const readinessResponseSchema = z.object({
  status: z.enum(["ready", "unavailable"]), service: z.literal("api"),
  database: z.enum(["up", "down"]), timestamp: z.iso.datetime(), requestId: z.string().min(1)
});
export const storageStatusSchema = z.object({
  provider: z.literal("postgresql"), connected: z.boolean(), lastSyncedAt: z.iso.datetime().nullable(),
  scopes: z.array(z.string().min(1)), requestId: z.string().min(1)
});
export type StorageStatus = z.infer<typeof storageStatusSchema>;

// Stage 09: annual, pre-tax samples. Equity is never part of total cash.
export const benchmarkFilterSchema = z.object({
  company: z.string().trim().max(120).optional(),
  role: z.string().trim().max(120).optional(),
  location: compensationLocationSchema.optional(),
  levelCode: z.string().trim().min(1).max(20).optional(),
  series: z.enum(["EX", "M", "P", "S", "T", "U", "W"]).optional(),
  asOfDate: z.iso.date().default("2026-10-14"),
  metric: z.enum(["totalCash", "base"]).default("totalCash")
}).strict();
export type BenchmarkFilter = z.infer<typeof benchmarkFilterSchema>;
const sampleMoney = z.number().nonnegative().max(1e12);
export const benchmarkSampleSchema = z.object({
  id: z.uuid(), company: z.string(), role: z.string(), location: compensationLocationSchema,
  currency: compensationCurrencySchema, levelCode: z.string(), series: z.string(),
  period: z.literal("annual"), taxBasis: z.literal("gross"), sampleDate: z.iso.date(),
  source: z.string(), sourceUrl: z.url(), license: z.string(),
  base: sampleMoney, bonusTarget: sampleMoney.nullable(), bonusActual: sampleMoney.nullable(),
  equity: sampleMoney.nullable(), allowances: sampleMoney.nullable(),
  statutoryBenefits: sampleMoney.nullable(), extraBenefits: sampleMoney.nullable(),
  employerTaxes: sampleMoney.nullable()
});
export type BenchmarkSample = z.infer<typeof benchmarkSampleSchema>;
export const benchmarkGroupSchema = z.object({
  location: compensationLocationSchema, currency: compensationCurrencySchema,
  levelCode: z.string(), role: z.string(), series: z.string(), sampleCount: z.number().int(),
  eligibleCount: z.number().int(), insufficient: z.boolean(),
  p25: sampleMoney.nullable(), p50: sampleMoney.nullable(), p75: sampleMoney.nullable(),
  sampleDate: z.iso.date(), totalCash: sampleMoney.nullable(), employerCost: sampleMoney.nullable(),
  components: z.array(z.object({ key: z.string(), label: z.string(), amount: sampleMoney.nullable(), share: z.number().nullable() })),
  missing: z.array(z.string())
});
export type BenchmarkGroup = z.infer<typeof benchmarkGroupSchema>;
export const benchmarkStructureSchema = z.object({
  snapshotId: z.uuid(), calculationVersion: z.string(), filters: benchmarkFilterSchema,
  minimumSampleCount: z.number().int(), source: z.literal("seed"),
  groups: z.array(benchmarkGroupSchema), samples: z.array(benchmarkSampleSchema), requestId: z.string()
});
export type BenchmarkStructure = z.infer<typeof benchmarkStructureSchema>;
export const levelMappingReviewSchema = z.object({
  expectedVersion: z.number().int().positive(), status: z.enum(["confirmed", "rejected"]),
  selectedLevel: z.string().trim().min(1).max(20).optional(), note: z.string().trim().min(3).max(1000)
}).strict().refine(value => value.status !== "confirmed" || !!value.selectedLevel, { message: "请选择确认职级", path: ["selectedLevel"] });
export type LevelMappingReview = z.infer<typeof levelMappingReviewSchema>;
export const levelMappingSchema = z.object({
  id: z.uuid(), company: z.string(), role: z.string(), location: compensationLocationSchema,
  series: z.string(), externalLevel: z.string(), candidateLevels: z.array(z.string()),
  confidence: z.number().min(0).max(100), evidenceUrl: z.url().nullable(), rationale: z.string(),
  status: z.enum(["pending", "confirmed", "rejected"]), selectedLevel: z.string().nullable(),
  version: z.number().int(), updatedAt: z.iso.datetime(),
  history: z.array(z.object({ version: z.number().int(), status: z.string(), selectedLevel: z.string().nullable(), note: z.string(), actorId: z.uuid(), createdAt: z.iso.datetime() }))
});
export type LevelMapping = z.infer<typeof levelMappingSchema>;
export const levelMappingsSchema = z.object({ items: z.array(levelMappingSchema), requestId: z.string() });
export const competitivenessInputSchema = z.object({
  role: z.string().trim().min(1).max(120), levelCode: z.string().trim().min(1).max(20),
  metric: z.enum(["totalCash", "base"]).default("totalCash"), asOfDate: z.iso.date().default("2026-10-14"),
  target: z.enum(["p25", "p50", "p75"]).default("p50"),
  plans: z.array(z.object({
    name: z.enum(["A", "B"]), location: compensationLocationSchema,
    annualCash: sampleMoney, employerBudget: sampleMoney.optional()
  }).strict()).min(2).max(8)
}).strict().refine(value => new Set(value.plans.map(p => `${p.name}:${p.location}`)).size === value.plans.length, { message: "方案与地区不能重复" });
export type CompetitivenessInput = z.infer<typeof competitivenessInputSchema>;
export const competitivenessSchema = z.object({
  snapshotId: z.uuid(), calculationVersion: z.string(), createdAt: z.iso.datetime(), input: competitivenessInputSchema,
  assumptionsVersion: z.string(), exchangeRateDate: z.iso.date(), pppYear: z.number().int(),
  macroSource: z.literal("seed"), macroStale: z.boolean(), minimumSampleCount: z.number().int(),
  results: z.array(z.object({
    name: z.enum(["A", "B"]), location: compensationLocationSchema, label: z.string(), currency: compensationCurrencySchema,
    annualCash: sampleMoney, nominalCny: sampleMoney, purchasingPowerCny: sampleMoney,
    takeHome: sampleMoney, employerCost: sampleMoney, budgetCash: sampleMoney.nullable(),
    sampleCount: z.number().int(), p25: sampleMoney.nullable(), p50: sampleMoney.nullable(), p75: sampleMoney.nullable(),
    position: z.enum(["below-p25", "p25-p50", "p50-p75", "above-p75"]).nullable(),
    targetGap: z.number().nullable(), warnings: z.array(z.string()),
    trend: z.array(z.object({ month: z.number().int(), cash: sampleMoney, takeHome: sampleMoney, employerCost: sampleMoney }))
  })), requestId: z.string()
});
export type CompetitivenessReport = z.infer<typeof competitivenessSchema>;
export const adminListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["active", "disabled"]).optional(),
  role: roleCodeSchema.optional(), group: z.string().trim().max(80).optional(),
  action: z.string().trim().max(80).optional()
});
export const adminListResponseSchema = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item), ...listMetadataSchema.shape });
export const adminUserCreateSchema = adminUserSchema.pick({ name: true, email: true, role: true }).strict();
export const adminUserUpdateSchema = adminUserSchema.pick({ role: true, status: true }).partial().strict().refine((value) => Object.keys(value).length > 0);
export const dictionaryCreateSchema = dictionarySchema.pick({ group: true, code: true, label: true }).strict();
export const dictionaryUpdateSchema = dictionarySchema.pick({ label: true, enabled: true }).partial().strict().refine((value) => Object.keys(value).length > 0);
export const preferencesUpdateSchema = preferencesSchema.partial().strict().refine((value) => Object.keys(value).length > 0);

// Stage 10: AI suggestions remain reviewable proposals until a human confirms them.
export const aiTaskStatusSchema = z.enum(["queued", "running", "succeeded", "failed", "cancelled"]);
export type AiTaskStatus = z.infer<typeof aiTaskStatusSchema>;
export const aiTaskKindSchema = z.enum(["organization-analysis", "intelligence-extraction"]);
export type AiTaskKind = z.infer<typeof aiTaskKindSchema>;
export const aiTaskSchema = z.object({
  id: z.uuid(),
  kind: aiTaskKindSchema,
  status: aiTaskStatusSchema,
  inputRef: z.string().min(1),
  model: z.string().min(1),
  attempt: z.number().int().positive(),
  maxAttempts: z.number().int().positive(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.iso.datetime(),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable()
});
export type AiTask = z.infer<typeof aiTaskSchema>;
export const aiTaskListResponseSchema = z.object({
  items: z.array(aiTaskSchema),
  total: z.number().int().nonnegative(),
  requestId: z.string().min(1)
});
export type AiTaskListResponse = z.infer<typeof aiTaskListResponseSchema>;

export const aiReviewStatusSchema = z.enum(["pending", "accepted", "edited", "rejected"]);
export type AiReviewStatus = z.infer<typeof aiReviewStatusSchema>;
export const aiReviewSchema = z.object({
  id: z.uuid(),
  taskId: z.uuid(),
  entityType: z.enum(["organization-unit", "leader-profile", "intelligence-item"]),
  entityId: z.string().min(1),
  status: aiReviewStatusSchema,
  proposed: z.record(z.string(), z.unknown()),
  evidenceIds: z.array(z.uuid()),
  reviewerId: z.uuid().nullable(),
  reviewNote: z.string().nullable(),
  reviewedAt: z.iso.datetime().nullable(),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime()
});
export type AiReview = z.infer<typeof aiReviewSchema>;
export const aiReviewDecisionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  status: z.enum(["accepted", "edited", "rejected"]),
  edited: z.record(z.string(), z.unknown()).optional(),
  note: z.string().trim().min(3).max(1000)
}).strict().refine(value => value.status !== "edited" || !!value.edited, {
  message: "编辑审核必须提交修改后的内容",
  path: ["edited"]
});
export type AiReviewDecision = z.infer<typeof aiReviewDecisionSchema>;
export const aiReviewListResponseSchema = z.object({
  items: z.array(aiReviewSchema),
  requestId: z.string().min(1)
});
export type AiReviewListResponse = z.infer<typeof aiReviewListResponseSchema>;

export const macroMetricSchema = z.enum(["exchange-rate", "ppp"]);
export type MacroMetric = z.infer<typeof macroMetricSchema>;
export const macroDataStatusSchema = z.enum(["draft", "published", "superseded", "rejected"]);
export type MacroDataStatus = z.infer<typeof macroDataStatusSchema>;
export const macroObservationSchema = z.object({
  key: z.string().min(1),
  value: z.number().finite().positive(),
  unit: z.string().min(1),
  observedAt: z.iso.date()
});
export type MacroObservation = z.infer<typeof macroObservationSchema>;
export const macroSnapshotSchema = z.object({
  id: z.uuid(),
  metric: macroMetricSchema,
  source: z.string().min(1),
  sourceUrl: z.url(),
  license: z.string().min(1),
  version: z.string().min(1),
  publishedAt: z.iso.datetime(),
  validFrom: z.iso.date(),
  validUntil: z.iso.date(),
  status: macroDataStatusSchema,
  stale: z.boolean(),
  observations: z.array(macroObservationSchema).min(1),
  checksum: z.string().min(1),
  supersedesId: z.uuid().nullable(),
  createdAt: z.iso.datetime()
});
export type MacroSnapshot = z.infer<typeof macroSnapshotSchema>;
export const macroSnapshotListResponseSchema = z.object({
  items: z.array(macroSnapshotSchema),
  activeVersion: z.string().nullable(),
  requestId: z.string().min(1)
});
export type MacroSnapshotListResponse = z.infer<typeof macroSnapshotListResponseSchema>;
export const macroSnapshotPublishSchema = z.object({
  expectedVersion: z.string().min(1),
  note: z.string().trim().min(3).max(1000)
}).strict();
export type MacroSnapshotPublish = z.infer<typeof macroSnapshotPublishSchema>;
