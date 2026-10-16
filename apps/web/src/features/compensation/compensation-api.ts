import { compensationAssumptionsResponseSchema, compensationCalculateResponseSchema } from "@hr-console/contracts";
import type {
  CompensationAssumptionsResponse,
  CompensationCalculateInput,
  CompensationCalculateResponse
} from "@hr-console/contracts";

const fallbackAssumptions: CompensationAssumptionsResponse = {
  version: "comp-2026.09.29-v1",
  asOfDate: "2026-09-29",
  exchangeRateDate: "2026-09-29",
  requestId: "fallback",
  assumptions: [
    { location: "beijing", label: "北京", currency: "CNY", fxToCny: 1, taxRate: 0.145, mandatoryRate: 0.105, employerRate: 0.265, pppFactor: 1, effectiveFrom: "2026-09-29", notes: ["社保与公积金按月薪基数估算", "未计入专项附加扣除"] },
    { location: "shanghai", label: "上海", currency: "CNY", fxToCny: 1, taxRate: 0.14, mandatoryRate: 0.105, employerRate: 0.255, pppFactor: 0.98, effectiveFrom: "2026-09-29", notes: ["社保与公积金按月薪基数估算", "未计入专项附加扣除"] },
    { location: "shenzhen", label: "深圳", currency: "CNY", fxToCny: 1, taxRate: 0.125, mandatoryRate: 0.095, employerRate: 0.235, pppFactor: 0.94, effectiveFrom: "2026-09-29", notes: ["社保与公积金按月薪基数估算", "未计入专项附加扣除"] },
    { location: "guangzhou", label: "广州", currency: "CNY", fxToCny: 1, taxRate: 0.12, mandatoryRate: 0.09, employerRate: 0.225, pppFactor: 0.9, effectiveFrom: "2026-09-29", notes: ["社保与公积金按月薪基数估算", "未计入专项附加扣除"] },
    { location: "hong-kong", label: "中国香港", currency: "HKD", fxToCny: 0.92, taxRate: 0.095, mandatoryRate: 0.05, employerRate: 0.05, pppFactor: 0.88, effectiveFrom: "2026-09-29", notes: ["MPF 以月薪上限口径估算", "采用薪俸税近似有效税率"] },
    { location: "singapore", label: "新加坡", currency: "SGD", fxToCny: 5.35, taxRate: 0.115, mandatoryRate: 0.12, employerRate: 0.17, pppFactor: 0.86, effectiveFrom: "2026-09-29", notes: ["CPF 按综合比例估算", "未计入个人税务减免"] },
    { location: "united-states", label: "美国", currency: "USD", fxToCny: 7.12, taxRate: 0.28, mandatoryRate: 0.0765, employerRate: 0.0765, pppFactor: 0.78, effectiveFrom: "2026-09-29", notes: ["FICA 与联邦/州税采用组合估算", "未计入州别差异"] }
  ]
};

export async function getCompensationAssumptions(signal?: AbortSignal): Promise<{ data: CompensationAssumptionsResponse; fallback: boolean }> {
  try {
    const response = await fetch("/api/v1/compensation/assumptions", signal ? { signal } : {});
    if (!response.ok) throw new Error("assumptions request failed");
    return { data: compensationAssumptionsResponseSchema.parse(await response.json()), fallback: false };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { data: structuredClone(fallbackAssumptions), fallback: true };
  }
}

export async function calculateCompensation(input: CompensationCalculateInput, signal?: AbortSignal): Promise<CompensationCalculateResponse> {
  const response = await fetch("/api/v1/compensation/calculate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    ...(signal ? { signal } : {})
  });
  const body: unknown = await response.json();
  if (!response.ok) throw new Error("薪酬计算失败");
  return compensationCalculateResponseSchema.parse(body);
}
