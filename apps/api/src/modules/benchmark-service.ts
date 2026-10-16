import { randomUUID } from "node:crypto";
import {
  benchmarkStructureSchema, competitivenessSchema,
  type BenchmarkFilter, type BenchmarkSample, type BenchmarkGroup,
  type CompetitivenessInput, type CompensationAssumption, type CompensationLocation
} from "@hr-console/contracts";

export const BENCHMARK_VERSION = "benchmark-2026.10-v1";
export const MINIMUM_SAMPLES = 3;
export const MACRO_DATE = "2026-09-29";
const round = (value: number) => Math.round(value * 100) / 100;

export function quantile(values: number[], rank: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) throw new Error("Empty quantile");
  const position = (sorted.length - 1) * rank;
  const lower = Math.floor(position);
  return round(sorted[lower]! + (sorted[Math.ceil(position)]! - sorted[lower]!) * (position - lower));
}

const components = [
  ["base", "基本工资"], ["bonusActual", "实际奖金"], ["allowances", "现金津贴"],
  ["equity", "股权年化估值"], ["statutoryBenefits", "法定福利"],
  ["extraBenefits", "额外福利"], ["employerTaxes", "雇主税费"]
] as const;
const cash = (sample: BenchmarkSample) => sample.bonusActual === null || sample.allowances === null
  ? null : round(sample.base + sample.bonusActual + sample.allowances);

export function aggregateSamples(samples: BenchmarkSample[], metric: BenchmarkFilter["metric"]): BenchmarkGroup[] {
  const groups = new Map<string, BenchmarkSample[]>();
  for (const sample of samples) {
    const key = `${sample.location}:${sample.currency}:${sample.levelCode}:${sample.series}:${sample.role}`;
    const group = groups.get(key) ?? [];
    group.push(sample);
    groups.set(key, group);
  }
  return [...groups.values()].map(group => {
    const first = group[0]!;
    const values = group.map(s => metric === "base" ? s.base : cash(s)).filter((v): v is number => v !== null);
    const insufficient = values.length < MINIMUM_SAMPLES;
    const average = (key: typeof components[number][0]) => group.some(s => s[key] === null)
      ? null : round(group.reduce((sum, s) => sum + (s[key] ?? 0), 0) / group.length);
    const totalCash = group.some(s => cash(s) === null) ? null : round(group.reduce((sum, s) => sum + cash(s)!, 0) / group.length);
    const parts = components.map(([key, label]) => ({ key, label, amount: average(key) }));
    const employerCost = parts.some(p => p.amount === null) ? null : round(parts.reduce((sum, p) => sum + p.amount!, 0));
    return {
      location: first.location, currency: first.currency, levelCode: first.levelCode, series: first.series, role: first.role,
      sampleCount: group.length, eligibleCount: values.length, insufficient,
      p25: insufficient ? null : quantile(values, .25), p50: insufficient ? null : quantile(values, .5), p75: insufficient ? null : quantile(values, .75),
      sampleDate: group.map(s => s.sampleDate).sort().at(-1)!, totalCash, employerCost,
      components: parts.map(p => ({ ...p, share: employerCost && p.amount !== null ? round(p.amount / employerCost * 100) : null })),
      missing: parts.filter(p => p.amount === null).map(p => p.label)
    };
  });
}

export function buildStructure(samples: BenchmarkSample[], filters: BenchmarkFilter, requestId: string) {
  return benchmarkStructureSchema.parse({ snapshotId: randomUUID(), calculationVersion: BENCHMARK_VERSION, filters,
    minimumSampleCount: MINIMUM_SAMPLES, source: "seed", samples, groups: aggregateSamples(samples, filters.metric), requestId });
}

export function comparePlans(input: CompetitivenessInput, samples: BenchmarkSample[], assumptions: Record<CompensationLocation, CompensationAssumption>, requestId: string, now = new Date()) {
  const macroStale = now.getTime() - Date.parse(MACRO_DATE) > 30 * 86400000;
  const groups = aggregateSamples(samples, input.metric);
  return competitivenessSchema.parse({
    snapshotId: randomUUID(), calculationVersion: BENCHMARK_VERSION, createdAt: now.toISOString(), input,
    assumptionsVersion: "comp-2026.09.29-v1", exchangeRateDate: MACRO_DATE, pppYear: 2026,
    macroSource: "seed", macroStale, minimumSampleCount: MINIMUM_SAMPLES,
    results: input.plans.map(plan => {
      const assumption = assumptions[plan.location];
      const group = groups.find(g => g.location === plan.location && g.currency === assumption.currency && g.role === input.role && g.levelCode === input.levelCode);
      const annualCash = plan.annualCash;
      const mandatory = annualCash * assumption.mandatoryRate;
      const takeHome = round((annualCash - mandatory) * (1 - assumption.taxRate));
      const employerCost = round(annualCash * (1 + assumption.employerRate));
      const valid = !!group && !group.insufficient && !macroStale;
      const p25 = valid ? group.p25! : null, p50 = valid ? group.p50! : null, p75 = valid ? group.p75! : null;
      const warnings = ["税费为版本化估算；股权和额外福利未纳入方案现金。", "样本、汇率与 PPP 均为演示数据，PPP 金额仅用于购买力比较。"];
      if (!group || group.insufficient) warnings.push("数据不足：有效样本未达到最低门槛，暂不判断竞争力。");
      if (macroStale) warnings.push("宏观数据已过期，暂不判断竞争力。");
      return {
        name: plan.name, location: plan.location, label: assumption.label, currency: assumption.currency,
        annualCash, nominalCny: round(annualCash * assumption.fxToCny),
        purchasingPowerCny: round(annualCash * assumption.fxToCny * assumption.pppFactor),
        takeHome, employerCost, budgetCash: plan.employerBudget === undefined ? null : round(plan.employerBudget / (1 + assumption.employerRate)),
        sampleCount: group?.eligibleCount ?? 0, p25, p50, p75,
        position: valid ? annualCash < p25! ? "below-p25" : annualCash < p50! ? "p25-p50" : annualCash < p75! ? "p50-p75" : "above-p75" : null,
        targetGap: valid ? round(group[input.target]! - annualCash) : null, warnings,
        trend: Array.from({ length: 12 }, (_, i) => {
          // Cumulative equal monthly payments, with the final point exactly matching the card.
          const fraction = (i + 1) / 12;
          return { month: i + 1, cash: round(annualCash * fraction), takeHome: round(takeHome * fraction), employerCost: round(employerCost * fraction) };
        })
      };
    }), requestId
  });
}
