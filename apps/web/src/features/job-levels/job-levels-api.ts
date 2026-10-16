import { jobLevelsResponseSchema } from "@hr-console/contracts";
import type { JobLevelsQuery, JobLevelsResponse } from "@hr-console/contracts";

const fallback: JobLevelsResponse = {
  surveyGrades: Array.from({ length: 24 }, (_, index) => index + 2),
  series: [
    { code: "EX", name: "Executive", nameZh: "高管序列", color: "#ed8b2f", description: "制定公司的战略方向，拥有全局决策与组织管理责任。", roles: ["总经理", "事业部负责人", "VP"] },
    { code: "M", name: "Management", nameZh: "管理序列", color: "#1ca094", description: "通过管理他人的工作来达成目标，承担团队与业务结果。", roles: ["主管", "经理", "总监"] },
    { code: "P", name: "Professional", nameZh: "专业序列", color: "#e42b7b", description: "通过专业知识和持续交付创造业务价值。", roles: ["产品", "设计", "职能专家"] },
    { code: "S", name: "Sales", nameZh: "客户管理/销售序列", color: "#bf1984", description: "通过客户经营、销售拓展与商业结果创造价值。", roles: ["销售", "客户成功", "解决方案"] },
    { code: "T", name: "Technology", nameZh: "技术支持序列", color: "#7138a6", description: "以技术能力解决复杂问题，持续提升产品与系统质量。", roles: ["研发", "数据", "技术支持"] },
    { code: "U", name: "Business Support", nameZh: "业务支持序列", color: "#482495", description: "为业务提供专业支持与运营保障，推动组织高效运行。", roles: ["运营", "财务", "人力"] },
    { code: "W", name: "Operations", nameZh: "操作序列", color: "#96226b", description: "通过标准化流程完成执行工作，保障服务稳定交付。", roles: ["客服", "仓储", "现场运营"] }
  ],
  levels: [
    { id: "ex", code: "EX", series: "EX", name: "Executive", gradeFrom: 15, gradeTo: 24, summary: "负责公司级战略与经营结果。", responsibilities: ["制定组织战略", "统筹跨区域资源", "对经营结果负责"], salaryBand: { currency: "USD", min: 180000, mid: 260000, max: 420000 } },
    { id: "m1", code: "M1", series: "M", name: "Supervisor", gradeFrom: 10, gradeTo: 11, summary: "带领一线团队完成目标。", responsibilities: ["目标拆解与跟进", "团队辅导与招聘"], salaryBand: { currency: "USD", min: 105000, mid: 132000, max: 175000 } },
    { id: "m2", code: "M2", series: "M", name: "Manager", gradeFrom: 11, gradeTo: 12, summary: "管理团队并推动跨部门协作。", responsibilities: ["资源协调", "组织能力建设"], salaryBand: { currency: "USD", min: 123000, mid: 154000, max: 203000 } },
    { id: "p1", code: "P1", series: "P", name: "Entry", gradeFrom: 8, gradeTo: 9, summary: "在指导下完成专业交付。", responsibilities: ["完成专业交付", "沉淀方法"], salaryBand: { currency: "USD", min: 65000, mid: 80000, max: 108000 } },
    { id: "p2", code: "P2", series: "P", name: "Intern.", gradeFrom: 9, gradeTo: 10, summary: "独立负责常规专业工作。", responsibilities: ["独立交付", "影响协作团队"], salaryBand: { currency: "USD", min: 80000, mid: 98000, max: 130000 } },
    { id: "p3", code: "P3", series: "P", name: "Career", gradeFrom: 10, gradeTo: 12, summary: "在专业领域持续产生影响。", responsibilities: ["复杂问题解决", "方法论建设"], salaryBand: { currency: "USD", min: 95000, mid: 116000, max: 152000 } },
    { id: "t1", code: "T1", series: "T", name: "Entry", gradeFrom: 4, gradeTo: 5, summary: "在指导下完成技术任务。", responsibilities: ["方案实现", "质量保障"], salaryBand: { currency: "USD", min: 58000, mid: 72000, max: 96000 } },
    { id: "t2", code: "T2", series: "T", name: "Intern.", gradeFrom: 5, gradeTo: 7, summary: "独立完成模块研发。", responsibilities: ["模块交付", "技术评审"], salaryBand: { currency: "USD", min: 76000, mid: 94000, max: 122000 } },
    { id: "t3", code: "T3", series: "T", name: "Senior", gradeFrom: 7, gradeTo: 9, summary: "负责关键技术方案与质量。", responsibilities: ["架构设计", "技术分享"], salaryBand: { currency: "USD", min: 94000, mid: 116000, max: 148000 } },
    { id: "p4", code: "P4", series: "P", name: "Specialist", gradeFrom: 11, gradeTo: 13, summary: "成为专业领域骨干，解决复杂问题。", responsibilities: ["推动专业实践", "辅导团队成员"], salaryBand: { currency: "USD", min: 110000, mid: 134000, max: 174000 } },
    { id: "p5", code: "P5", series: "P", name: "Expert", gradeFrom: 13, gradeTo: 14, summary: "建立专业标准并影响多个团队。", responsibilities: ["制定专业标准", "影响关键决策"], salaryBand: { currency: "USD", min: 125000, mid: 152000, max: 198000 } },
    { id: "p6", code: "P6", series: "P", name: "Recognized Expert", gradeFrom: 14, gradeTo: 15, summary: "在组织内外具备广泛专业影响力。", responsibilities: ["塑造专业方向", "解决组织级问题"], salaryBand: { currency: "USD", min: 140000, mid: 172000, max: 224000 } },
    { id: "t4", code: "T4", series: "T", name: "Lead/Advanced", gradeFrom: 8, gradeTo: 10, summary: "主导关键技术方向与系统演进。", responsibilities: ["架构规划", "技术影响力建设"], salaryBand: { currency: "USD", min: 112000, mid: 138000, max: 178000 } },
    { id: "s1", code: "S1", series: "S", name: "Entry", gradeFrom: 8, gradeTo: 9, summary: "发展客户并完成基础商业目标。", responsibilities: ["客户开发", "销售执行"], salaryBand: { currency: "USD", min: 62000, mid: 78000, max: 104000 } },
    { id: "s2", code: "S2", series: "S", name: "Intern.", gradeFrom: 9, gradeTo: 11, summary: "独立经营客户并推进转化。", responsibilities: ["客户经营", "商机推进"], salaryBand: { currency: "USD", min: 78000, mid: 98000, max: 128000 } },
    { id: "s3", code: "S3", series: "S", name: "Career", gradeFrom: 11, gradeTo: 13, summary: "负责重点客户与区域增长。", responsibilities: ["关键客户拓展", "销售策略执行"], salaryBand: { currency: "USD", min: 94000, mid: 118000, max: 154000 } },
    { id: "u1", code: "U1", series: "U", name: "Entry", gradeFrom: 4, gradeTo: 5, summary: "完成基础业务支持工作。", responsibilities: ["流程执行", "资料维护"], salaryBand: { currency: "USD", min: 52000, mid: 67000, max: 90000 } },
    { id: "u2", code: "U2", series: "U", name: "Intern.", gradeFrom: 5, gradeTo: 7, summary: "独立负责日常职能支持。", responsibilities: ["流程优化", "跨团队支持"], salaryBand: { currency: "USD", min: 67000, mid: 86000, max: 113000 } },
    { id: "u3", code: "U3", series: "U", name: "Senior", gradeFrom: 7, gradeTo: 8, summary: "负责复杂运营问题与机制建设。", responsibilities: ["机制建设", "风险控制"], salaryBand: { currency: "USD", min: 82000, mid: 105000, max: 136000 } },
    { id: "u4", code: "U4", series: "U", name: "Lead/Advanced", gradeFrom: 8, gradeTo: 10, summary: "引领职能专业方向和运营效率。", responsibilities: ["专业规划", "组织级支持"], salaryBand: { currency: "USD", min: 97000, mid: 126000, max: 164000 } },
    { id: "w1", code: "W1", series: "W", name: "Entry", gradeFrom: 2, gradeTo: 4, summary: "按规范完成基础执行操作。", responsibilities: ["执行标准流程", "记录工作结果"], salaryBand: { currency: "USD", min: 38000, mid: 47000, max: 62000 } },
    { id: "w2", code: "W2", series: "W", name: "Intermediate", gradeFrom: 4, gradeTo: 6, summary: "熟练处理日常服务与操作任务。", responsibilities: ["处理复杂请求", "协助新人上手"], salaryBand: { currency: "USD", min: 47000, mid: 58000, max: 76000 } },
    { id: "w3", code: "W3", series: "W", name: "Senior", gradeFrom: 6, gradeTo: 7, summary: "处理高难度任务并提升服务质量。", responsibilities: ["复杂任务处理", "质量检查"], salaryBand: { currency: "USD", min: 56000, mid: 69000, max: 90000 } },
    { id: "w4", code: "W4", series: "W", name: "Lead/Advanced", gradeFrom: 7, gradeTo: 8, summary: "带领一线执行团队稳定交付。", responsibilities: ["现场协调", "执行标准维护"], salaryBand: { currency: "USD", min: 65000, mid: 80000, max: 104000 } }
  ],
  benchmarks: [
    { id: "benchmark-1", company: "Alibaba", levelCode: "P4", series: "P", salary: 145000, employees: 235000, source: "2026 Q3 薪酬调研" },
    { id: "benchmark-2", company: "ByteDance", levelCode: "P4", series: "P", salary: 162000, employees: 180000, source: "2026 Q3 薪酬调研" },
    { id: "benchmark-3", company: "Tencent", levelCode: "P4", series: "P", salary: 138000, employees: 105000, source: "2026 Q3 薪酬调研" },
    { id: "benchmark-4", company: "Google", levelCode: "T4", series: "T", salary: 210000, employees: 180000, source: "2026 Q3 薪酬调研" },
    { id: "benchmark-5", company: "Microsoft", levelCode: "T4", series: "T", salary: 198000, employees: 220000, source: "2026 Q3 薪酬调研" },
    { id: "benchmark-6", company: "Amazon", levelCode: "T3", series: "T", salary: 176000, employees: 150000, source: "2026 Q3 薪酬调研" },
    { id: "benchmark-7", company: "Meituan", levelCode: "M3", series: "M", salary: 154000, employees: 90000, source: "2026 Q3 薪酬调研" },
    { id: "benchmark-8", company: "Huawei", levelCode: "P5", series: "P", salary: 128000, employees: 207000, source: "2026 Q3 薪酬调研" }
  ],
  currency: "USD", metric: "baseSalary", fxRate: 7.12, asOf: "2026-09-28", requestId: "fallback"
};

export async function getJobLevels(query: JobLevelsQuery, signal?: AbortSignal): Promise<{ data: JobLevelsResponse; fallback: boolean }> {
  const params = new URLSearchParams({ currency: query.currency, metric: query.metric });
  if (query.series) params.set("series", query.series);
  try {
    const response = await fetch(`/api/v1/job-levels?${params.toString()}`, signal ? { signal } : {});
    if (!response.ok) throw new Error(`Job levels request failed (${response.status})`);
    return { data: jobLevelsResponseSchema.parse(await response.json()), fallback: false };
  } catch (error) {
    if (signal?.aborted) throw error;
    const filtered = query.series ? { ...structuredClone(fallback), levels: fallback.levels.filter((level) => level.series === query.series), benchmarks: fallback.benchmarks.filter((item) => item.series === query.series) } : structuredClone(fallback);
    const totalCashFactor = query.metric === "totalCash" ? 1.2 : 1;
    filtered.benchmarks = filtered.benchmarks.map((item) => ({
      ...item,
      salary: Math.round(item.salary * totalCashFactor * (query.currency === "CNY" ? filtered.fxRate : 1))
    }));
    if (totalCashFactor !== 1) filtered.levels = filtered.levels.map((level) => ({
      ...level,
      salaryBand: { ...level.salaryBand, min: Math.round(level.salaryBand.min * totalCashFactor), mid: Math.round(level.salaryBand.mid * totalCashFactor), max: Math.round(level.salaryBand.max * totalCashFactor) }
    }));
    return { data: filtered, fallback: true };
  }
}
