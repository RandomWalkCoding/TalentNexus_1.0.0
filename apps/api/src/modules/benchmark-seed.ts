import type { BenchmarkSample, CompensationLocation } from "@hr-console/contracts";
import type { PrismaClient } from "../generated/client/index.js";
import { locations } from "./compensation.js";

export const benchmarkSamples: BenchmarkSample[] = ([
  ["beijing", 420000], ["beijing", 480000], ["beijing", 540000],
  ["shanghai", 432000], ["shanghai", 492000], ["shanghai", 552000],
  ["singapore", 108000], ["singapore", 126000], ["singapore", 144000],
  ["united-states", 156000], ["united-states", 180000], ["united-states", 204000],
  ["shenzhen", 396000]
] as const).map(([location, base], index) => ({
  id: `29000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  company: ["Northstar AI", "Harbor Robotics", "Fieldnote Health"][index % 3]!,
  role: "产品经理", location: location as CompensationLocation, currency: locations[location].currency,
  levelCode: "P4", series: "P", period: "annual", taxBasis: "gross", sampleDate: "2026-10-10",
  source: "虚构薪酬样本 · 2026 Q4", sourceUrl: "https://survey.example.com/2026-q4",
  license: "仅用于本地演示；非真实市场调研", base,
  bonusTarget: base * .2, bonusActual: base * .15, equity: index === 12 ? null : base * .25,
  allowances: base * .04, statutoryBenefits: base * .12, extraBenefits: base * .02, employerTaxes: base * .08
}));

export async function seedBenchmarks(db: PrismaClient) {
  for (const sample of benchmarkSamples) {
    const { period: _period, taxBasis: _taxBasis, ...data } = sample;
    void _period; void _taxBasis;
    await db.compensationSample.upsert({ where: { id: sample.id }, create: data, update: {} });
  }
  for (const [index, company] of ["Northstar AI", "Harbor Robotics", "Fieldnote Health"].entries()) {
    const data = {
      id: `29100000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      company, role: "产品经理", location: ["beijing", "shenzhen", "singapore"][index]!,
      series: "P", externalLevel: `Product ${index + 3}`, candidateLevels: ["P3", "P4"], confidence: 82 - index * 8,
      evidenceUrl: index === 2 ? null : "https://jobs.example.com/product-scope",
      rationale: "演示来源：独立负责产品线，跨团队协作；团队规模 4–8 人，向产品负责人汇报。职责与内部 P3/P4 重叠，需人工核验。"
    };
    await db.levelBenchmark.upsert({ where: { id: data.id }, create: data, update: {} });
  }
}
