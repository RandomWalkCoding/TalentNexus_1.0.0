import { dashboardActionResponseSchema, dashboardResponseSchema } from "@hr-console/contracts";
import type { DashboardActionResponse, DashboardResponse } from "@hr-console/contracts";

const fallbackDashboard: DashboardResponse = {
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

export async function getDashboard(signal?: AbortSignal): Promise<{ data: DashboardResponse; fallback: boolean }> {
  try {
    const response = await fetch("/api/v1/dashboard", signal ? { signal } : {});
    if (!response.ok) throw new Error(`Dashboard request failed (${response.status})`);
    return { data: dashboardResponseSchema.parse(await response.json()), fallback: false };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { data: structuredClone(fallbackDashboard), fallback: true };
  }
}

export async function dashboardAction(path: string): Promise<DashboardActionResponse> {
  const response = await fetch(path, { method: "POST" });
  const body: unknown = await response.json();
  if (!response.ok) throw new Error("操作未完成，请稍后重试");
  return dashboardActionResponseSchema.parse(body) as DashboardActionResponse;
}
