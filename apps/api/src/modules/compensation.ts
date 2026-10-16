import {
  compensationAssumptionsResponseSchema,
  compensationCalculateSchema,
  compensationCalculateResponseSchema,
  compensationSampleQuerySchema,
  compensationSamplesResponseSchema,
  type CompensationAssumption,
  type CompensationCalculateInput,
  type CompensationCalculateResponse,
  type CompensationSample,
  type CompensationLocation,
  type CompensationResult
} from "@hr-console/contracts";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../generated/client/index.js";

const ASSUMPTIONS_VERSION = "comp-2026.09.29-v1";
const AS_OF_DATE = "2026-09-29";
const EXCHANGE_RATE_DATE = "2026-09-29";
const SAMPLE_SNAPSHOT_ID = "comp-samples-2026-q3-v1";
const SAMPLE_MINIMUM = 3;

export const locations: Record<CompensationLocation, CompensationAssumption> = {
  beijing: { location: "beijing", label: "北京", currency: "CNY", fxToCny: 1, taxRate: 0.145, mandatoryRate: 0.105, employerRate: 0.265, pppFactor: 1, effectiveFrom: AS_OF_DATE, notes: ["社保与公积金按月薪基数估算", "未计入专项附加扣除"] },
  shanghai: { location: "shanghai", label: "上海", currency: "CNY", fxToCny: 1, taxRate: 0.14, mandatoryRate: 0.105, employerRate: 0.255, pppFactor: 0.98, effectiveFrom: AS_OF_DATE, notes: ["社保与公积金按月薪基数估算", "未计入专项附加扣除"] },
  shenzhen: { location: "shenzhen", label: "深圳", currency: "CNY", fxToCny: 1, taxRate: 0.125, mandatoryRate: 0.095, employerRate: 0.235, pppFactor: 0.94, effectiveFrom: AS_OF_DATE, notes: ["社保与公积金按月薪基数估算", "未计入专项附加扣除"] },
  guangzhou: { location: "guangzhou", label: "广州", currency: "CNY", fxToCny: 1, taxRate: 0.12, mandatoryRate: 0.09, employerRate: 0.225, pppFactor: 0.9, effectiveFrom: AS_OF_DATE, notes: ["社保与公积金按月薪基数估算", "未计入专项附加扣除"] },
  "hong-kong": { location: "hong-kong", label: "中国香港", currency: "HKD", fxToCny: 0.92, taxRate: 0.095, mandatoryRate: 0.05, employerRate: 0.05, pppFactor: 0.88, effectiveFrom: AS_OF_DATE, notes: ["MPF 以月薪上限口径估算", "采用薪俸税近似有效税率"] },
  singapore: { location: "singapore", label: "新加坡", currency: "SGD", fxToCny: 5.35, taxRate: 0.115, mandatoryRate: 0.12, employerRate: 0.17, pppFactor: 0.86, effectiveFrom: AS_OF_DATE, notes: ["CPF 按综合比例估算", "未计入个人税务减免"] },
  "united-states": { location: "united-states", label: "美国", currency: "USD", fxToCny: 7.12, taxRate: 0.28, mandatoryRate: 0.0765, employerRate: 0.0765, pppFactor: 0.78, effectiveFrom: AS_OF_DATE, notes: ["FICA 与联邦/州税采用组合估算", "未计入州别差异"] },
  japan: { location: "japan", label: "日本", currency: "JPY", fxToCny: 0.048, taxRate: 0.19, mandatoryRate: 0.15, employerRate: 0.16, pppFactor: 0.84, effectiveFrom: AS_OF_DATE, notes: ["社会保险按综合比例估算", "未计入扶养扣除"] },
  "south-korea": { location: "south-korea", label: "韩国", currency: "USD", fxToCny: 0.0053, taxRate: 0.16, mandatoryRate: 0.09, employerRate: 0.095, pppFactor: 0.82, effectiveFrom: AS_OF_DATE, notes: ["四大保险按综合比例估算", "税率使用中位薪资近似"] },
  germany: { location: "germany", label: "德国", currency: "EUR", fxToCny: 8.02, taxRate: 0.31, mandatoryRate: 0.205, employerRate: 0.205, pppFactor: 0.8, effectiveFrom: AS_OF_DATE, notes: ["社会保险按雇员侧综合比例估算", "未计入教会税和家庭因素"] },
  "united-kingdom": { location: "united-kingdom", label: "英国", currency: "GBP", fxToCny: 9.55, taxRate: 0.25, mandatoryRate: 0.12, employerRate: 0.138, pppFactor: 0.79, effectiveFrom: AS_OF_DATE, notes: ["National Insurance 按中位税率估算", "未计入 pension salary sacrifice"] },
  uae: { location: "uae", label: "阿联酋", currency: "AED", fxToCny: 1.94, taxRate: 0, mandatoryRate: 0.05, employerRate: 0.12, pppFactor: 0.74, effectiveFrom: AS_OF_DATE, notes: ["不计个人所得税", "福利成本采用地区平均比例"] },
  "saudi-arabia": { location: "saudi-arabia", label: "沙特", currency: "SAR", fxToCny: 1.9, taxRate: 0, mandatoryRate: 0.1, employerRate: 0.12, pppFactor: 0.75, effectiveFrom: AS_OF_DATE, notes: ["不计个人所得税", "社保成本采用本地雇佣近似"] },
  france: { location: "france", label: "法国", currency: "EUR", fxToCny: 8.02, taxRate: 0.27, mandatoryRate: 0.22, employerRate: 0.42, pppFactor: 0.81, effectiveFrom: AS_OF_DATE, notes: ["社会分摊采用综合比例估算", "未计入家庭税率差异"] }
};

const sampleSeed: CompensationSample[] = [
  ["Alibaba", "产品经理", "beijing", "P4", "P", 420000, 60000, 100000, 18000],
  ["ByteDance", "产品经理", "beijing", "P4", "P", 468000, 72000, 120000, 20000],
  ["Tencent", "产品经理", "shanghai", "P4", "P", 396000, 54000, 90000, 16000],
  ["Northstar AI", "产品负责人", "united-states", "P4", "P", 168000, 28000, 42000, 12000],
  ["Google", "软件工程师", "united-states", "T4", "T", 190000, 30000, 70000, 15000],
  ["Microsoft", "软件工程师", "united-states", "T4", "T", 178000, 26000, 60000, 14000],
  ["Harbor Robotics", "软件工程师", "shenzhen", "T4", "T", 360000, 48000, 72000, 14000],
  ["Fieldnote Health", "软件工程师", "singapore", "T4", "T", 118000, 18000, 28000, 10000]
].map(([company, role, location, levelCode, series, base, bonus, equity, allowances], index) => {
  const annualTotalCash = Number(base) + Number(bonus) + Number(allowances);
  const assumption = locations[location as CompensationLocation];
  return {
    id: `sample-${index + 1}`, company: String(company), role: String(role), location: location as CompensationLocation,
    currency: assumption.currency, levelCode: String(levelCode), series: series as CompensationSample["series"],
    annualTotalCash, annualEquity: Number(equity), sampleDate: "2026-09-29", source: "2026 Q3 薪酬调研",
    structure: { base: Number(base), bonus: Number(bonus), equity: Number(equity), allowances: Number(allowances), employerCost: Math.round((annualTotalCash + Number(equity)) * (1 + assumption.employerRate)) }
  } satisfies CompensationSample;
});

function percentile(values: number[], rank: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * rank;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return Math.round(sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower));
}

function buildSampleResponse(query: ReturnType<typeof compensationSampleQuerySchema.parse>, requestId: string) {
  const samples = sampleSeed.filter((sample) => (!query.location || sample.location === query.location) && (!query.series || sample.series === query.series) && (!query.levelCode || sample.levelCode === query.levelCode) && (!query.asOfDate || sample.sampleDate <= query.asOfDate));
  const groups = new Map<string, CompensationSample[]>();
  for (const sample of samples) {
    const key = `${sample.location}:${sample.levelCode}:${sample.series}`;
    groups.set(key, [...(groups.get(key) ?? []), sample]);
  }
  const aggregates = [...groups.values()].map((group) => {
    const first = group[0]!;
    const average = (key: keyof CompensationSample["structure"]) => Math.round(group.reduce((sum, sample) => sum + sample.structure[key], 0) / group.length);
    const insufficient = group.length < SAMPLE_MINIMUM;
    return { location: first.location, levelCode: first.levelCode, series: first.series, currency: first.currency, sampleCount: group.length, insufficient, p25: percentile(group.map((sample) => sample.annualTotalCash), 0.25), p50: percentile(group.map((sample) => sample.annualTotalCash), 0.5), p75: percentile(group.map((sample) => sample.annualTotalCash), 0.75), structure: { base: average("base"), bonus: average("bonus"), equity: average("equity"), allowances: average("allowances"), employerCost: average("employerCost") }, sampleDate: first.sampleDate, warning: insufficient ? `样本量不足（当前 ${group.length}，建议至少 ${SAMPLE_MINIMUM} 个）` : null };
  });
  return compensationSamplesResponseSchema.parse({ snapshotId: SAMPLE_SNAPSHOT_ID, asOfDate: AS_OF_DATE, filters: query, minimumSampleCount: SAMPLE_MINIMUM, aggregates, samples, requestId });
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function currencyRate(assumption: CompensationAssumption, currency: CompensationCalculateInput["currency"]): number {
  const target = {
    CNY: 1, USD: 7.12, HKD: 0.92, SGD: 5.35, JPY: 0.048, EUR: 8.02, GBP: 9.55, AED: 1.94, SAR: 1.9
  }[currency];
  return assumption.fxToCny / target;
}

function waterfall(label: string, value: number, kind: "base" | "deduction" | "addition" | "total", color: string) {
  return { label, value: roundMoney(value), kind, color };
}

function calculateResult(input: CompensationCalculateInput, location: CompensationLocation, assumption: CompensationAssumption): CompensationResult {
  const rate = currencyRate(assumption, input.currency);
  const annualInput = input.monthlyGross * 12 + input.annualBonus;
  const grossAnnual = input.mode === "reverse"
    ? annualInput / Math.max(0.01, 1 - assumption.mandatoryRate - assumption.taxRate) * rate
    : annualInput * rate;
  const mandatoryAnnual = grossAnnual * assumption.mandatoryRate;
  const taxAnnual = Math.max(0, grossAnnual - mandatoryAnnual) * assumption.taxRate;
  const takeHomeAnnual = grossAnnual - mandatoryAnnual - taxAnnual;
  const employerCostAnnual = grossAnnual * (1 + assumption.employerRate);
  const factor = input.basis === "ppp" ? assumption.pppFactor : 1;
  const display = (value: number) => value * factor;
  const trend = Array.from({ length: 12 }, (_, index) => {
    const month = `${String(index + 1).padStart(2, "0")}月`;
    const monthGross = grossAnnual / 12 + (index === 11 ? input.annualBonus : 0);
    return { month, gross: roundMoney(display(monthGross)), takeHome: roundMoney(display(monthGross * (1 - assumption.mandatoryRate - assumption.taxRate))), employerCost: roundMoney(display(monthGross * (1 + assumption.employerRate))) };
  });
  return {
    location,
    label: assumption.label,
    currency: input.currency,
    grossAnnual: roundMoney(display(grossAnnual)),
    bonusAnnual: roundMoney(display(input.annualBonus * rate)),
    mandatoryAnnual: roundMoney(display(mandatoryAnnual)),
    taxAnnual: roundMoney(display(taxAnnual)),
    takeHomeAnnual: roundMoney(display(takeHomeAnnual)),
    employerCostAnnual: roundMoney(display(employerCostAnnual)),
    effectiveTaxRate: roundMoney(taxAnnual / grossAnnual),
    takeHomeRate: roundMoney(takeHomeAnnual / grossAnnual),
    candidateWaterfall: [
      waterfall("税前名义", display(grossAnnual), "base", "#397ea7"),
      waterfall("五险一金 / MPF", -display(mandatoryAnnual), "deduction", "#c57b45"),
      waterfall("个人所得税", -display(taxAnnual), "deduction", "#c15d6f"),
      waterfall("税后到手", display(takeHomeAnnual), "total", "#3b9b82")
    ],
    employerWaterfall: [
      waterfall("税前名义", display(grossAnnual), "base", "#397ea7"),
      waterfall("企业法定成本", display(grossAnnual * assumption.employerRate), "addition", "#8b6ec1"),
      waterfall("企业总成本", display(employerCostAnnual), "total", "#3b9b82")
    ],
    trend
  };
}

export function calculateCompensation(input: CompensationCalculateInput, requestId: string, assumptions: Record<CompensationLocation, CompensationAssumption> = locations): CompensationCalculateResponse {
  const parsed = compensationCalculateSchema.parse(input);
  const results = parsed.locations.map((location) => calculateResult(parsed, location, assumptions[location]));
  return compensationCalculateResponseSchema.parse({
    calculationId: `calc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    asOfDate: AS_OF_DATE,
    exchangeRateDate: EXCHANGE_RATE_DATE,
    assumptionsVersion: ASSUMPTIONS_VERSION,
    input: parsed,
    results,
    requestId
  });
}

function toAssumption(record: { location: string; label: string; currency: string; fxToCny: unknown; taxRate: unknown; mandatoryRate: unknown; employerRate: unknown; pppFactor: unknown; effectiveFrom: string; notes: string[] }): CompensationAssumption {
  return {
    location: compensationAssumptionsResponseSchema.shape.assumptions.element.shape.location.parse(record.location),
    label: record.label,
    currency: record.currency as CompensationAssumption["currency"],
    fxToCny: Number(record.fxToCny),
    taxRate: Number(record.taxRate),
    mandatoryRate: Number(record.mandatoryRate),
    employerRate: Number(record.employerRate),
    pppFactor: Number(record.pppFactor),
    effectiveFrom: record.effectiveFrom,
    notes: record.notes
  };
}

export function compensationRoutes(app: FastifyInstance, prisma?: PrismaClient): void {
  let cached: Record<CompensationLocation, CompensationAssumption> | null = null;
  let expiresAt = 0;
  let pending: Promise<Record<CompensationLocation, CompensationAssumption>> | null = null;
  async function fetchAssumptions(): Promise<Record<CompensationLocation, CompensationAssumption>> {
    if (!prisma) return locations;
    try {
      const rows = await prisma.compensationAssumption.findMany();
      if (!rows.length) return locations;
      return rows.reduce((result, row) => {
        result[row.location as CompensationLocation] = toAssumption(row);
        return result;
      }, { ...locations });
    } catch {
      return locations;
    }
  }

  async function readAssumptions(): Promise<Record<CompensationLocation, CompensationAssumption>> {
    if (cached && Date.now() < expiresAt) return cached;
    if (!pending) {
      pending = fetchAssumptions()
        .then((result) => {
          cached = result;
          expiresAt = Date.now() + 60000;
          return result;
        })
        .finally(() => {
          pending = null;
        });
    }
    return pending;
  }

  app.get("/api/v1/compensation/assumptions", async (request) => {
    const assumptions = await readAssumptions();
    return compensationAssumptionsResponseSchema.parse({
      version: ASSUMPTIONS_VERSION,
      asOfDate: AS_OF_DATE,
      exchangeRateDate: EXCHANGE_RATE_DATE,
      assumptions: Object.values(assumptions),
      requestId: request.id
    });
  });

  app.get("/api/v1/compensation/samples", async (request, reply) => {
    const parsed = compensationSampleQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "薪酬样本筛选条件无效", details: parsed.error.issues, requestId: request.id } });
    return buildSampleResponse(parsed.data, request.id);
  });

  app.post("/api/v1/compensation/calculate", async (request, reply) => {
    const parsed = compensationCalculateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "薪酬参数无效", details: parsed.error.issues, requestId: request.id } });
    return calculateCompensation(parsed.data, request.id, await readAssumptions());
  });
}

export async function seedCompensationAssumptions(prisma: PrismaClient): Promise<void> {
  await Promise.all(Object.values(locations).map((assumption) => prisma.compensationAssumption.upsert({
    where: { location: assumption.location },
    create: {
      ...assumption,
      fxToCny: assumption.fxToCny,
      taxRate: assumption.taxRate,
      mandatoryRate: assumption.mandatoryRate,
      employerRate: assumption.employerRate,
      pppFactor: assumption.pppFactor,
      version: ASSUMPTIONS_VERSION
    },
    update: {
      label: assumption.label,
      currency: assumption.currency,
      fxToCny: assumption.fxToCny,
      taxRate: assumption.taxRate,
      mandatoryRate: assumption.mandatoryRate,
      employerRate: assumption.employerRate,
      pppFactor: assumption.pppFactor,
      effectiveFrom: assumption.effectiveFrom,
      notes: assumption.notes,
      version: ASSUMPTIONS_VERSION
    }
  })));
}
